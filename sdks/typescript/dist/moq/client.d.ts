import { PanaudiaConfig, ConnectionState, ClientEventType, ClientEventHandler, Position, Rotation, Vec3, WebTransportOptions } from './types.js';
import { AudioPublisherConfig } from './audio-publisher.js';
import { AudioSubscriberStats } from './audio-subscriber.js';
import { AudioPlayerConfig, AudioPlayerStats } from './audio-player.js';
import { EntityState, EntityStateHandler } from './state-subscriber.js';
import { ValuesHandler, RemovedHandler } from './attributes-subscriber.js';
/**
 * Main Panaudia MOQ Client
 *
 * Usage:
 * ```typescript
 * const client = new PanaudiaMoqClient({
 *   serverUrl: 'https://server.example.com:4433',
 *   ticket: 'your-jwt-token',
 * });
 *
 * await client.connect();
 * await client.startMicrophone();
 * await client.startPlayback();
 *
 * client.setPosition({ x: 0.5, y: 0.5, z: 0.5 });
 * ```
 */
export declare class PanaudiaMoqClient {
    private readonly config;
    private readonly events;
    private connection;
    private session;
    private state;
    private audioPublisher;
    private audioTrackPublisher;
    private stateTrackPublisher;
    private statePublishPending;
    private statePublishThrottleMs;
    private lastStatePublishTime;
    private audioSubscriber;
    private audioPlayer;
    private stateSubscriber;
    private controlTrackPublisher;
    private controlTrackAlias;
    private attributesSubscriber;
    private attributesOutputTrackAlias;
    private readonly attributesCache;
    private audioInputTrackAlias;
    private stateTrackAlias;
    private audioOutputTrackAlias;
    private stateOutputTrackAlias;
    private position;
    private rotation;
    constructor(config: PanaudiaConfig);
    private log;
    private logWarn;
    /**
     * Get current connection state
     */
    getState(): ConnectionState;
    /**
     * Get the node ID
     */
    getEntityId(): string;
    /**
     * Register an event handler
     */
    on<T>(event: ClientEventType, handler: ClientEventHandler<T>): void;
    /**
     * Remove an event handler
     */
    off<T>(event: ClientEventType, handler: ClientEventHandler<T>): void;
    /**
     * Connect to the MOQ server
     */
    connect(options?: WebTransportOptions): Promise<void>;
    /**
     * Disconnect from the server
     */
    disconnect(): Promise<void>;
    /**
     * Update position (in Panaudia internal coordinates, 0-1 range)
     */
    setPosition(position: Position): void;
    /**
     * Update rotation (in degrees)
     */
    setRotation(rotation: Rotation): void;
    /**
     * Get current position
     */
    getPosition(): Position;
    /**
     * Get current rotation
     */
    getRotation(): Rotation;
    /**
     * Update position using WebGL coordinates (-1 to 1 range, Three.js convention)
     */
    setPositionWebGL(pos: Vec3): void;
    /**
     * Update rotation using WebGL Euler angles (XYZ order, radians)
     */
    setRotationWebGL(rot: Vec3): void;
    /**
     * Get current position in WebGL coordinates
     */
    getPositionWebGL(): Vec3;
    /**
     * Get current rotation in WebGL Euler angles (XYZ order, radians)
     */
    getRotationWebGL(): Vec3;
    /**
     * Get all known entities (not gone)
     */
    getEntities(): Map<string, EntityState>;
    /**
     * Get a specific entity by UUID
     */
    getEntity(uuid: string): EntityState | undefined;
    /**
     * Register a handler for entity state updates (Panaudia coordinates)
     */
    onEntityState(handler: EntityStateHandler): void;
    /**
     * Get the attributes cache containing all current key-value entries.
     */
    getAttributesCache(): ReadonlyMap<string, import('../shared/cache-map.js').CacheEntry>;
    /**
     * Register a handler for batches of attribute values.
     * Fired once per envelope with all accepted (added/updated) values.
     * A single-op envelope is delivered as a one-element array.
     */
    onAttributeValues(handler: ValuesHandler): void;
    /**
     * Register a handler for batches of attribute key removals (tombstones).
     * Fired once per envelope with all tombstoned keys.
     */
    onAttributeRemoved(handler: RemovedHandler): void;
    /**
     * Mute a remote entity (they will be silent in your mix)
     */
    mute(entityId: string): Promise<void>;
    /**
     * Unmute a remote entity
     */
    unmute(entityId: string): Promise<void>;
    /**
     * Start capturing and publishing microphone audio
     *
     * @param config - Optional audio configuration
     */
    startMicrophone(config?: AudioPublisherConfig): Promise<void>;
    /**
     * Stop capturing microphone audio
     */
    stopMicrophone(): void;
    /**
     * Check if microphone is currently recording
     */
    isMicrophoneActive(): boolean;
    /**
     * Pause microphone recording
     */
    pauseMicrophone(): void;
    /**
     * Resume microphone recording
     */
    resumeMicrophone(): void;
    /**
     * Publish the current state immediately
     *
     * This sends the current position, rotation, and volume to the server.
     */
    publishState(): Promise<void>;
    /**
     * Configure state update throttling
     *
     * @param throttleMs - Minimum milliseconds between state updates (default: 50ms = 20Hz)
     */
    setStateThrottle(throttleMs: number): void;
    /**
     * Start receiving and playing audio from the server
     *
     * @param config - Optional audio player configuration
     */
    startPlayback(config?: AudioPlayerConfig): Promise<void>;
    /**
     * Stop receiving and playing audio
     */
    stopPlayback(): void;
    /**
     * Check if audio playback is currently active
     */
    isPlaybackActive(): boolean;
    /**
     * Pause audio playback
     */
    pausePlayback(): void;
    /**
     * Resume audio playback
     */
    resumePlayback(): void;
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
     * Get audio playback statistics
     */
    getPlaybackStats(): {
        subscriber: AudioSubscriberStats;
        player: AudioPlayerStats;
    } | null;
    /**
     * Schedule a state publish with throttling
     *
     * If called multiple times rapidly, only one publish will occur
     * after the throttle delay.
     */
    private scheduleStatePublish;
    /**
     * Extract node ID from JWT token
     */
    private extractEntityIdFromJwt;
    /**
     * Update internal state and emit events
     */
    private setState;
    /**
     * Handle connection error
     */
    private handleError;
    /**
     * Handle disconnection
     */
    private handleDisconnect;
}
//# sourceMappingURL=client.d.ts.map