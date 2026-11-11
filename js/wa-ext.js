// ============================================================
//  WA Hook Auto: ekstensi Chrome/Edge (Manifest V3) yang dibangun langsung dari kode aplikasi ini
//  (waHookMain + waClean/waMerge di hooks-ops.js dipakai ulang lewat toString, tidak ada salinan kode).
//  - wa.js     : berjalan otomatis di web.whatsapp.com, menangkap pesan yang tampil dan (opsional) membuka
//                chat satu per satu lalu menggulir riwayatnya, tanpa klik bookmark.
//  - bg.js     : service worker, arsip tetap di IndexedDB ekstensi (nama DB/store/skema sama dengan scanner: scaWaHook/msgs).
//  - bridge.js : berjalan di halaman scanner ini, mengalirkan arsip ke IndexedDB scanner supaya bisa dicari di tab WA Hook.
//  - popup     : status, mulai/berhenti, pengaturan.
//  Semua lokal: tidak ada permintaan jaringan dan tidak ada izin selain storage.
// ============================================================
const WA_EXT_DEF = { auto: true, everyH: 24, maxChats: 60, maxSteps: 250, horizonD: 120, skipUnread: true };

// Service worker: arsip pesan (skema sama dengan IndexedDB scanner) + jawaban untuk wa.js, bridge.js, popup
function waExtBg(app) {
  var DB = 'scaWaHook', ST = 'msgs', seq = 0;
  function open() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB, 2);
      r.onupgradeneeded = function () {
        var st = r.result.objectStoreNames.contains(ST) ? r.transaction.objectStore(ST) : r.result.createObjectStore(ST, { keyPath: 'id' });
        if (!st.indexNames.contains('upd')) st.createIndex('upd', 'upd');
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(mode, work) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(ST, mode), out;
        work(t.objectStore(ST), function (v) { out = v; });
        t.oncomplete = function () { db.close(); res(out); };
        t.onerror = function () { db.close(); rej(t.error); };
      });
    });
  }
  function count() { return tx('readonly', function (st, set) { var q = st.count(); q.onsuccess = function () { set(q.result); }; }); }
  // upd naik terus (dipakai bridge sebagai penanda "sudah disinkron sampai mana"); item tak berubah tidak ditulis ulang
  function put(list) {
    return tx('readwrite', function (st) {
      list.forEach(function (it) {
        var g = st.get(it.id);
        g.onsuccess = function () {
          var m = waMerge(g.result, it);
          if (g.result && JSON.stringify(m) === JSON.stringify(g.result)) return;
          seq = Math.max(Date.now(), seq + 1); m.upd = seq; st.put(m);
        };
      });
    });
  }
  function pull(since, max) {
    return tx('readonly', function (st, set) {
      var out = [], q = st.index('upd').openCursor(IDBKeyRange.lowerBound(since, true));
      q.onsuccess = function () { var c = q.result; if (c && out.length < max) { out.push(c.value); c.continue(); } else set(out); };
    }).then(function (items) { return { items: items, max: items.length ? items[items.length - 1].upd : since, more: items.length >= max }; });
  }
  chrome.runtime.onMessage.addListener(function (m, sender, send) {
    if (!m || typeof m !== 'object') return false;
    if (m.t === 'items' && /^https:\/\/web\.whatsapp\.com\//.test(sender.url || '')) {
      var list = (Array.isArray(m.items) ? m.items : []).slice(0, 5000).map(waClean).filter(Boolean);
      put(list).then(count).then(function (n) { send({ ok: true, total: n }); }, function (e) { send({ ok: false, err: String(e) }); });
      return true;
    }
    if (m.t === 'pull') { pull(+m.since || 0, Math.min(+m.max || 1500, 100000)).then(send, function () { send(null); }); return true; }
    if (m.t === 'stats') { count().then(function (n) { send({ total: n }); }, function () { send({ total: 0 }); }); return true; }
    if (m.t === 'open') { if (app) chrome.tabs.create({ url: app + '#wa-hook' }); return false; }
    return false;
  });
}

// Content script di web.whatsapp.com (setelah waHookMain): jadwal + "crawl" chat satu per satu
function waExtCrawl(DEF) {
  var S = window.__waHook, store = chrome.storage.local, cfg = Object.assign({}, DEF);
  var st = { run: false, chat: '', done: 0, skipped: 0, msg: '', last: 0, t: 0 }, stopReq = false, lastInput = Date.now(), lastPub = 0;
  ['mousemove', 'keydown', 'wheel', 'touchstart', 'pointerdown'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (e.isTrusted) lastInput = Date.now(); }, true);
  });
  function publish(force) {
    var n = Date.now();
    if (!force && n - lastPub < 1500) return;
    lastPub = n; st.t = n;
    try { store.set({ waStat: st }); } catch (e) { /* ekstensi dimuat ulang */ }
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function rand(a, b) { return a + Math.round(Math.random() * (b - a)); }
  // jeda selama pengguna sendiri sedang memakai WhatsApp (input asli, bukan klik buatan skrip)
  async function calm() { while (!stopReq && Date.now() - lastInput < 15000) await sleep(2000); }
  function rowsNow() {
    var side = document.getElementById('pane-side');
    if (!side) return [];
    var all = side.querySelectorAll('[role=listitem], [role=row]');
    if (!all.length) all = side.querySelectorAll('[data-testid=cell-frame-container]');
    return Array.prototype.filter.call(all, function (r) { return !r.querySelector('[role=listitem], [role=row]'); });
  }
  function rowTitle(r) {
    var t = r.querySelector('span[title]') || r.querySelector('span[dir=auto]');
    return t ? String(t.getAttribute('title') || t.textContent || '').trim() : '';
  }
  // membuka chat yang punya pesan belum dibaca akan mengirim tanda "dibaca" ke pengirim, jadi dilewati secara bawaan
  function isUnread(r) {
    var a = r.querySelectorAll('[aria-label]');
    for (var i = 0; i < a.length; i++) if (/unread|belum dibaca/i.test(a[i].getAttribute('aria-label') || '')) return true;
    return false;
  }
  function openChat(r) {
    var t = r.querySelector('span[title]') || r;
    ['mousedown', 'mouseup', 'click'].forEach(function (n) { t.dispatchEvent(new MouseEvent(n, { bubbles: true, cancelable: true, view: window })); });
  }
  function oldestTs(chat) {
    var m = Infinity;
    S.order.forEach(function (id) { var it = S.items[id]; if (it && it.chat === chat && it.ts && it.ts < m) m = it.ts; });
    return m;
  }
  // gulir riwayat chat yang sedang terbuka ke atas sampai batas waktu (cutoff), mentok atas, atau batas langkah
  async function sweep(chat, cutoff) {
    var top = 0;
    for (var i = 0; i < cfg.maxSteps && !stopReq; i++) {
      await calm();
      S.scan();
      var p = S.pane();
      if (!p || oldestTs(chat) < cutoff) return;
      var h = p.scrollHeight;
      p.scrollTop = Math.max(0, p.scrollTop - Math.max(280, Math.round(p.clientHeight * 0.75)));
      await sleep(rand(900, 1500));
      S.scan();
      if (p.scrollTop === 0 && p.scrollHeight === h) { if (++top >= 3) return; } else top = 0;
    }
  }
  function pickNext(seen) {
    var rs = rowsNow();
    for (var i = 0; i < rs.length; i++) {
      var k = rowTitle(rs[i]);
      if (!k || seen[k]) continue;
      seen[k] = 1;
      if (cfg.skipUnread && isUnread(rs[i])) { st.skipped++; continue; }
      return { row: rs[i], key: k };
    }
    return null;
  }
  function finish(msg, ok) {
    st.run = false; st.chat = ''; st.msg = msg;
    if (ok) { st.last = Date.now(); try { store.set({ waLast: st.last }); } catch (e) { /* abaikan */ } }
    publish(true);
  }
  async function run() {
    if (st.run) return;
    var side = document.getElementById('pane-side');
    if (!side) { st.msg = 'Buka WhatsApp Web sampai daftar chat tampil.'; publish(true); return; }
    st.run = true; stopReq = false; st.done = 0; st.skipped = 0; st.msg = ''; publish(true);
    try {
      var cutoff = st.last ? st.last - 2 * 86400000 : Date.now() - cfg.horizonD * 86400000;
      var seen = {}, idle = 0;
      side.scrollTop = 0; await sleep(900);
      while (!stopReq && st.done < cfg.maxChats) {
        await calm();
        var nx = pickNext(seen);
        if (!nx) {
          var y0 = side.scrollTop;
          side.scrollTop = y0 + Math.round(side.clientHeight * 0.8); await sleep(1000);
          if (side.scrollTop === y0) { if (++idle >= 2) break; } else idle = 0;
          continue;
        }
        idle = 0; st.chat = nx.key; publish();
        openChat(nx.row); await sleep(rand(1800, 3000));
        await sweep(S.chat(), cutoff);
        st.done++; publish();
        await sleep(rand(2000, 5000));
      }
      finish(stopReq ? 'stopped' : 'done', !stopReq);
    } catch (e) { finish('error: ' + (e && e.message), false); }
  }
  function tick() {
    if (!cfg.auto || st.run || !document.getElementById('pane-side')) return;
    if (Date.now() - st.last < cfg.everyH * 3600000 || Date.now() - lastInput < 90000) return;
    run();
  }
  store.get(['waSet', 'waLast'], function (r) { Object.assign(cfg, r.waSet || {}); st.last = r.waLast || 0; });
  chrome.storage.onChanged.addListener(function (ch) {
    if (ch.waSet && ch.waSet.newValue) Object.assign(cfg, ch.waSet.newValue);
    var c = ch.waCmd && ch.waCmd.newValue;
    if (c && c.a === 'start') run();
    if (c && c.a === 'stop') stopReq = true;
  });
  setInterval(tick, 60000);
  setInterval(function () { publish(true); }, 10000);
  publish(true);
}

// Content script di halaman scanner: alirkan arsip ekstensi ke aplikasi (yang menyimpannya ke IndexedDB scanner)
function waExtBridge() {
  var busy = false, store = chrome.storage.local, O = location.origin;
  function say(m) { window.postMessage(m, O); }
  function waitSaved() {
    return new Promise(function (res) {
      var to = setTimeout(function () { off(); res(false); }, 10000);
      function on(e) { if (e.source === window && e.data && e.data.type === 'wa-ext-saved') { clearTimeout(to); off(); res(true); } }
      function off() { window.removeEventListener('message', on); }
      window.addEventListener('message', on);
    });
  }
  async function pull(full) {
    if (busy) return;
    busy = true;
    try {
      var since = full ? 0 : ((await store.get('syncedAt')).syncedAt || 0);
      for (;;) {
        var r = await chrome.runtime.sendMessage({ t: 'pull', since: since, max: 1500 });
        if (!r || !r.items || !r.items.length) break;
        var ok = waitSaved(); say({ type: 'wa-ext-items', items: r.items });
        if (!(await ok)) break;
        since = r.max; await store.set({ syncedAt: since });
        if (!r.more) break;
      }
    } catch (e) { /* ekstensi dimuat ulang: coba lagi di putaran berikut */ } finally { busy = false; }
  }
  window.addEventListener('message', function (e) {
    var d = e.source === window && e.data;
    if (!d) return;
    if (d.type === 'wa-ext-hello') { say({ type: 'wa-ext-ready' }); pull(false); }
    if (d.type === 'wa-ext-sync') pull(true);
  });
  say({ type: 'wa-ext-ready' }); pull(false);
  setInterval(function () { say({ type: 'wa-ext-ready' }); pull(false); }, 10000);
}

// Popup ekstensi (id elemen dan data-i dari popup.html)
function waExtPopup(DEF, lang) {
  var L = lang === 'en'
    ? { t: 'WA Hook Auto', total: 'messages archived', off: 'Open WhatsApp Web in a tab first.', on: 'WhatsApp Web connected.', run: 'Running: ', start: 'Start now', stop: 'Stop', open: 'Open scanner', exp: 'Export JSON', auto: 'Auto run', every: 'every (hours)', max: 'max chats per run', hz: 'first run: back to (days)', unread: 'skip chats with unread messages (opening them sends read receipts)', last: 'Last full run: ', never: 'never', done: 'done', stopped: 'stopped' }
    : { t: 'WA Hook Auto', total: 'pesan tersimpan', off: 'Buka WhatsApp Web di satu tab dulu.', on: 'WhatsApp Web terhubung.', run: 'Berjalan: ', start: 'Mulai sekarang', stop: 'Berhenti', open: 'Buka scanner', exp: 'Ekspor JSON', auto: 'Jalan otomatis', every: 'setiap (jam)', max: 'maks chat per putaran', hz: 'putaran pertama: sampai (hari)', unread: 'lewati chat yang punya pesan belum dibaca (membukanya mengirim tanda dibaca)', last: 'Putaran penuh terakhir: ', never: 'belum pernah', done: 'selesai', stopped: 'dihentikan' };
  var store = chrome.storage.local, $ = function (id) { return document.getElementById(id); };
  document.querySelectorAll('[data-i]').forEach(function (e) { e.textContent = L[e.getAttribute('data-i')]; });
  var set = Object.assign({}, DEF);
  function readSet() {
    set = { auto: $('auto').checked, everyH: +$('everyH').value || DEF.everyH, maxChats: Math.max(1, +$('maxChats').value || DEF.maxChats), maxSteps: DEF.maxSteps, horizonD: Math.max(1, +$('horizonD').value || DEF.horizonD), skipUnread: $('skipUnread').checked };
    store.set({ waSet: set });
  }
  function paint(stat, last) {
    var live = stat && Date.now() - stat.t < 30000;
    var msg = !live ? L.off : stat.run ? L.run + (stat.chat || '…') + ' (' + stat.done + ')' : L.on + (stat.msg ? ' [' + (L[stat.msg] || stat.msg) + ']' : '');
    $('state').textContent = msg;
    $('last').textContent = L.last + (last ? new Date(last).toLocaleString() : L.never);
    $('start').disabled = !live || !!(stat && stat.run);
    $('stop').disabled = !live || !(stat && stat.run);
  }
  function refresh() { store.get(['waStat', 'waLast'], function (r) { paint(r.waStat, r.waLast); }); chrome.runtime.sendMessage({ t: 'stats' }, function (r) { $('total').textContent = r ? r.total : 0; }); }
  store.get('waSet', function (r) {
    set = Object.assign(set, r.waSet || {});
    $('auto').checked = set.auto; $('everyH').value = set.everyH; $('maxChats').value = set.maxChats; $('horizonD').value = set.horizonD; $('skipUnread').checked = set.skipUnread;
  });
  ['auto', 'everyH', 'maxChats', 'horizonD', 'skipUnread'].forEach(function (id) { $(id).addEventListener('change', readSet); });
  $('start').onclick = function () { store.set({ waCmd: { a: 'start', n: Date.now() } }); };
  $('stop').onclick = function () { store.set({ waCmd: { a: 'stop', n: Date.now() } }); };
  $('open').onclick = function () { chrome.runtime.sendMessage({ t: 'open' }); };
  $('exp').onclick = function () {
    chrome.runtime.sendMessage({ t: 'pull', since: 0, max: 100000 }, function (r) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ type: 'wa-export', items: (r && r.items) || [] })], { type: 'application/json' }));
      a.download = 'wa-hook-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    });
  };
  chrome.storage.onChanged.addListener(refresh);
  setInterval(refresh, 3000); refresh();
}

const WA_EXT_POPUP_HTML = '<!doctype html><html><head><meta charset="utf-8"><title>WA Hook Auto</title><style>'
  + 'body{width:320px;margin:0;padding:12px;font:13px/1.45 Segoe UI,system-ui,sans-serif;background:#14100d;color:#f3ece4}'
  + 'h1{font-size:15px;margin:0 0 6px}button{background:#2a2019;color:#f3ece4;border:1px solid #453429;border-radius:6px;padding:5px 9px;cursor:pointer}'
  + 'button:disabled{opacity:.45;cursor:default}label{display:block;margin:6px 0}input[type=number]{width:60px;background:#2a2019;color:#f3ece4;border:1px solid #453429;border-radius:4px}'
  + 'select{background:#2a2019;color:#f3ece4;border:1px solid #453429;border-radius:4px}.row{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.m{color:#aa9888;font-size:12px}'
  + '</style></head><body><h1>💬 <span data-i="t"></span></h1><div><b id="total">0</b> <span data-i="total"></span></div>'
  + '<div class="m" id="state"></div><div class="m" id="last"></div>'
  + '<div class="row"><button id="start" data-i="start"></button><button id="stop" data-i="stop"></button><button id="open" data-i="open"></button><button id="exp" data-i="exp"></button></div>'
  + '<label><input type="checkbox" id="auto"> <span data-i="auto"></span> <span data-i="every"></span> <select id="everyH"><option>6</option><option>12</option><option>24</option><option>72</option><option>168</option></select></label>'
  + '<label><span data-i="max"></span> <input type="number" id="maxChats" min="1" max="500"></label>'
  + '<label><span data-i="hz"></span> <input type="number" id="horizonD" min="1" max="3650"></label>'
  + '<label><input type="checkbox" id="skipUnread"> <span data-i="unread"></span></label>'
  + '<script src="popup.js"></script></body></html>';

// Pola URL halaman scanner untuk bridge.js (kosong bila dibuka dari file:// karena ekstensi tidak boleh membaca file lokal secara bawaan)
function waExtMatch() {
  if (!/^https?:$/.test(location.protocol)) return '';
  return location.protocol + '//' + location.hostname + location.pathname.replace(/[^/]*$/, '') + '*';
}
function waExtFiles() {
  const app = pupAppCfg().app, match = waExtMatch();
  const scripts = [{ matches: ['https://web.whatsapp.com/*'], js: ['wa.js'], run_at: 'document_idle' }];
  if (match) scripts.push({ matches: [match], js: ['bridge.js'], run_at: 'document_idle' });
  const def = JSON.stringify(WA_EXT_DEF);
  return {
    'manifest.json': JSON.stringify({
      manifest_version: 3, name: 'WA Hook Auto', version: String(window.APP_VERSION || '1.0'),
      description: 'Arsip chat WhatsApp Web otomatis dan lokal untuk Scanner Security (tab WA Hook).',
      permissions: ['storage', 'unlimitedStorage'], background: { service_worker: 'bg.js' },
      action: { default_popup: 'popup.html', default_title: 'WA Hook Auto' }, content_scripts: scripts
    }, null, 2),
    'bg.js': waClean.toString() + '\n' + waMerge.toString() + '\n(' + waExtBg.toString() + ')(' + JSON.stringify(app) + ');\n',
    'wa.js': localizeScript('(' + waHookMain.toString() + ')({ ext: true });\n(' + waExtCrawl.toString() + ')(' + def + ');\n'),
    'bridge.js': '(' + waExtBridge.toString() + ')();\n',
    'popup.html': WA_EXT_POPUP_HTML,
    'popup.js': '(' + waExtPopup.toString() + ')(' + def + ', ' + JSON.stringify(LANG) + ');\n'
  };
}
// ZIP tanpa kompresi (method 0) supaya tidak perlu pustaka; crc32 dari scanners.js
function waExtZip(files) {
  const enc = new TextEncoder(), parts = [], cd = [], d = new Date();
  const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  const dosT = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosD = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let off = 0;
  Object.keys(files).forEach(name => {
    const n = enc.encode(name), b = enc.encode(files[name]);
    const common = [...u16(0x0800), ...u16(0), ...u16(dosT), ...u16(dosD), ...u32(crc32(b)), ...u32(b.length), ...u32(b.length), ...u16(n.length), ...u16(0)];
    const local = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...common]);
    cd.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off), ...n]));
    parts.push(local, n, b);
    off += local.length + n.length + b.length;
  });
  const cdSize = cd.reduce((s, x) => s + x.length, 0), cnt = cd.length;
  return new Blob(parts.concat(cd, [new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(cnt), ...u16(cnt), ...u32(cdSize), ...u32(off), 0, 0])]), { type: 'application/zip' });
}
