import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT, importPKCS8 } from 'jose';
import { v4 as uuidv4 } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV_KEYS_DIR = resolve(__dirname, '../../../../../clients/dev/keys');
const STATUS_FILE = resolve(__dirname, 'stub-status.json');

export const SERVER_URL = 'https://dev.panaudia.com:4433/moq';
export const STUB_PORT = 4433;

/** Generate a signed JWT for testing */
export async function createTestJwt(options?: {
  entityId?: string;
  name?: string;
  expiresIn?: string;
}): Promise<{ jwt: string; entityId: string }> {
  const privateKeyPem = readFileSync(resolve(DEV_KEYS_DIR, 'panaudia_key'), 'utf-8');
  const privateKey = await importPKCS8(privateKeyPem, 'EdDSA');

  const entityId = options?.entityId ?? uuidv4();
  const name = options?.name ?? 'test-user';

  const jwt = await new SignJWT({
    panaudia: {
      name,
      uuid: entityId,
      attenuation: 2.0,
      gain: 1.0,
      priority: false,
      attrs: {},
    },
    preferred_username: name,
  })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setJti(entityId)
    .setIssuedAt()
    .setExpirationTime(options?.expiresIn ?? '1h')
    .sign(privateKey);

  return { jwt, entityId };
}

/** Read the Go stub's status file */
export function readStubStatus(): StubStatus | null {
  if (!existsSync(STATUS_FILE)) return null;
  try {
    const data = readFileSync(STATUS_FILE, 'utf-8');
    return JSON.parse(data) as StubStatus;
  } catch {
    return null;
  }
}

/** Poll the status file until a condition is met */
export async function waitForStatus(
  predicate: (status: StubStatus) => boolean,
  timeoutMs = 10_000,
  pollMs = 200,
): Promise<StubStatus> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = readStubStatus();
    if (status && predicate(status)) return status;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  const lastStatus = readStubStatus();
  throw new Error(
    `Timed out waiting for status condition after ${timeoutMs}ms. ` +
    `Last status: ${JSON.stringify(lastStatus, null, 2)}`
  );
}

// Types matching the Go stub's JSON output
export interface StubStatus {
  ready: boolean;
  port: number;
  connections: Record<string, EntityStatus>;
  errors: string[];
}

export interface EntityStatus {
  entityId: string;
  name: string;
  connected: boolean;
  connectedAt: string;
  disconnectedAt?: string;
  audioFrames: number;
  position: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number; roll: number };
  controls: ControlEvent[];
}

export interface ControlEvent {
  type: string;
  entityId: string;
  message: unknown;
}
