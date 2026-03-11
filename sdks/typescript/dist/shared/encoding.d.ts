import { EntityInfo3, Position, Rotation } from '../types.js';
/**
 * Size of EntityInfo3 binary encoding in bytes
 */
export declare const ENTITY_INFO3_SIZE = 48;
/**
 * Parse a UUID string into 16 bytes (RFC 4122 binary format)
 *
 * @param uuid - UUID string like "550e8400-e29b-41d4-a716-446655440000"
 * @returns 16-byte Uint8Array
 */
export declare function uuidToBytes(uuid: string): Uint8Array;
/**
 * Convert 16 bytes to a UUID string
 *
 * @param bytes - 16-byte array
 * @returns UUID string with hyphens
 */
export declare function bytesToUuid(bytes: Uint8Array): string;
/**
 * Encode an EntityInfo3 struct to 48 bytes
 *
 * @param info - EntityInfo3 data
 * @returns 48-byte Uint8Array
 */
export declare function entityInfo3ToBytes(info: EntityInfo3): Uint8Array;
/**
 * Decode 48 bytes to an EntityInfo3 struct
 *
 * @param bytes - 48-byte array
 * @returns EntityInfo3 data
 */
export declare function entityInfo3FromBytes(bytes: Uint8Array): EntityInfo3;
/**
 * Create a default EntityInfo3 for a given entity ID
 *
 * @param entityId - UUID string
 * @param position - Initial position (defaults to center: 0.5, 0.5, 0.5)
 * @param rotation - Initial rotation (defaults to no rotation: 0, 0, 0)
 * @param volume - Initial volume (defaults to 1.0)
 */
export declare function createEntityInfo3(entityId: string, position?: Partial<Position>, rotation?: Partial<Rotation>, volume?: number): EntityInfo3;
/**
 * Validate a UUID string format
 *
 * @param uuid - UUID string to validate
 * @returns true if valid UUID format
 */
export declare function isValidUuid(uuid: string): boolean;
//# sourceMappingURL=encoding.d.ts.map