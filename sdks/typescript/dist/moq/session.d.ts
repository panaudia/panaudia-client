import { MoqConnection } from './connection.js';
import { MoqRole } from './types.js';
export declare class MoqSession {
    private readonly connection;
    private controlStream;
    private writer;
    private reader;
    private readBuffer;
    private nextSubscribeId;
    private nextTrackAlias;
    private nextAnnounceRequestId;
    private subscriptions;
    private announcements;
    private incomingSubscriptions;
    private onIncomingSubscribeCallback;
    private readonly debug;
    constructor(connection: MoqConnection, debug?: boolean);
    private log;
    /**
     * Set callback for when server subscribes to one of our announced tracks
     */
    onIncomingSubscribe(callback: (namespace: string[], trackAlias: number) => void): void;
    /**
     * Initialize the MOQ session over the control stream
     * @param role - The MOQ role (publisher, subscriber, or pubsub)
     * @param path - Optional path parameter
     * @param maxSubscribeId - Max number of requests server can send to client (default: 100)
     */
    initialize(role: MoqRole, path?: string, maxSubscribeId?: number): Promise<void>;
    /**
     * Subscribe to a track with JWT authorization
     */
    subscribe(namespace: string[], trackName: string, authorization?: string, resumeOpId?: bigint): Promise<number>;
    /**
     * Wait for a specific message type, handling other messages that arrive first
     */
    private waitForMessage;
    /**
     * Handle messages that arrive when we're waiting for something else
     */
    private handleUnexpectedMessage;
    /**
     * Handle incoming SUBSCRIBE from server and respond with SUBSCRIBE_OK
     *
     * Per moqtransport v0.5.1 / draft-ietf-moq-transport-11, the SUBSCRIBE
     * wire format does NOT include TrackAlias. The publisher (us) assigns a
     * TrackAlias and returns it in SUBSCRIBE_OK.
     *
     * SUBSCRIBE wire format: RequestID, Namespace, TrackName, Priority,
     *   GroupOrder, Forward, FilterType, Parameters
     *
     * SUBSCRIBE_OK wire format: RequestID, TrackAlias, Expires, GroupOrder,
     *   ContentExists, [LargestLocation], Parameters
     */
    private handleIncomingSubscribe;
    /**
     * Get track alias for an incoming subscription by namespace
     */
    getIncomingTrackAlias(namespacePrefix: string): number | undefined;
    /**
     * Parse namespace from content starting at given position
     */
    private parseNamespaceFromContent;
    /**
     * Send ANNOUNCE_OK response
     */
    private sendAnnounceOk;
    /**
     * Send SUBSCRIBE_ANNOUNCES_OK response
     */
    private sendSubscribeAnnouncesOk;
    /**
     * Parse RequestID (first varint) from message content
     */
    private parseRequestId;
    /**
     * Announce a track namespace
     */
    announce(namespace: string[], authorization?: string): Promise<void>;
    /**
     * Get track alias for a subscription
     */
    getTrackAlias(subscribeId: number): number | undefined;
    /**
     * Start background message processing loop
     * This handles messages that arrive after initial connection setup
     */
    startMessageLoop(): void;
    /**
     * Background message processing
     */
    private processMessages;
    /**
     * Close the session
     */
    close(): Promise<void>;
    /**
     * Read a complete message from the control stream with proper length framing
     * Format: [Type varint] [Length: 2 bytes big-endian] [Content: length bytes]
     * Returns: { type, content } where content is the message body without type/length
     */
    private readFramedMessage;
}
//# sourceMappingURL=session.d.ts.map