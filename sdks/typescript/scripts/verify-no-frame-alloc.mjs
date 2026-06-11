/**
 * Verifies the mic SEND hot path allocates NO backing typed-array buffers per frame
 * (worker-capture-plan.md P6 / design §8). Runs CaptureEncoder over many frames with a
 * fake encoder + real CaptureRing and asserts zero `new Float32Array(n)` /
 * `new Uint8Array(n)` BACKING allocations in steady state.
 *
 * Counting trick: a view from `.subarray()` constructs via the species constructor with
 * a (buffer, offset, length) signature — its first arg is a buffer, not a number — so we
 * count only constructions whose first arg is a number (real backing allocations) and
 * ignore views. Reflect.construct WITHOUT a newTarget keeps instances "real", so their
 * subarray species is the real constructor and never re-enters the proxy.
 *
 * Run against dist after a build:  npm run build && npm run verify:no-frame-alloc
 *
 * The RECEIVE path mirrors this (moq-worker.ts decoder output reuses a grow-on-demand
 * `decodePcm` scratch); that lives in the worker shell and is covered by code review +
 * the P7 browser pass.
 */
import { CaptureRing, CaptureEncoder } from '../dist/moq/index.js';

const RealF32 = globalThis.Float32Array;
const RealU8 = globalThis.Uint8Array;
let f32Allocs = 0;
let u8Allocs = 0;

globalThis.Float32Array = new Proxy(RealF32, {
  construct(target, args) {
    if (typeof args[0] === 'number') f32Allocs++;
    return Reflect.construct(target, args); // no newTarget ⇒ real instance, real species
  },
});
globalThis.Uint8Array = new Proxy(RealU8, {
  construct(target, args) {
    if (typeof args[0] === 'number') u8Allocs++;
    return Reflect.construct(target, args);
  },
});

const SR = 48000;
const FRAME = 240; // Opus packet boundary the fake emits on
const NC = 1;
const CAP = 4096;

// Harness-owned buffers (use the real ctors; not part of the measured loop anyway).
const sharedStorage = new RealF32(CAP * NC);
const sharedWritePos = new BigInt64Array(1);
const sharedReadPos = new BigInt64Array(1);
const producer = new CaptureRing({ numChannels: NC, capacityFrames: CAP, sharedStorage, sharedWritePos, sharedReadPos });
const consumer = new CaptureRing({ numChannels: NC, capacityFrames: CAP, sharedStorage, sharedWritePos, sharedReadPos });

const fakeEncoder = (onChunk) => {
  let buffered = 0;
  let emitted = 0;
  return {
    encode(_samples, frames) {
      buffered += frames;
      while (buffered >= FRAME) {
        onChunk({
          byteLength: 40,
          timestamp: Math.round((emitted / SR) * 1e6),
          copyTo(dest) {
            for (let i = 0; i < 40; i++) dest[i] = i & 0xff;
          },
        });
        emitted += FRAME;
        buffered -= FRAME;
      }
    },
    async flush() {},
    close() {},
  };
};

let sent = 0;
const enc = new CaptureEncoder({
  ring: consumer,
  trackAlias: 1,
  sampleRate: SR,
  numChannels: NC,
  makeEncoder: fakeEncoder,
  send: () => {
    sent++;
  },
});

const quantum = [new RealF32(128)]; // reused planar input (allocated once, pre-measure)

// Warm up so any one-time growth settles.
for (let i = 0; i < 10; i++) {
  producer.write(quantum);
  enc.pump();
}

// Measure the steady-state loop.
const f0 = f32Allocs;
const u0 = u8Allocs;
const sent0 = sent;
const N = 500;
for (let i = 0; i < N; i++) {
  producer.write(quantum);
  enc.pump();
}
const dF = f32Allocs - f0;
const dU = u8Allocs - u0;
const framesSent = sent - sent0;

let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) failures++;
};

check(`actually encoded+sent frames (${framesSent} over ${N} pumps)`, framesSent > 0);
check(`no Float32Array backing alloc in steady state (saw ${dF})`, dF === 0);
check(`no Uint8Array backing alloc in steady state (saw ${dU})`, dU === 0);

if (failures) {
  console.error(`\n${failures} no-frame-alloc check(s) failed`);
  process.exit(1);
}
console.log('\nsend hot path is allocation-free (per frame)');
