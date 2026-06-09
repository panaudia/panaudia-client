/**
 * audio-receive-worker.ts — the receive Worker that takes the MOQ datagram
 * pipeline OFF the main thread (design:
 * spatial-mixer/plan/browser-audio/playout-v3-design.md §11, plan Phase 5).
 *
 * **Why this exists.** v3 soak (latency-insights §9) showed crackle whose root
 * cause is architectural, not tuning: the whole producer side (the datagram read
 * loop AND the WebCodecs decode-output callback) ran on the main-thread event
 * loop, so even a perfectly-paced 5 ms server feed reached the worklet ring in
 * clumps. This Worker owns the **datagram read loop + parse + WebCodecs decode**
 * so the audio path never touches the main thread:
 *
 * ```
 *   transport.datagrams.readable ──transfer──▶ THIS WORKER
 *      read loop → parseObjectDatagram → by trackAlias:
 *        • audio  → AudioDecoder → PCM ──▶ pcmPort ──▶ playout worklet (direct)
 *        • other  → postMessage ─────────▶ main thread (connection dispatch)
 * ```
 *
 * Decoded PCM goes straight to the worklet over a transferred `MessagePort`
 * (`pcmPort`), so the main thread is uninvolved in steady state — and it stays
 * **`SharedArrayBuffer`-free / no COOP-COEP** (design §11.3). Non-audio datagrams
 * (state/attributes/entity/space/cache-topic) are low-rate and jank-tolerant, so
 * they are forwarded back to the main thread and routed through the existing
 * `connection.ts` dispatch + SUBSCRIBE_OK race buffer, unchanged (§11.4).
 *
 * **Build-free loading.** Like the playout worklet, this is loaded from a Blob URL
 * (so it needs no module-worker bundling, which Vite lib-mode does not emit
 * cleanly). A Blob worker cannot `import`, so the two pure MOQ parse helpers are
 * serialized into it via `.toString()` — single source of truth preserved, no
 * duplicated wire logic. WebTransport and WebCodecs `AudioDecoder` are available
 * in a DedicatedWorker regardless of how it was loaded (verified June 2026 across
 * Chrome/Edge/Firefox-desktop/Safari-26.4+ — design §11.8).
 */

import { decodeVarint, parseObjectDatagram } from './moq-transport.js';
import { JitterBufferCore, type JitterBufferCoreConfig } from './jitter-buffer-core.js';

/** The render-quantum-agnostic decoder config the worker configures `AudioDecoder` with. */
export interface ReceiveWorkerDecoderConfig {
  codec: string; // 'opus'
  sampleRate: number;
  numberOfChannels: number;
}

/**
 * main → worker: initialise with the transferred datagram readable. Sent at
 * connect, before the audio track (or the worklet's PCM port) exists — so the
 * worker starts reading and forwards *everything* to main until the `audio`
 * message arrives. `pcmPort` is optional here (used by tests); in the real flow
 * it rides with `audio` (the worklet doesn't exist until `startPlayback`).
 */
export interface ReceiveWorkerInitMessage {
  type: 'init';
  /** Transferred `transport.datagrams.readable` (must be unlocked — main never reads it in worker mode). */
  readable: ReadableStream<Uint8Array>;
  /** Optional transferred port to the playout worklet; usually sent with `audio` instead. */
  pcmPort?: MessagePort;
}

/**
 * main → worker: the audio track is now known (post-`startPlayback`) — configure
 * the decoder, adopt the worklet's PCM port, and start decoding this alias
 * locally (everything else keeps forwarding to main).
 */
export interface ReceiveWorkerAudioMessage {
  type: 'audio';
  audioTrackAlias: number;
  decoderConfig: ReceiveWorkerDecoderConfig;
  /**
   * SAB mode (preferred, design §11.3): the worker constructs a writer-view
   * `JitterBufferCore` over the shared ring and writes decoded PCM straight into
   * it — no `postMessage` for PCM. `jbufConfig` must be the SAME config the
   * worklet's reader core uses (so capacity/nc match); the SAB arrays must be
   * sized with `computeJitterCapacity(jbufConfig)`.
   */
  jbufConfig?: JitterBufferCoreConfig;
  sharedStorage?: Float32Array;
  sharedWritePos?: BigInt64Array;
  /** Non-isolated fallback only: transferred worklet port; PCM is posted here when there is no SAB. */
  pcmPort?: MessagePort;
}

/** main → worker: tear down (stop the read loop, close the decoder). */
export interface ReceiveWorkerStopMessage {
  type: 'stop';
}

export type ReceiveWorkerInbound =
  | ReceiveWorkerInitMessage
  | ReceiveWorkerAudioMessage
  | ReceiveWorkerStopMessage;

/** worker → main: a non-audio datagram, to be routed through `connection.ingestForwardedDatagram`. */
export interface ForwardedDatagramMessage {
  type: 'datagram';
  trackAlias: number;
  groupId: bigint;
  objectId: bigint;
  publisherPriority: number;
  payload: Uint8Array;
}

/** worker → main: diagnostics (read-loop ended / decode error). */
export interface ReceiveWorkerNoticeMessage {
  type: 'notice';
  event: 'reader-done' | 'reader-error' | 'decode-error';
  detail?: string;
}

export type ReceiveWorkerOutbound = ForwardedDatagramMessage | ReceiveWorkerNoticeMessage;

/**
 * Best-effort capability probe for the worker datagram path (design §11.8). The
 * deep checks (WebTransport / WebCodecs *inside* a Worker, stream + port
 * transfer) can't be done synchronously, so this gates on the main-thread
 * presence of the primitives; the actual worker construction is wrapped in
 * try/catch by the caller, which falls back to the main-thread decode path if
 * any of these turn out not to work in a given engine.
 */
export function audioReceiveWorkerSupported(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof MessageChannel !== 'undefined' &&
    typeof WebTransport !== 'undefined' &&
    typeof AudioDecoder !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  );
}

/**
 * Routing decision for one parsed datagram — extracted as a pure function so it
 * is unit-testable off the worker thread (the analog of `connection`'s
 * `dispatchOrBuffer` split). Until the audio alias is known (`audioTrackAlias`
 * undefined) everything is forwarded, including any pre-subscribe audio (those
 * land in `connection`'s pending buffer with no handler and are harmlessly
 * dropped — see design §11.4).
 */
export function routeDatagram(
  trackAlias: number,
  audioTrackAlias: number | undefined
): 'decode' | 'forward' {
  return audioTrackAlias !== undefined && trackAlias === audioTrackAlias ? 'decode' : 'forward';
}

/**
 * The worker runtime, as plain JS text (it runs in DedicatedWorkerGlobalScope and
 * references `AudioDecoder` / `EncodedAudioChunk` / `self`, so it is not a normal
 * imported module). It depends only on `decodeVarint` + `parseObjectDatagram`,
 * which {@link buildReceiveWorkerCode} prepends via `.toString()`, and on the
 * pure `routeDatagram` rule, which is inlined here (one line) to keep the worker
 * self-contained.
 */
const RECEIVE_WORKER_SOURCE = `
'use strict';
let reader = null;
let pcmPort = null;     // non-isolated fallback PCM sink
let jbuf = null;        // SAB writer-view JitterBufferCore (preferred PCM sink)
let decoder = null;
let audioTrackAlias = undefined;
let running = false;

function post(msg, transfer) { self.postMessage(msg, transfer || []); }

function configureDecoder(cfg) {
  if (decoder) { try { decoder.close(); } catch (e) {} decoder = null; }
  decoder = new AudioDecoder({
    output: (audioData) => {
      try {
        const frames = audioData.numberOfFrames;
        const channels = audioData.numberOfChannels;
        const pcm = new Float32Array(frames * channels);
        // Interleaved single-plane copy — matches the worklet ring's interleaved layout.
        audioData.copyTo(pcm, { planeIndex: 0, format: 'f32' });
        // SAB mode: write straight into the shared ring (real-time-safe, no
        // postMessage). Fallback: post to the worklet's port.
        if (jbuf) jbuf.write(pcm);
        else if (pcmPort) pcmPort.postMessage(pcm, [pcm.buffer]);
      } catch (e) {
        post({ type: 'notice', event: 'decode-error', detail: String(e) });
      } finally {
        audioData.close();
      }
    },
    error: (e) => post({ type: 'notice', event: 'decode-error', detail: String(e) }),
  });
  // optimizeForLatency: minimise how many input chunks the decoder buffers before
  // emitting output (WebCodecs real-time hint) — without it some decoders batch
  // several frames, adding burstiness on top of the transport.
  decoder.configure({ codec: cfg.codec, sampleRate: cfg.sampleRate, numberOfChannels: cfg.numberOfChannels, optimizeForLatency: true });
}

async function readLoop() {
  if (!reader || running) return;
  running = true;
  try {
    while (running) {
      const { value, done } = await reader.read();
      if (done) { post({ type: 'notice', event: 'reader-done' }); break; }
      if (!value) continue;
      let parsed;
      try { parsed = parseObjectDatagram(value); } catch (e) { continue; } // malformed — skip
      const isAudio = audioTrackAlias !== undefined && parsed.trackAlias === audioTrackAlias && decoder;
      if (isAudio) {
        try {
          const chunk = new EncodedAudioChunk({
            type: 'key', // Opus frames are always key frames
            timestamp: Number(parsed.groupId) * 1000,
            data: parsed.payload,
          });
          decoder.decode(chunk);
        } catch (e) {
          post({ type: 'notice', event: 'decode-error', detail: String(e) });
        }
      } else {
        // Forward non-audio to the main thread. Copy the payload (it is a
        // subarray of the read chunk) into its own buffer so it can be transferred.
        const copy = parsed.payload.slice();
        post({
          type: 'datagram',
          trackAlias: parsed.trackAlias,
          groupId: parsed.groupId,
          objectId: parsed.objectId,
          publisherPriority: parsed.publisherPriority,
          payload: copy,
        }, [copy.buffer]);
      }
    }
  } catch (e) {
    if (running) post({ type: 'notice', event: 'reader-error', detail: String(e) });
  } finally {
    running = false;
  }
}

self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === 'init') {
    if (msg.pcmPort) pcmPort = msg.pcmPort;
    if (msg.readable) { reader = msg.readable.getReader(); readLoop(); }
  } else if (msg.type === 'audio') {
    if (msg.pcmPort) pcmPort = msg.pcmPort;
    if (msg.sharedStorage && msg.sharedWritePos && msg.jbufConfig) {
      // SAB mode: writer-view core over the shared ring (same config the worklet
      // reader uses, plus the shared arrays).
      const c = Object.assign({}, msg.jbufConfig, {
        sharedStorage: msg.sharedStorage,
        sharedWritePos: msg.sharedWritePos,
      });
      jbuf = new JitterBufferCore(c);
    }
    configureDecoder(msg.decoderConfig);
    audioTrackAlias = msg.audioTrackAlias;
  } else if (msg.type === 'stop') {
    running = false;
    if (decoder) { try { decoder.close(); } catch (e2) {} decoder = null; }
    if (reader) { try { reader.cancel(); } catch (e2) {} reader = null; }
  }
};
`;

/**
 * Build the full worker module source: the serialized pure MOQ parse helpers
 * (`decodeVarint`, `parseObjectDatagram`) followed by the worker runtime.
 * Self-contained (no imports, no free module-scope refs) so it loads from a Blob
 * URL in any of the four target engines.
 */
export function buildReceiveWorkerCode(): string {
  const coreSrc = JitterBufferCore.toString();
  const varintSrc = decodeVarint.toString();
  const parseSrc = parseObjectDatagram.toString();
  if (!coreSrc.startsWith('class')) {
    throw new Error('audio-receive-worker: JitterBufferCore.toString() is not a class declaration');
  }
  for (const [name, src] of [
    ['decodeVarint', varintSrc],
    ['parseObjectDatagram', parseSrc],
  ] as const) {
    if (!src.startsWith('function')) {
      // A bundler wrapping these such that .toString() is not self-contained
      // source would break the worker — surface early and loudly.
      throw new Error(`audio-receive-worker: ${name}.toString() is not a function declaration`);
    }
  }
  // Same helper-leak guard as the playout worklet: a transpiler/bundler helper
  // (e.g. esbuild class-field lowering) referenced from serialized source would
  // be undefined in the worker. Build targets es2022 to avoid it.
  const helper = /\b__(publicField|privateField|decorateClass|decorateParam|name|esDecorate)\b/.exec(
    coreSrc + varintSrc + parseSrc
  );
  if (helper) {
    throw new Error(
      `audio-receive-worker: serialized source references bundler helper "${helper[0]}" — ` +
        'it would be undefined in the worker. Keep native output (es2022+).'
    );
  }
  // JitterBufferCore first (the worker constructs a writer view in SAB mode),
  // then the pure parse helpers, then the worker runtime. The class is BOUND to a
  // const because a consumer's bundler may emit it as an anonymous expression
  // (`var X = class {…}`) → `.toString()` is `class {…}`, a syntax error as a bare
  // statement; `const JitterBufferCore = class {…};` is valid either way. (The
  // functions stay as named declarations — consumers keep those intact.)
  return `const JitterBufferCore = ${coreSrc};\n${varintSrc}\n${parseSrc}\n${RECEIVE_WORKER_SOURCE}`;
}

/**
 * Create a Blob URL for the receive worker. Caller passes it to `new Worker(url)`
 * and should `URL.revokeObjectURL` after construction.
 */
export function createReceiveWorkerUrl(): string {
  const blob = new Blob([buildReceiveWorkerCode()], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}
