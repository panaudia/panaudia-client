import { ConnectionState, Position, Rotation, EntityAttributes, ErrorEvent, EntityState } from './types.js';
import { PanaudiaPose } from './shared/coordinates.js';
export type TransportType = 'moq' | 'webrtc';
export interface PanaudiaClientConfig {
    /** Server URL (from resolveServer() or hardcoded for dev). */
    serverUrl: string;
    /** JWT authentication token. */
    ticket: string;
    /** Transport to use. Default: 'auto' (MOQ if supported, else WebRTC). */
    transport?: 'auto' | 'moq' | 'webrtc';
    /** Initial position in Panaudia coordinates (0-1 range). */
    initialPosition?: Position;
    /** Initial rotation in degrees. */
    initialRotation?: Rotation;
    /** Enable presence (state/attributes updates from other entities). Default: true. */
    presence?: boolean;
    /** Entity ID (UUID) — extracted from JWT if not provided. */
    entityId?: string;
    /** Additional query parameters to include in the connection URL. */
    queryParams?: Record<string, string>;
    /** Microphone device ID — use listMicrophones() to get available IDs. Default: system default. */
    microphoneId?: string;
    /** Enable debug logging. Default: false. */
    debug?: boolean;
    /** World bounds for position normalization. If set, setPose normalizes positions from [min,max] to [0,1]. */
    worldBounds?: {
        min: number;
        max: number;
    };
}
type EventHandlerMap = {
    connected: () => void;
    disconnected: () => void;
    authenticated: () => void;
    error: (event: ErrorEvent) => void;
    entityState: (state: EntityState) => void;
    attributes: (attrs: EntityAttributes) => void;
};
export interface MicrophoneInfo {
    deviceId: string;
    label: string;
}
export declare class PanaudiaClient {
    /** List available microphone devices. Labels may be empty until mic permission is granted. */
    static listMicrophones(): Promise<MicrophoneInfo[]>;
    private transport;
    private transportType;
    private config;
    private position;
    private rotation;
    private statePublishTimer;
    private statePublishPending;
    private stateThrottleMs;
    private muted;
    private handlers;
    constructor(config: PanaudiaClientConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getState(): ConnectionState;
    getEntityId(): string;
    getTransportType(): TransportType;
    muteMic(): void;
    unmuteMic(): void;
    isMuted(): boolean;
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
     * Set pose in Panaudia coordinates (position 0-1 range, rotation in degrees).
     * If worldBounds is configured, positions are normalized from world space to 0-1 range.
     * Accepts a PanaudiaPose — the same type returned by the coordinate converter functions.
     *
     * @example
     * client.setPose(threejsToPanaudia(position, rotation));
     */
    setPose(pose: PanaudiaPose): void;
    mute(entityId: string): Promise<void>;
    unmute(entityId: string): Promise<void>;
    on<K extends keyof EventHandlerMap>(event: K, handler: EventHandlerMap[K]): void;
    off<K extends keyof EventHandlerMap>(event: K, handler: EventHandlerMap[K]): void;
    private emit;
    private scheduleStatePublish;
    private cancelPendingStatePublish;
}
export {};
//# sourceMappingURL=panaudia-client.d.ts.map