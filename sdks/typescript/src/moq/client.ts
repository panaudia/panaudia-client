/**
 * Panaudia MOQ Client
 *
 * Main client class for connecting to the Panaudia spatial audio mixer
 * via Media over QUIC (MOQ) transport.
 */

import { MoqConnection, isWebTransportSupported } from './connection.js';
import { MoqSession } from './session.js';
import {
  PanaudiaConfig,
  ConnectionState,
  ClientEventType,
  ClientEventHandler,
  ErrorEvent,
  StateChangeEvent,
  MoqRole,
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
  WebTransportNotSupportedError,
  AuthenticationError,
  JwtParseError,
  ProtocolError,
  InvalidStateError,
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
import { createReceiveWorkerUrl, audioReceiveWorkerSupported, type ReceiveWorkerOutbound } from './audio-receive-worker.js';
import { StateSubscriber, EntityState, EntityStateHandler } from './state-subscriber.js';
import { ControlTrackPublisher } from './control-publisher.js';
import {
  AttributesSubscriber,
  EntitySubscriber,
  SpaceSubscriber,
  ValuesHandler,
  RemovedHandler,
  TopicValue,
} from './cache-topic-subscriber.js';
import { CacheMap } from '../shared/cache-map.js';

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
  // Receive Worker: owns the datagram read loop + Opus decode off the main
  // thread (design §11). Null when unsupported/failed ⇒ main-thread fallback.
  private receiveWorker: Worker | null = null;

  // State tracking
  private stateSubscriber: StateSubscriber | null = null;

  // Control publishing
  private controlTrackPublisher: ControlTrackPublisher | null = null;
  private controlTrackAlias: number = 3;

  // Attributes tracking
  private attributesSubscriber: AttributesSubscriber | null = null;
  private attributesOutputTrackAlias: number = 0;
  private readonly attributesCache: CacheMap = new CacheMap();

  // Entity tracking (per-client filtered: only this client's own uuid keys)
  private entitySubscriber: EntitySubscriber | null = null;
  private entityOutputTrackAlias: number = 0;
  private readonly entityCache: CacheMap = new CacheMap();

  // Space tracking (gated server-side by commands.ReadCapSpaceRead).
  // The server only announces the space output track to holders with
  // the cap; if the announce never arrives we leave the subscriber
  // null and never subscribe. Cache is persistent across subscriber
  // lifetimes to support resume HLC on reconnect.
  private spaceSubscriber: SpaceSubscriber | null = null;
  private spaceOutputTrackAlias: number = 0;
  private readonly spaceCache: CacheMap = new CacheMap();

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
    if (!config.ticket && !config.entityId) {
      throw new Error('either ticket or entityId is required');
    }

    // Extract entity ID from JWT if not provided explicitly
    const entityId = config.entityId ?? this.extractEntityIdFromJwt(config.ticket!);

    this.config = {
      serverUrl: config.serverUrl,
      // Empty string means "tokenless" — SUBSCRIBE/ANNOUNCE path treats an
      // empty auth token as absent and skips the Authorization KVP.
      ticket: config.ticket ?? '',
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

      // Move the datagram read loop + Opus decode off the main thread (design
      // §11). MUST happen before any subscriber registers a datagram handler
      // (which would start — and lock — the main-thread dispatcher).
      this.setupReceiveWorker();

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

      // Subscribe to attributes output track (with resume opID if reconnecting)
      const attributesOutputNamespace = generateTrackNamespace(PanaudiaTrackType.ATTRIBUTES_OUTPUT, this.config.entityId);
      const resumeOpId = this.attributesCache.getHighestOpId();
      this.log('Subscribing to attributes output:', attributesOutputNamespace.join('/'),
        resumeOpId > 0n ? `resumeOpId: ${resumeOpId}` : '');
      const attrsSubscribeId = await this.session.subscribe(
        attributesOutputNamespace, '', undefined, resumeOpId > 0n ? resumeOpId : undefined
      );
      this.attributesOutputTrackAlias = this.session.getTrackAlias(attrsSubscribeId) ?? 0;
      this.log('Attributes output subscribed, trackAlias:', this.attributesOutputTrackAlias);

      // Set up attributes subscriber (reuses persistent cache for resume)
      this.attributesSubscriber = new AttributesSubscriber(this.attributesCache);
      this.attributesSubscriber.attach(this.connection, this.attributesOutputTrackAlias);
      this.attributesSubscriber.onValues((values) => {
        this.events.emit('attributes', values);
      });
      this.attributesSubscriber.onRemoved((keys) => {
        this.events.emit('attributesRemoved', keys);
      });
      this.attributesSubscriber.setDebugHandler((info) => {
        this.events.emit('cacheDebug', info);
      });
      this.attributesSubscriber.start();

      // Subscribe to entity output track (per-client filtered).
      // Server-side filter ensures only this client's own uuid keys flow
      // here, so the cache stays small and safe to share globally.
      const entityOutputNamespace = generateTrackNamespace(PanaudiaTrackType.ENTITY_OUTPUT, this.config.entityId);
      const entityResumeOpId = this.entityCache.getHighestOpId();
      this.log('Subscribing to entity output:', entityOutputNamespace.join('/'),
        entityResumeOpId > 0n ? `resumeOpId: ${entityResumeOpId}` : '');
      const entitySubscribeId = await this.session.subscribe(
        entityOutputNamespace, '', undefined, entityResumeOpId > 0n ? entityResumeOpId : undefined
      );
      this.entityOutputTrackAlias = this.session.getTrackAlias(entitySubscribeId) ?? 0;
      this.log('Entity output subscribed, trackAlias:', this.entityOutputTrackAlias);

      this.entitySubscriber = new EntitySubscriber(this.entityCache);
      this.entitySubscriber.attach(this.connection, this.entityOutputTrackAlias);
      this.entitySubscriber.onValues((values) => {
        this.events.emit('entity', values);
      });
      this.entitySubscriber.onRemoved((keys) => {
        this.events.emit('entityRemoved', keys);
      });
      this.entitySubscriber.setDebugHandler((info) => {
        this.events.emit('cacheDebug', info);
      });
      this.entitySubscriber.start();

      // Subscribe to the space output track. Gated server-side on
      // commands.ReadCapSpaceRead — the SUBSCRIBE is accepted by the
      // catch-all path even for unauthorised holders, but the server
      // never installs a publisher for them so no envelopes arrive.
      // Tolerate a subscribe error (the server may also reject) and
      // proceed without space data.
      try {
        const spaceOutputNamespace = generateTrackNamespace(PanaudiaTrackType.SPACE_OUTPUT, this.config.entityId);
        const spaceResumeOpId = this.spaceCache.getHighestOpId();
        this.log('Subscribing to space output:', spaceOutputNamespace.join('/'),
          spaceResumeOpId > 0n ? `resumeOpId: ${spaceResumeOpId}` : '');
        const spaceSubscribeId = await this.session.subscribe(
          spaceOutputNamespace, '', undefined, spaceResumeOpId > 0n ? spaceResumeOpId : undefined,
        );
        this.spaceOutputTrackAlias = this.session.getTrackAlias(spaceSubscribeId) ?? 0;
        this.log('Space output subscribed, trackAlias:', this.spaceOutputTrackAlias);

        this.spaceSubscriber = new SpaceSubscriber(this.spaceCache);
        this.spaceSubscriber.attach(this.connection, this.spaceOutputTrackAlias);
        this.spaceSubscriber.onValues((values) => {
          this.events.emit('space', values);
        });
        this.spaceSubscriber.onRemoved((keys) => {
          this.events.emit('spaceRemoved', keys);
        });
        this.spaceSubscriber.setDebugHandler((info) => {
          this.events.emit('cacheDebug', info);
        });
        this.spaceSubscriber.start();
      } catch (err) {
        this.log('Space output subscribe failed (likely no space.read cap):', err);
      }

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

    if (this.entitySubscriber) {
      this.entitySubscriber.stop();
      this.entitySubscriber = null;
    }

    if (this.spaceSubscriber) {
      this.spaceSubscriber.stop();
      this.spaceSubscriber = null;
    }

    this.teardownReceiveWorker();

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
   * Get the attributes cache containing all current key-value entries.
   */
  getAttributesCache(): ReadonlyMap<string, import('../shared/cache-map.js').CacheEntry> {
    return this.attributesSubscriber?.getAll() ?? new Map();
  }

  /**
   * Register a handler for batches of attribute values.
   * Fired once per envelope with all accepted (added/updated) values.
   * A single-op envelope is delivered as a one-element array.
   */
  onAttributeValues(handler: ValuesHandler): void {
    this.events.on('attributes', ((values: TopicValue[]) => {
      handler(values);
    }) as ClientEventHandler);
  }

  /**
   * Register a handler for batches of attribute key removals (tombstones).
   * Fired once per envelope with all tombstoned keys.
   */
  onAttributeRemoved(handler: RemovedHandler): void {
    this.events.on('attributesRemoved', ((keys: string[]) => {
      handler(keys);
    }) as ClientEventHandler);
  }

  /**
   * Register a handler for batches of entity values. Mirrors
   * `onAttributeValues` but for the per-client entity stream — only ops
   * whose key starts with this client's own uuid arrive here.
   */
  onEntityValues(handler: ValuesHandler): void {
    this.events.on('entity', ((values: TopicValue[]) => {
      handler(values);
    }) as ClientEventHandler);
  }

  /**
   * Register a handler for batches of entity key removals (tombstones).
   */
  onEntityRemoved(handler: RemovedHandler): void {
    this.events.on('entityRemoved', ((keys: string[]) => {
      handler(keys);
    }) as ClientEventHandler);
  }

  /**
   * Invoke a named command from the server's command catalog.
   *
   * Strict-MVC: this fires-and-forgets. The command's effect (if any)
   * arrives later as an echoed entity / attribute op via the existing
   * subscriber path. There is no per-call error response — failed
   * authorisation, unknown command names and bad args all silently
   * drop on the server.
   */
  async command(name: string, args: Record<string, unknown> = {}): Promise<void> {
    if (!this.controlTrackPublisher) {
      this.logWarn('Control publisher not ready, cannot send command');
      return;
    }
    await this.controlTrackPublisher.publishControlMessage({
      type: 'command',
      message: { command: name, args },
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
   * Enable or disable mic capture without tearing down the publisher.
   * Disabled tracks emit silence; the encoder and track publisher stay
   * alive so MOQ frames keep flowing as Opus DTX.
   */
  setMicEnabled(enabled: boolean): void {
    this.audioPublisher?.setMicEnabled(enabled);
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

    // Worker mode (design §11.3): hand the worklet's PCM port + audio config to
    // the receive Worker so it decodes the audio track off-thread straight into
    // the ring. The main-thread audioSubscriber handler above stays registered
    // but is inert (the worker never forwards audio); decodeFrame is a no-op in
    // worker mode. In fallback mode (no worker) the audioSubscriber path drives
    // the main-thread decoder as before.
    if (this.receiveWorker && this.audioPlayer) {
      const handoff = this.audioPlayer.prepareForWorker();
      if (handoff?.mode === 'sab') {
        // SAB shared by reference — NOT in the transfer list (it stays usable here).
        this.receiveWorker.postMessage({
          type: 'audio',
          audioTrackAlias: this.audioOutputTrackAlias,
          decoderConfig: this.audioPlayer.getDecoderConfig(),
          jbufConfig: handoff.jbufConfig,
          sharedStorage: handoff.sharedStorage,
          sharedWritePos: handoff.sharedWritePos,
        });
        this.log(`receive worker decoding audio trackAlias=${this.audioOutputTrackAlias} via SAB ring`);
      } else if (handoff?.mode === 'port') {
        this.receiveWorker.postMessage(
          {
            type: 'audio',
            audioTrackAlias: this.audioOutputTrackAlias,
            decoderConfig: this.audioPlayer.getDecoderConfig(),
            pcmPort: handoff.pcmPort,
          },
          [handoff.pcmPort]
        );
        this.log(`receive worker decoding audio trackAlias=${this.audioOutputTrackAlias} via pcmPort (fallback)`);
      }
    }

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
   * Move datagram receive + Opus decode off the main thread into the receive
   * Worker (design §11). Best-effort: if the worker can't be created the
   * connection stays in main-thread mode and the worklet is fed by the
   * main-thread decoder (fallback, design §11.8) — audio still plays. MUST run
   * after connect() and BEFORE any subscriber starts (which would lock the
   * datagram stream on the main thread).
   */
  private setupReceiveWorker(): void {
    if (!this.connection) return;
    if (!audioReceiveWorkerSupported()) {
      this.log('receive worker unsupported — main-thread decode (fallback)');
      return;
    }
    let url: string | null = null;
    try {
      url = createReceiveWorkerUrl();
      const worker = new Worker(url);
      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data as ReceiveWorkerOutbound;
        if (!msg) return;
        if (msg.type === 'datagram') {
          this.connection?.ingestForwardedDatagram(msg.trackAlias, msg.payload, msg.groupId, msg.objectId);
        } else if (msg.type === 'notice') {
          this.log(`[receive-worker] ${msg.event}${msg.detail ? ': ' + msg.detail : ''}`);
        }
      };
      worker.onerror = (e) => this.log('[receive-worker] error', e.message);
      // Hand the datagram readable to the worker (switches connection to worker
      // mode). Done last so a failure above leaves main mode intact.
      const readable = this.connection.takeDatagramReadableForWorker();
      if (!readable) {
        worker.terminate();
        return;
      }
      worker.postMessage({ type: 'init', readable }, [readable as unknown as Transferable]);
      this.receiveWorker = worker;
      // Loud on purpose (not debug-gated): which producer path is live is the
      // single most important fact when diagnosing crackle (design §11.8).
      console.info('[panaudia] receive worker ACTIVE — datagram read + decode OFF the main thread');
    } catch (err) {
      console.warn(
        '[panaudia] receive worker setup FAILED — falling back to MAIN-THREAD decode ' +
          '(audio will be coupled to main-thread jank). Cause:',
        err
      );
      this.receiveWorker?.terminate();
      this.receiveWorker = null;
      this.connection?.revertToMainDatagramMode();
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }

  /** Stop and release the receive Worker, if any. */
  private teardownReceiveWorker(): void {
    if (this.receiveWorker) {
      try {
        this.receiveWorker.postMessage({ type: 'stop' });
      } catch {
        // worker may already be gone
      }
      this.receiveWorker.terminate();
      this.receiveWorker = null;
    }
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
    this.teardownReceiveWorker();
    this.session = null;
    this.connection = null;
    this.setState(ConnectionState.DISCONNECTED);
    this.events.emit('disconnected');
  }
}
