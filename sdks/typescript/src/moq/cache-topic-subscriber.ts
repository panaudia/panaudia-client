/**
 * CacheTopicSubscriber — receives per-key operations from a server cache
 * topic via MOQ datagrams.
 *
 * Subscribes to a track that publishes binary cache envelopes, parses the
 * JSON payload (single op or batch), and merges each operation into a
 * `CacheMap` using the envelope's opID. The subscriber fires per-batch
 * callbacks; the application is responsible for reconstructing structured
 * objects from the flat key-value map (see `TopicTree`).
 *
 * The class is topic-agnostic — both the `attributes` and `entity` MOQ
 * output tracks use the same envelope/op format and feed through this
 * subscriber.
 *
 * JSON operation format:
 *   Single:    {"key":"uuid.field","value":"..."}
 *   Tombstone: {"key":"uuid.field","tombstone":true}
 *   Batch:     [{"key":"uuid.name","value":"alice"}, ...]
 */

import { MoqConnection } from './connection.js';
import { CacheMap, CacheEntry } from '../shared/cache-map.js';
import { TopicMerger, type TopicValue, type MergeDebugHandler } from '../shared/topic-merger.js';

// Re-export so existing import paths keep working.
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
export class CacheTopicSubscriber {
  private connection: MoqConnection | null = null;
  private trackAlias: number = 0;
  private isListening: boolean = false;
  private valuesHandler: ValuesHandler | null = null;
  private removedHandler: RemovedHandler | null = null;
  private readonly merger: TopicMerger;

  constructor(cache?: CacheMap) {
    this.merger = new TopicMerger(cache);
  }

  /** Underlying CacheMap. Exposed so callers (PanaudiaMoqClient) can pass
   *  a shared instance to preserve resume state across subscriber lifetimes. */
  get cache(): CacheMap {
    return this.merger.cache;
  }

  /** Install a per-envelope diagnostic callback that fires after every
   *  applyEnvelope. Used by the test page to distinguish "envelope
   *  arrived but every op was stale" from "no envelope arrived". */
  setDebugHandler(handler: MergeDebugHandler | null): void {
    this.merger.setDebugHandler(handler);
  }

  /**
   * Set handler called once per envelope with all accepted values.
   * Each value is `{key, value}` where value is the JSON-serialised value
   * from the operation. Single-op messages are delivered as a one-element
   * array so the atomicity of batches is preserved at the API.
   */
  onValues(handler: ValuesHandler): void {
    this.valuesHandler = handler;
  }

  /**
   * Set handler called once per envelope with all tombstoned keys.
   * Single-op messages are delivered as a one-element array.
   */
  onRemoved(handler: RemovedHandler): void {
    this.removedHandler = handler;
  }

  /**
   * Attach to a connection and track alias.
   */
  attach(connection: MoqConnection, trackAlias: number): void {
    this.connection = connection;
    this.trackAlias = trackAlias;
  }

  /**
   * Start receiving updates via the datagram dispatcher.
   */
  start(): void {
    if (!this.connection || this.isListening) return;

    this.isListening = true;

    this.connection.registerDatagramHandler(this.trackAlias, (payload) => {
      if (!this.isListening) return;
      // The merger handles decode + opId-gated merge. Each envelope
      // produces at most one accepted-values callback and one
      // tombstones callback, preserving batch atomicity.
      const result = this.merger.applyEnvelope(payload);
      if (!result) return;
      if (result.accepted.length > 0) {
        this.valuesHandler?.(result.accepted);
      }
      if (result.tombstoned.length > 0) {
        this.removedHandler?.(result.tombstoned);
      }
    });
  }

  /**
   * Stop receiving updates.
   */
  stop(): void {
    this.isListening = false;
    if (this.connection) {
      this.connection.unregisterDatagramHandler(this.trackAlias);
    }
  }

  /**
   * Get a single cache entry by key.
   */
  get(key: string): CacheEntry | undefined {
    return this.merger.get(key);
  }

  /**
   * Get all cache entries as a read-only map.
   */
  getAll(): ReadonlyMap<string, CacheEntry> {
    return this.merger.getAll();
  }

  /**
   * Get the highest opId seen, for use as resume point on reconnection.
   */
  getResumeOpId(): bigint {
    return this.merger.getResumeOpId();
  }

  /**
   * Get statistics.
   */
  getStats(): { updatesReceived: number; errorsDropped: number; entryCount: number } {
    return this.merger.getStats();
  }
}

/**
 * @deprecated Use `CacheTopicSubscriber` directly, or import the typed
 *   alias `EntitySubscriber` from `cache-topic-subscriber.js`.
 *   Kept for backwards compatibility — the original `AttributesSubscriber`
 *   class was generalised in the entity-read-path refactor.
 */
export class AttributesSubscriber extends CacheTopicSubscriber {}

/**
 * Subscriber for the entity output track. Identical mechanics to
 * `AttributesSubscriber`; named separately for call-site clarity.
 */
export class EntitySubscriber extends CacheTopicSubscriber {}

/**
 * Subscriber for the space output track. The space topic carries the
 * space-wide role-rule record (roles-muted / roles-kicked /
 * roles-gain / roles-attenuation) and is delivered only to holders
 * with the commands.ReadCapSpaceRead cap; without it the server
 * doesn't announce the namespace at all and the client never
 * subscribes. Identical mechanics to the other subscribers.
 */
export class SpaceSubscriber extends CacheTopicSubscriber {}

/**
 * @deprecated Renamed to `TopicValue` to reflect topic-agnostic usage.
 *   Kept as a type alias for backwards compatibility.
 */
export type AttributeValue = TopicValue;
