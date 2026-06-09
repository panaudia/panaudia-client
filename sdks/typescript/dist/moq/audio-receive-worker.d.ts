import { JitterBufferCoreConfig } from './jitter-buffer-core.js';
/** The render-quantum-agnostic decoder config the worker configures `AudioDecoder` with. */
export interface ReceiveWorkerDecoderConfig {
    codec: string;
    sampleRate: number;
    numberOfChannels: number;
}
/**
 * main → worker: initialise with the transferred datagram readable. Sent at
 * connect, before the audio track (or the worklet's PCM port) exists — so the
 * worker starts reading and forwards *everything* to main until the `audio`
 * message arrives. `pcmPort` is optional here (used by tests); in the real flow
 * it rides with `audio` (the worklet doesn't exist until `startPlayback`).
 */
export interface ReceiveWorkerInitMessage {
    type: 'init';
    /** Transferred `transport.datagrams.readable` (must be unlocked — main never reads it in worker mode). */
    readable: ReadableStream<Uint8Array>;
    /** Optional transferred port to the playout worklet; usually sent with `audio` instead. */
    pcmPort?: MessagePort;
}
/**
 * main → worker: the audio track is now known (post-`startPlayback`) — configure
 * the decoder, adopt the worklet's PCM port, and start decoding this alias
 * locally (everything else keeps forwarding to main).
 */
export interface ReceiveWorkerAudioMessage {
    type: 'audio';
    audioTrackAlias: number;
    decoderConfig: ReceiveWorkerDecoderConfig;
    /**
     * SAB mode (preferred, design §11.3): the worker constructs a writer-view
     * `JitterBufferCore` over the shared ring and writes decoded PCM straight into
     * it — no `postMessage` for PCM. `jbufConfig` must be the SAME config the
     * worklet's reader core uses (so capacity/nc match); the SAB arrays must be
     * sized with `computeJitterCapacity(jbufConfig)`.
     */
    jbufConfig?: JitterBufferCoreConfig;
    sharedStorage?: Float32Array;
    sharedWritePos?: BigInt64Array;
    /** Non-isolated fallback only: transferred worklet port; PCM is posted here when there is no SAB. */
    pcmPort?: MessagePort;
}
/** main → worker: tear down (stop the read loop, close the decoder). */
export interface ReceiveWorkerStopMessage {
    type: 'stop';
}
export type ReceiveWorkerInbound = ReceiveWorkerInitMessage | ReceiveWorkerAudioMessage | ReceiveWorkerStopMessage;
/** worker → main: a non-audio datagram, to be routed through `connection.ingestForwardedDatagram`. */
export interface ForwardedDatagramMessage {
    type: 'datagram';
    trackAlias: number;
    groupId: bigint;
    objectId: bigint;
    publisherPriority: number;
    payload: Uint8Array;
}
/** worker → main: diagnostics (read-loop ended / decode error). */
export interface ReceiveWorkerNoticeMessage {
    type: 'notice';
    event: 'reader-done' | 'reader-error' | 'decode-error';
    detail?: string;
}
export type ReceiveWorkerOutbound = ForwardedDatagramMessage | ReceiveWorkerNoticeMessage;
/**
 * Best-effort capability probe for the worker datagram path (design §11.8). The
 * deep checks (WebTransport / WebCodecs *inside* a Worker, stream + port
 * transfer) can't be done synchronously, so this gates on the main-thread
 * presence of the primitives; the actual worker construction is wrapped in
 * try/catch by the caller, which falls back to the main-thread decode path if
 * any of these turn out not to work in a given engine.
 */
export declare function audioReceiveWorkerSupported(): boolean;
/**
 * Routing decision for one parsed datagram — extracted as a pure function so it
 * is unit-testable off the worker thread (the analog of `connection`'s
 * `dispatchOrBuffer` split). Until the audio alias is known (`audioTrackAlias`
 * undefined) everything is forwarded, including any pre-subscribe audio (those
 * land in `connection`'s pending buffer with no handler and are harmlessly
 * dropped — see design §11.4).
 */
export declare function routeDatagram(trackAlias: number, audioTrackAlias: number | undefined): 'decode' | 'forward';
/**
 * Build the full worker module source: the serialized pure MOQ parse helpers
 * (`decodeVarint`, `parseObjectDatagram`) followed by the worker runtime.
 * Self-contained (no imports, no free module-scope refs) so it loads from a Blob
 * URL in any of the four target engines.
 */
export declare function buildReceiveWorkerCode(): string;
/**
 * Create a Blob URL for the receive worker. Caller passes it to `new Worker(url)`
 * and should `URL.revokeObjectURL` after construction.
 */
export declare function createReceiveWorkerUrl(): string;
//# sourceMappingURL=audio-receive-worker.d.ts.map