import { MoqClientError } from './errors.js';
import { MicrophoneType } from '../shared/microphone-selection.js';
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
export declare enum AudioPublisherState {
    IDLE = "idle",
    REQUESTING_PERMISSION = "requesting_permission",
    READY = "ready",
    RECORDING = "recording",
    PAUSED = "paused",
    ERROR = "error"
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
 * Error thrown when the default microphone is Bluetooth and no explicit device was chosen.
 * The `availableDevices` field contains all mics with their classification so the app
 * can immediately show a mic picker.
 */
export declare class BluetoothMicDefaultError extends MoqClientError {
    readonly availableDevices: Array<{
        deviceId: string;
        label: string;
        type: MicrophoneType;
    }>;
    constructor(defaultLabel: string, availableDevices: Array<{
        deviceId: string;
        label: string;
        type: MicrophoneType;
    }>);
}
/**
 * Check if Opus encoding is supported via MediaRecorder
 */
export declare function isOpusSupported(): boolean;
/**
 * Get the best supported Opus MIME type
 */
export declare function getBestOpusMimeType(): string | null;
/**
 * Audio Publisher
 *
 * Captures audio from the microphone, encodes it to Opus, and provides
 * frames for publishing to the MOQ server.
 *
 * Uses WebCodecs AudioEncoder (preferred) for raw Opus output,
 * or MediaRecorder as fallback.
 */
export declare class AudioPublisher {
    private config;
    private state;
    private mediaStream;
    private mediaRecorder;
    private frameHandler;
    private webCodecsEncoder;
    private useWebCodecs;
    private startTime;
    private frameSequence;
    private log;
    constructor(config?: AudioPublisherConfig);
    /**
     * Get current state
     */
    getState(): AudioPublisherState;
    /**
     * Set handler for audio frames
     */
    onFrame(handler: AudioFrameHandler): void;
    /**
     * Request microphone access and prepare for recording
     */
    initialize(): Promise<void>;
    /**
     * Start recording and encoding audio
     */
    start(): void;
    /**
     * Start encoding using WebCodecs AudioEncoder (preferred - raw Opus)
     */
    private startWebCodecs;
    /**
     * Start encoding using MediaRecorder (fallback - WebM container)
     */
    private startMediaRecorder;
    /**
     * Pause recording
     */
    pause(): void;
    /**
     * Resume recording
     */
    resume(): void;
    /**
     * Stop recording
     */
    stop(): void;
    /**
     * Release all resources
     */
    dispose(): void;
    /**
     * Handle encoded audio data from MediaRecorder
     */
    private handleEncodedData;
    /**
     * Update state
     */
    private setState;
}
/**
 * Check browser audio capabilities
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