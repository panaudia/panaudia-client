/**
 * Track Publisher - Publishes data to MOQ tracks
 *
 * Handles the creation and transmission of MOQ objects for
 * audio frames and state updates.
 */

import { MoqConnection } from './connection.js';
import { buildObjectDatagram } from './moq-transport.js';
import { MoqClientError } from './errors.js';

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
export class TrackPublisher {
  private readonly trackAlias: number;
  private readonly publisherPriority: number;
  private connection: MoqConnection | null = null;

  // Group/Object tracking
  private currentGroupId: bigint = 0n;
  private currentObjectId: bigint = 0n;
  private lastGroupTimestamp: number = 0;
  private groupDurationMs: number = 1000; // Start new group every second

  // Statistics
  private stats: TrackPublisherStats = {
    objectsPublished: 0,
    bytesPublished: 0,
    errors: 0,
    currentGroupId: 0n,
    currentObjectId: 0n,
  };

  constructor(config: TrackPublisherConfig) {
    this.trackAlias = config.trackAlias;
    this.publisherPriority = config.publisherPriority ?? 0;
  }

  /**
   * Get the track alias
   */
  getTrackAlias(): number {
    return this.trackAlias;
  }

  /**
   * Attach to a connection for publishing
   */
  attach(connection: MoqConnection): void {
    this.connection = connection;
  }

  /**
   * Detach from the connection
   */
  detach(): void {
    this.connection = null;
  }

  /**
   * Get publishing statistics
   */
  getStats(): TrackPublisherStats {
    return {
      ...this.stats,
      currentGroupId: this.currentGroupId,
      currentObjectId: this.currentObjectId,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      objectsPublished: 0,
      bytesPublished: 0,
      errors: 0,
      currentGroupId: this.currentGroupId,
      currentObjectId: this.currentObjectId,
    };
  }

  /**
   * Publish a data payload as an MOQ object
   *
   * @param payload - The data to publish
   * @param timestampMs - Optional timestamp in milliseconds (uses current time if not provided)
   */
  async publish(payload: Uint8Array, timestampMs?: number): Promise<void> {
    if (!this.connection) {
      throw new MoqClientError('Not attached to a connection', 'NOT_CONNECTED');
    }

    const timestamp = timestampMs ?? Date.now();

    // Determine group ID based on timestamp
    // Start a new group if enough time has passed
    if (timestamp - this.lastGroupTimestamp >= this.groupDurationMs) {
      this.currentGroupId++;
      this.currentObjectId = 0n;
      this.lastGroupTimestamp = timestamp;
    }

    // Build the MOQ object datagram
    const datagram = buildObjectDatagram(
      this.trackAlias,
      this.currentGroupId,
      this.currentObjectId,
      this.publisherPriority,
      payload
    );

    try {
      // Send via datagram for low-latency delivery
      await this.connection.sendDatagram(datagram);

      // Update tracking
      this.currentObjectId++;
      this.stats.objectsPublished++;
      this.stats.bytesPublished += payload.length;
    } catch (error) {
      this.stats.errors++;
      console.error('Failed to publish object:', error);
      throw new MoqClientError(
        `Failed to publish object: ${error}`,
        'PUBLISH_FAILED',
        error
      );
    }
  }

  /**
   * Publish with explicit group and object IDs
   *
   * @param groupId - Group ID for this object
   * @param objectId - Object ID within the group
   * @param payload - The data to publish
   */
  async publishWithIds(
    groupId: bigint,
    objectId: bigint,
    payload: Uint8Array
  ): Promise<void> {
    if (!this.connection) {
      throw new MoqClientError('Not attached to a connection', 'NOT_CONNECTED');
    }

    const datagram = buildObjectDatagram(
      this.trackAlias,
      groupId,
      objectId,
      this.publisherPriority,
      payload
    );

    try {
      await this.connection.sendDatagram(datagram);

      this.stats.objectsPublished++;
      this.stats.bytesPublished += payload.length;
    } catch (error) {
      this.stats.errors++;
      throw new MoqClientError(
        `Failed to publish object: ${error}`,
        'PUBLISH_FAILED',
        error
      );
    }
  }

  /**
   * Set the group duration for automatic group ID management
   */
  setGroupDuration(durationMs: number): void {
    this.groupDurationMs = durationMs;
  }

  /**
   * Force start a new group
   */
  startNewGroup(): void {
    this.currentGroupId++;
    this.currentObjectId = 0n;
    this.lastGroupTimestamp = Date.now();
  }
}

/**
 * Audio Track Publisher
 *
 * Specialized publisher for audio frames with timing-based group management.
 */
export class AudioTrackPublisher extends TrackPublisher {
  private frameSequence: bigint = 0n;
  private sessionStartTime: number = 0;

  constructor(config: TrackPublisherConfig) {
    super(config);
    // Audio uses smaller groups (per-frame or small batches)
    this.setGroupDuration(20); // 20ms per group (one Opus frame)
  }

  /**
   * Start a new audio session
   */
  startSession(): void {
    this.sessionStartTime = Date.now();
    this.frameSequence = 0n;
    this.startNewGroup();
  }

  /**
   * Publish an audio frame
   *
   * @param opusData - Opus-encoded audio data
   * @param timestampMs - Frame timestamp in milliseconds (relative to session start)
   */
  async publishAudioFrame(opusData: Uint8Array, timestampMs?: number): Promise<void> {
    const timestamp = timestampMs ?? (Date.now() - this.sessionStartTime);

    // Use timestamp as group ID and frame sequence as object ID
    // This allows the receiver to order frames correctly
    const groupId = BigInt(Math.floor(timestamp));
    const objectId = this.frameSequence++;

    await this.publishWithIds(groupId, objectId, opusData);
  }
}

/**
 * State Track Publisher
 *
 * Specialized publisher for position/rotation state updates.
 */
export class StateTrackPublisher extends TrackPublisher {
  private updateSequence: bigint = 0n;

  constructor(config: TrackPublisherConfig) {
    super(config);
    // State updates use longer groups
    this.setGroupDuration(1000); // 1 second per group
  }

  /**
   * Publish a state update (EntityInfo3 binary data)
   *
   * @param stateData - 48-byte EntityInfo3 binary data
   */
  async publishState(stateData: Uint8Array): Promise<void> {
    if (stateData.length !== 48) {
      throw new MoqClientError(
        `Invalid state data size: expected 48 bytes, got ${stateData.length}`,
        'INVALID_DATA'
      );
    }

    const timestamp = Date.now();
    const groupId = BigInt(Math.floor(timestamp / 1000)); // Group by second
    const objectId = this.updateSequence++;

    await this.publishWithIds(groupId, objectId, stateData);
  }
}
