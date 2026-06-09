/**
 * Tests for MoqConnection — thin delegation checks that its datagram routing
 * forwards to the composed DatagramRouter. The full dispatch/race-buffer behaviour
 * is owned and exhaustively tested by datagram-router.test.ts (Phase 1 extraction);
 * here we only verify the wiring through the connection's public API (no real
 * WebTransport needed — `ingestForwardedDatagram` drives the same routing path the
 * dispatcher loop uses).
 */

import { describe, it, expect, vi } from 'vitest';
import { MoqConnection } from '../../src/moq/connection.js';

describe('MoqConnection → DatagramRouter delegation', () => {
  it('routes an ingested datagram straight to a registered handler', () => {
    const conn = new MoqConnection('https://test.invalid');
    const handler = vi.fn();
    conn.registerDatagramHandler(7, handler);

    conn.ingestForwardedDatagram(7, new Uint8Array([0xaa, 0xbb]), 1n, 0n);

    expect(handler).toHaveBeenCalledWith(new Uint8Array([0xaa, 0xbb]), 7, 1n, 0n);
    expect(conn.getPendingDatagramCount()).toBe(0);
  });

  it('buffers before registration and drains on register (SUBSCRIBE_OK race)', () => {
    const conn = new MoqConnection('https://test.invalid');

    conn.ingestForwardedDatagram(7, new Uint8Array([0x01]), 10n, 0n);
    conn.ingestForwardedDatagram(7, new Uint8Array([0x02]), 10n, 1n);
    expect(conn.getPendingDatagramCount()).toBe(2);

    const handler = vi.fn();
    conn.registerDatagramHandler(7, handler);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(conn.getPendingDatagramCount()).toBe(0);
  });

  it('unregister + close delegate to the router', () => {
    const conn = new MoqConnection('https://test.invalid');
    conn.ingestForwardedDatagram(5, new Uint8Array([0x10]), 1n, 0n);
    conn.ingestForwardedDatagram(6, new Uint8Array([0x20]), 1n, 0n);
    expect(conn.getPendingDatagramCount()).toBe(2);

    conn.unregisterDatagramHandler(5); // discards alias-5's buffered entry
    expect(conn.getPendingDatagramCount()).toBe(1);

    conn.close(); // clears the rest
    expect(conn.getPendingDatagramCount()).toBe(0);
  });
});
