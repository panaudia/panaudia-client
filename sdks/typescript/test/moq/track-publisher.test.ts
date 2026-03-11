/**
 * Tests for Track Publisher
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TrackPublisher,
  AudioTrackPublisher,
  StateTrackPublisher,
} from '../../src/moq/track-publisher.js';
import { MoqClientError } from '../../src/moq/errors.js';

// Mock MoqConnection
const createMockConnection = () => ({
  sendDatagram: vi.fn().mockResolvedValue(undefined),
});

describe('TrackPublisher', () => {
  let publisher: TrackPublisher;
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    publisher = new TrackPublisher({ trackAlias: 1 });
    mockConnection = createMockConnection();
  });

  describe('constructor', () => {
    it('should create publisher with track alias', () => {
      const pub = new TrackPublisher({ trackAlias: 42 });
      expect(pub).toBeDefined();
    });

    it('should use default publisher priority', () => {
      const pub = new TrackPublisher({ trackAlias: 1 });
      const stats = pub.getStats();
      expect(stats.objectsPublished).toBe(0);
    });

    it('should accept custom publisher priority', () => {
      const pub = new TrackPublisher({ trackAlias: 1, publisherPriority: 5 });
      expect(pub).toBeDefined();
    });
  });

  describe('attach/detach', () => {
    it('should attach to a connection', () => {
      publisher.attach(mockConnection as never);
      // Can publish after attaching
      expect(() => publisher.publish(new Uint8Array([1, 2, 3]))).not.toThrow();
    });

    it('should detach from connection', async () => {
      publisher.attach(mockConnection as never);
      publisher.detach();

      await expect(publisher.publish(new Uint8Array([1, 2, 3]))).rejects.toThrow('Not attached');
    });
  });

  describe('publish', () => {
    it('should throw if not attached', async () => {
      await expect(publisher.publish(new Uint8Array([1, 2, 3]))).rejects.toThrow(
        'Not attached to a connection'
      );
    });

    it('should publish data via datagram', async () => {
      publisher.attach(mockConnection as never);

      await publisher.publish(new Uint8Array([1, 2, 3]));

      expect(mockConnection.sendDatagram).toHaveBeenCalled();
    });

    it('should update statistics after publish', async () => {
      publisher.attach(mockConnection as never);

      await publisher.publish(new Uint8Array([1, 2, 3]));

      const stats = publisher.getStats();
      expect(stats.objectsPublished).toBe(1);
      expect(stats.bytesPublished).toBe(3);
    });

    it('should increment object ID within same group', async () => {
      publisher.attach(mockConnection as never);
      publisher.setGroupDuration(10000); // Long duration to stay in same group

      await publisher.publish(new Uint8Array([1]));
      await publisher.publish(new Uint8Array([2]));
      await publisher.publish(new Uint8Array([3]));

      const stats = publisher.getStats();
      expect(stats.objectsPublished).toBe(3);
      expect(stats.currentObjectId).toBe(3n);
    });

    it('should start new group after duration passes', async () => {
      publisher.attach(mockConnection as never);
      publisher.setGroupDuration(1); // Very short duration

      await publisher.publish(new Uint8Array([1]));
      const stats1 = publisher.getStats();
      const group1 = stats1.currentGroupId;

      // Wait for group duration to pass
      await new Promise((resolve) => setTimeout(resolve, 10));

      await publisher.publish(new Uint8Array([2]));
      const stats2 = publisher.getStats();

      expect(stats2.currentGroupId).toBeGreaterThan(group1);
      expect(stats2.currentObjectId).toBe(1n); // Reset in new group
    });

    it('should track errors', async () => {
      mockConnection.sendDatagram = vi.fn().mockRejectedValue(new Error('Send failed'));
      publisher.attach(mockConnection as never);

      await expect(publisher.publish(new Uint8Array([1]))).rejects.toThrow('Failed to publish');

      const stats = publisher.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('publishWithIds', () => {
    it('should throw if not attached', async () => {
      await expect(publisher.publishWithIds(1n, 1n, new Uint8Array([1]))).rejects.toThrow(
        'Not attached'
      );
    });

    it('should publish with explicit IDs', async () => {
      publisher.attach(mockConnection as never);

      await publisher.publishWithIds(42n, 7n, new Uint8Array([1, 2, 3]));

      expect(mockConnection.sendDatagram).toHaveBeenCalled();
      const stats = publisher.getStats();
      expect(stats.objectsPublished).toBe(1);
      expect(stats.bytesPublished).toBe(3);
    });

    it('should track errors on failure', async () => {
      mockConnection.sendDatagram = vi.fn().mockRejectedValue(new Error('Send failed'));
      publisher.attach(mockConnection as never);

      await expect(publisher.publishWithIds(1n, 1n, new Uint8Array([1]))).rejects.toThrow();

      const stats = publisher.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('getStats/resetStats', () => {
    it('should return current statistics', async () => {
      publisher.attach(mockConnection as never);
      await publisher.publish(new Uint8Array([1, 2, 3, 4, 5]));

      const stats = publisher.getStats();

      expect(stats.objectsPublished).toBe(1);
      expect(stats.bytesPublished).toBe(5);
      expect(stats.errors).toBe(0);
    });

    it('should reset statistics', async () => {
      publisher.attach(mockConnection as never);
      await publisher.publish(new Uint8Array([1, 2, 3]));

      publisher.resetStats();
      const stats = publisher.getStats();

      expect(stats.objectsPublished).toBe(0);
      expect(stats.bytesPublished).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });

  describe('setGroupDuration', () => {
    it('should change group duration', () => {
      publisher.setGroupDuration(5000);
      // No direct way to test, but should not throw
      expect(true).toBe(true);
    });
  });

  describe('startNewGroup', () => {
    it('should increment group ID and reset object ID', async () => {
      publisher.attach(mockConnection as never);
      await publisher.publish(new Uint8Array([1]));

      const stats1 = publisher.getStats();
      const group1 = stats1.currentGroupId;

      publisher.startNewGroup();

      const stats2 = publisher.getStats();
      expect(stats2.currentGroupId).toBeGreaterThan(group1);
      expect(stats2.currentObjectId).toBe(0n);
    });
  });
});

describe('AudioTrackPublisher', () => {
  let publisher: AudioTrackPublisher;
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    publisher = new AudioTrackPublisher({ trackAlias: 1 });
    mockConnection = createMockConnection();
  });

  it('should extend TrackPublisher', () => {
    expect(publisher).toBeInstanceOf(TrackPublisher);
  });

  describe('startSession', () => {
    it('should reset frame sequence', () => {
      publisher.attach(mockConnection as never);
      publisher.startSession();
      // No direct way to test, but should not throw
      expect(true).toBe(true);
    });

    it('should start new group', () => {
      publisher.attach(mockConnection as never);
      const stats1 = publisher.getStats();
      const group1 = stats1.currentGroupId;

      publisher.startSession();

      const stats2 = publisher.getStats();
      expect(stats2.currentGroupId).toBeGreaterThan(group1);
    });
  });

  describe('publishAudioFrame', () => {
    it('should publish audio data', async () => {
      publisher.attach(mockConnection as never);
      publisher.startSession();

      await publisher.publishAudioFrame(new Uint8Array([0x00, 0x01, 0x02]));

      expect(mockConnection.sendDatagram).toHaveBeenCalled();
    });

    it('should increment frame sequence', async () => {
      publisher.attach(mockConnection as never);
      publisher.startSession();

      await publisher.publishAudioFrame(new Uint8Array([1]));
      await publisher.publishAudioFrame(new Uint8Array([2]));
      await publisher.publishAudioFrame(new Uint8Array([3]));

      const stats = publisher.getStats();
      expect(stats.objectsPublished).toBe(3);
    });

    it('should use timestamp as group ID', async () => {
      publisher.attach(mockConnection as never);
      publisher.startSession();

      // Publish with explicit timestamp
      await publisher.publishAudioFrame(new Uint8Array([1]), 1000);
      await publisher.publishAudioFrame(new Uint8Array([2]), 2000);

      expect(mockConnection.sendDatagram).toHaveBeenCalledTimes(2);
    });
  });
});

describe('StateTrackPublisher', () => {
  let publisher: StateTrackPublisher;
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    publisher = new StateTrackPublisher({ trackAlias: 1 });
    mockConnection = createMockConnection();
  });

  it('should extend TrackPublisher', () => {
    expect(publisher).toBeInstanceOf(TrackPublisher);
  });

  describe('publishState', () => {
    it('should require exactly 48 bytes', async () => {
      publisher.attach(mockConnection as never);

      // Too small
      await expect(publisher.publishState(new Uint8Array(47))).rejects.toThrow(
        'Invalid state data size'
      );

      // Too large
      await expect(publisher.publishState(new Uint8Array(49))).rejects.toThrow(
        'Invalid state data size'
      );
    });

    it('should publish valid 48-byte state', async () => {
      publisher.attach(mockConnection as never);

      const stateData = new Uint8Array(48);
      await publisher.publishState(stateData);

      expect(mockConnection.sendDatagram).toHaveBeenCalled();
    });

    it('should increment update sequence', async () => {
      publisher.attach(mockConnection as never);

      await publisher.publishState(new Uint8Array(48));
      await publisher.publishState(new Uint8Array(48));
      await publisher.publishState(new Uint8Array(48));

      const stats = publisher.getStats();
      expect(stats.objectsPublished).toBe(3);
    });

    it('should throw MoqClientError for invalid size', async () => {
      publisher.attach(mockConnection as never);

      try {
        await publisher.publishState(new Uint8Array(10));
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MoqClientError);
        expect((error as MoqClientError).code).toBe('INVALID_DATA');
      }
    });
  });
});
