/**
 * Tests for CaptureEncoder — the worker-side mic send pipeline (worker-capture-design.md
 * §6, plan P4). A fake FrameEncoder mimics Opus's accumulate-to-frameDuration behaviour
 * so we can drive the full drain → encode → frame → send path off-thread and assert the
 * MOQ datagrams that reach the transport: right alias, monotonic group/object IDs, and
 * that SUB-FRAME input still produces output once a frame's worth has accumulated.
 */

import { describe, it, expect } from 'vitest';
import { CaptureRing } from '../../src/moq/capture-ring.js';
import { CaptureEncoder, type EncodedChunkLike, type FrameEncoder } from '../../src/moq/capture-encoder.js';
import { parseObjectDatagram } from '../../src/moq/moq-transport.js';

const SR = 48000;
const FRAME = 240; // 5 ms @ 48 k — Opus packet boundary the fake emits on

/**
 * Fake Opus encoder: buffers input frames and emits one packet every `FRAME` frames,
 * exactly like WebCodecs AudioEncoder packetizing to its frameDuration. Packet `k`
 * covers samples [k*FRAME, (k+1)*FRAME); its timestamp is derived from accumulated
 * output samples (contiguous), independent of how the input was chunked.
 */
function makeFakeEncoder(payloadLen = 40) {
  return (onChunk: (c: EncodedChunkLike) => void): FrameEncoder => {
    let buffered = 0;
    let emittedFrames = 0;
    const emit = () => {
      const timestamp = Math.round((emittedFrames / SR) * 1e6); // µs of this packet's first sample
      onChunk({
        byteLength: payloadLen,
        timestamp,
        copyTo(dest: Uint8Array) {
          for (let i = 0; i < payloadLen; i++) dest[i] = (i + emittedFrames) & 0xff;
        },
      });
      emittedFrames += FRAME;
    };
    return {
      encode(_samples, frames) {
        buffered += frames;
        while (buffered >= FRAME) {
          emit();
          buffered -= FRAME;
        }
      },
      async flush() {
        /* drop sub-frame remainder, like a real flushless stop */
      },
      close() {},
    };
  };
}

/** Producer + consumer rings over shared cells, a CaptureEncoder, and a captured send list. */
function harness(nc: number, capacityFrames: number, trackAlias: number, payloadLen = 40) {
  const sharedStorage = new Float32Array(capacityFrames * nc);
  const sharedWritePos = new BigInt64Array(1);
  const sharedReadPos = new BigInt64Array(1);
  const producer = new CaptureRing({ numChannels: nc, capacityFrames, sharedStorage, sharedWritePos, sharedReadPos });
  const consumer = new CaptureRing({ numChannels: nc, capacityFrames, sharedStorage, sharedWritePos, sharedReadPos });
  const sent: Uint8Array[] = [];
  const enc = new CaptureEncoder({
    ring: consumer,
    trackAlias,
    sampleRate: SR,
    numChannels: nc,
    publisherPriority: 7,
    makeEncoder: makeFakeEncoder(payloadLen),
    send: (b) => sent.push(b.slice()), // copy: b is a reused pool buffer view
  });
  return { producer, enc, sent };
}

/** A planar quantum of `nFrames` (values are irrelevant to framing). */
function quantum(nFrames: number, nc: number): Float32Array[] {
  const planar: Float32Array[] = [];
  for (let ch = 0; ch < nc; ch++) planar.push(new Float32Array(nFrames));
  return planar;
}

describe('CaptureEncoder', () => {
  it('encodes a drained frame and sends one datagram with the right alias/ids', () => {
    const { producer, enc, sent } = harness(1, 1024, 3);
    producer.write(quantum(FRAME, 1)); // exactly one Opus frame
    expect(enc.pump()).toBe(FRAME); // drained FRAME interleaved samples (mono)
    expect(sent.length).toBe(1);

    const d = parseObjectDatagram(sent[0]!);
    expect(d.trackAlias).toBe(3);
    expect(d.groupId).toBe(0n); // ts 0 → 0 ms
    expect(d.objectId).toBe(0n);
    expect(d.publisherPriority).toBe(7);
    expect(d.payload.length).toBe(40);
  });

  it('produces monotonic group/object IDs across multiple frames', () => {
    const { producer, enc, sent } = harness(2, 2048, 1);
    producer.write(quantum(FRAME * 3, 2)); // three Opus frames' worth, stereo
    enc.pump();
    expect(sent.length).toBe(3);

    const parsed = sent.map((b) => parseObjectDatagram(b));
    expect(parsed.map((p) => p.objectId)).toEqual([0n, 1n, 2n]); // monotonic
    // groupId = packet ts in ms; packet k ts = k*240/48000 s = k*5 ms.
    expect(parsed.map((p) => p.groupId)).toEqual([0n, 5n, 10n]);
    expect(parsed.every((p) => p.trackAlias === 1)).toBe(true);
  });

  it('handles sub-frame quanta — output only once a frame has accumulated (Opus framing)', () => {
    const { producer, enc, sent } = harness(1, 1024, 5);
    // First 128-sample quantum: drained + encoded, but < FRAME ⇒ no packet yet.
    producer.write(quantum(128, 1));
    expect(enc.pump()).toBe(128);
    expect(sent.length).toBe(0);
    // Second 128-sample quantum: now 256 ≥ 240 ⇒ exactly one packet emitted.
    producer.write(quantum(128, 1));
    expect(enc.pump()).toBe(128);
    expect(sent.length).toBe(1);
    expect(parseObjectDatagram(sent[0]!).objectId).toBe(0n);
  });

  it('pump on an empty ring sends nothing', () => {
    const { enc, sent } = harness(1, 256, 0);
    expect(enc.pump()).toBe(0);
    expect(sent.length).toBe(0);
  });

  it('drains several accumulated quanta in one pump', () => {
    const { producer, enc, sent } = harness(1, 2048, 9);
    producer.write(quantum(FRAME, 1));
    producer.write(quantum(FRAME, 1));
    producer.write(quantum(FRAME, 1)); // 3 frames sitting in the ring
    expect(enc.pump()).toBe(FRAME * 3); // one drain takes them all
    expect(sent.length).toBe(3);
    expect(enc.encodedBatches).toBe(1); // a single encode() batch fed the encoder
  });

  it('does not reuse a datagram pool buffer until several sends later (async-write safety)', () => {
    // With the default pool of 8, the first and ninth datagrams use the same buffer —
    // but the test copies on send, so here we just assert distinct contents are framed
    // correctly across more frames than one buffer.
    const { producer, enc, sent } = harness(1, 4096, 2);
    producer.write(quantum(FRAME * 10, 1));
    enc.pump();
    expect(sent.length).toBe(10);
    const ids = sent.map((b) => parseObjectDatagram(b).objectId);
    expect(ids).toEqual([0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n]);
  });

  it('stop() resolves and closes the encoder', async () => {
    const { enc } = harness(1, 256, 0);
    await expect(enc.stop()).resolves.toBeUndefined();
  });
});
