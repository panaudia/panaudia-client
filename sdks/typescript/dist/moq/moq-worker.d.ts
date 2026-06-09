/**
 * moq-worker.ts — the MOQ worker entry (worker-transport-design.md §11 / §4).
 *
 * Owns, OFF THE MAIN THREAD: the WebTransport, MoqConnection, MoqSession (control
 * stream), the datagram read loop, and Opus decode. The main thread orchestrates
 * via the RPC/event protocol (moq-worker-protocol.ts) and never touches the
 * transport or the read loop — so main-thread jank can't stall audio.
 *
 * Datagram handling: the worker reads `datagrams.readable` DIRECTLY (not via
 * MoqConnection's dispatcher — that router lives on the main thread for the
 * subscribers). The audio track is decoded and written straight into the
 * SharedArrayBuffer ring (the worklet reads it); every other track is forwarded
 * to the main thread, where the DatagramRouter + subscribers handle it.
 *
 * Loaded via `?worker&inline` (packaging proven in Phase 0): a self-contained
 * bundled module worker — it `import`s the full stack, no `.toString()` fragility.
 */
export {};
//# sourceMappingURL=moq-worker.d.ts.map