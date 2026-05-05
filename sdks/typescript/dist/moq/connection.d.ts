import { ConnectionState, WebTransportOptions } from './types.js';
/**
 * Connection event handlers
 */
export interface ConnectionEventHandlers {
    onStateChange?: (state: ConnectionState, error?: Error) => void;
    onClose?: (info: WebTransportCloseInfo) => void;
}
/**
 * Manages a WebTransport connection to an MOQ server
 */
/**
 * Handler for datagrams dispatched by track alias
 */
export type DatagramHandler = (payload: Uint8Array, trackAlias: number, groupId: bigint, objectId: bigint) => void;
export declare class MoqConnection {
    private readonly serverUrl;
    private transport;
    private state;
    private handlers;
    private datagramWriter;
    private datagramHandlers;
    private datagramDispatcherRunning;
    private pendingDatagrams;
    private pendingDatagramBytes;
    constructor(serverUrl: string);
    /**
     * Get current connection state
     */
    getState(): ConnectionState;
    /**
     * Get the underlying WebTransport instance
     */
    getTransport(): WebTransport | null;
    /**
     * Set event handlers
     */
    setHandlers(handlers: ConnectionEventHandlers): void;
    /**
     * Connect to the MOQ server via WebTransport
     */
    connect(options?: WebTransportOptions): Promise<void>;
    /**
     * Close the connection gracefully
     */
    close(closeInfo?: WebTransportCloseInfo): void;
    /**
     * Create a bidirectional stream for the MOQ control channel
     */
    createControlStream(): Promise<WebTransportBidirectionalStream>;
    /**
     * Create a unidirectional stream for sending data
     */
    createSendStream(): Promise<WritableStream<Uint8Array>>;
    /**
     * Get the incoming unidirectional streams reader
     */
    getIncomingStreams(): ReadableStream<WebTransportReceiveStream>;
    /**
     * Get the datagram writer/reader for audio frames
     */
    getDatagrams(): WebTransportDatagramDuplexStream;
    /**
     * Get a reader for incoming datagrams
     */
    getDatagramReader(): ReadableStreamDefaultReader<Uint8Array> | null;
    /**
     * Send a datagram (used for audio frames)
     */
    sendDatagram(data: Uint8Array): Promise<void>;
    /**
     * Register a datagram handler for a specific track alias.
     * Starts the dispatcher on first registration. Drains any datagrams
     * that arrived for this alias before the handler was registered (the
     * SUBSCRIBE_OK / first-datagram race — see `pendingDatagrams`).
     */
    registerDatagramHandler(trackAlias: number, handler: DatagramHandler): void;
    /**
     * Unregister a datagram handler for a track alias. Discards any
     * still-buffered pre-handler datagrams for that alias.
     */
    unregisterDatagramHandler(trackAlias: number): void;
    /**
     * Number of buffered pre-handler datagrams currently held. Exposed
     * for tests and diagnostics; production callers shouldn't need it.
     */
    getPendingDatagramCount(): number;
    /**
     * Drain any datagrams that arrived for `trackAlias` before its
     * handler was registered, in arrival order. Called from
     * registerDatagramHandler.
     */
    private drainPendingForAlias;
    /**
     * Drop any buffered datagrams for `trackAlias` (called on
     * unregister so we don't keep stale bytes around).
     */
    private discardPendingForAlias;
    /**
     * Buffer a datagram whose trackAlias has no registered handler yet.
     * FIFO across all aliases; oldest entries are dropped when the byte
     * cap is exceeded. Called from the dispatcher loop.
     */
    private bufferUnknownDatagram;
    /**
     * Start the single datagram reader loop that dispatches to handlers by track alias
     */
    private startDatagramDispatcher;
    /**
     * Route a parsed datagram to its handler, or buffer it if the
     * handler hasn't been registered yet. Extracted from the dispatcher
     * loop so unit tests can drive it without a real WebTransport.
     */
    private dispatchOrBuffer;
    /**
     * Update connection state and notify handlers
     */
    private setState;
    /**
     * Handle connection close
     */
    private handleClose;
    /**
     * Handle connection error
     */
    private handleError;
}
/**
 * Check if WebTransport is supported in this browser
 */
export declare function isWebTransportSupported(): boolean;
/**
 * Get WebTransport support information
 */
export declare function getWebTransportSupport(): {
    supported: boolean;
    datagrams: boolean;
    serverCertificateHashes: boolean;
};
//# sourceMappingURL=connection.d.ts.map