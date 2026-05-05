/**
 * WebTransport connection management for MOQ client
 *
 * Handles the underlying WebTransport connection to the MOQ server.
 */

import { ConnectionState, WebTransportOptions } from './types.js';
import { parseObjectDatagram } from './moq-transport.js';

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

interface PendingDatagram {
  trackAlias: number;
  payload: Uint8Array;
  groupId: bigint;
  objectId: bigint;
}

// Maximum bytes the pre-handler datagram buffer is allowed to hold
// across all unknown aliases. 1 MiB is the same envelope-size budget
// used elsewhere in the SDK and is far more than any realistic
// SUBSCRIBE_OK race needs (typically a handful of envelopes a few
// hundred bytes each).
const PENDING_DATAGRAM_MAX_BYTES = 1 * 1024 * 1024;

export class MoqConnection {
  private transport: WebTransport | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private handlers: ConnectionEventHandlers = {};
  private datagramWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;

  // Datagram dispatcher
  private datagramHandlers: Map<number, DatagramHandler> = new Map();
  private datagramDispatcherRunning: boolean = false;

  // Pre-handler datagram buffer. The server's MOQ AddPublisher writes
  // SUBSCRIBE_OK on the bidi control stream and then immediately
  // SendDatagram's any backfilled / pre-buffered objects via the
  // unreliable QUIC datagram channel. Datagrams can race ahead of the
  // SUBSCRIBE_OK on the wire (the streams have independent flow), so a
  // datagram for a freshly-assigned trackAlias can arrive at the
  // dispatcher *before* the await session.subscribe() resolves and
  // registerDatagramHandler is called. We buffer those here in arrival
  // order and drain them when the handler is registered.
  //
  // FIFO across all aliases; oldest dropped when the byte cap is
  // exceeded. Cleared on close().
  private pendingDatagrams: PendingDatagram[] = [];
  private pendingDatagramBytes: number = 0;

  constructor(private readonly serverUrl: string) {}

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get the underlying WebTransport instance
   */
  getTransport(): WebTransport | null {
    return this.transport;
  }

  /**
   * Set event handlers
   */
  setHandlers(handlers: ConnectionEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Connect to the MOQ server via WebTransport
   */
  async connect(options?: WebTransportOptions): Promise<void> {
    if (this.state !== ConnectionState.DISCONNECTED) {
      throw new Error(`Cannot connect: already in state ${this.state}`);
    }

    this.setState(ConnectionState.CONNECTING);

    try {
      // Build WebTransport options
      const wtOptions: WebTransportOptions = {
        allowPooling: false,
        requireUnreliable: true, // We use datagrams for audio
        congestionControl: 'low-latency',
        ...options,
      };

      // Create WebTransport connection
      this.transport = new WebTransport(this.serverUrl, wtOptions);

      // Set up close handler
      this.transport.closed
        .then((info: WebTransportCloseInfo) => {
          this.handleClose(info);
        })
        .catch((error: Error) => {
          this.handleError(error);
        });

      // Wait for connection to be ready
      await this.transport.ready;

      this.setState(ConnectionState.CONNECTED);
    } catch (error) {
      this.setState(ConnectionState.ERROR, error as Error);
      throw error;
    }
  }

  /**
   * Close the connection gracefully
   */
  close(closeInfo?: WebTransportCloseInfo): void {
    this.datagramDispatcherRunning = false;
    this.datagramHandlers.clear();
    this.pendingDatagrams = [];
    this.pendingDatagramBytes = 0;
    if (this.datagramWriter) {
      this.datagramWriter.releaseLock();
      this.datagramWriter = null;
    }
    if (this.transport) {
      this.transport.close(closeInfo);
      this.transport = null;
    }
    this.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * Create a bidirectional stream for the MOQ control channel
   */
  async createControlStream(): Promise<WebTransportBidirectionalStream> {
    if (!this.transport) {
      throw new Error('Not connected');
    }
    return this.transport.createBidirectionalStream();
  }

  /**
   * Create a unidirectional stream for sending data
   */
  async createSendStream(): Promise<WritableStream<Uint8Array>> {
    if (!this.transport) {
      throw new Error('Not connected');
    }
    return this.transport.createUnidirectionalStream();
  }

  /**
   * Get the incoming unidirectional streams reader
   */
  getIncomingStreams(): ReadableStream<WebTransportReceiveStream> {
    if (!this.transport) {
      throw new Error('Not connected');
    }
    return this.transport.incomingUnidirectionalStreams;
  }

  /**
   * Get the datagram writer/reader for audio frames
   */
  getDatagrams(): WebTransportDatagramDuplexStream {
    if (!this.transport) {
      throw new Error('Not connected');
    }
    return this.transport.datagrams;
  }

  /**
   * Get a reader for incoming datagrams
   */
  getDatagramReader(): ReadableStreamDefaultReader<Uint8Array> | null {
    if (!this.transport) {
      return null;
    }
    return this.transport.datagrams.readable.getReader();
  }

  /**
   * Send a datagram (used for audio frames)
   */
  async sendDatagram(data: Uint8Array): Promise<void> {
    if (!this.transport) {
      throw new Error('Not connected');
    }
    if (!this.datagramWriter) {
      this.datagramWriter = this.transport.datagrams.writable.getWriter();
    }
    try {
      await this.datagramWriter.write(data);
    } catch (error) {
      // Writer may be in error state — release lock so a new writer can be created
      try { this.datagramWriter.releaseLock(); } catch {}
      this.datagramWriter = null;
      throw error;
    }
  }

  /**
   * Register a datagram handler for a specific track alias.
   * Starts the dispatcher on first registration. Drains any datagrams
   * that arrived for this alias before the handler was registered (the
   * SUBSCRIBE_OK / first-datagram race — see `pendingDatagrams`).
   */
  registerDatagramHandler(trackAlias: number, handler: DatagramHandler): void {
    this.datagramHandlers.set(trackAlias, handler);
    if (!this.datagramDispatcherRunning) {
      this.startDatagramDispatcher();
    }
    if (this.pendingDatagrams.length > 0) {
      this.drainPendingForAlias(trackAlias, handler);
    }
  }

  /**
   * Unregister a datagram handler for a track alias. Discards any
   * still-buffered pre-handler datagrams for that alias.
   */
  unregisterDatagramHandler(trackAlias: number): void {
    this.datagramHandlers.delete(trackAlias);
    if (this.pendingDatagrams.length > 0) {
      this.discardPendingForAlias(trackAlias);
    }
  }

  /**
   * Number of buffered pre-handler datagrams currently held. Exposed
   * for tests and diagnostics; production callers shouldn't need it.
   */
  getPendingDatagramCount(): number {
    return this.pendingDatagrams.length;
  }

  /**
   * Drain any datagrams that arrived for `trackAlias` before its
   * handler was registered, in arrival order. Called from
   * registerDatagramHandler.
   */
  private drainPendingForAlias(trackAlias: number, handler: DatagramHandler): void {
    const remaining: PendingDatagram[] = [];
    let drainedBytes = 0;
    for (const d of this.pendingDatagrams) {
      if (d.trackAlias === trackAlias) {
        try {
          handler(d.payload, d.trackAlias, d.groupId, d.objectId);
        } catch {
          // Ignore handler errors; drain proceeds.
        }
        drainedBytes += d.payload.length;
      } else {
        remaining.push(d);
      }
    }
    this.pendingDatagrams = remaining;
    this.pendingDatagramBytes -= drainedBytes;
  }

  /**
   * Drop any buffered datagrams for `trackAlias` (called on
   * unregister so we don't keep stale bytes around).
   */
  private discardPendingForAlias(trackAlias: number): void {
    const remaining: PendingDatagram[] = [];
    let discardedBytes = 0;
    for (const d of this.pendingDatagrams) {
      if (d.trackAlias === trackAlias) {
        discardedBytes += d.payload.length;
      } else {
        remaining.push(d);
      }
    }
    this.pendingDatagrams = remaining;
    this.pendingDatagramBytes -= discardedBytes;
  }

  /**
   * Buffer a datagram whose trackAlias has no registered handler yet.
   * FIFO across all aliases; oldest entries are dropped when the byte
   * cap is exceeded. Called from the dispatcher loop.
   */
  private bufferUnknownDatagram(d: PendingDatagram): void {
    this.pendingDatagrams.push(d);
    this.pendingDatagramBytes += d.payload.length;
    while (
      this.pendingDatagramBytes > PENDING_DATAGRAM_MAX_BYTES &&
      this.pendingDatagrams.length > 0
    ) {
      const dropped = this.pendingDatagrams.shift()!;
      this.pendingDatagramBytes -= dropped.payload.length;
    }
  }

  /**
   * Start the single datagram reader loop that dispatches to handlers by track alias
   */
  private startDatagramDispatcher(): void {
    if (this.datagramDispatcherRunning || !this.transport) {
      return;
    }
    this.datagramDispatcherRunning = true;

    const reader = this.transport.datagrams.readable.getReader();

    const loop = async () => {
      try {
        while (this.datagramDispatcherRunning) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;

          try {
            const parsed = parseObjectDatagram(value);
            this.dispatchOrBuffer(parsed);
          } catch {
            // Malformed datagram — skip
          }
        }
      } catch (error) {
        if (this.datagramDispatcherRunning) {
          console.error('Datagram dispatcher error:', error);
        }
      } finally {
        this.datagramDispatcherRunning = false;
      }
    };

    loop();
  }

  /**
   * Route a parsed datagram to its handler, or buffer it if the
   * handler hasn't been registered yet. Extracted from the dispatcher
   * loop so unit tests can drive it without a real WebTransport.
   */
  private dispatchOrBuffer(parsed: PendingDatagram): void {
    const handler = this.datagramHandlers.get(parsed.trackAlias);
    if (handler) {
      handler(parsed.payload, parsed.trackAlias, parsed.groupId, parsed.objectId);
    } else {
      this.bufferUnknownDatagram(parsed);
    }
  }

  /**
   * Update connection state and notify handlers
   */
  private setState(state: ConnectionState, error?: Error): void {
    this.state = state;

    if (this.handlers.onStateChange) {
      this.handlers.onStateChange(state, error);
    }
  }

  /**
   * Handle connection close
   */
  private handleClose(info: WebTransportCloseInfo): void {
    if (this.datagramWriter) {
      try { this.datagramWriter.releaseLock(); } catch {}
      this.datagramWriter = null;
    }
    this.transport = null;
    this.setState(ConnectionState.DISCONNECTED);

    if (this.handlers.onClose) {
      this.handlers.onClose(info);
    }
  }

  /**
   * Handle connection error
   */
  private handleError(error: Error): void {
    console.error('WebTransport connection error:', error);
    if (this.datagramWriter) {
      try { this.datagramWriter.releaseLock(); } catch {}
      this.datagramWriter = null;
    }
    this.transport = null;
    this.setState(ConnectionState.ERROR, error);
  }
}

/**
 * Check if WebTransport is supported in this browser
 */
export function isWebTransportSupported(): boolean {
  return typeof WebTransport !== 'undefined';
}

/**
 * Get WebTransport support information
 */
export function getWebTransportSupport(): {
  supported: boolean;
  datagrams: boolean;
  serverCertificateHashes: boolean;
} {
  const supported = isWebTransportSupported();

  return {
    supported,
    // These are typically supported if WebTransport is available
    datagrams: supported,
    serverCertificateHashes: supported,
  };
}
