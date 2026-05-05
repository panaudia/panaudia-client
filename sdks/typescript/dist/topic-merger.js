var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var ConnectionState = /* @__PURE__ */ ((ConnectionState2) => {
  ConnectionState2["DISCONNECTED"] = "disconnected";
  ConnectionState2["CONNECTING"] = "connecting";
  ConnectionState2["CONNECTED"] = "connected";
  ConnectionState2["AUTHENTICATED"] = "authenticated";
  ConnectionState2["ERROR"] = "error";
  return ConnectionState2;
})(ConnectionState || {});
const ENTITY_INFO3_SIZE = 48;
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
function entityInfo3ToBytes(info) {
  const buffer = new ArrayBuffer(ENTITY_INFO3_SIZE);
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
function entityInfo3FromBytes(bytes) {
  if (bytes.length !== ENTITY_INFO3_SIZE) {
    throw new Error(`Invalid EntityInfo3 bytes: expected ${ENTITY_INFO3_SIZE} bytes, got ${bytes.length}`);
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
function createEntityInfo3(entityId, position, rotation, volume) {
  return {
    uuid: entityId,
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
class CacheMap {
  constructor() {
    __publicField(this, "entries", /* @__PURE__ */ new Map());
    __publicField(this, "highestOpId", 0n);
    __publicField(this, "changeHandler", null);
  }
  /**
   * Register a handler called on every state change (add, update, remove).
   */
  onChange(handler) {
    this.changeHandler = handler;
  }
  /**
   * Merge an incoming cache operation.
   *
   * Returns 'accepted' if the value was stored, 'tombstoned' if a key
   * was removed, or 'rejected' if the incoming opId was not higher.
   */
  merge(op) {
    var _a, _b;
    if (op.opId > this.highestOpId) {
      this.highestOpId = op.opId;
    }
    const existing = this.entries.get(op.key);
    if (existing && op.opId <= existing.opId) {
      return "rejected";
    }
    if (op.tombstone) {
      if (existing) {
        this.entries.delete(op.key);
        (_a = this.changeHandler) == null ? void 0 : _a.call(this, op.key, null, "tombstoned");
      }
      return "tombstoned";
    }
    const entry = {
      value: op.value,
      opId: op.opId,
      nodeId: op.nodeId
    };
    this.entries.set(op.key, entry);
    (_b = this.changeHandler) == null ? void 0 : _b.call(this, op.key, entry, "accepted");
    return "accepted";
  }
  /**
   * Get a single entry by key.
   */
  get(key) {
    return this.entries.get(key);
  }
  /**
   * Get all entries as a read-only map.
   */
  getAll() {
    return this.entries;
  }
  /**
   * Get the highest opId seen across all merge calls.
   * Used as the resume point on reconnection.
   */
  getHighestOpId() {
    return this.highestOpId;
  }
  /**
   * Number of entries in the map.
   */
  get size() {
    return this.entries.size;
  }
  /**
   * Clear all entries and reset the highest opId.
   */
  clear() {
    this.entries.clear();
    this.highestOpId = 0n;
  }
}
const WIRE_VERSION = 202;
const FLAG_TOMBSTONE = 1;
const MIN_WIRE_LEN = 21;
function isCacheEnvelope(data) {
  return data.length > 0 && data[0] === WIRE_VERSION;
}
function decodeCacheOp(data) {
  if (data.length < MIN_WIRE_LEN) {
    return null;
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let off = 0;
  if (data[off] !== WIRE_VERSION) {
    return null;
  }
  off++;
  const flags = data[off];
  off++;
  const opId = view.getBigUint64(off, false);
  off += 8;
  const nodeId = view.getUint32(off, false);
  off += 4;
  const topicLen = data[off];
  off++;
  if (off + topicLen > data.length) {
    return null;
  }
  const topic = new TextDecoder().decode(data.subarray(off, off + topicLen));
  off += topicLen;
  if (off + 2 > data.length) {
    return null;
  }
  const keyLen = view.getUint16(off, false);
  off += 2;
  if (off + keyLen > data.length) {
    return null;
  }
  const key = new TextDecoder().decode(data.subarray(off, off + keyLen));
  off += keyLen;
  if (off + 4 > data.length) {
    return null;
  }
  const valueLen = view.getUint32(off, false);
  off += 4;
  if (off + valueLen > data.length) {
    return null;
  }
  const value = new Uint8Array(data.subarray(off, off + valueLen));
  off += valueLen;
  return {
    topic,
    key,
    value,
    opId,
    nodeId,
    tombstone: (flags & FLAG_TOMBSTONE) !== 0
  };
}
function encodeCacheOp(op) {
  const topicBytes = new TextEncoder().encode(op.topic);
  const keyBytes = new TextEncoder().encode(op.key);
  const size = 1 + 1 + 8 + 4 + 1 + topicBytes.length + 2 + keyBytes.length + 4 + op.value.length;
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  let off = 0;
  buf[off] = WIRE_VERSION;
  off++;
  buf[off] = op.tombstone ? FLAG_TOMBSTONE : 0;
  off++;
  view.setBigUint64(off, op.opId, false);
  off += 8;
  view.setUint32(off, op.nodeId, false);
  off += 4;
  buf[off] = topicBytes.length;
  off++;
  buf.set(topicBytes, off);
  off += topicBytes.length;
  view.setUint16(off, keyBytes.length, false);
  off += 2;
  buf.set(keyBytes, off);
  off += keyBytes.length;
  view.setUint32(off, op.value.length, false);
  off += 4;
  buf.set(op.value, off);
  return buf;
}
function parseJsonOps(payload) {
  try {
    const json = new TextDecoder().decode(payload);
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      const ops = [];
      for (const item of parsed) {
        if (typeof item !== "object" || item === null || !("key" in item)) {
          return null;
        }
        ops.push(item);
      }
      return ops.length > 0 ? ops : null;
    }
    if (typeof parsed === "object" && parsed !== null && "key" in parsed) {
      return [parsed];
    }
    return null;
  } catch {
    return null;
  }
}
class TopicMerger {
  constructor(cache) {
    __publicField(this, "cache");
    __publicField(this, "updatesReceived", 0);
    __publicField(this, "errorsDropped", 0);
    __publicField(this, "debugHandler", null);
    this.cache = cache ?? new CacheMap();
  }
  /** Install a per-envelope diagnostic callback. Pass null to clear. */
  setDebugHandler(handler) {
    this.debugHandler = handler;
  }
  /**
   * Decode a binary cache envelope and merge each inner op into the
   * cache. Returns the values and tombstoned keys that survived the
   * opId gate, in envelope order. Returns null if the payload was not
   * a valid cache envelope or its inner JSON could not be parsed.
   */
  applyEnvelope(payload) {
    if (!isCacheEnvelope(payload)) {
      this.errorsDropped++;
      return null;
    }
    const envelope = decodeCacheOp(payload);
    if (!envelope) {
      this.errorsDropped++;
      return null;
    }
    const jsonOps = parseJsonOps(envelope.value);
    if (!jsonOps) {
      this.errorsDropped++;
      return null;
    }
    const accepted = [];
    const tombstoned = [];
    const rejectedKeys = [];
    for (const jsonOp of jsonOps) {
      if (!jsonOp.key) continue;
      const isTombstone = jsonOp.tombstone === true;
      const valueStr = isTombstone ? "" : JSON.stringify(jsonOp.value);
      const valueBytes = new TextEncoder().encode(valueStr);
      const cacheOp = {
        topic: envelope.topic,
        key: jsonOp.key,
        value: valueBytes,
        opId: envelope.opId,
        nodeId: envelope.nodeId,
        tombstone: isTombstone
      };
      const result = this.cache.merge(cacheOp);
      if (result === "rejected") {
        rejectedKeys.push(jsonOp.key);
        continue;
      }
      this.updatesReceived++;
      if (result === "tombstoned") {
        tombstoned.push(jsonOp.key);
      } else {
        accepted.push({ key: jsonOp.key, value: valueStr });
      }
    }
    if (this.debugHandler) {
      this.debugHandler({
        topic: envelope.topic,
        opId: envelope.opId,
        opCount: jsonOps.length,
        acceptedKeys: accepted.map((v) => v.key),
        tombstonedKeys: tombstoned.slice(),
        rejectedKeys
      });
    }
    return { accepted, tombstoned };
  }
  get(key) {
    return this.cache.get(key);
  }
  getAll() {
    return this.cache.getAll();
  }
  /**
   * Highest opId merged so far. Use as the resume point on reconnect.
   */
  getResumeOpId() {
    return this.cache.getHighestOpId();
  }
  getStats() {
    return {
      updatesReceived: this.updatesReceived,
      errorsDropped: this.errorsDropped,
      entryCount: this.cache.size
    };
  }
}
export {
  ConnectionState as C,
  ENTITY_INFO3_SIZE as E,
  TopicMerger as T,
  entityInfo3ToBytes as a,
  bytesToUuid as b,
  createEntityInfo3 as c,
  CacheMap as d,
  entityInfo3FromBytes as e,
  decodeCacheOp as f,
  encodeCacheOp as g,
  isCacheEnvelope as h,
  isValidUuid as i,
  uuidToBytes as u
};
//# sourceMappingURL=topic-merger.js.map
