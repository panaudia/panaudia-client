import { ConnectionState, Position, Rotation, ErrorEvent, WarningEvent, EntityState } from './types.js';
import { PanaudiaPose } from './shared/coordinates.js';
import { TopicNode } from './shared/topic-tree.js';
import { SingleRecordNode } from './shared/single-record-tree.js';
import { MergeDebugInfo } from './shared/topic-merger.js';
import { selectBestMicrophone, MicrophoneType } from './shared/microphone-selection.js';
export type TransportType = 'moq' | 'webrtc';
export interface PanaudiaClientConfig {
    /** Server URL (from resolveServer() or hardcoded for dev). */
    serverUrl: string;
    /** JWT authentication token. Omit for tokenless (dev/sandbox) connections —
     *  the client will generate a UUID and pass it in the connection URL. The
     *  server must be running with PANAUDIA_UNTICKETED=1 for this to succeed. */
    ticket?: string;
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
    warning: (event: WarningEvent) => void;
    entityState: (state: EntityState) => void;
    attributes: (values: Array<{
        key: string;
        value: string;
    }>) => void;
    attributesRemoved: (keys: string[]) => void;
    attributeTreeChange: (uuid: string, attrs: TopicNode) => void;
    attributeTreeRemove: (uuid: string) => void;
    entity: (values: Array<{
        key: string;
        value: string;
    }>) => void;
    entityRemoved: (keys: string[]) => void;
    entityTreeChange: (uuid: string, record: TopicNode) => void;
    entityTreeRemove: (uuid: string) => void;
    space: (values: Array<{
        key: string;
        value: string;
    }>) => void;
    spaceRemoved: (keys: string[]) => void;
    spaceTreeChange: (record: SingleRecordNode) => void;
    cacheDebug: (info: MergeDebugInfo) => void;
};
export interface MicrophoneInfo {
    deviceId: string;
    label: string;
    type: MicrophoneType;
}
export declare class PanaudiaClient {
    /**
     * List available microphone devices with type classification.
     * Requests mic permission if not already granted (one prompt, briefly opens default mic).
     */
    static listMicrophones(): Promise<MicrophoneInfo[]>;
    /**
     * Get the recommended non-Bluetooth microphone.
     * Use this to pre-select a device in a mic picker UI.
     * The user should confirm the selection before connecting.
     */
    static getRecommendedMicrophone: typeof selectBestMicrophone;
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
    private attributeTree;
    private entityTree;
    private spaceTree;
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
    /**
     * Invoke a named command from the server's command catalog
     * (see `plan/commands/command_types.md`). Args are command-specific —
     * for example `space.entity.mute` takes `{entity_id}` and
     * `personal.role.mute` takes `{role}`.
     *
     * Strict-MVC: this fires-and-forgets. The server applies the command
     * (if the holder's roles allow it) and the resulting cache op flows
     * back through the entity / attribute streams. Failed authorisation,
     * unknown command names and bad arguments all silently drop on the
     * server — clients infer success from the absence or presence of an
     * echoed op. There is no per-call error path by design.
     */
    command(name: string, args?: Record<string, unknown>): Promise<void>;
    on<K extends keyof EventHandlerMap>(event: K, handler: EventHandlerMap[K]): void;
    off<K extends keyof EventHandlerMap>(event: K, handler: EventHandlerMap[K]): void;
    /**
     * Get the structured per-participant attribute tree, keyed by uuid.
     * Maintained automatically from incoming attribute values and tombstones.
     */
    getAttributeTree(): ReadonlyMap<string, TopicNode>;
    /**
     * Get a single participant's attributes, or undefined if unknown.
     */
    getAttributes(uuid: string): TopicNode | undefined;
    /**
     * Get the structured per-entity tree, keyed by uuid. Maintained
     * automatically from incoming entity values and tombstones. Under the
     * current server-side filter the only uuid this map will contain is
     * the client's own (`getEntityId()`).
     */
    getEntityTree(): ReadonlyMap<string, TopicNode>;
    /**
     * Get a single entity's record, or undefined if unknown. Pass
     * `getEntityId()` to retrieve this client's own record.
     */
    getEntity(uuid: string): TopicNode | undefined;
    /**
     * Get the space-wide role-rule record (roles-muted, roles-kicked,
     * roles-gain, roles-attenuation). Empty for connections without
     * the `space.read` read cap.
     */
    getSpace(): Readonly<SingleRecordNode>;
    private emit;
    private scheduleStatePublish;
    private cancelPendingStatePublish;
}
export {};
//# sourceMappingURL=panaudia-client.d.ts.map