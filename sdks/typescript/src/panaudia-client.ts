/**
 * PanaudiaClient — unified client for Panaudia spatial audio.
 *
 * Wraps either MOQ or WebRTC transport behind a common API.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Transport } from './transport.js';
import {
  ConnectionState,
  type Position,
  type Rotation,
  type EntityInfo3,
  type ErrorEvent,
  type WarningEvent,
  type EntityState,
} from './types.js';
import type { PanaudiaPose } from './shared/coordinates.js';
import { createEntityInfo3 } from './shared/encoding.js';
import { TopicTree, type TopicNode } from './shared/topic-tree.js';
import { SingleRecordTree, type SingleRecordNode } from './shared/single-record-tree.js';
import type { MergeDebugInfo } from './shared/topic-merger.js';
import { MoqTransportAdapter } from './moq/moq-transport-adapter.js';
import { isWebTransportSupported } from './moq/connection.js';
import { WebRtcTransport } from './webrtc/webrtc-transport.js';
import {
  selectBestMicrophone,
  classifyByLabel,
  type MicrophoneType,
} from './shared/microphone-selection.js';
import { BluetoothMicDefaultError } from './moq/audio-publisher.js';

export type TransportType = 'moq' | 'webrtc';

export interface PanaudiaClientConfig {
  /** Server URL (from resolveServer() or hardcoded for dev). */
  serverUrl: string;
  /** JWT authentication token. Omit for tokenless (dev/sandbox) connections —
   *  the client will generate a UUID and pass it in the connection URL. The
   *  server must be running with PANAUDIA_UNTICKETED=1 for this to succeed. */
  ticket?: string;
  /** Transport to use. Default: 'auto' (MOQ if supported, else WebRTC). */
  transport?: 'auto' | 'moq' | 'webrtc';
  /** Initial position in Panaudia coordinates (0-1 range). */
  initialPosition?: Position;
  /** Initial rotation in degrees. */
  initialRotation?: Rotation;
  /** Enable presence (state/attributes updates from other entities). Default: true. */
  presence?: boolean;
  /** Entity ID (UUID) — extracted from JWT if not provided. */
  entityId?: string;
  /** Additional query parameters to include in the connection URL. */
  queryParams?: Record<string, string>;
  /** Microphone device ID — use listMicrophones() to get available IDs. Default: system default. */
  microphoneId?: string;
  /** Enable debug logging. Default: false. */
  debug?: boolean;
  /** World bounds for position normalization. If set, setPose normalizes positions from [min,max] to [0,1]. */
  worldBounds?: { min: number; max: number };
}

type EventHandlerMap = {
  connected: () => void;
  disconnected: () => void;
  authenticated: () => void;
  error: (event: ErrorEvent) => void;
  warning: (event: WarningEvent) => void;
  entityState: (state: EntityState) => void;
  attributes: (values: Array<{ key: string; value: string }>) => void;
  attributesRemoved: (keys: string[]) => void;
  attributeTreeChange: (uuid: string, attrs: TopicNode) => void;
  attributeTreeRemove: (uuid: string) => void;
  entity: (values: Array<{ key: string; value: string }>) => void;
  entityRemoved: (keys: string[]) => void;
  entityTreeChange: (uuid: string, record: TopicNode) => void;
  entityTreeRemove: (uuid: string) => void;
  // Space topic — single-record (no per-uuid grouping). Raw events
  // mirror the entity/attributes shape; spaceTreeChange fires once
  // per envelope with the whole reconstructed record.
  space: (values: Array<{ key: string; value: string }>) => void;
  spaceRemoved: (keys: string[]) => void;
  spaceTreeChange: (record: SingleRecordNode) => void;
  cacheDebug: (info: MergeDebugInfo) => void;
};

export interface MicrophoneInfo {
  deviceId: string;
  label: string;
  type: MicrophoneType;
}

export class PanaudiaClient {

  /**
   * List available microphone devices with type classification.
   * Requests mic permission if not already granted (one prompt, briefly opens default mic).
   */
  static async listMicrophones(): Promise<MicrophoneInfo[]> {
    // Ensure mic permission is granted so device labels are populated.
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } finally {
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({
        deviceId: d.deviceId,
        label: d.label,
        type: classifyByLabel(d.label),
      }));
  }

  /**
   * Get the recommended non-Bluetooth microphone.
   * Use this to pre-select a device in a mic picker UI.
   * The user should confirm the selection before connecting.
   */
  static getRecommendedMicrophone = selectBestMicrophone;
  private transport: Transport;
  private transportType: TransportType;
  private config: PanaudiaClientConfig;

  private position: Position;
  private rotation: Rotation;

  private statePublishTimer: ReturnType<typeof setTimeout> | null = null;
  private statePublishPending = false;
  private stateThrottleMs = 50; // 20Hz
  private muted = false;

  // Event emitter
  private handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  // Structured per-participant view of attribute state, kept in sync with
  // the flat values/removed events from the transport.
  private attributeTree = new TopicTree();

  // Structured per-entity view of server-internal entity state, kept in
  // sync with the flat entity values/removed events. The server filters
  // the stream so only this client's own entity record arrives.
  private entityTree = new TopicTree();

  // Space-wide role-rule record (roles-muted, roles-kicked,
  // roles-gain, roles-attenuation). Single nested object — no
  // per-uuid grouping since the topic's keys are uuid-less. Stays
  // empty for connections without the `space.read` cap (no envelopes
  // arrive). See plan/commands/space-read-path-plan.md.
  private spaceTree = new SingleRecordTree();

  constructor(config: PanaudiaClientConfig) {
    this.config = config;
    this.position = config.initialPosition ?? { x: 0.5, y: 0.5, z: 0.5 };
    this.rotation = config.initialRotation ?? { yaw: 0, pitch: 0, roll: 0 };

    // Select transport
    const choice = config.transport ?? 'auto';
    if (choice === 'webrtc') {
      this.transport = new WebRtcTransport();
      this.transportType = 'webrtc';
    } else if (choice === 'moq' || (choice === 'auto' && isWebTransportSupported())) {
      this.transport = new MoqTransportAdapter();
      this.transportType = 'moq';
    } else {
      // auto + no WebTransport = WebRTC fallback
      this.transport = new WebRtcTransport();
      this.transportType = 'webrtc';
    }

    // Wire up transport events to our event emitter
    this.transport.onEntityState((state) => {
      // Denormalize position if worldBounds is configured
      if (this.config.worldBounds) {
        const { min, max } = this.config.worldBounds;
        const range = max - min;
        const denormalized: EntityState = {
          ...state,
          position: {
            x: state.position.x * range + min,
            y: state.position.y * range + min,
            z: state.position.z * range + min,
          },
        };
        this.emit('entityState', denormalized);
      } else {
        this.emit('entityState', state);
      }
    });
    this.transport.onAttributeValues((values) => {
      this.emit('attributes', values);
      const affected = this.attributeTree.applyValues(values);
      for (const uuid of affected) {
        const attrs = this.attributeTree.get(uuid);
        if (attrs) this.emit('attributeTreeChange', uuid, attrs);
      }
    });
    this.transport.onAttributeRemoved((keys) => {
      this.emit('attributesRemoved', keys);
      const { updated, removed } = this.attributeTree.applyRemoved(keys);
      for (const uuid of updated) {
        const attrs = this.attributeTree.get(uuid);
        if (attrs) this.emit('attributeTreeChange', uuid, attrs);
      }
      for (const uuid of removed) {
        this.emit('attributeTreeRemove', uuid);
      }
    });
    this.transport.onEntityValues((values) => {
      this.emit('entity', values);
      const affected = this.entityTree.applyValues(values);
      for (const uuid of affected) {
        const record = this.entityTree.get(uuid);
        if (record) this.emit('entityTreeChange', uuid, record);
      }
    });
    this.transport.onEntityRemoved((keys) => {
      this.emit('entityRemoved', keys);
      const { updated, removed } = this.entityTree.applyRemoved(keys);
      for (const uuid of updated) {
        const record = this.entityTree.get(uuid);
        if (record) this.emit('entityTreeChange', uuid, record);
      }
      for (const uuid of removed) {
        this.emit('entityTreeRemove', uuid);
      }
    });
    this.transport.onSpaceValues((values) => {
      this.emit('space', values);
      if (this.spaceTree.applyValues(values)) {
        this.emit('spaceTreeChange', this.spaceTree.get());
      }
    });
    this.transport.onSpaceRemoved((keys) => {
      this.emit('spaceRemoved', keys);
      if (this.spaceTree.applyRemoved(keys)) {
        this.emit('spaceTreeChange', this.spaceTree.get());
      }
    });
    this.transport.onConnectionStateChange((state) => {
      if (state === ConnectionState.CONNECTED) this.emit('connected', undefined);
      if (state === ConnectionState.AUTHENTICATED) this.emit('authenticated', undefined);
      if (state === ConnectionState.DISCONNECTED) this.emit('disconnected', undefined);
    });
    this.transport.onError((error) => {
      const event: ErrorEvent = {
        code: 'TRANSPORT_ERROR',
        message: error.message,
        details: error,
      };
      this.emit('error', event);
    });
    this.transport.onWarning((warning) => {
      this.emit('warning', warning);
    });
    this.transport.onCacheDebug((info) => {
      this.emit('cacheDebug', info);
    });
  }

  // ── Connection lifecycle ─────────────────────────────────────────────

  async connect(): Promise<void> {
    // Check Bluetooth mic status before any transport setup.
    // This ensures both MOQ and WebRTC fail identically (clean, nothing connected).
    const microphoneId = this.config.microphoneId;
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        // Brief getUserMedia to populate device labels, then stop immediately
        const permStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        for (const track of permStream.getTracks()) track.stop();

        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label, type: classifyByLabel(d.label) }));

        if (microphoneId) {
          // Explicit device — warn if Bluetooth
          const match = mics.find((m) => m.deviceId === microphoneId);
          if (match && match.type === 'bluetooth') {
            this.emit('warning', {
              code: 'BLUETOOTH_MIC',
              message: `Bluetooth microphone in use: ${match.label}. Stereo audio may be reduced to mono.`,
              details: { deviceId: microphoneId, label: match.label },
            });
          }
        } else {
          // No explicit device — refuse if default is Bluetooth
          const defaultMic = mics[0];
          if (defaultMic && defaultMic.type === 'bluetooth') {
            throw new BluetoothMicDefaultError(defaultMic.label, mics);
          }
        }
      } catch (e) {
        // Re-throw our own errors, swallow enumeration failures
        if (e instanceof BluetoothMicDefaultError) throw e;
      }
    }

    // Tokenless path: if no ticket provided, generate a UUID client-side
    // and pass it through as a query param so the server can adopt it via
    // AuthoriseWithoutTicket. The generated id also becomes our entityId.
    let entityId = this.config.entityId;
    const queryParams: Record<string, string> = { ...(this.config.queryParams ?? {}) };
    if (!this.config.ticket) {
      if (!entityId) entityId = uuidv4();
      if (!queryParams['uuid']) queryParams['uuid'] = entityId;
    }

    await this.transport.connect({
      serverUrl: this.config.serverUrl,
      ticket: this.config.ticket,
      entityId,
      initialPosition: this.position,
      initialRotation: this.rotation,
      presence: this.config.presence,
      queryParams,
      microphoneId: this.config.microphoneId,
      debug: this.config.debug,
    });
  }

  async disconnect(): Promise<void> {
    this.cancelPendingStatePublish();
    await this.transport.disconnect();
  }

  getState(): ConnectionState {
    return this.transport.getState();
  }

  getEntityId(): string {
    return this.transport.getEntityId();
  }

  getTransportType(): TransportType {
    return this.transportType;
  }

  // ── Audio ────────────────────────────────────────────────────────────

  muteMic(): void {
    this.transport.muteMic();
    this.muted = true;
  }

  unmuteMic(): void {
    this.transport.unmuteMic();
    this.muted = false;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Set playback volume.
   * @param volume - Volume level from 0.0 (silent) to 1.0 (full volume).
   */
  setVolume(volume: number): void {
    this.transport.setVolume(volume);
  }

  /**
   * Get current playback volume.
   */
  getVolume(): number {
    return this.transport.getVolume();
  }

  // ── Spatial ──────────────────────────────────────────────────────────

  /**
   * Set pose in Panaudia coordinates (position 0-1 range, rotation in degrees).
   * If worldBounds is configured, positions are normalized from world space to 0-1 range.
   * Accepts a PanaudiaPose — the same type returned by the coordinate converter functions.
   *
   * @example
   * client.setPose(threejsToPanaudia(position, rotation));
   */
  setPose(pose: PanaudiaPose): void {
    const { x, y, z } = pose.position;
    const { yaw, pitch, roll } = pose.rotation;
    if (this.config.worldBounds) {
      const { min, max } = this.config.worldBounds;
      const range = max - min;
      this.position = {
        x: (x - min) / range,
        y: (y - min) / range,
        z: (z - min) / range,
      };
    } else {
      this.position = { x, y, z };
    }
    this.rotation = { yaw, pitch, roll };
    this.scheduleStatePublish();
  }


  // ── Remote entity control ───────────────────────────────────────────

  async mute(entityId: string): Promise<void> {
    await this.transport.publishControl({ type: 'mute', message: { node: entityId } });
  }

  async unmute(entityId: string): Promise<void> {
    await this.transport.publishControl({ type: 'unmute', message: { node: entityId } });
  }

  /**
   * Invoke a named command from the server's command catalog
   * (see `plan/commands/command_types.md`). Args are command-specific —
   * for example `space.entity.mute` takes `{entity_id}` and
   * `personal.role.mute` takes `{role}`.
   *
   * Strict-MVC: this fires-and-forgets. The server applies the command
   * (if the holder's roles allow it) and the resulting cache op flows
   * back through the entity / attribute streams. Failed authorisation,
   * unknown command names and bad arguments all silently drop on the
   * server — clients infer success from the absence or presence of an
   * echoed op. There is no per-call error path by design.
   */
  async command(name: string, args: Record<string, unknown> = {}): Promise<void> {
    await this.transport.publishControl({
      type: 'command',
      message: { command: name, args },
    });
  }

  // ── Events ───────────────────────────────────────────────────────────

  on<K extends keyof EventHandlerMap>(event: K, handler: EventHandlerMap[K]): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as (...args: unknown[]) => void);
  }

  off<K extends keyof EventHandlerMap>(event: K, handler: EventHandlerMap[K]): void {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler as (...args: unknown[]) => void);
    }
  }

  /**
   * Get the structured per-participant attribute tree, keyed by uuid.
   * Maintained automatically from incoming attribute values and tombstones.
   */
  getAttributeTree(): ReadonlyMap<string, TopicNode> {
    return this.attributeTree.getAll();
  }

  /**
   * Get a single participant's attributes, or undefined if unknown.
   */
  getAttributes(uuid: string): TopicNode | undefined {
    return this.attributeTree.get(uuid);
  }

  /**
   * Get the structured per-entity tree, keyed by uuid. Maintained
   * automatically from incoming entity values and tombstones. Under the
   * current server-side filter the only uuid this map will contain is
   * the client's own (`getEntityId()`).
   */
  getEntityTree(): ReadonlyMap<string, TopicNode> {
    return this.entityTree.getAll();
  }

  /**
   * Get a single entity's record, or undefined if unknown. Pass
   * `getEntityId()` to retrieve this client's own record.
   */
  getEntity(uuid: string): TopicNode | undefined {
    return this.entityTree.get(uuid);
  }

  /**
   * Get the space-wide role-rule record (roles-muted, roles-kicked,
   * roles-gain, roles-attenuation). Empty for connections without
   * the `space.read` read cap.
   */
  getSpace(): Readonly<SingleRecordNode> {
    return this.spaceTree.get();
  }

  // ── Internal ─────────────────────────────────────────────────────────

  private emit(event: string, ...args: unknown[]): void {
    const set = this.handlers.get(event);
    if (set) {
      for (const handler of set) {
        try {
          handler(...args);
        } catch (err) {
          console.error(`Error in ${event} handler:`, err);
        }
      }
    }
  }

  private scheduleStatePublish(): void {
    this.statePublishPending = true;

    if (this.statePublishTimer !== null) return; // already scheduled

    this.statePublishTimer = setTimeout(() => {
      this.statePublishTimer = null;
      if (this.statePublishPending) {
        this.statePublishPending = false;

        // Don't publish if not connected yet — pose will be sent in the connect URL
        const connState = this.transport.getState();
        if (connState !== ConnectionState.CONNECTED && connState !== ConnectionState.AUTHENTICATED) {
          return;
        }

        const state: EntityInfo3 = createEntityInfo3(
          this.getEntityId(),
          this.position,
          this.rotation,
          0, // volume is read-only (server-computed loudness)
        );
        this.transport.publishState(state).catch((err) => {
          console.error('Failed to publish state:', err);
        });
      }
    }, this.stateThrottleMs);
  }

  private cancelPendingStatePublish(): void {
    if (this.statePublishTimer !== null) {
      clearTimeout(this.statePublishTimer);
      this.statePublishTimer = null;
    }
    this.statePublishPending = false;
  }
}
