/**
 * Binary Encoding - EntityInfo3 binary encoding/decoding
 *
 * Implements the 48-byte binary format used by the Go server for
 * position, rotation, and state data.
 *
 * Binary Layout (48 bytes):
 *   [0-15]   UUID (16 bytes, RFC 4122 binary format)
 *   [16-19]  Position.X (float32, little-endian)
 *   [20-23]  Position.Y (float32, little-endian)
 *   [24-27]  Position.Z (float32, little-endian)
 *   [28-31]  Rotation.Yaw (float32, little-endian)
 *   [32-35]  Rotation.Pitch (float32, little-endian)
 *   [36-39]  Rotation.Roll (float32, little-endian)
 *   [40-43]  Volume (float32, little-endian)
 *   [44-47]  Gone flag (int32, little-endian)
 */

import { EntityInfo3, Position, Rotation } from '../types.js';

/**
 * Size of EntityInfo3 binary encoding in bytes
 */
export const ENTITY_INFO3_SIZE = 48;

/**
 * Parse a UUID string into 16 bytes (RFC 4122 binary format)
 *
 * @param uuid - UUID string like "550e8400-e29b-41d4-a716-446655440000"
 * @returns 16-byte Uint8Array
 */
export function uuidToBytes(uuid: string): Uint8Array {
  // Remove hyphens and validate
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) {
    throw new Error(`Invalid UUID: expected 32 hex chars, got ${hex.length}`);
  }

  // Convert hex pairs to bytes
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    const hexByte = hex.substring(i * 2, i * 2 + 2);
    const value = parseInt(hexByte, 16);
    if (isNaN(value)) {
      throw new Error(`Invalid UUID: invalid hex at position ${i * 2}`);
    }
    bytes[i] = value;
  }

  return bytes;
}

/**
 * Convert 16 bytes to a UUID string
 *
 * @param bytes - 16-byte array
 * @returns UUID string with hyphens
 */
export function bytesToUuid(bytes: Uint8Array): string {
  if (bytes.length !== 16) {
    throw new Error(`Invalid UUID bytes: expected 16 bytes, got ${bytes.length}`);
  }

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i]!.toString(16).padStart(2, '0'));
  }

  // Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}

/**
 * Encode an EntityInfo3 struct to 48 bytes
 *
 * @param info - EntityInfo3 data
 * @returns 48-byte Uint8Array
 */
export function entityInfo3ToBytes(info: EntityInfo3): Uint8Array {
  const buffer = new ArrayBuffer(ENTITY_INFO3_SIZE);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // UUID (bytes 0-15)
  const uuidBytes = uuidToBytes(info.uuid);
  bytes.set(uuidBytes, 0);

  // Position (bytes 16-27) - float32 little-endian
  view.setFloat32(16, info.position.x, true);
  view.setFloat32(20, info.position.y, true);
  view.setFloat32(24, info.position.z, true);

  // Rotation (bytes 28-39) - float32 little-endian
  view.setFloat32(28, info.rotation.yaw, true);
  view.setFloat32(32, info.rotation.pitch, true);
  view.setFloat32(36, info.rotation.roll, true);

  // Volume (bytes 40-43) - float32 little-endian
  view.setFloat32(40, info.volume, true);

  // Gone flag (bytes 44-47) - int32 little-endian
  view.setInt32(44, info.gone ? 1 : 0, true);

  return bytes;
}

/**
 * Decode 48 bytes to an EntityInfo3 struct
 *
 * @param bytes - 48-byte array
 * @returns EntityInfo3 data
 */
export function entityInfo3FromBytes(bytes: Uint8Array): EntityInfo3 {
  if (bytes.length !== ENTITY_INFO3_SIZE) {
    throw new Error(`Invalid EntityInfo3 bytes: expected ${ENTITY_INFO3_SIZE} bytes, got ${bytes.length}`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // UUID (bytes 0-15)
  const uuidBytes = bytes.slice(0, 16);
  const uuid = bytesToUuid(uuidBytes);

  // Position (bytes 16-27) - float32 little-endian
  const position: Position = {
    x: view.getFloat32(16, true),
    y: view.getFloat32(20, true),
    z: view.getFloat32(24, true),
  };

  // Rotation (bytes 28-39) - float32 little-endian
  const rotation: Rotation = {
    yaw: view.getFloat32(28, true),
    pitch: view.getFloat32(32, true),
    roll: view.getFloat32(36, true),
  };

  // Volume (bytes 40-43) - float32 little-endian
  const volume = view.getFloat32(40, true);

  // Gone flag (bytes 44-47) - int32 little-endian
  const gone = view.getInt32(44, true) !== 0;

  return {
    uuid,
    position,
    rotation,
    volume,
    gone,
  };
}

/**
 * Create a default EntityInfo3 for a given entity ID
 *
 * @param entityId - UUID string
 * @param position - Initial position (defaults to center: 0.5, 0.5, 0.5)
 * @param rotation - Initial rotation (defaults to no rotation: 0, 0, 0)
 * @param volume - Initial volume (defaults to 1.0)
 */
export function createEntityInfo3(
  entityId: string,
  position?: Partial<Position>,
  rotation?: Partial<Rotation>,
  volume?: number
): EntityInfo3 {
  return {
    uuid: entityId,
    position: {
      x: position?.x ?? 0.5,
      y: position?.y ?? 0.5,
      z: position?.z ?? 0.5,
    },
    rotation: {
      yaw: rotation?.yaw ?? 0,
      pitch: rotation?.pitch ?? 0,
      roll: rotation?.roll ?? 0,
    },
    volume: volume ?? 1.0,
    gone: false,
  };
}

/**
 * Validate a UUID string format
 *
 * @param uuid - UUID string to validate
 * @returns true if valid UUID format
 */
export function isValidUuid(uuid: string): boolean {
  // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
