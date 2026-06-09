import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

const keysDir = process.env.PANAUDIA_DEV_KEYS_DIR
  ? path.resolve(process.env.PANAUDIA_DEV_KEYS_DIR)
  : path.resolve(__dirname, 'certs');

const httpsOptions = {
  key: fs.readFileSync(path.join(keysDir, 'server.key')),
  cert: fs.readFileSync(path.join(keysDir, 'server.crt')),
};

// Cross-origin isolation (COOP + COEP) makes `self.crossOriginIsolated === true`,
// which unlocks SharedArrayBuffer — required for the real-time-safe worker→worklet
// audio ring (design §11.3). Without these the client falls back to the
// postMessage PCM path (works, but couples audio delivery to main-thread jank).
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  server: {
    https: httpsOptions,
    port: 5173,
    host: true,
    allowedHosts: ['localhost', 'dev.panaudia.com'],
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    https: httpsOptions,
    headers: crossOriginIsolationHeaders,
  },
  resolve: {
    preserveSymlinks: true,
  },
  // @panaudia/client requires es2022+: the playout worklet serializes
  // JitterBufferCore via .toString() and that must keep NATIVE class fields.
  // Vite's default target ('modules' ≈ es2020) down-levels them to a
  // module-scope `__publicField` helper during dep pre-bundling, which is
  // undefined inside the worklet → it throws. Pin es2022 everywhere esbuild runs.
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  build: { target: 'es2022' },
});
