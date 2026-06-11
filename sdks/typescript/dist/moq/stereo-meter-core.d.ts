/**
 * stereo-meter-core.ts — shared stereo-ness metering for the mono-collapse
 * diagnostics (spatial-mixer/plan/stereo-diagnostics/plan.md).
 *
 * One accumulator class used by both measurement taps:
 *   • Tap A — decoded PCM in the MOQ worker (is the incoming *stream content* stereo?)
 *   • Tap B — rendered output in the playout worklet (is the *graph* preserving it?)
 *
 * Reading both localizes a collapse: A stereo + B mono → graph; A mono → server
 * content or decode; both stereo but it *sounds* mono → OS/device/routing.
 *
 * Everything is derived from three running sums (Σl², Σr², Σl·r), so a window
 * costs three multiply-adds per frame and the report is computed only at
 * snapshot time. `sideRms` (energy of (L−R)/2) is the unambiguous collapse
 * signal — exactly 0 for any mono-derived signal, and well-defined near silence
 * where correlation is not.
 *
 * IMPORTANT: like JitterBufferCore, this class is serialized into the playout
 * worklet's Blob via `.toString()` — it must stay fully self-contained: no
 * imports used by the class body, no external constants, no decorators.
 */
/** One analysis window's result. Linear amplitudes (not dB); convert UI-side. */
export interface StereoMeterReport {
    /** Frames (sample pairs) in the window. 0 ⇒ all other fields are 0. */
    frames: number;
    rmsL: number;
    rmsR: number;
    /** RMS of (L+R)/2 — the mono ("mid") content. */
    midRms: number;
    /** RMS of (L−R)/2 — the stereo difference ("side"). ~0 ⇒ mono collapse. */
    sideRms: number;
    /** Normalized L/R correlation at lag 0, −1…+1. 0 when either channel is ~silent. */
    correlation: number;
}
export declare class StereoMeterCore {
    private sumLL;
    private sumRR;
    private sumLR;
    private frames;
    /** Frames accumulated since the last snapshot (drives window emission). */
    get frameCount(): number;
    /**
     * Accumulate interleaved PCM (LRLR… for stereo). `channels` is the interleave
     * stride; only the first two channels are measured. Mono input (channels=1)
     * is treated as L=R — it reports correlation 1 / sideRms 0, which is the
     * correct verdict for it.
     */
    writeInterleaved(pcm: Float32Array, channels: number): void;
    /** Accumulate planar channels (the worklet's output layout). `right` null ⇒ mono. */
    writePlanar(left: Float32Array, right: Float32Array | null, count: number): void;
    /** Produce the window report and reset the accumulators. */
    snapshotAndReset(): StereoMeterReport;
}
//# sourceMappingURL=stereo-meter-core.d.ts.map