import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';
import { execFile } from 'node:child_process';

// A tiny local web server for previewing episode pages. Opening the HTML over file:// is
// blocked by the browser ("file: URLs are treated as unique security origins"), so the
// audio never loads. Serving over http://127.0.0.1 fixes that — same files, real origin.

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.wav': 'audio/wav',
};

export interface RunningServer {
  port: number;
  close: () => void;
}

function contentType(filePath: string): string {
  return MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

// Serve one file, honoring a Range request so audio can be sought/streamed (browsers send
// Range for <audio>; without 206 support seeking — and Safari playback — breaks).
function sendFile(filePath: string, range: string | undefined, res: import('node:http').ServerResponse): void {
  const size = statSync(filePath).size;
  const type = contentType(filePath);
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match) {
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : size - 1;
    if (start >= size || end >= size || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
    });
    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
  createReadStream(filePath).pipe(res);
}

// Start a static file server rooted at rootDir. Port 0 = let the OS pick a free port, so
// two runs never collide.
export function startServer(rootDir: string): Promise<RunningServer> {
  const root = normalize(rootDir);
  const server: Server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let filePath = normalize(join(root, urlPath));
    // Path-traversal guard: never serve anything outside the root.
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    sendFile(filePath, req.headers.range, res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ port, close: () => server.close() });
    });
  });
}

export function openUrl(url: string): void {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  execFile(opener, [url], () => {});
}
