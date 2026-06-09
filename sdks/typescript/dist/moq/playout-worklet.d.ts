import { JitterBufferCoreConfig, JitterBufferSnapshot } from './jitter-buffer-core.js';
/** The name the processor registers under / that `AudioWorkletNode` references. */
export declare const PLAYOUT_PROCESSOR_NAME = "playout-processor";
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
 * Build the full worklet module source: the serialized {@link JitterBufferCore}
 * class followed by the processor. Self-contained — no imports, no free
 * references — so it loads from a Blob URL in any browser.
 */
export declare function buildPlayoutWorkletCode(): string;
/**
 * Create a Blob URL for the playout worklet module. Caller passes it to
 * `audioContext.audioWorklet.addModule(url)` and should `URL.revokeObjectURL`
 * afterwards.
 */
export declare function createPlayoutWorkletUrl(): string;
//# sourceMappingURL=playout-worklet.d.ts.map