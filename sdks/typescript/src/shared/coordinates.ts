/**
 * Framework ↔ Panaudia Coordinate Conversion
 *
 * Converts between various 3D framework coordinate systems and Panaudia's
 * internal coordinate system.
 *
 * Panaudia coordinate system:
 *   Position: +X = forward, +Y = left, +Z = up (right-handed)
 *   Rotation: yaw/pitch/roll in degrees, YXZ Euler order
 *     yaw   = rotation around up axis (turning left/right)
 *     pitch = rotation around right axis (looking up/down)
 *     roll  = rotation around forward axis (tilting head)
 *
 * Supported frameworks:
 *   Three.js    — RH, Y-up, -Z forward, XYZ Euler, radians
 *   Babylon.js  — LH, Y-up, +Z forward, YXZ Euler, radians
 *   A-Frame     — RH, Y-up, -Z forward, YXZ Euler, degrees
 *   PlayCanvas  — RH, Y-up, -Z forward, XYZ Euler, degrees
 *   Unity       — LH, Y-up, +Z forward, ZXY Euler, degrees
 *   Unreal      — LH, Z-up, +X forward, FRotator (pitch/yaw/roll), degrees
 *   PixiJS      — 2D, Y-down, +X right, single rotation, radians
 *
 * Performance notes (benchmarked on Apple M-series, Node.js, 2026-03-09):
 *   Rotations go through a quaternion intermediary to correctly handle
 *   different Euler orders and left/right handedness. This is necessary for
 *   correctness on 5 of 7 frameworks (A-Frame and PixiJS use direct mapping).
 *   Cost per conversion: ~0.1–0.2µs (6 trig calls + ~40 arithmetic ops).
 *   500 players at 20Hz = 10,000 conversions/sec = ~2.5ms/sec total.
 *   100,000 conversions = ~14ms. Not a meaningful bottleneck.
 *
 * The Euler math is ported from Three.js (MIT license).
 * Copyright 2010-2024 Three.js authors. https://threejs.org/
 */

import type { Position, Rotation } from '../types.js';

// ============================================================================
// Framework-specific types
// ============================================================================

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

// ============================================================================
// Euler / Quaternion Math
// ============================================================================

type EulerOrder = 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

function radiansToDegrees(rad: number): number {
  return (rad / Math.PI) * 180;
}

function degreesToRadians(deg: number): number {
  return (deg / 180.0) * Math.PI;
}

/**
 * Convert Euler angles (radians) to quaternion.
 * Supports XYZ, YXZ, ZXY, ZYX intrinsic orders.
 * Formulas from Three.js Quaternion.setFromEuler().
 */
function eulerToQuaternion(
  ex: number,
  ey: number,
  ez: number,
  order: EulerOrder,
): Quat {
  const c1 = Math.cos(ex / 2);
  const c2 = Math.cos(ey / 2);
  const c3 = Math.cos(ez / 2);
  const s1 = Math.sin(ex / 2);
  const s2 = Math.sin(ey / 2);
  const s3 = Math.sin(ez / 2);

  switch (order) {
    case 'XYZ':
      return {
        x: s1 * c2 * c3 + c1 * s2 * s3,
        y: c1 * s2 * c3 - s1 * c2 * s3,
        z: c1 * c2 * s3 + s1 * s2 * c3,
        w: c1 * c2 * c3 - s1 * s2 * s3,
      };
    case 'YXZ':
      return {
        x: s1 * c2 * c3 + c1 * s2 * s3,
        y: c1 * s2 * c3 - s1 * c2 * s3,
        z: c1 * c2 * s3 - s1 * s2 * c3,
        w: c1 * c2 * c3 + s1 * s2 * s3,
      };
    case 'ZXY':
      return {
        x: s1 * c2 * c3 - c1 * s2 * s3,
        y: c1 * s2 * c3 + s1 * c2 * s3,
        z: c1 * c2 * s3 + s1 * s2 * c3,
        w: c1 * c2 * c3 - s1 * s2 * s3,
      };
    case 'ZYX':
      return {
        x: s1 * c2 * c3 - c1 * s2 * s3,
        y: c1 * s2 * c3 + s1 * c2 * s3,
        z: c1 * c2 * s3 - s1 * s2 * c3,
        w: c1 * c2 * c3 + s1 * s2 * s3,
      };
  }
}

/**
 * Convert quaternion to rotation matrix (column-major 4x4 elements).
 */
function quaternionToMatrix(q: Quat): number[] {
  const { x, y, z, w } = q;
  const x2 = x + x,
    y2 = y + y,
    z2 = z + z;
  const xx = x * x2,
    xy = x * y2,
    xz = x * z2;
  const yy = y * y2,
    yz = y * z2,
    zz = z * z2;
  const wx = w * x2,
    wy = w * y2,
    wz = w * z2;

  return [
    1 - (yy + zz), xy + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xz + wy, yz - wx, 1 - (xx + yy), 0,
    0, 0, 0, 1,
  ];
}

/**
 * Extract Euler angles (radians) from rotation matrix in the given order.
 * Formulas from Three.js Euler.setFromRotationMatrix().
 */
function matrixToEuler(
  te: number[],
  order: EulerOrder,
): { x: number; y: number; z: number } {
  const m11 = te[0]!,
    m12 = te[4]!,
    m13 = te[8]!;
  const m21 = te[1]!,
    m22 = te[5]!,
    m23 = te[9]!;
  const m31 = te[2]!,
    m32 = te[6]!,
    m33 = te[10]!;

  switch (order) {
    case 'XYZ': {
      const sy = clamp(m13, -1, 1);
      const ey = Math.asin(sy);
      if (Math.abs(sy) < 0.9999999) {
        return { x: Math.atan2(-m23, m33), y: ey, z: Math.atan2(-m12, m11) };
      } else {
        return { x: Math.atan2(m32, m22), y: ey, z: 0 };
      }
    }
    case 'YXZ': {
      const sx = clamp(m23, -1, 1);
      const ex = Math.asin(-sx);
      if (Math.abs(sx) < 0.9999999) {
        return { x: ex, y: Math.atan2(m13, m33), z: Math.atan2(m21, m22) };
      } else {
        return { x: ex, y: Math.atan2(-m31, m11), z: 0 };
      }
    }
    case 'ZXY': {
      const sx = clamp(m32, -1, 1);
      const ex = Math.asin(sx);
      if (Math.abs(sx) < 0.9999999) {
        return { x: ex, y: Math.atan2(-m31, m33), z: Math.atan2(-m12, m22) };
      } else {
        return { x: ex, y: 0, z: Math.atan2(m21, m11) };
      }
    }
    case 'ZYX': {
      const sy = clamp(m31, -1, 1);
      const ey = Math.asin(-sy);
      if (Math.abs(sy) < 0.9999999) {
        return { x: Math.atan2(m32, m33), y: ey, z: Math.atan2(m21, m11) };
      } else {
        return { x: 0, y: ey, z: Math.atan2(-m12, m22) };
      }
    }
  }
}

/**
 * Convert a quaternion from one Euler representation to another.
 */
function quaternionToEuler(q: Quat, order: EulerOrder): { x: number; y: number; z: number } {
  const m = quaternionToMatrix(q);
  return matrixToEuler(m, order);
}

// ============================================================================
// Internal: WebGL ↔ Panaudia core transforms
//
// WebGL (Three.js) axes: +X=right, +Y=up, +Z=backward
// Panaudia axes:         +X=forward, +Y=left, +Z=up
//
// Position mapping (no scale normalization):
//   Pan.x = -WebGL.z   (forward = -backward)
//   Pan.y = -WebGL.x   (left = -right)
//   Pan.z =  WebGL.y   (up = up)
//
// Rotation: The Panaudia YXZ Euler representation uses WebGL axis labels.
//   yaw   = Y component (rotation around WebGL Y / up axis)
//   pitch = X component (rotation around WebGL X / right axis)
//   roll  = Z component (rotation around WebGL Z / forward axis)
// ============================================================================

function webglPositionToPanaudia(pos: Vec3): Position {
  return { x: -pos.z, y: -pos.x, z: pos.y };
}

function panaudiaPositionToWebgl(pos: Position): Vec3 {
  return { x: -pos.y, y: pos.z, z: -pos.x };
}

/**
 * Convert a WebGL-space quaternion to Panaudia rotation (YXZ Euler, degrees).
 */
function webglQuatToPanaudiaRotation(q: Quat): Rotation {
  const euler = quaternionToEuler(q, 'YXZ');
  return {
    yaw: radiansToDegrees(euler.y),
    pitch: radiansToDegrees(euler.x),
    roll: radiansToDegrees(euler.z),
  };
}

/**
 * Convert Panaudia rotation (YXZ Euler, degrees) to a WebGL-space quaternion.
 */
function panaudiaRotationToWebglQuat(rot: Rotation): Quat {
  return eulerToQuaternion(
    degreesToRadians(rot.pitch),
    degreesToRadians(rot.yaw),
    degreesToRadians(rot.roll),
    'YXZ',
  );
}

// ============================================================================
// Internal: Framework → WebGL quaternion transforms
//
// For left-handed frameworks, we transform the quaternion from the framework's
// coordinate system to WebGL's right-handed system. This involves:
//   1. Transforming the vector part (x,y,z) by the coordinate mapping matrix
//   2. Negating w if the mapping has det=-1 (handedness change)
// ============================================================================

/**
 * Transform a quaternion from Babylon/Unity space (LH, Y-up, +Z fwd) to WebGL space.
 *
 * Coordinate mapping: WebGL = (Bab.x, Bab.y, -Bab.z), det=-1
 * Quaternion: negate z and w, then normalize sign.
 */
function lhYupQuatToWebgl(q: Quat): Quat {
  // T = diag(1,1,-1), det=-1: transform vector by T, negate w
  // q_webgl = {x: q.x, y: q.y, z: -q.z, w: -q.w}
  // Normalize sign (negate all = same rotation): {x: -q.x, y: -q.y, z: q.z, w: q.w}
  return { x: -q.x, y: -q.y, z: q.z, w: q.w };
}

/**
 * Transform a quaternion from WebGL space to Babylon/Unity space (LH, Y-up, +Z fwd).
 * This is the inverse of lhYupQuatToWebgl.
 */
function webglQuatToLhYup(q: Quat): Quat {
  // Inverse of diag(1,1,-1) is itself (involutory), and det is still -1
  return { x: -q.x, y: -q.y, z: q.z, w: q.w };
}

/**
 * Transform a quaternion from Unreal space (LH, Z-up, +X fwd) to WebGL space.
 *
 * Coordinate mapping:
 *   WebGL.x = UE.y  (right)
 *   WebGL.y = UE.z  (up)
 *   WebGL.z = -UE.x (backward = -forward)
 *   det = -1
 *
 * Quaternion: transform vector part, negate w.
 */
function unrealQuatToWebgl(q: Quat): Quat {
  // T * (qx, qy, qz) = (qy, qz, -qx), then negate w
  // = {x: q.y, y: q.z, z: -q.x, w: -q.w}
  // Normalize sign: {x: -q.y, y: -q.z, z: q.x, w: q.w}
  return { x: -q.y, y: -q.z, z: q.x, w: q.w };
}

/**
 * Transform a quaternion from WebGL space to Unreal space.
 * Inverse of unrealQuatToWebgl.
 *
 * Inverse mapping:
 *   UE.x = -WebGL.z (forward = -backward)
 *   UE.y = WebGL.x  (right)
 *   UE.z = WebGL.y  (up)
 *   det = -1
 */
function webglQuatToUnreal(q: Quat): Quat {
  // T_inv * (qx, qy, qz) = (-qz, qx, qy), then negate w
  // = {x: -q.z, y: q.x, z: q.y, w: -q.w}
  // Normalize sign: {x: q.z, y: -q.x, z: -q.y, w: q.w}
  return { x: q.z, y: -q.x, z: -q.y, w: q.w };
}

// ============================================================================
// Public API: Three.js (RH, Y-up, -Z fwd, XYZ Euler, radians)
// ============================================================================

/**
 * Convert Three.js position and rotation to Panaudia coordinates.
 *
 * @param position - Three.js position {x, y, z}
 * @param rotation - Three.js Euler rotation {x, y, z} in radians, XYZ order
 */
export function threejsToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose {
  const q = eulerToQuaternion(rotation.x, rotation.y, rotation.z, 'XYZ');
  return {
    position: webglPositionToPanaudia(position),
    rotation: webglQuatToPanaudiaRotation(q),
  };
}

/**
 * Convert Panaudia coordinates to Three.js position and rotation.
 *
 * @returns Three.js position and Euler rotation {x, y, z} in radians, XYZ order
 */
export function panaudiaToThreejs(position: Position, rotation: Rotation): Vec3Pose {
  const q = panaudiaRotationToWebglQuat(rotation);
  const euler = quaternionToEuler(q, 'XYZ');
  return {
    position: panaudiaPositionToWebgl(position),
    rotation: { x: euler.x, y: euler.y, z: euler.z },
  };
}

// ============================================================================
// Public API: Babylon.js (LH, Y-up, +Z fwd, YXZ Euler, radians)
//
// Position: same right (+X) and up (+Y) as Three.js, but +Z = forward (LH)
// Rotation: YXZ Euler order, radians, left-handed
// ============================================================================

/**
 * Convert Babylon.js position and rotation to Panaudia coordinates.
 *
 * @param position - Babylon.js position {x, y, z}
 * @param rotation - Babylon.js Euler rotation {x, y, z} in radians, YXZ order
 */
export function babylonToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose {
  // Position: Babylon to WebGL is just negate Z
  const webglPos: Vec3 = { x: position.x, y: position.y, z: -position.z };

  // Rotation: build quaternion in Babylon space, transform to WebGL
  const qBab = eulerToQuaternion(rotation.x, rotation.y, rotation.z, 'YXZ');
  const qWebgl = lhYupQuatToWebgl(qBab);

  return {
    position: webglPositionToPanaudia(webglPos),
    rotation: webglQuatToPanaudiaRotation(qWebgl),
  };
}

/**
 * Convert Panaudia coordinates to Babylon.js position and rotation.
 *
 * @returns Babylon.js position and Euler rotation {x, y, z} in radians, YXZ order
 */
export function panaudiaToBabylon(position: Position, rotation: Rotation): Vec3Pose {
  const webglPos = panaudiaPositionToWebgl(position);
  const qWebgl = panaudiaRotationToWebglQuat(rotation);

  // WebGL to Babylon: negate Z for position, transform quaternion
  const qBab = webglQuatToLhYup(qWebgl);
  const euler = quaternionToEuler(qBab, 'YXZ');

  return {
    position: { x: webglPos.x, y: webglPos.y, z: -webglPos.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z },
  };
}

// ============================================================================
// Public API: A-Frame (RH, Y-up, -Z fwd, YXZ Euler, DEGREES)
//
// Same axes as Three.js (built on Three.js), but:
//   - Rotation in DEGREES
//   - YXZ Euler order (not XYZ)
// ============================================================================

/**
 * Convert A-Frame position and rotation to Panaudia coordinates.
 *
 * @param position - A-Frame position {x, y, z}
 * @param rotation - A-Frame rotation {x, y, z} in DEGREES, YXZ order
 */
export function aframeToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose {
  // Position: same axes as Three.js / WebGL
  // Rotation: YXZ order, degrees → same as Panaudia's internal representation
  // Since A-Frame uses the same axes and same Euler order as Panaudia's
  // internal representation, we can map directly:
  //   Panaudia yaw = A-Frame rotation.y (Y = up axis rotation)
  //   Panaudia pitch = A-Frame rotation.x (X = right axis rotation)
  //   Panaudia roll = A-Frame rotation.z (Z = forward axis rotation)
  return {
    position: webglPositionToPanaudia(position),
    rotation: { yaw: rotation.y, pitch: rotation.x, roll: rotation.z },
  };
}

/**
 * Convert Panaudia coordinates to A-Frame position and rotation.
 *
 * @returns A-Frame position and rotation {x, y, z} in DEGREES, YXZ order
 */
export function panaudiaToAframe(position: Position, rotation: Rotation): Vec3Pose {
  return {
    position: panaudiaPositionToWebgl(position),
    rotation: { x: rotation.pitch, y: rotation.yaw, z: rotation.roll },
  };
}

// ============================================================================
// Public API: PlayCanvas (RH, Y-up, -Z fwd, XYZ Euler, DEGREES)
//
// Same axes and Euler order as Three.js, but rotation in degrees.
// ============================================================================

/**
 * Convert PlayCanvas position and rotation to Panaudia coordinates.
 *
 * @param position - PlayCanvas position {x, y, z}
 * @param rotation - PlayCanvas Euler rotation {x, y, z} in DEGREES, XYZ order
 */
export function playcanvasToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose {
  // Same as Three.js but convert degrees to radians first
  const q = eulerToQuaternion(
    degreesToRadians(rotation.x),
    degreesToRadians(rotation.y),
    degreesToRadians(rotation.z),
    'XYZ',
  );
  return {
    position: webglPositionToPanaudia(position),
    rotation: webglQuatToPanaudiaRotation(q),
  };
}

/**
 * Convert Panaudia coordinates to PlayCanvas position and rotation.
 *
 * @returns PlayCanvas position and Euler rotation {x, y, z} in DEGREES, XYZ order
 */
export function panaudiaToPlaycanvas(position: Position, rotation: Rotation): Vec3Pose {
  const q = panaudiaRotationToWebglQuat(rotation);
  const euler = quaternionToEuler(q, 'XYZ');
  return {
    position: panaudiaPositionToWebgl(position),
    rotation: {
      x: radiansToDegrees(euler.x),
      y: radiansToDegrees(euler.y),
      z: radiansToDegrees(euler.z),
    },
  };
}

// ============================================================================
// Public API: Unity (LH, Y-up, +Z fwd, ZXY Euler, DEGREES)
//
// Same physical directions as Babylon (+X=right, +Y=up, +Z=forward, LH)
// but uses ZXY Euler order and degrees.
// ============================================================================

/**
 * Convert Unity position and rotation to Panaudia coordinates.
 *
 * @param position - Unity position {x, y, z}
 * @param rotation - Unity Euler rotation {x, y, z} in DEGREES, ZXY order
 */
export function unityToPanaudia(position: Vec3, rotation: Vec3): PanaudiaPose {
  // Position: same as Babylon (negate Z for WebGL)
  const webglPos: Vec3 = { x: position.x, y: position.y, z: -position.z };

  // Rotation: ZXY order, degrees, in Unity's LH space
  const qUnity = eulerToQuaternion(
    degreesToRadians(rotation.x),
    degreesToRadians(rotation.y),
    degreesToRadians(rotation.z),
    'ZXY',
  );
  const qWebgl = lhYupQuatToWebgl(qUnity);

  return {
    position: webglPositionToPanaudia(webglPos),
    rotation: webglQuatToPanaudiaRotation(qWebgl),
  };
}

/**
 * Convert Panaudia coordinates to Unity position and rotation.
 *
 * @returns Unity position and Euler rotation {x, y, z} in DEGREES, ZXY order
 */
export function panaudiaToUnity(position: Position, rotation: Rotation): Vec3Pose {
  const webglPos = panaudiaPositionToWebgl(position);
  const qWebgl = panaudiaRotationToWebglQuat(rotation);

  const qUnity = webglQuatToLhYup(qWebgl);
  const euler = quaternionToEuler(qUnity, 'ZXY');

  return {
    position: { x: webglPos.x, y: webglPos.y, z: -webglPos.z },
    rotation: {
      x: radiansToDegrees(euler.x),
      y: radiansToDegrees(euler.y),
      z: radiansToDegrees(euler.z),
    },
  };
}

// ============================================================================
// Public API: Unreal Engine (LH, Z-up, +X fwd, FRotator degrees)
//
// Position: +X=forward, +Y=right, +Z=up (left-handed)
// Rotation: FRotator { pitch, yaw, roll } in degrees
//   yaw  = rotation around Z (up axis), positive = turn right
//   pitch = rotation around Y (right axis), positive = look up
//   roll  = rotation around X (forward axis), positive = roll CW from pilot view
//
// Note: Unreal's FRotator convention negates pitch and roll relative to the
// natural LH rotation direction. We account for this in the conversion.
// ============================================================================

/**
 * Convert Unreal Engine position and FRotator to Panaudia coordinates.
 *
 * @param position - Unreal position {x, y, z} (X=forward, Y=right, Z=up)
 * @param rotation - Unreal FRotator {pitch, yaw, roll} in degrees
 */
export function unrealToPanaudia(position: Vec3, rotation: FRotator): PanaudiaPose {
  // Position: Unreal to Panaudia direct mapping
  //   Pan.x = UE.x  (forward = forward)
  //   Pan.y = -UE.y (left = -right, accounts for LH→RH)
  //   Pan.z = UE.z  (up = up)
  const panPos: Position = { x: position.x, y: -position.y, z: position.z };

  // Rotation: FRotator → quaternion in Unreal space, then transform to WebGL
  // FRotator convention: positive pitch=up, positive roll=CW from pilot view
  // These are negated relative to natural LH rotation direction:
  //   Euler angles for ZYX: ex=-roll, ey=-pitch, ez=yaw
  const qUe = eulerToQuaternion(
    degreesToRadians(-rotation.roll),
    degreesToRadians(-rotation.pitch),
    degreesToRadians(rotation.yaw),
    'ZYX',
  );
  const qWebgl = unrealQuatToWebgl(qUe);

  return {
    position: panPos,
    rotation: webglQuatToPanaudiaRotation(qWebgl),
  };
}

/**
 * Convert Panaudia coordinates to Unreal Engine position and FRotator.
 *
 * @returns Unreal position {x, y, z} and FRotator {pitch, yaw, roll} in degrees
 */
export function panaudiaToUnreal(position: Position, rotation: Rotation): UnrealPose {
  const qWebgl = panaudiaRotationToWebglQuat(rotation);
  const qUe = webglQuatToUnreal(qWebgl);

  // Extract ZYX Euler from Unreal-space quaternion
  const euler = quaternionToEuler(qUe, 'ZYX');

  return {
    position: { x: position.x, y: -position.y, z: position.z },
    rotation: {
      roll: radiansToDegrees(-euler.x),
      pitch: radiansToDegrees(-euler.y),
      yaw: radiansToDegrees(euler.z),
    },
  };
}

// ============================================================================
// Public API: PixiJS (2D, Y-down, +X right, single rotation, radians)
//
// Maps 2D screen coordinates to Panaudia's horizontal plane:
//   Pixi +X (right)  → Panaudia -Y (right direction)
//   Pixi +Y (down/screen south) → Panaudia -X (backward, in top-down view)
//   Panaudia Z = 0 (no height in 2D)
//
// Rotation: Pixi positive rotation is clockwise (due to Y-down)
//   Pixi CW rotation → yaw right → negative Panaudia yaw
// ============================================================================

/**
 * Convert PixiJS position and rotation to Panaudia coordinates.
 *
 * @param position - PixiJS position {x, y} (screen coordinates)
 * @param rotation - PixiJS rotation in radians (clockwise positive)
 */
export function pixiToPanaudia(position: Vec2, rotation: number): PanaudiaPose {
  return {
    position: { x: -position.y, y: -position.x, z: 0 },
    rotation: {
      yaw: -radiansToDegrees(rotation),
      pitch: 0,
      roll: 0,
    },
  };
}

/**
 * Convert Panaudia coordinates to PixiJS position and rotation.
 * Height (z) is discarded. Only yaw maps to 2D rotation; pitch and roll are ignored.
 *
 * @returns PixiJS position {x, y} and rotation in radians
 */
export function panaudiaToPixi(position: Position, rotation: Rotation): PixiPose {
  return {
    position: { x: -position.y, y: -position.x },
    rotation: -degreesToRadians(rotation.yaw),
  };
}

// ============================================================================
// Legacy API (backward compatibility)
//
// These functions are used by the existing PanaudiaClient and include scale
// normalization (0-1 range). They will be removed once the client is refactored
// to use the new converter functions + worldBounds normalization.
// ============================================================================

/** @deprecated Use threejsToPanaudia() instead */
export function webglToAmbisonicPosition(pos: Vec3): Position {
  return {
    x: -(pos.z / 2) + 0.5,
    y: -(pos.x / 2) + 0.5,
    z: pos.y / 2 + 0.5,
  };
}

/** @deprecated Use panaudiaToThreejs() instead */
export function ambisonicToWebglPosition(pos: Position): Vec3 {
  return {
    x: -(pos.y - 0.5) * 2,
    y: (pos.z - 0.5) * 2,
    z: -((pos.x - 0.5) * 2),
  };
}

/** @deprecated Use threejsToPanaudia() instead */
export function webglToAmbisonicRotation(rot: Vec3): Rotation {
  const q = eulerToQuaternion(rot.x, rot.y, rot.z, 'XYZ');
  return webglQuatToPanaudiaRotation(q);
}

/** @deprecated Use panaudiaToThreejs() instead */
export function ambisonicToWebglRotation(rot: Rotation): Vec3 {
  const q = panaudiaRotationToWebglQuat(rot);
  const euler = quaternionToEuler(q, 'XYZ');
  return { x: euler.x, y: euler.y, z: euler.z };
}
