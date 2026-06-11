/**
 * jitter-buffer-core.ts — the v3 adaptive jitter buffer, ported from the Go
 * `spatial-mixer/core/buffers/jitter_buffer.go` (design:
 * `spatial-mixer/plan/browser-audio/playout-v3-design.md`, itself the TS analog
 * of `jitter-buffer/design_v3.md`).
 *
 * The floor is fixed (R + S); two independent allowances widen/narrow the
 * operating window — L on the late side (costs latency), H on the bunch side
 * (costs capacity) — driven purely by counting the buffer's own ±1 corrections
 * over a tumbling window of reads. No wall-clock, no rates, no decay constants.
 *
 * **Single-threaded, no atomics.** Unlike the Go SPSC original (network thread
 * writes, audio callback reads), the browser playout runs both `write` (decoder
 * → `onmessage`) and `read` (`process`) on the *same* AudioWorklet audio thread,
 * which never overlaps them. So the Go acquire/release/atomic machinery drops
 * away: plain numbers throughout. The geometry, the splice, and the controller
 * port verbatim.
 *
 * **One stereo buffer, interleaved, frame-based corrections.** The atomic unit
 * is a *frame* of `nc` interleaved samples; a ±1 correction moves the whole
 * frame, so for binaural (`nc=2`) L/R stay sample-locked and the interaural time
 * difference (ITD) is preserved structurally. This is one stereo buffer, not two
 * mono buffers (which would decorrelate).
 *
 * This module is pure logic — no Web Audio, no worklet, no DOM — so it is unit-
 * testable off the audio thread (the port of `jitter_buffer_test.go`). The
 * worklet (Phase 2) wraps it; `AudioPlayer` (Phase 3) drives that.
 *
 * Most mutable fields below are `public` for the worklet's stats/observability
 * and for white-box tests; outside `write`/`read`/`adapt` they should be treated
 * as read-only (mutating them by hand is a test/seed seam only).
 */
/**
 * Browser playout tuning — the one named constants block (design §6/§10). All
 * are starting guesses refined in the soak phase. None is a wall-clock value:
 * the window is a read count, the threshold a correction count, the steps are
 * sample counts (expressed in ms/µs here and converted to frames at the buffer's
 * sample rate). `windowReads` is the one knob re-derived for the browser.
 */
export declare const PLAYOUT_TUNING: {
    readonly safetyMs: 1;
    readonly lowInitMs: 10;
    readonly lowMinMs: 7;
    readonly lowMaxMs: 30;
    readonly highInitMs: 16;
    readonly highMinMs: 14;
    readonly highMaxMs: 30;
    readonly windowReads: 750;
    readonly widenThreshold: 5;
    readonly widenStepMs: 2;
    readonly narrowStepMicros: 500;
};
/**
 * Configuration for {@link JitterBufferCore}. All frame-size fields are in
 * **samples** (the browser knows these concretely: R = the 128-sample worklet
 * quantum, W = the server's 240-sample Opus frame). Zero/omitted fields fall
 * back to the defaults below, derived from `sampleRate` so they are correct at
 * any rate and match the Go worked examples exactly at 48 kHz.
 */
export interface JitterBufferCoreConfig {
    /** Sample rate (Hz). Used for the ms-domain defaults and stats. Default 48000. */
    sampleRate?: number;
    /** Channels per frame (interleaved). Default 1. Binaural playout is 2. */
    numChannels?: number;
    /** R — reader frame, samples. Default = 5 ms. Browser worklet passes 128. */
    readerFrame?: number;
    /** W — writer frame, samples. Default = 20 ms. Browser playout passes 240 (5 ms). */
    writerFrame?: number;
    /** S — static floor pad, samples. Default = 1 ms. */
    safety?: number;
    /** Warm-start L, samples. Default = 5 ms. */
    lowInit?: number;
    /** L adapt-down floor, samples. Default = 2 ms. */
    lowMin?: number;
    /** L latency ceiling, samples. Default = 30 ms. */
    lowMax?: number;
    /** Warm-start H, samples. Default = W. */
    highInit?: number;
    /** H adapt-down floor, samples. Default = W. */
    highMin?: number;
    /** H ceiling, samples. Default = 3·W. */
    highMax?: number;
    /** N — tumbling-window length, reads. Default 750. */
    windowReads?: number;
    /** Corrections/side/window to widen. Default 5. */
    widenThreshold?: number;
    /** Widen step, samples. Default = 2 ms. */
    widenStep?: number;
    /** Narrow step, samples. Default = 0.5 ms. */
    narrowStep?: number;
    /**
     * Cross-thread mode (design §11.3, post-2026-06-09 SAB revision). When the
     * writer (receive Worker / main-thread decoder) and the reader (worklet) are
     * different threads, the ring storage and the writePos must live in shared
     * memory — feeding the ring by `postMessage` is not real-time-safe. Provide a
     * `SharedArrayBuffer`-backed interleaved `Float32Array` of exactly
     * `capacity*nc` and a length-1 `BigInt64Array` for the (atomic) writePos;
     * `readPos` stays reader-owned (plain). Size them with {@link computeJitterCapacity}.
     * Omit both for the original single-thread / postMessage mode.
     */
    sharedStorage?: Float32Array;
    /** SAB-backed length-1 BigInt64Array holding the atomic cumulative writePos (frames). */
    sharedWritePos?: BigInt64Array;
}
/**
 * Pure geometry: the ring capacity (frames) and channel count for a given config
 * — the single source of truth shared by the constructor and by callers that
 * must allocate the SharedArrayBuffer storage (`capacity*nc` floats) before
 * constructing the cross-thread cores. Mirrors the Go capacity formula.
 */
export declare function computeJitterCapacity(cfg?: JitterBufferCoreConfig): {
    capacity: number;
    nc: number;
};
/** Operating thresholds derived from the live (L, H) — see {@link JitterBufferCore.levels}. */
export interface Levels {
    /** T = floor + L — operating target / sawtooth bottom. */
    t: number;
    /** snapTarget = T + W — recovery point for every snap. */
    snapTarget: number;
    /** dropLine = T + W + H — drift-DROP fires above this. */
    dropLine: number;
    /** overrunAt = T + 2W + H — overrun snap fires above this. */
    overrunAt: number;
}
/** Rich snapshot of the buffer for tuning/observability (port of Go `JitterBufferStats`). */
export interface JitterBufferSnapshot {
    fillFrames: number;
    fillMs: number;
    floorFrames: number;
    lowAllowanceFrames: number;
    lowAllowanceMs: number;
    highAllowanceFrames: number;
    highAllowanceMs: number;
    targetFrames: number;
    started: boolean;
    underruns: number;
    overruns: number;
    laps: number;
    samplesDropped: number;
    samplesInserted: number;
    lastWindowInserts: number;
    lastWindowDrops: number;
    /** Effective-band zone: -1 below floor, +1 above dropLine, else 0. */
    zone: -1 | 0 | 1;
}
export declare class JitterBufferCore {
    readonly capacity: number;
    readonly floor: number;
    readonly w: number;
    readonly nc: number;
    readonly sampleRate: number;
    readonly lMin: number;
    readonly lMax: number;
    readonly hMin: number;
    readonly hMax: number;
    readonly windowReads: number;
    readonly widenThreshold: number;
    readonly widenStep: number;
    readonly narrowStep: number;
    readonly data: Float32Array;
    private _writePos;
    private wpCell;
    get writePos(): number;
    set writePos(v: number);
    readPos: number;
    currentL: number;
    currentH: number;
    insertCount: number;
    dropCount: number;
    readsThisWindow: number;
    lastWinInserts: number;
    lastWinDrops: number;
    underruns: number;
    overruns: number;
    laps: number;
    samplesDropped: number;
    samplesInserted: number;
    constructor(cfg?: JitterBufferCoreConfig);
    /**
     * Derive the operating thresholds from the (loaded-once) window allowances
     * `l`, `h` plus the immutable floor and writer frame. Pure function; all
     * branches of {@link read} use one consistent snapshot.
     */
    levels(l: number, h: number): Levels;
    /**
     * Copy `src` (interleaved, length a multiple of `nc`) into the ring. Never
     * blocks. Writes longer than capacity are clipped to the most-recent
     * `capacity` frames.
     */
    write(src: Float32Array): void;
    /**
     * Copy up to `dst.length` interleaved samples from the ring into `dst`.
     * Returns true when audio was produced, false on silence. See design §4. The
     * window allowances L and H are read exactly once at the top so every branch
     * sees consistent geometry. No debounce: corrections fire on the first
     * out-of-band read.
     */
    read(dst: Float32Array): boolean;
    /**
     * Tick the tumbling window once per Read and, every `windowReads`, run the
     * decision off the accumulated correction counts, then reset them. No
     * wall-clock: the window is a read count, the inputs are correction counts.
     */
    adapt(): void;
    /**
     * Move the window allowances from one window's correction counts (design §6):
     *   - both sides breached (min ≥ threshold) ⇒ jitter ⇒ widen the breaching
     *     side(s) by widenStep, capped at max (eager);
     *   - otherwise a fully-calm side (count 0) narrows by narrowStep, floored at
     *     min; a side that is lit but un-gated is drift — left to the ±1 corrector.
     * `narrowStep < widenStep` makes it eager-up / reluctant-down — the stability
     * guarantee.
     */
    decide(insertCount: number, dropCount: number): void;
    /** Current fill in frames. */
    fillFrames(): number;
    /** Fill in interleaved floats (matching the Go ICircularBuffer convention). */
    getBehind(): number;
    /** Rich snapshot for tuning/observability. */
    snapshot(): JitterBufferSnapshot;
    /**
     * Copy `nFrames` frames from `src` into the ring at frame position `wp`,
     * handling wraparound. Caller guarantees `nFrames <= capacity`.
     */
    private writeToRing;
    /**
     * Copy `nFrames` frames from the ring at frame position `rp` into `dst`,
     * handling wraparound. Caller guarantees `nFrames <= capacity`.
     */
    private readFromRing;
}
//# sourceMappingURL=jitter-buffer-core.d.ts.map