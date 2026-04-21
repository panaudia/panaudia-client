import { CacheOp } from './cache-wire.js';
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
export declare class CacheMap {
    private entries;
    private highestOpId;
    private changeHandler;
    /**
     * Register a handler called on every state change (add, update, remove).
     */
    onChange(handler: CacheChangeHandler): void;
    /**
     * Merge an incoming cache operation.
     *
     * Returns 'accepted' if the value was stored, 'tombstoned' if a key
     * was removed, or 'rejected' if the incoming opId was not higher.
     */
    merge(op: CacheOp): MergeResult;
    /**
     * Get a single entry by key.
     */
    get(key: string): CacheEntry | undefined;
    /**
     * Get all entries as a read-only map.
     */
    getAll(): ReadonlyMap<string, CacheEntry>;
    /**
     * Get the highest opId seen across all merge calls.
     * Used as the resume point on reconnection.
     */
    getHighestOpId(): bigint;
    /**
     * Number of entries in the map.
     */
    get size(): number;
    /**
     * Clear all entries and reset the highest opId.
     */
    clear(): void;
}
//# sourceMappingURL=cache-map.d.ts.map