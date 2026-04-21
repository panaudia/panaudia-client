/**
 * Inner JSON-op parser shared between MOQ and WebRTC attribute paths.
 *
 * The cache envelope wraps either a single op (`{"key":"…","value":…}` or
 * `{"key":"…","tombstone":true}`) or a batch (a JSON array of ops).
 */
export interface JsonOp {
    key: string;
    value?: unknown;
    tombstone?: boolean;
}
/**
 * Parse a JSON payload into individual operations.
 * Returns null if the payload is malformed.
 */
export declare function parseJsonOps(payload: Uint8Array): JsonOp[] | null;
//# sourceMappingURL=json-ops.d.ts.map