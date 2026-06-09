/**
 * Tests the main-thread MoqWorkerClient RPC plumbing with a fake Worker (no real
 * worker spawned): requests get ids, responses resolve/reject the matching call,
 * events route to the sink, and dispose() rejects in-flight calls.
 */

import { describe, it, expect, vi } from 'vitest';
import { MoqWorkerClient } from '../../src/moq/moq-worker-client.js';
import type { WorkerRequest, WorkerOutbound, WorkerEvent } from '../../src/moq/moq-worker-protocol.js';

/** A fake Worker that records posted requests and lets the test push responses/events back. */
class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  posted: WorkerRequest[] = [];
  terminated = false;
  postMessage(msg: WorkerRequest): void {
    this.posted.push(msg);
  }
  terminate(): void {
    this.terminated = true;
  }
  /** Simulate the worker replying. */
  reply(out: WorkerOutbound): void {
    this.onmessage?.({ data: out } as MessageEvent);
  }
}

function setup() {
  const worker = new FakeWorker();
  const events: WorkerEvent[] = [];
  const client = new MoqWorkerClient(worker as unknown as Worker, (e) => events.push(e));
  return { worker, events, client };
}

describe('MoqWorkerClient', () => {
  it('assigns ids and resolves a call when the matching response arrives', async () => {
    const { worker, client } = setup();
    const p = client.call('subscribe', { namespace: ['a', 'b'], trackName: '' });

    expect(worker.posted).toHaveLength(1);
    const req = worker.posted[0]!;
    expect(req.kind).toBe('req');
    expect(req.method).toBe('subscribe');
    const id = req.id;

    worker.reply({ kind: 'res', id, ok: true, result: { subscribeId: 5, trackAlias: 9 } });
    await expect(p).resolves.toEqual({ subscribeId: 5, trackAlias: 9 });
  });

  it('rejects the matching call on an error response', async () => {
    const { worker, client } = setup();
    const p = client.call('connect', { serverUrl: 'https://x.invalid' });
    const id = worker.posted[0]!.id;
    worker.reply({ kind: 'res', id, ok: false, error: 'boom' });
    await expect(p).rejects.toThrow('boom');
  });

  it('routes events to the sink and never resolves a call', async () => {
    const { worker, events, client } = setup();
    const p = client.call('startMessageLoop', {});
    worker.reply({ kind: 'evt', type: 'connectionState', state: 'connected' });
    worker.reply({ kind: 'evt', type: 'datagram', trackAlias: 3, payload: new Uint8Array([1]), groupId: 1n, objectId: 0n });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: 'connectionState', state: 'connected' });
    expect(events[1]).toMatchObject({ type: 'datagram', trackAlias: 3 });

    // The call is still pending until its response lands.
    worker.reply({ kind: 'res', id: worker.posted[0]!.id, ok: true, result: undefined });
    await expect(p).resolves.toBeUndefined();
  });

  it('concurrent calls resolve independently by id', async () => {
    const { worker, client } = setup();
    const p1 = client.call('announce', { namespace: ['x'] });
    const p2 = client.call('subscribe', { namespace: ['y'], trackName: '' });
    const [id1, id2] = worker.posted.map((r) => r.id);
    expect(id1).not.toBe(id2);

    // Reply out of order.
    worker.reply({ kind: 'res', id: id2!, ok: true, result: { subscribeId: 1, trackAlias: 2 } });
    worker.reply({ kind: 'res', id: id1!, ok: true, result: undefined });
    await expect(p2).resolves.toEqual({ subscribeId: 1, trackAlias: 2 });
    await expect(p1).resolves.toBeUndefined();
  });

  it('dispose() terminates the worker and rejects in-flight calls', async () => {
    const { worker, client } = setup();
    const p = client.call('connect', { serverUrl: 'https://x.invalid' });
    client.dispose();
    expect(worker.terminated).toBe(true);
    await expect(p).rejects.toThrow('worker disposed');
  });
});
