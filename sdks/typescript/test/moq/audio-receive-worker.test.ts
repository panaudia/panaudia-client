/**
 * Tests the receive Worker WITHOUT a browser by evaluating its generated source
 * in a stubbed DedicatedWorkerGlobalScope (exactly what the browser does with the
 * Blob). Validates the `.toString()` serialization of the MOQ parse helpers (they
 * must be self-contained) and the read-loop routing: the audio trackAlias is
 * decoded → posted to the pcmPort; every other alias is forwarded to the main
 * thread. The live in-browser smoke test is plan Phase 5d.
 */

import { describe, it, expect } from 'vitest';
import {
  buildReceiveWorkerCode,
  routeDatagram,
  type ReceiveWorkerOutbound,
} from '../../src/moq/audio-receive-worker.js';
import { buildObjectDatagram } from '../../src/moq/moq-transport.js';

describe('routeDatagram', () => {
  it('forwards everything until the audio alias is known', () => {
    expect(routeDatagram(5, undefined)).toBe('forward');
    expect(routeDatagram(0, undefined)).toBe('forward');
  });
  it('decodes the audio alias, forwards the rest', () => {
    expect(routeDatagram(7, 7)).toBe('decode');
    expect(routeDatagram(8, 7)).toBe('forward');
  });
});

/** A one-shot fake reader yielding the queued chunks then `{done:true}`. */
function fakeReadable(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return {
    getReader() {
      return {
        read: async () =>
          i < chunks.length ? { value: chunks[i++], done: false } : { value: undefined, done: true },
        cancel: async () => {},
      };
    },
  } as unknown as ReadableStream<Uint8Array>;
}

interface DriveResult {
  pcmPosts: Float32Array[];
  mainPosts: ReceiveWorkerOutbound[];
  decoded: Uint8Array[];
  decoderConfigured: number;
}

/**
 * Eval the worker source in a stubbed scope, deliver the given inbound messages
 * in order, drain microtasks, and return what reached the pcmPort / main thread.
 */
async function driveWorker(messages: unknown[]): Promise<DriveResult> {
  const pcmPosts: Float32Array[] = [];
  const mainPosts: ReceiveWorkerOutbound[] = [];
  const decoded: Uint8Array[] = [];
  let decoderConfigured = 0;
  let outputCb: ((d: unknown) => void) | null = null;

  const pcmPort = {
    postMessage: (m: Float32Array) => pcmPosts.push(m),
  };

  // Stubbed worker globals.
  const self: { onmessage: ((e: { data: unknown }) => void) | null; postMessage: (m: unknown) => void } = {
    onmessage: null,
    postMessage: (m: unknown) => mainPosts.push(m as ReceiveWorkerOutbound),
  };
  class FakeAudioDecoder {
    constructor(init: { output: (d: unknown) => void }) {
      outputCb = init.output;
    }
    configure() {
      decoderConfigured++;
    }
    decode(chunk: { data: Uint8Array }) {
      decoded.push(chunk.data);
      // Simulate async decode → a 2-frame stereo AudioData for the output callback.
      outputCb?.({
        numberOfFrames: 2,
        numberOfChannels: 2,
        copyTo: (dst: Float32Array) => dst.fill(0.25),
        close: () => {},
      });
    }
    close() {}
  }
  class FakeEncodedAudioChunk {
    data: Uint8Array;
    type: string;
    timestamp: number;
    constructor(init: { data: Uint8Array; type: string; timestamp: number }) {
      this.data = init.data;
      this.type = init.type;
      this.timestamp = init.timestamp;
    }
  }

  const code = buildReceiveWorkerCode();
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('self', 'AudioDecoder', 'EncodedAudioChunk', code)(
    self,
    FakeAudioDecoder,
    FakeEncodedAudioChunk
  );
  expect(self.onmessage).toBeTypeOf('function');

  for (const data of messages) {
    // Inject our capturing pcmPort into the init message so we observe its PCM.
    if (data && typeof data === 'object' && (data as { type?: string }).type === 'init') {
      (data as { pcmPort: unknown }).pcmPort = pcmPort;
    }
    self.onmessage!({ data });
    // Let the read loop's awaited reads resolve between messages.
    await Promise.resolve();
    await Promise.resolve();
  }
  // Drain the read loop to completion.
  for (let k = 0; k < 10; k++) await Promise.resolve();

  return { pcmPosts, mainPosts, decoded, decoderConfigured };
}

describe('receive worker runtime (stubbed scope)', () => {
  const AUDIO_ALIAS = 7;
  const STATE_ALIAS = 3;
  const opus = new Uint8Array([0xaa, 0xbb, 0xcc]);
  const state = new Uint8Array([0x01, 0x02]);

  it('decodes the audio alias to the pcmPort and forwards non-audio to main', async () => {
    const audioDg = buildObjectDatagram(AUDIO_ALIAS, 1n, 0n, 0, opus);
    const stateDg = buildObjectDatagram(STATE_ALIAS, 2n, 0n, 0, state);

    const { pcmPosts, mainPosts, decoded, decoderConfigured } = await driveWorker([
      // audio config must arrive before the loop sees the audio datagram
      { type: 'audio', audioTrackAlias: AUDIO_ALIAS, decoderConfig: { codec: 'opus', sampleRate: 48000, numberOfChannels: 2 } },
      { type: 'init', readable: fakeReadable([audioDg, stateDg]), pcmPort: null },
    ]);

    expect(decoderConfigured).toBe(1);
    // audio datagram → decoded → pcmPort PCM (2 frames * 2 ch = 4 samples)
    expect(decoded).toHaveLength(1);
    expect(Array.from(decoded[0]!)).toEqual(Array.from(opus));
    expect(pcmPosts).toHaveLength(1);
    expect(pcmPosts[0]!.length).toBe(4);

    // state datagram → forwarded to main
    const forwarded = mainPosts.filter((m) => m.type === 'datagram');
    expect(forwarded).toHaveLength(1);
    const fwd = forwarded[0]!;
    if (fwd.type === 'datagram') {
      expect(fwd.trackAlias).toBe(STATE_ALIAS);
      expect(Array.from(fwd.payload)).toEqual(Array.from(state));
    }
  });

  it('forwards audio too when the alias is not yet known (pre-subscribe)', async () => {
    const audioDg = buildObjectDatagram(AUDIO_ALIAS, 1n, 0n, 0, opus);
    const { pcmPosts, mainPosts, decoded } = await driveWorker([
      { type: 'init', readable: fakeReadable([audioDg]), pcmPort: null },
    ]);
    expect(decoded).toHaveLength(0);
    expect(pcmPosts).toHaveLength(0);
    expect(mainPosts.filter((m) => m.type === 'datagram')).toHaveLength(1);
  });
});
