/**
 * capture-encoder.ts — the worker-side mic SEND pipeline (worker-capture-design.md §6).
 *
 * Drains the {@link CaptureRing} (filled by the capture worklet over the SAB), feeds the
 * PCM to an Opus encoder, frames each emitted packet as a MOQ OBJECT_DATAGRAM, and hands
 * the bytes to the transport — all on the worker thread, never touching main. This is
 * the send-side twin of the worker's decode path.
 *
 * The WebCodecs globals (`AudioEncoder` / `AudioData`) are INJECTED via `makeEncoder`,
 * so this whole pipeline — the drain, the group/object sequencing (lifted from
 * `AudioTrackPublisher`), the zero-alloc framing — is unit-testable off-thread with a
 * fake encoder and a fake send sink. `moq-worker.ts` supplies the real ones.
 *
 * Zero per-frame allocation (design §8): the drained PCM, the Opus bytes, and the
 * framed datagram all live in reused scratch buffers. The only forced per-frame
 * allocation is the `AudioData` the WebCodecs API requires (made inside `makeEncoder`).
 *
 * Opus owns the framing (design §5): we feed the encoder whatever the ring holds each
 * wake (even a sub-frame quantum) with monotonic timestamps; the encoder buffers to its
 * `frameDuration` and emits one packet per boundary. We never assemble frames ourselves.
 */

import type { CaptureRing } from './capture-ring.js';
import { encodeObjectDatagramInto, maxObjectDatagramSize } from './moq-transport.js';

/** Minimal view of an encoded Opus packet (WebCodecs `EncodedAudioChunk` duck type). */
export interface EncodedChunkLike {
  /** Encoded byte length. */
  readonly byteLength: number;
  /** Presentation timestamp in microseconds (propagated from the input AudioData). */
  readonly timestamp: number;
  /** Copy the encoded bytes into `dest` (must be >= byteLength). */
  copyTo(dest: Uint8Array): void;
}

/**
 * Frame-oriented encoder seam. `moq-worker.ts` implements this over a WebCodecs
 * `AudioEncoder` (+ `AudioData`); tests implement a fake that mimics Opus's
 * accumulate-to-`frameDuration` behaviour. The encoder's output is wired to the
 * `onChunk` callback {@link CaptureEncoder} passes to `makeEncoder`.
 */
export interface FrameEncoder {
  /** Encode `frames` interleaved frames from `samples` (length `frames*nc`) at `timestampUs`. */
  encode(samples: Float32Array, frames: number, timestampUs: number): void;
  flush(): Promise<void>;
  close(): void;
}

export interface CaptureEncoderConfig {
  ring: CaptureRing;
  /** Track alias the server assigned to our audio-in track. */
  trackAlias: number;
  sampleRate: number;
  numChannels: number;
  /** Publisher priority byte (0 = highest). Default 0. */
  publisherPriority?: number;
  /** Upper bound on an encoded Opus packet (scratch sizing). Default 4000. */
  maxPayloadBytes?: number;
  /**
   * Round-robin datagram buffer count. The transport's `send` may read the bytes
   * asynchronously, so a framed datagram must not be overwritten until its write has
   * drained — we cycle through a small pool instead of reusing one buffer (or
   * allocating per frame). Default 8 (≈40 ms of frames; writes complete far sooner).
   */
  datagramPoolSize?: number;
  /** Construct the frame encoder, wiring its output to `onChunk`. */
  makeEncoder: (onChunk: (chunk: EncodedChunkLike) => void) => FrameEncoder;
  /** Send a framed datagram (the worker writes it to the transport). */
  send: (bytes: Uint8Array) => void;
}

/**
 * Drains a CaptureRing and publishes Opus frames as MOQ datagrams. Call {@link pump}
 * on each §6.1 wake; call {@link stop} to flush + close on teardown.
 */
export class CaptureEncoder {
  private readonly ring: CaptureRing;
  private readonly trackAlias: number;
  private readonly sampleRate: number;
  private readonly nc: number;
  private readonly priority: number;
  private readonly encoder: FrameEncoder;
  private readonly send: (bytes: Uint8Array) => void;

  // Reused scratch — the zero-alloc hot path (design §6/§8).
  private readonly pcmScratch: Float32Array; // drained interleaved PCM
  private readonly bytesScratch: Uint8Array; // Opus bytes (encoder output copyTo)
  private readonly dgPool: Uint8Array[]; // framed OBJECT_DATAGRAMs, round-robin (see config)
  private dgPoolIdx: number;

  // Sequencing (lifted from AudioTrackPublisher): input timestamp is a running sample
  // count; objectId is a monotonic counter; groupId is the chunk timestamp in ms.
  private samplesSent: number;
  private objectSeq: bigint;

  // Observability.
  encodedBatches: number;
  sentDatagrams: number;
  droppedOversize: number;

  constructor(cfg: CaptureEncoderConfig) {
    this.ring = cfg.ring;
    this.trackAlias = cfg.trackAlias;
    this.sampleRate = cfg.sampleRate;
    this.nc = cfg.numChannels;
    this.priority = cfg.publisherPriority ?? 0;
    this.send = cfg.send;

    const maxPayload = cfg.maxPayloadBytes ?? 4000;
    this.pcmScratch = new Float32Array(cfg.ring.capacity * this.nc); // holds a full ring drain
    this.bytesScratch = new Uint8Array(maxPayload);
    const poolSize = cfg.datagramPoolSize ?? 8;
    this.dgPool = [];
    for (let i = 0; i < poolSize; i++) {
      this.dgPool.push(new Uint8Array(maxObjectDatagramSize(maxPayload)));
    }
    this.dgPoolIdx = 0;

    this.samplesSent = 0;
    this.objectSeq = 0n;
    this.encodedBatches = 0;
    this.sentDatagrams = 0;
    this.droppedOversize = 0;

    // Wire the encoder's output back to our framing/send.
    this.encoder = cfg.makeEncoder((chunk) => this.handleChunk(chunk));
  }

  /**
   * Drain all PCM currently in the ring and feed it to the encoder as one AudioData.
   * Called on each wake (design §6.1). Returns the interleaved sample count encoded (0
   * if the ring was empty). Opus does the 240-frame packetization internally.
   */
  pump(): number {
    const n = this.ring.drain(this.pcmScratch);
    if (n <= 0) {
      return 0;
    }
    const frames = n / this.nc;
    // Running-sample-count timestamp (µs), monotonic and contiguous across pumps.
    const timestampUs = Math.round((this.samplesSent / this.sampleRate) * 1e6);
    this.encoder.encode(this.pcmScratch.subarray(0, n), frames, timestampUs);
    this.samplesSent += frames;
    this.encodedBatches++;
    return n;
  }

  /** Encoder output: frame the Opus packet into reused scratch and send it. No alloc. */
  private handleChunk(chunk: EncodedChunkLike): void {
    const size = chunk.byteLength;
    if (size === 0) {
      return; // never publish a header-only (zero-Opus-payload) audio datagram
    }
    if (size > this.bytesScratch.length) {
      this.droppedOversize++; // pathological packet larger than scratch — drop it
      return;
    }
    chunk.copyTo(this.bytesScratch);
    // groupId = chunk timestamp in ms; objectId = monotonic counter (AudioTrackPublisher parity).
    const groupId = BigInt(Math.floor(chunk.timestamp / 1000));
    const objectId = this.objectSeq++;
    // Frame into the next pool buffer (not reused until the write has long drained).
    const dg = this.dgPool[this.dgPoolIdx]!;
    this.dgPoolIdx = (this.dgPoolIdx + 1) % this.dgPool.length;
    const len = encodeObjectDatagramInto(
      dg,
      this.trackAlias,
      groupId,
      objectId,
      this.priority,
      this.bytesScratch.subarray(0, size)
    );
    this.send(dg.subarray(0, len));
    this.sentDatagrams++;
  }

  /** Flush any buffered Opus packet (fires `handleChunk`) and close the encoder. */
  async stop(): Promise<void> {
    try {
      await this.encoder.flush();
    } catch {
      /* encoder may already be erroring/closed */
    }
    this.encoder.close();
  }
}
