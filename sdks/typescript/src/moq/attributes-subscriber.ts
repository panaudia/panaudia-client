/**
 * Attributes Subscriber - Receives entity attributes from server via MOQ datagrams
 *
 * Subscribes to the attributes output track, parses JSON payloads,
 * and maintains a map of known entity attributes.
 *
 * When the server wraps messages in a cache envelope (0xCA prefix),
 * the subscriber decodes the envelope, merges via CacheMap (highest opId wins),
 * and delivers the inner JSON payload to the application handler.
 * Non-envelope messages are handled as plain JSON for backward compatibility.
 */

import { MoqConnection } from './connection.js';
import { isCacheEnvelope, decodeCacheOp } from '../shared/cache-wire.js';
import { CacheMap } from '../shared/cache-map.js';

/**
 * Node attributes received from the server
 */
export interface EntityAttributes {
  uuid: string;
  name?: string;
  ticket?: string;
  connection?: string;
  subspaces?: string[];
  _tombstone?: boolean;
}

/**
 * Handler for attribute updates
 */
export type AttributesHandler = (attrs: EntityAttributes) => void;

/**
 * Handler called when a node is removed via tombstone
 */
export type AttributesRemovedHandler = (uuid: string) => void;

/**
 * Attributes Subscriber
 *
 * Receives JSON-encoded attribute updates from the server's attributes output track.
 * Maintains a map of known nodes and their attributes, with cache-aware merging
 * when the server provides cache envelopes.
 */
export class AttributesSubscriber {
  private connection: MoqConnection | null = null;
  private trackAlias: number = 0;
  private isListening: boolean = false;
  private entities: Map<string, EntityAttributes> = new Map();
  private handler: AttributesHandler | null = null;
  private removedHandler: AttributesRemovedHandler | null = null;
  readonly cache: CacheMap;

  constructor(cache?: CacheMap) {
    this.cache = cache ?? new CacheMap();
  }

  // Statistics
  private updatesReceived: number = 0;
  private errorsDropped: number = 0;

  /**
   * Set handler for attribute updates
   */
  onAttributes(handler: AttributesHandler): void {
    this.handler = handler;
  }

  /**
   * Set handler for attribute removals (tombstones)
   */
  onRemoved(handler: AttributesRemovedHandler): void {
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
        // Cache envelope path
        if (isCacheEnvelope(payload)) {
          const op = decodeCacheOp(payload);
          if (!op) {
            this.errorsDropped++;
            return;
          }

          const result = this.cache.merge(op);
          if (result === 'rejected') {
            return; // stale — already have a newer version
          }

          if (result === 'tombstoned') {
            this.entities.delete(op.key);
            this.removedHandler?.(op.key);
            return;
          }

          // Decode the inner JSON payload
          const json = new TextDecoder().decode(op.value);
          const attrs: EntityAttributes = JSON.parse(json);
          if (!attrs.uuid) {
            this.errorsDropped++;
            return;
          }

          this.updatesReceived++;
          this.entities.set(attrs.uuid, attrs);
          this.handler?.(attrs);
          return;
        }

        // Plain JSON path (backward compatibility with servers without cache)
        const json = new TextDecoder().decode(payload);
        const attrs: EntityAttributes = JSON.parse(json);

        if (!attrs.uuid) {
          this.errorsDropped++;
          return;
        }

        this.updatesReceived++;
        this.entities.set(attrs.uuid, attrs);
        this.handler?.(attrs);
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
   * Get all known entities
   */
  getKnownEntities(): Map<string, EntityAttributes> {
    return new Map(this.entities);
  }

  /**
   * Get attributes for a specific entity
   */
  getEntityAttributes(uuid: string): EntityAttributes | undefined {
    return this.entities.get(uuid);
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
  getStats(): { updatesReceived: number; errorsDropped: number; entityCount: number } {
    return {
      updatesReceived: this.updatesReceived,
      errorsDropped: this.errorsDropped,
      entityCount: this.entities.size,
    };
  }
}
