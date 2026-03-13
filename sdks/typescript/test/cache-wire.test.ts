import { describe, it, expect } from "vitest";
import {
  decodeCacheOp,
  encodeCacheOp,
  isCacheEnvelope,
  CacheOp,
} from "../src/shared/cache-wire";
import vectors from "./wire_vectors.json";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("cache wire format", () => {
  describe("test vector decoding", () => {
    for (const v of vectors) {
      it(`decodes ${v.name}`, () => {
        const encoded = hexToBytes(v.encoded_hex);
        const op = decodeCacheOp(encoded);
        expect(op).not.toBeNull();
        if (!op) return;

        expect(op.topic).toBe(v.topic);
        expect(op.key).toBe(v.key);
        expect(op.opId).toBe(BigInt(v.op_id));
        expect(op.nodeId).toBe(v.node_id);
        expect(op.tombstone).toBe(v.tombstone);

        const expectedValue = v.value_hex ? hexToBytes(v.value_hex) : new Uint8Array(0);
        expect(bytesToHex(op.value)).toBe(bytesToHex(expectedValue));
      });
    }
  });

  describe("test vector encoding matches Go", () => {
    for (const v of vectors) {
      it(`encodes ${v.name} to matching bytes`, () => {
        const value = v.value_hex ? hexToBytes(v.value_hex) : new Uint8Array(0);
        const op: CacheOp = {
          topic: v.topic,
          key: v.key,
          value,
          opId: BigInt(v.op_id),
          nodeId: v.node_id,
          tombstone: v.tombstone,
        };
        const encoded = encodeCacheOp(op);
        expect(bytesToHex(encoded)).toBe(v.encoded_hex);
      });
    }
  });

  describe("round-trip", () => {
    it("encode then decode preserves all fields", () => {
      const op: CacheOp = {
        topic: "attributes",
        key: "test-uuid",
        value: new TextEncoder().encode('{"name":"test"}'),
        opId: BigInt("1234567890"),
        nodeId: 99,
        tombstone: false,
      };
      const encoded = encodeCacheOp(op);
      const decoded = decodeCacheOp(encoded);
      expect(decoded).not.toBeNull();
      if (!decoded) return;

      expect(decoded.topic).toBe(op.topic);
      expect(decoded.key).toBe(op.key);
      expect(decoded.opId).toBe(op.opId);
      expect(decoded.nodeId).toBe(op.nodeId);
      expect(decoded.tombstone).toBe(op.tombstone);
      expect(bytesToHex(decoded.value)).toBe(bytesToHex(op.value));
    });

    it("round-trips tombstone", () => {
      const op: CacheOp = {
        topic: "attributes",
        key: "gone-node",
        value: new Uint8Array(0),
        opId: BigInt("999"),
        nodeId: 1,
        tombstone: true,
      };
      const encoded = encodeCacheOp(op);
      const decoded = decodeCacheOp(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded!.tombstone).toBe(true);
    });
  });

  describe("error handling", () => {
    it("returns null for empty input", () => {
      expect(decodeCacheOp(new Uint8Array(0))).toBeNull();
    });

    it("returns null for truncated input", () => {
      expect(decodeCacheOp(new Uint8Array([0xca, 0x00]))).toBeNull();
    });

    it("returns null for wrong version", () => {
      const buf = new Uint8Array(21);
      buf[0] = 0x01;
      expect(decodeCacheOp(buf)).toBeNull();
    });

    it("returns null for key length overrun", () => {
      const op: CacheOp = {
        topic: "a",
        key: "k",
        value: new Uint8Array([1]),
        opId: BigInt(100),
        nodeId: 1,
        tombstone: false,
      };
      const encoded = encodeCacheOp(op);
      // Corrupt key length to 0xFFFF
      const topicLen = encoded[14];
      const keyLenOff = 15 + topicLen;
      encoded[keyLenOff] = 0xff;
      encoded[keyLenOff + 1] = 0xff;
      expect(decodeCacheOp(encoded)).toBeNull();
    });

    it("returns null for value length overrun", () => {
      const op: CacheOp = {
        topic: "a",
        key: "k",
        value: new Uint8Array([1]),
        opId: BigInt(100),
        nodeId: 1,
        tombstone: false,
      };
      const encoded = encodeCacheOp(op);
      const topicLen = encoded[14];
      const keyLenOff = 15 + topicLen;
      const keyLen = (encoded[keyLenOff] << 8) | encoded[keyLenOff + 1];
      const valLenOff = keyLenOff + 2 + keyLen;
      encoded[valLenOff] = 0xff;
      encoded[valLenOff + 1] = 0xff;
      encoded[valLenOff + 2] = 0xff;
      encoded[valLenOff + 3] = 0xff;
      expect(decodeCacheOp(encoded)).toBeNull();
    });
  });

  describe("isCacheEnvelope", () => {
    it("detects cache envelope", () => {
      const op: CacheOp = {
        topic: "a",
        key: "k",
        value: new Uint8Array(0),
        opId: BigInt(1),
        nodeId: 1,
        tombstone: false,
      };
      expect(isCacheEnvelope(encodeCacheOp(op))).toBe(true);
    });

    it("rejects JSON", () => {
      expect(
        isCacheEnvelope(new TextEncoder().encode('{"name":"alice"}'))
      ).toBe(false);
    });

    it("rejects empty", () => {
      expect(isCacheEnvelope(new Uint8Array(0))).toBe(false);
    });
  });
});
