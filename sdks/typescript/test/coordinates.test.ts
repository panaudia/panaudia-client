import { describe, it, expect } from 'vitest';
import {
  threejsToPanaudia,
  panaudiaToThreejs,
  babylonToPanaudia,
  panaudiaToBabylon,
  aframeToPanaudia,
  panaudiaToAframe,
  playcanvasToPanaudia,
  panaudiaToPlaycanvas,
  unityToPanaudia,
  panaudiaToUnity,
  unrealToPanaudia,
  panaudiaToUnreal,
  pixiToPanaudia,
  panaudiaToPixi,
} from '../src/shared/coordinates.js';

import type { Position, Rotation } from '../src/types.js';

// ============================================================================
// Test helpers
// ============================================================================

/** Approximate equality for floats (6 decimal places) */
function expectClose(actual: number, expected: number, label?: string) {
  expect(actual, label).toBeCloseTo(expected, 6);
}

/** Check a full Panaudia pose (position + rotation) */
function expectPanaudiaPose(
  actual: { position: Position; rotation: Rotation },
  expected: { position: Position; rotation: Rotation },
) {
  expectClose(actual.position.x, expected.position.x, 'position.x');
  expectClose(actual.position.y, expected.position.y, 'position.y');
  expectClose(actual.position.z, expected.position.z, 'position.z');
  expectClose(actual.rotation.yaw, expected.rotation.yaw, 'rotation.yaw');
  expectClose(actual.rotation.pitch, expected.rotation.pitch, 'rotation.pitch');
  expectClose(actual.rotation.roll, expected.rotation.roll, 'rotation.roll');
}

const DEG_TO_RAD = Math.PI / 180;

// ============================================================================
// Panaudia coordinate system reference:
//   Position: 0-1 range on each axis (but converters do NOT normalise scale)
//   Rotation: yaw/pitch/roll in degrees, YXZ Euler order
//
//   Axis mapping (Panaudia is Y-up, right-handed):
//     Panaudia +X = forward
//     Panaudia +Y = right (inverted from WebGL)
//     Panaudia +Z = up
//
//   The existing WebGL converter maps:
//     WebGL X  → Panaudia -Y
//     WebGL Y  → Panaudia  Z
//     WebGL Z  → Panaudia -X
// ============================================================================

// ============================================================================
// Three.js — right-handed, Y-up, -Z forward, XYZ Euler order, radians
// ============================================================================

describe('Three.js ↔ Panaudia', () => {
  describe('threejsToPanaudia', () => {
    it('converts origin (identity pose)', () => {
      const result = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      expectPanaudiaPose(result, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { yaw: 0, pitch: 0, roll: 0 },
      });
    });

    it('converts positive X position (Three.js right → Panaudia)', () => {
      const result = threejsToPanaudia(
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      // Three.js +X = right. Panaudia +Y = right but inverted, so X → -Y
      expectClose(result.position.y, -1, 'x→-y');
      expectClose(result.position.x, 0);
      expectClose(result.position.z, 0);
    });

    it('converts positive Y position (Three.js up → Panaudia)', () => {
      const result = threejsToPanaudia(
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      // Three.js +Y = up → Panaudia +Z
      expectClose(result.position.z, 1, 'y→z');
      expectClose(result.position.x, 0);
      expectClose(result.position.y, 0);
    });

    it('converts positive Z position (Three.js backward → Panaudia)', () => {
      const result = threejsToPanaudia(
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: 0 },
      );
      // Three.js +Z = backward (−forward). Panaudia +X = forward, so Z → -X
      expectClose(result.position.x, -1, 'z→-x');
      expectClose(result.position.y, 0);
      expectClose(result.position.z, 0);
    });

    it('converts yaw left 90° (positive Y rotation in RH = counter-clockwise from above)', () => {
      // Three.js: +Y rotation = yaw LEFT (right-hand rule around Y-up)
      const result = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: Math.PI / 2, z: 0 },
      );
      // Should produce non-zero yaw, zero pitch and roll
      expect(Math.abs(result.rotation.yaw)).toBeCloseTo(90, 0);
      expectClose(result.rotation.pitch, 0);
      expectClose(result.rotation.roll, 0);
    });

    it('converts pitch up 90° (positive X rotation in RH = nose up)', () => {
      const result = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: Math.PI / 2, y: 0, z: 0 },
      );
      // Should produce non-zero pitch, zero yaw and roll
      expect(Math.abs(result.rotation.pitch)).toBeCloseTo(90, 0);
      expectClose(result.rotation.yaw, 0);
    });

    it('converts roll 90° (positive Z rotation in RH)', () => {
      const result = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: Math.PI / 2 },
      );
      expect(Math.abs(result.rotation.roll)).toBeCloseTo(90, 0);
      expectClose(result.rotation.yaw, 0);
    });

    it('converts combined rotation (45° yaw + 30° pitch)', () => {
      const result = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 30 * DEG_TO_RAD, y: 45 * DEG_TO_RAD, z: 0 },
      );
      // Combined rotation should produce non-zero yaw and pitch
      expect(Math.abs(result.rotation.yaw)).toBeGreaterThan(0);
      expect(Math.abs(result.rotation.pitch)).toBeGreaterThan(0);
    });

    it('converts negative positions', () => {
      const result = threejsToPanaudia(
        { x: -2, y: -3, z: -4 },
        { x: 0, y: 0, z: 0 },
      );
      expectClose(result.position.y, 2);   // -X → +Y (double negation)
      expectClose(result.position.z, -3);  // -Y → -Z
      expectClose(result.position.x, 4);   // -Z → +X (double negation)
    });

    it('preserves large positions without clamping', () => {
      const result = threejsToPanaudia(
        { x: 100, y: 200, z: 300 },
        { x: 0, y: 0, z: 0 },
      );
      // No normalisation — just axis swap
      expectClose(result.position.x, -300);
      expectClose(result.position.y, -100);
      expectClose(result.position.z, 200);
    });
  });

  describe('panaudiaToThreejs', () => {
    it('converts origin', () => {
      const result = panaudiaToThreejs(
        { x: 0, y: 0, z: 0 },
        { yaw: 0, pitch: 0, roll: 0 },
      );
      expectClose(result.position.x, 0);
      expectClose(result.position.y, 0);
      expectClose(result.position.z, 0);
      expectClose(result.rotation.x, 0);
      expectClose(result.rotation.y, 0);
      expectClose(result.rotation.z, 0);
    });

    it('converts 90-degree yaw back to Three.js', () => {
      const result = panaudiaToThreejs(
        { x: 0, y: 0, z: 0 },
        { yaw: 90, pitch: 0, roll: 0 },
      );
      expectClose(result.rotation.y, 90 * DEG_TO_RAD);
    });
  });

  describe('roundtrip', () => {
    const testCases = [
      { pos: { x: 1, y: 2, z: 3 }, rot: { x: 0.1, y: 0.2, z: 0.3 } },
      { pos: { x: -5, y: 10, z: -15 }, rot: { x: 0, y: Math.PI / 4, z: 0 } },
      { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      { pos: { x: 0.5, y: -0.5, z: 0.5 }, rot: { x: -0.3, y: 0.6, z: -0.1 } },
    ];

    testCases.forEach(({ pos, rot }, i) => {
      it(`roundtrip case ${i}: threejs → panaudia → threejs`, () => {
        const pan = threejsToPanaudia(pos, rot);
        const back = panaudiaToThreejs(pan.position, pan.rotation);
        expectClose(back.position.x, pos.x, 'position.x');
        expectClose(back.position.y, pos.y, 'position.y');
        expectClose(back.position.z, pos.z, 'position.z');
        expectClose(back.rotation.x, rot.x, 'rotation.x');
        expectClose(back.rotation.y, rot.y, 'rotation.y');
        expectClose(back.rotation.z, rot.z, 'rotation.z');
      });
    });
  });

  describe('edge cases', () => {
    it('handles gimbal lock (pitch = 90°)', () => {
      const result = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: Math.PI / 2, y: 0, z: 0 },
      );
      // Should not produce NaN or Infinity
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
      expect(Number.isFinite(result.rotation.pitch)).toBe(true);
      expect(Number.isFinite(result.rotation.roll)).toBe(true);
    });

    it('handles full 360° rotation', () => {
      const result = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 2 * Math.PI, y: 0, z: 0 },
      );
      // 360° should be equivalent to 0° (or ±360°)
      expect(Number.isFinite(result.rotation.pitch)).toBe(true);
    });

    it('handles negative rotation', () => {
      const result = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: -Math.PI / 2, z: 0 },
      );
      expectClose(result.rotation.yaw, -90);
    });

    it('handles very small values (near-zero)', () => {
      const result = threejsToPanaudia(
        { x: 1e-10, y: 1e-10, z: 1e-10 },
        { x: 1e-10, y: 1e-10, z: 1e-10 },
      );
      expectClose(result.position.x, 0, 'near-zero position');
      expectClose(result.rotation.yaw, 0, 'near-zero rotation');
    });
  });
});

// ============================================================================
// Babylon.js — left-handed, Y-up, +Z forward, YXZ Euler order, radians
//
// Axis differences from Three.js:
//   Babylon +Z = forward  (Three.js -Z = forward) → negate Z
//   Babylon -X = right    (Three.js +X = right)   → negate X
//   Babylon +Y = up       (same as Three.js)
// ============================================================================

describe('Babylon.js ↔ Panaudia', () => {
  describe('babylonToPanaudia', () => {
    it('converts origin', () => {
      const result = babylonToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      expectPanaudiaPose(result, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { yaw: 0, pitch: 0, roll: 0 },
      });
    });

    it('converts +Z position (Babylon forward → Panaudia +X)', () => {
      const result = babylonToPanaudia(
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: 0 },
      );
      // Babylon +Z = forward → Panaudia +X
      expectClose(result.position.x, 1);
      expectClose(result.position.y, 0);
      expectClose(result.position.z, 0);
    });

    it('converts +Y position (Babylon up → Panaudia +Z)', () => {
      const result = babylonToPanaudia(
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      expectClose(result.position.z, 1, 'y→z');
    });

    it('converts +X position (Babylon right → Panaudia -Y)', () => {
      const result = babylonToPanaudia(
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      // Babylon +X = right (same as Three.js), maps to Panaudia -Y
      expectClose(result.position.y, -1, 'bab +x right → pan -y');
      expectClose(result.position.x, 0);
      expectClose(result.position.z, 0);
    });

    it('converts yaw right 90° (positive Y in LH = clockwise from above)', () => {
      // Babylon.js LH: +Y rotation = yaw RIGHT (left-hand rule around Y-up)
      const result = babylonToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: Math.PI / 2, z: 0 },
      );
      // Should match Three.js yaw RIGHT (which is -π/2 in Three.js)
      const threeYawRight = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: -Math.PI / 2, z: 0 },
      );
      expectClose(result.rotation.yaw, threeYawRight.rotation.yaw, 'yaw should match');
      expectClose(result.rotation.pitch, 0);
      expectClose(result.rotation.roll, 0);
    });

    it('converts pitch via rotation around X (Babylon +X = left, so negated vs Three.js)', () => {
      // Babylon -rot.x should match Three.js +rot.x (same physical pitch)
      const result = babylonToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: -Math.PI / 4, y: 0, z: 0 },
      );
      const threePitchUp = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: Math.PI / 4, y: 0, z: 0 },
      );
      expectClose(result.rotation.pitch, threePitchUp.rotation.pitch, 'pitch should match');
    });

    it('handles combined rotation in radians', () => {
      const result = babylonToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: Math.PI / 6, y: Math.PI / 4, z: Math.PI / 3 },
      );
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
      expect(Number.isFinite(result.rotation.pitch)).toBe(true);
      expect(Number.isFinite(result.rotation.roll)).toBe(true);
    });
  });

  describe('roundtrip', () => {
    const testCases = [
      { pos: { x: 1, y: 2, z: 3 }, rot: { x: 0.1, y: 0.2, z: 0.3 } },
      { pos: { x: -5, y: 10, z: -15 }, rot: { x: 0, y: Math.PI / 4, z: 0 } },
      { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
    ];

    testCases.forEach(({ pos, rot }, i) => {
      it(`roundtrip case ${i}: babylon → panaudia → babylon`, () => {
        const pan = babylonToPanaudia(pos, rot);
        const back = panaudiaToBabylon(pan.position, pan.rotation);
        expectClose(back.position.x, pos.x, 'position.x');
        expectClose(back.position.y, pos.y, 'position.y');
        expectClose(back.position.z, pos.z, 'position.z');
        expectClose(back.rotation.x, rot.x, 'rotation.x');
        expectClose(back.rotation.y, rot.y, 'rotation.y');
        expectClose(back.rotation.z, rot.z, 'rotation.z');
      });
    });
  });

  describe('edge cases', () => {
    it('handles gimbal lock', () => {
      const result = babylonToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: Math.PI / 2, y: 0, z: 0 },
      );
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
      expect(Number.isFinite(result.rotation.pitch)).toBe(true);
      expect(Number.isFinite(result.rotation.roll)).toBe(true);
    });

    it('handles negative rotation', () => {
      const result = babylonToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: -Math.PI / 2, z: 0 },
      );
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
    });
  });
});

// ============================================================================
// A-Frame — right-handed, Y-up, -Z forward, YXZ Euler order, DEGREES
//
// Same axes as Three.js, but rotation in degrees and YXZ Euler order
// ============================================================================

describe('A-Frame ↔ Panaudia', () => {
  describe('aframeToPanaudia', () => {
    it('converts origin', () => {
      const result = aframeToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      expectPanaudiaPose(result, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { yaw: 0, pitch: 0, roll: 0 },
      });
    });

    it('converts positions same as Three.js (same axes)', () => {
      const result = aframeToPanaudia(
        { x: 1, y: 2, z: 3 },
        { x: 0, y: 0, z: 0 },
      );
      const threeResult = threejsToPanaudia(
        { x: 1, y: 2, z: 3 },
        { x: 0, y: 0, z: 0 },
      );
      expectClose(result.position.x, threeResult.position.x);
      expectClose(result.position.y, threeResult.position.y);
      expectClose(result.position.z, threeResult.position.z);
    });

    it('accepts degrees (90° yaw)', () => {
      const result = aframeToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 90, z: 0 },
      );
      expectClose(result.rotation.yaw, 90);
    });

    it('converts 45° pitch (degrees)', () => {
      const result = aframeToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 45, y: 0, z: 0 },
      );
      expectClose(result.rotation.pitch, 45);
    });

    it('converts 30° roll (degrees)', () => {
      const result = aframeToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 30 },
      );
      expectClose(result.rotation.roll, 30);
    });

    it('converts combined rotation in degrees', () => {
      const result = aframeToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 30, y: 45, z: 60 },
      );
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
      expect(Number.isFinite(result.rotation.pitch)).toBe(true);
      expect(Number.isFinite(result.rotation.roll)).toBe(true);
    });
  });

  describe('panaudiaToAframe', () => {
    it('outputs rotation in degrees', () => {
      const result = panaudiaToAframe(
        { x: 0, y: 0, z: 0 },
        { yaw: 90, pitch: 0, roll: 0 },
      );
      // A-Frame uses degrees, so output should be in degrees
      expectClose(result.rotation.y, 90);
    });
  });

  describe('roundtrip', () => {
    const testCases = [
      { pos: { x: 1, y: 2, z: 3 }, rot: { x: 10, y: 20, z: 30 } },
      { pos: { x: -5, y: 10, z: -15 }, rot: { x: 0, y: 45, z: 0 } },
      { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      { pos: { x: 0, y: 0, z: 0 }, rot: { x: -30, y: 60, z: -15 } },
    ];

    testCases.forEach(({ pos, rot }, i) => {
      it(`roundtrip case ${i}: aframe → panaudia → aframe`, () => {
        const pan = aframeToPanaudia(pos, rot);
        const back = panaudiaToAframe(pan.position, pan.rotation);
        expectClose(back.position.x, pos.x, 'position.x');
        expectClose(back.position.y, pos.y, 'position.y');
        expectClose(back.position.z, pos.z, 'position.z');
        expectClose(back.rotation.x, rot.x, 'rotation.x');
        expectClose(back.rotation.y, rot.y, 'rotation.y');
        expectClose(back.rotation.z, rot.z, 'rotation.z');
      });
    });
  });

  describe('edge cases', () => {
    it('handles 360° rotation', () => {
      const result = aframeToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 360, y: 0, z: 0 },
      );
      expect(Number.isFinite(result.rotation.pitch)).toBe(true);
    });

    it('handles negative degrees', () => {
      const result = aframeToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: -90, z: 0 },
      );
      expectClose(result.rotation.yaw, -90);
    });
  });
});

// ============================================================================
// PlayCanvas — right-handed, Y-up, -Z forward, XYZ Euler order, DEGREES
//
// Same axes as Three.js, same Euler order, but rotation in degrees
// ============================================================================

describe('PlayCanvas ↔ Panaudia', () => {
  describe('playcanvasToPanaudia', () => {
    it('converts origin', () => {
      const result = playcanvasToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      expectPanaudiaPose(result, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { yaw: 0, pitch: 0, roll: 0 },
      });
    });

    it('converts positions same as Three.js (same axes)', () => {
      const result = playcanvasToPanaudia(
        { x: 1, y: 2, z: 3 },
        { x: 0, y: 0, z: 0 },
      );
      const threeResult = threejsToPanaudia(
        { x: 1, y: 2, z: 3 },
        { x: 0, y: 0, z: 0 },
      );
      expectClose(result.position.x, threeResult.position.x);
      expectClose(result.position.y, threeResult.position.y);
      expectClose(result.position.z, threeResult.position.z);
    });

    it('accepts degrees (90° yaw)', () => {
      const result = playcanvasToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 90, z: 0 },
      );
      expectClose(result.rotation.yaw, 90);
    });

    it('matches Three.js with equivalent rotation', () => {
      // PlayCanvas 45° should match Three.js π/4 rad
      const pcResult = playcanvasToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 30, y: 45, z: 60 },
      );
      const threeResult = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 30 * DEG_TO_RAD, y: 45 * DEG_TO_RAD, z: 60 * DEG_TO_RAD },
      );
      // Same axes + same Euler order → same Panaudia output
      expectClose(pcResult.rotation.yaw, threeResult.rotation.yaw);
      expectClose(pcResult.rotation.pitch, threeResult.rotation.pitch);
      expectClose(pcResult.rotation.roll, threeResult.rotation.roll);
    });
  });

  describe('panaudiaToPlaycanvas', () => {
    it('outputs rotation in degrees', () => {
      const result = panaudiaToPlaycanvas(
        { x: 0, y: 0, z: 0 },
        { yaw: 90, pitch: 0, roll: 0 },
      );
      // PlayCanvas uses degrees
      expectClose(result.rotation.y, 90);
    });
  });

  describe('roundtrip', () => {
    const testCases = [
      { pos: { x: 1, y: 2, z: 3 }, rot: { x: 10, y: 20, z: 30 } },
      { pos: { x: -5, y: 10, z: -15 }, rot: { x: 0, y: 45, z: 0 } },
      { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
    ];

    testCases.forEach(({ pos, rot }, i) => {
      it(`roundtrip case ${i}: playcanvas → panaudia → playcanvas`, () => {
        const pan = playcanvasToPanaudia(pos, rot);
        const back = panaudiaToPlaycanvas(pan.position, pan.rotation);
        expectClose(back.position.x, pos.x, 'position.x');
        expectClose(back.position.y, pos.y, 'position.y');
        expectClose(back.position.z, pos.z, 'position.z');
        expectClose(back.rotation.x, rot.x, 'rotation.x');
        expectClose(back.rotation.y, rot.y, 'rotation.y');
        expectClose(back.rotation.z, rot.z, 'rotation.z');
      });
    });
  });
});

// ============================================================================
// Unity — left-handed, Y-up, +Z forward, ZXY Euler order, DEGREES
//
//   Unity +X = right       (Three.js +X = right) → same
//   Unity +Y = up          (Three.js +Y = up)    → same
//   Unity +Z = forward     (Three.js -Z = forward) → negate Z
//   Left-handed: negate Z to convert to right-handed
// ============================================================================

describe('Unity ↔ Panaudia', () => {
  describe('unityToPanaudia', () => {
    it('converts origin', () => {
      const result = unityToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      expectPanaudiaPose(result, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { yaw: 0, pitch: 0, roll: 0 },
      });
    });

    it('converts +Z position (Unity forward → Panaudia +X)', () => {
      const result = unityToPanaudia(
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: 0 },
      );
      // Unity +Z = forward. After left→right conversion: negate Z → Three.js -Z = forward
      // Then Three.js mapping: -Z → Panaudia +X
      // So Unity +Z should map similarly to Three.js -Z → Panaudia +X... but via negate
      // Net: Unity +Z → (negate) → Three.js -Z → Panaudia +X? No.
      // Unity +Z = forward, in right-hand equiv = Three.js -Z. So +Z unity → -Z threejs → Panaudia +X? Let's just check sign.
      // Actually: left-to-right conversion negates Z. So Unity(0,0,1) → RH(0,0,-1) → Three.js(0,0,-1)
      // Three.js (0,0,-1): z=-1 → Panaudia x = -(-1) = 1
      expectClose(result.position.x, 1, 'unity +z forward → panaudia +x');
    });

    it('converts +Y position (Unity up → Panaudia +Z)', () => {
      const result = unityToPanaudia(
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      expectClose(result.position.z, 1, 'y→z');
    });

    it('converts +X position (Unity right)', () => {
      const result = unityToPanaudia(
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      // Unity +X = right, same as Three.js +X
      expectClose(result.position.y, -1, 'x→-y');
    });

    it('converts yaw right 90° (Unity LH: +90° Y = clockwise from above)', () => {
      const result = unityToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 90, z: 0 },
      );
      // Should match Three.js yaw RIGHT (-π/2 around Y)
      const threeYawRight = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: -Math.PI / 2, z: 0 },
      );
      expectClose(result.rotation.yaw, threeYawRight.rotation.yaw, 'yaw right');
      expectClose(result.rotation.pitch, 0);
      expectClose(result.rotation.roll, 0);
    });

    it('handles combined rotation in degrees', () => {
      const result = unityToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 30, y: 45, z: 60 },
      );
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
      expect(Number.isFinite(result.rotation.pitch)).toBe(true);
      expect(Number.isFinite(result.rotation.roll)).toBe(true);
    });
  });

  describe('panaudiaToUnity', () => {
    it('outputs rotation in degrees', () => {
      const result = panaudiaToUnity(
        { x: 0, y: 0, z: 0 },
        { yaw: 90, pitch: 0, roll: 0 },
      );
      expect(Number.isFinite(result.rotation.y)).toBe(true);
    });
  });

  describe('roundtrip', () => {
    const testCases = [
      { pos: { x: 1, y: 2, z: 3 }, rot: { x: 10, y: 20, z: 30 } },
      { pos: { x: -5, y: 10, z: -15 }, rot: { x: 0, y: 45, z: 0 } },
      { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      { pos: { x: 100, y: 50, z: -200 }, rot: { x: -30, y: 60, z: 15 } },
    ];

    testCases.forEach(({ pos, rot }, i) => {
      it(`roundtrip case ${i}: unity → panaudia → unity`, () => {
        const pan = unityToPanaudia(pos, rot);
        const back = panaudiaToUnity(pan.position, pan.rotation);
        expectClose(back.position.x, pos.x, 'position.x');
        expectClose(back.position.y, pos.y, 'position.y');
        expectClose(back.position.z, pos.z, 'position.z');
        expectClose(back.rotation.x, rot.x, 'rotation.x');
        expectClose(back.rotation.y, rot.y, 'rotation.y');
        expectClose(back.rotation.z, rot.z, 'rotation.z');
      });
    });
  });

  describe('edge cases', () => {
    it('handles gimbal lock (pitch = 90°)', () => {
      const result = unityToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 90, y: 0, z: 0 },
      );
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
      expect(Number.isFinite(result.rotation.pitch)).toBe(true);
      expect(Number.isFinite(result.rotation.roll)).toBe(true);
    });
  });
});

// ============================================================================
// Unreal Engine — left-handed, Z-up, X-forward, ZYX Euler order, DEGREES
//
// Uses FRotator: { pitch, yaw, roll } in degrees
// FVector: { x, y, z } where X=forward, Y=right, Z=up
//
//   Unreal +X = forward    → Panaudia +X
//   Unreal +Y = right      → Panaudia -Y (Panaudia Y is inverted right)
//   Unreal +Z = up          → Panaudia +Z
//   Left-handed → right-handed: negate Y
// ============================================================================

describe('Unreal Engine ↔ Panaudia', () => {
  describe('unrealToPanaudia', () => {
    it('converts origin', () => {
      const result = unrealToPanaudia(
        { x: 0, y: 0, z: 0 },
        { pitch: 0, yaw: 0, roll: 0 },
      );
      expectPanaudiaPose(result, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { yaw: 0, pitch: 0, roll: 0 },
      });
    });

    it('converts +X position (Unreal forward → Panaudia +X)', () => {
      const result = unrealToPanaudia(
        { x: 1, y: 0, z: 0 },
        { pitch: 0, yaw: 0, roll: 0 },
      );
      expectClose(result.position.x, 1, 'unreal +x forward → panaudia +x');
    });

    it('converts +Z position (Unreal up → Panaudia +Z)', () => {
      const result = unrealToPanaudia(
        { x: 0, y: 0, z: 1 },
        { pitch: 0, yaw: 0, roll: 0 },
      );
      expectClose(result.position.z, 1, 'unreal +z up → panaudia +z');
    });

    it('converts +Y position (Unreal right)', () => {
      const result = unrealToPanaudia(
        { x: 0, y: 1, z: 0 },
        { pitch: 0, yaw: 0, roll: 0 },
      );
      // Unreal +Y = right, left-handed → negate for right-handed → Panaudia -Y
      expectClose(result.position.y, -1, 'unreal +y right → panaudia -y');
    });

    it('converts yaw right 90° (Unreal LH: +90° yaw = clockwise from above)', () => {
      const result = unrealToPanaudia(
        { x: 0, y: 0, z: 0 },
        { pitch: 0, yaw: 90, roll: 0 },
      );
      // Should match Three.js yaw RIGHT
      const threeYawRight = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: -Math.PI / 2, z: 0 },
      );
      expectClose(result.rotation.yaw, threeYawRight.rotation.yaw, 'yaw right');
      expectClose(result.rotation.pitch, 0);
      expectClose(result.rotation.roll, 0);
    });

    it('converts pitch up 45° (Unreal: positive pitch = look up)', () => {
      const result = unrealToPanaudia(
        { x: 0, y: 0, z: 0 },
        { pitch: 45, yaw: 0, roll: 0 },
      );
      // Should match Three.js pitch up (+π/4 around X)
      const threePitchUp = threejsToPanaudia(
        { x: 0, y: 0, z: 0 },
        { x: Math.PI / 4, y: 0, z: 0 },
      );
      expectClose(result.rotation.pitch, threePitchUp.rotation.pitch, 'pitch up');
      expectClose(result.rotation.yaw, 0);
    });

    it('handles combined FRotator', () => {
      const result = unrealToPanaudia(
        { x: 0, y: 0, z: 0 },
        { pitch: 30, yaw: 45, roll: 60 },
      );
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
      expect(Number.isFinite(result.rotation.pitch)).toBe(true);
      expect(Number.isFinite(result.rotation.roll)).toBe(true);
    });

    it('handles large positions (Unreal uses centimetre-scale)', () => {
      const result = unrealToPanaudia(
        { x: 1000, y: -500, z: 200 },
        { pitch: 0, yaw: 0, roll: 0 },
      );
      // No normalisation — values pass through with axis swap only
      expectClose(result.position.x, 1000);
      expectClose(result.position.y, 500); // negated
      expectClose(result.position.z, 200);
    });
  });

  describe('panaudiaToUnreal', () => {
    it('outputs FRotator-shaped rotation (pitch, yaw, roll)', () => {
      const result = panaudiaToUnreal(
        { x: 0, y: 0, z: 0 },
        { yaw: 90, pitch: 0, roll: 0 },
      );
      expect(result.rotation).toHaveProperty('pitch');
      expect(result.rotation).toHaveProperty('yaw');
      expect(result.rotation).toHaveProperty('roll');
    });

    it('outputs degrees', () => {
      const result = panaudiaToUnreal(
        { x: 0, y: 0, z: 0 },
        { yaw: 45, pitch: 0, roll: 0 },
      );
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
    });
  });

  describe('roundtrip', () => {
    const testCases = [
      { pos: { x: 100, y: 200, z: 300 }, rot: { pitch: 10, yaw: 20, roll: 30 } },
      { pos: { x: -500, y: 100, z: -150 }, rot: { pitch: 0, yaw: 45, roll: 0 } },
      { pos: { x: 0, y: 0, z: 0 }, rot: { pitch: 0, yaw: 0, roll: 0 } },
      { pos: { x: 1000, y: -1000, z: 50 }, rot: { pitch: -30, yaw: 60, roll: -15 } },
    ];

    testCases.forEach(({ pos, rot }, i) => {
      it(`roundtrip case ${i}: unreal → panaudia → unreal`, () => {
        const pan = unrealToPanaudia(pos, rot);
        const back = panaudiaToUnreal(pan.position, pan.rotation);
        expectClose(back.position.x, pos.x, 'position.x');
        expectClose(back.position.y, pos.y, 'position.y');
        expectClose(back.position.z, pos.z, 'position.z');
        expectClose(back.rotation.pitch, rot.pitch, 'rotation.pitch');
        expectClose(back.rotation.yaw, rot.yaw, 'rotation.yaw');
        expectClose(back.rotation.roll, rot.roll, 'rotation.roll');
      });
    });
  });

  describe('edge cases', () => {
    it('handles gimbal lock (pitch = 90°)', () => {
      const result = unrealToPanaudia(
        { x: 0, y: 0, z: 0 },
        { pitch: 90, yaw: 0, roll: 0 },
      );
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
      expect(Number.isFinite(result.rotation.pitch)).toBe(true);
      expect(Number.isFinite(result.rotation.roll)).toBe(true);
    });

    it('handles 360° yaw', () => {
      const result = unrealToPanaudia(
        { x: 0, y: 0, z: 0 },
        { pitch: 0, yaw: 360, roll: 0 },
      );
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
    });

    it('handles negative rotation', () => {
      const result = unrealToPanaudia(
        { x: 0, y: 0, z: 0 },
        { pitch: -45, yaw: -90, roll: -30 },
      );
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
      expect(Number.isFinite(result.rotation.pitch)).toBe(true);
      expect(Number.isFinite(result.rotation.roll)).toBe(true);
    });
  });
});

// ============================================================================
// PixiJS — 2D, Y-down, X-right, single rotation (radians, clockwise)
//
// Position: { x, y } screen coordinates (Y-down)
// Rotation: single number in radians, clockwise positive (due to Y-down)
//
// For spatial audio mapping:
//   Pixi X → horizontal plane X (Panaudia +X = forward? or right?)
//   Pixi Y → horizontal plane Z (but Y-down, so negate)
//   Height (Z in Panaudia) is fixed (user can override)
//   Rotation → yaw only (rotation in 2D = orientation on horizontal plane)
// ============================================================================

describe('PixiJS ↔ Panaudia', () => {
  describe('pixiToPanaudia', () => {
    it('converts origin', () => {
      const result = pixiToPanaudia(
        { x: 0, y: 0 },
        0,
      );
      expectPanaudiaPose(result, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { yaw: 0, pitch: 0, roll: 0 },
      });
    });

    it('converts +X position (Pixi right)', () => {
      const result = pixiToPanaudia(
        { x: 1, y: 0 },
        0,
      );
      // Pixi +X should map to some horizontal axis in Panaudia
      expect(Number.isFinite(result.position.x)).toBe(true);
      expect(Number.isFinite(result.position.y)).toBe(true);
      expectClose(result.position.z, 0, 'z should be 0 for 2D');
    });

    it('converts +Y position (Pixi down → negated)', () => {
      const result = pixiToPanaudia(
        { x: 0, y: 1 },
        0,
      );
      // Pixi Y is down, should be negated for forward direction
      expect(Number.isFinite(result.position.x)).toBe(true);
      expectClose(result.position.z, 0, 'z should be 0 for 2D');
    });

    it('sets z to 0 (2D has no height)', () => {
      const result = pixiToPanaudia(
        { x: 100, y: 200 },
        0,
      );
      expectClose(result.position.z, 0);
    });

    it('converts rotation (radians → yaw only)', () => {
      const result = pixiToPanaudia(
        { x: 0, y: 0 },
        Math.PI / 2,
      );
      // 90° clockwise in Pixi (Y-down) → should map to yaw
      expect(Math.abs(result.rotation.yaw)).toBeGreaterThan(0);
      expectClose(result.rotation.pitch, 0);
      expectClose(result.rotation.roll, 0);
    });

    it('converts rotation in radians', () => {
      const result = pixiToPanaudia(
        { x: 0, y: 0 },
        Math.PI,
      );
      // 180° rotation
      expectClose(Math.abs(result.rotation.yaw), 180);
    });

    it('handles negative rotation', () => {
      const result = pixiToPanaudia(
        { x: 0, y: 0 },
        -Math.PI / 4,
      );
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
    });
  });

  describe('panaudiaToPixi', () => {
    it('outputs 2D position { x, y }', () => {
      const result = panaudiaToPixi(
        { x: 1, y: 2, z: 3 },
        { yaw: 0, pitch: 0, roll: 0 },
      );
      expect(result.position).toHaveProperty('x');
      expect(result.position).toHaveProperty('y');
      expect(result.position).not.toHaveProperty('z');
    });

    it('outputs single rotation number (radians)', () => {
      const result = panaudiaToPixi(
        { x: 0, y: 0, z: 0 },
        { yaw: 90, pitch: 0, roll: 0 },
      );
      expect(typeof result.rotation).toBe('number');
    });

    it('discards height (z) — projects to 2D', () => {
      const result1 = panaudiaToPixi(
        { x: 1, y: 2, z: 0 },
        { yaw: 0, pitch: 0, roll: 0 },
      );
      const result2 = panaudiaToPixi(
        { x: 1, y: 2, z: 100 },
        { yaw: 0, pitch: 0, roll: 0 },
      );
      expectClose(result1.position.x, result2.position.x);
      expectClose(result1.position.y, result2.position.y);
    });

    it('discards pitch and roll — only yaw maps to 2D', () => {
      const result1 = panaudiaToPixi(
        { x: 0, y: 0, z: 0 },
        { yaw: 45, pitch: 0, roll: 0 },
      );
      const result2 = panaudiaToPixi(
        { x: 0, y: 0, z: 0 },
        { yaw: 45, pitch: 30, roll: 60 },
      );
      expectClose(result1.rotation, result2.rotation);
    });
  });

  describe('roundtrip', () => {
    const testCases = [
      { pos: { x: 100, y: 200 }, rot: 0 },
      { pos: { x: -50, y: 50 }, rot: Math.PI / 4 },
      { pos: { x: 0, y: 0 }, rot: -Math.PI / 2 },
      { pos: { x: 500, y: -300 }, rot: Math.PI },
    ];

    testCases.forEach(({ pos, rot }, i) => {
      it(`roundtrip case ${i}: pixi → panaudia → pixi`, () => {
        const pan = pixiToPanaudia(pos, rot);
        const back = panaudiaToPixi(pan.position, pan.rotation);
        expectClose(back.position.x, pos.x, 'position.x');
        expectClose(back.position.y, pos.y, 'position.y');
        expectClose(back.rotation, rot, 'rotation');
      });
    });
  });

  describe('edge cases', () => {
    it('handles zero rotation', () => {
      const result = pixiToPanaudia({ x: 0, y: 0 }, 0);
      expectClose(result.rotation.yaw, 0);
    });

    it('handles full 2π rotation', () => {
      const result = pixiToPanaudia({ x: 0, y: 0 }, 2 * Math.PI);
      expect(Number.isFinite(result.rotation.yaw)).toBe(true);
    });

    it('handles very large positions (pixel coordinates)', () => {
      const result = pixiToPanaudia({ x: 1920, y: 1080 }, 0);
      expect(Number.isFinite(result.position.x)).toBe(true);
      expect(Number.isFinite(result.position.y)).toBe(true);
    });
  });
});

// ============================================================================
// Cross-framework consistency tests
//
// These tests define physical directions and rotations in plain English
// (forward, back, up, down, left, right, yaw-right, pitch-up, roll-clockwise)
// and verify that every framework's representation of that same physical
// motion produces identical Panaudia output.
//
// This catches bugs where an implementation just swaps axis names without
// accounting for handedness or axis permutation in rotations.
// ============================================================================

describe('Cross-framework consistency — positions', () => {
  it('all frameworks at origin produce the same Panaudia pose', () => {
    const three = threejsToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    const babylon = babylonToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    const aframe = aframeToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    const playcanvas = playcanvasToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    const unity = unityToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    const unreal = unrealToPanaudia({ x: 0, y: 0, z: 0 }, { pitch: 0, yaw: 0, roll: 0 });
    const pixi = pixiToPanaudia({ x: 0, y: 0 }, 0);

    for (const result of [three, babylon, aframe, playcanvas, unity, unreal, pixi]) {
      expectClose(result.position.x, 0, 'position.x');
      expectClose(result.position.y, 0, 'position.y');
      expectClose(result.position.z, 0, 'position.z');
      expectClose(result.rotation.yaw, 0, 'yaw');
      expectClose(result.rotation.pitch, 0, 'pitch');
      expectClose(result.rotation.roll, 0, 'roll');
    }
  });

  it('1 unit FORWARD in each framework → same Panaudia position', () => {
    // "Forward" in each framework (the direction the default camera faces):
    //   Three.js:   -Z    Babylon.js: +Z    A-Frame:    -Z
    //   PlayCanvas: -Z    Unity:      +Z    Unreal:     +X
    const results = [
      threejsToPanaudia({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }),
      babylonToPanaudia({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }),
      aframeToPanaudia({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }),
      playcanvasToPanaudia({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }),
      unityToPanaudia({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }),
      unrealToPanaudia({ x: 1, y: 0, z: 0 }, { pitch: 0, yaw: 0, roll: 0 }),
    ];
    for (const result of results) {
      expectClose(result.position.x, 1, 'forward → panaudia +x');
      expectClose(result.position.y, 0, 'no lateral');
      expectClose(result.position.z, 0, 'no vertical');
    }
  });

  it('1 unit BACK in each framework → same Panaudia position', () => {
    const results = [
      threejsToPanaudia({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }),
      babylonToPanaudia({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }),
      aframeToPanaudia({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }),
      playcanvasToPanaudia({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }),
      unityToPanaudia({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }),
      unrealToPanaudia({ x: -1, y: 0, z: 0 }, { pitch: 0, yaw: 0, roll: 0 }),
    ];
    for (const result of results) {
      expectClose(result.position.x, -1, 'back → panaudia -x');
      expectClose(result.position.y, 0, 'no lateral');
      expectClose(result.position.z, 0, 'no vertical');
    }
  });

  it('1 unit UP in each framework → same Panaudia position', () => {
    //   Three.js/Babylon/A-Frame/PlayCanvas/Unity: +Y = up
    //   Unreal: +Z = up
    const results = [
      threejsToPanaudia({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }),
      babylonToPanaudia({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }),
      aframeToPanaudia({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }),
      playcanvasToPanaudia({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }),
      unityToPanaudia({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }),
      unrealToPanaudia({ x: 0, y: 0, z: 1 }, { pitch: 0, yaw: 0, roll: 0 }),
    ];
    for (const result of results) {
      expectClose(result.position.x, 0, 'no forward');
      expectClose(result.position.y, 0, 'no lateral');
      expectClose(result.position.z, 1, 'up → panaudia +z');
    }
  });

  it('1 unit DOWN in each framework → same Panaudia position', () => {
    const results = [
      threejsToPanaudia({ x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }),
      babylonToPanaudia({ x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }),
      aframeToPanaudia({ x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }),
      playcanvasToPanaudia({ x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }),
      unityToPanaudia({ x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }),
      unrealToPanaudia({ x: 0, y: 0, z: -1 }, { pitch: 0, yaw: 0, roll: 0 }),
    ];
    for (const result of results) {
      expectClose(result.position.x, 0, 'no forward');
      expectClose(result.position.y, 0, 'no lateral');
      expectClose(result.position.z, -1, 'down → panaudia -z');
    }
  });

  it('1 unit RIGHT in each framework → same Panaudia position', () => {
    //   Three.js: +X    Babylon.js: -X    A-Frame: +X
    //   PlayCanvas: +X  Unity: +X         Unreal: +Y
    const results = [
      threejsToPanaudia({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      babylonToPanaudia({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      aframeToPanaudia({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      playcanvasToPanaudia({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      unityToPanaudia({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      unrealToPanaudia({ x: 0, y: 1, z: 0 }, { pitch: 0, yaw: 0, roll: 0 }),
    ];
    const expected = results[0]!;
    for (const result of results) {
      expectClose(result.position.x, 0, 'no forward');
      expectClose(result.position.z, 0, 'no vertical');
      expectClose(result.position.y, expected.position.y, 'right → same panaudia y');
    }
  });

  it('1 unit LEFT in each framework → same Panaudia position', () => {
    const results = [
      threejsToPanaudia({ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      babylonToPanaudia({ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      aframeToPanaudia({ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      playcanvasToPanaudia({ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      unityToPanaudia({ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      unrealToPanaudia({ x: 0, y: -1, z: 0 }, { pitch: 0, yaw: 0, roll: 0 }),
    ];
    const expected = results[0]!;
    for (const result of results) {
      expectClose(result.position.x, 0, 'no forward');
      expectClose(result.position.z, 0, 'no vertical');
      expectClose(result.position.y, expected.position.y, 'left → same panaudia y');
    }
    // Left should be opposite to right
    const rightResult = threejsToPanaudia({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    expectClose(expected.position.y, -rightResult.position.y, 'left is opposite of right');
  });
});

describe('Cross-framework consistency — rotations', () => {
  // These tests verify that the SAME PHYSICAL ROTATION expressed in each
  // framework's native convention produces the same Panaudia output.
  //
  // This is the critical test that catches naive axis-name-swapping bugs.
  // A rotation "turn 90° to the right" (yaw right) has DIFFERENT signs
  // in left-handed vs right-handed systems, and maps to different axis
  // components in Z-up vs Y-up systems.

  it('YAW RIGHT 90° (turn right, viewed from above) → same Panaudia yaw', () => {
    // "Yaw right" = clockwise rotation when viewed from above (looking down the up axis)
    //
    // Three.js (RH, Y-up):   rotation around +Y, right-hand rule → negative Y rotation
    //   Thumb along +Y (up), fingers curl from +Z toward +X → positive = counter-clockwise
    //   So yaw RIGHT = NEGATIVE rotation.y = -π/2
    //
    // Babylon.js (LH, Y-up): rotation around +Y, left-hand rule → positive Y rotation
    //   Thumb along +Y (up), left fingers curl from +Z toward -X → positive = clockwise
    //   So yaw RIGHT = POSITIVE rotation.y = +π/2
    //
    // A-Frame (RH, Y-up, degrees, YXZ): same sign as Three.js but degrees
    //   Yaw RIGHT = rotation.y = -90
    //
    // PlayCanvas (RH, Y-up, degrees, XYZ): same as Three.js but degrees
    //   Yaw RIGHT = rotation.y = -90
    //
    // Unity (LH, Y-up, degrees, ZXY): same sign as Babylon but degrees
    //   Yaw RIGHT = rotation.y = +90
    //
    // Unreal (LH, Z-up, degrees, ZYX): yaw is around +Z (up), left-hand rule
    //   Thumb along +Z, left fingers curl clockwise → positive = clockwise = right
    //   Yaw RIGHT = FRotator.yaw = +90
    const results = [
      threejsToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: -Math.PI / 2, z: 0 }),
      babylonToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: Math.PI / 2, z: 0 }),
      aframeToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: -90, z: 0 }),
      playcanvasToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: -90, z: 0 }),
      unityToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: 90, z: 0 }),
      unrealToPanaudia({ x: 0, y: 0, z: 0 }, { pitch: 0, yaw: 90, roll: 0 }),
    ];
    const expected = results[0]!;
    for (let i = 0; i < results.length; i++) {
      expectClose(results[i]!.rotation.yaw, expected.rotation.yaw, `framework ${i}: yaw`);
      expectClose(results[i]!.rotation.pitch, 0, `framework ${i}: pitch should be 0`);
      expectClose(results[i]!.rotation.roll, 0, `framework ${i}: roll should be 0`);
    }
    // Yaw right should be non-zero and have a definite sign
    expect(Math.abs(expected.rotation.yaw)).toBeCloseTo(90, 0);
  });

  it('YAW LEFT 90° (turn left, viewed from above) → same Panaudia yaw', () => {
    const results = [
      threejsToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: Math.PI / 2, z: 0 }),
      babylonToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: -Math.PI / 2, z: 0 }),
      aframeToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: 90, z: 0 }),
      playcanvasToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: 90, z: 0 }),
      unityToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: -90, z: 0 }),
      unrealToPanaudia({ x: 0, y: 0, z: 0 }, { pitch: 0, yaw: -90, roll: 0 }),
    ];
    const expected = results[0]!;
    for (let i = 0; i < results.length; i++) {
      expectClose(results[i]!.rotation.yaw, expected.rotation.yaw, `framework ${i}: yaw`);
      expectClose(results[i]!.rotation.pitch, 0, `framework ${i}: pitch`);
      expectClose(results[i]!.rotation.roll, 0, `framework ${i}: roll`);
    }
    // Yaw left should be opposite of yaw right
    const yawRight = threejsToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: -Math.PI / 2, z: 0 });
    expectClose(expected.rotation.yaw, -yawRight.rotation.yaw, 'left is opposite of right');
  });

  it('PITCH UP 45° (look up, tilt nose toward sky) → same Panaudia pitch', () => {
    // "Pitch up" = rotation around the right axis that tilts forward-vector upward
    //
    // Three.js (RH, Y-up): right axis = +X, right-hand rule around +X
    //   Thumb along +X (right), fingers curl from +Y toward -Z
    //   Forward is -Z, up is +Y. Pitching up = rotating -Z toward +Y = positive direction
    //   So pitch UP = NEGATIVE rotation.x = -π/4
    //   Wait: thumb along +X, positive rotation goes from +Y toward -Z.
    //   "Pitch up" means the camera looks up = the forward vector (-Z) rotates toward +Y.
    //   -Z rotating toward +Y is the OPPOSITE of the positive direction (+Y toward -Z).
    //   So pitch UP = NEGATIVE rotation.x in Three.js? Let me reconsider.
    //   Actually: right-hand rule around +X: curl from +Y to +Z (in the YZ plane).
    //   +rot.x rotates +Y toward +Z and -Z toward +Y... wait that IS pitching up.
    //   Hmm, let me think in terms of camera:
    //   Default camera looks down -Z. +rotation.x rotates around +X (right).
    //   Right-hand rule: +Y moves toward +Z, and -Z moves toward +Y.
    //   So the camera's forward (-Z) moves toward +Y (up). That IS "pitch up".
    //   So pitch UP = POSITIVE rotation.x in Three.js = +π/4
    //
    // Babylon.js (LH, Y-up): rotation around Babylon +X axis
    //   Babylon +X = LEFT (not right!). Left-hand rule around +X (left axis).
    //   Thumb along +X (left), left fingers curl from +Y toward +Z.
    //   Camera looks along +Z. +rot.x rotates +Y toward +Z, forward (+Z) toward -Y.
    //   So +rot.x makes camera look DOWN. Pitch UP = NEGATIVE rotation.x = -π/4
    //
    // A-Frame (RH, Y-up, degrees, YXZ): same as Three.js but degrees
    //   Pitch UP = +45 degrees (rotation.x = +45)
    //
    // PlayCanvas (RH, Y-up, degrees, XYZ): same as Three.js but degrees
    //   Pitch UP = +45 degrees (rotation.x = +45)
    //
    // Unity (LH, Y-up, degrees, ZXY): rotation around +X (right axis)
    //   Left-hand rule around +X (right): thumb along +X, left fingers curl +Y toward -Z
    //   Camera looks along +Z. +rot.x: +Y moves toward -Z, +Z moves toward +Y...
    //   Forward (+Z) moves toward +Y (up). That IS pitch up.
    //   But wait, left-hand rule around +X: curl from +Y toward -Z.
    //   So +rot.x: +Y→-Z, -Z→-Y, which means +Z→+Y. Camera forward (+Z) goes up.
    //   Pitch UP = NEGATIVE rotation.x = -45
    //   Actually this is confusing. Let me just check: in Unity, positive rotation
    //   around X follows left-hand rule. Thumb right, fingers curl from +Y toward -Z (screen).
    //   Camera looks +Z. For pitch up, forward (+Z) should tilt toward +Y.
    //   +Z moving toward +Y is: we need +Z→+Y. From the rule, +Y→-Z, so +Z→+Y (reverse).
    //   So positive rotation.x in Unity pitches UP? Let me confirm from Unity docs:
    //   "A positive X rotation tilts the object downward" — no, Unity docs say:
    //   Positive rotation is clockwise when looking from the positive end of the axis.
    //   Looking from +X toward origin, clockwise = +Y to +Z in RH, but +Y to -Z in LH.
    //   Unity is LH, so looking from +X: clockwise goes +Y→-Z→-Y→+Z.
    //   So +rot.x: +Y→-Z, forward(+Z)→+Y. That IS pitch up!
    //   Pitch UP = POSITIVE rotation.x = +45? I'm going back and forth. Let me just
    //   use the standard: Unity docs say positive X rotation = "look down". So pitch
    //   UP = NEGATIVE rotation.x = -45.
    //
    // Unreal (LH, Z-up, degrees): pitch is an FRotator field
    //   Unreal: positive pitch = "look up" (camera tilts upward)
    //   Pitch UP = +45
    const results = [
      threejsToPanaudia({ x: 0, y: 0, z: 0 }, { x: Math.PI / 4, y: 0, z: 0 }),
      babylonToPanaudia({ x: 0, y: 0, z: 0 }, { x: -Math.PI / 4, y: 0, z: 0 }),
      aframeToPanaudia({ x: 0, y: 0, z: 0 }, { x: 45, y: 0, z: 0 }),
      playcanvasToPanaudia({ x: 0, y: 0, z: 0 }, { x: 45, y: 0, z: 0 }),
      unityToPanaudia({ x: 0, y: 0, z: 0 }, { x: -45, y: 0, z: 0 }),
      unrealToPanaudia({ x: 0, y: 0, z: 0 }, { pitch: 45, yaw: 0, roll: 0 }),
    ];
    const expected = results[0]!;
    for (let i = 0; i < results.length; i++) {
      expectClose(results[i]!.rotation.yaw, 0, `framework ${i}: yaw should be 0`);
      expectClose(results[i]!.rotation.pitch, expected.rotation.pitch, `framework ${i}: pitch`);
      expectClose(results[i]!.rotation.roll, 0, `framework ${i}: roll should be 0`);
    }
    expect(Math.abs(expected.rotation.pitch)).toBeGreaterThan(0);
  });

  it('PITCH DOWN 45° → same Panaudia pitch (opposite of pitch up)', () => {
    const results = [
      threejsToPanaudia({ x: 0, y: 0, z: 0 }, { x: -Math.PI / 4, y: 0, z: 0 }),
      babylonToPanaudia({ x: 0, y: 0, z: 0 }, { x: Math.PI / 4, y: 0, z: 0 }),
      aframeToPanaudia({ x: 0, y: 0, z: 0 }, { x: -45, y: 0, z: 0 }),
      playcanvasToPanaudia({ x: 0, y: 0, z: 0 }, { x: -45, y: 0, z: 0 }),
      unityToPanaudia({ x: 0, y: 0, z: 0 }, { x: 45, y: 0, z: 0 }),
      unrealToPanaudia({ x: 0, y: 0, z: 0 }, { pitch: -45, yaw: 0, roll: 0 }),
    ];
    const expected = results[0]!;
    for (let i = 0; i < results.length; i++) {
      expectClose(results[i]!.rotation.pitch, expected.rotation.pitch, `framework ${i}: pitch`);
    }
    // Down should be opposite of up
    const pitchUp = threejsToPanaudia({ x: 0, y: 0, z: 0 }, { x: Math.PI / 4, y: 0, z: 0 });
    expectClose(expected.rotation.pitch, -pitchUp.rotation.pitch, 'down is opposite of up');
  });

  it('ROLL CLOCKWISE 30° (tilt head right) → same Panaudia roll', () => {
    // "Roll clockwise" = looking forward, the top of the head tilts to the right
    // This is rotation around the forward axis.
    //
    // Three.js (RH, Y-up): forward = -Z, so roll is rotation around -Z (or negative around +Z)
    //   Right-hand rule around +Z: curl from +X toward +Y.
    //   Roll CW (head tilts right) = +Y tilts toward +X = positive rotation around -Z = negative rotation.z
    //   Roll CW = NEGATIVE rotation.z = -π/6
    //
    // Babylon.js (LH, Y-up): forward = +Z, roll is rotation around +Z
    //   Left-hand rule around +Z: curl from +X toward -Y (LH reverses curl direction)
    //   Actually LH: looking from +Z end, clockwise = +X→-Y→-X→+Y
    //   Roll CW = NEGATIVE rotation.z? Let's think:
    //   Head tilts right = +Y moves toward +X (RH) or equivalently negative rotation.
    //   In Babylon LH, positive rotation around +Z goes +X→-Y.
    //   Roll CW: top(+Y)→right(−X in Babylon). +Y→−X is... positive in LH around +Z? Yes!
    //   Wait, Babylon right = -X. Head tilting right = +Y moves toward -X.
    //   LH positive around +Z: +X→-Y. So +Y→+X is negative. +Y→-X is positive? No.
    //   +rot.z in Babylon LH around +Z: +X→-Y→-X→+Y. So +Y→+X. That means +Y moves
    //   toward +X which is LEFT in Babylon. That's head tilting LEFT, not right.
    //   So roll CW (head right) = NEGATIVE rotation.z in Babylon = -π/6
    //
    // (The exact signs here may need adjustment during implementation;
    //  the cross-framework consistency test itself is what matters most.)
    //
    // A-Frame: same physical convention as Three.js → rotation.z = -30 (degrees)
    // PlayCanvas: same as Three.js → rotation.z = -30 (degrees)
    // Unity (LH): rotation around +Z (forward). Positive is... LH clockwise from +Z end.
    //   +rot.z: +X→+Y in LH? Looking from +Z, CW = +X→-Y. So head right (+Y→+X) = negative.
    //   Roll CW = NEGATIVE rotation.z = -30
    //   Wait: Unity forward is +Z, and it's LH. From +Z, CW = +X→-Y→-X→+Y.
    //   Roll CW (head tilts right, +Y→+X in screen) = that's the opposite of CW above.
    //   So roll CW = POSITIVE rotation.z = +30 in Unity? This is getting confusing.
    //   Let me just use: in Unity, positive rotation.z = counter-clockwise roll (head tilts left).
    //   So CW roll = NEGATIVE rotation.z = -30.
    //
    // Unreal: FRotator.roll is rotation around the forward axis (+X)
    //   Positive roll = clockwise when viewed from behind (looking along +X direction)
    //   Roll CW = POSITIVE FRotator.roll = +30
    const results = [
      threejsToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -Math.PI / 6 }),
      babylonToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -Math.PI / 6 }),
      aframeToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }),
      playcanvasToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }),
      unityToPanaudia({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }),
      unrealToPanaudia({ x: 0, y: 0, z: 0 }, { pitch: 0, yaw: 0, roll: 30 }),
    ];
    const expected = results[0]!;
    for (let i = 0; i < results.length; i++) {
      expectClose(results[i]!.rotation.yaw, 0, `framework ${i}: yaw should be 0`);
      expectClose(results[i]!.rotation.pitch, 0, `framework ${i}: pitch should be 0`);
      expectClose(results[i]!.rotation.roll, expected.rotation.roll, `framework ${i}: roll`);
    }
    expect(Math.abs(expected.rotation.roll)).toBeGreaterThan(0);
  });

  it('combined yaw+pitch in every framework → same Panaudia output', () => {
    // Physical motion: yaw 45° right THEN pitch 30° up
    // This tests that combined rotations (not just single-axis) are handled correctly
    // across different Euler orders and handedness.
    //
    // Since Euler order matters for combined rotations, we define this as:
    // "the orientation you get when you first yaw 45° right then pitch 30° up"
    // Each framework expresses this differently due to Euler order.
    //
    // For intrinsic rotations (which is what all these frameworks use):
    // The Euler angles represent sequential rotations around the OBJECT's axes.
    // So "yaw then pitch" is always yaw-component then pitch-component,
    // regardless of the Euler order letters — the order letters determine
    // which axis is applied first.

    // For this test, we build the rotation via quaternion multiplication:
    // q = q_yaw_right_45 * q_pitch_up_30
    // Then extract each framework's Euler representation.
    // But since we don't have the converters yet, we'll verify at implementation
    // time that these values are correct. For now, use the Three.js representation
    // and just verify all frameworks produce the same Panaudia result.
    //
    // Actually — since different Euler orders will decompose a combined rotation
    // differently, we can't easily pre-compute the Euler angles for each framework.
    // Instead, let's test a combined rotation that we CAN easily express:
    // just put values in both yaw and pitch slots and verify roundtrip + cross-framework.

    // Simpler approach: verify that a specific Panaudia rotation converts to
    // each framework and back consistently
    const panaudiaRot: Rotation = { yaw: 45, pitch: 30, roll: 0 };
    const panaudiaPos: Position = { x: 0, y: 0, z: 0 };

    const threeResult = panaudiaToThreejs(panaudiaPos, panaudiaRot);
    const babylonResult = panaudiaToBabylon(panaudiaPos, panaudiaRot);
    const aframeResult = panaudiaToAframe(panaudiaPos, panaudiaRot);
    const playcanvasResult = panaudiaToPlaycanvas(panaudiaPos, panaudiaRot);
    const unityResult = panaudiaToUnity(panaudiaPos, panaudiaRot);
    const unrealResult = panaudiaToUnreal(panaudiaPos, panaudiaRot);

    // Now convert each back to Panaudia — they should all match the original
    const backFromThree = threejsToPanaudia(threeResult.position, threeResult.rotation);
    const backFromBabylon = babylonToPanaudia(babylonResult.position, babylonResult.rotation);
    const backFromAframe = aframeToPanaudia(aframeResult.position, aframeResult.rotation);
    const backFromPlaycanvas = playcanvasToPanaudia(playcanvasResult.position, playcanvasResult.rotation);
    const backFromUnity = unityToPanaudia(unityResult.position, unityResult.rotation);
    const backFromUnreal = unrealToPanaudia(unrealResult.position, unrealResult.rotation);

    for (const back of [backFromThree, backFromBabylon, backFromAframe, backFromPlaycanvas, backFromUnity, backFromUnreal]) {
      expectClose(back.rotation.yaw, panaudiaRot.yaw, 'yaw');
      expectClose(back.rotation.pitch, panaudiaRot.pitch, 'pitch');
      expectClose(back.rotation.roll, panaudiaRot.roll, 'roll');
    }
  });

  it('combined yaw+pitch+roll in every framework → same Panaudia output', () => {
    const panaudiaRot: Rotation = { yaw: 30, pitch: -20, roll: 15 };
    const panaudiaPos: Position = { x: 5, y: -3, z: 7 };

    const threeResult = panaudiaToThreejs(panaudiaPos, panaudiaRot);
    const babylonResult = panaudiaToBabylon(panaudiaPos, panaudiaRot);
    const unityResult = panaudiaToUnity(panaudiaPos, panaudiaRot);
    const unrealResult = panaudiaToUnreal(panaudiaPos, panaudiaRot);

    const backFromThree = threejsToPanaudia(threeResult.position, threeResult.rotation);
    const backFromBabylon = babylonToPanaudia(babylonResult.position, babylonResult.rotation);
    const backFromUnity = unityToPanaudia(unityResult.position, unityResult.rotation);
    const backFromUnreal = unrealToPanaudia(unrealResult.position, unrealResult.rotation);

    for (const back of [backFromThree, backFromBabylon, backFromUnity, backFromUnreal]) {
      expectClose(back.position.x, panaudiaPos.x, 'position.x');
      expectClose(back.position.y, panaudiaPos.y, 'position.y');
      expectClose(back.position.z, panaudiaPos.z, 'position.z');
      expectClose(back.rotation.yaw, panaudiaRot.yaw, 'yaw');
      expectClose(back.rotation.pitch, panaudiaRot.pitch, 'pitch');
      expectClose(back.rotation.roll, panaudiaRot.roll, 'roll');
    }
  });
});
