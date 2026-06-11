/**
 * Verifies the BUILT capture worklet is self-contained and runs — against dist/,
 * because the vite build target (not vitest's esbuild) decides whether the serialized
 * CaptureRing class is self-contained (no `__publicField` helper). Run after build:
 *
 *   npm run build && npm run verify:capture-worklet
 *
 * Exits non-zero on any failure so it can gate a release. Mirror of verify-worklet.mjs.
 */
import { buildCaptureWorkletCode, CAPTURE_PROCESSOR_NAME, CaptureRing } from '../dist/moq/index.js';

let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) failures++;
};

const code = buildCaptureWorkletCode();
check('binds CaptureRing as a const (robust to anonymous-class emit)', /^const CaptureRing = class\b/.test(code));
check('no __publicField helper', !code.includes('__publicField'));
check('has the processor', code.includes('extends AudioWorkletProcessor'));
check('no import/export', !/(^|[^.])\b(import|export)\b/.test(code));

// Evaluate in a stubbed AudioWorkletGlobalScope (what the browser does) and run.
let Cls = null;
let registeredName = '';
class FakeAWP {
  constructor() {
    this.port = { onmessage: null, postMessage() {} };
  }
}
new Function('AudioWorkletProcessor', 'registerProcessor', code)(FakeAWP, (n, c) => {
  registeredName = n;
  Cls = c;
});
check('processor registered under the expected name', registeredName === CAPTURE_PROCESSOR_NAME && Cls !== null);

// Shared memory (Node has SharedArrayBuffer); a consumer CaptureRing reads back.
const NC = 2;
const CAP = 64;
const sharedStorage = new Float32Array(new SharedArrayBuffer(4 * CAP * NC));
const sharedWritePos = new BigInt64Array(new SharedArrayBuffer(8));
const sharedReadPos = new BigInt64Array(new SharedArrayBuffer(8));
const signal = new Int32Array(new SharedArrayBuffer(4));

const proc = new Cls({
  processorOptions: { numChannels: NC, capacityFrames: CAP, sharedStorage, sharedWritePos, sharedReadPos, signal },
});

// One planar quantum: L=[10,11,12,13], R=[10.25,11.25,12.25,13.25].
const left = Float32Array.from([10, 11, 12, 13]);
const right = Float32Array.from([10.25, 11.25, 12.25, 13.25]);
proc.process([[left, right]]);

check('signalled the worker once', Atomics.load(signal, 0) === 1);

const consumer = new CaptureRing({ numChannels: NC, capacityFrames: CAP, sharedStorage, sharedWritePos, sharedReadPos });
const dst = new Float32Array(8);
const n = consumer.drain(dst);
check('drained one interleaved frame block', n === 8);
check(
  'interleaved L/R correctly',
  dst[0] === 10 && dst[1] === 10.25 && dst[6] === 13 && dst[7] === 13.25
);

if (failures) {
  console.error(`\n${failures} capture-worklet check(s) failed`);
  process.exit(1);
}
console.log('\nbuilt capture worklet OK');
