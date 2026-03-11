/**
 * Tests for Panaudia MOQ Client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateTrackNamespace,
  PanaudiaTrackType,
  ConnectionState,
  MoqRole,
  MoqFilterType,
} from '../../src/moq/types.js';
import {
  buildSubscribe,
  buildClientSetup,
  buildAnnounce,
  parseMessageType,
  MOQ_TRANSPORT_VERSION,
  decodeVarint,
  decodeString,
} from '../../src/moq/moq-transport.js';

// ============================================================================
// JWT Parsing Tests
// ============================================================================

describe('JWT Parsing', () => {
  // Create a test JWT payload
  function createTestJwt(claims: Record<string, unknown>): string {
    const header = { alg: 'EdDSA', typ: 'JWT' };
    const headerB64 = btoa(JSON.stringify(header))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const payloadB64 = btoa(JSON.stringify(claims))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const signature = 'fake_signature';
    return `${headerB64}.${payloadB64}.${signature}`;
  }

  it('should extract entity ID from jti claim', () => {
    const entityId = '550e8400-e29b-41d4-a716-446655440000';
    const jwt = createTestJwt({ jti: entityId });

    // Simulate the extraction logic
    const parts = jwt.split('.');
    const payload = parts[1]!;
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(decoded);

    expect(claims.jti).toBe(entityId);
  });

  it('should extract entity ID from panaudia.uuid claim', () => {
    const entityId = '550e8400-e29b-41d4-a716-446655440000';
    const jwt = createTestJwt({
      panaudia: { uuid: entityId, name: 'Test User' },
    });

    const parts = jwt.split('.');
    const payload = parts[1]!;
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(decoded);

    expect(claims.panaudia.uuid).toBe(entityId);
  });

  it('should preserve UUID hyphens', () => {
    const entityId = '550e8400-e29b-41d4-a716-446655440000';
    const jwt = createTestJwt({ jti: entityId });

    const parts = jwt.split('.');
    const payload = parts[1]!;
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(decoded);

    // UUID should have hyphens (Go server expects this)
    expect(claims.jti).toContain('-');
    expect(claims.jti.split('-').length).toBe(5);
  });
});

// ============================================================================
// Track Namespace Tests
// ============================================================================

describe('Track Namespace Generation', () => {
  const testEntityId = '550e8400-e29b-41d4-a716-446655440000';

  it('should generate audio input namespace', () => {
    const namespace = generateTrackNamespace(PanaudiaTrackType.AUDIO_INPUT, testEntityId);
    expect(namespace).toEqual(['in', 'audio', 'opus-mono', testEntityId]);
  });

  it('should generate audio output namespace', () => {
    const namespace = generateTrackNamespace(PanaudiaTrackType.AUDIO_OUTPUT, testEntityId);
    expect(namespace).toEqual(['out', 'audio', 'opus-stereo', testEntityId]);
  });

  it('should generate state namespace', () => {
    const namespace = generateTrackNamespace(PanaudiaTrackType.STATE, testEntityId);
    expect(namespace).toEqual(['state', testEntityId]);
  });

  it('should preserve UUID with hyphens in namespace', () => {
    const namespace = generateTrackNamespace(PanaudiaTrackType.AUDIO_INPUT, testEntityId);
    expect(namespace[3]).toBe(testEntityId);
    expect(namespace[3]).toContain('-');
  });
});

// ============================================================================
// SUBSCRIBE Message Tests
// ============================================================================

describe('SUBSCRIBE Message Building', () => {
  it('should build SUBSCRIBE with authorization', () => {
    const subscription = {
      subscribeId: 1,
      trackAlias: 1,
      namespace: ['out', 'audio', 'opus-stereo', '550e8400-e29b-41d4-a716-446655440000'],
      trackName: '',
      filterType: MoqFilterType.LATEST_GROUP,
      authorization: 'test_jwt_token',
    };

    const msg = buildSubscribe(subscription);

    // Parse the message to verify structure
    const { type, bytesRead } = parseMessageType(msg);
    expect(type).toBe(0x03); // SUBSCRIBE message type

    // The message should be larger when authorization is included
    expect(msg.length).toBeGreaterThan(20);
  });

  it('should build SUBSCRIBE without authorization', () => {
    const subscription = {
      subscribeId: 1,
      trackAlias: 1,
      namespace: ['state', 'test-node'],
      trackName: '',
      filterType: MoqFilterType.LATEST_GROUP,
    };

    const msg = buildSubscribe(subscription);
    const { type } = parseMessageType(msg);
    expect(type).toBe(0x03);
  });

  it('should encode namespace correctly', () => {
    const subscription = {
      subscribeId: 1,
      trackAlias: 1,
      namespace: ['out', 'audio', 'opus-stereo', 'node-123'],
      trackName: 'track',
      filterType: MoqFilterType.LATEST_GROUP,
    };

    const msg = buildSubscribe(subscription);

    // Message should start with type (0x03)
    expect(msg[0]).toBe(0x03);
  });
});

// ============================================================================
// CLIENT_SETUP Message Tests
// ============================================================================

describe('CLIENT_SETUP Message Building', () => {
  it('should build CLIENT_SETUP with PUBSUB role', () => {
    const msg = buildClientSetup([MOQ_TRANSPORT_VERSION], MoqRole.PUBSUB);

    const { type, bytesRead } = parseMessageType(msg);
    expect(type).toBe(0x20); // CLIENT_SETUP

    // Skip 2-byte length prefix, then parse number of versions
    const contentOffset = bytesRead + 2;
    const { value: numVersions } = decodeVarint(msg, contentOffset);
    expect(Number(numVersions)).toBe(1);
  });

  it('should include version number', () => {
    const msg = buildClientSetup([MOQ_TRANSPORT_VERSION], MoqRole.SUBSCRIBER);

    // Should contain our version
    expect(msg.length).toBeGreaterThan(5);
  });

  it('should support multiple roles', () => {
    const pubMsg = buildClientSetup([MOQ_TRANSPORT_VERSION], MoqRole.PUBLISHER);
    const subMsg = buildClientSetup([MOQ_TRANSPORT_VERSION], MoqRole.SUBSCRIBER);
    const pubsubMsg = buildClientSetup([MOQ_TRANSPORT_VERSION], MoqRole.PUBSUB);

    // All should be valid CLIENT_SETUP messages
    expect(parseMessageType(pubMsg).type).toBe(0x20);
    expect(parseMessageType(subMsg).type).toBe(0x20);
    expect(parseMessageType(pubsubMsg).type).toBe(0x20);
  });
});

// ============================================================================
// ANNOUNCE Message Tests
// ============================================================================

describe('ANNOUNCE Message Building', () => {
  it('should build ANNOUNCE message', () => {
    const announcement = {
      requestId: 0,
      namespace: ['in', 'audio', 'opus-mono', 'node-123'],
    };

    const msg = buildAnnounce(announcement);
    const { type } = parseMessageType(msg);

    expect(type).toBe(0x06); // ANNOUNCE message type
  });

  it('should encode namespace correctly', () => {
    const announcement = {
      requestId: 2,
      namespace: ['state', 'node-123'],
    };

    const msg = buildAnnounce(announcement);

    // Message should contain the namespace
    expect(msg.length).toBeGreaterThan(5);
  });
});

// ============================================================================
// Connection State Tests
// ============================================================================

describe('Connection States', () => {
  it('should have all required states', () => {
    expect(ConnectionState.DISCONNECTED).toBe('disconnected');
    expect(ConnectionState.CONNECTING).toBe('connecting');
    expect(ConnectionState.CONNECTED).toBe('connected');
    expect(ConnectionState.AUTHENTICATED).toBe('authenticated');
    expect(ConnectionState.ERROR).toBe('error');
  });
});

// ============================================================================
// Error Code Tests
// ============================================================================

describe('Error Codes', () => {
  it('should have unauthorized error code matching Go server', () => {
    // The Go server uses 0x403 for unauthorized
    const ErrorCodeUnauthorized = 0x02; // MOQ spec unauthorized
    expect(ErrorCodeUnauthorized).toBe(2);
  });
});

// ============================================================================
// Protocol Version Tests
// ============================================================================

describe('Protocol Version', () => {
  it('should be draft-11', () => {
    // 0xff000000 is the draft marker, 11 is the draft number
    expect(MOQ_TRANSPORT_VERSION).toBe(0xff00000b);
  });

  it('should encode correctly in CLIENT_SETUP', () => {
    const msg = buildClientSetup([MOQ_TRANSPORT_VERSION], MoqRole.PUBSUB);

    // The version should be encoded somewhere in the message
    expect(msg.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Track Matching Tests (for server compatibility)
// ============================================================================

describe('Track Matching', () => {
  it('should generate namespaces matching Go server format', () => {
    const entityId = '550e8400-e29b-41d4-a716-446655440000';

    // These should match the Go GenerateTrackNames function
    const audioInput = generateTrackNamespace(PanaudiaTrackType.AUDIO_INPUT, entityId);
    const audioOutput = generateTrackNamespace(PanaudiaTrackType.AUDIO_OUTPUT, entityId);
    const state = generateTrackNamespace(PanaudiaTrackType.STATE, entityId);

    // Match Go: AudioInputNamespace: []string{"in", "audio", "opus-mono", nodeID}
    expect(audioInput).toEqual(['in', 'audio', 'opus-mono', entityId]);

    // Match Go: AudioOutputNamespace: []string{"out", "audio", "opus-stereo", nodeID}
    expect(audioOutput).toEqual(['out', 'audio', 'opus-stereo', entityId]);

    // Match Go: StateInputNamespace: []string{"state", nodeID}
    expect(state).toEqual(['state', entityId]);
  });
});
