/**
 * moq-worker-client.ts — the main-thread half of the MOQ worker proxy
 * (worker-transport-design.md §4). Spins up the worker, turns its RPC
 * request/response protocol into promise-returning `call()`s, and dispatches
 * worker→main events to a handler. Used by PanaudiaMoqClient to drive the
 * worker-hosted WebTransport/session.
 */

import type {
  WorkerRequest,
  WorkerOutbound,
  WorkerEvent,
  SubscribeResult,
} from './moq-worker-protocol.js';

// NOTE: the `?worker&inline` loader lives in moq-worker-loader.ts (kept separate so
// importing this RPC class doesn't drag the worker bundle into unit tests).

/** Args type for a given method, sans the envelope fields. */
type ArgsOf<M extends WorkerRequest['method']> = Extract<WorkerRequest, { method: M }>['args'];

/** Result type for a given method (only `subscribe` returns a value today). */
type ResultOf<M extends WorkerRequest['method']> = M extends 'subscribe' ? SubscribeResult : void;

/**
 * Promise-based RPC over the worker's postMessage channel + an event sink.
 * Inject the `Worker` (so it's unit-testable with a fake); production passes
 * `createMoqWorker()`.
 */
export class MoqWorkerClient {
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(
    private readonly worker: Worker,
    onEvent: (evt: WorkerEvent) => void
  ) {
    this.worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as WorkerOutbound;
      if (!msg) return;
      if (msg.kind === 'res') {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.ok) p.resolve(msg.result);
        else p.reject(new Error(msg.error));
      } else if (msg.kind === 'evt') {
        onEvent(msg);
      }
    };
  }

  /** Issue an RPC and resolve with its result. `transfer` moves buffers into the worker. */
  call<M extends WorkerRequest['method']>(method: M, args: ArgsOf<M>, transfer?: Transferable[]): Promise<ResultOf<M>> {
    const id = this.nextId++;
    const req = { kind: 'req', id, method, args } as WorkerRequest;
    return new Promise<ResultOf<M>>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      try {
        this.worker.postMessage(req, transfer ?? []);
      } catch (e) {
        this.pending.delete(id);
        reject(e as Error);
      }
    });
  }

  /** Terminate the worker and reject any in-flight calls. */
  dispose(): void {
    for (const { reject } of this.pending.values()) reject(new Error('worker disposed'));
    this.pending.clear();
    this.worker.terminate();
  }
}
