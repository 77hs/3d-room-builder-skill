import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { digest, readScene, materialize } from './workspace.mjs';

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };
export async function serve({ dir, staticDir, port = 5173 }) {
  if (dir) await materialize(dir, await readScene(dir));
  const server = http.createServer(async (req, res) => {
    const send = (code, body, type = 'text/plain') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(req.method === 'HEAD' ? undefined : body); };
    try {
      if (!['GET', 'HEAD'].includes(req.method)) return send(405, 'GET/HEAD only');
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/favicon.ico') return send(204, '');
      let root, name;
      if (dir) {
        const scene = await readScene(dir), hash = digest(scene);
        if (url.pathname === '/__current') return send(200, JSON.stringify({ hash, revision: scene.revision }), 'application/json');
        if (url.pathname === '/') { res.writeHead(302, { Location: `/v/${hash}/?live=1`, 'Cache-Control': 'no-store' }); return res.end(); }
        const match = /^\/v\/([a-f0-9]{64})\/(.*)$/.exec(url.pathname);
        if (!match) return send(404, 'Not found');
        root = path.join(dir, '.room-builder/builds', match[1]); name = decodeURIComponent(match[2]) || 'index.html';
      } else { root = staticDir; name = decodeURIComponent(url.pathname.slice(1)) || 'index.html'; }
      const file = path.resolve(root, name), base = await fs.realpath(root);
      const real = await fs.realpath(file);
      if (!real.startsWith(base + path.sep) || (await fs.lstat(file)).isSymbolicLink() || !(await fs.stat(real)).isFile()) return send(404, 'Not found');
      return send(200, await fs.readFile(real), mime[path.extname(real)] || 'application/octet-stream');
    } catch { send(404, 'Not found or no valid committed scene'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}
