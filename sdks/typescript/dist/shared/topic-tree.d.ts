/**
 * Structured per-uuid view of a flat-key topic stream.
 *
 * Topic ops use keys of the form `{uuid}.<dotted.path>`, where the first
 * segment is always the entity uuid. TopicTree groups incoming leaves by
 * uuid and reconstructs the nested JSON object so applications can read
 * `tree.get(uuid).ticket.colour` instead of working with a flat `CacheMap`
 * of dotted keys. The shape is topic-agnostic — the same class powers the
 * `attributes` tree (per-participant attributes) and the `entity` tree
 * (per-entity server-internal config).
 *
 * For new uuids the whole record is built off to the side and only
 * inserted into the tree once fully populated, so a consumer reading the
 * tree mid-batch never sees a partially initialised record.
 */
export type TopicNode = {
    [key: string]: unknown;
};
export interface TopicValue {
    key: string;
    value: string;
}
export declare class TopicTree {
    private records;
    /**
     * Apply a batch of values from one envelope.
     * Existing uuids are mutated in place; new uuids are built fully then
     * inserted atomically. Returns the set of uuids whose subtree changed.
     */
    applyValues(values: ReadonlyArray<TopicValue>): Set<string>;
    /**
     * Apply a batch of tombstones from one envelope.
     * Walks the dotted path for each key and removes the leaf, cleaning up
     * empty intermediate objects. Returns the set of uuids that still have
     * data (`updated`) and uuids whose last leaf was removed (`removed`).
     */
    applyRemoved(keys: ReadonlyArray<string>): {
        updated: Set<string>;
        removed: Set<string>;
    };
    /**
     * Get the record for a single uuid.
     */
    get(uuid: string): TopicNode | undefined;
    /**
     * Get the full tree as a read-only map of `uuid -> record`.
     */
    getAll(): ReadonlyMap<string, TopicNode>;
    /**
     * Number of records in the tree.
     */
    get size(): number;
    /**
     * Drop all records.
     */
    clear(): void;
    private deletePath;
}
//# sourceMappingURL=topic-tree.d.ts.map