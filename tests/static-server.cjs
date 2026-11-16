const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Früher lag die App in dist/, heute direkt im Wurzelordner.
const root = fs.existsSync(path.resolve(__dirname, '..', 'dist', 'index.html')) ? path.resolve(__dirname, '..', 'dist') : path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const port = Number(process.argv[2] || 4173);
http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/preview-v6(?=\/)/, '');
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(target, (error, body) => {
    if (error) { response.writeHead(404).end('Not found'); return; }
    response.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  });
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
