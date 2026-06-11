/**
 * Opus encode capability check.
 *
 * The actual Opus encoding now runs in the MOQ worker (worker-capture-design.md): the
 * capture worklet fills a SAB ring and the worker drains + encodes it off the main
 * thread (see `capture-encoder.ts`). The former main-thread `OpusEncoder` /
 * `AudioCaptureEncoder` classes were removed in that refactor (Phase 5); only this
 * capability probe remains, used by `AudioPublisher` / `getAudioCapabilities`.
 */
/**
 * Check if WebCodecs AudioEncoder (with Opus) is available. The worker constructs the
 * real encoder; this main-thread probe is a reasonable proxy for support.
 */
export declare function isWebCodecsOpusSupported(): boolean;
//# sourceMappingURL=opus-encoder.d.ts.map