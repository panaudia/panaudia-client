/**
 * Gateway resolution — resolve a Panaudia server URL from a ticket.
 *
 * Calls the Panaudia gateway API to determine which server to connect to,
 * based on the ticket (JWT) and desired protocol.
 */

import { isWebTransportSupported } from './moq/connection.js';

const DEFAULT_GATEWAY_URL = 'https://panaudia.com/gateway';

export interface ResolveServerOptions {
  /** Transport protocol. Default: 'auto' (picks MOQ if WebTransport supported, else WebRTC) */
  protocol?: 'moq' | 'webrtc' | 'auto';
  /** Gateway URL. Default: 'https://panaudia.com/gateway' */
  gatewayUrl?: string;
}

interface GatewayResponse {
  status: string;
  url?: string;
  message?: string;
}

/**
 * Resolve the server URL to connect to.
 *
 * Calls the Panaudia gateway with the given ticket and protocol,
 * and returns the server URL to pass to PanaudiaClient.
 *
 * @example
 * ```typescript
 * // Production — auto-detect protocol
 * const serverUrl = await resolveServer(ticket);
 *
 * // Force WebRTC
 * const serverUrl = await resolveServer(ticket, { protocol: 'webrtc' });
 *
 * // Custom gateway (dev)
 * const serverUrl = await resolveServer(ticket, {
 *   gatewayUrl: 'https://dev.panaudia.com/gateway',
 * });
 * ```
 */
export async function resolveServer(
  ticket: string,
  options?: ResolveServerOptions,
): Promise<string> {
  const gatewayUrl = options?.gatewayUrl ?? DEFAULT_GATEWAY_URL;

  let protocol = options?.protocol ?? 'auto';
  if (protocol === 'auto') {
    protocol = isWebTransportSupported() ? 'moq' : 'webrtc';
  }

  const url = `${gatewayUrl}?ticket=${encodeURIComponent(ticket)}&protocol=${encodeURIComponent(protocol)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(
      `Gateway request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (response.status === 401) {
    throw new Error('Gateway authentication failed: invalid or expired ticket');
  }

  if (!response.ok) {
    throw new Error(`Gateway request failed with status ${response.status}`);
  }

  let body: GatewayResponse;
  try {
    body = (await response.json()) as GatewayResponse;
  } catch {
    throw new Error('Gateway returned invalid JSON');
  }

  if (body.status !== 'ok' || !body.url) {
    throw new Error(
      `Gateway resolution failed: ${body.message ?? 'unknown error'}`,
    );
  }

  return body.url;
}
