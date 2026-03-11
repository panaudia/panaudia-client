/**
 * State Subscriber - Receives entity state from server via MOQ datagrams
 *
 * Subscribes to the state output track, parses EntityInfo3 binary payloads,
 * and maintains a map of known entities.
 */

import { MoqConnection } from './connection.js';
import { entityInfo3FromBytes, ENTITY_INFO3_SIZE } from '../shared/encoding.js';
import { EntityInfo3 } from './types.js';

/**
 * Entity state with Panaudia coordinates
 */
export interface EntityState {
  uuid: string;
  position: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number; roll: number };
  volume: number;
  gone: boolean;
}

/**
 * Handler for entity state updates
 */
export type EntityStateHandler = (state: EntityState) => void;

/**
 * State Subscriber
 *
 * Receives 48-byte EntityInfo3 state updates from the server's state output track.
 * Maintains a map of known entities and fires callbacks on state updates.
 */
export class StateSubscriber {
  private connection: MoqConnection | null = null;
  private trackAlias: number = 0;
  private isListening: boolean = false;
  private entities: Map<string, EntityState> = new Map();
  private stateHandler: EntityStateHandler | null = null;

  // Statistics
  private updatesReceived: number = 0;
  private errorsDropped: number = 0;

  /**
   * Set handler for entity state updates
   */
  onState(handler: EntityStateHandler): void {
    this.stateHandler = handler;
  }

  /**
   * Attach to a connection and track alias
   */
  attach(connection: MoqConnection, trackAlias: number): void {
    this.connection = connection;
    this.trackAlias = trackAlias;
  }

  /**
   * Start receiving state updates via the datagram dispatcher
   */
  start(): void {
    if (!this.connection || this.isListening) return;

    this.isListening = true;

    this.connection.registerDatagramHandler(this.trackAlias, (payload) => {
      if (!this.isListening) return;

      if (payload.length !== ENTITY_INFO3_SIZE) {
        this.errorsDropped++;
        return;
      }

      try {
        const info: EntityInfo3 = entityInfo3FromBytes(payload);
        const state: EntityState = {
          uuid: info.uuid,
          position: { ...info.position },
          rotation: { ...info.rotation },
          volume: info.volume,
          gone: info.gone,
        };

        this.updatesReceived++;

        if (info.gone) {
          this.entities.delete(info.uuid);
        } else {
          this.entities.set(info.uuid, state);
        }

        if (this.stateHandler) {
          this.stateHandler(state);
        }
      } catch {
        this.errorsDropped++;
      }
    });
  }

  /**
   * Stop receiving state updates
   */
  stop(): void {
    this.isListening = false;
    if (this.connection) {
      this.connection.unregisterDatagramHandler(this.trackAlias);
    }
  }

  /**
   * Get all known entities (not gone)
   */
  getEntities(): Map<string, EntityState> {
    return new Map(this.entities);
  }

  /**
   * Get a specific entity by UUID
   */
  getEntity(uuid: string): EntityState | undefined {
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
