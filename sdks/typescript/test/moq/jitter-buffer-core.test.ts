/**
 * Port of spatial-mixer/core/buffers/jitter_buffer_test.go (the v3 buffer).
 *
 * The Go suite is mono (nc=1) except for one insert-splice stereo case; since
 * the browser playout track is always stereo, this file ADDS nc=2 coverage for
 * the drop splice, drop-across-wrap, the full read path, and a steady stereo
 * stream asserting L/R stay sample-locked (design §9).
 *
 * One intentional divergence from Go: the browser default windowReads is 750
 * (= 2.0s at the 2.667ms worklet cadence), not Go's 400. Behavioral scenarios
 * that depend on the window length override it to Go's value for parity.
 */

import { JitterBufferCore, PLAYOUT_TUNING, computeJitterCapacity, type JitterBufferCoreConfig } from '../../src/moq/jitter-buffer-core.js';

// ---- helpers -------------------------------------------------------------

const F = 48; // frames per ms at 48 kHz

/**
 * Small explicit geometry for branch/splice tests: floor=20, w=10, capacity=200,
 * L=10, H=10 → T=30, snapTarget=40, dropLine=50, overrunAt=60, band [20, 50].
 * Adaptation off (windowReads=0), mirroring the Go struct-literal `v3buf`.
 */
function branchBuf(nc: number): JitterBufferCore {
  return new JitterBufferCore({
    sampleRate: 48000,
    numChannels: nc,
    readerFrame: 10,
    safety: 10,
    writerFrame: 10,
    lowInit: 10,
    lowMin: 10,
    lowMax: 25,
    highInit: 10,
    highMin: 10,
    highMax: 25, // lMax+hMax=50 ⇒ capacity=200
    windowReads: 0,
  });
}

/** Fill the ring so ring[i] = i (mono). */
function indexRing(core: JitterBufferCore): void {
  for (let i = 0; i < core.data.length; i++) core.data[i] = i;
}

/** Controller-only buffer (no meaningful ring): mirrors Go `v3adaptBuf`. */
function adaptBuf(l: number, h: number, windowReads = 20): JitterBufferCore {
  return new JitterBufferCore({
    sampleRate: 48000,
    numChannels: 1,
    readerFrame: 1,
    writerFrame: 1,
    safety: 0,
    lowInit: l,
    lowMin: 10,
    lowMax: 100,
    highInit: h,
    highMin: 10,
    highMax: 100,
    windowReads,
    widenThreshold: 5,
    widenStep: 8,
    narrowStep: 2,
  });
}

/** Ring + adaptation tuning for forced-fill sims: mirrors Go `v3simBuf`.
 * levels(40,40): floor 100, T 140, snapTarget 340, dropLine 380, overrunAt 580. */
function simBuf(): JitterBufferCore {
  return new JitterBufferCore({
    sampleRate: 48000,
    numChannels: 1,
    readerFrame: 80,
    safety: 20, // floor 100
    writerFrame: 200,
    lowInit: 40,
    lowMin: 20,
    lowMax: 200,
    highInit: 40,
    highMin: 20,
    highMax: 200,
    windowReads: 10,
    widenThreshold: 3,
    widenStep: 16,
    narrowStep: 4,
  });
}

/** Script one Read at a chosen fill (rp anchored nonzero so startup is skipped). */
function force(core: JitterBufferCore, fill: number): void {
  const rp = core.capacity; // % capacity == 0 and != 0
  core.readPos = rp;
  core.writePos = rp + fill;
  core.read(new Float32Array(4));
}

function arr(a: Float32Array): number[] {
  return Array.from(a);
}

// ---- geometry ------------------------------------------------------------

describe('geometry — worked examples', () => {
  interface LV {
    t: number;
    snap: number;
    drop: number;
    over: number;
  }
  const cases: Array<{ name: string; cfg: JitterBufferCoreConfig; floor: number; capacity: number; atInit: LV; atMax: LV }> = [
    {
      name: 'MOQ 20/5',
      cfg: { writerFrame: 20 * F, readerFrame: 5 * F },
      floor: 288,
      capacity: 14976,
      atInit: { t: 528, snap: 1488, drop: 2448, over: 3408 },
      atMax: { t: 1728, snap: 2688, drop: 5568, over: 6528 },
    },
    {
      name: 'MOQ 5/5',
      cfg: { writerFrame: 5 * F, readerFrame: 5 * F },
      floor: 288,
      capacity: 6336,
      atInit: { t: 528, snap: 768, drop: 1008, over: 1248 },
      atMax: { t: 1728, snap: 1968, drop: 2688, over: 2928 },
    },
    {
      name: 'WebRTC 20/5, LowInit 10',
      cfg: { writerFrame: 20 * F, readerFrame: 5 * F, lowInit: 10 * F },
      floor: 288,
      capacity: 14976,
      atInit: { t: 768, snap: 1728, drop: 2688, over: 3648 },
      atMax: { t: 1728, snap: 2688, drop: 5568, over: 6528 },
    },
    {
      name: 'browser playout 240/128 (W=5ms, R=128)',
      cfg: { writerFrame: 240, readerFrame: 128 },
      floor: 176,
      // 2*(128+48+1440+480+720)+2*240 = 2*2816+480 = 6112
      capacity: 6112,
      atInit: { t: 416, snap: 656, drop: 896, over: 1136 },
      atMax: { t: 1616, snap: 1856, drop: 2576, over: 2816 },
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const j = new JitterBufferCore(c.cfg);
      expect(j.floor).toBe(c.floor);
      expect(j.capacity).toBe(c.capacity);

      const li = j.levels(j.currentL, j.currentH);
      expect({ t: li.t, snap: li.snapTarget, drop: li.dropLine, over: li.overrunAt }).toEqual(c.atInit);

      const lm = j.levels(j.lMax, j.hMax);
      expect({ t: lm.t, snap: lm.snapTarget, drop: lm.dropLine, over: lm.overrunAt }).toEqual(c.atMax);

      // Structural invariants for any config / window.
      expect(li.snapTarget).toBeLessThan(li.overrunAt);
      expect(li.snapTarget).toBeGreaterThan(j.floor);
      expect(j.capacity).toBeGreaterThan(lm.overrunAt + j.w);
    });
  }
});

// ---- construction / invariants ------------------------------------------

describe('construction', () => {
  it('warm-start seed', () => {
    const j = new JitterBufferCore({ writerFrame: 20 * F, readerFrame: 5 * F, lowInit: 5 * F });
    expect(j.currentL).toBe(240); // 5ms
    expect(j.currentH).toBe(960); // default H_init = W = 20ms
  });

  it('panics on bad input', () => {
    expect(() => new JitterBufferCore({ writerFrame: 20 * F, readerFrame: -F })).toThrow();
    expect(() => new JitterBufferCore({ writerFrame: -F, readerFrame: 5 * F })).toThrow();
    expect(() => new JitterBufferCore({ writerFrame: 20 * F, readerFrame: 5 * F, lowMin: 40 * F, lowMax: 30 * F })).toThrow();
    expect(() => new JitterBufferCore({ writerFrame: 20 * F, readerFrame: 5 * F, highMin: 100 * F, highMax: 30 * F })).toThrow();
  });

  it('defaults (browser: N=750, the one divergence from Go)', () => {
    const j = new JitterBufferCore({});
    expect(j.sampleRate).toBe(48000);
    expect(j.nc).toBe(1);
    expect(j.w).toBe(960); // 20ms
    expect(j.floor).toBe(288); // R(240)+S(48)
    expect(j.lMin).toBe(96);
    expect(j.lMax).toBe(1440);
    expect(j.hMin).toBe(960);
    expect(j.hMax).toBe(2880); // W and 3W
    expect(j.windowReads).toBe(750); // browser default (Go: 400)
    expect(j.windowReads).toBe(PLAYOUT_TUNING.windowReads);
    expect(j.widenThreshold).toBe(5);
    expect(j.widenStep).toBe(96); // 2ms
    expect(j.narrowStep).toBe(24); // 0.5ms
  });
});

// ---- Write ---------------------------------------------------------------

describe('write', () => {
  it('fill accounting', () => {
    const j = new JitterBufferCore({ writerFrame: 20 * F, readerFrame: 5 * F });
    j.write(new Float32Array(100));
    expect(j.fillFrames()).toBe(100);
    j.write(new Float32Array(50));
    expect(j.fillFrames()).toBe(150);
  });

  it('wraps transparently', () => {
    const j = new JitterBufferCore({ writerFrame: 20 * F, readerFrame: 5 * F });
    j.writePos = j.capacity - 2; // two frames before wrap
    j.write(Float32Array.from([1, 2, 3, 4, 5]));
    // ring positions cap-2, cap-1, 0, 1, 2
    expect(j.data[j.capacity - 2]).toBe(1);
    expect(j.data[j.capacity - 1]).toBe(2);
    expect(j.data[0]).toBe(3);
    expect(j.data[1]).toBe(4);
    expect(j.data[2]).toBe(5);
  });

  it('clips over-capacity writes to the last capacity frames', () => {
    const j = new JitterBufferCore({ writerFrame: 20 * F, readerFrame: 5 * F });
    const cap = j.capacity;
    const src = new Float32Array(cap + 10);
    for (let i = 0; i < src.length; i++) src[i] = i;
    j.write(src);
    expect(j.fillFrames()).toBe(cap);
    // Clip keeps the LAST cap frames: ring[0]=src[10], ring[cap-1]=src[cap+9].
    expect(j.data[0]).toBe(10);
    expect(j.data[cap - 1]).toBe(cap + 9);
  });
});

// ---- Read path -----------------------------------------------------------

describe('read path', () => {
  it('startup silence when fill < snapTarget', () => {
    const j = branchBuf(1); // snapTarget 40
    j.write(new Float32Array(30)); // fill 30 < 40
    const dst = Float32Array.from([9, 9, 9, 9]);
    expect(j.read(dst)).toBe(false);
    expect(j.readPos).toBe(0);
    expect(arr(dst)).toEqual([0, 0, 0, 0]);
  });

  it('startup snaps and plays when fill >= snapTarget', () => {
    const j = branchBuf(1); // snapTarget 40
    indexRing(j);
    j.writePos = 100; // fill 100 >= 40
    const dst = new Float32Array(4);
    expect(j.read(dst)).toBe(true);
    // snap rp = 100-40 = 60; in-band plain read ring[60..63]; rp 64
    expect(j.readPos).toBe(64);
    expect(arr(dst)).toEqual([60, 61, 62, 63]);
  });

  it('lap snaps and plays', () => {
    const j = branchBuf(1);
    indexRing(j);
    j.writePos = 300;
    j.readPos = 50; // fill 250 >= capacity 200, rp != 0
    const dst = new Float32Array(4);
    expect(j.read(dst)).toBe(true);
    expect(j.laps).toBe(1);
    // snap rp = 300-40 = 260; play ring[260%200=60 ..]; rp 264
    expect(j.readPos).toBe(264);
    expect(arr(dst)).toEqual([60, 61, 62, 63]);
  });

  it('overrun snaps and plays', () => {
    const j = branchBuf(1); // overrunAt 60
    indexRing(j);
    j.writePos = 100;
    j.readPos = 30; // fill 70 > 60, < capacity, rp != 0
    const dst = new Float32Array(4);
    expect(j.read(dst)).toBe(true);
    expect(j.overruns).toBe(1);
    expect(j.readPos).toBe(64); // snap rp = 60; play; rp 64
    expect(arr(dst)).toEqual([60, 61, 62, 63]);
  });

  it('underrun silences without advancing rp', () => {
    const j = branchBuf(1);
    j.writePos = 102;
    j.readPos = 100; // fill 2 < nFrames 4, rp != 0
    const dst = Float32Array.from([9, 9, 9, 9]);
    expect(j.read(dst)).toBe(false);
    expect(j.underruns).toBe(1);
    expect(j.readPos).toBe(100);
    expect(arr(dst)).toEqual([0, 0, 0, 0]);
  });

  it('plays in-band with no correction', () => {
    const j = branchBuf(1); // band [20, 50]
    indexRing(j);
    j.writePos = 130;
    j.readPos = 100; // fill 30, in band
    const dst = new Float32Array(4);
    expect(j.read(dst)).toBe(true);
    expect(j.readPos).toBe(104);
    expect(j.samplesInserted).toBe(0);
    expect(j.samplesDropped).toBe(0);
    expect(arr(dst)).toEqual([100, 101, 102, 103]);
  });
});

// ---- splice --------------------------------------------------------------

describe('splice', () => {
  it('insert: consume nFrames-1, tail = avg(last, peek)', () => {
    const j = branchBuf(1); // floor 20
    j.data[100] = 10;
    j.data[101] = 20;
    j.data[102] = 30;
    j.data[103] = 40;
    j.writePos = 115;
    j.readPos = 100; // fill 15 < floor 20, >= nFrames
    const dst = new Float32Array(4);
    expect(j.read(dst)).toBe(true);
    // consume 3 (ring[100..102]); tail = (ring[102]=30 + peek ring[103]=40)/2 = 35
    expect(arr(dst)).toEqual([10, 20, 30, 35]);
    expect(j.readPos).toBe(103); // advance by realFrames = 3
    expect(j.samplesInserted).toBe(1);
    expect(j.insertCount).toBe(1);
  });

  it('drop: consume nFrames+1, last = avg(last, skipped)', () => {
    const j = branchBuf(1); // dropLine 50, overrunAt 60
    j.data[100] = 10;
    j.data[101] = 20;
    j.data[102] = 30;
    j.data[103] = 40;
    j.data[104] = 50;
    j.writePos = 160;
    j.readPos = 100; // fill 60 > dropLine 50, == overrunAt (not >), so drop not overrun
    const dst = new Float32Array(4);
    expect(j.read(dst)).toBe(true);
    // consume 5 (ring[100..104]); last out = (ring[103]=40 + skipped ring[104]=50)/2 = 45
    expect(arr(dst)).toEqual([10, 20, 30, 45]);
    expect(j.readPos).toBe(105); // advance by nFrames+1 = 5
    expect(j.samplesDropped).toBe(1);
    expect(j.dropCount).toBe(1);
  });

  it('drop across wrap', () => {
    const j = branchBuf(1);
    j.data[198] = 1;
    j.data[199] = 2;
    j.data[0] = 3;
    j.data[1] = 4;
    j.data[2] = 5;
    j.writePos = 258;
    j.readPos = 198; // fill 60 -> drop; read wraps
    const dst = new Float32Array(4);
    expect(j.read(dst)).toBe(true);
    // ring[198,199,0,1] = 1,2,3,4; tail = (4 + skipped ring[2]=5)/2 = 4.5
    expect(arr(dst)).toEqual([1, 2, 3, 4.5]);
    expect(j.readPos).toBe(203);
  });

  it('nFrames=1 precludes insert', () => {
    const j = branchBuf(1);
    j.data[100] = 7;
    j.writePos = 110;
    j.readPos = 100; // fill 10 < floor 20, but nFrames=1
    const dst = new Float32Array(1);
    expect(j.read(dst)).toBe(true); // plain read, not underrun
    expect(j.insertCount).toBe(0);
    expect(j.samplesInserted).toBe(0);
    expect(arr(dst)).toEqual([7]);
    expect(j.readPos).toBe(101);
  });
});

// ---- stereo (nc=2) — the added coverage (design §9) ----------------------

describe('stereo (nc=2)', () => {
  // ring[frame] = (10*frame, 10*frame+1) so L/R are distinguishable.
  function setStereoRamp(j: JitterBufferCore, fromFrame: number, toFrame: number): void {
    for (let f = fromFrame; f <= toFrame; f++) {
      j.data[f * 2] = 10 * f;
      j.data[f * 2 + 1] = 10 * f + 1;
    }
  }

  it('insert splice averages per channel, keeps L/R locked', () => {
    const j = branchBuf(2);
    j.data[200] = 10;
    j.data[201] = 11;
    j.data[202] = 20;
    j.data[203] = 21;
    j.data[204] = 30;
    j.data[205] = 31;
    j.data[206] = 40;
    j.data[207] = 41; // peek frame 103
    j.writePos = 115;
    j.readPos = 100; // fill 15 < floor 20
    const dst = new Float32Array(8); // 4 stereo frames
    expect(j.read(dst)).toBe(true);
    // frames 100,101,102 then tail = avg(frame102, frame103) per channel = (35, 36)
    expect(arr(dst)).toEqual([10, 11, 20, 21, 30, 31, 35, 36]);
    expect(j.readPos).toBe(103);
    expect(j.samplesInserted).toBe(1);
  });

  it('drop splice averages per channel, keeps L/R locked', () => {
    const j = branchBuf(2); // dropLine 50, overrunAt 60
    setStereoRamp(j, 100, 104); // frames 100..104 = (1000,1001)..(1040,1041)
    j.writePos = 160;
    j.readPos = 100; // fill 60 -> drop
    const dst = new Float32Array(8); // 4 stereo frames
    expect(j.read(dst)).toBe(true);
    // consume 5 frames; last out frame = avg(frame103, frame104) per ch = (1035, 1036)
    expect(arr(dst)).toEqual([1000, 1001, 1010, 1011, 1020, 1021, 1035, 1036]);
    expect(j.readPos).toBe(105); // advance by nFrames+1 = 5
    expect(j.samplesDropped).toBe(1);
  });

  it('drop splice across wrap (stereo)', () => {
    const j = branchBuf(2);
    // frames 198,199,0,1,2 interleaved
    j.data[198 * 2] = 1;
    j.data[198 * 2 + 1] = 101;
    j.data[199 * 2] = 2;
    j.data[199 * 2 + 1] = 102;
    j.data[0] = 3;
    j.data[1] = 103;
    j.data[2] = 4;
    j.data[3] = 104;
    j.data[4] = 5; // frame 2 L (skipped)
    j.data[5] = 105; // frame 2 R (skipped)
    j.writePos = 258;
    j.readPos = 198; // fill 60 -> drop, wraps
    const dst = new Float32Array(8);
    expect(j.read(dst)).toBe(true);
    // frames 198,199,0,1 then tail = avg(frame1, skipped frame2) = ((4+5)/2,(104+105)/2)=(4.5,104.5)
    expect(arr(dst)).toEqual([1, 101, 2, 102, 3, 103, 4.5, 104.5]);
    expect(j.readPos).toBe(203);
  });

  it('startup/lap/overrun/underrun on a stereo buffer', () => {
    // startup snap + play
    let j = branchBuf(2);
    setStereoRamp(j, 0, 199);
    j.writePos = 100; // fill 100 >= snapTarget 40
    let dst = new Float32Array(8);
    expect(j.read(dst)).toBe(true);
    // snap rp = 60; read frames 60..63
    expect(j.readPos).toBe(64);
    expect(arr(dst)).toEqual([600, 601, 610, 611, 620, 621, 630, 631]);

    // overrun
    j = branchBuf(2);
    setStereoRamp(j, 0, 199);
    j.writePos = 100;
    j.readPos = 30; // fill 70 > overrunAt 60
    dst = new Float32Array(8);
    expect(j.read(dst)).toBe(true);
    expect(j.overruns).toBe(1);
    expect(j.readPos).toBe(64);

    // underrun
    j = branchBuf(2);
    j.writePos = 102;
    j.readPos = 100; // fill 2 < nFrames 4
    dst = Float32Array.from([9, 9, 9, 9, 9, 9, 9, 9]);
    expect(j.read(dst)).toBe(false);
    expect(j.underruns).toBe(1);
    expect(arr(dst)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('steady stereo stream stays clean and L/R stay sample-locked', () => {
    const j = new JitterBufferCore({ writerFrame: 20 * F, readerFrame: 5 * F, numChannels: 2 });
    const W = 960;
    const R = 240;
    // write stereo frames where L = frameIndex, R = frameIndex + 0.5 (distinct, exact in f32)
    let frame = 0;
    const writeBlock = () => {
      const buf = new Float32Array(W * 2);
      for (let i = 0; i < W; i++) {
        buf[i * 2] = frame;
        buf[i * 2 + 1] = frame + 0.5;
        frame++;
      }
      j.write(buf);
    };
    writeBlock();
    writeBlock(); // prime past snapTarget
    const read = new Float32Array(R * 2);
    for (let i = 0; i < 4000; i++) {
      if (i % 4 === 0) writeBlock();
      if (j.read(read)) {
        // Every output frame must have R = L + 0.5 — channels never decorrelate.
        for (let k = 0; k < R; k++) {
          expect(read[k * 2 + 1]! - read[k * 2]!).toBeCloseTo(0.5, 5);
        }
      }
    }
    expect(j.underruns).toBe(0);
    expect(j.samplesInserted).toBe(0);
    expect(j.samplesDropped).toBe(0);
    expect(j.overruns).toBe(0);
    expect(j.laps).toBe(0);
  });
});

// ---- steady stream + over-capacity (real geometry) -----------------------

describe('steady stream (mono, real geometry)', () => {
  it('balanced 20/5 stream rides the sawtooth with zero corrections', () => {
    const j = new JitterBufferCore({ writerFrame: 20 * F, readerFrame: 5 * F });
    const W = 960;
    const R = 240;
    j.write(new Float32Array(W));
    j.write(new Float32Array(W)); // prime past snapTarget (1488)
    const read = new Float32Array(R);
    for (let i = 0; i < 4000; i++) {
      if (i % 4 === 0) j.write(new Float32Array(W));
      j.read(read);
    }
    expect(j.underruns).toBe(0);
    expect(j.samplesInserted).toBe(0);
    expect(j.samplesDropped).toBe(0);
    expect(j.overruns).toBe(0);
    expect(j.laps).toBe(0);
  });
});

// ---- decide() ------------------------------------------------------------

describe('decide()', () => {
  function wantLH(j: JitterBufferCore, l: number, h: number) {
    expect([j.currentL, j.currentH]).toEqual([l, h]);
  }

  it('both directions widens', () => {
    const j = adaptBuf(20, 20);
    j.decide(5, 5);
    wantLH(j, 28, 28);
  });
  it('asymmetric still widens both', () => {
    const j = adaptBuf(20, 20);
    j.decide(20, 5);
    wantLH(j, 28, 28);
  });
  it('widen caps at max', () => {
    const j = adaptBuf(96, 96);
    j.decide(10, 10); // 96+8=104 -> cap 100
    wantLH(j, 100, 100);
  });
  it('drift down holds L, narrows H', () => {
    const j = adaptBuf(50, 50);
    j.decide(10, 0);
    wantLH(j, 50, 48);
  });
  it('drift up holds H, narrows L', () => {
    const j = adaptBuf(50, 50);
    j.decide(0, 10);
    wantLH(j, 48, 50);
  });
  it('calm narrows to min, not below', () => {
    const j = adaptBuf(12, 12);
    j.decide(0, 0);
    wantLH(j, 10, 10); // 12-2=10=min
    j.decide(0, 0);
    wantLH(j, 10, 10); // stays at min
  });
  it('incidental opposite does not trip the gate', () => {
    const j = adaptBuf(50, 50);
    j.decide(10, 2); // min 2 < 5
    wantLH(j, 50, 50); // no widen; H not narrowed (drop != 0)
  });
});

describe('adapt() tumbling window', () => {
  it('accumulates, fires decide at N, resets', () => {
    const j = adaptBuf(20, 20, 4);
    j.insertCount = 5;
    j.dropCount = 5;
    for (let i = 0; i < 3; i++) j.adapt(); // reads 1-3, below N
    expect(j.currentL).toBe(20); // not fired yet
    expect(j.readsThisWindow).toBe(3);
    j.adapt(); // read 4 == N: decide(5,5) widens, then reset
    expect([j.currentL, j.currentH]).toEqual([28, 28]);
    expect([j.insertCount, j.dropCount, j.readsThisWindow]).toEqual([0, 0, 0]);
  });
});

// ---- adaptation: forced-fill integration ---------------------------------

describe('adaptation (forced fill)', () => {
  it('drift-down does not widen L', () => {
    const j = simBuf();
    for (let i = 0; i < 30; i++) force(j, 80); // inserts only
    expect(j.currentL).toBe(40);
    expect(j.currentH).toBeLessThan(40); // calm high side narrows
  });

  it('drift-up does not widen H', () => {
    const j = simBuf();
    for (let i = 0; i < 30; i++) force(j, 400); // drops only
    expect(j.currentH).toBe(40);
    expect(j.currentL).toBeLessThan(40);
  });

  it('jitter widens both', () => {
    const j = simBuf();
    for (let i = 0; i < 20; i++) force(j, i % 2 === 0 ? 80 : 400);
    expect(j.currentL).toBeGreaterThan(40);
    expect(j.currentH).toBeGreaterThan(40);
  });

  it('outage does not ratchet L (the v2 bug, gone)', () => {
    const j = simBuf();
    for (let i = 0; i < 5; i++) force(j, 80); // draining: inserts
    for (let i = 0; i < 50; i++) force(j, 2); // drained: underruns feed no counter
    expect(j.currentL).toBeLessThanOrEqual(40);
    expect(j.currentL).toBeGreaterThanOrEqual(j.lMin);
  });

  it('jitter then calm narrows back', () => {
    const j = simBuf();
    for (let i = 0; i < 40; i++) force(j, i % 2 === 0 ? 80 : 400); // grow
    const grown = j.currentL;
    expect(grown).toBeGreaterThan(40);
    for (let i = 0; i < 300; i++) force(j, 250); // long calm in-band -> narrow back
    expect(j.currentL).toBeLessThan(grown);
    expect(j.currentL).toBeGreaterThanOrEqual(j.lMin);
  });
});

// ---- adaptation: real clock-driven jitter sim ----------------------------

describe('clock-driven jitter sim', () => {
  it('two-sided jitter widens both, stays bounded, keeps clean', () => {
    // Go parity: override windowReads to 400 (this validates controller behavior,
    // not the browser cadence). 6ms late/early alternating.
    const j = new JitterBufferCore({
      writerFrame: 20 * F,
      readerFrame: 5 * F,
      lowInit: F,
      lowMin: F,
      lowMax: 15 * F,
      highInit: F,
      highMin: F,
      highMax: 15 * F,
      windowReads: 400,
    });
    const W = 960;
    const R = 240;
    const lead = 960;
    const X = 288; // 6ms
    const jit = (k: number) => (k % 2 === 0 ? X : -X);
    const sched = (k: number) => k * W - lead + jit(k);
    let now = 0;
    let nextW = 0;
    for (let r = 0; r < 8000; r++) {
      now += R;
      while (sched(nextW) <= now) {
        j.write(new Float32Array(W));
        nextW++;
      }
      j.read(new Float32Array(R));
    }
    expect(j.currentL).toBeLessThanOrEqual(j.lMax);
    expect(j.currentH).toBeLessThanOrEqual(j.hMax);
    expect(j.currentL).toBeGreaterThan(48); // 1ms init: two-sided jitter widens
    expect(j.currentH).toBeGreaterThan(48);
    expect(j.underruns).toBeLessThan(10); // widened window keeps it clean
  });
});

// ---- snapshot / stats ----------------------------------------------------

describe('snapshot & stats', () => {
  it('exposes geometry and live allowances', () => {
    const j = new JitterBufferCore({ writerFrame: 20 * F, readerFrame: 5 * F, lowInit: 5 * F });
    const s = j.snapshot();
    expect(s.floorFrames).toBe(288);
    expect(s.lowAllowanceFrames).toBe(240);
    expect(s.lowAllowanceMs).toBe(5.0);
    expect(s.highAllowanceFrames).toBe(960);
    expect(s.highAllowanceMs).toBe(20.0);
    expect(s.targetFrames).toBe(528); // floor 288 + L 240
    expect(s.started).toBe(false);
    expect(s.fillFrames).toBe(0);
  });

  it('reflects activity', () => {
    const j = new JitterBufferCore({ writerFrame: 20 * F, readerFrame: 5 * F });
    for (let i = 0; i < 3; i++) j.write(new Float32Array(960));
    j.read(new Float32Array(240)); // fill 2880 >= snapTarget 1488: starts and plays
    const s = j.snapshot();
    expect(s.started).toBe(true);
    expect(s.fillFrames).toBeGreaterThan(0);
  });

  it('zone tracks the effective band', () => {
    const j = branchBuf(1); // floor 20, dropLine 50
    const setFill = (fill: number) => {
      j.readPos = j.capacity; // %cap == 0, != 0
      j.writePos = j.capacity + fill;
    };
    setFill(30);
    expect(j.snapshot().zone).toBe(0);
    setFill(10);
    expect(j.snapshot().zone).toBe(-1);
    setFill(100);
    expect(j.snapshot().zone).toBe(1);
    // Grow H: dropLine -> T(30)+w(10)+H(100)=140; the SAME fill is now in-band.
    j.currentH = 100;
    setFill(100);
    expect(j.snapshot().zone).toBe(0);
  });

  it('started transitions on first successful read', () => {
    const j = new JitterBufferCore({ writerFrame: 20 * F, readerFrame: 5 * F });
    expect(j.snapshot().started).toBe(false);
    for (let i = 0; i < 3; i++) j.write(new Float32Array(960));
    j.read(new Float32Array(240));
    expect(j.snapshot().started).toBe(true);
  });

  it('getBehind returns fill in interleaved floats', () => {
    const j = branchBuf(2); // stereo
    j.readPos = 100;
    j.writePos = 110; // 10 frames
    expect(j.getBehind()).toBe(20); // 10 frames * 2 channels
  });

  it('last-window counts published for observation', () => {
    const j = simBuf(); // windowReads = 10
    for (let i = 0; i < 10; i++) force(j, i % 2 === 0 ? 80 : 400);
    const s = j.snapshot();
    expect(s.lastWindowInserts).toBe(5);
    expect(s.lastWindowDrops).toBe(5);
  });
});

describe('SAB cross-thread mode (design §11.3)', () => {
  const cfg: JitterBufferCoreConfig = { sampleRate: 48000, numChannels: 2, readerFrame: 128, writerFrame: 240 };

  /** Allocate the shared ring + writePos and return a writer view and a reader view of it. */
  function sharedPair() {
    const { capacity, nc } = computeJitterCapacity(cfg);
    const storage = new Float32Array(new SharedArrayBuffer(capacity * nc * 4));
    const writePos = new BigInt64Array(new SharedArrayBuffer(8));
    const writer = new JitterBufferCore({ ...cfg, sharedStorage: storage, sharedWritePos: writePos });
    const reader = new JitterBufferCore({ ...cfg, sharedStorage: storage, sharedWritePos: writePos });
    return { writer, reader, storage, writePos, capacity };
  }

  /** Interleaved stereo ramp: frame i → L=i, R=i+0.5. */
  function ramp(frames: number): Float32Array {
    const pcm = new Float32Array(frames * 2);
    for (let i = 0; i < frames; i++) {
      pcm[i * 2] = i;
      pcm[i * 2 + 1] = i + 0.5;
    }
    return pcm;
  }

  it('rejects sharedStorage of the wrong length', () => {
    const { capacity, nc } = computeJitterCapacity(cfg);
    const wrong = new Float32Array(capacity * nc - 2);
    expect(() => new JitterBufferCore({ ...cfg, sharedStorage: wrong })).toThrow(/sharedStorage length/);
  });

  it("the writer's writePos is visible to the reader through the atomic cell", () => {
    const { writer, reader, writePos } = sharedPair();
    expect(reader.writePos).toBe(0);
    writer.write(ramp(1000));
    expect(Number(Atomics.load(writePos, 0))).toBe(1000); // released by the writer
    expect(reader.writePos).toBe(1000); // acquired by the reader, separate instance
    expect(writer.readPos).toBe(0); // writer never advances readPos
  });

  it('reader pulls writer-produced audio from the shared ring, L/R sample-locked', () => {
    const { writer, reader } = sharedPair();
    writer.write(ramp(1000));
    const out = new Float32Array(128 * 2);
    expect(reader.read(out)).toBe(true);
    // startup snap: rp = 1000 - snapTarget(656) = 344 ⇒ first frame is ring frame 344.
    expect(out[0]).toBe(344);
    for (let i = 0; i < 128; i++) {
      expect(out[i * 2 + 1] - out[i * 2]).toBeCloseTo(0.5, 5); // R = L + 0.5, never decorrelated
    }
    // reader advanced its own (plain) readPos; the shared writePos is untouched by reads.
    expect(reader.writePos).toBe(1000);
  });

  it('interleaves writer writes and reader reads across the boundary', () => {
    const { writer, reader } = sharedPair();
    writer.write(ramp(700)); // > snapTarget so the reader can start
    const out = new Float32Array(128 * 2);
    reader.read(out); // consumes ~128 frames
    const rpAfter = reader.readPos;
    expect(rpAfter).toBeGreaterThan(0);
    writer.write(ramp(240)); // writer keeps producing
    expect(reader.writePos).toBe(940); // reader sees the new total
    expect(reader.read(out)).toBe(true); // and can keep reading
  });
});
