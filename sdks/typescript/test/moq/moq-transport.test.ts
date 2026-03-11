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

  it('should include role parameter', () => {
    const msg = buildClientSetup([MOQ_TRANSPORT_VERSION], MoqRole.SUBSCRIBER);

    // Message should include the role parameter
    expect(msg.length).toBeGreaterThan(5);
  });

  it('should include path parameter when provided', () => {
    const msgWithPath = buildClientSetup([MOQ_TRANSPORT_VERSION], MoqRole.PUBSUB, '/test');
    const msgWithoutPath = buildClientSetup([MOQ_TRANSPORT_VERSION], MoqRole.PUBSUB);

    expect(msgWithPath.length).toBeGreaterThan(msgWithoutPath.length);
  });
});

describe('MOQ Protocol Version', () => {
  it('should be draft-11', () => {
    // Draft marker (0xff000000) + draft number (11)
    expect(MOQ_TRANSPORT_VERSION).toBe(0xff000000 + 11);
  });
});
