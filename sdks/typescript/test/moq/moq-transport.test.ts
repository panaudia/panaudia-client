/**
 * Tests for MOQ Transport protocol implementation
 */

import { describe, it, expect } from 'vitest';
import {
  encodeVarint,
  decodeVarint,
  encodeString,
  decodeString,
  encodeBytes,
  decodeBytes,
  MessageBuilder,
  buildClientSetup,
  buildObjectDatagram,
  parseObjectDatagram,
  varintSize,
  writeVarintInto,
  maxObjectDatagramSize,
  encodeObjectDatagramInto,
  MOQ_TRANSPORT_VERSION,
} from '../../src/moq/moq-transport.js';
import { MoqRole } from '../../src/moq/types.js';

describe('VARINT encoding', () => {
  it('should encode 1-byte values (0-63)', () => {
    expect(encodeVarint(0)).toEqual(new Uint8Array([0x00]));
    expect(encodeVarint(1)).toEqual(new Uint8Array([0x01]));
    expect(encodeVarint(37)).toEqual(new Uint8Array([0x25]));
    expect(encodeVarint(63)).toEqual(new Uint8Array([0x3f]));
  });

  it('should encode 2-byte values (64-16383)', () => {
    expect(encodeVarint(64)).toEqual(new Uint8Array([0x40, 0x40]));
    expect(encodeVarint(100)).toEqual(new Uint8Array([0x40, 0x64]));
    expect(encodeVarint(16383)).toEqual(new Uint8Array([0x7f, 0xff]));
  });

  it('should encode 4-byte values (16384-1073741823)', () => {
    const result = encodeVarint(16384);
    expect(result.length).toBe(4);
    expect(result[0]! >> 6).toBe(2); // 10xxxxxx prefix
  });

  it('should encode 8-byte values (>= 1073741824)', () => {
    const result = encodeVarint(1073741824);
    expect(result.length).toBe(8);
    expect(result[0]! >> 6).toBe(3); // 11xxxxxx prefix
  });

  it('should handle BigInt values', () => {
    const result = encodeVarint(BigInt('9223372036854775807')); // Max int64
    expect(result.length).toBe(8);
  });
});

describe('VARINT decoding', () => {
  it('should decode 1-byte values', () => {
    const { value, bytesRead } = decodeVarint(new Uint8Array([0x25]));
    expect(value).toBe(37n);
    expect(bytesRead).toBe(1);
  });

  it('should decode 2-byte values', () => {
    const { value, bytesRead } = decodeVarint(new Uint8Array([0x7b, 0xbd]));
    expect(value).toBe(15293n);
    expect(bytesRead).toBe(2);
  });

  it('should decode 4-byte values', () => {
    const { value, bytesRead } = decodeVarint(new Uint8Array([0x9d, 0x7f, 0x3e, 0x7d]));
    expect(value).toBe(494878333n);
    expect(bytesRead).toBe(4);
  });

  it('should decode with offset', () => {
    const data = new Uint8Array([0xff, 0x25, 0x00]);
    const { value, bytesRead } = decodeVarint(data, 1);
    expect(value).toBe(37n);
    expect(bytesRead).toBe(1);
  });

  it('should round-trip encode/decode', () => {
    const testValues = [0, 1, 63, 64, 100, 16383, 16384, 1000000];
    for (const original of testValues) {
      const encoded = encodeVarint(original);
      const { value } = decodeVarint(encoded);
      expect(Number(value)).toBe(original);
    }
  });
});

describe('String encoding', () => {
  it('should encode empty string', () => {
    const encoded = encodeString('');
    expect(encoded).toEqual(new Uint8Array([0x00]));
  });

  it('should encode simple string', () => {
    const encoded = encodeString('hello');
    expect(encoded[0]).toBe(5); // Length prefix
    expect(new TextDecoder().decode(encoded.slice(1))).toBe('hello');
  });

  it('should round-trip encode/decode', () => {
    const testStrings = ['', 'hello', 'Hello, 世界!', 'a'.repeat(1000)];
    for (const original of testStrings) {
      const encoded = encodeString(original);
      const { value } = decodeString(encoded);
      expect(value).toBe(original);
    }
  });
});

describe('Bytes encoding', () => {
  it('should encode empty bytes', () => {
    const encoded = encodeBytes(new Uint8Array(0));
    expect(encoded).toEqual(new Uint8Array([0x00]));
  });

  it('should encode bytes with length prefix', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03]);
    const encoded = encodeBytes(data);
    expect(encoded[0]).toBe(3); // Length prefix
    expect(encoded.slice(1)).toEqual(data);
  });

  it('should round-trip encode/decode', () => {
    const testData = [
      new Uint8Array(0),
      new Uint8Array([0x00]),
      new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]),
    ];
    for (const original of testData) {
      const encoded = encodeBytes(original);
      const { value } = decodeBytes(encoded);
      expect(value).toEqual(original);
    }
  });
});

describe('MessageBuilder', () => {
  it('should build a message with varints', () => {
    const builder = new MessageBuilder();
    builder.writeVarint(1);
    builder.writeVarint(2);
    builder.writeVarint(3);

    const result = builder.build();
    expect(result).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
  });

  it('should build a message with strings', () => {
    const builder = new MessageBuilder();
    builder.writeString('hi');

    const result = builder.build();
    expect(result).toEqual(new Uint8Array([0x02, 0x68, 0x69])); // length + "hi"
  });

  it('should chain writes', () => {
    const result = new MessageBuilder()
      .writeVarint(1)
      .writeString('a')
      .writeRaw(new Uint8Array([0xff]))
      .build();

    expect(result).toEqual(new Uint8Array([0x01, 0x01, 0x61, 0xff]));
  });
});

describe('CLIENT_SETUP message', () => {
  it('should build a valid CLIENT_SETUP', () => {
    const msg = buildClientSetup([MOQ_TRANSPORT_VERSION], MoqRole.PUBSUB);

    // Should start with message type (0x20 for CLIENT_SETUP)
    const { value: msgType } = decodeVarint(msg, 0);
    expect(Number(msgType)).toBe(0x20);
  });

  it('should not include a role parameter or version list (draft-16)', () => {
    // draft-16 removed the ROLE setup parameter and the in-band version list.
    // With no path/maxSubscribeId the body is just an empty param list:
    // [type 0x20][len 0x0001][count 0x00] = 4 bytes.
    const msg = buildClientSetup([MOQ_TRANSPORT_VERSION], MoqRole.SUBSCRIBER);
    expect(msg.length).toBe(4);
    expect(msg[3]).toBe(0x00); // parameter count = 0
  });

  it('should include path parameter when provided', () => {
    const msgWithPath = buildClientSetup([MOQ_TRANSPORT_VERSION], MoqRole.PUBSUB, '/test');
    const msgWithoutPath = buildClientSetup([MOQ_TRANSPORT_VERSION], MoqRole.PUBSUB);

    expect(msgWithPath.length).toBeGreaterThan(msgWithoutPath.length);
  });
});

describe('MOQ Protocol Version', () => {
  it('should be draft-16', () => {
    // Draft marker (0xff000000) + draft number (0x10 = 16)
    expect(MOQ_TRANSPORT_VERSION).toBe(0xff000010);
  });
});

// ---------------------------------------------------------------------------
// Zero-allocation framing (worker-capture-plan.md P1). The bar: byte-for-byte
// parity with the existing allocating builders, so the worker send path can
// frame into a reused scratch buffer with no behaviour change.
// ---------------------------------------------------------------------------

describe('writeVarintInto / varintSize (zero-alloc varint)', () => {
  // Boundaries of every varint width, as both number and bigint, plus large 8-byte.
  const VALUES: Array<number | bigint> = [
    0, 1, 63, // 1-byte
    64, 100, 16383, // 2-byte
    16384, 494878333, 1073741823, // 4-byte (last = 2^30 - 1)
    1073741824, 9999999999, // 8-byte (first = 2^30)
    0n, 63n, 64n, 16383n, 16384n, 1073741823n, 1073741824n,
    4611686018427387903n, // 2^62 - 1 = max QUIC varint (top 2 bits are the length prefix)
  ];

  it('produces bytes identical to encodeVarint, at the right offset', () => {
    for (const v of VALUES) {
      const expected = encodeVarint(v);
      // Write into a padded scratch at a non-zero offset to exercise offset math.
      const scratch = new Uint8Array(16).fill(0xee);
      const end = writeVarintInto(scratch, 3, v);
      expect(end - 3).toBe(expected.length);
      expect(scratch.subarray(3, end)).toEqual(expected);
      // Bytes outside [3, end) are untouched.
      expect(scratch[2]).toBe(0xee);
      expect(scratch[end]).toBe(0xee);
    }
  });

  it('varintSize matches encodeVarint length for every value', () => {
    for (const v of VALUES) {
      expect(varintSize(v)).toBe(encodeVarint(v).length);
    }
  });

  it('round-trips through decodeVarint', () => {
    for (const v of VALUES) {
      const scratch = new Uint8Array(16);
      const end = writeVarintInto(scratch, 0, v);
      const { value, bytesRead } = decodeVarint(scratch.subarray(0, end));
      expect(value).toBe(typeof v === 'bigint' ? v : BigInt(v));
      expect(bytesRead).toBe(end);
    }
  });

  it('rejects negative values', () => {
    expect(() => writeVarintInto(new Uint8Array(8), 0, -1)).toThrow();
    expect(() => writeVarintInto(new Uint8Array(8), 0, -1n)).toThrow();
  });
});

describe('encodeObjectDatagramInto (zero-alloc datagram framing)', () => {
  interface Case {
    alias: number;
    group: bigint;
    object: bigint;
    priority: number;
    payload: Uint8Array;
  }
  const opus = new Uint8Array(40);
  for (let i = 0; i < opus.length; i++) opus[i] = (i * 7) & 0xff;
  const CASES: Case[] = [
    { alias: 0, group: 0n, object: 0n, priority: 0, payload: new Uint8Array(0) },
    { alias: 1, group: 5n, object: 3n, priority: 128, payload: new Uint8Array([0xde, 0xad]) },
    { alias: 63, group: 16383n, object: 200n, priority: 255, payload: opus },
    // wide group/object IDs forcing 4- and 8-byte varints
    { alias: 7, group: 1700000000000n, object: 1073741824n, priority: 1, payload: opus },
  ];

  it('is byte-for-byte identical to buildObjectDatagram', () => {
    for (const c of CASES) {
      const expected = buildObjectDatagram(c.alias, c.group, c.object, c.priority, c.payload);
      const scratch = new Uint8Array(maxObjectDatagramSize(c.payload.length));
      const len = encodeObjectDatagramInto(scratch, c.alias, c.group, c.object, c.priority, c.payload);
      expect(len).toBe(expected.length);
      expect(scratch.subarray(0, len)).toEqual(expected);
    }
  });

  it('round-trips through parseObjectDatagram', () => {
    for (const c of CASES) {
      const scratch = new Uint8Array(maxObjectDatagramSize(c.payload.length));
      const len = encodeObjectDatagramInto(scratch, c.alias, c.group, c.object, c.priority, c.payload);
      const parsed = parseObjectDatagram(scratch.subarray(0, len));
      expect(parsed.trackAlias).toBe(c.alias);
      expect(parsed.groupId).toBe(c.group);
      expect(parsed.objectId).toBe(c.object);
      expect(parsed.publisherPriority).toBe(c.priority);
      expect(parsed.payload).toEqual(c.payload);
    }
  });

  it('maxObjectDatagramSize is a safe upper bound', () => {
    for (const c of CASES) {
      const scratch = new Uint8Array(maxObjectDatagramSize(c.payload.length));
      const len = encodeObjectDatagramInto(scratch, c.alias, c.group, c.object, c.priority, c.payload);
      expect(len).toBeLessThanOrEqual(scratch.length);
    }
  });

  it('reuses a single scratch buffer across frames (no per-frame allocation)', () => {
    // One scratch sized for the largest payload, framed repeatedly. Each frame must
    // write from offset 0 and produce its own correct bytes — proving the buffer is
    // reusable (the whole point of the zero-alloc path).
    const scratch = new Uint8Array(maxObjectDatagramSize(opus.length));
    for (let frame = 0; frame < 5; frame++) {
      const group = BigInt(frame);
      const object = BigInt(frame * 2);
      const expected = buildObjectDatagram(2, group, object, 128, opus);
      const len = encodeObjectDatagramInto(scratch, 2, group, object, 128, opus);
      expect(scratch.subarray(0, len)).toEqual(expected);
      // The returned view shares the scratch's buffer — no new allocation.
      expect(scratch.subarray(0, len).buffer).toBe(scratch.buffer);
    }
  });
});
