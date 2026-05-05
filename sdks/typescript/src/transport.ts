/**
 * Transport interface — abstraction over MOQ and WebRTC transports.
 */

import type {
  ConnectionState,
  EntityInfo3,
  ControlMessage,
  EntityState,
  WarningEvent,
  Position,
  Rotation,
} from './types.js';
import type { MergeDebugInfo } from './shared/topic-merger.js';

/**
 * Configuration passed to a Transport when connecting.
 */
export interface TransportConfig {
  serverUrl: string;
  /** Omit for tokenless connections. */
  ticket?: string;
  entityId?: string;
  initialPosition?: Position;
  initialRotation?: Rotation;
  /** Enable presence (state/attributes updates from other entities). Default: true. */
  presence?: boolean;
  /** Additional query parameters to include in the connection URL. */
  queryParams?: Record<string, string>;
  /** Microphone device ID. Default: system default. */
  microphoneId?: string;
  /** Enable debug logging. Default: false. */
  debug?: boolean;
}

/**
 * Audio capture configuration (common subset for MOQ and WebRTC).
 */
export interface AudioCaptureConfig {
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

/**
 * Audio playback configuration (common subset for MOQ and WebRTC).
 */
export interface AudioPlaybackConfig {
  sampleRate?: number;
  channelCount?: number;
}

/**
 * Transport interface implemented by MOQ and WebRTC backends.
 */
export interface Transport {
  /** Connect to the server. */
  connect(config: TransportConfig): Promise<void>;

  /** Disconnect from the server. */
  disconnect(): Promise<void>;

  /** Get current connection state. */
  getState(): ConnectionState;

  /** Get this client's entity UUID. */
  getEntityId(): string;

  /** Start capturing and sending microphone audio. */
  startAudioCapture(config?: AudioCaptureConfig): Promise<void>;

  /** Stop capturing audio. */
  stopAudioCapture(): Promise<void>;

  /** Start receiving and playing back audio. */
  startAudioPlayback(config?: AudioPlaybackConfig): Promise<void>;

  /** Stop playback. */
  stopAudioPlayback(): Promise<void>;

  /** Set playback volume (0.0 = silent, 1.0 = full). */
  setVolume(volume: number): void;

  /** Get current playback volume. */
  getVolume(): number;

  /** Mute local microphone (keep connection, stop sending). */
  muteMic(): void;

  /** Unmute local microphone. */
  unmuteMic(): void;

  /** Publish spatial state (position/rotation/volume). */
  publishState(state: EntityInfo3): Promise<void>;

  /** Publish a control message (mute/unmute a remote entity). */
  publishControl(msg: ControlMessage): Promise<void>;

  /** Register handler for entity state updates. */
  onEntityState(handler: (state: EntityState) => void): void;

  /** Register handler for batches of attribute values. Fired once per
   * envelope; single-op messages arrive as a one-element array. */
  onAttributeValues(handler: (values: Array<{ key: string; value: string }>) => void): void;

  /** Register handler for batches of attribute key removals (tombstones).
   * Fired once per envelope; single-op messages arrive as a one-element array. */
  onAttributeRemoved(handler: (keys: string[]) => void): void;

  /** Register handler for batches of entity values. Mirrors `onAttributeValues`
   * but for the per-client entity stream — only ops whose key starts with
   * this client's own uuid arrive here. Fired once per envelope. */
  onEntityValues(handler: (values: Array<{ key: string; value: string }>) => void): void;

  /** Register handler for batches of entity key removals (tombstones).
   * Mirrors `onAttributeRemoved` but for the per-client entity stream. */
  onEntityRemoved(handler: (keys: string[]) => void): void;

  /** Register handler for batches of space-topic values. The space
   * topic carries the space-wide role-rule record (roles-muted /
   * roles-kicked / roles-gain / roles-attenuation) and is delivered
   * only to holders with the `space.read` read cap. Keys are
   * uuid-less — they look like `roles-muted.{role}` etc. Fired once
   * per envelope. */
  onSpaceValues(handler: (values: Array<{ key: string; value: string }>) => void): void;

  /** Register handler for batches of space-topic key removals. */
  onSpaceRemoved(handler: (keys: string[]) => void): void;

  /** Register handler for connection state changes. */
  onConnectionStateChange(handler: (state: ConnectionState) => void): void;

  /** Register handler for errors. */
  onError(handler: (error: Error) => void): void;

  /** Register handler for warnings (non-fatal issues like Bluetooth mic detected). */
  onWarning(handler: (warning: WarningEvent) => void): void;

  /** Register handler for per-envelope cache-merge diagnostics. Fires
   * once per cache envelope on either the attributes or entity stream
   * with the topic, opId, and per-key accept/tombstone/reject decisions
   * from the opId gate. Used to distinguish "envelope arrived but every
   * op was stale" from "no envelope arrived". */
  onCacheDebug(handler: (info: MergeDebugInfo) => void): void;
}
