/**
 * Panaudia MOQ Client
 *
 * Main client class for connecting to the Panaudia spatial audio mixer
 * via Media over QUIC (MOQ) transport.
 */

import { MoqConnection, isWebTransportSupported } from './connection.js';
import {
  PanaudiaConfig,
  ConnectionState,
  ClientEventType,
  ClientEventHandler,
  ErrorEvent,
  StateChangeEvent,
  MoqRole,
  MoqFilterType,
  MoqMessageType,
  Position,
  Rotation,
  Vec3,
  generateTrackNamespace,
  PanaudiaTrackType,
  WebTransportOptions,
} from './types.js';
import {
  webglToAmbisonicPosition,
  webglToAmbisonicRotation,
  ambisonicToWebglPosition,
  ambisonicToWebglRotation,
} from '../shared/coordinates.js';
import {
  buildClientSetup,
  buildSubscribe,
  buildAnnounce,
  parseServerSetup,
  parseSubscribeOk,
  parseSubscribeError,
  parseAnnounceOk,
  parseAnnounceError,
  MOQ_TRANSPORT_VERSION,
  MessageBuilder,
  wrapWithLengthFrame,
} from './moq-transport.js';
import {
  WebTransportNotSupportedError,
  AuthenticationError,
  JwtParseError,
  ProtocolError,
  SubscriptionError,
  AnnouncementError,
  InvalidStateError,
  getMoqErrorMessage,
  MoqClientError,
} from './errors.js';
import {
  AudioPublisher,
  AudioPublisherState,
  AudioPublisherConfig,
} from './audio-publisher.js';
import { AudioTrackPublisher, StateTrackPublisher } from './track-publisher.js';
import { entityInfo3ToBytes, createEntityInfo3 } from '../shared/encoding.js';
import { AudioSubscriber, AudioSubscriberStats } from './audio-subscriber.js';
import { AudioPlayer, AudioPlayerState, AudioPlayerConfig, AudioPlayerStats } from './audio-player.js';
import { StateSubscriber, EntityState, EntityStateHandler } from './state-subscriber.js';
import { ControlTrackPublisher } from './control-publisher.js';
import { AttributesSubscriber, EntityAttributes, AttributesHandler } from './attributes-subscriber.js';

/**
 * Event emitter for client events
 */
class EventEmitter {
  private handlers: Map<string, Set<ClientEventHandler>> = new Map();

  on<T>(event: ClientEventType, handler: ClientEventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as ClientEventHandler);
  }

  off<T>(event: ClientEventType, handler: ClientEventHandler<T>): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler as ClientEventHandler);
    }
  }

  emit<T>(event: ClientEventType, data?: T): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
  }
}

/**
 * MOQ Session handler for control stream communication
 */
class MoqSession {
  private controlStream: WebTransportBidirectionalStream | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private readBuffer: Uint8Array = new Uint8Array(0);

  private nextSubscribeId = 1;
  private nextTrackAlias = 1;
  private nextAnnounceRequestId = 2; // Client uses even IDs for announces (to avoid collisions with server)

  // Track state
  private subscriptions: Map<number, { namespace: string[]; trackName: string; alias: number }> = new Map();
  private announcements: Map<string, { namespace: string[] }> = new Map();
  private incomingSubscriptions: Map<number, { trackAlias: number; namespace: string[] }> = new Map();

  // Callbacks for when server subscribes to our tracks
  private onIncomingSubscribeCallback: ((namespace: string[], trackAlias: number) => void) | null = null;

  private readonly debug: boolean;

  constructor(private readonly connection: MoqConnection, debug: boolean = false) {
    this.debug = debug;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[MOQ]', ...args);
    }
  }

  /**
   * Set callback for when server subscribes to one of our announced tracks
   */
  onIncomingSubscribe(callback: (namespace: string[], trackAlias: number) => void): void {
    this.onIncomingSubscribeCallback = callback;
  }

  /**
   * Initialize the MOQ session over the control stream
   * @param role - The MOQ role (publisher, subscriber, or pubsub)
   * @param path - Optional path parameter
   * @param maxSubscribeId - Max number of requests server can send to client (default: 100)
   */
  async initialize(role: MoqRole, path?: string, maxSubscribeId: number = 100): Promise<void> {
    this.log('Creating control stream...');
    // Create bidirectional control stream
    this.controlStream = await this.connection.createControlStream();
    this.writer = this.controlStream.writable.getWriter();
    this.reader = this.controlStream.readable.getReader();
    this.log('Control stream created, sending CLIENT_SETUP...');

    // Send CLIENT_SETUP with maxSubscribeId to allow server to send requests to us
    const setupMsg = buildClientSetup([MOQ_TRANSPORT_VERSION], role, path, maxSubscribeId);
    this.log('CLIENT_SETUP message size:', setupMsg.length, 'bytes');
    this.log('CLIENT_SETUP hex:', Array.from(setupMsg).map(b => b.toString(16).padStart(2, '0')).join(' '));
    await this.writer.write(setupMsg);
    this.log('CLIENT_SETUP sent, waiting for SERVER_SETUP...');

    // Wait for SERVER_SETUP response (with proper length framing)
    const { type, content } = await this.readFramedMessage();
    this.log('Received response type: 0x' + type.toString(16) + ', content size:', content.length, 'bytes');

    if (type !== MoqMessageType.SERVER_SETUP) {
      throw new ProtocolError(
        `Expected SERVER_SETUP (0x41), got message type 0x${type.toString(16)}`,
        type
      );
    }

    // Parse content directly (type and length already stripped)
    const serverSetup = parseServerSetup(content, 0);
    this.log('Session established, server version:', serverSetup.selectedVersion.toString(16));
  }

  /**
   * Subscribe to a track with JWT authorization
   */
  async subscribe(namespace: string[], trackName: string, authorization?: string): Promise<number> {
    const subscribeId = this.nextSubscribeId++;

    const subscribeMsg = buildSubscribe({
      subscribeId,
      namespace,
      trackName,
      filterType: MoqFilterType.LATEST_GROUP,
      authorization,
    });

    this.log('SUBSCRIBE message size:', subscribeMsg.length, 'bytes');
    await this.writer!.write(subscribeMsg);

    // Wait for SUBSCRIBE_OK or SUBSCRIBE_ERROR
    // The server may send other messages (like ANNOUNCE) before the response,
    // so we need to handle/skip those while waiting
    const { type, content } = await this.waitForMessage([
      MoqMessageType.SUBSCRIBE_OK,
      MoqMessageType.SUBSCRIBE_ERROR,
    ]);

    if (type === MoqMessageType.SUBSCRIBE_OK) {
      const ok = parseSubscribeOk(content, 0);
      // Use the server-assigned trackAlias from SUBSCRIBE_OK, not our local one.
      // The server uses this alias when sending datagrams for this subscription.
      this.log('Subscribed successfully, subscribeId:', ok.subscribeId, 'trackAlias:', ok.trackAlias);
      this.subscriptions.set(subscribeId, { namespace, trackName, alias: ok.trackAlias });
      return subscribeId;
    } else if (type === MoqMessageType.SUBSCRIBE_ERROR) {
      const error = parseSubscribeError(content, 0);
      const errorMessage = `${error.reasonPhrase} (${getMoqErrorMessage(error.errorCode)})`;

      // Check if this is an authentication error
      if (error.errorCode === 0x02 || error.errorCode === 0x403) {
        throw new AuthenticationError(errorMessage, error.errorCode, { namespace, trackName });
      }

      throw new SubscriptionError(errorMessage, error.errorCode, namespace);
    } else {
      throw new ProtocolError(
        `Expected SUBSCRIBE_OK or SUBSCRIBE_ERROR, got message type 0x${type.toString(16)}`,
        type
      );
    }
  }

  /**
   * Wait for a specific message type, handling other messages that arrive first
   */
  private async waitForMessage(expectedTypes: number[]): Promise<{ type: number; content: Uint8Array }> {
    const maxAttempts = 20; // Prevent infinite loops
    for (let i = 0; i < maxAttempts; i++) {
      const { type, content } = await this.readFramedMessage();

      if (expectedTypes.includes(type)) {
        return { type, content };
      }

      // Handle other message types that may arrive
      this.log(`Received unexpected message type 0x${type.toString(16)} while waiting, handling it`);
      await this.handleUnexpectedMessage(type, content);
    }

    throw new ProtocolError(
      `Timeout waiting for message types: ${expectedTypes.map(t => '0x' + t.toString(16)).join(', ')}`,
      0
    );
  }

  /**
   * Handle messages that arrive when we're waiting for something else
   */
  private async handleUnexpectedMessage(type: number, content: Uint8Array): Promise<void> {
    switch (type) {
      case MoqMessageType.ANNOUNCE:
        // Server is announcing a track to us - respond with ANNOUNCE_OK
        this.log('Received ANNOUNCE from server, sending ANNOUNCE_OK');
        await this.sendAnnounceOk(content);
        break;

      case 0x11: // SUBSCRIBE_ANNOUNCES
        // Server wants to subscribe to our announcements - respond with OK
        this.log('Received SUBSCRIBE_ANNOUNCES from server, sending OK');
        await this.sendSubscribeAnnouncesOk(content);
        break;

      case MoqMessageType.SUBSCRIBE:
        // Server wants to subscribe to one of our tracks - accept it
        this.log('Received SUBSCRIBE from server, sending SUBSCRIBE_OK');
        await this.handleIncomingSubscribe(content);
        break;

      default:
        // Log and skip unknown messages
        this.log(`Skipping unhandled message type 0x${type.toString(16)}`);
    }
  }

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
  private async handleIncomingSubscribe(content: Uint8Array): Promise<void> {
    let pos = 0;

    // Request ID (varint)
    const requestIdByte = content[pos]!;
    let requestId: number;
    if (requestIdByte < 64) {
      requestId = requestIdByte;
      pos += 1;
    } else if ((requestIdByte & 0xc0) === 0x40) {
      requestId = ((requestIdByte & 0x3f) << 8) | content[pos + 1]!;
      pos += 2;
    } else {
      requestId = requestIdByte & 0x3f;
      pos += 1;
    }

    // Parse namespace (directly after RequestID — no TrackAlias in SUBSCRIBE)
    const namespace = this.parseNamespaceFromContent(content, pos);

    // Assign a local TrackAlias for this subscription. The server will use
    // this alias to identify our datagrams for this track.
    const trackAlias = this.nextTrackAlias++;
    this.log(`Server subscribing to: ${namespace.join('/')}, assigning trackAlias=${trackAlias}`);

    // Send SUBSCRIBE_OK with TrackAlias
    // Format: RequestID, TrackAlias, Expires, GroupOrder(1 byte), ContentExists(1 byte), Parameters
    const builder = new MessageBuilder();
    builder.writeVarint(requestId);    // Request ID
    builder.writeVarint(trackAlias);   // Track Alias (assigned by us)
    builder.writeVarint(0);            // Expires (0 = no expiry)
    builder.writeRaw(new Uint8Array([0x01])); // Group order (1 byte: ascending)
    builder.writeRaw(new Uint8Array([0x00])); // Content exists (1 byte: false)
    builder.writeVarint(0);            // Number of parameters

    const msg = wrapWithLengthFrame(MoqMessageType.SUBSCRIBE_OK, builder.build());
    await this.writer!.write(msg);
    this.log('Sent SUBSCRIBE_OK for requestId:', requestId, 'trackAlias:', trackAlias);

    // Store the subscription so we know the track alias to use when publishing
    this.incomingSubscriptions.set(requestId, { trackAlias, namespace });

    // Notify callback if registered
    if (this.onIncomingSubscribeCallback) {
      this.onIncomingSubscribeCallback(namespace, trackAlias);
    }
  }

  /**
   * Get track alias for an incoming subscription by namespace
   */
  getIncomingTrackAlias(namespacePrefix: string): number | undefined {
    for (const [, sub] of this.incomingSubscriptions) {
      if (sub.namespace.join('/').startsWith(namespacePrefix)) {
        return sub.trackAlias;
      }
    }
    return undefined;
  }

  /**
   * Parse namespace from content starting at given position
   */
  private parseNamespaceFromContent(content: Uint8Array, startPos: number): string[] {
    let pos = startPos;
    const namespace: string[] = [];

    if (pos >= content.length) return namespace;

    // Read namespace tuple length
    const firstByte = content[pos]!;
    let nsLength: number;

    if (firstByte < 64) {
      nsLength = firstByte;
      pos += 1;
    } else if ((firstByte & 0xc0) === 0x40) {
      nsLength = ((firstByte & 0x3f) << 8) | content[pos + 1]!;
      pos += 2;
    } else {
      nsLength = firstByte & 0x3f;
      pos += 1;
    }

    // Read each namespace part
    for (let i = 0; i < nsLength && pos < content.length; i++) {
      const partLenByte = content[pos]!;
      let partLen: number;

      if (partLenByte < 64) {
        partLen = partLenByte;
        pos += 1;
      } else if ((partLenByte & 0xc0) === 0x40) {
        partLen = ((partLenByte & 0x3f) << 8) | content[pos + 1]!;
        pos += 2;
      } else {
        partLen = partLenByte & 0x3f;
        pos += 1;
      }

      if (pos + partLen <= content.length) {
        const part = new TextDecoder().decode(content.slice(pos, pos + partLen));
        namespace.push(part);
        pos += partLen;
      }
    }

    return namespace;
  }

  /**
   * Send ANNOUNCE_OK response
   */
  private async sendAnnounceOk(announceContent: Uint8Array): Promise<void> {
    // Parse the RequestID from the ANNOUNCE message (first varint)
    const requestId = this.parseRequestId(announceContent);
    this.log('Sending ANNOUNCE_OK for requestId:', requestId);

    // Build ANNOUNCE_OK: just the RequestID (per moqtransport v0.5.0)
    const builder = new MessageBuilder();
    builder.writeVarint(requestId);

    const msg = wrapWithLengthFrame(MoqMessageType.ANNOUNCE_OK, builder.build());
    this.log('ANNOUNCE_OK message size:', msg.length, 'bytes');
    await this.writer!.write(msg);
  }

  /**
   * Send SUBSCRIBE_ANNOUNCES_OK response
   */
  private async sendSubscribeAnnouncesOk(subscribeAnnouncesContent: Uint8Array): Promise<void> {
    // Parse the RequestID from the message (first varint)
    const requestId = this.parseRequestId(subscribeAnnouncesContent);
    this.log('Sending SUBSCRIBE_ANNOUNCES_OK for requestId:', requestId);

    // Build SUBSCRIBE_ANNOUNCES_OK (0x12): just the RequestID (per moqtransport v0.5.0)
    const builder = new MessageBuilder();
    builder.writeVarint(requestId);

    const msg = wrapWithLengthFrame(0x12, builder.build()); // 0x12 = SUBSCRIBE_ANNOUNCES_OK
    await this.writer!.write(msg);
  }

  /**
   * Parse RequestID (first varint) from message content
   */
  private parseRequestId(content: Uint8Array): number {
    const firstByte = content[0]!;
    if (firstByte < 64) {
      return firstByte;
    } else if ((firstByte & 0xc0) === 0x40) {
      return ((firstByte & 0x3f) << 8) | content[1]!;
    } else if ((firstByte & 0xc0) === 0x80) {
      return ((firstByte & 0x3f) << 24) | (content[1]! << 16) | (content[2]! << 8) | content[3]!;
    } else {
      // 8-byte varint - for simplicity, just return the lower 32 bits
      return (content[4]! << 24) | (content[5]! << 16) | (content[6]! << 8) | content[7]!;
    }
  }

  /**
   * Announce a track namespace
   */
  async announce(namespace: string[], authorization?: string): Promise<void> {
    const requestId = this.nextAnnounceRequestId;
    this.nextAnnounceRequestId += 2; // Increment by 2 to stay in client's ID space

    const parameters = new Map<number, Uint8Array>();
    if (authorization) {
      // Add authorization as parameter 0x03 (AuthorizationTokenParameterKey per moqtransport v0.5.1)
      const encoder = new TextEncoder();
      parameters.set(0x03, encoder.encode(authorization));
    }
    const announceMsg = buildAnnounce({ requestId, namespace, parameters: parameters.size > 0 ? parameters : undefined });
    this.log('ANNOUNCE message size:', announceMsg.length, 'bytes, requestId:', requestId);
    await this.writer!.write(announceMsg);

    // Wait for ANNOUNCE_OK or ANNOUNCE_ERROR
    // Server may send other messages (like SUBSCRIBE) before the response
    const { type, content } = await this.waitForMessage([
      MoqMessageType.ANNOUNCE_OK,
      MoqMessageType.ANNOUNCE_ERROR,
    ]);

    if (type === MoqMessageType.ANNOUNCE_OK) {
      const ok = parseAnnounceOk(content, 0);
      // moqtransport v0.5.0: ANNOUNCE_OK only contains RequestID, not namespace
      // We use the namespace from our local state
      const nsKey = namespace.join('/');
      this.announcements.set(nsKey, { namespace });
      this.log('Announced successfully:', nsKey, 'requestId:', ok.requestId);
    } else if (type === MoqMessageType.ANNOUNCE_ERROR) {
      const error = parseAnnounceError(content, 0);
      const errorMessage = `${error.reasonPhrase} (${getMoqErrorMessage(error.errorCode)})`;
      throw new AnnouncementError(errorMessage, error.errorCode, namespace);
    } else {
      throw new ProtocolError(
        `Expected ANNOUNCE_OK or ANNOUNCE_ERROR, got message type 0x${type.toString(16)}`,
        type
      );
    }
  }

  /**
   * Get track alias for a subscription
   */
  getTrackAlias(subscribeId: number): number | undefined {
    return this.subscriptions.get(subscribeId)?.alias;
  }

  /**
   * Start background message processing loop
   * This handles messages that arrive after initial connection setup
   */
  startMessageLoop(): void {
    this.processMessages().catch((error) => {
      this.log('Message loop ended:', error.message);
    });
  }

  /**
   * Background message processing
   */
  private async processMessages(): Promise<void> {
    this.log('Starting background message processing loop');
    while (this.reader) {
      try {
        const { type, content } = await this.readFramedMessage();
        this.log(`Background received message type 0x${type.toString(16)}`);
        await this.handleUnexpectedMessage(type, content);
      } catch (error) {
        // Stream closed or error - exit loop
        this.log('Message processing stopped:', (error as Error).message);
        break;
      }
    }
  }

  /**
   * Close the session
   */
  async close(): Promise<void> {
    if (this.writer) {
      try {
        await this.writer.close();
      } catch {
        // Ignore close errors
      }
      this.writer = null;
    }
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // Ignore cancel errors
      }
      this.reader = null;
    }
    this.controlStream = null;
  }

  /**
   * Read a complete message from the control stream with proper length framing
   * Format: [Type varint] [Length: 2 bytes big-endian] [Content: length bytes]
   * Returns: { type, content } where content is the message body without type/length
   */
  private async readFramedMessage(): Promise<{ type: number; content: Uint8Array }> {
    // Ensure we have enough bytes for the header
    // Minimum: 1 byte type + 2 bytes length = 3 bytes
    while (this.readBuffer.length < 3) {
      const { value, done } = await this.reader!.read();
      if (done) {
        throw new Error('Control stream closed unexpectedly');
      }
      const newBuffer = new Uint8Array(this.readBuffer.length + value.length);
      newBuffer.set(this.readBuffer);
      newBuffer.set(value, this.readBuffer.length);
      this.readBuffer = newBuffer;
    }

    // Parse message type (QUIC varint)
    let typeLength = 1;
    const firstByte = this.readBuffer[0]!;
    const prefix = firstByte >> 6;
    if (prefix === 1) typeLength = 2;
    else if (prefix === 2) typeLength = 4;
    else if (prefix === 3) typeLength = 8;

    // Ensure we have enough bytes for type + 2 byte length
    const headerSize = typeLength + 2;
    while (this.readBuffer.length < headerSize) {
      const { value, done } = await this.reader!.read();
      if (done) {
        throw new Error('Control stream closed unexpectedly');
      }
      const newBuffer = new Uint8Array(this.readBuffer.length + value.length);
      newBuffer.set(this.readBuffer);
      newBuffer.set(value, this.readBuffer.length);
      this.readBuffer = newBuffer;
    }

    // Extract message type
    let type: number;
    if (typeLength === 1) {
      type = firstByte;
    } else if (typeLength === 2) {
      type = ((firstByte & 0x3f) << 8) | this.readBuffer[1]!;
    } else {
      // For simplicity, only handle 1-2 byte varints (covers all MOQ message types)
      throw new Error(`Unsupported varint length: ${typeLength}`);
    }

    // Extract length (2 bytes big-endian)
    const lengthOffset = typeLength;
    const contentLength = (this.readBuffer[lengthOffset]! << 8) | this.readBuffer[lengthOffset + 1]!;
    this.log('readFramedMessage: type=0x' + type.toString(16) + ', contentLength=' + contentLength);

    // Read until we have the full message
    const totalSize = headerSize + contentLength;
    while (this.readBuffer.length < totalSize) {
      const { value, done } = await this.reader!.read();
      if (done) {
        throw new Error('Control stream closed unexpectedly');
      }
      const newBuffer = new Uint8Array(this.readBuffer.length + value.length);
      newBuffer.set(this.readBuffer);
      newBuffer.set(value, this.readBuffer.length);
      this.readBuffer = newBuffer;
    }

    // Extract content
    const content = this.readBuffer.slice(headerSize, totalSize);

    // Remove consumed bytes from buffer
    this.readBuffer = this.readBuffer.slice(totalSize);

    this.log('readFramedMessage: returning type=0x' + type.toString(16) + ', content.length=' + content.length);
    return { type, content };
  }

}

/**
 * Main Panaudia MOQ Client
 *
 * Usage:
 * ```typescript
 * const client = new PanaudiaMoqClient({
 *   serverUrl: 'https://server.example.com:4433',
 *   ticket: 'your-jwt-token',
 * });
 *
 * await client.connect();
 * await client.startMicrophone();
 * await client.startPlayback();
 *
 * client.setPosition({ x: 0.5, y: 0.5, z: 0.5 });
 * ```
 */
export class PanaudiaMoqClient {
  private readonly config: Required<PanaudiaConfig>;
  private readonly events = new EventEmitter();
  private connection: MoqConnection | null = null;
  private session: MoqSession | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;

  // Audio publishing
  private audioPublisher: AudioPublisher | null = null;
  private audioTrackPublisher: AudioTrackPublisher | null = null;

  // State publishing
  private stateTrackPublisher: StateTrackPublisher | null = null;
  private statePublishPending: boolean = false;
  private statePublishThrottleMs: number = 50; // Throttle state updates to 20Hz max
  private lastStatePublishTime: number = 0;

  // Audio playback
  private audioSubscriber: AudioSubscriber | null = null;
  private audioPlayer: AudioPlayer | null = null;

  // State tracking
  private stateSubscriber: StateSubscriber | null = null;

  // Control publishing
  private controlTrackPublisher: ControlTrackPublisher | null = null;
  private controlTrackAlias: number = 3;

  // Attributes tracking
  private attributesSubscriber: AttributesSubscriber | null = null;
  private attributesOutputTrackAlias: number = 0;

  // Track aliases (assigned after announcement/subscription)
  private audioInputTrackAlias: number = 1;
  private stateTrackAlias: number = 2;
  private audioOutputTrackAlias: number = 0; // Assigned by server
  private stateOutputTrackAlias: number = 0; // Assigned by server

  // Node state
  private position: Position;
  private rotation: Rotation;

  constructor(config: PanaudiaConfig) {
    // Validate config
    if (!config.serverUrl) {
      throw new Error('serverUrl is required');
    }
    if (!config.ticket) {
      throw new Error('ticket is required');
    }

    // Extract entity ID from JWT if not provided
    const entityId = config.entityId ?? this.extractEntityIdFromJwt(config.ticket);

    this.config = {
      serverUrl: config.serverUrl,
      ticket: config.ticket,
      entityId,
      initialPosition: config.initialPosition ?? { x: 0.5, y: 0.5, z: 0.5 },
      initialRotation: config.initialRotation ?? { yaw: 0, pitch: 0, roll: 0 },
      debug: config.debug ?? false,
    };

    this.position = { ...this.config.initialPosition };
    this.rotation = { ...this.config.initialRotation };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[MOQ]', ...args);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private logWarn(...args: any[]): void {
    if (this.config.debug) {
      console.warn('[MOQ]', ...args);
    }
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get the node ID
   */
  getEntityId(): string {
    return this.config.entityId;
  }

  /**
   * Register an event handler
   */
  on<T>(event: ClientEventType, handler: ClientEventHandler<T>): void {
    this.events.on(event, handler);
  }

  /**
   * Remove an event handler
   */
  off<T>(event: ClientEventType, handler: ClientEventHandler<T>): void {
    this.events.off(event, handler);
  }

  /**
   * Connect to the MOQ server
   */
  async connect(options?: WebTransportOptions): Promise<void> {
    if (!isWebTransportSupported()) {
      throw new WebTransportNotSupportedError();
    }

    if (this.state !== ConnectionState.DISCONNECTED) {
      throw new InvalidStateError('disconnected', this.state);
    }

    this.setState(ConnectionState.CONNECTING);

    try {
      // Create and connect WebTransport
      this.connection = new MoqConnection(this.config.serverUrl);
      this.connection.setHandlers({
        onStateChange: (connState, error) => {
          if (connState === ConnectionState.ERROR) {
            this.handleError('connection_error', error?.message ?? 'Connection failed');
          } else if (connState === ConnectionState.DISCONNECTED) {
            this.handleDisconnect();
          }
        },
      });

      await this.connection.connect(options);
      this.setState(ConnectionState.CONNECTED);
      this.log('WebTransport connected, initializing MOQ session...');

      // Initialize MOQ session
      this.session = new MoqSession(this.connection, this.config.debug);

      // Register callback for incoming subscriptions BEFORE any subscribes,
      // because server SUBSCRIBE messages can arrive during our subscribe calls
      this.session.onIncomingSubscribe((namespace, trackAlias) => {
        const nsPath = namespace.join('/');
        this.log(`Server subscribed to ${nsPath} with trackAlias=${trackAlias}`);

        // Check if this is our audio input track
        if (nsPath.includes('in/audio')) {
          this.audioInputTrackAlias = trackAlias;
          this.log(`Updated audioInputTrackAlias to ${trackAlias}`);

          // If audio publisher already exists, update its track alias
          if (this.audioTrackPublisher) {
            this.audioTrackPublisher.detach();
            this.audioTrackPublisher = new AudioTrackPublisher({
              trackAlias: trackAlias,
              publisherPriority: 0,
            });
            this.audioTrackPublisher.attach(this.connection!);
            this.audioTrackPublisher.startSession();
            this.log(`Recreated audioTrackPublisher with trackAlias=${trackAlias}`);
          }
        }

        // Check if this is our state track (but not "out/state")
        if (nsPath.includes('state/') && !nsPath.includes('out/state')) {
          this.stateTrackAlias = trackAlias;
          this.log(`Updated stateTrackAlias to ${this.stateTrackAlias}`);

          // Recreate state publisher with new alias
          if (this.stateTrackPublisher) {
            this.stateTrackPublisher.detach();
          }
          this.stateTrackPublisher = new StateTrackPublisher({
            trackAlias: this.stateTrackAlias,
            publisherPriority: 1,
          });
          this.stateTrackPublisher.attach(this.connection!);
          this.log(`Recreated stateTrackPublisher with trackAlias=${this.stateTrackAlias}`);
        }

        // Check if this is our control track
        if (nsPath.includes('in/control')) {
          this.controlTrackAlias = trackAlias;
          this.log(`Updated controlTrackAlias to ${this.controlTrackAlias}`);

          if (this.controlTrackPublisher) {
            this.controlTrackPublisher.detach();
          }
          this.controlTrackPublisher = new ControlTrackPublisher({
            trackAlias: this.controlTrackAlias,
            publisherPriority: 2,
          });
          this.controlTrackPublisher.attach(this.connection!);
          this.log(`Created controlTrackPublisher with trackAlias=${this.controlTrackAlias}`);
        }
      });

      await this.session.initialize(MoqRole.PUBSUB);
      this.log('Session initialized, subscribing to output track...');

      // Subscribe to output audio track with JWT authorization
      // This is where authentication happens
      const outputNamespace = generateTrackNamespace(PanaudiaTrackType.AUDIO_OUTPUT, this.config.entityId);
      this.log('Subscribing to:', outputNamespace.join('/'));
      const subscribeId = await this.session.subscribe(outputNamespace, '', this.config.ticket);
      this.log('Subscribe successful, id:', subscribeId);
      this.audioOutputTrackAlias = this.session.getTrackAlias(subscribeId) ?? 0;

      // Subscribe to state output track
      const stateOutputNamespace = generateTrackNamespace(PanaudiaTrackType.STATE_OUTPUT, this.config.entityId);
      this.log('Subscribing to state output:', stateOutputNamespace.join('/'));
      const stateSubscribeId = await this.session.subscribe(stateOutputNamespace, '');
      this.stateOutputTrackAlias = this.session.getTrackAlias(stateSubscribeId) ?? 0;
      this.log('State output subscribed, trackAlias:', this.stateOutputTrackAlias);

      // Set up state subscriber
      this.stateSubscriber = new StateSubscriber();
      this.stateSubscriber.attach(this.connection, this.stateOutputTrackAlias);
      this.stateSubscriber.onState((state) => {
        this.events.emit<EntityState>('entityState', state);
      });
      this.stateSubscriber.start();

      // Subscribe to attributes output track
      const attributesOutputNamespace = generateTrackNamespace(PanaudiaTrackType.ATTRIBUTES_OUTPUT, this.config.entityId);
      this.log('Subscribing to attributes output:', attributesOutputNamespace.join('/'));
      const attrsSubscribeId = await this.session.subscribe(attributesOutputNamespace, '');
      this.attributesOutputTrackAlias = this.session.getTrackAlias(attrsSubscribeId) ?? 0;
      this.log('Attributes output subscribed, trackAlias:', this.attributesOutputTrackAlias);

      // Set up attributes subscriber
      this.attributesSubscriber = new AttributesSubscriber();
      this.attributesSubscriber.attach(this.connection, this.attributesOutputTrackAlias);
      this.attributesSubscriber.onAttributes((attrs) => {
        this.events.emit<EntityAttributes>('attributes', attrs);
      });
      this.attributesSubscriber.start();

      this.setState(ConnectionState.AUTHENTICATED);
      this.events.emit('authenticated');

      // Announce input tracks
      const audioInputNamespace = generateTrackNamespace(PanaudiaTrackType.AUDIO_INPUT, this.config.entityId);
      const stateNamespace = generateTrackNamespace(PanaudiaTrackType.STATE, this.config.entityId);
      const controlNamespace = generateTrackNamespace(PanaudiaTrackType.CONTROL_INPUT, this.config.entityId);

      await this.session.announce(audioInputNamespace, this.config.ticket);
      await this.session.announce(stateNamespace, this.config.ticket);
      await this.session.announce(controlNamespace, this.config.ticket);

      // Note: Track publishers will be created in the onIncomingSubscribe callback
      // when the server subscribes to our announced tracks

      // Start background message processing to handle server's subscriptions
      // that may arrive after connection setup
      this.session.startMessageLoop();

      this.events.emit('connected');

      // Publish initial state (will be deferred if no subscriber yet)
      await this.publishState();
    } catch (error) {
      this.setState(ConnectionState.ERROR);

      // Extract error details
      let code = 'connect_failed';
      let message = 'Unknown error';
      let details: unknown = undefined;

      if (error instanceof AuthenticationError) {
        code = error.code;
        message = error.message;
        details = { moqErrorCode: error.moqErrorCode };
      } else if (error instanceof ProtocolError) {
        code = error.code;
        message = error.message;
        details = { moqErrorCode: error.moqErrorCode };
      } else if (error instanceof Error) {
        message = error.message;
        // Check for common WebTransport errors
        if (message.includes('net::ERR_')) {
          code = 'network_error';
        } else if (message.includes('certificate')) {
          code = 'certificate_error';
          message = `Certificate error: ${message}. For local testing, use a trusted certificate or add an exception.`;
        }
      }

      this.events.emit<ErrorEvent>('error', { code, message, details });
      throw error;
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (this.stateSubscriber) {
      this.stateSubscriber.stop();
      this.stateSubscriber = null;
    }

    if (this.attributesSubscriber) {
      this.attributesSubscriber.stop();
      this.attributesSubscriber = null;
    }

    if (this.session) {
      await this.session.close();
      this.session = null;
    }

    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    this.setState(ConnectionState.DISCONNECTED);
    this.events.emit('disconnected');
  }

  /**
   * Update position (in Panaudia internal coordinates, 0-1 range)
   */
  setPosition(position: Position): void {
    this.position = { ...position };
    this.scheduleStatePublish();
  }

  /**
   * Update rotation (in degrees)
   */
  setRotation(rotation: Rotation): void {
    this.rotation = { ...rotation };
    this.scheduleStatePublish();
  }


  /**
   * Get current position
   */
  getPosition(): Position {
    return { ...this.position };
  }

  /**
   * Get current rotation
   */
  getRotation(): Rotation {
    return { ...this.rotation };
  }


  /**
   * Update position using WebGL coordinates (-1 to 1 range, Three.js convention)
   */
  setPositionWebGL(pos: Vec3): void {
    this.position = webglToAmbisonicPosition(pos);
    this.scheduleStatePublish();
  }

  /**
   * Update rotation using WebGL Euler angles (XYZ order, radians)
   */
  setRotationWebGL(rot: Vec3): void {
    this.rotation = webglToAmbisonicRotation(rot);
    this.scheduleStatePublish();
  }

  /**
   * Get current position in WebGL coordinates
   */
  getPositionWebGL(): Vec3 {
    return ambisonicToWebglPosition(this.position);
  }

  /**
   * Get current rotation in WebGL Euler angles (XYZ order, radians)
   */
  getRotationWebGL(): Vec3 {
    return ambisonicToWebglRotation(this.rotation);
  }

  /**
   * Get all known entities (not gone)
   */
  getEntities(): Map<string, EntityState> {
    return this.stateSubscriber?.getEntities() ?? new Map();
  }

  /**
   * Get a specific entity by UUID
   */
  getEntity(uuid: string): EntityState | undefined {
    return this.stateSubscriber?.getEntity(uuid);
  }

  /**
   * Register a handler for entity state updates (Panaudia coordinates)
   */
  onEntityState(handler: EntityStateHandler): void {
    this.events.on('entityState', handler as ClientEventHandler);
  }

  /**
   * Get all known nodes and their attributes
   */
  getKnownEntities(): Map<string, EntityAttributes> {
    return this.attributesSubscriber?.getKnownEntities() ?? new Map();
  }

  /**
   * Register a handler for attribute updates
   */
  onAttributes(handler: AttributesHandler): void {
    this.events.on('attributes', handler as ClientEventHandler);
  }

  /**
   * Mute a remote entity (they will be silent in your mix)
   */
  async mute(entityId: string): Promise<void> {
    if (!this.controlTrackPublisher) {
      this.logWarn('Control publisher not ready, cannot mute');
      return;
    }
    await this.controlTrackPublisher.publishControlMessage({
      type: 'mute',
      message: { node: entityId },
    });
  }

  /**
   * Unmute a remote entity
   */
  async unmute(entityId: string): Promise<void> {
    if (!this.controlTrackPublisher) {
      this.logWarn('Control publisher not ready, cannot unmute');
      return;
    }
    await this.controlTrackPublisher.publishControlMessage({
      type: 'unmute',
      message: { node: entityId },
    });
  }

  /**
   * Start capturing and publishing microphone audio
   *
   * @param config - Optional audio configuration
   */
  async startMicrophone(config?: AudioPublisherConfig): Promise<void> {
    if (this.state !== ConnectionState.CONNECTED && this.state !== ConnectionState.AUTHENTICATED) {
      throw new InvalidStateError('connected or authenticated', this.state);
    }

    if (!this.connection) {
      throw new MoqClientError('No connection available', 'NOT_CONNECTED');
    }

    // Create audio publisher if not exists
    if (!this.audioPublisher) {
      this.audioPublisher = new AudioPublisher({ ...config, debug: this.config.debug });
    }

    // Create track publisher for audio input
    if (!this.audioTrackPublisher) {
      this.audioTrackPublisher = new AudioTrackPublisher({
        trackAlias: this.audioInputTrackAlias,
        publisherPriority: 0, // High priority for audio
      });
      this.audioTrackPublisher.attach(this.connection);
    }

    // Initialize audio publisher (requests microphone permission)
    await this.audioPublisher.initialize();

    // Set up frame handler to publish audio frames
    this.audioPublisher.onFrame((frame) => {
      // Skip encoder warmup frames (WebCodecs produces tiny frames before stabilising)
      if (frame.data.length < 10) return;

      if (this.audioTrackPublisher && this.state === ConnectionState.AUTHENTICATED) {
        this.audioTrackPublisher.publishAudioFrame(frame.data, frame.timestamp)
          .catch((error) => {
            console.error('Failed to publish audio frame:', error);
          });
      }
    });

    // Start recording
    this.audioTrackPublisher.startSession();
    this.audioPublisher.start();

    this.log('Microphone started');
  }

  /**
   * Stop capturing microphone audio
   */
  stopMicrophone(): void {
    if (this.audioPublisher) {
      this.audioPublisher.stop();
      this.log('Microphone stopped');
    }
  }

  /**
   * Check if microphone is currently recording
   */
  isMicrophoneActive(): boolean {
    return this.audioPublisher?.getState() === AudioPublisherState.RECORDING;
  }

  /**
   * Pause microphone recording
   */
  pauseMicrophone(): void {
    this.audioPublisher?.pause();
  }

  /**
   * Resume microphone recording
   */
  resumeMicrophone(): void {
    this.audioPublisher?.resume();
  }

  /**
   * Publish the current state immediately
   *
   * This sends the current position, rotation, and volume to the server.
   */
  async publishState(): Promise<void> {
    if (!this.stateTrackPublisher || this.state !== ConnectionState.AUTHENTICATED) {
      return;
    }

    try {
      const entityInfo = createEntityInfo3(
        this.config.entityId,
        this.position,
        this.rotation,
        0
      );
      const stateBytes = entityInfo3ToBytes(entityInfo);
      await this.stateTrackPublisher.publishState(stateBytes);
      this.lastStatePublishTime = Date.now();
    } catch (error) {
      console.error('Failed to publish state:', error);
    }
  }

  /**
   * Configure state update throttling
   *
   * @param throttleMs - Minimum milliseconds between state updates (default: 50ms = 20Hz)
   */
  setStateThrottle(throttleMs: number): void {
    this.statePublishThrottleMs = Math.max(0, throttleMs);
  }

  /**
   * Start receiving and playing audio from the server
   *
   * @param config - Optional audio player configuration
   */
  async startPlayback(config?: AudioPlayerConfig): Promise<void> {
    if (this.state !== ConnectionState.CONNECTED && this.state !== ConnectionState.AUTHENTICATED) {
      throw new InvalidStateError('connected or authenticated', this.state);
    }

    if (!this.connection) {
      throw new MoqClientError('No connection available', 'NOT_CONNECTED');
    }

    // Create audio player if not exists
    if (!this.audioPlayer) {
      this.audioPlayer = new AudioPlayer({ ...config, debug: this.config.debug });
    }

    // Initialize audio player (creates AudioContext and decoder)
    if (this.audioPlayer.getState() === AudioPlayerState.IDLE) {
      await this.audioPlayer.initialize();
    }

    // Create audio subscriber if not exists
    if (!this.audioSubscriber) {
      this.audioSubscriber = new AudioSubscriber();
    }

    // Attach subscriber to connection
    this.audioSubscriber.attach(this.connection, this.audioOutputTrackAlias);

    // Set up frame handler to decode and play audio
    this.audioSubscriber.onFrame((data, groupId) => {
      if (this.audioPlayer && this.audioPlayer.getState() === AudioPlayerState.PLAYING) {
        try {
          const timestamp = Number(groupId) * 1000;
          this.audioPlayer.decodeFrame(data, timestamp);
        } catch (error) {
          console.error('Failed to decode audio frame:', error);
        }
      }
    });

    // Start playback
    this.audioPlayer.start();
    await this.audioSubscriber.start();

    this.log('Playback started');
  }

  /**
   * Stop receiving and playing audio
   */
  stopPlayback(): void {
    if (this.audioSubscriber) {
      this.audioSubscriber.stop();
    }

    if (this.audioPlayer) {
      this.audioPlayer.stop();
    }

    this.log('Playback stopped');
  }

  /**
   * Check if audio playback is currently active
   */
  isPlaybackActive(): boolean {
    return this.audioPlayer?.getState() === AudioPlayerState.PLAYING;
  }

  /**
   * Pause audio playback
   */
  pausePlayback(): void {
    this.audioPlayer?.pause();
  }

  /**
   * Resume audio playback
   */
  resumePlayback(): void {
    this.audioPlayer?.resume();
  }

  /**
   * Set playback volume.
   * @param volume - Volume level from 0.0 (silent) to 1.0 (full volume).
   */
  setVolume(volume: number): void {
    this.audioPlayer?.setVolume(volume);
  }

  /**
   * Get current playback volume.
   */
  getVolume(): number {
    return this.audioPlayer?.getVolume() ?? 1;
  }

  /**
   * Get audio playback statistics
   */
  getPlaybackStats(): { subscriber: AudioSubscriberStats; player: AudioPlayerStats } | null {
    if (!this.audioSubscriber || !this.audioPlayer) {
      return null;
    }

    return {
      subscriber: this.audioSubscriber.getStats(),
      player: this.audioPlayer.getStats(),
    };
  }

  /**
   * Schedule a state publish with throttling
   *
   * If called multiple times rapidly, only one publish will occur
   * after the throttle delay.
   */
  private scheduleStatePublish(): void {
    if (this.state !== ConnectionState.AUTHENTICATED) {
      return;
    }

    // If already pending, let the scheduled publish handle it
    if (this.statePublishPending) {
      return;
    }

    const now = Date.now();
    const timeSinceLastPublish = now - this.lastStatePublishTime;

    if (timeSinceLastPublish >= this.statePublishThrottleMs) {
      // Enough time has passed, publish immediately
      this.publishState();
    } else {
      // Schedule a publish after the throttle delay
      this.statePublishPending = true;
      const delay = this.statePublishThrottleMs - timeSinceLastPublish;

      setTimeout(() => {
        this.statePublishPending = false;
        if (this.state === ConnectionState.AUTHENTICATED) {
          this.publishState();
        }
      }, delay);
    }
  }

  /**
   * Extract node ID from JWT token
   */
  private extractEntityIdFromJwt(token: string): string {
    try {
      // JWT format: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new JwtParseError('Invalid JWT format: expected 3 parts separated by dots');
      }

      // Decode base64url payload
      const payload = parts[1]!;
      let decoded: string;
      try {
        decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      } catch {
        throw new JwtParseError('Invalid JWT format: payload is not valid base64');
      }

      let claims: Record<string, unknown>;
      try {
        claims = JSON.parse(decoded);
      } catch {
        throw new JwtParseError('Invalid JWT format: payload is not valid JSON');
      }

      // Get entity ID from jti claim (as per Panaudia JWT structure)
      const entityId = (claims.jti as string) || (claims.panaudia as Record<string, unknown>)?.uuid as string;
      if (!entityId) {
        throw new JwtParseError('No entity ID found in JWT: missing jti or panaudia.uuid claim');
      }

      // Validate UUID format (basic check)
      if (typeof entityId !== 'string' || entityId.length < 32) {
        throw new JwtParseError(`Invalid entity ID in JWT: expected UUID string, got ${typeof entityId}`);
      }

      // Return UUID as-is (with hyphens) - Go server expects this format
      return entityId;
    } catch (error) {
      if (error instanceof JwtParseError) {
        throw error;
      }
      throw new JwtParseError(`Failed to extract entity ID from JWT: ${error}`);
    }
  }

  /**
   * Update internal state and emit events
   */
  private setState(newState: ConnectionState): void {
    const previousState = this.state;
    this.state = newState;

    this.events.emit<StateChangeEvent>('statechange', {
      previousState,
      currentState: newState,
    });
  }

  /**
   * Handle connection error
   */
  private handleError(code: string, message: string): void {
    this.setState(ConnectionState.ERROR);
    this.events.emit<ErrorEvent>('error', { code, message });
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.session = null;
    this.connection = null;
    this.setState(ConnectionState.DISCONNECTED);
    this.events.emit('disconnected');
  }
}
