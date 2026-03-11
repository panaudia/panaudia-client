import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PanaudiaClient } from '../src/panaudia-client.js';
import type { Transport, TransportConfig, AudioCaptureConfig, AudioPlaybackConfig } from '../src/transport.js';
import type { ConnectionState, EntityInfo3, ControlMessage, EntityState, EntityAttributes } from '../src/types.js';

// Mock isWebTransportSupported to return true so 'auto' picks MOQ
vi.mock('../src/moq/connection.js', () => ({
  isWebTransportSupported: vi.fn(() => true),
  getWebTransportSupport: vi.fn(() => ({ supported: true })),
}));

// Mock MoqTransportAdapter
const mockTransport: Transport = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  getState: vi.fn().mockReturnValue('disconnected' as ConnectionState),
  getEntityId: vi.fn().mockReturnValue('test-node-id'),
  startAudioCapture: vi.fn().mockResolvedValue(undefined),
  stopAudioCapture: vi.fn().mockResolvedValue(undefined),
  startAudioPlayback: vi.fn().mockResolvedValue(undefined),
  stopAudioPlayback: vi.fn().mockResolvedValue(undefined),
  muteMic: vi.fn(),
  unmuteMic: vi.fn(),
  publishState: vi.fn().mockResolvedValue(undefined),
  publishControl: vi.fn().mockResolvedValue(undefined),
  onEntityState: vi.fn(),
  onAttributes: vi.fn(),
  onConnectionStateChange: vi.fn(),
  onError: vi.fn(),
  setVolume: vi.fn(),
  getVolume: vi.fn().mockReturnValue(1),
};

vi.mock('../src/moq/moq-transport-adapter.js', () => ({
  MoqTransportAdapter: vi.fn(() => mockTransport),
}));

describe('PanaudiaClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultConfig = {
    serverUrl: 'quic://server.panaudia.com/moq',
    ticket: 'test-jwt-token',
  };

  describe('constructor', () => {
    it('should create with MOQ transport when transport is "moq"', () => {
      const client = new PanaudiaClient({ ...defaultConfig, transport: 'moq' });
      expect(client.getTransportType()).toBe('moq');
    });

    it('should create with MOQ transport when transport is "auto" and WebTransport supported', () => {
      const client = new PanaudiaClient({ ...defaultConfig, transport: 'auto' });
      expect(client.getTransportType()).toBe('moq');
    });

    it('should default transport to "auto"', () => {
      const client = new PanaudiaClient(defaultConfig);
      expect(client.getTransportType()).toBe('moq');
    });

    it('should create with WebRTC transport when transport is "webrtc"', () => {
      const client = new PanaudiaClient({ ...defaultConfig, transport: 'webrtc' });
      expect(client.getTransportType()).toBe('webrtc');
    });

  });

  describe('connect/disconnect', () => {
    it('should delegate connect to transport', async () => {
      const client = new PanaudiaClient(defaultConfig);
      await client.connect();
      expect(mockTransport.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          serverUrl: defaultConfig.serverUrl,
          ticket: defaultConfig.ticket,
        }),
      );
    });

    it('should delegate disconnect to transport', async () => {
      const client = new PanaudiaClient(defaultConfig);
      await client.disconnect();
      expect(mockTransport.disconnect).toHaveBeenCalled();
    });

    it('should delegate getState to transport', () => {
      const client = new PanaudiaClient(defaultConfig);
      client.getState();
      expect(mockTransport.getState).toHaveBeenCalled();
    });

    it('should delegate getEntityId to transport', () => {
      const client = new PanaudiaClient(defaultConfig);
      expect(client.getEntityId()).toBe('test-node-id');
    });
  });

  describe('audio', () => {
    it('should delegate muteMic/unmuteMic to transport', () => {
      const client = new PanaudiaClient(defaultConfig);
      client.muteMic();
      expect(mockTransport.muteMic).toHaveBeenCalled();
      client.unmuteMic();
      expect(mockTransport.unmuteMic).toHaveBeenCalled();
    });

    it('should track mute state with isMuted()', () => {
      const client = new PanaudiaClient(defaultConfig);
      expect(client.isMuted()).toBe(false);
      client.muteMic();
      expect(client.isMuted()).toBe(true);
      client.unmuteMic();
      expect(client.isMuted()).toBe(false);
    });
  });

  describe('spatial', () => {
    it('should schedule state publish on setPose', async () => {
      vi.useFakeTimers();
      vi.mocked(mockTransport.getState).mockReturnValue('authenticated' as ConnectionState);
      const client = new PanaudiaClient(defaultConfig);
      client.setPose({ position: { x: 0.5, y: 0.5, z: 0.5 }, rotation: { yaw: 0, pitch: 0, roll: 0 } });

      // Not published immediately
      expect(mockTransport.publishState).not.toHaveBeenCalled();

      // Published after throttle
      await vi.advanceTimersByTimeAsync(100);
      expect(mockTransport.publishState).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should throttle multiple pose changes', async () => {
      vi.useFakeTimers();
      vi.mocked(mockTransport.getState).mockReturnValue('authenticated' as ConnectionState);
      const client = new PanaudiaClient(defaultConfig);

      client.setPose({ position: { x: 0.1, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } });
      client.setPose({ position: { x: 0.2, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } });
      client.setPose({ position: { x: 0.3, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } });

      await vi.advanceTimersByTimeAsync(100);

      // Should only publish once (throttled)
      expect(mockTransport.publishState).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should normalize position when worldBounds is set', async () => {
      vi.useFakeTimers();
      vi.mocked(mockTransport.getState).mockReturnValue('authenticated' as ConnectionState);
      const client = new PanaudiaClient({
        ...defaultConfig,
        worldBounds: { min: -100, max: 100 },
      });
      client.setPose({ position: { x: 0, y: 0, z: 0 }, rotation: { yaw: 90, pitch: 0, roll: 0 } });

      await vi.advanceTimersByTimeAsync(100);
      expect(mockTransport.publishState).toHaveBeenCalled();

      // Position (0,0,0) with bounds [-100,100] should normalize to (0.5, 0.5, 0.5)
      const publishedState = vi.mocked(mockTransport.publishState).mock.calls[0][0];
      expect(publishedState.position.x).toBeCloseTo(0.5);
      expect(publishedState.position.y).toBeCloseTo(0.5);
      expect(publishedState.position.z).toBeCloseTo(0.5);

      vi.useRealTimers();
    });

    it('should not publish state when not connected', async () => {
      vi.useFakeTimers();
      vi.mocked(mockTransport.getState).mockReturnValue('disconnected' as ConnectionState);
      const client = new PanaudiaClient(defaultConfig);
      client.setPose({ position: { x: 0.5, y: 0.5, z: 0.5 }, rotation: { yaw: 0, pitch: 0, roll: 0 } });

      await vi.advanceTimersByTimeAsync(100);
      expect(mockTransport.publishState).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('control', () => {
    it('should send mute control message', async () => {
      const client = new PanaudiaClient(defaultConfig);
      await client.mute('some-node-id');
      expect(mockTransport.publishControl).toHaveBeenCalledWith({
        type: 'mute',
        message: { node: 'some-node-id' },
      });
    });

    it('should send unmute control message', async () => {
      const client = new PanaudiaClient(defaultConfig);
      await client.unmute('some-node-id');
      expect(mockTransport.publishControl).toHaveBeenCalledWith({
        type: 'unmute',
        message: { node: 'some-node-id' },
      });
    });
  });

  describe('events', () => {
    it('should fire entityState with Panaudia coordinates', () => {
      const client = new PanaudiaClient(defaultConfig);
      const handler = vi.fn();
      client.on('entityState', handler);

      const transportHandler = vi.mocked(mockTransport.onEntityState).mock.calls[0]?.[0];
      expect(transportHandler).toBeDefined();

      // Simulate event from transport (Panaudia coordinates)
      const state: EntityState = {
        uuid: 'test-uuid',
        position: { x: 0.5, y: 0.5, z: 0.5 },
        rotation: { yaw: 0, pitch: 0, roll: 0 },
        volume: 1,
        gone: false,
      };
      transportHandler!(state);

      expect(handler).toHaveBeenCalledTimes(1);
      const received = handler.mock.calls[0][0];
      expect(received.uuid).toBe('test-uuid');
      expect(received.position.x).toBe(0.5);
      expect(received.position.y).toBe(0.5);
      expect(received.position.z).toBe(0.5);
      expect(received.volume).toBe(1);
      expect(received.gone).toBe(false);
    });

    it('should denormalize entityState positions when worldBounds is set', () => {
      const client = new PanaudiaClient({
        ...defaultConfig,
        worldBounds: { min: -100, max: 100 },
      });
      const handler = vi.fn();
      client.on('entityState', handler);

      const transportHandler = vi.mocked(mockTransport.onEntityState).mock.calls[0]?.[0];

      const state: EntityState = {
        uuid: 'test-uuid',
        position: { x: 0.5, y: 0.5, z: 0.5 },
        rotation: { yaw: 90, pitch: 0, roll: 0 },
        volume: 0.8,
        gone: false,
      };
      transportHandler!(state);

      expect(handler).toHaveBeenCalledTimes(1);
      const received = handler.mock.calls[0][0];
      expect(received.uuid).toBe('test-uuid');
      // 0.5 * 200 + (-100) = 0
      expect(received.position.x).toBeCloseTo(0);
      expect(received.position.y).toBeCloseTo(0);
      expect(received.position.z).toBeCloseTo(0);
      expect(received.rotation.yaw).toBe(90);
      expect(received.volume).toBe(0.8);
    });

    it('should unregister event handlers with off()', () => {
      const client = new PanaudiaClient(defaultConfig);
      const handler = vi.fn();
      client.on('entityState', handler);
      client.off('entityState', handler);

      const transportHandler = vi.mocked(mockTransport.onEntityState).mock.calls[0]?.[0];
      transportHandler!({
        uuid: 'test',
        position: { x: 0.5, y: 0.5, z: 0.5 },
        rotation: { yaw: 0, pitch: 0, roll: 0 },
        volume: 1,
        gone: false,
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
