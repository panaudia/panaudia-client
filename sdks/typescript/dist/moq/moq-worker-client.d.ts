import { WorkerRequest, WorkerEvent, SubscribeResult } from './moq-worker-protocol.js';
/** Args type for a given method, sans the envelope fields. */
type ArgsOf<M extends WorkerRequest['method']> = Extract<WorkerRequest, {
    method: M;
}>['args'];
/** Result type for a given method (only `subscribe` returns a value today). */
type ResultOf<M extends WorkerRequest['method']> = M extends 'subscribe' ? SubscribeResult : void;
/**
 * Promise-based RPC over the worker's postMessage channel + an event sink.
 * Inject the `Worker` (so it's unit-testable with a fake); production passes
 * `createMoqWorker()`.
 */
export declare class MoqWorkerClient {
    private readonly worker;
    private nextId;
    private readonly pending;
    constructor(worker: Worker, onEvent: (evt: WorkerEvent) => void);
    /** Issue an RPC and resolve with its result. `transfer` moves buffers into the worker. */
    call<M extends WorkerRequest['method']>(method: M, args: ArgsOf<M>, transfer?: Transferable[]): Promise<ResultOf<M>>;
    /** Terminate the worker and reject any in-flight calls. */
    dispose(): void;
}
export {};
//# sourceMappingURL=moq-worker-client.d.ts.map