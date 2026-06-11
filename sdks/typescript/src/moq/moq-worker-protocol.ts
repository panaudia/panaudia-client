/**
 * moq-worker-protocol.ts — the message contract between the main thread and the
 * MOQ worker (worker-transport-design.md §4). The worker owns the WebTransport +
 * MoqConnection + MoqSession and the datagram read loop + Opus decode; the main
 * thread orchestrates (it holds the config/caches), issuing RPC commands and
 * consuming events. Audio PCM never crosses this channel — it goes worker → SAB
 * ring → worklet. Everything here is low-rate (connect/subscribe/announce + send
 * + forwarded non-audio datagrams), off the real-time audio path.
 *
 * Transport note: `bigint` (group/object IDs, resume opIds) and SharedArrayBuffer-
 * backed typed arrays are structured-cloneable, so they cross postMessage as-is.
 */

import type { WebTransportOptions } from './types.js';
import type { JitterBufferCoreConfig } from './jitter-buffer-core.js';

/** Opus decoder config the worker hands to WebCodecs AudioDecoder. */
export interface WorkerDecoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
}

/** Opus encoder config the worker hands to WebCodecs AudioEncoder (mic send path). */
export interface WorkerEncoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  bitrate: number;
  /** Opus frame duration in microseconds (e.g. 5000 = 5 ms). */
  frameDurationUs: number;
}

// ---- RPC: main → worker requests (each gets exactly one response) ----

export type WorkerRequest =
  | { kind: 'req'; id: number; method: 'connect'; args: { serverUrl: string; options?: WebTransportOptions } }
  | { kind: 'req'; id: number; method: 'initSession'; args: { role: number; maxSubscribeId?: number } }
  | {
      kind: 'req';
      id: number;
      method: 'subscribe';
      args: { namespace: string[]; trackName: string; authorization?: string; resumeOpId?: bigint };
    }
  | { kind: 'req'; id: number; method: 'announce'; args: { namespace: string[]; authorization?: string } }
  | {
      kind: 'req';
      id: number;
      method: 'setAudioTrack';
      args: {
        trackAlias: number;
        decoderConfig: WorkerDecoderConfig;
        jbufConfig: JitterBufferCoreConfig;
        sharedStorage: Float32Array;
        sharedWritePos: BigInt64Array;
      };
    }
  | { kind: 'req'; id: number; method: 'sendDatagram'; args: { bytes: Uint8Array } }
  | {
      kind: 'req';
      id: number;
      method: 'setCaptureTrack';
      args: {
        trackAlias: number;
        publisherPriority?: number;
        encoderConfig: WorkerEncoderConfig;
        numChannels: number;
        capacityFrames: number;
        sharedStorage: Float32Array;
        sharedWritePos: BigInt64Array;
        sharedReadPos: BigInt64Array;
        sharedSignal: Int32Array;
      };
    }
  | { kind: 'req'; id: number; method: 'stopCapture'; args: Record<string, never> }
  | { kind: 'req'; id: number; method: 'startMessageLoop'; args: Record<string, never> }
  | { kind: 'req'; id: number; method: 'disconnect'; args: Record<string, never> };

export type WorkerMethod = WorkerRequest['method'];

/** Result payload for `subscribe`. Other methods resolve with `undefined`. */
export interface SubscribeResult {
  subscribeId: number;
  trackAlias: number | undefined;
}

// ---- RPC: worker → main responses ----

export type WorkerResponse =
  | { kind: 'res'; id: number; ok: true; result: unknown }
  | { kind: 'res'; id: number; ok: false; error: string };

// ---- Events: worker → main (no response) ----

export type WorkerEvent =
  | { kind: 'evt'; type: 'connectionState'; state: string; detail?: string }
  | { kind: 'evt'; type: 'incomingSubscribe'; namespace: string[]; trackAlias: number }
  | {
      kind: 'evt';
      type: 'datagram';
      trackAlias: number;
      payload: Uint8Array;
      groupId: bigint;
      objectId: bigint;
    }
  | { kind: 'evt'; type: 'notice'; event: string; detail?: string };

/** Anything the worker posts to the main thread. */
export type WorkerOutbound = WorkerResponse | WorkerEvent;
