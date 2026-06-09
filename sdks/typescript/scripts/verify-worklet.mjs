/**
 * Verifies the BUILT playout worklet is self-contained and runs — against
 * dist/, because the vite build target (not vitest's esbuild) decides whether
 * the serialized JitterBufferCore class is self-contained (class fields must
 * stay native, no `__publicField` helper). Run after `npm run build`:
 *
 *   npm run build && npm run verify:worklet
 *
 * Exits non-zero on any failure so it can gate a release.
 */
import { buildPlayoutWorkletCode } from '../dist/moq/index.js';

let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) failures++;
};

const code = buildPlayoutWorkletCode();
check('binds JitterBufferCore as a const (robust to anonymous-class emit)', /^const JitterBufferCore = class\b/.test(code));
check('no __publicField helper', !code.includes('__publicField'));
check('has the processor', code.includes('extends AudioWorkletProcessor'));
check('no import/export', !/(^|[^.])\b(import|export)\b/.test(code));

// Evaluate in a stubbed AudioWorkletGlobalScope (what the browser does) and run.
let Cls = null;
class FakeAWP {
  constructor() {
    this.port = { onmessage: null, postMessage() {} };
  }
}
new Function('AudioWorkletProcessor', 'registerProcessor', code)(FakeAWP, (_n, c) => {
  Cls = c;
});
check('processor registered', Cls !== null);

const p = new Cls({ processorOptions: { config: { numChannels: 2, readerFrame: 128, writerFrame: 240 } } });
const pcm = new Float32Array(2000);
for (let i = 0; i < 1000; i++) {
  pcm[i * 2] = i;
  pcm[i * 2 + 1] = i + 0.5;
}
p.port.onmessage({ data: pcm });
const out = [[new Float32Array(128), new Float32Array(128)]];
p.process([], out);
check('plays buffered audio (L[0] == 344, the snap point)', out[0][0][0] === 344);
check('L/R sample-locked after deinterleave', out[0][1][0] - out[0][0][0] === 0.5);
check('advances through the ramp (L[127] == 471)', out[0][0][127] === 471);

if (failures) {
  console.error(`\n${failures} worklet check(s) failed`);
  process.exit(1);
}
console.log('\nbuilt playout worklet OK');
