/**
 * Tests the playout AudioWorklet WITHOUT a browser by evaluating the generated
 * worklet source in a stubbed AudioWorkletGlobalScope (exactly what the browser
 * does with the Blob). This validates both the `.toString()` serialization
 * (the core must be self-contained) and the processor's write/read/deinterleave/
 * stats logic. The live in-browser smoke test comes with the test page (Phase 4).
 */

import {
  buildPlayoutWorkletCode,
  PLAYOUT_PROCESSOR_NAME,
  type PlayoutProcessorOptions,
  type PlayoutStatsMessage,
} from '../../src/moq/playout-worklet.js';

interface FakePort {
  onmessage: ((e: { data: Float32Array }) => void) | null;
  posted: unknown[];
  postMessage(m: unknown): void;
}

interface WorkletProcessor {
  port: FakePort;
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}

/** Eval the worklet source in a stubbed scope and instantiate the processor. */
function instantiate(options: { processorOptions: PlayoutProcessorOptions }): WorkletProcessor {
  let RegisteredClass: (new (o: unknown) => WorkletProcessor) | null = null;
  let registeredName = '';

  class FakeAudioWorkletProcessor {
    port: FakePort;
    constructor() {
      this.port = {
        onmessage: null,
        posted: [],
        postMessage(m: unknown) {
          this.posted.push(m);
        },
      };
    }
  }
  const registerProcessor = (name: string, cls: new (o: unknown) => WorkletProcessor) => {
    registeredName = name;
    RegisteredClass = cls;
  };

  const code = buildPlayoutWorkletCode();
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('AudioWorkletProcessor', 'registerProcessor', code)(FakeAudioWorkletProcessor, registerProcessor);

  expect(registeredName).toBe(PLAYOUT_PROCESSOR_NAME);
  expect(RegisteredClass).not.toBeNull();
  return new RegisteredClass!(options);
}

/** Fresh stereo output frame: one output, 2 channels of 128 samples. */
function stereoOut(): Float32Array[][] {
  return [[new Float32Array(128), new Float32Array(128)]];
}

/** Interleaved stereo PCM ramp: frame i → L=i, R=i+0.5 (exact in f32). */
function rampPcm(frames: number): Float32Array {
  const pcm = new Float32Array(frames * 2);
  for (let i = 0; i < frames; i++) {
    pcm[i * 2] = i;
    pcm[i * 2 + 1] = i + 0.5;
  }
  return pcm;
}

const STEREO_CFG: { processorOptions: PlayoutProcessorOptions } = {
  processorOptions: {
    config: { numChannels: 2, readerFrame: 128, writerFrame: 240 },
    statsEvery: 5,
  },
};

describe('playout worklet', () => {
  it('the generated source is self-contained and registers the processor', () => {
    const code = buildPlayoutWorkletCode();
    expect(code).toContain('class JitterBufferCore');
    expect(code).toContain('class PlayoutRingProcessor extends AudioWorkletProcessor');
    expect(code).toContain(`registerProcessor("${PLAYOUT_PROCESSOR_NAME}"`);
    // No leftover module references that would be undefined in the worklet.
    expect(code).not.toContain('PLAYOUT_TUNING');
    expect(code).not.toContain('import ');
    expect(code).not.toContain('export ');
    // It must actually evaluate in a bare scope.
    expect(() => instantiate(STEREO_CFG)).not.toThrow();
  });

  it('outputs silence before enough audio is buffered (startup)', () => {
    const p = instantiate(STEREO_CFG);
    const out = stereoOut();
    expect(p.process([], out)).toBe(true);
    expect(Array.from(out[0]![0]!).every((v) => v === 0)).toBe(true);
    expect(Array.from(out[0]![1]!).every((v) => v === 0)).toBe(true);
  });

  it('plays buffered audio and keeps L/R sample-locked after deinterleave', () => {
    const p = instantiate(STEREO_CFG);
    // Prime past snapTarget (floor 176 + L 240 + W 240 = 656 frames).
    p.port.onmessage!({ data: rampPcm(1000) });

    const out = stereoOut();
    p.process([], out);
    const left = out[0]![0]!;
    const right = out[0]![1]!;

    // snap rp = 1000 - 656 = 344 ⇒ first output frame is ring frame 344.
    expect(left[0]).toBe(344);
    // Every frame: R = L + 0.5 — the deinterleave never decorrelates the channels.
    for (let i = 0; i < 128; i++) {
      expect(right[i]! - left[i]!).toBeCloseTo(0.5, 5);
    }
    // And it actually advanced through the ramp (not all one value).
    expect(left[127]).toBe(344 + 127);
  });

  it('emits a stats snapshot every statsEvery reads', () => {
    const p = instantiate(STEREO_CFG);
    p.port.onmessage!({ data: rampPcm(2000) });
    for (let i = 0; i < 5; i++) p.process([], stereoOut());

    const stats = p.port.posted.filter((m): m is PlayoutStatsMessage => (m as PlayoutStatsMessage).type === 'stats');
    expect(stats.length).toBe(1); // statsEvery = 5 ⇒ exactly one after 5 reads
    const snap = stats[0]!.snapshot;
    expect(snap.started).toBe(true);
    expect(snap.fillFrames).toBeGreaterThan(0);
    expect(snap.floorFrames).toBe(176); // R 128 + S 48
    expect(snap.lowAllowanceFrames).toBe(240); // L_init 5ms
  });

  it('accepts a transferred pcmPort and writes PCM arriving on it (worker mode)', () => {
    const p = instantiate(STEREO_CFG);
    // Fake the receive Worker's MessagePort.
    const pcmPort: { onmessage: ((e: { data: Float32Array }) => void) | null; start: () => void } = {
      onmessage: null,
      start: () => {},
    };
    // Handshake: hand the worklet the port.
    p.port.onmessage!({ data: { type: 'pcmPort', port: pcmPort } as unknown as Float32Array });
    expect(pcmPort.onmessage).toBeTypeOf('function');

    // PCM now arrives on the pcmPort, not on this.port.
    pcmPort.onmessage!({ data: rampPcm(1000) });
    const out = stereoOut();
    p.process([], out);
    // Same geometry as the direct-PCM test: rp = 1000 - 656 = 344.
    expect(out[0]![0]![0]).toBe(344);
    expect(out[0]![0]![127]).toBe(344 + 127);
  });

  it('handles mono config too', () => {
    const p = instantiate({ processorOptions: { config: { numChannels: 1, readerFrame: 128, writerFrame: 240 } } });
    const mono = new Float32Array(800);
    for (let i = 0; i < mono.length; i++) mono[i] = i;
    p.port.onmessage!({ data: mono });
    const out: Float32Array[][] = [[new Float32Array(128)]];
    p.process([], out);
    // snapTarget 656 ⇒ rp = 800 - 656 = 144; first sample = ring[144] = 144.
    expect(out[0]![0]![0]).toBe(144);
    expect(out[0]![0]![127]).toBe(144 + 127);
  });
});
