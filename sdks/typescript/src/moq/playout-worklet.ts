/**
 * playout-worklet.ts — the AudioWorklet wrapper around {@link JitterBufferCore}
 * for MOQ playout (design: spatial-mixer/plan/browser-audio/playout-v3-design.md
 * §5.1, plan Phase 2).
 *
 * The ring lives entirely inside the worklet: `onmessage` (decoded PCM from the
 * main thread) is the WRITER and `process()` (the 128-frame render quantum) is
 * the READER — both on the audio thread, so there are no atomics. The buffer
 * holds interleaved frames; `process()` deinterleaves the 128-frame block into
 * the per-channel `outputs[0][ch]` (Web Audio is always planar), keeping the
 * binaural L/R sample-locked.
 *
 * **Build-free loading.** A worklet loaded via Blob URL cannot `import` app
 * modules at runtime, so we serialize the (self-contained) core class via
 * `.toString()` and concatenate it with the processor source into one Blob — the
 * same pattern as the capture worklet in `opus-encoder.ts`, but with the core's
 * single source of truth preserved (no duplicated logic). The core's constructor
 * inlines its default literals precisely so this serialization stays valid under
 * a minified build (no free module-scope references).
 */

import { JitterBufferCore, type JitterBufferCoreConfig, type JitterBufferSnapshot } from './jitter-buffer-core.js';

/** The name the processor registers under / that `AudioWorkletNode` references. */
export const PLAYOUT_PROCESSOR_NAME = 'playout-processor';

/** `processorOptions` passed to the worklet via `new AudioWorkletNode(...)`. */
export interface PlayoutProcessorOptions {
  /** Buffer geometry/tuning. The worklet builds a {@link JitterBufferCore} from it. */
  config: JitterBufferCoreConfig;
  /** Emit a stats snapshot every N reads (~250 ms at 48 kHz). Default 94. */
  statsEvery?: number;
}

/** Message posted from the worklet to the main thread every `statsEvery` reads. */
export interface PlayoutStatsMessage {
  type: 'stats';
  snapshot: JitterBufferSnapshot;
}

/**
 * Handshake posted TO the worklet (`workletNode.port.postMessage(msg, [msg.port])`)
 * to hand it the receive Worker's PCM port. After this, decoded PCM arrives on
 * `port` instead of the main-thread `workletNode.port` (design §11.3).
 */
export interface PlayoutPcmPortMessage {
  type: 'pcmPort';
  port: MessagePort;
}

/**
 * The processor source, as plain JS text (it runs in AudioWorkletGlobalScope and
 * references `AudioWorkletProcessor` / `registerProcessor`, so it cannot be a
 * normal imported module). It depends only on `JitterBufferCore`, which is
 * prepended by {@link buildPlayoutWorkletCode}. ~250 ms ≈ 94 reads at the
 * 128-sample / 48 kHz quantum.
 */
const PLAYOUT_PROCESSOR_SOURCE = `
class PlayoutRingProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.core = new JitterBufferCore(opts.config || {});
    this.nc = this.core.nc;
    this.statsEvery = opts.statsEvery || 94;
    this.readsSinceStats = 0;
    this.scratch = new Float32Array(128 * this.nc);
    this.pcmPort = null;
    // WRITER inputs arrive on this.port:
    //   • {type:'pcmPort', port} — a transferred MessagePort whose other end is
    //     held by the receive Worker (worker mode, design §11.3); PCM flows
    //     worker → worklet directly, never touching the main thread.
    //   • a Float32Array — decoded PCM posted directly from the main thread
    //     (fallback path when the receive Worker is unavailable, design §11.8).
    // this.port stays the OUTBOUND stats channel either way.
    const onPcm = (pcm) => { if (pcm && pcm.length) this.core.write(pcm); };
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d && d.type === 'pcmPort' && d.port) {
        this.pcmPort = d.port;
        this.pcmPort.onmessage = (ev) => onPcm(ev.data);
        if (this.pcmPort.start) this.pcmPort.start();
        return;
      }
      onPcm(d);
    };
  }

  // READER: pull one render quantum from the ring, deinterleave to outputs.
  process(_inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length === 0 || !out[0]) return true;
    const nFrames = out[0].length;
    const nc = this.nc;
    const need = nFrames * nc;
    if (this.scratch.length < need) this.scratch = new Float32Array(need);
    const block = this.scratch.subarray(0, need);
    // core.read zeroes the block on startup/underrun, so silence falls through.
    this.core.read(block);
    for (let ch = 0; ch < out.length; ch++) {
      const dst = out[ch];
      const srcCh = ch < nc ? ch : nc - 1;
      for (let i = 0; i < nFrames; i++) dst[i] = block[i * nc + srcCh];
    }
    if (++this.readsSinceStats >= this.statsEvery) {
      this.readsSinceStats = 0;
      this.port.postMessage({ type: 'stats', snapshot: this.core.snapshot() });
    }
    return true;
  }
}
registerProcessor(${JSON.stringify(PLAYOUT_PROCESSOR_NAME)}, PlayoutRingProcessor);
`;

/**
 * Build the full worklet module source: the serialized {@link JitterBufferCore}
 * class followed by the processor. Self-contained — no imports, no free
 * references — so it loads from a Blob URL in any browser.
 */
export function buildPlayoutWorkletCode(): string {
  const coreSource = JitterBufferCore.toString();
  if (!coreSource.startsWith('class')) {
    // Guards against a bundler wrapping the class such that .toString() is not
    // self-contained source (would break the worklet). Surfaces early/loudly.
    throw new Error('playout-worklet: JitterBufferCore.toString() is not a class declaration');
  }
  // The serialized class must not reference transpiler/bundler helpers that live
  // in module scope (e.g. esbuild's `__publicField` for class-field lowering, or
  // `__decorateClass`) — they'd be undefined in the worklet. The build targets
  // es2022 (vite.config) specifically to keep class fields native. If a future
  // build setting reintroduces a helper, fail loudly here rather than ship a
  // worklet that throws at runtime.
  const helper = /\b__(publicField|privateField|decorateClass|decorateParam|name|esDecorate)\b/.exec(coreSource);
  if (helper) {
    throw new Error(
      `playout-worklet: serialized JitterBufferCore references the bundler helper "${helper[0]}" — ` +
        'it would be undefined in the worklet. Ensure the build target keeps native class fields (es2022+).'
    );
  }
  // BIND to a const rather than emit the bare source: a consumer's bundler may
  // emit the class as an ANONYMOUS expression (`var X = class {…}`), so
  // `.toString()` returns `class {…}` — a syntax error as a statement. Wrapping
  // it (`const JitterBufferCore = class {…};`) is valid for both the anonymous
  // and the named-declaration forms.
  return `const JitterBufferCore = ${coreSource};\n${PLAYOUT_PROCESSOR_SOURCE}`;
}

/**
 * Create a Blob URL for the playout worklet module. Caller passes it to
 * `audioContext.audioWorklet.addModule(url)` and should `URL.revokeObjectURL`
 * afterwards.
 */
export function createPlayoutWorkletUrl(): string {
  const blob = new Blob([buildPlayoutWorkletCode()], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}
