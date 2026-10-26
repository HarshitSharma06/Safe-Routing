/**
 * Simple static file server for SafeRoute AI
 * Uses ONLY Node.js built-in modules — no npm install needed.
 * Run: node server.js
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 5500;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.md':   'text/markdown',
};

const server = http.createServer((req, res) => {
  // Default to index.html
  // Strip query string / hash, decode %20 etc., default to index.html
  let urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);

  // Block path traversal (e.g. /../../etc/passwd)
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }
  const ext      = path.extname(filePath).toLowerCase();
  const mimeType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType + (mimeType.startsWith('text/') || mimeType.includes('javascript') ? '; charset=utf-8' : '') });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  SafeRoute AI server running!`);
  console.log(`  Open: http://localhost:${PORT}\n`);
});
