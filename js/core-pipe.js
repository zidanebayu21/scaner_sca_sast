/* ============================================================
   Scanner Security — Core Inbound/Outbound & IndexedDB Full Pipe + Smart Diff/Masker
   Mandiri, tanpa innerHTML / eval / RegExp.exec, kompatibel https:// & file://
   Seluruh log penuh (Outbound, Inbound Hook, Input & IndexedDB/LocalStorage) disimpan di IndexedDB (scaPipeLog)
   ============================================================ */
(function () {
  'use strict';

  var PIPE_KEY = 'scaPipeOn';
  var PIPE_DB = 'scaPipeLog';
  var PIPE_STORE = 'logs';
  var MAX_LOGS = 500;
  var MAX_PREV = 131072; // 128 KB payload penuh per entri

  var UI_LS_SKIP = {
    scaPipeOn: 1,
    scaPipeMin: 1,
    scaPingHist: 1,
    scaSideWidth: 1,
    scaSideOpen: 1,
    scaTheme: 1,
    scaLang: 1,
    scaTblSize: 1,
    scaVisibleTabs: 1,
    scaTabOrder: 1,
    scaPinnedTabs: 1,
    scaPupHidden: 1,
    scaPupGroup: 1
  };

  var origFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  var XHR = window.XMLHttpRequest;
  var origXhrOpen = XHR ? XHR.prototype.open : null;
  var origXhrSetHeader = XHR ? XHR.prototype.setRequestHeader : null;
  var origXhrSend = XHR ? XHR.prototype.send : null;
  var origBeacon = navigator && typeof navigator.sendBeacon === 'function' ? navigator.sendBeacon.bind(navigator) : null;
  var origWS = window.WebSocket;
  var origES = window.EventSource;

  var IDBStore = typeof window.IDBObjectStore !== 'undefined' ? window.IDBObjectStore : null;
  var origIdbPut = IDBStore && IDBStore.prototype ? IDBStore.prototype.put : null;
  var origIdbAdd = IDBStore && IDBStore.prototype ? IDBStore.prototype.add : null;
  var origIdbDel = IDBStore && IDBStore.prototype ? IDBStore.prototype.delete : null;
  var origIdbClear = IDBStore && IDBStore.prototype ? IDBStore.prototype.clear : null;
  var origIdbGetAll = IDBStore && IDBStore.prototype ? IDBStore.prototype.getAll : null;
  var origIdbGet = IDBStore && IDBStore.prototype ? IDBStore.prototype.get : null;

  var DomStorage = typeof window.Storage !== 'undefined' ? window.Storage : null;
  var origLsSet = DomStorage && DomStorage.prototype ? DomStorage.prototype.setItem : (window.localStorage && window.localStorage.setItem ? window.localStorage.setItem : null);
  var origLsRm = DomStorage && DomStorage.prototype ? DomStorage.prototype.removeItem : (window.localStorage && window.localStorage.removeItem ? window.localStorage.removeItem : null);

  var seq = 0;
  var lastId = 0;
  var clearEpoch = 0;
  var enabled = false;
  var installed = false;
  var inInternalOp = false;
  var logs = [];
  var stats = { outCount: 0, inCount: 0, idbCount: 0, outBytes: 0, inBytes: 0, idbBytes: 0, totalLogs: 0, lastAt: 0 };
  var listeners = [];
  var notifyTimer = 0;
  var pipeDbPromise = null;
  var perfObs = null;
  var seenResUrls = {};
  var lastIdbRead = {};
  var lastLsWrite = {};

  function nextId() {
    var cand = Date.now() * 1000 + (++seq % 1000);
    if (cand <= lastId) cand = lastId + 1;
    lastId = cand;
    return cand;
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function fmtTime(ms) {
    var d = new Date(ms);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function fmtDateTime(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + fmtTime(ms);
  }

  function byteLen(str) {
    if (!str) return 0;
    var s = String(str);
    try { return new TextEncoder().encode(s).length; } catch (e) { return s.length; }
  }

  function trunc(v, max) {
    var m = max || MAX_PREV;
    if (v === null || v === undefined) return '';
    var s = String(v);
    return s.length > m ? s.slice(0, m) + '\n… [+' + (s.length - m) + ' chars]' : s;
  }

  function serializeSmart(val) {
    if (val === null || val === undefined) return { text: '', bytes: 0 };
    if (typeof val === 'string') {
      var trimmed = val.trim();
      if ((trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') && val.length < MAX_PREV) {
        try {
          var pretty = JSON.stringify(JSON.parse(val), null, 2);
          return { text: trunc(pretty), bytes: byteLen(val) };
        } catch (e) { /* bukan JSON murni */ }
      }
      return { text: trunc(val), bytes: byteLen(val) };
    }
    if (typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams) {
      var us = val.toString();
      return { text: trunc(us), bytes: byteLen(us) };
    }
    if (typeof FormData !== 'undefined' && val instanceof FormData) {
      var parts = [];
      var fBytes = 0;
      try {
        val.forEach(function (v, k) {
          if (typeof File !== 'undefined' && v instanceof File) {
            fBytes += v.size || 0;
            parts.push(k + '=[File: ' + v.name + ', ' + (v.type || 'binary') + ', ' + v.size + ' B]');
          } else if (typeof Blob !== 'undefined' && v instanceof Blob) {
            fBytes += v.size || 0;
            parts.push(k + '=[Blob: ' + (v.type || 'binary') + ', ' + v.size + ' B]');
          } else {
            parts.push(k + '=' + String(v));
          }
        });
      } catch (e) { /* abaikan */ }
      var fs = parts.join('\n');
      return { text: trunc(fs), bytes: Math.max(byteLen(fs), fBytes) };
    }
    if (typeof File !== 'undefined' && val instanceof File) {
      return { text: '[File: ' + val.name + ' (' + (val.type || 'binary') + ', ' + val.size + ' B)]', bytes: val.size || 0 };
    }
    if (typeof Blob !== 'undefined' && val instanceof Blob) {
      return { text: '[Blob: ' + (val.type || 'binary') + ', ' + val.size + ' B]', bytes: val.size || 0 };
    }
    if (typeof ArrayBuffer !== 'undefined' && (val instanceof ArrayBuffer || ArrayBuffer.isView(val))) {
      var bl = val.byteLength || 0;
      return { text: '[Binary ' + bl + ' B]', bytes: bl };
    }
    if (typeof ReadableStream !== 'undefined' && val instanceof ReadableStream) {
      return { text: '[ReadableStream]', bytes: 0 };
    }
    var extraBytes = 0;
    var seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    try {
      var js = JSON.stringify(val, function (k, v) {
        if (v && typeof v === 'object') {
          if (typeof File !== 'undefined' && v instanceof File) {
            extraBytes += v.size || 0;
            return '[File: ' + v.name + ' (' + (v.type || 'binary') + ', ' + v.size + ' B)]';
          }
          if (typeof Blob !== 'undefined' && v instanceof Blob) {
            extraBytes += v.size || 0;
            return '[Blob: ' + (v.type || 'binary') + ', ' + v.size + ' B]';
          }
          if (typeof ArrayBuffer !== 'undefined' && (v instanceof ArrayBuffer || ArrayBuffer.isView(v))) {
            extraBytes += v.byteLength || 0;
            return '[Binary ' + (v.byteLength || 0) + ' B]';
          }
          if (seen) {
            if (seen.has(v)) return '[Circular]';
            seen.add(v);
          }
        }
        return v;
      }, 2);
      if (js === undefined) return { text: String(val), bytes: byteLen(String(val)) };
      return { text: trunc(js), bytes: byteLen(js) + extraBytes };
    } catch (e) {
      var st = String(val);
      return { text: trunc(st), bytes: byteLen(st) };
    }
  }

  function headersToObj(h) {
    var out = {};
    if (!h) return out;
    try {
      if (typeof Headers !== 'undefined' && h instanceof Headers) {
        h.forEach(function (v, k) { out[k] = v; });
      } else if (Array.isArray(h)) {
        h.forEach(function (p) { if (p && p.length >= 2) out[p[0]] = String(p[1]); });
      } else if (typeof h === 'object') {
        Object.keys(h).forEach(function (k) { out[k] = String(h[k]); });
      }
    } catch (e) { /* abaikan */ }
    return out;
  }

  function parseRawHeaders(raw) {
    var out = {};
    if (!raw) return out;
    String(raw).split(/\r?\n/).forEach(function (ln) {
      var idx = ln.indexOf(':');
      if (idx > 0) out[ln.slice(0, idx).trim().toLowerCase()] = ln.slice(idx + 1).trim();
    });
    return out;
  }

  function guessFeature(url, kind) {
    var u = String(url || '');
    if (/api\.osv\.dev/i.test(u)) return 'SCA (OSV)';
    if (/api\.first\.org\/data\/v1\/epss/i.test(u)) return 'SCA (EPSS)';
    if (/cisa\.gov/i.test(u)) return 'SCA (CISA KEV)';
    if (/deps\.dev/i.test(u)) return 'SCA (deps.dev)';
    if (/endoflife\.date/i.test(u)) return 'EOL Check';
    if (/api\.github\.com|raw\.githubusercontent\.com|gitlab\.com/i.test(u)) return 'Repo Fetch';
    if (/observatory-api\.mdn\.mozilla\.net|api\.hackertarget\.com|dns\.google|internetdb\.shodan\.io/i.test(u)) return 'DAST Pasif';
    if (/unpkg\.com|cdn\.jsdelivr\.net|tessdata/i.test(u)) return 'CDN Library/Model';
    if (/api\.ocr\.space|openrouter\.ai|api\.openai\.com|generativelanguage\.googleapis\.com/i.test(u)) return 'OCR / AI API';
    if (kind === 'postMessage') return 'Cross-Tab Hook';
    try {
      if (u && new URL(u, location.href).origin === location.origin) return 'Local Asset';
    } catch (e) { /* abaikan */ }
    return (window.__scaActiveTab && String(window.__scaActiveTab).toUpperCase()) || 'Outbound';
  }

  function idbFeatureName(dbName) {
    if (dbName === 'scaWaHook') return 'WA Hook (IndexedDB)';
    if (dbName === 'scaShopee') return 'Shopee Hook (IndexedDB)';
    if (dbName === 'scaPupRec') return 'Puppeteer (IndexedDB)';
    if (dbName === 'scaSheetRecent') return 'Sheet Viewer (IndexedDB)';
    return 'IndexedDB (' + (dbName || 'local') + ')';
  }

  function lsFeatureName(key) {
    if (key === 'scaItems') return 'SCA Files (localStorage)';
    if (key === 'scaPing') return 'Multi Ping (localStorage)';
    if (/^scaColor/i.test(key)) return 'Color Picker (localStorage)';
    if (/^scaClock/i.test(key)) return 'Jam Dunia (localStorage)';
    if (/^scaOcr/i.test(key)) return 'OCR Prefs (localStorage)';
    return 'LocalStorage (' + key + ')';
  }

  function recalcStats() {
    var outC = 0, inC = 0, idbC = 0, outB = 0, inB = 0, idbB = 0, latest = 0;
    for (var i = 0; i < logs.length; i++) {
      var e = logs[i];
      if (!e) continue;
      if (e.ts > latest) latest = e.ts;
      var b = Number(e.bytes) || 0;
      if (e.dir === 'OUT') { outC++; outB += b; }
      else if (e.dir === 'IN') { inC++; inB += b; }
      else { idbC++; idbB += b; }
    }
    stats = {
      outCount: outC,
      inCount: inC,
      idbCount: idbC,
      outBytes: outB,
      inBytes: inB,
      idbBytes: idbB,
      totalLogs: logs.length,
      lastAt: latest
    };
  }

  function emit() {
    recalcStats();
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(function () {
      var snapLogs = logs.map(function (x) { return Object.assign({}, x); });
      var snapStats = Object.assign({}, stats);
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](snapLogs, snapStats); } catch (e) { /* abaikan */ }
      }
    }, 25);
  }

  // ---- IndexedDB Persistence untuk Pipe Log (scaPipeLog -> logs) ----
  function openPipeDb() {
    if (pipeDbPromise) return pipeDbPromise;
    if (typeof indexedDB === 'undefined' || !indexedDB || typeof indexedDB.open !== 'function') {
      return Promise.resolve(null);
    }
    pipeDbPromise = new Promise(function (resolve) {
      var prevInternal = inInternalOp;
      inInternalOp = true;
      try {
        var req = indexedDB.open(PIPE_DB, 1);
        req.onupgradeneeded = function () {
          var p = inInternalOp;
          inInternalOp = true;
          try {
            var db = req.result;
            if (db && (!db.objectStoreNames || !db.objectStoreNames.contains(PIPE_STORE))) {
              db.createObjectStore(PIPE_STORE, { keyPath: 'id' });
            }
          } catch (e) { /* abaikan */ }
          inInternalOp = p;
        };
        req.onsuccess = function () {
          var db = req.result;
          if (db) {
            try {
              db.onversionchange = function () {
                try { db.close(); } catch (e) { /* abaikan */ }
                pipeDbPromise = null;
              };
            } catch (e) { /* abaikan */ }
          }
          resolve(db || null);
        };
        req.onerror = function () { pipeDbPromise = null; resolve(null); };
        req.onblocked = function () { pipeDbPromise = null; resolve(null); };
      } catch (e) {
        pipeDbPromise = null;
        resolve(null);
      } finally {
        inInternalOp = prevInternal;
      }
    });
    return pipeDbPromise;
  }

  function closePipeDb() {
    if (!pipeDbPromise) return;
    var p = pipeDbPromise;
    pipeDbPromise = null;
    p.then(function (db) {
      if (db && typeof db.close === 'function') {
        try { db.close(); } catch (e) { /* abaikan */ }
      }
    });
  }

  function rawIdbOp(store, origFn, method, args) {
    var fn = origFn || (store && store[method]);
    if (typeof fn !== 'function') return null;
    var prev = inInternalOp;
    inInternalOp = true;
    try { return fn.apply(store, args || []); }
    finally { inInternalOp = prev; }
  }

  function clonePlainEntry(entry) {
    return {
      id: entry.id,
      ts: entry.ts,
      time: entry.time,
      dateTime: entry.dateTime || fmtDateTime(entry.ts),
      dir: entry.dir,
      kind: entry.kind,
      method: entry.method,
      target: entry.target,
      feature: entry.feature,
      status: entry.status,
      ok: !!entry.ok,
      bytes: Number(entry.bytes) || 0,
      ms: entry.ms === null || entry.ms === undefined ? null : Number(entry.ms),
      reqHeaders: entry.reqHeaders || {},
      reqBody: entry.reqBody || '',
      resHeaders: entry.resHeaders || {},
      resBody: entry.resBody || ''
    };
  }

  function saveEntryToDb(entry, prunedIds) {
    if (!entry) return;
    var ep = clearEpoch;
    var plain = clonePlainEntry(entry);
    openPipeDb().then(function (db) {
      if (!db || ep !== clearEpoch) return;
      var prev = inInternalOp;
      inInternalOp = true;
      try {
        var tx = db.transaction(PIPE_STORE, 'readwrite');
        var st = tx.objectStore(PIPE_STORE);
        rawIdbOp(st, origIdbPut, 'put', [plain]);
        if (prunedIds && prunedIds.length) {
          for (var i = 0; i < prunedIds.length; i++) {
            rawIdbOp(st, origIdbDel, 'delete', [prunedIds[i]]);
          }
        }
      } catch (e) { /* abaikan */ }
      finally { inInternalOp = prev; }
    });
  }

  function clearDbLogs() {
    return openPipeDb().then(function (db) {
      if (!db) return;
      return new Promise(function (resolve) {
        var prev = inInternalOp;
        inInternalOp = true;
        try {
          var tx = db.transaction(PIPE_STORE, 'readwrite');
          var st = tx.objectStore(PIPE_STORE);
          rawIdbOp(st, origIdbClear, 'clear', []);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        } catch (e) { resolve(); }
        finally { inInternalOp = prev; }
      });
    });
  }

  function loadPersistedLogs() {
    var ep = clearEpoch;
    return openPipeDb().then(function (db) {
      if (!db || ep !== clearEpoch) return;
      return new Promise(function (resolve) {
        var prev = inInternalOp;
        inInternalOp = true;
        try {
          var tx = db.transaction(PIPE_STORE, 'readonly');
          var st = tx.objectStore(PIPE_STORE);
          var req = rawIdbOp(st, origIdbGetAll, 'getAll', []);
          if (!req) { resolve(); return; }
          var done = function (saved) {
            if (ep !== clearEpoch) { resolve(); return; }
            if (Array.isArray(saved) && saved.length) {
              var byId = {};
              for (var i = 0; i < logs.length; i++) byId[logs[i].id] = logs[i];
              for (var j = 0; j < saved.length; j++) {
                var s = saved[j];
                if (s && s.id && !byId[s.id]) {
                  if (!s.dateTime && s.ts) s.dateTime = fmtDateTime(s.ts);
                  byId[s.id] = s;
                  if (s.id > lastId) lastId = s.id;
                }
              }
              var merged = Object.keys(byId).map(function (k) { return byId[k]; });
              merged.sort(function (a, b) { return (b.id || 0) - (a.id || 0); });
              if (merged.length > MAX_LOGS) merged.length = MAX_LOGS;
              logs = merged;
              emit();
            }
            resolve();
          };
          if (typeof req.addEventListener === 'function') {
            req.addEventListener('success', function () { done(req.result); });
            req.addEventListener('error', function () { resolve(); });
          } else {
            req.onsuccess = function () { done(req.result); };
            req.onerror = function () { resolve(); };
          }
        } catch (e) { resolve(); }
        finally { inInternalOp = prev; }
      });
    });
  }

  function pushEntry(entry) {
    if (!entry.dateTime) entry.dateTime = fmtDateTime(entry.ts || Date.now());
    logs.unshift(entry);
    var pruned = [];
    while (logs.length > MAX_LOGS) {
      var old = logs.pop();
      if (old && old.id) pruned.push(old.id);
    }
    saveEntryToDb(entry, pruned);
    emit();
    return entry;
  }

  function updateEntry(entry) {
    if (!entry) return;
    saveEntryToDb(entry, null);
    emit();
  }

  // ---- Tangkap Resource Eksternal (CDN Script/CSS/Img seperti Vue unpkg.com) ----
  function recordPerfResource(r) {
    if (!enabled || !r || !r.name) return;
    var it = String(r.initiatorType || '').toLowerCase();
    if (it === 'fetch' || it === 'xmlhttprequest' || it === 'beacon') return;
    var url = String(r.name);
    if (/^(data:|blob:)/i.test(url)) return;
    var isExternal = false;
    try {
      var uObj = new URL(url, location.href);
      isExternal = /^https?:$/i.test(uObj.protocol) && uObj.origin !== location.origin;
    } catch (e) { isExternal = false; }
    if (!isExternal) return;
    if (seenResUrls[url]) return;
    seenResUrls[url] = 1;
    var sz = Number(r.transferSize) || Number(r.encodedBodySize) || Number(r.decodedBodySize) || 0;
    var cached = Number(r.transferSize) === 0 && (Number(r.decodedBodySize) > 0 || Number(r.duration) >= 0);
    if (cached && sz === 0) return;
    var now = Date.now();
    pushEntry({
      id: nextId(),
      ts: now,
      time: fmtTime(now),
      dateTime: fmtDateTime(now),
      dir: 'OUT',
      kind: 'resource',
      method: (it ? it.toUpperCase() : 'RES'),
      target: url,
      feature: guessFeature(url, 'resource'),
      status: cached && sz === 0 ? 'CACHE' : '200',
      ok: true,
      bytes: sz,
      ms: Math.max(0, Math.round(Number(r.duration) || 0)),
      reqHeaders: {
        initiatorType: it || 'resource',
        delivery: cached && sz === 0 ? 'Browser Cache (0 B network)' : 'External CDN / Resource',
        protocol: r.nextHopProtocol || 'https'
      },
      reqBody: '',
      resHeaders: {
        encodedBodySize: String(r.encodedBodySize || 0),
        decodedBodySize: String(r.decodedBodySize || 0),
        transferSize: String(r.transferSize || 0)
      },
      resBody: '[Static Resource Loaded: ' + url + ']'
    });
  }

  function scanInitialResources() {
    try {
      if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
        var list = performance.getEntriesByType('resource') || [];
        for (var i = 0; i < list.length; i++) recordPerfResource(list[i]);
      }
    } catch (e) { /* abaikan */ }
    try {
      if (!perfObs && typeof PerformanceObserver === 'function') {
        perfObs = new PerformanceObserver(function (list) {
          var entries = list.getEntries ? list.getEntries() : [];
          for (var i = 0; i < entries.length; i++) recordPerfResource(entries[i]);
        });
        perfObs.observe({ entryTypes: ['resource'] });
      }
    } catch (e) { /* abaikan */ }
  }

  function scanInitialLocalStorage() {
    if (!enabled || typeof localStorage === 'undefined' || !localStorage) return;
    try {
      var summary = {};
      var totalBytes = 0;
      var keysFound = 0;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || !/^sca/i.test(k) || UI_LS_SKIP[k]) continue;
        var raw = localStorage.getItem(k) || '';
        var b = byteLen(raw);
        totalBytes += b;
        keysFound++;
        try {
          var parsed = JSON.parse(raw);
          summary[k] = Array.isArray(parsed) ? ('Array(' + parsed.length + ' item, ' + b + ' B)') : parsed;
        } catch (e) {
          summary[k] = trunc(raw, 500);
        }
      }
      if (keysFound > 0) {
        var ser = serializeSmart(summary);
        var now = Date.now();
        pushEntry({
          id: nextId(),
          ts: now,
          time: fmtTime(now),
          dateTime: fmtDateTime(now),
          dir: 'IDB',
          kind: 'localStorage',
          method: 'LS-READ',
          target: 'localStorage://sca* (' + keysFound + ' key)',
          feature: 'LocalStorage Boot',
          status: 'OK (' + keysFound + ')',
          ok: true,
          bytes: totalBytes,
          ms: 0,
          reqHeaders: { storage: 'window.localStorage', keys: Object.keys(summary).join(', '), privacy: '100% Lokal di Browser (0 B keluar)' },
          reqBody: '',
          resHeaders: {},
          resBody: ser.text
        });
      }
    } catch (e) { /* abaikan */ }
  }

  // ---- Listener Input Lokal (File Picker & Drag-Drop) ----
  function recordFilesInput(fileList, channel) {
    if (!enabled || !fileList || !fileList.length) return;
    var items = [];
    var totalB = 0;
    for (var i = 0; i < fileList.length && i < 100; i++) {
      var f = fileList[i];
      if (!f) continue;
      var sz = Number(f.size) || 0;
      totalB += sz;
      items.push({ name: f.name || 'unnamed', type: f.type || 'application/octet-stream', sizeBytes: sz });
    }
    if (!items.length) return;
    var firstNames = items.slice(0, 3).map(function (x) { return x.name; }).join(', ') + (items.length > 3 ? ' +' + (items.length - 3) : '');
    var now = Date.now();
    var tabName = (window.__scaActiveTab && String(window.__scaActiveTab).toUpperCase()) || 'LOCAL';
    pushEntry({
      id: nextId(),
      ts: now,
      time: fmtTime(now),
      dateTime: fmtDateTime(now),
      dir: 'IDB',
      kind: channel,
      method: 'FILE-IN',
      target: 'local-file://' + firstNames + ' (' + fileList.length + ' file)',
      feature: tabName + ' (File Input)',
      status: 'LOCAL',
      ok: true,
      bytes: totalB,
      ms: 0,
      reqHeaders: { channel: channel, fileCount: String(fileList.length), activeTab: tabName, privacy: '100% Lokal di Browser (0 B keluar)' },
      reqBody: serializeSmart(items).text,
      resHeaders: {},
      resBody: ''
    });
  }

  function onDocChange(e) {
    if (!enabled || !e || !e.target) return;
    var t = e.target;
    if (t.tagName === 'INPUT' && String(t.type || '').toLowerCase() === 'file' && t.files && t.files.length) {
      recordFilesInput(t.files, 'file-picker');
    }
  }

  function onDocDrop(e) {
    if (!enabled || !e || !e.dataTransfer) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      recordFilesInput(e.dataTransfer.files, 'drag-drop');
    }
  }

  // ---- Listener Inbound postMessage dari Hook ----
  function onWinMessage(e) {
    if (!enabled || !e) return;
    var d = e.data;
    if (!d) return;
    if (typeof d === 'object' && (d.source && /devtools|vue|react|wappalyzer|metamask/i.test(String(d.source)))) return;
    if (e.source === window && (!d || typeof d !== 'object' || !/^(wa-|shp-|sheet-|pup-|swag-|dbg-)/.test(String(d.type || '')))) return;
    var bodyInfo = serializeSmart(d);
    var mtype = (d && typeof d === 'object' && d.type) ? String(d.type) : typeof d;
    var countInfo = (d && Array.isArray(d.items)) ? ' (' + d.items.length + ' item)' : (d && Array.isArray(d.msgs)) ? ' (' + d.msgs.length + ' pesan)' : '';
    var now = Date.now();
    pushEntry({
      id: nextId(),
      ts: now,
      time: fmtTime(now),
      dateTime: fmtDateTime(now),
      dir: 'IN',
      kind: 'postMessage',
      method: 'MSG',
      target: (e.origin && e.origin !== 'null' ? e.origin : 'tab-hook') + ' → ' + mtype + countInfo,
      feature: /^wa-/.test(mtype) ? 'WA Hook' : /^shp-/.test(mtype) ? 'Shopee Hook' : /^sheet-/.test(mtype) ? 'Sheet Hook' : /^pup-/.test(mtype) ? 'Puppeteer' : /^swag-/.test(mtype) ? 'Swag' : 'Inbound Msg',
      status: 'OK',
      ok: true,
      bytes: bodyInfo.bytes,
      ms: 0,
      reqHeaders: { origin: e.origin || '(local/null)', messageType: mtype, channel: 'window.postMessage' },
      reqBody: bodyInfo.text,
      resHeaders: {},
      resBody: ''
    });
  }

  // ---- Helper Intersepsi IndexedDB (IDBObjectStore.prototype) ----
  function getStoreMeta(store) {
    var sName = (store && store.name) ? String(store.name) : 'store';
    var dName = (store && store.transaction && store.transaction.db && store.transaction.db.name)
      ? String(store.transaction.db.name)
      : '';
    return { db: dName, store: sName };
  }

  function attachReqSuccess(req, cb) {
    if (!req) return;
    if (typeof req.addEventListener === 'function') {
      req.addEventListener('success', function () {
        try { cb(req.result); } catch (e) { /* abaikan */ }
      });
    } else {
      var prev = req.onsuccess;
      try {
        Object.defineProperty(req, 'onsuccess', {
          configurable: true,
          get: function () { return prev; },
          set: function (fn) {
            prev = function (ev) {
              try { cb(req.result); } catch (e) { /* abaikan */ }
              if (typeof fn === 'function') return fn.call(this, ev);
            };
          }
        });
      } catch (e) { /* abaikan */ }
    }
  }

  function recordIdbMutation(store, opName, valOrKey) {
    if (!enabled || inInternalOp) return;
    var meta = getStoreMeta(store);
    if (meta.db === PIPE_DB) return;
    var tx = store && store.transaction;
    if (!tx) return;
    if (!tx.__pipeBatch) {
      var batch = {
        db: meta.db || 'indexedDB',
        store: meta.store,
        ops: {},
        count: 0,
        samples: [],
        extraBytes: 0,
        flushed: false
      };
      tx.__pipeBatch = batch;
      var flush = function () {
        if (batch.flushed || !enabled) return;
        batch.flushed = true;
        var opKeys = Object.keys(batch.ops);
        var methodLbl = opKeys.length === 1 ? ('IDB-' + opKeys[0]) : 'IDB-WRITE';
        var payloadObj = batch.samples.length === 1 ? batch.samples[0] : batch.samples;
        if (batch.count > batch.samples.length) {
          payloadObj = batch.samples.concat(['[… +' + (batch.count - batch.samples.length) + ' item lainnya di transaksi yang sama]']);
        }
        var ser = serializeSmart(payloadObj);
        var now = Date.now();
        pushEntry({
          id: nextId(),
          ts: now,
          time: fmtTime(now),
          dateTime: fmtDateTime(now),
          dir: 'IDB',
          kind: 'indexedDB',
          method: methodLbl,
          target: 'indexedDB://' + batch.db + '/' + batch.store + ' (' + batch.count + ' item)',
          feature: idbFeatureName(batch.db),
          status: 'SAVED',
          ok: true,
          bytes: Math.max(ser.bytes, batch.extraBytes),
          ms: 0,
          reqHeaders: {
            database: batch.db,
            objectStore: batch.store,
            operation: opKeys.join(', '),
            itemCount: String(batch.count),
            privacy: '100% Lokal di IndexedDB Browser (0 B keluar)'
          },
          reqBody: ser.text,
          resHeaders: {},
          resBody: ''
        });
      };
      if (typeof tx.addEventListener === 'function') {
        tx.addEventListener('complete', flush);
      } else {
        setTimeout(flush, 15);
      }
    }
    var b = tx.__pipeBatch;
    b.ops[opName] = (b.ops[opName] || 0) + 1;
    b.count++;
    if (b.samples.length < 150) {
      b.samples.push(valOrKey !== undefined ? valOrKey : ('[' + opName + ']'));
    } else if (valOrKey && typeof valOrKey === 'object') {
      b.extraBytes += 256;
    }
  }

  function recordIdbReadResult(meta, opName, queryKey, result) {
    if (!enabled || inInternalOp || meta.db === PIPE_DB) return;
    var isArr = Array.isArray(result);
    var count = isArr ? result.length : (result !== undefined && result !== null ? 1 : 0);
    if (count === 0) return;
    var sigKey = meta.db + '/' + meta.store + ':' + opName;
    var now = Date.now();
    var prevRead = lastIdbRead[sigKey];
    if (prevRead && prevRead.count === count && (now - prevRead.ts) < 4000) return;
    lastIdbRead[sigKey] = { count: count, ts: now };

    var previewVal = result;
    if (isArr && result.length > 150) {
      previewVal = result.slice(0, 150).concat(['[… +' + (result.length - 150) + ' item lainnya]']);
    }
    var ser = count > 0 ? serializeSmart(previewVal) : { text: isArr ? '[] (0 item tersimpan saat ini)' : '(kosong)', bytes: 0 };
    pushEntry({
      id: nextId(),
      ts: now,
      time: fmtTime(now),
      dateTime: fmtDateTime(now),
      dir: 'IDB',
      kind: 'indexedDB',
      method: opName,
      target: 'indexedDB://' + (meta.db || 'local') + '/' + meta.store + (queryKey !== undefined ? '[' + String(queryKey) + ']' : '') + ' (' + count + ' item)',
      feature: idbFeatureName(meta.db),
      status: count > 0 ? ('OK (' + count + ')') : 'EMPTY (0)',
      ok: true,
      bytes: ser.bytes,
      ms: 0,
      reqHeaders: {
        database: meta.db || 'local',
        objectStore: meta.store,
        operation: opName,
        itemCount: String(count),
        privacy: '100% Lokal di IndexedDB Browser (0 B keluar)'
      },
      reqBody: queryKey !== undefined ? ('Key: ' + String(queryKey)) : '',
      resHeaders: {},
      resBody: ser.text
    });
  }

  function recordLsMutation(opName, key, val) {
    if (!enabled || inInternalOp || !key) return;
    var k = String(key);
    if (UI_LS_SKIP[k]) return;
    var ser = val !== undefined ? serializeSmart(val) : { text: '[Removed key: ' + k + ']', bytes: 0 };
    var now = Date.now();
    var prev = lastLsWrite[k];
    if (prev && prev.entry && (now - prev.ts) < 900 && logs.indexOf(prev.entry) >= 0) {
      prev.ts = now;
      prev.entry.ts = now;
      prev.entry.time = fmtTime(now);
      prev.entry.dateTime = fmtDateTime(now);
      prev.entry.method = opName;
      prev.entry.bytes = ser.bytes;
      prev.entry.reqBody = ser.text;
      updateEntry(prev.entry);
      return;
    }
    var entry = pushEntry({
      id: nextId(),
      ts: now,
      time: fmtTime(now),
      dateTime: fmtDateTime(now),
      dir: 'IDB',
      kind: 'localStorage',
      method: opName,
      target: 'localStorage://' + k,
      feature: lsFeatureName(k),
      status: opName === 'LS-DEL' ? 'DELETED' : 'SAVED',
      ok: true,
      bytes: ser.bytes,
      ms: 0,
      reqHeaders: {
        storage: 'window.localStorage',
        key: k,
        privacy: '100% Lokal di Browser (0 B keluar)'
      },
      reqBody: ser.text,
      resHeaders: {},
      resBody: ''
    });
    lastLsWrite[k] = { ts: now, entry: entry };
  }

  function install() {
    if (installed) return;
    installed = true;

    if (origFetch) {
      window.fetch = function (input, init) {
        if (!enabled) return origFetch(input, init);
        var url = typeof input === 'string' ? input : (input && input.url) || String(input);
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        var hdrs = headersToObj((init && init.headers) || (input && input.headers));
        var bodyInfo = serializeSmart(init && init.body);
        var now = Date.now(), t0 = performance.now();
        var entry = pushEntry({
          id: nextId(),
          ts: now,
          time: fmtTime(now),
          dateTime: fmtDateTime(now),
          dir: 'OUT',
          kind: 'fetch',
          method: method,
          target: url,
          feature: guessFeature(url, 'fetch'),
          status: '…',
          ok: true,
          bytes: bodyInfo.bytes,
          ms: null,
          reqHeaders: hdrs,
          reqBody: bodyInfo.text,
          resHeaders: {},
          resBody: ''
        });
        return origFetch(input, init).then(function (res) {
          entry.ms = Math.round(performance.now() - t0);
          entry.status = res.type === 'opaque' ? 'opaque' : String(res.status || 'OK');
          entry.ok = res.type === 'opaque' || !!res.ok;
          entry.resHeaders = headersToObj(res.headers);
          var cl = parseInt((res.headers && res.headers.get && res.headers.get('content-length')) || '0', 10) || 0;
          var ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
          var isTextual = !ct || /(json|text|xml|javascript|html|csv|yaml|urlencoded)/i.test(ct);
          if (res.type !== 'opaque' && isTextual && cl <= 524288 && typeof res.clone === 'function') {
            try {
              res.clone().text().then(function (txt) {
                var serRes = serializeSmart(txt);
                entry.resBody = serRes.text;
                entry.bytes = bodyInfo.bytes + (cl || serRes.bytes);
                updateEntry(entry);
              }).catch(function () { updateEntry(entry); });
              return res;
            } catch (e) { /* lanjut simpan metadata */ }
          }
          if (cl > 0) entry.bytes = bodyInfo.bytes + cl;
          updateEntry(entry);
          return res;
        }, function (err) {
          entry.ms = Math.round(performance.now() - t0);
          entry.status = 'ERR';
          entry.ok = false;
          entry.resBody = String((err && err.message) || err || 'Network Error');
          updateEntry(entry);
          throw err;
        });
      };
    }

    if (XHR && origXhrOpen && origXhrSend) {
      XHR.prototype.open = function (method, url) {
        this.__pipe = {
          method: String(method || 'GET').toUpperCase(),
          url: String(url || ''),
          headers: {}
        };
        return origXhrOpen.apply(this, arguments);
      };
      if (origXhrSetHeader) {
        XHR.prototype.setRequestHeader = function (k, v) {
          if (this.__pipe && k) this.__pipe.headers[k] = String(v);
          return origXhrSetHeader.apply(this, arguments);
        };
      }
      XHR.prototype.send = function (body) {
        if (enabled && this.__pipe) {
          var meta = this.__pipe;
          var bInfo = serializeSmart(body);
          var now = Date.now(), t0 = performance.now();
          var entry = pushEntry({
            id: nextId(),
            ts: now,
            time: fmtTime(now),
            dateTime: fmtDateTime(now),
            dir: 'OUT',
            kind: 'xhr',
            method: meta.method,
            target: meta.url,
            feature: guessFeature(meta.url, 'xhr'),
            status: '…',
            ok: true,
            bytes: bInfo.bytes,
            ms: null,
            reqHeaders: meta.headers,
            reqBody: bInfo.text,
            resHeaders: {},
            resBody: ''
          });
          var xhrRef = this;
          this.addEventListener('loadend', function () {
            entry.ms = Math.round(performance.now() - t0);
            entry.status = xhrRef.status ? String(xhrRef.status) : 'ERR';
            entry.ok = xhrRef.status >= 200 && xhrRef.status < 400;
            try {
              if (typeof xhrRef.getAllResponseHeaders === 'function') {
                entry.resHeaders = parseRawHeaders(xhrRef.getAllResponseHeaders());
              }
            } catch (e) { /* abaikan */ }
            try {
              if (!xhrRef.responseType || xhrRef.responseType === 'text') {
                var serT = serializeSmart(xhrRef.responseText || '');
                entry.resBody = serT.text;
                entry.bytes = bInfo.bytes + serT.bytes;
              } else if (xhrRef.responseType === 'json') {
                var serJ = serializeSmart(xhrRef.response);
                entry.resBody = serJ.text;
                entry.bytes = bInfo.bytes + serJ.bytes;
              }
            } catch (e) { /* abaikan */ }
            updateEntry(entry);
          });
        }
        return origXhrSend.apply(this, arguments);
      };
    }

    if (origBeacon) {
      navigator.sendBeacon = function (url, data) {
        if (enabled) {
          var bInfo = serializeSmart(data);
          var now = Date.now();
          pushEntry({
            id: nextId(), ts: now, time: fmtTime(now), dateTime: fmtDateTime(now),
            dir: 'OUT', kind: 'beacon', method: 'BEACON',
            target: String(url || ''), feature: guessFeature(url, 'beacon'), status: 'SENT', ok: true,
            bytes: bInfo.bytes, ms: 0, reqHeaders: {}, reqBody: bInfo.text, resHeaders: {}, resBody: ''
          });
        }
        return origBeacon(url, data);
      };
    }

    if (origWS) {
      var WrappedWS = function (url, protocols) {
        var ws = protocols !== undefined ? new origWS(url, protocols) : new origWS(url);
        if (enabled) {
          var now = Date.now();
          pushEntry({
            id: nextId(), ts: now, time: fmtTime(now), dateTime: fmtDateTime(now),
            dir: 'OUT', kind: 'ws', method: 'WS-OPEN',
            target: String(url || ''), feature: guessFeature(url, 'ws'), status: 'OPEN', ok: true,
            bytes: 0, ms: 0, reqHeaders: protocols ? { protocols: String(protocols) } : {}, reqBody: '', resHeaders: {}, resBody: ''
          });
          if (ws && typeof ws.send === 'function') {
            var origWsSend = ws.send.bind(ws);
            ws.send = function (frame) {
              if (enabled) {
                var fInfo = serializeSmart(frame);
                var tNow = Date.now();
                pushEntry({
                  id: nextId(), ts: tNow, time: fmtTime(tNow), dateTime: fmtDateTime(tNow),
                  dir: 'OUT', kind: 'ws', method: 'WS-SEND',
                  target: String(url || ''), feature: guessFeature(url, 'ws'), status: 'SENT', ok: true,
                  bytes: fInfo.bytes, ms: 0, reqHeaders: {}, reqBody: fInfo.text, resHeaders: {}, resBody: ''
                });
              }
              return origWsSend(frame);
            };
          }
        }
        return ws;
      };
      WrappedWS.prototype = origWS.prototype;
      WrappedWS.CONNECTING = origWS.CONNECTING;
      WrappedWS.OPEN = origWS.OPEN;
      WrappedWS.CLOSING = origWS.CLOSING;
      WrappedWS.CLOSED = origWS.CLOSED;
      window.WebSocket = WrappedWS;
    }

    if (origES) {
      var WrappedES = function (url, cfg) {
        var es = cfg !== undefined ? new origES(url, cfg) : new origES(url);
        if (enabled) {
          var now = Date.now();
          pushEntry({
            id: nextId(), ts: now, time: fmtTime(now), dateTime: fmtDateTime(now),
            dir: 'OUT', kind: 'sse', method: 'SSE',
            target: String(url || ''), feature: guessFeature(url, 'sse'), status: 'OPEN', ok: true,
            bytes: 0, ms: 0, reqHeaders: {}, reqBody: '', resHeaders: {}, resBody: ''
          });
        }
        return es;
      };
      WrappedES.prototype = origES.prototype;
      window.EventSource = WrappedES;
    }

    // Intersepsi IndexedDB (IDBObjectStore.prototype) untuk bukti Input/Storage penuh
    if (IDBStore && IDBStore.prototype) {
      if (origIdbPut) {
        IDBStore.prototype.put = function (val, key) {
          recordIdbMutation(this, 'PUT', val);
          return origIdbPut.apply(this, arguments);
        };
      }
      if (origIdbAdd) {
        IDBStore.prototype.add = function (val, key) {
          recordIdbMutation(this, 'ADD', val);
          return origIdbAdd.apply(this, arguments);
        };
      }
      if (origIdbDel) {
        IDBStore.prototype.delete = function (key) {
          recordIdbMutation(this, 'DEL', { deletedKey: key });
          return origIdbDel.apply(this, arguments);
        };
      }
      if (origIdbClear) {
        IDBStore.prototype.clear = function () {
          recordIdbMutation(this, 'CLEAR', { clearedStore: this && this.name });
          return origIdbClear.apply(this, arguments);
        };
      }
      if (origIdbGetAll) {
        IDBStore.prototype.getAll = function (query, count) {
          var req = origIdbGetAll.apply(this, arguments);
          if (enabled && !inInternalOp) {
            var meta = getStoreMeta(this);
            if (meta.db !== PIPE_DB) {
              attachReqSuccess(req, function (res) { recordIdbReadResult(meta, 'IDB-READ', query, res); });
            }
          }
          return req;
        };
      }
      if (origIdbGet) {
        IDBStore.prototype.get = function (query) {
          var req = origIdbGet.apply(this, arguments);
          if (enabled && !inInternalOp) {
            var meta = getStoreMeta(this);
            if (meta.db !== PIPE_DB) {
              attachReqSuccess(req, function (res) { recordIdbReadResult(meta, 'IDB-GET', query, res); });
            }
          }
          return req;
        };
      }
    }

    // Intersepsi localStorage (setItem / removeItem) — abaikan no-op jika nilai tidak berubah
    if (DomStorage && DomStorage.prototype && origLsSet) {
      DomStorage.prototype.setItem = function (k, v) {
        if (this === window.localStorage) {
          var prevVal = null;
          try { prevVal = this.getItem(k); } catch (e) { prevVal = null; }
          if (prevVal !== String(v)) recordLsMutation('LS-WRITE', k, v);
        }
        return origLsSet.apply(this, arguments);
      };
      if (origLsRm) {
        DomStorage.prototype.removeItem = function (k) {
          if (this === window.localStorage) {
            var hadVal = null;
            try { hadVal = this.getItem(k); } catch (e) { hadVal = null; }
            if (hadVal !== null) recordLsMutation('LS-DEL', k);
          }
          return origLsRm.apply(this, arguments);
        };
      }
    } else if (window.localStorage && origLsSet) {
      window.localStorage.setItem = function (k, v) {
        var prevVal = null;
        try { prevVal = window.localStorage.getItem(k); } catch (e) { prevVal = null; }
        if (prevVal !== String(v)) recordLsMutation('LS-WRITE', k, v);
        return origLsSet.call(window.localStorage, k, v);
      };
      if (origLsRm) {
        window.localStorage.removeItem = function (k) {
          var hadVal = null;
          try { hadVal = window.localStorage.getItem(k); } catch (e) { hadVal = null; }
          if (hadVal !== null) recordLsMutation('LS-DEL', k);
          return origLsRm.call(window.localStorage, k);
        };
      }
    }

    window.addEventListener('message', onWinMessage, true);
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('change', onDocChange, true);
      document.addEventListener('drop', onDocDrop, true);
    }
    scanInitialResources();
  }

  function uninstall() {
    if (!installed) return;
    installed = false;
    if (origFetch) window.fetch = origFetch;
    if (XHR && origXhrOpen) XHR.prototype.open = origXhrOpen;
    if (XHR && origXhrSetHeader) XHR.prototype.setRequestHeader = origXhrSetHeader;
    if (XHR && origXhrSend) XHR.prototype.send = origXhrSend;
    if (origBeacon) navigator.sendBeacon = origBeacon;
    if (origWS) window.WebSocket = origWS;
    if (origES) window.EventSource = origES;
    if (IDBStore && IDBStore.prototype) {
      if (origIdbPut) IDBStore.prototype.put = origIdbPut;
      if (origIdbAdd) IDBStore.prototype.add = origIdbAdd;
      if (origIdbDel) IDBStore.prototype.delete = origIdbDel;
      if (origIdbClear) IDBStore.prototype.clear = origIdbClear;
      if (origIdbGetAll) IDBStore.prototype.getAll = origIdbGetAll;
      if (origIdbGet) IDBStore.prototype.get = origIdbGet;
    }
    if (DomStorage && DomStorage.prototype && origLsSet) {
      DomStorage.prototype.setItem = origLsSet;
      if (origLsRm) DomStorage.prototype.removeItem = origLsRm;
    } else if (window.localStorage && origLsSet) {
      window.localStorage.setItem = origLsSet;
      if (origLsRm) window.localStorage.removeItem = origLsRm;
    }
    if (perfObs) {
      try { perfObs.disconnect(); } catch (e) { /* abaikan */ }
      perfObs = null;
    }
    window.removeEventListener('message', onWinMessage, true);
    if (typeof document !== 'undefined' && document.removeEventListener) {
      document.removeEventListener('change', onDocChange, true);
      document.removeEventListener('drop', onDocDrop, true);
    }
  }

  function setEnabled(on, persist) {
    enabled = !!on;
    if (enabled) install();
    else uninstall();
    if (persist !== false) {
      var prev = inInternalOp;
      inInternalOp = true;
      try {
        if (origLsSet) origLsSet.call(window.localStorage, PIPE_KEY, enabled ? '1' : '0');
        else localStorage.setItem(PIPE_KEY, enabled ? '1' : '0');
      } catch (e) { /* abaikan */ }
      inInternalOp = prev;
    }
    emit();
  }

  function recordPostOut(targetOrigin, payload, feature) {
    if (!enabled) return;
    var bInfo = serializeSmart(payload);
    var now = Date.now();
    var mtype = (payload && typeof payload === 'object' && payload.type) ? payload.type : 'message';
    pushEntry({
      id: nextId(), ts: now, time: fmtTime(now), dateTime: fmtDateTime(now),
      dir: 'OUT', kind: 'postMessage', method: 'MSG',
      target: (targetOrigin || '*') + ' ← ' + mtype,
      feature: feature || 'Cross-Tab Reply',
      status: 'SENT', ok: true, bytes: bInfo.bytes, ms: 0,
      reqHeaders: { targetOrigin: targetOrigin || '*', type: mtype },
      reqBody: bInfo.text, resHeaders: {}, resBody: ''
    });
  }

  function recordInput(method, target, payload, feature) {
    if (!enabled) return;
    var bInfo = serializeSmart(payload);
    var now = Date.now();
    pushEntry({
      id: nextId(), ts: now, time: fmtTime(now), dateTime: fmtDateTime(now),
      dir: 'IDB', kind: 'local-input', method: String(method || 'INPUT'),
      target: String(target || 'local://input'),
      feature: feature || ((window.__scaActiveTab && String(window.__scaActiveTab).toUpperCase()) || 'Local Input'),
      status: 'LOCAL', ok: true, bytes: bInfo.bytes, ms: 0,
      reqHeaders: { channel: 'local-input', privacy: '100% Lokal di Browser (0 B keluar)' },
      reqBody: bInfo.text, resHeaders: {}, resBody: ''
    });
  }

  function clearLogs() {
    clearEpoch++;
    logs = [];
    lastIdbRead = {};
    lastLsWrite = {};
    recalcStats();
    emit();
    return clearDbLogs();
  }

  var initOn = true;
  try {
    var saved = localStorage.getItem(PIPE_KEY);
    if (saved === '0') initOn = false;
  } catch (e) { /* abaikan */ }
  setEnabled(initOn, false);

  loadPersistedLogs();

  window.AppPipe = {
    dbName: PIPE_DB,
    storeName: PIPE_STORE,
    isEnabled: function () { return enabled; },
    setEnabled: setEnabled,
    clear: clearLogs,
    closeDb: closePipeDb,
    reloadFromDb: loadPersistedLogs,
    getLogs: function () { return logs.map(function (x) { return Object.assign({}, x); }); },
    getStats: function () { recalcStats(); return Object.assign({}, stats); },
    recordPostOut: recordPostOut,
    recordInput: recordInput,
    subscribe: function (fn) {
      if (typeof fn === 'function' && listeners.indexOf(fn) < 0) listeners.push(fn);
      return function () {
        var idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }
  };

  // ============================================================
  //  Smart Diff & Secret Masker Engine (8C) — 100% Lokal
  // ============================================================
  function sortJsonDeep(v) {
    if (Array.isArray(v)) return v.map(sortJsonDeep);
    if (v && typeof v === 'object') {
      var out = {};
      Object.keys(v).sort().forEach(function (k) { out[k] = sortJsonDeep(v[k]); });
      return out;
    }
    return v;
  }

  function formatForDiff(raw, fmt) {
    var s = String(raw === null || raw === undefined ? '' : raw).replace(/\r\n?/g, '\n');
    if (fmt === 'json' && s.trim()) {
      try { return { text: JSON.stringify(sortJsonDeep(JSON.parse(s)), null, 2), warn: '' }; }
      catch (e) { return { text: s, warn: 'JSON: ' + e.message }; }
    }
    if (fmt === 'env' && s.trim()) {
      var lines = s.split('\n');
      var kv = [], comments = [];
      lines.forEach(function (ln) {
        var t = ln.trim();
        if (!t) return;
        if (t.charAt(0) === '#') comments.push(t);
        else kv.push(t);
      });
      kv.sort(function (a, b) {
        var ka = a.split('=')[0].trim(), kb = b.split('=')[0].trim();
        return ka.localeCompare(kb);
      });
      return { text: (comments.length ? comments.join('\n') + '\n' : '') + kv.join('\n'), warn: '' };
    }
    return { text: s, warn: '' };
  }

  function inlineSegs(a, b) {
    var sa = String(a), sb = String(b);
    var p = 0, minL = Math.min(sa.length, sb.length);
    while (p < minL && sa.charCodeAt(p) === sb.charCodeAt(p)) p++;
    var s = 0;
    while (s < (minL - p) && sa.charCodeAt(sa.length - 1 - s) === sb.charCodeAt(sb.length - 1 - s)) s++;
    var pre = sa.slice(0, p), suf = s ? sa.slice(sa.length - s) : '';
    var midA = sa.slice(p, sa.length - s), midB = sb.slice(p, sb.length - s);
    var segA = [], segB = [];
    if (pre) { segA.push({ t: pre, c: false }); segB.push({ t: pre, c: false }); }
    if (midA) segA.push({ t: midA, c: true });
    if (midB) segB.push({ t: midB, c: true });
    if (suf) { segA.push({ t: suf, c: false }); segB.push({ t: suf, c: false }); }
    return [segA.length ? segA : [{ t: '', c: false }], segB.length ? segB : [{ t: '', c: false }]];
  }

  function computeDiff(leftRaw, rightRaw, opts) {
    opts = opts || {};
    var fL = formatForDiff(leftRaw, opts.fmt);
    var fR = formatForDiff(rightRaw, opts.fmt);
    var aLines = fL.text === '' ? [] : fL.text.split('\n');
    var bLines = fR.text === '' ? [] : fR.text.split('\n');
    var norm = function (ln) {
      var x = ln;
      if (opts.ignoreTrim) x = x.trim();
      if (opts.ignoreCase) x = x.toLowerCase();
      return x;
    };
    var aKey = aLines.map(norm), bKey = bLines.map(norm);
    var n = aLines.length, m = bLines.length;

    // Trim common prefix & suffix for instant speed on large files
    var start = 0;
    while (start < n && start < m && aKey[start] === bKey[start]) start++;
    var endA = n - 1, endB = m - 1;
    while (endA >= start && endB >= start && aKey[endA] === bKey[endB]) { endA--; endB--; }

    var ops = [];
    for (var i0 = 0; i0 < start; i0++) ops.push({ k: 'eq', a: i0, b: i0 });

    var subN = endA - start + 1, subM = endB - start + 1;
    if (subN > 0 && subM > 0 && subN * subM <= 1600000) {
      var dp = new Array(subN + 1);
      for (var r = 0; r <= subN; r++) dp[r] = new Int32Array(subM + 1);
      for (var i = subN - 1; i >= 0; i--) {
        for (var j = subM - 1; j >= 0; j--) {
          dp[i][j] = aKey[start + i] === bKey[start + j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
      var ci = 0, cj = 0;
      while (ci < subN && cj < subM) {
        if (aKey[start + ci] === bKey[start + cj]) {
          ops.push({ k: 'eq', a: start + ci, b: start + cj });
          ci++; cj++;
        } else if (dp[ci + 1][cj] >= dp[ci][cj + 1]) {
          ops.push({ k: 'del', a: start + ci });
          ci++;
        } else {
          ops.push({ k: 'add', b: start + cj });
          cj++;
        }
      }
      while (ci < subN) { ops.push({ k: 'del', a: start + ci }); ci++; }
      while (cj < subM) { ops.push({ k: 'add', b: start + cj }); cj++; }
    } else {
      // Fallback linear scan for massive inputs (>1200x1200 changed block)
      for (var di = 0; di < subN; di++) ops.push({ k: 'del', a: start + di });
      for (var dj = 0; dj < subM; dj++) ops.push({ k: 'add', b: start + dj });
    }

    var sufCount = n - 1 - endA;
    for (var s = 0; s < sufCount; s++) ops.push({ k: 'eq', a: endA + 1 + s, b: endB + 1 + s });

    // Build side-by-side & unified rows, pairing consecutive del+add blocks for inline word/char highlight
    var splitRows = [], uniRows = [];
    var added = 0, removed = 0, unchanged = 0;
    var idx = 0;
    while (idx < ops.length) {
      var op = ops[idx];
      if (op.k === 'eq') {
        unchanged++;
        var txtEq = aLines[op.a];
        if (!opts.onlyChanged) {
          splitRows.push({
            type: 'eq',
            lnL: op.a + 1, segsL: [{ t: txtEq, c: false }],
            lnR: op.b + 1, segsR: [{ t: bLines[op.b], c: false }]
          });
          uniRows.push({ type: 'eq', lnL: op.a + 1, lnR: op.b + 1, sign: ' ', segs: [{ t: txtEq, c: false }] });
        }
        idx++;
      } else {
        var dels = [], adds = [];
        while (idx < ops.length && ops[idx].k !== 'eq') {
          if (ops[idx].k === 'del') dels.push(ops[idx].a);
          else adds.push(ops[idx].b);
          idx++;
        }
        removed += dels.length;
        added += adds.length;
        var maxLen = Math.max(dels.length, adds.length);
        for (var k = 0; k < maxLen; k++) {
          var hasD = k < dels.length, hasA = k < adds.length;
          if (hasD && hasA) {
            var pair = inlineSegs(aLines[dels[k]], bLines[adds[k]]);
            splitRows.push({
              type: 'chg',
              lnL: dels[k] + 1, segsL: pair[0],
              lnR: adds[k] + 1, segsR: pair[1]
            });
            uniRows.push({ type: 'del', lnL: dels[k] + 1, lnR: '', sign: '-', segs: pair[0] });
            uniRows.push({ type: 'add', lnL: '', lnR: adds[k] + 1, sign: '+', segs: pair[1] });
          } else if (hasD) {
            var td = aLines[dels[k]];
            splitRows.push({
              type: 'del',
              lnL: dels[k] + 1, segsL: [{ t: td, c: false }],
              lnR: '', segsR: []
            });
            uniRows.push({ type: 'del', lnL: dels[k] + 1, lnR: '', sign: '-', segs: [{ t: td, c: false }] });
          } else if (hasA) {
            var ta = bLines[adds[k]];
            splitRows.push({
              type: 'add',
              lnL: '', segsL: [],
              lnR: adds[k] + 1, segsR: [{ t: ta, c: false }]
            });
            uniRows.push({ type: 'add', lnL: '', lnR: adds[k] + 1, sign: '+', segs: [{ t: ta, c: false }] });
          }
        }
      }
    }

    return {
      splitRows: splitRows,
      uniRows: uniRows,
      added: added,
      removed: removed,
      unchanged: unchanged,
      identical: added === 0 && removed === 0 && fL.text === fR.text,
      warn: [fL.warn, fR.warn].filter(Boolean).join(' · ')
    };
  }

  function redactSecrets(input, rules) {
    var r = rules || {};
    var s = String(input === null || input === undefined ? '' : input);
    var counts = { pem: 0, conn: 0, jwt: 0, apikey: 0, env: 0, email: 0, phone: 0, ip: 0 };
    if (!s) return { output: '', total: 0, counts: counts };

    if (r.pem !== false) {
      s = s.replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, function () {
        counts.pem++;
        return '[REDACTED_PRIVATE_KEY]';
      });
    }
    if (r.conn !== false) {
      s = s.replace(/\b((?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqp|amqps|mssql):\/\/[^:\s/@]+:)([^@\s]+)(@)/gi, function (m, p1, p2, p3) {
        if (/^\[REDACTED/.test(p2)) return m;
        counts.conn++;
        return p1 + '[REDACTED_DB_PASS]' + p3;
      });
    }
    if (r.jwt !== false) {
      s = s.replace(/\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, function () {
        counts.jwt++;
        return '[REDACTED_JWT]';
      });
    }
    if (r.apikey !== false) {
      s = s.replace(/\b(Bearer\s+)([A-Za-z0-9._~+/=-]{16,})/gi, function (m, p1, p2) {
        if (/^\[REDACTED/.test(p2)) return m;
        counts.apikey++;
        return p1 + '[REDACTED_TOKEN]';
      });
      s = s.replace(/\b(?:sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{22,}|AIza[0-9A-Za-z_-]{32,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{16,}|glpat-[A-Za-z0-9_-]{16,})\b/g, function () {
        counts.apikey++;
        return '[REDACTED_API_KEY]';
      });
    }
    if (r.env !== false) {
      // JSON / JS / YAML / .env key-value pairs for secret-named keys
      s = s.replace(/([\"\']?[A-Za-z0-9_.-]*(?:PASSWORD|PASSWD|PWD|SECRET|TOKEN|API_KEY|APIKEY|APP_KEY|PRIVATE_KEY|ACCESS_KEY|CLIENT_SECRET|SESSION_ID|COOKIE|AUTH_KEY)[A-Za-z0-9_.-]*[\"\']?\s*[:=]\s*)([\"\']?)([^\r\n\"\',;}\s][^,\r\n\"\';}]*)(\2)/gi, function (m, pre, q, val, q2) {
        var trimmed = val.trim();
        if (!trimmed || /^(\[REDACTED|true|false|null|undefined|\$\{|\{\{)/i.test(trimmed)) return m;
        counts.env++;
        return pre + q + '[REDACTED_SECRET]' + q2;
      });
    }
    if (r.email !== false) {
      s = s.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,12}\b/g, function () {
        counts.email++;
        return '[REDACTED_EMAIL]';
      });
    }
    if (r.phone !== false) {
      s = s.replace(/(?:^|[\s:(,"'])(\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,5}(?=$|[\s:),."'])/gm, function (m) {
        var digits = m.replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 15) return m;
        if (!/^(62|08|8\d|1\d|\d{10,})/.test(digits)) return m;
        var lead = m.match(/^[\s:(,"']/) ? m.charAt(0) : '';
        counts.phone++;
        return lead + '[REDACTED_PHONE]';
      });
    }
    if (r.ip !== false) {
      s = s.replace(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, function (ip) {
        if (ip === '0.0.0.0' || ip === '127.0.0.1') return ip;
        counts.ip++;
        return '[REDACTED_IP]';
      });
    }

    var total = Object.keys(counts).reduce(function (a, k) { return a + counts[k]; }, 0);
    return { output: s, total: total, counts: counts };
  }

  window.AppDiff = {
    computeDiff: computeDiff,
    redactSecrets: redactSecrets
  };
})();
