/**
 * Audio Subscriber - Receives audio from MOQ track and decodes for playback
 *
 * Subscribes to the output audio track from the server, receives Opus-encoded
 * frames via MOQ datagrams, and passes them to a decoder for playback.
 */

import { MoqConnection } from './connection.js';
import { MoqClientError } from './errors.js';

/**
 * Audio frame received from server
 */
export interface ReceivedAudioFrame {
  /** Track alias this frame belongs to */
  trackAlias: number;

  /** Group ID (typically timestamp-based) */
  groupId: bigint;

  /** Object ID within the group */
  objectId: bigint;

  /** Publisher priority */
  publisherPriority: number;

  /** Opus-encoded audio data */
  data: Uint8Array;

  /** Receive timestamp (local) */
  receiveTime: number;
}

/**
 * Handler for received audio frames
 */
export type AudioFrameReceivedHandler = (data: Uint8Array, groupId: bigint) => void;

/**
 * Audio subscriber state
 */
export enum AudioSubscriberState {
  IDLE = 'idle',
  SUBSCRIBING = 'subscribing',
  ACTIVE = 'active',
  ERROR = 'error',
}

/**
 * Audio subscriber statistics
 */
export interface AudioSubscriberStats {
  /** Total frames received */
  framesReceived: number;

  /** Total bytes received */
  bytesReceived: number;

  /** Frames dropped due to errors */
  framesDropped: number;

  /** Current group ID */
  currentGroupId: bigint;

  /** Last frame receive time */
  lastFrameTime: number;
}

/**
 * Audio Subscriber
 *
 * Receives Opus-encoded audio frames from an MOQ track via datagrams.
 */
export class AudioSubscriber {
  private connection: MoqConnection | null = null;
  private state: AudioSubscriberState = AudioSubscriberState.IDLE;
  private frameHandler: AudioFrameReceivedHandler | null = null;
  private trackAlias: number = 0;
  private isListening: boolean = false;

  // Statistics
  private stats: AudioSubscriberStats = {
    framesReceived: 0,
    bytesReceived: 0,
    framesDropped: 0,
    currentGroupId: 0n,
    lastFrameTime: 0,
  };

  /**
   * Get current state
   */
  getState(): AudioSubscriberState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): AudioSubscriberStats {
    return { ...this.stats };
  }

  /**
   * Set handler for received audio frames
   */
  onFrame(handler: AudioFrameReceivedHandler): void {
    this.frameHandler = handler;
  }

  /**
   * Attach to a connection and start listening for datagrams
   *
   * @param connection - MOQ connection
   * @param trackAlias - Track alias to filter frames
   */
  attach(connection: MoqConnection, trackAlias: number): void {
    this.connection = connection;
    this.trackAlias = trackAlias;
    this.state = AudioSubscriberState.SUBSCRIBING;
  }

  /**
   * Start receiving audio frames via the connection's datagram dispatcher
   */
  async start(): Promise<void> {
    if (!this.connection) {
      throw new MoqClientError('Not attached to a connection', 'NOT_CONNECTED');
    }

    if (this.isListening) {
      return;
    }

    this.isListening = true;
    this.state = AudioSubscriberState.ACTIVE;

    // Register with the connection's datagram dispatcher
    this.connection.registerDatagramHandler(this.trackAlias, (payload, _trackAlias, groupId, _objectId) => {
      if (!this.isListening) return;

      this.stats.framesReceived++;
      this.stats.bytesReceived += payload.length;
      this.stats.currentGroupId = groupId;
      this.stats.lastFrameTime = performance.now();

      if (this.frameHandler) {
        this.frameHandler(payload, groupId);
      }
    });
  }

  /**
   * Stop receiving audio frames
   */
  stop(): void {
    this.isListening = false;
    if (this.connection) {
      this.connection.unregisterDatagramHandler(this.trackAlias);
    }
    this.state = AudioSubscriberState.IDLE;
  }

  /**
   * Detach from connection
   */
  detach(): void {
    this.stop();
    this.connection = null;
    this.state = AudioSubscriberState.IDLE;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      framesReceived: 0,
      bytesReceived: 0,
      framesDropped: 0,
      currentGroupId: 0n,
      lastFrameTime: 0,
    };
  }

}

/**
 * Check if WebCodecs AudioDecoder is supported
 */
export function isAudioDecoderSupported(): boolean {
  return typeof AudioDecoder !== 'undefined';
}

/**
 * Get audio decoder capabilities
 */
export async function getAudioDecoderCapabilities(): Promise<{
  supported: boolean;
  opusSupported: boolean;
}> {
  if (!isAudioDecoderSupported()) {
    return { supported: false, opusSupported: false };
  }

  try {
    const support = await AudioDecoder.isConfigSupported({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
    });

    return {
      supported: true,
      opusSupported: support.supported ?? false,
    };
  } catch {
    return { supported: true, opusSupported: false };
  }
}
