import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveServer } from '../src/gateway.js';

// Mock isWebTransportSupported
vi.mock('../src/moq/connection.js', () => ({
  isWebTransportSupported: vi.fn(() => true),
}));

import { isWebTransportSupported } from '../src/moq/connection.js';

const mockFetch = vi.fn();

describe('resolveServer', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should resolve MOQ server URL and transport', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', url: 'quic://server.panaudia.com/moq' }),
    });

    const server = await resolveServer('test-ticket', { transport: 'moq' });
    expect(server).toEqual({
      serverUrl: 'quic://server.panaudia.com/moq',
      transport: 'moq',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://panaudia.com/gateway?ticket=test-ticket&protocol=moq',
    );
  });

  it('should resolve WebRTC server URL and transport', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', url: 'wss://server.panaudia.com/join' }),
    });

    const server = await resolveServer('test-ticket', { transport: 'webrtc' });
    expect(server).toEqual({
      serverUrl: 'wss://server.panaudia.com/join',
      transport: 'webrtc',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://panaudia.com/gateway?ticket=test-ticket&protocol=webrtc',
    );
  });

  it('should pick MOQ when WebTransport is supported and transport is auto', async () => {
    vi.mocked(isWebTransportSupported).mockReturnValue(true);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', url: 'quic://server.panaudia.com/moq' }),
    });

    const server = await resolveServer('test-ticket');
    expect(server.transport).toBe('moq');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('protocol=moq'),
    );
  });

  it('should pick WebRTC when WebTransport is not supported and transport is auto', async () => {
    vi.mocked(isWebTransportSupported).mockReturnValue(false);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', url: 'wss://server.panaudia.com/join' }),
    });

    const server = await resolveServer('test-ticket');
    expect(server.transport).toBe('webrtc');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('protocol=webrtc'),
    );
  });

  it('should use custom gateway URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', url: 'quic://dev.panaudia.com:4433/moq' }),
    });

    await resolveServer('test-ticket', {
      gatewayUrl: 'https://dev.panaudia.com/gateway',
      transport: 'moq',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://dev.panaudia.com/gateway?ticket=test-ticket&protocol=moq',
    );
  });

  it('should throw on 401 response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(resolveServer('bad-ticket', { transport: 'moq' }))
      .rejects.toThrow('invalid or expired ticket');
  });

  it('should throw on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(resolveServer('test-ticket', { transport: 'moq' }))
      .rejects.toThrow('Gateway request failed: Network error');
  });

  it('should throw on malformed JSON response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new Error('bad json'); },
    });

    await expect(resolveServer('test-ticket', { transport: 'moq' }))
      .rejects.toThrow('Gateway returned invalid JSON');
  });

  it('should throw on fail status', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'fail', message: 'Provide a valid ticket.' }),
    });

    await expect(resolveServer('test-ticket', { transport: 'moq' }))
      .rejects.toThrow('Provide a valid ticket.');
  });

  it('should URL-encode the ticket', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', url: 'quic://server.panaudia.com/moq' }),
    });

    await resolveServer('ticket with spaces&special=chars', { transport: 'moq' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('ticket=ticket%20with%20spaces%26special%3Dchars'),
    );
  });
});
