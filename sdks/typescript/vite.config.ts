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
    sourcemap: true,
    minify: false,
  },
  server: {
    https: true,
  },
});
