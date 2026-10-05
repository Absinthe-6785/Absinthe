// Loopback convenience only; real iPhone uses the separate HTTPS deployment.
import http from 'node:http';
import path from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.sha256': 'text/plain; charset=utf-8' };
export async function serverFor(output) {
  const root = await realpath(output);
  // Never serve the app, source tree or arbitrary user-selected directory.
  if (!/[\\/]qualification[\\/]rel05g-patha[\\/]dist[\\/][a-f0-9]{40}$/.test(root)) {
    throw new Error('NOT_A_FIXTURE_BUILD_ROOT');
  }
  return http.createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      if (!['127.0.0.1:4189', 'localhost:4189'].includes(request.headers.host)) throw new Error('BAD_HOST');
      const url = new URL(request.url, 'http://127.0.0.1:4189');
      const requested = decodeURIComponent(url.pathname);
      if (requested.includes('\\') || requested.includes('\0')) throw new Error('BAD_PATH');
      let name = requested.endsWith('/') ? `${requested}index.html` : requested;
      const candidate = path.resolve(root, `.${name}`);
      if (!candidate.startsWith(root + path.sep)) throw new Error('OUTSIDE_ROOT');
      const actual = await realpath(candidate);
      if (!actual.startsWith(root + path.sep)) throw new Error('OUTSIDE_ROOT');
      const type = types[path.extname(actual)]; if (!type) throw new Error('NOT_STATIC_ASSET');
      const bytes = await readFile(actual);
      response.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache', 'Referrer-Policy': 'no-referrer' });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch { response.writeHead(404); response.end('Fixture asset not found'); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('PASS_EXACT_BUILD_OUTPUT_DIRECTORY');
  const server = await serverFor(path.resolve(process.argv[2]));
  server.listen(4189, '127.0.0.1', () => console.log('Fixture only: http://127.0.0.1:4189 (NOT physical iPhone delivery)'));
}
