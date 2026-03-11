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
export declare class AudioPlayer {
    private config;
    private state;
    private audioContext;
    private gainNode;
    private decoder;
    private nextPlayTime;
    private scheduledBuffers;
    private stats;
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
     * Initialize the audio player
     *
     * This creates the AudioContext and AudioDecoder.
     * Must be called in response to a user gesture on some browsers.
     */
    initialize(): Promise<void>;
    /**
     * Start playback
     */
    start(): void;
    /**
     * Stop playback
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
     * Handle decoded audio data
     */
    private handleDecodedAudio;
    /**
     * Schedule an audio buffer for playback
     */
    private scheduleBuffer;
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