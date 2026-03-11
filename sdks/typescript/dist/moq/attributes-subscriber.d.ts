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
export declare class AttributesSubscriber {
    private connection;
    private trackAlias;
    private isListening;
    private entities;
    private handler;
    private updatesReceived;
    private errorsDropped;
    /**
     * Set handler for attribute updates
     */
    onAttributes(handler: AttributesHandler): void;
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
     * Get all known entities
     */
    getKnownEntities(): Map<string, EntityAttributes>;
    /**
     * Get attributes for a specific entity
     */
    getEntityAttributes(uuid: string): EntityAttributes | undefined;
    /**
     * Get statistics
     */
    getStats(): {
        updatesReceived: number;
        errorsDropped: number;
        entityCount: number;
    };
}
//# sourceMappingURL=attributes-subscriber.d.ts.map