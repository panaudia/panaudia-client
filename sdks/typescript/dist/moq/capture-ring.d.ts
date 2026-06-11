/**
 * capture-ring.ts — the mic SEND ring (worker-capture-design.md §5).
 *
 * A minimal lock-free SPSC ring over a SharedArrayBuffer. The capture AudioWorklet is
 * the PRODUCER (interleaves each 128-sample render quantum into the ring); the MOQ
 * worker is the CONSUMER (drains whole frames out to feed the Opus encoder). It is the
 * send-side twin of the playout ring — but deliberately carries NONE of the
 * jitter-buffer machinery: no adaptive window, no ±1 splice, no target fill, no
 * warm-start, no underrun/overrun handling. Its only job is to pass every write
 * through to the encoder as fast as possible — drain to empty, hold nothing (design
 * §5). If you find yourself reaching for any jitter-buffer concept here, it is the bug
 * this file exists to prevent.
 *
 * Cross-thread SPSC. Producer and consumer run on different threads, so BOTH
 * cumulative positions live in shared atomic cells: the worklet stores `writePos`
 * (the release fence for its ring writes) and the worker stores `readPos` (the release
 * fence for the space it freed). Each side `Atomics.load`s the other's position with
 * acquire semantics; bulk PCM is plain reads/writes — the position load/store pair
 * establishes the happens-before. Positions are cumulative (never wrap), so the fill
 * `writePos - readPos` is unambiguous in [0, capacity]; index via `(pos % cap) * nc`.
 *
 * NOTE: each THREAD constructs its own `CaptureRing` over the same shared cells — the
 * object is not shared. (Off-thread tests construct one and drive both ends, which is
 * valid because `Atomics.load`/`store` work on non-shared typed arrays too.)
 *
 * Self-contained for `.toString()` serialization into the capture worklet (Blob URL,
 * cannot import): no module-scope free references, no imported constants (the ctor
 * takes everything), and — unlike JitterBufferCore — fields are assigned in the
 * constructor rather than via class-field initializers, so NO transpile target can
 * lower them to a `__publicField` helper that would be undefined in the worklet.
 */
/**
 * Fixed ring capacity in frames — a small stall backstop, NOT a tuned buffer (the
 * operating fill is ~0; the worker drains to empty every wake). 2048 frames ≈ 42 ms at
 * 48 kHz: comfortably larger than any normal worker-drain gap, so a lap is a logged
 * glitch, not a routine event. Single source of truth for SAB sizing — main allocates
 * `sharedStorage` of `captureCapacityFrames() * numChannels`. Deliberately a flat
 * constant: there is no geometry formula on the send side.
 */
export declare function captureCapacityFrames(): number;
export interface CaptureRingConfig {
    /** Channels per frame (interleaved). Default 1 (mono mic). */
    numChannels?: number;
    /** Ring capacity in frames. Default {@link captureCapacityFrames}. */
    capacityFrames?: number;
    /** SAB-backed interleaved float storage of exactly `capacityFrames * numChannels`. */
    sharedStorage: Float32Array;
    /** SAB-backed length-1 BigInt64Array — cumulative producer position (frames). */
    sharedWritePos: BigInt64Array;
    /** SAB-backed length-1 BigInt64Array — cumulative consumer position (frames). */
    sharedReadPos: BigInt64Array;
}
export declare class CaptureRing {
    readonly nc: number;
    readonly capacity: number;
    readonly data: Float32Array;
    private readonly wpCell;
    private readonly rpCell;
    /** Count of quanta dropped because the consumer stalled past capacity (§5.1). */
    overflows: number;
    constructor(cfg: CaptureRingConfig);
    /** Cumulative producer position (frames), acquire-loaded. */
    get writePos(): number;
    /** Cumulative consumer position (frames), acquire-loaded. */
    get readPos(): number;
    /** Current fill in frames (unambiguous: positions are cumulative). */
    fillFrames(): number;
    /**
     * PRODUCER (capture worklet). Interleave one render quantum of planar channels into
     * the ring. `planar[ch]` is a Float32Array of `nFrames` samples (Web Audio is
     * planar; all channels equal length). Channels beyond `planar.length` reuse the last
     * (mono→stereo dup); channels beyond `nc` are ignored. If the consumer has stalled
     * and the quantum would not fit, the WHOLE quantum is dropped and `overflows` is
     * bumped — never blocks, never overwrites unread data (§5.1). Returns true if written.
     */
    write(planar: Float32Array[]): boolean;
    /**
     * CONSUMER (MOQ worker). Copy all whole frames currently available into `dst`
     * (interleaved), up to `dst`'s capacity, then free that space. Returns the number of
     * interleaved SAMPLES written (`frames * nc`), or 0 if nothing was ready. Drain to
     * empty: leaves only what the producer hasn't yet published.
     */
    drain(dst: Float32Array): number;
}
//# sourceMappingURL=capture-ring.d.ts.map