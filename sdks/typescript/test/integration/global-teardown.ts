import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, unlinkSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID_FILE = resolve(__dirname, 'stub.pid');
const STATUS_FILE = resolve(__dirname, 'stub-status.json');

export default async function globalTeardown() {
  if (existsSync(PID_FILE)) {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`[global-teardown] Sent SIGTERM to stub (pid ${pid})`);
    } catch {
      // Process may have already exited
    }
    unlinkSync(PID_FILE);
  }

  if (existsSync(STATUS_FILE)) {
    unlinkSync(STATUS_FILE);
  }
}
