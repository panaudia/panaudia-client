import { WebTransportOptions } from './types.js';
import { JitterBufferCoreConfig } from './jitter-buffer-core.js';
/** Opus decoder config the worker hands to WebCodecs AudioDecoder. */
export interface WorkerDecoderConfig {
    codec: string;
    sampleRate: number;
    numberOfChannels: number;
}
/** Opus encoder config the worker hands to WebCodecs AudioEncoder (mic send path). */
export interface WorkerEncoderConfig {
    codec: string;
    sampleRate: number;
    numberOfChannels: number;
    bitrate: number;
    /** Opus frame duration in microseconds (e.g. 5000 = 5 ms). */
    frameDurationUs: number;
}
export type WorkerRequest = {
    kind: 'req';
    id: number;
    method: 'connect';
    args: {
        serverUrl: string;
        options?: WebTransportOptions;
        debug?: boolean;
    };
} | {
    kind: 'req';
    id: number;
    method: 'initSession';
    args: {
        role: number;
        maxSubscribeId?: number;
    };
} | {
    kind: 'req';
    id: number;
    method: 'subscribe';
    args: {
        namespace: string[];
        trackName: string;
        authorization?: string;
        resumeOpId?: bigint;
    };
} | {
    kind: 'req';
    id: number;
    method: 'announce';
    args: {
        namespace: string[];
        authorization?: string;
    };
} | {
    kind: 'req';
    id: number;
    method: 'setAudioTrack';
    args: {
        trackAlias: number;
        decoderConfig: WorkerDecoderConfig;
        jbufConfig: JitterBufferCoreConfig;
        sharedStorage: Float32Array;
        sharedWritePos: BigInt64Array;
    };
} | {
    kind: 'req';
    id: number;
    method: 'sendDatagram';
    args: {
        bytes: Uint8Array;
    };
} | {
    kind: 'req';
    id: number;
    method: 'setCaptureTrack';
    args: {
        trackAlias: number;
        publisherPriority?: number;
        encoderConfig: WorkerEncoderConfig;
        numChannels: number;
        capacityFrames: number;
        sharedStorage: Float32Array;
        sharedWritePos: BigInt64Array;
        sharedReadPos: BigInt64Array;
        sharedSignal: Int32Array;
    };
} | {
    kind: 'req';
    id: number;
    method: 'stopCapture';
    args: Record<string, never>;
} | {
    kind: 'req';
    id: number;
    method: 'startMessageLoop';
    args: Record<string, never>;
} | {
    kind: 'req';
    id: number;
    method: 'disconnect';
    args: Record<string, never>;
};
export type WorkerMethod = WorkerRequest['method'];
/** Result payload for `subscribe`. Other methods resolve with `undefined`. */
export interface SubscribeResult {
    subscribeId: number;
    trackAlias: number | undefined;
}
export type WorkerResponse = {
    kind: 'res';
    id: number;
    ok: true;
    result: unknown;
} | {
    kind: 'res';
    id: number;
    ok: false;
    error: string;
};
export type WorkerEvent = {
    kind: 'evt';
    type: 'connectionState';
    state: string;
    detail?: string;
} | {
    kind: 'evt';
    type: 'incomingSubscribe';
    namespace: string[];
    trackAlias: number;
} | {
    kind: 'evt';
    type: 'datagram';
    trackAlias: number;
    payload: Uint8Array;
    groupId: bigint;
    objectId: bigint;
} | {
    kind: 'evt';
    type: 'notice';
    event: string;
    detail?: string;
};
/** Anything the worker posts to the main thread. */
export type WorkerOutbound = WorkerResponse | WorkerEvent;
//# sourceMappingURL=moq-worker-protocol.d.ts.map