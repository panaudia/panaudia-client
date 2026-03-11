/**
 * Attributes Subscriber - Receives entity attributes from server via MOQ datagrams
 *
 * Subscribes to the attributes output track, parses JSON payloads,
 * and maintains a map of known entity attributes.
 */

import { MoqConnection } from './connection.js';

/**
 * Node attributes received from the server
 */
export interface EntityAttributes {
  uuid: string;
  name?: string;
  ticket?: string;
  connection?: string;
  subspaces?: string[];
}

/**
 * Handler for attribute updates
 */
export type AttributesHandler = (attrs: EntityAttributes) => void;

/**
 * Attributes Subscriber
 *
 * Receives JSON-encoded attribute updates from the server's attributes output track.
 * Maintains a map of known nodes and their attributes.
 */
export class AttributesSubscriber {
  private connection: MoqConnection | null = null;
  private trackAlias: number = 0;
  private isListening: boolean = false;
  private entities: Map<string, EntityAttributes> = new Map();
  private handler: AttributesHandler | null = null;

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
        const json = new TextDecoder().decode(payload);
        const attrs: EntityAttributes = JSON.parse(json);

        if (!attrs.uuid) {
          this.errorsDropped++;
          return;
        }

        this.updatesReceived++;
        this.entities.set(attrs.uuid, attrs);

        if (this.handler) {
          this.handler(attrs);
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
