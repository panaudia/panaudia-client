var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var MoqMessageType = /* @__PURE__ */ ((MoqMessageType2) => {
  MoqMessageType2[MoqMessageType2["CLIENT_SETUP"] = 64] = "CLIENT_SETUP";
  MoqMessageType2[MoqMessageType2["SERVER_SETUP"] = 65] = "SERVER_SETUP";
  MoqMessageType2[MoqMessageType2["ANNOUNCE"] = 6] = "ANNOUNCE";
  MoqMessageType2[MoqMessageType2["ANNOUNCE_OK"] = 7] = "ANNOUNCE_OK";
  MoqMessageType2[MoqMessageType2["ANNOUNCE_ERROR"] = 8] = "ANNOUNCE_ERROR";
  MoqMessageType2[MoqMessageType2["UNANNOUNCE"] = 9] = "UNANNOUNCE";
  MoqMessageType2[MoqMessageType2["SUBSCRIBE"] = 3] = "SUBSCRIBE";
  MoqMessageType2[MoqMessageType2["SUBSCRIBE_OK"] = 4] = "SUBSCRIBE_OK";
  MoqMessageType2[MoqMessageType2["SUBSCRIBE_ERROR"] = 5] = "SUBSCRIBE_ERROR";
  MoqMessageType2[MoqMessageType2["UNSUBSCRIBE"] = 10] = "UNSUBSCRIBE";
  MoqMessageType2[MoqMessageType2["SUBSCRIBE_DONE"] = 11] = "SUBSCRIBE_DONE";
  MoqMessageType2[MoqMessageType2["OBJECT_STREAM"] = 0] = "OBJECT_STREAM";
  MoqMessageType2[MoqMessageType2["OBJECT_DATAGRAM"] = 1] = "OBJECT_DATAGRAM";
  MoqMessageType2[MoqMessageType2["GOAWAY"] = 16] = "GOAWAY";
  return MoqMessageType2;
})(MoqMessageType || {});
var MoqSetupParameter = /* @__PURE__ */ ((MoqSetupParameter2) => {
  MoqSetupParameter2[MoqSetupParameter2["ROLE"] = 0] = "ROLE";
  MoqSetupParameter2[MoqSetupParameter2["PATH"] = 1] = "PATH";
  MoqSetupParameter2[MoqSetupParameter2["MAX_SUBSCRIBE_ID"] = 2] = "MAX_SUBSCRIBE_ID";
  return MoqSetupParameter2;
})(MoqSetupParameter || {});
var MoqRole = /* @__PURE__ */ ((MoqRole2) => {
  MoqRole2[MoqRole2["PUBLISHER"] = 0] = "PUBLISHER";
  MoqRole2[MoqRole2["SUBSCRIBER"] = 1] = "SUBSCRIBER";
  MoqRole2[MoqRole2["PUBSUB"] = 2] = "PUBSUB";
  return MoqRole2;
})(MoqRole || {});
var MoqFilterType = /* @__PURE__ */ ((MoqFilterType2) => {
  MoqFilterType2[MoqFilterType2["LATEST_GROUP"] = 1] = "LATEST_GROUP";
  MoqFilterType2[MoqFilterType2["LATEST_OBJECT"] = 2] = "LATEST_OBJECT";
  MoqFilterType2[MoqFilterType2["ABSOLUTE_START"] = 3] = "ABSOLUTE_START";
  MoqFilterType2[MoqFilterType2["ABSOLUTE_RANGE"] = 4] = "ABSOLUTE_RANGE";
  return MoqFilterType2;
})(MoqFilterType || {});
var MoqForwardingPreference = /* @__PURE__ */ ((MoqForwardingPreference2) => {
  MoqForwardingPreference2[MoqForwardingPreference2["DATAGRAM"] = 0] = "DATAGRAM";
  MoqForwardingPreference2[MoqForwardingPreference2["STREAM_TRACK"] = 1] = "STREAM_TRACK";
  MoqForwardingPreference2[MoqForwardingPreference2["STREAM_GROUP"] = 2] = "STREAM_GROUP";
  MoqForwardingPreference2[MoqForwardingPreference2["STREAM_OBJECT"] = 3] = "STREAM_OBJECT";
  return MoqForwardingPreference2;
})(MoqForwardingPreference || {});
var MoqErrorCode = /* @__PURE__ */ ((MoqErrorCode2) => {
  MoqErrorCode2[MoqErrorCode2["NO_ERROR"] = 0] = "NO_ERROR";
  MoqErrorCode2[MoqErrorCode2["INTERNAL_ERROR"] = 1] = "INTERNAL_ERROR";
  MoqErrorCode2[MoqErrorCode2["UNAUTHORIZED"] = 2] = "UNAUTHORIZED";
  MoqErrorCode2[MoqErrorCode2["PROTOCOL_VIOLATION"] = 3] = "PROTOCOL_VIOLATION";
  MoqErrorCode2[MoqErrorCode2["DUPLICATE_TRACK_ALIAS"] = 4] = "DUPLICATE_TRACK_ALIAS";
  MoqErrorCode2[MoqErrorCode2["PARAMETER_LENGTH_MISMATCH"] = 5] = "PARAMETER_LENGTH_MISMATCH";
  MoqErrorCode2[MoqErrorCode2["TOO_MANY_SUBSCRIBES"] = 6] = "TOO_MANY_SUBSCRIBES";
  MoqErrorCode2[MoqErrorCode2["GOAWAY_TIMEOUT"] = 16] = "GOAWAY_TIMEOUT";
  MoqErrorCode2[MoqErrorCode2["INVALID_TOKEN"] = 1027] = "INVALID_TOKEN";
  return MoqErrorCode2;
})(MoqErrorCode || {});
var ConnectionState = /* @__PURE__ */ ((ConnectionState2) => {
  ConnectionState2["DISCONNECTED"] = "disconnected";
  ConnectionState2["CONNECTING"] = "connecting";
  ConnectionState2["CONNECTED"] = "connected";
  ConnectionState2["AUTHENTICATED"] = "authenticated";
  ConnectionState2["ERROR"] = "error";
  return ConnectionState2;
})(ConnectionState || {});
var PanaudiaTrackType = /* @__PURE__ */ ((PanaudiaTrackType2) => {
  PanaudiaTrackType2["AUDIO_INPUT"] = "in/audio/opus-mono";
  PanaudiaTrackType2["AUDIO_OUTPUT"] = "out/audio/opus-stereo";
  PanaudiaTrackType2["STATE"] = "state";
  return PanaudiaTrackType2;
})(PanaudiaTrackType || {});
function generateTrackNamespace(trackType, nodeId) {
  switch (trackType) {
    case "in/audio/opus-mono":
      return ["in", "audio", "opus-mono", nodeId];
    case "out/audio/opus-stereo":
      return ["out", "audio", "opus-stereo", nodeId];
    case "state":
      return ["state", nodeId];
    default:
      throw new Error(`Unknown track type: ${trackType}`);
  }
}
class MoqConnection {
  constructor(serverUrl) {
    __publicField(this, "transport", null);
    __publicField(this, "state", ConnectionState.DISCONNECTED);
    __publicField(this, "handlers", {});
    this.serverUrl = serverUrl;
  }
  /**
   * Get current connection state
   */
  getState() {
    return this.state;
  }
  /**
   * Get the underlying WebTransport instance
   */
  getTransport() {
    return this.transport;
  }
  /**
   * Set event handlers
   */
  setHandlers(handlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }
  /**
   * Connect to the MOQ server via WebTransport
   */
  async connect(options) {
    if (this.state !== ConnectionState.DISCONNECTED) {
      throw new Error(`Cannot connect: already in state ${this.state}`);
    }
    this.setState(ConnectionState.CONNECTING);
    try {
      const wtOptions = {
        allowPooling: false,
        requireUnreliable: true,
        // We use datagrams for audio
        congestionControl: "low-latency",
        ...options
      };
      this.transport = new WebTransport(this.serverUrl, wtOptions);
      this.transport.closed.then((info) => {
        this.handleClose(info);
      }).catch((error) => {
        this.handleError(error);
      });
      await this.transport.ready;
      this.setState(ConnectionState.CONNECTED);
    } catch (error) {
      this.setState(ConnectionState.ERROR, error);
      throw error;
    }
  }
  /**
   * Close the connection gracefully
   */
  close(closeInfo) {
    if (this.transport) {
      this.transport.close(closeInfo);
      this.transport = null;
    }
    this.setState(ConnectionState.DISCONNECTED);
  }
  /**
   * Create a bidirectional stream for the MOQ control channel
   */
  async createControlStream() {
    if (!this.transport) {
      throw new Error("Not connected");
    }
    return this.transport.createBidirectionalStream();
  }
  /**
   * Create a unidirectional stream for sending data
   */
  async createSendStream() {
    if (!this.transport) {
      throw new Error("Not connected");
    }
    return this.transport.createUnidirectionalStream();
  }
  /**
   * Get the incoming unidirectional streams reader
   */
  getIncomingStreams() {
    if (!this.transport) {
      throw new Error("Not connected");
    }
    return this.transport.incomingUnidirectionalStreams;
  }
  /**
   * Get the datagram writer/reader for audio frames
   */
  getDatagrams() {
    if (!this.transport) {
      throw new Error("Not connected");
    }
    return this.transport.datagrams;
  }
  /**
   * Get a reader for incoming datagrams
   */
  getDatagramReader() {
    if (!this.transport) {
      return null;
    }
    return this.transport.datagrams.readable.getReader();
  }
  /**
   * Send a datagram (used for audio frames)
   */
  async sendDatagram(data) {
    if (!this.transport) {
      throw new Error("Not connected");
    }
    const writer = this.transport.datagrams.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }
  /**
   * Update connection state and notify handlers
   */
  setState(state, error) {
    this.state = state;
    if (this.handlers.onStateChange) {
      this.handlers.onStateChange(state, error);
    }
  }
  /**
   * Handle connection close
   */
  handleClose(info) {
    this.transport = null;
    this.setState(ConnectionState.DISCONNECTED);
    if (this.handlers.onClose) {
      this.handlers.onClose(info);
    }
  }
  /**
   * Handle connection error
   */
  handleError(error) {
    console.error("WebTransport connection error:", error);
    this.transport = null;
    this.setState(ConnectionState.ERROR, error);
  }
}
function isWebTransportSupported() {
  return typeof WebTransport !== "undefined";
}
function getWebTransportSupport() {
  const supported = isWebTransportSupported();
  return {
    supported,
    // These are typically supported if WebTransport is available
    datagrams: supported,
    serverCertificateHashes: supported
  };
}
function encodeVarint(value) {
  const n = BigInt(value);
  if (n < 64n) {
    return new Uint8Array([Number(n)]);
  } else if (n < 16384n) {
    return new Uint8Array([Number(n >> 8n | 0x40n), Number(n & 0xffn)]);
  } else if (n < 1073741824n) {
    return new Uint8Array([
      Number(n >> 24n | 0x80n),
      Number(n >> 16n & 0xffn),
      Number(n >> 8n & 0xffn),
      Number(n & 0xffn)
    ]);
  } else {
    return new Uint8Array([
      Number(n >> 56n | 0xc0n),
      Number(n >> 48n & 0xffn),
      Number(n >> 40n & 0xffn),
      Number(n >> 32n & 0xffn),
      Number(n >> 24n & 0xffn),
      Number(n >> 16n & 0xffn),
      Number(n >> 8n & 0xffn),
      Number(n & 0xffn)
    ]);
  }
}
function decodeVarint(data, offset = 0) {
  if (offset >= data.length) {
    throw new Error("Not enough data to decode varint");
  }
  const firstByte = data[offset];
  const prefix = firstByte >> 6;
  switch (prefix) {
    case 0: {
      return { value: BigInt(firstByte), bytesRead: 1 };
    }
    case 1: {
      if (offset + 2 > data.length) {
        throw new Error("Not enough data for 2-byte varint");
      }
      const value = BigInt((firstByte & 63) << 8) | BigInt(data[offset + 1]);
      return { value, bytesRead: 2 };
    }
    case 2: {
      if (offset + 4 > data.length) {
        throw new Error("Not enough data for 4-byte varint");
      }
      const value = BigInt(firstByte & 63) << 24n | BigInt(data[offset + 1]) << 16n | BigInt(data[offset + 2]) << 8n | BigInt(data[offset + 3]);
      return { value, bytesRead: 4 };
    }
    case 3: {
      if (offset + 8 > data.length) {
        throw new Error("Not enough data for 8-byte varint");
      }
      const value = BigInt(firstByte & 63) << 56n | BigInt(data[offset + 1]) << 48n | BigInt(data[offset + 2]) << 40n | BigInt(data[offset + 3]) << 32n | BigInt(data[offset + 4]) << 24n | BigInt(data[offset + 5]) << 16n | BigInt(data[offset + 6]) << 8n | BigInt(data[offset + 7]);
      return { value, bytesRead: 8 };
    }
    default:
      throw new Error("Invalid varint prefix");
  }
}
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
function encodeString(str) {
  const bytes = textEncoder.encode(str);
  const lengthBytes = encodeVarint(bytes.length);
  const result = new Uint8Array(lengthBytes.length + bytes.length);
  result.set(lengthBytes, 0);
  result.set(bytes, lengthBytes.length);
  return result;
}
function decodeString(data, offset = 0) {
  const { value: length, bytesRead: lengthBytes } = decodeVarint(data, offset);
  const stringLength = Number(length);
  const stringStart = offset + lengthBytes;
  const stringEnd = stringStart + stringLength;
  if (stringEnd > data.length) {
    throw new Error("Not enough data for string");
  }
  const value = textDecoder.decode(data.subarray(stringStart, stringEnd));
  return { value, bytesRead: lengthBytes + stringLength };
}
function encodeBytes(bytes) {
  const lengthBytes = encodeVarint(bytes.length);
  const result = new Uint8Array(lengthBytes.length + bytes.length);
  result.set(lengthBytes, 0);
  result.set(bytes, lengthBytes.length);
  return result;
}
function decodeBytes(data, offset = 0) {
  const { value: length, bytesRead: lengthBytes } = decodeVarint(data, offset);
  const bytesLength = Number(length);
  const bytesStart = offset + lengthBytes;
  const bytesEnd = bytesStart + bytesLength;
  if (bytesEnd > data.length) {
    throw new Error("Not enough data for bytes");
  }
  const value = data.subarray(bytesStart, bytesEnd);
  return { value, bytesRead: lengthBytes + bytesLength };
}
class MessageBuilder {
  constructor() {
    __publicField(this, "chunks", []);
    __publicField(this, "totalLength", 0);
  }
  /**
   * Append a varint to the message
   */
  writeVarint(value) {
    const bytes = encodeVarint(value);
    this.chunks.push(bytes);
    this.totalLength += bytes.length;
    return this;
  }
  /**
   * Append a length-prefixed string to the message
   */
  writeString(str) {
    const bytes = encodeString(str);
    this.chunks.push(bytes);
    this.totalLength += bytes.length;
    return this;
  }
  /**
   * Append length-prefixed bytes to the message
   */
  writeBytes(data) {
    const bytes = encodeBytes(data);
    this.chunks.push(bytes);
    this.totalLength += bytes.length;
    return this;
  }
  /**
   * Append raw bytes (no length prefix) to the message
   */
  writeRaw(data) {
    this.chunks.push(data);
    this.totalLength += data.length;
    return this;
  }
  /**
   * Build the final message
   */
  build() {
    const result = new Uint8Array(this.totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}
function buildClientSetup(supportedVersions, role, path, maxSubscribeId) {
  const builder = new MessageBuilder();
  builder.writeVarint(MoqMessageType.CLIENT_SETUP);
  builder.writeVarint(supportedVersions.length);
  for (const version of supportedVersions) {
    builder.writeVarint(version);
  }
  let numParams = 1;
  if (path !== void 0) numParams++;
  if (maxSubscribeId !== void 0) numParams++;
  builder.writeVarint(numParams);
  builder.writeVarint(MoqSetupParameter.ROLE);
  builder.writeVarint(1);
  builder.writeVarint(role);
  if (path !== void 0) {
    builder.writeVarint(MoqSetupParameter.PATH);
    const pathBytes = textEncoder.encode(path);
    builder.writeVarint(pathBytes.length);
    builder.writeRaw(pathBytes);
  }
  if (maxSubscribeId !== void 0) {
    builder.writeVarint(MoqSetupParameter.MAX_SUBSCRIBE_ID);
    const maxIdBytes = encodeVarint(maxSubscribeId);
    builder.writeVarint(maxIdBytes.length);
    builder.writeRaw(maxIdBytes);
  }
  return builder.build();
}
function buildSubscribe(subscription) {
  const builder = new MessageBuilder();
  builder.writeVarint(MoqMessageType.SUBSCRIBE);
  builder.writeVarint(subscription.subscribeId);
  builder.writeVarint(subscription.trackAlias);
  builder.writeVarint(subscription.namespace.length);
  for (const part of subscription.namespace) {
    builder.writeString(part);
  }
  builder.writeString(subscription.trackName);
  builder.writeVarint(subscription.filterType);
  if (subscription.authorization) {
    builder.writeVarint(1);
    builder.writeVarint(2);
    builder.writeString(subscription.authorization);
  } else {
    builder.writeVarint(0);
  }
  return builder.build();
}
function buildAnnounce(announcement) {
  const builder = new MessageBuilder();
  builder.writeVarint(MoqMessageType.ANNOUNCE);
  builder.writeVarint(announcement.namespace.length);
  for (const part of announcement.namespace) {
    builder.writeString(part);
  }
  if (announcement.parameters && announcement.parameters.size > 0) {
    builder.writeVarint(announcement.parameters.size);
    for (const [key, value] of announcement.parameters) {
      builder.writeVarint(key);
      builder.writeBytes(value);
    }
  } else {
    builder.writeVarint(0);
  }
  return builder.build();
}
function buildUnsubscribe(subscribeId) {
  const builder = new MessageBuilder();
  builder.writeVarint(MoqMessageType.UNSUBSCRIBE);
  builder.writeVarint(subscribeId);
  return builder.build();
}
function buildUnannounce(namespace) {
  const builder = new MessageBuilder();
  builder.writeVarint(MoqMessageType.UNANNOUNCE);
  builder.writeVarint(namespace.length);
  for (const part of namespace) {
    builder.writeString(part);
  }
  return builder.build();
}
function buildObjectDatagram(trackAlias, groupId, objectId, publisherPriority, payload) {
  const builder = new MessageBuilder();
  builder.writeVarint(MoqMessageType.OBJECT_DATAGRAM);
  builder.writeVarint(trackAlias);
  builder.writeVarint(groupId);
  builder.writeVarint(objectId);
  builder.writeVarint(publisherPriority);
  builder.writeRaw(payload);
  return builder.build();
}
function parseMessageType(data) {
  const { value, bytesRead } = decodeVarint(data, 0);
  return { type: Number(value), bytesRead };
}
function parseServerSetup(data, offset = 0) {
  let pos = offset;
  const { value: version, bytesRead: versionBytes } = decodeVarint(data, pos);
  pos += versionBytes;
  const { value: numParams, bytesRead: numParamsBytes } = decodeVarint(data, pos);
  pos += numParamsBytes;
  const parameters = /* @__PURE__ */ new Map();
  for (let i = 0; i < Number(numParams); i++) {
    const { value: paramType, bytesRead: paramTypeBytes } = decodeVarint(data, pos);
    pos += paramTypeBytes;
    const { value: paramValue, bytesRead: paramValueBytes } = decodeBytes(data, pos);
    pos += paramValueBytes;
    parameters.set(Number(paramType), paramValue);
  }
  return {
    selectedVersion: Number(version),
    parameters
  };
}
function parseSubscribeOk(data, offset = 0) {
  let pos = offset;
  const { value: subscribeId, bytesRead: subIdBytes } = decodeVarint(data, pos);
  pos += subIdBytes;
  const { value: expires, bytesRead: expiresBytes } = decodeVarint(data, pos);
  pos += expiresBytes;
  const { value: contentExists, bytesRead: contentExistsBytes } = decodeVarint(data, pos);
  pos += contentExistsBytes;
  const result = {
    subscribeId: Number(subscribeId),
    expires,
    contentExists: contentExists !== 0n
  };
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
function parseSubscribeError(data, offset = 0) {
  let pos = offset;
  const { value: subscribeId, bytesRead: subIdBytes } = decodeVarint(data, pos);
  pos += subIdBytes;
  const { value: errorCode, bytesRead: errorCodeBytes } = decodeVarint(data, pos);
  pos += errorCodeBytes;
  const { value: reasonPhrase, bytesRead: reasonBytes } = decodeString(data, pos);
  pos += reasonBytes;
  const { value: trackAlias, bytesRead: aliasBytes } = decodeVarint(data, pos);
  pos += aliasBytes;
  return {
    subscribeId: Number(subscribeId),
    errorCode: Number(errorCode),
    reasonPhrase,
    trackAlias: Number(trackAlias)
  };
}
function parseAnnounceOk(data, offset = 0) {
  let pos = offset;
  const { value: nsLength, bytesRead: nsLengthBytes } = decodeVarint(data, pos);
  pos += nsLengthBytes;
  const namespace = [];
  for (let i = 0; i < Number(nsLength); i++) {
    const { value: part, bytesRead: partBytes } = decodeString(data, pos);
    pos += partBytes;
    namespace.push(part);
  }
  return { namespace };
}
function parseAnnounceError(data, offset = 0) {
  let pos = offset;
  const { value: nsLength, bytesRead: nsLengthBytes } = decodeVarint(data, pos);
  pos += nsLengthBytes;
  const namespace = [];
  for (let i = 0; i < Number(nsLength); i++) {
    const { value: part, bytesRead: partBytes } = decodeString(data, pos);
    pos += partBytes;
    namespace.push(part);
  }
  const { value: errorCode, bytesRead: errorCodeBytes } = decodeVarint(data, pos);
  pos += errorCodeBytes;
  const { value: reasonPhrase, bytesRead: reasonBytes } = decodeString(data, pos);
  pos += reasonBytes;
  return {
    namespace,
    errorCode: Number(errorCode),
    reasonPhrase
  };
}
function parseObjectDatagram(data, offset = 0) {
  let pos = offset;
  const { value: trackAlias, bytesRead: aliasBytes } = decodeVarint(data, pos);
  pos += aliasBytes;
  const { value: groupId, bytesRead: groupIdBytes } = decodeVarint(data, pos);
  pos += groupIdBytes;
  const { value: objectId, bytesRead: objectIdBytes } = decodeVarint(data, pos);
  pos += objectIdBytes;
  const { value: publisherPriority, bytesRead: priorityBytes } = decodeVarint(data, pos);
  pos += priorityBytes;
  const payload = data.subarray(pos);
  return {
    trackAlias: Number(trackAlias),
    groupId,
    objectId,
    publisherPriority: Number(publisherPriority),
    payload
  };
}
const MOQ_TRANSPORT_VERSION = 4278190080 + 11;
class MoqClientError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "MoqClientError";
  }
}
class WebTransportNotSupportedError extends MoqClientError {
  constructor() {
    super(
      "WebTransport is not supported in this browser. Try Chrome 97+, Edge 97+, or Safari 16.4+.",
      "WEBTRANSPORT_NOT_SUPPORTED"
    );
    this.name = "WebTransportNotSupportedError";
  }
}
class ConnectionError extends MoqClientError {
  constructor(message, details) {
    super(message, "CONNECTION_FAILED", details);
    this.name = "ConnectionError";
  }
}
class AuthenticationError extends MoqClientError {
  constructor(message, moqErrorCode, details) {
    super(message, "AUTHENTICATION_FAILED", details);
    this.moqErrorCode = moqErrorCode;
    this.name = "AuthenticationError";
  }
  /**
   * Check if this is an invalid token error
   */
  isInvalidToken() {
    return this.moqErrorCode === 2 || this.moqErrorCode === 1027;
  }
  /**
   * Check if this is an expired token error
   */
  isExpiredToken() {
    return this.message.toLowerCase().includes("expired");
  }
}
class JwtParseError extends MoqClientError {
  constructor(message, details) {
    super(message, "JWT_PARSE_FAILED", details);
    this.name = "JwtParseError";
  }
}
class ProtocolError extends MoqClientError {
  constructor(message, moqErrorCode, details) {
    super(message, "PROTOCOL_ERROR", details);
    this.moqErrorCode = moqErrorCode;
    this.name = "ProtocolError";
  }
}
class SubscriptionError extends MoqClientError {
  constructor(message, moqErrorCode, trackNamespace, details) {
    super(message, "SUBSCRIPTION_FAILED", details);
    this.moqErrorCode = moqErrorCode;
    this.trackNamespace = trackNamespace;
    this.name = "SubscriptionError";
  }
}
class AnnouncementError extends MoqClientError {
  constructor(message, moqErrorCode, namespace, details) {
    super(message, "ANNOUNCEMENT_FAILED", details);
    this.moqErrorCode = moqErrorCode;
    this.namespace = namespace;
    this.name = "AnnouncementError";
  }
}
class InvalidStateError extends MoqClientError {
  constructor(expectedState, actualState) {
    super(
      `Invalid state: expected ${expectedState}, but was ${actualState}`,
      "INVALID_STATE",
      { expectedState, actualState }
    );
    this.name = "InvalidStateError";
  }
}
class TimeoutError extends MoqClientError {
  constructor(operation, timeoutMs) {
    super(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      "TIMEOUT",
      { operation, timeoutMs }
    );
    this.name = "TimeoutError";
  }
}
function getMoqErrorMessage(code) {
  switch (code) {
    case 0:
      return "No error";
    case 1:
      return "Internal error";
    case 2:
      return "Unauthorized";
    case 3:
      return "Protocol violation";
    case 4:
      return "Duplicate track alias";
    case 5:
      return "Parameter length mismatch";
    case 6:
      return "Too many subscribes";
    case 16:
      return "GOAWAY timeout";
    case 1027:
      return "Invalid token (custom)";
    default:
      return `Unknown error (0x${code.toString(16)})`;
  }
}
function wrapError(error, defaultCode = "UNKNOWN") {
  if (error instanceof MoqClientError) {
    return error;
  }
  if (error instanceof Error) {
    return new MoqClientError(error.message, defaultCode, error);
  }
  return new MoqClientError(String(error), defaultCode);
}
var AudioPublisherState = /* @__PURE__ */ ((AudioPublisherState2) => {
  AudioPublisherState2["IDLE"] = "idle";
  AudioPublisherState2["REQUESTING_PERMISSION"] = "requesting_permission";
  AudioPublisherState2["READY"] = "ready";
  AudioPublisherState2["RECORDING"] = "recording";
  AudioPublisherState2["PAUSED"] = "paused";
  AudioPublisherState2["ERROR"] = "error";
  return AudioPublisherState2;
})(AudioPublisherState || {});
class AudioPermissionError extends MoqClientError {
  constructor(message, details) {
    super(message, "AUDIO_PERMISSION_DENIED", details);
    this.name = "AudioPermissionError";
  }
}
class AudioEncodingError extends MoqClientError {
  constructor(message, details) {
    super(message, "AUDIO_ENCODING_FAILED", details);
    this.name = "AudioEncodingError";
  }
}
class AudioNotSupportedError extends MoqClientError {
  constructor(message) {
    super(message, "AUDIO_NOT_SUPPORTED");
    this.name = "AudioNotSupportedError";
  }
}
function isOpusSupported() {
  if (typeof MediaRecorder === "undefined") {
    return false;
  }
  const mimeTypes = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm"
  ];
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return true;
    }
  }
  return false;
}
function getBestOpusMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }
  const mimeTypes = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm"
  ];
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return null;
}
class AudioPublisher {
  constructor(config = {}) {
    __publicField(this, "config");
    __publicField(this, "state", "idle");
    __publicField(this, "mediaStream", null);
    __publicField(this, "mediaRecorder", null);
    __publicField(this, "frameHandler", null);
    // Timing
    __publicField(this, "startTime", 0);
    __publicField(this, "frameSequence", 0);
    this.config = {
      sampleRate: config.sampleRate ?? 48e3,
      channelCount: config.channelCount ?? 1,
      bitrate: config.bitrate ?? 64e3,
      frameDurationMs: config.frameDurationMs ?? 20,
      echoCancellation: config.echoCancellation ?? true,
      noiseSuppression: config.noiseSuppression ?? true,
      autoGainControl: config.autoGainControl ?? true
    };
  }
  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
  /**
   * Set handler for audio frames
   */
  onFrame(handler) {
    this.frameHandler = handler;
  }
  /**
   * Request microphone access and prepare for recording
   */
  async initialize() {
    if (this.state !== "idle") {
      throw new MoqClientError(
        `Cannot initialize: already in state ${this.state}`,
        "INVALID_STATE"
      );
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new AudioNotSupportedError(
        "getUserMedia is not supported in this browser"
      );
    }
    if (!isOpusSupported()) {
      throw new AudioNotSupportedError(
        "Opus encoding is not supported in this browser. Try Chrome, Firefox, or Edge."
      );
    }
    this.setState(
      "requesting_permission"
      /* REQUESTING_PERMISSION */
    );
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.config.channelCount,
          sampleRate: this.config.sampleRate,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl
        },
        video: false
      });
      this.setState(
        "ready"
        /* READY */
      );
      console.log("Microphone access granted");
    } catch (error) {
      this.setState(
        "error"
        /* ERROR */
      );
      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          throw new AudioPermissionError(
            "Microphone access denied. Please allow microphone access in your browser settings.",
            error
          );
        } else if (error.name === "NotFoundError") {
          throw new AudioPermissionError(
            "No microphone found. Please connect a microphone and try again.",
            error
          );
        } else if (error.name === "NotReadableError") {
          throw new AudioPermissionError(
            "Microphone is in use by another application.",
            error
          );
        }
      }
      throw new AudioPermissionError(
        `Failed to access microphone: ${error}`,
        error
      );
    }
  }
  /**
   * Start recording and encoding audio
   */
  start() {
    if (this.state !== "ready" && this.state !== "paused") {
      throw new MoqClientError(
        `Cannot start: must be in READY or PAUSED state, currently ${this.state}`,
        "INVALID_STATE"
      );
    }
    if (!this.mediaStream) {
      throw new MoqClientError("No media stream available", "INVALID_STATE");
    }
    const mimeType = getBestOpusMimeType();
    if (!mimeType) {
      throw new AudioNotSupportedError("No supported Opus MIME type found");
    }
    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType,
      audioBitsPerSecond: this.config.bitrate
    });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.handleEncodedData(event.data);
      }
    };
    this.mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event);
      this.setState(
        "error"
        /* ERROR */
      );
    };
    this.mediaRecorder.onstop = () => {
      console.log("MediaRecorder stopped");
    };
    this.startTime = performance.now();
    this.frameSequence = 0;
    this.mediaRecorder.start(this.config.frameDurationMs);
    this.setState(
      "recording"
      /* RECORDING */
    );
    console.log(`Recording started with ${mimeType}, ${this.config.bitrate} bps`);
  }
  /**
   * Pause recording
   */
  pause() {
    if (this.state !== "recording") {
      return;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.pause();
      this.setState(
        "paused"
        /* PAUSED */
      );
    }
  }
  /**
   * Resume recording
   */
  resume() {
    if (this.state !== "paused") {
      return;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
      this.mediaRecorder.resume();
      this.setState(
        "recording"
        /* RECORDING */
      );
    }
  }
  /**
   * Stop recording
   */
  stop() {
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder = null;
    }
    this.setState(
      "ready"
      /* READY */
    );
  }
  /**
   * Release all resources
   */
  dispose() {
    this.stop();
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    this.frameHandler = null;
    this.setState(
      "idle"
      /* IDLE */
    );
  }
  /**
   * Handle encoded audio data from MediaRecorder
   */
  async handleEncodedData(blob) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const timestamp = performance.now() - this.startTime;
      const frame = {
        data,
        timestamp: Math.floor(timestamp),
        duration: this.config.frameDurationMs
      };
      this.frameSequence++;
      if (this.frameHandler) {
        this.frameHandler(frame);
      }
    } catch (error) {
      console.error("Error processing encoded audio:", error);
    }
  }
  /**
   * Update state
   */
  setState(state) {
    this.state = state;
  }
}
function getAudioCapabilities() {
  return {
    getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    mediaRecorder: typeof MediaRecorder !== "undefined",
    opusSupport: isOpusSupported(),
    bestMimeType: getBestOpusMimeType()
  };
}
class TrackPublisher {
  constructor(config) {
    __publicField(this, "trackAlias");
    __publicField(this, "publisherPriority");
    __publicField(this, "connection", null);
    // Group/Object tracking
    __publicField(this, "currentGroupId", 0n);
    __publicField(this, "currentObjectId", 0n);
    __publicField(this, "lastGroupTimestamp", 0);
    __publicField(this, "groupDurationMs", 1e3);
    // Start new group every second
    // Statistics
    __publicField(this, "stats", {
      objectsPublished: 0,
      bytesPublished: 0,
      errors: 0,
      currentGroupId: 0n,
      currentObjectId: 0n
    });
    this.trackAlias = config.trackAlias;
    this.publisherPriority = config.publisherPriority ?? 0;
  }
  /**
   * Attach to a connection for publishing
   */
  attach(connection) {
    this.connection = connection;
  }
  /**
   * Detach from the connection
   */
  detach() {
    this.connection = null;
  }
  /**
   * Get publishing statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentGroupId: this.currentGroupId,
      currentObjectId: this.currentObjectId
    };
  }
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      objectsPublished: 0,
      bytesPublished: 0,
      errors: 0,
      currentGroupId: this.currentGroupId,
      currentObjectId: this.currentObjectId
    };
  }
  /**
   * Publish a data payload as an MOQ object
   *
   * @param payload - The data to publish
   * @param timestampMs - Optional timestamp in milliseconds (uses current time if not provided)
   */
  async publish(payload, timestampMs) {
    if (!this.connection) {
      throw new MoqClientError("Not attached to a connection", "NOT_CONNECTED");
    }
    const timestamp = timestampMs ?? Date.now();
    if (timestamp - this.lastGroupTimestamp >= this.groupDurationMs) {
      this.currentGroupId++;
      this.currentObjectId = 0n;
      this.lastGroupTimestamp = timestamp;
    }
    const datagram = buildObjectDatagram(
      this.trackAlias,
      this.currentGroupId,
      this.currentObjectId,
      this.publisherPriority,
      payload
    );
    try {
      await this.connection.sendDatagram(datagram);
      this.currentObjectId++;
      this.stats.objectsPublished++;
      this.stats.bytesPublished += payload.length;
    } catch (error) {
      this.stats.errors++;
      console.error("Failed to publish object:", error);
      throw new MoqClientError(
        `Failed to publish object: ${error}`,
        "PUBLISH_FAILED",
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
  async publishWithIds(groupId, objectId, payload) {
    if (!this.connection) {
      throw new MoqClientError("Not attached to a connection", "NOT_CONNECTED");
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
        "PUBLISH_FAILED",
        error
      );
    }
  }
  /**
   * Set the group duration for automatic group ID management
   */
  setGroupDuration(durationMs) {
    this.groupDurationMs = durationMs;
  }
  /**
   * Force start a new group
   */
  startNewGroup() {
    this.currentGroupId++;
    this.currentObjectId = 0n;
    this.lastGroupTimestamp = Date.now();
  }
}
class AudioTrackPublisher extends TrackPublisher {
  constructor(config) {
    super(config);
    __publicField(this, "frameSequence", 0n);
    __publicField(this, "sessionStartTime", 0);
    this.setGroupDuration(20);
  }
  /**
   * Start a new audio session
   */
  startSession() {
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
  async publishAudioFrame(opusData, timestampMs) {
    const timestamp = timestampMs ?? Date.now() - this.sessionStartTime;
    const groupId = BigInt(Math.floor(timestamp));
    const objectId = this.frameSequence++;
    await this.publishWithIds(groupId, objectId, opusData);
  }
}
class StateTrackPublisher extends TrackPublisher {
  constructor(config) {
    super(config);
    __publicField(this, "updateSequence", 0n);
    this.setGroupDuration(1e3);
  }
  /**
   * Publish a state update (NodeInfo3 binary data)
   *
   * @param stateData - 48-byte NodeInfo3 binary data
   */
  async publishState(stateData) {
    if (stateData.length !== 48) {
      throw new MoqClientError(
        `Invalid state data size: expected 48 bytes, got ${stateData.length}`,
        "INVALID_DATA"
      );
    }
    const timestamp = Date.now();
    const groupId = BigInt(Math.floor(timestamp / 1e3));
    const objectId = this.updateSequence++;
    await this.publishWithIds(groupId, objectId, stateData);
  }
}
const NODE_INFO3_SIZE = 48;
function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) {
    throw new Error(`Invalid UUID: expected 32 hex chars, got ${hex.length}`);
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    const hexByte = hex.substring(i * 2, i * 2 + 2);
    const value = parseInt(hexByte, 16);
    if (isNaN(value)) {
      throw new Error(`Invalid UUID: invalid hex at position ${i * 2}`);
    }
    bytes[i] = value;
  }
  return bytes;
}
function bytesToUuid(bytes) {
  if (bytes.length !== 16) {
    throw new Error(`Invalid UUID bytes: expected 16 bytes, got ${bytes.length}`);
  }
  const hex = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i].toString(16).padStart(2, "0"));
  }
  return hex.slice(0, 4).join("") + "-" + hex.slice(4, 6).join("") + "-" + hex.slice(6, 8).join("") + "-" + hex.slice(8, 10).join("") + "-" + hex.slice(10, 16).join("");
}
function nodeInfo3ToBytes(info) {
  const buffer = new ArrayBuffer(NODE_INFO3_SIZE);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const uuidBytes = uuidToBytes(info.uuid);
  bytes.set(uuidBytes, 0);
  view.setFloat32(16, info.position.x, true);
  view.setFloat32(20, info.position.y, true);
  view.setFloat32(24, info.position.z, true);
  view.setFloat32(28, info.rotation.yaw, true);
  view.setFloat32(32, info.rotation.pitch, true);
  view.setFloat32(36, info.rotation.roll, true);
  view.setFloat32(40, info.volume, true);
  view.setInt32(44, info.gone ? 1 : 0, true);
  return bytes;
}
function nodeInfo3FromBytes(bytes) {
  if (bytes.length !== NODE_INFO3_SIZE) {
    throw new Error(`Invalid NodeInfo3 bytes: expected ${NODE_INFO3_SIZE} bytes, got ${bytes.length}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const uuidBytes = bytes.slice(0, 16);
  const uuid = bytesToUuid(uuidBytes);
  const position = {
    x: view.getFloat32(16, true),
    y: view.getFloat32(20, true),
    z: view.getFloat32(24, true)
  };
  const rotation = {
    yaw: view.getFloat32(28, true),
    pitch: view.getFloat32(32, true),
    roll: view.getFloat32(36, true)
  };
  const volume = view.getFloat32(40, true);
  const gone = view.getInt32(44, true) !== 0;
  return {
    uuid,
    position,
    rotation,
    volume,
    gone
  };
}
function createNodeInfo3(nodeId, position, rotation, volume) {
  return {
    uuid: nodeId,
    position: {
      x: (position == null ? void 0 : position.x) ?? 0.5,
      y: (position == null ? void 0 : position.y) ?? 0.5,
      z: (position == null ? void 0 : position.z) ?? 0.5
    },
    rotation: {
      yaw: (rotation == null ? void 0 : rotation.yaw) ?? 0,
      pitch: (rotation == null ? void 0 : rotation.pitch) ?? 0,
      roll: (rotation == null ? void 0 : rotation.roll) ?? 0
    },
    volume: volume ?? 1,
    gone: false
  };
}
function isValidUuid(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
var AudioSubscriberState = /* @__PURE__ */ ((AudioSubscriberState2) => {
  AudioSubscriberState2["IDLE"] = "idle";
  AudioSubscriberState2["SUBSCRIBING"] = "subscribing";
  AudioSubscriberState2["ACTIVE"] = "active";
  AudioSubscriberState2["ERROR"] = "error";
  return AudioSubscriberState2;
})(AudioSubscriberState || {});
class AudioSubscriber {
  constructor() {
    __publicField(this, "connection", null);
    __publicField(this, "state", "idle");
    __publicField(this, "frameHandler", null);
    __publicField(this, "trackAlias", 0);
    __publicField(this, "isListening", false);
    // Statistics
    __publicField(this, "stats", {
      framesReceived: 0,
      bytesReceived: 0,
      framesDropped: 0,
      currentGroupId: 0n,
      lastFrameTime: 0
    });
  }
  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
  /**
   * Get statistics
   */
  getStats() {
    return { ...this.stats };
  }
  /**
   * Set handler for received audio frames
   */
  onFrame(handler) {
    this.frameHandler = handler;
  }
  /**
   * Attach to a connection and start listening for datagrams
   *
   * @param connection - MOQ connection
   * @param trackAlias - Track alias to filter frames
   */
  attach(connection, trackAlias) {
    this.connection = connection;
    this.trackAlias = trackAlias;
    this.state = "subscribing";
  }
  /**
   * Start receiving audio frames
   */
  async start() {
    if (!this.connection) {
      throw new MoqClientError("Not attached to a connection", "NOT_CONNECTED");
    }
    if (this.isListening) {
      return;
    }
    this.isListening = true;
    this.state = "active";
    this.readDatagrams().catch((error) => {
      console.error("Datagram reader error:", error);
      this.state = "error";
    });
  }
  /**
   * Stop receiving audio frames
   */
  stop() {
    this.isListening = false;
    this.state = "idle";
  }
  /**
   * Detach from connection
   */
  detach() {
    this.stop();
    this.connection = null;
    this.state = "idle";
  }
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      framesReceived: 0,
      bytesReceived: 0,
      framesDropped: 0,
      currentGroupId: 0n,
      lastFrameTime: 0
    };
  }
  /**
   * Read datagrams from the connection
   */
  async readDatagrams() {
    if (!this.connection) {
      return;
    }
    const reader = this.connection.getDatagramReader();
    if (!reader) {
      console.error("No datagram reader available");
      this.state = "error";
      return;
    }
    try {
      while (this.isListening) {
        const { value, done } = await reader.read();
        if (done) {
          console.log("Datagram stream closed");
          break;
        }
        if (value) {
          this.handleDatagram(value);
        }
      }
    } catch (error) {
      if (this.isListening) {
        console.error("Error reading datagrams:", error);
        this.state = "error";
      }
    }
  }
  /**
   * Handle a received datagram
   */
  handleDatagram(data) {
    try {
      const parsed = parseObjectDatagram(data);
      if (parsed.trackAlias !== this.trackAlias) {
        return;
      }
      const frame = {
        trackAlias: parsed.trackAlias,
        groupId: parsed.groupId,
        objectId: parsed.objectId,
        publisherPriority: parsed.publisherPriority,
        data: parsed.payload,
        receiveTime: performance.now()
      };
      this.stats.framesReceived++;
      this.stats.bytesReceived += parsed.payload.length;
      this.stats.currentGroupId = parsed.groupId;
      this.stats.lastFrameTime = frame.receiveTime;
      if (this.frameHandler) {
        this.frameHandler(frame);
      }
    } catch (error) {
      this.stats.framesDropped++;
      console.error("Error parsing datagram:", error);
    }
  }
}
function isAudioDecoderSupported() {
  return typeof AudioDecoder !== "undefined";
}
async function getAudioDecoderCapabilities() {
  if (!isAudioDecoderSupported()) {
    return { supported: false, opusSupported: false };
  }
  try {
    const support = await AudioDecoder.isConfigSupported({
      codec: "opus",
      sampleRate: 48e3,
      numberOfChannels: 2
    });
    return {
      supported: true,
      opusSupported: support.supported ?? false
    };
  } catch {
    return { supported: true, opusSupported: false };
  }
}
var AudioPlayerState = /* @__PURE__ */ ((AudioPlayerState2) => {
  AudioPlayerState2["IDLE"] = "idle";
  AudioPlayerState2["INITIALIZING"] = "initializing";
  AudioPlayerState2["READY"] = "ready";
  AudioPlayerState2["PLAYING"] = "playing";
  AudioPlayerState2["ERROR"] = "error";
  return AudioPlayerState2;
})(AudioPlayerState || {});
class AudioPlayer {
  constructor(config = {}) {
    __publicField(this, "config");
    __publicField(this, "state", "idle");
    // Web Audio API
    __publicField(this, "audioContext", null);
    // WebCodecs decoder
    __publicField(this, "decoder", null);
    // Playback scheduling
    __publicField(this, "nextPlayTime", 0);
    __publicField(this, "scheduledBuffers", []);
    // Statistics
    __publicField(this, "stats", {
      framesDecoded: 0,
      samplesPlayed: 0,
      underruns: 0,
      bufferLevel: 0,
      decodeErrors: 0
    });
    this.config = {
      sampleRate: config.sampleRate ?? 48e3,
      channelCount: config.channelCount ?? 2,
      bufferSize: config.bufferSize ?? 0.1,
      latencyHint: config.latencyHint ?? "interactive"
    };
  }
  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
  /**
   * Get statistics
   */
  getStats() {
    return { ...this.stats };
  }
  /**
   * Initialize the audio player
   *
   * This creates the AudioContext and AudioDecoder.
   * Must be called in response to a user gesture on some browsers.
   */
  async initialize() {
    if (this.state !== "idle") {
      throw new MoqClientError(
        `Cannot initialize: already in state ${this.state}`,
        "INVALID_STATE"
      );
    }
    this.state = "initializing";
    try {
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
        latencyHint: this.config.latencyHint
      });
      if (typeof AudioDecoder === "undefined") {
        throw new AudioDecoderNotSupportedError(
          "WebCodecs AudioDecoder is not supported in this browser"
        );
      }
      const support = await AudioDecoder.isConfigSupported({
        codec: "opus",
        sampleRate: this.config.sampleRate,
        numberOfChannels: this.config.channelCount
      });
      if (!support.supported) {
        throw new AudioDecoderNotSupportedError(
          "Opus decoding is not supported in this browser"
        );
      }
      this.decoder = new AudioDecoder({
        output: (audioData) => this.handleDecodedAudio(audioData),
        error: (error) => this.handleDecodeError(error)
      });
      this.decoder.configure({
        codec: "opus",
        sampleRate: this.config.sampleRate,
        numberOfChannels: this.config.channelCount
      });
      this.state = "ready";
      console.log("AudioPlayer initialized");
    } catch (error) {
      this.state = "error";
      throw error;
    }
  }
  /**
   * Start playback
   */
  start() {
    var _a;
    if (this.state !== "ready" && this.state !== "playing") {
      throw new MoqClientError(
        `Cannot start: must be in READY state, currently ${this.state}`,
        "INVALID_STATE"
      );
    }
    if (((_a = this.audioContext) == null ? void 0 : _a.state) === "suspended") {
      this.audioContext.resume();
    }
    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime + this.config.bufferSize;
    }
    this.state = "playing";
    console.log("AudioPlayer started");
  }
  /**
   * Stop playback
   */
  stop() {
    for (const source of this.scheduledBuffers) {
      try {
        source.stop();
      } catch {
      }
    }
    this.scheduledBuffers = [];
    this.state = "ready";
    console.log("AudioPlayer stopped");
  }
  /**
   * Pause playback
   */
  pause() {
    var _a;
    if (((_a = this.audioContext) == null ? void 0 : _a.state) === "running") {
      this.audioContext.suspend();
    }
  }
  /**
   * Resume playback
   */
  resume() {
    var _a;
    if (((_a = this.audioContext) == null ? void 0 : _a.state) === "suspended") {
      this.audioContext.resume();
    }
  }
  /**
   * Decode an Opus frame
   *
   * @param opusData - Opus-encoded audio data
   * @param timestamp - Frame timestamp in microseconds (optional)
   */
  decodeFrame(opusData, timestamp) {
    if (!this.decoder) {
      throw new MoqClientError("Decoder not initialized", "NOT_INITIALIZED");
    }
    if (this.decoder.state === "closed") {
      throw new MoqClientError("Decoder is closed", "DECODER_CLOSED");
    }
    const chunk = new EncodedAudioChunk({
      type: "key",
      // Opus frames are always key frames
      timestamp: timestamp ?? performance.now() * 1e3,
      data: opusData
    });
    this.decoder.decode(chunk);
  }
  /**
   * Release all resources
   */
  async dispose() {
    this.stop();
    if (this.decoder) {
      if (this.decoder.state !== "closed") {
        this.decoder.close();
      }
      this.decoder = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.state = "idle";
    console.log("AudioPlayer disposed");
  }
  /**
   * Handle decoded audio data
   */
  handleDecodedAudio(audioData) {
    if (!this.audioContext || this.state !== "playing") {
      audioData.close();
      return;
    }
    try {
      const buffer = this.audioContext.createBuffer(
        audioData.numberOfChannels,
        audioData.numberOfFrames,
        audioData.sampleRate
      );
      for (let channel = 0; channel < audioData.numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        audioData.copyTo(channelData, {
          planeIndex: channel,
          format: "f32-planar"
        });
      }
      this.scheduleBuffer(buffer);
      this.stats.framesDecoded++;
      this.stats.samplesPlayed += audioData.numberOfFrames;
      if (this.audioContext) {
        this.stats.bufferLevel = Math.max(
          0,
          this.nextPlayTime - this.audioContext.currentTime
        );
      }
    } finally {
      audioData.close();
    }
  }
  /**
   * Schedule an audio buffer for playback
   */
  scheduleBuffer(buffer) {
    if (!this.audioContext) {
      return;
    }
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    const currentTime = this.audioContext.currentTime;
    if (this.nextPlayTime < currentTime) {
      this.stats.underruns++;
      this.nextPlayTime = currentTime + this.config.bufferSize;
    }
    source.start(this.nextPlayTime);
    this.scheduledBuffers.push(source);
    source.onended = () => {
      const index = this.scheduledBuffers.indexOf(source);
      if (index > -1) {
        this.scheduledBuffers.splice(index, 1);
      }
    };
    this.nextPlayTime += buffer.duration;
  }
  /**
   * Handle decode error
   */
  handleDecodeError(error) {
    console.error("Audio decode error:", error);
    this.stats.decodeErrors++;
  }
}
class AudioDecoderNotSupportedError extends MoqClientError {
  constructor(message) {
    super(message, "AUDIO_DECODER_NOT_SUPPORTED");
    this.name = "AudioDecoderNotSupportedError";
  }
}
function isAudioPlaybackSupported() {
  return typeof AudioContext !== "undefined" && typeof AudioDecoder !== "undefined";
}
async function getAudioPlaybackCapabilities() {
  const hasAudioContext = typeof AudioContext !== "undefined";
  const hasWebCodecs = typeof AudioDecoder !== "undefined";
  let opusDecoding = false;
  if (hasWebCodecs) {
    try {
      const support = await AudioDecoder.isConfigSupported({
        codec: "opus",
        sampleRate: 48e3,
        numberOfChannels: 2
      });
      opusDecoding = support.supported ?? false;
    } catch {
      opusDecoding = false;
    }
  }
  return {
    audioContext: hasAudioContext,
    webCodecs: hasWebCodecs,
    opusDecoding
  };
}
class EventEmitter {
  constructor() {
    __publicField(this, "handlers", /* @__PURE__ */ new Map());
  }
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, /* @__PURE__ */ new Set());
    }
    this.handlers.get(event).add(handler);
  }
  off(event, handler) {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
    }
  }
  emit(event, data) {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
  }
}
class MoqSession {
  constructor(connection) {
    __publicField(this, "controlStream", null);
    __publicField(this, "writer", null);
    __publicField(this, "reader", null);
    __publicField(this, "readBuffer", new Uint8Array(0));
    __publicField(this, "nextSubscribeId", 1);
    __publicField(this, "nextTrackAlias", 1);
    // Track state
    __publicField(this, "subscriptions", /* @__PURE__ */ new Map());
    __publicField(this, "announcements", /* @__PURE__ */ new Map());
    this.connection = connection;
  }
  /**
   * Initialize the MOQ session over the control stream
   */
  async initialize(role, path) {
    this.controlStream = await this.connection.createControlStream();
    this.writer = this.controlStream.writable.getWriter();
    this.reader = this.controlStream.readable.getReader();
    const setupMsg = buildClientSetup([MOQ_TRANSPORT_VERSION], role, path);
    await this.writer.write(setupMsg);
    const response = await this.readMessage();
    const { type, bytesRead } = parseMessageType(response);
    if (type !== MoqMessageType.SERVER_SETUP) {
      throw new ProtocolError(
        `Expected SERVER_SETUP (0x41), got message type 0x${type.toString(16)}`,
        type
      );
    }
    const serverSetup = parseServerSetup(response, bytesRead);
    console.log("MOQ session established, server version:", serverSetup.selectedVersion.toString(16));
  }
  /**
   * Subscribe to a track with JWT authorization
   */
  async subscribe(namespace, trackName, authorization) {
    const subscribeId = this.nextSubscribeId++;
    const trackAlias = this.nextTrackAlias++;
    const subscribeMsg = buildSubscribe({
      subscribeId,
      trackAlias,
      namespace,
      trackName,
      filterType: MoqFilterType.LATEST_GROUP,
      authorization
    });
    await this.writer.write(subscribeMsg);
    const response = await this.readMessage();
    const { type, bytesRead } = parseMessageType(response);
    if (type === MoqMessageType.SUBSCRIBE_OK) {
      const ok = parseSubscribeOk(response, bytesRead);
      console.log("Subscribed successfully, subscribeId:", ok.subscribeId);
      this.subscriptions.set(subscribeId, { namespace, trackName, alias: trackAlias });
      return subscribeId;
    } else if (type === MoqMessageType.SUBSCRIBE_ERROR) {
      const error = parseSubscribeError(response, bytesRead);
      const errorMessage = `${error.reasonPhrase} (${getMoqErrorMessage(error.errorCode)})`;
      if (error.errorCode === 2 || error.errorCode === 1027) {
        throw new AuthenticationError(errorMessage, error.errorCode, { namespace, trackName });
      }
      throw new SubscriptionError(errorMessage, error.errorCode, namespace);
    } else {
      throw new ProtocolError(
        `Expected SUBSCRIBE_OK or SUBSCRIBE_ERROR, got message type 0x${type.toString(16)}`,
        type
      );
    }
  }
  /**
   * Announce a track namespace
   */
  async announce(namespace) {
    const announceMsg = buildAnnounce({ namespace });
    await this.writer.write(announceMsg);
    const response = await this.readMessage();
    const { type, bytesRead } = parseMessageType(response);
    if (type === MoqMessageType.ANNOUNCE_OK) {
      const ok = parseAnnounceOk(response, bytesRead);
      const nsKey = ok.namespace.join("/");
      this.announcements.set(nsKey, { namespace: ok.namespace });
      console.log("Announced successfully:", nsKey);
    } else if (type === MoqMessageType.ANNOUNCE_ERROR) {
      const error = parseAnnounceError(response, bytesRead);
      const errorMessage = `${error.reasonPhrase} (${getMoqErrorMessage(error.errorCode)})`;
      throw new AnnouncementError(errorMessage, error.errorCode, namespace);
    } else {
      throw new ProtocolError(
        `Expected ANNOUNCE_OK or ANNOUNCE_ERROR, got message type 0x${type.toString(16)}`,
        type
      );
    }
  }
  /**
   * Get track alias for a subscription
   */
  getTrackAlias(subscribeId) {
    var _a;
    return (_a = this.subscriptions.get(subscribeId)) == null ? void 0 : _a.alias;
  }
  /**
   * Close the session
   */
  async close() {
    if (this.writer) {
      try {
        await this.writer.close();
      } catch {
      }
      this.writer = null;
    }
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
      }
      this.reader = null;
    }
    this.controlStream = null;
  }
  /**
   * Read a complete message from the control stream
   */
  async readMessage() {
    while (true) {
      const { value, done } = await this.reader.read();
      if (done) {
        throw new Error("Control stream closed unexpectedly");
      }
      const newBuffer = new Uint8Array(this.readBuffer.length + value.length);
      newBuffer.set(this.readBuffer);
      newBuffer.set(value, this.readBuffer.length);
      this.readBuffer = newBuffer;
      if (this.readBuffer.length > 0) {
        const message = this.readBuffer;
        this.readBuffer = new Uint8Array(0);
        return message;
      }
    }
  }
}
class PanaudiaMoqClient {
  constructor(config) {
    __publicField(this, "config");
    __publicField(this, "events", new EventEmitter());
    __publicField(this, "connection", null);
    __publicField(this, "session", null);
    __publicField(this, "state", ConnectionState.DISCONNECTED);
    // Audio publishing
    __publicField(this, "audioPublisher", null);
    __publicField(this, "audioTrackPublisher", null);
    // State publishing
    __publicField(this, "stateTrackPublisher", null);
    __publicField(this, "statePublishPending", false);
    __publicField(this, "statePublishThrottleMs", 50);
    // Throttle state updates to 20Hz max
    __publicField(this, "lastStatePublishTime", 0);
    // Audio playback
    __publicField(this, "audioSubscriber", null);
    __publicField(this, "audioPlayer", null);
    // Track aliases (assigned after announcement/subscription)
    __publicField(this, "audioInputTrackAlias", 1);
    __publicField(this, "stateTrackAlias", 2);
    __publicField(this, "audioOutputTrackAlias", 0);
    // Assigned by server
    // Node state
    __publicField(this, "position");
    __publicField(this, "rotation");
    __publicField(this, "volume");
    if (!config.serverUrl) {
      throw new Error("serverUrl is required");
    }
    if (!config.ticket) {
      throw new Error("ticket is required");
    }
    const nodeId = config.nodeId ?? this.extractNodeIdFromJwt(config.ticket);
    this.config = {
      serverUrl: config.serverUrl,
      ticket: config.ticket,
      nodeId,
      initialPosition: config.initialPosition ?? { x: 0.5, y: 0.5, z: 0.5 },
      initialRotation: config.initialRotation ?? { yaw: 0, pitch: 0, roll: 0 },
      initialVolume: config.initialVolume ?? 1
    };
    this.position = { ...this.config.initialPosition };
    this.rotation = { ...this.config.initialRotation };
    this.volume = this.config.initialVolume;
  }
  /**
   * Get current connection state
   */
  getState() {
    return this.state;
  }
  /**
   * Get the node ID
   */
  getNodeId() {
    return this.config.nodeId;
  }
  /**
   * Register an event handler
   */
  on(event, handler) {
    this.events.on(event, handler);
  }
  /**
   * Remove an event handler
   */
  off(event, handler) {
    this.events.off(event, handler);
  }
  /**
   * Connect to the MOQ server
   */
  async connect(options) {
    if (!isWebTransportSupported()) {
      throw new WebTransportNotSupportedError();
    }
    if (this.state !== ConnectionState.DISCONNECTED) {
      throw new InvalidStateError("disconnected", this.state);
    }
    this.setState(ConnectionState.CONNECTING);
    try {
      this.connection = new MoqConnection(this.config.serverUrl);
      this.connection.setHandlers({
        onStateChange: (connState, error) => {
          if (connState === ConnectionState.ERROR) {
            this.handleError("connection_error", (error == null ? void 0 : error.message) ?? "Connection failed");
          } else if (connState === ConnectionState.DISCONNECTED) {
            this.handleDisconnect();
          }
        }
      });
      await this.connection.connect(options);
      this.setState(ConnectionState.CONNECTED);
      this.session = new MoqSession(this.connection);
      await this.session.initialize(MoqRole.PUBSUB);
      const outputNamespace = generateTrackNamespace(PanaudiaTrackType.AUDIO_OUTPUT, this.config.nodeId);
      const subscribeId = await this.session.subscribe(outputNamespace, "", this.config.ticket);
      this.audioOutputTrackAlias = this.session.getTrackAlias(subscribeId) ?? 0;
      this.setState(ConnectionState.AUTHENTICATED);
      this.events.emit("authenticated");
      const audioInputNamespace = generateTrackNamespace(PanaudiaTrackType.AUDIO_INPUT, this.config.nodeId);
      const stateNamespace = generateTrackNamespace(PanaudiaTrackType.STATE, this.config.nodeId);
      await this.session.announce(audioInputNamespace);
      await this.session.announce(stateNamespace);
      this.stateTrackPublisher = new StateTrackPublisher({
        trackAlias: this.stateTrackAlias,
        publisherPriority: 1
        // Slightly lower priority than audio
      });
      this.stateTrackPublisher.attach(this.connection);
      await this.publishState();
      this.events.emit("connected");
    } catch (error) {
      this.setState(ConnectionState.ERROR);
      let code = "connect_failed";
      let message = "Unknown error";
      let details = void 0;
      if (error instanceof AuthenticationError) {
        code = error.code;
        message = error.message;
        details = { moqErrorCode: error.moqErrorCode };
      } else if (error instanceof ProtocolError) {
        code = error.code;
        message = error.message;
        details = { moqErrorCode: error.moqErrorCode };
      } else if (error instanceof Error) {
        message = error.message;
        if (message.includes("net::ERR_")) {
          code = "network_error";
        } else if (message.includes("certificate")) {
          code = "certificate_error";
          message = `Certificate error: ${message}. For local testing, use a trusted certificate or add an exception.`;
        }
      }
      this.events.emit("error", { code, message, details });
      throw error;
    }
  }
  /**
   * Disconnect from the server
   */
  async disconnect() {
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.setState(ConnectionState.DISCONNECTED);
    this.events.emit("disconnected");
  }
  /**
   * Update position (in Panaudia internal coordinates, 0-1 range)
   */
  setPosition(position) {
    this.position = { ...position };
    this.scheduleStatePublish();
  }
  /**
   * Update rotation (in degrees)
   */
  setRotation(rotation) {
    this.rotation = { ...rotation };
    this.scheduleStatePublish();
  }
  /**
   * Update volume (0-1 range)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.scheduleStatePublish();
  }
  /**
   * Get current position
   */
  getPosition() {
    return { ...this.position };
  }
  /**
   * Get current rotation
   */
  getRotation() {
    return { ...this.rotation };
  }
  /**
   * Get current volume
   */
  getVolume() {
    return this.volume;
  }
  /**
   * Start capturing and publishing microphone audio
   *
   * @param config - Optional audio configuration
   */
  async startMicrophone(config) {
    if (this.state !== ConnectionState.AUTHENTICATED) {
      throw new InvalidStateError("authenticated", this.state);
    }
    if (!this.connection) {
      throw new MoqClientError("No connection available", "NOT_CONNECTED");
    }
    if (!this.audioPublisher) {
      this.audioPublisher = new AudioPublisher(config);
    }
    if (!this.audioTrackPublisher) {
      this.audioTrackPublisher = new AudioTrackPublisher({
        trackAlias: this.audioInputTrackAlias,
        publisherPriority: 0
        // High priority for audio
      });
      this.audioTrackPublisher.attach(this.connection);
    }
    await this.audioPublisher.initialize();
    this.audioPublisher.onFrame((frame) => {
      if (this.audioTrackPublisher && this.state === ConnectionState.AUTHENTICATED) {
        this.audioTrackPublisher.publishAudioFrame(frame.data, frame.timestamp).catch((error) => {
          console.error("Failed to publish audio frame:", error);
        });
      }
    });
    this.audioTrackPublisher.startSession();
    this.audioPublisher.start();
    console.log("Microphone started");
  }
  /**
   * Stop capturing microphone audio
   */
  stopMicrophone() {
    if (this.audioPublisher) {
      this.audioPublisher.stop();
      console.log("Microphone stopped");
    }
  }
  /**
   * Check if microphone is currently recording
   */
  isMicrophoneActive() {
    var _a;
    return ((_a = this.audioPublisher) == null ? void 0 : _a.getState()) === AudioPublisherState.RECORDING;
  }
  /**
   * Pause microphone recording
   */
  pauseMicrophone() {
    var _a;
    (_a = this.audioPublisher) == null ? void 0 : _a.pause();
  }
  /**
   * Resume microphone recording
   */
  resumeMicrophone() {
    var _a;
    (_a = this.audioPublisher) == null ? void 0 : _a.resume();
  }
  /**
   * Publish the current state immediately
   *
   * This sends the current position, rotation, and volume to the server.
   */
  async publishState() {
    if (!this.stateTrackPublisher || this.state !== ConnectionState.AUTHENTICATED) {
      return;
    }
    try {
      const nodeInfo = createNodeInfo3(
        this.config.nodeId,
        this.position,
        this.rotation,
        this.volume
      );
      const stateBytes = nodeInfo3ToBytes(nodeInfo);
      await this.stateTrackPublisher.publishState(stateBytes);
      this.lastStatePublishTime = Date.now();
    } catch (error) {
      console.error("Failed to publish state:", error);
    }
  }
  /**
   * Configure state update throttling
   *
   * @param throttleMs - Minimum milliseconds between state updates (default: 50ms = 20Hz)
   */
  setStateThrottle(throttleMs) {
    this.statePublishThrottleMs = Math.max(0, throttleMs);
  }
  /**
   * Start receiving and playing audio from the server
   *
   * @param config - Optional audio player configuration
   */
  async startPlayback(config) {
    if (this.state !== ConnectionState.AUTHENTICATED) {
      throw new InvalidStateError("authenticated", this.state);
    }
    if (!this.connection) {
      throw new MoqClientError("No connection available", "NOT_CONNECTED");
    }
    if (!this.audioPlayer) {
      this.audioPlayer = new AudioPlayer(config);
    }
    if (this.audioPlayer.getState() === AudioPlayerState.IDLE) {
      await this.audioPlayer.initialize();
    }
    if (!this.audioSubscriber) {
      this.audioSubscriber = new AudioSubscriber();
    }
    this.audioSubscriber.attach(this.connection, this.audioOutputTrackAlias);
    this.audioSubscriber.onFrame((frame) => {
      if (this.audioPlayer && this.audioPlayer.getState() === AudioPlayerState.PLAYING) {
        try {
          const timestamp = Number(frame.groupId) * 1e3;
          this.audioPlayer.decodeFrame(frame.data, timestamp);
        } catch (error) {
          console.error("Failed to decode audio frame:", error);
        }
      }
    });
    this.audioPlayer.start();
    await this.audioSubscriber.start();
    console.log("Playback started");
  }
  /**
   * Stop receiving and playing audio
   */
  stopPlayback() {
    if (this.audioSubscriber) {
      this.audioSubscriber.stop();
    }
    if (this.audioPlayer) {
      this.audioPlayer.stop();
    }
    console.log("Playback stopped");
  }
  /**
   * Check if audio playback is currently active
   */
  isPlaybackActive() {
    var _a;
    return ((_a = this.audioPlayer) == null ? void 0 : _a.getState()) === AudioPlayerState.PLAYING;
  }
  /**
   * Pause audio playback
   */
  pausePlayback() {
    var _a;
    (_a = this.audioPlayer) == null ? void 0 : _a.pause();
  }
  /**
   * Resume audio playback
   */
  resumePlayback() {
    var _a;
    (_a = this.audioPlayer) == null ? void 0 : _a.resume();
  }
  /**
   * Get audio playback statistics
   */
  getPlaybackStats() {
    if (!this.audioSubscriber || !this.audioPlayer) {
      return null;
    }
    return {
      subscriber: this.audioSubscriber.getStats(),
      player: this.audioPlayer.getStats()
    };
  }
  /**
   * Schedule a state publish with throttling
   *
   * If called multiple times rapidly, only one publish will occur
   * after the throttle delay.
   */
  scheduleStatePublish() {
    if (this.state !== ConnectionState.AUTHENTICATED) {
      return;
    }
    if (this.statePublishPending) {
      return;
    }
    const now = Date.now();
    const timeSinceLastPublish = now - this.lastStatePublishTime;
    if (timeSinceLastPublish >= this.statePublishThrottleMs) {
      this.publishState();
    } else {
      this.statePublishPending = true;
      const delay = this.statePublishThrottleMs - timeSinceLastPublish;
      setTimeout(() => {
        this.statePublishPending = false;
        if (this.state === ConnectionState.AUTHENTICATED) {
          this.publishState();
        }
      }, delay);
    }
  }
  /**
   * Extract node ID from JWT token
   */
  extractNodeIdFromJwt(token) {
    var _a;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new JwtParseError("Invalid JWT format: expected 3 parts separated by dots");
      }
      const payload = parts[1];
      let decoded;
      try {
        decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      } catch {
        throw new JwtParseError("Invalid JWT format: payload is not valid base64");
      }
      let claims;
      try {
        claims = JSON.parse(decoded);
      } catch {
        throw new JwtParseError("Invalid JWT format: payload is not valid JSON");
      }
      const nodeId = claims.jti || ((_a = claims.panaudia) == null ? void 0 : _a.uuid);
      if (!nodeId) {
        throw new JwtParseError("No node ID found in JWT: missing jti or panaudia.uuid claim");
      }
      if (typeof nodeId !== "string" || nodeId.length < 32) {
        throw new JwtParseError(`Invalid node ID in JWT: expected UUID string, got ${typeof nodeId}`);
      }
      return nodeId;
    } catch (error) {
      if (error instanceof JwtParseError) {
        throw error;
      }
      throw new JwtParseError(`Failed to extract node ID from JWT: ${error}`);
    }
  }
  /**
   * Update internal state and emit events
   */
  setState(newState) {
    const previousState = this.state;
    this.state = newState;
    this.events.emit("statechange", {
      previousState,
      currentState: newState
    });
  }
  /**
   * Handle connection error
   */
  handleError(code, message) {
    this.setState(ConnectionState.ERROR);
    this.events.emit("error", { code, message });
  }
  /**
   * Handle disconnection
   */
  handleDisconnect() {
    this.session = null;
    this.connection = null;
    this.setState(ConnectionState.DISCONNECTED);
    this.events.emit("disconnected");
  }
}
export {
  AnnouncementError,
  AudioDecoderNotSupportedError,
  AudioEncodingError,
  AudioNotSupportedError,
  AudioPermissionError,
  AudioPlayer,
  AudioPlayerState,
  AudioPublisher,
  AudioPublisherState,
  AudioSubscriber,
  AudioSubscriberState,
  AudioTrackPublisher,
  AuthenticationError,
  ConnectionError,
  ConnectionState,
  InvalidStateError,
  JwtParseError,
  MOQ_TRANSPORT_VERSION,
  MessageBuilder,
  MoqClientError,
  MoqConnection,
  MoqErrorCode,
  MoqFilterType,
  MoqForwardingPreference,
  MoqMessageType,
  MoqRole,
  NODE_INFO3_SIZE,
  PanaudiaMoqClient,
  PanaudiaTrackType,
  ProtocolError,
  StateTrackPublisher,
  SubscriptionError,
  TimeoutError,
  TrackPublisher,
  WebTransportNotSupportedError,
  buildAnnounce,
  buildClientSetup,
  buildObjectDatagram,
  buildSubscribe,
  buildUnannounce,
  buildUnsubscribe,
  bytesToUuid,
  createNodeInfo3,
  decodeBytes,
  decodeString,
  decodeVarint,
  encodeBytes,
  encodeString,
  encodeVarint,
  generateTrackNamespace,
  getAudioCapabilities,
  getAudioDecoderCapabilities,
  getAudioPlaybackCapabilities,
  getBestOpusMimeType,
  getMoqErrorMessage,
  getWebTransportSupport,
  isAudioDecoderSupported,
  isAudioPlaybackSupported,
  isOpusSupported,
  isValidUuid,
  isWebTransportSupported,
  nodeInfo3FromBytes,
  nodeInfo3ToBytes,
  parseAnnounceError,
  parseAnnounceOk,
  parseMessageType,
  parseObjectDatagram,
  parseServerSetup,
  parseSubscribeError,
  parseSubscribeOk,
  uuidToBytes,
  wrapError
};
//# sourceMappingURL=panaudia-moq-client.js.map
