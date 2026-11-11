// Service worker: menyimpan aset aplikasi agar kunjungan berikutnya cepat walau internet lambat, dan tetap terbuka saat offline.
// - Aset ber-versi (js/css dengan ?v=APP_VERSION): cache-first. URL berubah tiap rilis, jadi versi lama tidak pernah terpakai.
// - Halaman utama: jaringan dulu; bila belum dijawab dalam NAV_TIMEOUT, pakai salinan tersimpan (salinan diperbarui di latar).
// - Selain itu (API, CDN, unduhan) tidak disentuh.
const CACHE = 'sca-assets-v1', NAV_TIMEOUT = 2500;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// buang versi lama dari file yang sama
async function prune(cache, url) {
  for (const k of await cache.keys()) { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) await cache.delete(k); }
}
async function asset(req, url) {
  const cache = await caches.open(CACHE), hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) { await cache.put(req, res.clone()); await prune(cache, url); }
  return res;
}
async function page(e, key) {
  const cache = await caches.open(CACHE), cached = await cache.match(key);
  const net = fetch(e.request).then(async res => { if (res.ok) await cache.put(key, res.clone()); return res; });
  if (!cached) return net;
  e.waitUntil(net.catch(() => null));
  return Promise.race([net.catch(() => cached), new Promise(done => setTimeout(() => done(cached), NAV_TIMEOUT))]);
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url), scope = new URL(self.registration.scope);
  if (req.method !== 'GET' || url.origin !== scope.origin) return;
  if (url.searchParams.has('v') && /\.(js|css)$/.test(url.pathname)) { e.respondWith(asset(req, url)); return; }
  // hanya halaman utama (…/ atau …/index.html di akar scope); ?tab= dan ?lang= memakai salinan yang sama
  if (req.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html')) e.respondWith(page(e, scope.href));
});
