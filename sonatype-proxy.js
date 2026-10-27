// sonatype-proxy.js - proxy lokal agar halaman HTML bisa memanggil Sonatype Guide (CORS).
// Jalankan: node sonatype-proxy.js      (port 8787, hanya 127.0.0.1; ganti dengan PORT=9000)
// Proxy tidak menyimpan token: header Authorization dari halaman diteruskan apa adanya ke Sonatype.
const http = require('http');
const https = require('https');

const PORT = parseInt(process.env.PORT || '8787', 10);
const UPSTREAM = { host: 'api.guide.sonatype.com', path: '/api/v3/component-report' };

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Max-Age', '600');
}

http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true}');
  }
  if (req.method !== 'POST' || req.url !== '/component-report') { res.writeHead(404); return res.end('not found'); }

  const chunks = [];
  let size = 0;
  req.on('data', c => { size += c.length; if (size > 5e6) { req.destroy(); return; } chunks.push(c); });
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const up = https.request({
      host: UPSTREAM.host, path: UPSTREAM.path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length, Authorization: req.headers.authorization || '' }
    }, r => {
      res.writeHead(r.statusCode, { 'Content-Type': r.headers['content-type'] || 'application/json' });
      r.pipe(res);
    });
    up.on('error', e => { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); });
    up.end(body);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log('Sonatype proxy aktif: http://127.0.0.1:' + PORT + '  (Ctrl+C untuk berhenti)');
});
