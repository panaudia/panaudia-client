import { MoqConnection } from './connection.js';
import { CacheMap, CacheEntry } from '../shared/cache-map.js';
/**
 * A single key/value pair delivered to the application.
 */
export interface AttributeValue {
    key: string;
    value: string;
}
/**
 * Handler called with a batch of accepted values (added or updated).
 * A single-op message is delivered as a one-element array so callers
 * can rely on the atomicity of each batch.
 */
export type ValuesHandler = (values: AttributeValue[]) => void;
/**
 * Handler called with a batch of removed keys (tombstones).
 * A single-op message is delivered as a one-element array.
 */
export type RemovedHandler = (keys: string[]) => void;
/**
 * Attributes Subscriber
 *
 * Receives per-key attribute operations from the server's attributes output track.
 * Maintains a CacheMap of all current key-value pairs, with cache-aware merging
 * via the binary cache envelope.
 */
export declare class AttributesSubscriber {
    private connection;
    private trackAlias;
    private isListening;
    private valuesHandler;
    private removedHandler;
    readonly cache: CacheMap;
    constructor(cache?: CacheMap);
    private updatesReceived;
    private errorsDropped;
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
     * Attach to a connection and track alias
     */
    attach(connection: MoqConnection, trackAlias: number): void;
    /**
     * Start receiving attribute updates via the datagram dispatcher
     */
    start(): void;
    /**
     * Stop receiving attribute updates
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
     * Get statistics
     */
    getStats(): {
        updatesReceived: number;
        errorsDropped: number;
        entryCount: number;
    };
}
//# sourceMappingURL=attributes-subscriber.d.ts.map