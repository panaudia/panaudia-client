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
 * A MOQ key-value parameter. By convention (RFC/draft-16):
 * - even `type` -> value is a varint (`bigint`)
 * - odd  `type` -> value is a length-prefixed byte blob (`Uint8Array`)
 */
export interface Kvp {
    type: number;
    value: bigint | Uint8Array;
}
/**
 * Append a parameter list using draft-16 delta encoding:
 *   [count][ (deltaType, value) ... ]
 * where deltaType = type - previousType (previousType starts at 0), the list is
 * sorted ascending by type first, and the value is a bare varint for even types
 * or length-prefixed bytes for odd types. Matches Eyevinn's KVPList.AppendNumVersioned.
 */
export declare function encodeParams(builder: MessageBuilder, params: Kvp[]): void;
/**
 * Decode a delta-encoded parameter list into a Map keyed by absolute type.
 * Even types map to a `bigint` (the varint value); odd types map to a
 * `Uint8Array` (the raw blob). Mirrors Eyevinn's KVPList.ParseNumVersioned.
 */
export declare function decodeParams(data: Uint8Array, offset?: number): {
    params: Map<number, bigint | Uint8Array>;
    bytesRead: number;
};
/**
 * Build CLIENT_SETUP message (draft-16).
 *
 * draft-16 differences from draft-11:
 * - NO supported-versions list (version is negotiated out-of-band via ALPN).
 * - NO ROLE parameter (removed from the spec).
 * - Setup parameters are delta-encoded (see encodeParams).
 *
 * `supportedVersions` and `role` are accepted for signature compatibility but
 * are not written to the wire in draft-16.
 */
export declare function buildClientSetup(_supportedVersions: number[], _role: MoqRole, path?: string, maxSubscribeId?: number): Uint8Array;
/**
 * Build SUBSCRIBE message (draft-16).
 *
 * Body: RequestID, TrackNamespace (tuple), TrackName (len-prefixed), then a
 * delta-encoded parameter list. SubscriberPriority/GroupOrder/Forward and the
 * Subscription Filter are now PARAMETERS (not inline fields). The custom
 * AuthorizationToken (0x03, raw JWT) and ResumeHLC (0xFF01) ride in the same
 * sorted, delta-encoded list.
 *
 * TrackAlias is NOT in SUBSCRIBE; the publisher assigns it in SUBSCRIBE_OK.
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
 * Parse SERVER_SETUP message (draft-16).
 *
 * draft-16 SERVER_SETUP has NO selected-version field (the version is fixed by
 * the ALPN negotiated out-of-band); the body is just a delta-encoded parameter
 * list. We report `selectedVersion` as the version we speak for logging.
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
 * Parse SUBSCRIBE_OK message (draft-16).
 *
 * Body: RequestID, TrackAlias, then a delta-encoded parameter list. Expires
 * (0x08), GroupOrder (0x22) and Largest Object (0x09 -> ContentExists) are now
 * PARAMETERS, not inline fields. A trailing Track Extensions block may follow
 * but Eyevinn emits none today, so we ignore anything after the params.
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
 * Parse SUBSCRIBE_ERROR message (draft-16).
 *
 * Body: RequestID, ErrorCode, RetryInterval (new in draft-16), ReasonPhrase.
 * There is NO trailing TrackAlias (that was draft-11); it is reported as 0.
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
 * MOQ Transport version we support (draft-ietf-moq-transport-16).
 * Not sent in-band (draft-16 negotiates via the "moqt-16" ALPN); kept for
 * logging and to report a selected version from SERVER_SETUP.
 */
export declare const MOQ_TRANSPORT_VERSION: number;
//# sourceMappingURL=moq-transport.d.ts.map