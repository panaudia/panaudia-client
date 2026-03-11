/**
 * Gateway resolution — resolve a Panaudia server URL from a ticket.
 *
 * Calls the Panaudia gateway API to determine which server to connect to,
 * based on the ticket (JWT) and desired protocol.
 */
export interface ResolveServerOptions {
    /** Transport protocol. Default: 'auto' (picks MOQ if WebTransport supported, else WebRTC) */
    protocol?: 'moq' | 'webrtc' | 'auto';
    /** Gateway URL. Default: 'https://panaudia.com/gateway' */
    gatewayUrl?: string;
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
export declare function resolveServer(ticket: string, options?: ResolveServerOptions): Promise<string>;
//# sourceMappingURL=gateway.d.ts.map