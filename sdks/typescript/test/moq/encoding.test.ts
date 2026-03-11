/**
 * Tests for EntityInfo3 binary encoding/decoding
 */

import { describe, it, expect } from 'vitest';
import {
  ENTITY_INFO3_SIZE,
  uuidToBytes,
  bytesToUuid,
  entityInfo3ToBytes,
  entityInfo3FromBytes,
  createEntityInfo3,
  isValidUuid,
} from '../../src/shared/encoding.js';
import type { EntityInfo3 } from '../../src/moq/types.js';

describe('UUID Encoding', () => {
  describe('uuidToBytes', () => {
    it('should convert UUID string to 16 bytes', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const bytes = uuidToBytes(uuid);

      expect(bytes.length).toBe(16);
      // First byte of 550e... is 0x55
      expect(bytes[0]).toBe(0x55);
      expect(bytes[1]).toBe(0x0e);
      expect(bytes[2]).toBe(0x84);
      expect(bytes[3]).toBe(0x00);
    });

    it('should handle lowercase UUIDs', () => {
      const uuid = 'abcdef00-1234-5678-9abc-def012345678';
      const bytes = uuidToBytes(uuid);

      expect(bytes.length).toBe(16);
      expect(bytes[0]).toBe(0xab);
      expect(bytes[1]).toBe(0xcd);
      expect(bytes[2]).toBe(0xef);
      expect(bytes[3]).toBe(0x00);
    });

    it('should handle uppercase UUIDs', () => {
      const uuid = 'ABCDEF00-1234-5678-9ABC-DEF012345678';
      const bytes = uuidToBytes(uuid);

      expect(bytes.length).toBe(16);
      expect(bytes[0]).toBe(0xab);
      expect(bytes[1]).toBe(0xcd);
    });

    it('should throw for invalid UUID length', () => {
      expect(() => uuidToBytes('too-short')).toThrow('Invalid UUID');
      expect(() => uuidToBytes('550e8400-e29b-41d4-a716-4466554400001')).toThrow('Invalid UUID');
    });

    it('should throw for invalid hex characters', () => {
      expect(() => uuidToBytes('gggggggg-gggg-gggg-gggg-gggggggggggg')).toThrow('invalid hex');
    });
  });

  describe('bytesToUuid', () => {
    it('should convert 16 bytes to UUID string', () => {
      const bytes = new Uint8Array([
        0x55, 0x0e, 0x84, 0x00, 0xe2, 0x9b, 0x41, 0xd4, 0xa7, 0x16, 0x44, 0x66, 0x55, 0x44, 0x00,
        0x00,
      ]);
      const uuid = bytesToUuid(bytes);

      expect(uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should pad single digit hex values', () => {
      const bytes = new Uint8Array([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
        0x00,
      ]);
      const uuid = bytesToUuid(bytes);

      expect(uuid).toBe('01020304-0506-0708-090a-0b0c0d0e0f00');
    });

    it('should throw for invalid byte length', () => {
      expect(() => bytesToUuid(new Uint8Array(15))).toThrow('Invalid UUID bytes');
      expect(() => bytesToUuid(new Uint8Array(17))).toThrow('Invalid UUID bytes');
    });
  });

  describe('round-trip', () => {
    it('should preserve UUID through encode/decode cycle', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const bytes = uuidToBytes(uuid);
      const result = bytesToUuid(bytes);

      expect(result).toBe(uuid);
    });

    it('should preserve various UUIDs', () => {
      const testCases = [
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
        '12345678-1234-5678-9abc-def012345678',
      ];

      for (const uuid of testCases) {
        const bytes = uuidToBytes(uuid);
        const result = bytesToUuid(bytes);
        expect(result).toBe(uuid);
      }
    });
  });
});

describe('EntityInfo3 Encoding', () => {
  const testEntityInfo: EntityInfo3 = {
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    position: { x: 0.5, y: 0.25, z: 0.75 },
    rotation: { yaw: 90, pitch: 45, roll: 0 },
    volume: 0.8,
    gone: false,
  };

  describe('entityInfo3ToBytes', () => {
    it('should produce 48 bytes', () => {
      const bytes = entityInfo3ToBytes(testEntityInfo);
      expect(bytes.length).toBe(ENTITY_INFO3_SIZE);
      expect(bytes.length).toBe(48);
    });

    it('should encode UUID in first 16 bytes', () => {
      const bytes = entityInfo3ToBytes(testEntityInfo);
      const uuidBytes = bytes.slice(0, 16);
      const uuid = bytesToUuid(uuidBytes);

      expect(uuid).toBe(testEntityInfo.uuid);
    });

    it('should encode position as float32 little-endian', () => {
      const bytes = entityInfo3ToBytes(testEntityInfo);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

      // Position starts at byte 16
      const x = view.getFloat32(16, true);
      const y = view.getFloat32(20, true);
      const z = view.getFloat32(24, true);

      expect(x).toBeCloseTo(0.5, 5);
      expect(y).toBeCloseTo(0.25, 5);
      expect(z).toBeCloseTo(0.75, 5);
    });

    it('should encode rotation as float32 little-endian', () => {
      const bytes = entityInfo3ToBytes(testEntityInfo);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

      // Rotation starts at byte 28
      const yaw = view.getFloat32(28, true);
      const pitch = view.getFloat32(32, true);
      const roll = view.getFloat32(36, true);

      expect(yaw).toBeCloseTo(90, 5);
      expect(pitch).toBeCloseTo(45, 5);
      expect(roll).toBeCloseTo(0, 5);
    });

    it('should encode volume as float32 little-endian', () => {
      const bytes = entityInfo3ToBytes(testEntityInfo);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

      // Volume at byte 40
      const volume = view.getFloat32(40, true);
      expect(volume).toBeCloseTo(0.8, 5);
    });

    it('should encode gone flag as int32 little-endian', () => {
      const bytes = entityInfo3ToBytes(testEntityInfo);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

      // Gone flag at byte 44
      const gone = view.getInt32(44, true);
      expect(gone).toBe(0);

      // Test with gone = true
      const goneInfo = { ...testEntityInfo, gone: true };
      const goneBytes = entityInfo3ToBytes(goneInfo);
      const goneView = new DataView(goneBytes.buffer, goneBytes.byteOffset, goneBytes.byteLength);
      expect(goneView.getInt32(44, true)).toBe(1);
    });
  });

  describe('entityInfo3FromBytes', () => {
    it('should decode 48 bytes to EntityInfo3', () => {
      const bytes = entityInfo3ToBytes(testEntityInfo);
      const decoded = entityInfo3FromBytes(bytes);

      expect(decoded.uuid).toBe(testEntityInfo.uuid);
    });

    it('should decode position correctly', () => {
      const bytes = entityInfo3ToBytes(testEntityInfo);
      const decoded = entityInfo3FromBytes(bytes);

      expect(decoded.position.x).toBeCloseTo(0.5, 5);
      expect(decoded.position.y).toBeCloseTo(0.25, 5);
      expect(decoded.position.z).toBeCloseTo(0.75, 5);
    });

    it('should decode rotation correctly', () => {
      const bytes = entityInfo3ToBytes(testEntityInfo);
      const decoded = entityInfo3FromBytes(bytes);

      expect(decoded.rotation.yaw).toBeCloseTo(90, 5);
      expect(decoded.rotation.pitch).toBeCloseTo(45, 5);
      expect(decoded.rotation.roll).toBeCloseTo(0, 5);
    });

    it('should decode volume correctly', () => {
      const bytes = entityInfo3ToBytes(testEntityInfo);
      const decoded = entityInfo3FromBytes(bytes);

      expect(decoded.volume).toBeCloseTo(0.8, 5);
    });

    it('should decode gone flag correctly', () => {
      const bytes = entityInfo3ToBytes(testEntityInfo);
      const decoded = entityInfo3FromBytes(bytes);
      expect(decoded.gone).toBe(false);

      const goneInfo = { ...testEntityInfo, gone: true };
      const goneBytes = entityInfo3ToBytes(goneInfo);
      const goneDecoded = entityInfo3FromBytes(goneBytes);
      expect(goneDecoded.gone).toBe(true);
    });

    it('should throw for invalid byte length', () => {
      expect(() => entityInfo3FromBytes(new Uint8Array(47))).toThrow('Invalid EntityInfo3 bytes');
      expect(() => entityInfo3FromBytes(new Uint8Array(49))).toThrow('Invalid EntityInfo3 bytes');
    });
  });

  describe('round-trip', () => {
    it('should preserve data through encode/decode cycle', () => {
      const bytes = entityInfo3ToBytes(testEntityInfo);
      const decoded = entityInfo3FromBytes(bytes);

      expect(decoded.uuid).toBe(testEntityInfo.uuid);
      expect(decoded.position.x).toBeCloseTo(testEntityInfo.position.x, 5);
      expect(decoded.position.y).toBeCloseTo(testEntityInfo.position.y, 5);
      expect(decoded.position.z).toBeCloseTo(testEntityInfo.position.z, 5);
      expect(decoded.rotation.yaw).toBeCloseTo(testEntityInfo.rotation.yaw, 5);
      expect(decoded.rotation.pitch).toBeCloseTo(testEntityInfo.rotation.pitch, 5);
      expect(decoded.rotation.roll).toBeCloseTo(testEntityInfo.rotation.roll, 5);
      expect(decoded.volume).toBeCloseTo(testEntityInfo.volume, 5);
      expect(decoded.gone).toBe(testEntityInfo.gone);
    });

    it('should handle edge case values', () => {
      const edgeCases: EntityInfo3[] = [
        {
          uuid: '00000000-0000-0000-0000-000000000000',
          position: { x: 0, y: 0, z: 0 },
          rotation: { yaw: 0, pitch: 0, roll: 0 },
          volume: 0,
          gone: false,
        },
        {
          uuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          position: { x: 1, y: 1, z: 1 },
          rotation: { yaw: 360, pitch: 180, roll: 180 },
          volume: 1,
          gone: true,
        },
        {
          uuid: '12345678-1234-5678-9abc-def012345678',
          position: { x: -1, y: -1, z: -1 },
          rotation: { yaw: -90, pitch: -45, roll: -30 },
          volume: 0.5,
          gone: false,
        },
      ];

      for (const info of edgeCases) {
        const bytes = entityInfo3ToBytes(info);
        const decoded = entityInfo3FromBytes(bytes);

        expect(decoded.uuid).toBe(info.uuid);
        expect(decoded.position.x).toBeCloseTo(info.position.x, 5);
        expect(decoded.position.y).toBeCloseTo(info.position.y, 5);
        expect(decoded.position.z).toBeCloseTo(info.position.z, 5);
        expect(decoded.rotation.yaw).toBeCloseTo(info.rotation.yaw, 5);
        expect(decoded.rotation.pitch).toBeCloseTo(info.rotation.pitch, 5);
        expect(decoded.rotation.roll).toBeCloseTo(info.rotation.roll, 5);
        expect(decoded.volume).toBeCloseTo(info.volume, 5);
        expect(decoded.gone).toBe(info.gone);
      }
    });
  });
});

describe('createEntityInfo3', () => {
  it('should create EntityInfo3 with defaults', () => {
    const entityId = '550e8400-e29b-41d4-a716-446655440000';
    const info = createEntityInfo3(entityId);

    expect(info.uuid).toBe(entityId);
    expect(info.position).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
    expect(info.rotation).toEqual({ yaw: 0, pitch: 0, roll: 0 });
    expect(info.volume).toBe(1.0);
    expect(info.gone).toBe(false);
  });

  it('should accept partial position', () => {
    const info = createEntityInfo3('550e8400-e29b-41d4-a716-446655440000', { x: 0.1 });

    expect(info.position.x).toBe(0.1);
    expect(info.position.y).toBe(0.5); // default
    expect(info.position.z).toBe(0.5); // default
  });

  it('should accept partial rotation', () => {
    const info = createEntityInfo3('550e8400-e29b-41d4-a716-446655440000', undefined, { yaw: 45 });

    expect(info.rotation.yaw).toBe(45);
    expect(info.rotation.pitch).toBe(0); // default
    expect(info.rotation.roll).toBe(0); // default
  });

  it('should accept custom volume', () => {
    const info = createEntityInfo3('550e8400-e29b-41d4-a716-446655440000', undefined, undefined, 0.5);

    expect(info.volume).toBe(0.5);
  });

  it('should accept all parameters', () => {
    const info = createEntityInfo3(
      '550e8400-e29b-41d4-a716-446655440000',
      { x: 0.1, y: 0.2, z: 0.3 },
      { yaw: 10, pitch: 20, roll: 30 },
      0.7
    );

    expect(info.position).toEqual({ x: 0.1, y: 0.2, z: 0.3 });
    expect(info.rotation).toEqual({ yaw: 10, pitch: 20, roll: 30 });
    expect(info.volume).toBe(0.7);
  });
});

describe('isValidUuid', () => {
  it('should return true for valid UUIDs', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUuid('00000000-0000-0000-0000-000000000000')).toBe(true);
    expect(isValidUuid('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe(true);
    expect(isValidUuid('ABCDEF00-1234-5678-9ABC-DEF012345678')).toBe(true);
  });

  it('should return false for invalid UUIDs', () => {
    expect(isValidUuid('')).toBe(false);
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('550e8400e29b41d4a716446655440000')).toBe(false); // missing hyphens
    expect(isValidUuid('550e8400-e29b-41d4-a716-44665544000')).toBe(false); // too short
    expect(isValidUuid('550e8400-e29b-41d4-a716-4466554400001')).toBe(false); // too long
    expect(isValidUuid('gggggggg-gggg-gggg-gggg-gggggggggggg')).toBe(false); // invalid chars
  });
});

describe('Binary format compatibility with Go', () => {
  it('should match expected binary layout', () => {
    // This test validates the exact binary layout expected by the Go server
    const info: EntityInfo3 = {
      uuid: '01020304-0506-0708-090a-0b0c0d0e0f10',
      position: { x: 1.0, y: 2.0, z: 3.0 },
      rotation: { yaw: 4.0, pitch: 5.0, roll: 6.0 },
      volume: 7.0,
      gone: false,
    };

    const bytes = entityInfo3ToBytes(info);

    // Check UUID bytes (big-endian as per RFC 4122)
    expect(bytes[0]).toBe(0x01);
    expect(bytes[1]).toBe(0x02);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
    expect(bytes[4]).toBe(0x05);
    expect(bytes[5]).toBe(0x06);
    expect(bytes[6]).toBe(0x07);
    expect(bytes[7]).toBe(0x08);
    expect(bytes[8]).toBe(0x09);
    expect(bytes[9]).toBe(0x0a);
    expect(bytes[10]).toBe(0x0b);
    expect(bytes[11]).toBe(0x0c);
    expect(bytes[12]).toBe(0x0d);
    expect(bytes[13]).toBe(0x0e);
    expect(bytes[14]).toBe(0x0f);
    expect(bytes[15]).toBe(0x10);

    // Check float32 values are at expected offsets (little-endian)
    const view = new DataView(bytes.buffer);

    // Position X at offset 16
    expect(view.getFloat32(16, true)).toBe(1.0);
    // Position Y at offset 20
    expect(view.getFloat32(20, true)).toBe(2.0);
    // Position Z at offset 24
    expect(view.getFloat32(24, true)).toBe(3.0);
    // Rotation Yaw at offset 28
    expect(view.getFloat32(28, true)).toBe(4.0);
    // Rotation Pitch at offset 32
    expect(view.getFloat32(32, true)).toBe(5.0);
    // Rotation Roll at offset 36
    expect(view.getFloat32(36, true)).toBe(6.0);
    // Volume at offset 40
    expect(view.getFloat32(40, true)).toBe(7.0);
    // Gone at offset 44
    expect(view.getInt32(44, true)).toBe(0);
  });
});
