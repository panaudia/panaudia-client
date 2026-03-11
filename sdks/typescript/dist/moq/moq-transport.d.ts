import { MoqMessageType, MoqRole, MoqSubscription, MoqAnnouncement } from './types.js';
/**
 * Encode a number as a QUIC-style variable-length integer
 * Returns the encoded bytes
 */
export declare function encodeVarint(value: number | bigint): Uint8Array;
/**
 * Decode a QUIC-style variable-length integer from a byte array
 * Returns the decoded value and the number of bytes consumed
 */
export declare function decodeVarint(data: Uint8Array, offset?: number): {
    value: bigint;
    bytesRead: number;
};
/**
 * Encode a string with length prefix (varint length + UTF-8 bytes)
 */
export declare function encodeString(str: string): Uint8Array;
/**
 * Decode a length-prefixed string
 */
export declare function decodeString(data: Uint8Array, offset?: number): {
    value: string;
    bytesRead: number;
};
/**
 * Encode bytes with length prefix (varint length + raw bytes)
 */
export declare function encodeBytes(bytes: Uint8Array): Uint8Array;
/**
 * Decode length-prefixed bytes
 */
export declare function decodeBytes(data: Uint8Array, offset?: number): {
    value: Uint8Array;
    bytesRead: number;
};
/**
 * Buffer builder for constructing MOQ messages
 */
export declare class MessageBuilder {
    private chunks;
    private totalLength;
    /**
     * Append a varint to the message
     */
    writeVarint(value: number | bigint): this;
    /**
     * Append a length-prefixed string to the message
     */
    writeString(str: string): this;
    /**
     * Append length-prefixed bytes to the message
     */
    writeBytes(data: Uint8Array): this;
    /**
     * Append raw bytes (no length prefix) to the message
     */
    writeRaw(data: Uint8Array): this;
    /**
     * Build the final message
     */
    build(): Uint8Array;
}
/**
 * Wrap a message with length framing as expected by moqtransport library.
 * Format: [Message Type varint] [Length: 2 bytes big-endian] [Content]
 */
export declare function wrapWithLengthFrame(messageType: number, content: Uint8Array): Uint8Array;
/**
 * Build CLIENT_SETUP message
 *
 * Per draft-ietf-moq-transport-11, setup parameter encoding depends on type:
 * - Even types (0x00, 0x02, etc.): Value is a single varint (no length prefix)
 * - Odd types (0x01, etc.): Length-prefixed bytes
 */
export declare function buildClientSetup(supportedVersions: number[], role: MoqRole, path?: string, maxSubscribeId?: number): Uint8Array;
/**
 * Build SUBSCRIBE message
 *
 * Per moqtransport v0.5.1 / draft-ietf-moq-transport-11 wire format:
 * - RequestID (varint)
 * - TrackNamespace (Tuple)
 * - TrackName (varint-prefixed bytes)
 * - SubscriberPriority (1 byte)
 * - GroupOrder (1 byte)
 * - Forward (1 byte)
 * - FilterType (varint)
 * - [StartLocation if absolute]
 * - Parameters (KVPList)
 *
 * NOTE: TrackAlias is NOT in SUBSCRIBE in draft-11. It is assigned by the
 * publisher and returned in SUBSCRIBE_OK.
 */
export declare function buildSubscribe(subscription: MoqSubscription): Uint8Array;
/**
 * Build ANNOUNCE message
 * Format: [RequestID varint][Namespace Tuple][Parameters count + list]
 */
export declare function buildAnnounce(announcement: MoqAnnouncement): Uint8Array;
/**
 * Build UNSUBSCRIBE message
 */
export declare function buildUnsubscribe(subscribeId: number): Uint8Array;
/**
 * Build UNANNOUNCE message
 */
export declare function buildUnannounce(namespace: string[]): Uint8Array;
/**
 * Build OBJECT_DATAGRAM message (for sending audio/state data)
 */
export declare function buildObjectDatagram(trackAlias: number, groupId: bigint, objectId: bigint, publisherPriority: number, payload: Uint8Array): Uint8Array;
/**
 * Parse the message type from the beginning of a message
 */
export declare function parseMessageType(data: Uint8Array): {
    type: MoqMessageType;
    bytesRead: number;
};
/**
 * Parsed SERVER_SETUP message
 */
export interface ParsedServerSetup {
    selectedVersion: number;
    parameters: Map<number, Uint8Array>;
}
/**
 * Parse SERVER_SETUP message
 *
 * Per draft-ietf-moq-transport-11, setup parameter encoding depends on type:
 * - Even types (0x00, 0x02, etc.): Value is a single varint (no length prefix)
 * - Odd types (0x01, etc.): Length-prefixed bytes
 */
export declare function parseServerSetup(data: Uint8Array, offset?: number): ParsedServerSetup;
/**
 * Parsed SUBSCRIBE_OK message
 */
export interface ParsedSubscribeOk {
    subscribeId: number;
    trackAlias: number;
    expires: bigint;
    groupOrder: number;
    contentExists: boolean;
    largestGroupId?: bigint;
    largestObjectId?: bigint;
}
/**
 * Parse SUBSCRIBE_OK message
 *
 * Per moqtransport v0.5.1 / draft-ietf-moq-transport-11 wire format:
 * - RequestID (varint)
 * - TrackAlias (varint)
 * - Expires (varint, milliseconds)
 * - GroupOrder (1 byte)
 * - ContentExists (1 byte: 0 or 1)
 * - [LargestLocation + Parameters if ContentExists=1]
 * - [Parameters if ContentExists=0]
 */
export declare function parseSubscribeOk(data: Uint8Array, offset?: number): ParsedSubscribeOk;
/**
 * Parsed SUBSCRIBE_ERROR message
 */
export interface ParsedSubscribeError {
    subscribeId: number;
    errorCode: number;
    reasonPhrase: string;
    trackAlias: number;
}
/**
 * Parse SUBSCRIBE_ERROR message
 */
export declare function parseSubscribeError(data: Uint8Array, offset?: number): ParsedSubscribeError;
/**
 * Parsed ANNOUNCE_OK message
 * Note: moqtransport v0.5.0 returns just RequestID, not namespace
 */
export interface ParsedAnnounceOk {
    requestId: number;
}
/**
 * Parse ANNOUNCE_OK message
 */
export declare function parseAnnounceOk(data: Uint8Array, offset?: number): ParsedAnnounceOk;
/**
 * Parsed ANNOUNCE_ERROR message
 */
export interface ParsedAnnounceError {
    namespace: string[];
    errorCode: number;
    reasonPhrase: string;
}
/**
 * Parse ANNOUNCE_ERROR message
 */
export declare function parseAnnounceError(data: Uint8Array, offset?: number): ParsedAnnounceError;
/**
 * Parsed OBJECT_DATAGRAM
 */
export interface ParsedObjectDatagram {
    trackAlias: number;
    groupId: bigint;
    objectId: bigint;
    publisherPriority: number;
    payload: Uint8Array;
}
/**
 * Parse OBJECT_DATAGRAM message
 * Wire format: [Type varint][TrackAlias varint][GroupID varint][ObjectID varint][Priority 1 byte][Payload...]
 */
export declare function parseObjectDatagram(data: Uint8Array, offset?: number): ParsedObjectDatagram;
/**
 * MOQ Transport version we support (draft-ietf-moq-transport-11)
 */
export declare const MOQ_TRANSPORT_VERSION: number;
//# sourceMappingURL=moq-transport.d.ts.map