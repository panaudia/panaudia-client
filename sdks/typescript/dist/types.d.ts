/**
 * Shared type definitions for the Panaudia client
 *
 * These types are used by both MOQ and WebRTC transports.
 */
/**
 * 3D vector in WebGL coordinates
 */
export interface Vec3 {
    x: number;
    y: number;
    z: number;
}
/**
 * 3D position in Panaudia internal coordinates (0 to 1 range)
 */
export interface Position {
    x: number;
    y: number;
    z: number;
}
/**
 * 3D rotation in degrees
 */
export interface Rotation {
    yaw: number;
    pitch: number;
    roll: number;
}
/**
 * EntityInfo3 state data - matches the 48-byte binary format from Go server
 */
export interface EntityInfo3 {
    uuid: string;
    position: Position;
    rotation: Rotation;
    volume: number;
    gone: boolean;
}
/**
 * Connection state
 */
export declare enum ConnectionState {
    DISCONNECTED = "disconnected",
    CONNECTING = "connecting",
    CONNECTED = "connected",
    AUTHENTICATED = "authenticated",
    ERROR = "error"
}
/**
 * Client event types
 */
export type ClientEventType = 'connected' | 'disconnected' | 'authenticated' | 'error' | 'warning' | 'statechange' | 'entityState' | 'attributes' | 'attributesRemoved' | 'entity' | 'entityRemoved' | 'space' | 'spaceRemoved' | 'cacheDebug';
/**
 * Client event handler
 */
export type ClientEventHandler<T = unknown> = (event: T) => void;
/**
 * Error event payload
 */
export interface ErrorEvent {
    code: string | number;
    message: string;
    details?: unknown;
}
/**
 * Warning event payload — non-fatal issues the application may want to surface to users.
 */
export interface WarningEvent {
    code: string;
    message: string;
    details?: unknown;
}
/**
 * State change event payload
 */
export interface StateChangeEvent {
    previousState: ConnectionState;
    currentState: ConnectionState;
}
/**
 * Entity state received from the server
 */
export interface EntityState {
    uuid: string;
    position: Position;
    rotation: Rotation;
    volume: number;
    gone: boolean;
}
/**
 * Entity attributes — replaced by per-key operations.
 * Use the CacheMap from the AttributesSubscriber to access
 * individual attribute key-value pairs.
 *
 * @deprecated Use per-key operations via onAttributeValues / getAttributesCache
 */
export interface EntityAttributes {
    uuid: string;
    name?: string;
    ticket?: string;
    connection?: string;
    subspaces?: string[];
}
/**
 * Control-channel message envelope. The server-side dispatcher branches
 * on `type`:
 *
 *   - "mute" / "unmute": legacy direct-mute messages (kept for the
 *     swap-over period; no server-side effect today).
 *   - "command": invoke a named command from the catalog. The op the
 *     command produces flows back through the entity / space cache,
 *     i.e. the client only sees its effect via the echoed entity
 *     stream (strict-MVC).
 */
export type ControlMessage = {
    type: 'mute' | 'unmute';
    message: {
        node: string;
    };
} | {
    type: 'command';
    message: {
        command: string;
        args: Record<string, unknown>;
    };
};
//# sourceMappingURL=types.d.ts.map