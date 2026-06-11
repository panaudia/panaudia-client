/**
 * WebTransport connection management for MOQ client
 *
 * Handles the underlying WebTransport connection to the MOQ server.
 */

import { ConnectionState, WebTransportOptions } from './types.js';
import { parseObjectDatagram } from './moq-transport.js';
import { DatagramRouter, type DatagramHandler } from './datagram-router.js';

// Re-exported for back-compat: subscribers import DatagramHandler from here.
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
export class MoqConnection {
  private transport: WebTransport | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private handlers: ConnectionEventHandlers = {};
  private datagramWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;

  // Datagram dispatcher: the read loop lives here (transport concern); the
  // trackAlias→handler routing + SUBSCRIBE_OK race buffer live in the router
  // (Phase 1 extraction — worker-transport-plan.md).
  private router = new DatagramRouter();
  private datagramDispatcherRunning: boolean = false;
  // 'main' = this class reads the datagram readable directly (default/fallback).
  // 'worker' = the receive Worker owns the read loop (design §11.4); the main
  // dispatcher is suppressed and parsed non-audio datagrams arrive via
  // ingestForwardedDatagram(), still routed through the same DatagramRouter
  // (handler map + SUBSCRIBE_OK race buffer), unchanged.
  private datagramMode: 'main' | 'worker' = 'main';

  constructor(private readonly serverUrl: string, private readonly debug: boolean = false) {}

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
        // Negotiate the MOQ draft-16 subprotocol over WebTransport so the server
        // selects draft-16 (it falls back to draft-14 if no subprotocol is set).
        protocols: ['moqt-16'],
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

      // DIAGNOSTIC (debug only): the negotiated WebTransport subprotocol. The server
      // selects MOQ draft-16 only when this is 'moqt-16'; if a browser lacks WebTransport
      // subprotocol negotiation (Firefox), this is empty → the server falls back to
      // draft-14 → our draft-16 CLIENT_SETUP is rejected → "remote close". Kept (it was
      // the key aid for the FF/Safari connect bug) but gated so it's silent in production.
      if (this.debug) {
        console.log(
          `[MOQ] WebTransport ready — negotiated subprotocol: ${JSON.stringify(this.getNegotiatedSubprotocol())}`
        );
      }

      this.setState(ConnectionState.CONNECTED);
    } catch (error) {
      this.setState(ConnectionState.ERROR, error as Error);
      throw error;
    }
  }

  /**
   * The WebTransport subprotocol the server selected ('moqt-16' when draft-16
   * negotiation worked; empty/undefined on engines without subprotocol support).
   * Null before connect. Used by the stereo diagnostics snapshot.
   */
  getNegotiatedSubprotocol(): string | null {
    if (!this.transport) return null;
    return (this.transport as { protocol?: string }).protocol ?? null;
  }

  /**
   * Close the connection gracefully
   */
  close(closeInfo?: WebTransportCloseInfo): void {
    this.datagramDispatcherRunning = false;
    this.datagramMode = 'main';
    this.router.clear();
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
    // Never write a zero-length datagram: it carries no MOQ object and some
    // WebTransport implementations (Firefox/Safari) reject/closeon an empty write.
    if (data.length === 0) {
      return;
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
   * Switch to worker datagram mode (design §11.4): the receive Worker reads the
   * datagram readable, so the main dispatcher must NOT. Returns the unlocked
   * `datagrams.readable` for transfer into the worker. Must be called before any
   * `registerDatagramHandler` (which would otherwise start the main dispatcher
   * and lock the stream). Returns null if not connected.
   */
  takeDatagramReadableForWorker(): ReadableStream<Uint8Array> | null {
    if (!this.transport) return null;
    if (this.datagramDispatcherRunning) {
      throw new Error('Cannot switch to worker datagram mode: main dispatcher already reading');
    }
    this.datagramMode = 'worker';
    return this.transport.datagrams.readable;
  }

  /**
   * Revert to main datagram mode if worker setup failed before locking the
   * stream (so a later registerDatagramHandler starts the main dispatcher).
   */
  revertToMainDatagramMode(): void {
    this.datagramMode = 'main';
  }

  /**
   * Feed a parsed datagram forwarded from the receive Worker through the normal
   * dispatch path (handlers map + SUBSCRIBE_OK pending buffer). The worker only
   * forwards non-audio tracks; audio is decoded in the worker and never arrives
   * here.
   */
  ingestForwardedDatagram(trackAlias: number, payload: Uint8Array, groupId: bigint, objectId: bigint): void {
    this.router.ingest({ trackAlias, payload, groupId, objectId });
  }

  /**
   * Register a datagram handler for a specific track alias. Starts the dispatcher
   * on first registration (transport concern); the router drains any datagrams
   * that arrived for this alias before registration (the SUBSCRIBE_OK race).
   */
  registerDatagramHandler(trackAlias: number, handler: DatagramHandler): void {
    if (!this.datagramDispatcherRunning) {
      this.startDatagramDispatcher();
    }
    this.router.register(trackAlias, handler);
  }

  /** Unregister a datagram handler; the router discards any still-buffered datagrams for it. */
  unregisterDatagramHandler(trackAlias: number): void {
    this.router.unregister(trackAlias);
  }

  /**
   * Number of buffered pre-handler datagrams currently held. Exposed for tests and
   * diagnostics; production callers shouldn't need it.
   */
  getPendingDatagramCount(): number {
    return this.router.pendingCount();
  }

  /**
   * Start the single datagram reader loop that dispatches to handlers by track alias
   */
  private startDatagramDispatcher(): void {
    if (this.datagramMode === 'worker') {
      // The receive Worker owns the read loop; main must not lock the stream.
      return;
    }
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
            this.router.ingest(parsed);
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
