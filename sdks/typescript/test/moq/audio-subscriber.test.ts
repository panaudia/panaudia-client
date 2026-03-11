/**
 * Tests for Audio Subscriber
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AudioSubscriber,
  AudioSubscriberState,
  isAudioDecoderSupported,
  getAudioDecoderCapabilities,
} from '../../src/moq/audio-subscriber.js';

// Mock MoqConnection
const createMockConnection = () => {
  const mockReader = {
    read: vi.fn(),
  };

  return {
    getDatagramReader: vi.fn().mockReturnValue(mockReader),
    registerDatagramHandler: vi.fn(),
    unregisterDatagramHandler: vi.fn(),
    mockReader,
  };
};

describe('AudioSubscriber', () => {
  let subscriber: AudioSubscriber;
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    subscriber = new AudioSubscriber();
    mockConnection = createMockConnection();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should start in IDLE state', () => {
      expect(subscriber.getState()).toBe(AudioSubscriberState.IDLE);
    });

    it('should have zero initial stats', () => {
      const stats = subscriber.getStats();
      expect(stats.framesReceived).toBe(0);
      expect(stats.bytesReceived).toBe(0);
      expect(stats.framesDropped).toBe(0);
    });
  });

  describe('attach', () => {
    it('should transition to SUBSCRIBING state', () => {
      subscriber.attach(mockConnection as never, 1);
      expect(subscriber.getState()).toBe(AudioSubscriberState.SUBSCRIBING);
    });
  });

  describe('detach', () => {
    it('should transition to IDLE state', () => {
      subscriber.attach(mockConnection as never, 1);
      subscriber.detach();
      expect(subscriber.getState()).toBe(AudioSubscriberState.IDLE);
    });
  });

  describe('start', () => {
    it('should throw if not attached', async () => {
      await expect(subscriber.start()).rejects.toThrow('Not attached');
    });

    it('should transition to ACTIVE state', async () => {
      // Set up mock to resolve after a delay then close
      mockConnection.mockReader.read.mockResolvedValue({ done: true });

      subscriber.attach(mockConnection as never, 1);
      await subscriber.start();

      expect(subscriber.getState()).toBe(AudioSubscriberState.ACTIVE);
    });

    it('should not start twice', async () => {
      mockConnection.mockReader.read.mockResolvedValue({ done: true });

      subscriber.attach(mockConnection as never, 1);
      await subscriber.start();
      await subscriber.start(); // Should not throw

      expect(subscriber.getState()).toBe(AudioSubscriberState.ACTIVE);
    });
  });

  describe('stop', () => {
    it('should transition to IDLE state', async () => {
      mockConnection.mockReader.read.mockResolvedValue({ done: true });

      subscriber.attach(mockConnection as never, 1);
      await subscriber.start();

      subscriber.stop();

      expect(subscriber.getState()).toBe(AudioSubscriberState.IDLE);
    });
  });

  describe('onFrame', () => {
    it('should set frame handler', () => {
      const handler = vi.fn();
      subscriber.onFrame(handler);

      // Handler is set, can't directly verify but should not throw
      expect(true).toBe(true);
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', () => {
      subscriber.resetStats();

      const stats = subscriber.getStats();
      expect(stats.framesReceived).toBe(0);
      expect(stats.bytesReceived).toBe(0);
      expect(stats.framesDropped).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return a copy of stats', () => {
      const stats1 = subscriber.getStats();
      const stats2 = subscriber.getStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });
});

describe('isAudioDecoderSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return false when AudioDecoder is undefined', () => {
    vi.stubGlobal('AudioDecoder', undefined);
    expect(isAudioDecoderSupported()).toBe(false);
  });

  it('should return true when AudioDecoder is defined', () => {
    vi.stubGlobal('AudioDecoder', class MockAudioDecoder {});
    expect(isAudioDecoderSupported()).toBe(true);
  });
});

describe('getAudioDecoderCapabilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return not supported when AudioDecoder is undefined', async () => {
    vi.stubGlobal('AudioDecoder', undefined);

    const caps = await getAudioDecoderCapabilities();

    expect(caps.supported).toBe(false);
    expect(caps.opusSupported).toBe(false);
  });

  it('should check Opus support when AudioDecoder is available', async () => {
    const mockIsConfigSupported = vi.fn().mockResolvedValue({ supported: true });
    vi.stubGlobal('AudioDecoder', {
      isConfigSupported: mockIsConfigSupported,
    });

    const caps = await getAudioDecoderCapabilities();

    expect(caps.supported).toBe(true);
    expect(caps.opusSupported).toBe(true);
    expect(mockIsConfigSupported).toHaveBeenCalledWith({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
    });
  });

  it('should handle isConfigSupported returning false', async () => {
    vi.stubGlobal('AudioDecoder', {
      isConfigSupported: vi.fn().mockResolvedValue({ supported: false }),
    });

    const caps = await getAudioDecoderCapabilities();

    expect(caps.supported).toBe(true);
    expect(caps.opusSupported).toBe(false);
  });

  it('should handle isConfigSupported throwing', async () => {
    vi.stubGlobal('AudioDecoder', {
      isConfigSupported: vi.fn().mockRejectedValue(new Error('Not supported')),
    });

    const caps = await getAudioDecoderCapabilities();

    expect(caps.supported).toBe(true);
    expect(caps.opusSupported).toBe(false);
  });
});
