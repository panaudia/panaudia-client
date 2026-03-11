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

export class MoqConnection {
  private transport: WebTransport | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private handlers: ConnectionEventHandlers = {};
  private datagramWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;

  // Datagram dispatcher
  private datagramHandlers: Map<number, DatagramHandler> = new Map();
  private datagramDispatcherRunning: boolean = false;

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
   * Starts the dispatcher on first registration.
   */
  registerDatagramHandler(trackAlias: number, handler: DatagramHandler): void {
    this.datagramHandlers.set(trackAlias, handler);
    if (!this.datagramDispatcherRunning) {
      this.startDatagramDispatcher();
    }
  }

  /**
   * Unregister a datagram handler for a track alias
   */
  unregisterDatagramHandler(trackAlias: number): void {
    this.datagramHandlers.delete(trackAlias);
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
            const handler = this.datagramHandlers.get(parsed.trackAlias);
            if (handler) {
              handler(parsed.payload, parsed.trackAlias, parsed.groupId, parsed.objectId);
            }
            // Datagrams for unknown track aliases are silently dropped
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
