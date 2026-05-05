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

export default defineConfig({
  server: {
    https: httpsOptions,
    port: 5173,
    host: true,
    allowedHosts: ['localhost', 'dev.panaudia.com'],
  },
  preview: {
    https: httpsOptions,
  },
  resolve: {
    preserveSymlinks: true,
  },
});
