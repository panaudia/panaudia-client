import { defineConfig } from '@playwright/test';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './test/integration',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    browserName: 'chromium',
    launchOptions: {
      args: [
        '--ignore-certificate-errors',
        '--origin-to-force-quic-on=dev.panaudia.com:4433',
      ],
    },
    baseURL: 'http://localhost:5174',
  },
  globalSetup: resolve(__dirname, 'test/integration/global-setup.ts'),
  globalTeardown: resolve(__dirname, 'test/integration/global-teardown.ts'),
  webServer: {
    command: 'npx tsx test/integration/serve-test-page.ts',
    port: 5174,
    reuseExistingServer: false,
  },
});
