/**
 * TopicMerger — decode a binary cache envelope and merge each op into a
 * `CacheMap`, returning only the values whose opId beat whatever was
 * already stored.
 *
 * This is the per-key opId gate that protects against out-of-order
 * arrivals on the wire — most importantly, against a stale backfill
 * envelope clobbering a newer live envelope when goroutine scheduling
 * or transport buffering interleaves the two on the bouncer's outbound
 * channel. See spatial-mixer/plan/distributed-state-sync/topic-ordering.md
 * for the broader picture.
 *
 * Both transports route every cached envelope through here so the merge
 * semantics are identical regardless of how the bytes arrived (MOQ
 * datagram, WebRTC data channel, or any future transport).
 */
import { CacheMap, type CacheEntry } from './cache-map.js';
import { isCacheEnvelope, decodeCacheOp, type CacheOp } from './cache-wire.js';
import { parseJsonOps } from './json-ops.js';

export interface TopicValue {
  key: string;
  value: string;
}

export interface MergeResult {
  /** Values from the envelope whose opId was strictly higher than the
   *  current cached opId for that key. Stale entries are filtered out. */
  accepted: TopicValue[];
  /** Tombstoned keys whose opId beat the cached entry. Already-removed
   *  or never-seen keys do not appear here. */
  tombstoned: string[];
}

/**
 * Diagnostic snapshot of one applyEnvelope call. Emitted to the
 * (optional) debug handler so callers can tell apart "envelope never
 * arrived" from "envelope arrived but all ops were stale".
 */
export interface MergeDebugInfo {
  topic: string;
  opId: bigint;
  /** Total ops parsed from the envelope. */
  opCount: number;
  /** Keys whose value was newer than what was cached. */
  acceptedKeys: string[];
  /** Keys whose tombstone was newer than what was cached. */
  tombstonedKeys: string[];
  /** Keys whose op was equal-or-older than the cached entry. */
  rejectedKeys: string[];
}

export type MergeDebugHandler = (info: MergeDebugInfo) => void;

export class TopicMerger {
  readonly cache: CacheMap;
  private updatesReceived = 0;
  private errorsDropped = 0;
  private debugHandler: MergeDebugHandler | null = null;

  constructor(cache?: CacheMap) {
    this.cache = cache ?? new CacheMap();
  }

  /** Install a per-envelope diagnostic callback. Pass null to clear. */
  setDebugHandler(handler: MergeDebugHandler | null): void {
    this.debugHandler = handler;
  }

  /**
   * Decode a binary cache envelope and merge each inner op into the
   * cache. Returns the values and tombstoned keys that survived the
   * opId gate, in envelope order. Returns null if the payload was not
   * a valid cache envelope or its inner JSON could not be parsed.
   */
  applyEnvelope(payload: Uint8Array): MergeResult | null {
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

    const accepted: TopicValue[] = [];
    const tombstoned: string[] = [];
    const rejectedKeys: string[] = [];

    for (const jsonOp of jsonOps) {
      if (!jsonOp.key) continue;

      const isTombstone = jsonOp.tombstone === true;
      const valueStr = isTombstone ? '' : JSON.stringify(jsonOp.value);
      const valueBytes = new TextEncoder().encode(valueStr);

      const cacheOp: CacheOp = {
        topic: envelope.topic,
        key: jsonOp.key,
        value: valueBytes,
        opId: envelope.opId,
        nodeId: envelope.nodeId,
        tombstone: isTombstone,
      };

      const result = this.cache.merge(cacheOp);
      if (result === 'rejected') {
        rejectedKeys.push(jsonOp.key);
        continue;
      }

      this.updatesReceived++;

      if (result === 'tombstoned') {
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
        rejectedKeys,
      });
    }

    return { accepted, tombstoned };
  }

  get(key: string): CacheEntry | undefined {
    return this.cache.get(key);
  }

  getAll(): ReadonlyMap<string, CacheEntry> {
    return this.cache.getAll();
  }

  /**
   * Highest opId merged so far. Use as the resume point on reconnect.
   */
  getResumeOpId(): bigint {
    return this.cache.getHighestOpId();
  }

  getStats(): { updatesReceived: number; errorsDropped: number; entryCount: number } {
    return {
      updatesReceived: this.updatesReceived,
      errorsDropped: this.errorsDropped,
      entryCount: this.cache.size,
    };
  }
}
