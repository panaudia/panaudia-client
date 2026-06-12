import { MoqClientError } from './errors.js';
import { WorkerEncoderConfig } from './moq-worker-protocol.js';
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
export declare enum AudioPublisherState {
    IDLE = "idle",
    REQUESTING_PERMISSION = "requesting_permission",
    READY = "ready",
    RECORDING = "recording",
    PAUSED = "paused",
    ERROR = "error"
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
export declare class AudioPermissionError extends MoqClientError {
    constructor(message: string, details?: unknown);
}
export declare class AudioEncodingError extends MoqClientError {
    constructor(message: string, details?: unknown);
}
export declare class AudioNotSupportedError extends MoqClientError {
    constructor(message: string);
}
/**
 * Check if Opus encoding is supported via MediaRecorder (diagnostic helper).
 */
export declare function isOpusSupported(): boolean;
/**
 * Get the best supported Opus MIME type (diagnostic helper).
 */
export declare function getBestOpusMimeType(): string | null;
/**
 * Audio Publisher
 *
 * Captures microphone audio into a SharedArrayBuffer ring (via a capture AudioWorklet)
 * for the MOQ worker to encode and publish. Does not encode on the main thread.
 */
export declare class AudioPublisher {
    private config;
    private state;
    private mediaStream;
    private audioContext;
    private sourceNode;
    private workletNode;
    private sharedStorage;
    private sharedWritePos;
    private sharedReadPos;
    private sharedSignal;
    private readonly numChannels;
    private readonly capacityFrames;
    private log;
    constructor(config?: AudioPublisherConfig);
    /**
     * Get current state
     */
    getState(): AudioPublisherState;
    /**
     * The Opus encoder config the worker should use (worker constructs WebCodecs
     * AudioEncoder from this). Matches the capture sample rate / channel count.
     */
    getEncoderConfig(): WorkerEncoderConfig;
    /**
     * The shared capture ring + geometry to hand to the worker, or null if capture is
     * not running / the SAB could not be allocated (not cross-origin isolated).
     */
    getCaptureHandoff(): CaptureHandoff | null;
    /**
     * Request microphone access and prepare for capture.
     */
    initialize(): Promise<void>;
    /**
     * Start capturing: build the AudioContext + capture worklet and allocate the SAB
     * ring the worklet fills. Requires cross-origin isolation (the SAB is mandatory —
     * there is no main-thread-encode fallback).
     */
    start(): Promise<void>;
    /**
     * Pause capture: disconnect the mic from the worklet so the ring stops filling (the
     * worker then has nothing to encode). The graph + SAB are kept for resume.
     */
    pause(): void;
    /**
     * Resume capture (reconnect the mic to the worklet).
     */
    resume(): void;
    /**
     * Enable or disable the mic tracks. Disabling makes the source emit silent samples —
     * the capture graph + worker encoder stay alive, so MOQ frames keep flowing as Opus
     * DTX comfort-noise.
     */
    setMicEnabled(enabled: boolean): void;
    /**
     * Stop capturing: tear down the capture graph (keeps the media stream so it can be
     * restarted). The SAB views are released; the worker should be told to `stopCapture`.
     */
    stop(): void;
    /**
     * Release all resources (tears down the graph and stops the mic tracks).
     */
    dispose(): void;
    private setState;
}
/**
 * Check browser audio capabilities (diagnostic helper).
 */
export declare function getAudioCapabilities(): {
    getUserMedia: boolean;
    mediaRecorder: boolean;
    opusSupport: boolean;
    bestMimeType: string | null;
    webCodecs: boolean;
    preferredEncoder: 'webcodecs' | 'mediarecorder' | 'none';
};
//# sourceMappingURL=audio-publisher.d.ts.map