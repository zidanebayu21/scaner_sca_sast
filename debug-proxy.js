// Proxy lokal untuk tab "API Debug": meneruskan request dengan header/cookie apa pun
// (yang diblokir browser) dan opsional mengabaikan sertifikat self-signed.
// Jalankan: node debug-proxy.js   (hanya mendengarkan 127.0.0.1:8788)
const http = require('http');
const https = require('https');

const PORT = 8788;
const MAX_BODY = 5 * 1024 * 1024;
const ALLOWED_ORIGINS = ['https://zidanebayu21.github.io', 'null'];

function allowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('Body terlalu besar')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function forward(p) {
  return new Promise((resolve, reject) => {
    const u = new URL(p.url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') { reject(new Error('Hanya http/https')); return; }
    const headers = {};
    (p.headers || []).forEach(([k, v]) => { headers[k] = v; });
    const t0 = Date.now();
    const lib = u.protocol === 'https:' ? https : http;
    const r = lib.request(u, { method: p.method || 'GET', headers, rejectUnauthorized: !p.insecure, timeout: 20000 }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const hdrs = [];
        for (let i = 0; i < res.rawHeaders.length; i += 2) hdrs.push([res.rawHeaders[i], res.rawHeaders[i + 1]]);
        resolve({ status: res.statusCode, statusText: res.statusMessage, headers: hdrs, body: buf.toString('utf8'), size: buf.length, ms: Date.now() - t0 });
      });
    });
    r.on('timeout', () => r.destroy(new Error('Timeout 20 detik')));
    r.on('error', reject);
    if (p.body && !['GET', 'HEAD'].includes(p.method)) r.write(p.body);
    r.end();
  });
}

http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigin(origin)) { res.writeHead(403).end(); return; }
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  if (req.url === '/ping') { res.writeHead(200).end('ok'); return; }
  if (req.method !== 'POST' || req.url !== '/send') { res.writeHead(404).end(); return; }
  let out;
  try { out = await forward(await readJson(req)); } catch (e) { out = { error: e.message }; }
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out));
}).listen(PORT, '127.0.0.1', () => console.log('debug-proxy aktif di http://127.0.0.1:' + PORT));
