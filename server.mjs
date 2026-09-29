// Serveur local de développement : sert l'app + /api/push (lit .env.local).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const envFile = join(root, '.env.local');
if (existsSync(envFile)) {
  for (const l of readFileSync(envFile, 'utf8').split('\n')) {
    const m = l.match(/^(\w+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const { default: handler } = await import('./api/push.js');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml',
};
const PORT = Number(process.env.PORT) || 5173;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/push') {
    let raw = '';
    for await (const c of req) raw += c;
    try { req.body = raw ? JSON.parse(raw) : undefined; } catch { req.body = raw; }
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    return handler(req, res);
  }
  const p = normalize(join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  if (!p.startsWith(root)) { res.statusCode = 403; return res.end(); }
  try {
    const data = await readFile(p);
    res.setHeader('content-type', TYPES[extname(p)] || 'application/octet-stream');
    res.setHeader('cache-control', 'no-cache');
    res.end(data);
  } catch { res.statusCode = 404; res.end('404'); }
}).listen(PORT, () => console.log(`Notif Sim → http://localhost:${PORT}`));
