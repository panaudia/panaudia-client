/**
 * datagram-router.ts — the main-thread datagram dispatch: a trackAlias→handler
 * map plus the SUBSCRIBE_OK/first-datagram pre-handler race buffer.
 *
 * Extracted verbatim from `MoqConnection` (Phase 1 of worker-transport-plan.md) so
 * the *routing* is independent of the *transport*. Today `MoqConnection` composes
 * it and feeds it from its own read loop; once the transport moves into the worker
 * (Phase 2), this same router runs on the main thread fed by datagrams the worker
 * forwards — the subscribers register on it exactly as they register on the
 * connection today, so their code is unchanged.
 *
 * The race it guards: the server writes SUBSCRIBE_OK on the bidi control stream
 * and then immediately SendDatagram's backfilled objects on the unreliable QUIC
 * datagram channel; a datagram for a freshly-assigned trackAlias can arrive before
 * `await session.subscribe()` resolves and the handler is registered. Such
 * datagrams are buffered in arrival order and drained when the handler registers.
 */
/** Handler for datagrams dispatched by track alias. */
export type DatagramHandler = (payload: Uint8Array, trackAlias: number, groupId: bigint, objectId: bigint) => void;
/** A parsed OBJECT_DATAGRAM, reduced to what routing needs (publisher priority is irrelevant here). */
export interface ParsedDatagram {
    trackAlias: number;
    payload: Uint8Array;
    groupId: bigint;
    objectId: bigint;
}
/**
 * The minimal receive surface a subscriber needs — register/unregister a handler
 * by track alias. Satisfied by both `MoqConnection` (main-thread transport) and
 * `DatagramRouter` (the main-side router fed by the worker's forwarded datagrams),
 * so subscribers work either way without knowing which.
 */
export interface DatagramReceiver {
    registerDatagramHandler(trackAlias: number, handler: DatagramHandler): void;
    unregisterDatagramHandler(trackAlias: number): void;
}
export declare class DatagramRouter {
    private handlers;
    private pending;
    private pendingBytes;
    /**
     * Register a handler for a track alias and drain any datagrams that arrived for
     * it before registration (the SUBSCRIBE_OK race), in arrival order.
     */
    register(trackAlias: number, handler: DatagramHandler): void;
    /** Unregister a handler and discard any still-buffered datagrams for its alias. */
    unregister(trackAlias: number): void;
    /** Route a parsed datagram to its handler, or buffer it if none is registered yet. */
    ingest(d: ParsedDatagram): void;
    registerDatagramHandler(trackAlias: number, handler: DatagramHandler): void;
    unregisterDatagramHandler(trackAlias: number): void;
    /** Number of buffered pre-handler datagrams (tests/diagnostics). */
    pendingCount(): number;
    /** Drop all handlers + buffered datagrams (connection close). */
    clear(): void;
    private drainForAlias;
    private discardForAlias;
    private bufferUnknown;
}
//# sourceMappingURL=datagram-router.d.ts.map