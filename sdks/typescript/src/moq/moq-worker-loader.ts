/**
 * moq-worker-loader.ts — constructs the bundled (inlined) MOQ worker. Isolated in
 * its own module so the `?worker&inline` import (which pulls in the whole worker
 * bundle) doesn't get dragged into unit tests of the pure RPC client.
 */
import MoqWorker from './moq-worker?worker&inline';

/** Construct the bundled MOQ worker (self-contained inlined Blob; see design §11.9). */
export function createMoqWorker(): Worker {
  return new MoqWorker();
}
