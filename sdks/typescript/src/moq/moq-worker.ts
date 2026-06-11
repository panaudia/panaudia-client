/**
 * moq-worker.ts — the MOQ worker entry (worker-transport-design.md §11 / §4).
 *
 * Owns, OFF THE MAIN THREAD: the WebTransport, MoqConnection, MoqSession (control
 * stream), the datagram read loop, and Opus decode. The main thread orchestrates
 * via the RPC/event protocol (moq-worker-protocol.ts) and never touches the
 * transport or the read loop — so main-thread jank can't stall audio.
 *
 * Datagram handling: the worker reads `datagrams.readable` DIRECTLY (not via
 * MoqConnection's dispatcher — that router lives on the main thread for the
 * subscribers). The audio track is decoded and written straight into the
 * SharedArrayBuffer ring (the worklet reads it); every other track is forwarded
 * to the main thread, where the DatagramRouter + subscribers handle it.
 *
 * Loaded via `?worker&inline` (packaging proven in Phase 0): a self-contained
 * bundled module worker — it `import`s the full stack, no `.toString()` fragility.
 */

import { MoqConnection } from './connection.js';
import { MoqSession } from './session.js';
import { JitterBufferCore } from './jitter-buffer-core.js';
import { CaptureRing } from './capture-ring.js';
import { CaptureEncoder, type EncodedChunkLike, type FrameEncoder } from './capture-encoder.js';
import { parseObjectDatagram } from './moq-transport.js';
import type {
  WorkerRequest,
  WorkerEvent,
  WorkerOutbound,
  WorkerDecoderConfig,
  SubscribeResult,
} from './moq-worker-protocol.js';

// tsconfig lib is DOM (not WebWorker); type the worker globals locally.
interface WorkerCtx {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(m: unknown, transfer?: Transferable[]): void;
}
const ctx = self as unknown as WorkerCtx;

let connection: MoqConnection | null = null;
let session: MoqSession | null = null;
let jbuf: JitterBufferCore | null = null; // SAB writer view for the audio track
let decoder: AudioDecoder | null = null;
let audioTrackAlias: number | undefined;
let reading = false;
// Reused decode-output scratch (worker-capture-plan.md P6): grow-on-demand, never
// per-frame. jbuf.write copies into the ring synchronously, so the scratch is safe to
// reuse on the next decoded frame — no `new Float32Array` per packet.
let decodePcm = new Float32Array(0);

// DIAGNOSTIC (playout-drift investigation): frames written to the ring per
// performance.now() wall-second. performance.now() shares the CPU clock domain with
// the server's 5ms send ticker, so this measures the server's true emit rate as the
// browser receives it: ≈48000 ⇒ server is real-time (residual drops are a device-clock
// offset → resampler fix); >48000 ⇒ server over-produces (server-side bug). No behaviour
// change; emitted as a `notice` (logs on main as `[moq-worker] decode-rate: …`).
let decFrames = 0;
let decRateStart = 0;

// Burst probe (playout-drift investigation): bucket inter-arrival gaps for two streams
// — audio-datagram READS (transport delivery) and decoder OUTPUT callbacks (WebCodecs
// emit) — to tell bursty delivery from async-decode batching. Buckets: <1ms (clumped),
// 1–4ms (tight), 4–6ms (≈the server's 5ms cadence = smooth), >6ms (gap after a burst).
// Plus frames-per-output min/max (catches multi-packet AudioData coalescing).
interface GapStats {
  count: number;
  clumped: number;
  tight: number;
  cadence: number;
  gap: number;
  last: number;
}
function newGapStats(): GapStats {
  return { count: 0, clumped: 0, tight: 0, cadence: 0, gap: 0, last: 0 };
}
function recordGap(s: GapStats, now: number): void {
  if (s.last > 0) {
    const g = now - s.last;
    if (g < 1) s.clumped++;
    else if (g < 4) s.tight++;
    else if (g <= 6) s.cadence++;
    else s.gap++;
  }
  s.last = now;
  s.count++;
}
function resetGapBuckets(s: GapStats): void {
  s.count = 0;
  s.clumped = 0;
  s.tight = 0;
  s.cadence = 0;
  s.gap = 0; // keep `last` so the next gap is measured correctly across the reset
}
const dgGaps = newGapStats(); // audio datagram reads (delivery)
const outGaps = newGapStats(); // decoder output callbacks (decode emit)
let outFmin = Number.MAX_SAFE_INTEGER;
let outFmax = 0;

// CLOCKTEST (one-shot): total frames written to the ring over ~60 performance.now()
// seconds (CPU clock), vs expected 48000×elapsed. Pairs with the server's per-minute
// send count — both are CPU-paced on the same machine, so both should land on expected;
// the drift (if real) shows in the audio-clock counter in audio-player.ts, not here.
let decTotal = 0;
let decTotalStart = 0;
let decTotalDone = false;

// Mic SEND path (worker-capture-design.md): the capture worklet fills a SAB ring; this
// worker drains it, Opus-encodes, frames, and writes to the transport.
let captureEncoder: CaptureEncoder | null = null;
let captureSignal: Int32Array | null = null; // §6.1 wake cell (worklet notifies, we wait)
let captureRunning = false;

function emit(evt: WorkerEvent): void {
  ctx.postMessage(evt satisfies WorkerOutbound);
}

function configureDecoder(cfg: WorkerDecoderConfig): void {
  if (decoder) {
    try {
      decoder.close();
    } catch {
      /* already closed */
    }
  }
  decoder = new AudioDecoder({
    output: (audioData: AudioData) => {
      try {
        const frames = audioData.numberOfFrames;
        const channels = audioData.numberOfChannels;
        const need = frames * channels;
        if (decodePcm.length < need) decodePcm = new Float32Array(need); // grow only
        const pcm = decodePcm.subarray(0, need);
        audioData.copyTo(pcm, { planeIndex: 0, format: 'f32' });
        jbuf?.write(pcm); // straight into the SAB ring — no postMessage, no per-frame alloc

        // Diagnostic: report frames/wall-second + burst buckets every ~2s.
        decFrames += frames;
        const tNow = performance.now();
        recordGap(outGaps, tNow); // decode-emit cadence
        if (frames < outFmin) outFmin = frames;
        if (frames > outFmax) outFmax = frames;
        if (decRateStart === 0) decRateStart = tNow;
        const elapsed = tNow - decRateStart;
        if (elapsed >= 2000) {
          const fps = (decFrames / elapsed) * 1000;
          emit({
            kind: 'evt',
            type: 'notice',
            event: 'decode-rate',
            detail: `${fps.toFixed(1)} frames/wall-sec (${decFrames} frames / ${(elapsed / 1000).toFixed(2)}s)`,
          });
          // Burst probe: gap distribution for delivery (dg) vs decode emit (out).
          const fmt = (s: GapStats) =>
            `n=${s.count} <1:${s.clumped} 1-4:${s.tight} ~5:${s.cadence} >6:${s.gap}`;
          emit({
            kind: 'evt',
            type: 'notice',
            event: 'burst',
            detail: `dg[${fmt(dgGaps)}] out[${fmt(outGaps)}] fpo=${outFmin === Number.MAX_SAFE_INTEGER ? 0 : outFmin}-${outFmax}`,
          });
          decFrames = 0;
          decRateStart = tNow;
          resetGapBuckets(dgGaps);
          resetGapBuckets(outGaps);
          outFmin = Number.MAX_SAFE_INTEGER;
          outFmax = 0;
        }
        // CLOCKTEST one-shot: 60s decode total vs expected (CPU clock).
        decTotal += frames;
        if (decTotalStart === 0) decTotalStart = tNow;
        if (!decTotalDone && tNow - decTotalStart >= 60000) {
          const el = (tNow - decTotalStart) / 1000;
          const expected = 48000 * el;
          const ppm = (decTotal / expected - 1) * 1e6;
          emit({
            kind: 'evt',
            type: 'notice',
            event: 'clocktest',
            detail: `client decode wrote ${decTotal} frames in ${el.toFixed(2)}s; expected ${expected.toFixed(0)}; drift ${ppm >= 0 ? '+' : ''}${ppm.toFixed(1)} ppm`,
          });
          decTotalDone = true;
        }
      } catch (e) {
        emit({ kind: 'evt', type: 'notice', event: 'decode-error', detail: String(e) });
      } finally {
        audioData.close();
      }
    },
    error: (e: DOMException) => emit({ kind: 'evt', type: 'notice', event: 'decode-error', detail: String(e) }),
  });
  decoder.configure({
    codec: cfg.codec,
    sampleRate: cfg.sampleRate,
    numberOfChannels: cfg.numberOfChannels,
    optimizeForLatency: true,
  } as AudioDecoderConfig & { optimizeForLatency: boolean });
}

/** Read the datagram readable directly: audio → decode → SAB; everything else → main. */
function startReadLoop(): void {
  if (reading || !connection) return;
  const datagrams = connection.getDatagrams();
  const reader = datagrams.readable.getReader();
  reading = true;
  (async () => {
    try {
      while (reading) {
        const { value, done } = await reader.read();
        if (done) {
          emit({ kind: 'evt', type: 'notice', event: 'reader-done' });
          break;
        }
        if (!value) continue;
        let parsed;
        try {
          parsed = parseObjectDatagram(value);
        } catch {
          continue; // malformed — skip
        }
        if (audioTrackAlias !== undefined && parsed.trackAlias === audioTrackAlias && jbuf && decoder) {
          recordGap(dgGaps, performance.now()); // burst probe: audio-datagram delivery cadence
          try {
            decoder.decode(
              new EncodedAudioChunk({
                type: 'key', // Opus frames are always key frames
                timestamp: Number(parsed.groupId) * 1000,
                data: parsed.payload,
              })
            );
          } catch (e) {
            emit({ kind: 'evt', type: 'notice', event: 'decode-error', detail: String(e) });
          }
        } else {
          // Copy the payload (a subarray of the read chunk) so it transfers cleanly.
          const copy = parsed.payload.slice();
          ctx.postMessage(
            {
              kind: 'evt',
              type: 'datagram',
              trackAlias: parsed.trackAlias,
              payload: copy,
              groupId: parsed.groupId,
              objectId: parsed.objectId,
            } satisfies WorkerOutbound,
            // transfer the copy's buffer
            [copy.buffer]
          );
        }
      }
    } catch (e) {
      if (reading) emit({ kind: 'evt', type: 'notice', event: 'reader-error', detail: String(e) });
    } finally {
      reading = false;
    }
  })();
}

/**
 * Drain the capture ring and encode/send on each §6.1 wake. Clock-free via
 * `Atomics.waitAsync` on the shared signal cell (the worklet notifies per quantum;
 * confirmed on all four engines in P0). The encode work is sub-ms and the loop spends
 * its time awaiting, so the decode read loop (an independent async loop on the same
 * event loop) is serviced freely between wakes (§11.3). Falls back to a short poll only
 * if `waitAsync` is somehow absent.
 */
function startCaptureLoop(): void {
  if (captureRunning || !captureEncoder || !captureSignal) return;
  captureRunning = true;
  const signal = captureSignal;
  const enc = captureEncoder;
  const waitAsync = (Atomics as unknown as {
    waitAsync?: (ta: Int32Array, i: number, v: number) => { async: boolean; value: Promise<string> };
  }).waitAsync;
  void (async () => {
    let seen = Atomics.load(signal, 0);
    while (captureRunning) {
      enc.pump(); // drain everything available → encode (Opus does the framing)
      if (waitAsync) {
        const r = waitAsync(signal, 0, seen);
        if (r.async) await r.value;
      } else {
        await new Promise((res) => setTimeout(res, 2)); // fallback poll (~2 ms)
      }
      seen = Atomics.load(signal, 0);
    }
  })();
}

/** Stop the capture loop and flush+close the encoder. Idempotent. */
async function stopCapture(): Promise<void> {
  captureRunning = false;
  // Wake the loop so it observes captureRunning=false and exits promptly.
  if (captureSignal) {
    Atomics.add(captureSignal, 0, 1);
    Atomics.notify(captureSignal, 0, 1);
  }
  if (captureEncoder) {
    await captureEncoder.stop();
    captureEncoder = null;
  }
  captureSignal = null;
}

async function handle(method: WorkerRequest['method'], args: WorkerRequest['args']): Promise<unknown> {
  switch (method) {
    case 'connect': {
      const a = args as Extract<WorkerRequest, { method: 'connect' }>['args'];
      connection = new MoqConnection(a.serverUrl);
      connection.setHandlers({
        onStateChange: (state, error) =>
          emit({ kind: 'evt', type: 'connectionState', state: String(state), detail: error?.message }),
      });
      await connection.connect(a.options);
      session = new MoqSession(connection);
      session.onIncomingSubscribe((namespace, trackAlias) =>
        emit({ kind: 'evt', type: 'incomingSubscribe', namespace, trackAlias })
      );
      return;
    }
    case 'initSession': {
      const a = args as Extract<WorkerRequest, { method: 'initSession' }>['args'];
      if (!session) throw new Error('initSession before connect');
      await session.initialize(a.role, undefined, a.maxSubscribeId);
      startReadLoop(); // datagrams can arrive right after the session is up
      return;
    }
    case 'subscribe': {
      const a = args as Extract<WorkerRequest, { method: 'subscribe' }>['args'];
      if (!session) throw new Error('subscribe before connect');
      const subscribeId = await session.subscribe(a.namespace, a.trackName, a.authorization, a.resumeOpId);
      return { subscribeId, trackAlias: session.getTrackAlias(subscribeId) } satisfies SubscribeResult;
    }
    case 'announce': {
      const a = args as Extract<WorkerRequest, { method: 'announce' }>['args'];
      if (!session) throw new Error('announce before connect');
      await session.announce(a.namespace, a.authorization);
      return;
    }
    case 'setAudioTrack': {
      const a = args as Extract<WorkerRequest, { method: 'setAudioTrack' }>['args'];
      jbuf = new JitterBufferCore({
        ...a.jbufConfig,
        sharedStorage: a.sharedStorage,
        sharedWritePos: a.sharedWritePos,
      });
      configureDecoder(a.decoderConfig);
      audioTrackAlias = a.trackAlias;
      return;
    }
    case 'sendDatagram': {
      const a = args as Extract<WorkerRequest, { method: 'sendDatagram' }>['args'];
      if (!connection) throw new Error('sendDatagram before connect');
      await connection.sendDatagram(a.bytes);
      return;
    }
    case 'setCaptureTrack': {
      const a = args as Extract<WorkerRequest, { method: 'setCaptureTrack' }>['args'];
      if (!connection) throw new Error('setCaptureTrack before connect');
      await stopCapture(); // replace any prior capture (re-subscribe / alias change)
      const conn = connection;
      const ring = new CaptureRing({
        numChannels: a.numChannels,
        capacityFrames: a.capacityFrames,
        sharedStorage: a.sharedStorage,
        sharedWritePos: a.sharedWritePos,
        sharedReadPos: a.sharedReadPos,
      });
      const ec = a.encoderConfig;
      captureEncoder = new CaptureEncoder({
        ring,
        trackAlias: a.trackAlias,
        sampleRate: ec.sampleRate,
        numChannels: ec.numberOfChannels,
        publisherPriority: a.publisherPriority,
        // Inject the real WebCodecs encoder + AudioData (kept out of CaptureEncoder so
        // its logic stays unit-testable). The output callback drives framing + send.
        makeEncoder: (onChunk: (chunk: EncodedChunkLike) => void): FrameEncoder => {
          const audioEncoder = new AudioEncoder({
            output: (chunk) => onChunk(chunk),
            error: (e) => emit({ kind: 'evt', type: 'notice', event: 'encode-error', detail: String(e) }),
          });
          audioEncoder.configure({
            codec: ec.codec,
            sampleRate: ec.sampleRate,
            numberOfChannels: ec.numberOfChannels,
            bitrate: ec.bitrate,
            opus: { frameDuration: ec.frameDurationUs },
          } as AudioEncoderConfig);
          return {
            encode: (samples, frames, timestampUs) => {
              const audioData = new AudioData({
                format: 'f32',
                sampleRate: ec.sampleRate,
                numberOfFrames: frames,
                numberOfChannels: ec.numberOfChannels,
                timestamp: timestampUs,
                // The view is the non-shared pcmScratch (offset 0); cast past the
                // ArrayBufferLike-vs-ArrayBuffer strictness. AudioData copies it
                // synchronously, so the scratch is reusable right after.
                data: samples as unknown as BufferSource,
              });
              try {
                audioEncoder.encode(audioData);
              } finally {
                audioData.close();
              }
            },
            flush: () => audioEncoder.flush(),
            close: () => {
              if (audioEncoder.state !== 'closed') audioEncoder.close();
            },
          };
        },
        send: (bytes) => {
          void conn.sendDatagram(bytes);
        },
      });
      captureSignal = a.sharedSignal;
      startCaptureLoop();
      return;
    }
    case 'stopCapture': {
      await stopCapture();
      return;
    }
    case 'startMessageLoop': {
      if (!session) throw new Error('startMessageLoop before connect');
      session.startMessageLoop();
      return;
    }
    case 'disconnect': {
      reading = false;
      await stopCapture();
      if (decoder) {
        try {
          decoder.close();
        } catch {
          /* ignore */
        }
        decoder = null;
      }
      if (session) {
        await session.close();
        session = null;
      }
      if (connection) {
        connection.close();
        connection = null;
      }
      jbuf = null;
      audioTrackAlias = undefined;
      return;
    }
    default: {
      throw new Error(`unknown method: ${String(method)}`);
    }
  }
}

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data as WorkerRequest;
  if (!msg || msg.kind !== 'req') return;
  handle(msg.method, msg.args).then(
    (result) => ctx.postMessage({ kind: 'res', id: msg.id, ok: true, result } satisfies WorkerOutbound),
    (err) => ctx.postMessage({ kind: 'res', id: msg.id, ok: false, error: String(err) } satisfies WorkerOutbound)
  );
};
