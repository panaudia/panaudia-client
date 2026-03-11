import { MoqConnection } from './connection.js';
/**
 * Audio frame received from server
 */
export interface ReceivedAudioFrame {
    /** Track alias this frame belongs to */
    trackAlias: number;
    /** Group ID (typically timestamp-based) */
    groupId: bigint;
    /** Object ID within the group */
    objectId: bigint;
    /** Publisher priority */
    publisherPriority: number;
    /** Opus-encoded audio data */
    data: Uint8Array;
    /** Receive timestamp (local) */
    receiveTime: number;
}
/**
 * Handler for received audio frames
 */
export type AudioFrameReceivedHandler = (data: Uint8Array, groupId: bigint) => void;
/**
 * Audio subscriber state
 */
export declare enum AudioSubscriberState {
    IDLE = "idle",
    SUBSCRIBING = "subscribing",
    ACTIVE = "active",
    ERROR = "error"
}
/**
 * Audio subscriber statistics
 */
export interface AudioSubscriberStats {
    /** Total frames received */
    framesReceived: number;
    /** Total bytes received */
    bytesReceived: number;
    /** Frames dropped due to errors */
    framesDropped: number;
    /** Current group ID */
    currentGroupId: bigint;
    /** Last frame receive time */
    lastFrameTime: number;
}
/**
 * Audio Subscriber
 *
 * Receives Opus-encoded audio frames from an MOQ track via datagrams.
 */
export declare class AudioSubscriber {
    private connection;
    private state;
    private frameHandler;
    private trackAlias;
    private isListening;
    private stats;
    /**
     * Get current state
     */
    getState(): AudioSubscriberState;
    /**
     * Get statistics
     */
    getStats(): AudioSubscriberStats;
    /**
     * Set handler for received audio frames
     */
    onFrame(handler: AudioFrameReceivedHandler): void;
    /**
     * Attach to a connection and start listening for datagrams
     *
     * @param connection - MOQ connection
     * @param trackAlias - Track alias to filter frames
     */
    attach(connection: MoqConnection, trackAlias: number): void;
    /**
     * Start receiving audio frames via the connection's datagram dispatcher
     */
    start(): Promise<void>;
    /**
     * Stop receiving audio frames
     */
    stop(): void;
    /**
     * Detach from connection
     */
    detach(): void;
    /**
     * Reset statistics
     */
    resetStats(): void;
}
/**
 * Check if WebCodecs AudioDecoder is supported
 */
export declare function isAudioDecoderSupported(): boolean;
/**
 * Get audio decoder capabilities
 */
export declare function getAudioDecoderCapabilities(): Promise<{
    supported: boolean;
    opusSupported: boolean;
}>;
//# sourceMappingURL=audio-subscriber.d.ts.map