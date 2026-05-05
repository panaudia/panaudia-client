/**
 * Single-record view of a flat-key topic stream — the rootless
 * counterpart to `TopicTree`.
 *
 * `TopicTree` groups incoming leaves by the first dotted segment
 * (always a uuid) and reconstructs one nested object per uuid. The
 * `space` topic, however, has no per-uuid prefix: keys look like
 * `roles-muted.{role}` / `roles-kicked.{role}` / `roles-gain.{role}`
 * / `roles-attenuation.{role}`. The reconstructed shape is a single
 * record:
 *
 *   {
 *     "roles-muted":       { "performer": true, ... },
 *     "roles-kicked":      { "performer": 1738273645000, ... },
 *     "roles-gain":        { "performer": 1.5, ... },
 *     "roles-attenuation": { "performer": 2.0, ... },
 *   }
 *
 * Same merge semantics as `TopicTree.applyValues` / `applyRemoved`
 * but keyed at the root instead of per-uuid. Out-of-order arrivals
 * are not the merger's concern — `TopicMerger` already filters stale
 * ops by opId before they reach this tree, so applyValues can write
 * blindly.
 */
export type SingleRecordNode = {
    [key: string]: unknown;
};
export interface SingleRecordValue {
    key: string;
    value: string;
}
export declare class SingleRecordTree {
    private record;
    /**
     * Apply a batch of values from one envelope. Existing leaves are
     * overwritten; intermediate path segments are created on demand.
     * Returns true if any leaf changed (the unified client uses this
     * to decide whether to emit a tree-change event).
     */
    applyValues(values: ReadonlyArray<SingleRecordValue>): boolean;
    /**
     * Apply a batch of tombstones from one envelope. Walks the dotted
     * path for each key and removes the leaf, cleaning up empty
     * intermediate objects. Returns true if anything was removed.
     */
    applyRemoved(keys: ReadonlyArray<string>): boolean;
    /** Get the entire reconstructed record as a read-only object. */
    get(): Readonly<SingleRecordNode>;
    /** Number of top-level fields in the record. */
    get size(): number;
    /** Drop all entries. */
    clear(): void;
    private deletePath;
}
//# sourceMappingURL=single-record-tree.d.ts.map