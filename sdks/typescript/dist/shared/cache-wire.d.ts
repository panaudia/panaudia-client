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
export declare function isCacheEnvelope(data: Uint8Array): boolean;
/**
 * Decode a cache envelope from binary data.
 * Returns null if the data is malformed.
 */
export declare function decodeCacheOp(data: Uint8Array): CacheOp | null;
/**
 * Encode a cache operation into the wire format.
 */
export declare function encodeCacheOp(op: CacheOp): Uint8Array;
//# sourceMappingURL=cache-wire.d.ts.map