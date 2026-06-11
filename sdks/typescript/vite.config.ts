import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    // es2022 keeps native class fields (no `__publicField` helper), which the
    // playout worklet relies on: it serializes JitterBufferCore via .toString()
    // and that must be self-contained. Safe — this lib already requires
    // WebCodecs/WebTransport/AudioWorklet, all newer than es2022.
    target: 'es2022',
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'moq/index': resolve(__dirname, 'src/moq/index.ts'),
        'webrtc/index': resolve(__dirname, 'src/webrtc/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        // Stable chunk names (no hashes) so importmaps can reference them
        chunkFileNames: '[name].js',
      },
    },
    // No source-maps: the `?worker&inline` blob worker bakes a relative
    // `//# sourceMappingURL=…` that resolves to `blob://null…` and Safari blocks it
    // (Vite drives the worker map from build.sourcemap, with no per-worker override).
    // minify is off, so the emitted bundle is fully readable without maps.
    sourcemap: false,
    minify: false,
  },
  // Bundled module workers (the receive/transport worker uses `?worker&inline`,
  // design §11.9 / worker-transport-design §8) must be emitted as ES — Vite's
  // default worker format is 'iife', incompatible with `type: 'module'`.
  worker: {
    format: 'es',
  },
  server: {
    https: true,
  },
});
