/**
 * Verifies the BUILT receive worker is self-contained and runs — against dist/,
 * because the vite/Rollup build (not vitest's esbuild) decides whether the
 * serialized cross-references survive: the worker concatenates
 * JitterBufferCore + decodeVarint + parseObjectDatagram via `.toString()`, and
 * `parseObjectDatagram` calls `decodeVarint` by name while the worker calls
 * `JitterBufferCore.write`. A rename or helper-lowering in the build would make
 * the worker throw at runtime (silently skipping every datagram). Run after build:
 *
 *   npm run build && npm run verify:receive-worker
 *
 * Exits non-zero on any failure so it can gate a release.
 */
import {
  buildReceiveWorkerCode,
  computeJitterCapacity,
  buildObjectDatagram,
} from '../dist/moq/index.js';

let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) failures++;
};

const code = buildReceiveWorkerCode();
check('binds JitterBufferCore as a const (robust to anonymous-class emit)', /^const JitterBufferCore = class\b/.test(code));
check('contains parseObjectDatagram', code.includes('parseObjectDatagram'));
check('contains decodeVarint', code.includes('decodeVarint'));
check('registers self.onmessage', code.includes('self.onmessage'));
check('no __publicField helper', !code.includes('__publicField'));
check('no import/export', !/(^|[^.])\b(import|export)\b/.test(code));

// Drive the worker in a stubbed DedicatedWorkerGlobalScope: SAB mode, one audio
// datagram. If the cross-refs survived, it parses → decodes → writes the SAB ring.
const cfg = { numChannels: 2, readerFrame: 128, writerFrame: 240, sampleRate: 48000 };
const { capacity, nc } = computeJitterCapacity(cfg);
const storage = new Float32Array(new SharedArrayBuffer(capacity * nc * 4));
const writePos = new BigInt64Array(new SharedArrayBuffer(8));
const AUDIO_ALIAS = 7;
const datagram = buildObjectDatagram(AUDIO_ALIAS, 1n, 0n, 0, new Uint8Array([0xaa, 0xbb, 0xcc]));

let outputCb = null;
class FakeAudioDecoder {
  constructor(init) { outputCb = init.output; }
  configure() {}
  decode() {
    outputCb?.({
      numberOfFrames: 2,
      numberOfChannels: 2,
      copyTo: (dst) => dst.fill(0.25),
      close: () => {},
    });
  }
  close() {}
}
class FakeEncodedAudioChunk {
  constructor(init) { Object.assign(this, init); }
}
const self = { onmessage: null, postMessage() {} };
const fakeReadable = () => {
  let sent = false;
  return { getReader: () => ({ read: async () => (sent ? { done: true } : ((sent = true), { value: datagram, done: false })), cancel: async () => {} }) };
};

new Function('self', 'AudioDecoder', 'EncodedAudioChunk', code)(self, FakeAudioDecoder, FakeEncodedAudioChunk);
check('registered onmessage handler', typeof self.onmessage === 'function');

self.onmessage({ data: { type: 'audio', audioTrackAlias: AUDIO_ALIAS, decoderConfig: { codec: 'opus', sampleRate: 48000, numberOfChannels: 2 }, jbufConfig: cfg, sharedStorage: storage, sharedWritePos: writePos } });
self.onmessage({ data: { type: 'init', readable: fakeReadable() } });
await new Promise((r) => setTimeout(r, 50)); // let the async read loop + decode run

check('decoded audio written to SAB ring (writePos advanced)', Number(Atomics.load(writePos, 0)) === 2);
check('SAB ring holds the decoded PCM (0.25)', storage[0] === 0.25);

if (failures) {
  console.error(`\n${failures} receive-worker check(s) failed`);
  process.exit(1);
}
console.log('\nbuilt receive worker OK');
