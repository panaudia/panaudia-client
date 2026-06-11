/**
 * jitter-buffer-core.ts — the v3 adaptive jitter buffer, ported from the Go
 * `spatial-mixer/core/buffers/jitter_buffer.go` (design:
 * `spatial-mixer/plan/browser-audio/playout-v3-design.md`, itself the TS analog
 * of `jitter-buffer/design_v3.md`).
 *
 * The floor is fixed (R + S); two independent allowances widen/narrow the
 * operating window — L on the late side (costs latency), H on the bunch side
 * (costs capacity) — driven purely by counting the buffer's own ±1 corrections
 * over a tumbling window of reads. No wall-clock, no rates, no decay constants.
 *
 * **Single-threaded, no atomics.** Unlike the Go SPSC original (network thread
 * writes, audio callback reads), the browser playout runs both `write` (decoder
 * → `onmessage`) and `read` (`process`) on the *same* AudioWorklet audio thread,
 * which never overlaps them. So the Go acquire/release/atomic machinery drops
 * away: plain numbers throughout. The geometry, the splice, and the controller
 * port verbatim.
 *
 * **One stereo buffer, interleaved, frame-based corrections.** The atomic unit
 * is a *frame* of `nc` interleaved samples; a ±1 correction moves the whole
 * frame, so for binaural (`nc=2`) L/R stay sample-locked and the interaural time
 * difference (ITD) is preserved structurally. This is one stereo buffer, not two
 * mono buffers (which would decorrelate).
 *
 * This module is pure logic — no Web Audio, no worklet, no DOM — so it is unit-
 * testable off the audio thread (the port of `jitter_buffer_test.go`). The
 * worklet (Phase 2) wraps it; `AudioPlayer` (Phase 3) drives that.
 *
 * Most mutable fields below are `public` for the worklet's stats/observability
 * and for white-box tests; outside `write`/`read`/`adapt` they should be treated
 * as read-only (mutating them by hand is a test/seed seam only).
 */

/**
 * Browser playout tuning — the one named constants block (design §6/§10). All
 * are starting guesses refined in the soak phase. None is a wall-clock value:
 * the window is a read count, the threshold a correction count, the steps are
 * sample counts (expressed in ms/µs here and converted to frames at the buffer's
 * sample rate). `windowReads` is the one knob re-derived for the browser.
 */
export const PLAYOUT_TUNING = {
  safetyMs: 1, // S — floor pad above the underrun edge
  // Deepened 2026-06-10 to absorb the browser reader-burst sawtooth. Measured: the
  // AudioWorklet consumes in ~device-buffer clumps (~13 ms swing; outputLatency 37 ms)
  // while the worker feeds smoothly at 5 ms, so `fill` sawtooths ~13 ms. The operating
  // band floor→dropLine (= L + W + H) must exceed that, and the MINIMUMS must hold it
  // there: the controller narrows on one-sided drops, and a reader-burst looks exactly
  // like one-sided drops, so without high minimums it shrinks the band into the sawtooth.
  // Retuned 2026-06-10 (robustness > latency): the controller narrows to the MINIMUMS
  // under a reader-burst (one-sided drops), so lowMin/highMin ARE the steady-state
  // operating point and must hold the WORST observed swing (~19 ms), not the median
  // (~12 ms). Inits govern the warm-up window before adaptation (cures early crackle).
  lowInitMs: 10, // warm-start L — keeps the sawtooth trough off the floor during warm-up
  lowMinMs: 7, // late-cushion floor (steady-state min)
  lowMaxMs: 30, // latency ceiling
  highInitMs: 16, // warm-start H — headroom for the reader-burst peak + warm-up transients
  highMinMs: 14, // H floor (steady-state min) — sized for the worst reader-burst swing
  highMaxMs: 30, // H ceiling — headroom for deeper-buffered output devices
  windowReads: 750, // N — 2.0s at the 2.667ms worklet cadence (Go uses 400 = 2.0s at 5ms)
  widenThreshold: 5, // corrections/side/window to call it jitter
  widenStepMs: 2, // eager up
  narrowStepMicros: 500, // 0.5ms — reluctant down (¼ of widen)
} as const;

/**
 * Configuration for {@link JitterBufferCore}. All frame-size fields are in
 * **samples** (the browser knows these concretely: R = the 128-sample worklet
 * quantum, W = the server's 240-sample Opus frame). Zero/omitted fields fall
 * back to the defaults below, derived from `sampleRate` so they are correct at
 * any rate and match the Go worked examples exactly at 48 kHz.
 */
export interface JitterBufferCoreConfig {
  /** Sample rate (Hz). Used for the ms-domain defaults and stats. Default 48000. */
  sampleRate?: number;
  /** Channels per frame (interleaved). Default 1. Binaural playout is 2. */
  numChannels?: number;
  /** R — reader frame, samples. Default = 5 ms. Browser worklet passes 128. */
  readerFrame?: number;
  /** W — writer frame, samples. Default = 20 ms. Browser playout passes 240 (5 ms). */
  writerFrame?: number;
  /** S — static floor pad, samples. Default = 1 ms. */
  safety?: number;
  /** Warm-start L, samples. Default = 5 ms. */
  lowInit?: number;
  /** L adapt-down floor, samples. Default = 2 ms. */
  lowMin?: number;
  /** L latency ceiling, samples. Default = 30 ms. */
  lowMax?: number;
  /** Warm-start H, samples. Default = W. */
  highInit?: number;
  /** H adapt-down floor, samples. Default = W. */
  highMin?: number;
  /** H ceiling, samples. Default = 3·W. */
  highMax?: number;
  /** N — tumbling-window length, reads. Default 750. */
  windowReads?: number;
  /** Corrections/side/window to widen. Default 5. */
  widenThreshold?: number;
  /** Widen step, samples. Default = 2 ms. */
  widenStep?: number;
  /** Narrow step, samples. Default = 0.5 ms. */
  narrowStep?: number;
  /**
   * Cross-thread mode (design §11.3, post-2026-06-09 SAB revision). When the
   * writer (receive Worker / main-thread decoder) and the reader (worklet) are
   * different threads, the ring storage and the writePos must live in shared
   * memory — feeding the ring by `postMessage` is not real-time-safe. Provide a
   * `SharedArrayBuffer`-backed interleaved `Float32Array` of exactly
   * `capacity*nc` and a length-1 `BigInt64Array` for the (atomic) writePos;
   * `readPos` stays reader-owned (plain). Size them with {@link computeJitterCapacity}.
   * Omit both for the original single-thread / postMessage mode.
   */
  sharedStorage?: Float32Array;
  /** SAB-backed length-1 BigInt64Array holding the atomic cumulative writePos (frames). */
  sharedWritePos?: BigInt64Array;
}

/**
 * Pure geometry: the ring capacity (frames) and channel count for a given config
 * — the single source of truth shared by the constructor and by callers that
 * must allocate the SharedArrayBuffer storage (`capacity*nc` floats) before
 * constructing the cross-thread cores. Mirrors the Go capacity formula.
 */
export function computeJitterCapacity(cfg: JitterBufferCoreConfig = {}): { capacity: number; nc: number } {
  const sr = cfg.sampleRate ?? 48000;
  const nc = cfg.numChannels ?? 1;
  const f = (ms: number) => Math.floor((sr * ms) / 1000);
  const W = cfg.writerFrame ?? f(20);
  const R = cfg.readerFrame ?? f(5);
  const S = cfg.safety ?? f(1);
  const lMax = cfg.lowMax ?? f(30);
  const hMax = cfg.highMax ?? f(30); // PLAYOUT_TUNING.highMaxMs — MUST match the ctor default
  const maxWR = Math.max(W, R);
  const bandTopMax = R + S + lMax + 2 * W + hMax; // overrunAt at L_max, H_max
  return { capacity: 2 * bandTopMax + 2 * maxWR, nc };
}

/** Operating thresholds derived from the live (L, H) — see {@link JitterBufferCore.levels}. */
export interface Levels {
  /** T = floor + L — operating target / sawtooth bottom. */
  t: number;
  /** snapTarget = T + W — recovery point for every snap. */
  snapTarget: number;
  /** dropLine = T + W + H — drift-DROP fires above this. */
  dropLine: number;
  /** overrunAt = T + 2W + H — overrun snap fires above this. */
  overrunAt: number;
}

/** Rich snapshot of the buffer for tuning/observability (port of Go `JitterBufferStats`). */
export interface JitterBufferSnapshot {
  fillFrames: number;
  fillMs: number;
  floorFrames: number;
  lowAllowanceFrames: number;
  lowAllowanceMs: number;
  highAllowanceFrames: number;
  highAllowanceMs: number;
  targetFrames: number;
  started: boolean;
  underruns: number;
  overruns: number;
  laps: number;
  samplesDropped: number;
  samplesInserted: number;
  lastWindowInserts: number;
  lastWindowDrops: number;
  /** Effective-band zone: -1 below floor, +1 above dropLine, else 0. */
  zone: -1 | 0 | 1;
}

export class JitterBufferCore {
  // ---- immutable geometry (frames) ----
  readonly capacity: number;
  readonly floor: number;
  readonly w: number;
  readonly nc: number;
  readonly sampleRate: number;
  readonly lMin: number;
  readonly lMax: number;
  readonly hMin: number;
  readonly hMax: number;

  // ---- immutable controller constants ----
  readonly windowReads: number;
  readonly widenThreshold: number;
  readonly widenStep: number;
  readonly narrowStep: number;

  // ---- storage: capacity * nc interleaved floats ----
  readonly data: Float32Array;

  // ---- SPSC heads — cumulative (never wrap). Index via (pos % capacity) * nc. ----
  // writePos crosses the writer→reader thread boundary in SAB mode, so it is
  // backed by an atomic cell when `sharedWritePos` is given; otherwise a plain
  // number. The Atomics.store/load act as the release/acquire fence pairing the
  // ring writes (writer) with the ring reads (reader) — the Go SPSC contract.
  // readPos is reader-owned (the writer never touches it), so it stays plain.
  private _writePos = 0;
  private wpCell: BigInt64Array | null = null;
  get writePos(): number {
    return this.wpCell ? Number(Atomics.load(this.wpCell, 0)) : this._writePos;
  }
  set writePos(v: number) {
    if (this.wpCell) Atomics.store(this.wpCell, 0, BigInt(v));
    else this._writePos = v;
  }
  readPos = 0;

  // ---- live adaptive window ----
  currentL: number;
  currentH: number;

  // ---- tumbling-window controller state (reader-owned) ----
  insertCount = 0;
  dropCount = 0;
  readsThisWindow = 0;

  // ---- last completed window's counts, for observation ----
  lastWinInserts = 0;
  lastWinDrops = 0;

  // ---- cumulative stats ----
  underruns = 0;
  overruns = 0;
  laps = 0;
  samplesDropped = 0;
  samplesInserted = 0;

  constructor(cfg: JitterBufferCoreConfig = {}) {
    // NOTE: the default literals below are inlined (rather than read from
    // PLAYOUT_TUNING) on purpose — this class is serialized into the AudioWorklet
    // via `.toString()` (see playout-worklet.ts), so it must be self-contained
    // with no free references to module-scope identifiers (which a minified build
    // would rename). The literals mirror PLAYOUT_TUNING; jitter-buffer-core.test
    // cross-checks they stay in sync.
    const sr = cfg.sampleRate ?? 48000;
    const nc = cfg.numChannels ?? 1;
    // Truncating ms→frames, matching Go's int64 division.
    const f = (ms: number) => Math.floor((sr * ms) / 1000);

    const W = cfg.writerFrame ?? f(20);
    const R = cfg.readerFrame ?? f(5);
    const S = cfg.safety ?? f(1); // PLAYOUT_TUNING.safetyMs

    const lInit = cfg.lowInit ?? f(10); // PLAYOUT_TUNING.lowInitMs
    const lMin = cfg.lowMin ?? f(7); // PLAYOUT_TUNING.lowMinMs
    const lMax = cfg.lowMax ?? f(30); // PLAYOUT_TUNING.lowMaxMs

    // High-side defaults absorb the browser reader-burst sawtooth — ms-based, NOT
    // W-relative (the burst is a hardware property, independent of the server frame).
    const hInit = cfg.highInit ?? f(16); // PLAYOUT_TUNING.highInitMs
    const hMin = cfg.highMin ?? f(14); // PLAYOUT_TUNING.highMinMs
    const hMax = cfg.highMax ?? f(30); // PLAYOUT_TUNING.highMaxMs

    if (R <= 0 || W <= 0) {
      throw new Error('JitterBufferCore: readerFrame and writerFrame must be > 0');
    }
    if (S < 0) {
      throw new Error('JitterBufferCore: safety must be >= 0');
    }
    if (!(0 <= lMin && lMin <= lInit && lInit <= lMax)) {
      throw new Error('JitterBufferCore: require 0 <= lowMin <= lowInit <= lowMax');
    }
    if (!(0 <= hMin && hMin <= hInit && hInit <= hMax)) {
      throw new Error('JitterBufferCore: require 0 <= highMin <= highInit <= highMax');
    }
    // snapTarget (T+W) < overrunAt (T+2W+H) reduces to 0 < W+H; with H ≥ hMin ≥ 0
    // the tightest case is H=0, so W>0 (checked above) suffices.

    const floor = R + S;
    const maxWR = Math.max(W, R);
    const bandTopMax = R + S + lMax + 2 * W + hMax; // = overrunAt at L_max, H_max
    const capacity = 2 * bandTopMax + 2 * maxWR;

    this.capacity = capacity;
    this.floor = floor;
    this.w = W;
    this.nc = nc;
    this.sampleRate = sr;
    this.lMin = lMin;
    this.lMax = lMax;
    this.hMin = hMin;
    this.hMax = hMax;
    this.windowReads = cfg.windowReads ?? 750; // PLAYOUT_TUNING.windowReads
    this.widenThreshold = cfg.widenThreshold ?? 5; // PLAYOUT_TUNING.widenThreshold
    this.widenStep = cfg.widenStep ?? f(2); // PLAYOUT_TUNING.widenStepMs
    this.narrowStep = cfg.narrowStep ?? Math.floor((sr * 500) / 1_000_000); // PLAYOUT_TUNING.narrowStepMicros (0.5ms)

    // Cross-thread (SAB) mode: adopt the caller's shared storage + atomic
    // writePos cell instead of allocating a private ring. The SAB is zero-
    // initialised, so writePos starts at 0 with no explicit store (and we must
    // NOT re-zero it — the other thread may already be using it).
    if (cfg.sharedStorage) {
      if (cfg.sharedStorage.length !== capacity * nc) {
        throw new Error(
          `JitterBufferCore: sharedStorage length ${cfg.sharedStorage.length} != capacity*nc ${capacity * nc} ` +
            '(size it with computeJitterCapacity using the same config)'
        );
      }
      this.data = cfg.sharedStorage;
    } else {
      this.data = new Float32Array(capacity * nc);
    }
    if (cfg.sharedWritePos) {
      if (cfg.sharedWritePos.length < 1) {
        throw new Error('JitterBufferCore: sharedWritePos must be a length-1 BigInt64Array');
      }
      this.wpCell = cfg.sharedWritePos;
    }

    this.currentL = lInit; // warm start
    this.currentH = hInit;
  }

  /**
   * Derive the operating thresholds from the (loaded-once) window allowances
   * `l`, `h` plus the immutable floor and writer frame. Pure function; all
   * branches of {@link read} use one consistent snapshot.
   */
  levels(l: number, h: number): Levels {
    const t = this.floor + l;
    return { t, snapTarget: t + this.w, dropLine: t + this.w + h, overrunAt: t + 2 * this.w + h };
  }

  /**
   * Copy `src` (interleaved, length a multiple of `nc`) into the ring. Never
   * blocks. Writes longer than capacity are clipped to the most-recent
   * `capacity` frames.
   */
  write(src: Float32Array): void {
    let nFrames = Math.floor(src.length / this.nc);
    if (nFrames === 0) return;
    if (nFrames > this.capacity) {
      const skip = nFrames - this.capacity;
      src = src.subarray(skip * this.nc);
      nFrames = this.capacity;
    }
    const wp = this.writePos;
    this.writeToRing(src, wp, nFrames);
    this.writePos = wp + nFrames;
  }

  /**
   * Copy up to `dst.length` interleaved samples from the ring into `dst`.
   * Returns true when audio was produced, false on silence. See design §4. The
   * window allowances L and H are read exactly once at the top so every branch
   * sees consistent geometry. No debounce: corrections fire on the first
   * out-of-band read.
   */
  read(dst: Float32Array): boolean {
    const nc = this.nc;
    const nFrames = Math.floor(dst.length / nc);
    if (nFrames === 0) return true;

    let wp = this.writePos;
    let rp = this.readPos;
    let fill = wp - rp;

    const { snapTarget, dropLine, overrunAt } = this.levels(this.currentL, this.currentH);

    // 1. STARTUP — rp == 0 means no Read has produced audio yet. Warm-start:
    // wait for a full operating point (snapTarget) before the first read.
    if (rp === 0) {
      if (fill < snapTarget) {
        dst.fill(0);
        this.adapt();
        return false;
      }
      rp = wp - snapTarget;
      this.readPos = rp;
      fill = snapTarget;
      // fall through and play this same Read
    }

    // 2. LAP — reader stalled long enough for the writer to wrap.
    if (fill >= this.capacity) {
      rp = wp - snapTarget;
      this.readPos = rp;
      fill = snapTarget;
      this.laps++;
    } else if (fill > overrunAt) {
      // 3. OVERRUN — sustained drift or a burst above the overrun line.
      rp = wp - snapTarget;
      this.readPos = rp;
      fill = snapTarget;
      this.overruns++;
    }

    // 4. UNDERRUN — physical floor: can't satisfy this read. Silence only; rp
    // unchanged. Lap/overrun do not feed adaptation; underrun's only effect is
    // the one-directional insert counter, bumped by the next playing read.
    if (fill < nFrames) {
      dst.fill(0);
      this.underruns++;
      this.adapt();
      return false;
    }

    // 5. PLAYING with optional ±1 splice. Fire on the first out-of-band read;
    // the band is [floor, dropLine] (both move with the live L/H via levels()).
    let corr = 0;
    if (fill > dropLine && fill >= nFrames + 1) {
      corr = 1; // DROP
    } else if (fill < this.floor && nFrames >= 2) {
      corr = -1; // INSERT
    }

    if (corr === 1) {
      // Drop with splice: consume nFrames+1 from the ring, output nFrames. The
      // last output frame is the per-channel average of the last consumed frame
      // and the skipped frame, softening the boundary.
      this.readFromRing(dst, rp, nFrames);
      const skipBase = ((rp + nFrames) % this.capacity) * nc;
      const dstBase = (nFrames - 1) * nc;
      for (let ch = 0; ch < nc; ch++) {
        const a = dst[dstBase + ch]!;
        const b = this.data[skipBase + ch]!;
        dst[dstBase + ch] = (a + b) * 0.5;
      }
      this.readPos = rp + nFrames + 1;
      this.samplesDropped++;
      this.dropCount++;
    } else if (corr === -1) {
      // Insert with splice: consume nFrames-1 from the ring, output nFrames. The
      // extra tail frame is the per-channel average of the last consumed frame
      // and the peek-ahead next frame (which stays in the ring).
      const realFrames = nFrames - 1;
      this.readFromRing(dst.subarray(0, realFrames * nc), rp, realFrames);
      const peekBase = ((rp + realFrames) % this.capacity) * nc;
      const lastBase = (realFrames - 1) * nc;
      const tailBase = realFrames * nc;
      for (let ch = 0; ch < nc; ch++) {
        const a = dst[lastBase + ch]!;
        const b = this.data[peekBase + ch]!;
        dst[tailBase + ch] = (a + b) * 0.5;
      }
      this.readPos = rp + realFrames;
      this.samplesInserted++;
      this.insertCount++;
    } else {
      this.readFromRing(dst, rp, nFrames);
      this.readPos = rp + nFrames;
    }
    this.adapt();
    return true;
  }

  /**
   * Tick the tumbling window once per Read and, every `windowReads`, run the
   * decision off the accumulated correction counts, then reset them. No
   * wall-clock: the window is a read count, the inputs are correction counts.
   */
  adapt(): void {
    if (this.windowReads <= 0) return; // adaptation disabled
    this.readsThisWindow++;
    if (this.readsThisWindow < this.windowReads) return;
    this.lastWinInserts = this.insertCount; // publish for observation before reset
    this.lastWinDrops = this.dropCount;
    this.decide(this.insertCount, this.dropCount);
    this.insertCount = 0;
    this.dropCount = 0;
    this.readsThisWindow = 0;
  }

  /**
   * Move the window allowances from one window's correction counts (design §6):
   *   - both sides breached (min ≥ threshold) ⇒ jitter ⇒ widen the breaching
   *     side(s) by widenStep, capped at max (eager);
   *   - otherwise a fully-calm side (count 0) narrows by narrowStep, floored at
   *     min; a side that is lit but un-gated is drift — left to the ±1 corrector.
   * `narrowStep < widenStep` makes it eager-up / reluctant-down — the stability
   * guarantee.
   */
  decide(insertCount: number, dropCount: number): void {
    if (Math.min(insertCount, dropCount) >= this.widenThreshold) {
      if (insertCount >= this.widenThreshold && this.currentL < this.lMax) {
        this.currentL = Math.min(this.currentL + this.widenStep, this.lMax);
      }
      if (dropCount >= this.widenThreshold && this.currentH < this.hMax) {
        this.currentH = Math.min(this.currentH + this.widenStep, this.hMax);
      }
      return;
    }
    if (insertCount === 0 && this.currentL > this.lMin) {
      this.currentL = Math.max(this.currentL - this.narrowStep, this.lMin);
    }
    if (dropCount === 0 && this.currentH > this.hMin) {
      this.currentH = Math.max(this.currentH - this.narrowStep, this.hMin);
    }
  }

  /** Current fill in frames. */
  fillFrames(): number {
    return this.writePos - this.readPos;
  }

  /** Fill in interleaved floats (matching the Go ICircularBuffer convention). */
  getBehind(): number {
    return this.fillFrames() * this.nc;
  }

  /** Rich snapshot for tuning/observability. */
  snapshot(): JitterBufferSnapshot {
    const fill = this.fillFrames();
    const l = this.currentL;
    const h = this.currentH;
    const srMs = this.sampleRate / 1000;
    const { dropLine } = this.levels(l, h);
    let zone: -1 | 0 | 1 = 0;
    if (fill < this.floor) zone = -1;
    else if (fill > dropLine) zone = 1;
    return {
      fillFrames: fill,
      fillMs: fill / srMs,
      floorFrames: this.floor,
      lowAllowanceFrames: l,
      lowAllowanceMs: l / srMs,
      highAllowanceFrames: h,
      highAllowanceMs: h / srMs,
      targetFrames: this.floor + l,
      started: this.readPos > 0,
      underruns: this.underruns,
      overruns: this.overruns,
      laps: this.laps,
      samplesDropped: this.samplesDropped,
      samplesInserted: this.samplesInserted,
      lastWindowInserts: this.lastWinInserts,
      lastWindowDrops: this.lastWinDrops,
      zone,
    };
  }

  /**
   * Copy `nFrames` frames from `src` into the ring at frame position `wp`,
   * handling wraparound. Caller guarantees `nFrames <= capacity`.
   */
  private writeToRing(src: Float32Array, wp: number, nFrames: number): void {
    const cap = this.capacity;
    const nc = this.nc;
    const startFrame = wp % cap;
    if (startFrame + nFrames <= cap) {
      this.data.set(src.subarray(0, nFrames * nc), startFrame * nc);
      return;
    }
    const first = cap - startFrame;
    this.data.set(src.subarray(0, first * nc), startFrame * nc);
    this.data.set(src.subarray(first * nc, nFrames * nc), 0);
  }

  /**
   * Copy `nFrames` frames from the ring at frame position `rp` into `dst`,
   * handling wraparound. Caller guarantees `nFrames <= capacity`.
   */
  private readFromRing(dst: Float32Array, rp: number, nFrames: number): void {
    const cap = this.capacity;
    const nc = this.nc;
    const startFrame = rp % cap;
    if (startFrame + nFrames <= cap) {
      dst.set(this.data.subarray(startFrame * nc, (startFrame + nFrames) * nc));
      return;
    }
    const first = cap - startFrame;
    dst.set(this.data.subarray(startFrame * nc, cap * nc), 0);
    dst.set(this.data.subarray(0, (nFrames - first) * nc), first * nc);
  }
}
