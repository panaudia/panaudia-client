
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

module.exports = defineConfig({

    build: {
        sourcemap: true,
        lib: {
            entry: resolve(__dirname, 'lib/panaudia-sdk.ts'),
            name: 'panaudia-sdk',
            formats: ['es'],
            fileName: (format) => `panaudia-sdk.js`,
        },
    },
    plugins: [dts()],
});
