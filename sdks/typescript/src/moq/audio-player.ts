/**
 * Audio Player - Decodes Opus and plays via a v3 jitter-buffer AudioWorklet.
 *
 * Decodes Opus with the WebCodecs AudioDecoder (main thread), then transfers the
 * decoded PCM to the {@link PlayoutRingProcessor} worklet, which holds the
 * adaptive jitter buffer and pulls it at the render quantum. This replaces the
 * previous static "schedule-ahead" model (a fixed 30 ms `AudioBufferSourceNode`
 * lead with no drift reconciliation) — see
 * spatial-mixer/plan/browser-audio/playout-v3-design.md.
 *
 * The public API is unchanged from the schedule-ahead version (drop-in).
 */

import { MoqClientError } from './errors.js';
import { createPlayoutWorkletUrl, PLAYOUT_PROCESSOR_NAME, type PlayoutProcessorOptions, type PlayoutStatsMessage } from './playout-worklet.js';
import { computeJitterCapacity, type JitterBufferCoreConfig, type JitterBufferSnapshot } from './jitter-buffer-core.js';

/**
 * How the receive Worker should receive decoded PCM (design §11.3). `sab` is the
 * real-time-safe path (shared ring, no postMessage) used when the page is
 * cross-origin isolated; `port` is the non-isolated fallback.
 */
export type WorkerPcmHandoff =
  | { mode: 'sab'; jbufConfig: JitterBufferCoreConfig; sharedStorage: Float32Array; sharedWritePos: BigInt64Array }
  | { mode: 'port'; pcmPort: MessagePort };

/** The AudioWorklet render quantum (frames per process() call) — fixed by the spec. */
const RENDER_QUANTUM = 128;
/** Default writer frame for geometry: the server's Opus output frame (5 ms @ 48 kHz). */
const DEFAULT_WRITER_FRAME = 240;

/**
 * Audio player configuration
 */
export interface AudioPlayerConfig {
  /** Sample rate (default: 48000) */
  sampleRate?: number;

  /** Number of channels (default: 2 for stereo/binaural) */
  channelCount?: number;

  /** @deprecated The v3 worklet buffer is adaptive; this static lead is ignored. */
  bufferSize?: number;

  /** @deprecated The v3 worklet buffer is adaptive; this static clamp is ignored. */
  maxBufferSize?: number;

  /** Latency hint for AudioContext */
  latencyHint?: AudioContextLatencyCategory;

  /** Enable debug logging. Default: false. */
  debug?: boolean;

  /** Writer frame (server's Opus output) in samples, for buffer geometry. Default 240 (5 ms @ 48 kHz). */
  writerFrameSamples?: number;

  /**
   * Advanced: override v3 jitter-buffer tuning (safety, low/high allowances,
   * windowReads, …). Merged over the derived geometry; see JitterBufferCoreConfig.
   */
  jitterConfig?: Partial<JitterBufferCoreConfig>;
}

/**
 * Audio player state
 */
export enum AudioPlayerState {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  READY = 'ready',
  PLAYING = 'playing',
  ERROR = 'error',
}

/**
 * Audio player statistics
 */
export interface AudioPlayerStats {
  /** Total frames decoded */
  framesDecoded: number;

  /** Total samples played (decoded and handed to the buffer) */
  samplesPlayed: number;

  /** Buffer underruns (gaps in playback), from the worklet */
  underruns: number;

  /** Current buffer level in seconds, from the worklet */
  bufferLevel: number;

  /** Decode errors */
  decodeErrors: number;
}

/**
 * Audio Player
 *
 * Decodes Opus audio and plays it through a v3 jitter-buffer AudioWorklet.
 */
export class AudioPlayer {
  private config: Required<Omit<AudioPlayerConfig, 'jitterConfig'>> & { jitterConfig: Partial<JitterBufferCoreConfig> };
  private state: AudioPlayerState = AudioPlayerState.IDLE;

  // Web Audio API
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private workletNode: AudioWorkletNode | null = null;

  // WebCodecs decoder
  private decoder: AudioDecoder | null = null;

  // Latest stats snapshot pushed from the worklet.
  private lastSnapshot: JitterBufferSnapshot | null = null;

  // Main-thread decode counters (the worklet owns playout/buffer stats).
  private decodeStats = { framesDecoded: 0, samplesPlayed: 0, decodeErrors: 0 };

  // Throttle counter for the [JBUF] observation log.
  private jbufLogCount = 0;

  // CLOCKTEST (playout-drift investigation): audio-output (DAC) clock vs wall clock.
  // Compares audioContext.currentTime advance to performance.now() advance over ~60s —
  // the decisive check for whether the audio device clock really differs from the
  // CPU/server clock by the suspected ~290 ppm. Fires once.
  private clockT0Wall = 0;
  private clockT0Ctx = 0;
  private clockLogged = false;

  // Worker mode: when the receive Worker decodes (design §11), AudioPlayer's own
  // main-thread AudioDecoder is bypassed (decodeFrame becomes a no-op) and PCM
  // reaches the worklet ring via the SAB (or the pcmPort fallback).
  private workerDecodeMode = false;

  // SAB ring (design §11.3, set in initialize() when the page is cross-origin
  // isolated). The worklet reads this shared ring; the writer (worker, or the
  // main-thread decoder in fallback) writes it. Null ⇒ postMessage path.
  private sharedStorage: Float32Array | null = null;
  private sharedWritePos: BigInt64Array | null = null;
  private jbConfigBase: JitterBufferCoreConfig | null = null;

  constructor(config: AudioPlayerConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 48000,
      channelCount: config.channelCount ?? 2,
      bufferSize: config.bufferSize ?? 0.03,
      maxBufferSize: config.maxBufferSize ?? 0.15,
      latencyHint: config.latencyHint ?? 'interactive',
      debug: config.debug ?? false,
      writerFrameSamples: config.writerFrameSamples ?? DEFAULT_WRITER_FRAME,
      jitterConfig: config.jitterConfig ?? {},
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[AudioPlayer]', ...args);
    }
  }

  /**
   * Get current state
   */
  getState(): AudioPlayerState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): AudioPlayerStats {
    const snap = this.lastSnapshot;
    return {
      framesDecoded: this.decodeStats.framesDecoded,
      samplesPlayed: this.decodeStats.samplesPlayed,
      underruns: snap ? snap.underruns : 0,
      bufferLevel: snap ? snap.fillMs / 1000 : 0,
      decodeErrors: this.decodeStats.decodeErrors,
    };
  }

  /**
   * Get the rich v3 jitter-buffer snapshot (live L/H, fill, corrections, …) for
   * tuning/observability, or null if no snapshot has arrived yet.
   */
  getJitterStats(): JitterBufferSnapshot | null {
    return this.lastSnapshot ? { ...this.lastSnapshot } : null;
  }

  /** The decoder config the receive Worker should use (mirrors this player's config). */
  getDecoderConfig(): { codec: string; sampleRate: number; numberOfChannels: number } {
    return { codec: 'opus', sampleRate: this.config.sampleRate, numberOfChannels: this.config.channelCount };
  }

  /**
   * Prepare to hand decode off to the receive Worker (design §11.3) and flip this
   * player into worker-decode mode (its own `decodeFrame` becomes a no-op).
   * Returns how the worker should deliver PCM:
   *  - **`sab`**: the worklet already reads a SharedArrayBuffer ring (cross-origin
   *    isolated); the worker constructs a writer view of the same ring and writes
   *    directly — real-time-safe, no `postMessage`.
   *  - **`port`**: fallback — a MessageChannel whose worklet end is handed to the
   *    worklet here; the worker posts PCM frames over it.
   * Must be called after {@link initialize}. Returns null if the worklet isn't ready.
   */
  prepareForWorker(): WorkerPcmHandoff | null {
    if (!this.workletNode) return null;
    this.workerDecodeMode = true;
    if (this.sharedStorage && this.sharedWritePos && this.jbConfigBase) {
      this.log('worker-decode mode: SAB ring (no postMessage for PCM)');
      return {
        mode: 'sab',
        jbufConfig: this.jbConfigBase,
        sharedStorage: this.sharedStorage,
        sharedWritePos: this.sharedWritePos,
      };
    }
    const channel = new MessageChannel();
    this.workletNode.port.postMessage({ type: 'pcmPort', port: channel.port2 }, [channel.port2]);
    this.log('worker-decode mode: pcmPort fallback (page is not cross-origin isolated)');
    return { mode: 'port', pcmPort: channel.port1 };
  }

  /**
   * Initialize the audio player
   *
   * This creates the AudioContext, loads the playout worklet, and creates the
   * AudioDecoder. Must be called in response to a user gesture on some browsers.
   */
  async initialize(): Promise<void> {
    if (this.state !== AudioPlayerState.IDLE) {
      throw new MoqClientError(
        `Cannot initialize: already in state ${this.state}`,
        'INVALID_STATE'
      );
    }

    this.state = AudioPlayerState.INITIALIZING;

    try {
      // Create AudioContext
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
        latencyHint: this.config.latencyHint,
      });

      // Check WebCodecs support
      if (typeof AudioDecoder === 'undefined') {
        throw new AudioDecoderNotSupportedError(
          'WebCodecs AudioDecoder is not supported in this browser'
        );
      }

      // Check Opus support
      const support = await AudioDecoder.isConfigSupported({
        codec: 'opus',
        sampleRate: this.config.sampleRate,
        numberOfChannels: this.config.channelCount,
      });

      if (!support.supported) {
        throw new AudioDecoderNotSupportedError(
          'Opus decoding is not supported in this browser'
        );
      }

      // Load the playout worklet (Blob URL; addModule copies it, so revoke after).
      const url = createPlayoutWorkletUrl();
      try {
        await this.audioContext.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }

      // Build the v3 buffer geometry. R = render quantum; W = server Opus frame.
      const jbConfig: JitterBufferCoreConfig = {
        sampleRate: this.audioContext.sampleRate,
        numChannels: this.config.channelCount,
        readerFrame: RENDER_QUANTUM,
        writerFrame: this.config.writerFrameSamples,
        ...this.config.jitterConfig,
      };
      this.jbConfigBase = jbConfig;

      // Cross-origin isolated ⇒ back the ring with a SharedArrayBuffer so the
      // writer (receive Worker, or the main-thread decoder in fallback) can feed
      // it without postMessage — the real-time-safe path (design §11.3). The
      // worklet reads the same shared ring. Sized from the SAME config so the
      // worker's writer view computes an identical capacity.
      let workletConfig: JitterBufferCoreConfig = jbConfig;
      if (typeof SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated === true) {
        const { capacity, nc } = computeJitterCapacity(jbConfig);
        this.sharedStorage = new Float32Array(new SharedArrayBuffer(capacity * nc * 4));
        this.sharedWritePos = new BigInt64Array(new SharedArrayBuffer(8));
        workletConfig = { ...jbConfig, sharedStorage: this.sharedStorage, sharedWritePos: this.sharedWritePos };
        this.log(`SAB ring active (capacity=${capacity} frames, nc=${nc})`);
      } else {
        this.log('SAB unavailable (not cross-origin isolated) — PCM via postMessage');
      }

      this.workletNode = new AudioWorkletNode(this.audioContext, PLAYOUT_PROCESSOR_NAME, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [this.config.channelCount],
        processorOptions: { config: workletConfig } satisfies PlayoutProcessorOptions,
      });
      this.workletNode.port.onmessage = (e: MessageEvent) => {
        const msg = e.data as PlayoutStatsMessage;
        if (msg && msg.type === 'stats') {
          this.lastSnapshot = msg.snapshot;
          this.logJitter(msg.snapshot, msg.fillMin, msg.fillMax);
          this.clockProbe();
        }
      };

      // Create gain node for volume control: worklet -> gain -> destination.
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.workletNode.connect(this.gainNode);

      // Create AudioDecoder; its output is transferred to the worklet ring.
      this.decoder = new AudioDecoder({
        output: (audioData: AudioData) => this.handleDecodedAudio(audioData),
        error: (error: DOMException) => this.handleDecodeError(error),
      });
      this.decoder.configure({
        codec: 'opus',
        sampleRate: this.config.sampleRate,
        numberOfChannels: this.config.channelCount,
        // Real-time hint: don't batch input chunks before emitting output.
        // (Not yet in lib.dom AudioDecoderConfig; honored at runtime, ignored if unknown.)
        optimizeForLatency: true,
      } as AudioDecoderConfig & { optimizeForLatency: boolean });

      this.state = AudioPlayerState.READY;
      this.log('initialized (v3 worklet playout)');
    } catch (error) {
      this.state = AudioPlayerState.ERROR;
      throw error;
    }
  }

  /**
   * Start playback
   */
  start(): void {
    if (this.state !== AudioPlayerState.READY && this.state !== AudioPlayerState.PLAYING) {
      throw new MoqClientError(
        `Cannot start: must be in READY state, currently ${this.state}`,
        'INVALID_STATE'
      );
    }

    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }

    this.state = AudioPlayerState.PLAYING;
    this.log('started');
  }

  /**
   * Stop playback. The worklet keeps running (and drains to silence); no new
   * frames are written until PLAYING resumes.
   */
  stop(): void {
    this.state = AudioPlayerState.READY;
    this.log('stopped');
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.audioContext?.state === 'running') {
      this.audioContext.suspend();
    }
  }

  /**
   * Resume playback
   */
  resume(): void {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  /**
   * Set playback volume.
   * @param volume - Volume level from 0.0 (silent) to 1.0 (full volume).
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get current playback volume.
   */
  getVolume(): number {
    return this.gainNode?.gain.value ?? 1;
  }

  /**
   * Decode an Opus frame
   *
   * @param opusData - Opus-encoded audio data
   * @param timestamp - Frame timestamp in microseconds (optional)
   */
  decodeFrame(opusData: Uint8Array, timestamp?: number): void {
    // In worker-decode mode the receive Worker owns decode; ignore any stray
    // main-thread frame so we never double-write the ring (design §11.5).
    if (this.workerDecodeMode) return;
    if (!this.decoder) {
      throw new MoqClientError('Decoder not initialized', 'NOT_INITIALIZED');
    }

    if (this.decoder.state === 'closed') {
      throw new MoqClientError('Decoder is closed', 'DECODER_CLOSED');
    }

    const chunk = new EncodedAudioChunk({
      type: 'key', // Opus frames are always key frames
      timestamp: timestamp ?? performance.now() * 1000,
      data: opusData,
    });

    this.decoder.decode(chunk);
  }

  /**
   * Release all resources
   */
  async dispose(): Promise<void> {
    this.stop();

    if (this.decoder) {
      if (this.decoder.state !== 'closed') {
        this.decoder.close();
      }
      this.decoder = null;
    }

    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      try {
        this.workletNode.disconnect();
      } catch {
        // already disconnected
      }
      this.workletNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.lastSnapshot = null;
    this.state = AudioPlayerState.IDLE;
    this.log('disposed');
  }

  /**
   * Handle decoded audio data: copy interleaved PCM and transfer it to the
   * worklet ring (zero-copy). The worklet does all buffering and playout.
   */
  private handleDecodedAudio(audioData: AudioData): void {
    try {
      if (this.state !== AudioPlayerState.PLAYING || !this.workletNode) {
        return;
      }
      const frames = audioData.numberOfFrames;
      const channels = audioData.numberOfChannels;
      const pcm = new Float32Array(frames * channels);
      // Interleaved copy (single plane) — matches the buffer's interleaved ring.
      audioData.copyTo(pcm, { planeIndex: 0, format: 'f32' });
      this.workletNode.port.postMessage(pcm, [pcm.buffer]);

      this.decodeStats.framesDecoded++;
      this.decodeStats.samplesPlayed += frames;
    } finally {
      audioData.close();
    }
  }

  /**
   * One-line [JBUF] observation log — the browser analog of the Go server's
   * [JBUF] tuning line (design §10 / plan Phase 4). Gated by `debug`; throttled
   * to ~1/s (the worklet posts stats ~4/s). Filter devtools by "JBUF" during soak.
   */
  /**
   * CLOCKTEST: compare the audio-output (DAC) clock to the wall clock. `currentTime`
   * advances in the audio render domain; `performance.now()` in the CPU domain. Over
   * ~60s, if the DAC is slower than the CPU/server clock, `currentTime` advances less →
   * negative ppm — which is exactly what produces the drop-dominant ±1 splices. Fires
   * once. Logged unconditionally (it's a deliberate diagnostic).
   */
  private clockProbe(): void {
    if (this.clockLogged || !this.audioContext) return;
    const wall = performance.now();
    const ctxMs = this.audioContext.currentTime * 1000;
    if (this.clockT0Wall === 0) {
      this.clockT0Wall = wall;
      this.clockT0Ctx = ctxMs;
      // Reader-burst probe: the hardware render buffer. If baseLatency ≈ the [JBUF]
      // `fill` swing amplitude (~10–15 ms), the drops are the worklet consuming in
      // device-buffer-sized clumps (not drift) — frames pile up during its idle gaps
      // and clip the high threshold.
      const ctx = this.audioContext as AudioContext & { outputLatency?: number };
      const base = (ctx.baseLatency ?? 0) * 1000;
      const out = (ctx.outputLatency ?? 0) * 1000;
      console.log(
        `[CLOCKTEST] AudioContext baseLatency=${base.toFixed(2)}ms outputLatency=${out.toFixed(2)}ms ` +
          `sampleRate=${this.audioContext.sampleRate} (render-buffer ≈ fill-swing if reader-burst is the cause)`
      );
      return;
    }
    const dWall = wall - this.clockT0Wall;
    if (dWall < 60000) return;
    const dCtx = ctxMs - this.clockT0Ctx;
    const ppm = (dCtx / dWall - 1) * 1e6;
    console.log(
      `[CLOCKTEST] audio(DAC) clock vs wall: currentTime +${dCtx.toFixed(1)}ms vs performance.now +${dWall.toFixed(1)}ms over ~60s ` +
        `→ DAC drift ${ppm >= 0 ? '+' : ''}${ppm.toFixed(1)} ppm (negative = DAC slower than CPU; that's the drop source)`
    );
    this.clockLogged = true;
  }

  private logJitter(s: JitterBufferSnapshot, fillMin?: number, fillMax?: number): void {
    if (!this.config.debug) return;
    if (this.jbufLogCount++ % 4 !== 0) return;
    const srMs = this.config.sampleRate / 1000;
    // True window swing (every read) — the real sawtooth the 250ms point-sample misses.
    const swing =
      fillMin !== undefined && fillMax !== undefined
        ? ` swing=${(fillMin / srMs).toFixed(1)}-${(fillMax / srMs).toFixed(1)}ms`
        : '';
    console.log(
      `[JBUF] fill=${s.fillMs.toFixed(1)}ms${swing} L=${s.lowAllowanceMs.toFixed(1)} H=${s.highAllowanceMs.toFixed(1)} ` +
        `tgt=${s.targetFrames}fr zone=${s.zone} win=${s.lastWindowInserts}/${s.lastWindowDrops} ` +
        `und=${s.underruns} ovr=${s.overruns} lap=${s.laps} ins=${s.samplesInserted} drop=${s.samplesDropped}`
    );
  }

  /**
   * Handle decode error
   */
  private handleDecodeError(error: DOMException): void {
    console.error('Audio decode error:', error);
    this.decodeStats.decodeErrors++;
  }
}

/**
 * Error thrown when WebCodecs AudioDecoder is not supported
 */
export class AudioDecoderNotSupportedError extends MoqClientError {
  constructor(message: string) {
    super(message, 'AUDIO_DECODER_NOT_SUPPORTED');
    this.name = 'AudioDecoderNotSupportedError';
  }
}

/**
 * Check if audio playback is supported
 */
export function isAudioPlaybackSupported(): boolean {
  return (
    typeof AudioContext !== 'undefined' &&
    typeof AudioDecoder !== 'undefined'
  );
}

/**
 * Get audio playback capabilities
 */
export async function getAudioPlaybackCapabilities(): Promise<{
  audioContext: boolean;
  webCodecs: boolean;
  opusDecoding: boolean;
}> {
  const hasAudioContext = typeof AudioContext !== 'undefined';
  const hasWebCodecs = typeof AudioDecoder !== 'undefined';

  let opusDecoding = false;
  if (hasWebCodecs) {
    try {
      const support = await AudioDecoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      opusDecoding = support.supported ?? false;
    } catch {
      opusDecoding = false;
    }
  }

  return {
    audioContext: hasAudioContext,
    webCodecs: hasWebCodecs,
    opusDecoding,
  };
}
