import { Position, Rotation } from '../types.js';
export type { Vec3, Position, Rotation, EntityInfo3, ClientEventType, ClientEventHandler, ErrorEvent, StateChangeEvent, } from '../types.js';
export { ConnectionState } from '../types.js';
/**
 * MOQ message types (matching moqtransport v0.5.0)
 * Note: These differ from the latest draft spec
 */
export declare enum MoqMessageType {
    CLIENT_SETUP = 32,
    SERVER_SETUP = 33,
    ANNOUNCE = 6,
    ANNOUNCE_OK = 7,
    ANNOUNCE_ERROR = 8,
    UNANNOUNCE = 9,
    SUBSCRIBE = 3,
    SUBSCRIBE_OK = 4,
    SUBSCRIBE_ERROR = 5,
    UNSUBSCRIBE = 10,
    SUBSCRIBE_DONE = 11,
    OBJECT_STREAM = 0,
    OBJECT_DATAGRAM = 1,
    GOAWAY = 16
}
/**
 * MOQ Setup parameters
 */
export declare enum MoqSetupParameter {
    ROLE = 0,
    PATH = 1,
    MAX_SUBSCRIBE_ID = 2
}
/**
 * MOQ role values
 */
export declare enum MoqRole {
    PUBLISHER = 0,
    SUBSCRIBER = 1,
    PUBSUB = 2
}
/**
 * MOQ filter type for subscriptions
 */
export declare enum MoqFilterType {
    LATEST_GROUP = 1,
    LATEST_OBJECT = 2,
    ABSOLUTE_START = 3,
    ABSOLUTE_RANGE = 4
}
/**
 * MOQ object forwarding preference
 */
export declare enum MoqForwardingPreference {
    DATAGRAM = 0,
    STREAM_TRACK = 1,
    STREAM_GROUP = 2,
    STREAM_OBJECT = 3
}
/**
 * MOQ error codes
 */
export declare enum MoqErrorCode {
    NO_ERROR = 0,
    INTERNAL_ERROR = 1,
    UNAUTHORIZED = 2,
    PROTOCOL_VIOLATION = 3,
    DUPLICATE_TRACK_ALIAS = 4,
    PARAMETER_LENGTH_MISMATCH = 5,
    TOO_MANY_SUBSCRIBES = 6,
    GOAWAY_TIMEOUT = 16,
    INVALID_TOKEN = 1027
}
/**
 * MOQ Track representation
 */
export interface MoqTrack {
    namespace: string[];
    name: string;
    alias?: number;
}
/**
 * MOQ Object representation
 */
export interface MoqObject {
    trackAlias: number;
    groupId: bigint;
    objectId: bigint;
    publisherPriority: number;
    payload: Uint8Array;
}
/**
 * MOQ Group ordering preference
 */
export declare enum MoqGroupOrder {
    NONE = 0,
    ASCENDING = 1,
    DESCENDING = 2
}
/**
 * MOQ Subscription request
 */
export interface MoqSubscription {
    subscribeId: number;
    namespace: string[];
    trackName: string;
    subscriberPriority?: number;
    groupOrder?: MoqGroupOrder;
    forward?: number;
    filterType: MoqFilterType;
    authorization?: string;
    resumeOpId?: bigint;
}
/**
 * MOQ Announcement
 */
export interface MoqAnnouncement {
    requestId: number;
    namespace: string[];
    parameters?: Map<number, Uint8Array>;
}
/**
 * Configuration for the Panaudia MOQ client
 */
export interface PanaudiaConfig {
    /** Server URL (e.g., "https://server.example.com:4433") */
    serverUrl: string;
    /** JWT authentication token */
    ticket: string;
    /** Entity ID (UUID) - typically extracted from JWT, but can be provided */
    entityId?: string;
    /** Initial position in Panaudia coordinates (0-1 range) */
    initialPosition?: Position;
    /** Initial rotation in degrees */
    initialRotation?: Rotation;
    /** Enable debug logging. Default: false. */
    debug?: boolean;
}
/**
 * Track types used by Panaudia
 */
export declare enum PanaudiaTrackType {
    AUDIO_INPUT = "in/audio/opus-mono",
    AUDIO_OUTPUT = "out/audio/opus-stereo",
    STATE = "state",
    STATE_OUTPUT = "out/state",
    ATTRIBUTES_OUTPUT = "out/attributes",
    CONTROL_INPUT = "in/control"
}
/**
 * Generate track namespace for Panaudia
 */
export declare function generateTrackNamespace(trackType: PanaudiaTrackType, entityId: string): string[];
/**
 * WebTransport hash for server certificate verification
 */
export interface WebTransportHash {
    algorithm: string;
    value: BufferSource;
}
/**
 * WebTransport connection options
 */
export interface WebTransportOptions {
    /** Server certificate hashes for self-signed certs (development) */
    serverCertificateHashes?: WebTransportHash[];
    /** Allow pooling with other connections */
    allowPooling?: boolean;
    /** Require unreliable transport (datagrams) */
    requireUnreliable?: boolean;
    /** Congestion control algorithm */
    congestionControl?: 'default' | 'throughput' | 'low-latency';
}
//# sourceMappingURL=types.d.ts.map