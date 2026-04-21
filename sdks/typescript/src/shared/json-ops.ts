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
export function parseJsonOps(payload: Uint8Array): JsonOp[] | null {
  try {
    const json = new TextDecoder().decode(payload);
    const parsed: unknown = JSON.parse(json);

    if (Array.isArray(parsed)) {
      const ops: JsonOp[] = [];
      for (const item of parsed) {
        if (typeof item !== 'object' || item === null || !('key' in item)) {
          return null;
        }
        ops.push(item as JsonOp);
      }
      return ops.length > 0 ? ops : null;
    }

    if (typeof parsed === 'object' && parsed !== null && 'key' in parsed) {
      return [parsed as JsonOp];
    }

    return null;
  } catch {
    return null;
  }
}
