/**
 * Opus Encoder using WebCodecs API
 *
 * Produces raw Opus frames (not WebM containers) for direct transmission
 * over MOQ transport.
 */

import { MoqClientError } from './errors.js';

/**
 * Opus encoder configuration
 */
export interface OpusEncoderConfig {
  /** Sample rate in Hz (default: 48000) */
  sampleRate?: number;

  /** Number of channels (default: 1 for mono) */
  channels?: number;

  /** Target bitrate in bits per second (default: 64000) */
  bitrate?: number;

  /** Opus frame duration in milliseconds (default: 5). Valid: 2.5, 5, 10, 20, 40, 60 */
  frameDurationMs?: number;

  /** Enable debug logging. Default: false. */
  debug?: boolean;
}

/**
 * Opus frame ready for transmission
 */
export interface OpusFrame {
  /** Raw Opus-encoded data */
  data: Uint8Array;

  /** Timestamp in microseconds */
  timestamp: number;

  /** Duration in microseconds */
  duration: number;
}

/**
 * Callback for encoded frames
 */
export type OpusFrameCallback = (frame: OpusFrame) => void;

/**
 * Check if WebCodecs AudioEncoder with Opus is supported
 */
export function isWebCodecsOpusSupported(): boolean {
  return typeof AudioEncoder !== 'undefined';
}

/**
 * Opus Encoder using WebCodecs
 *
 * Uses the browser's AudioEncoder API to encode PCM audio to raw Opus frames.
 * Unlike MediaRecorder, this produces raw Opus packets without container overhead.
 */
export class OpusEncoder {
  private encoder: AudioEncoder | null = null;
  private config: Required<OpusEncoderConfig>;
  private frameCallback: OpusFrameCallback | null = null;
  private isInitialized = false;

  constructor(config: OpusEncoderConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 48000,
      channels: config.channels ?? 1,
      bitrate: config.bitrate ?? 64000,
      frameDurationMs: config.frameDurationMs ?? 5,
      debug: config.debug ?? false,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[OpusEncoder]', ...args);
    }
  }

  /**
   * Set callback for encoded frames
   */
  onFrame(callback: OpusFrameCallback): void {
    this.frameCallback = callback;
  }

  /**
   * Initialize the encoder
   */
  async initialize(): Promise<void> {
    if (!isWebCodecsOpusSupported()) {
      throw new MoqClientError(
        'WebCodecs AudioEncoder is not supported in this browser',
        'WEBCODECS_NOT_SUPPORTED'
      );
    }

    const frameDurationUs = this.config.frameDurationMs * 1000;

    // Check for Opus support with frame duration
    const encoderConfig: AudioEncoderConfig = {
      codec: 'opus',
      sampleRate: this.config.sampleRate,
      numberOfChannels: this.config.channels,
      bitrate: this.config.bitrate,
      opus: { frameDuration: frameDurationUs },
    } as AudioEncoderConfig;

    const support = await AudioEncoder.isConfigSupported(encoderConfig);

    if (!support.supported) {
      throw new MoqClientError(
        `Opus encoding not supported (frameDuration=${this.config.frameDurationMs}ms)`,
        'OPUS_NOT_SUPPORTED'
      );
    }

    // Create encoder
    this.encoder = new AudioEncoder({
      output: (chunk, metadata) => {
        this.handleEncodedChunk(chunk, metadata);
      },
      error: (error) => {
        console.error('AudioEncoder error:', error);
      },
    });

    // Configure encoder with Opus-specific frame duration
    this.encoder.configure(encoderConfig);

    this.isInitialized = true;
    this.log(`initialized: ${this.config.sampleRate}Hz, ${this.config.channels}ch, ${this.config.bitrate}bps, ${this.config.frameDurationMs}ms frames`);
  }

  /**
   * Encode PCM audio data
   *
   * @param pcmData - Float32 PCM samples (interleaved if stereo)
   * @param timestamp - Timestamp in microseconds
   */
  encode(pcmData: Float32Array, timestamp: number): void {
    if (!this.encoder || !this.isInitialized) {
      throw new MoqClientError('Encoder not initialized', 'NOT_INITIALIZED');
    }

    // Create AudioData from PCM samples
    // Cast to BufferSource to satisfy TypeScript (Float32Array is valid)
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: this.config.sampleRate,
      numberOfFrames: pcmData.length / this.config.channels,
      numberOfChannels: this.config.channels,
      timestamp,
      data: pcmData.buffer as ArrayBuffer,
    });

    try {
      this.encoder.encode(audioData);
    } finally {
      audioData.close();
    }
  }

  /**
   * Flush any pending frames
   */
  async flush(): Promise<void> {
    if (this.encoder && this.encoder.state === 'configured') {
      await this.encoder.flush();
    }
  }

  /**
   * Close the encoder and release resources
   */
  close(): void {
    if (this.encoder) {
      if (this.encoder.state !== 'closed') {
        this.encoder.close();
      }
      this.encoder = null;
    }
    this.isInitialized = false;
  }

  /**
   * Handle encoded chunk from WebCodecs
   */
  private handleEncodedChunk(chunk: EncodedAudioChunk, _metadata?: EncodedAudioChunkMetadata): void {
    // Extract raw Opus data from chunk
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    const frameDurationUs = this.config.frameDurationMs * 1000;
    const frame: OpusFrame = {
      data,
      timestamp: chunk.timestamp,
      duration: chunk.duration ?? frameDurationUs,
    };

    if (this.frameCallback) {
      this.frameCallback(frame);
    }
  }

  /**
   * Get encoder state
   */
  getState(): string {
    return this.encoder?.state ?? 'closed';
  }
}

/**
 * AudioWorklet processor code (runs on the audio rendering thread).
 * Forwards raw PCM samples to the main thread via MessagePort.
 * Each callback delivers 128 samples (one render quantum at any sample rate).
 */
const WORKLET_PROCESSOR_CODE = `
class AudioCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      this.port.postMessage(new Float32Array(input[0]));
    }
    return true;
  }
}
registerProcessor('audio-capture-processor', AudioCaptureProcessor);
`;

/**
 * Audio Capture with Opus Encoding
 *
 * Captures audio from MediaStream using AudioWorklet and encodes to Opus.
 * AudioWorklet delivers 128 samples per render quantum (~2.67ms at 48kHz),
 * which are accumulated to the configured frame size before encoding.
 */
export class AudioCaptureEncoder {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private encoder: OpusEncoder;

  private config: Required<OpusEncoderConfig>;
  private sampleBuffer: Float32Array[] = [];
  private bufferSize = 0;
  private samplesPerFrame: number;
  private frameDurationUs: number;
  private timestampUs = 0;
  private isRunning = false;

  constructor(config: OpusEncoderConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 48000,
      channels: config.channels ?? 1,
      bitrate: config.bitrate ?? 64000,
      frameDurationMs: config.frameDurationMs ?? 5,
      debug: config.debug ?? false,
    };
    this.encoder = new OpusEncoder(this.config);
    this.samplesPerFrame = Math.floor(this.config.sampleRate * this.config.frameDurationMs / 1000);
    this.frameDurationUs = this.config.frameDurationMs * 1000;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[AudioCaptureEncoder]', ...args);
    }
  }

  /**
   * Set callback for encoded Opus frames
   */
  onFrame(callback: OpusFrameCallback): void {
    this.encoder.onFrame(callback);
  }

  /**
   * Start capturing and encoding
   */
  async start(mediaStream: MediaStream): Promise<void> {
    // Initialize encoder
    await this.encoder.initialize();

    // Create audio context
    this.audioContext = new AudioContext({
      sampleRate: this.config.sampleRate,
    });

    // Register AudioWorklet processor via Blob URL
    const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await this.audioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    // Create source from media stream
    this.sourceNode = this.audioContext.createMediaStreamSource(mediaStream);

    // Create worklet node
    this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');

    // Receive PCM samples from the audio thread
    this.workletNode.port.onmessage = (event) => {
      if (!this.isRunning) return;
      this.addSamples(event.data as Float32Array);
    };

    // Connect: source -> worklet (no destination connection needed for capture)
    this.sourceNode.connect(this.workletNode);

    this.isRunning = true;
    this.log(`started (AudioWorklet, ${this.config.frameDurationMs}ms frames, ${this.samplesPerFrame} samples/frame)`);
  }

  /**
   * Add samples to buffer and encode when we have enough
   */
  private addSamples(samples: Float32Array): void {
    this.sampleBuffer.push(samples);
    this.bufferSize += samples.length;

    // Encode when we have enough samples for a frame
    while (this.bufferSize >= this.samplesPerFrame) {
      // Collect samples for one frame
      const frameData = new Float32Array(this.samplesPerFrame);
      let frameOffset = 0;

      while (frameOffset < this.samplesPerFrame && this.sampleBuffer.length > 0) {
        const chunk = this.sampleBuffer[0]!;
        const needed = this.samplesPerFrame - frameOffset;
        const available = chunk.length;

        if (available <= needed) {
          // Use entire chunk
          frameData.set(chunk, frameOffset);
          frameOffset += available;
          this.sampleBuffer.shift();
          this.bufferSize -= available;
        } else {
          // Use part of chunk
          frameData.set(chunk.subarray(0, needed), frameOffset);
          this.sampleBuffer[0] = chunk.subarray(needed);
          this.bufferSize -= needed;
          frameOffset += needed;
        }
      }

      // Encode the frame
      this.encoder.encode(frameData, this.timestampUs);
      this.timestampUs += this.frameDurationUs;
    }
  }

  /**
   * Stop capturing and encoding
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    // Flush encoder
    await this.encoder.flush();

    // Disconnect nodes
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Close audio context
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Close encoder
    this.encoder.close();

    // Clear buffer
    this.sampleBuffer = [];
    this.bufferSize = 0;

    this.log('stopped');
  }

  /**
   * Check if currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
