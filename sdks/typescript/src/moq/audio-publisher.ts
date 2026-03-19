/**
 * Audio Publisher - Captures microphone audio and publishes to MOQ
 *
 * Uses WebCodecs AudioEncoder API for raw Opus encoding (preferred),
 * falling back to MediaRecorder for browsers without WebCodecs support.
 */

import { MoqClientError } from './errors.js';
import { AudioCaptureEncoder, isWebCodecsOpusSupported, type OpusFrame } from './opus-encoder.js';
import type { MicrophoneType } from '../shared/microphone-selection.js';

/**
 * Audio publisher configuration
 */
export interface AudioPublisherConfig {
  /** Sample rate in Hz (default: 48000) */
  sampleRate?: number;

  /** Number of channels (default: 1 for mono) */
  channelCount?: number;

  /** Target bitrate in bits per second (default: 64000) */
  bitrate?: number;

  /** Frame duration in milliseconds (default: 5). Valid: 2.5, 5, 10, 20, 40, 60 */
  frameDurationMs?: number;

  /** Enable echo cancellation (default: true) */
  echoCancellation?: boolean;

  /** Enable noise suppression (default: true) */
  noiseSuppression?: boolean;

  /** Enable auto gain control (default: true) */
  autoGainControl?: boolean;

  /** Microphone device ID. Default: system default. */
  deviceId?: string;

  /** Enable debug logging. Default: false. */
  debug?: boolean;
}

/**
 * Audio publisher state
 */
export enum AudioPublisherState {
  IDLE = 'idle',
  REQUESTING_PERMISSION = 'requesting_permission',
  READY = 'ready',
  RECORDING = 'recording',
  PAUSED = 'paused',
  ERROR = 'error',
}

/**
 * Audio frame data ready for publishing
 */
export interface AudioFrame {
  /** Opus-encoded audio data */
  data: Uint8Array;

  /** Timestamp in milliseconds */
  timestamp: number;

  /** Duration in milliseconds */
  duration: number;
}

/**
 * Event handler for audio frames
 */
export type AudioFrameHandler = (frame: AudioFrame) => void;

/**
 * Error types for audio publisher
 */
export class AudioPermissionError extends MoqClientError {
  constructor(message: string, details?: unknown) {
    super(message, 'AUDIO_PERMISSION_DENIED', details);
    this.name = 'AudioPermissionError';
  }
}

export class AudioEncodingError extends MoqClientError {
  constructor(message: string, details?: unknown) {
    super(message, 'AUDIO_ENCODING_FAILED', details);
    this.name = 'AudioEncodingError';
  }
}

export class AudioNotSupportedError extends MoqClientError {
  constructor(message: string) {
    super(message, 'AUDIO_NOT_SUPPORTED');
    this.name = 'AudioNotSupportedError';
  }
}

/**
 * Error thrown when the default microphone is Bluetooth and no explicit device was chosen.
 * The `availableDevices` field contains all mics with their classification so the app
 * can immediately show a mic picker.
 */
export class BluetoothMicDefaultError extends MoqClientError {
  public readonly availableDevices: Array<{ deviceId: string; label: string; type: MicrophoneType }>;

  constructor(
    defaultLabel: string,
    availableDevices: Array<{ deviceId: string; label: string; type: MicrophoneType }>,
  ) {
    super(
      `Default microphone is Bluetooth (${defaultLabel}). Please select a non-Bluetooth microphone to preserve stereo audio.`,
      'BLUETOOTH_MIC_DEFAULT',
      { defaultLabel, availableDevices },
    );
    this.name = 'BluetoothMicDefaultError';
    this.availableDevices = availableDevices;
  }
}

/**
 * Check if Opus encoding is supported via MediaRecorder
 */
export function isOpusSupported(): boolean {
  if (typeof MediaRecorder === 'undefined') {
    return false;
  }

  // Check for Opus support in various containers
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
  ];

  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the best supported Opus MIME type
 */
export function getBestOpusMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  // Prefer webm with explicit opus codec
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
  ];

  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return null;
}

/**
 * Audio Publisher
 *
 * Captures audio from the microphone, encodes it to Opus, and provides
 * frames for publishing to the MOQ server.
 *
 * Uses WebCodecs AudioEncoder (preferred) for raw Opus output,
 * or MediaRecorder as fallback.
 */
export class AudioPublisher {
  private config: Required<Omit<AudioPublisherConfig, 'deviceId'>> & Pick<AudioPublisherConfig, 'deviceId'>;
  private state: AudioPublisherState = AudioPublisherState.IDLE;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private frameHandler: AudioFrameHandler | null = null;

  // WebCodecs encoder (preferred - produces raw Opus)
  private webCodecsEncoder: AudioCaptureEncoder | null = null;
  private useWebCodecs: boolean = false;

  // Timing
  private startTime: number = 0;
  private frameSequence: number = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[AudioPublisher]', ...args);
    }
  }

  constructor(config: AudioPublisherConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 48000,
      channelCount: config.channelCount ?? 1,
      bitrate: config.bitrate ?? 64000,
      frameDurationMs: config.frameDurationMs ?? 5,
      echoCancellation: config.echoCancellation ?? false,
      noiseSuppression: config.noiseSuppression ?? false,
      autoGainControl: config.autoGainControl ?? false,
      deviceId: config.deviceId,
      debug: config.debug ?? false,
    };

    // Prefer WebCodecs if available (produces raw Opus frames)
    this.useWebCodecs = isWebCodecsOpusSupported();
    if (this.useWebCodecs) {

      this.log('Using WebCodecs for raw Opus encoding');
    } else {
      this.log('WebCodecs not available, using MediaRecorder (WebM container)');
    }
  }

  /**
   * Get current state
   */
  getState(): AudioPublisherState {
    return this.state;
  }

  /**
   * Set handler for audio frames
   */
  onFrame(handler: AudioFrameHandler): void {
    this.frameHandler = handler;
  }

  /**
   * Request microphone access and prepare for recording
   */
  async initialize(): Promise<void> {
    if (this.state !== AudioPublisherState.IDLE) {
      throw new MoqClientError(
        `Cannot initialize: already in state ${this.state}`,
        'INVALID_STATE'
      );
    }

    // Check for getUserMedia support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new AudioNotSupportedError(
        'getUserMedia is not supported in this browser'
      );
    }

    // Check for Opus support
    if (!isOpusSupported()) {
      throw new AudioNotSupportedError(
        'Opus encoding is not supported in this browser. Try Chrome, Firefox, or Edge.'
      );
    }

    this.setState(AudioPublisherState.REQUESTING_PERMISSION);

    try {
      const deviceId = this.config.deviceId;

      // Bluetooth mic check is handled by PanaudiaClient.connect() before
      // transport setup, so both MOQ and WebRTC behave identically.

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.config.channelCount,
          sampleRate: this.config.sampleRate,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
          latency: { ideal: 0.005 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        } as MediaTrackConstraints,
        video: false,
      });

      this.setState(AudioPublisherState.READY);
      this.log('Microphone access granted');
    } catch (error) {
      this.setState(AudioPublisherState.ERROR);

      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          throw new AudioPermissionError(
            'Microphone access denied. Please allow microphone access in your browser settings.',
            error
          );
        } else if (error.name === 'NotFoundError') {
          throw new AudioPermissionError(
            'No microphone found. Please connect a microphone and try again.',
            error
          );
        } else if (error.name === 'NotReadableError') {
          throw new AudioPermissionError(
            'Microphone is in use by another application.',
            error
          );
        }
      }

      throw new AudioPermissionError(
        `Failed to access microphone: ${error}`,
        error
      );
    }
  }

  /**
   * Start recording and encoding audio
   */
  start(): void {
    if (this.state !== AudioPublisherState.READY && this.state !== AudioPublisherState.PAUSED) {
      throw new MoqClientError(
        `Cannot start: must be in READY or PAUSED state, currently ${this.state}`,
        'INVALID_STATE'
      );
    }

    if (!this.mediaStream) {
      throw new MoqClientError('No media stream available', 'INVALID_STATE');
    }

    // Use WebCodecs if available (produces raw Opus frames)
    if (this.useWebCodecs) {
      this.startWebCodecs();
      return;
    }

    // Fallback to MediaRecorder (produces WebM container - not recommended)
    this.startMediaRecorder();
  }

  /**
   * Start encoding using WebCodecs AudioEncoder (preferred - raw Opus)
   */
  private startWebCodecs(): void {
    this.webCodecsEncoder = new AudioCaptureEncoder({
      sampleRate: this.config.sampleRate,
      channels: this.config.channelCount,
      bitrate: this.config.bitrate,
      frameDurationMs: this.config.frameDurationMs,
      debug: this.config.debug,
    });

    // Set up frame handler to convert OpusFrame to AudioFrame
    this.webCodecsEncoder.onFrame((opusFrame: OpusFrame) => {
      if (this.frameHandler) {
        const frame: AudioFrame = {
          data: opusFrame.data,
          timestamp: Math.floor(opusFrame.timestamp / 1000), // Convert us to ms
          duration: Math.floor(opusFrame.duration / 1000),
        };
        this.frameHandler(frame);
      }
    });

    // Start encoding
    this.webCodecsEncoder.start(this.mediaStream!).then(() => {
      this.setState(AudioPublisherState.RECORDING);
      this.log(`Recording started with WebCodecs, ${this.config.bitrate} bps (raw Opus)`);
    }).catch((error) => {
      console.error('Failed to start WebCodecs encoder:', error);
      this.setState(AudioPublisherState.ERROR);
    });
  }

  /**
   * Start encoding using MediaRecorder (fallback - WebM container)
   */
  private startMediaRecorder(): void {
    const mimeType = getBestOpusMimeType();
    if (!mimeType) {
      throw new AudioNotSupportedError('No supported Opus MIME type found');
    }

    // Create MediaRecorder with Opus encoding
    this.mediaRecorder = new MediaRecorder(this.mediaStream!, {
      mimeType,
      audioBitsPerSecond: this.config.bitrate,
    });

    // Handle encoded data
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.handleEncodedData(event.data);
      }
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      this.setState(AudioPublisherState.ERROR);
    };

    this.mediaRecorder.onstop = () => {
      this.log('MediaRecorder stopped');
    };

    // Start recording with timeslice for regular data chunks
    this.startTime = performance.now();
    this.frameSequence = 0;
    this.mediaRecorder.start(this.config.frameDurationMs);
    this.setState(AudioPublisherState.RECORDING);

    this.log(`Recording started with ${mimeType}, ${this.config.bitrate} bps (WARNING: WebM container, server may not decode correctly)`);
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this.state !== AudioPublisherState.RECORDING) {
      return;
    }

    // WebCodecs doesn't have pause - we just stop/start
    // For now, we stop and rely on resume to restart
    if (this.webCodecsEncoder) {
      this.webCodecsEncoder.stop().catch(console.error);
      this.setState(AudioPublisherState.PAUSED);
      return;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.setState(AudioPublisherState.PAUSED);
    }
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.state !== AudioPublisherState.PAUSED) {
      return;
    }

    // WebCodecs: restart encoding
    if (this.useWebCodecs && this.mediaStream) {
      this.startWebCodecs();
      return;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.setState(AudioPublisherState.RECORDING);
    }
  }

  /**
   * Stop recording
   */
  stop(): void {
    // Stop WebCodecs encoder
    if (this.webCodecsEncoder) {
      this.webCodecsEncoder.stop().catch((error) => {
        console.error('Error stopping WebCodecs encoder:', error);
      });
      this.webCodecsEncoder = null;
    }

    // Stop MediaRecorder
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder = null;
    }

    this.setState(AudioPublisherState.READY);
  }

  /**
   * Release all resources
   */
  dispose(): void {
    this.stop();

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    this.frameHandler = null;
    this.setState(AudioPublisherState.IDLE);
  }

  /**
   * Handle encoded audio data from MediaRecorder
   */
  private async handleEncodedData(blob: Blob): Promise<void> {
    try {
      // Convert Blob to Uint8Array
      const arrayBuffer = await blob.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Calculate timestamp
      const timestamp = performance.now() - this.startTime;

      // Create audio frame
      const frame: AudioFrame = {
        data,
        timestamp: Math.floor(timestamp),
        duration: this.config.frameDurationMs,
      };

      this.frameSequence++;

      // Call handler if set
      if (this.frameHandler) {
        this.frameHandler(frame);
      }
    } catch (error) {
      console.error('Error processing encoded audio:', error);
    }
  }

  /**
   * Update state
   */
  private setState(state: AudioPublisherState): void {
    this.state = state;
  }
}

/**
 * Check browser audio capabilities
 */
export function getAudioCapabilities(): {
  getUserMedia: boolean;
  mediaRecorder: boolean;
  opusSupport: boolean;
  bestMimeType: string | null;
  webCodecs: boolean;
  preferredEncoder: 'webcodecs' | 'mediarecorder' | 'none';
} {
  const webCodecs = isWebCodecsOpusSupported();
  const mediaRecorder = isOpusSupported();

  let preferredEncoder: 'webcodecs' | 'mediarecorder' | 'none' = 'none';
  if (webCodecs) {
    preferredEncoder = 'webcodecs';
  } else if (mediaRecorder) {
    preferredEncoder = 'mediarecorder';
  }

  return {
    getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    opusSupport: mediaRecorder,
    bestMimeType: getBestOpusMimeType(),
    webCodecs,
    preferredEncoder,
  };
}
