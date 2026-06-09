/**
 * Panaudia MOQ Client
 *
 * Main client class for connecting to the Panaudia spatial audio mixer
 * via Media over QUIC (MOQ) transport.
 */

import { isWebTransportSupported, type DatagramSender } from './connection.js';
import { DatagramRouter } from './datagram-router.js';
import { MoqWorkerClient } from './moq-worker-client.js';
import { createMoqWorker } from './moq-worker-loader.js';
import type { WorkerEvent } from './moq-worker-protocol.js';
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
  // The MOQ worker hosts the WebTransport + session + datagram read loop + decode
  // (design §11). The main thread drives it by RPC and routes its events. The
  // main-side DatagramRouter is fed by the worker's forwarded non-audio datagrams;
  // subscribers register on it. `sender` proxies publisher sends to the worker.
  private workerClient: MoqWorkerClient | null = null;
  private readonly datagramRouter = new DatagramRouter();
  private sender: DatagramSender | null = null;
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
      // Spin up the MOQ worker — it owns the WebTransport + session + the datagram
      // read loop + Opus decode, OFF the main thread (design §11). The main thread
      // drives it by RPC and routes its events (handleWorkerEvent): forwarded
      // non-audio datagrams → the main-side DatagramRouter, incoming subscribes →
      // publishers, connection state → here. Publisher sends are proxied to the
      // worker's transport via `sender`.
      this.workerClient = new MoqWorkerClient(createMoqWorker(), (evt) => this.handleWorkerEvent(evt));
      this.sender = { sendDatagram: (bytes) => this.workerClient!.call('sendDatagram', { bytes }) };

      await this.workerClient.call('connect', { serverUrl: this.config.serverUrl, options });
      this.setState(ConnectionState.CONNECTED);
      this.log('WebTransport connected (worker), initializing MOQ session...');

      await this.workerClient.call('initSession', { role: MoqRole.PUBSUB });
      this.log('Session initialized, subscribing to output track...');

      const wc = this.workerClient;

      // Audio output (JWT-authorised — this is where authentication happens).
      const outputNamespace = generateTrackNamespace(PanaudiaTrackType.AUDIO_OUTPUT, this.config.entityId);
      this.log('Subscribing to:', outputNamespace.join('/'));
      const audioSub = await wc.call('subscribe', { namespace: outputNamespace, trackName: '', authorization: this.config.ticket });
      this.audioOutputTrackAlias = audioSub.trackAlias ?? 0;
      this.log('Audio output subscribed, trackAlias:', this.audioOutputTrackAlias);

      // State output.
      const stateOutputNamespace = generateTrackNamespace(PanaudiaTrackType.STATE_OUTPUT, this.config.entityId);
      const stateSub = await wc.call('subscribe', { namespace: stateOutputNamespace, trackName: '' });
      this.stateOutputTrackAlias = stateSub.trackAlias ?? 0;
      this.log('State output subscribed, trackAlias:', this.stateOutputTrackAlias);
      this.stateSubscriber = new StateSubscriber();
      this.stateSubscriber.attach(this.datagramRouter, this.stateOutputTrackAlias);
      this.stateSubscriber.onState((state) => {
        this.events.emit<EntityState>('entityState', state);
      });
      this.stateSubscriber.start();

      // Attributes output (resume opId on reconnect).
      const attributesOutputNamespace = generateTrackNamespace(PanaudiaTrackType.ATTRIBUTES_OUTPUT, this.config.entityId);
      const resumeOpId = this.attributesCache.getHighestOpId();
      const attrsSub = await wc.call('subscribe', {
        namespace: attributesOutputNamespace, trackName: '', resumeOpId: resumeOpId > 0n ? resumeOpId : undefined,
      });
      this.attributesOutputTrackAlias = attrsSub.trackAlias ?? 0;
      this.log('Attributes output subscribed, trackAlias:', this.attributesOutputTrackAlias);
      this.attributesSubscriber = new AttributesSubscriber(this.attributesCache);
      this.attributesSubscriber.attach(this.datagramRouter, this.attributesOutputTrackAlias);
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

      // Entity output (per-client filtered server-side).
      const entityOutputNamespace = generateTrackNamespace(PanaudiaTrackType.ENTITY_OUTPUT, this.config.entityId);
      const entityResumeOpId = this.entityCache.getHighestOpId();
      const entitySub = await wc.call('subscribe', {
        namespace: entityOutputNamespace, trackName: '', resumeOpId: entityResumeOpId > 0n ? entityResumeOpId : undefined,
      });
      this.entityOutputTrackAlias = entitySub.trackAlias ?? 0;
      this.log('Entity output subscribed, trackAlias:', this.entityOutputTrackAlias);
      this.entitySubscriber = new EntitySubscriber(this.entityCache);
      this.entitySubscriber.attach(this.datagramRouter, this.entityOutputTrackAlias);
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

      // Space output (server-gated by commands.ReadCapSpaceRead; tolerate failure).
      try {
        const spaceOutputNamespace = generateTrackNamespace(PanaudiaTrackType.SPACE_OUTPUT, this.config.entityId);
        const spaceResumeOpId = this.spaceCache.getHighestOpId();
        const spaceSub = await wc.call('subscribe', {
          namespace: spaceOutputNamespace, trackName: '', resumeOpId: spaceResumeOpId > 0n ? spaceResumeOpId : undefined,
        });
        this.spaceOutputTrackAlias = spaceSub.trackAlias ?? 0;
        this.log('Space output subscribed, trackAlias:', this.spaceOutputTrackAlias);
        this.spaceSubscriber = new SpaceSubscriber(this.spaceCache);
        this.spaceSubscriber.attach(this.datagramRouter, this.spaceOutputTrackAlias);
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

      // Announce input tracks. Publishers are created when the server subscribes
      // back to them — handleWorkerEvent('incomingSubscribe').
      const audioInputNamespace = generateTrackNamespace(PanaudiaTrackType.AUDIO_INPUT, this.config.entityId);
      const stateNamespace = generateTrackNamespace(PanaudiaTrackType.STATE, this.config.entityId);
      const controlNamespace = generateTrackNamespace(PanaudiaTrackType.CONTROL_INPUT, this.config.entityId);
      await wc.call('announce', { namespace: audioInputNamespace, authorization: this.config.ticket });
      await wc.call('announce', { namespace: stateNamespace, authorization: this.config.ticket });
      await wc.call('announce', { namespace: controlNamespace, authorization: this.config.ticket });

      // Start the worker's background control-stream message loop.
      await wc.call('startMessageLoop', {});

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

    if (this.workerClient) {
      try {
        await this.workerClient.call('disconnect', {});
      } catch {
        // worker may already be torn down
      }
      this.workerClient.dispose();
      this.workerClient = null;
    }
    this.sender = null;
    this.datagramRouter.clear();

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

    if (!this.workerClient || !this.sender) {
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
      this.audioTrackPublisher.attach(this.sender);
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

    if (!this.workerClient) {
      throw new MoqClientError('No connection available', 'NOT_CONNECTED');
    }

    // Create audio player if not exists
    if (!this.audioPlayer) {
      this.audioPlayer = new AudioPlayer({ ...config, debug: this.config.debug });
    }

    // Initialize audio player (creates AudioContext + worklet + the SAB ring).
    if (this.audioPlayer.getState() === AudioPlayerState.IDLE) {
      await this.audioPlayer.initialize();
    }
    this.audioPlayer.start();

    // Hand the audio track to the worker: it decodes that trackAlias and writes
    // the SAB ring the worklet reads (design §11.3) — decode is off the main
    // thread, fed by the worker-owned transport. Requires cross-origin isolation
    // (SAB); prepareForWorker() returns the shared ring + geometry.
    const handoff = this.audioPlayer.prepareForWorker();
    if (handoff?.mode === 'sab') {
      // SAB is shared by reference (NOT transferred — it stays usable here).
      await this.workerClient.call('setAudioTrack', {
        trackAlias: this.audioOutputTrackAlias,
        decoderConfig: this.audioPlayer.getDecoderConfig(),
        jbufConfig: handoff.jbufConfig,
        sharedStorage: handoff.sharedStorage,
        sharedWritePos: handoff.sharedWritePos,
      });
      this.log(`worker decoding audio trackAlias=${this.audioOutputTrackAlias} via SAB ring`);
    } else {
      this.logWarn('audio playback needs cross-origin isolation (SAB) — not active on this page');
    }

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
   * Route an event from the MOQ worker (design §11 / worker-transport-design §4):
   * connection-state changes, the server subscribing back to our tracks (→ create
   * publishers), forwarded non-audio datagrams (→ the main-side DatagramRouter,
   * where the subscribers handle them), and diagnostic notices. Audio PCM never
   * arrives here — it goes worker → SAB ring → worklet.
   */
  private handleWorkerEvent(evt: WorkerEvent): void {
    switch (evt.type) {
      case 'connectionState':
        if (evt.state === String(ConnectionState.ERROR)) {
          this.handleError('connection_error', evt.detail ?? 'Connection failed');
        } else if (evt.state === String(ConnectionState.DISCONNECTED)) {
          this.handleDisconnect();
        }
        break;
      case 'incomingSubscribe':
        this.handleIncomingSubscribe(evt.namespace, evt.trackAlias);
        break;
      case 'datagram':
        this.datagramRouter.ingest({
          trackAlias: evt.trackAlias,
          payload: evt.payload,
          groupId: evt.groupId,
          objectId: evt.objectId,
        });
        break;
      case 'notice':
        this.log(`[moq-worker] ${evt.event}${evt.detail ? ': ' + evt.detail : ''}`);
        break;
    }
  }

  /**
   * The server subscribed to one of our announced input tracks — (re)create the
   * matching publisher bound to the worker-backed sender. (Was the inline
   * session.onIncomingSubscribe callback before the transport moved to the worker.)
   */
  private handleIncomingSubscribe(namespace: string[], trackAlias: number): void {
    const nsPath = namespace.join('/');
    this.log(`Server subscribed to ${nsPath} with trackAlias=${trackAlias}`);
    if (!this.sender) return;

    if (nsPath.includes('in/audio')) {
      this.audioInputTrackAlias = trackAlias;
      if (this.audioTrackPublisher) {
        this.audioTrackPublisher.detach();
        this.audioTrackPublisher = new AudioTrackPublisher({ trackAlias, publisherPriority: 0 });
        this.audioTrackPublisher.attach(this.sender);
        this.audioTrackPublisher.startSession();
        this.log(`Recreated audioTrackPublisher with trackAlias=${trackAlias}`);
      }
    }

    if (nsPath.includes('state/') && !nsPath.includes('out/state')) {
      this.stateTrackAlias = trackAlias;
      if (this.stateTrackPublisher) this.stateTrackPublisher.detach();
      this.stateTrackPublisher = new StateTrackPublisher({ trackAlias: this.stateTrackAlias, publisherPriority: 1 });
      this.stateTrackPublisher.attach(this.sender);
      this.log(`Recreated stateTrackPublisher with trackAlias=${this.stateTrackAlias}`);
    }

    if (nsPath.includes('in/control')) {
      this.controlTrackAlias = trackAlias;
      if (this.controlTrackPublisher) this.controlTrackPublisher.detach();
      this.controlTrackPublisher = new ControlTrackPublisher({ trackAlias: this.controlTrackAlias, publisherPriority: 2 });
      this.controlTrackPublisher.attach(this.sender);
      this.log(`Created controlTrackPublisher with trackAlias=${this.controlTrackAlias}`);
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
    if (this.workerClient) {
      this.workerClient.dispose();
      this.workerClient = null;
    }
    this.sender = null;
    this.datagramRouter.clear();
    this.setState(ConnectionState.DISCONNECTED);
    this.events.emit('disconnected');
  }
}
