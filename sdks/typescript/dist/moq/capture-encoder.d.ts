import { CaptureRing } from './capture-ring.js';
/** Minimal view of an encoded Opus packet (WebCodecs `EncodedAudioChunk` duck type). */
export interface EncodedChunkLike {
    /** Encoded byte length. */
    readonly byteLength: number;
    /** Presentation timestamp in microseconds (propagated from the input AudioData). */
    readonly timestamp: number;
    /** Copy the encoded bytes into `dest` (must be >= byteLength). */
    copyTo(dest: Uint8Array): void;
}
/**
 * Frame-oriented encoder seam. `moq-worker.ts` implements this over a WebCodecs
 * `AudioEncoder` (+ `AudioData`); tests implement a fake that mimics Opus's
 * accumulate-to-`frameDuration` behaviour. The encoder's output is wired to the
 * `onChunk` callback {@link CaptureEncoder} passes to `makeEncoder`.
 */
export interface FrameEncoder {
    /** Encode `frames` interleaved frames from `samples` (length `frames*nc`) at `timestampUs`. */
    encode(samples: Float32Array, frames: number, timestampUs: number): void;
    flush(): Promise<void>;
    close(): void;
}
export interface CaptureEncoderConfig {
    ring: CaptureRing;
    /** Track alias the server assigned to our audio-in track. */
    trackAlias: number;
    sampleRate: number;
    numChannels: number;
    /** Publisher priority byte (0 = highest). Default 0. */
    publisherPriority?: number;
    /** Upper bound on an encoded Opus packet (scratch sizing). Default 4000. */
    maxPayloadBytes?: number;
    /**
     * Round-robin datagram buffer count. The transport's `send` may read the bytes
     * asynchronously, so a framed datagram must not be overwritten until its write has
     * drained — we cycle through a small pool instead of reusing one buffer (or
     * allocating per frame). Default 8 (≈40 ms of frames; writes complete far sooner).
     */
    datagramPoolSize?: number;
    /** Construct the frame encoder, wiring its output to `onChunk`. */
    makeEncoder: (onChunk: (chunk: EncodedChunkLike) => void) => FrameEncoder;
    /** Send a framed datagram (the worker writes it to the transport). */
    send: (bytes: Uint8Array) => void;
}
/**
 * Drains a CaptureRing and publishes Opus frames as MOQ datagrams. Call {@link pump}
 * on each §6.1 wake; call {@link stop} to flush + close on teardown.
 */
export declare class CaptureEncoder {
    private readonly ring;
    private readonly trackAlias;
    private readonly sampleRate;
    private readonly nc;
    private readonly priority;
    private readonly encoder;
    private readonly send;
    private readonly pcmScratch;
    private readonly bytesScratch;
    private readonly dgPool;
    private dgPoolIdx;
    private samplesSent;
    private objectSeq;
    encodedBatches: number;
    sentDatagrams: number;
    droppedOversize: number;
    constructor(cfg: CaptureEncoderConfig);
    /**
     * Drain all PCM currently in the ring and feed it to the encoder as one AudioData.
     * Called on each wake (design §6.1). Returns the interleaved sample count encoded (0
     * if the ring was empty). Opus does the 240-frame packetization internally.
     */
    pump(): number;
    /** Encoder output: frame the Opus packet into reused scratch and send it. No alloc. */
    private handleChunk;
    /** Flush any buffered Opus packet (fires `handleChunk`) and close the encoder. */
    stop(): Promise<void>;
}
//# sourceMappingURL=capture-encoder.d.ts.map