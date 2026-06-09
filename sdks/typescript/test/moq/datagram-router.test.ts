/**
 * Tests for DatagramRouter — the trackAlias→handler dispatch + the pre-handler
 * SUBSCRIBE_OK/first-datagram race buffer. Ported from connection.test.ts (Phase 1
 * extraction): this is now the logic's home, tested directly via the public
 * register/unregister/ingest/pendingCount/clear API (no private casts). A thin
 * delegation test stays in connection.test.ts.
 */

import { describe, it, expect, vi } from 'vitest';
import { DatagramRouter, type ParsedDatagram } from '../../src/moq/datagram-router.js';

const datagram = (alias: number, payload: number[], group = 1n, obj = 0n): ParsedDatagram => ({
  trackAlias: alias,
  payload: new Uint8Array(payload),
  groupId: group,
  objectId: obj,
});

describe('DatagramRouter pre-handler datagram buffering', () => {
  it('delivers immediately when a handler is already registered', () => {
    const router = new DatagramRouter();
    const handler = vi.fn();
    router.register(7, handler);

    router.ingest(datagram(7, [0xaa, 0xbb]));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(new Uint8Array([0xaa, 0xbb]), 7, 1n, 0n);
    expect(router.pendingCount()).toBe(0);
  });

  it('buffers when no handler is registered, then drains on registration', () => {
    const router = new DatagramRouter();

    router.ingest(datagram(7, [0x01], 10n, 0n));
    router.ingest(datagram(7, [0x02], 10n, 1n));
    router.ingest(datagram(7, [0x03], 11n, 0n));

    expect(router.pendingCount()).toBe(3);

    const handler = vi.fn();
    router.register(7, handler);

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[0]).toEqual([new Uint8Array([0x01]), 7, 10n, 0n]);
    expect(handler.mock.calls[1]).toEqual([new Uint8Array([0x02]), 7, 10n, 1n]);
    expect(handler.mock.calls[2]).toEqual([new Uint8Array([0x03]), 7, 11n, 0n]);
    expect(router.pendingCount()).toBe(0);
  });

  it('drains only the matching alias, leaves other aliases buffered', () => {
    const router = new DatagramRouter();

    router.ingest(datagram(2, [0xa1]));
    router.ingest(datagram(3, [0xb1]));
    router.ingest(datagram(2, [0xa2]));

    expect(router.pendingCount()).toBe(3);

    const attrHandler = vi.fn();
    router.register(2, attrHandler);

    expect(attrHandler).toHaveBeenCalledTimes(2);
    expect(attrHandler.mock.calls[0][0]).toEqual(new Uint8Array([0xa1]));
    expect(attrHandler.mock.calls[1][0]).toEqual(new Uint8Array([0xa2]));
    expect(router.pendingCount()).toBe(1);

    const entityHandler = vi.fn();
    router.register(3, entityHandler);

    expect(entityHandler).toHaveBeenCalledTimes(1);
    expect(entityHandler.mock.calls[0][0]).toEqual(new Uint8Array([0xb1]));
    expect(router.pendingCount()).toBe(0);
  });

  it('preserves arrival order across alias-interleaved buffering', () => {
    const router = new DatagramRouter();

    router.ingest(datagram(2, [1], 10n, 0n));
    router.ingest(datagram(3, [10], 11n, 0n));
    router.ingest(datagram(2, [2], 10n, 1n));
    router.ingest(datagram(3, [11], 11n, 1n));
    router.ingest(datagram(2, [3], 10n, 2n));

    const attrHandler = vi.fn();
    router.register(2, attrHandler);

    expect(attrHandler.mock.calls.map((c) => c[0][0])).toEqual([1, 2, 3]);
  });

  it('drops oldest pending entries when the byte cap is exceeded', () => {
    const router = new DatagramRouter();

    // 1 MiB cap. Push 2 MiB worth of 64 KiB chunks (32 entries).
    const chunk = new Uint8Array(64 * 1024);
    chunk.fill(0xcc);
    for (let i = 0; i < 32; i++) {
      router.ingest({ trackAlias: 9, payload: chunk, groupId: BigInt(i), objectId: 0n });
    }

    // After 32 pushes only the newest 16 (1 MiB) remain (oldest 16 dropped FIFO).
    expect(router.pendingCount()).toBe(16);

    const handler = vi.fn();
    router.register(9, handler);

    expect(handler).toHaveBeenCalledTimes(16);
    expect(handler.mock.calls[0][2]).toBe(16n);
    expect(handler.mock.calls[15][2]).toBe(31n);
  });

  it('does not deliver to a handler that was registered then removed; buffers as unknown', () => {
    const router = new DatagramRouter();
    const handler = vi.fn();

    router.register(5, handler);
    router.ingest(datagram(5, [0x10]));
    expect(handler).toHaveBeenCalledTimes(1);

    router.unregister(5);
    router.ingest(datagram(5, [0x20]));

    expect(router.pendingCount()).toBe(1); // buffered as unknown alias now
    expect(handler).toHaveBeenCalledTimes(1); // no extra call to the removed handler
  });

  it('discards pending entries when a handler is unregistered without being registered', () => {
    const router = new DatagramRouter();

    router.ingest(datagram(5, [0x10]));
    router.ingest(datagram(5, [0x20]));
    router.ingest(datagram(6, [0x30]));
    expect(router.pendingCount()).toBe(3);

    router.unregister(5);

    expect(router.pendingCount()).toBe(1); // alias-5 discarded, alias-6 remains
  });

  it('clears all buffered datagrams on clear()', () => {
    const router = new DatagramRouter();

    router.ingest(datagram(5, [0x10]));
    router.ingest(datagram(6, [0x20]));
    expect(router.pendingCount()).toBe(2);

    router.clear();

    expect(router.pendingCount()).toBe(0);
  });
});
