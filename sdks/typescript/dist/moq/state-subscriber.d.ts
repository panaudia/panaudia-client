import { MoqConnection } from './connection.js';
/**
 * Entity state with Panaudia coordinates
 */
export interface EntityState {
    uuid: string;
    position: {
        x: number;
        y: number;
        z: number;
    };
    rotation: {
        yaw: number;
        pitch: number;
        roll: number;
    };
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
export declare class StateSubscriber {
    private connection;
    private trackAlias;
    private isListening;
    private entities;
    private stateHandler;
    private updatesReceived;
    private errorsDropped;
    /**
     * Set handler for entity state updates
     */
    onState(handler: EntityStateHandler): void;
    /**
     * Attach to a connection and track alias
     */
    attach(connection: MoqConnection, trackAlias: number): void;
    /**
     * Start receiving state updates via the datagram dispatcher
     */
    start(): void;
    /**
     * Stop receiving state updates
     */
    stop(): void;
    /**
     * Get all known entities (not gone)
     */
    getEntities(): Map<string, EntityState>;
    /**
     * Get a specific entity by UUID
     */
    getEntity(uuid: string): EntityState | undefined;
    /**
     * Get statistics
     */
    getStats(): {
        updatesReceived: number;
        errorsDropped: number;
        entityCount: number;
    };
}
//# sourceMappingURL=state-subscriber.d.ts.map