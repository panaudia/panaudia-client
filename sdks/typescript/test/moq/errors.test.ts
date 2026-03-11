/**
 * Tests for custom error types
 */

import { describe, it, expect } from 'vitest';
import {
  MoqClientError,
  WebTransportNotSupportedError,
  ConnectionError,
  AuthenticationError,
  JwtParseError,
  ProtocolError,
  SubscriptionError,
  AnnouncementError,
  InvalidStateError,
  TimeoutError,
  getMoqErrorMessage,
  wrapError,
} from '../../src/moq/errors.js';

describe('MoqClientError', () => {
  it('should create error with message, code, and details', () => {
    const error = new MoqClientError('Test error', 'TEST_CODE', { foo: 'bar' });

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ foo: 'bar' });
    expect(error.name).toBe('MoqClientError');
  });

  it('should be instanceof Error', () => {
    const error = new MoqClientError('Test', 'CODE');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MoqClientError);
  });
});

describe('WebTransportNotSupportedError', () => {
  it('should have correct message and code', () => {
    const error = new WebTransportNotSupportedError();

    expect(error.message).toContain('WebTransport is not supported');
    expect(error.code).toBe('WEBTRANSPORT_NOT_SUPPORTED');
    expect(error.name).toBe('WebTransportNotSupportedError');
  });
});

describe('ConnectionError', () => {
  it('should create with message and details', () => {
    const error = new ConnectionError('Connection refused', { host: 'localhost' });

    expect(error.message).toBe('Connection refused');
    expect(error.code).toBe('CONNECTION_FAILED');
    expect(error.details).toEqual({ host: 'localhost' });
  });
});

describe('AuthenticationError', () => {
  it('should include MOQ error code', () => {
    const error = new AuthenticationError('Invalid token', 0x02);

    expect(error.message).toBe('Invalid token');
    expect(error.code).toBe('AUTHENTICATION_FAILED');
    expect(error.moqErrorCode).toBe(0x02);
  });

  it('should detect invalid token error', () => {
    const error1 = new AuthenticationError('Error', 0x02);
    const error2 = new AuthenticationError('Error', 0x403);
    const error3 = new AuthenticationError('Error', 0x01);

    expect(error1.isInvalidToken()).toBe(true);
    expect(error2.isInvalidToken()).toBe(true);
    expect(error3.isInvalidToken()).toBe(false);
  });

  it('should detect expired token error', () => {
    const error1 = new AuthenticationError('Token expired', 0x02);
    const error2 = new AuthenticationError('Invalid token', 0x02);

    expect(error1.isExpiredToken()).toBe(true);
    expect(error2.isExpiredToken()).toBe(false);
  });
});

describe('JwtParseError', () => {
  it('should create with message', () => {
    const error = new JwtParseError('Invalid JWT format');

    expect(error.message).toBe('Invalid JWT format');
    expect(error.code).toBe('JWT_PARSE_FAILED');
  });
});

describe('ProtocolError', () => {
  it('should include MOQ error code', () => {
    const error = new ProtocolError('Unexpected message type', 0x41);

    expect(error.message).toBe('Unexpected message type');
    expect(error.code).toBe('PROTOCOL_ERROR');
    expect(error.moqErrorCode).toBe(0x41);
  });
});

describe('SubscriptionError', () => {
  it('should include track namespace', () => {
    const namespace = ['out', 'audio', 'opus-stereo', 'node-123'];
    const error = new SubscriptionError('Track not found', 0x01, namespace);

    expect(error.trackNamespace).toEqual(namespace);
    expect(error.moqErrorCode).toBe(0x01);
    expect(error.code).toBe('SUBSCRIPTION_FAILED');
  });
});

describe('AnnouncementError', () => {
  it('should include namespace', () => {
    const namespace = ['in', 'audio', 'opus-mono', 'node-123'];
    const error = new AnnouncementError('Already announced', 0x04, namespace);

    expect(error.namespace).toEqual(namespace);
    expect(error.moqErrorCode).toBe(0x04);
    expect(error.code).toBe('ANNOUNCEMENT_FAILED');
  });
});

describe('InvalidStateError', () => {
  it('should include expected and actual state', () => {
    const error = new InvalidStateError('disconnected', 'connected');

    expect(error.message).toContain('expected disconnected');
    expect(error.message).toContain('was connected');
    expect(error.code).toBe('INVALID_STATE');
    expect(error.details).toEqual({
      expectedState: 'disconnected',
      actualState: 'connected',
    });
  });
});

describe('TimeoutError', () => {
  it('should include operation and timeout', () => {
    const error = new TimeoutError('connect', 5000);

    expect(error.message).toContain('connect');
    expect(error.message).toContain('5000ms');
    expect(error.code).toBe('TIMEOUT');
    expect(error.details).toEqual({
      operation: 'connect',
      timeoutMs: 5000,
    });
  });
});

describe('getMoqErrorMessage', () => {
  it('should return human-readable messages for known codes', () => {
    expect(getMoqErrorMessage(0x00)).toBe('No error');
    expect(getMoqErrorMessage(0x01)).toBe('Internal error');
    expect(getMoqErrorMessage(0x02)).toBe('Unauthorized');
    expect(getMoqErrorMessage(0x03)).toBe('Protocol violation');
    expect(getMoqErrorMessage(0x04)).toBe('Duplicate track alias');
    expect(getMoqErrorMessage(0x05)).toBe('Parameter length mismatch');
    expect(getMoqErrorMessage(0x06)).toBe('Too many subscribes');
    expect(getMoqErrorMessage(0x10)).toBe('GOAWAY timeout');
    expect(getMoqErrorMessage(0x403)).toBe('Invalid token (custom)');
  });

  it('should return hex code for unknown errors', () => {
    expect(getMoqErrorMessage(0xff)).toBe('Unknown error (0xff)');
    expect(getMoqErrorMessage(0x1234)).toBe('Unknown error (0x1234)');
  });
});

describe('wrapError', () => {
  it('should return MoqClientError unchanged', () => {
    const original = new MoqClientError('Test', 'CODE');
    const wrapped = wrapError(original);

    expect(wrapped).toBe(original);
  });

  it('should wrap Error into MoqClientError', () => {
    const original = new Error('Something went wrong');
    const wrapped = wrapError(original);

    expect(wrapped).toBeInstanceOf(MoqClientError);
    expect(wrapped.message).toBe('Something went wrong');
    expect(wrapped.code).toBe('UNKNOWN');
  });

  it('should wrap non-Error values', () => {
    const wrapped = wrapError('string error');

    expect(wrapped).toBeInstanceOf(MoqClientError);
    expect(wrapped.message).toBe('string error');
  });

  it('should use custom default code', () => {
    const wrapped = wrapError(new Error('test'), 'CUSTOM_CODE');

    expect(wrapped.code).toBe('CUSTOM_CODE');
  });
});
