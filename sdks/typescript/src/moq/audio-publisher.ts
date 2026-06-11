/**
 * Audio Publisher — captures microphone audio into a SharedArrayBuffer ring for the
 * MOQ worker to Opus-encode and send (worker-capture-design.md §6, plan Phase 5).
 *
 * This is the send-side mirror of `AudioPlayer`: it owns the capture half of the Web
 * Audio graph on the MAIN thread (getUserMedia → AudioContext → capture AudioWorklet)
 * but does **no encoding** — the worklet interleaves each render quantum straight into a
 * SAB ring (`CaptureRing`), and the worker drains/encodes/frames/sends it off the main
 * thread. Main never touches mic PCM and does zero per-frame audio work.
 *
 * Cross-origin isolation (COOP/COEP) is REQUIRED — the SAB ring is the transport from
 * the worklet to the worker; there is no non-isolated fallback for capture (the old
 * main-thread encode path is gone). `getCaptureHandoff()` hands the shared ring +
 * geometry to `PanaudiaMoqClient`, which passes it to the worker via `setCaptureTrack`.
 */

import { MoqClientError } from './errors.js';
import { isWebCodecsOpusSupported } from './opus-encoder.js';
import { createCaptureWorkletUrl, CAPTURE_PROCESSOR_NAME, type CaptureProcessorOptions } from './capture-worklet.js';
import { captureCapacityFrames } from './capture-ring.js';
import type { WorkerEncoderConfig } from './moq-worker-protocol.js';
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

  /** Enable echo cancellation (default: false) */
  echoCancellation?: boolean;

  /** Enable noise suppression (default: false) */
  noiseSuppression?: boolean;

  /** Enable auto gain control (default: false) */
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
 * @deprecated The publisher no longer emits encoded frames on the main thread —
 * encoding moved to the worker (worker-capture-design.md). Kept as an exported type
 * for API compatibility only.
 */
export interface AudioFrame {
  data: Uint8Array;
  timestamp: number;
  duration: number;
}

/** @deprecated See {@link AudioFrame}. */
export type AudioFrameHandler = (frame: AudioFrame) => void;

/**
 * The shared capture ring + geometry handed to the worker (via `setCaptureTrack`). The
 * worklet is the producer of this ring; the worker constructs a consumer `CaptureRing`
 * over the same SAB cells.
 */
export interface CaptureHandoff {
  numChannels: number;
  capacityFrames: number;
  sharedStorage: Float32Array;
  sharedWritePos: BigInt64Array;
  sharedReadPos: BigInt64Array;
  /** §6.1 wake cell: the worklet notifies it, the worker waits on it. */
  sharedSignal: Int32Array;
}

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
 * @deprecated No longer thrown (2026-06-11). Pre-connect Bluetooth gating was
 * removed after cross-browser testing showed it helps nowhere: Chrome manages
 * a Bluetooth default sensibly itself, Firefox collapses to mono regardless of
 * mic choice, and on Safari the gating flow itself triggered HFP.
 * `PanaudiaClient.connect()` now emits a non-blocking 'warning'
 * (BLUETOOTH_MIC / BLUETOOTH_MIC_DEFAULT) instead, and an actual collapse is
 * detected post-connect via `probeOutputDeviceSampleRate()`. Kept only so
 * existing imports keep compiling; will be removed in a future release.
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
 * Check if Opus encoding is supported via MediaRecorder (diagnostic helper).
 */
export function isOpusSupported(): boolean {
  if (typeof MediaRecorder === 'undefined') {
    return false;
  }
  const mimeTypes = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'];
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return true;
    }
  }
  return false;
}

/**
 * Get the best supported Opus MIME type (diagnostic helper).
 */
export function getBestOpusMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }
  const mimeTypes = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'];
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
 * Captures microphone audio into a SharedArrayBuffer ring (via a capture AudioWorklet)
 * for the MOQ worker to encode and publish. Does not encode on the main thread.
 */
export class AudioPublisher {
  private config: Required<Omit<AudioPublisherConfig, 'deviceId'>> & Pick<AudioPublisherConfig, 'deviceId'>;
  private state: AudioPublisherState = AudioPublisherState.IDLE;
  private mediaStream: MediaStream | null = null;

  // Capture half of the Web Audio graph (main thread).
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;

  // SAB ring shared with the worklet (producer) and the worker (consumer).
  private sharedStorage: Float32Array | null = null;
  private sharedWritePos: BigInt64Array | null = null;
  private sharedReadPos: BigInt64Array | null = null;
  private sharedSignal: Int32Array | null = null;
  private readonly numChannels: number;
  private readonly capacityFrames: number;

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
    this.numChannels = this.config.channelCount;
    this.capacityFrames = captureCapacityFrames();
  }

  /**
   * Get current state
   */
  getState(): AudioPublisherState {
    return this.state;
  }

  /**
   * The Opus encoder config the worker should use (worker constructs WebCodecs
   * AudioEncoder from this). Matches the capture sample rate / channel count.
   */
  getEncoderConfig(): WorkerEncoderConfig {
    return {
      codec: 'opus',
      sampleRate: this.config.sampleRate,
      numberOfChannels: this.config.channelCount,
      bitrate: this.config.bitrate,
      frameDurationUs: Math.round(this.config.frameDurationMs * 1000),
    };
  }

  /**
   * The shared capture ring + geometry to hand to the worker, or null if capture is
   * not running / the SAB could not be allocated (not cross-origin isolated).
   */
  getCaptureHandoff(): CaptureHandoff | null {
    if (!this.sharedStorage || !this.sharedWritePos || !this.sharedReadPos || !this.sharedSignal) {
      return null;
    }
    return {
      numChannels: this.numChannels,
      capacityFrames: this.capacityFrames,
      sharedStorage: this.sharedStorage,
      sharedWritePos: this.sharedWritePos,
      sharedReadPos: this.sharedReadPos,
      sharedSignal: this.sharedSignal,
    };
  }

  /**
   * Request microphone access and prepare for capture.
   */
  async initialize(): Promise<void> {
    if (this.state !== AudioPublisherState.IDLE) {
      throw new MoqClientError(`Cannot initialize: already in state ${this.state}`, 'INVALID_STATE');
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new AudioNotSupportedError('getUserMedia is not supported in this browser');
    }
    if (!isWebCodecsOpusSupported()) {
      throw new AudioNotSupportedError(
        'WebCodecs Opus encoding is not supported in this browser. Try Chrome, Edge, Firefox, or Safari 26.4+.'
      );
    }

    this.setState(AudioPublisherState.REQUESTING_PERMISSION);

    try {
      const deviceId = this.config.deviceId;
      // Bluetooth mic check is handled by PanaudiaClient.connect() before transport setup.
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
          throw new AudioPermissionError('No microphone found. Please connect a microphone and try again.', error);
        } else if (error.name === 'NotReadableError') {
          throw new AudioPermissionError('Microphone is in use by another application.', error);
        }
      }
      throw new AudioPermissionError(`Failed to access microphone: ${error}`, error);
    }
  }

  /**
   * Start capturing: build the AudioContext + capture worklet and allocate the SAB
   * ring the worklet fills. Requires cross-origin isolation (the SAB is mandatory —
   * there is no main-thread-encode fallback).
   */
  async start(): Promise<void> {
    if (this.state !== AudioPublisherState.READY && this.state !== AudioPublisherState.PAUSED) {
      throw new MoqClientError(
        `Cannot start: must be in READY or PAUSED state, currently ${this.state}`,
        'INVALID_STATE'
      );
    }
    if (!this.mediaStream) {
      throw new MoqClientError('No media stream available', 'INVALID_STATE');
    }
    if (typeof SharedArrayBuffer === 'undefined' || globalThis.crossOriginIsolated !== true) {
      throw new AudioNotSupportedError(
        'Microphone capture requires cross-origin isolation (COOP/COEP) for the SharedArrayBuffer ring'
      );
    }
    if (typeof AudioWorkletNode === 'undefined') {
      throw new AudioNotSupportedError('AudioWorklet is not supported in this browser');
    }

    // Resuming from PAUSED just reconnects the existing graph.
    if (this.state === AudioPublisherState.PAUSED && this.audioContext && this.sourceNode && this.workletNode) {
      this.sourceNode.connect(this.workletNode);
      this.setState(AudioPublisherState.RECORDING);
      this.log('Microphone resumed');
      return;
    }

    this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });

    // Load the capture worklet (Blob URL; addModule copies it, so revoke after).
    const url = createCaptureWorkletUrl();
    try {
      await this.audioContext.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }

    // Allocate the SAB ring (interleaved storage + cumulative positions + wake signal).
    const nc = this.numChannels;
    const cap = this.capacityFrames;
    this.sharedStorage = new Float32Array(new SharedArrayBuffer(cap * nc * 4));
    this.sharedWritePos = new BigInt64Array(new SharedArrayBuffer(8));
    this.sharedReadPos = new BigInt64Array(new SharedArrayBuffer(8));
    this.sharedSignal = new Int32Array(new SharedArrayBuffer(4));

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, CAPTURE_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      processorOptions: {
        numChannels: nc,
        capacityFrames: cap,
        sharedStorage: this.sharedStorage,
        sharedWritePos: this.sharedWritePos,
        sharedReadPos: this.sharedReadPos,
        signal: this.sharedSignal,
      } satisfies CaptureProcessorOptions,
    });
    // Source → capture worklet (a sink; no output connection needed).
    this.sourceNode.connect(this.workletNode);

    this.setState(AudioPublisherState.RECORDING);
    this.log(`Capture started (SAB ring, ${nc}ch, capacity=${cap} frames)`);
  }

  /**
   * Pause capture: disconnect the mic from the worklet so the ring stops filling (the
   * worker then has nothing to encode). The graph + SAB are kept for resume.
   */
  pause(): void {
    if (this.state !== AudioPublisherState.RECORDING) {
      return;
    }
    if (this.sourceNode && this.workletNode) {
      try {
        this.sourceNode.disconnect(this.workletNode);
      } catch {
        /* already disconnected */
      }
    }
    this.setState(AudioPublisherState.PAUSED);
    this.log('Microphone paused');
  }

  /**
   * Resume capture (reconnect the mic to the worklet).
   */
  resume(): void {
    if (this.state !== AudioPublisherState.PAUSED) {
      return;
    }
    if (this.sourceNode && this.workletNode) {
      this.sourceNode.connect(this.workletNode);
      this.setState(AudioPublisherState.RECORDING);
      this.log('Microphone resumed');
    }
  }

  /**
   * Enable or disable the mic tracks. Disabling makes the source emit silent samples —
   * the capture graph + worker encoder stay alive, so MOQ frames keep flowing as Opus
   * DTX comfort-noise.
   */
  setMicEnabled(enabled: boolean): void {
    if (!this.mediaStream) return;
    for (const track of this.mediaStream.getAudioTracks()) {
      track.enabled = enabled;
    }
  }

  /**
   * Stop capturing: tear down the capture graph (keeps the media stream so it can be
   * restarted). The SAB views are released; the worker should be told to `stopCapture`.
   */
  stop(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
    this.sharedStorage = null;
    this.sharedWritePos = null;
    this.sharedReadPos = null;
    this.sharedSignal = null;
    if (this.state !== AudioPublisherState.IDLE && this.state !== AudioPublisherState.ERROR) {
      this.setState(AudioPublisherState.READY);
    }
  }

  /**
   * Release all resources (tears down the graph and stops the mic tracks).
   */
  dispose(): void {
    this.stop();
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    this.setState(AudioPublisherState.IDLE);
  }

  private setState(state: AudioPublisherState): void {
    this.state = state;
  }
}

/**
 * Check browser audio capabilities (diagnostic helper).
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
