/**
 * Tests for Audio Publisher
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AudioPublisher,
  AudioPublisherState,
  isOpusSupported,
  getBestOpusMimeType,
  getAudioCapabilities,
  AudioPermissionError,
  AudioNotSupportedError,
} from '../../src/moq/audio-publisher.js';

// Helper to create mock MediaRecorder class
function createMockMediaRecorderClass(options: {
  isTypeSupported?: (mimeType: string) => boolean;
} = {}) {
  const isTypeSupportedFn = options.isTypeSupported ?? ((mimeType: string) => {
    return mimeType === 'audio/webm;codecs=opus' || mimeType === 'audio/webm';
  });

  return class MockMediaRecorder {
    static isTypeSupported = vi.fn(isTypeSupportedFn);

    state: 'inactive' | 'recording' | 'paused' = 'inactive';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    onstop: (() => void) | null = null;

    constructor(
      public stream: MediaStream,
      public options: { mimeType: string; audioBitsPerSecond: number }
    ) {}

    start(timeslice?: number) {
      this.state = 'recording';
      if (this.ondataavailable && timeslice) {
        setTimeout(() => {
          if (this.ondataavailable && this.state === 'recording') {
            const mockData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
            this.ondataavailable({ data: new Blob([mockData]) });
          }
        }, timeslice);
      }
    }

    stop() {
      this.state = 'inactive';
      if (this.onstop) {
        this.onstop();
      }
    }

    pause() {
      this.state = 'paused';
    }

    resume() {
      this.state = 'recording';
    }
  };
}

// Mock MediaStream
class MockMediaStream {
  private tracks: { stop: ReturnType<typeof vi.fn> }[] = [{ stop: vi.fn() }];

  getTracks() {
    return this.tracks;
  }
}

// Helper to set up standard mocks
function setupStandardMocks() {
  const MockMediaRecorder = createMockMediaRecorderClass();
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);

  const mockGetUserMedia = vi.fn().mockResolvedValue(new MockMediaStream());
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: mockGetUserMedia,
    },
  });

  return { MockMediaRecorder, mockGetUserMedia };
}

describe('Audio Publisher', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('isOpusSupported', () => {
    it('should return true when Opus is supported', () => {
      setupStandardMocks();
      expect(isOpusSupported()).toBe(true);
    });

    it('should return false when MediaRecorder is undefined', () => {
      vi.stubGlobal('MediaRecorder', undefined);
      expect(isOpusSupported()).toBe(false);
    });

    it('should return false when no Opus MIME types are supported', () => {
      const MockMediaRecorder = createMockMediaRecorderClass({
        isTypeSupported: () => false,
      });
      vi.stubGlobal('MediaRecorder', MockMediaRecorder);
      expect(isOpusSupported()).toBe(false);
    });
  });

  describe('getBestOpusMimeType', () => {
    it('should return webm with opus codec as first choice', () => {
      setupStandardMocks();
      expect(getBestOpusMimeType()).toBe('audio/webm;codecs=opus');
    });

    it('should return null when MediaRecorder is undefined', () => {
      vi.stubGlobal('MediaRecorder', undefined);
      expect(getBestOpusMimeType()).toBe(null);
    });

    it('should return null when no types are supported', () => {
      const MockMediaRecorder = createMockMediaRecorderClass({
        isTypeSupported: () => false,
      });
      vi.stubGlobal('MediaRecorder', MockMediaRecorder);
      expect(getBestOpusMimeType()).toBe(null);
    });

    it('should fall back to webm without explicit codec', () => {
      const MockMediaRecorder = createMockMediaRecorderClass({
        isTypeSupported: (mimeType: string) => mimeType === 'audio/webm',
      });
      vi.stubGlobal('MediaRecorder', MockMediaRecorder);
      expect(getBestOpusMimeType()).toBe('audio/webm');
    });
  });

  describe('getAudioCapabilities', () => {
    it('should return capability information', () => {
      setupStandardMocks();
      const caps = getAudioCapabilities();

      expect(caps.getUserMedia).toBe(true);
      expect(caps.mediaRecorder).toBe(true);
      expect(caps.opusSupport).toBe(true);
      expect(caps.bestMimeType).toBe('audio/webm;codecs=opus');
    });
  });

  describe('AudioPublisher', () => {
    beforeEach(() => {
      setupStandardMocks();
    });

    it('should start in IDLE state', () => {
      const publisher = new AudioPublisher();
      expect(publisher.getState()).toBe(AudioPublisherState.IDLE);
    });

    it('should use default config values', () => {
      const publisher = new AudioPublisher();
      expect(publisher.getState()).toBe(AudioPublisherState.IDLE);
    });

    it('should accept custom config', () => {
      const publisher = new AudioPublisher({
        sampleRate: 44100,
        channelCount: 2,
        bitrate: 128000,
        frameDurationMs: 40,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      });

      expect(publisher.getState()).toBe(AudioPublisherState.IDLE);
    });

    describe('initialize', () => {
      it('should request microphone access', async () => {
        const publisher = new AudioPublisher();
        await publisher.initialize();

        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
          audio: expect.objectContaining({
            channelCount: 1,
            sampleRate: 48000,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          }),
          video: false,
        });

        expect(publisher.getState()).toBe(AudioPublisherState.READY);
      });

      it('should throw if already initialized', async () => {
        const publisher = new AudioPublisher();
        await publisher.initialize();

        await expect(publisher.initialize()).rejects.toThrow('Cannot initialize');
      });

      it('should throw AudioNotSupportedError if getUserMedia not available', async () => {
        vi.stubGlobal('navigator', { mediaDevices: undefined });

        const publisher = new AudioPublisher();

        await expect(publisher.initialize()).rejects.toBeInstanceOf(AudioNotSupportedError);
      });

      it('should throw AudioNotSupportedError if Opus not supported', async () => {
        const MockMediaRecorder = createMockMediaRecorderClass({
          isTypeSupported: () => false,
        });
        vi.stubGlobal('MediaRecorder', MockMediaRecorder);

        const publisher = new AudioPublisher();

        await expect(publisher.initialize()).rejects.toBeInstanceOf(AudioNotSupportedError);
      });

      it('should throw AudioPermissionError on NotAllowedError', async () => {
        const error = new DOMException('Permission denied', 'NotAllowedError');
        const mockGetUserMedia = vi.fn().mockRejectedValue(error);
        vi.stubGlobal('navigator', {
          mediaDevices: { getUserMedia: mockGetUserMedia },
        });

        const publisher = new AudioPublisher();

        await expect(publisher.initialize()).rejects.toBeInstanceOf(AudioPermissionError);
        expect(publisher.getState()).toBe(AudioPublisherState.ERROR);
      });

      it('should throw AudioPermissionError on NotFoundError', async () => {
        const error = new DOMException('No microphone', 'NotFoundError');
        const mockGetUserMedia = vi.fn().mockRejectedValue(error);
        vi.stubGlobal('navigator', {
          mediaDevices: { getUserMedia: mockGetUserMedia },
        });

        const publisher = new AudioPublisher();

        await expect(publisher.initialize()).rejects.toBeInstanceOf(AudioPermissionError);
      });

      it('should throw AudioPermissionError on NotReadableError', async () => {
        const error = new DOMException('Device in use', 'NotReadableError');
        const mockGetUserMedia = vi.fn().mockRejectedValue(error);
        vi.stubGlobal('navigator', {
          mediaDevices: { getUserMedia: mockGetUserMedia },
        });

        const publisher = new AudioPublisher();

        await expect(publisher.initialize()).rejects.toBeInstanceOf(AudioPermissionError);
      });
    });

    describe('start/stop', () => {
      it('should throw if not in READY state', () => {
        const publisher = new AudioPublisher();

        expect(() => publisher.start()).toThrow('Cannot start');
      });

      it('should start recording when ready', async () => {
        const publisher = new AudioPublisher();
        await publisher.initialize();

        publisher.start();

        expect(publisher.getState()).toBe(AudioPublisherState.RECORDING);
      });

      it('should stop recording', async () => {
        const publisher = new AudioPublisher();
        await publisher.initialize();
        publisher.start();

        publisher.stop();

        expect(publisher.getState()).toBe(AudioPublisherState.READY);
      });

      it('should throw AudioNotSupportedError if no MIME type available after init', async () => {
        const publisher = new AudioPublisher();
        await publisher.initialize();

        // Remove MIME type support after initialization
        const MockMediaRecorder = createMockMediaRecorderClass({
          isTypeSupported: () => false,
        });
        vi.stubGlobal('MediaRecorder', MockMediaRecorder);

        expect(() => publisher.start()).toThrow(AudioNotSupportedError);
      });
    });

    describe('pause/resume', () => {
      it('should pause recording', async () => {
        const publisher = new AudioPublisher();
        await publisher.initialize();
        publisher.start();

        publisher.pause();

        expect(publisher.getState()).toBe(AudioPublisherState.PAUSED);
      });

      it('should resume recording', async () => {
        const publisher = new AudioPublisher();
        await publisher.initialize();
        publisher.start();
        publisher.pause();

        publisher.resume();

        expect(publisher.getState()).toBe(AudioPublisherState.RECORDING);
      });

      it('should do nothing if pausing when not recording', async () => {
        const publisher = new AudioPublisher();
        await publisher.initialize();

        publisher.pause();

        expect(publisher.getState()).toBe(AudioPublisherState.READY);
      });

      it('should do nothing if resuming when not paused', async () => {
        const publisher = new AudioPublisher();
        await publisher.initialize();
        publisher.start();

        publisher.resume();

        expect(publisher.getState()).toBe(AudioPublisherState.RECORDING);
      });

      it('should allow starting from PAUSED state', async () => {
        const publisher = new AudioPublisher();
        await publisher.initialize();
        publisher.start();
        publisher.pause();

        publisher.start();

        expect(publisher.getState()).toBe(AudioPublisherState.RECORDING);
      });
    });

    describe('frame handling', () => {
      it('should call frame handler when data is available', async () => {
        const publisher = new AudioPublisher();
        const frameHandler = vi.fn();

        publisher.onFrame(frameHandler);
        await publisher.initialize();
        publisher.start();

        // Wait for the mock to trigger ondataavailable
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(frameHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.any(Uint8Array),
            timestamp: expect.any(Number),
            duration: 5,
          })
        );
      });
    });

    describe('dispose', () => {
      it('should release all resources', async () => {
        const publisher = new AudioPublisher();
        await publisher.initialize();
        publisher.start();

        publisher.dispose();

        expect(publisher.getState()).toBe(AudioPublisherState.IDLE);
      });

      it('should stop media stream tracks', async () => {
        const mockStream = new MockMediaStream();
        const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
        vi.stubGlobal('navigator', {
          mediaDevices: { getUserMedia: mockGetUserMedia },
        });

        const publisher = new AudioPublisher();
        await publisher.initialize();

        publisher.dispose();

        expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
      });

      it('should be safe to call multiple times', async () => {
        const publisher = new AudioPublisher();
        await publisher.initialize();

        publisher.dispose();
        publisher.dispose();

        expect(publisher.getState()).toBe(AudioPublisherState.IDLE);
      });
    });
  });
});
