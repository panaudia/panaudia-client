/**
 * PanaudiaClient — unified client for Panaudia spatial audio.
 *
 * Wraps either MOQ or WebRTC transport behind a common API.
 */

import type { Transport } from './transport.js';
import {
  ConnectionState,
  type Position,
  type Rotation,
  type EntityInfo3,
  type EntityAttributes,
  type ErrorEvent,
  type WarningEvent,
  type EntityState,
} from './types.js';
import type { PanaudiaPose } from './shared/coordinates.js';
import { createEntityInfo3 } from './shared/encoding.js';
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
  /** JWT authentication token. */
  ticket: string;
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
  attributes: (attrs: EntityAttributes) => void;
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
  private handlers = new Map<string, Set<(event: unknown) => void>>();

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
    this.transport.onAttributes((attrs) => this.emit('attributes', attrs));
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

    await this.transport.connect({
      serverUrl: this.config.serverUrl,
      ticket: this.config.ticket,
      entityId: this.config.entityId,
      initialPosition: this.position,
      initialRotation: this.rotation,
      presence: this.config.presence,
      queryParams: this.config.queryParams,
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

  // ── Events ───────────────────────────────────────────────────────────

  on<K extends keyof EventHandlerMap>(event: K, handler: EventHandlerMap[K]): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as (event: unknown) => void);
  }

  off<K extends keyof EventHandlerMap>(event: K, handler: EventHandlerMap[K]): void {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler as (event: unknown) => void);
    }
  }

  // ── Internal ─────────────────────────────────────────────────────────

  private emit(event: string, data: unknown): void {
    const set = this.handlers.get(event);
    if (set) {
      for (const handler of set) {
        try {
          handler(data);
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
