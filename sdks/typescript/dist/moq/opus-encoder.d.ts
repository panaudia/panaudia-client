/**
 * Opus Encoder using WebCodecs API
 *
 * Produces raw Opus frames (not WebM containers) for direct transmission
 * over MOQ transport.
 */
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
export declare function isWebCodecsOpusSupported(): boolean;
/**
 * Opus Encoder using WebCodecs
 *
 * Uses the browser's AudioEncoder API to encode PCM audio to raw Opus frames.
 * Unlike MediaRecorder, this produces raw Opus packets without container overhead.
 */
export declare class OpusEncoder {
    private encoder;
    private config;
    private frameCallback;
    private isInitialized;
    constructor(config?: OpusEncoderConfig);
    private log;
    /**
     * Set callback for encoded frames
     */
    onFrame(callback: OpusFrameCallback): void;
    /**
     * Initialize the encoder
     */
    initialize(): Promise<void>;
    /**
     * Encode PCM audio data
     *
     * @param pcmData - Float32 PCM samples (interleaved if stereo)
     * @param timestamp - Timestamp in microseconds
     */
    encode(pcmData: Float32Array, timestamp: number): void;
    /**
     * Flush any pending frames
     */
    flush(): Promise<void>;
    /**
     * Close the encoder and release resources
     */
    close(): void;
    /**
     * Handle encoded chunk from WebCodecs
     */
    private handleEncodedChunk;
    /**
     * Get encoder state
     */
    getState(): string;
}
/**
 * Audio Capture with Opus Encoding
 *
 * Captures audio from MediaStream using AudioWorklet and encodes to Opus.
 * AudioWorklet delivers 128 samples per render quantum (~2.67ms at 48kHz),
 * which are accumulated to the configured frame size before encoding.
 */
export declare class AudioCaptureEncoder {
    private audioContext;
    private sourceNode;
    private workletNode;
    private encoder;
    private config;
    private sampleBuffer;
    private bufferSize;
    private samplesPerFrame;
    private frameDurationUs;
    private timestampUs;
    private isRunning;
    constructor(config?: OpusEncoderConfig);
    private log;
    /**
     * Set callback for encoded Opus frames
     */
    onFrame(callback: OpusFrameCallback): void;
    /**
     * Start capturing and encoding
     */
    start(mediaStream: MediaStream): Promise<void>;
    /**
     * Add samples to buffer and encode when we have enough
     */
    private addSamples;
    /**
     * Stop capturing and encoding
     */
    stop(): Promise<void>;
    /**
     * Check if currently running
     */
    isActive(): boolean;
}
//# sourceMappingURL=opus-encoder.d.ts.map