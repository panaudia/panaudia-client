/**
 * Audio Player - Decodes Opus and plays via Web Audio API
 *
 * Uses the WebCodecs AudioDecoder API to decode Opus frames,
 * then plays them through the Web Audio API with buffering
 * to handle network jitter.
 */

import { MoqClientError } from './errors.js';

/**
 * Audio player configuration
 */
export interface AudioPlayerConfig {
  /** Sample rate (default: 48000) */
  sampleRate?: number;

  /** Number of channels (default: 2 for stereo) */
  channelCount?: number;

  /** Target jitter buffer size in seconds (default: 0.03 = 30ms) */
  bufferSize?: number;

  /** Maximum buffer before clamping in seconds (default: 0.15 = 150ms) */
  maxBufferSize?: number;

  /** Latency hint for AudioContext */
  latencyHint?: AudioContextLatencyCategory;

  /** Enable debug logging. Default: false. */
  debug?: boolean;
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

  /** Total samples played */
  samplesPlayed: number;

  /** Buffer underruns (gaps in playback) */
  underruns: number;

  /** Current buffer level in seconds */
  bufferLevel: number;

  /** Decode errors */
  decodeErrors: number;
}

/**
 * Audio Player
 *
 * Decodes Opus audio and plays it through the Web Audio API.
 */
export class AudioPlayer {
  private config: Required<AudioPlayerConfig>;
  private state: AudioPlayerState = AudioPlayerState.IDLE;

  // Web Audio API
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;

  // WebCodecs decoder
  private decoder: AudioDecoder | null = null;

  // Playback scheduling
  private nextPlayTime: number = 0;
  private scheduledBuffers: AudioBufferSourceNode[] = [];

  // Statistics
  private stats: AudioPlayerStats = {
    framesDecoded: 0,
    samplesPlayed: 0,
    underruns: 0,
    bufferLevel: 0,
    decodeErrors: 0,
  };

  constructor(config: AudioPlayerConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 48000,
      channelCount: config.channelCount ?? 2,
      bufferSize: config.bufferSize ?? 0.03,
      maxBufferSize: config.maxBufferSize ?? 0.15,
      latencyHint: config.latencyHint ?? 'interactive',
      debug: config.debug ?? false,
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
    return { ...this.stats };
  }

  /**
   * Initialize the audio player
   *
   * This creates the AudioContext and AudioDecoder.
   * Must be called in response to a user gesture on some browsers.
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

      // Create AudioDecoder
      this.decoder = new AudioDecoder({
        output: (audioData: AudioData) => this.handleDecodedAudio(audioData),
        error: (error: DOMException) => this.handleDecodeError(error),
      });

      // Configure decoder
      this.decoder.configure({
        codec: 'opus',
        sampleRate: this.config.sampleRate,
        numberOfChannels: this.config.channelCount,
      });

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);

      this.state = AudioPlayerState.READY;
      this.log('initialized');
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

    // Initialize next play time to current time plus buffer
    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime + this.config.bufferSize;
    }

    this.state = AudioPlayerState.PLAYING;
    this.log('started');
  }

  /**
   * Stop playback
   */
  stop(): void {
    // Stop all scheduled buffers
    for (const source of this.scheduledBuffers) {
      try {
        source.stop();
      } catch {
        // Ignore errors from already stopped sources
      }
    }
    this.scheduledBuffers = [];

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

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.state = AudioPlayerState.IDLE;
    this.log('disposed');
  }

  /**
   * Handle decoded audio data
   */
  private handleDecodedAudio(audioData: AudioData): void {
    if (!this.audioContext || this.state !== AudioPlayerState.PLAYING) {
      audioData.close();
      return;
    }

    try {
      // Create AudioBuffer from AudioData
      const buffer = this.audioContext.createBuffer(
        audioData.numberOfChannels,
        audioData.numberOfFrames,
        audioData.sampleRate
      );

      // Copy audio data to buffer
      for (let channel = 0; channel < audioData.numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        audioData.copyTo(channelData, {
          planeIndex: channel,
          format: 'f32-planar',
        });
      }

      // Schedule playback
      this.scheduleBuffer(buffer);

      // Update stats
      this.stats.framesDecoded++;
      this.stats.samplesPlayed += audioData.numberOfFrames;

      // Calculate buffer level
      if (this.audioContext) {
        this.stats.bufferLevel = Math.max(
          0,
          this.nextPlayTime - this.audioContext.currentTime
        );
      }
    } finally {
      audioData.close();
    }
  }

  /**
   * Schedule an audio buffer for playback
   */
  private scheduleBuffer(buffer: AudioBuffer): void {
    if (!this.audioContext) {
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode ?? this.audioContext.destination);

    const currentTime = this.audioContext.currentTime;

    if (this.nextPlayTime < currentTime) {
      // Underrun — reset schedule point ahead by the target buffer amount
      this.stats.underruns++;
      this.nextPlayTime = currentTime + this.config.bufferSize;
    } else if (this.nextPlayTime > currentTime + this.config.maxBufferSize) {
      // Buffer has grown too large (e.g. tab was backgrounded) — reset to target
      this.nextPlayTime = currentTime + this.config.bufferSize;
    }

    // Schedule playback at the precise time
    source.start(this.nextPlayTime);

    // Track scheduled buffers for cleanup
    this.scheduledBuffers.push(source);
    source.onended = () => {
      const index = this.scheduledBuffers.indexOf(source);
      if (index > -1) {
        this.scheduledBuffers.splice(index, 1);
      }
    };

    // Advance schedule point by this buffer's duration
    this.nextPlayTime += buffer.duration;
  }

  /**
   * Handle decode error
   */
  private handleDecodeError(error: DOMException): void {
    console.error('Audio decode error:', error);
    this.stats.decodeErrors++;
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
