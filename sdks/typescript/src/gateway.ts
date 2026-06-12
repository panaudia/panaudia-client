/**
 * Gateway resolution — resolve a Panaudia server URL from a ticket.
 *
 * Calls the Panaudia gateway API to determine which server to connect to,
 * based on the ticket (JWT) and desired transport.
 */

import { isWebTransportSupported } from './moq/connection.js';
import type { TransportType } from './panaudia-client.js';

const DEFAULT_GATEWAY_URL = 'https://panaudia.com/gateway';

export interface ResolveServerOptions {
  /** Transport to use. Default: 'auto' (picks MOQ if WebTransport supported, else WebRTC) */
  transport?: TransportType | 'auto';
  /** Gateway URL. Default: 'https://panaudia.com/gateway' */
  gatewayUrl?: string;
}

export interface ResolvedServer {
  /** Server URL to pass to PanaudiaClient. */
  serverUrl: string;
  /** The concrete transport the URL was resolved for ('auto' resolved here). */
  transport: TransportType;
}

interface GatewayResponse {
  status: string;
  url?: string;
  message?: string;
}

/**
 * Resolve the server URL and transport to connect with.
 *
 * Calls the Panaudia gateway with the given ticket and transport, and
 * returns the server URL plus the concrete transport it was resolved
 * for. This is the single point of transport selection — pass both
 * values to PanaudiaClient so the client uses the transport the URL
 * was resolved for.
 *
 * @example
 * ```typescript
 * // Production — auto-detect transport
 * const server = await resolveServer(ticket);
 * const client = new PanaudiaClient({ ...server, ticket });
 *
 * // Force WebRTC
 * const server = await resolveServer(ticket, { transport: 'webrtc' });
 *
 * // Custom gateway (dev)
 * const server = await resolveServer(ticket, {
 *   gatewayUrl: 'https://dev.panaudia.com/gateway',
 * });
 * ```
 */
export async function resolveServer(
  ticket: string,
  options?: ResolveServerOptions,
): Promise<ResolvedServer> {
  const gatewayUrl = options?.gatewayUrl ?? DEFAULT_GATEWAY_URL;

  let transport = options?.transport ?? 'auto';
  if (transport === 'auto') {
    transport = isWebTransportSupported() ? 'moq' : 'webrtc';
  }

  // The gateway's HTTP API names this query param "protocol".
  const url = `${gatewayUrl}?ticket=${encodeURIComponent(ticket)}&protocol=${encodeURIComponent(transport)}`;

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

  return { serverUrl: body.url, transport };
}
