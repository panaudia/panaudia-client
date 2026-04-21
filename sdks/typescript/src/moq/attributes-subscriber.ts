/**
 * Attributes Subscriber - Receives per-key attribute operations from server via MOQ datagrams
 *
 * Subscribes to the attributes output track, decodes binary cache envelopes,
 * parses the JSON payload (single op or batch), and merges each operation
 * into the CacheMap using the envelope's opID.
 *
 * JSON operation format:
 *   Single: {"key":"uuid.field","value":"..."}
 *   Tombstone: {"key":"uuid.field","tombstone":true}
 *   Batch: [{"key":"uuid.name","value":"alice"}, {"key":"uuid.ticket","value":"..."}]
 *
 * The subscriber fires per-key callbacks. The application is responsible
 * for reconstructing structured objects from the flat key-value map.
 */

import { MoqConnection } from './connection.js';
import { isCacheEnvelope, decodeCacheOp } from '../shared/cache-wire.js';
import { CacheMap, CacheEntry } from '../shared/cache-map.js';
import type { CacheOp } from '../shared/cache-wire.js';
import { parseJsonOps } from '../shared/json-ops.js';

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
export class AttributesSubscriber {
  private connection: MoqConnection | null = null;
  private trackAlias: number = 0;
  private isListening: boolean = false;
  private valuesHandler: ValuesHandler | null = null;
  private removedHandler: RemovedHandler | null = null;
  readonly cache: CacheMap;

  constructor(cache?: CacheMap) {
    this.cache = cache ?? new CacheMap();
  }

  // Statistics
  private updatesReceived: number = 0;
  private errorsDropped: number = 0;

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
   * Attach to a connection and track alias
   */
  attach(connection: MoqConnection, trackAlias: number): void {
    this.connection = connection;
    this.trackAlias = trackAlias;
  }

  /**
   * Start receiving attribute updates via the datagram dispatcher
   */
  start(): void {
    if (!this.connection || this.isListening) return;

    this.isListening = true;

    this.connection.registerDatagramHandler(this.trackAlias, (payload) => {
      if (!this.isListening) return;

      try {
        if (!isCacheEnvelope(payload)) {
          this.errorsDropped++;
          return;
        }

        const envelope = decodeCacheOp(payload);
        if (!envelope) {
          this.errorsDropped++;
          return;
        }

        // Parse the inner JSON payload (single op or batch).
        const jsonOps = parseJsonOps(envelope.value);
        if (!jsonOps) {
          this.errorsDropped++;
          return;
        }

        // Merge each operation using the envelope's opId, collecting
        // accepted values and tombstoned keys so each envelope produces
        // at most one callback per kind (preserves batch atomicity).
        const acceptedValues: AttributeValue[] = [];
        const tombstonedKeys: string[] = [];

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
            continue; // stale
          }

          this.updatesReceived++;

          if (result === 'tombstoned') {
            tombstonedKeys.push(jsonOp.key);
          } else {
            acceptedValues.push({ key: jsonOp.key, value: valueStr });
          }
        }

        if (acceptedValues.length > 0) {
          this.valuesHandler?.(acceptedValues);
        }
        if (tombstonedKeys.length > 0) {
          this.removedHandler?.(tombstonedKeys);
        }
      } catch {
        this.errorsDropped++;
      }
    });
  }

  /**
   * Stop receiving attribute updates
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
    return this.cache.get(key);
  }

  /**
   * Get all cache entries as a read-only map.
   */
  getAll(): ReadonlyMap<string, CacheEntry> {
    return this.cache.getAll();
  }

  /**
   * Get the highest opId seen, for use as resume point on reconnection.
   */
  getResumeOpId(): bigint {
    return this.cache.getHighestOpId();
  }

  /**
   * Get statistics
   */
  getStats(): { updatesReceived: number; errorsDropped: number; entryCount: number } {
    return {
      updatesReceived: this.updatesReceived,
      errorsDropped: this.errorsDropped,
      entryCount: this.cache.size,
    };
  }
}
