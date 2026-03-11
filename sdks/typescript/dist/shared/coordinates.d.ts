import { Position, Rotation } from '../types.js';
/** 3D vector (used by Three.js, Babylon, A-Frame, PlayCanvas, Unity) */
export interface Vec3 {
    x: number;
    y: number;
    z: number;
}
/** 2D vector (used by PixiJS) */
export interface Vec2 {
    x: number;
    y: number;
}
/** Unreal Engine FRotator (pitch/yaw/roll in degrees) */
export interface FRotator {
    pitch: number;
    yaw: number;
    roll: number;
}
/** Panaudia pose (position + rotation) */
export interface PanaudiaPose {
    position: Position;
    rotation: Rotation;
}
/** Three.js / PlayCanvas pose (position + Euler rotation as Vec3) */
export interface Vec3Pose {
    position: Vec3;
    rotation: Vec3;
}
/** Unreal Engine pose (position + FRotator) */
export interface UnrealPose {
    position: Vec3;
    rotation: FRotator;
}
/** PixiJS pose (2D position + single rotation angle) */
export interface PixiPose {
    position: Vec2;
    rotation: number;
}
/**
 * Convert Three.js position and rotation to Panaudia coordinates.
 *
 * @param position - Three.js position {x, y, z}
 * @param rotation - Three.js Euler rotation {x, y, z} in radians, XYZ order
 */
export declare function threejsToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose;
/**
 * Convert Panaudia coordinates to Three.js position and rotation.
 *
 * @returns Three.js position and Euler rotation {x, y, z} in radians, XYZ order
 */
export declare function panaudiaToThreejs(position: Position, rotation: Rotation): Vec3Pose;
/**
 * Convert Babylon.js position and rotation to Panaudia coordinates.
 *
 * @param position - Babylon.js position {x, y, z}
 * @param rotation - Babylon.js Euler rotation {x, y, z} in radians, YXZ order
 */
export declare function babylonToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose;
/**
 * Convert Panaudia coordinates to Babylon.js position and rotation.
 *
 * @returns Babylon.js position and Euler rotation {x, y, z} in radians, YXZ order
 */
export declare function panaudiaToBabylon(position: Position, rotation: Rotation): Vec3Pose;
/**
 * Convert A-Frame position and rotation to Panaudia coordinates.
 *
 * @param position - A-Frame position {x, y, z}
 * @param rotation - A-Frame rotation {x, y, z} in DEGREES, YXZ order
 */
export declare function aframeToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose;
/**
 * Convert Panaudia coordinates to A-Frame position and rotation.
 *
 * @returns A-Frame position and rotation {x, y, z} in DEGREES, YXZ order
 */
export declare function panaudiaToAframe(position: Position, rotation: Rotation): Vec3Pose;
/**
 * Convert PlayCanvas position and rotation to Panaudia coordinates.
 *
 * @param position - PlayCanvas position {x, y, z}
 * @param rotation - PlayCanvas Euler rotation {x, y, z} in DEGREES, XYZ order
 */
export declare function playcanvasToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose;
/**
 * Convert Panaudia coordinates to PlayCanvas position and rotation.
 *
 * @returns PlayCanvas position and Euler rotation {x, y, z} in DEGREES, XYZ order
 */
export declare function panaudiaToPlaycanvas(position: Position, rotation: Rotation): Vec3Pose;
/**
 * Convert Unity position and rotation to Panaudia coordinates.
 *
 * @param position - Unity position {x, y, z}
 * @param rotation - Unity Euler rotation {x, y, z} in DEGREES, ZXY order
 */
export declare function unityToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose;
/**
 * Convert Panaudia coordinates to Unity position and rotation.
 *
 * @returns Unity position and Euler rotation {x, y, z} in DEGREES, ZXY order
 */
export declare function panaudiaToUnity(position: Position, rotation: Rotation): Vec3Pose;
/**
 * Convert Unreal Engine position and FRotator to Panaudia coordinates.
 *
 * @param position - Unreal position {x, y, z} (X=forward, Y=right, Z=up)
 * @param rotation - Unreal FRotator {pitch, yaw, roll} in degrees
 */
export declare function unrealToPanaudia(position: Vec3, rotation: FRotator): PanaudiaPose;
/**
 * Convert Panaudia coordinates to Unreal Engine position and FRotator.
 *
 * @returns Unreal position {x, y, z} and FRotator {pitch, yaw, roll} in degrees
 */
export declare function panaudiaToUnreal(position: Position, rotation: Rotation): UnrealPose;
/**
 * Convert PixiJS position and rotation to Panaudia coordinates.
 *
 * @param position - PixiJS position {x, y} (screen coordinates)
 * @param rotation - PixiJS rotation in radians (clockwise positive)
 */
export declare function pixiToPanaudia(position: Vec2, rotation: number): PanaudiaPose;
/**
 * Convert Panaudia coordinates to PixiJS position and rotation.
 * Height (z) is discarded. Only yaw maps to 2D rotation; pitch and roll are ignored.
 *
 * @returns PixiJS position {x, y} and rotation in radians
 */
export declare function panaudiaToPixi(position: Position, rotation: Rotation): PixiPose;
/** @deprecated Use threejsToPanaudia() instead */
export declare function webglToAmbisonicPosition(pos: Vec3): Position;
/** @deprecated Use panaudiaToThreejs() instead */
export declare function ambisonicToWebglPosition(pos: Position): Vec3;
/** @deprecated Use threejsToPanaudia() instead */
export declare function webglToAmbisonicRotation(rot: Vec3): Rotation;
/** @deprecated Use panaudiaToThreejs() instead */
export declare function ambisonicToWebglRotation(rot: Rotation): Vec3;
//# sourceMappingURL=coordinates.d.ts.map