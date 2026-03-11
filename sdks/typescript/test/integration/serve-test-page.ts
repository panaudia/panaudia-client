import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const PORT = parseInt(process.env.TEST_PAGE_PORT ?? '5174', 10);

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  let filePath: string;

  if (url.pathname === '/' || url.pathname === '/index.html') {
    filePath = resolve(__dirname, 'test-page.html');
  } else {
    filePath = resolve(ROOT, url.pathname.slice(1));
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] ?? 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': mime,
    'Access-Control-Allow-Origin': '*',
  });
  res.end(readFileSync(filePath));
});

server.listen(PORT, () => {
  console.log(`Test page server listening on http://localhost:${PORT}`);
});
