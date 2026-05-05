import { CacheMap, CacheEntry } from './cache-map.js';
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
export declare class TopicMerger {
    readonly cache: CacheMap;
    private updatesReceived;
    private errorsDropped;
    private debugHandler;
    constructor(cache?: CacheMap);
    /** Install a per-envelope diagnostic callback. Pass null to clear. */
    setDebugHandler(handler: MergeDebugHandler | null): void;
    /**
     * Decode a binary cache envelope and merge each inner op into the
     * cache. Returns the values and tombstoned keys that survived the
     * opId gate, in envelope order. Returns null if the payload was not
     * a valid cache envelope or its inner JSON could not be parsed.
     */
    applyEnvelope(payload: Uint8Array): MergeResult | null;
    get(key: string): CacheEntry | undefined;
    getAll(): ReadonlyMap<string, CacheEntry>;
    /**
     * Highest opId merged so far. Use as the resume point on reconnect.
     */
    getResumeOpId(): bigint;
    getStats(): {
        updatesReceived: number;
        errorsDropped: number;
        entryCount: number;
    };
}
//# sourceMappingURL=topic-merger.d.ts.map