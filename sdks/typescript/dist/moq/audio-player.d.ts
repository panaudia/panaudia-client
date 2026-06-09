import { MoqClientError } from './errors.js';
import { JitterBufferCoreConfig, JitterBufferSnapshot } from './jitter-buffer-core.js';
/**
 * How the receive Worker should receive decoded PCM (design §11.3). `sab` is the
 * real-time-safe path (shared ring, no postMessage) used when the page is
 * cross-origin isolated; `port` is the non-isolated fallback.
 */
export type WorkerPcmHandoff = {
    mode: 'sab';
    jbufConfig: JitterBufferCoreConfig;
    sharedStorage: Float32Array;
    sharedWritePos: BigInt64Array;
} | {
    mode: 'port';
    pcmPort: MessagePort;
};
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
export declare enum AudioPlayerState {
    IDLE = "idle",
    INITIALIZING = "initializing",
    READY = "ready",
    PLAYING = "playing",
    ERROR = "error"
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
export declare class AudioPlayer {
    private config;
    private state;
    private audioContext;
    private gainNode;
    private workletNode;
    private decoder;
    private lastSnapshot;
    private decodeStats;
    private jbufLogCount;
    private workerDecodeMode;
    private sharedStorage;
    private sharedWritePos;
    private jbConfigBase;
    constructor(config?: AudioPlayerConfig);
    private log;
    /**
     * Get current state
     */
    getState(): AudioPlayerState;
    /**
     * Get statistics
     */
    getStats(): AudioPlayerStats;
    /**
     * Get the rich v3 jitter-buffer snapshot (live L/H, fill, corrections, …) for
     * tuning/observability, or null if no snapshot has arrived yet.
     */
    getJitterStats(): JitterBufferSnapshot | null;
    /** The decoder config the receive Worker should use (mirrors this player's config). */
    getDecoderConfig(): {
        codec: string;
        sampleRate: number;
        numberOfChannels: number;
    };
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
    prepareForWorker(): WorkerPcmHandoff | null;
    /**
     * Initialize the audio player
     *
     * This creates the AudioContext, loads the playout worklet, and creates the
     * AudioDecoder. Must be called in response to a user gesture on some browsers.
     */
    initialize(): Promise<void>;
    /**
     * Start playback
     */
    start(): void;
    /**
     * Stop playback. The worklet keeps running (and drains to silence); no new
     * frames are written until PLAYING resumes.
     */
    stop(): void;
    /**
     * Pause playback
     */
    pause(): void;
    /**
     * Resume playback
     */
    resume(): void;
    /**
     * Set playback volume.
     * @param volume - Volume level from 0.0 (silent) to 1.0 (full volume).
     */
    setVolume(volume: number): void;
    /**
     * Get current playback volume.
     */
    getVolume(): number;
    /**
     * Decode an Opus frame
     *
     * @param opusData - Opus-encoded audio data
     * @param timestamp - Frame timestamp in microseconds (optional)
     */
    decodeFrame(opusData: Uint8Array, timestamp?: number): void;
    /**
     * Release all resources
     */
    dispose(): Promise<void>;
    /**
     * Handle decoded audio data: copy interleaved PCM and transfer it to the
     * worklet ring (zero-copy). The worklet does all buffering and playout.
     */
    private handleDecodedAudio;
    /**
     * One-line [JBUF] observation log — the browser analog of the Go server's
     * [JBUF] tuning line (design §10 / plan Phase 4). Gated by `debug`; throttled
     * to ~1/s (the worklet posts stats ~4/s). Filter devtools by "JBUF" during soak.
     */
    private logJitter;
    /**
     * Handle decode error
     */
    private handleDecodeError;
}
/**
 * Error thrown when WebCodecs AudioDecoder is not supported
 */
export declare class AudioDecoderNotSupportedError extends MoqClientError {
    constructor(message: string);
}
/**
 * Check if audio playback is supported
 */
export declare function isAudioPlaybackSupported(): boolean;
/**
 * Get audio playback capabilities
 */
export declare function getAudioPlaybackCapabilities(): Promise<{
    audioContext: boolean;
    webCodecs: boolean;
    opusDecoding: boolean;
}>;
//# sourceMappingURL=audio-player.d.ts.map