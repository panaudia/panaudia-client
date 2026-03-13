/**
 * Client-side merge map for cached state operations.
 *
 * Maintains one entry per key, keeping only the highest opId.
 * Tombstones remove the key from the map.
 */

import type { CacheOp } from './cache-wire.js';

export interface CacheEntry {
  value: Uint8Array;
  opId: bigint;
  nodeId: number;
}

/**
 * Merge result returned by CacheMap.merge()
 */
export type MergeResult = 'accepted' | 'rejected' | 'tombstoned';

/**
 * Handler called when the map state changes
 */
export type CacheChangeHandler = (key: string, entry: CacheEntry | null, result: MergeResult) => void;

/**
 * CacheMap — keeps the latest value per key, ordered by opId.
 *
 * Merge rule: highest opId wins. Tombstones with a higher opId remove the key.
 */
export class CacheMap {
  private entries: Map<string, CacheEntry> = new Map();
  private highestOpId: bigint = 0n;
  private changeHandler: CacheChangeHandler | null = null;

  /**
   * Register a handler called on every state change (add, update, remove).
   */
  onChange(handler: CacheChangeHandler): void {
    this.changeHandler = handler;
  }

  /**
   * Merge an incoming cache operation.
   *
   * Returns 'accepted' if the value was stored, 'tombstoned' if a key
   * was removed, or 'rejected' if the incoming opId was not higher.
   */
  merge(op: CacheOp): MergeResult {
    if (op.opId > this.highestOpId) {
      this.highestOpId = op.opId;
    }

    const existing = this.entries.get(op.key);
    if (existing && op.opId <= existing.opId) {
      return 'rejected';
    }

    if (op.tombstone) {
      if (existing) {
        this.entries.delete(op.key);
        this.changeHandler?.(op.key, null, 'tombstoned');
      }
      return 'tombstoned';
    }

    const entry: CacheEntry = {
      value: op.value,
      opId: op.opId,
      nodeId: op.nodeId,
    };
    this.entries.set(op.key, entry);
    this.changeHandler?.(op.key, entry, 'accepted');
    return 'accepted';
  }

  /**
   * Get a single entry by key.
   */
  get(key: string): CacheEntry | undefined {
    return this.entries.get(key);
  }

  /**
   * Get all entries as a read-only map.
   */
  getAll(): ReadonlyMap<string, CacheEntry> {
    return this.entries;
  }

  /**
   * Get the highest opId seen across all merge calls.
   * Used as the resume point on reconnection.
   */
  getHighestOpId(): bigint {
    return this.highestOpId;
  }

  /**
   * Number of entries in the map.
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Clear all entries and reset the highest opId.
   */
  clear(): void {
    this.entries.clear();
    this.highestOpId = 0n;
  }
}
