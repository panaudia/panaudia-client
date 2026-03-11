import { test, expect } from '@playwright/test';
import { createTestJwt, waitForStatus, readStubStatus, SERVER_URL } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Wait for the test page to load and expose the client
  await page.waitForFunction(() => (window as any).__ready === true, null, { timeout: 5_000 });
});

test('client connects to stub server and stub records it', async ({ page }) => {
  const { jwt, entityId } = await createTestJwt({ name: 'connect-test' });

  // Connect using PanaudiaMoqClient in the browser
  const connected = await page.evaluate(async ({ serverUrl, ticket }) => {
    const client = new (window as any).PanaudiaMoqClient({
      serverUrl,
      ticket,
    });

    try {
      await client.connect();
      // Give it a moment to complete the MOQ handshake
      await new Promise(r => setTimeout(r, 1000));
      const state = client.getState();
      return { success: true, state };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, { serverUrl: SERVER_URL, ticket: jwt });

  expect(connected.success).toBe(true);

  // Verify server-side: stub should have recorded the connection
  const status = await waitForStatus(
    (s) => s.connections[entityId]?.connected === true,
    5_000,
  );

  expect(status.connections[entityId]).toBeDefined();
  expect(status.connections[entityId].name).toBe('connect-test');
  expect(status.connections[entityId].connected).toBe(true);
});

test('client disconnects cleanly', async ({ page }) => {
  const { jwt, entityId } = await createTestJwt({ name: 'disconnect-test' });

  await page.evaluate(async ({ serverUrl, ticket }) => {
    const client = new (window as any).PanaudiaMoqClient({
      serverUrl,
      ticket,
    });
    await client.connect();
    await new Promise(r => setTimeout(r, 1000));
    await client.disconnect();
  }, { serverUrl: SERVER_URL, ticket: jwt });

  // Verify server-side: connection should be marked disconnected
  const status = await waitForStatus(
    (s) => s.connections[entityId]?.connected === false,
    5_000,
  );

  expect(status.connections[entityId].connected).toBe(false);
  expect(status.connections[entityId].disconnectedAt).toBeDefined();
});

test('position updates reach the server', async ({ page }) => {
  const { jwt, entityId } = await createTestJwt({ name: 'position-test' });

  await page.evaluate(async ({ serverUrl, ticket }) => {
    const client = new (window as any).PanaudiaMoqClient({
      serverUrl,
      ticket,
    });
    await client.connect();
    await new Promise(r => setTimeout(r, 1000));

    // Update position
    client.setPoseAmbisonic(0.25, 0.75, 0.5, 0, 0, 0);
    await client.publishState();

    // Give the server time to receive
    await new Promise(r => setTimeout(r, 500));
  }, { serverUrl: SERVER_URL, ticket: jwt });

  // Verify server recorded the position update
  const status = await waitForStatus(
    (s) => {
      const conn = s.connections[entityId];
      return conn != null && conn.position.x !== 0.5; // moved from default
    },
    5_000,
  );

  const pos = status.connections[entityId].position;
  expect(pos.x).toBeCloseTo(0.25, 1);
  expect(pos.y).toBeCloseTo(0.75, 1);
});

test('invalid JWT is rejected', async ({ page }) => {
  const result = await page.evaluate(async ({ serverUrl }) => {
    try {
      const client = new (window as any).PanaudiaMoqClient({
        serverUrl,
        ticket: 'invalid.jwt.token',
      });
      await client.connect();
      await new Promise(r => setTimeout(r, 2000));
      return { rejected: false };
    } catch (err: any) {
      return { rejected: true, error: err.message };
    }
  }, { serverUrl: SERVER_URL });

  // Client should reject — either at construction (JWT parse) or connection (auth failure)
  expect(result.rejected).toBe(true);
});
