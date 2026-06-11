/**
 * capture-worklet.ts — the AudioWorklet wrapper around {@link CaptureRing} for the
 * mic SEND path (design: worker-capture-design.md §6/§6.1, plan Phase 3).
 *
 * This is the PRODUCER side, and it is deliberately trivial and real-time-safe: each
 * 128-sample render quantum is interleaved straight into the SAB ring and — if data
 * was written — the worker is woken via the clock-free signal (`Atomics.add` +
 * `Atomics.notify` on a shared Int32 cell, design §6.1). It does **no** Opus encode,
 * **no** frame-boundary logic, and **no** `postMessage` of PCM. Encode + framing +
 * send all live in the MOQ worker, which drains the ring (CaptureRing.drain).
 *
 * **Build-free loading.** A worklet loaded via Blob URL cannot `import` app modules at
 * runtime, so the (self-contained) {@link CaptureRing} class is serialized via
 * `.toString()` and concatenated with the processor source into one Blob — the same
 * pattern as the playout worklet. CaptureRing assigns its fields in the constructor
 * (no class-field initializers), so this serialization stays valid under any build
 * target (no `__publicField` helper to leak module scope).
 */
/** The name the processor registers under / that `AudioWorkletNode` references. */
export declare const CAPTURE_PROCESSOR_NAME = "capture-processor";
/**
 * `processorOptions` passed to the worklet via `new AudioWorkletNode(...)`. The SAB
 * views are created on main (sized via `captureCapacityFrames()`) and handed to both
 * this worklet and the MOQ worker so they share one ring. The `signal` cell is the
 * §6.1 wake channel: this worklet notifies it, the worker `Atomics.waitAsync`es on it.
 */
export interface CaptureProcessorOptions {
    /** Channels per frame (interleaved). Matches the mic capture channel count. */
    numChannels: number;
    /** Ring capacity in frames (from `captureCapacityFrames()`). */
    capacityFrames: number;
    /** SAB-backed interleaved float ring storage (`capacityFrames * numChannels`). */
    sharedStorage: Float32Array;
    /** SAB-backed length-1 BigInt64Array — cumulative producer position (frames). */
    sharedWritePos: BigInt64Array;
    /** SAB-backed length-1 BigInt64Array — cumulative consumer position (frames). */
    sharedReadPos: BigInt64Array;
    /** SAB-backed length-1 Int32Array — the wake signal the worker waits on. */
    signal: Int32Array;
}
/**
 * Build the full worklet module source: the serialized {@link CaptureRing} class
 * followed by the processor. Self-contained — no imports, no free references — so it
 * loads from a Blob URL in any browser. Mirrors {@link buildPlayoutWorkletCode}.
 */
export declare function buildCaptureWorkletCode(): string;
/**
 * Create a Blob URL for the capture worklet module. Caller passes it to
 * `audioContext.audioWorklet.addModule(url)` and should `URL.revokeObjectURL`
 * afterwards.
 */
export declare function createCaptureWorkletUrl(): string;
//# sourceMappingURL=capture-worklet.d.ts.map