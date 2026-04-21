/**
 * Structured per-participant view of attribute state.
 *
 * Attribute keys follow the convention `{uuid}.<dotted.path>`, where the first
 * segment is always the participant's uuid. AttributeTree groups incoming
 * leaves by uuid and reconstructs the nested JSON object so applications can
 * read `tree.get(uuid).ticket.colour` instead of working with the flat
 * `CacheMap` of dotted keys.
 *
 * For new uuids the whole attribute object is built off to the side and only
 * inserted into the tree once fully populated, so a consumer reading the tree
 * mid-batch never sees a partially initialised participant.
 */
export type AttributeNode = {
    [key: string]: unknown;
};
export interface AttributeValue {
    key: string;
    value: string;
}
export declare class AttributeTree {
    private participants;
    /**
     * Apply a batch of attribute values from one envelope.
     * Existing uuids are mutated in place; new uuids are built fully then
     * inserted atomically. Returns the set of uuids whose subtree changed.
     */
    applyValues(values: ReadonlyArray<AttributeValue>): Set<string>;
    /**
     * Apply a batch of tombstones from one envelope.
     * Walks the dotted path for each key and removes the leaf, cleaning up
     * empty intermediate objects. Returns the set of uuids that still have
     * data (`updated`) and uuids whose last attribute was removed (`removed`).
     */
    applyRemoved(keys: ReadonlyArray<string>): {
        updated: Set<string>;
        removed: Set<string>;
    };
    /**
     * Get the attribute object for a single participant.
     */
    get(uuid: string): AttributeNode | undefined;
    /**
     * Get the full tree as a read-only map of `uuid -> attributes`.
     */
    getAll(): ReadonlyMap<string, AttributeNode>;
    /**
     * Number of participants in the tree.
     */
    get size(): number;
    /**
     * Drop all participants.
     */
    clear(): void;
    private deletePath;
}
//# sourceMappingURL=attribute-tree.d.ts.map