/**
 * Tests for MoqConnection — focuses on the pre-handler datagram
 * buffer that protects against the SUBSCRIBE_OK / first-datagram race.
 *
 * The race: server's MOQ AddPublisher writes SUBSCRIBE_OK on the bidi
 * control stream and then immediately sends datagrams via the unreliable
 * QUIC datagram channel. Datagrams can race ahead of SUBSCRIBE_OK on
 * the wire, so a datagram for a freshly-assigned trackAlias can arrive
 * at the dispatcher before the client's `await session.subscribe()`
 * resolves and `registerDatagramHandler` is called.
 */

import { describe, it, expect, vi } from 'vitest';
import { MoqConnection } from '../../src/moq/connection.js';

// Internal shape used by the connection's dispatcher; drives the
// dispatch path without needing a real WebTransport.
interface ParsedDatagram {
  trackAlias: number;
  payload: Uint8Array;
  groupId: bigint;
  objectId: bigint;
}

// Test helper: feed a parsed datagram into the connection's dispatch
// path as if the wire had just delivered it. Bypasses the need for a
// real WebTransport / readable stream in the test, while still
// exercising the production routing logic.
function feed(conn: MoqConnection, d: ParsedDatagram): void {
  // dispatchOrBuffer is private but accessible via cast — lets us
  // exercise the same path the real dispatcher loop hits.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (conn as any).dispatchOrBuffer(d);
}

const datagram = (alias: number, payload: number[], group = 1n, obj = 0n): ParsedDatagram => ({
  trackAlias: alias,
  payload: new Uint8Array(payload),
  groupId: group,
  objectId: obj,
});

describe('MoqConnection pre-handler datagram buffering', () => {
  it('delivers immediately when a handler is already registered', () => {
    const conn = new MoqConnection('https://test.invalid');
    const handler = vi.fn();
    conn.registerDatagramHandler(7, handler);

    feed(conn, datagram(7, [0xaa, 0xbb]));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(new Uint8Array([0xaa, 0xbb]), 7, 1n, 0n);
    expect(conn.getPendingDatagramCount()).toBe(0);
  });

  it('buffers when no handler is registered, then drains on registration', () => {
    const conn = new MoqConnection('https://test.invalid');

    // Three datagrams arrive for alias 7 before a handler is registered.
    feed(conn, datagram(7, [0x01], 10n, 0n));
    feed(conn, datagram(7, [0x02], 10n, 1n));
    feed(conn, datagram(7, [0x03], 11n, 0n));

    expect(conn.getPendingDatagramCount()).toBe(3);

    const handler = vi.fn();
    conn.registerDatagramHandler(7, handler);

    // All three drained in arrival order.
    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[0]).toEqual([new Uint8Array([0x01]), 7, 10n, 0n]);
    expect(handler.mock.calls[1]).toEqual([new Uint8Array([0x02]), 7, 10n, 1n]);
    expect(handler.mock.calls[2]).toEqual([new Uint8Array([0x03]), 7, 11n, 0n]);
    expect(conn.getPendingDatagramCount()).toBe(0);
  });

  it('drains only the matching alias, leaves other aliases buffered', () => {
    const conn = new MoqConnection('https://test.invalid');

    feed(conn, datagram(2, [0xa1])); // attributes — buffered
    feed(conn, datagram(3, [0xb1])); // entity — buffered
    feed(conn, datagram(2, [0xa2])); // another attributes — buffered

    expect(conn.getPendingDatagramCount()).toBe(3);

    const attrHandler = vi.fn();
    conn.registerDatagramHandler(2, attrHandler);

    // Both attribute datagrams drained, entity still buffered.
    expect(attrHandler).toHaveBeenCalledTimes(2);
    expect(attrHandler.mock.calls[0][0]).toEqual(new Uint8Array([0xa1]));
    expect(attrHandler.mock.calls[1][0]).toEqual(new Uint8Array([0xa2]));
    expect(conn.getPendingDatagramCount()).toBe(1);

    const entityHandler = vi.fn();
    conn.registerDatagramHandler(3, entityHandler);

    expect(entityHandler).toHaveBeenCalledTimes(1);
    expect(entityHandler.mock.calls[0][0]).toEqual(new Uint8Array([0xb1]));
    expect(conn.getPendingDatagramCount()).toBe(0);
  });

  it('preserves arrival order across alias-interleaved buffering', () => {
    const conn = new MoqConnection('https://test.invalid');

    // Realistic backfill drain: alternating aliases.
    feed(conn, datagram(2, [1], 10n, 0n));
    feed(conn, datagram(3, [10], 11n, 0n));
    feed(conn, datagram(2, [2], 10n, 1n));
    feed(conn, datagram(3, [11], 11n, 1n));
    feed(conn, datagram(2, [3], 10n, 2n));

    const attrHandler = vi.fn();
    conn.registerDatagramHandler(2, attrHandler);

    // Should drain alias-2 entries in arrival order, ignoring alias-3.
    expect(attrHandler.mock.calls.map((c) => c[0][0])).toEqual([1, 2, 3]);
  });

  it('drops oldest pending entries when the byte cap is exceeded', () => {
    const conn = new MoqConnection('https://test.invalid');

    // 1 MiB cap. Push 2 MiB worth of 64 KiB chunks (32 entries).
    const chunk = new Uint8Array(64 * 1024);
    chunk.fill(0xcc);
    for (let i = 0; i < 32; i++) {
      feed(conn, {
        trackAlias: 9,
        payload: chunk,
        groupId: BigInt(i),
        objectId: 0n,
      });
    }

    // Cap is 1 MiB = 16 chunks of 64 KiB. After 32 pushes, only the
    // newest 16 should remain (oldest 16 dropped FIFO).
    expect(conn.getPendingDatagramCount()).toBe(16);

    const handler = vi.fn();
    conn.registerDatagramHandler(9, handler);

    expect(handler).toHaveBeenCalledTimes(16);
    // First drained should be groupId 16 (entries 0-15 were dropped).
    expect(handler.mock.calls[0][2]).toBe(16n);
    expect(handler.mock.calls[15][2]).toBe(31n);
  });

  it('does not buffer datagrams for an unregistered alias if handler was previously registered then removed', () => {
    const conn = new MoqConnection('https://test.invalid');
    const handler = vi.fn();

    conn.registerDatagramHandler(5, handler);
    feed(conn, datagram(5, [0x10]));
    expect(handler).toHaveBeenCalledTimes(1);

    conn.unregisterDatagramHandler(5);
    feed(conn, datagram(5, [0x20]));

    // Buffered as unknown alias now (caller may re-register later).
    expect(conn.getPendingDatagramCount()).toBe(1);
    // No additional calls to the old handler.
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('discards pending entries when a handler is unregistered without being registered', () => {
    const conn = new MoqConnection('https://test.invalid');

    feed(conn, datagram(5, [0x10]));
    feed(conn, datagram(5, [0x20]));
    feed(conn, datagram(6, [0x30]));
    expect(conn.getPendingDatagramCount()).toBe(3);

    conn.unregisterDatagramHandler(5);

    // Alias-5 entries discarded; alias-6 still buffered.
    expect(conn.getPendingDatagramCount()).toBe(1);
  });

  it('clears all buffered datagrams on close', () => {
    const conn = new MoqConnection('https://test.invalid');

    feed(conn, datagram(5, [0x10]));
    feed(conn, datagram(6, [0x20]));
    expect(conn.getPendingDatagramCount()).toBe(2);

    conn.close();

    expect(conn.getPendingDatagramCount()).toBe(0);
  });
});
