import { TransportType } from './panaudia-client.js';
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
export declare function resolveServer(ticket: string, options?: ResolveServerOptions): Promise<ResolvedServer>;
//# sourceMappingURL=gateway.d.ts.map