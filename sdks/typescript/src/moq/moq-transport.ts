/**
 * MOQ Transport Protocol Implementation
 *
 * Implements the IETF MOQ Transport protocol (draft-ietf-moq-transport-11)
 * for use with the Panaudia spatial audio mixer.
 *
 * This is a minimal implementation focused on the messages needed for
 * audio streaming and state updates.
 */

import {
  MoqMessageType,
  MoqRole,
  MoqSetupParameter,
  MoqSubscription,
  MoqAnnouncement,
} from './types.js';

// ============================================================================
// VARINT Encoding/Decoding (RFC 9000 style)
// ============================================================================

/**
 * Encode a number as a QUIC-style variable-length integer
 * Returns the encoded bytes
 */
export function encodeVarint(value: number | bigint): Uint8Array {
  const n = BigInt(value);

  if (n < 64n) {
    // 1 byte: 00xxxxxx
    return new Uint8Array([Number(n)]);
  } else if (n < 16384n) {
    // 2 bytes: 01xxxxxx xxxxxxxx
    return new Uint8Array([Number((n >> 8n) | 0x40n), Number(n & 0xffn)]);
  } else if (n < 1073741824n) {
    // 4 bytes: 10xxxxxx xxxxxxxx xxxxxxxx xxxxxxxx
    return new Uint8Array([
      Number((n >> 24n) | 0x80n),
      Number((n >> 16n) & 0xffn),
      Number((n >> 8n) & 0xffn),
      Number(n & 0xffn),
    ]);
  } else {
    // 8 bytes: 11xxxxxx xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxxx
    return new Uint8Array([
      Number((n >> 56n) | 0xc0n),
      Number((n >> 48n) & 0xffn),
      Number((n >> 40n) & 0xffn),
      Number((n >> 32n) & 0xffn),
      Number((n >> 24n) & 0xffn),
      Number((n >> 16n) & 0xffn),
      Number((n >> 8n) & 0xffn),
      Number(n & 0xffn),
    ]);
  }
}

/**
 * Decode a QUIC-style variable-length integer from a byte array
 * Returns the decoded value and the number of bytes consumed
 */
export function decodeVarint(data: Uint8Array, offset: number = 0): { value: bigint; bytesRead: number } {
  if (offset >= data.length) {
    throw new Error('Not enough data to decode varint');
  }

  const firstByte = data[offset]!;
  const prefix = firstByte >> 6;

  switch (prefix) {
    case 0: {
      // 1 byte
      return { value: BigInt(firstByte), bytesRead: 1 };
    }
    case 1: {
      // 2 bytes
      if (offset + 2 > data.length) {
        throw new Error('Not enough data for 2-byte varint');
      }
      const value = BigInt((firstByte & 0x3f) << 8) | BigInt(data[offset + 1]!);
      return { value, bytesRead: 2 };
    }
    case 2: {
      // 4 bytes
      if (offset + 4 > data.length) {
        throw new Error('Not enough data for 4-byte varint');
      }
      const value =
        (BigInt(firstByte & 0x3f) << 24n) |
        (BigInt(data[offset + 1]!) << 16n) |
        (BigInt(data[offset + 2]!) << 8n) |
        BigInt(data[offset + 3]!);
      return { value, bytesRead: 4 };
    }
    case 3: {
      // 8 bytes
      if (offset + 8 > data.length) {
        throw new Error('Not enough data for 8-byte varint');
      }
      const value =
        (BigInt(firstByte & 0x3f) << 56n) |
        (BigInt(data[offset + 1]!) << 48n) |
        (BigInt(data[offset + 2]!) << 40n) |
        (BigInt(data[offset + 3]!) << 32n) |
        (BigInt(data[offset + 4]!) << 24n) |
        (BigInt(data[offset + 5]!) << 16n) |
        (BigInt(data[offset + 6]!) << 8n) |
        BigInt(data[offset + 7]!);
      return { value, bytesRead: 8 };
    }
    default:
      throw new Error('Invalid varint prefix');
  }
}

// ============================================================================
// String/Bytes Encoding
// ============================================================================

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Encode a string with length prefix (varint length + UTF-8 bytes)
 */
export function encodeString(str: string): Uint8Array {
  const bytes = textEncoder.encode(str);
  const lengthBytes = encodeVarint(bytes.length);
  const result = new Uint8Array(lengthBytes.length + bytes.length);
  result.set(lengthBytes, 0);
  result.set(bytes, lengthBytes.length);
  return result;
}

/**
 * Decode a length-prefixed string
 */
export function decodeString(data: Uint8Array, offset: number = 0): { value: string; bytesRead: number } {
  const { value: length, bytesRead: lengthBytes } = decodeVarint(data, offset);
  const stringLength = Number(length);
  const stringStart = offset + lengthBytes;
  const stringEnd = stringStart + stringLength;

  if (stringEnd > data.length) {
    throw new Error('Not enough data for string');
  }

  const value = textDecoder.decode(data.subarray(stringStart, stringEnd));
  return { value, bytesRead: lengthBytes + stringLength };
}

/**
 * Encode bytes with length prefix (varint length + raw bytes)
 */
export function encodeBytes(bytes: Uint8Array): Uint8Array {
  const lengthBytes = encodeVarint(bytes.length);
  const result = new Uint8Array(lengthBytes.length + bytes.length);
  result.set(lengthBytes, 0);
  result.set(bytes, lengthBytes.length);
  return result;
}

/**
 * Decode length-prefixed bytes
 */
export function decodeBytes(data: Uint8Array, offset: number = 0): { value: Uint8Array; bytesRead: number } {
  const { value: length, bytesRead: lengthBytes } = decodeVarint(data, offset);
  const bytesLength = Number(length);
  const bytesStart = offset + lengthBytes;
  const bytesEnd = bytesStart + bytesLength;

  if (bytesEnd > data.length) {
    throw new Error('Not enough data for bytes');
  }

  const value = data.subarray(bytesStart, bytesEnd);
  return { value, bytesRead: lengthBytes + bytesLength };
}

// ============================================================================
// Message Building Helpers
// ============================================================================

/**
 * Buffer builder for constructing MOQ messages
 */
export class MessageBuilder {
  private chunks: Uint8Array[] = [];
  private totalLength = 0;

  /**
   * Append a varint to the message
   */
  writeVarint(value: number | bigint): this {
    const bytes = encodeVarint(value);
    this.chunks.push(bytes);
    this.totalLength += bytes.length;
    return this;
  }

  /**
   * Append a length-prefixed string to the message
   */
  writeString(str: string): this {
    const bytes = encodeString(str);
    this.chunks.push(bytes);
    this.totalLength += bytes.length;
    return this;
  }

  /**
   * Append length-prefixed bytes to the message
   */
  writeBytes(data: Uint8Array): this {
    const bytes = encodeBytes(data);
    this.chunks.push(bytes);
    this.totalLength += bytes.length;
    return this;
  }

  /**
   * Append raw bytes (no length prefix) to the message
   */
  writeRaw(data: Uint8Array): this {
    this.chunks.push(data);
    this.totalLength += data.length;
    return this;
  }

  /**
   * Build the final message
   */
  build(): Uint8Array {
    const result = new Uint8Array(this.totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}

// ============================================================================
// MOQ Message Encoding
// ============================================================================

/**
 * Wrap a message with length framing as expected by moqtransport library.
 * Format: [Message Type varint] [Length: 2 bytes big-endian] [Content]
 */
export function wrapWithLengthFrame(messageType: number, content: Uint8Array): Uint8Array {
  const typeBytes = encodeVarint(messageType);
  const length = content.length;

  // 2-byte big-endian length
  const lengthBytes = new Uint8Array(2);
  lengthBytes[0] = (length >> 8) & 0xff;
  lengthBytes[1] = length & 0xff;

  // Combine: type + length + content
  const result = new Uint8Array(typeBytes.length + 2 + content.length);
  result.set(typeBytes, 0);
  result.set(lengthBytes, typeBytes.length);
  result.set(content, typeBytes.length + 2);

  return result;
}

/**
 * Build CLIENT_SETUP message
 *
 * Per draft-ietf-moq-transport-11, setup parameter encoding depends on type:
 * - Even types (0x00, 0x02, etc.): Value is a single varint (no length prefix)
 * - Odd types (0x01, etc.): Length-prefixed bytes
 */
export function buildClientSetup(
  supportedVersions: number[],
  role: MoqRole,
  path?: string,
  maxSubscribeId?: number
): Uint8Array {
  // Build the content (everything after message type and length)
  const contentBuilder = new MessageBuilder();

  // Number of supported versions
  contentBuilder.writeVarint(supportedVersions.length);

  // Supported versions
  for (const version of supportedVersions) {
    contentBuilder.writeVarint(version);
  }

  // Count parameters
  let numParams = 1; // Role is required
  if (path !== undefined) numParams++;
  if (maxSubscribeId !== undefined) numParams++;

  contentBuilder.writeVarint(numParams);

  // Role parameter (type 0x00, even - just varint value, no length prefix)
  contentBuilder.writeVarint(MoqSetupParameter.ROLE);
  contentBuilder.writeVarint(role);

  // Path parameter (type 0x01, odd - length-prefixed bytes)
  if (path !== undefined) {
    contentBuilder.writeVarint(MoqSetupParameter.PATH);
    const pathBytes = textEncoder.encode(path);
    contentBuilder.writeVarint(pathBytes.length);
    contentBuilder.writeRaw(pathBytes);
  }

  // Max subscribe ID parameter (type 0x02, even - just varint value, no length prefix)
  if (maxSubscribeId !== undefined) {
    contentBuilder.writeVarint(MoqSetupParameter.MAX_SUBSCRIBE_ID);
    contentBuilder.writeVarint(maxSubscribeId);
  }

  // Wrap with length frame
  return wrapWithLengthFrame(MoqMessageType.CLIENT_SETUP, contentBuilder.build());
}

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
export function buildSubscribe(subscription: MoqSubscription): Uint8Array {
  const contentBuilder = new MessageBuilder();

  // Request ID (called subscribeId in our interface)
  contentBuilder.writeVarint(subscription.subscribeId);

  // Namespace (tuple of strings)
  contentBuilder.writeVarint(subscription.namespace.length);
  for (const part of subscription.namespace) {
    contentBuilder.writeString(part);
  }

  // Track name (varint-prefixed bytes)
  contentBuilder.writeString(subscription.trackName);

  // Subscriber priority (1 byte, default 128)
  const priority = subscription.subscriberPriority ?? 128;
  contentBuilder.writeRaw(new Uint8Array([priority]));

  // Group order (1 byte, default 0 = none)
  const groupOrder = subscription.groupOrder ?? 0;
  contentBuilder.writeRaw(new Uint8Array([groupOrder]));

  // Forward (1 byte, default 0)
  const forward = subscription.forward ?? 0;
  contentBuilder.writeRaw(new Uint8Array([forward]));

  // Filter type
  contentBuilder.writeVarint(subscription.filterType);

  // Filter-specific fields based on type
  // For LATEST_GROUP/LATEST_OBJECT, no additional fields needed
  // For ABSOLUTE_START and ABSOLUTE_RANGE, we would add group/object IDs

  // Parameters (KVPList format: count + key-value pairs)
  if (subscription.authorization) {
    // One parameter: authorization
    contentBuilder.writeVarint(1);

    // Authorization parameter (0x03 = AuthorizationTokenParameterKey per moqtransport v0.5.1)
    // KVP format: type (varint) + length (varint) + value (bytes)
    contentBuilder.writeVarint(0x03);
    const authBytes = textEncoder.encode(subscription.authorization);
    contentBuilder.writeVarint(authBytes.length);
    contentBuilder.writeRaw(authBytes);
  } else {
    // No parameters
    contentBuilder.writeVarint(0);
  }

  return wrapWithLengthFrame(MoqMessageType.SUBSCRIBE, contentBuilder.build());
}

/**
 * Build ANNOUNCE message
 * Format: [RequestID varint][Namespace Tuple][Parameters count + list]
 */
export function buildAnnounce(announcement: MoqAnnouncement): Uint8Array {
  const contentBuilder = new MessageBuilder();

  // Request ID (required by moqtransport v0.5.0)
  contentBuilder.writeVarint(announcement.requestId);

  // Namespace (tuple of strings)
  contentBuilder.writeVarint(announcement.namespace.length);
  for (const part of announcement.namespace) {
    contentBuilder.writeString(part);
  }

  // Parameters
  if (announcement.parameters && announcement.parameters.size > 0) {
    contentBuilder.writeVarint(announcement.parameters.size);
    for (const [key, value] of announcement.parameters) {
      contentBuilder.writeVarint(key);
      contentBuilder.writeBytes(value);
    }
  } else {
    contentBuilder.writeVarint(0);
  }

  return wrapWithLengthFrame(MoqMessageType.ANNOUNCE, contentBuilder.build());
}

/**
 * Build UNSUBSCRIBE message
 */
export function buildUnsubscribe(subscribeId: number): Uint8Array {
  const contentBuilder = new MessageBuilder();
  contentBuilder.writeVarint(subscribeId);
  return wrapWithLengthFrame(MoqMessageType.UNSUBSCRIBE, contentBuilder.build());
}

/**
 * Build UNANNOUNCE message
 */
export function buildUnannounce(namespace: string[]): Uint8Array {
  const contentBuilder = new MessageBuilder();

  // Namespace tuple
  contentBuilder.writeVarint(namespace.length);
  for (const part of namespace) {
    contentBuilder.writeString(part);
  }

  return wrapWithLengthFrame(MoqMessageType.UNANNOUNCE, contentBuilder.build());
}

/**
 * Build OBJECT_DATAGRAM message (for sending audio/state data)
 */
export function buildObjectDatagram(
  trackAlias: number,
  groupId: bigint,
  objectId: bigint,
  publisherPriority: number,
  payload: Uint8Array
): Uint8Array {
  const builder = new MessageBuilder();

  // Object datagram type: 0x00 = datagram without extension headers
  // (0x01 = with extensions, 0x02 = status, 0x03 = status with extensions)
  builder.writeVarint(0x00);

  // Track alias
  builder.writeVarint(trackAlias);

  // Group ID
  builder.writeVarint(groupId);

  // Object ID
  builder.writeVarint(objectId);

  // Publisher priority (single byte, NOT varint)
  builder.writeRaw(new Uint8Array([publisherPriority & 0xff]));

  // Payload (rest of datagram, no length prefix)
  builder.writeRaw(payload);

  return builder.build();
}

// ============================================================================
// MOQ Message Parsing
// ============================================================================

/**
 * Parse the message type from the beginning of a message
 */
export function parseMessageType(data: Uint8Array): { type: MoqMessageType; bytesRead: number } {
  const { value, bytesRead } = decodeVarint(data, 0);
  return { type: Number(value) as MoqMessageType, bytesRead };
}

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
export function parseServerSetup(data: Uint8Array, offset: number = 0): ParsedServerSetup {
  let pos = offset;

  // Selected version
  const { value: version, bytesRead: versionBytes } = decodeVarint(data, pos);
  pos += versionBytes;

  // Number of parameters
  const { value: numParams, bytesRead: numParamsBytes } = decodeVarint(data, pos);
  pos += numParamsBytes;

  // Parameters
  const parameters = new Map<number, Uint8Array>();
  for (let i = 0; i < Number(numParams); i++) {
    const { value: paramType, bytesRead: paramTypeBytes } = decodeVarint(data, pos);
    pos += paramTypeBytes;

    const typeNum = Number(paramType);

    if (typeNum % 2 === 0) {
      // Even type: value is a single varint (no length prefix)
      const { value: paramValue, bytesRead: paramValueBytes } = decodeVarint(data, pos);
      pos += paramValueBytes;
      // Store the varint value as bytes
      const valueBytes = encodeVarint(paramValue);
      parameters.set(typeNum, valueBytes);
    } else {
      // Odd type: length-prefixed bytes
      const { value: paramValue, bytesRead: paramValueBytes } = decodeBytes(data, pos);
      pos += paramValueBytes;
      parameters.set(typeNum, paramValue);
    }
  }

  return {
    selectedVersion: Number(version),
    parameters,
  };
}

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
export function parseSubscribeOk(data: Uint8Array, offset: number = 0): ParsedSubscribeOk {
  let pos = offset;

  // Request ID
  const { value: subscribeId, bytesRead: subIdBytes } = decodeVarint(data, pos);
  pos += subIdBytes;

  // Track Alias (assigned by publisher, used in datagrams)
  const { value: trackAlias, bytesRead: aliasBytes } = decodeVarint(data, pos);
  pos += aliasBytes;

  // Expires (varint, milliseconds)
  const { value: expires, bytesRead: expiresBytes } = decodeVarint(data, pos);
  pos += expiresBytes;

  // Group Order (1 byte, NOT varint)
  if (pos >= data.length) {
    throw new Error('Not enough data for GroupOrder in SUBSCRIBE_OK');
  }
  const groupOrder = data[pos]!;
  pos += 1;

  // Content Exists (1 byte: 0 or 1)
  if (pos >= data.length) {
    throw new Error('Not enough data for ContentExists in SUBSCRIBE_OK');
  }
  const contentExists = data[pos]! !== 0;
  pos += 1;

  const result: ParsedSubscribeOk = {
    subscribeId: Number(subscribeId),
    trackAlias: Number(trackAlias),
    expires,
    groupOrder,
    contentExists,
  };

  // If content exists, parse largest location (group + object)
  if (result.contentExists) {
    const { value: largestGroupId, bytesRead: groupIdBytes } = decodeVarint(data, pos);
    pos += groupIdBytes;

    const { value: largestObjectId, bytesRead: objectIdBytes } = decodeVarint(data, pos);
    pos += objectIdBytes;

    result.largestGroupId = largestGroupId;
    result.largestObjectId = largestObjectId;
  }

  return result;
}

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
export function parseSubscribeError(data: Uint8Array, offset: number = 0): ParsedSubscribeError {
  let pos = offset;

  // Subscribe ID
  const { value: subscribeId, bytesRead: subIdBytes } = decodeVarint(data, pos);
  pos += subIdBytes;

  // Error code
  const { value: errorCode, bytesRead: errorCodeBytes } = decodeVarint(data, pos);
  pos += errorCodeBytes;

  // Reason phrase
  const { value: reasonPhrase, bytesRead: reasonBytes } = decodeString(data, pos);
  pos += reasonBytes;

  // Track alias
  const { value: trackAlias, bytesRead: aliasBytes } = decodeVarint(data, pos);
  pos += aliasBytes;

  return {
    subscribeId: Number(subscribeId),
    errorCode: Number(errorCode),
    reasonPhrase,
    trackAlias: Number(trackAlias),
  };
}

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
export function parseAnnounceOk(data: Uint8Array, offset: number = 0): ParsedAnnounceOk {
  // moqtransport v0.5.0: ANNOUNCE_OK contains just RequestID
  const { value: requestId } = decodeVarint(data, offset);

  return { requestId: Number(requestId) };
}

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
export function parseAnnounceError(data: Uint8Array, offset: number = 0): ParsedAnnounceError {
  let pos = offset;

  // Namespace tuple length
  const { value: nsLength, bytesRead: nsLengthBytes } = decodeVarint(data, pos);
  pos += nsLengthBytes;

  // Namespace parts
  const namespace: string[] = [];
  for (let i = 0; i < Number(nsLength); i++) {
    const { value: part, bytesRead: partBytes } = decodeString(data, pos);
    pos += partBytes;
    namespace.push(part);
  }

  // Error code
  const { value: errorCode, bytesRead: errorCodeBytes } = decodeVarint(data, pos);
  pos += errorCodeBytes;

  // Reason phrase
  const { value: reasonPhrase, bytesRead: reasonBytes } = decodeString(data, pos);
  pos += reasonBytes;

  return {
    namespace,
    errorCode: Number(errorCode),
    reasonPhrase,
  };
}

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
export function parseObjectDatagram(data: Uint8Array, offset: number = 0): ParsedObjectDatagram {
  let pos = offset;

  // Type (0x00=datagram, 0x01=datagram+extensions, 0x02=status, 0x03=status+extensions)
  const { value: _type, bytesRead: typeBytes } = decodeVarint(data, pos);
  pos += typeBytes;

  // Track alias
  const { value: trackAlias, bytesRead: aliasBytes } = decodeVarint(data, pos);
  pos += aliasBytes;

  // Group ID
  const { value: groupId, bytesRead: groupIdBytes } = decodeVarint(data, pos);
  pos += groupIdBytes;

  // Object ID
  const { value: objectId, bytesRead: objectIdBytes } = decodeVarint(data, pos);
  pos += objectIdBytes;

  // Publisher priority (single byte, NOT varint)
  if (pos >= data.length) {
    throw new Error('Not enough data for publisher priority');
  }
  const publisherPriority = data[pos]!;
  pos += 1;

  // Payload (rest of message)
  const payload = data.subarray(pos);

  return {
    trackAlias: Number(trackAlias),
    groupId,
    objectId,
    publisherPriority,
    payload,
  };
}

// ============================================================================
// MOQ Protocol Version
// ============================================================================

/**
 * MOQ Transport version we support (draft-ietf-moq-transport-11)
 */
export const MOQ_TRANSPORT_VERSION = 0xff000000 + 11; // Draft version marker + draft number
