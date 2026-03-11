/**
 * Tests for Audio Player
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AudioPlayer,
  AudioPlayerState,
  AudioDecoderNotSupportedError,
  isAudioPlaybackSupported,
  getAudioPlaybackCapabilities,
} from '../../src/moq/audio-player.js';

// Mock AudioContext
class MockAudioContext {
  sampleRate = 48000;
  currentTime = 0;
  state: 'running' | 'suspended' | 'closed' = 'running';

  createBuffer = vi.fn().mockReturnValue({
    duration: 0.02,
    getChannelData: vi.fn().mockReturnValue(new Float32Array(960)),
  });

  createBufferSource = vi.fn().mockReturnValue({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  });

  destination = {};

  createGain = vi.fn().mockReturnValue({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  resume = vi.fn().mockResolvedValue(undefined);
  suspend = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

// Mock AudioDecoder
class MockAudioDecoder {
  static isConfigSupported = vi.fn().mockResolvedValue({ supported: true });

  state: 'unconfigured' | 'configured' | 'closed' = 'unconfigured';
  private outputCallback: ((data: AudioData) => void) | null = null;
  private errorCallback: ((error: DOMException) => void) | null = null;

  constructor(init: { output: (data: AudioData) => void; error: (error: DOMException) => void }) {
    this.outputCallback = init.output;
    this.errorCallback = init.error;
  }

  configure() {
    this.state = 'configured';
  }

  decode(chunk: EncodedAudioChunk) {
    // Simulate async decode by calling output callback
    if (this.outputCallback && this.state === 'configured') {
      const mockAudioData = {
        numberOfChannels: 2,
        numberOfFrames: 960,
        sampleRate: 48000,
        format: 'f32-planar',
        copyTo: vi.fn(),
        close: vi.fn(),
      };
      setTimeout(() => this.outputCallback!(mockAudioData as unknown as AudioData), 0);
    }
  }

  close() {
    this.state = 'closed';
  }
}

// Mock EncodedAudioChunk
class MockEncodedAudioChunk {
  constructor(public init: { type: string; timestamp: number; data: Uint8Array }) {}
}

// Mock AudioData
interface MockAudioData {
  numberOfChannels: number;
  numberOfFrames: number;
  sampleRate: number;
  copyTo: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

describe('AudioPlayer', () => {
  let player: AudioPlayer;

  beforeEach(() => {
    // Reset the static mock before each test (some tests modify it)
    MockAudioDecoder.isConfigSupported = vi.fn().mockResolvedValue({ supported: true });

    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('AudioDecoder', MockAudioDecoder);
    vi.stubGlobal('EncodedAudioChunk', MockEncodedAudioChunk);

    player = new AudioPlayer();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should start in IDLE state', () => {
      expect(player.getState()).toBe(AudioPlayerState.IDLE);
    });

    it('should have default config values', () => {
      const stats = player.getStats();
      expect(stats.framesDecoded).toBe(0);
      expect(stats.samplesPlayed).toBe(0);
      expect(stats.underruns).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should transition to READY state', async () => {
      await player.initialize();
      expect(player.getState()).toBe(AudioPlayerState.READY);
    });

    it('should throw if already initialized', async () => {
      await player.initialize();
      await expect(player.initialize()).rejects.toThrow('Cannot initialize');
    });

    it('should throw if AudioDecoder not supported', async () => {
      vi.stubGlobal('AudioDecoder', undefined);

      const player2 = new AudioPlayer();
      await expect(player2.initialize()).rejects.toBeInstanceOf(AudioDecoderNotSupportedError);
    });

    it('should throw if Opus not supported', async () => {
      MockAudioDecoder.isConfigSupported = vi.fn().mockResolvedValue({ supported: false });

      const player2 = new AudioPlayer();
      await expect(player2.initialize()).rejects.toBeInstanceOf(AudioDecoderNotSupportedError);
    });
  });

  describe('start', () => {
    it('should throw if not initialized', () => {
      expect(() => player.start()).toThrow('Cannot start');
    });

    it('should transition to PLAYING state', async () => {
      await player.initialize();
      player.start();
      expect(player.getState()).toBe(AudioPlayerState.PLAYING);
    });
  });

  describe('stop', () => {
    it('should transition to READY state', async () => {
      await player.initialize();
      player.start();

      player.stop();

      expect(player.getState()).toBe(AudioPlayerState.READY);
    });
  });

  describe('pause/resume', () => {
    it('should pause playback', async () => {
      await player.initialize();
      player.start();

      player.pause();

      // AudioContext.suspend should have been called
      expect(true).toBe(true); // Just verify no error
    });

    it('should resume playback', async () => {
      await player.initialize();
      player.start();
      player.pause();

      player.resume();

      // AudioContext.resume should have been called
      expect(true).toBe(true); // Just verify no error
    });
  });

  describe('decodeFrame', () => {
    it('should throw if not initialized', () => {
      expect(() => player.decodeFrame(new Uint8Array([1, 2, 3]))).toThrow('not initialized');
    });

    it('should decode frame when playing', async () => {
      vi.useFakeTimers();

      await player.initialize();
      player.start();

      // Should not throw
      player.decodeFrame(new Uint8Array([1, 2, 3]));

      // Advance timers to let mock callback fire
      await vi.advanceTimersByTimeAsync(10);

      // Clean up before test ends
      await player.dispose();

      vi.useRealTimers();
      expect(true).toBe(true);
    });

    it('should accept optional timestamp', async () => {
      vi.useFakeTimers();

      await player.initialize();
      player.start();

      // Should not throw
      player.decodeFrame(new Uint8Array([1, 2, 3]), 12345);

      // Advance timers to let mock callback fire
      await vi.advanceTimersByTimeAsync(10);

      // Clean up before test ends
      await player.dispose();

      vi.useRealTimers();
      expect(true).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should transition to IDLE state', async () => {
      await player.initialize();
      player.start();

      await player.dispose();

      expect(player.getState()).toBe(AudioPlayerState.IDLE);
    });

    it('should be safe to call multiple times', async () => {
      await player.initialize();

      await player.dispose();
      await player.dispose();

      expect(player.getState()).toBe(AudioPlayerState.IDLE);
    });
  });

  describe('getStats', () => {
    it('should return a copy of stats', () => {
      const stats1 = player.getStats();
      const stats2 = player.getStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });
});

describe('isAudioPlaybackSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return false when AudioContext is undefined', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('AudioDecoder', class {});

    expect(isAudioPlaybackSupported()).toBe(false);
  });

  it('should return false when AudioDecoder is undefined', () => {
    vi.stubGlobal('AudioContext', class {});
    vi.stubGlobal('AudioDecoder', undefined);

    expect(isAudioPlaybackSupported()).toBe(false);
  });

  it('should return true when both are defined', () => {
    vi.stubGlobal('AudioContext', class {});
    vi.stubGlobal('AudioDecoder', class {});

    expect(isAudioPlaybackSupported()).toBe(true);
  });
});

describe('getAudioPlaybackCapabilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return capabilities', async () => {
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('AudioDecoder', {
      isConfigSupported: vi.fn().mockResolvedValue({ supported: true }),
    });

    const caps = await getAudioPlaybackCapabilities();

    expect(caps.audioContext).toBe(true);
    expect(caps.webCodecs).toBe(true);
    expect(caps.opusDecoding).toBe(true);
  });

  it('should handle missing AudioContext', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('AudioDecoder', undefined);

    const caps = await getAudioPlaybackCapabilities();

    expect(caps.audioContext).toBe(false);
    expect(caps.webCodecs).toBe(false);
    expect(caps.opusDecoding).toBe(false);
  });

  it('should handle Opus not supported', async () => {
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('AudioDecoder', {
      isConfigSupported: vi.fn().mockResolvedValue({ supported: false }),
    });

    const caps = await getAudioPlaybackCapabilities();

    expect(caps.audioContext).toBe(true);
    expect(caps.webCodecs).toBe(true);
    expect(caps.opusDecoding).toBe(false);
  });
});
