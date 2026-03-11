import { spawn, type ChildProcess } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, existsSync, unlinkSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPATIAL_MIXER_DIR = resolve(__dirname, '../../../../../spatial-mixer');
const STUB_BINARY = resolve(SPATIAL_MIXER_DIR, 'moq_test_stub/moq_test_stub');
const STATUS_FILE = resolve(__dirname, 'stub-status.json');
const PID_FILE = resolve(__dirname, 'stub.pid');
const PORT = 4433;

export default async function globalSetup() {
  if (existsSync(STATUS_FILE)) unlinkSync(STATUS_FILE);

  if (!existsSync(STUB_BINARY)) {
    throw new Error(
      `Test stub binary not found at ${STUB_BINARY}. ` +
      `Build it: cd spatial-mixer && go build -tags=accelerate -o moq_test_stub/moq_test_stub ./moq_test_stub/`
    );
  }

  const proc = spawn(STUB_BINARY, [
    '--port', String(PORT),
    '--status-file', STATUS_FILE,
    '--tls-crt', resolve(SPATIAL_MIXER_DIR, 'keys/server.crt'),
    '--tls-key', resolve(SPATIAL_MIXER_DIR, 'keys/server.key'),
    '--ticket-key', resolve(SPATIAL_MIXER_DIR, 'keys/panaudia_key.pub'),
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  writeFileSync(PID_FILE, String(proc.pid));

  await waitForReady(proc, 10_000);
  console.log(`[global-setup] MOQ test stub running on port ${PORT} (pid ${proc.pid})`);
}

function waitForReady(proc: ChildProcess, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Test stub did not become ready within timeout'));
    }, timeoutMs);

    let stderr = '';

    proc.stdout!.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.includes('READY')) {
        clearTimeout(timer);
        resolve();
      }
    });

    proc.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Test stub exited with code ${code}. stderr: ${stderr}`));
    });
  });
}
