/**
 * Wire format encoder/decoder for cached state operations.
 *
 * Byte layout (big-endian):
 *   [Version    1 byte]  — 0xCA identifies a cache envelope
 *   [Flags      1 byte]  — bit 0: tombstone
 *   [OpID       8 bytes] — monotonic operation ID assigned by the bouncer
 *   [NodeID     4 bytes] — originating node ID (for identification, not ordering)
 *   [TopicLen   1 byte]  — length of topic string
 *   [Topic      N bytes]
 *   [KeyLen     2 bytes] — length of key string
 *   [Key        N bytes]
 *   [ValueLen   4 bytes] — length of value payload
 *   [Value      N bytes]
 */

const WIRE_VERSION = 0xca;
const FLAG_TOMBSTONE = 0x01;
const MIN_WIRE_LEN = 21;

export interface CacheOp {
  topic: string;
  key: string;
  value: Uint8Array;
  opId: bigint;
  nodeId: number;
  tombstone: boolean;
}

/**
 * Returns true if the data starts with the cache version byte.
 */
export function isCacheEnvelope(data: Uint8Array): boolean {
  return data.length > 0 && data[0] === WIRE_VERSION;
}

/**
 * Decode a cache envelope from binary data.
 * Returns null if the data is malformed.
 */
export function decodeCacheOp(data: Uint8Array): CacheOp | null {
  if (data.length < MIN_WIRE_LEN) {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let off = 0;

  if (data[off] !== WIRE_VERSION) {
    return null;
  }
  off++;

  const flags = data[off]!;
  off++;

  const opId = view.getBigUint64(off, false); // big-endian
  off += 8;

  const nodeId = view.getUint32(off, false);
  off += 4;

  const topicLen = data[off]!;
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
    tombstone: (flags! & FLAG_TOMBSTONE) !== 0,
  };
}

/**
 * Encode a cache operation into the wire format.
 */
export function encodeCacheOp(op: CacheOp): Uint8Array {
  const topicBytes = new TextEncoder().encode(op.topic);
  const keyBytes = new TextEncoder().encode(op.key);

  const size =
    1 +
    1 +
    8 +
    4 +
    1 +
    topicBytes.length +
    2 +
    keyBytes.length +
    4 +
    op.value.length;
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
