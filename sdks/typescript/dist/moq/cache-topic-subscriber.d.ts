import { MoqConnection } from './connection.js';
import { CacheMap, CacheEntry } from '../shared/cache-map.js';
import { TopicValue, MergeDebugHandler } from '../shared/topic-merger.js';
export type { TopicValue };
/**
 * Handler called with a batch of accepted values (added or updated).
 * A single-op message is delivered as a one-element array so callers
 * can rely on the atomicity of each batch.
 */
export type ValuesHandler = (values: TopicValue[]) => void;
/**
 * Handler called with a batch of removed keys (tombstones).
 * A single-op message is delivered as a one-element array.
 */
export type RemovedHandler = (keys: string[]) => void;
/**
 * CacheTopicSubscriber
 *
 * Receives per-key operations from a single MOQ output track that
 * publishes cache envelopes. Maintains a `CacheMap` of all current
 * key-value pairs, with cache-aware merging (highest opId wins).
 */
export declare class CacheTopicSubscriber {
    private connection;
    private trackAlias;
    private isListening;
    private valuesHandler;
    private removedHandler;
    private readonly merger;
    constructor(cache?: CacheMap);
    /** Underlying CacheMap. Exposed so callers (PanaudiaMoqClient) can pass
     *  a shared instance to preserve resume state across subscriber lifetimes. */
    get cache(): CacheMap;
    /** Install a per-envelope diagnostic callback that fires after every
     *  applyEnvelope. Used by the test page to distinguish "envelope
     *  arrived but every op was stale" from "no envelope arrived". */
    setDebugHandler(handler: MergeDebugHandler | null): void;
    /**
     * Set handler called once per envelope with all accepted values.
     * Each value is `{key, value}` where value is the JSON-serialised value
     * from the operation. Single-op messages are delivered as a one-element
     * array so the atomicity of batches is preserved at the API.
     */
    onValues(handler: ValuesHandler): void;
    /**
     * Set handler called once per envelope with all tombstoned keys.
     * Single-op messages are delivered as a one-element array.
     */
    onRemoved(handler: RemovedHandler): void;
    /**
     * Attach to a connection and track alias.
     */
    attach(connection: MoqConnection, trackAlias: number): void;
    /**
     * Start receiving updates via the datagram dispatcher.
     */
    start(): void;
    /**
     * Stop receiving updates.
     */
    stop(): void;
    /**
     * Get a single cache entry by key.
     */
    get(key: string): CacheEntry | undefined;
    /**
     * Get all cache entries as a read-only map.
     */
    getAll(): ReadonlyMap<string, CacheEntry>;
    /**
     * Get the highest opId seen, for use as resume point on reconnection.
     */
    getResumeOpId(): bigint;
    /**
     * Get statistics.
     */
    getStats(): {
        updatesReceived: number;
        errorsDropped: number;
        entryCount: number;
    };
}
/**
 * @deprecated Use `CacheTopicSubscriber` directly, or import the typed
 *   alias `EntitySubscriber` from `cache-topic-subscriber.js`.
 *   Kept for backwards compatibility — the original `AttributesSubscriber`
 *   class was generalised in the entity-read-path refactor.
 */
export declare class AttributesSubscriber extends CacheTopicSubscriber {
}
/**
 * Subscriber for the entity output track. Identical mechanics to
 * `AttributesSubscriber`; named separately for call-site clarity.
 */
export declare class EntitySubscriber extends CacheTopicSubscriber {
}
/**
 * Subscriber for the space output track. The space topic carries the
 * space-wide role-rule record (roles-muted / roles-kicked /
 * roles-gain / roles-attenuation) and is delivered only to holders
 * with the commands.ReadCapSpaceRead cap; without it the server
 * doesn't announce the namespace at all and the client never
 * subscribes. Identical mechanics to the other subscribers.
 */
export declare class SpaceSubscriber extends CacheTopicSubscriber {
}
/**
 * @deprecated Renamed to `TopicValue` to reflect topic-agnostic usage.
 *   Kept as a type alias for backwards compatibility.
 */
export type AttributeValue = TopicValue;
//# sourceMappingURL=cache-topic-subscriber.d.ts.map