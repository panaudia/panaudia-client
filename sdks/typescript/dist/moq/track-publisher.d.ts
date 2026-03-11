import { MoqConnection } from './connection.js';
/**
 * Track publisher configuration
 */
export interface TrackPublisherConfig {
    /** Track alias assigned by the server */
    trackAlias: number;
    /** Publisher priority (0 = highest) */
    publisherPriority?: number;
}
/**
 * Statistics for track publishing
 */
export interface TrackPublisherStats {
    /** Total objects published */
    objectsPublished: number;
    /** Total bytes published */
    bytesPublished: number;
    /** Number of errors */
    errors: number;
    /** Current group ID */
    currentGroupId: bigint;
    /** Current object ID within group */
    currentObjectId: bigint;
}
/**
 * Track Publisher
 *
 * Publishes data to an MOQ track using datagrams for low-latency delivery.
 */
export declare class TrackPublisher {
    private readonly trackAlias;
    private readonly publisherPriority;
    private connection;
    private currentGroupId;
    private currentObjectId;
    private lastGroupTimestamp;
    private groupDurationMs;
    private stats;
    constructor(config: TrackPublisherConfig);
    /**
     * Get the track alias
     */
    getTrackAlias(): number;
    /**
     * Attach to a connection for publishing
     */
    attach(connection: MoqConnection): void;
    /**
     * Detach from the connection
     */
    detach(): void;
    /**
     * Get publishing statistics
     */
    getStats(): TrackPublisherStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Publish a data payload as an MOQ object
     *
     * @param payload - The data to publish
     * @param timestampMs - Optional timestamp in milliseconds (uses current time if not provided)
     */
    publish(payload: Uint8Array, timestampMs?: number): Promise<void>;
    /**
     * Publish with explicit group and object IDs
     *
     * @param groupId - Group ID for this object
     * @param objectId - Object ID within the group
     * @param payload - The data to publish
     */
    publishWithIds(groupId: bigint, objectId: bigint, payload: Uint8Array): Promise<void>;
    /**
     * Set the group duration for automatic group ID management
     */
    setGroupDuration(durationMs: number): void;
    /**
     * Force start a new group
     */
    startNewGroup(): void;
}
/**
 * Audio Track Publisher
 *
 * Specialized publisher for audio frames with timing-based group management.
 */
export declare class AudioTrackPublisher extends TrackPublisher {
    private frameSequence;
    private sessionStartTime;
    constructor(config: TrackPublisherConfig);
    /**
     * Start a new audio session
     */
    startSession(): void;
    /**
     * Publish an audio frame
     *
     * @param opusData - Opus-encoded audio data
     * @param timestampMs - Frame timestamp in milliseconds (relative to session start)
     */
    publishAudioFrame(opusData: Uint8Array, timestampMs?: number): Promise<void>;
}
/**
 * State Track Publisher
 *
 * Specialized publisher for position/rotation state updates.
 */
export declare class StateTrackPublisher extends TrackPublisher {
    private updateSequence;
    constructor(config: TrackPublisherConfig);
    /**
     * Publish a state update (EntityInfo3 binary data)
     *
     * @param stateData - 48-byte EntityInfo3 binary data
     */
    publishState(stateData: Uint8Array): Promise<void>;
}
//# sourceMappingURL=track-publisher.d.ts.map