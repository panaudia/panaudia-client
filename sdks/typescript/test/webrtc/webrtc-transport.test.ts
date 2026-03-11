import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebRtcTransport } from '../../src/webrtc/webrtc-transport.js';
import type { TransportConfig } from '../../src/transport.js';
import type { ConnectionState, EntityInfo3 } from '../../src/types.js';

// ── Mocks ────────────────────────────────────────────────────────────

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  sent: string[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
    // Fire onopen async
    setTimeout(() => this.onopen?.(new Event('open')), 0);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    setTimeout(() => this.onclose?.(new CloseEvent('close')), 0);
  }

  // Test helper: simulate server sending a message
  _receive(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
}

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  onicecandidate: ((ev: RTCPeerConnectionIceEvent) => void) | null = null;
  ontrack: ((ev: RTCTrackEvent) => void) | null = null;
  ondatachannel: ((ev: RTCDataChannelEvent) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  connectionState = 'new';
  localDescription: RTCSessionDescriptionInit | null = null;

  async setRemoteDescription(_desc: RTCSessionDescriptionInit) {}
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'answer', sdp: 'v=0\r\na=fmtp:111 minptime=10\r\n' };
  }
  async setLocalDescription(desc: RTCSessionDescriptionInit) {
    this.localDescription = desc;
  }
  async addIceCandidate(_candidate: RTCIceCandidateInit) {}
  addTrack(_track: MediaStreamTrack, _stream: MediaStream) {}
  close() {}

  // Test helper: simulate a data channel being created by server
  _createDataChannel(label: string): MockDataChannel {
    const channel = new MockDataChannel(label);
    this.ondatachannel?.({ channel } as unknown as RTCDataChannelEvent);
    return channel;
  }
}

class MockDataChannel {
  label: string;
  readyState = 'open';
  binaryType = 'arraybuffer';
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  sent: unknown[] = [];

  constructor(label: string) {
    this.label = label;
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 'closed';
  }

  // Test helper
  _receive(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  _open() {
    this.onopen?.();
  }
}

// Install mocks
let lastWs: MockWebSocket;
let lastPc: MockRTCPeerConnection;

function installGlobalMocks() {
  vi.stubGlobal('WebSocket', class extends MockWebSocket {
    constructor(url: string) {
      super(url);
      lastWs = this;
    }
  });

  vi.stubGlobal('RTCPeerConnection', class extends MockRTCPeerConnection {
    constructor() {
      super();
      lastPc = this;
    }
  });

  // Mock navigator.mediaDevices.getUserMedia for mic capture during connect
  const mockTrack = { kind: 'audio', enabled: true, stop: vi.fn() };
  const mockStream = {
    getAudioTracks: () => [mockTrack],
  };
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    },
  });
}

// ── Test config ─────────────────────────────────────────────────────

// A valid-looking JWT with jti=test-node-id
const testPayload = btoa(JSON.stringify({ jti: 'test-node-id', preferred_username: 'tester' }));
const testJwt = `eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.${testPayload}.fakesig`;

const testConfig: TransportConfig = {
  serverUrl: 'wss://server.panaudia.com/join',
  ticket: testJwt,
  initialPosition: { x: 0.5, y: 0.5, z: 0.5 },
  initialRotation: { yaw: 0, pitch: 0, roll: 0 },
};

// Helper: connect and complete the SDP handshake
async function connectAndHandshake(transport: WebRtcTransport) {
  const connectPromise = transport.connect(testConfig);
  // Wait for WebSocket to fire onopen
  await new Promise(r => setTimeout(r, 10));
  // Server sends offer
  lastWs._receive({ event: 'offer', data: JSON.stringify({ type: 'offer', sdp: 'v=0\r\n' }) });
  await connectPromise;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('WebRtcTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installGlobalMocks();
  });

  describe('connect', () => {
    it('should open WebSocket with ticket in URL', async () => {
      const transport = new WebRtcTransport();
      await connectAndHandshake(transport);

      expect(lastWs.url).toContain('wss://server.panaudia.com/join');
      expect(lastWs.url).toContain('ticket=');
      expect(lastWs.url).toContain('presence=true');
    });

    it('should include initial position in WebSocket URL', async () => {
      const transport = new WebRtcTransport();
      await connectAndHandshake(transport);

      expect(lastWs.url).toContain('x=0.5');
      expect(lastWs.url).toContain('y=0.5');
      expect(lastWs.url).toContain('z=0.5');
    });

    it('should send SDP answer after receiving offer', async () => {
      const transport = new WebRtcTransport();
      await connectAndHandshake(transport);

      const answerMsg = lastWs.sent.find(s => JSON.parse(s).event === 'answer');
      expect(answerMsg).toBeDefined();

      const parsed = JSON.parse(answerMsg!);
      const answer = JSON.parse(parsed.data);
      expect(answer.type).toBe('answer');
    });

    it('should apply stereo SDP hack to answer', async () => {
      const transport = new WebRtcTransport();
      await connectAndHandshake(transport);

      const answerMsg = lastWs.sent.find(s => JSON.parse(s).event === 'answer');
      const answer = JSON.parse(JSON.parse(answerMsg!).data);
      expect(answer.sdp).toContain('stereo=1; sprop-stereo=1;');
    });

    it('should extract entityId from JWT', async () => {
      const transport = new WebRtcTransport();
      await connectAndHandshake(transport);
      expect(transport.getEntityId()).toBe('test-node-id');
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket and peer connection', async () => {
      const transport = new WebRtcTransport();
      await connectAndHandshake(transport);
      await transport.disconnect();
      expect(transport.getState()).toBe('disconnected');
    });
  });

  describe('muteMic / unmuteMic', () => {
    it('should disable and re-enable mic tracks', async () => {
      const transport = new WebRtcTransport();
      await connectAndHandshake(transport);

      // Simulate getUserMedia
      const mockTrack = { enabled: true, stop: vi.fn() } as unknown as MediaStreamTrack;
      const mockStream = {
        getAudioTracks: () => [mockTrack],
      } as unknown as MediaStream;

      vi.stubGlobal('navigator', {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
      });

      await transport.startAudioCapture();

      transport.muteMic();
      expect(mockTrack.enabled).toBe(false);

      transport.unmuteMic();
      expect(mockTrack.enabled).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  describe('publishState', () => {
    it('should send binary data on state data channel', async () => {
      const transport = new WebRtcTransport();
      await connectAndHandshake(transport);

      // Simulate server creating state data channel
      const dc = lastPc._createDataChannel('state');
      dc._open();

      const state: EntityInfo3 = {
        uuid: '550e8400-e29b-41d4-a716-446655440000',
        position: { x: 0.3, y: 0.7, z: 0.5 },
        rotation: { yaw: 90, pitch: 0, roll: 0 },
        volume: 1.0,
        gone: false,
      };

      await transport.publishState(state);
      expect(dc.sent.length).toBe(1);
    });
  });

  describe('publishControl', () => {
    it('should send JSON on control data channel', async () => {
      const transport = new WebRtcTransport();
      await connectAndHandshake(transport);

      const dc = lastPc._createDataChannel('control');

      await transport.publishControl({ type: 'mute', message: { node: 'some-node' } });
      expect(dc.sent.length).toBe(1);

      const parsed = JSON.parse(dc.sent[0] as string);
      expect(parsed.type).toBe('mute');
      expect(parsed.message.node).toBe('some-node');
    });
  });

  describe('onEntityState', () => {
    it('should parse incoming binary state and fire handler', async () => {
      const transport = new WebRtcTransport();
      const handler = vi.fn();
      transport.onEntityState(handler);

      await connectAndHandshake(transport);

      const dc = lastPc._createDataChannel('state');

      // Create a 48-byte state buffer
      const buffer = new ArrayBuffer(48);
      const view = new DataView(buffer);
      // UUID bytes 0-15 (zeros = "00000000-0000-0000-0000-000000000000")
      view.setFloat32(16, 0.25, true); // x
      view.setFloat32(20, 0.75, true); // y
      view.setFloat32(24, 0.5, true);  // z
      view.setFloat32(28, 45, true);   // yaw
      view.setFloat32(32, 0, true);    // pitch
      view.setFloat32(36, 0, true);    // roll
      view.setFloat32(40, 0.8, true);  // volume
      view.setInt32(44, 0, true);      // gone

      dc._receive(buffer);

      expect(handler).toHaveBeenCalledTimes(1);
      const state = handler.mock.calls[0][0];
      expect(state.position.x).toBeCloseTo(0.25, 2);
      expect(state.position.y).toBeCloseTo(0.75, 2);
      expect(state.volume).toBeCloseTo(0.8, 2);
    });
  });

  describe('onAttributes', () => {
    it('should parse incoming JSON attributes and fire handler', async () => {
      const transport = new WebRtcTransport();
      const handler = vi.fn();
      transport.onAttributes(handler);

      await connectAndHandshake(transport);

      const dc = lastPc._createDataChannel('attributes');

      dc._receive(JSON.stringify({
        uuid: 'test-uuid',
        name: 'Test User',
        ticket: 'abc',
        connection: 'ws',
      }));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].name).toBe('Test User');
    });
  });

  describe('onConnectionStateChange', () => {
    it('should fire on state transitions', async () => {
      const transport = new WebRtcTransport();
      const states: ConnectionState[] = [];
      transport.onConnectionStateChange((s) => states.push(s));

      await connectAndHandshake(transport);

      // Should have transitioned to 'connecting'
      expect(states).toContain('connecting');
    });

    it('should fire authenticated when state data channel opens', async () => {
      const transport = new WebRtcTransport();
      const states: ConnectionState[] = [];
      transport.onConnectionStateChange((s) => states.push(s));

      await connectAndHandshake(transport);

      const dc = lastPc._createDataChannel('state');
      dc._open();

      expect(states).toContain('authenticated');
    });
  });
});
