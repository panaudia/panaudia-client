import { ConnectionState, WebTransportOptions } from './types.js';
import { DatagramHandler } from './datagram-router.js';
export type { DatagramHandler };
/**
 * The minimal send surface a publisher needs. Satisfied by `MoqConnection`
 * (main-thread transport) and by a worker-backed adapter that forwards bytes to
 * the worker's `sendDatagram` RPC — so publishers work either way.
 */
export interface DatagramSender {
    sendDatagram(data: Uint8Array): Promise<void>;
}
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
export declare class MoqConnection {
    private readonly serverUrl;
    private transport;
    private state;
    private handlers;
    private datagramWriter;
    private router;
    private datagramDispatcherRunning;
    private datagramMode;
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
     * Switch to worker datagram mode (design §11.4): the receive Worker reads the
     * datagram readable, so the main dispatcher must NOT. Returns the unlocked
     * `datagrams.readable` for transfer into the worker. Must be called before any
     * `registerDatagramHandler` (which would otherwise start the main dispatcher
     * and lock the stream). Returns null if not connected.
     */
    takeDatagramReadableForWorker(): ReadableStream<Uint8Array> | null;
    /**
     * Revert to main datagram mode if worker setup failed before locking the
     * stream (so a later registerDatagramHandler starts the main dispatcher).
     */
    revertToMainDatagramMode(): void;
    /**
     * Feed a parsed datagram forwarded from the receive Worker through the normal
     * dispatch path (handlers map + SUBSCRIBE_OK pending buffer). The worker only
     * forwards non-audio tracks; audio is decoded in the worker and never arrives
     * here.
     */
    ingestForwardedDatagram(trackAlias: number, payload: Uint8Array, groupId: bigint, objectId: bigint): void;
    /**
     * Register a datagram handler for a specific track alias. Starts the dispatcher
     * on first registration (transport concern); the router drains any datagrams
     * that arrived for this alias before registration (the SUBSCRIBE_OK race).
     */
    registerDatagramHandler(trackAlias: number, handler: DatagramHandler): void;
    /** Unregister a datagram handler; the router discards any still-buffered datagrams for it. */
    unregisterDatagramHandler(trackAlias: number): void;
    /**
     * Number of buffered pre-handler datagrams currently held. Exposed for tests and
     * diagnostics; production callers shouldn't need it.
     */
    getPendingDatagramCount(): number;
    /**
     * Start the single datagram reader loop that dispatches to handlers by track alias
     */
    private startDatagramDispatcher;
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