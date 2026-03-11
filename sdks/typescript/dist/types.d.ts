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
export type ClientEventType = 'connected' | 'disconnected' | 'authenticated' | 'error' | 'statechange' | 'entityState' | 'attributes';
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
 * Entity attributes received from the server
 */
export interface EntityAttributes {
    uuid: string;
    name?: string;
    ticket?: string;
    connection?: string;
    subspaces?: string[];
}
/**
 * Control message (mute/unmute)
 */
export interface ControlMessage {
    type: 'mute' | 'unmute';
    message: {
        node: string;
    };
}
//# sourceMappingURL=types.d.ts.map