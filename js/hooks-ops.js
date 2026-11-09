// ============================================================
//  Skrip "Hook tab lain": dipasang lewat console/bookmarklet DI TAB TARGET (bukan di sini).
//  Menyadap fetch/XHR + SubtleCrypto.decrypt supaya request & hasil dekripsi asli terbaca
//  apa adanya, sesaat setelah aplikasi target memanggilnya sendiri dengan key ephemeral-nya.
//  Jalan di console: CSP halaman target tidak berlaku untuk kode yang dieksekusi dari sana.
// ============================================================
// Penjaga reload untuk semua skrip yang dipasang di tab target (Hook, Rate, RTO, Middleware, Pup).
// Selama panelnya masih tampil, reload/pindah halaman yang TIDAK dipicu user (mis. auto-reload aplikasi saat
// koneksi gagal, redirect dari skrip) memunculkan dialog konfirmasi bawaan browser: Muat ulang (hook berhenti)
// atau Batal (tetap di halaman, hook jalan terus). Klik/tombol user <= 1,5 dtk sebelumnya dianggap sengaja.
// Teks dialog ditentukan browser (tidak bisa diubah) dan hanya muncul bila user sudah pernah berinteraksi dengan halaman.
function hookGuardInstall() {
  var g = window.__hookGuard;
  if (g) return;
  g = window.__hookGuard = { act: 0, allow: false, els: [] };
  g.add = function (p) { if (p && g.els.indexOf(p) < 0) g.els.push(p); };
  g.mark = function () { g.act = Date.now(); };
  ['mousedown', 'keydown', 'touchstart'].forEach(function (t) { document.addEventListener(t, function () { g.act = Date.now(); }, true); });
  window.addEventListener('beforeunload', function (e) {
    var live = g.els.some(function (p) { return p.isConnected && p.style.display !== 'none'; });
    if (!live || g.allow || Date.now() - g.act < 1500) return undefined;
    e.preventDefault();
    e.returnValue = '';
    return '';
  });
}
const GUARD_LINES = ['  (' + hookGuardInstall.toString() + ')();', '  window.__hookGuard.add(panel);'];
// Baris mkBtn dipakai bersama oleh HOOK_SCRIPT dan RATE_SCRIPT (hindari duplikasi).
const MKBTN_LINES = [
  '  function mkBtn(label, fn) {',
  '    var b = document.createElement("button"); b.textContent = label;',
  '    Object.assign(b.style, { background: "#2c211b", color: "#f3ece4", border: "1px solid #453429", borderRadius: "5px", padding: "3px 8px", cursor: "pointer", fontSize: "11px" });',
  '    b.onclick = fn; return b;',
  '  }'
];
const HOOK_BODY_LINES = [
  '  if (window.__apiHook) window.__apiHook.close();',
  '  function pretty(t) { try { return JSON.stringify(JSON.parse(t), null, 2); } catch (e) { return t; } }',
  '  function bodyToText(b) {',
  '    if (b == null) return null;',
  '    if (typeof b === "string") return b;',
  '    try { if (b instanceof URLSearchParams) return b.toString(); } catch (e) {}',
  '    try { if (b instanceof FormData) { var o = {}; b.forEach(function (v, k) { o[k] = typeof v === "string" ? v : "[file]"; }); return JSON.stringify(o); } } catch (e) {}',
  '    try { return String(b); } catch (e) { return "[tidak terbaca]"; }',
  '  }',
  '  function parseHeaders(raw) {',
  '    var o = {}; String(raw || "").trim().split(/\\r?\\n/).forEach(function (line) { var i = line.indexOf(":"); if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }); return o;',
  '  }',
  ...MKBTN_LINES,
  '  var panel = document.createElement("div");',
  '  Object.assign(panel.style, { position: "fixed", right: "12px", bottom: "12px", width: "440px", height: "420px", minWidth: "300px", minHeight: "180px", maxWidth: "90vw", maxHeight: "90vh", resize: "both", overflow: "hidden", background: "linear-gradient(160deg, #211914 0%, #14100d 100%)", color: "#f3ece4", font: "12px/1.4 Consolas,monospace", border: "1px solid #453429", borderRadius: "10px", boxShadow: "0 12px 30px rgba(0,0,0,.55)", zIndex: 2147483647, display: "flex", flexDirection: "column" });',
  '  var head = document.createElement("div");',
  '  Object.assign(head.style, { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderBottom: "1px solid #3e2f25", background: "linear-gradient(135deg, #2d2119 0%, #201813 100%)", borderRadius: "10px 10px 0 0", flexShrink: "0" });',
  '  var title = document.createElement("b"); title.textContent = "API Hook"; title.style.flex = "1";',
  '  var body = document.createElement("div");',
  '  Object.assign(body.style, { overflow: "auto", padding: "8px 10px", flex: "1" });',
  '  var entries = [], uniq = [], byKey = {};',
  '  var exportBtn = mkBtn("export json", function () {',
  '    var data = uniq.map(function (w) { var r = w.rec; return { method: r.method, url: r.url, hits: w.count, reqHeaders: r.reqHeaders || {}, reqBody: bodyToText(r.reqBody), reqPlain: r.reqPlain || null, status: r.status != null ? r.status : null, resHeaders: r.resHeaders || {}, plain: r.plain || null, resBody: r.resBody != null ? r.resBody : null, resend: !!r.resend }; });',
  '    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });',
  '    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "api-hook-" + location.hostname + "-" + Date.now() + ".json";',
  '    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);',
  '  });',
  '  exportBtn.title = "Unduh semua request tercatat sebagai JSON (link, method, header, body, status)";',
  '  var expandBtn = mkBtn("buka semua", function () {',
  '    var open = expandBtn.textContent === "buka semua";',
  '    entries.forEach(function (en) { en.pre.style.display = open ? "block" : "none"; en.arrow.textContent = open ? String.fromCharCode(9662) : String.fromCharCode(9656); });',
  '    expandBtn.textContent = open ? "tutup semua" : "buka semua";',
  '  });',
  '  var clearBtn = mkBtn("bersihkan", function () { while (body.firstChild) body.removeChild(body.firstChild); entries.length = 0; uniq.length = 0; byKey = {}; count = 0; expandBtn.textContent = "buka semua"; });',
  '  var minimized = false, prevHeight = "";',
  '  var minBtn = mkBtn(String.fromCharCode(8211), function () {',
  '    minimized = !minimized;',
  '    body.style.display = minimized ? "none" : "block";',
  '    if (minimized) { prevHeight = panel.style.height; panel.style.height = "auto"; panel.style.resize = "none"; }',
  '    else { panel.style.height = prevHeight || "420px"; panel.style.resize = "both"; }',
  '    minBtn.textContent = minimized ? String.fromCharCode(9633) : String.fromCharCode(8211);',
  '    minBtn.title = minimized ? "Tampilkan" : "Kecilkan";',
  '  });',
  '  minBtn.title = "Kecilkan";',
  '  var closeBtn = mkBtn(String.fromCharCode(10005), function () { restore(); panel.remove(); });',
  '  head.append(title, minBtn, exportBtn, expandBtn, clearBtn, closeBtn);',
  '  panel.append(head, body);',
  '  document.body.appendChild(panel);',
  ...GUARD_LINES,
  '  head.style.cursor = "move";',
  '  var dragging = false, dragDx = 0, dragDy = 0;',
  '  head.addEventListener("mousedown", function (e) {',
  '    if (e.target !== head && e.target !== title) return;',
  '    dragging = true;',
  '    var rect = panel.getBoundingClientRect();',
  '    dragDx = e.clientX - rect.left; dragDy = e.clientY - rect.top;',
  '    panel.style.right = "auto"; panel.style.bottom = "auto";',
  '    panel.style.left = rect.left + "px"; panel.style.top = rect.top + "px";',
  '    e.preventDefault();',
  '  });',
  '  function onDragMove(e) {',
  '    if (!dragging) return;',
  '    var x = Math.min(Math.max(0, e.clientX - dragDx), window.innerWidth - panel.offsetWidth);',
  '    var y = Math.min(Math.max(0, e.clientY - dragDy), window.innerHeight - panel.offsetHeight);',
  '    panel.style.left = x + "px"; panel.style.top = y + "px";',
  '  }',
  '  function onDragEnd() { dragging = false; }',
  '  window.addEventListener("mousemove", onDragMove);',
  '  window.addEventListener("mouseup", onDragEnd);',
  '  var count = 0;',
  '  function mkField(labelText, value, multiline) {',
  '    var wrap = document.createElement("label");',
  '    Object.assign(wrap.style, { display: "block", margin: "6px 0", color: "#aa9888" });',
  '    wrap.textContent = labelText;',
  '    var f = document.createElement(multiline ? "textarea" : "input");',
  '    f.value = value == null ? "" : value;',
  '    Object.assign(f.style, { display: "block", width: "100%", marginTop: "3px", boxSizing: "border-box", background: "#110d0b", color: "#f3ece4", border: "1px solid #3e2f25", borderRadius: "5px", padding: "4px 6px", font: "12px/1.4 Consolas,monospace" });',
  '    if (multiline) { f.style.minHeight = "60px"; f.style.resize = "vertical"; }',
  '    wrap.appendChild(f);',
  '    return { wrap: wrap, field: f };',
  '  }',
  '  function openEditor(rec) {',
  '    var ov = document.createElement("div");',
  '    Object.assign(ov.style, { position: "absolute", top: "0", left: "0", right: "0", bottom: "0", background: "#16110e", display: "flex", flexDirection: "column", zIndex: "5" });',
  '    var oh = document.createElement("div");',
  '    Object.assign(oh.style, { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderBottom: "1px solid #3e2f25", background: "linear-gradient(135deg, #2d2119 0%, #201813 100%)", flexShrink: "0" });',
  '    var ot = document.createElement("b"); ot.textContent = "Edit & kirim ulang"; ot.style.flex = "1";',
  '    var backBtn = mkBtn(String.fromCharCode(8592) + " kembali", function () { ov.remove(); });',
  '    oh.append(ot, backBtn);',
  '    var form = document.createElement("div");',
  '    Object.assign(form.style, { overflow: "auto", padding: "8px 10px", flex: "1" });',
  '    var mUrl = document.createElement("div"); Object.assign(mUrl.style, { display: "flex", gap: "6px" });',
  '    var m = mkField("Method", rec.method || "GET", false); m.wrap.style.flex = "0 0 90px";',
  '    var u = mkField("URL", rec.url || "", false); u.wrap.style.flex = "1";',
  '    mUrl.append(m.wrap, u.wrap);',
  '    var hdrJson = ""; try { hdrJson = JSON.stringify(rec.reqHeaders || {}, null, 2); } catch (e) {}',
  '    var hdr = mkField("Headers (JSON)", hdrJson, true);',
  '    var bod = mkField("Body", rec.reqBody != null ? String(rec.reqBody) : "", true);',
  '    var note = document.createElement("div");',
  '    Object.assign(note.style, { color: "#f59e0b", margin: "4px 0", fontSize: "11px" });',
  '    note.textContent = "Body data= terenkripsi tidak bisa diedit manual (key per sesi); ubah query/header saja.";',
  '    var sendBtn = mkBtn("Kirim ulang", function () {',
  '      var headers = {}; try { headers = JSON.parse(hdr.field.value || "{}"); } catch (e) { note.textContent = "Headers bukan JSON valid."; return; }',
  '      resend(m.field.value.trim().toUpperCase() || "GET", u.field.value.trim(), headers, bod.field.value);',
  '      ov.remove();',
  '    });',
  '    sendBtn.style.background = "linear-gradient(135deg, #c87840 0%, #985225 100%)"; sendBtn.style.borderColor = "#c87840";',
  '    var btns = document.createElement("div"); Object.assign(btns.style, { display: "flex", gap: "6px", marginTop: "6px" });',
  '    btns.append(sendBtn);',
  '    form.append(mUrl, hdr.wrap, bod.wrap, note, btns);',
  '    ov.append(oh, form);',
  '    return ov;',
  '  }',
  '  function addEntry(rec) {',
  '    var key = rec.method + " " + rec.url;',
  '    var ex = byKey[key];',
  '    if (ex) {',
  '      ex.count++; ex.rec = rec; rec.slot = ex.pre;',
  '      ex.titleEl.textContent = ex.label + " \\u00d7" + ex.count;',
  '      body.insertBefore(ex.box, body.firstChild);',
  '      return ex.pre;',
  '    }',
  '    count++;',
  '    var box = document.createElement("div");',
  '    Object.assign(box.style, { marginBottom: "6px", borderRadius: "6px", border: "1px solid #352820", overflow: "hidden" });',
  '    var h = document.createElement("div");',
  '    Object.assign(h.style, { display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px", background: "#231a14", color: "#e59a63", cursor: "pointer" });',
  '    var arrow = document.createElement("span"); arrow.textContent = String.fromCharCode(9656); arrow.style.flexShrink = "0";',
  '    var titleEl = document.createElement("span");',
  '    Object.assign(titleEl.style, { flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });',
  '    var label = "#" + count + (rec.resend ? " \\u21bb " : " ") + rec.method + " " + String(rec.url).replace(location.origin, "");',
  '    titleEl.textContent = label;',
  '    var pre = document.createElement("pre");',
  '    Object.assign(pre.style, { whiteSpace: "pre-wrap", wordBreak: "break-all", margin: "0", padding: "8px", color: "#b6a494", background: "#110d0b", display: "none" });',
  '    pre.textContent = "menunggu" + String.fromCharCode(8230);',
  '    var editBtn = mkBtn(String.fromCharCode(8635), function (e) {',
  '      e.stopPropagation();',
  '      var existing = panel.querySelector(".hook-ed");',
  '      if (existing) existing.remove();',
  '      var ov = openEditor(rec); ov.className = "hook-ed"; panel.appendChild(ov);',
  '    });',
  '    editBtn.title = "Edit & kirim ulang";',
  '    var copyBtn = mkBtn(String.fromCharCode(10697), function (e) {',
  '      e.stopPropagation();',
  '      navigator.clipboard.writeText(pre.textContent).then(function () {',
  '        var old = copyBtn.textContent; copyBtn.textContent = String.fromCharCode(10003);',
  '        setTimeout(function () { copyBtn.textContent = old; }, 1200);',
  '      });',
  '    });',
  '    copyBtn.title = "Salin isi";',
  '    h.onclick = function () {',
  '      var open = pre.style.display !== "none";',
  '      pre.style.display = open ? "none" : "block";',
  '      arrow.textContent = open ? String.fromCharCode(9656) : String.fromCharCode(9662);',
  '    };',
  '    h.append(arrow, titleEl, editBtn, copyBtn);',
  '    box.append(h, pre);',
  '    body.insertBefore(box, body.firstChild);',
  '    entries.push({ pre: pre, arrow: arrow });',
  '    byKey[key] = { box: box, pre: pre, titleEl: titleEl, label: label, count: 1, rec: rec };',
  '    uniq.push(byKey[key]);',
  '    rec.slot = pre;',
  '    return pre;',
  '  }',
  '  function resend(method, url, headers, bodyText) {',
  '    var hdrs = {}; Object.keys(headers).forEach(function (k) { if (headers[k] != null) hdrs[k] = String(headers[k]); });',
  '    var noBody = method === "GET" || method === "HEAD" || !bodyText;',
  '    var rec = { url: url, method: method, reqBody: noBody ? null : bodyText, reqHeaders: hdrs, reqPlain: null, plain: null, resend: true };',
  '    addEntry(rec); pending.push(rec); render(rec);',
  '    origFetch(url, { method: method, headers: hdrs, body: noBody ? undefined : bodyText, credentials: "include" })',
  '      .then(function (res) { rec.status = res.status; var rh = {}; try { res.headers.forEach(function (v, k) { rh[k] = v; }); } catch (e) {} rec.resHeaders = rh; return res.text().then(function (t) { if (!rec.plain) { rec.resBody = t; render(rec); } }); })',
  '      .catch(function (err) { rec.resBody = "error: " + err.message; render(rec); });',
  '  }',
  '  function render(rec) {',
  '    var parts = [];',
  '    parts.push(String.fromCharCode(9656) + " " + rec.method + " " + rec.url);',
  '    if (rec.reqHeaders && Object.keys(rec.reqHeaders).length) parts.push("» header req: " + pretty(JSON.stringify(rec.reqHeaders)));',
  '    if (rec.reqPlain) parts.push("» sebelum dienkripsi: " + pretty(rec.reqPlain));',
  '    var bt = bodyToText(rec.reqBody);',
  '    if (bt) parts.push("» body req: " + bt);',
  '    if (rec.status != null) parts.push("« status: " + rec.status);',
  '    if (rec.resHeaders && Object.keys(rec.resHeaders).length) parts.push("« header res: " + pretty(JSON.stringify(rec.resHeaders)));',
  '    if (rec.plain) parts.push("« dekripsi: " + pretty(rec.plain));',
  '    else if (rec.resBody != null) parts.push("« respons: " + pretty(rec.resBody));',
  '    rec.slot.textContent = parts.join("\\n") || "(tidak ada body)";',
  '  }',
  '  var pending = [], pendingPlain = [];',
  '  var origFetch = window.fetch;',
  '  window.fetch = function (input, init) {',
  '    var url = typeof input === "string" ? input : input.url;',
  '    var method = (init && init.method) || "GET";',
  '    var hdrs = {}; try { if (init && init.headers) new Headers(init.headers).forEach(function (v, k) { hdrs[k] = v; }); } catch (e) {}',
  '    var rec = { url: url, method: method, reqBody: init && init.body, reqHeaders: hdrs, reqPlain: pendingPlain.shift() || null, plain: null };',
  '    addEntry(rec); pending.push(rec); render(rec);',
  '    var p = origFetch.apply(this, arguments);',
  '    p.then(function (res) {',
  '      try { rec.status = res.status; var rh = {}; res.headers.forEach(function (v, k) { rh[k] = v; }); rec.resHeaders = rh; render(rec); } catch (e) {}',
  '      try { res.clone().text().then(function (t) { if (!rec.plain) { rec.resBody = t; render(rec); } }, function () {}); } catch (e) {}',
  '    }, function (err) {',
  // Cabang pengamat saja: error asli tetap diterima pemanggil lewat p (yang dikembalikan apa adanya).
  '      try { rec.status = "error: " + (err && err.message || err); render(rec); } catch (e) {}',
  '    });',
  '    return p;',
  '  };',
  '  var OrigOpen = XMLHttpRequest.prototype.open, OrigSend = XMLHttpRequest.prototype.send, OrigSetHdr = XMLHttpRequest.prototype.setRequestHeader;',
  '  XMLHttpRequest.prototype.open = function (method, url) { this.__hookUrl = url; this.__hookMethod = method; this.__hookHdrs = {}; return OrigOpen.apply(this, arguments); };',
  '  XMLHttpRequest.prototype.setRequestHeader = function (k, v) { try { if (this.__hookHdrs) this.__hookHdrs[k] = v; } catch (e) {} return OrigSetHdr.apply(this, arguments); };',
  '  XMLHttpRequest.prototype.send = function (reqBody) {',
  '    var self = this;',
  '    var rec = { url: this.__hookUrl, method: this.__hookMethod, reqBody: reqBody, reqHeaders: this.__hookHdrs || {}, reqPlain: pendingPlain.shift() || null, plain: null };',
  '    addEntry(rec); pending.push(rec); render(rec);',
  '    this.addEventListener("loadend", function () { try { rec.status = self.status || "error"; rec.resHeaders = parseHeaders(self.getAllResponseHeaders()); if (!rec.plain) rec.resBody = self.responseText; render(rec); } catch (e) {} });',
  '    return OrigSend.apply(this, arguments);',
  '  };',
  '  var protoSubtle = SubtleCrypto.prototype, origDecrypt = protoSubtle.decrypt, origEncrypt = protoSubtle.encrypt;',
  '  protoSubtle.decrypt = function () {',
  '    var args = arguments;',
  '    return origDecrypt.apply(this, args).then(function (r) {',
  '      try {',
  '        var text = new TextDecoder().decode(r);',
  '        var rec = pending[pending.length - 1];',
  '        if (rec && text) { rec.plain = text; render(rec); }',
  '      } catch (e) {}',
  '      return r;',
  '    });',
  '  };',
  '  protoSubtle.encrypt = function (algo, key, data) {',
  '    var args = arguments, plain = null;',
  '    try { plain = new TextDecoder().decode(data); } catch (e) {}',
  '    return origEncrypt.apply(this, args).then(function (r) { if (plain) pendingPlain.push(plain); return r; });',
  '  };',
  '  function restore() { window.fetch = origFetch; XMLHttpRequest.prototype.open = OrigOpen; XMLHttpRequest.prototype.send = OrigSend; XMLHttpRequest.prototype.setRequestHeader = OrigSetHdr; protoSubtle.decrypt = origDecrypt; protoSubtle.encrypt = origEncrypt; window.removeEventListener("mousemove", onDragMove); window.removeEventListener("mouseup", onDragEnd); }',
  '  window.__apiHook = { close: function () { restore(); panel.remove(); } };'
];
const HOOK_SCRIPT = localizeScript(['(function () {', ...HOOK_BODY_LINES, '})();'].join('\n'));

// ============================================================
//  Parser curl ringan: dipakai di halaman ini sendiri untuk mengisi
//  form "Tes Rate Limiter" dari teks curl yang ditempel (mis. "Copy as cURL").
// ============================================================
const CURL_ESC = { n: '\n', t: '\t', r: '\r' };
function readQuoted(s, i, ansi) {
  let cur = '';
  for (; i < s.length && s[i] !== "'"; i++) {
    if (ansi && s[i] === '\\' && i + 1 < s.length) { i++; cur += CURL_ESC[s[i]] || s[i]; } else cur += s[i];
  }
  return [cur, i + 1];
}
function readDoubleQuoted(s, i) {
  let cur = '';
  for (; i < s.length && s[i] !== '"'; i++) {
    if (s[i] === '\\' && i + 1 < s.length) i++;
    cur += s[i];
  }
  return [cur, i + 1];
}
function tokenizeCurl(src) {
  const s = src.replace(/\\\r?\n/g, ' ');
  const out = [];
  let cur = '', has = false, i = 0, r;
  while (i < s.length) {
    const c = s[i];
    if (c === "'" || (c === '$' && s[i + 1] === "'")) {
      r = readQuoted(s, c === '$' ? i + 2 : i + 1, c === '$'); cur += r[0]; i = r[1]; has = true;
    } else if (c === '"') {
      r = readDoubleQuoted(s, i + 1); cur += r[0]; i = r[1]; has = true;
    } else if (/\s/.test(c)) {
      if (has) { out.push(cur); cur = ''; has = false; }
      i++;
    } else if (c === '\\') { cur += s[i + 1] || ''; i += 2; has = true; }
    else { cur += c; has = true; i++; }
  }
  if (has) out.push(cur);
  return out;
}
const addHeader = (r, v) => { const k = v.indexOf(':'); if (k > 0) r.headers.push([v.slice(0, k).trim(), v.slice(k + 1).trim()]); };
const addBody = (r, v) => { r.body = r.body ? r.body + '&' + v : v; };
const setMethod = (r, v) => { r.method = v.toUpperCase(); };
const CURL_FLAGS = { '--url': (r, v) => { r.url = v; } };
[['-X', '--request', setMethod], ['-H', '--header', addHeader], ['-b', '--cookie', (r, v) => addHeader(r, 'Cookie: ' + v)]].forEach(([a, b, fn]) => { CURL_FLAGS[a] = fn; CURL_FLAGS[b] = fn; });
['-d', '--data', '--data-raw', '--data-binary', '--data-urlencode', '--data-ascii'].forEach(f => { CURL_FLAGS[f] = addBody; });
function parseCurl(src) {
  const t = tokenizeCurl(src), r = { method: '', url: '', headers: [], body: '' };
  for (let i = 0; i < t.length; i++) {
    const a = t[i];
    if (CURL_FLAGS[a]) CURL_FLAGS[a](r, t[++i] || '');
    else if (a === '-I' || a === '--head') r.method = 'HEAD';
    else if (/^https?:\/\//i.test(a)) r.url = a;
  }
  r.method = r.method || (r.body ? 'POST' : 'GET');
  return r;
}

// ============================================================
//  Skrip "Tes Rate Limiter": sama prinsipnya dengan HOOK_SCRIPT -- dipasang
//  lewat console/bookmarklet DI TAB TARGET supaya cookie sesi ikut otomatis
//  (same-origin) dan tidak kena CORS seperti bila dikirim dari halaman ini.
//  Mengulang SATU request apa adanya sejumlah kali dengan jeda yang ditentukan,
//  lalu menampilkan status/waktu/header Retry-After tiap percobaan.
// ============================================================
// Header yang tidak bisa (atau tidak perlu) diset manual lewat fetch() dari halaman ini.
const RATE_FORBIDDEN_HDR = /^(cookie2?|user-agent|referer|origin|host|connection|content-length|date|dnt|expect|te|trailer|transfer-encoding|upgrade|via|keep-alive|accept-encoding|accept-charset|sec-.*|proxy-.*)$/i;
function buildRateScript(cfg) {
  const headers = {};
  cfg.headers.forEach(([k, v]) => { headers[k] = v; });
  const payload = JSON.stringify({ method: cfg.method, url: cfg.url, headers, body: cfg.body, count: cfg.count, delay: cfg.delay });
  return localizeScript([
    '(function () {',
    '  if (window.__rateHook) window.__rateHook.close();',
    '  var cfg = ' + payload + ';',
    '  var FORBIDDEN = /^(cookie2?|user-agent|referer|origin|host|connection|content-length|date|dnt|expect|te|trailer|transfer-encoding|upgrade|via|keep-alive|accept-encoding|accept-charset|sec-.*|proxy-.*)$/i;',
    '  var hdrs = {};',
    '  Object.keys(cfg.headers).forEach(function (k) { if (!FORBIDDEN.test(k)) hdrs[k] = cfg.headers[k]; });',
    ...MKBTN_LINES,
    '  var panel = document.createElement("div");',
    '  Object.assign(panel.style, { position: "fixed", left: "12px", bottom: "12px", width: "380px", height: "360px", minWidth: "260px", minHeight: "160px", maxWidth: "90vw", maxHeight: "90vh", resize: "both", overflow: "hidden", background: "linear-gradient(160deg, #211914 0%, #14100d 100%)", color: "#f3ece4", font: "12px/1.4 Consolas,monospace", border: "1px solid #453429", borderRadius: "10px", boxShadow: "0 12px 30px rgba(0,0,0,.55)", zIndex: 2147483647, display: "flex", flexDirection: "column" });',
    '  var head = document.createElement("div");',
    '  Object.assign(head.style, { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderBottom: "1px solid #3e2f25", background: "linear-gradient(135deg, #2d2119 0%, #201813 100%)", borderRadius: "10px 10px 0 0", flexShrink: "0" });',
    '  var title = document.createElement("b"); title.textContent = "Rate Limit Test"; title.style.flex = "1";',
    '  var summary = document.createElement("div");',
    '  Object.assign(summary.style, { padding: "6px 10px", color: "#aa9888", borderBottom: "1px solid #2f241d", flexShrink: "0" });',
    '  summary.textContent = "0 / " + cfg.count + " " + String.fromCharCode(183) + " bersiap...";',
    '  var body = document.createElement("div");',
    '  Object.assign(body.style, { overflow: "auto", padding: "6px 10px", flex: "1" });',
    '  var stopped = false, rows = [], counts = {};',
    '  var stopBtn = mkBtn("stop", function () { stopped = true; });',
    '  var csvBtn = mkBtn("salin csv", function () {',
    '    var lines = ["index,status,ms,retry_after"].concat(rows.map(function (r) { return [r.i, r.status, r.ms, r.retryAfter || ""].join(","); }));',
    '    navigator.clipboard.writeText(lines.join("\\n"));',
    '    var old = csvBtn.textContent; csvBtn.textContent = "tersalin"; setTimeout(function () { csvBtn.textContent = old; }, 1200);',
    '  });',
    '  var closeBtn = mkBtn(String.fromCharCode(10005), function () { stopped = true; panel.remove(); });',
    '  head.append(title, stopBtn, csvBtn, closeBtn);',
    '  panel.append(head, summary, body);',
    '  document.body.appendChild(panel);',
    ...GUARD_LINES,
    '  function addRow(i, status, ms, retryAfter, err) {',
    '    rows.push({ i: i, status: status, ms: ms, retryAfter: retryAfter });',
    '    var key = err ? "error" : (status === 429 ? "429" : status >= 500 ? "5xx" : status >= 400 ? "4xx" : "2xx/3xx");',
    '    counts[key] = (counts[key] || 0) + 1;',
    '    var row = document.createElement("div");',
    '    row.style.color = status === 429 ? "#fbbf24" : (err || status >= 400) ? "#f87171" : "#4ade80";',
    '    row.textContent = "#" + i + " " + status + (err ? " (" + err + ")" : "") + " " + String.fromCharCode(183) + " " + ms + "ms" + (retryAfter ? " " + String.fromCharCode(183) + " Retry-After: " + retryAfter : "");',
    '    body.insertBefore(row, body.firstChild);',
    '    summary.textContent = rows.length + " / " + cfg.count + " " + String.fromCharCode(183) + " " + Object.keys(counts).map(function (k) { return k + ":" + counts[k]; }).join("  ");',
    '  }',
    '  function send(i) {',
    '    var t0 = performance.now();',
    '    var noBody = cfg.method === "GET" || cfg.method === "HEAD" || !cfg.body;',
    '    return fetch(cfg.url, { method: cfg.method, headers: hdrs, body: noBody ? undefined : cfg.body, credentials: "include" })',
    '      .then(function (res) { addRow(i, res.status, Math.round(performance.now() - t0), res.headers.get("retry-after")); })',
    '      .catch(function (e) { addRow(i, "error", Math.round(performance.now() - t0), null, e.message); });',
    '  }',
    '  (async function run() {',
    '    for (var i = 1; i <= cfg.count && !stopped; i++) {',
    '      await send(i);',
    '      if (i < cfg.count && cfg.delay) await new Promise(function (r) { setTimeout(r, cfg.delay); });',
    '    }',
    '  })();',
    '  window.__rateHook = { close: function () { stopped = true; panel.remove(); } };',
    '})();'
  ].join('\n'));
}

// ============================================================
//  Tes RTO (slow request): body request dikirim menetes pada laju tertentu
//  (kbps) untuk menguji request-read-timeout server. Satu koneksi lambat,
//  bersifat diagnostik (OWASP Slow HTTP / CWE-400) -- bukan membanjiri server.
//  Streaming upload lewat fetch({ body: ReadableStream, duplex: 'half' }).
// ============================================================
const RTO_TICK_MS = 100; // tiap potongan body dikirim sekali per interval ini
// Clamp angka ke rentang [lo, hi]; dipakai agar input di luar batas tetap aman.
// Konfigurasi Rate Limiter tidak valid -> pesan (bukan diam): jumlah 1-300, jeda 0-5000 ms, URL http(s).
function rateCfgError(rl) {
  if (!Number.isInteger(rl.count) || rl.count < 1 || rl.count > 300) return tr('rl_err_count');
  if (typeof rl.delay !== 'number' || !Number.isFinite(rl.delay) || rl.delay < 0 || rl.delay > 5000) return tr('rl_err_delay');
  return /^https?:\/\/[^/\s]+/i.test(rl.url.trim()) ? '' : tr('err_url_invalid');
}
function clampNum(v, lo, hi) { return Math.min(hi, Math.max(lo, Number(v) || lo)); }
// Metode berbody yang valid untuk slow request; selain itu dipaksa POST.
function rtoMethod(m) { return /^(POST|PUT|PATCH|DELETE)$/i.test(m) ? m.toUpperCase() : 'POST'; }
// Payload sebesar sizeKb (KB) sebagai Uint8Array; isinya body (diulang) bila ada,
// selain itu byte 'A'. Hanya untuk mengisi aliran lambat, bukan data bermakna.
function rtoPayload(body, sizeKb) {
  const total = Math.max(1, Math.round(sizeKb * 1024));
  const seed = body ? new TextEncoder().encode(body) : new Uint8Array([65]);
  const out = new Uint8Array(total);
  for (let i = 0; i < total; i++) out[i] = seed[i % seed.length] || 65;
  return out;
}
// ReadableStream yang mengeluarkan ~ (kbps) data per detik dalam potongan kecil.
// onSent(off) melaporkan jumlah byte terkirim; isStopped() menghentikan aliran.
function slowBodyStream(bytes, kbps, onSent, isStopped) {
  const perSec = Math.max(1, kbps * 1000 / 8);
  const chunk = Math.max(1, Math.round(perSec * RTO_TICK_MS / 1000));
  let off = 0;
  return new ReadableStream({
    pull(ctrl) {
      return new Promise(resolve => {
        setTimeout(() => {
          if (isStopped() || off >= bytes.length) { ctrl.close(); resolve(); return; }
          const end = Math.min(off + chunk, bytes.length);
          ctrl.enqueue(bytes.subarray(off, end));
          off = end;
          if (onSent) onSent(off);
          resolve();
        }, RTO_TICK_MS);
      });
    }
  });
}

// Skrip RTO untuk Opsi 2: dipasang DI TAB TARGET (same-origin, cookie ikut).
function buildRtoScript(cfg) {
  const headers = {};
  cfg.headers.forEach(([k, v]) => { headers[k] = v; });
  const payload = JSON.stringify({ method: rtoMethod(cfg.method), url: cfg.url, headers, body: cfg.body, kbps: clampNum(cfg.kbps, 2, 100000), sizeKb: clampNum(cfg.sizeKb, 1, 10240), count: clampNum(cfg.count, 1, 5), delay: clampNum(cfg.delay, 0, 10000) });
  return localizeScript([
    '(function () {',
    '  if (window.__rtoHook) window.__rtoHook.close();',
    '  var cfg = ' + payload + ', TICK = 100;',
    '  var FORBIDDEN = /^(cookie2?|user-agent|referer|origin|host|connection|content-length|date|dnt|expect|te|trailer|transfer-encoding|upgrade|via|keep-alive|accept-encoding|accept-charset|sec-.*|proxy-.*)$/i;',
    '  var hdrs = {};',
    '  Object.keys(cfg.headers).forEach(function (k) { if (!FORBIDDEN.test(k)) hdrs[k] = cfg.headers[k]; });',
    '  var total = Math.max(1, Math.round(cfg.sizeKb * 1024));',
    '  var seed = cfg.body ? new TextEncoder().encode(cfg.body) : new Uint8Array([65]);',
    '  var bytes = new Uint8Array(total);',
    '  for (var b = 0; b < total; b++) bytes[b] = seed[b % seed.length] || 65;',
    ...MKBTN_LINES,
    '  var panel = document.createElement("div");',
    '  Object.assign(panel.style, { position: "fixed", left: "12px", bottom: "12px", width: "380px", height: "300px", minWidth: "260px", minHeight: "150px", maxWidth: "90vw", maxHeight: "90vh", resize: "both", overflow: "hidden", background: "linear-gradient(160deg, #211914 0%, #14100d 100%)", color: "#f3ece4", font: "12px/1.4 Consolas,monospace", border: "1px solid #453429", borderRadius: "10px", boxShadow: "0 12px 30px rgba(0,0,0,.55)", zIndex: 2147483647, display: "flex", flexDirection: "column" });',
    '  var head = document.createElement("div");',
    '  Object.assign(head.style, { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderBottom: "1px solid #3e2f25", background: "linear-gradient(135deg, #2d2119 0%, #201813 100%)", borderRadius: "10px 10px 0 0", flexShrink: "0" });',
    '  var title = document.createElement("b"); title.textContent = "RTO Test (" + cfg.kbps + " kbps)"; title.style.flex = "1";',
    '  var summary = document.createElement("div");',
    '  Object.assign(summary.style, { padding: "6px 10px", color: "#aa9888", borderBottom: "1px solid #2f241d", flexShrink: "0" });',
    '  summary.textContent = "0 / " + cfg.count + " " + String.fromCharCode(183) + " bersiap...";',
    '  var body = document.createElement("div");',
    '  Object.assign(body.style, { overflow: "auto", padding: "6px 10px", flex: "1" });',
    '  var stopped = false, rows = [], ctl = null;',
    '  var stopBtn = mkBtn("stop", function () { stopped = true; if (ctl) ctl.abort(); });',
    '  var csvBtn = mkBtn("salin csv", function () {',
    '    var lines = ["index,outcome,ms,sent,total,status"].concat(rows.map(function (r) { return [r.i, r.outcome, r.ms, r.sent, r.total, r.status].join(","); }));',
    '    navigator.clipboard.writeText(lines.join("\\n"));',
    '    var old = csvBtn.textContent; csvBtn.textContent = "tersalin"; setTimeout(function () { csvBtn.textContent = old; }, 1200);',
    '  });',
    '  var closeBtn = mkBtn(String.fromCharCode(10005), function () { stopped = true; if (ctl) ctl.abort(); panel.remove(); });',
    '  head.append(title, stopBtn, csvBtn, closeBtn);',
    '  panel.append(head, summary, body);',
    '  document.body.appendChild(panel);',
    ...GUARD_LINES,
    '  function addRow(r) {',
    '    rows.push(r);',
    '    var row = document.createElement("div");',
    '    row.style.color = r.outcome === "reset" ? "#fbbf24" : r.outcome === "done" ? "#4ade80" : "#f87171";',
    '    row.textContent = "#" + r.i + " " + r.label + " " + String.fromCharCode(183) + " " + r.ms + "ms " + String.fromCharCode(183) + " " + r.sent + "/" + r.total + "B" + (r.status ? " " + String.fromCharCode(183) + " " + r.status : "");',
    '    body.insertBefore(row, body.firstChild);',
    '    summary.textContent = rows.length + " / " + cfg.count + " selesai";',
    '  }',
    '  function send(i) {',
    '    ctl = new AbortController(); var t0 = performance.now(), off = 0;',
    '    var perSec = Math.max(1, cfg.kbps * 1000 / 8), chunk = Math.max(1, Math.round(perSec * TICK / 1000));',
    '    var stream = new ReadableStream({ pull: function (c) { return new Promise(function (res) { setTimeout(function () { if (stopped || off >= bytes.length) { c.close(); res(); return; } var end = Math.min(off + chunk, bytes.length); c.enqueue(bytes.subarray(off, end)); off = end; res(); }, TICK); }); } });',
    '    return fetch(cfg.url, { method: cfg.method, headers: hdrs, body: stream, duplex: "half", credentials: "include", signal: ctl.signal })',
    '      .then(function (res) { addRow({ i: i, outcome: "done", label: "selesai (tidak timeout)", ms: Math.round(performance.now() - t0), sent: off, total: bytes.length, status: res.status }); })',
    '      .catch(function (e) { var reset = !stopped && off > 0 && off < bytes.length; addRow({ i: i, outcome: stopped ? "stop" : reset ? "reset" : "error", label: stopped ? "dihentikan" : reset ? "diputus server (kemungkinan read timeout)" : ("gagal: " + e.message), ms: Math.round(performance.now() - t0), sent: off, total: bytes.length, status: "" }); });',
    '  }',
    '  (async function run() {',
    '    for (var i = 1; i <= cfg.count && !stopped; i++) {',
    '      await send(i);',
    '      if (i < cfg.count && cfg.delay && !stopped) await new Promise(function (r) { setTimeout(r, cfg.delay); });',
    '    }',
    '  })();',
    '  window.__rtoHook = { close: function () { stopped = true; if (ctl) ctl.abort(); panel.remove(); } };',
    '})();'
  ].join('\n'));
}

// ============================================================
//  Tab "Cek Basic Middleware": uji konformansi DEFENSIF apakah security
//  middleware target benar-benar MEMBLOKIR input buruk/berbahaya (harness
//  uji ASVS / ala ZAP active-scan terhadap aplikasi milik sendiri) -- BUKAN
//  untuk menyerang. Hanya untuk sistem yang Anda berwenang menguji.
//  Rujukan: OWASP ASVS v4 V5 (Validation, Sanitization & Encoding),
//  OWASP A03:2021 Injection, CWE-20 Improper Input Validation.
// ============================================================
// Util request-probe MURNI (tanpa ketergantungan luar) supaya definisi probe
// jadi SATU sumber kebenaran: dipakai langsung oleh app (Opsi 1) dan disisipkan
// apa adanya ke skrip Opsi 2 lewat .toString() -- menghindari duplikasi (SonarQube).
function mwQ(url, qs) { return url + (url.indexOf('?') >= 0 ? '&' : '?') + qs; }
function mwBaseBody() { return '{"username":"test","password":"test"}'; }
function mwJsonHdr() { return [['Content-Type', 'application/json']]; }
function mwRepeat(ch, n) { return new Array(Math.max(0, n) + 1).join(ch); }
// Verdict DEFENSIF: status blok (400/413/431) = pertahanan bekerja (LULUS);
// lolos ke aplikasi (2xx/401/403/500) = celah (GAGAL); gagal jaringan/CORS/TLS = ERROR.
function mwVerdictOf(status, hadError) {
  if (hadError) return 'ERROR';
  return (status === 400 || status === 413 || status === 431) ? 'LULUS' : 'GAGAL';
}
// Pesan server dari body {"message":"Request ditolak: ..."}; dipotong aman (anti layout-break).
function mwExtractMsg(txt) {
  if (!txt) return '';
  try { var j = JSON.parse(txt); if (j && j.message) return String(j.message).slice(0, 200); } catch (e) { /* bukan JSON */ }
  return String(txt).replace(/\s+/g, ' ').trim().slice(0, 160);
}
// Bangun SATU request sengaja-buruk dari spesifikasi probe deklaratif.
// Tiap 'op' menguji satu aturan middleware (lihat label i18n mw_p_*).
function mwBuildReq(p, cfg, size) {
  var method = cfg.method || 'POST';
  var url = cfg.url, headers = mwJsonHdr(), body = mwBaseBody(), i, a;
  switch (p.op) {
    case 'dupQuery': url = mwQ(url, 'id=1&id=2'); break;
    case 'dupHeader': headers.push(['X-Probe-Dup', '1'], ['X-Probe-Dup', '2']); break;
    case 'dupCookie': headers.push(['Cookie', 'a=1; a=2']); break;
    case 'dupJsonKey': body = '{"a":1,"a":2}'; break;
    case 'bufQuery': url = mwQ(url, 'buf=' + mwRepeat('A', size * 1024)); break;
    case 'bufBody': body = '{"data":"' + mwRepeat('A', size * 1024) + '"}'; break;
    case 'qsLen': url = mwQ(url, 'x=' + mwRepeat('A', 4200)); break;
    case 'qsCount': a = []; for (i = 0; i < 60; i++) a.push('p' + i + '=1'); url = mwQ(url, a.join('&')); break;
    case 'hdrLen': headers.push(['X-Long', mwRepeat('A', 4200)]); break;
    case 'hdrCount': for (i = 0; i < 110; i++) headers.push(['X-H' + i, '1']); break;
    case 'badCt': headers = [['Content-Type', 'text/plain']]; break;
    case 'badJson': body = '{bad'; break;
    case 'deepJson': body = '{"a":' + mwRepeat('[', 400) + '1' + mwRepeat(']', 400) + '}'; break;
    case 'inject': a = {}; a[p.field] = p.payload; a.password = 'test'; body = JSON.stringify(a); break;
    case 'ctrlChar': url = mwQ(url, 'q=%00'); break;
    case 'unknownCookie': headers.push(['Cookie', '__mw_probe=' + Math.random().toString(36).slice(2)]); break;
    default: break;
  }
  return { method: method, url: url, headers: headers, body: body, surface: p.surface };
}
// SATU sumber kebenaran daftar probe. st = status blok yang diharapkan, msg = substring
// pesan server yang diharapkan (toleran/substring), escalating = keluarga ukuran (stop-on-first-block),
// cookie = butuh set header Cookie (dilarang fetch -> ERROR dari Opsi 1), base = kunci i18n induk.
const MW_PROBES = (function () {
  var P = [
    { id: 'dupquery', op: 'dupQuery', cat: 'dup', surface: 'query', st: [400], msg: 'parameter dengan nama ganda' },
    { id: 'dupheader', op: 'dupHeader', cat: 'dup', surface: 'header', st: [400, 431], msg: 'header ganda', limited: 'header' },
    { id: 'dupcookie', op: 'dupCookie', cat: 'dup', surface: 'cookie', st: [400], msg: 'cookie dengan nama ganda', cookie: true },
    { id: 'dupjson', op: 'dupJsonKey', cat: 'dup', surface: 'body', st: [400], msg: 'parameter dengan nama ganda' },
    { id: 'bufquery', op: 'bufQuery', cat: 'buf', surface: 'query', st: [400], msg: 'panjang parameter melebihi batas', escalating: true },
    { id: 'bufbody', op: 'bufBody', cat: 'buf', surface: 'body', st: [400, 413], msg: 'ukuran body melebihi batas', escalating: true },
    { id: 'qslen', op: 'qsLen', cat: 'buf', surface: 'query', st: [400], msg: 'panjang query string melebihi batas' },
    { id: 'qscount', op: 'qsCount', cat: 'buf', surface: 'query', st: [400], msg: 'jumlah parameter melebihi batas' },
    { id: 'hdrlen', op: 'hdrLen', cat: 'buf', surface: 'header', st: [431, 400], msg: 'ukuran header melebihi batas' },
    { id: 'hdrcount', op: 'hdrCount', cat: 'buf', surface: 'header', st: [431], msg: 'jumlah header melebihi batas' },
    { id: 'badct', op: 'badCt', cat: 'ctjson', surface: 'header', st: [400], msg: 'format body tidak didukung' },
    { id: 'badjson', op: 'badJson', cat: 'ctjson', surface: 'body', st: [400], msg: 'format JSON tidak valid' },
    { id: 'deepjson', op: 'deepJson', cat: 'ctjson', surface: 'body', st: [400], msg: 'struktur body terlalu dalam' },
    { id: 'ctrl', op: 'ctrlChar', cat: 'charcookie', surface: 'query', st: [400], msg: 'karakter tidak valid' },
    { id: 'unkcookie', op: 'unknownCookie', cat: 'charcookie', surface: 'cookie', st: [400], msg: 'cookie yang tidak dikenal', cookie: true }
  ];
  // Sanitize (CWE-89 SQLi, CWE-79 XSS, CWE-77/78 Command/Path): satu payload = satu probe,
  // dibangkitkan dari daftar payload tunggal agar tidak ada duplikasi definisi.
  var SAN = [
    { base: 'sqli', msg: 'pola yang tidak diizinkan', payloads: ["' OR 1=1 --", 'UNION SELECT 1,2,3 FROM users', '; DROP TABLE x', 'information_schema.tables'] },
    { base: 'xss', msg: 'masukan yang tidak diizinkan', payloads: ['<script>alert(1)<\/script>', 'javascript:alert(1)', 'x onerror=alert(1)'] },
    { base: 'cmd', msg: 'pola yang tidak diizinkan', payloads: ['; ls -la', '$(whoami)', '/etc/passwd', '../../etc/passwd'] }
  ];
  SAN.forEach(function (s) {
    s.payloads.forEach(function (pl, i) {
      P.push({ id: s.base + (i + 1), base: s.base, op: 'inject', cat: 'sanitize', surface: 'body', st: [400], msg: s.msg, payload: pl, field: 'username' });
    });
  });
  return P;
})();
// Normalisasi ukuran buffer (KB) ke bilangan bulat 1..4096.
function mwSizeList(arr) {
  return (arr || []).map(function (n) { return Math.max(1, Math.min(4096, Math.round(Number(n) || 1))); });
}
// Skrip Opsi 2 (same-origin, cookie sesi ikut) -- MENIRU buildRateScript/buildRtoScript.
// Fungsi probe murni disisipkan via .toString() + daftar probe diserialisasi (satu sumber kebenaran).
function buildMwScript(cfg) {
  var payload = JSON.stringify({ url: cfg.url, method: cfg.method || 'POST', delay: clampNum(cfg.delayMs, 0, 5000), sizes: mwSizeList(cfg.sizesKb) });
  var shared = [mwQ, mwBaseBody, mwJsonHdr, mwRepeat, mwVerdictOf, mwExtractMsg, mwBuildReq].map(function (f) { return '  ' + f.toString(); });
  return localizeScript([
    '(function () {',
    '  if (window.__mwHook) window.__mwHook.close();',
    '  var cfg = ' + payload + ';',
    '  var MW_PROBES = ' + JSON.stringify(MW_PROBES) + ';'
  ].concat(shared).concat([
    ...MKBTN_LINES,
    '  var panel = document.createElement("div");',
    '  Object.assign(panel.style, { position: "fixed", left: "12px", bottom: "12px", width: "460px", height: "400px", minWidth: "280px", minHeight: "170px", maxWidth: "90vw", maxHeight: "90vh", resize: "both", overflow: "hidden", background: "linear-gradient(160deg, #211914 0%, #14100d 100%)", color: "#f3ece4", font: "12px/1.4 Consolas,monospace", border: "1px solid #453429", borderRadius: "10px", boxShadow: "0 12px 30px rgba(0,0,0,.55)", zIndex: 2147483647, display: "flex", flexDirection: "column" });',
    '  var head = document.createElement("div");',
    '  Object.assign(head.style, { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderBottom: "1px solid #3e2f25", background: "linear-gradient(135deg, #2d2119 0%, #201813 100%)", borderRadius: "10px 10px 0 0", flexShrink: "0" });',
    '  var title = document.createElement("b"); title.textContent = "Cek Middleware"; title.style.flex = "1";',
    '  var summary = document.createElement("div");',
    '  Object.assign(summary.style, { padding: "6px 10px", color: "#aa9888", borderBottom: "1px solid #2f241d", flexShrink: "0" });',
    '  summary.textContent = "bersiap...";',
    '  var body = document.createElement("div");',
    '  Object.assign(body.style, { overflow: "auto", padding: "6px 10px", flex: "1" });',
    '  var stopped = false, rows = [], counts = { LULUS: 0, GAGAL: 0, ERROR: 0 };',
    '  var stopBtn = mkBtn("stop", function () { stopped = true; });',
    '  var jsonBtn = mkBtn("salin json", function () {',
    '    navigator.clipboard.writeText(JSON.stringify(rows, null, 2));',
    '    var old = jsonBtn.textContent; jsonBtn.textContent = "tersalin"; setTimeout(function () { jsonBtn.textContent = old; }, 1200);',
    '  });',
    '  var closeBtn = mkBtn(String.fromCharCode(10005), function () { stopped = true; panel.remove(); });',
    '  head.append(title, stopBtn, jsonBtn, closeBtn);',
    '  panel.append(head, summary, body);',
    '  document.body.appendChild(panel);',
    ...GUARD_LINES,
    '  function addRow(r) {',
    '    rows.push(r); counts[r.verdict] = (counts[r.verdict] || 0) + 1;',
    '    var row = document.createElement("div");',
    '    row.style.color = r.verdict === "LULUS" ? "#4ade80" : r.verdict === "GAGAL" ? "#f87171" : "#94a3b8";',
    '    row.textContent = "[" + r.verdict + "] " + r.name + " " + String.fromCharCode(183) + " " + r.status + (r.message ? " " + String.fromCharCode(183) + " " + r.message.slice(0, 60) : "");',
    '    body.insertBefore(row, body.firstChild);',
    '    summary.textContent = "LULUS:" + counts.LULUS + "  GAGAL:" + counts.GAGAL + "  ERROR:" + counts.ERROR;',
    '  }',
    '  function wait() { return new Promise(function (r) { setTimeout(r, cfg.delay); }); }',
    '  async function doProbe(p, size) {',
    '    var r = { key: p.id + (size != null ? "@" + size + "kb" : ""), cat: p.cat, name: p.id + (p.payload ? (" " + p.payload) : "") + (size != null ? " " + size + "KB" : ""), surface: p.surface, status: "", verdict: "ERROR", message: "", expect: p.st.join("/") + " " + String.fromCharCode(183) + " " + p.msg };',
    '    if (p.op === "dupCookie") { r.message = "tidak dapat menduplikasi cookie via fetch"; addRow(r); return r; }',
    '    var req = mwBuildReq(p, cfg, size || 2), cleanup = null;',
    '    if (p.op === "unknownCookie") { var cn = "__mw_probe_" + Date.now(); document.cookie = cn + "=1; path=/"; cleanup = function () { document.cookie = cn + "=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"; }; req.headers = req.headers.filter(function (h) { return h[0].toLowerCase() !== "cookie"; }); }',
    '    try {',
    '      var H = new Headers(); req.headers.forEach(function (h) { try { H.append(h[0], h[1]); } catch (e) { /* header dilarang browser */ } });',
    '      var noBody = req.method === "GET" || req.method === "HEAD";',
    '      var res = await fetch(req.url, { method: req.method, headers: H, body: noBody ? undefined : req.body, credentials: "include" });',
    '      r.status = res.status; var txt = ""; try { txt = await res.text(); } catch (e) { /* body tak terbaca */ }',
    '      r.message = mwExtractMsg(txt); r.verdict = mwVerdictOf(res.status, false);',
    '    } catch (e) { r.status = "error"; r.verdict = "ERROR"; r.message = e.message; }',
    '    if (cleanup) cleanup();',
    '    addRow(r); return r;',
    '  }',
    '  (async function run() {',
    '    for (var i = 0; i < MW_PROBES.length && !stopped; i++) {',
    '      var p = MW_PROBES[i];',
    '      if (p.escalating) { for (var s = 0; s < cfg.sizes.length && !stopped; s++) { var rr = await doProbe(p, cfg.sizes[s]); if (rr.verdict === "LULUS") break; await wait(); } }',
    '      else { await doProbe(p, null); }',
    '      if (!stopped) await wait();',
    '    }',
    '    summary.textContent = "selesai " + String.fromCharCode(183) + " LULUS:" + counts.LULUS + "  GAGAL:" + counts.GAGAL + "  ERROR:" + counts.ERROR;',
    '  })();',
    '  window.__mwHook = { close: function () { stopped = true; panel.remove(); } };',
    '})();'
  ]).join('\n'));
}

// ============================================================
//  Puppeteer Record: bookmarklet "Pup Rec" merekam klik/ketik di tab target (format JSON
//  Chrome DevTools Recorder), lalu dikirim ke tab scanner lewat postMessage dan disimpan di
//  IndexedDB milik halaman ini. "Pup Play" memutar ulang rekaman di tab target.
//  Fungsi pupRecorderMain/pupPlayerMain dijadikan teks (toString) untuk bookmarklet, jadi
//  isinya harus mandiri (tanpa variabel dari luar) dan tidak memakai innerHTML/eval.
// ============================================================
const PUP_DB = 'scaPupRec', PUP_STORE = 'recs';
const PUP_I18N = {
  id: {
    tab_pup: 'Puppeteer Record',
    pup_title: 'Puppeteer Record (rekam & putar ulang di browser)',
    pup_intro: 'Rekam klik dan ketikan di aplikasi target tanpa membuka DevTools. Hasilnya disimpan di browser ini (IndexedDB) dan bisa dikelola di sini: putar ulang, ekspor ke script Puppeteer / JSON Chrome Recorder, atau bagikan ke orang lain lewat Ekspor lalu Import.',
    pup_step1: 'Seret tombol Pup ke bookmark bar (jangan diklik di sini). Satu bookmark untuk rekam dan putar.',
    pup_step2: 'Di tab target, klik bookmark Pup > Rekam, pakai aplikasi seperti biasa (jeda, hover menu, klik, ketik ikut tercatat), lalu Stop & simpan. Tab scanner terbuka sendiri dan rekaman masuk ke tabel di bawah.',
    pup_step3: 'Untuk memutar: klik Putar di tabel. Situs target terbuka di tab baru, klik bookmark Pup di tab itu dan pemutaran langsung jalan (kecepatan waktu asli / 2x / jeda tetap, dengan kursor visual).',
    pup_note: 'Isi field password tidak direkam (diganti {{password}}, diminta saat diputar). Kalau popup diblokir atau situs memasang header COOP, pakai Salin/Unduh JSON di panel lalu Import di sini. Aplikasi non-SPA (tiap pindah halaman reload penuh): klik bookmark Pup lagi di setiap halaman baru; rekaman tersambung dan pemutaran lanjut otomatis dari langkah berikutnya. Halaman di domain lain (mis. login SSO) tidak ikut tergabung. Satu-satunya batas: idle. Rekaman berhenti dan tersimpan otomatis bila tidak ada aktivitas melebihi "Batas idle" di panel (default 2 menit, 0 = tanpa batas; bila popup diblokir, JSON diunduh). Jeda dan lama mengetik tidak dibatasi; tiap 5000 langkah rekaman otomatis disimpan sebagai satu bagian lalu lanjut merekam bagian berikutnya. Tombol Lanjutkan di panel merekam bagian berikutnya setelah Stop / berhenti karena idle. Iframe satu domain ikut direkam (klik, ketik, hover, aktivitas); iframe beda domain (mis. widget pembayaran pihak ketiga) tidak bisa diakses browser. Reload/redirect otomatis dari aplikasi (mis. saat koneksi gagal) selama panel aktif memunculkan konfirmasi browser: Muat ulang (rekam/putar berhenti) atau Batal (tetap jalan); berlaku juga untuk Hook, Rate Limiter, RTO, dan Cek Middleware. Alternatif tanpa klik ulang: rekam dengan DevTools (F12) > Recorder, ekspor JSON, lalu Import di sini untuk dikelola / diekspor ke Puppeteer .js.',
    pup_list: 'Rekaman tersimpan', pup_select_all: 'Pilih semua', pup_delete: 'Hapus', pup_export: 'Ekspor JSON', pup_import: 'Import JSON',
    pup_reload: 'Muat ulang', pup_th_name: 'Nama', pup_th_url: 'URL awal', pup_th_steps: 'Langkah', pup_th_date: 'Dibuat', pup_th_act: 'Aksi',
    pup_play: 'Putar', pup_view: 'Lihat', pup_hide: 'Tutup', pup_js: 'Puppeteer .js', pup_recjson: 'Recorder JSON', pup_empty: 'Belum ada rekaman.',
    pup_th_type: 'Jenis', pup_th_target: 'Selector / URL', pup_th_value: 'Nilai', pup_rename_hint: 'Klik dua kali nama untuk mengganti',
    pup_saved: 'Rekaman "{t}" tersimpan.', pup_deleted: '{n} rekaman dihapus.', pup_imported: '{n} rekaman di-import.', pup_import_bad: 'File tidak dikenali: {f}',
    pup_confirm_del: 'Hapus {n} rekaman terpilih?', pup_play_msg: 'Tab target dibuka. Klik Pup Play dari bookmark bar di tab itu; rekaman "{t}" dikirim otomatis.',
    pup_usage: 'Pemakaian storage browser: {u} dari kuota {q}',
    pup_th_size: 'Ukuran', pup_th_gap: 'Jeda', pup_gap_hint: 'Klik untuk ubah jeda (detik). Kosongkan untuk kembali ke jeda asli.', pup_group_none: 'Tanpa grup', pup_group_new: 'Grup untuk rekaman baru', pup_group_ph: 'mis. CAPEX',
    pup_move: 'Pindahkan terpilih ke grup', pup_move_ph: 'nama grup (kosong = tanpa grup)', pup_moved: '{n} rekaman dipindah ke grup "{g}".',
    pup_total: 'Total {n} rekaman, {s}', pup_group_sel: 'Pilih semua di grup ini', pup_show: 'Tampilkan', pup_hide_g: 'Sembunyikan', pup_no_idb: 'IndexedDB tidak tersedia di browser/mode ini.', pup_popup_blocked: 'Popup diblokir browser. Izinkan popup untuk halaman ini lalu coba lagi.'
  },
  en: {
    tab_pup: 'Puppeteer Record',
    pup_title: 'Puppeteer Record (record & replay in the browser)',
    pup_intro: 'Record clicks and typing in the target app without opening DevTools. Recordings are stored in this browser (IndexedDB) and managed here: replay, export to a Puppeteer script / Chrome Recorder JSON, or share with others via Export then Import.',
    pup_step1: 'Drag the Pup button to your bookmarks bar (do not click it here). One bookmark for recording and playback.',
    pup_step2: 'On the target tab, click the Pup bookmark > Record, use the app as usual (delays, menu hovers, clicks, and typing are captured), then Stop & save. The scanner tab opens automatically and the recording appears in the table below.',
    pup_step3: 'To replay: click Play in the table. The target site opens in a new tab; click the Pup bookmark there and replay starts immediately (real timing / 2x / fixed delay, with a visual cursor).',
    pup_note: 'Password fields are not recorded (replaced by {{password}} and asked at replay). If popups are blocked or the site sends a COOP header, use Copy/Download JSON in the panel and Import here. Non-SPA apps (full reload on every page change): click the Pup bookmark again on each new page; the recording is stitched together and replay auto-continues from the next step. Pages on another domain (e.g. SSO login) are not merged. The only limit is idle: recording stops and saves automatically when there is no activity for longer than the "Idle limit" in the panel (default 2 minutes, 0 = no limit; if the popup is blocked, the JSON is downloaded). Delays and typing time are unlimited; every 5000 steps the recording is saved as one part and recording continues with the next part automatically. The Continue button in the panel records the next part after Stop / an idle stop. Same-origin iframes are recorded (clicks, typing, hover, activity); cross-origin iframes (e.g. third-party payment widgets) are not accessible to the browser. An automatic reload/redirect by the app (e.g. on connection failure) while a panel is active shows the browser confirmation: Reload (recording/replay stops) or Cancel (keeps running); this also applies to Hook, Rate Limiter, RTO and Middleware Check. No-reclick alternative: record with DevTools (F12) > Recorder, export JSON, then Import here to manage / export to Puppeteer .js.',
    pup_list: 'Saved recordings', pup_select_all: 'Select all', pup_delete: 'Delete', pup_export: 'Export JSON', pup_import: 'Import JSON',
    pup_reload: 'Reload', pup_th_name: 'Name', pup_th_url: 'Start URL', pup_th_steps: 'Steps', pup_th_date: 'Created', pup_th_act: 'Actions',
    pup_play: 'Play', pup_view: 'View', pup_hide: 'Hide', pup_js: 'Puppeteer .js', pup_recjson: 'Recorder JSON', pup_empty: 'No recordings yet.',
    pup_th_type: 'Type', pup_th_target: 'Selector / URL', pup_th_value: 'Value', pup_rename_hint: 'Double-click name to rename',
    pup_saved: 'Recording "{t}" saved.', pup_deleted: '{n} recordings deleted.', pup_imported: '{n} recordings imported.', pup_import_bad: 'Unrecognized file: {f}',
    pup_confirm_del: 'Delete {n} selected recordings?', pup_play_msg: 'Target tab opened. Click Pup Play from the bookmarks bar there; recording "{t}" is sent automatically.',
    pup_usage: 'Browser storage used: {u} of {q} quota',
    pup_th_size: 'Size', pup_th_gap: 'Delay', pup_gap_hint: 'Click to edit delay (seconds). Clear to restore recorded delay.', pup_group_none: 'No group', pup_group_new: 'Group for new recordings', pup_group_ph: 'e.g. CAPEX',
    pup_move: 'Move selected to group', pup_move_ph: 'group name (empty = no group)', pup_moved: '{n} recordings moved to group "{g}".',
    pup_total: 'Total {n} recordings, {s}', pup_group_sel: 'Select all in this group', pup_show: 'Show', pup_hide_g: 'Hide', pup_no_idb: 'IndexedDB is not available in this browser/mode.', pup_popup_blocked: 'The browser blocked the popup. Allow popups for this page and try again.'
  }
};
Object.keys(PUP_I18N).forEach(l => { I18N[l] = Object.assign({}, PUP_I18N[l], I18N[l] || {}); });
// Teks panel bookmarklet (localizeScript menerjemahkan literal "..." lewat kamus ini).
Object.assign(TEXT_EN, {
  'Rekam': 'Record', 'Stop & simpan': 'Stop & save', 'Salin JSON': 'Copy JSON', 'Unduh JSON': 'Download JSON', 'Tutup': 'Close',
  'Nama rekaman': 'Recording name', 'Siap merekam.': 'Ready to record.', 'Merekam... langkah: ': 'Recording... steps: ',
  'Lanjut merekam setelah reload. Langkah: ': 'Resumed after reload. Steps: ', 'Belum ada rekaman.': 'No recording yet.',
  'Tersalin ke clipboard.': 'Copied to clipboard.', 'Mengirim ke tab scanner...': 'Sending to the scanner tab...',
  'Tersimpan di tab scanner.': 'Saved in the scanner tab.', 'Popup diblokir. Pakai Salin/Unduh JSON lalu Import di scanner.': 'Popup blocked. Use Copy/Download JSON then Import in the scanner.',
  'Tab scanner tidak merespons (popup/COOP). Pakai Salin/Unduh JSON lalu Import di scanner.': 'The scanner tab did not respond (popup/COOP). Use Copy/Download JSON then Import in the scanner.',
  'Putar': 'Play', 'Lewati': 'Skip', 'Muat JSON': 'Load JSON', 'Tempel JSON rekaman di sini': 'Paste recording JSON here',
  'Password untuk {{password}}': 'Password for {{password}}', 'Jeda (ms)': 'Delay (ms)', 'Meminta rekaman dari tab scanner...': 'Requesting the recording from the scanner tab...',
  'Tidak ada tab scanner. Tempel JSON rekaman lalu Muat JSON.': 'No scanner tab. Paste the recording JSON then Load JSON.',
  'JSON tidak valid.': 'Invalid JSON.', 'Siap diputar: ': 'Ready to play: ', ' langkah': ' steps', 'Selesai.': 'Done.', 'Dihentikan.': 'Stopped.',
  'Elemen tidak ditemukan pada langkah ': 'Element not found at step ', 'Pindah halaman. Klik Pup Play lagi setelah halaman terbuka untuk melanjutkan.': 'Navigating. Click Pup Play again once the page has loaded to continue.',
  'Lanjut dari langkah ': 'Continuing from step ', '⇄ Putar': '⇄ Play', '⇄ Rekam': '⇄ Record', '⏺ Rekam': '⏺ Record', '▶ Putar': '▶ Play',
  'Stop dulu sebelum pindah ke Putar.': 'Stop first before switching to Play.', 'Waktu asli': 'Real timing', 'Jeda tetap (ms)': 'Fixed delay (ms)', 'Kecepatan': 'Speed',
  'Mulai otomatis...': 'Starting automatically...', 'mengetik': 'typing', '↻ Ulangi': '↻ Replay', 'langkah': 'step', 'jeda': 'wait', 'dtk': 's', 'Mulai dari langkah ': 'Start from step ', 'Non-SPA: tiap pindah halaman, klik bookmark Pup lagi untuk melanjutkan.': 'Non-SPA: after every page change, click the Pup bookmark again to continue.',
  'Pindah halaman. Klik bookmark Pup lagi setelah halaman terbuka untuk melanjutkan.': 'Navigating. Click the Pup bookmark again once the page has loaded to continue.', 'Lanjut otomatis dari langkah ': 'Auto-continuing from step ', 'Isi password lalu klik Putar.': 'Enter the password then click Play.',
  'Non-SPA: tiap pindah halaman, klik Pup Rec lagi untuk melanjutkan.': 'Non-SPA: after every page change, click Pup Rec again to continue.', 'Berhenti otomatis: tidak ada aktivitas lebih dari ': 'Stopped automatically: no activity for more than ', 'menit': 'minutes',
'Batas idle (menit, 0 = tanpa batas)': 'Idle limit (minutes, 0 = no limit)', 'Lanjutkan': 'Continue', 'bagian': 'part',
'Batas langkah tercapai (': 'Step limit reached (', 'Bagian sebelumnya disimpan, lanjut merekam': 'Previous part saved, now recording',
'Penyimpanan sementara gagal (storage tab penuh/diblokir). Rekaman masih di memori: jangan reload, klik Stop & simpan sekarang.': 'Temporary save failed (tab storage full/blocked). The recording is only in memory: do not reload, click Stop & save now.', 'Iframe beda domain tidak bisa direkam: ': 'Cross-origin iframes cannot be recorded: ',
'Peringatan: halaman ini bukan URL awal rekaman: ': 'Warning: this page is not the recording start URL: '
});

// ---- Dijalankan DI TAB TARGET (panel Rekam dari bookmarklet Pup).
function pupRecorderMain(cfg) {
  var KEY = '__pupRec', IDLE_KEY = '__pupIdleMin'; // batas idle (menit) diatur di panel, diingat per situs
  var PART_STEPS = 5000; // rekaman sepanjang ini disimpan sebagai satu bagian, lalu otomatis lanjut ke bagian berikutnya
  // Panel bisa digeser lewat judulnya (posisi diingat selama tab ini terbuka).
  function pupDrag(box, handle) {
    var on = false, dx = 0, dy = 0;
    function place(l, t) { box.style.left = Math.min(Math.max(0, l), window.innerWidth - box.offsetWidth) + 'px'; box.style.top = Math.min(Math.max(0, t), window.innerHeight - box.offsetHeight) + 'px'; box.style.right = 'auto'; box.style.bottom = 'auto'; }
    handle.style.cursor = 'move';
    try { var p = JSON.parse(sessionStorage.getItem('__pupPos') || 'null'); if (p) setTimeout(function () { place(p.l, p.t); }, 0); } catch (e) { /* abaikan */ }
    handle.addEventListener('mousedown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      var r = box.getBoundingClientRect(); on = true; dx = e.clientX - r.left; dy = e.clientY - r.top; e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) { if (on) place(e.clientX - dx, e.clientY - dy); }, true);
    document.addEventListener('mouseup', function () {
      if (!on) return; on = false;
      try { sessionStorage.setItem('__pupPos', JSON.stringify({ l: parseInt(box.style.left, 10), t: parseInt(box.style.top, 10) })); } catch (e) { /* abaikan */ }
    }, true);
  }

  if (window.__pupRecUi) { window.__pupRecUi.style.display = 'flex'; return; }
  var rec = null, lastRec = null, lastUrl = location.href, scrollT = 0;
  try { var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (saved && saved.active) rec = saved; } catch (e) { rec = null; }
  function el(tag, css, text) { var x = document.createElement(tag); if (css) Object.assign(x.style, css); if (text != null) x.textContent = text; return x; }
  function btn(label, fn) { var b = el('button', { background: '#2c211b', color: '#f3ece4', border: '1px solid #453429', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }, label); b.onclick = fn; return b; }
  var ui = el('div', { position: 'fixed', right: '12px', bottom: '12px', width: '300px', background: 'linear-gradient(160deg, #211914 0%, #14100d 100%)', color: '#f3ece4', font: '12px/1.4 Consolas,monospace', border: '2px solid #453429', borderRadius: '10px', boxShadow: '0 12px 30px rgba(0,0,0,.55)', zIndex: 2147483647, display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px' });
  window.__pupRecUi = ui;
  var head = el('div', { display: 'flex', alignItems: 'center', gap: '6px' });
  head.appendChild(el('b', { flex: '1' }, 'Pup · ' + "Rekam"));
  if (cfg.openPlay) head.appendChild(btn("⇄ Putar", function () { if (rec) { info.textContent = "Stop dulu sebelum pindah ke Putar."; return; } ui.remove(); window.__pupRecUi = null; cfg.openPlay(); }));
  var nameIn = el('input', { background: '#120e0b', color: '#f3ece4', border: '1px solid #3e2f25', borderRadius: '5px', padding: '3px 6px', font: 'inherit' });
  nameIn.placeholder = "Nama rekaman";
  var info = el('div', { color: '#aa9888' }, "Siap merekam.");
  var row = el('div', { display: 'flex', gap: '6px', flexWrap: 'wrap' });
  var bRec = btn("Rekam", function () { start(); }), bStop = btn("Stop & simpan", stop), bCopy = btn("Salin JSON", copyJson), bDl = btn("Unduh JSON", downloadJson);
  // Lanjutkan: rekam bagian berikutnya dari halaman ini (setelah Stop / berhenti otomatis karena idle).
  var bCont = btn("Lanjutkan", function () { cont(); }); bCont.style.display = 'none'; bCont.style.background = '#b45309';
  head.appendChild(btn("Tutup", function () { if (rec) stop(); ui.style.display = 'none'; }));
  pupDrag(ui, head);
  bRec.style.background = '#b91c1c';
  [bRec, bCont, bStop, bCopy, bDl].forEach(function (b) { row.appendChild(b); });
  var hint = el('div', { color: '#f59e0b', fontSize: '11px' }, "Non-SPA: tiap pindah halaman, klik bookmark Pup lagi untuk melanjutkan.");
  var frameHint = el('div', { color: '#f59e0b', fontSize: '11px', display: 'none' }, '');
  var warn = el('div', { color: '#fca5a5', fontSize: '11px', display: 'none' }, '');
  var partNote = el('div', { color: '#fbbf24', fontSize: '11px', display: 'none' }, '');
  // Satu-satunya batas: idle. Tidak ada aktivitas selama N menit -> rekaman berhenti & disimpan. 0 = tanpa batas.
  var idleRow = el('label', { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px' }, "Batas idle (menit, 0 = tanpa batas)");
  var idleIn = el('input', { width: '56px', background: '#120e0b', color: '#f3ece4', border: '1px solid #3e2f25', borderRadius: '5px', padding: '2px 4px', font: 'inherit' });
  idleIn.type = 'number'; idleIn.min = '0'; idleIn.step = '0.5';
  try { idleIn.value = localStorage.getItem(IDLE_KEY) || '2'; } catch (e) { idleIn.value = '2'; }
  idleIn.onchange = function () { try { localStorage.setItem(IDLE_KEY, idleIn.value); } catch (e) { /* abaikan */ } };
  idleRow.appendChild(idleIn);
  ui.appendChild(head); ui.appendChild(nameIn); ui.appendChild(row); ui.appendChild(idleRow); ui.appendChild(hint); ui.appendChild(frameHint); ui.appendChild(warn); ui.appendChild(partNote); ui.appendChild(info);
  document.body.appendChild(ui);
  if (window.__hookGuard) window.__hookGuard.add(ui);
  function inUi(x) { return x && ui.contains(x); }
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, function (c) { return '\\' + c; }); }
  function attrSel(tag, a, v) { return tag + '[' + a + '="' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]'; }
  function uniq(s, doc) { try { return (doc || document).querySelectorAll(s).length === 1; } catch (e) { return false; } }
  // Posisi iframe (indeks window.frames bertingkat) tempat elemen berada; [] = halaman utama. Sama dengan 'frame' Chrome Recorder.
  function framePath(doc) {
    var path = [], w = doc && doc.defaultView;
    while (w && w !== window) {
      var p = w.parent, k = -1;
      for (var i = 0; i < p.frames.length; i++) { if (p.frames[i] === w) { k = i; break; } }
      if (k < 0) break;
      path.unshift(k); w = p;
    }
    return path;
  }
  function inFrame(x, st) { var f = framePath(x.ownerDocument); if (f.length) st.frame = f; return st; }
  // id buatan framework berubah tiap render/reload (React useId _r_9k_ / :r1:, MUI, Radix, Headless UI) -> jangan dipakai
  function goodId(id) { return id && !/\d{4,}/.test(id) && id.indexOf(':') < 0 && !/^(_r_|r_|mui-|radix-|headlessui-|react-select-|downshift-|rc_|ember)/i.test(id) && !/^_[a-z0-9]+_$/i.test(id); }
  function pathSel(x) {
    var parts = [], doc = x.ownerDocument;
    while (x && x.nodeType === 1 && x !== doc.documentElement) {
      if (goodId(x.id) && uniq('#' + cssEsc(x.id), doc)) { parts.unshift('#' + cssEsc(x.id)); break; }
      var tag = x.tagName.toLowerCase(), p = x.parentElement;
      if (p) { var same = [].filter.call(p.children, function (c) { return c.tagName === x.tagName; }); if (same.length > 1) tag += ':nth-of-type(' + (same.indexOf(x) + 1) + ')'; }
      parts.unshift(tag); x = p;
    }
    return parts.join(' > ');
  }
  function selectorsFor(x) {
    var out = [], tag = x.tagName.toLowerCase(), doc = x.ownerDocument;
    function add(s) { if (s && out.indexOf(s) < 0 && uniq(s, doc)) out.push(s); }
    if (goodId(x.id)) add('#' + cssEsc(x.id));
    ['data-testid', 'data-test', 'data-cy', 'name', 'aria-label', 'placeholder', 'title'].forEach(function (a) { var v = x.getAttribute(a); if (v) add(attrSel(tag, a, v)); });
    var txt = (x.textContent || '').trim();
    if (/^(button|a)$/.test(tag) && txt && txt.length <= 40 && x.children.length <= 2) out.push('text/' + txt);
    add(pathSel(x));
    return out.slice(0, 4).map(function (s) { return [s]; });
  }
  // Simpan sementara ke sessionStorage; bila gagal (penuh/diblokir) tampilkan peringatan: rekaman hanya di memori.
  function persistRec() {
    try { sessionStorage.setItem(KEY, JSON.stringify(rec)); warn.style.display = 'none'; return true; }
    catch (e) { warn.style.display = ''; warn.textContent = "Penyimpanan sementara gagal (storage tab penuh/diblokir). Rekaman masih di memori: jangan reload, klik Stop & simpan sekarang."; return false; }
  }
  function save() {
    rec.lastAt = Date.now();
    persistRec();
    info.textContent = "Merekam... langkah: " + rec.steps.length + (rec.part > 1 ? ' · ' + "bagian" + ' ' + rec.part : '');
  }
  function push(step) { if (!rec) return; if (step.t == null) step.t = Date.now() - rec.created; rec.steps.push(step); save(); if (rec.steps.length >= PART_STEPS) nextPart("Batas langkah tercapai (" + PART_STEPS + "). "); }
  function last() { return rec && rec.steps[rec.steps.length - 1]; }
  function sameSel(a, b) { return a && b && JSON.stringify(a.selectors) === JSON.stringify(b.selectors); }
  function actionable(t) { return (t.closest && t.closest('button,a,input,select,textarea,label,summary,[role=button],[role=link],[role=menuitem],[role=tab],[role=option],[role=checkbox],[onclick]')) || t; }
  function isText(x) { return x && (x.tagName === 'TEXTAREA' || (x.tagName === 'INPUT' && !/^(checkbox|radio|file|button|submit|reset|image|range|color)$/i.test(x.type))); }
  function valueOf(x) { return x.type === 'password' ? '{{password}}' : x.value; }
  function recordChange(x) {
    if (!rec || inUi(x)) return;
    var st = inFrame(x, { type: 'change', target: 'main', selectors: selectorsFor(x), value: valueOf(x) });
    var l = last();
    if (l && l.type === 'change' && sameSel(l, st)) { l.value = st.value; save(); return; }
    // nilai sama dengan change terakhir di field ini (mis. dari pagehide) -> tidak dicatat dua kali
    for (var i = rec.steps.length - 1; i >= 0; i--) { var p = rec.steps[i]; if (p.type === 'change' && sameSel(p, st)) { if (p.value === st.value) return; break; } }
    push(st);
  }
  function onClick(e) {
    if (!rec || inUi(e.target)) return;
    var t = actionable(e.target), r = t.getBoundingClientRect();
    push(inFrame(t, { type: 'click', target: 'main', selectors: selectorsFor(t), offsetX: Math.round(e.clientX - r.left), offsetY: Math.round(e.clientY - r.top) }));
  }
  function onChange(e) { var x = e.target; if (x.tagName === 'SELECT' || isText(x)) recordChange(x); }
  // Ketikan per input: simpan riwayat nilai [ms sejak mulai ketik, nilai] supaya ketik-hapus-ketik ulang
  // (pencarian otomatis per kata) ikut terputar. Password tidak dicatat per ketikan.
  function onInput(e) {
    var x = e.target;
    if (!rec || inUi(x) || !isText(x) || x.type === 'password') return;
    var sel = selectorsFor(x), l = last(), now = Date.now();
    if (!(l && l.type === 'change' && JSON.stringify(l.selectors) === JSON.stringify(sel) && l.typing)) {
      l = inFrame(x, { type: 'change', target: 'main', selectors: sel, value: x.value, typing: [] });
      push(l);
    }
    var off = now - rec.created - l.t, tp = l.typing, prev = tp[tp.length - 1];
    if (prev && prev[0] === off) prev[1] = x.value; else tp.push([off, x.value]);
    l.value = x.value; save();
  }
  function onKey(e) {
    if (!rec || inUi(e.target) || ['Enter', 'Tab', 'Escape'].indexOf(e.key) < 0) return;
    if (isText(e.target)) recordChange(e.target);
    push(inFrame(e.target, { type: 'keyDown', target: 'main', key: e.key }));
    push(inFrame(e.target, { type: 'keyUp', target: 'main', key: e.key }));
  }
  function onScroll() {
    if (!rec) return;
    clearTimeout(scrollT);
    scrollT = setTimeout(function () {
      var l = last(), st = { type: 'scroll', target: 'main', x: Math.round(window.scrollX), y: Math.round(window.scrollY) };
      if (l && l.type === 'scroll' && !l.selectors) { l.x = st.x; l.y = st.y; save(); } else push(st);
    }, 400);
  }
  // Hover: dicatat bila mouse diam >= 350 ms di elemen interaktif DAN halaman berubah (menu/tooltip muncul)
  // atau elemennya punya aria-haspopup. Gerakan mouse mentah tidak direkam.
  var hovEl = null, hovAt = 0, hovT = 0, lastMut = 0;
  function observe(doc) {
    try {
      new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) { if (!inUi(list[i].target)) { lastMut = Date.now(); return; } }
      }).observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'aria-expanded', 'open'] });
    } catch (e) { /* MutationObserver tidak tersedia */ }
  }
  function hoverTarget(x) { return x && x.closest ? x.closest('a,button,li,summary,[role=menuitem],[role=button],[role=tab],[aria-haspopup]') : null; }
  function onOver(e) {
    if (!rec || inUi(e.target)) return;
    var t = hoverTarget(e.target);
    if (!t || t === hovEl) return;
    hovEl = t; hovAt = Date.now(); clearTimeout(hovT);
    hovT = setTimeout(function () {
      if (!rec || hovEl !== t) return;
      var popup = t.getAttribute('aria-haspopup') || (t.parentElement && t.parentElement.closest('[aria-haspopup]'));
      if (lastMut < hovAt && !popup) return;
      var st = inFrame(t, { type: 'hover', target: 'main', selectors: selectorsFor(t) }), l = last();
      // sudah ada aksi sesudah hover dimulai (mis. langsung diklik) -> hover tidak perlu dicatat
      if (l && (l.t || 0) > hovAt - rec.created) return;
      if (l && l.type === 'hover' && sameSel(l, st)) return;
      st.t = hovAt - rec.created;
      push(st);
    }, 350);
  }
  function checkUrl() {
    if (!rec || location.href === lastUrl) return;
    lastUrl = location.href; rec.lastUrl = lastUrl;
    // navigasi dicatat pada klik/Enter terakhir (maks 4 langkah ke belakang)
    for (var i = rec.steps.length - 1; i >= Math.max(0, rec.steps.length - 4); i--) {
      var l = rec.steps[i];
      if (l.type === 'click' || l.type === 'keyDown') { l.assertedEvents = [{ type: 'navigation', url: lastUrl, title: document.title }]; break; }
    }
    save();
  }
  // Pasang listener ke halaman utama dan setiap iframe satu domain (bertingkat). Iframe beda domain
  // tidak bisa diakses browser -> hanya dihitung dan ditampilkan sebagai peringatan.
  function hook(doc) {
    if (!doc || doc.__pupHooked) return;
    doc.__pupHooked = true;
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('change', onChange, true);
    doc.addEventListener('input', onInput, true);
    doc.addEventListener('keydown', onKey, true);
    doc.addEventListener('mouseover', onOver, true);
    ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'focusin', 'input'].forEach(function (t) { doc.addEventListener(t, touch, { capture: true, passive: true }); });
    observe(doc);
  }
  function scanFrames() {
    var cross = 0;
    (function walk(doc) {
      [].forEach.call(doc.querySelectorAll('iframe,frame'), function (f) {
        var d = null;
        try { d = f.contentDocument; } catch (e) { d = null; }
        if (d && d.documentElement) { hook(d); walk(d); } else if (f.src && f.src.indexOf('about:') !== 0) cross++;
      });
    })(document);
    frameHint.style.display = cross ? '' : 'none';
    frameHint.textContent = cross ? "Iframe beda domain tidak bisa direkam: " + cross : '';
  }
  window.addEventListener('scroll', onScroll, true);
  // Halaman akan diganti (non-SPA): simpan ketikan di field aktif yang belum sempat memicu change.
  window.addEventListener('pagehide', function () { var a = document.activeElement; if (rec && a && isText(a) && !inUi(a)) recordChange(a); }, true);
  setInterval(checkUrl, 400);
  function idleMs() { var v = parseFloat(idleIn.value); return v > 0 ? v * 60000 : 0; }
  function idle() { var m = idleMs(); return !!(rec && m && Date.now() - (rec.lastAt || rec.created) > m); }
  // Dipicu timer (bukan klik) -> popup biasanya diblokir browser, jadi rekaman diunduh sebagai JSON.
  function autoStop() {
    if (!stop()) downloadJson();
    info.textContent = "Berhenti otomatis: tidak ada aktivitas lebih dari " + idleIn.value + " " + "menit" + ". " + info.textContent;
  }
  setInterval(function () { if (idle()) autoStop(); }, 1000);
  // Interaksi apa pun (gerak mouse, hover, tombol, scroll, sentuh) menunda batas idle walau tidak jadi langkah.
  var touchT = 0;
  function touch() {
    if (!rec) return;
    rec.lastAt = Date.now();
    if (touchT) return;
    touchT = setTimeout(function () { touchT = 0; if (rec) persistRec(); }, 5000);
  }
  hook(document); scanFrames();
  setInterval(scanFrames, 1000);
  function partTitle(base, n) { return base + ' (' + "bagian" + ' ' + n + ')'; }
  function start(part, base) {
    if (rec) return;
    var title = nameIn.value.trim() || ('Rekaman ' + new Date().toLocaleString());
    if (part > 1) { title = partTitle(base, part); nameIn.value = title; }
    bCont.style.display = 'none';
    rec = { active: true, title: title, base: base || title, part: part || 1, url: location.href, lastUrl: location.href, created: Date.now(),
      steps: [{ t: 0, type: 'setViewport', width: window.innerWidth, height: window.innerHeight, deviceScaleFactor: 1, isMobile: false, hasTouch: false, isLandscape: window.innerWidth > window.innerHeight },
        { t: 0, type: 'navigate', url: location.href, assertedEvents: [{ type: 'navigation', url: location.href, title: document.title }] }] };
    ui.style.borderColor = '#ef4444'; save();
  }
  function stop() {
    if (!rec) { if (!lastRec) info.textContent = "Belum ada rekaman."; return; }
    lastRec = { title: rec.title, base: rec.base || rec.title, part: rec.part || 1, url: rec.url, created: rec.created, origin: location.origin, steps: rec.steps };
    rec = null; ui.style.borderColor = '#453429';
    try { sessionStorage.removeItem(KEY); } catch (e) { /* abaikan */ }
    bCont.style.display = '';
    return send();
  }
  // Lanjutkan sebagai bagian berikutnya dari rekaman terakhir (mulai dari halaman ini).
  function cont() {
    if (rec || !lastRec) return;
    if (lastRec.part === 1 && lastRec.title === lastRec.base) lastRec.title = partTitle(lastRec.base, 1);
    start(lastRec.part + 1, lastRec.base);
  }
  // Bagian penuh: simpan bagian ini (scanner / unduh JSON bila popup diblokir) lalu langsung rekam bagian berikutnya.
  function nextPart(why) {
    var base = rec.base || rec.title, part = rec.part || 1;
    if (part === 1 && rec.title === base) rec.title = partTitle(base, 1);
    if (!stop()) downloadJson();
    start(part + 1, base);
    partNote.style.display = '';
    partNote.textContent = why + "Bagian sebelumnya disimpan, lanjut merekam" + ' ' + "bagian" + ' ' + (part + 1) + '.';
  }
  function text() { return JSON.stringify(lastRec || rec, null, 2); }
  function copyJson() {
    if (!lastRec && !rec) { info.textContent = "Belum ada rekaman."; return; }
    var s = text();
    function fb() { var ta = el('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* abaikan */ } ta.remove(); }
    if (navigator.clipboard) navigator.clipboard.writeText(s).catch(fb); else fb();
    info.textContent = "Tersalin ke clipboard.";
  }
  function downloadJson() {
    if (!lastRec && !rec) { info.textContent = "Belum ada rekaman."; return; }
    var a = el('a'), r = lastRec || rec;
    a.href = URL.createObjectURL(new Blob([text()], { type: 'application/json' }));
    a.download = (r.title || 'rekaman').replace(/[^\w.-]+/g, '_') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function send() {
    if (!cfg.app) { info.textContent = "Tab scanner tidak merespons (popup/COOP). Pakai Salin/Unduh JSON lalu Import di scanner."; return false; }
    var w = null, done = false;
    try { w = window.open(cfg.app + '#pup-import', '_blank'); } catch (e) { w = null; }
    if (!w) { info.textContent = "Popup diblokir. Pakai Salin/Unduh JSON lalu Import di scanner."; return false; }
    info.textContent = "Mengirim ke tab scanner...";
    var target = cfg.origin && cfg.origin !== 'null' ? cfg.origin : '*';
    function onMsg(e) {
      if (e.source !== w || !e.data) return;
      if (e.data.type === 'pup-ready') w.postMessage({ type: 'pup-rec', rec: lastRec }, target);
      if (e.data.type === 'pup-saved') { done = true; info.textContent = "Tersimpan di tab scanner."; window.removeEventListener('message', onMsg); }
    }
    window.addEventListener('message', onMsg);
    setTimeout(function () { if (!done) info.textContent = "Tab scanner tidak merespons (popup/COOP). Pakai Salin/Unduh JSON lalu Import di scanner."; }, 10000);
    return true;
  }
  // Lanjut setelah reload: jeda sejak aktivitas terakhir sudah lewat batas -> langsung simpan, jangan disambung.
  if (idle()) autoStop();
  if (rec) {
    if (rec.lastUrl && rec.lastUrl !== location.href) { lastUrl = rec.lastUrl; checkUrl(); }
    ui.style.borderColor = '#ef4444'; nameIn.value = rec.title;
    info.textContent = "Lanjut merekam setelah reload. Langkah: " + rec.steps.length;
  }
}

// ---- Dijalankan DI TAB TARGET (panel Putar dari bookmarklet Pup). boot = { rec, auto } dari tab scanner.
function pupPlayerMain(cfg, boot) {
  var KEY = '__pupPlay';
  // Panel bisa digeser lewat judulnya (posisi diingat selama tab ini terbuka).
  function pupDrag(box, handle) {
    var on = false, dx = 0, dy = 0;
    function place(l, t) { box.style.left = Math.min(Math.max(0, l), window.innerWidth - box.offsetWidth) + 'px'; box.style.top = Math.min(Math.max(0, t), window.innerHeight - box.offsetHeight) + 'px'; box.style.right = 'auto'; box.style.bottom = 'auto'; }
    handle.style.cursor = 'move';
    try { var p = JSON.parse(sessionStorage.getItem('__pupPos') || 'null'); if (p) setTimeout(function () { place(p.l, p.t); }, 0); } catch (e) { /* abaikan */ }
    handle.addEventListener('mousedown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      var r = box.getBoundingClientRect(); on = true; dx = e.clientX - r.left; dy = e.clientY - r.top; e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) { if (on) place(e.clientX - dx, e.clientY - dy); }, true);
    document.addEventListener('mouseup', function () {
      if (!on) return; on = false;
      try { sessionStorage.setItem('__pupPos', JSON.stringify({ l: parseInt(box.style.left, 10), t: parseInt(box.style.top, 10) })); } catch (e) { /* abaikan */ }
    }, true);
  }

  if (window.__pupPlayUi) { window.__pupPlayUi.style.display = 'flex'; return; }
  var rec = null, idx = 0, running = false, stopFlag = false;
  function el(tag, css, text) { var x = document.createElement(tag); if (css) Object.assign(x.style, css); if (text != null) x.textContent = text; return x; }
  function btn(label, fn) { var b = el('button', { background: '#2c211b', color: '#f3ece4', border: '1px solid #453429', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }, label); b.onclick = fn; return b; }
  var inputCss = { background: '#120e0b', color: '#f3ece4', border: '1px solid #3e2f25', borderRadius: '5px', padding: '3px 6px', font: 'inherit' };
  var ui = el('div', { position: 'fixed', right: '12px', bottom: '12px', width: '320px', background: 'linear-gradient(160deg, #211914 0%, #14100d 100%)', color: '#f3ece4', font: '12px/1.4 Consolas,monospace', border: '2px solid #453429', borderRadius: '10px', boxShadow: '0 12px 30px rgba(0,0,0,.55)', zIndex: 2147483647, display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px' });
  window.__pupPlayUi = ui;
  var head = el('div', { display: 'flex', alignItems: 'center', gap: '6px' });
  head.appendChild(el('b', { flex: '1' }, 'Pup · ' + "Putar"));
  if (cfg.openRec) head.appendChild(btn("⇄ Rekam", function () { if (running) return; ui.remove(); cur.remove(); window.__pupPlayUi = null; cfg.openRec(); }));
  head.appendChild(btn("Tutup", function () { stopFlag = true; ui.style.display = 'none'; cur.style.display = 'none'; }));
  pupDrag(ui, head);
  var ta = el('textarea', Object.assign({ height: '60px', resize: 'vertical' }, inputCss)); ta.placeholder = "Tempel JSON rekaman di sini";
  var pw = el('input', inputCss); pw.type = 'password'; pw.placeholder = "Password untuk {{password}}"; pw.style.display = 'none';
  var delayRow = el('div', { display: 'flex', gap: '6px', alignItems: 'center' });
  var speed = el('select', inputCss);
  [['real', "Waktu asli"], ['2x', '2x'], ['fixed', "Jeda tetap (ms)"]].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; speed.appendChild(op); });
  var delay = el('input', Object.assign({ width: '64px' }, inputCss)); delay.type = 'number'; delay.value = '600';
  delayRow.appendChild(el('span', null, "Kecepatan")); delayRow.appendChild(speed); delayRow.appendChild(delay);
  // Kursor visual: bergerak ke elemen tiap langkah + efek klik (tidak menghalangi klik).
  var cur = el('div', { position: 'fixed', left: '50%', top: '50%', width: '18px', height: '18px', marginLeft: '-9px', marginTop: '-9px', borderRadius: '50%', background: 'rgba(239,68,68,.35)', border: '2px solid #ef4444', boxShadow: '0 0 0 3px rgba(255,255,255,.6)', pointerEvents: 'none', zIndex: 2147483646, transition: 'left .45s ease, top .45s ease, transform .15s ease', display: 'none' });
  document.body.appendChild(cur);
  var row = el('div', { display: 'flex', gap: '6px', flexWrap: 'wrap' });
  var bPlay = btn("Putar", play); bPlay.style.background = '#16a34a';
  // Ulangi dari awal: bila halaman sudah berpindah, buka URL awal dulu lalu lanjut otomatis (klik bookmark Pup lagi bila reload penuh).
  var bAgain = btn("↻ Ulangi", function () {
    if (running || !rec) return;
    idx = 0; pos = 0; drawBar('');
    var nav = rec.steps.filter(function (s) { return s.type === 'navigate'; })[0];
    if (nav && nav.url.split('#')[0] !== location.href.split('#')[0]) {
      running = true; persist(1); running = false;
      info.textContent = "Pindah halaman. Klik bookmark Pup lagi setelah halaman terbuka untuk melanjutkan.";
      location.href = nav.url; return;
    }
    play();
  });
  [btn("Muat JSON", function () { load(ta.value); }), bPlay, bAgain, btn("Stop", function () { stopFlag = true; }), btn("Lewati", function () { if (rec && idx < rec.steps.length - 1) idx++; pos = eff[idx] || pos; drawBar(''); info.textContent = "Lanjut dari langkah " + (idx + 1); })].forEach(function (b) { row.appendChild(b); });
  var info = el('div', { color: '#aa9888', maxHeight: '120px', overflow: 'auto', whiteSpace: 'pre-wrap' }, '');
  // Timeline ala video: garis waktu rekaman (jeda asli, maks 15 dtk per jeda), penanda tiap langkah, progres, waktu.
  var bar = el('div', { position: 'relative', height: '12px', background: '#2a201a', borderRadius: '6px', cursor: 'pointer', overflow: 'hidden', display: 'none' });
  var fill = el('div', { position: 'absolute', left: '0', top: '0', bottom: '0', width: '0%', background: 'rgba(22,163,74,.55)' });
  bar.appendChild(fill);
  var clock = el('div', { color: '#d8c8b8', fontSize: '11px', display: 'none' }, '');
  [head, ta, pw, delayRow, bar, clock, row, info].forEach(function (x) { ui.appendChild(x); });
  document.body.appendChild(ui);
  if (window.__hookGuard) window.__hookGuard.add(ui);
  var eff = [], total = 0, pos = 0, tickT = 0;
  function clamp(d) { return Math.max(80, d); }
  // Jeda asli sebelum langkah i: 'wait' (diedit di scanner) atau selisih waktu rekaman (min 80 ms, tanpa batas atas).
  // Lama mengetik pada langkah change yang punya riwayat ketikan (dibatasi 2 mnt).
  function typDur(s) { var tp = s && s.typing; return tp && tp.length ? tp[tp.length - 1][0] : 0; }
  function rawGap(i) {
    var a = rec.steps[i - 1], b = rec.steps[i];
    if (!b || i === 0) return 0;
    if (typeof b.wait === 'number') return Math.max(0, b.wait);
    return a && typeof a.t === 'number' && typeof b.t === 'number' ? clamp(b.t - a.t - typDur(a)) : 600;
  }
  // eff[i] = posisi langkah i di timeline (ms): jumlah jeda asli yang sudah dibatasi.
  function buildTimeline() {
    eff = []; var acc = 0;
    rec.steps.forEach(function (s, i) {
      acc += rawGap(i);
      eff.push(acc);
      acc += typDur(s);
    });
    total = acc || 1;
    [].slice.call(bar.querySelectorAll('[data-tick]')).forEach(function (x) { x.remove(); });
    var colors = { click: '#f59e0b', doubleClick: '#f59e0b', change: '#38bdf8', hover: '#c084fc', keyDown: '#94a3b8', keyUp: '#94a3b8', navigate: '#22c55e', scroll: '#64748b' };
    rec.steps.forEach(function (s, i) {
      if (s.type === 'setViewport' || s.type === 'keyUp') return;
      var tk = el('div', { position: 'absolute', top: '1px', bottom: '1px', width: '3px', marginLeft: '-1px', borderRadius: '1px', left: (eff[i] / total * 100) + '%', background: colors[s.type] || '#e2e8f0' });
      tk.setAttribute('data-tick', '1');
      tk.title = '#' + (i + 1) + ' ' + s.type + (i > 0 ? ' (+' + ((eff[i] - eff[i - 1]) / 1000).toFixed(1) + ' s)' : '');
      bar.appendChild(tk);
    });
    bar.style.display = ''; clock.style.display = '';
    pos = eff[idx] || 0; drawBar('');
  }
  function fmtT(ms) { var sec = ms / 1000, m = Math.floor(sec / 60); return m + ':' + (sec - m * 60).toFixed(1).padStart(4, '0'); }
  function drawBar(extra) {
    if (!eff.length) return;
    fill.style.width = Math.min(100, pos / total * 100) + '%';
    clock.textContent = fmtT(pos) + ' / ' + fmtT(total) + ' · ' + "langkah" + ' ' + Math.min(idx + 1, rec.steps.length) + '/' + rec.steps.length + (extra ? ' · ' + extra : '');
  }
  // Jeda sebelum langkah i sambil menggerakkan progres timeline + hitung mundur.
  function sleepGap(i) {
    var g = gap(i), start = Date.now(), from = eff[i - 1] || 0, to = eff[i] || from;
    if (g <= 0) { pos = to; drawBar(''); return Promise.resolve(); }
    return new Promise(function (resolve) {
      clearInterval(tickT);
      tickT = setInterval(function () {
        var k = Math.min(1, (Date.now() - start) / g);
        pos = from + (to - from) * k;
        drawBar("jeda" + ' ' + Math.max(0, (g - (Date.now() - start)) / 1000).toFixed(1) + ' ' + "dtk");
        if (k >= 1 || stopFlag) { clearInterval(tickT); resolve(); }
      }, 50);
    });
  }
  // Klik timeline (saat tidak berjalan) = mulai dari langkah di titik itu.
  bar.onclick = function (e) {
    if (running || !rec) return;
    var r = bar.getBoundingClientRect(), want = (e.clientX - r.left) / r.width * total, j = 0;
    while (j < eff.length - 1 && eff[j] < want) j++;
    idx = j; pos = eff[j]; drawBar(''); info.textContent = "Mulai dari langkah " + (idx + 1);
  };
  function needsPw() { return rec && JSON.stringify(rec.steps).indexOf('{{password}}') >= 0; }
  function setRec(r, from) {
    if (!r || !Array.isArray(r.steps)) { info.textContent = "JSON tidak valid."; return false; }
    rec = r; idx = from || 0; ta.style.display = 'none';
    buildTimeline();
    pw.style.display = needsPw() ? '' : 'none';
    info.textContent = "Siap diputar: " + (r.title || '') + ' (' + r.steps.length + " langkah" + ')';
    var nav = r.steps.filter(function (s) { return s.type === 'navigate'; })[0];
    if (!from && nav && nav.url.split('#')[0] !== location.href.split('#')[0]) info.textContent += '\n' + "Peringatan: halaman ini bukan URL awal rekaman: " + nav.url;
    return true;
  }
  function load(s) { try { setRec(JSON.parse(s)); } catch (e) { info.textContent = "JSON tidak valid."; } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function fast() { return speed.value === '2x'; }
  // Jeda sebelum langkah i: selisih waktu rekaman (dibatasi 80 ms - 15 dtk), dibagi 2 untuk 2x, atau jeda tetap.
  function gap(i) {
    if (speed.value === 'fixed') return Math.max(0, +delay.value || 0);
    var d = rawGap(i);
    return fast() ? d / 2 : d;
  }
  function moveTo(x) {
    var r = x.getBoundingClientRect(), o = frameOffset(x.ownerDocument);
    cur.style.display = '';
    cur.style.left = Math.round(o.x + r.left + r.width / 2) + 'px'; cur.style.top = Math.round(o.y + r.top + r.height / 2) + 'px';
    return sleep(fast() ? 250 : 480);
  }
  function pulse() { cur.style.transform = 'scale(.55)'; setTimeout(function () { cur.style.transform = 'scale(1.5)'; }, 120); setTimeout(function () { cur.style.transform = ''; }, 320); }
  // Dokumen iframe satu domain dari 'frame' langkah (indeks window.frames bertingkat).
  function docOf(frame) {
    var w = window;
    (frame || []).forEach(function (i) { w = w && w.frames[i]; });
    try { return w ? w.document : null; } catch (e) { return null; }
  }
  // Geser koordinat elemen di iframe ke koordinat halaman utama (untuk kursor visual).
  function frameOffset(doc) {
    var x = 0, y = 0, w = doc.defaultView;
    while (w && w !== window && w.frameElement) { var r = w.frameElement.getBoundingClientRect(); x += r.left + w.frameElement.clientLeft; y += r.top + w.frameElement.clientTop; w = w.parent; }
    return { x: x, y: y };
  }
  function query(sel, doc) {
    doc = doc || document;
    try {
      if (sel.indexOf('text/') === 0) {
        var want = sel.slice(5);
        return [].filter.call(doc.querySelectorAll('button,a,[role=button],[role=link],[role=menuitem],[role=tab],label,span,div'), function (x) { return (x.textContent || '').trim() === want && x.offsetParent !== null; })[0] || null;
      }
      if (sel.indexOf('aria/') === 0) { var n = sel.slice(5).replace(/"/g, '\\"'); return doc.querySelector('[aria-label="' + n + '"]') || query('text/' + sel.slice(5), doc); }
      if (sel.indexOf('xpath/') === 0) return doc.evaluate(sel.slice(6), doc, null, 9, null).singleNodeValue;
      if (sel.indexOf('pierce/') === 0) return doc.querySelector(sel.slice(7));
      return doc.querySelector(sel);
    } catch (e) { return null; }
  }
  function find(groups, ms, frame) {
    var end = Date.now() + ms;
    return new Promise(function (resolve) {
      (function tick() {
        var doc = docOf(frame); // iframe bisa belum selesai dimuat -> coba lagi
        for (var i = 0; doc && i < groups.length; i++) { var g = groups[i], x = query(Array.isArray(g) ? g[g.length - 1] : g, doc); if (x) return resolve(x); }
        if (Date.now() > end || stopFlag) return resolve(null);
        setTimeout(tick, 200);
      })();
    });
  }
  function fire(x, type, Ctor, extra) { var ev = new Ctor(type, Object.assign({ bubbles: true, cancelable: true, composed: true }, extra || {})); return x.dispatchEvent(ev); }
  function setRaw(x, v) {
    if (x.tagName === 'SELECT') { x.value = v; return; }
    var W = (x.ownerDocument && x.ownerDocument.defaultView) || window; // elemen di iframe pakai prototype realm-nya
    var proto = x.tagName === 'TEXTAREA' ? W.HTMLTextAreaElement.prototype : W.HTMLInputElement.prototype;
    var d = Object.getOwnPropertyDescriptor(proto, 'value');
    if (d && d.set) d.set.call(x, v); else x.value = v;
  }
  // Ketik per karakter seperti user (select / teks panjang langsung diisi).
  function typeInto(x, v) {
    if (x.focus) x.focus();
    if (x.tagName === 'SELECT' || v.length > 120) { setRaw(x, v); fire(x, 'input', Event); fire(x, 'change', Event); return Promise.resolve(); }
    var i = 0;
    setRaw(x, ''); fire(x, 'input', Event);
    return new Promise(function (resolve) {
      (function step() {
        if (i >= v.length || stopFlag) { fire(x, 'change', Event); return resolve(); }
        i++; setRaw(x, v.slice(0, i)); fire(x, 'input', Event);
        setTimeout(step, fast() ? 15 : 35);
      })();
    });
  }
  // Putar ulang riwayat ketikan (ketik, hapus, ketik ulang) dengan jeda aslinya; timeline ikut maju.
  function replayTyping(x, s, finalV) {
    var tp = s.typing, base = eff[idx] || 0, k = 0, t0 = Date.now(), f = speed.value === 'fixed' ? 0 : fast() ? 0.5 : 1;
    if (x.focus) x.focus();
    return new Promise(function (resolve) {
      (function step() {
        if (stopFlag || k >= tp.length) {
          if (!stopFlag && x.value !== finalV) { setRaw(x, finalV); fire(x, 'input', Event); }
          fire(x, 'change', Event); return resolve();
        }
        var due = f ? tp[k][0] * f : k * 35;
        var wait = due - (Date.now() - t0);
        if (wait > 0) { setTimeout(step, Math.min(wait, 200)); pos = base + Math.min(Date.now() - t0, due) / (f || 1); drawBar("mengetik"); return; }
        setRaw(x, tp[k][1]); fire(x, 'input', Event); k++;
        pos = base + tp[k - 1][0]; drawBar("mengetik");
        setTimeout(step, 0);
      })();
    });
  }

  // at = langkah yang dijalankan setelah reload; auto = lanjut putar otomatis setelah Pup Play diklik lagi
  // at != null: aksi pemutar yang bisa memindah halaman -> tandai sebagai aksi user agar penjaga reload tidak bertanya.
  function persist(at) { if (at != null && window.__hookGuard) window.__hookGuard.mark(); try { sessionStorage.setItem(KEY, JSON.stringify({ rec: rec, idx: at == null ? idx : at, delay: delay.value, speed: speed.value, auto: running })); } catch (e) { /* abaikan */ } }
  function navUrl(s) { var n = (s.assertedEvents || []).filter(function (a) { return a.type === 'navigation' && a.url; })[0]; return n ? n.url.split('#')[0] : ''; }
  // Klik/Enter yang memicu pindah halaman: tunggu URL berubah (SPA) atau halaman diganti (non-SPA, skrip berhenti di sini).
  function waitNav(s) {
    var want = navUrl(s), end = Date.now() + 8000;
    if (!want) return Promise.resolve(true);
    return new Promise(function (resolve) {
      (function tick() {
        if (location.href.split('#')[0] === want || Date.now() > end || stopFlag) return resolve(true);
        setTimeout(tick, 200);
      })();
    });
  }
  function run(s) {
    if (s.type === 'setViewport' || s.type === 'emulateNetworkConditions') return Promise.resolve(true);
    if (s.type === 'navigate') {
      if (idx === 0 || s.url.split('#')[0] === location.href.split('#')[0]) return Promise.resolve(true);
      persist(idx + 1); info.textContent = "Pindah halaman. Klik bookmark Pup lagi setelah halaman terbuka untuk melanjutkan."; location.href = s.url; return Promise.resolve(false);
    }
    if (s.type === 'keyDown' || s.type === 'keyUp') {
      var kd = docOf(s.frame) || document, a = kd.activeElement || kd.body;
      persist(idx + 1);
      var ok = fire(a, s.type === 'keyDown' ? 'keydown' : 'keyup', KeyboardEvent, { key: s.key });
      if (s.type === 'keyDown' && s.key === 'Enter' && ok && a.form && a.tagName === 'INPUT') { if (a.form.requestSubmit) a.form.requestSubmit(); else a.form.submit(); }
      return waitNav(s);
    }
    if (s.type === 'scroll' && !s.selectors) { window.scrollTo(s.x || 0, s.y || 0); return Promise.resolve(true); }
    if (!s.selectors) return Promise.resolve(true);
    return find(s.selectors, 10000, s.frame).then(function (x) {
      if (!x) { info.textContent = "Elemen tidak ditemukan pada langkah " + (idx + 1) + ': ' + JSON.stringify(s.selectors[0] || ''); return null; }
      if (x.scrollIntoView) x.scrollIntoView({ block: 'center' });
      var oldOutline = x.style.outline;
      x.style.outline = '2px solid #f59e0b';
      return moveTo(x).then(function () {
        persist(idx + 1); // aksi ini bisa me-reload halaman: setelah reload lanjut ke langkah berikutnya, bukan mengulang
        var act = Promise.resolve();
        if (s.type === 'click' || s.type === 'doubleClick') {
          pulse();
          fire(x, 'pointerdown', PointerEvent); fire(x, 'mousedown', MouseEvent); if (x.focus) x.focus();
          fire(x, 'pointerup', PointerEvent); fire(x, 'mouseup', MouseEvent); x.click();
          if (s.type === 'doubleClick') fire(x, 'dblclick', MouseEvent);
        } else if (s.type === 'change') {
          var fv = String(s.value).split('{{password}}').join(pw.value);
          act = s.typing && s.typing.length > 1 && x.tagName !== 'SELECT' ? replayTyping(x, s, fv) : typeInto(x, fv);
        } else if (s.type === 'hover') {
          fire(x, 'pointerover', PointerEvent); fire(x, 'mouseover', MouseEvent); fire(x, 'mouseenter', MouseEvent, { bubbles: false }); fire(x, 'mousemove', MouseEvent);
        } else if (s.type === 'scroll' && x.scrollTo) { x.scrollTo(s.x || 0, s.y || 0); }
        return act.then(function () { setTimeout(function () { x.style.outline = oldOutline; }, 300); return waitNav(s); });
      });
    });
  }
  function play() {
    if (!rec) { info.textContent = "Tidak ada tab scanner. Tempel JSON rekaman lalu Muat JSON."; return; }
    if (running) return;
    running = true; stopFlag = false; ui.style.borderColor = '#16a34a';
    (function next() {
      if (stopFlag) { running = false; persist(); ui.style.borderColor = '#453429'; cur.style.display = 'none'; info.textContent = "Dihentikan."; return; }
      if (idx >= rec.steps.length) { running = false; ui.style.borderColor = '#453429'; cur.style.display = 'none'; pos = total; drawBar(''); info.textContent = "Selesai."; try { sessionStorage.removeItem(KEY); } catch (e) { /* abaikan */ } return; }
      persist();
      pos = eff[idx] || pos; drawBar(rec.steps[idx].type);
      info.textContent = (idx + 1) + '/' + rec.steps.length + ' ' + rec.steps[idx].type;
      run(rec.steps[idx]).then(function (r) {
        if (r === false) { running = false; return; }
        if (r === null) { running = false; persist(); ui.style.borderColor = '#b45309'; return; }
        idx++; return (idx < rec.steps.length ? sleepGap(idx) : Promise.resolve()).then(next);
      });
    })();
  }
  var resume = null;
  try { resume = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { resume = null; }
  if (resume && resume.rec) {
    setRec(resume.rec, resume.idx);
    if (resume.delay) delay.value = resume.delay;
    if (resume.speed) speed.value = resume.speed;
    var pwLeft = JSON.stringify(resume.rec.steps.slice(resume.idx)).indexOf('{{password}}') >= 0;
    pw.style.display = pwLeft ? '' : 'none';
    if (resume.auto && !pwLeft && resume.idx < resume.rec.steps.length) {
      info.textContent = "Lanjut otomatis dari langkah " + (resume.idx + 1);
      var go = function () { setTimeout(play, 800); };
      if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
    } else info.textContent = "Lanjut dari langkah " + (resume.idx + 1) + (pwLeft ? '. ' + "Isi password lalu klik Putar." : '');
    return;
  }
  if (boot && boot.rec && setRec(boot.rec)) {
    if (needsPw()) { info.textContent += '\n' + "Isi password lalu klik Putar."; return; }
    if (boot.auto) { info.textContent += '\n' + "Mulai otomatis..."; setTimeout(play, 700); }
    return;
  }
  info.textContent = "Tidak ada tab scanner. Tempel JSON rekaman lalu Muat JSON.";
}

// ---- Bookmarklet "Pup": lanjutkan rekam/putar yang sedang berjalan, terima rekaman dari tombol Putar di
// tab scanner (langsung diputar), atau tampilkan pilihan Rekam / Putar.
function pupLauncher(cfg, recFn, playFn) {
  if (window.__pupRecUi) { window.__pupRecUi.style.display = 'flex'; return; }
  if (window.__pupPlayUi) { window.__pupPlayUi.style.display = 'flex'; return; }
  cfg.openRec = function () { recFn(cfg); };
  cfg.openPlay = function () { playFn(cfg, null); };
  var rs = null, ps = null;
  try { rs = JSON.parse(sessionStorage.getItem('__pupRec') || 'null'); ps = JSON.parse(sessionStorage.getItem('__pupPlay') || 'null'); } catch (e) { rs = ps = null; }
  if (ps && ps.rec) { playFn(cfg, null); return; }
  if (rs && rs.active) { recFn(cfg); return; }
  var done = false, chooser = null;
  function pick(fn) { done = true; window.removeEventListener('message', onMsg); if (chooser) chooser.remove(); fn(); }
  function onMsg(e) {
    if (done || !e.data || e.data.type !== 'pup-play' || e.source !== window.opener) return;
    pick(function () { playFn(cfg, { rec: e.data.rec, auto: true }); });
  }
  if (window.opener) {
    window.addEventListener('message', onMsg);
    try { window.opener.postMessage({ type: 'pup-need' }, cfg.origin && cfg.origin !== 'null' ? cfg.origin : '*'); } catch (e) { /* opener terputus */ }
  }
  setTimeout(function () {
    if (done) return;
    chooser = document.createElement('div');
    Object.assign(chooser.style, { position: 'fixed', right: '12px', bottom: '12px', background: 'linear-gradient(160deg, #211914 0%, #14100d 100%)', color: '#f3ece4', font: '12px/1.4 Consolas,monospace', border: '2px solid #c87840', borderRadius: '10px', boxShadow: '0 12px 30px rgba(0,0,0,.55)', zIndex: 2147483647, display: 'flex', gap: '6px', alignItems: 'center', padding: '8px 10px' });
    var t = document.createElement('b'); t.textContent = 'Pup'; chooser.appendChild(t);
    [["⏺ Rekam", function () { pick(cfg.openRec); }], ["▶ Putar", function () { pick(cfg.openPlay); }], ["Tutup", function () { pick(function () {}); }]].forEach(function (o) {
      var b = document.createElement('button'); b.textContent = o[0]; b.onclick = o[1];
      Object.assign(b.style, { background: '#2c211b', color: '#f3ece4', border: '1px solid #453429', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' });
      chooser.appendChild(b);
    });
    document.body.appendChild(chooser);
  }, window.opener ? 900 : 0);
}
function pupAppCfg() {
  const app = location.protocol === 'file:' ? '' : location.href.split('#')[0];
  return { app, origin: location.origin };
}
function pupScript() { return localizeScript('(' + hookGuardInstall.toString() + ')();\n(' + pupLauncher.toString() + ')(' + JSON.stringify(pupAppCfg()) + ',\n' + pupRecorderMain.toString() + ',\n' + pupPlayerMain.toString() + ');'); }

// ---- IndexedDB milik halaman scanner.
function pupOpen() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error(tr('pup_no_idb'))); return; }
    const r = indexedDB.open(PUP_DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(PUP_STORE, { keyPath: 'id', autoIncrement: true }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function pupTx(mode, work) {
  return pupOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(PUP_STORE, mode), st = tx.objectStore(PUP_STORE);
    let out;
    work(st, v => { out = v; });
    tx.oncomplete = () => { db.close(); resolve(out); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  }));
}
function pupAll() { return pupTx('readonly', (st, set) => { const r = st.getAll(); r.onsuccess = () => set(r.result || []); }); }
function pupPutMany(recs) { return pupTx('readwrite', st => { recs.forEach(r => st.put(r)); }); }
function pupDelMany(ids) { return pupTx('readwrite', st => { ids.forEach(id => st.delete(id)); }); }
// Rekaman dari bookmarklet/file -> bentuk simpan; null bila bukan rekaman.
function pupNormalize(o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.steps) || !o.steps.length) return null;
  if (!o.steps.every(s => s && typeof s === 'object' && typeof s.type === 'string')) return null;
  const nav = o.steps.find(s => s.type === 'navigate' && typeof s.url === 'string');
  const url = String(o.url || (nav && nav.url) || '');
  return { title: String(o.title || 'Rekaman').slice(0, 200), url, group: String(o.group || '').trim().slice(0, 80), origin: String(o.origin || (url ? (() => { try { return new URL(url).origin; } catch (e) { return ''; } })() : '')),
    created: Number(o.created) || Date.now(), updated: Date.now(), steps: o.steps };
}
function pupFromFile(obj) {
  if (obj && obj.type === 'pup-bundle' && Array.isArray(obj.recordings)) return obj.recordings.map(pupNormalize).filter(Boolean);
  if (Array.isArray(obj)) return obj.map(pupNormalize).filter(Boolean);
  const one = pupNormalize(obj);
  return one ? [one] : [];
}
// Format Chrome Recorder murni (tanpa waktu 't' milik Pup); keepT untuk pemutaran di tab target.
function pupRecorderJson(r, keepT) {
  return { title: r.title, steps: r.steps.map(s => { const c = Object.assign({}, s); if (!keepT) { delete c.t; delete c.wait; delete c.typing; } return c; }) };
}
// Jeda sebelum langkah i (ms): 'wait' hasil edit atau selisih waktu rekaman (dikurangi lama mengetik). Tanpa batas atas.
function pupStepGap(r, i) {
  const a = r.steps[i - 1], b = r.steps[i];
  if (!a || !b) return null;
  if (typeof b.wait === 'number') return { ms: Math.max(0, b.wait), edited: true };
  const typ = a.typing && a.typing.length ? a.typing[a.typing.length - 1][0] : 0;
  if (typeof a.t === 'number' && typeof b.t === 'number') { const raw = b.t - a.t - typ; return { ms: Math.max(0, raw), edited: false, raw }; }
  return null;
}
function pupSize(r) { try { return new Blob([JSON.stringify(r)]).size; } catch (e) { return 0; } }
function pupFileName(s, ext) { return (String(s || 'rekaman').replace(/[^\w.-]+/g, '_').slice(0, 80) || 'rekaman') + ext; }
function pupDownload(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function pupStepTarget(s) {
  if (s.url) return s.url;
  if (s.selectors && s.selectors.length) { const g = s.selectors[0]; return Array.isArray(g) ? g.join(' >>> ') : String(g); }
  if (s.type === 'scroll') return 'x=' + (s.x || 0) + ' y=' + (s.y || 0);
  if (s.width) return s.width + 'x' + s.height;
  return '';
}
function pupStepValue(s) {
  if (Array.isArray(s.typing) && s.typing.length > 1) {
    // ringkas riwayat: nilai yang berbeda berurutan, mis. "bess → be → paiton"
    const seen = [];
    s.typing.forEach(p => { const v = p[1]; if (!seen.length || seen[seen.length - 1] !== v) seen.push(v); });
    const words = seen.filter((v, k) => k === seen.length - 1 || !(seen[k + 1].indexOf(v) === 0 && seen[k + 1].length > v.length));
    return words.slice(-8).map(v => v === '' ? '∅' : v).join(' → ');
  }
  return s.value != null ? String(s.value) : s.key ? s.key : '';
}
// Script Node + Puppeteer (npm i puppeteer). Password dari env PUP_PASSWORD.
function pupToPuppeteer(r) {
  const J = v => JSON.stringify(v);
  const val = v => (String(v).indexOf('{{password}}') >= 0 ? J(String(v)) + ".split('{{password}}').join(process.env.PUP_PASSWORD || '')" : J(String(v)));
  const sels = s => J((s.selectors || []).map(g => (Array.isArray(g) ? g[g.length - 1] : g)).map(x => (x.indexOf('text/') === 0 ? '::-p-text(' + x.slice(5) + ')' : x.indexOf('aria/') === 0 ? '::-p-aria(' + x.slice(5) + ')' : x.indexOf('xpath/') === 0 ? '::-p-xpath(' + x.slice(6) + ')' : x.indexOf('pierce/') === 0 ? 'pierce/' + x.slice(7) : x)));
  const ctx = s => (Array.isArray(s.frame) && s.frame.length ? 'frameAt(page, ' + J(s.frame) + ')' : 'page');
  const lines = [
    '// ' + r.title,
    '// Ekspor dari Puppeteer Record. Jalankan: npm i puppeteer && node ' + pupFileName(r.title, '.js'),
    '// Field password: set env PUP_PASSWORD sebelum menjalankan.',
    "const puppeteer = require('puppeteer');",
    '// Riwayat ketikan: ketik / hapus / ketik ulang sesuai rekaman (pencarian per kata ikut terpicu).',
    'async function typeSteps(el, snaps) {',
    "  await el.click({ clickCount: 3 }); await el.press('Backspace');",
    "  let cur = '', prev = 0;",
    '  for (const [dt, v] of snaps) {',
    '    await wait(Math.max(0, dt - prev)); prev = dt;',
    '    let p = 0; while (p < cur.length && p < v.length && cur[p] === v[p]) p++;',
    "    for (let k = cur.length; k > p; k--) await el.press('Backspace');",
    '    if (v.length > p) await el.type(v.slice(p));',
    '    cur = v;',
    '  }',
    '}',
    '// Langkah di iframe: frame = indeks frame bertingkat (sama dengan window.frames di browser).',
    'function frameAt(page, path) { let f = page.mainFrame(); for (const i of path) f = f.childFrames()[i]; return f; }',
    'async function find(page, sels) {',
    '  for (const s of sels) { try { return await page.waitForSelector(s, { visible: true, timeout: 3000 }); } catch (e) { /* coba selector berikutnya */ } }',
    "  throw new Error('Elemen tidak ditemukan: ' + JSON.stringify(sels));",
    '}',
    'async function settle(page) { await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {}); }',
    '// Jeda antar langkah = waktu asli saat direkam (maks 15 dtk). PUP_SPEED=2 -> 2x lebih cepat, PUP_SPEED=0 -> tanpa jeda.',
    'const SPEED = Number(process.env.PUP_SPEED || 1);',
    'const wait = ms => (SPEED > 0 ? new Promise(r => setTimeout(r, ms / SPEED)) : Promise.resolve());',
    '(async () => {',
    '  const browser = await puppeteer.launch({ headless: false });',
    '  const page = await browser.newPage();',
    '  try {'
  ];
  r.steps.forEach((s, i) => {
    const nav = Array.isArray(s.assertedEvents) && s.assertedEvents.some(a => a.type === 'navigation');
    const prev = r.steps[i - 1];
    lines.push('    // ' + (i + 1) + '. ' + s.type);
    const g = i > 0 ? pupStepGap(r, i) : null;
    if (g && g.ms > 0) lines.push('    await wait(' + Math.round(g.ms) + ');');
    if (s.type === 'setViewport') lines.push('    await page.setViewport({ width: ' + (+s.width || 1280) + ', height: ' + (+s.height || 800) + ' });');
    else if (s.type === 'navigate') lines.push('    await page.goto(' + J(s.url) + ", { waitUntil: 'networkidle2' });");
    else if (s.type === 'click' || s.type === 'doubleClick') lines.push('    await (await find(' + ctx(s) + ', ' + sels(s) + ')).click(' + (s.type === 'doubleClick' ? '{ clickCount: 2 }' : '') + ');');
    else if (s.type === 'change' && Array.isArray(s.typing) && s.typing.length > 1) {
      lines.push('    await typeSteps(await find(' + ctx(s) + ', ' + sels(s) + '), ' + J(s.typing) + ');');
    } else if (s.type === 'change') {
      lines.push('    { const el = await find(' + ctx(s) + ', ' + sels(s) + ');');
      lines.push("      if (await el.evaluate(e => e.tagName === 'SELECT')) await el.select(" + val(s.value) + ');');
      lines.push("      else { await el.click({ clickCount: 3 }); await el.press('Backspace'); await el.type(" + val(s.value) + '); } }');
    } else if (s.type === 'keyDown') lines.push('    await page.keyboard.down(' + J(s.key) + ');');
    else if (s.type === 'keyUp') lines.push('    await page.keyboard.up(' + J(s.key) + ');');
    else if (s.type === 'scroll') lines.push('    await page.evaluate((x, y) => window.scrollTo(x, y), ' + (+s.x || 0) + ', ' + (+s.y || 0) + ');');
    else if (s.type === 'hover') lines.push('    await (await find(' + ctx(s) + ', ' + sels(s) + ')).hover();');
    else if (s.type === 'waitForElement') lines.push('    await find(' + ctx(s) + ', ' + sels(s) + ');');
    else lines.push('    // (langkah ' + J(s.type) + ' dilewati)');
    if (nav) lines.push('    await settle(page);');
  });
  lines.push('  } finally {', '    // await browser.close();', '  }', '})();');
  return lines.join('\n') + '\n';
}
function pupFmtBytes(n) { if (!n && n !== 0) return '?'; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; } return n.toFixed(i ? 1 : 0) + ' ' + u[i]; }

// ============================================================
//  OCR Gambar: tempel/drop gambar -> teks. Simple = Tesseract.js (lokal, via CDN) atau
//  OCR.space (API publik); Advance = endpoint AI OpenAI-compatible milik user (vision).
//  Token/API key hanya di memori; base URL + model boleh diingat di localStorage.
//  Hasil OCR tidak tepercaya: hanya ditampilkan sebagai teks (tanpa v-html).
// ============================================================
const OCR_PREFS_KEY = 'scaOcrPrefs';
const TESS_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';
const OCR_PRESETS = [
  { key: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'google/gemini-2.5-flash' },
  { key: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { key: 'gemini', label: 'Google Gemini (OpenAI-compatible)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  { key: 'ollama', label: 'Ollama (lokal)', baseUrl: 'http://localhost:11434/v1', model: 'llava' },
  { key: 'custom', label: 'Custom', baseUrl: '', model: '' }
];
const OCR_I18N = {
  id: {
    tab_ocr: 'OCR Gambar', ocr_title: 'OCR Gambar (gambar -> teks)',
    ocr_intro: 'Tempel screenshot (Ctrl+V di tab ini), drop, atau pilih gambar, lalu ambil teksnya. Cocok untuk screenshot log, error, token, atau potongan kode yang mau dicek di Smart Decode / SAST.',
    ocr_drop: 'Ctrl+V untuk tempel gambar, atau drop / klik untuk pilih file', ocr_drop_sub: 'PNG, JPG, WebP, BMP, GIF',
    ocr_paste_btn: 'Tempel dari clipboard', ocr_clear: 'Hapus gambar', ocr_preview: 'Pratinjau gambar',
    ocr_mode: 'Mode', ocr_eng_tess: 'Simple: Tesseract.js', ocr_eng_tess_d: 'Jalan di browser, gambar tidak dikirim ke mana-mana',
    ocr_eng_space: 'Simple: OCR.space API', ocr_eng_space_d: 'API publik gratis, gambar dikirim ke ocr.space',
    ocr_eng_ai: 'Advance: AI (token sendiri)', ocr_eng_ai_d: 'Model vision OpenAI-compatible, hasil lebih detail',
    ocr_lang: 'Bahasa', ocr_lang_ind_eng: 'Indonesia + English', ocr_lang_eng: 'English', ocr_lang_ind: 'Indonesia', ocr_tess_note: 'Pertama kali perlu unduh library + data bahasa (±5–15 MB), setelah itu di-cache.',
    ocr_space_ph: 'kosong = key demo publik', ocr_space_note: 'Key demo terbatas (maks ±1 MB, ada rate limit). Daftar key gratis di ocr.space untuk kuota lebih.',
    ocr_ai_preset: 'Provider', ocr_ai_detail: 'Hasil', ocr_ai_m_detail: 'Detail (teks + tabel + ringkasan)', ocr_ai_m_text: 'Teks saja (persis)',
    ocr_ai_model_ph: 'nama model yang mendukung gambar', ocr_ai_token_ph: 'API key / token (hanya di memori, hilang saat reload)',
    ocr_ai_note: 'Endpoint dipanggil langsung dari browser: POST {Base URL}/chat/completions. Provider harus mengizinkan CORS (OpenRouter, OpenAI, Gemini bisa; Ollama perlu OLLAMA_ORIGINS=*). Token tidak pernah disimpan.',
    ocr_ai_prompt: 'Prompt (opsional, kosong = bawaan)',
    ocr_run: 'Ambil teks', ocr_result: 'Hasil', ocr_empty: 'Tidak ada teks yang terbaca.', ocr_copy: 'Copy',
    ocr_auto: 'Langsung ambil teks saat gambar di-paste/drop', ocr_tr_on: 'Terjemahkan otomatis ke', ocr_tr_auto: 'Otomatis (Indonesia ↔ English)',
    ocr_tr_title: 'Terjemahan', ocr_tr_run: 'Terjemahkan', ocr_tr_busy: 'Menerjemahkan…', ocr_tr_fail: 'Gagal menerjemahkan', ocr_tr_note: 'Teks dikirim ke Google Translate (cadangan MyMemory). Matikan centang untuk teks rahasia.',
    ocr_tr_l_id: 'Indonesia', ocr_tr_l_en: 'English', ocr_tr_l_ja: 'Jepang', 'ocr_tr_l_zh-CN': 'Mandarin', ocr_tr_l_ko: 'Korea', ocr_tr_l_ar: 'Arab',
    ocr_e_noimg: 'Clipboard tidak berisi gambar.', ocr_e_clip: 'Browser menolak baca clipboard. Pakai Ctrl+V langsung di tab ini.',
    ocr_e_type: 'File bukan gambar.', ocr_e_big: 'Gambar terlalu besar (maks 20 MB).', ocr_e_cfg: 'Isi Base URL, Model, dan Token dulu.',
    ocr_e_url: 'Base URL harus http(s)://', ocr_e_tess: 'Gagal memuat Tesseract.js dari CDN (cek koneksi).',
    ocr_e_cors: 'Request diblokir (CORS / jaringan). Provider ini mungkin tidak bisa dipanggil langsung dari browser.',
    ocr_p_load: 'Memuat Tesseract.js…', ocr_p_send: 'Mengirim gambar…', ocr_p_resize: 'Memperkecil gambar…',
    ocr_prompt_text: 'Transkripsikan semua teks di gambar ini persis apa adanya (pertahankan baris, spasi, simbol, huruf besar/kecil). Jangan menambah penjelasan. Jika tidak ada teks, balas kosong.',
    ocr_prompt_detail: 'Baca gambar ini secara detail. 1) Transkripsikan semua teks persis apa adanya, pertahankan urutan dan baris. 2) Tabel tulis ulang sebagai tabel Markdown. 3) Kode/log/JSON taruh di blok kode. 4) Akhiri dengan bagian "Ringkasan" berisi 1-3 kalimat tentang isi gambar. Jawab dalam bahasa Indonesia, tetapi teks hasil transkripsi tetap bahasa aslinya.',
    grp_ocr_title: 'OCR Gambar — baca teks dari gambar', grp_ocr_desc: 'Hanya dipakai di tab OCR Gambar. Tesseract jalan di browser; OCR.space dan AI menerima gambar yang Anda kirim.'
  },
  en: {
    tab_ocr: 'Image OCR', ocr_title: 'Image OCR (image -> text)',
    ocr_intro: 'Paste a screenshot (Ctrl+V on this tab), drop, or pick an image, then extract its text. Handy for screenshots of logs, errors, tokens, or code you want to check in Smart Decode / SAST.',
    ocr_drop: 'Ctrl+V to paste an image, or drop / click to pick a file', ocr_drop_sub: 'PNG, JPG, WebP, BMP, GIF',
    ocr_paste_btn: 'Paste from clipboard', ocr_clear: 'Clear image', ocr_preview: 'Image preview',
    ocr_mode: 'Mode', ocr_eng_tess: 'Simple: Tesseract.js', ocr_eng_tess_d: 'Runs locally in the browser; images are never uploaded',
    ocr_eng_space: 'Simple: OCR.space API', ocr_eng_space_d: 'Free public API; images are sent to ocr.space',
    ocr_eng_ai: 'Advanced: AI (your own token)', ocr_eng_ai_d: 'OpenAI-compatible vision model, more detailed output',
    ocr_lang: 'Language', ocr_lang_ind_eng: 'Indonesian + English', ocr_lang_eng: 'English', ocr_lang_ind: 'Indonesian', ocr_tess_note: 'First run downloads library + language data (~5–15 MB), cached afterwards.',
    ocr_space_ph: 'Leave blank for public demo key', ocr_space_note: 'Demo key is limited (max ~1 MB, rate-limited). Register for a free key at ocr.space for more quota.',
    ocr_ai_preset: 'Provider', ocr_ai_detail: 'Output', ocr_ai_m_detail: 'Detailed (text + tables + summary)', ocr_ai_m_text: 'Text only (verbatim)',
    ocr_ai_model_ph: 'model name supporting images', ocr_ai_token_ph: 'API key / token (memory only, cleared on reload)',
    ocr_ai_note: 'The endpoint is called straight from the browser: POST {Base URL}/chat/completions. The provider must allow CORS (OpenRouter, OpenAI, Gemini do; Ollama needs OLLAMA_ORIGINS=*). The token is never stored.',
    ocr_ai_prompt: 'Prompt (optional, empty = default)',
    ocr_run: 'Extract text', ocr_result: 'Result', ocr_empty: 'No text found.', ocr_copy: 'Copy',
    ocr_auto: 'Extract text as soon as an image is pasted/dropped', ocr_tr_on: 'Auto-translate to', ocr_tr_auto: 'Auto (Indonesian ↔ English)',
    ocr_tr_title: 'Translation', ocr_tr_run: 'Translate', ocr_tr_busy: 'Translating…', ocr_tr_fail: 'Translation failed', ocr_tr_note: 'Text is sent to Google Translate (MyMemory as fallback). Untick for confidential text.',
    ocr_tr_l_id: 'Indonesian', ocr_tr_l_en: 'English', ocr_tr_l_ja: 'Japanese', 'ocr_tr_l_zh-CN': 'Chinese', ocr_tr_l_ko: 'Korean', ocr_tr_l_ar: 'Arabic',
    ocr_e_noimg: 'Clipboard does not contain an image.', ocr_e_clip: 'Browser denied clipboard access. Press Ctrl+V directly on this tab.',
    ocr_e_type: 'Selected file is not an image.', ocr_e_big: 'Image too large (max 20 MB).', ocr_e_cfg: 'Fill in Base URL, Model, and Token first.',
    ocr_e_url: 'Base URL must start with http(s)://', ocr_e_tess: 'Could not load Tesseract.js from the CDN (check your connection).',
    ocr_e_cors: 'Request blocked (CORS / network). This provider may not allow direct browser calls.',
    ocr_p_load: 'Loading Tesseract.js…', ocr_p_send: 'Sending image…', ocr_p_resize: 'Resizing image…',
    ocr_prompt_text: 'Transcribe all text in this image exactly as it is (keep lines, spacing, symbols, letter case). Do not add any explanation. If there is no text, reply with nothing.',
    ocr_prompt_detail: 'Read this image in detail. 1) Transcribe all text exactly as it is, keeping order and line breaks. 2) Rewrite tables as Markdown tables. 3) Put code/logs/JSON in code blocks. 4) End with a "Summary" section of 1-3 sentences about the image. Answer in English, but keep transcribed text in its original language.',
    grp_ocr_title: 'Image OCR — read text from images', grp_ocr_desc: 'Used only in the Image OCR tab. Tesseract runs in the browser; OCR.space and the AI endpoint receive the image you send.',
    api_tess_use: 'OCR library (WASM) + language data, runs locally in the browser.', api_tess_sends: 'nothing (downloads the library/data only)', api_tess_when: 'Image OCR tab — Tesseract mode',
    api_ocrspace_use: 'Public OCR API (engine 2, auto language).', api_ocrspace_sends: 'the image (base64), API key', api_ocrspace_when: 'Image OCR tab — OCR.space mode',
    api_aiocr_use: 'Vision model reads the image; detailed mode also returns tables and a summary.', api_aiocr_sends: 'the image (base64), prompt, your token', api_aiocr_when: 'Image OCR tab — AI mode'
  }
};
Object.keys(OCR_I18N).forEach(l => { I18N[l] = Object.assign({}, OCR_I18N[l], I18N[l] || {}); });
// Muat Tesseract.js sekali (elemen <script> dari CDN, bukan eval).
let tessLoading = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tessLoading) return tessLoading;
  tessLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESS_SRC; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error(tr('ocr_e_tess'))));
    s.onerror = () => { tessLoading = null; s.remove(); reject(new Error(tr('ocr_e_tess'))); };
    document.head.appendChild(s);
  });
  return tessLoading;
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result); r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
// Perkecil gambar (sisi terpanjang <= maxSide, lalu turunkan kualitas JPEG) sampai <= maxBytes.
// Terjemahan teks OCR: Google Translate (endpoint gtx publik), cadangan MyMemory. Teks dipotong per baris supaya URL tidak kepanjangan.
const OCR_TR_LANGS = ['auto', 'id', 'en', 'ja', 'zh-CN', 'ko', 'ar'];
function ocrTrChunks(text, max) {
  const out = []; let cur = '';
  text.split('\n').forEach(line => {
    while (line.length > max) { if (cur) { out.push(cur); cur = ''; } out.push(line.slice(0, max)); line = line.slice(max); }
    if (cur.length + line.length + 1 > max) { out.push(cur); cur = ''; }
    cur += (cur ? '\n' : '') + line;
  });
  if (cur) out.push(cur);
  return out;
}
async function ocrTranslateText(text, to) {
  try {
    let src = '', res = '';
    for (const part of ocrTrChunks(text, 1800)) {
      const r = await apiFetch('gtx', 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(to) + '&dt=t&q=' + encodeURIComponent(part));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      res += (res ? '\n' : '') + (d[0] || []).map(x => x[0] || '').join('');
      if (!src && typeof d[2] === 'string') src = d[2];
    }
    return { text: res, src };
  } catch (e) {
    let res = '';
    for (const part of ocrTrChunks(text, 450)) {
      const r = await apiFetch('mymemory', 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(part) + '&langpair=' + encodeURIComponent('Autodetect|' + to));
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || !d.responseData) throw new Error((e && e.message) || 'translate');
      res += (res ? '\n' : '') + (d.responseData.translatedText || '');
    }
    return { text: res, src: '' };
  }
}
async function ocrShrink(blob, maxBytes, maxSide) {
  if (blob.size <= maxBytes && !maxSide) return blob;
  const bmp = await createImageBitmap(blob);
  let side = Math.max(bmp.width, bmp.height);
  let scale = maxSide && side > maxSide ? maxSide / side : 1;
  if (scale === 1 && blob.size <= maxBytes) { bmp.close && bmp.close(); return blob; }
  let out = blob;
  for (let i = 0; i < 8; i++) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(bmp.height * scale));
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    out = await new Promise(res => c.toBlob(res, 'image/jpeg', i < 3 ? 0.9 : 0.8));
    if (out && out.size <= maxBytes) break;
    scale *= 0.8;
  }
  bmp.close && bmp.close();
  return out || blob;
}
// Isi jawaban chat/completions bisa string atau array bagian {type:'text', text}.
function aiContentText(msg) {
  const c = msg && msg.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(p => (p && typeof p.text === 'string' ? p.text : '')).join('');
  return '';
}

// ============================================================
//  Color Picker: ambil warna dari gambar (tempel/drop/pilih/contoh), dari layar (EyeDropper
//  atau screenshot getDisplayMedia), atau dari palet. Format HEX/RGB(A)/HSL/HSV/CMYK, kontras
//  WCAG, koleksi dengan peran (primary, background, ...) + ekspor prompt AI / CSS / Tailwind.
//  Koleksi + riwayat + thumbnail kecil disimpan di localStorage (tanpa API apa pun).
// ============================================================
const COL_KEY = 'scaColor';
const COL_HIST_MAX = 500, COL_THUMB_MAX = 40;
const COL_ROLES = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted', 'border', 'success', 'warning', 'danger', 'info'];
const COL_TW_RAW = {
  slate: 'f1f5f9 cbd5e1 64748b 334155 0f172a', gray: 'f3f4f6 d1d5db 6b7280 374151 111827',
  red: 'fee2e2 fca5a5 ef4444 b91c1c 7f1d1d', orange: 'ffedd5 fdba74 f97316 c2410c 7c2d12',
  amber: 'fef3c7 fcd34d f59e0b b45309 78350f', yellow: 'fef9c3 fde047 eab308 a16207 713f12',
  lime: 'ecfccb bef264 84cc16 4d7c0f 365314', green: 'dcfce7 86efac 22c55e 15803d 14532d',
  emerald: 'd1fae5 6ee7b7 10b981 047857 064e3b', teal: 'ccfbf1 5eead4 14b8a6 0f766e 134e4a',
  cyan: 'cffafe 67e8f9 06b6d4 0e7490 164e63', sky: 'e0f2fe 7dd3fc 0ea5e9 0369a1 0c4a6e',
  blue: 'dbeafe 93c5fd 3b82f6 1d4ed8 1e3a8a', indigo: 'e0e7ff a5b4fc 6366f1 4338ca 312e81',
  violet: 'ede9fe c4b5fd 8b5cf6 6d28d9 4c1d95', purple: 'f3e8ff d8b4fe a855f7 7e22ce 581c87',
  fuchsia: 'fae8ff f0abfc d946ef a21caf 701a75', pink: 'fce7f3 f9a8d4 ec4899 be185d 831843',
  rose: 'ffe4e6 fda4af f43f5e be123c 881337'
};
const COL_TW = Object.keys(COL_TW_RAW).map(name => ({ name, shades: COL_TW_RAW[name].split(' ').map((h, i) => ({ k: [100, 300, 500, 700, 900][i], hex: '#' + h })) }));
const COL_I18N = {
  id: {
    tab_color: 'Color Picker', col_title: 'Color Picker (ambil warna untuk tema FE)',
    col_intro: 'Ambil warna dari layar, screenshot, gambar yang ditempel (Ctrl+V), contoh gambar, atau palet. Lihat HEX/RGBA/HSL/dll + kontras WCAG, kumpulkan ke koleksi dengan peran (primary, background, ...), lalu ekspor sebagai prompt AI, CSS variables, atau Tailwind. Koleksi & riwayat tersimpan di browser ini.',
    col_screen: 'Ambil dari layar', col_screenshot: 'Screenshot layar', col_pick_file: 'Pilih gambar', col_paste: 'Tempel dari clipboard',
    col_samples: 'Contoh:', col_sample_ui: 'Mockup UI', col_sample_spectrum: 'Spektrum', col_sample_sunset: 'Senja',
    col_drop: 'Ctrl+V untuk tempel gambar, atau drop / klik untuk pilih file', col_drop_sub: 'Klik di gambar untuk ambil warna; warna dominan dihitung otomatis',
    col_sample_size: 'Sampel', col_clear_img: 'Tutup gambar', col_click_hint: 'Klik = ambil warna', col_dominant: 'Warna dominan:', col_add_all: 'masukkan semua ke koleksi',
    col_palette: 'Palet', col_manual_ph: '#1e3a8a / rgb(30,58,138) / hsl(224 64% 33%)',
    col_collect: 'Koleksi', col_nearest: 'Mirip Tailwind', col_contrast: 'Kontras WCAG', col_vs_white: 'vs putih', col_vs_black: 'vs hitam', col_shades: 'Tint/shade:',
    col_collection: 'Koleksi warna', col_coll_empty: 'Belum ada. Ambil warna lalu klik "+ Koleksi".', col_role_none: '(peran)',
    col_auto_roles: 'Isi peran otomatis', col_exp_ai: 'Prompt untuk AI', col_copy_exp: 'Copy ekspor', col_clear_coll: 'Kosongkan koleksi',
    col_history: 'Riwayat ambil warna', col_clear_hist: 'hapus riwayat', col_th_color: 'Warna', col_th_src: 'Sumber', col_th_time: 'Waktu', col_use: 'pakai', col_more: 'Tampilkan lagi',
    col_e_noimg: 'Clipboard tidak berisi gambar.', col_e_clip: 'Browser menolak baca clipboard. Pakai Ctrl+V langsung di tab ini.', col_e_type: 'File bukan gambar.',
    col_e_parse: 'Format warna tidak dikenali.', col_e_screen: 'Gagal mengambil layar: ', col_eyedrop_fallback: 'Browser ini belum mendukung EyeDropper; pakai screenshot layar lalu klik di gambar.',
    col_src_screen: 'layar', col_src_shot: 'screenshot layar', col_cancel: 'Dibatalkan.',
    col_confirm_clear: 'Hapus semua?',
    col_ai_head: 'Saya akan membangun sebuah website. Gunakan palet warna berikut sebagai warna dasar tema:',
    col_ai_tail: 'Buat design token (CSS variables) untuk light dan dark mode dari palet ini, turunkan skala 50-900 bila perlu, pastikan kontras teks memenuhi WCAG AA (min 4.5:1), dan pakai warna secara konsisten untuk tombol, link, background, card, border, dan status (success/warning/danger/info). Tampilkan juga contoh komponen yang memakainya.',
    col_ai_norole: 'warna tambahan',
    grp_color_title: 'Color Picker', grp_color_desc: 'Tidak memakai API: gambar dan warna diproses lokal di browser.'
  },
  en: {
    tab_color: 'Color Picker', col_title: 'Color Picker (pick colors for frontend themes)',
    col_intro: 'Pick colors from the screen, a screenshot, a pasted image (Ctrl+V), sample images, or a palette. View HEX/RGBA/HSL/etc + WCAG contrast, organize into a collection with roles (primary, background, ...), then export as an AI prompt, CSS variables, or Tailwind config. Collection & history are stored in this browser.',
    col_screen: 'Pick from screen', col_screenshot: 'Screenshot', col_pick_file: 'Choose image', col_paste: 'Paste from clipboard',
    col_samples: 'Samples:', col_sample_ui: 'UI mockup', col_sample_spectrum: 'Spectrum', col_sample_sunset: 'Sunset',
    col_drop: 'Ctrl+V to paste an image, or drop / click to pick a file', col_drop_sub: 'Click the image to pick a color; dominant colors are computed automatically',
    col_sample_size: 'Sample size', col_clear_img: 'Close image', col_click_hint: 'Click = pick color', col_dominant: 'Dominant colors:', col_add_all: 'add all to collection',
    col_palette: 'Palette', col_manual_ph: '#1e3a8a / rgb(30,58,138) / hsl(224 64% 33%)',
    col_collect: 'Collect', col_nearest: 'Closest Tailwind', col_contrast: 'WCAG contrast', col_vs_white: 'vs white', col_vs_black: 'vs black', col_shades: 'Tints/shades:',
    col_collection: 'Color collection', col_coll_empty: 'No colors yet. Pick a color, then click "+ Collect".', col_role_none: '(role)',
    col_auto_roles: 'Auto-assign roles', col_exp_ai: 'AI prompt', col_copy_exp: 'Copy export', col_clear_coll: 'Clear collection',
    col_history: 'Color history', col_clear_hist: 'clear history', col_th_color: 'Color', col_th_src: 'Source', col_th_time: 'Time', col_use: 'use', col_more: 'Show more',
    col_e_noimg: 'Clipboard does not contain an image.', col_e_clip: 'Browser denied clipboard access. Press Ctrl+V directly on this tab.', col_e_type: 'Selected file is not an image.',
    col_e_parse: 'Unrecognized color format.', col_e_screen: 'Failed to capture screen: ', col_eyedrop_fallback: 'EyeDropper API is not supported in this browser; take a screenshot and pick from the image.',
    col_src_screen: 'screen', col_src_shot: 'screenshot', col_cancel: 'Cancelled.',
    col_confirm_clear: 'Clear all?',
    col_ai_head: 'I am going to build a website. Use the following color palette as the base theme colors:',
    col_ai_tail: 'Create design tokens (CSS variables) for light and dark mode from this palette, derive a 50-900 scale where needed, make sure text contrast meets WCAG AA (min 4.5:1), and use the colors consistently for buttons, links, backgrounds, cards, borders, and states (success/warning/danger/info). Also show sample components that use them.',
    col_ai_norole: 'additional color',
    grp_color_title: 'Color Picker', grp_color_desc: 'Uses no API: images and colors are processed locally in the browser.'
  }
};
Object.keys(COL_I18N).forEach(l => { I18N[l] = Object.assign({}, COL_I18N[l], I18N[l] || {}); });

const colClamp = (v, a, b) => Math.min(b, Math.max(a, v));
const colH2 = n => Math.round(colClamp(n, 0, 255)).toString(16).padStart(2, '0');
function colToHex(c, withAlpha) { return '#' + colH2(c.r) + colH2(c.g) + colH2(c.b) + (withAlpha ? colH2(Math.round((c.a == null ? 1 : c.a) * 255)) : ''); }
function colFromHex(h) {
  let s = String(h || '').trim().replace(/^#/, '');
  if (!/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return null;
  if (s.length <= 4) s = s.split('').map(ch => ch + ch).join('');
  const n = i => parseInt(s.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: s.length === 8 ? Math.round(n(6) / 255 * 100) / 100 : 1 };
}
function colToHsl(c) {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function colFromHsl(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255), a: 1 };
}
// Terima #hex, rgb()/rgba(), hsl()/hsla(), atau "r,g,b".
function colParse(text) {
  const s = String(text || '').trim().toLowerCase();
  const hx = colFromHex(s);
  if (hx) return hx;
  const nums = (s.match(/-?[\d.]+%?/g) || []).map(x => ({ v: parseFloat(x), p: x.endsWith('%') }));
  if (nums.length < 3 || nums.slice(0, 3).some(x => isNaN(x.v))) return null;
  const alpha = nums[3] ? (nums[3].p ? nums[3].v / 100 : nums[3].v) : 1;
  if (s.startsWith('hsl')) return { ...colFromHsl(nums[0].v, nums[1].v, nums[2].v), a: colClamp(alpha, 0, 1) };
  const ch = x => colClamp(Math.round(x.p ? x.v * 2.55 : x.v), 0, 255);
  return { r: ch(nums[0]), g: ch(nums[1]), b: ch(nums[2]), a: colClamp(alpha, 0, 1) };
}
function colLum(c) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function colContrast(a, b) { const x = colLum(a), y = colLum(b); return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 100) / 100; }
function colMix(c, w, t) { return { r: c.r + (w.r - c.r) * t, g: c.g + (w.g - c.g) * t, b: c.b + (w.b - c.b) * t, a: 1 }; }
function colNearestTw(c) {
  let best = null, bd = Infinity;
  COL_TW.forEach(row => row.shades.forEach(s => {
    const o = colFromHex(s.hex), d = (o.r - c.r) ** 2 * 0.3 + (o.g - c.g) ** 2 * 0.59 + (o.b - c.b) ** 2 * 0.11;
    if (d < bd) { bd = d; best = row.name + '-' + s.k + ' (' + s.hex + ')'; }
  }));
  return best;
}
function colEntry(c, src, extra) {
  const hsl = colToHsl(c), a = c.a == null ? 1 : c.a;
  return Object.assign({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), hex: colToHex(c), hex8: colToHex({ ...c, a }, true),
    rgba: 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + a + ')', hsl: 'hsl(' + hsl.h + ' ' + hsl.s + '% ' + hsl.l + '%' + (a < 1 ? ' / ' + a : '') + ')',
    src, t: Date.now() }, extra || {});
}
// Warna dominan: gambar diperkecil, dikelompokkan per 16 level/kanal, lalu kelompok yang mirip digabung.
function colDominant(canvas, max) {
  const sc = Math.min(1, 120 / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * sc)), h = Math.max(1, Math.round(canvas.height * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(canvas, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, bins = new Map();
  let total = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const k = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4);
    const b = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; bins.set(k, b); total++;
  }
  const list = [...bins.values()].sort((a, b) => b.n - a.n).map(b => ({ r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n), n: b.n }));
  const out = [];
  for (const x of list) {
    const near = out.find(o => (o.r - x.r) ** 2 + (o.g - x.g) ** 2 + (o.b - x.b) ** 2 < 1600);
    if (near) { near.n += x.n; continue; }
    out.push({ ...x });
    if (out.length >= (max || 8) * 3) break;
  }
  return out.sort((a, b) => b.n - a.n).slice(0, max || 8).map(o => ({ hex: colToHex(o), pct: Math.round(o.n / total * 1000) / 10 }));
}
// Contoh gambar dibuat di canvas (tanpa file/URL luar).
function colSampleCanvas(kind) {
  const c = document.createElement('canvas'); c.width = 900; c.height = 520;
  const g = c.getContext('2d');
  if (kind === 'spectrum') {
    for (let x = 0; x < 900; x++) {
      const grd = g.createLinearGradient(0, 0, 0, 520);
      grd.addColorStop(0, '#fff'); grd.addColorStop(0.5, 'hsl(' + (x / 900 * 360) + ' 100% 50%)'); grd.addColorStop(1, '#000');
      g.fillStyle = grd; g.fillRect(x, 0, 1, 520);
    }
  } else if (kind === 'sunset') {
    const grd = g.createLinearGradient(0, 0, 0, 520);
    ['#1e1b4b', '#7c3aed', '#db2777', '#f97316', '#fde68a'].forEach((h, i) => grd.addColorStop(i / 4, h));
    g.fillStyle = grd; g.fillRect(0, 0, 900, 520);
    g.fillStyle = '#fef3c7'; g.beginPath(); g.arc(450, 400, 80, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0f172a'; g.fillRect(0, 430, 900, 90);
  } else {
    g.fillStyle = '#f1f5f9'; g.fillRect(0, 0, 900, 520);
    g.fillStyle = '#1e3a8a'; g.fillRect(0, 0, 900, 64);
    g.fillStyle = '#ffffff'; g.font = 'bold 22px Arial'; g.fillText('Dashboard Proyek', 24, 40);
    g.fillStyle = '#f97316'; g.fillRect(720, 14, 150, 36);
    g.fillStyle = '#ffffff'; g.font = '16px Arial'; g.fillText('+ Proyek baru', 742, 38);
    g.fillStyle = '#ffffff'; g.fillRect(24, 90, 400, 200); g.fillRect(450, 90, 420, 200);
    g.strokeStyle = '#cbd5e1'; g.strokeRect(24, 90, 400, 200); g.strokeRect(450, 90, 420, 200);
    g.fillStyle = '#0f172a'; g.font = 'bold 18px Arial'; g.fillText('Realisasi anggaran', 44, 125);
    g.fillStyle = '#64748b'; g.font = '14px Arial'; g.fillText('Update 2 Nov 2026', 44, 150);
    [['#22c55e', 120], ['#3b82f6', 90], ['#eab308', 60], ['#ef4444', 30]].forEach((b, i) => { g.fillStyle = b[0]; g.fillRect(470 + i * 95, 270 - b[1] * 1.4, 60, b[1] * 1.4); });
    g.fillStyle = '#dcfce7'; g.fillRect(44, 180, 160, 34); g.fillStyle = '#15803d'; g.font = '15px Arial'; g.fillText('✓ Disetujui', 60, 203);
    g.fillStyle = '#fee2e2'; g.fillRect(220, 180, 160, 34); g.fillStyle = '#b91c1c'; g.fillText('✕ Ditolak', 240, 203);
    g.fillStyle = '#0f172a'; g.fillRect(24, 320, 846, 170);
    g.fillStyle = '#e2e8f0'; g.font = '15px Consolas, monospace'; g.fillText('$ npm run build  # tema gelap', 44, 360);
    g.fillStyle = '#a78bfa'; g.fillText('const primary = "#1e3a8a";', 44, 392);
  }
  return c;
}

// ============================================================
//  Swag: Swagger 2.0 / OpenAPI 3.x -> Postman Collection v2.1, curl (bash), PowerShell.
//  Fungsi di blok ini murni (tanpa Vue/DOM) dan ditulis ES5 karena juga disisipkan ke
//  bookmarklet Swag lewat .toString() (jalan di halaman Swagger milik user).
// ============================================================
function swagYaml(src) {
  // Parser YAML subset untuk spec OpenAPI: map/list blok, skalar, block scalar | >, flow [] {}.
  var lines = [];
  String(src).replace(/\r\n?/g, '\n').split('\n').forEach(function (raw) {
    if (/^\s*#/.test(raw) || /^\s*$/.test(raw) || /^(---|\.\.\.)\s*$/.test(raw)) { lines.push({ ind: -1, raw: raw }); return; }
    var ind = raw.length - raw.replace(/^ +/, '').length;
    lines.push({ ind: ind, raw: raw, text: swagYamlStrip(raw.slice(ind)) });
  });
  var pos = 0;
  function more(buf, closed) {
    while (!closed(buf) && pos < lines.length) {
      var r = lines[pos].raw.replace(/^\s+|\s+$/g, '');
      pos++;
      if (r === '') { buf += '\n'; continue; }
      if (buf.charAt(buf.length - 1) === '\\' && buf.charAt(0) === '"') buf = buf.slice(0, -1) + r;
      else buf += (buf.charAt(buf.length - 1) === '\n' ? '' : ' ') + r;
    }
    return buf;
  }
  function skip() { while (pos < lines.length && lines[pos].ind < 0) pos++; }
  function block(ind) {
    skip();
    if (pos >= lines.length) return null;
    var ln = lines[pos], c0 = ln.text.charAt(0);
    if (c0 === '[' || c0 === '{') { pos++; return swagFlow(more(ln.text, swagFlowClosed)); }
    if (ln.text === '-' || ln.text.indexOf('- ') === 0) return seq(ln.ind);
    return map(ln.ind);
  }
  function blockScalar(head, parentInd) {
    var fold = head.charAt(0) === '>', keep = head.indexOf('+') >= 0, strip = head.indexOf('-') >= 0, out = [], bi = -1;
    while (pos < lines.length) {
      var l = lines[pos], r = l.raw;
      if (/^\s*$/.test(r)) { out.push(''); pos++; continue; }
      var ii = r.length - r.replace(/^ +/, '').length;
      if (ii <= parentInd) break;
      if (bi < 0) bi = ii;
      out.push(r.slice(Math.min(bi, ii))); pos++;
    }
    while (!keep && out.length && out[out.length - 1] === '') out.pop();
    var s = fold ? out.join('\n').replace(/([^\n])\n(?!\n)/g, '$1 ') : out.join('\n');
    return strip ? s : s + '\n';
  }
  function value(rest, ind) {
    rest = rest.replace(/^&\S+\s*/, '');
    if (rest === '') {
      skip();
      if (pos < lines.length && (lines[pos].ind > ind || (lines[pos].ind === ind && (lines[pos].text === '-' || lines[pos].text.indexOf('- ') === 0)))) return block(lines[pos].ind);
      return null;
    }
    if (/^[|>][-+0-9]*$/.test(rest)) return blockScalar(rest, ind);
    var c = rest.charAt(0);
    if (c === '[' || c === '{') {
      return swagFlow(more(rest, swagFlowClosed));
    }
    if (c === '"' || c === "'") return swagScalar(more(rest, swagQuoteClosed));
    {
      // skalar polos yang berlanjut ke baris berikut (indentasi lebih dalam)
      while (pos < lines.length && lines[pos].ind > ind && !swagYamlKey(lines[pos].text)) { rest += ' ' + lines[pos].text; pos++; skip(); }
    }
    return swagScalar(rest);
  }
  function map(ind) {
    var o = {};
    while (true) {
      skip();
      if (pos >= lines.length || lines[pos].ind !== ind) break;
      var t = lines[pos].text, kv = swagYamlKey(t);
      if (!kv) break;
      pos++;
      o[kv.k] = value(kv.v, ind);
    }
    return o;
  }
  function seq(ind) {
    var a = [];
    while (true) {
      skip();
      if (pos >= lines.length || lines[pos].ind !== ind) break;
      var t = lines[pos].text;
      if (!(t === '-' || t.indexOf('- ') === 0)) break;
      var rest = t === '-' ? '' : t.slice(2).replace(/^ +/, ''), sub = ind + (t.length - rest.length);
      if (rest === '-' || rest.indexOf('- ') === 0) {
        lines[pos] = { ind: sub, raw: lines[pos].raw, text: rest };
        a.push(seq(sub));
      } else if (rest !== '' && swagYamlKey(rest) && rest.charAt(0) !== '{' && rest.charAt(0) !== '[') {
        lines[pos] = { ind: sub, raw: lines[pos].raw, text: rest };
        a.push(map(sub));
      } else { pos++; a.push(value(rest, ind)); }
    }
    return a;
  }
  return block(0);
}
function swagYamlStrip(t) {
  // buang komentar " #..." di luar tanda kutip
  var q = '', out = '';
  for (var i = 0; i < t.length; i++) {
    var c = t.charAt(i);
    if (q) { if (c === q) { if (q === "'" && t.charAt(i + 1) === "'") { out += c; i++; } else q = ''; } else if (c === '\\' && q === '"') { out += c; i++; c = t.charAt(i); } }
    else if (c === '"' || c === "'") { if (out === '' || /[\s:\[\{,-]$/.test(out)) q = c; }
    else if (c === '#' && (i === 0 || /\s/.test(t.charAt(i - 1)))) break;
    out += c;
  }
  return out.replace(/\s+$/, '');
}
function swagYamlKey(t) {
  var c = t.charAt(0), k, i;
  if (c === '"' || c === "'") {
    for (i = 1; i < t.length; i++) { if (t.charAt(i) === '\\' && c === '"') { i++; continue; } if (t.charAt(i) === c) { if (c === "'" && t.charAt(i + 1) === "'") { i++; continue; } break; } }
    if (t.charAt(i + 1) !== ':' || (t.length > i + 2 && t.charAt(i + 2) !== ' ')) return null;
    k = swagScalar(t.slice(0, i + 1));
    return { k: String(k), v: t.slice(i + 2).replace(/^ +/, '') };
  }
  if (c === '-' && (t.length === 1 || t.charAt(1) === ' ')) return null;
  if (c === '[' || c === '{') return null;
  i = t.indexOf(': ');
  if (i < 0 && t.charAt(t.length - 1) === ':') i = t.length - 1;
  if (i <= 0) return null;
  return { k: t.slice(0, i).replace(/\s+$/, ''), v: t.slice(i + 1).replace(/^ +/, '') };
}
function swagScalar(s) {
  s = String(s).replace(/^\s+|\s+$/g, '');
  if (s.charAt(0) === '"') { try { return JSON.parse(s.replace(/\n/g, '\\n').replace(/\\ /g, ' ').replace(/\\\//g, '/')); } catch (e) { return s.slice(1, -1); } }
  if (s.charAt(0) === "'") return s.slice(1, -1).replace(/''/g, "'");
  if (s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL') return null;
  if (/^(true|True|TRUE)$/.test(s)) return true;
  if (/^(false|False|FALSE)$/.test(s)) return false;
  if (/^[-+]?(\d+|\d*\.\d+)([eE][-+]?\d+)?$/.test(s) && !/^0\d/.test(s)) return Number(s);
  if (s.charAt(0) === '*') return null;
  return s;
}
function swagQuoteClosed(s) {
  var q = s.charAt(0);
  for (var i = 1; i < s.length; i++) {
    var c = s.charAt(i);
    if (q === '"' && c === '\\') { i++; continue; }
    if (c === q) { if (q === "'" && s.charAt(i + 1) === "'") { i++; continue; } return true; }
  }
  return false;
}
function swagFlowClosed(s) {
  var d = 0, q = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (q) { if (c === '\\' && q === '"') i++; else if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") q = c; else if (c === '[' || c === '{') d++; else if (c === ']' || c === '}') d--;
  }
  return d <= 0;
}
function swagFlow(s) {
  var i = 0;
  function ws() { while (i < s.length && /\s/.test(s.charAt(i))) i++; }
  function atom(stops) {
    ws();
    var c = s.charAt(i), st = i;
    if (c === '[' || c === '{') return node();
    if (c === '"' || c === "'") {
      i++;
      while (i < s.length) { if (s.charAt(i) === '\\' && c === '"') { i += 2; continue; } if (s.charAt(i) === c) { if (c === "'" && s.charAt(i + 1) === "'") { i += 2; continue; } break; } i++; }
      i++;
      return swagScalar(s.slice(st, i));
    }
    while (i < s.length && stops.indexOf(s.charAt(i)) < 0) i++;
    return swagScalar(s.slice(st, i));
  }
  function node() {
    ws();
    var c = s.charAt(i);
    if (c === '[') {
      i++; var a = [];
      while (true) { ws(); if (s.charAt(i) === ']') { i++; break; } if (i >= s.length) break; a.push(atom(',]')); ws(); if (s.charAt(i) === ',') i++; }
      return a;
    }
    if (c === '{') {
      i++; var o = {};
      while (true) {
        ws(); if (s.charAt(i) === '}') { i++; break; } if (i >= s.length) break;
        var k = atom(':,}'); ws();
        var v = null;
        if (s.charAt(i) === ':') { i++; v = atom(',}'); }
        o[String(k)] = v; ws(); if (s.charAt(i) === ',') i++;
      }
      return o;
    }
    return atom(',]}');
  }
  return node();
}
// Teks spec (JSON atau YAML) -> objek.
function swagParse(text) {
  var t = String(text || '').replace(/^\uFEFF/, '');
  if (/^\s*[\{\[]/.test(t)) { try { return JSON.parse(t); } catch (e) { /* coba YAML */ } }
  return swagYaml(t);
}
function swagRef(root, ref) {
  if (typeof ref !== 'string' || ref.charAt(0) !== '#') return undefined;
  var parts = ref.slice(1).split('/').slice(1), cur = root;
  for (var i = 0; i < parts.length; i++) {
    if (cur == null || typeof cur !== 'object') return undefined;
    var k = parts[i].replace(/~1/g, '/').replace(/~0/g, '~');
    try { k = decodeURIComponent(k); } catch (e) { /* biarkan */ }
    cur = cur[k];
  }
  return cur;
}
function swagDeref(root, o) {
  var n = 0;
  while (o && typeof o === 'object' && typeof o.$ref === 'string' && n++ < 30) { var r = swagRef(root, o.$ref); if (r === undefined) return {}; o = r; }
  return o || {};
}
// Contoh nilai dari schema (example/default/enum/format), dengan batas kedalaman & deteksi siklus $ref.
function swagExample(root, s, depth, stack) {
  depth = depth || 0; stack = stack || [];
  if (!s || typeof s !== 'object') return null;
  if (typeof s.$ref === 'string') {
    if (stack.indexOf(s.$ref) >= 0 || depth > 8) return {};
    return swagExample(root, swagRef(root, s.$ref), depth + 1, stack.concat([s.$ref]));
  }
  if (s.example !== undefined) return s.example;
  if (Array.isArray(s.examples) && s.examples.length) return s.examples[0];
  if (s['default'] !== undefined) return s['default'];
  if (s['const'] !== undefined) return s['const'];
  if (Array.isArray(s['enum']) && s['enum'].length) return s['enum'][0];
  var base = null;
  if (Array.isArray(s.allOf)) {
    base = {};
    s.allOf.forEach(function (x) {
      var v = swagExample(root, x, depth + 1, stack);
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.keys(v).forEach(function (k) { base[k] = v[k]; });
    });
  }
  var alt = s.oneOf || s.anyOf;
  if (!base && Array.isArray(alt) && alt.length) {
    var pick = alt.filter(function (x) { return !(x && x.type === 'null'); })[0] || alt[0];
    return swagExample(root, pick, depth + 1, stack);
  }
  var t = s.type;
  if (Array.isArray(t)) t = t.filter(function (x) { return x !== 'null'; })[0];
  if (!t) t = (s.properties || s.additionalProperties || base) ? 'object' : s.items ? 'array' : '';
  if (t === 'object') {
    var o = base || {};
    if (depth > 8) return o;
    var props = s.properties || {};
    Object.keys(props).forEach(function (k) { if (!(props[k] && props[k].readOnly)) o[k] = swagExample(root, props[k], depth + 1, stack); });
    if (!Object.keys(props).length && s.additionalProperties && typeof s.additionalProperties === 'object' && !base) o.key = swagExample(root, s.additionalProperties, depth + 1, stack);
    return o;
  }
  if (t === 'array') { if (depth > 8 || !s.items) return []; var it = swagExample(root, s.items, depth + 1, stack); return it === null ? [] : [it]; }
  if (t === 'string') {
    var F = { 'date-time': '2026-01-01T00:00:00Z', date: '2026-01-01', time: '00:00:00', uuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6', email: 'user@example.com', uri: 'https://example.com', url: 'https://example.com', hostname: 'example.com', ipv4: '127.0.0.1', ipv6: '::1', byte: 'U3dhZw==', binary: '', password: 'string' };
    return F[s.format] !== undefined ? F[s.format] : 'string';
  }
  if (t === 'integer' || t === 'number') return typeof s.minimum === 'number' ? s.minimum : 0;
  if (t === 'boolean') return true;
  if (t === 'file') return '';
  return null;
}
function swagStr(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(swagStr).join(',');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
function swagParamVal(root, p) {
  var v = p.example;
  if (v === undefined && p.examples && typeof p.examples === 'object') { var k = Object.keys(p.examples)[0]; if (k) v = swagDeref(root, p.examples[k]).value; }
  if (v === undefined) v = swagExample(root, p.schema || { type: p.type, format: p.format, items: p.items, 'enum': p['enum'], 'default': p['default'] }, 0, []);
  return swagStr(v);
}
function swagAuthOf(d) {
  var t = String((d && d.type) || '').toLowerCase();
  if (t === 'http') return String(d.scheme || '').toLowerCase() === 'basic' ? { type: 'basic' } : { type: 'bearer' };
  if (t === 'basic') return { type: 'basic' };
  if (t === 'apikey') {
    if (String(d.name || '').toLowerCase() === 'authorization' && d['in'] !== 'query') return { type: 'bearer' };
    return { type: 'apikey', 'in': d['in'] === 'query' ? 'query' : d['in'] === 'cookie' ? 'cookie' : 'header', name: String(d.name || 'X-API-Key') };
  }
  if (t === 'oauth2' || t === 'openidconnect') return { type: 'bearer' };
  return null;
}
function swagAbs(u, base) {
  u = String(u || '');
  try { if (/^https?:/i.test(base || '') || /^https?:/i.test(u)) u = new URL(u, base).href; } catch (e) { /* biarkan */ }
  return u.replace(/\/+$/, '');
}
// Spec -> model netral { title, version, kind, baseUrl, tags[], ops[] }.
function swagBuild(spec, opt) {
  opt = opt || {};
  if (!spec || typeof spec !== 'object') throw new Error("Spec kosong atau tidak terbaca.");
  if (spec.swaggerVersion || (spec.apis && !spec.paths)) throw new Error("Swagger 1.x belum didukung (upgrade ke Swagger 2.0 / OpenAPI 3).");
  var v2 = String(spec.swagger || '').charAt(0) === '2', v3 = String(spec.openapi || '').charAt(0) === '3';
  if (!v2 && !v3) throw new Error("Bukan spec Swagger 2.0 / OpenAPI 3.x.");
  var ref = opt.specUrl || opt.pageUrl || '', base;
  if (v3) {
    var sv = (spec.servers || [])[0] || { url: '/' }, su = String(sv.url || '/');
    Object.keys(sv.variables || {}).forEach(function (k) { su = su.split('{' + k + '}').join(String((sv.variables[k] || {})['default'] || '')); });
    base = swagAbs(su, ref);
  } else if (spec.host) {
    var sch = spec.schemes || [], pp = '';
    try { pp = new URL(ref).protocol.replace(':', ''); } catch (e) { pp = ''; }
    var scheme = sch.indexOf(pp) >= 0 ? pp : sch.indexOf('https') >= 0 ? 'https' : (sch[0] || pp || 'https');
    base = (scheme + '://' + spec.host + (spec.basePath || '')).replace(/\/+$/, '');
  } else base = swagAbs(spec.basePath || '/', ref);
  var defs = (v3 ? (spec.components || {}).securitySchemes : spec.securityDefinitions) || {};
  var METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
  var ops = [], tags = [], uses = {};
  (spec.tags || []).forEach(function (t) { if (t && t.name && tags.indexOf(t.name) < 0) tags.push(t.name); });
  var paths = spec.paths || {};
  Object.keys(paths).forEach(function (path) {
    var item = swagDeref(spec, paths[path]);
    METHODS.forEach(function (m) {
      var op = item[m];
      if (!op || typeof op !== 'object') return;
      var plist = {}, order = [];
      (item.parameters || []).concat(op.parameters || []).forEach(function (p0) {
        var p = swagDeref(spec, p0);
        if (!p || !p.name) return;
        var key = p['in'] + ':' + p.name;
        if (!plist[key]) order.push(key);
        plist[key] = p;
      });
      var prm = { path: [], query: [], header: [], cookie: [] }, form = [], bodySchema = null, body = null;
      order.forEach(function (key) {
        var p = plist[key], where = p['in'];
        if (v2 && where === 'body') { bodySchema = p.schema || {}; return; }
        if (v2 && where === 'formData') { form.push(p); return; }
        if (!prm[where]) return;
        prm[where].push({ name: p.name, value: swagParamVal(spec, p), required: !!p.required || where === 'path', desc: p.description || '' });
      });
      if (v2) {
        var cons = op.consumes || spec.consumes || [];
        if (bodySchema) {
          var ct2 = cons.filter(function (c) { return /json/i.test(c); })[0] || cons[0] || 'application/json';
          var ex2 = swagExample(spec, bodySchema, 0, []);
          body = { mode: 'raw', ct: ct2, raw: /json/i.test(ct2) || typeof ex2 !== 'string' ? JSON.stringify(ex2 === null ? {} : ex2, null, 2) : ex2 };
        } else if (form.length) {
          var multi = form.some(function (p) { return p.type === 'file'; }) || cons.some(function (c) { return /multipart/i.test(c); });
          body = { mode: multi ? 'formdata' : 'urlencoded', ct: multi ? 'multipart/form-data' : 'application/x-www-form-urlencoded', fields: form.map(function (p) { return { key: p.name, type: p.type === 'file' ? 'file' : 'text', value: p.type === 'file' ? '' : swagParamVal(spec, p), required: !!p.required }; }) };
        }
      } else if (op.requestBody) {
        var rb = swagDeref(spec, op.requestBody), content = rb.content || {}, cts = Object.keys(content);
        var ct = cts.filter(function (c) { return /json/i.test(c); })[0] || cts.filter(function (c) { return /x-www-form-urlencoded/i.test(c); })[0] || cts.filter(function (c) { return /multipart/i.test(c); })[0] || cts[0];
        if (ct) {
          var media = content[ct] || {}, ex = media.example;
          if (ex === undefined && media.examples && typeof media.examples === 'object') { var ek = Object.keys(media.examples)[0]; if (ek) ex = swagDeref(spec, media.examples[ek]).value; }
          if (ex === undefined) ex = swagExample(spec, media.schema, 0, []);
          if (/x-www-form-urlencoded|multipart/i.test(ct)) {
            var sc = swagDeref(spec, media.schema || {}), props = sc.properties || {};
            var isFile = function (k) {
              var ps = swagDeref(spec, props[k] || {});
              if (ps.type === 'array') ps = swagDeref(spec, ps.items || {});
              return ps.format === 'binary' || ps.format === 'base64';
            };
            var obj = ex && typeof ex === 'object' && !Array.isArray(ex) ? ex : {};
            var keys = Object.keys(obj);
            Object.keys(props).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
            var multi3 = /multipart/i.test(ct);
            body = { mode: multi3 ? 'formdata' : 'urlencoded', ct: ct, fields: keys.map(function (k) { var f = multi3 && isFile(k); return { key: k, type: f ? 'file' : 'text', value: f ? '' : swagStr(obj[k]), required: (sc.required || []).indexOf(k) >= 0 }; }) };
          } else if (/json/i.test(ct)) body = { mode: 'raw', ct: ct, raw: JSON.stringify(ex === null || ex === undefined ? {} : ex, null, 2) };
          else if (/^text\/|xml|javascript|yaml|csv/i.test(ct)) body = { mode: 'raw', ct: ct, raw: typeof ex === 'string' ? ex : swagStr(ex) };
          else body = { mode: 'file', ct: ct };
        }
      }
      var sec = op.security !== undefined ? op.security : spec.security, auth = null;
      if (Array.isArray(sec)) {
        var req = sec.filter(function (r) { return r && Object.keys(r).length; })[0];
        if (!req) auth = sec.length ? null : { type: 'none' };
        else auth = swagAuthOf(swagDeref(spec, defs[Object.keys(req)[0]]));
      }
      if (auth && auth.type !== 'none') uses[auth.type] = true;
      var tag = (op.tags && op.tags[0]) || 'default';
      if (tags.indexOf(tag) < 0) tags.push(tag);
      ops.push({ tag: tag, method: m.toUpperCase(), path: path, name: String(op.summary || op.operationId || (m.toUpperCase() + ' ' + path)).replace(/\s+/g, ' ').replace(/^\s|\s$/g, ''), desc: op.description || '', deprecated: !!op.deprecated, params: prm, body: body, auth: auth });
    });
  });
  tags = tags.filter(function (t) { return ops.some(function (o) { return o.tag === t; }); });
  var info = spec.info || {};
  return { title: String(info.title || 'API'), version: String(info.version || ''), kind: v2 ? 'Swagger 2.0' : 'OpenAPI ' + spec.openapi, baseUrl: base, relative: !/^https?:/i.test(base), tags: tags, ops: ops, uses: uses };
}
function swagPick(model, opt) {
  var tg = opt && opt.tags;
  return model.ops.filter(function (o) { return !tg || tg.indexOf(o.tag) >= 0; });
}
function swagFill(op, mode) {
  // mode 'postman' -> :id, selain itu nilai contoh (di-encode).
  return op.path.replace(/\{([^}]+)\}/g, function (m0, n) {
    if (mode === 'postman') return ':' + n;
    var p = op.params.path.filter(function (x) { return x.name === n; })[0];
    return encodeURIComponent(p && p.value !== '' ? p.value : n);
  });
}
function swagQs(op, extra) {
  var q = op.params.query.filter(function (x) { return x.required; }).map(function (x) { return encodeURIComponent(x.name) + '=' + encodeURIComponent(x.value); });
  if (extra) q.push(extra);
  return q.length ? '?' + q.join('&') : '';
}
function swagUuid() {
  var h = '0123456789abcdef', s = '';
  for (var i = 0; i < 36; i++) s += (i === 8 || i === 13 || i === 18 || i === 23) ? '-' : i === 14 ? '4' : h.charAt(i === 19 ? 8 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 16));
  return s;
}
function swagPostman(model, opt) {
  opt = opt || {};
  var cr = opt.creds || {}, groups = {}, order = [];
  swagPick(model, opt).forEach(function (op) {
    var hdr = op.params.header.map(function (h) { return { key: h.name, value: h.value, type: 'text', description: h.desc, disabled: !h.required }; });
    if (op.params.cookie.length) hdr.push({ key: 'Cookie', value: op.params.cookie.map(function (c) { return c.name + '=' + c.value; }).join('; '), type: 'text' });
    var path = swagFill(op, 'postman'), url = {
      raw: '{{baseUrl}}' + path + swagQs(op),
      host: ['{{baseUrl}}'],
      path: path.split('/').filter(function (x) { return x !== ''; }),
      query: op.params.query.map(function (q) { return { key: q.name, value: q.value, description: q.desc, disabled: !q.required }; }),
      variable: op.params.path.map(function (p) { return { key: p.name, value: p.value, description: p.desc }; })
    };
    var rq = { method: op.method, header: hdr, url: url };
    var b = op.body;
    if (b) {
      if (b.mode === 'raw') { hdr.push({ key: 'Content-Type', value: b.ct, type: 'text' }); rq.body = { mode: 'raw', raw: b.raw, options: { raw: { language: /json/i.test(b.ct) ? 'json' : /xml/i.test(b.ct) ? 'xml' : 'text' } } }; }
      else if (b.mode === 'urlencoded') rq.body = { mode: 'urlencoded', urlencoded: b.fields.map(function (f) { return { key: f.key, value: f.value, type: 'text' }; }) };
      else if (b.mode === 'formdata') rq.body = { mode: 'formdata', formdata: b.fields.map(function (f) { return f.type === 'file' ? { key: f.key, type: 'file', src: [] } : { key: f.key, value: f.value, type: 'text' }; }) };
      else { hdr.push({ key: 'Content-Type', value: b.ct, type: 'text' }); rq.body = { mode: 'file', file: { src: '' } }; }
    }
    var a = op.auth;
    if (a) {
      if (a.type === 'none') rq.auth = { type: 'noauth' };
      else if (a.type === 'bearer') rq.auth = { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] };
      else if (a.type === 'basic') rq.auth = { type: 'basic', basic: [{ key: 'username', value: '{{username}}', type: 'string' }, { key: 'password', value: '{{password}}', type: 'string' }] };
      else if (a.type === 'apikey') rq.auth = { type: 'apikey', apikey: [{ key: 'key', value: a.name, type: 'string' }, { key: 'value', value: '{{apiKey}}', type: 'string' }, { key: 'in', value: a['in'] === 'query' ? 'query' : 'header', type: 'string' }] };
    }
    var d = [op.deprecated ? '(deprecated)' : '', op.desc].filter(Boolean).join('\n');
    if (d) rq.description = d;
    if (!groups[op.tag]) { groups[op.tag] = []; order.push(op.tag); }
    groups[op.tag].push({ name: op.name, request: rq, response: [] });
  });
  var vars = [{ key: 'baseUrl', value: opt.baseUrl || model.baseUrl, type: 'string' }];
  if (model.uses.bearer) vars.push({ key: 'token', value: cr.token || '', type: 'string' });
  if (model.uses.apikey) vars.push({ key: 'apiKey', value: cr.apiKey || '', type: 'string' });
  if (model.uses.basic) { vars.push({ key: 'username', value: cr.username || '', type: 'string' }); vars.push({ key: 'password', value: cr.password || '', type: 'string' }); }
  var items = model.tags.filter(function (t) { return groups[t]; }).map(function (t) { return { name: t, item: groups[t] }; });
  return JSON.stringify({
    info: { _postman_id: swagUuid(), name: model.title + (model.version ? ' ' + model.version : ''), description: model.kind + ' - Swag', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: items.length === 1 && items[0].name === 'default' ? items[0].item : items,
    variable: vars
  }, null, 2);
}
function swagSq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
function swagHn(s) { return String(s).replace(/[^A-Za-z0-9!#$%&*+.^_`|~-]/g, ''); }
function swagCurl(model, opt) {
  opt = opt || {};
  var T = opt.L || function (x) { return x; };
  var cr = opt.creds || {}, out = ['#!/usr/bin/env bash', '# ' + model.title + (model.version ? ' ' + model.version : '') + ' (' + model.kind + ') - Swag', 'BASE_URL=' + swagSq(opt.baseUrl || model.baseUrl)];
  if (model.uses.bearer) out.push('TOKEN=' + swagSq(cr.token || ''));
  if (model.uses.apikey) out.push('API_KEY=' + swagSq(cr.apiKey || ''));
  if (model.uses.basic) { out.push('API_USER=' + swagSq(cr.username || '')); out.push('API_PASS=' + swagSq(cr.password || '')); }
  var last = null;
  swagPick(model, opt).forEach(function (op) {
    if (op.tag !== last) { out.push('', '# ===== ' + op.tag + ' ====='); last = op.tag; }
    out.push('', '# ' + op.method + ' ' + op.path + ' - ' + op.name + (op.deprecated ? ' (deprecated)' : ''));
    var opq = op.params.query.filter(function (x) { return !x.required; }).map(function (x) { return x.name; });
    if (opq.length) out.push('# ' + T("opsional") + ': ' + opq.join(', '));
    var a = op.auth || {}, keyQ = a.type === 'apikey' && a['in'] === 'query';
    var urlExpr = '"$BASE_URL"' + swagSq(swagFill(op) + swagQs(op, keyQ ? encodeURIComponent(a.name) + '=' : ''));
    if (keyQ) urlExpr += '"$API_KEY"';
    var parts = ['curl -sS -X ' + op.method + ' ' + urlExpr];
    op.params.header.forEach(function (h) { parts.push((h.required ? '' : '# ') + '-H ' + swagSq(h.name + ': ' + h.value)); });
    if (op.params.cookie.length) parts.push('-b ' + swagSq(op.params.cookie.map(function (c) { return c.name + '=' + c.value; }).join('; ')));
    if (a.type === 'bearer') parts.push('-H "Authorization: Bearer $TOKEN"');
    else if (a.type === 'basic') parts.push('-u "$API_USER:$API_PASS"');
    else if (a.type === 'apikey' && a['in'] === 'header') parts.push('-H "' + swagHn(a.name) + ': $API_KEY"');
    else if (a.type === 'apikey' && a['in'] === 'cookie') parts.push('-b "' + swagHn(a.name) + '=$API_KEY"');
    var b = op.body;
    if (b && b.mode === 'raw') { parts.push('-H ' + swagSq('Content-Type: ' + b.ct)); parts.push('--data-raw ' + swagSq(b.raw)); }
    else if (b && b.mode === 'urlencoded') b.fields.forEach(function (f) { parts.push('--data-urlencode ' + swagSq(f.key + '=' + f.value)); });
    else if (b && b.mode === 'formdata') b.fields.forEach(function (f) { parts.push('-F ' + swagSq(f.key + '=' + (f.type === 'file' ? '@/path/to/file' : f.value))); });
    else if (b && b.mode === 'file') { parts.push('-H ' + swagSq('Content-Type: ' + b.ct)); parts.push("--data-binary '@/path/to/file'"); }
    // baris "# -H ..." (header opsional) tidak boleh berada di tengah rantai backslash: pindahkan ke atas
    var cm = parts.filter(function (p) { return p.indexOf('# ') === 0; }), act = parts.filter(function (p) { return p.indexOf('# ') !== 0; });
    cm.forEach(function (c) { out.push('#   ' + T("opsional") + ': ' + c.slice(2)); });
    out.push(act.join(' \\\n  '));
  });
  return out.join('\n') + '\n';
}
function swagPq(s) { return "'" + String(s).replace(/['\u2018\u2019\u201A\u201B]/g, function (c) { return c + c; }) + "'"; }
function swagPwsh(model, opt) {
  opt = opt || {};
  var T = opt.L || function (x) { return x; };
  var cr = opt.creds || {}, out = ['# ' + model.title + (model.version ? ' ' + model.version : '') + ' (' + model.kind + ') - Swag', '$BaseUrl = ' + swagPq(opt.baseUrl || model.baseUrl)];
  if (model.uses.bearer) out.push('$Token = ' + swagPq(cr.token || ''));
  if (model.uses.apikey) out.push('$ApiKey = ' + swagPq(cr.apiKey || ''));
  if (model.uses.basic) { out.push('$ApiUser = ' + swagPq(cr.username || '')); out.push('$ApiPass = ' + swagPq(cr.password || '')); }
  var last = null;
  swagPick(model, opt).forEach(function (op) {
    if (op.tag !== last) { out.push('', '# ===== ' + op.tag + ' ====='); last = op.tag; }
    out.push('', '# ' + op.method + ' ' + op.path + ' - ' + op.name + (op.deprecated ? ' (deprecated)' : ''));
    var a = op.auth || {}, keyQ = a.type === 'apikey' && a['in'] === 'query';
    var uri = '($BaseUrl + ' + swagPq(swagFill(op) + swagQs(op, keyQ ? encodeURIComponent(a.name) + '=' : '')) + (keyQ ? ' + $ApiKey' : '') + ')';
    var m = op.method.charAt(0) + op.method.slice(1).toLowerCase();
    var parts = ['Invoke-RestMethod -Method ' + m + ' -Uri ' + uri], hs = [];
    op.params.header.filter(function (h) { return h.required; }).forEach(function (h) { hs.push(swagPq(h.name) + ' = ' + swagPq(h.value)); });
    if (op.params.cookie.length) hs.push("'Cookie' = " + swagPq(op.params.cookie.map(function (c) { return c.name + '=' + c.value; }).join('; ')));
    if (a.type === 'bearer') hs.push("'Authorization' = \"Bearer $Token\"");
    else if (a.type === 'basic') hs.push("'Authorization' = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($ApiUser + ':' + $ApiPass))");
    else if (a.type === 'apikey' && a['in'] === 'header') hs.push(swagPq(a.name) + ' = $ApiKey');
    else if (a.type === 'apikey' && a['in'] === 'cookie') hs.push("'Cookie' = " + swagPq(a.name + '=') + ' + $ApiKey');
    if (hs.length) parts.push('-Headers @{ ' + hs.join('; ') + ' }');
    var b = op.body;
    if (b && b.mode === 'raw') { parts.push('-ContentType ' + swagPq(b.ct)); parts.push('-Body ' + swagPq(b.raw)); }
    else if (b && b.mode === 'urlencoded') { parts.push("-ContentType 'application/x-www-form-urlencoded'"); parts.push('-Body @{ ' + b.fields.map(function (f) { return swagPq(f.key) + ' = ' + swagPq(f.value); }).join('; ') + ' }'); }
    else if (b && b.mode === 'formdata') { out.push('# ' + T("-Form butuh PowerShell 7+")); parts.push('-Form @{ ' + b.fields.map(function (f) { return swagPq(f.key) + ' = ' + (f.type === 'file' ? "Get-Item 'C:\\path\\to\\file'" : swagPq(f.value)); }).join('; ') + ' }'); }
    else if (b && b.mode === 'file') { parts.push('-ContentType ' + swagPq(b.ct)); parts.push("-InFile 'C:\\path\\to\\file'"); }
    out.push(parts.join(' `\n  '));
  });
  return out.join('\r\n').replace(/\r?\n/g, '\r\n') + '\r\n';
}
function swagSlug(s) { return String(s || 'api').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'api'; }
// ---- Dijalankan DI TAB TARGET (halaman Swagger UI / ReDoc / file spec) lewat bookmarklet Swag.
// Sumber spec dicoba berurutan: Swagger UI 3/4/5 (window.ui), Swagger UI 2.x (window.swaggerUi),
// ReDoc, halaman yang isinya spec mentah, link di halaman, lalu path umum
// (Swashbuckle Core/Framework, NSwag, Springfox, springdoc, FastAPI). fetch same-origin: cookie ikut.
function swagPageMain(cfg) {
  if (window.__swag && window.__swag.close) window.__swag.close();
  function el(tag, css, text) { var e = document.createElement(tag); if (css) Object.assign(e.style, css); if (text != null) e.textContent = text; return e; }
  function btn(label, fn, blue) { var b = el('button', { background: blue ? 'linear-gradient(135deg, #c87840 0%, #985225 100%)' : '#2c211b', color: '#f3ece4', border: blue ? '1px solid #c87840' : '1px solid #453429', borderRadius: '5px', padding: '4px 9px', cursor: 'pointer', fontSize: '12px' }, label); b.onclick = fn; return b; }
  var IN = { background: '#110d0b', color: '#f3ece4', border: '1px solid #3e2f25', borderRadius: '5px', padding: '4px 6px', font: '12px Consolas,monospace', boxSizing: 'border-box' };
  var panel = el('div', { position: 'fixed', right: '12px', bottom: '12px', width: '430px', maxWidth: '92vw', maxHeight: '86vh', overflow: 'auto', background: 'linear-gradient(160deg, #211914 0%, #14100d 100%)', color: '#f3ece4', font: '12px/1.45 system-ui,Segoe UI,sans-serif', border: '1px solid #453429', borderRadius: '10px', boxShadow: '0 12px 30px rgba(0,0,0,.55)', zIndex: 2147483647, padding: '10px 12px', textAlign: 'left' });
  var head = el('div', { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' });
  var title = el('b', { flex: '1', fontSize: '14px' }, 'Swag');
  head.appendChild(title);
  head.appendChild(btn("Tutup", function () { close(); }));
  panel.appendChild(head);
  var status = el('div', { color: '#aa9888', margin: '4px 0 8px', wordBreak: 'break-word' }, "Mencari spec Swagger/OpenAPI di halaman ini...");
  panel.appendChild(status);
  var defRow = el('div', { display: 'none', margin: '4px 0' });
  defRow.appendChild(el('div', { color: '#aa9888' }, "Definisi"));
  var defSel = el('select', Object.assign({ width: '100%' }, IN));
  defRow.appendChild(defSel);
  panel.appendChild(defRow);
  var box = el('div', { display: 'none' });
  box.appendChild(el('div', { color: '#aa9888', marginTop: '4px' }, "Base URL"));
  var baseIn = el('input', Object.assign({ width: '100%' }, IN)); baseIn.type = 'text';
  box.appendChild(baseIn);
  var tokLab = el('label', { display: 'flex', gap: '6px', alignItems: 'center', margin: '8px 0 2px', cursor: 'pointer' });
  var tokChk = el('input'); tokChk.type = 'checkbox';
  tokLab.appendChild(tokChk); tokLab.appendChild(el('span', null, "Ikut token dari tombol Authorize (default: kosong, aman dibagikan)"));
  box.appendChild(tokLab);
  var tagHead = el('div', { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' });
  tagHead.appendChild(el('span', { color: '#aa9888', flex: '1' }, "Tag / controller"));
  var allLnk = btn("Semua", function () { tagBoxes.forEach(function (c) { c.checked = true; }); }); var noneLnk = btn("Kosongkan", function () { tagBoxes.forEach(function (c) { c.checked = false; }); });
  tagHead.appendChild(allLnk); tagHead.appendChild(noneLnk);
  box.appendChild(tagHead);
  var tagWrap = el('div', { maxHeight: '150px', overflow: 'auto', border: '1px solid #3e2f25', borderRadius: '5px', padding: '4px 6px', marginTop: '4px' });
  box.appendChild(tagWrap);
  var acts = el('div', { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' });
  box.appendChild(acts);
  panel.appendChild(box);
  var manRow = el('div', { display: 'none', marginTop: '8px', gap: '6px' });
  var manIn = el('input', Object.assign({ flex: '1' }, IN)); manIn.type = 'text'; manIn.placeholder = '/swagger/v1/swagger.json';
  manRow.appendChild(manIn);
  manRow.appendChild(btn("Muat", function () { var u = manIn.value.replace(/^\s+|\s+$/g, ''); if (u) loadDef({ name: u, url: abs(u) }); }, true));
  panel.appendChild(manRow);
  document.body.appendChild(panel);
  try { if (window.__hookGuard) window.__hookGuard.add(panel); } catch (e) { /* abaikan */ }
  var defs = [], model = null, cur = null, tagBoxes = [];
  function close() { panel.remove(); window.__swag = null; }
  window.__swag = { close: close };
  function say(t, bad) { status.textContent = t; status.style.color = bad ? '#f87171' : '#94a3b8'; }
  function abs(u) { try { return new URL(u, location.href).href; } catch (e) { return u; } }
  function plain(x) { try { return x && typeof x.toJS === 'function' ? x.toJS() : x; } catch (e) { return x; } }
  function isSpec(o) { return !!(o && typeof o === 'object' && (o.swagger || o.openapi || o.swaggerVersion)); }
  function fetchSpec(u) {
    return fetch(u, { credentials: 'include', headers: { Accept: 'application/json, application/yaml;q=0.9, */*;q=0.8' } }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (t) {
      var o = swagParse(t);
      if (!isSpec(o)) throw new Error("Bukan spec Swagger 2.0 / OpenAPI 3.x.");
      return o;
    });
  }
  function addDef(d) { if (!defs.some(function (x) { return x.url && x.url === d.url; })) defs.push(d); return d; }
  function discover() {
    // 1) Swagger UI 3/4/5 (Swashbuckle Core, NSwag, springdoc, FastAPI ...)
    try {
      var ui = window.ui;
      if (ui && ui.specSelectors) {
        var c = (ui.getConfigs && ui.getConfigs()) || {}, urls = plain(c.urls) || [];
        var curUrl = (ui.specSelectors.url && ui.specSelectors.url()) || c.url || '';
        urls.forEach(function (u) { if (u && u.url) addDef({ name: u.name || u.url, url: abs(u.url) }); });
        var js = plain(ui.specSelectors.specJson && ui.specSelectors.specJson());
        if (isSpec(js)) {
          var hit = defs.filter(function (d) { return d.url === abs(curUrl); })[0];
          if (hit) hit.spec = js; else defs.unshift({ name: (js.info && js.info.title) || 'spec', url: curUrl ? abs(curUrl) : location.href, spec: js });
        } else if (curUrl) addDef({ name: curUrl, url: abs(curUrl) });
        if (defs.length) { var sel = defs.filter(function (d) { return d.url === abs(curUrl); })[0]; return Promise.resolve(sel || defs[0]); }
      }
    } catch (e) { /* lanjut cara lain */ }
    // 2) Swagger UI 2.x (Swashbuckle 5 .NET Framework, Springfox lama)
    try {
      var su = window.swaggerUi, api = su && su.api;
      if (su) {
        var sp = api && (api.swaggerObject || api.spec), u2 = (api && api.url) || (su.options && su.options.url) || '';
        if (isSpec(sp) && !sp.swaggerVersion) return Promise.resolve(addDef({ name: (sp.info && sp.info.title) || 'spec', url: u2 ? abs(u2) : location.href, spec: sp }));
        if (u2) return Promise.resolve(addDef({ name: u2, url: abs(u2) }));
      }
    } catch (e) { /* lanjut */ }
    // 3) ReDoc
    try {
      var rd = window.__redoc_state && window.__redoc_state.spec;
      if (rd && isSpec(rd.data)) return Promise.resolve(addDef({ name: (rd.data.info && rd.data.info.title) || 'spec', url: rd.url ? abs(rd.url) : location.href, spec: rd.data }));
    } catch (e) { /* lanjut */ }
    // 4) Halaman ini sendiri adalah file spec (JSON/YAML mentah)
    try {
      var txt = document.body ? document.body.innerText : '';
      if (/json|yaml|text\/plain/i.test(document.contentType || '') && txt && txt.length < 30000000) {
        var o = swagParse(txt);
        if (isSpec(o)) return Promise.resolve(addDef({ name: (o.info && o.info.title) || 'spec', url: location.href, spec: o }));
      }
    } catch (e) { /* lanjut */ }
    // 5) Link/input di halaman + path umum
    var cand = [];
    function push(u) { if (u && cand.indexOf(u) < 0) cand.push(u); }
    try {
      // ReDoc/Elements/RapiDoc: <redoc spec-url>, <elements-api apiDescriptionUrl>, <rapi-doc spec-url>
      Array.prototype.forEach.call(document.querySelectorAll('[spec-url], [apiDescriptionUrl], [apidescriptionurl]'), function (x) { push(x.getAttribute('spec-url') || x.getAttribute('apiDescriptionUrl') || x.getAttribute('apidescriptionurl')); });
      // File JSON/YAML yang sudah dimuat halaman (mis. spec yang di-fetch oleh ReDoc/Swagger UI)
      var res = (performance.getEntriesByType && performance.getEntriesByType('resource')) || [];
      res.map(function (r) { return r.name; }).filter(function (n) { return /\.(json|ya?ml)(\?|#|$)|api-docs|openapi|swagger/i.test(n) && !/\.(js|css|png|svg|woff2?)(\?|$)/i.test(n); })
        .sort(function (a, b) { return (/swagger|openapi|api-docs|spec/i.test(b) ? 1 : 0) - (/swagger|openapi|api-docs|spec/i.test(a) ? 1 : 0); })
        .slice(0, 15).forEach(push);
      Array.prototype.forEach.call(document.querySelectorAll('.download-url-input, #input_baseUrl, select#select option, .topbar select option'), function (x) { push(x.value); });
      Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function (a) { var h = a.getAttribute('href') || ''; if (/(swagger|openapi|api-docs)[^?#]*(\.json|\.ya?ml)?$/i.test(h) && !/\.html?$/i.test(h)) push(h); });
    } catch (e) { /* abaikan */ }
    var dir = location.pathname.replace(/[^/]*$/, '');
    ['swagger/v1/swagger.json', 'swagger.json', 'openapi.json', 'v3/api-docs', 'v2/api-docs', 'swagger/docs/v1', 'api-docs', 'swagger/v1/openapi.json', 'openapi.yaml', 'swagger.yaml'].forEach(function (p) { push(dir + p); push('/' + p); });
    var i = 0;
    function next() {
      if (i >= cand.length) return Promise.reject(new Error("Spec tidak ditemukan otomatis. Isi URL spec di bawah lalu klik Muat."));
      var u = abs(cand[i++]);
      say("Mencoba " + u);
      return fetchSpec(u).then(function (o) { return addDef({ name: (o.info && o.info.title) || u, url: u, spec: o }); }, next);
    }
    return next();
  }
  function fillDefs() {
    defSel.textContent = '';
    defs.forEach(function (d, i) { var o = el('option', null, d.name); o.value = String(i); if (d === cur) o.selected = true; defSel.appendChild(o); });
    defRow.style.display = defs.length > 1 ? 'block' : 'none';
  }
  defSel.onchange = function () { var d = defs[Number(defSel.value)]; if (d) loadDef(d); };
  function loadDef(d) {
    cur = d; fillDefs();
    say("Memuat " + (d.url || d.name) + " ...");
    var p = d.spec ? Promise.resolve(d.spec) : fetchSpec(d.url).then(function (o) { d.spec = o; return o; });
    return p.then(function (spec) {
      model = swagBuild(spec, { pageUrl: location.href, specUrl: d.url });
      baseIn.value = model.baseUrl;
      tagWrap.textContent = ''; tagBoxes = [];
      model.tags.forEach(function (t) {
        var n = model.ops.filter(function (o) { return o.tag === t; }).length;
        var lb = el('label', { display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' });
        var c = el('input'); c.type = 'checkbox'; c.checked = true; c.value = t;
        lb.appendChild(c); lb.appendChild(el('span', null, t + ' (' + n + ')'));
        tagWrap.appendChild(lb); tagBoxes.push(c);
      });
      box.style.display = 'block'; manRow.style.display = 'none';
      title.textContent = 'Swag - ' + model.title + (model.version ? ' ' + model.version : '');
      say(model.kind + ' - ' + model.ops.length + " endpoint" + (model.relative ? ' - ' + "base URL relatif, cek isiannya" : ''));
    }).catch(function (e) { say(String(e && e.message || e), true); manRow.style.display = 'flex'; });
  }
  function creds() {
    var c = {};
    if (!tokChk.checked) return c;
    try {
      var a = plain(window.ui && window.ui.authSelectors && window.ui.authSelectors.authorized && window.ui.authSelectors.authorized()) || {};
      Object.keys(a).forEach(function (k) {
        var x = a[k] || {}, v = x.value, sc = plain(x.schema) || {};
        if (x.token && x.token.access_token) c.token = x.token.access_token;
        else if (v && typeof v === 'object') { if (v.username) c.username = v.username; if (v.password) c.password = v.password; }
        else if (typeof v === 'string' && v) {
          if (String(sc.type).toLowerCase() === 'apikey' && String(sc.name).toLowerCase() !== 'authorization') c.apiKey = v;
          else c.token = v.replace(/^Bearer\s+/i, '');
        }
      });
    } catch (e) { /* abaikan */ }
    try {
      var z = window.swaggerUi && window.swaggerUi.api && window.swaggerUi.api.clientAuthorizations && window.swaggerUi.api.clientAuthorizations.authz;
      Object.keys(z || {}).forEach(function (k) {
        var x = z[k] || {};
        if (x.username) { c.username = x.username; c.password = x.password; }
        else if (typeof x.value === 'string' && x.value) { if (String(x.name).toLowerCase() === 'authorization') c.token = x.value.replace(/^Bearer\s+/i, ''); else c.apiKey = x.value; }
      });
    } catch (e) { /* abaikan */ }
    return c;
  }
  function opts() {
    var tg = tagBoxes.filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
    return { baseUrl: baseIn.value.replace(/^\s+|\s+$/g, '') || model.baseUrl, tags: tg, creds: creds() };
  }
  function count(o) { return swagPick(model, o).length; }
  function dl(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function out(kind) {
    if (!model) return null;
    var o = opts();
    if (!count(o)) { say("Pilih minimal satu tag.", true); return null; }
    var base = swagSlug(model.title + (model.version ? '-' + model.version : ''));
    if (kind === 'pm') return { name: base + '.postman_collection.json', text: swagPostman(model, o), type: 'application/json', n: count(o) };
    if (kind === 'sh') return { name: base + '.curl.sh', text: swagCurl(model, o), type: 'text/x-shellscript', n: count(o) };
    return { name: base + '.ps1', text: swagPwsh(model, o), type: 'text/plain', n: count(o) };
  }
  function doDl(kind) { var r = out(kind); if (r) { dl(r.name, r.text, r.type); say(r.name + ' - ' + r.n + " endpoint"); } }
  function doCopy(kind) {
    var r = out(kind); if (!r) return;
    navigator.clipboard.writeText(r.text).then(function () { say("Tersalin ke clipboard." + ' (' + r.n + " endpoint" + ')'); }, function () { say("Clipboard ditolak browser. Pakai tombol unduh.", true); });
  }
  acts.appendChild(btn('Postman (.json)', function () { doDl('pm'); }, true));
  acts.appendChild(btn('curl (.sh)', function () { doDl('sh'); }, true));
  acts.appendChild(btn('PowerShell (.ps1)', function () { doDl('ps'); }, true));
  acts.appendChild(btn("Salin Postman", function () { doCopy('pm'); }));
  acts.appendChild(btn("Salin curl", function () { doCopy('sh'); }));
  discover().then(loadDef, function (e) { say(String(e && e.message || e), true); manRow.style.display = 'flex'; });
}
const SWAG_FNS = [swagYaml, swagYamlStrip, swagYamlKey, swagScalar, swagQuoteClosed, swagFlowClosed, swagFlow, swagParse, swagRef, swagDeref, swagExample, swagStr, swagParamVal, swagAuthOf, swagAbs, swagBuild, swagPick, swagFill, swagQs, swagUuid, swagPostman, swagSq, swagHn, swagCurl, swagPq, swagPwsh, swagSlug];
function swagScript() {
  return localizeScript('(function () {\n(' + hookGuardInstall.toString() + ')();\n' + SWAG_FNS.map(f => f.toString()).join('\n') + '\n(' + swagPageMain.toString() + ')({});\n})();');
}
// ============================================================
//  Multi Ping: cek banyak URL/server berkala dari browser (HTTP, bukan ICMP).
//  Config + riwayat singkat di localStorage. Request langsung ke URL milik user.
// ============================================================
const PING_KEY = 'scaPing', PING_HIST_KEY = 'scaPingHist', PING_MAX = 720, PING_KEEP = 200;
function pingId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function pingIsPrivate(host) { return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|169\.254\.)/.test(host) || /^localhost$/i.test(host) || /\.(local|lan|internal|intra)$/i.test(host); }
// "10.0.0.10:8080" -> "http://10.0.0.10:8080/", "api.github.com" -> "https://api.github.com/"
function pingNormUrl(s) {
  s = String(s || '').trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    const host = s.split(/[/:?#]/)[0];
    s = (pingIsPrivate(host) ? 'http://' : 'https://') + s;
  }
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; }
}
function pingLooksUrl(x) { return /^[a-z]+:\/\//i.test(x) || /^(localhost|\d{1,3}(\.\d{1,3}){3}|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#].*)?$/i.test(x); }
// Satu baris = "url" | "nama | url | grup | interval" (pemisah | ; atau tab, urutan bebas) | "nama dengan spasi url".
function pingParseBulk(text, defGroup, defInterval) {
  const out = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (!line || line.charAt(0) === '#') return;
    let parts = line.split(/\s*[|;\t]\s*/).filter(Boolean);
    if (parts.length === 1) parts = line.split(/\s+/);
    const urlTok = parts.find(pingLooksUrl);
    if (!urlTok) return;
    const url = pingNormUrl(urlTok);
    if (!url) return;
    // posisi: token sebelum URL = nama, sesudah URL = grup (teks) / interval (angka)
    const at = parts.indexOf(urlTok), after = parts.slice(at + 1);
    const num = after.find(x => /^\d+$/.test(x));
    let name = parts.slice(0, at).join(' ');
    const group = after.filter(x => !/^\d+$/.test(x)).join(' ') || defGroup;
    if (!name) { try { name = new URL(url).host; } catch (e) { name = url; } }
    out.push({ name, url, group: group || '', interval: num ? Number(num) : defInterval });
  });
  return out;
}
function pingStats(h) {
  h = h || [];
  const n = h.length, ok = h.filter(x => x.ok && x.ms != null).map(x => x.ms), up = h.filter(x => x.ok).length;
  if (!n) return { n: 0, up: 0, uptime: null, loss: null, min: null, max: null, avg: null, p95: null, jitter: null };
  const s = ok.slice().sort((a, b) => a - b);
  let jit = null;
  const seq = h.filter(x => x.ok && x.ms != null);
  if (seq.length > 1) { let d = 0; for (let i = 1; i < seq.length; i++) d += Math.abs(seq[i].ms - seq[i - 1].ms); jit = Math.round(d / (seq.length - 1)); }
  const r1 = v => Math.round(v * 10) / 10;
  return {
    n, up, uptime: r1(up / n * 100), loss: r1((n - up) / n * 100),
    min: s.length ? s[0] : null, max: s.length ? s[s.length - 1] : null,
    avg: s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null,
    p95: s.length ? s[Math.max(0, Math.ceil(s.length * 0.95) - 1)] : null, jitter: jit
  };
}
// Satu kali cek. CORS diizinkan -> status HTTP terbaca; tidak -> fallback no-cors (opaque):
// ada jawaban dari server = UP walau kodenya tidak terlihat. Error jaringan / timeout = DOWN.
// mixedOk: hasil cek apakah halaman https ini boleh memanggil http (setelan Chrome "Insecure content").
async function pingProbe(t, mixedOk) {
  if (location.protocol === 'https:' && /^http:/i.test(t.url) && !mixedOk) return { ok: false, blocked: true, ms: null, code: null, kind: 'blocked', note: 'mixed' };
  const once = async (mode) => {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), Math.max(1000, Number(t.timeout) || 5000)), t0 = performance.now();
    try {
      const r = await fetch(t.url, { method: mode === 'cors' ? (t.method || 'GET') : (t.method === 'HEAD' ? 'HEAD' : 'GET'), mode, cache: 'no-store', credentials: 'omit', redirect: 'follow', referrerPolicy: 'no-referrer', signal: ctl.signal });
      const ms = Math.round(performance.now() - t0);
      try { if (r.body) r.body.cancel(); } catch (e) { /* abaikan */ }
      return { r, ms };
    } catch (e) { e.isTimeout = ctl.signal.aborted; throw e; }
    finally { clearTimeout(tm); }
  };
  if (t.cors !== false) {
    try {
      const { r, ms } = await once('cors');
      const c = r.status, ok = t.expect === 'lt500' ? c < 500 : t.expect === '2xx' ? (c >= 200 && c < 400) : true;
      return { ok, ms, code: c, kind: 'cors', cors: true, note: ok ? '' : 'code' };
    } catch (e) { if (e.isTimeout) return { ok: false, ms: null, code: null, kind: 'timeout', note: 'timeout' }; }
  }
  try {
    const { ms } = await once('no-cors');
    return { ok: true, ms, code: null, kind: 'opaque', cors: false, note: '' };
  } catch (e) { return { ok: false, ms: null, code: null, kind: e.isTimeout ? 'timeout' : 'error', note: e.isTimeout ? 'timeout' : 'neterr' }; }
}
// Ticker 1 dtk di Web Worker (timer tab latar tidak diperlambat sekuat setInterval biasa); gagal -> setInterval.
// Halaman https boleh memanggil http? Uji ke http://example.com (no-cors): berhasil = "Insecure content" diizinkan.
async function pingMixedTest() {
  if (location.protocol !== 'https:') return true;
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 6000);
  try { await fetch('http://example.com/?swag=' + Date.now(), { mode: 'no-cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal }); return true; }
  catch (e) { return false; }
  finally { clearTimeout(tm); }
}
// Versi lokal satu file: index.html + seluruh CSS & JS lokal disisipkan inline, supaya bisa dibuka mandiri lewat file://.
async function pingLocalHtml() {
  const res = await fetch(location.href.split('#')[0], { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  let html = await res.text();
  const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'));
  for (const lnk of cssLinks) {
    const href = lnk.getAttribute('href');
    if (!href || /^https?:\/\//i.test(href)) continue;
    const rCss = await fetch(new URL(href, location.href).href, { cache: 'no-store' });
    if (!rCss.ok) throw new Error(href + ' HTTP ' + rCss.status);
    const cssText = (await rCss.text()).split('</' + 'style').join('<\\/' + 'style');
    const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp('<link[^>]+href=["\']' + escapedHref + '["\'][^>]*/?>', 'i'), () => '<style>\n' + cssText + '\n</' + 'style>');
  }
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  for (const sc of scripts) {
    const src = sc.getAttribute('src');
    if (!src || /^https?:\/\//i.test(src)) continue;
    const rJs = await fetch(new URL(src, location.href).href, { cache: 'no-store' });
    if (!rJs.ok) throw new Error(src + ' HTTP ' + rJs.status);
    const code = (await rJs.text()).split('</' + 'script').join('<\\/' + 'script');
    const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp('<script[^>]+src=["\']' + escapedSrc + '["\'][^>]*></' + 'script>', 'i'), () => '<script>\n' + code + '\n</' + 'script>');
  }
  return html;
}
function pingWorkerMain() { setInterval(function () { postMessage(1); }, 1000); }
function pingTicker(cb) {
  let id = null, w = null;
  const fallback = () => { if (w) { try { w.terminate(); } catch (e) { /* abaikan */ } w = null; } if (!id) id = setInterval(cb, 1000); };
  try {
    const url = URL.createObjectURL(new Blob(['(' + pingWorkerMain.toString() + ')();'], { type: 'text/javascript' }));
    w = new Worker(url);
    w.onmessage = cb; w.onerror = fallback;
  } catch (e) { fallback(); }
  return { stop() { if (w) w.terminate(); if (id) clearInterval(id); w = null; id = null; } };
}
// Bunyi alarm via WebAudio (perlu satu klik user dulu supaya AudioContext boleh bunyi).
function pingBeep(ctx, kind) {
  if (!ctx) return;
  const notes = kind === 'up' ? [523, 659, 784, 1047] : [440, 330, 220];
  const now = ctx.currentTime;
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = kind === 'up' ? 'sine' : 'square'; o.frequency.value = f;
    const st = now + i * 0.18;
    g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(kind === 'up' ? 0.35 : 0.15, st + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.16);
    o.connect(g); g.connect(ctx.destination); o.start(st); o.stop(st + 0.17);
  });
}
function pingCss(n, d) { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d; } catch (e) { return d; } }
function pingMsColor(ms) { return ms < 200 ? '#22c55e' : ms < 800 ? '#eab308' : '#f97316'; }
function pingCanvas(c, hgt) {
  const dpr = window.devicePixelRatio || 1, w = Math.max(60, c.clientWidth || 120);
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(hgt * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hgt * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, hgt);
  return { g, w };
}
function pingDrawSpark(c, hist) {
  const H = 28, { g, w } = pingCanvas(c, H), n = Math.max(20, Math.floor(w / 3)), h = (hist || []).slice(-n);
  const mx = Math.max(50, ...h.filter(x => x.ok && x.ms != null).map(x => x.ms));
  const bw = w / n;
  g.fillStyle = pingCss('--border', '#3e2f25'); g.fillRect(0, H - 1, w, 1);
  h.forEach((x, i) => {
    const xx = (n - h.length + i) * bw;
    if (!x.ok) { g.fillStyle = 'rgba(239,68,68,.85)'; g.fillRect(xx, 0, Math.max(1, bw - 1), H); return; }
    const hh = Math.max(2, Math.round((x.ms || 0) / mx * (H - 3)));
    g.fillStyle = pingMsColor(x.ms || 0); g.fillRect(xx, H - hh, Math.max(1, bw - 1), hh);
  });
}
function pingDrawBig(c, hist) {
  const H = 220, { g, w } = pingCanvas(c, H), L = 52, B = 22, T = 8, R = 8, h = hist || [];
  const muted = pingCss('--muted', '#aa9888'), border = pingCss('--border', '#3e2f25');
  g.font = '11px Consolas, monospace'; g.fillStyle = muted;
  if (!h.length) { g.fillText('—', L, H / 2); return; }
  const okMs = h.filter(x => x.ok && x.ms != null).map(x => x.ms);
  const mx = Math.max(50, ...okMs) * 1.1, pw = w - L - R, ph = H - T - B;
  const X = i => L + (h.length === 1 ? pw / 2 : i / (h.length - 1) * pw), Y = ms => T + ph - ms / mx * ph;
  for (let k = 0; k <= 4; k++) {
    const v = mx * k / 4, y = Y(v);
    g.strokeStyle = border; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(L, y); g.lineTo(w - R, y); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = muted; g.fillText(Math.round(v) + ' ms', 2, y + 4);
  }
  h.forEach((x, i) => { if (!x.ok) { g.fillStyle = 'rgba(239,68,68,.35)'; g.fillRect(X(i) - Math.max(1.5, pw / h.length / 2), T, Math.max(3, pw / h.length), ph); } });
  g.strokeStyle = pingCss('--accent', '#c87840'); g.lineWidth = 1.6; g.beginPath();
  let pen = false;
  h.forEach((x, i) => { if (x.ok && x.ms != null) { if (pen) g.lineTo(X(i), Y(x.ms)); else { g.moveTo(X(i), Y(x.ms)); pen = true; } } else pen = false; });
  g.stroke(); g.lineWidth = 1;
  h.forEach((x, i) => { if (x.ok && x.ms != null && h.length <= 240) { g.fillStyle = pingMsColor(x.ms); g.fillRect(X(i) - 1.5, Y(x.ms) - 1.5, 3, 3); } });
  const tl = ts => { const d = new Date(ts); return d.toTimeString().slice(0, 8); };
  g.fillStyle = muted;
  g.fillText(tl(h[0].t), L, H - 6);
  const last = tl(h[h.length - 1].t); g.fillText(last, w - R - g.measureText(last).width, H - 6);
  if (h.length > 2) { const mid = tl(h[Math.floor(h.length / 2)].t); g.fillText(mid, L + pw / 2 - g.measureText(mid).width / 2, H - 6); }
}
// ============================================================
//  Jam Dunia: cari kota / negara / singkatan (WIB, JST, PST) / UTC+7 -> jam di sana vs jam saya.
//  Semua lokal lewat Intl (database zona waktu browser, termasuk DST). Pin disimpan di localStorage.
// ============================================================
const CLK_KEY = 'scaClock';
// ============================================================
//  Git Lens: baca folder .git langsung di browser (loose object + packfile idx v1/v2,
//  delta OFS/REF) atau teks `git log`, lalu tabel + graph + pencarian + statistik + laporan.
// ============================================================
async function glInflate(u8) {
  const ds = new DecompressionStream('deflate');
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer());
}
function glHex(u8, off) { let s = ''; for (let i = 0; i < 20; i++) s += (u8[off + i] < 16 ? '0' : '') + u8[off + i].toString(16); return s; }
function glHexBytes(h) { const b = new Uint8Array(20); for (let i = 0; i < 20; i++) b[i] = parseInt(h.substr(i * 2, 2), 16); return b; }
function glU32(u8, o) { return ((u8[o] << 24) >>> 0) + (u8[o + 1] << 16) + (u8[o + 2] << 8) + u8[o + 3]; }
function glApplyDelta(base, d) {
  let p = 0;
  const vint = () => { let r = 0, s = 0, c; do { c = d[p++]; r += (c & 127) * Math.pow(2, s); s += 7; } while (c & 128); return r; };
  vint();
  const out = new Uint8Array(vint());
  let o = 0;
  while (p < d.length) {
    const c = d[p++];
    if (c & 128) {
      let off = 0, size = 0;
      if (c & 1) off |= d[p++]; if (c & 2) off |= d[p++] << 8; if (c & 4) off |= d[p++] << 16; if (c & 8) off += d[p++] * 16777216;
      if (c & 16) size |= d[p++]; if (c & 32) size |= d[p++] << 8; if (c & 64) size |= d[p++] << 16;
      if (!size) size = 65536;
      out.set(base.subarray(off, off + size), o); o += size;
    } else if (c) { out.set(d.subarray(p, p + c), o); o += c; p += c; }
    else throw new Error('delta rusak');
  }
  return out;
}
const GL_TYPES = { 1: 'commit', 2: 'tree', 3: 'blob', 4: 'tag' };
// files: Map path-relatif-terhadap-.git -> File/Blob. Kembalikan objek repo dengan readObject(sha).
async function glOpenRepo(files) {
  const packs = [], cache = new Map(), dec = new TextDecoder();
  for (const [path, f] of files) {
    const m = path.match(/^objects\/pack\/(pack-[0-9a-f]+)\.idx$/);
    if (!m || !files.has('objects/pack/' + m[1] + '.pack')) continue;
    const u = new Uint8Array(await f.arrayBuffer()), pf = files.get('objects/pack/' + m[1] + '.pack');
    const v2 = glU32(u, 0) === 0xff744f63, fan = v2 ? 8 : 0, n = glU32(u, fan + 1020);
    const offs = new Float64Array(n);
    let shaAt;
    if (v2) {
      shaAt = i => 1032 + i * 20;
      const offStart = 1032 + n * 24, large = offStart + n * 4;
      for (let i = 0; i < n; i++) { const v = glU32(u, offStart + i * 4); offs[i] = v & 0x80000000 ? glU32(u, large + (v & 0x7fffffff) * 8) * 4294967296 + glU32(u, large + (v & 0x7fffffff) * 8 + 4) : v; }
    } else {
      shaAt = i => 1024 + i * 24 + 4;
      for (let i = 0; i < n; i++) offs[i] = glU32(u, 1024 + i * 24);
    }
    const sorted = Float64Array.from(offs).sort();
    packs.push({ id: m[1], idx: u, fan, n, shaAt, offs, sorted, file: pf, end: pf.size - 20 });
  }
  const find = (p, b) => {
    let lo = b[0] ? glU32(p.idx, p.fan + (b[0] - 1) * 4) : 0, hi = glU32(p.idx, p.fan + b[0] * 4) - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, at = p.shaAt(mid);
      let cmp = 0;
      for (let i = 0; i < 20 && !cmp; i++) cmp = p.idx[at + i] - b[i];
      if (!cmp) return p.offs[mid];
      if (cmp < 0) lo = mid + 1; else hi = mid - 1;
    }
    return -1;
  };
  const nextOff = (p, off) => {
    let lo = 0, hi = p.sorted.length - 1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (p.sorted[mid] <= off) lo = mid + 1; else hi = mid - 1; }
    return lo < p.sorted.length ? p.sorted[lo] : p.end;
  };
  const remember = (k, v) => { if (cache.size > 30000) cache.clear(); cache.set(k, v); return v; };
  async function readPacked(p, off) {
    const ck = p.id + ':' + off;
    if (cache.has(ck)) return cache.get(ck);
    const h = new Uint8Array(await p.file.slice(off, off + 40).arrayBuffer());
    let pos = 0, c = h[pos++];
    const type = (c >> 4) & 7;
    while (c & 128) c = h[pos++];
    let base = null;
    if (type === 6) {
      c = h[pos++]; let ofs = c & 127;
      while (c & 128) { c = h[pos++]; ofs = (ofs + 1) * 128 + (c & 127); }
      base = await readPacked(p, off - ofs);
    } else if (type === 7) { base = await readObject(glHex(h, pos)); pos += 20; }
    const data = await glInflate(new Uint8Array(await p.file.slice(off + pos, nextOff(p, off)).arrayBuffer()));
    const obj = base ? { type: base.type, data: glApplyDelta(base.data, data) } : { type: GL_TYPES[type] || 'unknown', data };
    return obj.type === 'blob' ? obj : remember(ck, obj);
  }
  async function readObject(sha) {
    if (cache.has(sha)) return cache.get(sha);
    const lf = files.get('objects/' + sha.slice(0, 2) + '/' + sha.slice(2));
    if (lf) {
      const raw = await glInflate(new Uint8Array(await lf.arrayBuffer())), z = raw.indexOf(0);
      const head = dec.decode(raw.subarray(0, z));
      return remember(sha, { type: head.split(' ')[0], data: raw.subarray(z + 1) });
    }
    const b = glHexBytes(sha);
    for (const p of packs) { const off = find(p, b); if (off >= 0) { const o = await readPacked(p, off); return o.type === 'blob' ? o : remember(sha, o); } }
    return null;
  }
  const text = async (path) => { const f = files.get(path); return f ? (await f.text()) : ''; };
  return { readObject, text, files, packs: packs.length, dec };
}
function glIdent(s) {
  const m = String(s || '').match(/^(.*?) <([^>]*)> (-?\d+) ([+-]\d{4})$/);
  return m ? { name: m[1], email: m[2], t: Number(m[3]), tz: m[4] } : { name: s || '', email: '', t: 0, tz: '+0000' };
}
function glParseCommit(sha, text) {
  const cut = text.indexOf('\n\n'), head = cut < 0 ? text : text.slice(0, cut), msg = cut < 0 ? '' : text.slice(cut + 2);
  const c = { sha, parents: [], tree: '', msg: msg.replace(/\s+$/, '') };
  head.split('\n').forEach(l => {
    if (l.charAt(0) === ' ') return;
    const i = l.indexOf(' '), k = l.slice(0, i), v = l.slice(i + 1);
    if (k === 'tree') c.tree = v; else if (k === 'parent') c.parents.push(v);
    else if (k === 'author') { const a = glIdent(v); c.an = a.name; c.ae = a.email; c.at = a.t; c.atz = a.tz; }
    else if (k === 'committer') { const a = glIdent(v); c.cn = a.name; c.ce = a.email; c.ct = a.t; c.ctz = a.tz; }
  });
  c.subject = c.msg.split('\n')[0];
  return c;
}
// Semua ref (HEAD, branch, remote, tag; loose + packed-refs) -> [{name, short, kind, sha}]
async function glRefs(repo) {
  const map = new Map();
  (await repo.text('packed-refs')).split(/\r?\n/).forEach(l => { const m = l.match(/^([0-9a-f]{40}) (refs\/\S+)$/); if (m) map.set(m[2], m[1]); });
  for (const [path, f] of repo.files) {
    if (path.indexOf('refs/') !== 0 || f.size > 200) continue;
    const v = (await f.text()).trim();
    if (/^[0-9a-f]{40}$/.test(v)) map.set(path, v);
  }
  const out = [];
  const head = (await repo.text('HEAD')).trim();
  for (const [name, sha0] of map) {
    if (/\/HEAD$/.test(name)) continue;
    let sha = sha0, o = await repo.readObject(sha);
    for (let k = 0; o && o.type === 'tag' && k < 5; k++) { const m = repo.dec.decode(o.data).match(/^object ([0-9a-f]{40})/); if (!m) break; sha = m[1]; o = await repo.readObject(sha); }
    if (!o || o.type !== 'commit') continue;
    const kind = name.indexOf('refs/heads/') === 0 ? 'branch' : name.indexOf('refs/remotes/') === 0 ? 'remote' : name.indexOf('refs/tags/') === 0 ? 'tag' : 'other';
    out.push({ name, short: name.replace(/^refs\/(heads|remotes|tags)\//, ''), kind, sha, head: head === 'ref: ' + name });
  }
  const hm = head.match(/^[0-9a-f]{40}$/);
  if (hm) out.push({ name: 'HEAD', short: 'HEAD (detached)', kind: 'head', sha: head, head: true });
  return out;
}
// Urutan seperti `git log --date-order`: anak selalu sebelum parent, sisanya terbaru dulu.
function glTopo(list) {
  const by = new Map(list.map(c => [c.sha, c])), kids = new Map();
  list.forEach(c => c.parents.forEach(p => { if (by.has(p)) kids.set(p, (kids.get(p) || 0) + 1); }));
  const ready = list.filter(c => !kids.get(c.sha)).sort((a, b) => a.ct - b.ct), out = [];
  const ins = c => { let lo = 0, hi = ready.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ready[m].ct <= c.ct) lo = m + 1; else hi = m; } ready.splice(lo, 0, c); };
  while (ready.length) {
    const c = ready.pop(); out.push(c);
    c.parents.forEach(p => { if (!by.has(p)) return; const n = kids.get(p) - 1; kids.set(p, n); if (!n) ins(by.get(p)); });
  }
  return out.length === list.length ? out : list.slice().sort((a, b) => b.ct - a.ct);
}
async function glWalk(repo, refs, max, onProg) {
  const seen = new Map(), stack = refs.map(r => r.sha);
  let n = 0;
  while (stack.length && seen.size < max) {
    const sha = stack.pop();
    if (seen.has(sha)) continue;
    const o = await repo.readObject(sha);
    if (!o || o.type !== 'commit') { seen.set(sha, null); continue; }
    const c = glParseCommit(sha, repo.dec.decode(o.data));
    seen.set(sha, c);
    for (let i = c.parents.length - 1; i >= 0; i--) if (!seen.has(c.parents[i])) stack.push(c.parents[i]);
    if (++n % 200 === 0 && onProg) await onProg(n);
  }
  return [...seen.values()].filter(Boolean);
}
// Perubahan file commit vs parent pertama: [{st:'A'|'M'|'D', path}]
async function glTreeDiff(repo, a, b) {
  const out = [];
  const tree = async (sha) => {
    if (!sha) return new Map();
    const o = await repo.readObject(sha), m = new Map();
    if (!o || o.type !== 'tree') return m;
    const d = o.data;
    let p = 0;
    while (p < d.length) {
      const sp = d.indexOf(32, p), z = d.indexOf(0, sp);
      const mode = repo.dec.decode(d.subarray(p, sp)), name = repo.dec.decode(d.subarray(sp + 1, z));
      m.set(name, { dir: mode === '40000', sha: glHex(d, z + 1) });
      p = z + 21;
    }
    return m;
  };
  const walk = async (x, y, pre) => {
    if (out.length > 3000) return;
    const A = await tree(x), B = await tree(y);
    for (const [n, e] of A) {
      const f = B.get(n);
      if (!f) { if (e.dir) await walk(e.sha, null, pre + n + '/'); else out.push({ st: 'A', path: pre + n, sha: e.sha }); }
      else if (f.sha !== e.sha) { if (e.dir && f.dir) await walk(e.sha, f.sha, pre + n + '/'); else out.push({ st: 'M', path: pre + n, sha: e.sha }); }
    }
    for (const [n, f] of B) if (!A.has(n)) { if (f.dir) await walk(null, f.sha, pre + n + '/'); else out.push({ st: 'D', path: pre + n }); }
  };
  await walk(a, b, '');
  return out.sort((p, q) => p.path.localeCompare(q.path));
}
function glTzOff(tz) { const m = String(tz || '').match(/^([+-])(\d{2}):?(\d{2})$/); return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0; }
function glTzStr(min) { const s = min < 0 ? '-' : '+', a = Math.abs(min); return s + String(Math.floor(a / 60)).padStart(2, '0') + String(a % 60).padStart(2, '0'); }
// Teks git log -> commit. Format disarankan: --pretty=format:"%H|%P|%an|%ae|%at|%ad|%ct|%D|%s" (lihat GL_LOG_CMD).
// Juga paham output default `git log` / `git log --date=iso` (tanpa graph bila parent tidak ada).
const GL_LOG_CMD = 'git log --all --date-order --pretty=format:"%H|%P|%an|%ae|%at|%ai|%ct|%D|%s"';
function glParseLog(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n'), out = [];
  if (lines.some(l => /^[0-9a-f]{40}\|/.test(l))) {
    lines.forEach(l => {
      if (!/^[0-9a-f]{40}\|/.test(l)) return;
      const f = l.split('|');
      const tzm = String(f[5] || '').match(/([+-]\d{2}:?\d{2})\s*$/), at = Number(f[4]) || Math.floor(Date.parse(f[5]) / 1000) || 0;
      const c = { sha: f[0], parents: f[1] ? f[1].split(' ').filter(Boolean) : [], an: f[2], ae: f[3], at, atz: tzm ? tzm[1].replace(':', '') : '+0000', ct: Number(f[6]) || at, refsTxt: f[7] || '', subject: f.slice(8).join('|') };
      c.cn = c.an; c.ce = c.ae; c.ctz = c.atz; c.msg = c.subject;
      out.push(c);
    });
    return { commits: out, graph: true };
  }
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const dt = s => {
    let m = s.match(/(\w{3}) (\w{3}) +(\d+) (\d\d):(\d\d):(\d\d) (\d{4}) ([+-]\d{4})/);
    if (m) return { t: (Date.UTC(+m[7], MON[m[2].toLowerCase()], +m[3], +m[4], +m[5], +m[6]) / 1000) - glTzOff(m[8]) * 60, tz: m[8] };
    m = s.match(/(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d):(\d\d) ?([+-]\d{2}:?\d{2}|Z)?/);
    if (m) { const tz = m[7] && m[7] !== 'Z' ? m[7].replace(':', '') : '+0000'; return { t: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000 - glTzOff(tz) * 60, tz }; }
    return { t: 0, tz: '+0000' };
  };
  let c = null;
  lines.forEach(l => {
    const cm = l.match(/^commit ([0-9a-f]{7,40})(?: \((.*)\))?/);
    if (cm) { c = { sha: cm[1], parents: [], refsTxt: cm[2] || '', msgLines: [] }; out.push(c); return; }
    if (!c) return;
    let m = l.match(/^Merge: (.+)$/); if (m) { c.parents = m[1].trim().split(/\s+/); c.merge = true; return; }
    m = l.match(/^Author:\s+(.*?)(?: <([^>]*)>)?$/); if (m) { c.an = m[1]; c.ae = m[2] || ''; return; }
    m = l.match(/^(?:Author)?Date:\s+(.*)$/); if (m) { const d = dt(m[1]); c.at = d.t; c.atz = d.tz; return; }
    m = l.match(/^(?:Commit)?Date:\s+(.*)$/); if (m) { c.ct = dt(m[1]).t; return; }
    if (/^ {4}/.test(l)) c.msgLines.push(l.slice(4));
  });
  out.forEach(x => { x.msg = x.msgLines.join('\n').trim(); x.subject = x.msg.split('\n')[0]; x.ct = x.ct || x.at; x.cn = x.an; x.ce = x.ae; x.ctz = x.atz; delete x.msgLines; });
  return { commits: out, graph: false };
}
// Lane graph per baris: {col, w, segs:[{d, c}], merge}
const GL_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#a855f7', '#14b8a6', '#ef4444', '#84cc16', '#06b6d4', '#f97316'];
function glGraph(list) {
  const have = new Set(list.map(c => c.sha)), rows = new Map(), lanes = [], LW = 12, RH = 26;
  let maxW = 1;
  const X = i => 7 + i * LW;
  list.forEach(c => {
    const before = lanes.slice();
    let col = lanes.indexOf(c.sha);
    if (col < 0) { col = lanes.indexOf(null); if (col < 0) col = lanes.length; lanes[col] = c.sha; }
    for (let i = 0; i < lanes.length; i++) if (i !== col && lanes[i] === c.sha) lanes[i] = null;
    const ps = c.parents.filter(p => have.has(p));
    lanes[col] = ps.length ? ps[0] : null;
    ps.slice(1).forEach(p => { if (lanes.indexOf(p) < 0) { let j = lanes.indexOf(null); if (j < 0) j = lanes.length; lanes[j] = p; } });
    while (lanes.length && lanes[lanes.length - 1] == null) lanes.pop();
    const after = lanes.slice(), segs = [];
    const curve = (x1, y1, x2, y2) => (x1 === x2 ? 'M' + x1 + ' ' + y1 + 'V' + y2 : 'M' + x1 + ' ' + y1 + 'C' + x1 + ' ' + (y1 + y2) / 2 + ' ' + x2 + ' ' + (y1 + y2) / 2 + ' ' + x2 + ' ' + y2);
    before.forEach((s, i) => {
      if (s == null) return;
      if (s === c.sha) segs.push({ d: curve(X(i), 0, X(col), RH / 2), c: GL_COLORS[i % 10] });
      else { const j = after.indexOf(s); segs.push({ d: curve(X(i), 0, X(j < 0 ? i : j), RH), c: GL_COLORS[(j < 0 ? i : j) % 10] }); }
    });
    ps.forEach(p => { const j = after.indexOf(p); if (j >= 0) segs.push({ d: curve(X(col), RH / 2, X(j), RH), c: GL_COLORS[j % 10] }); });
    maxW = Math.max(maxW, before.length, after.length, col + 1);
    rows.set(c.sha, { col, cx: X(col), color: GL_COLORS[col % 10], segs, merge: c.parents.length > 1 });
  });
  return { rows, w: Math.min(14 + (maxW - 1) * LW, 14 + 15 * LW) };
}
// Judul commit untuk laporan: rapikan spasi, huruf awal kapital, tanpa titik akhir.
// Branch per commit. tips: [{name, kind, sha, head}] (urut bebas). Hasil:
//  names[] (urutan prioritas), bit per commit (Uint32Array, commit terjangkau dari ref ke-i = seperti `git log <ref>`),
//  owner: nama branch "pemilik" commit (rantai first-parent dari tip; sisanya dari pesan "Merge branch 'x'").
function glBranchInfo(list, tips) {
  // prioritas pemilik: main/master > HEAD > develop > branch lokal lain > remote > tag
  const rank = t => {
    const base = t.name.replace(/^[^/]+\//, ''), loc = t.kind === 'branch';
    if (/^(main|master)$/.test(t.kind === 'remote' ? base : t.name) && t.kind !== 'tag') return loc ? 0 : 1;
    if (t.head) return 2;
    if (/^(develop|dev|development)$/.test(t.kind === 'remote' ? base : t.name) && t.kind !== 'tag') return loc ? 3 : 4;
    return loc ? 5 : t.kind === 'remote' ? 6 : t.kind === 'tag' ? 8 : 9;
  };
  const seenName = new Set();
  const refs = tips.filter(t => t.name && !/^(refs\/stash|stash)$/.test(t.name) && !seenName.has(t.name) && seenName.add(t.name))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const idx = new Map(list.map((c, i) => [c.sha, i])), n = list.length, R = refs.length, W = Math.max(1, Math.ceil(R / 32));
  const bits = new Uint32Array(n * W);
  refs.forEach((r, k) => { const i = idx.get(r.sha); if (i != null) bits[i * W + (k >> 5)] |= (1 << (k & 31)); });
  for (let i = 0; i < n; i++) list[i].parents.forEach(p => { const j = idx.get(p); if (j != null) for (let w = 0; w < W; w++) bits[j * W + w] |= bits[i * W + w]; });
  const owner = new Map(), remotes = new Set(refs.filter(r => r.kind === 'remote').map(r => r.name.split('/')[0]));
  const norm = n => { const i = n.indexOf('/'); return i > 0 && remotes.has(n.slice(0, i)) ? n.slice(i + 1) : n; };
  const claim = (sha, name0) => {
    const name = norm(name0);
    let c = list[idx.get(sha)];
    while (c && !owner.has(c.sha)) { owner.set(c.sha, name); c = c.parents.length ? list[idx.get(c.parents[0])] : null; }
  };
  refs.filter(r => r.kind !== 'tag').forEach(r => claim(r.sha, r.name));
  const mergeName = s => { let m = String(s || '').match(/^Merge (?:remote-tracking )?branch '([^']+)'/); if (m) return m[1]; m = String(s || '').match(/^Merge pull request #\d+ from [^/\s]+\/(\S+)/); if (m) return m[1]; m = String(s || '').match(/^Merge (?:branch )?(\S+) into /); return m ? m[1].replace(/^'|'$/g, '') : ''; };
  const isStash = c => /^(WIP on|On|index on|untracked files on) [^:]+: [0-9a-f]{7,}/.test(c.subject || '');
  list.forEach(c => { if (isStash(c) && !owner.has(c.sha)) owner.set(c.sha, 'stash'); });
  list.forEach(c => { if (owner.get(c.sha) === 'stash') return; for (let k = 1; k < c.parents.length; k++) if (idx.has(c.parents[k]) && !owner.has(c.parents[k])) claim(c.parents[k], mergeName(c.subject) || '(' + c.parents[k].slice(0, 7) + ')'); });
  refs.filter(r => r.kind === 'tag').forEach(r => claim(r.sha, 'tag ' + r.name));
  list.forEach(c => { if (!owner.has(c.sha)) owner.set(c.sha, '(?)'); });
  return { names: refs.map(r => r.name), kinds: refs.map(r => r.kind), W, bits, idx, owner };
}
// Gantt/timeline: baris = branch pemilik, x = waktu. ppd = px per hari.
function glGanttLayout(list, owner, tOf, ppd, prio, loc) {
  const RH = 24, TOP = 34, L = 12, have = new Map(list.map(c => [c.sha, c]));
  let minT = Infinity, maxT = -Infinity;
  list.forEach(c => { const t = tOf(c); if (t < minT) minT = t; if (t > maxT) maxT = t; });
  const d0 = new Date(minT * 1000); d0.setHours(0, 0, 0, 0);
  const d1 = new Date(maxT * 1000); d1.setHours(0, 0, 0, 0); d1.setDate(d1.getDate() + 1);
  const t0 = d0.getTime() / 1000, t1 = d1.getTime() / 1000, X = t => L + (t - t0) / 86400 * ppd;
  const rowsMap = new Map();
  list.forEach(c => { const o = owner.get(c.sha) || '(?)', t = tOf(c); const r = rowsMap.get(o) || { name: o, min: t, max: t, n: 0 }; r.min = Math.min(r.min, t); r.max = Math.max(r.max, t); r.n++; rowsMap.set(o, r); });
  const rows = [...rowsMap.values()].sort((a, b) => (prio(a.name) - prio(b.name)) || (a.min - b.min));
  rows.forEach((r, i) => { r.i = i; r.y = TOP + i * RH + RH / 2; r.color = GL_COLORS[i % 10]; r.x1 = X(r.min); r.x2 = X(r.max); });
  const rowOf = new Map(rows.map(r => [r.name, r]));
  const dots = list.map(c => { const r = rowOf.get(owner.get(c.sha) || '(?)'); return { sha: c.sha, x: X(tOf(c)), y: r.y, color: r.color, merge: c.parents.length > 1, tip: c }; });
  const links = [];
  list.forEach(c => c.parents.forEach(p => {
    const pc = have.get(p); if (!pc) return;
    const ra = rowOf.get(owner.get(p) || '(?)'), rb = rowOf.get(owner.get(c.sha) || '(?)');
    if (ra === rb) return;
    const x1 = X(tOf(pc)), x2 = X(tOf(c)), xm = (x1 + x2) / 2;
    links.push({ d: 'M' + x1 + ' ' + ra.y + 'C' + xm + ' ' + ra.y + ' ' + xm + ' ' + rb.y + ' ' + x2 + ' ' + rb.y, color: c.parents[0] === p ? ra.color : rb.color, merge: c.parents[0] !== p });
  }));
  const ticks = [], z = n => String(n).padStart(2, '0'), MON = [];
  for (let m = 0; m < 12; m++) { let nm = ''; try { nm = new Date(2026, m, 1).toLocaleDateString(loc || 'id-ID', { month: 'short' }).replace(/\.$/, ''); } catch (e) { nm = String(m + 1); } MON.push(nm); }
  const cur = new Date(t0 * 1000);
  for (let k = 0; cur.getTime() / 1000 <= t1 && k < 5000; k++) {
    const x = X(cur.getTime() / 1000), dom = cur.getDate(), dow = cur.getDay();
    const major = dom === 1;
    if (ppd >= 36) ticks.push({ x, label: z(dom) + ' ' + MON[cur.getMonth()] + (major || k === 0 ? ' ' + cur.getFullYear() : ''), major, weekend: dow === 0 || dow === 6 });
    else if (ppd >= 6) { if (dow === 1 || major || k === 0) ticks.push({ x, label: (dow === 1 || k === 0) ? z(dom) + ' ' + MON[cur.getMonth()] : '', major, weekend: false }); }
    else if (major || k === 0) ticks.push({ x, label: MON[cur.getMonth()] + ' ' + cur.getFullYear(), major: true, weekend: false });
    cur.setDate(cur.getDate() + 1);
  }
  const now = Date.now() / 1000;
  return { rows, dots, links, ticks, w: Math.ceil(X(t1)) + 20, h: TOP + rows.length * RH + 6, top: TOP, rh: RH, nowX: now >= t0 && now <= t1 ? X(now) : null };
}
// Aturan secret untuk scan riwayat git: aturan 'raw' dari SAST + pola tambahan khas file config/.env.
const GL_SECRET_RULES = SAST_RULES.filter(r => r.view === 'raw').concat([
  { re: /^\s*(?:export\s+)?[A-Za-z0-9_.]*(?:PASSWORD|PASSWD|PWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY|CLIENT_?SECRET)[A-Za-z0-9_.]*\s*[=:]\s*(?!\$\{|\$\(|<|%|\s*$|["']?\s*["']?\s*$)["']?[^\s"'#]{4,}/i, rule: 'Secret di file env/config', severity: 'HIGH', fix: 'Pindahkan ke secret manager / variabel environment server; jangan commit file .env (tambahkan ke .gitignore).' },
  { re: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|mariadb|redis|amqp|mssql|sqlserver):\/\/[^\s:@/'"]+:[^\s@/'"]{3,}@/i, rule: 'Connection string berisi password', severity: 'HIGH', fix: 'Ganti password database itu, lalu ambil connection string dari environment/secret manager.' },
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, rule: 'Token JWT ter-hardcode', severity: 'MEDIUM', fix: 'Cabut token/sesinya, ganti signing key bila token masih berlaku lama.' },
  { re: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]{20,}|https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]{20,}/, rule: 'Webhook URL ter-hardcode', severity: 'MEDIUM', fix: 'Buat ulang webhook (URL lama bisa dipakai siapa saja untuk kirim pesan).' },
  { re: /\bAuthorization['"]?\s*[:=]\s*['"]?(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/i, rule: 'Header Authorization ter-hardcode', severity: 'HIGH', fix: 'Cabut token/kredensial itu dan ambil dari konfigurasi saat runtime.' }
]);
const GL_SKIP_EXT = /\.(png|jpe?g|gif|bmp|ico|webp|svgz?|woff2?|ttf|eot|otf|zip|gz|tgz|rar|7z|jar|war|ear|dll|exe|so|dylib|pdb|pdf|docx?|xlsx?|pptx?|mp[34]|mov|avi|wav|class|o|a|min\.js|min\.css|map|lock)$/i;
const GL_SKIP_NAME = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|Pipfile\.lock|poetry\.lock|Cargo\.lock|go\.sum|packages\.lock\.json)$|(^|\/)(node_modules|vendor|bower_components|dist|\.angular)\//i;
function glMask(v) { v = String(v || ''); if (v.length <= 8) return v.slice(0, 2) + '•••'; return v.slice(0, 4) + '•'.repeat(Math.min(12, v.length - 6)) + v.slice(-2); }
// Scan satu teks blob -> [{rule, severity, fix, value, line, text}]
function glScanText(text) {
  const out = [], lines = text.split('\n');
  for (let i = 0; i < lines.length && i < 50000; i++) {
    const line = lines[i].length > 4000 ? lines[i].slice(0, 4000) : lines[i];
    if (line.length < 8) continue;
    for (const r of GL_SECRET_RULES) {
      if (!r.re.test(line)) continue;
      const m = line.match(r.re);
      out.push({ rule: r.rule, severity: r.severity, fix: r.fix, value: (m ? m[0] : line).trim().slice(0, 300), line: i + 1, text: line.trim().slice(0, 300) }); break;
    }
  }
  return out;
}
// Cari sha blob di tree berdasarkan path (mis. 'src/app/config.ts'); null bila tidak ada.
async function glBlobAt(repo, treeSha, path) {
  let cur = treeSha;
  const parts = path.split('/');
  for (let k = 0; k < parts.length; k++) {
    const o = await repo.readObject(cur);
    if (!o || o.type !== 'tree') return null;
    const d = o.data;
    let p = 0, hit = null;
    while (p < d.length) {
      const sp = d.indexOf(32, p), z = d.indexOf(0, sp);
      if (repo.dec.decode(d.subarray(sp + 1, z)) === parts[k]) { hit = glHex(d, z + 1); break; }
      p = z + 21;
    }
    if (!hit) return null;
    cur = hit;
  }
  return cur;
}
function glTidy(s) { s = String(s || '').replace(/\s+/g, ' ').trim().replace(/\.+$/, ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function glCsv(rows) { return rows.map(r => r.map(v => { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n'); }
const GL_I18N = {
  id: {
    tab_git: 'Git Lens', gl_title: 'Git Lens — riwayat commit, graph, pola & laporan',
    gl_intro: 'Drop folder repo (atau folder .git-nya) untuk membaca semua commit langsung dari .git di browser: branch, tag, merge, graph, pencarian, timestamp, statistik pola kerja, dan laporan harian (CSV/HTML). Tidak ada yang diunggah ke server. Bisa beberapa repo sekaligus, atau paste output git log.',
    gl_drop: 'Drop folder repo / .git di sini, atau klik untuk memilih folder .git', gl_drop_sub: 'Drag & drop folder repo paling enak (hanya .git yang dibaca, node_modules dilewati). Lewat dialog pilih folder, pilih folder .git-nya (aktifkan "tampilkan item tersembunyi" di Explorer).',
    gl_max: 'Maks commit', gl_paste_title: '📋 Atau paste output git log', gl_paste_desc: 'Jalankan perintah ini di repo (graph ikut tampil), atau paste output git log biasa (tanpa graph):',
    gl_project_ph: 'Nama project (mis. capex-be)', gl_paste_ph: 'Paste hasil git log di sini', gl_paste_add: 'Tambah',
    gl_search_ph: 'Cari pesan, hash, author, email, branch/tag ... (beberapa kata = semua harus cocok)',
    gl_all_authors: 'Semua author', gl_all_projects: 'Semua project', gl_m_all: 'Commit + merge', gl_m_no: 'Tanpa merge', gl_m_only: 'Merge saja',
    gl_from: 'Dari', gl_to: 'Sampai', gl_tip_datekind: 'Tanggal author = saat perubahan dibuat; tanggal commit = saat commit dibuat/di-rebase/cherry-pick.', gl_d_author: 'Tanggal author', gl_d_commit: 'Tanggal commit',
    gl_all_branches: 'Semua branch', gl_tip_branch: 'Hanya commit yang ada di branch/tag ini (seperti git log <branch>).', gl_tip_owner: 'Branch asal commit: rantai first-parent dari tip branch; commit dari branch yang sudah dihapus dikenali dari pesan "Merge branch \'x\'".',
    gl_lk_leak: 'secret bocor', gl_lk_bell_tip: 'Hasil scan secret (password, token, key) di seluruh riwayat commit. Klik untuk lihat.',
    gl_lk_title: 'Secret bocor di riwayat git', gl_lk_prog: 'scan commit {d}/{t} · {b} file dibaca', gl_lk_done: 'selesai: {t} commit, {b} versi file dibaca', gl_lk_rescan: 'Scan ulang',
    gl_lk_desc: 'Setiap versi file di setiap commit diperiksa satu per satu (commit lama ke baru), termasuk file yang sudah dihapus atau ditimpa. Lockfile, gambar, file biner, node_modules/vendor/dist dilewati. Aturan = aturan secret tab SAST + pola .env/connection string/JWT/webhook.',
    gl_lk_show: 'Tampilkan nilai penuh (hanya di layar ini)', gl_lk_all_sev: 'Semua severity', gl_lk_none: 'Belum ada secret yang terdeteksi.',
    gl_lk_rule: 'Jenis', gl_lk_value: 'Nilai yang bocor', gl_lk_file: 'File:baris', gl_lk_first: 'Commit pertama', gl_lk_first_tip: 'Commit paling lama yang memasukkan secret ini (klik untuk detail commit).',
    gl_lk_count: 'Muncul', gl_lk_count_tip: 'Berapa versi file yang berisi secret yang sama.', gl_lk_st_tip: 'Masih ada di versi terbaru (HEAD) atau hanya tersisa di riwayat.',
    gl_lk_st_head: 'masih di HEAD', gl_lk_st_history: 'hanya di history', gl_lk_fix: 'Saran',
    gl_lk_advice_t: 'Langkah perbaikan', gl_lk_advice: '1. Anggap semua secret di atas sudah bocor: ganti/rotate (password DB, API key, token) di sistem aslinya. Menghapus dari kode saja tidak cukup.\n2. Pindahkan ke secret manager / environment server, tambahkan file .env ke .gitignore.\n3. Bila repo pernah dibagikan, bersihkan riwayat dengan git filter-repo (atau BFG), lalu force push dan minta semua orang clone ulang.\n4. Pasang pengecekan sebelum commit (pre-commit hook / gitleaks di CI) supaya tidak terulang.',
    gl_v_gantt: 'Timeline branch', gl_gantt_need: 'Timeline butuh satu project dengan data parent (folder .git atau git log format yang disarankan). Pilih project dulu.',
    gl_gantt_desc: 'Satu baris per branch, sumbu X = tanggal (geser kiri-kanan).', gl_zoom: 'Zoom', gl_z_auto: 'otomatis', gl_z_dayu: 'hari', gl_gantt_latest: 'Ke paling baru',
    gl_gantt_cap: 'Ditampilkan 6000 commit terbaru; pakai filter tanggal untuk melihat yang lebih lama.',
    gl_gantt_legend: 'Batang = rentang aktif branch. Garis putus = branch dibuat (fork) dari commit di branch lain; garis penuh = di-merge ke branch tujuan. Titik berongga = commit merge, garis merah = hari ini. Klik titik untuk detail.',
    gl_v_list: 'Commit & graph', gl_v_stats: 'Statistik & pola', gl_v_report: 'Laporan harian', gl_shown: '{n} dari {t} commit', gl_reset: 'hapus filter',
    gl_to_clock: 'Ke Jam Dunia', gl_parents: 'Parent', gl_root: 'commit pertama (root)', gl_merge: 'merge', gl_files: 'File berubah', gl_vs_first: 'dibanding parent pertama',
    gl_files_paste: 'Daftar file hanya tersedia bila sumbernya folder .git.', gl_graph_off: 'Graph tampil bila satu project dipilih dan tidak ada filter.',
    gl_th_msg: 'Pesan', gl_th_date: 'Tanggal (jam saya)', gl_more: 'Tampilkan 300 lagi ({n} tersisa)',
    gl_per_month: 'Commit per bulan', gl_per_day: 'Commit per hari', gl_heat: 'Pola jam kerja (hari × jam)', gl_heat_desc: 'Jumlah commit per hari dan jam (zona jam saya). Klik sel untuk melihat commit-nya.',
    gl_authors: 'Author', gl_first: 'Pertama', gl_last: 'Terakhir', gl_days_active: 'Hari aktif',
    gl_rep_nomerge: 'Sembunyikan commit merge', gl_th_day: 'Tanggal', gl_tip_first: 'Jam commit pertama/terakhir hari itu (zona jam saya), perkiraan jam mulai/selesai kerja.', gl_first_time: 'Jam pertama', gl_last_time: 'Jam terakhir', gl_work: 'Pekerjaan (judul commit)',
    gl_rep_more: '... dan {n} baris lain (semua ikut di file export).', gl_rep_title: 'Laporan Pekerjaan dari Riwayat Git', gl_rep_meta: 'Total {n} commit dalam {d} hari kerja.',
    gl_note: 'Dibaca langsung dari loose object + packfile (.idx v1/v2, delta), semua ref (branch, remote, tag, packed-refs). Worktree/submodule (file .git berisi gitdir) belum didukung: pilih folder .git aslinya.',
    gl_local: 'jam saya', gl_orig: 'zona asli', gl_loaded: '{n} commit dimuat dari {p}.', gl_capped: 'Dibatasi {n} commit (naikkan "Maks commit" untuk lebih).',
    gl_err_nogit: 'Folder .git tidak ditemukan (butuh file HEAD, refs, objects).', gl_err_browser: 'Browser ini belum mendukung DecompressionStream. Pakai Chrome/Edge versi baru.',
    gl_err_norefs: 'Tidak ada branch/tag yang bisa dibaca.', gl_err_read: 'Gagal membaca repo:', gl_err_paste: 'Tidak ada commit yang terbaca dari teks.',
    gl_prog_open: 'Membuka index pack...', gl_prog_walk: 'Membaca commit: {n}', gl_prog_sort: 'Mengurutkan...', gl_prog_scan: 'Membaca daftar file...',
    gl_c_commits: 'Commit', gl_c_merges: 'Merge', gl_c_authors: 'Author', gl_c_days: 'Hari aktif', gl_c_avg: 'Commit / hari aktif', gl_c_busiest: 'Hari tersibuk',
    gl_c_start: 'Rata-rata jam pertama', gl_c_end: 'Rata-rata jam terakhir', gl_c_hour: 'Jam tersibuk', gl_c_dow: 'Hari tersibuk (minggu)', gl_c_first: 'Commit pertama', gl_c_last: 'Commit terakhir',
    grp_git_title: 'Git Lens', grp_git_desc: 'Tidak memakai API: folder .git / teks git log dibaca lokal di browser.'
  },
  en: {
    tab_git: 'Git Lens', gl_title: 'Git Lens — commit history, graph, patterns & reports',
    gl_intro: 'Drop a repository folder (or its .git folder) to parse commits directly from .git in the browser: branches, tags, merges, commit graph, search, timestamps, work patterns, and daily reports (CSV/HTML). No data is uploaded. Supports multiple repositories or pasted git log output.',
    gl_drop: 'Drop a repo / .git folder here, or click to pick the .git folder', gl_drop_sub: 'Dragging and dropping the repository folder works best (only .git is read; node_modules is skipped). When using the folder dialog, select the .git folder (enable "Hidden items" in file explorer).',
    gl_max: 'Max commits', gl_paste_title: '📋 Or paste git log output', gl_paste_desc: 'Run this command in the repository to include graph data, or paste standard git log output (without graph):',
    gl_project_ph: 'Project name (e.g. backend-api)', gl_paste_ph: 'Paste git log output here', gl_paste_add: 'Add',
    gl_search_ph: 'Search message, hash, author, email, branch/tag ... (several words = all must match)',
    gl_all_authors: 'All authors', gl_all_projects: 'All projects', gl_m_all: 'Commits + merges', gl_m_no: 'No merges', gl_m_only: 'Merges only',
    gl_from: 'From', gl_to: 'To', gl_tip_datekind: 'Author date = when the change was made; commit date = when it was committed/rebased/cherry-picked.', gl_d_author: 'Author date', gl_d_commit: 'Commit date',
    gl_all_branches: 'All branches', gl_tip_branch: 'Only commits contained in this branch/tag (like git log <branch>).', gl_tip_owner: 'Branch a commit belongs to: first-parent chain from the branch tip; commits from deleted branches are named from "Merge branch \'x\'" messages.',
    gl_lk_leak: 'leaked secrets', gl_lk_bell_tip: 'Secret scan (passwords, tokens, keys) across the whole commit history. Click to view.',
    gl_lk_title: 'Secrets leaked in git history', gl_lk_prog: 'Scanning commit {d}/{t} · {b} files read', gl_lk_done: 'Done: {t} commits, {b} file versions read', gl_lk_rescan: 'Rescan',
    gl_lk_desc: 'Every file version in every commit is checked one by one (oldest to newest), including files that were later deleted or overwritten. Lockfiles, images, binaries, node_modules/vendor/dist are skipped. Rules = the SAST tab secret rules + .env/connection string/JWT/webhook patterns.',
    gl_lk_show: 'Show full values (on this screen only)', gl_lk_all_sev: 'All severities', gl_lk_none: 'No secrets detected yet.',
    gl_lk_rule: 'Type', gl_lk_value: 'Leaked value', gl_lk_file: 'File:line', gl_lk_first: 'First commit', gl_lk_first_tip: 'The oldest commit that introduced this secret (click for commit details).',
    gl_lk_count: 'Occurrences', gl_lk_count_tip: 'How many file versions contain the same secret.', gl_lk_st_tip: 'Still present in the latest version (HEAD) or only left in history.',
    gl_lk_st_head: 'still in HEAD', gl_lk_st_history: 'history only', gl_lk_fix: 'Remediation',
    gl_lk_advice_t: 'Remediation steps', gl_lk_advice: '1. Treat every secret above as leaked: rotate it (DB password, API key, token) in the real system. Removing it from code is not enough.\n2. Move it to a secret manager / server environment and add .env files to .gitignore.\n3. If the repo was ever shared, clean the history with git filter-repo (or BFG), force push and ask everyone to re-clone.\n4. Add a pre-commit hook / gitleaks in CI so it does not happen again.',
    gl_v_gantt: 'Branch timeline', gl_gantt_need: 'The timeline needs one project with parent data (a .git folder or git log in the suggested format). Pick a project first.',
    gl_gantt_desc: 'One row per branch, X axis = date (scroll left/right).', gl_zoom: 'Zoom', gl_z_auto: 'Auto', gl_z_dayu: 'day', gl_gantt_latest: 'Jump to latest',
    gl_gantt_cap: 'Showing the 6000 newest commits; use the date filter for older ones.',
    gl_gantt_legend: 'Bar = active span of the branch. Dashed line = branch forked from a commit on another branch; solid line = merged into the target branch. Hollow dot = merge commit, red line = today. Click a dot for details.',
    gl_v_list: 'Commits & graph', gl_v_stats: 'Stats & patterns', gl_v_report: 'Daily report', gl_shown: '{n} of {t} commits', gl_reset: 'Clear filters',
    gl_to_clock: 'To World Clock', gl_parents: 'Parents', gl_root: 'initial commit (root)', gl_merge: 'merge', gl_files: 'Changed files', gl_vs_first: 'vs first parent',
    gl_files_paste: 'The file list is only available when the source is a .git folder.', gl_graph_off: 'The graph shows when one project is selected and no filter is active.',
    gl_th_msg: 'Message', gl_th_date: 'Date (local time)', gl_more: 'Show 300 more ({n} left)',
    gl_per_month: 'Commits per month', gl_per_day: 'Commits per day', gl_heat: 'Work-hour pattern (day × hour)', gl_heat_desc: 'Commits per weekday and hour (local time zone). Click a cell to see those commits.',
    gl_authors: 'Authors', gl_first: 'First', gl_last: 'Last', gl_days_active: 'Active days',
    gl_rep_nomerge: 'Hide merge commits', gl_th_day: 'Date', gl_tip_first: 'First/last commit time that day (local time zone), a rough start/end of work.', gl_first_time: 'Start time', gl_last_time: 'End time', gl_work: 'Work (commit titles)',
    gl_rep_more: '... and {n} more rows (all are in the export).', gl_rep_title: 'Work Report from Git History', gl_rep_meta: 'Total {n} commits over {d} working days.',
    gl_note: 'Read straight from loose objects + packfiles (.idx v1/v2, deltas) and every ref (branches, remotes, tags, packed-refs). Worktrees/submodules (a .git file with gitdir) are not supported yet: pick the real .git folder.',
    gl_local: 'local time', gl_orig: 'original time zone', gl_loaded: '{n} commits loaded from {p}.', gl_capped: 'Capped at {n} commits (raise "Max commits" for more).',
    gl_err_nogit: 'No .git folder found (HEAD, refs and objects are needed).', gl_err_browser: 'This browser lacks DecompressionStream. Use a recent Chrome/Edge.',
    gl_err_norefs: 'No readable branch/tag.', gl_err_read: 'Could not read the repo:', gl_err_paste: 'No commits could be read from the text.',
    gl_prog_open: 'Opening pack indexes...', gl_prog_walk: 'Reading commits: {n}', gl_prog_sort: 'Sorting...', gl_prog_scan: 'Listing files...',
    gl_c_commits: 'Commits', gl_c_merges: 'Merges', gl_c_authors: 'Authors', gl_c_days: 'Active days', gl_c_avg: 'Commits / active day', gl_c_busiest: 'Busiest day',
    gl_c_start: 'Avg start time', gl_c_end: 'Avg end time', gl_c_hour: 'Busiest hour', gl_c_dow: 'Busiest weekday', gl_c_first: 'First commit', gl_c_last: 'Last commit',
    grp_git_title: 'Git Lens', grp_git_desc: 'Uses no server API: the .git folder / git log text is read locally in the browser.'
  }
};
Object.keys(GL_I18N).forEach(l => { I18N[l] = Object.assign({}, GL_I18N[l], I18N[l] || {}); });
// ============================================================
//  Shopee Hook: bookmarklet di tab Shopee. Menangkap produk yang SUDAH dimuat halaman
//  (respons JSON /api/v4/... yang diminta browser sendiri + kartu produk di DOM) selama
//  user menjelajah manual, lalu mengirimnya ke tab scanner (postMessage) untuk disimpan
//  di IndexedDB scanner. Tidak memanggil API Shopee sendiri. Fungsi dijadikan teks
//  (toString) untuk bookmarklet: harus mandiri, ES5, tanpa innerHTML/eval.
// ============================================================
function shpHookMain(cfg) {
  if (window.__shpHook) { window.__shpHook.show(); return; }
  var S = window.__shpHook = { items: {}, order: [], sent: 0, api: 0, dom: 0, w: null, ack: false, queue: [] };
  var KEY = '__shpHookItems';
  function now() { return Date.now(); }
  function num(v) { if (v === null || v === undefined || v === '') return null; var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : null; }
  function str(v, max) { return v === null || v === undefined ? '' : String(v).slice(0, max || 300); }
  function keyword() {
    try { var u = new URL(location.href); return u.searchParams.get('keyword') || u.searchParams.get('q') || (/-cat\./.test(u.pathname) ? decodeURIComponent(u.pathname.split('/').pop().split('-cat.')[0]).replace(/-/g, ' ') : ''); } catch (e) { return ''; }
  }
  // Gabung item baru dengan yang sudah ada; data API lebih lengkap dari DOM.
  function put(it) {
    if (!it || !it.shopid || !it.itemid || !it.name) return false;
    var id = it.shopid + '.' + it.itemid, old = S.items[id];
    it.id = id; it.host = location.host; it.q = keyword(); it.seen = now(); it.url = 'https://' + location.host + '/product/' + it.shopid + '/' + it.itemid;
    if (old) {
      if (old.src === 'api' && it.src === 'dom') { old.seen = it.seen; old.q = old.q || it.q; return false; }
      for (var k in it) if (it[k] !== null && it[k] !== '' && it[k] !== undefined) old[k] = it[k];
      old.dirty = true;
      return false;
    }
    it.dirty = true; S.items[id] = it; S.order.push(id);
    if (it.src === 'api') S.api++; else S.dom++;
    return true;
  }
  // ---- 1) Respons JSON: cari objek ber-itemid + shopid di mana pun dalam struktur.
  function fromApi(o) {
    var b = o.item_basic || o.item_data || o, a = o.item_card_displayed_asset || b.item_card_displayed_asset || {};
    var itemid = num(b.itemid || o.itemid), shopid = num(b.shopid || o.shopid), name = b.name || a.name || o.name;
    if (!itemid || !shopid || typeof name !== 'string') return null;
    var pr = o.item_card_display_price || b.item_card_display_price || {};
    var P = function (v) { v = num(v); return v === null ? null : Math.round(v / 100000); };
    var sc = b.item_card_display_sold_count || o.item_card_display_sold_count || {};
    var rt = b.item_rating || {};
    var price = P(b.price !== undefined ? b.price : (pr.price !== undefined ? pr.price : b.price_min));
    return {
      src: 'api', itemid: itemid, shopid: shopid, name: str(name, 300),
      price: price, priceMin: P(b.price_min), priceMax: P(b.price_max), priceBefore: P(b.price_before_discount || pr.strikethrough_price),
      discount: num(b.raw_discount !== undefined ? b.raw_discount : b.discount),
      sold: num(b.historical_sold !== undefined ? b.historical_sold : sc.historical_sold_count),
      monthly: num(b.sold !== undefined ? b.sold : sc.monthly_sold_count),
      soldText: str(sc.display_sold_count_text || sc.historical_sold_count_text || '', 40),
      rating: num(rt.rating_star), ratingCount: rt.rating_count && rt.rating_count.length ? num(rt.rating_count[0]) : null,
      loc: str(b.shop_location || a.shop_location || '', 80), shop: str(b.shop_name || (o.shop_data && o.shop_data.shop_name) || '', 120),
      mall: !!(b.is_official_shop || b.show_official_shop_label || b.shop_type === 1 || (b.shopee_verified && b.is_official_shop)),
      starPlus: !!b.is_preferred_plus_seller, star: !!(b.shopee_verified || b.is_preferred_seller),
      ad: !!(o.adsid || b.adsid || o.campaignid), stock: num(b.stock), liked: num(b.liked_count),
      image: str(b.image || a.image || '', 80), brand: str(b.brand || '', 80), ctime: num(b.ctime)
    };
  }
  function walk(o, depth, out) {
    if (!o || typeof o !== 'object' || depth > 9) return;
    if (Array.isArray(o)) { for (var i = 0; i < o.length && i < 500; i++) walk(o[i], depth + 1, out); return; }
    if ((o.itemid || (o.item_basic && o.item_basic.itemid)) && (o.shopid || (o.item_basic && o.item_basic.shopid))) { var it = fromApi(o); if (it) { out.push(it); return; } }
    for (var k in o) if (o[k] && typeof o[k] === 'object') walk(o[k], depth + 1, out);
  }
  function onJson(url, data) {
    var out = []; walk(data, 0, out);
    var n = 0; out.forEach(function (it) { if (put(it)) n++; });
    if (out.length) changed('API ' + out.length + ' (' + n + ' baru)');
  }
  var WANT = /\/api\/v[24]\/(search|recommend|shop|pdp|item|homepage|flash_sale|collection)/;
  var oFetch = window.fetch;
  if (oFetch) window.fetch = function (input, init) {
    var p = oFetch.apply(this, arguments);
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (WANT.test(url)) p.then(function (r) { try { r.clone().json().then(function (j) { onJson(url, j); }, function () {}); } catch (e) { /* abaikan */ } }, function () {});
    } catch (e) { /* abaikan */ }
    return p;
  };
  var oOpen = XMLHttpRequest.prototype.open, oSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) { this.__shpUrl = String(url || ''); return oOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    var x = this;
    if (WANT.test(x.__shpUrl || '')) x.addEventListener('load', function () {
      try { var j = x.responseType === 'json' ? x.response : (x.responseType === '' || x.responseType === 'text' ? JSON.parse(x.responseText) : null); if (j) onJson(x.__shpUrl, j); } catch (e) { /* bukan JSON */ }
    });
    return oSend.apply(this, arguments);
  };
  // ---- 2) Kartu produk di DOM (hasil yang sudah tampil sebelum bookmarklet diklik).
  function parseIdr(s) { var m = String(s).match(/Rp\s?([\d.]+)/); return m ? num(m[1].replace(/\./g, '')) : null; }
  function parseSold(s) {
    var m = String(s).match(/([\d.,]+)\s*(RB|rb|Rb|jt|JT|Jt|K|k)?\+?\s*(terjual|sold)/i);
    if (!m) return null;
    var v = parseFloat(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
    var u = (m[2] || '').toLowerCase();
    return Math.round(v * (u === 'rb' || u === 'k' ? 1000 : u === 'jt' ? 1000000 : 1));
  }
  function scanDom() {
    var as = document.querySelectorAll('a[href*="-i."], a[href*="/product/"]'), n = 0, seen = {};
    for (var i = 0; i < as.length; i++) {
      var a = as[i], h = a.getAttribute('href') || '', m = h.match(/-i\.(\d+)\.(\d+)/) || h.match(/\/product\/(\d+)\/(\d+)/);
      if (!m || seen[m[1] + '.' + m[2]]) continue;
      seen[m[1] + '.' + m[2]] = 1;
      var card = a, txt = (card.innerText || '').trim();
      if (!txt || txt.length < 8) continue;
      var lines = txt.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      var name = '';
      lines.forEach(function (l) { if (!/^Rp|terjual|sold|^\d+(\.\d+)?$|^-?\d+%$|^(Mall|Star\+?|Ad|Iklan|Termurah|COD)$/i.test(l) && l.length > name.length) name = l; });
      var imgs = card.querySelectorAll('img'), alts = [];
      for (var k = 0; k < imgs.length; k++) alts.push((imgs[k].getAttribute('alt') || '') + ' ' + (imgs[k].getAttribute('src') || ''));
      var all = txt + ' ' + alts.join(' ');
      var rate = null; lines.forEach(function (l) { if (/^[1-5]([.,]\d)?$/.test(l)) rate = num(l.replace(',', '.')); });
      var loc = lines.length ? lines[lines.length - 1] : '';
      if (/Rp|terjual|sold/i.test(loc) || loc === name) loc = '';
      if (put({
        src: 'dom', itemid: num(m[2]), shopid: num(m[1]), name: str(name, 300), price: parseIdr(txt), sold: parseSold(txt), soldText: str((txt.match(/[\d.,]+\s*(RB|rb|jt)?\+?\s*terjual/i) || [''])[0], 40),
        rating: rate, loc: str(loc, 80), mall: /\bMall\b|official/i.test(all), starPlus: /Star\s?\+|Star Plus|preferred_plus/i.test(all), star: /\bStar\b|preferred/i.test(all), ad: /\b(Ad|Iklan)\b/.test(txt)
      })) n++;
    }
    if (n) changed('DOM +' + n);
    return n;
  }
  // ---- Panel
  var panel = document.createElement('div');
  Object.assign(panel.style, { position: 'fixed', right: '12px', bottom: '12px', width: '300px', background: 'linear-gradient(155deg, #221914 0%, #14100d 100%)', color: '#f3ece4', font: '12px/1.45 Segoe UI,system-ui,sans-serif', border: '2px solid #ee4d2d', borderRadius: '10px', boxShadow: '0 12px 30px rgba(0,0,0,.55)', zIndex: 2147483647, padding: '10px' });
  var head = document.createElement('div'); Object.assign(head.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' });
  var title = document.createElement('b'); title.textContent = "🛒 Shopee Hook"; head.appendChild(title);
  var x = document.createElement('button'); x.textContent = '–'; x.title = "Kecilkan"; Object.assign(x.style, { background: '#2a2019', color: '#f3ece4', border: '1px solid #453429', borderRadius: '5px', padding: '1px 7px', cursor: 'pointer' }); head.appendChild(x);
  var body = document.createElement('div');
  var cnt = document.createElement('div'); Object.assign(cnt.style, { fontSize: '13px', fontWeight: '700' });
  var info = document.createElement('div'); Object.assign(info.style, { color: '#aa9888', margin: '4px 0 8px', minHeight: '16px' });
  var row = document.createElement('div'); Object.assign(row.style, { display: 'flex', flexWrap: 'wrap', gap: '4px' });
  function btn(label, fn, tip) { var b = document.createElement('button'); b.textContent = label; if (tip) b.title = tip; Object.assign(b.style, { background: '#2a2019', color: '#f3ece4', border: '1px solid #453429', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', font: 'inherit' }); b.onclick = fn; row.appendChild(b); return b; }
  body.appendChild(cnt); body.appendChild(info); body.appendChild(row);
  panel.appendChild(head); panel.appendChild(body);
  document.body.appendChild(panel);
  try { if (window.__hookGuard) window.__hookGuard.add(panel); } catch (e) { /* abaikan */ }
  x.onclick = function () { var h = body.style.display === 'none'; body.style.display = h ? '' : 'none'; x.textContent = h ? '–' : '+'; };
  S.show = function () { panel.style.display = ''; body.style.display = ''; };
  function list() { return S.order.map(function (id) { return S.items[id]; }); }
  function clean(it) { var o = {}; for (var k in it) if (k !== 'dirty') o[k] = it[k]; return o; }
  function render() {
    cnt.textContent = "Tertangkap: " + S.order.length + " produk (API " + S.api + ", DOM " + S.dom + ") · terkirim " + S.sent;
  }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(list().map(clean))); } catch (e) { /* kuota penuh */ } }
  var tmr = 0;
  function changed(msg) { if (msg) info.textContent = msg; render(); save(); clearTimeout(tmr); tmr = setTimeout(flush, 700); }
  // ---- Kirim ke tab scanner
  var target = cfg.origin && cfg.origin !== 'null' ? cfg.origin : '*';
  function openApp() {
    if (!cfg.app) { info.textContent = "Scanner dibuka dari file lokal: pakai Salin/Unduh JSON lalu Import di tab Shopee Hook."; return; }
    try { S.w = window.open(cfg.app.split('#')[0] + '#shp-hook', 'scaShopeeHook'); } catch (e) { S.w = null; }
    if (!S.w) { info.textContent = "Popup diblokir: izinkan popup untuk shopee, lalu klik Buka tabel."; return; }
    S.ack = false; ping();
  }
  var pings = 0;
  function ping() { pings = 0; (function p() { if (S.ack || !S.w || S.w.closed || ++pings > 40) { if (!S.ack && pings > 40) info.textContent = "Tab scanner tidak merespons. Pakai Salin/Unduh JSON lalu Import."; return; } try { S.w.postMessage({ type: 'shp-hello' }, target); } catch (e) { /* belum siap */ } setTimeout(p, 400); })(); }
  function flush() {
    if (!S.w || S.w.closed || !S.ack) return;
    var batch = list().filter(function (it) { return it.dirty; });
    if (!batch.length) return;
    try { S.w.postMessage({ type: 'shp-items', items: batch.map(clean), page: location.href }, target); batch.forEach(function (it) { it.dirty = false; }); } catch (e) { info.textContent = "Gagal kirim: " + e.message; }
  }
  window.addEventListener('message', function (e) {
    if (!e.data || e.source !== S.w || (target !== '*' && e.origin !== target)) return;
    if (e.data.type === 'shp-ack') { if (!S.ack) { S.ack = true; info.textContent = "Terhubung ke tab scanner."; list().forEach(function (it) { it.dirty = true; }); } flush(); }
    if (e.data.type === 'shp-saved') { S.sent = e.data.total || S.sent; render(); }
  });
  btn("Buka tabel", openApp, "Buka/hubungkan tab scanner (tabel Shopee Hook)");
  btn("Scan ulang", function () { var n = scanDom(); info.textContent = n ? '' : "Tidak ada produk baru di halaman."; }, "Baca ulang kartu produk yang tampil");
  btn("Salin JSON", function () {
    var s = JSON.stringify({ type: 'shp-export', items: list().map(clean) });
    function fb() { var ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* abaikan */ } ta.remove(); }
    if (navigator.clipboard) navigator.clipboard.writeText(s).then(function () { info.textContent = "Tersalin ke clipboard."; }, fb); else fb();
  });
  btn("Unduh JSON", function () {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ type: 'shp-export', items: list().map(clean) })], { type: 'application/json' }));
    a.download = 'shopee-hook-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  });
  btn("Kosongkan daftar", function () { S.items = {}; S.order = []; S.api = S.dom = 0; save(); render(); info.textContent = "Daftar di tab ini dikosongkan (data di scanner tetap)."; });
  btn("Tutup", function () { panel.style.display = 'none'; }, "Sembunyikan panel (hook tetap berjalan)");
  // Lanjutan setelah reload halaman di tab yang sama.
  try { (JSON.parse(sessionStorage.getItem(KEY) || '[]') || []).forEach(function (it) { if (it && it.id && !S.items[it.id]) { S.items[it.id] = it; S.order.push(it.id); if (it.src === 'api') S.api++; else S.dom++; } }); } catch (e) { /* abaikan */ }
  var mo = new MutationObserver(function () { clearTimeout(S.mt); S.mt = setTimeout(scanDom, 800); });
  mo.observe(document.body, { childList: true, subtree: true });
  render(); scanDom();
  info.textContent = "Hook aktif. Scroll / pindah halaman hasil pencarian; produk yang tampil ikut tercatat.";
  openApp();
}
// ---- Shopee Hook: penyimpanan (IndexedDB scanner) + penilaian kepercayaan
const SHP_DB = 'scaShopee', SHP_STORE = 'items';
const SHP_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*shopee\.(co\.id|com|sg|com\.my|co\.th|ph|vn|tw|com\.br|com\.mx|cl|com\.co)$/;
function shpOpen() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB')); return; }
    const r = indexedDB.open(SHP_DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(SHP_STORE, { keyPath: 'id' }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function shpTx(mode, work) {
  return shpOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SHP_STORE, mode), st = tx.objectStore(SHP_STORE);
    let out;
    work(st, v => { out = v; });
    tx.oncomplete = () => { db.close(); resolve(out); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}
function shpAll() { return shpTx('readonly', (st, set) => { const q = st.getAll(); q.onsuccess = () => set(q.result || []); }); }
function shpClear(ids) { return shpTx('readwrite', st => { if (ids) ids.forEach(id => st.delete(id)); else st.clear(); }); }
// Data dari tab lain tidak tepercaya: ambil field yang dikenal saja, tipe dipaksa.
function shpClean(it) {
  if (!it || typeof it !== 'object') return null;
  const n = v => (typeof v === 'number' && isFinite(v) ? v : (v === null || v === undefined || v === '' ? null : (isFinite(+v) ? +v : null)));
  const s = (v, m) => (v === null || v === undefined ? '' : String(v).slice(0, m));
  const shopid = n(it.shopid), itemid = n(it.itemid);
  if (!shopid || !itemid || !it.name) return null;
  return {
    id: shopid + '.' + itemid, shopid, itemid, src: it.src === 'api' ? 'api' : 'dom', name: s(it.name, 300), q: s(it.q, 120),
    price: n(it.price), priceMin: n(it.priceMin), priceMax: n(it.priceMax), priceBefore: n(it.priceBefore), discount: n(it.discount),
    sold: n(it.sold), monthly: n(it.monthly), soldText: s(it.soldText, 40), rating: n(it.rating), ratingCount: n(it.ratingCount),
    loc: s(it.loc, 80), shop: s(it.shop, 120), mall: !!it.mall, starPlus: !!it.starPlus, star: !!it.star, ad: !!it.ad,
    stock: n(it.stock), liked: n(it.liked), image: /^[\w-]{10,80}$/.test(String(it.image || '')) ? String(it.image) : '', brand: s(it.brand, 80),
    host: /^[a-z0-9.-]+$/.test(String(it.host || '')) ? String(it.host) : 'shopee.co.id', seen: n(it.seen) || Date.now()
  };
}
function shpMerge(old, it) {
  if (!old) { it.first = it.seen; it.hist = it.price ? [[it.seen, it.price]] : []; return it; }
  const out = Object.assign({}, old);
  Object.keys(it).forEach(k => { if (it[k] !== null && it[k] !== '' && !(old.src === 'api' && it.src === 'dom' && k !== 'seen' && k !== 'q')) out[k] = it[k]; });
  out.first = old.first || old.seen; out.hist = (old.hist || []).slice(-30);
  if (out.price && (!out.hist.length || out.hist[out.hist.length - 1][1] !== out.price)) out.hist.push([it.seen, out.price]);
  if (old.q && it.q && old.q.indexOf(it.q) < 0) out.q = (old.q + ', ' + it.q).slice(0, 200);
  return out;
}
function shpPutMany(list) {
  return shpTx('readwrite', st => {
    list.forEach(it => { const g = st.get(it.id); g.onsuccess = () => { st.put(shpMerge(g.result, it)); }; });
  });
}
function shpMedian(a) { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
// Skor 0-100 + catatan. med = median harga untuk kata kunci yang sama.
function shpAssess(it, med) {
  let sc = 40;
  const notes = [];
  const add = (v, k) => { sc += v; notes.push({ v, k }); };
  if (it.mall) add(30, 'shp_n_mall');
  else if (it.starPlus) add(20, 'shp_n_starplus');
  else if (it.star) add(12, 'shp_n_star');
  const sold = it.sold || 0;
  if (sold >= 5000) add(25, 'shp_n_sold5k'); else if (sold >= 1000) add(20, 'shp_n_sold1k'); else if (sold >= 500) add(15, 'shp_n_sold500');
  else if (sold >= 100) add(6, 'shp_n_sold100'); else if (it.sold !== null && it.sold !== undefined && sold < 10) add(-10, 'shp_n_soldlow');
  if (it.rating) {
    if (it.rating >= 4.8 && (it.ratingCount || 0) >= 50) add(15, 'shp_n_rate_hi');
    else if (it.rating >= 4.5) add(8, 'shp_n_rate_ok');
    else if (it.rating < 4.3) add(-15, 'shp_n_rate_lo');
  } else add(-5, 'shp_n_rate_none');
  if (med && it.price) {
    if (it.price < med * 0.5) add(-25, 'shp_n_cheap');
    else if (it.price < med * 0.7) add(-10, 'shp_n_cheapish');
  }
  if (/luar negeri|overseas|china|tiongkok/i.test(it.loc || '')) add(-5, 'shp_n_abroad');
  if ((it.discount || 0) >= 70) add(-5, 'shp_n_disc');
  if (it.ad) add(0, 'shp_n_ad');
  sc = Math.max(0, Math.min(100, sc));
  return { score: sc, level: sc >= 75 ? 'ok' : sc >= 50 ? 'mid' : 'bad', notes };
}

const SHP_I18N = {
  id: {
    tab_shop: 'Shopee Hook', shp_title: 'Shopee Hook — catat produk saat menjelajah Shopee',
    shp_intro: 'Bookmarklet di tab Shopee mencatat produk yang tampil saat Anda menjelajah manual (hasil pencarian, halaman berikutnya, toko): nama, harga, terjual, rating, Mall/Star, lokasi. Data diambil dari respons yang sudah dimuat browser Anda sendiri (tanpa memanggil API Shopee), dikirim ke tab ini, disimpan di IndexedDB browser ini, lalu bisa dicari, difilter, dan diurutkan.',
    shp_step1: 'Seret tombol 🛒 Shopee Hook ke bookmark bar.',
    shp_step2: 'Buka Shopee (mis. cari "baterai lxt", urutkan Terlaris), lalu klik bookmark itu. Izinkan popup bila diminta: tab tabel ini terbuka dan terhubung.',
    shp_step3: 'Scroll dan pindah halaman seperti biasa; setiap produk yang tampil langsung masuk tabel di bawah.',
    shp_import: 'Import JSON', shp_reload: 'Muat ulang', shp_del_all: 'Hapus semua', shp_del_shown: 'Hapus yang tampil',
    shp_del_confirm: 'Hapus {n} produk dari tabel?', shp_paste_t: 'Paste JSON (dari tombol Salin JSON di panel Shopee)', shp_paste_ph: 'Paste JSON di sini',
    shp_bad_json: 'JSON tidak berisi data produk Shopee Hook.', shp_got: '{n} produk diterima.',
    shp_search_ph: 'Cari nama, toko, lokasi, merek, saran ... (beberapa kata = semua harus cocok)',
    shp_all_kw: 'Semua kata kunci', shp_all_level: 'Semua penilaian', shp_l_ok: 'Aman', shp_l_mid: 'Cukup', shp_l_bad: 'Hati-hati',
    shp_no_ad: 'Tanpa iklan', shp_min_sold: 'Min terjual', shp_min_rate: 'Min rating', shp_shown: '{n} dari {t} produk',
    shp_c_name: 'Produk', shp_c_price: 'Harga', shp_c_sold: 'Terjual', shp_c_shop: 'Toko', shp_c_loc: 'Lokasi', shp_c_score: 'Skor', shp_c_tips: 'Saran', shp_c_kw: 'Kata kunci', shp_c_seen: 'Dilihat',
    shp_score_tip: 'Perkiraan kepercayaan 0-100 dari status toko, jumlah terjual, rating, dan harga dibanding median kata kunci yang sama. Arahkan mouse ke skor untuk rinciannya.',
    shp_ad: 'iklan', shp_hist: '{n} perubahan harga', shp_empty: 'Belum ada produk. Jalankan bookmarklet di tab Shopee.',
    shp_note: 'Penilaian hanya perkiraan dari data yang terlihat, bukan jaminan. Data tersimpan di browser ini saja. Hormati syarat layanan Shopee: dipakai untuk riset pribadi, jangan disebar ulang.',
    shp_n_mall: 'Shopee Mall (toko resmi)', shp_n_starplus: 'Star+ seller', shp_n_star: 'Star seller',
    shp_n_sold5k: 'terjual 5.000+ (sangat laris)', shp_n_sold1k: 'terjual 1.000+', shp_n_sold500: 'terjual 500+ (aman)', shp_n_sold100: 'terjual 100+', shp_n_soldlow: 'baru sedikit terjual',
    shp_n_rate_hi: 'rating 4.8+ dari banyak ulasan', shp_n_rate_ok: 'rating 4.5+', shp_n_rate_lo: 'rating di bawah 4.3', shp_n_rate_none: 'belum ada rating',
    shp_n_cheap: 'harga < 50% median (rawan palsu/KW)', shp_n_cheapish: 'harga jauh di bawah median', shp_n_abroad: 'dikirim dari luar negeri (lama)', shp_n_disc: 'diskon 70%+ (cek harga asli)', shp_n_ad: 'produk iklan',
    grp_shop_title: 'Shopee Hook', grp_shop_desc: 'Tidak memanggil API Shopee: data dari halaman Shopee yang Anda buka sendiri.'
  },
  en: {
    tab_shop: 'Shopee Hook', shp_title: 'Shopee Hook — log products while browsing Shopee',
    shp_intro: 'A bookmarklet on the Shopee tab logs the products shown while you browse manually (search results, next pages, shops): name, price, sold, rating, Mall/Star, location. Data comes from responses your own browser already loaded (no calls to the Shopee API), is sent to this tab, stored in this browser (IndexedDB), and can be searched, filtered and sorted.',
    shp_step1: 'Drag the 🛒 Shopee Hook button to the bookmarks bar.',
    shp_step2: 'Open Shopee (e.g. search "baterai lxt", sort by Top Sales) and click the bookmark. Allow popups if asked: this table tab opens and connects.',
    shp_step3: 'Scroll and change pages as usual; every product shown goes straight into the table below.',
    shp_import: 'Import JSON', shp_reload: 'Reload', shp_del_all: 'Delete all', shp_del_shown: 'Delete shown',
    shp_del_confirm: 'Delete {n} products from the table?', shp_paste_t: 'Paste JSON (from the Copy JSON button on the Shopee panel)', shp_paste_ph: 'Paste JSON here',
    shp_bad_json: 'The JSON contains no Shopee Hook product data.', shp_got: '{n} products received.',
    shp_search_ph: 'Search name, shop, location, brand, notes ... (several words = all must match)',
    shp_all_kw: 'All keywords', shp_all_level: 'All ratings', shp_l_ok: 'Safe', shp_l_mid: 'Fair', shp_l_bad: 'Caution',
    shp_no_ad: 'No ads', shp_min_sold: 'Min sold', shp_min_rate: 'Min rating', shp_shown: '{n} of {t} products',
    shp_c_name: 'Product', shp_c_price: 'Price', shp_c_sold: 'Sold', shp_c_shop: 'Shop', shp_c_loc: 'Location', shp_c_score: 'Score', shp_c_tips: 'Notes', shp_c_kw: 'Keyword', shp_c_seen: 'Seen',
    shp_score_tip: 'Rough trust estimate 0-100 from shop status, units sold, rating and price versus the median for the same keyword. Hover the score for details.',
    shp_ad: 'ad', shp_hist: '{n} price changes', shp_empty: 'No products yet. Run the bookmarklet on a Shopee tab.',
    shp_note: 'The rating is only an estimate from visible data, not a guarantee. Data stays in this browser. Respect the Shopee terms of service: personal research only, do not republish.',
    shp_n_mall: 'Shopee Mall (official store)', shp_n_starplus: 'Star+ seller', shp_n_star: 'Star seller',
    shp_n_sold5k: '5,000+ sold (best seller)', shp_n_sold1k: '1,000+ sold', shp_n_sold500: '500+ sold (safe)', shp_n_sold100: '100+ sold', shp_n_soldlow: 'few sales so far',
    shp_n_rate_hi: 'rating 4.8+ from many reviews', shp_n_rate_ok: 'rating 4.5+', shp_n_rate_lo: 'rating below 4.3', shp_n_rate_none: 'no rating yet',
    shp_n_cheap: 'price < 50% of median (possible fake)', shp_n_cheapish: 'price well below median', shp_n_abroad: 'ships from abroad (slow)', shp_n_disc: '70%+ discount (check the real price)', shp_n_ad: 'sponsored product',
    grp_shop_title: 'Shopee Hook', grp_shop_desc: 'Does not call the Shopee API: data comes from the Shopee pages you open yourself.'
  }
};
Object.keys(SHP_I18N).forEach(l => { I18N[l] = Object.assign({}, SHP_I18N[l], I18N[l] || {}); });

// ============================================================
//  WA Hook: bookmarklet / skrip console di tab web.whatsapp.com.
//  Mengumpulkan pesan yang terlihat di DOM saat user membuka chat & melakukan scroll
//  (teks, pengirim, waktu, balasan kutipan, link URL, serta nama/ukuran file dokumen),
//  lalu mengirimnya via postMessage ke tab scanner untuk disimpan di IndexedDB.
//  Mandiri, ES5, tanpa innerHTML/eval/RegExp.exec agar aman terhadap CSP & Trusted Types.
// ============================================================
function waHookMain(cfg) {
  var prev = window.__waHook;
  if (prev && prev.destroy) { try { prev.destroy(); } catch (e) { /* abaikan */ } }
  else if (prev) {
    try { if (prev.auto) clearInterval(prev.auto); } catch (e) { /* abaikan */ }
    var oldBs = document.querySelectorAll('b');
    for (var bi = 0; bi < oldBs.length; bi++) {
      if (oldBs[bi].textContent === '💬 WA Hook' && oldBs[bi].parentElement && oldBs[bi].parentElement.parentElement) {
        try { oldBs[bi].parentElement.parentElement.remove(); } catch (e) { /* abaikan */ }
      }
    }
  }
  var S = window.__waHook = {
    items: (prev && prev.items) || {},
    order: (prev && prev.order) || [],
    chats: {},
    links: 0,
    docs: 0,
    sent: (prev && prev.sent) || 0,
    w: (prev && prev.w && !prev.w.closed) ? prev.w : null,
    ack: !!(prev && prev.w && !prev.w.closed && prev.ack),
    st: 0, mt: 0, auto: 0
  };
  var KEY = '__waHookItems';
  function now() { return Date.now(); }
  function stripMarks(s) { return String(s === null || s === undefined ? '' : s).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ''); }
  function str(v, max) { return stripMarks(v).trim().slice(0, max || 4000); }
  function fnv(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul ? Math.imul(h, 16777619) : (h * 16777619) | 0; }
    return (h >>> 0).toString(16);
  }
  function readText(el, skipEl) {
    if (!el || el === skipEl) return '';
    var out = '';
    var ch = el.childNodes;
    for (var i = 0; i < ch.length; i++) {
      var n = ch[i];
      if (n === skipEl) continue;
      if (n.nodeType === 3) out += n.nodeValue || '';
      else if (n.nodeType === 1) {
        var tag = (n.tagName || '').toUpperCase();
        if (tag === 'BR') out += '\n';
        else if (tag === 'IMG') out += n.getAttribute('alt') || '';
        else if (tag === 'DIV' || tag === 'P' || tag === 'LI') {
          var sub = readText(n, skipEl);
          if (sub) out += (out && out.charAt(out.length - 1) !== '\n' ? '\n' : '') + sub + '\n';
        } else out += readText(n, skipEl);
      }
    }
    return stripMarks(out);
  }
  function leafLines(el, skipEl) {
    var out = [];
    if (!el || el === skipEl) return out;
    var nodes = el.querySelectorAll('span, div, p, a');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if ((skipEl && skipEl.contains(n)) || (n.closest && n.closest('[aria-hidden=true]'))) continue;
      if (n.children && n.children.length > 0) continue;
      var t = str(n.textContent, 1000);
      if (t && out.indexOf(t) < 0) out.push(t);
    }
    return out;
  }
  function findMain() {
    var m = document.querySelector('#main') || document.querySelector('[data-testid=conversation-panel-wrapper]');
    if (m) return m;
    var boxes = document.querySelectorAll('div[contenteditable=true][data-lexical-editor=true], footer div[contenteditable=true]');
    var side = document.querySelector('#side') || document.querySelector('#pane-side');
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (side && side.contains(b)) continue;
      var p = b.parentElement;
      while (p && p !== document.body) {
        if (side && p.contains(side)) break;
        if (p.querySelector('header') || p.clientHeight > 300) { m = p; }
        p = p.parentElement;
      }
      if (m) return m;
    }
    return null;
  }
  function isStatusSub(t) {
    return /^(online|mengetik|sedang mengetik|typing|recording|merekam|last seen|terakhir dilihat|klik di sini|ketuk di sini|click here|tap here|pilih pesan|select messages|business account|akun bisnis|cari|search|menu|panggilan|call|video|\d{1,2}[.:]\d{2})/i.test(t);
  }
  function chatName(main) {
    main = main || findMain();
    if (!main) return '';
    var hd = main.querySelector('header') || main.querySelector('[data-testid=conversation-header]');
    if (!hd) {
      var ch = main.children;
      for (var ci = 0; ci < ch.length; ci++) {
        if (ch[ci].clientHeight > 30 && ch[ci].clientHeight < 110) { hd = ch[ci]; break; }
      }
    }
    if (hd) {
      var t0 = hd.querySelector('[data-testid=conversation-info-header-chat-title]');
      if (t0) { var v0 = str(t0.textContent, 140); if (v0 && !isStatusSub(v0)) return v0; }
      var cands = hd.querySelectorAll('div[role=button] span, span[title], span[dir=auto], h1, h2, span');
      for (var i = 0; i < cands.length; i++) {
        var el = cands[i];
        var ttl = str(el.getAttribute('title'), 140);
        if (ttl && !isStatusSub(ttl) && ttl.length >= 2) return ttl;
        if (el.querySelector && el.querySelector('span')) continue;
        var v = str(el.textContent, 140);
        if (v && v.length >= 2 && !isStatusSub(v) && !/^[\W_]+$/.test(v)) return v;
      }
    }
    var sel = document.querySelector('#pane-side [aria-selected=true] span[title], #pane-side [aria-selected=true] span');
    if (sel) {
      var sv = str(sel.getAttribute('title') || sel.textContent, 140);
      if (sv && !isStatusSub(sv)) return sv;
    }
    return 'Chat WhatsApp';
  }
  function p2(n) { return n < 10 ? '0' + n : String(n); }
  function parseDatePart(dm) {
    var a = parseInt(dm[1], 10), b = parseInt(dm[2], 10), c = parseInt(dm[3], 10);
    var y, mo, d;
    if (a > 1900) { y = a; mo = b; d = c; }
    else {
      y = c < 100 ? 2000 + c : c;
      if (a > 12) { d = a; mo = b; }
      else if (b > 12) { mo = a; d = b; }
      else if (/^en-US/i.test((document.documentElement && document.documentElement.lang) || navigator.language || '')) { mo = a; d = b; }
      else { d = a; mo = b; }
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    // Penjagaan anti masa depan: tanggal pesan chat tidak mungkin di masa depan
    var nowMs = Date.now() + 43200000;
    var dt = new Date(y, mo - 1, d);
    if (dt.getTime() > nowMs) {
      if (d <= 12 && mo <= 31) {
        var alt = new Date(y, d - 1, mo);
        if (alt.getTime() <= nowMs) {
          var tmp = mo; mo = d; d = tmp;
        }
      }
    }
    if (new Date(y, mo - 1, d).getTime() > nowMs) return null;
    return [y, mo, d];
  }
  function parseTimePart(tm) {
    var h = parseInt(tm[1], 10), mi = parseInt(tm[2], 10), sc = tm[3] ? parseInt(tm[3], 10) : 0;
    var ap = (tm[4] || '').toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
    return [h, mi, sc];
  }
  function parsePrePlain(pre) {
    var s = stripMarks(pre).trim();
    var m = s.match(/^\[([^\]]+)\]\s*(.*?):?\s*$/);
    if (!m) return null;
    var meta = m[1], sender = str(m[2], 120).replace(/:$/, '').trim();
    var tm = meta.match(/(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?\s*(AM|PM|am|pm)?/);
    var dm = meta.match(/(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    var ymd = dm ? parseDatePart(dm) : null;
    var hms = tm ? parseTimePart(tm) : null;
    var ts = null, timeText = meta.trim();
    if (ymd && hms) {
      var dt = new Date(ymd[0], ymd[1] - 1, ymd[2], hms[0], hms[1], hms[2]);
      if (!isNaN(dt.getTime())) {
        var nowMs = Date.now() + 43200000;
        if (dt.getTime() > nowMs && ymd[2] <= 12 && ymd[1] <= 31) {
          var alt = new Date(ymd[0], ymd[2] - 1, ymd[1], hms[0], hms[1], hms[2]);
          if (alt.getTime() <= nowMs) {
            ymd = [ymd[0], ymd[2], ymd[1]];
            dt = alt;
          }
        }
        if (dt.getTime() <= nowMs) {
          ts = dt.getTime();
          timeText = ymd[0] + '-' + p2(ymd[1]) + '-' + p2(ymd[2]) + ' ' + p2(hms[0]) + ':' + p2(hms[1]);
        }
      }
    }
    return { sender: sender, ts: ts, timeText: timeText, ymd: ymd };
  }
  var DOW_MAP = { minggu: 0, ahad: 0, sunday: 0, senin: 1, monday: 1, selasa: 2, tuesday: 2, rabu: 3, wednesday: 3, kamis: 4, thursday: 4, jumat: 5, 'jum\'at': 5, friday: 5, sabtu: 6, saturday: 6 };
  var MON_MAP = { jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, agt: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12 };
  function parsePillYmd(txt) {
    var s = str(txt, 60).toLowerCase();
    if (!s || s.length > 40) return null;
    if (s === 'hari ini' || s === 'today') { var d0 = new Date(); return [d0.getFullYear(), d0.getMonth() + 1, d0.getDate()]; }
    if (s === 'kemarin' || s === 'yesterday') { var d1 = new Date(Date.now() - 86400000); return [d1.getFullYear(), d1.getMonth() + 1, d1.getDate()]; }
    if (DOW_MAP[s] !== undefined) {
      var nowD = new Date(), diff = (nowD.getDay() - DOW_MAP[s] + 7) % 7;
      if (diff === 0) diff = 7;
      var wd = new Date(Date.now() - diff * 86400000);
      return [wd.getFullYear(), wd.getMonth() + 1, wd.getDate()];
    }
    var dm = s.match(/^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (dm) return parseDatePart(dm);
    var mm = s.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/) || s.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (mm) {
      var isDayFirst = /^\d/.test(mm[1]);
      var day = parseInt(isDayFirst ? mm[1] : mm[2], 10);
      var mon = MON_MAP[isDayFirst ? mm[2] : mm[1]];
      var yr = parseInt(mm[3], 10);
      if (mon && day >= 1 && day <= 31) return [yr, mon, day];
    }
    return null;
  }
  function recalcStats() {
    var ch = {}, lk = 0, dc = 0;
    S.order.forEach(function (id) {
      var it = S.items[id];
      if (!it) return;
      if (it.chat) ch[it.chat] = 1;
      if (it.links && it.links.length) lk++;
      if (it.docs && it.docs.length) dc++;
    });
    S.chats = ch; S.links = lk; S.docs = dc;
  }
  function unionStr(a, b, maxItems) {
    var out = (a || []).slice(), seen = {};
    out.forEach(function (x) { seen[x] = 1; });
    (b || []).forEach(function (x) { if (x && !seen[x] && out.length < (maxItems || 20)) { seen[x] = 1; out.push(x); } });
    return out;
  }
  function put(it) {
    if (!it || !it.id) return false;
    var old = S.items[it.id];
    if (old) {
      var mod = false;
      if (it.text && (!old.text || it.text.length > old.text.length)) { old.text = it.text; mod = true; }
      if (it.quote && !old.quote) { old.quote = it.quote; mod = true; }
      if (it.ts && !old.ts) { old.ts = it.ts; old.timeText = it.timeText || old.timeText; mod = true; }
      if (it.chat && old.chat === 'Chat WhatsApp' && it.chat !== 'Chat WhatsApp') { old.chat = it.chat; mod = true; }
      if (it.sender && (!old.sender || old.sender === old.chat)) { old.sender = it.sender; mod = true; }
      if (it.media && !old.media) { old.media = it.media; mod = true; }
      var nl = unionStr(old.links, it.links, 30);
      if (nl.length !== (old.links || []).length) { old.links = nl; mod = true; }
      var nd = unionStr(old.docs, it.docs, 12);
      if (nd.length !== (old.docs || []).length) { old.docs = nd; mod = true; }
      if (mod) old.dirty = true;
      return false;
    }
    it.dirty = true;
    S.items[it.id] = it;
    S.order.push(it.id);
    return true;
  }
  function inChrome(el) {
    return !!(el && el.closest && el.closest('header, footer, [data-wa-hook]'));
  }
  function isListBox(el, main) {
    if (!el || el === main || el === document.body) return true;
    if (/^(application|grid|list|region)$/i.test(el.getAttribute('role') || '')) return true;
    if (el.querySelectorAll('div[role=row], .message-in, .message-out, [data-pre-plain-text]').length > 1) return true;
    return false;
  }
  function findScrollPane(main) {
    main = main || findMain();
    if (!main) return null;
    var sample = main.querySelector('[data-pre-plain-text], span[data-lexical-text=true], .selectable-text, [data-id], div[role=row], .message-in, .message-out');
    var el = sample ? sample.parentElement : null;
    while (el && el !== main && el !== document.body) {
      if (!inChrome(el) && el.scrollHeight > el.clientHeight + 10) {
        var oy = (window.getComputedStyle(el).overflowY || '');
        if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') return el;
      }
      el = el.parentElement;
    }
    var best = null, bestH = 0;
    var divs = main.querySelectorAll('div');
    for (var i = 0; i < divs.length; i++) {
      var d = divs[i];
      if (inChrome(d)) continue;
      if (d.scrollHeight > d.clientHeight + 20 && /(auto|scroll|overlay)/.test(window.getComputedStyle(d).overflowY || '')) {
        if (d.scrollHeight > bestH) { best = d; bestH = d.scrollHeight; }
      }
    }
    return best;
  }
  function collectRows(main) {
    var rows = [];
    function addCand(el) {
      if (!el || el === main || inChrome(el) || isListBox(el, main)) return;
      for (var k = 0; k < rows.length; k++) {
        if (rows[k] === el || rows[k].contains(el) || el.contains(rows[k])) return;
      }
      rows.push(el);
    }
    var g1 = main.querySelectorAll('div[role=row], div[role=listitem]');
    for (var i1 = 0; i1 < g1.length; i1++) {
      if (!g1[i1].querySelector('div[role=row], div[role=listitem]')) addCand(g1[i1]);
    }
    var g2 = main.querySelectorAll('.message-in, .message-out, [data-testid=msg-container]');
    for (var i2 = 0; i2 < g2.length; i2++) addCand(g2[i2]);
    var g3 = main.querySelectorAll('[data-id]');
    for (var i3 = 0; i3 < g3.length; i3++) {
      var dEl = g3[i3];
      if (dEl.closest && dEl.closest('[data-testid=quoted-message], .quoted-mention')) continue;
      addCand(dEl);
    }
    var g4 = main.querySelectorAll('[data-pre-plain-text], .copyable-text, .selectable-text');
    for (var i4 = 0; i4 < g4.length; i4++) {
      var b = g4[i4];
      if (b.closest && b.closest('[data-testid=quoted-message], .quoted-mention')) continue;
      if (b.parentElement && !isListBox(b.parentElement, main)) b = b.parentElement;
      if (b.parentElement && !isListBox(b.parentElement, main)) b = b.parentElement;
      addCand(b);
    }
    if (!rows.length) {
      var pane = findScrollPane(main);
      if (pane) {
        var feed = pane;
        var guard = 0;
        while (feed.children && feed.children.length === 1 && guard++ < 5) feed = feed.children[0];
        var kids = feed.children || [];
        for (var i5 = 0; i5 < kids.length; i5++) addCand(kids[i5]);
      }
    }
    rows.sort(function (a, b) { return (a.compareDocumentPosition(b) & 4) ? -1 : 1; });
    return rows;
  }
  var DOC_EXT = /\.(pdf|docx?|xlsx?|csv|pptx?|odt|ods|rtf|zip|rar|7z|tar|gz|txt|json|xml|yaml|yml|sql|log|apk|exe|msi|dmg)$/i;
  var DOC_INLINE = /[^\n\r\t<>:\x22/\\|?*]{1,160}\.(pdf|docx?|xlsx?|csv|pptx?|odt|ods|rtf|zip|rar|7z|tar|gz|txt|json|xml|yaml|yml|sql|log|apk|exe|msi|dmg)\b/ig;
  var META_RE = /\b(\d+(?:[.,]\d+)?\s*(?:B|KB|MB|GB|kB))\s*[·•\-]\s*([A-Za-z0-9]{2,8})\b/;
  var SYS_RE = /^(pesan dan panggilan terenkripsi secara end-to-end|messages and calls are end-to-end encrypted|gunakan whatsapp di telepon anda|use whatsapp on your phone)/i;
  var BADGE_RE = /^(iteruskan|diteruskan|forwarded|diedit|edited)$/i;
  function scanDom() {
    var main = findMain();
    if (!main) return 0;
    var chat = chatName(main);
    var mainRect = main.getBoundingClientRect ? main.getBoundingClientRect() : null;
    var curYmd = null;
    var allSpans = main.querySelectorAll('span, div[role=button]');
    for (var pi = 0; pi < allSpans.length && pi < 400; pi++) {
      if (inChrome(allSpans[pi])) continue;
      if (allSpans[pi].children && allSpans[pi].children.length > 0) continue;
      var py = parsePillYmd(allSpans[pi].textContent);
      if (py) { curYmd = py; break; }
    }
    var rows = collectRows(main);
    var added = 0;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rawRowSimple = str(row.textContent, 80);
      var rowPill = parsePillYmd(rawRowSimple);
      if (rowPill && rawRowSimple.length <= 35 && !row.querySelector('[data-pre-plain-text], a[href], img[src^=\x22blob:\x22], video, audio')) {
        curYmd = rowPill;
        continue;
      }
      var qEl = row.querySelector('[data-testid=quoted-message], .quoted-mention, [aria-label*=Quoted], [aria-label*=dikutip]');
      var idHolder = null;
      if (row.getAttribute('data-id') && !isListBox(row, main)) idHolder = row;
      else if (row.closest) {
        var ancId = row.closest('[data-id]');
        if (ancId && main.contains(ancId) && !isListBox(ancId, main) && !(rows.length > 1 && ancId.contains(rows[0]) && ancId.contains(rows[rows.length - 1]))) idHolder = ancId;
      }
      if (!idHolder) {
        var subIds = row.querySelectorAll('[data-id]');
        for (var idi0 = 0; idi0 < subIds.length; idi0++) {
          if (!qEl || !qEl.contains(subIds[idi0])) { idHolder = subIds[idi0]; break; }
        }
      }
      var rawId = idHolder ? str(idHolder.getAttribute('data-id') || '', 180) : '';
      var dir = '';
      if (/^true_/.test(rawId) || row.classList.contains('message-out') || (row.closest && row.closest('.message-out')) || row.querySelector('.message-out')) dir = 'out';
      else if (/^false_/.test(rawId) || row.classList.contains('message-in') || (row.closest && row.closest('.message-in')) || row.querySelector('.message-in')) dir = 'in';
      else if (row.querySelector('[data-icon^=msg-check], [data-icon^=msg-dblcheck], [data-icon^=msg-time], [aria-label*=Dibaca], [aria-label*=Terkirim], [aria-label*=Read], [aria-label*=Delivered]')) dir = 'out';
      else if (mainRect && mainRect.width > 200) {
        var bub = row.querySelector('[data-pre-plain-text], .copyable-text, .selectable-text, span[data-lexical-text=true], span[dir=ltr], span[dir=rtl]') || row.firstElementChild || row;
        var br = bub.getBoundingClientRect ? bub.getBoundingClientRect() : null;
        if (br && br.width > 0 && br.width < mainRect.width * 0.92) {
          dir = (br.left - mainRect.left) > (mainRect.right - br.right + 16) ? 'out' : 'in';
        }
      }
      if (!dir) dir = 'in';
      var isGroup = rawId.indexOf('@g.us') >= 0;
      var quote = qEl ? str(readText(qEl, null).replace(/\s+/g, ' '), 240) : '';
      var cp = row.querySelector('[data-pre-plain-text]') || (row.hasAttribute && row.hasAttribute('data-pre-plain-text') ? row : null);
      var pp = cp ? parsePrePlain(cp.getAttribute('data-pre-plain-text')) : null;
      if (pp && pp.ymd) curYmd = pp.ymd;
      var sender = pp && pp.sender ? pp.sender : '';
      var ts = pp ? pp.ts : null;
      var timeText = pp ? pp.timeText : '';
      if (!sender) {
        if (dir === 'out') sender = 'Saya';
        else {
          var au = row.querySelector('span[dir=auto][aria-label], div[role=button] span[dir=auto]');
          if (au && (!qEl || !qEl.contains(au)) && (!cp || !cp.contains(au))) {
            var candSender = str(au.getAttribute('aria-label') || au.textContent, 120).replace(/:$/, '');
            if (candSender && candSender.length <= 60) { sender = candSender; if (candSender !== chat) isGroup = true; }
          }
          if (!sender && !isGroup) sender = chat;
        }
      } else if (dir === 'in' && sender !== chat) {
        isGroup = true;
      }
      if (!ts) {
        var sp = row.querySelectorAll('span');
        for (var si = sp.length - 1; si >= 0; si--) {
          var stx = str(sp[si].textContent, 20);
          var tm = stx.match(/^(\d{1,2})[.:](\d{2})\s*(AM|PM|am|pm)?$/);
          if (tm) {
            timeText = stx;
            var hms = parseTimePart(tm);
            if (hms && curYmd) {
              var dt = new Date(curYmd[0], curYmd[1] - 1, curYmd[2], hms[0], hms[1], 0);
              var nowMs = Date.now() + 43200000;
              if (dt.getTime() > nowMs && curYmd[2] <= 12 && curYmd[1] <= 31) {
                var alt = new Date(curYmd[0], curYmd[2] - 1, curYmd[1], hms[0], hms[1], 0);
                if (alt.getTime() <= nowMs) dt = alt;
              }
              if (dt.getTime() <= nowMs && !isNaN(dt.getTime())) {
                ts = dt.getTime();
                timeText = curYmd[0] + '-' + p2(curYmd[1]) + '-' + p2(curYmd[2]) + ' ' + p2(hms[0]) + ':' + p2(hms[1]);
              }
            }
            break;
          }
        }
      }
      var hasDocCard = !!row.querySelector('[data-icon*=document], [data-icon*=doc-], [data-testid*=document], [aria-label*=Download], [aria-label*=Unduh]');
      var rawRowText = str(readText(row, qEl), 2000);
      var metaHit = rawRowText.match(META_RE);
      // Teks utama pesan (di luar kutipan): 5 lapis agar tahan segala variasi DOM WhatsApp Web
      var textParts = [];
      var selScope = cp || row;
      var sels = selScope.querySelectorAll('.selectable-text');
      for (var ti = 0; ti < sels.length; ti++) {
        var stEl = sels[ti];
        if (qEl && qEl.contains(stEl)) continue;
        if (stEl.parentElement && stEl.parentElement.closest && stEl.parentElement.closest('.selectable-text') && selScope.contains(stEl.parentElement.closest('.selectable-text'))) continue;
        var piece = str(readText(stEl, qEl), 4000);
        if (piece && textParts.indexOf(piece) < 0) textParts.push(piece);
      }
      if (!textParts.length && cp) {
        var cpTxt = str(readText(cp, qEl), 4000);
        if (cpTxt) textParts.push(cpTxt);
      }
      if (!textParts.length) {
        var lex = row.querySelectorAll('span[data-lexical-text=true]');
        var lexParents = [];
        for (var lxi = 0; lxi < lex.length; lxi++) {
          if (qEl && qEl.contains(lex[lxi])) continue;
          var lp = lex[lxi].parentElement || lex[lxi];
          if (lp.tagName === 'A' && lp.parentElement && row.contains(lp.parentElement) && lp.parentElement !== row) lp = lp.parentElement;
          var covered = false;
          for (var lpk = lexParents.length - 1; lpk >= 0; lpk--) {
            if (lexParents[lpk] === lp || lexParents[lpk].contains(lp)) { covered = true; break; }
            if (lp.contains(lexParents[lpk])) lexParents.splice(lpk, 1);
          }
          if (!covered) lexParents.push(lp);
        }
        for (var lpi = 0; lpi < lexParents.length; lpi++) {
          var ltxt = str(readText(lexParents[lpi], qEl), 4000);
          if (ltxt && textParts.indexOf(ltxt) < 0) textParts.push(ltxt);
        }
      }
      if (!textParts.length) {
        var bidi = row.querySelectorAll('span[dir=ltr], span[dir=rtl], div[dir=ltr], div[dir=rtl]');
        for (var bi2 = 0; bi2 < bidi.length; bi2++) {
          var bd = bidi[bi2];
          if ((qEl && qEl.contains(bd)) || (bd.closest && bd.closest('[aria-hidden=true]'))) continue;
          if (bd.parentElement && bd.parentElement.closest && bd.parentElement.closest('[dir=ltr], [dir=rtl]') && row.contains(bd.parentElement.closest('[dir=ltr], [dir=rtl]'))) continue;
          var btxt = str(readText(bd, qEl), 4000);
          if (btxt && !/^\d{1,2}[.:]\d{2}(\s?[AP]M)?$/i.test(btxt) && !BADGE_RE.test(btxt) && textParts.indexOf(btxt) < 0) textParts.push(btxt);
        }
      }
      if (!textParts.length && !hasDocCard && !metaHit) {
        var fbLines = leafLines(row, qEl);
        for (var fli = 0; fli < fbLines.length; fli++) {
          var fln = fbLines[fli];
          if (fln === sender || /^\d{1,2}[.:]\d{2}(\s?[AP]M)?$/i.test(fln) || BADGE_RE.test(fln) || parsePillYmd(fln)) continue;
          textParts.push(fln);
        }
      }
      var text = str(textParts.join('\n'), 4000);
      if (text && SYS_RE.test(text)) continue;
      // Link URL
      var links = [], lseen = {};
      var anchors = row.querySelectorAll('a[href]');
      for (var ai = 0; ai < anchors.length; ai++) {
        var href = str(anchors[ai].getAttribute('href') || '', 600);
        if (/^https?:\/\//i.test(href) && !lseen[href] && links.length < 30) { lseen[href] = 1; links.push(href); }
      }
      var urlMatches = text.match(/https?:\/\/[^\s<>\x22')]+/gi) || [];
      for (var ui = 0; ui < urlMatches.length; ui++) {
        var cu = urlMatches[ui].replace(/[.,;:!?]+$/, '').slice(0, 600);
        if (cu && !lseen[cu] && links.length < 30) { lseen[cu] = 1; links.push(cu); }
      }
      // Dokumen / file lampiran
      var docs = [], dseen = {};
      function addDoc(d) {
        var cd = str(d, 200);
        if (cd && !dseen[cd] && docs.length < 12) { dseen[cd] = 1; docs.push(cd); }
      }
      var titled = row.querySelectorAll('[title]');
      for (var di = 0; di < titled.length; di++) {
        if (qEl && qEl.contains(titled[di])) continue;
        var tv = str(titled[di].getAttribute('title'), 180);
        if (tv && DOC_EXT.test(tv)) addDoc(tv);
      }
      if (hasDocCard || metaHit) {
        var rlines = leafLines(row, qEl).concat(rawRowText.split(/\r?\n/).map(function (l) { return str(l, 180); }).filter(Boolean));
        var docTitle = '';
        for (var li = 0; li < rlines.length; li++) {
          var ln = rlines[li];
          if (ln === sender || ln === text || /^\d{1,2}[.:]\d{2}(\s?[AP]M)?$/i.test(ln) || META_RE.test(ln) || BADGE_RE.test(ln)) continue;
          if (DOC_EXT.test(ln)) { docTitle = ln; break; }
          if (!docTitle && ln.length >= 2 && ln.length <= 160) docTitle = ln;
        }
        if (docTitle || metaHit) {
          var label = docTitle ? (metaHit && !DOC_EXT.test(docTitle) ? docTitle + '.' + metaHit[2].toLowerCase() + ' (' + metaHit[1] + ')' : (metaHit ? docTitle + ' (' + metaHit[1] + ')' : docTitle)) : (metaHit[2].toUpperCase() + ' (' + metaHit[1] + ')');
          addDoc(label);
        }
      }
      var inlineDocs = rawRowText.match(DOC_INLINE) || [];
      for (var idi = 0; idi < inlineDocs.length; idi++) {
        var idc = str(inlineDocs[idi], 180);
        if (idc && !/^https?:\/\//i.test(idc) && !docs.some(function (x) { return x.indexOf(idc) === 0; })) addDoc(idc);
      }
      // Indikator media (foto / video / audio / stiker)
      var media = '';
      if (row.querySelector('video, [data-icon*=video]')) media = 'video';
      else if (row.querySelector('audio, [data-icon*=ptt], [data-icon*=audio]')) media = 'audio';
      else if (row.querySelector('[data-icon*=sticker], img[alt*=Sticker]')) media = 'sticker';
      else {
        var imgs = row.querySelectorAll('img[src^=\x22blob:\x22]');
        for (var imi = 0; imi < imgs.length; imi++) {
          var im = imgs[imi];
          if (!im.classList.contains('emoji') && (!qEl || !qEl.contains(im)) && (!im.width || im.width > 44)) { media = 'image'; break; }
        }
      }
      if (!text && !links.length && !docs.length && !media) continue;
      var id = rawId ? (rawId.indexOf('_') > 0 ? rawId : chat + '_' + rawId) : ('wa_' + fnv(chat + '|' + dir + '|' + timeText + '|' + sender + '|' + text.slice(0, 200) + '|' + docs.join('|')));
      if (put({
        id: id, chat: chat, isGroup: isGroup, sender: sender, dir: dir,
        ts: ts, timeText: timeText, text: text, quote: quote,
        links: links, docs: docs, media: media, seen: now()
      })) added++;
    }
    if (added) { recalcStats(); changed('+' + added + ' (' + chat + ')'); }
    else render();
    return added;
  }
  S.scan = scanDom;
  // ---- Panel melayang (kanan atas agar tidak menutupi kolom ketik WA di kanan bawah; bisa digeser)
  var panel = document.createElement('div');
  panel.setAttribute('data-wa-hook', '1');
  Object.assign(panel.style, { position: 'fixed', right: '16px', top: '64px', width: '310px', background: 'linear-gradient(155deg, #221914 0%, #14100d 100%)', color: '#f3ece4', font: '12px/1.45 Segoe UI,system-ui,sans-serif', border: '2px solid #22c55e', borderRadius: '10px', boxShadow: '0 12px 30px rgba(0,0,0,.55)', zIndex: 2147483647, padding: '10px' });
  var head = document.createElement('div'); Object.assign(head.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', cursor: 'move', userSelect: 'none' });
  var title = document.createElement('b'); title.textContent = '💬 WA Hook'; head.appendChild(title);
  var x = document.createElement('button'); x.textContent = '–'; x.title = "Kecilkan"; Object.assign(x.style, { background: '#2a2019', color: '#f3ece4', border: '1px solid #453429', borderRadius: '5px', padding: '1px 7px', cursor: 'pointer' }); head.appendChild(x);
  var body = document.createElement('div');
  var cnt = document.createElement('div'); Object.assign(cnt.style, { fontSize: '12.5px', fontWeight: '700' });
  var info = document.createElement('div'); Object.assign(info.style, { color: '#aa9888', margin: '4px 0 8px', minHeight: '16px' });
  var row = document.createElement('div'); Object.assign(row.style, { display: 'flex', flexWrap: 'wrap', gap: '4px' });
  function btn(label, fn, tip) { var b = document.createElement('button'); b.textContent = label; if (tip) b.title = tip; Object.assign(b.style, { background: '#2a2019', color: '#f3ece4', border: '1px solid #453429', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', font: 'inherit' }); b.onclick = fn; row.appendChild(b); return b; }
  body.appendChild(cnt); body.appendChild(info); body.appendChild(row);
  panel.appendChild(head); panel.appendChild(body);
  document.body.appendChild(panel);
  try { if (window.__hookGuard) window.__hookGuard.add(panel); } catch (e) { /* abaikan */ }
  var drag = false, dx = 0, dy = 0;
  function onMouseMove(e) {
    if (!drag) return;
    panel.style.left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, e.clientX - dx)) + 'px';
    panel.style.top = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, e.clientY - dy)) + 'px';
    panel.style.right = 'auto';
  }
  function onMouseUp() { drag = false; }
  head.addEventListener('mousedown', function (e) {
    if (e.target === x) return;
    var r = panel.getBoundingClientRect(); drag = true; dx = e.clientX - r.left; dy = e.clientY - r.top; e.preventDefault();
  });
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('mouseup', onMouseUp, true);
  x.onclick = function () { var h = body.style.display === 'none'; body.style.display = h ? '' : 'none'; x.textContent = h ? '–' : '+'; };
  S.show = function () { panel.style.display = ''; body.style.display = ''; x.textContent = '–'; };
  function list() { return S.order.map(function (id) { return S.items[id]; }).filter(Boolean); }
  function clean(it) { var o = {}; for (var k in it) if (k !== 'dirty') o[k] = it[k]; return o; }
  function render() {
    var nc = Object.keys(S.chats).length;
    cnt.textContent = "Tertangkap: " + S.order.length + " pesan · " + nc + " chat · 🔗" + S.links + " · 📄" + S.docs + " · terkirim " + S.sent;
  }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(list().slice(-5000).map(clean))); } catch (e) { /* kuota penuh */ } }
  var tmr = 0;
  function changed(msg) { if (msg) info.textContent = msg; render(); save(); clearTimeout(tmr); tmr = setTimeout(flush, 650); }
  // ---- Kirim ke tab scanner
  var target = cfg.origin && cfg.origin !== 'null' ? cfg.origin : '*';
  function openApp() {
    if (!cfg.app) { info.textContent = "Scanner dibuka dari file lokal: pakai Salin/Unduh JSON lalu Import di tab WA Hook."; return; }
    try { S.w = window.open(cfg.app.split('#')[0] + '#wa-hook', 'scaWaHook'); } catch (e) { S.w = null; }
    if (!S.w) { info.textContent = "Popup diblokir: izinkan popup untuk WhatsApp Web, lalu klik Buka tabel."; return; }
    S.ack = false; ping();
  }
  var pings = 0;
  function ping() { pings = 0; (function p() { if (S.ack || !S.w || S.w.closed || ++pings > 40) { if (!S.ack && pings > 40) info.textContent = "Tab scanner tidak merespons. Pakai Salin/Unduh JSON lalu Import."; return; } try { S.w.postMessage({ type: 'wa-hello' }, target); } catch (e) { /* belum siap */ } setTimeout(p, 400); })(); }
  function flush() {
    if (!S.w || S.w.closed || !S.ack) return;
    var batch = list().filter(function (it) { return it.dirty; });
    if (!batch.length) return;
    try { S.w.postMessage({ type: 'wa-items', items: batch.map(clean) }, target); batch.forEach(function (it) { it.dirty = false; }); } catch (e) { info.textContent = "Gagal kirim: " + e.message; }
  }
  function onWinMsg(e) {
    if (!e.data || e.source !== S.w || (target !== '*' && e.origin !== target)) return;
    if (e.data.type === 'wa-ack') { if (!S.ack) { S.ack = true; info.textContent = "Terhubung ke tab scanner."; list().forEach(function (it) { it.dirty = true; }); } flush(); }
    if (e.data.type === 'wa-saved') { S.sent = e.data.total || S.sent; render(); }
  }
  window.addEventListener('message', onWinMsg);
  var bAuto = null;
  function stopAuto(msg) {
    if (S.auto) { clearInterval(S.auto); S.auto = 0; }
    if (bAuto) bAuto.textContent = "⏫ Auto-scroll";
    if (msg) info.textContent = msg;
  }
  function toggleAuto() {
    if (S.auto) { stopAuto("Auto-scroll dihentikan."); return; }
    var pane = findScrollPane();
    if (!pane) { info.textContent = "Buka salah satu chat di WhatsApp Web lalu scroll."; return; }
    bAuto.textContent = "⏹ Stop";
    info.textContent = "Auto-scroll ke atas berjalan... klik Stop untuk berhenti.";
    var stuck = 0, lastTop = pane.scrollTop, lastH = pane.scrollHeight;
    S.auto = setInterval(function () {
      var p = findScrollPane();
      if (!p) { stopAuto("Auto-scroll dihentikan."); return; }
      scanDom();
      if (p.scrollHeight !== lastH) stuck = 0;
      lastH = p.scrollHeight;
      p.scrollTop = Math.max(0, p.scrollTop - Math.max(280, Math.round(p.clientHeight * 0.75)));
      if (p.scrollTop === 0 && lastTop === 0) { if (++stuck >= 6) stopAuto("Auto-scroll selesai / sudah mentok atas."); }
      else stuck = 0;
      lastTop = p.scrollTop;
    }, 1050);
  }
  btn("Buka tabel", openApp, "Buka/hubungkan tab scanner (tabel WA Hook)");
  btn("Scan ulang", function () {
    var m = findMain();
    if (!m) { info.textContent = "Buka salah satu chat di WhatsApp Web lalu scroll."; return; }
    var n = scanDom();
    if (!n) info.textContent = "Tidak ada pesan baru di layar ini." + ' (' + chatName(m) + ' · ' + collectRows(m).length + ' baris)';
  });
  bAuto = btn("⏫ Auto-scroll", toggleAuto, "Scroll otomatis ke atas perlahan untuk mengumpulkan riwayat chat yang sedang dibuka");
  btn("Salin JSON", function () {
    var s = JSON.stringify({ type: 'wa-export', items: list().map(clean) });
    function fb() { var ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* abaikan */ } ta.remove(); info.textContent = "Tersalin ke clipboard."; }
    if (navigator.clipboard) navigator.clipboard.writeText(s).then(function () { info.textContent = "Tersalin ke clipboard."; }, fb); else fb();
  });
  btn("Unduh JSON", function () {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ type: 'wa-export', items: list().map(clean) }, null, 2)], { type: 'application/json' }));
    a.download = 'wa-hook-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  });
  btn("Kosongkan daftar", function () { S.items = {}; S.order = []; recalcStats(); save(); render(); info.textContent = "Daftar di tab ini dikosongkan (data di scanner tetap)."; });
  btn("Tutup", function () { stopAuto(''); panel.style.display = 'none'; }, "Sembunyikan panel (hook tetap berjalan)");
  try {
    (JSON.parse(sessionStorage.getItem(KEY) || '[]') || []).forEach(function (it) {
      if (it && it.id && !S.items[it.id]) { S.items[it.id] = it; S.order.push(it.id); }
    });
    recalcStats();
  } catch (e) { /* abaikan */ }
  function onScrollEvt() { clearTimeout(S.st); S.st = setTimeout(scanDom, 200); }
  document.addEventListener('scroll', onScrollEvt, true);
  var mo = new MutationObserver(function () { clearTimeout(S.mt); S.mt = setTimeout(scanDom, 450); });
  mo.observe(document.body, { childList: true, subtree: true });
  S.destroy = function () {
    stopAuto('');
    clearTimeout(S.st); clearTimeout(S.mt); clearTimeout(tmr);
    try { mo.disconnect(); } catch (e) { /* abaikan */ }
    document.removeEventListener('scroll', onScrollEvt, true);
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
    window.removeEventListener('message', onWinMsg);
    try { panel.remove(); } catch (e) { /* abaikan */ }
  };
  render();
  var initAdded = scanDom();
  if (!initAdded) {
    info.textContent = /whatsapp\.com$/i.test(location.hostname)
      ? "Hook aktif. Buka chat & scroll untuk mengumpulkan pesan."
      : "Buka halaman web.whatsapp.com terlebih dahulu.";
  }
  if (!S.w || S.w.closed) openApp();
  else flush();
}

// ---- WA Hook: penyimpanan (IndexedDB scanner) + sanitasi lintas-tab
const WA_DB = 'scaWaHook', WA_STORE = 'msgs';
const WA_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*whatsapp\.com$/;
const WA_DOC_URL_RE = /(?:drive\.google\.com|docs\.google\.com|sheets\.google\.com|slides\.google\.com|sharepoint\.com|onedrive\.live\.com|1drv\.ms|dropbox\.com|box\.com|notion\.so|figma\.com)|\.(?:pdf|docx?|xlsx?|csv|pptx?|odt|ods|zip|rar|7z)(?:[?#]|$)/i;
function waHasDocLink(links) {
  return Array.isArray(links) && links.some(u => WA_DOC_URL_RE.test(u));
}
function waOpen() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB')); return; }
    const r = indexedDB.open(WA_DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(WA_STORE, { keyPath: 'id' }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function waTx(mode, work) {
  return waOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(WA_STORE, mode), st = tx.objectStore(WA_STORE);
    let out;
    work(st, v => { out = v; });
    tx.oncomplete = () => { db.close(); resolve(out); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}
function waAll() { return waTx('readonly', (st, set) => { const q = st.getAll(); q.onsuccess = () => set(q.result || []); }); }
function waClear(ids) { return waTx('readwrite', st => { if (ids) ids.forEach(id => st.delete(id)); else st.clear(); }); }
function waClean(it) {
  if (!it || typeof it !== 'object') return null;
  const s = (v, m) => (v === null || v === undefined ? '' : String(v).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, m));
  const n = v => (typeof v === 'number' && isFinite(v) ? v : (v !== null && v !== undefined && v !== '' && isFinite(+v) ? +v : null));
  const id = s(it.id, 180), chat = s(it.chat, 140);
  if (!id || !chat) return null;
  const links = Array.isArray(it.links) ? [...new Set(it.links.map(u => s(u, 600)).filter(u => /^https?:\/\//i.test(u)))].slice(0, 30) : [];
  const docs = Array.isArray(it.docs) ? [...new Set(it.docs.map(d => s(d, 200)).filter(Boolean))].slice(0, 12) : [];
  const text = s(it.text, 4000), quote = s(it.quote, 240);
  const media = ['image', 'video', 'audio', 'sticker'].includes(it.media) ? it.media : '';
  if (!text && !links.length && !docs.length && !media) return null;

  let ts = n(it.ts);
  let timeText = s(it.timeText, 40);
  const now = Date.now();
  const nowLimit = now + 43200000;
  // Penjagaan anti masa depan: perbaiki otomatis tanggal terbalik (MM/DD vs DD/MM)
  if (ts && ts > nowLimit) {
    const d = new Date(ts);
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    const h = d.getHours(), mi = d.getMinutes(), sc = d.getSeconds();
    if (day >= 1 && day <= 12 && m >= 1 && m <= 31) {
      const sw = new Date(y, day - 1, m, h, mi, sc);
      if (sw.getTime() <= nowLimit) {
        ts = sw.getTime();
        const p2 = v => String(v).padStart(2, '0');
        timeText = y + '-' + p2(day) + '-' + p2(m) + ' ' + p2(h) + ':' + p2(mi);
      } else {
        ts = n(it.seen) || now;
      }
    } else {
      ts = n(it.seen) || now;
    }
  }

  return {
    id, chat, isGroup: !!it.isGroup, sender: s(it.sender, 120), dir: it.dir === 'out' ? 'out' : 'in',
    ts, timeText, text, quote, links, docs, media, seen: n(it.seen) || now
  };
}
function waMerge(old, it) {
  if (!old) return it;
  const out = Object.assign({}, old);
  if (it.text && (!old.text || it.text.length >= old.text.length)) out.text = it.text;
  if (it.quote && !old.quote) out.quote = it.quote;
  if (it.ts) { out.ts = it.ts; if (it.timeText) out.timeText = it.timeText; }
  else if (it.timeText && !old.timeText) out.timeText = it.timeText;
  if (it.sender && (!old.sender || old.sender === old.chat)) out.sender = it.sender;
  if (it.isGroup) out.isGroup = true;
  if (it.media && !old.media) out.media = it.media;
  out.links = [...new Set([].concat(old.links || [], it.links || []))].slice(0, 30);
  out.docs = [...new Set([].concat(old.docs || [], it.docs || []))].slice(0, 12);
  out.seen = Math.min(old.seen || it.seen, it.seen || old.seen);
  return out;
}
function waPutMany(list) {
  return waTx('readwrite', st => {
    list.forEach(it => { const g = st.get(it.id); g.onsuccess = () => { st.put(waMerge(g.result, it)); }; });
  });
}

const WA_I18N = {
  id: {
    tab_wa: 'WA Hook', wa_title: 'WA Hook — arsipkan chat, link & referensi dokumen WhatsApp Web',
    wa_intro: 'WhatsApp Web sering membatasi riwayat sinkronisasi lama (±2 bulan). Jalankan hook ini sebulan sekali sambil scroll chat/grup penting: setiap pesan, link URL, dan nama dokumen yang tampil di layar otomatis dikumpulkan dan disimpan permanen di IndexedDB browser ini supaya 6 bulan ke depan mudah dicari tanpa perlu buka HP utama.',
    wa_step1: 'Seret tombol 💬 WA Hook ke bookmark bar (atau klik Salin Script untuk ditempel di Console F12 tab WhatsApp Web).',
    wa_step2: 'Buka web.whatsapp.com, jalankan 💬 WA Hook. Izinkan popup bila diminta agar langsung terhubung ke tab tabel ini.',
    wa_step3: 'Buka chat/grup lalu scroll ke atas (atau klik ⏫ Auto-scroll di panel WA); semua pesan yang lewat otomatis tersimpan.',
    wa_copy_script: 'Salin Script', wa_copy_script_tip: 'Salin skrip untuk ditempel di DevTools Console (F12) bila bookmarklet diblokir browser',
    wa_paste_t: 'Paste JSON (dari tombol Salin JSON di panel WA Hook)',
    wa_bad_json: 'JSON tidak berisi data pesan WA Hook.', wa_got: '{n} pesan WA disimpan ke arsip.',
    wa_del_confirm: 'Hapus {n} pesan WA dari IndexedDB browser ini?',
    wa_stat_msgs: 'pesan tersimpan', wa_stat_chats: 'chat / grup', wa_stat_links: 'pesan ber-link', wa_stat_docs: 'dokumen / file',
    wa_search_ph: 'Cari isi chat, nama pengirim, grup, link URL, atau nama dokumen ... (beberapa kata = semua harus cocok)',
    wa_all_chats: 'Semua chat / grup', wa_all_kind: 'Semua jenis pesan',
    wa_k_doc: 'Ada Dokumen / Link File', wa_k_link: 'Ada Link URL', wa_k_att: 'Lampiran File WA', wa_k_media: 'Media (Foto/Video/Audio)', wa_k_text: 'Teks saja',
    wa_all_dir: 'Semua arah', wa_dir_in: 'Masuk', wa_dir_out: 'Keluar (Saya)',
    wa_from: 'Dari', wa_to: 'Sampai', wa_shown: 'Menampilkan {n} dari {t} pesan tersimpan',
    wa_c_time: 'Waktu', wa_c_chat: 'Chat / Grup', wa_c_sender: 'Pengirim', wa_c_msg: 'Isi Pesan', wa_c_ref: 'Dokumen & Link',
    wa_filter_chat: 'Klik untuk filter chat ini saja', wa_me: 'Saya',
    wa_empty: 'Belum ada arsip pesan. Buka WhatsApp Web lalu jalankan 💬 WA Hook dan scroll chat yang ingin disimpan.',
    wa_note: 'Semua chat disimpan lokal di IndexedDB browser perangkat ini saja (tidak dikirim ke server mana pun) dan otomatis ikut ter-backup saat Anda memakai menu "Export semua data & setelan (.json)". Anda bisa menghapus per baris, per hasil filter, atau seluruhnya kapan saja.',
    grp_wa_title: 'WA Hook', grp_wa_desc: 'Tidak memakai API: membaca pesan yang tampil saat Anda scroll di tab WhatsApp Web Anda sendiri, lalu menyimpannya lokal di IndexedDB browser ini.'
  },
  en: {
    tab_wa: 'WA Hook', wa_title: 'WA Hook — archive WhatsApp Web chats, links & document references',
    wa_intro: 'WhatsApp Web often limits older synced history (~2 months). Run this hook once a month while scrolling important chats/groups: every visible message, URL link, and document filename is collected and stored locally in IndexedDB so you can search references months later without opening your main phone.',
    wa_step1: 'Drag the 💬 WA Hook button to your bookmarks bar (or click Copy Script to paste in the WhatsApp Web F12 Console).',
    wa_step2: 'Open web.whatsapp.com and run 💬 WA Hook. Allow popups if prompted so it connects straight to this table tab.',
    wa_step3: 'Open any chat/group and scroll up (or click ⏫ Auto-scroll on the WA panel); every visible message is saved automatically.',
    wa_copy_script: 'Copy Script', wa_copy_script_tip: 'Copy the script to paste into DevTools Console (F12) if bookmarklets are blocked',
    wa_paste_t: 'Paste JSON (from the Copy JSON button on the WA Hook panel)',
    wa_bad_json: 'The JSON contains no WA Hook message data.', wa_got: '{n} WA messages saved to archive.',
    wa_del_confirm: 'Delete {n} WA messages from this browser\'s IndexedDB?',
    wa_stat_msgs: 'saved messages', wa_stat_chats: 'chats / groups', wa_stat_links: 'with links', wa_stat_docs: 'docs / files',
    wa_search_ph: 'Search message text, sender, group, URL link, or document filename ... (multiple words = all must match)',
    wa_all_chats: 'All chats / groups', wa_all_kind: 'All message types',
    wa_k_doc: 'Has Document / File Link', wa_k_link: 'Has URL Link', wa_k_att: 'WA File Attachment', wa_k_media: 'Media (Photo/Video/Audio)', wa_k_text: 'Text only',
    wa_all_dir: 'All directions', wa_dir_in: 'Incoming', wa_dir_out: 'Outgoing (Me)',
    wa_from: 'From', wa_to: 'To', wa_shown: 'Showing {n} of {t} saved messages',
    wa_c_time: 'Time', wa_c_chat: 'Chat / Group', wa_c_sender: 'Sender', wa_c_msg: 'Message', wa_c_ref: 'Documents & Links',
    wa_filter_chat: 'Click to filter this chat only', wa_me: 'Me',
    wa_empty: 'No archived messages yet. Open WhatsApp Web, run 💬 WA Hook, and scroll the chats you want to keep.',
    wa_note: 'All chats stay locally in this browser\'s IndexedDB (never uploaded anywhere) and are included when you use "Export all data & settings (.json)". You can delete single rows, filtered rows, or everything anytime.',
    grp_wa_title: 'WA Hook', grp_wa_desc: 'Uses no API: reads messages shown while you scroll your own WhatsApp Web tab and stores them locally in IndexedDB.'
  }
};
Object.keys(WA_I18N).forEach(l => { I18N[l] = Object.assign({}, WA_I18N[l], I18N[l] || {}); });
// ============================================================
//  Sheet Viewer: xlsx/csv dibaca di Web Worker (stream, tidak memuat semua ke UI) supaya
//  file jutaan baris tidak membuat halaman hang. Baris disimpan sebagai satu string per
//  baris (sel dipisah \u001f) agar hemat memori. UI hanya meminta potongan baris yang
//  terlihat (virtual scroll). Fungsi worker dijadikan teks (toString): harus mandiri.
// ============================================================
function sheetWorkerMain() {
  var SEP = '\u001f';
  var books = {}, views = {}, latest = {};
  function post(m, tr) { self.postMessage(m, tr || []); }
  function sleep0() { return new Promise(function (r) { setTimeout(r, 0); }); }
  // ---------- util XML ringan (tanpa DOMParser: tidak ada di worker)
  var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  function unxml(s) {
    if (s.indexOf('&') < 0) return s;
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, function (m, e) {
      if (e.charAt(0) === '#') { var c = e.charAt(1) === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(c); } catch (x) { return ''; } }
      return ENT[e];
    });
  }
  function attr(tag, name) {
    var k = ' ' + name + '="', i = tag.indexOf(k);
    if (i < 0) return null;
    var j = tag.indexOf('"', i + k.length);
    return tag.slice(i + k.length, j);
  }
  // gabung teks semua <t ...>...</t> di dalam s
  function texts(s) {
    var out = '', p = 0;
    for (;;) {
      var a = s.indexOf('<t', p); if (a < 0) break;
      var c = s.charAt(a + 2);
      if (c !== '>' && c !== ' ') { p = a + 2; continue; }
      var b = s.indexOf('>', a); if (s.charAt(b - 1) === '/') { p = b + 1; continue; }
      var e = s.indexOf('</t>', b); if (e < 0) break;
      out += s.slice(b + 1, e); p = e + 4;
    }
    return unxml(out);
  }
  function colIndex(ref) { var n = 0; for (var i = 0; i < ref.length; i++) { var c = ref.charCodeAt(i); if (c < 65 || c > 90) break; n = n * 26 + (c - 64); } return n - 1; }
  // ---------- zip (central directory) langsung dari File.slice
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  async function zipList(file) {
    var tail = Math.min(file.size, 65557), b = new Uint8Array(await file.slice(file.size - tail).arrayBuffer()), e = -1;
    for (var i = b.length - 22; i >= 0; i--) if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 5 && b[i + 3] === 6) { e = i; break; }
    if (e < 0) throw new Error('not-zip');
    var cnt = u16(b, e + 10), size = u32(b, e + 12), off = u32(b, e + 16);
    var cd = new Uint8Array(await file.slice(off, off + size).arrayBuffer()), p = 0, map = {};
    var dec = new TextDecoder();
    for (var k = 0; k < cnt && p + 46 <= cd.length; k++) {
      var nl = u16(cd, p + 28), xl = u16(cd, p + 30), cl = u16(cd, p + 32);
      map[dec.decode(cd.subarray(p + 46, p + 46 + nl))] = { method: u16(cd, p + 10), csize: u32(cd, p + 20), local: u32(cd, p + 42) };
      p += 46 + nl + xl + cl;
    }
    return map;
  }
  // stream teks entri zip; onChunk(string) dipanggil berulang
  async function zipStream(file, ent, onChunk) {
    var h = new Uint8Array(await file.slice(ent.local, ent.local + 30).arrayBuffer());
    var start = ent.local + 30 + u16(h, 26) + u16(h, 28);
    var st = file.slice(start, start + ent.csize).stream();
    if (ent.method === 8) st = st.pipeThrough(new DecompressionStream('deflate-raw'));
    var rd = st.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) { var r = await rd.read(); if (r.done) break; await onChunk(r.value); }
  }
  async function zipText(file, ent) { var s = ''; await zipStream(file, ent, function (c) { s += c; }); return s; }
  // ---------- tanggal Excel
  function dateStyles(xml) {
    var custom = {}, p = 0;
    for (;;) { var a = xml.indexOf('<numFmt ', p); if (a < 0) break; var b = xml.indexOf('>', a), tag = xml.slice(a, b); custom[attr(tag, 'numFmtId')] = unxml(attr(tag, 'formatCode') || ''); p = b; }
    var out = [], cx = xml.indexOf('<cellXfs'), end = xml.indexOf('</cellXfs>', cx); p = cx;
    while (cx >= 0) {
      var x = xml.indexOf('<xf ', p); if (x < 0 || x > end) break;
      var y = xml.indexOf('>', x), id = +attr(xml.slice(x, y), 'numFmtId'), f = custom[id], isD = false, isT = false;
      if ((id >= 14 && id <= 17) || id === 22 || (id >= 27 && id <= 36) || (id >= 50 && id <= 58)) isD = true;
      if ((id >= 18 && id <= 21) || (id >= 45 && id <= 47)) isT = true;
      if (f) { var g = f.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''); if (/[dy]/i.test(g) || /m{3,}/i.test(g)) isD = true; else if (/[hs]/i.test(g)) isT = true; }
      out.push(isD ? (/[hs]/i.test(f || '') || id === 22 ? 'dt' : 'd') : isT ? 't' : '');
      p = y;
    }
    return out;
  }
  function z2(n) { return n < 10 ? '0' + n : '' + n; }
  function serial(v, kind) {
    var n = +v; if (!isFinite(n)) return v;
    var ms = Math.round((n - 25569) * 86400000), d = new Date(ms);
    var date = d.getUTCFullYear() + '-' + z2(d.getUTCMonth() + 1) + '-' + z2(d.getUTCDate()), time = z2(d.getUTCHours()) + ':' + z2(d.getUTCMinutes()) + (d.getUTCSeconds() ? ':' + z2(d.getUTCSeconds()) : '');
    return kind === 'd' ? date : kind === 't' ? time : date + ' ' + time;
  }
  // ---------- muat buku
  function newSheet(name) { return { name: name, rows: [], nums: [], cols: 0 }; }
  async function loadXlsx(id, file) {
    var z = await zipList(file);
    var rels = z['xl/_rels/workbook.xml.rels'] ? await zipText(file, z['xl/_rels/workbook.xml.rels']) : '';
    var wb = await zipText(file, z['xl/workbook.xml']);
    var target = {}, p = 0;
    for (;;) { var a = rels.indexOf('<Relationship ', p); if (a < 0) break; var b = rels.indexOf('>', a), t = rels.slice(a, b); target[attr(t, 'Id')] = attr(t, 'Target'); p = b; }
    var list = []; p = 0;
    for (;;) { var s = wb.indexOf('<sheet ', p); if (s < 0) break; var e = wb.indexOf('>', s), tg = wb.slice(s, e), tgt = target[attr(tg, 'r:id')] || ''; tgt = tgt.charAt(0) === '/' ? tgt.slice(1) : 'xl/' + tgt.replace(/^\.\//, ''); list.push({ name: unxml(attr(tg, 'name') || ''), path: tgt, hidden: attr(tg, 'state') === 'hidden' || attr(tg, 'state') === 'veryHidden' }); p = e; }
    var ds = z['xl/styles.xml'] ? dateStyles(await zipText(file, z['xl/styles.xml'])) : [];
    var ss = [];
    if (z['xl/sharedStrings.xml']) {
      var buf = '';
      post({ op: 'prog', id: id, phase: 'strings', pct: 0 });
      await zipStream(file, z['xl/sharedStrings.xml'], function (c) {
        buf += c; var q = 0;
        for (;;) { var a1 = buf.indexOf('<si', q); if (a1 < 0) break; var b1 = buf.indexOf('</si>', a1); if (b1 < 0) break; ss.push(texts(buf.slice(a1, b1))); q = b1 + 5; }
        buf = buf.slice(q);
      });
    }
    var book = { id: id, name: file.name, sheets: [] }, total = 0;
    books[id] = book;
    for (var si = 0; si < list.length; si++) {
      var info = list[si], ent = z[info.path];
      var sh = newSheet(info.name); sh.hidden = info.hidden; book.sheets.push(sh);
      if (!ent) continue;
      var rest = '', lastPost = 0, csz = ent.csize || 1, seen = 0;
      await zipStream(file, ent, async function (c) {
        seen += c.length;
        var s = rest + c, q = 0;
        for (;;) {
          var a2 = s.indexOf('<row', q); if (a2 < 0) { q = Math.max(q, s.length - 8); break; }
          var gt = s.indexOf('>', a2); if (gt < 0) { q = a2; break; }
          var r;
          if (s.charAt(gt - 1) === '/') { q = gt + 1; continue; }
          var end2 = s.indexOf('</row>', gt); if (end2 < 0) { q = a2; break; }
          r = s.slice(gt + 1, end2);
          var rn = +attr(s.slice(a2, gt), 'r') || (sh.nums.length ? sh.nums[sh.nums.length - 1] + 1 : 1);
          var cells = [], cp = 0, next = 0;
          for (;;) {
            var ca = r.indexOf('<c', cp); if (ca < 0) break;
            var cc = r.charAt(ca + 2); if (cc !== ' ' && cc !== '>' && cc !== '/') { cp = ca + 2; continue; }
            var cg = r.indexOf('>', ca), ctag = r.slice(ca, cg), self1 = r.charAt(cg - 1) === '/';
            var ce = self1 ? cg : r.indexOf('</c>', cg), inner = self1 ? '' : r.slice(cg + 1, ce);
            var ref = attr(ctag, 'r'), ci = ref ? colIndex(ref) : next, ty = attr(ctag, 't'), st = attr(ctag, 's'), val = '';
            if (ty === 'inlineStr') val = texts(inner);
            else {
              var va = inner.indexOf('<v>'), vb = va < 0 ? -1 : inner.indexOf('</v>', va);
              var v = va < 0 ? '' : inner.slice(va + 3, vb);
              if (ty === 's') val = ss[+v] || '';
              else if (ty === 'b') val = v === '1' ? 'TRUE' : v === '0' ? 'FALSE' : v;
              else if (ty === 'str' || ty === 'e') val = unxml(v);
              else { val = v; if (v !== '' && st !== null && ds[+st]) val = serial(v, ds[+st]); }
            }
            while (cells.length < ci) cells.push('');
            cells[ci] = val; next = ci + 1;
            cp = self1 ? cg + 1 : ce + 4;
          }
          while (cells.length && cells[cells.length - 1] === '') cells.pop();
          if (cells.length) { sh.rows.push(cells.join(SEP)); sh.nums.push(rn); if (cells.length > sh.cols) sh.cols = cells.length; }
          q = end2 + 6;
        }
        rest = s.slice(q);
        if (Date.now() - lastPost > 250) { lastPost = Date.now(); post({ op: 'prog', id: id, phase: 'sheet', sheet: info.name, si: si, sn: list.length, rows: sh.rows.length, pct: Math.min(99, Math.round(seen / (csz * 6) * 100)) }); await sleep0(); }
      });
    }
  }
  async function loadCsv(id, file) {
    var head = await file.slice(0, 65536).text(), first = head.split(/\r?\n/)[0] || '';
    var cand = [',', ';', '\t', '|'], delim = ',', best = -1;
    cand.forEach(function (d) { var n = first.split(d).length; if (n > best) { best = n; delim = d; } });
    var book = { id: id, name: file.name, sheets: [newSheet(file.name.replace(/\.[^.]+$/, ''))] }, sh = book.sheets[0];
    books[id] = book;
    var rd = file.stream().pipeThrough(new TextDecoderStream()).getReader();
    var cells = [], cur = '', inQ = false, line = 1, lastPost = 0, read = 0, bom = true;
    function endRow() {
      cells.push(cur); cur = '';
      while (cells.length && cells[cells.length - 1] === '') cells.pop();
      if (cells.length) { sh.rows.push(cells.join(SEP)); sh.nums.push(line); if (cells.length > sh.cols) sh.cols = cells.length; }
      cells = []; line++;
    }
    for (;;) {
      var r = await rd.read(); if (r.done) break;
      var s = r.value; read += s.length;
      if (bom && s.charCodeAt(0) === 0xfeff) s = s.slice(1);
      bom = false;
      var i = 0, n = s.length;
      while (i < n) {
        if (inQ) {
          var j = s.indexOf('"', i);
          if (j < 0) { cur += s.slice(i); i = n; break; }
          cur += s.slice(i, j);
          if (s.charAt(j + 1) === '"') { cur += '"'; i = j + 2; }
          else if (j + 1 >= n) { inQ = 'maybe'; i = n; }
          else { inQ = false; i = j + 1; }
          continue;
        }
        if (inQ === 'maybe') { if (s.charAt(i) === '"') { cur += '"'; i++; inQ = true; continue; } inQ = false; }
        var ch = s.charAt(i);
        if (ch === '"' && cur === '') { inQ = true; i++; }
        else if (ch === delim) { cells.push(cur); cur = ''; i++; }
        else if (ch === '\n') { if (cur.charAt(cur.length - 1) === '\r') cur = cur.slice(0, -1); endRow(); i++; }
        else {
          var k = i; while (k < n) { var cd = s.charAt(k); if (cd === delim || cd === '\n' || cd === '"') break; k++; }
          cur += s.slice(i, k); i = k;
          if (s.charAt(i) === '"' && cur !== '') { cur += '"'; i++; }
        }
      }
      if (Date.now() - lastPost > 250) { lastPost = Date.now(); post({ op: 'prog', id: id, phase: 'sheet', sheet: sh.name, si: 0, sn: 1, rows: sh.rows.length, pct: Math.min(99, Math.round(read / file.size * 100)) }); await sleep0(); }
    }
    if (cur !== '' || cells.length) { if (cur.charAt(cur.length - 1) === '\r') cur = cur.slice(0, -1); endRow(); }
    sh.delim = delim;
  }
  function meta(book) { return { id: book.id, name: book.name, sheets: book.sheets.map(function (s, i) { return { i: i, name: s.name, rows: s.rows.length, cols: s.cols, hidden: !!s.hidden, header: s.rows.length ? s.rows[0].split(SEP) : [] }; }) }; }
  // ---------- filter / cari / urut
  function lc(s) { return s.toLowerCase(); }
  function cellOf(row, c) { var p = 0; for (var k = 0; k < c; k++) { p = row.indexOf(SEP, p); if (p < 0) return ''; p++; } var e = row.indexOf(SEP, p); return e < 0 ? row.slice(p) : row.slice(p, e); }
  function numOf(v) { if (v === '') return NaN; var t = v.replace(/\s/g, ''); if (/^-?[\d.]+,\d+$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(/,/g, ''); return /^-?\d*\.?\d+(e-?\d+)?$/i.test(t) ? +t : NaN; }
  // filter kolom: "teks" (mengandung), "=teks", "!teks", ">10", "<10", ">=", "<=", "(kosong)"
  function colTest(f) {
    var v = String(f.v || '').trim(), lv = lc(v);
    if (lv === '(kosong)' || lv === '(empty)') return function (x) { return x === ''; };
    if (lv === '!(kosong)' || lv === '!(empty)') return function (x) { return x !== ''; };
    var m = v.match(/^(>=|<=|>|<)\s*(.+)$/);
    if (m) { var n = numOf(m[2]), op = m[1]; if (!isNaN(n)) return function (x) { var y = numOf(x); if (isNaN(y)) return false; return op === '>' ? y > n : op === '<' ? y < n : op === '>=' ? y >= n : y <= n; }; var sv = lc(m[2]); return function (x) { x = lc(x); return op === '>' ? x > sv : op === '<' ? x < sv : op === '>=' ? x >= sv : x <= sv; }; }
    if (v.charAt(0) === '=') { var eq = lc(v.slice(1)); return function (x) { return lc(x) === eq; }; }
    if (v.charAt(0) === '!') { var ne = lc(v.slice(1)); return function (x) { return lc(x).indexOf(ne) < 0; }; }
    return function (x) { return lc(x).indexOf(lv) >= 0; };
  }
  async function buildView(m) {
    var book = books[m.book]; if (!book) return;
    var sh = book.sheets[m.sheet], rows = sh.rows, start = m.header ? 1 : 0;
    var toks = String(m.q || '').toLowerCase().split(/\s+/).filter(Boolean);
    var fs = (m.filters || []).filter(function (f) { return String(f.v || '').trim() !== ''; }).map(function (f) { return { c: f.c, t: colTest(f) }; });
    var out = new Uint32Array(Math.max(0, rows.length - start)), n = 0, key = m.vid;
    latest[key] = m.req;
    for (var i = start; i < rows.length; i++) {
      if ((i & 65535) === 0 && i) { await sleep0(); if (latest[key] !== m.req) return; post({ op: 'vprog', vid: key, req: m.req, pct: Math.round(i / rows.length * 100) }); }
      var r = rows[i];
      if (toks.length) { var L = lc(r), ok = true; for (var t = 0; t < toks.length; t++) if (L.indexOf(toks[t]) < 0) { ok = false; break; } if (!ok) continue; }
      if (fs.length) { var ok2 = true; for (var f = 0; f < fs.length; f++) if (!fs[f].t(cellOf(r, fs[f].c))) { ok2 = false; break; } if (!ok2) continue; }
      out[n++] = i;
    }
    out = out.subarray(0, n);
    if (m.sort && m.sort.c >= 0) {
      var c = m.sort.c, keys = new Array(n), nums = new Float64Array(n), allNum = true;
      for (var k = 0; k < n; k++) { keys[k] = cellOf(rows[out[k]], c); nums[k] = numOf(keys[k]); if (keys[k] !== '' && isNaN(nums[k])) allNum = false; }
      if (latest[key] !== m.req) return;
      var ord = new Uint32Array(n); for (var o = 0; o < n; o++) ord[o] = o;
      var dir = m.sort.desc ? -1 : 1, col = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
      var arr = Array.prototype.slice.call(ord);
      arr.sort(allNum ? function (a, b) { var x = nums[a], y = nums[b]; if (isNaN(x)) return 1; if (isNaN(y)) return -1; return (x - y) * dir; } : function (a, b) { var x = keys[a], y = keys[b]; if (x === '') return y === '' ? 0 : 1; if (y === '') return -1; return col.compare(x, y) * dir; });
      var sorted = new Uint32Array(n); for (var q = 0; q < n; q++) sorted[q] = out[arr[q]];
      out = sorted;
    }
    if (latest[key] !== m.req) return;
    views[key] = { book: m.book, sheet: m.sheet, idx: out };
    post({ op: 'view', vid: key, req: m.req, total: n });
  }
  // cari di semua sheet (semua buku bila m.book kosong)
  async function search(m) {
    var key = 'global'; latest[key] = m.req;
    var toks = String(m.q || '').toLowerCase().split(/\s+/).filter(Boolean);
    var hitsB = [], hitsS = [], hitsR = [], per = [];
    if (toks.length) {
      var ids = m.book ? [m.book] : Object.keys(books);
      for (var b = 0; b < ids.length; b++) {
        var book = books[ids[b]];
        for (var s = 0; s < book.sheets.length; s++) {
          var rows = book.sheets[s].rows, c = 0;
          for (var i = 0; i < rows.length; i++) {
            if ((i & 65535) === 0 && i) { await sleep0(); if (latest[key] !== m.req) return; }
            var L = lc(rows[i]), ok = true;
            for (var t = 0; t < toks.length; t++) if (L.indexOf(toks[t]) < 0) { ok = false; break; }
            if (ok) { hitsB.push(ids[b]); hitsS.push(s); hitsR.push(i); c++; }
          }
          if (c) per.push({ book: ids[b], bookName: book.name, sheet: s, name: book.sheets[s].name, n: c });
        }
      }
    }
    if (latest[key] !== m.req) return;
    views[key] = { global: true, b: hitsB, s: Uint32Array.from(hitsS), r: Uint32Array.from(hitsR) };
    post({ op: 'search', req: m.req, total: hitsR.length, per: per });
  }
  function rowsOut(m) {
    var v = views[m.vid]; if (!v) { post({ op: 'rows', vid: m.vid, req: m.req, rows: [] }); return; }
    var out = [], end = Math.min(m.end, v.global ? v.r.length : v.idx.length);
    for (var i = m.start; i < end; i++) {
      if (v.global) { var bk = books[v.b[i]], sh = bk.sheets[v.s[i]]; out.push({ i: i, book: v.b[i], sheet: v.s[i], sheetName: sh.name, n: sh.nums[v.r[i]], ri: v.r[i], c: sh.rows[v.r[i]].split(SEP) }); }
      else { var sh2 = books[v.book].sheets[v.sheet], ri = v.idx[i]; out.push({ i: i, n: sh2.nums[ri], ri: ri, c: sh2.rows[ri].split(SEP) }); }
    }
    post({ op: 'rows', vid: m.vid, req: m.req, start: m.start, rows: out });
  }
  // posisi baris (indeks asli) di dalam view aktif -> untuk "lompat ke baris"
  function locate(m) { var v = views[m.vid], pos = -1; if (v && !v.global) for (var i = 0; i < v.idx.length; i++) if (v.idx[i] === m.ri) { pos = i; break; } post({ op: 'locate', vid: m.vid, req: m.req, pos: pos }); }
  async function stats(m) {
    var v = views[m.vid], sh = books[v.book].sheets[v.sheet], idx = v.idx, c = m.c, cap = 1000000;
    var counts = new Map(), empty = 0, nonEmpty = 0, nNum = 0, sum = 0, min = Infinity, max = -Infinity, lmin = Infinity, lmax = 0, capped = false;
    for (var i = 0; i < idx.length; i++) {
      if ((i & 131071) === 0 && i) await sleep0();
      var x = cellOf(sh.rows[idx[i]], c);
      if (x === '') { empty++; continue; }
      nonEmpty++;
      if (x.length < lmin) lmin = x.length; if (x.length > lmax) lmax = x.length;
      var y = numOf(x); if (!isNaN(y)) { nNum++; sum += y; if (y < min) min = y; if (y > max) max = y; }
      if (counts.size < cap || counts.has(x)) counts.set(x, (counts.get(x) || 0) + 1); else capped = true;
    }
    var dupVals = 0, dupRows = 0, top = [];
    counts.forEach(function (n, val) { if (n > 1) { dupVals++; dupRows += n; } if (top.length < 15 || n > top[top.length - 1][1]) { top.push([val, n]); top.sort(function (a, b) { return b[1] - a[1]; }); if (top.length > 15) top.pop(); } });
    post({ op: 'stats', vid: m.vid, req: m.req, c: c, rows: idx.length, empty: empty, filled: nonEmpty, distinct: counts.size, capped: capped, dupVals: dupVals, dupRows: dupRows, top: top.map(function (t) { return [t[0].slice(0, 200), t[1]]; }), num: nNum, sum: sum, min: nNum ? min : null, max: nNum ? max : null, avg: nNum ? sum / nNum : null, lmin: nonEmpty ? lmin : null, lmax: lmax });
  }
  // ---------- bandingkan dua sheet: kunci = kolom terpilih (nama header), kolom dicocokkan lewat header
  async function diff(m) {
    var A = books[m.a.book].sheets[m.a.sheet], B = books[m.b.book].sheets[m.b.sheet];
    var ha = A.rows.length ? A.rows[0].split(SEP) : [], hb = B.rows.length ? B.rows[0].split(SEP) : [];
    var hdr = m.header !== false, names = [], mapA = {}, mapB = {};
    if (hdr) { ha.forEach(function (h, i) { if (names.indexOf(h) < 0) names.push(h); mapA[h] = i; }); hb.forEach(function (h, i) { if (names.indexOf(h) < 0) names.push(h); mapB[h] = i; }); }
    else { var w = Math.max(A.cols, B.cols); for (var k = 0; k < w; k++) { names.push('#' + (k + 1)); mapA['#' + (k + 1)] = k; mapB['#' + (k + 1)] = k; } }
    var keys = (m.keys && m.keys.length ? m.keys : []).filter(function (k) { return names.indexOf(k) >= 0; });
    function rowKey(row, map) { if (!keys.length) return row; return keys.map(function (k) { return map[k] === undefined ? '' : cellOf(row, map[k]).trim().toLowerCase(); }).join(SEP); }
    function proj(row, map) { var c = row.split(SEP); return names.map(function (n) { return map[n] === undefined ? '' : (c[map[n]] || ''); }); }
    var st = hdr ? 1 : 0, ia = new Map(), dupA = 0;
    for (var i = st; i < A.rows.length; i++) { if ((i & 65535) === 0 && i) await sleep0(); var ka = rowKey(A.rows[i], mapA); if (ia.has(ka)) dupA++; else ia.set(ka, i); }
    var out = [], same = 0, dupB = 0, seenB = new Set(), ign = m.ignoreCase;
    for (var j = st; j < B.rows.length; j++) {
      if ((j & 65535) === 0 && j) { await sleep0(); post({ op: 'dprog', req: m.req, pct: Math.round(j / B.rows.length * 100) }); }
      var kb = rowKey(B.rows[j], mapB);
      if (seenB.has(kb)) { dupB++; continue; }
      seenB.add(kb);
      var ai = ia.get(kb);
      if (ai === undefined) { out.push({ t: 'add', b: j }); continue; }
      ia.delete(kb);
      var pa = proj(A.rows[ai], mapA), pb = proj(B.rows[j], mapB), ch = [];
      for (var c = 0; c < names.length; c++) { var x = pa[c].trim(), y = pb[c].trim(); if (ign) { x = x.toLowerCase(); y = y.toLowerCase(); } if (x !== y) ch.push(c); }
      if (ch.length) out.push({ t: 'chg', a: ai, b: j, ch: ch }); else same++;
    }
    ia.forEach(function (ai) { out.push({ t: 'del', a: ai }); });
    var cnt = { add: 0, del: 0, chg: 0 }, colChg = names.map(function () { return 0; });
    out.forEach(function (o) { cnt[o.t]++; if (o.ch) o.ch.forEach(function (c) { colChg[c]++; }); });
    views.diff = { A: A, B: B, mapA: mapA, mapB: mapB, names: names, list: out, proj: proj };
    post({ op: 'diff', req: m.req, names: names, keys: keys, same: same, add: cnt.add, del: cnt.del, chg: cnt.chg, dupA: dupA, dupB: dupB, colChg: colChg, total: out.length });
  }
  function diffRows(m) {
    var d = views.diff, out = [];
    if (d) {
      var list = m.only ? d.list.filter(function (o) { return o.t === m.only; }) : d.list;
      for (var i = m.start; i < Math.min(m.end, list.length); i++) { var o = list[i]; out.push({ i: i, t: o.t, ch: o.ch || [], na: o.a !== undefined ? d.A.nums[o.a] : null, nb: o.b !== undefined ? d.B.nums[o.b] : null, a: o.a !== undefined ? d.proj(d.A.rows[o.a], d.mapA) : null, b: o.b !== undefined ? d.proj(d.B.rows[o.b], d.mapB) : null }); }
      post({ op: 'drows', req: m.req, start: m.start, rows: out, total: list.length });
    }
  }
  // export view -> CSV (dibangun di worker, dikirim sebagai Blob)
  function csvCell(v) { return /[",\n\r;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportView(m) {
    var v = views[m.vid], parts = [], sh = books[v.book].sheets[v.sheet];
    if (m.header && sh.rows.length) parts.push(sh.rows[0].split(SEP).map(csvCell).join(',') + '\r\n');
    for (var i = 0; i < v.idx.length; i++) parts.push(sh.rows[v.idx[i]].split(SEP).map(csvCell).join(',') + '\r\n');
    post({ op: 'export', req: m.req, blob: new Blob(['\ufeff'].concat(parts), { type: 'text/csv' }) });
  }
  self.onmessage = async function (e) {
    var m = e.data;
    try {
      if (m.op === 'load') {
        var t0 = Date.now(), nm = m.file.name.toLowerCase();
        if (/\.(xlsx|xlsm)$/.test(nm)) await loadXlsx(m.id, m.file); else await loadCsv(m.id, m.file);
        post({ op: 'loaded', id: m.id, ms: Date.now() - t0, book: meta(books[m.id]) });
      } else if (m.op === 'view') await buildView(m);
      else if (m.op === 'rows') rowsOut(m);
      else if (m.op === 'search') await search(m);
      else if (m.op === 'locate') locate(m);
      else if (m.op === 'stats') await stats(m);
      else if (m.op === 'diff') await diff(m);
      else if (m.op === 'drows') diffRows(m);
      else if (m.op === 'export') exportView(m);
      else if (m.op === 'drop') { delete books[m.id]; Object.keys(views).forEach(function (k) { var v = views[k]; if (v && (v.book === m.id || (v.global && v.b.indexOf(m.id) >= 0))) delete views[k]; }); }
    } catch (err) { post({ op: 'error', id: m.id, req: m.req, msg: String((err && err.message) || err) }); }
  };
}
// Bookmarklet di Google Sheets: unduh SEMUA tab sebagai xlsx (export milik Google, memakai
// login Anda sendiri) lalu kirim file-nya ke tab scanner. Mandiri, ES5, tanpa innerHTML/eval.
function sheetHookMain(cfg) {
  var m = location.pathname.match(/\/spreadsheets\/d\/([\w-]+)/);
  var box = document.createElement('div');
  Object.assign(box.style, { position: 'fixed', right: '12px', bottom: '12px', width: '300px', background: 'linear-gradient(155deg, #221914 0%, #14100d 100%)', color: '#f3ece4', font: '12px/1.45 Segoe UI,system-ui,sans-serif', border: '2px solid #22c55e', borderRadius: '10px', boxShadow: '0 12px 30px rgba(0,0,0,.55)', zIndex: 2147483647, padding: '10px' });
  var t = document.createElement('b'); t.textContent = "📊 Sheet Hook"; box.appendChild(t);
  var info = document.createElement('div'); info.style.margin = '6px 0'; box.appendChild(info);
  var row = document.createElement('div'); Object.assign(row.style, { display: 'flex', gap: '4px', flexWrap: 'wrap' }); box.appendChild(row);
  function btn(label, fn) { var b = document.createElement('button'); b.textContent = label; Object.assign(b.style, { background: '#2a2019', color: '#f3ece4', border: '1px solid #453429', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', font: 'inherit' }); b.onclick = fn; row.appendChild(b); return b; }
  btn("Tutup", function () { box.remove(); });
  document.body.appendChild(box);
  if (!m) { info.textContent = "Buka file Google Sheets dulu (docs.google.com/spreadsheets/d/...)."; return; }
  var url = '/spreadsheets/d/' + m[1] + '/export?format=xlsx';
  var title = (document.title || 'sheet').replace(/\s*-\s*Google (Sheets|Spreadsheet).*$/i, '').trim() || 'sheet';
  var w = null;
  if (cfg.app) { try { w = window.open(cfg.app.split('#')[0] + '#sheet-hook', 'scaSheetHook'); } catch (e) { w = null; } }
  function fallback(msg) {
    info.textContent = msg + " Klik Unduh xlsx, lalu seret file-nya ke tab Sheet Viewer.";
    btn("Unduh xlsx", function () { location.href = url; });
  }
  info.textContent = "Mengunduh semua tab sebagai xlsx...";
  fetch(url, { credentials: 'include' }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.arrayBuffer();
  }).then(function (buf) {
    info.textContent = "Terunduh " + Math.round(buf.byteLength / 1024) + " KB.";
    if (!w) { fallback("Tab scanner tidak terbuka (popup diblokir / file lokal)."); return; }
    var target = cfg.origin && cfg.origin !== 'null' ? cfg.origin : '*', ok = false, n = 0;
    window.addEventListener('message', function (e) {
      if (e.source !== w || !e.data) return;
      if (e.data.type === 'sheet-ready' && !ok) { ok = true; try { w.postMessage({ type: 'sheet-file', name: title + '.xlsx', buf: buf }, target, [buf]); info.textContent = "Terkirim ke Sheet Viewer."; } catch (err) { fallback("Gagal kirim: " + err.message + "."); } }
    });
    (function ping() { if (ok || ++n > 50 || w.closed) { if (!ok) fallback("Tab scanner tidak merespons."); return; } try { w.postMessage({ type: 'sheet-hello' }, target); } catch (e) { /* belum siap */ } setTimeout(ping, 300); })();
  }).catch(function (err) { fallback("Unduh langsung gagal (" + err.message + ")."); });
}
// ---- 1 Master Bookmarklet (All-in-One Hook): auto-detect situs aktif atau tampilkan pemilih alat.
function masterHookMain(cfg, tools) {
  if (window.__scaMasterPanel) { try { window.__scaMasterPanel.remove(); } catch (e) { /* abaikan */ } window.__scaMasterPanel = null; }
  var host = String(location.hostname || '').toLowerCase();
  var path = String(location.pathname || '');
  var isSwagger = !!(document.getElementById('swagger-ui') || document.querySelector('redoc, [spec-url], .swagger-ui') || /swagger|api-docs|openapi/i.test(path + location.href) || (window.ui && typeof window.ui.specSelectors === 'object'));
  if (!window.__scaMasterAuto) {
    if (/(^|\.)whatsapp\.com$/.test(host) && !window.__waHook) { window.__scaMasterAuto = 'wa'; tools.wa(cfg); return; }
    if (/(^|\.)shopee\./.test(host) && !window.__shpHook) { window.__scaMasterAuto = 'shp'; tools.shp(cfg); return; }
    if (host === 'docs.google.com' && /\/spreadsheets\//.test(path)) { window.__scaMasterAuto = 'sheet'; tools.sheet(cfg); return; }
    if (isSwagger && !window.__swag) { window.__scaMasterAuto = 'swag'; tools.swag({}); return; }
  }
  var box = document.createElement('div');
  window.__scaMasterPanel = box;
  Object.assign(box.style, { position: 'fixed', right: '16px', top: '64px', width: '310px', background: 'linear-gradient(155deg, #241b15 0%, #14100d 100%)', color: '#f3ece4', font: '12px/1.45 Segoe UI,system-ui,sans-serif', border: '1.5px solid #c87840', borderRadius: '12px', boxShadow: '0 14px 36px rgba(0,0,0,.6)', zIndex: 2147483647, padding: '10px 12px' });
  try { if (window.__hookGuard) window.__hookGuard.add(box); } catch (e) { /* abaikan */ }
  var head = document.createElement('div');
  Object.assign(head.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', cursor: 'move', userSelect: 'none' });
  var ttl = document.createElement('b'); ttl.textContent = '⚡ Master Hook'; ttl.style.color = '#e59a63'; head.appendChild(ttl);
  var closeB = document.createElement('button'); closeB.textContent = '✕'; closeB.title = "Tutup";
  Object.assign(closeB.style, { background: '#2a2019', color: '#f3ece4', border: '1px solid #453429', borderRadius: '5px', padding: '1px 7px', cursor: 'pointer' });
  closeB.onclick = function () { box.remove(); window.__scaMasterPanel = null; };
  head.appendChild(closeB);
  var sub = document.createElement('div');
  Object.assign(sub.style, { color: '#aa9888', fontSize: '11.5px', marginBottom: '8px' });
  sub.textContent = "Pilih alat untuk halaman ini:" + ' ' + (host || 'local');
  var grid = document.createElement('div');
  Object.assign(grid.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' });
  function addChoice(label, runFn, accent) {
    var b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, { background: accent ? 'linear-gradient(135deg, #c87840 0%, #985225 100%)' : '#291f19', color: '#f3ece4', border: '1px solid ' + (accent ? '#c87840' : '#453429'), borderRadius: '7px', padding: '6px 8px', cursor: 'pointer', font: 'inherit', textAlign: 'left', fontWeight: accent ? '600' : '500' });
    b.onclick = function () { box.remove(); window.__scaMasterPanel = null; runFn(); };
    grid.appendChild(b);
  }
  addChoice("🐞 Hook Debug (API)", function () { tools.api(); }, true);
  addChoice("🎬 Puppeteer Rec/Play", function () { tools.pupLaunch(cfg, tools.pupRec, tools.pupPlay); }, false);
  addChoice("📜 Swag (OpenAPI)", function () { tools.swag({}); }, isSwagger);
  addChoice("💬 WA Hook", function () { tools.wa(cfg); }, /(^|\.)whatsapp\.com$/.test(host));
  addChoice("🛒 Shopee Hook", function () { tools.shp(cfg); }, /(^|\.)shopee\./.test(host));
  addChoice("📊 Sheet Hook", function () { tools.sheet(cfg); }, host === 'docs.google.com');
  box.appendChild(head); box.appendChild(sub); box.appendChild(grid);
  document.body.appendChild(box);
  var drag = false, dx = 0, dy = 0;
  head.addEventListener('mousedown', function (e) {
    if (e.target === closeB) return;
    var r = box.getBoundingClientRect(); drag = true; dx = e.clientX - r.left; dy = e.clientY - r.top; e.preventDefault();
  });
  window.addEventListener('mousemove', function (e) {
    if (!drag) return;
    box.style.left = Math.max(0, Math.min(window.innerWidth - box.offsetWidth, e.clientX - dx)) + 'px';
    box.style.top = Math.max(0, Math.min(window.innerHeight - box.offsetHeight, e.clientY - dy)) + 'px';
    box.style.right = 'auto';
  });
  window.addEventListener('mouseup', function () { drag = false; });
}
function masterHookScript() {
  const cfg = JSON.stringify(pupAppCfg());
  const src = '(function () {\n'
    + '(' + hookGuardInstall.toString() + ')();\n'
    + 'function apiHookMain() {\n' + HOOK_BODY_LINES.join('\n') + '\n}\n'
    + SWAG_FNS.map(f => f.toString()).join('\n') + '\n'
    + 'var tools = {\n'
    + '  api: apiHookMain,\n'
    + '  wa: ' + waHookMain.toString() + ',\n'
    + '  shp: ' + shpHookMain.toString() + ',\n'
    + '  sheet: ' + sheetHookMain.toString() + ',\n'
    + '  swag: ' + swagPageMain.toString() + ',\n'
    + '  pupLaunch: ' + pupLauncher.toString() + ',\n'
    + '  pupRec: ' + pupRecorderMain.toString() + ',\n'
    + '  pupPlay: ' + pupPlayerMain.toString() + '\n'
    + '};\n'
    + '(' + masterHookMain.toString() + ')(' + cfg + ', tools);\n'
    + '})();';
  return localizeScript(src);
}
// ---- Sheet Viewer: daftar file terakhir (Blob asli disimpan di IndexedDB agar bisa dibuka lagi tanpa pilih ulang)
const SV_DB = 'scaSheetRecent', SV_STORE = 'files';
function svDb() { return new Promise((res, rej) => { const r = indexedDB.open(SV_DB, 1); r.onupgradeneeded = () => { r.result.createObjectStore(SV_STORE, { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function svTx(mode, work) { return svDb().then(db => new Promise((res, rej) => { const tx = db.transaction(SV_STORE, mode), st = tx.objectStore(SV_STORE); let out; work(st, v => { out = v; }); tx.oncomplete = () => { db.close(); res(out); }; tx.onerror = () => { db.close(); rej(tx.error); }; })); }
function svRecentList() { return svTx('readonly', (st, set) => { const q = st.getAll(); q.onsuccess = () => set((q.result || []).map(r => ({ id: r.id, name: r.name, size: r.size, t: r.t })).sort((a, b) => b.t - a.t)); }); }
function svRecentGet(id) { return svTx('readonly', (st, set) => { const q = st.get(id); q.onsuccess = () => { const r = q.result; set(r ? new File([r.blob], r.name) : null); }; }); }
function svRecentDel(id) { return svTx('readwrite', st => { st.delete(id); }); }
function svRecentPut(f) {
  if (f.size > 400 * 1024 * 1024) return Promise.resolve();
  const id = f.name + '|' + f.size;
  return svTx('readwrite', st => {
    st.put({ id, name: f.name, size: f.size, t: Date.now(), blob: f });
    const q = st.getAll();
    q.onsuccess = () => { (q.result || []).sort((a, b) => b.t - a.t).slice(8).forEach(r => st.delete(r.id)); };
  });
}

const SV_I18N = {
  id: {
    tab_sheet: 'Sheet Viewer', sv_title: 'Sheet Viewer — cari di semua tab xlsx/csv, filter, statistik, bandingkan',
    sv_intro: 'Drop file xlsx/csv (bisa beberapa): semua tab langsung terbaca dan bisa dicari sekaligus tanpa pindah-pindah tab. Diproses di Web Worker dengan tabel virtual, jadi file jutaan baris tetap lancar. Tidak ada yang diunggah ke server.',
    sv_drop: 'Drop file xlsx / csv di sini, atau klik untuk memilih', sv_drop_sub: 'xlsx, xlsm, csv, tsv (pemisah , ; tab | dideteksi otomatis). Beberapa file sekaligus boleh.',
    sv_hook_desc: 'Seret ke bookmark bar, lalu klik saat membuka Google Sheets: semua tab diunduh sebagai xlsx dan langsung dibuka di sini.',
    sv_recent: 'File terakhir', sv_forget: 'Lupakan', sv_loading: 'membaca...', sv_rows: 'baris', sv_close: 'Tutup file',
    sv_p_strings: 'membaca teks bersama...', sv_p_sheet: 'tab {i}/{n} "{s}": {r} baris',
    sv_gsearch_ph: '🔎 Cari di SEMUA tab & file (beberapa kata = semua harus ada di baris yang sama)', sv_all_files: 'Semua file',
    sv_compare: 'Bandingkan', sv_searching: 'mencari...', sv_hits: 'baris cocok di:', sv_nohit: 'Tidak ada baris yang cocok.', sv_sheet: 'Tab', sv_open_hit: 'Klik untuk membuka baris ini di tab-nya',
    sv_compare_t: 'Bandingkan dua tab / file', sv_old: 'lama', sv_new: 'baru', sv_key: 'Kolom kunci', sv_key_tip: 'Kolom pengenal baris (mis. ID, kode, NIP). Ctrl+klik untuk lebih dari satu. Tanpa kunci: baris dibandingkan utuh (hanya tambah/hapus).',
    sv_ignore_case: 'Abaikan huruf besar/kecil', sv_compare_run: 'Bandingkan',
    sv_compare_desc: 'Kolom dicocokkan lewat nama header, jadi urutan kolom boleh beda. Hasil: baris baru, terhapus, dan berubah (sel lama dicoret → nilai baru).',
    sv_comparing: 'membandingkan...', sv_d_add: 'Baru', sv_d_del: 'Terhapus', sv_d_chg: 'Berubah', sv_d_same: 'Sama', sv_d_dup: 'kunci ganda dilewati: A {a}, B {b}', sv_back_sheet: 'Kembali ke tabel', sv_show_diff: 'Lihat hasil banding',
    sv_inq_ph: 'Cari di tab ini...', sv_header: 'Baris 1 = header', sv_colw: 'Lebar kolom', sv_shown: '{n} dari {t} baris', sv_filtering: 'memfilter...',
    sv_filter_help: 'Filter per kolom: teks = mengandung, =teks sama persis, !teks tidak mengandung, >100 / <=5 angka atau tanggal, (kosong) / !(kosong). Klik judul kolom untuk urut, 📊 untuk statistik.',
    sv_filter_ph: 'filter', sv_stats_tip: 'Statistik kolom (jumlah, kosong, duplikat, nilai terbanyak)',
    sv_s_rows: 'Baris', sv_s_filled: 'Terisi', sv_s_empty: 'Kosong', sv_s_distinct: 'Nilai unik', sv_s_dup: 'Nilai duplikat', sv_s_num: 'Angka', sv_s_sum: 'jumlah', sv_s_avg: 'rata-rata', sv_s_len: 'Panjang teks', sv_s_top: 'Terbanyak', sv_s_pick: 'Klik untuk filter nilai ini',
    sv_err_type: 'Pilih file .xlsx, .xlsm, .csv, .tsv atau .txt.', sv_err_zip: 'File bukan xlsx yang valid (xls lama: simpan ulang sebagai xlsx).',
    sv_note: 'Statistik, filter, dan banding mengikuti hasil filter tab yang aktif. File .xls lama (Excel 97-2003) belum didukung: simpan ulang sebagai xlsx. File terakhir disimpan di browser ini (maks 8 file, masing-masing ≤ 400 MB).',
    grp_sheet_title: 'Sheet Viewer', grp_sheet_desc: 'Tidak memakai API: file dibaca lokal di browser (Web Worker).'
  },
  en: {
    tab_sheet: 'Sheet Viewer', sv_title: 'Sheet Viewer — search every xlsx/csv tab, filter, stats, compare',
    sv_intro: 'Drop xlsx/csv files (several at once): every tab is read and can be searched in one go, no switching tabs. Processed in a Web Worker with a virtual table, so files with millions of rows stay smooth. Nothing is uploaded.',
    sv_drop: 'Drop xlsx / csv files here, or click to choose', sv_drop_sub: 'xlsx, xlsm, csv, tsv (delimiter , ; tab | detected automatically). Several files at once are fine.',
    sv_hook_desc: 'Drag to the bookmarks bar, then click it on a Google Sheets file: every tab is downloaded as xlsx and opened here.',
    sv_recent: 'Recent files', sv_forget: 'Forget', sv_loading: 'reading...', sv_rows: 'rows', sv_close: 'Close file',
    sv_p_strings: 'reading shared strings...', sv_p_sheet: 'tab {i}/{n} "{s}": {r} rows',
    sv_gsearch_ph: '🔎 Search ALL tabs & files (several words = all must be in the same row)', sv_all_files: 'All files',
    sv_compare: 'Compare', sv_searching: 'searching...', sv_hits: 'matching rows in:', sv_nohit: 'No matching rows.', sv_sheet: 'Tab', sv_open_hit: 'Click to open this row in its tab',
    sv_compare_t: 'Compare two tabs / files', sv_old: 'old', sv_new: 'new', sv_key: 'Key columns', sv_key_tip: 'Columns that identify a row (e.g. ID, code, employee no.). Ctrl+click for more than one. Without a key rows are compared whole (added/removed only).',
    sv_ignore_case: 'Ignore case', sv_compare_run: 'Compare',
    sv_compare_desc: 'Columns are matched by header name, so the column order may differ. Result: added, removed and changed rows (old value struck through → new value).',
    sv_comparing: 'comparing...', sv_d_add: 'Added', sv_d_del: 'Removed', sv_d_chg: 'Changed', sv_d_same: 'Same', sv_d_dup: 'duplicate keys skipped: A {a}, B {b}', sv_back_sheet: 'Back to table', sv_show_diff: 'Show comparison',
    sv_inq_ph: 'Search this tab...', sv_header: 'Row 1 = header', sv_colw: 'Column width', sv_shown: '{n} of {t} rows', sv_filtering: 'filtering...',
    sv_filter_help: 'Column filter: text = contains, =text exact, !text does not contain, >100 / <=5 numbers or dates, (empty) / !(empty). Click a column title to sort, 📊 for stats.',
    sv_filter_ph: 'filter', sv_stats_tip: 'Column stats (count, empty, duplicates, top values)',
    sv_s_rows: 'Rows', sv_s_filled: 'Filled', sv_s_empty: 'Empty', sv_s_distinct: 'Distinct', sv_s_dup: 'Duplicate values', sv_s_num: 'Numbers', sv_s_sum: 'sum', sv_s_avg: 'average', sv_s_len: 'Text length', sv_s_top: 'Top', sv_s_pick: 'Click to filter by this value',
    sv_err_type: 'Choose a .xlsx, .xlsm, .csv, .tsv or .txt file.', sv_err_zip: 'Not a valid xlsx file (old .xls: save it again as xlsx).',
    sv_note: 'Stats, filters and compare follow the filtered result of the active tab. Old .xls files (Excel 97-2003) are not supported yet: save them as xlsx. Recent files are kept in this browser (max 8 files, each ≤ 400 MB).',
    grp_sheet_title: 'Sheet Viewer', grp_sheet_desc: 'Uses no API: files are read locally in the browser (Web Worker).'
  }
};
Object.keys(SV_I18N).forEach(l => { I18N[l] = Object.assign({}, SV_I18N[l], I18N[l] || {}); });
// ============================================================
//  Studio Gambar: kompres, resize (Lanczos/bicubic/area/nearest), perbaiki buram
//  (unsharp, Richardson-Lucy, denoise), sensor area, hapus EXIF, upscale AI lokal
//  (Real-ESRGAN via onnxruntime-web) dan AI lewat API milik user.
//  Operasi piksel berat jalan di Web Worker (fungsi mandiri, dijadikan teks).
// ============================================================
function imgWorkerMain() {
  function post(m, tr) { self.postMessage(m, tr || []); }
  // ---------- resample terpisah (horizontal lalu vertikal), alpha premultiplied
  function sinc(x) { if (x === 0) return 1; x *= Math.PI; return Math.sin(x) / x; }
  function cubicBC(B, C) {
    return function (x) {
      x = Math.abs(x);
      if (x < 1) return ((12 - 9 * B - 6 * C) * x * x * x + (-18 + 12 * B + 6 * C) * x * x + (6 - 2 * B)) / 6;
      if (x < 2) return ((-B - 6 * C) * x * x * x + (6 * B + 30 * C) * x * x + (-12 * B - 48 * C) * x + (8 * B + 24 * C)) / 6;
      return 0;
    };
  }
  var FILTERS = {
    lanczos3: { s: 3, f: function (x) { x = Math.abs(x); return x < 3 ? sinc(x) * sinc(x / 3) : 0; } },
    lanczos2: { s: 2, f: function (x) { x = Math.abs(x); return x < 2 ? sinc(x) * sinc(x / 2) : 0; } },
    catmull: { s: 2, f: cubicBC(0, 0.5) },
    mitchell: { s: 2, f: cubicBC(1 / 3, 1 / 3) },
    bilinear: { s: 1, f: function (x) { x = Math.abs(x); return x < 1 ? 1 - x : 0; } },
    area: { s: 0.5, f: function (x) { return Math.abs(x) <= 0.5 ? 1 : 0; } }
  };
  function weights(sn, dn, flt) {
    var scale = dn / sn, fs = scale < 1 ? 1 / scale : 1, sup = flt.s * fs, out = [];
    for (var x = 0; x < dn; x++) {
      var c = (x + 0.5) / scale, l = Math.max(0, Math.floor(c - sup)), r = Math.min(sn - 1, Math.ceil(c + sup)), ws = [], sum = 0;
      for (var j = l; j <= r; j++) { var w = flt.f((j + 0.5 - c) / fs); ws.push(w); sum += w; }
      if (!sum) { ws = [1]; l = Math.min(sn - 1, Math.max(0, Math.floor(c))); sum = 1; }
      out.push({ l: l, w: Float32Array.from(ws.map(function (v) { return v / sum; })) });
    }
    return out;
  }
  function resize(src, sw, sh, dw, dh, alg) {
    var dst = new Uint8ClampedArray(dw * dh * 4);
    if (alg === 'nearest') {
      for (var y = 0; y < dh; y++) { var sy = Math.min(sh - 1, Math.floor((y + 0.5) * sh / dh)); for (var x = 0; x < dw; x++) { var sx = Math.min(sw - 1, Math.floor((x + 0.5) * sw / dw)), si = (sy * sw + sx) * 4, di = (y * dw + x) * 4; dst[di] = src[si]; dst[di + 1] = src[si + 1]; dst[di + 2] = src[si + 2]; dst[di + 3] = src[si + 3]; } }
      return dst;
    }
    var flt = FILTERS[alg] || FILTERS.lanczos3;
    var pre = new Float32Array(sw * sh * 4);
    for (var i = 0; i < sw * sh; i++) { var a = src[i * 4 + 3] / 255; pre[i * 4] = src[i * 4] * a; pre[i * 4 + 1] = src[i * 4 + 1] * a; pre[i * 4 + 2] = src[i * 4 + 2] * a; pre[i * 4 + 3] = src[i * 4 + 3]; }
    var wx = weights(sw, dw, flt), tmp = new Float32Array(dw * sh * 4);
    for (var yy = 0; yy < sh; yy++) {
      if ((yy & 255) === 0) post({ op: 'prog', pct: Math.round(yy / sh * 50) });
      var ro = yy * sw * 4, to = yy * dw * 4;
      for (var xx = 0; xx < dw; xx++) { var W = wx[xx], r0 = 0, g0 = 0, b0 = 0, a0 = 0, p = ro + W.l * 4; for (var k = 0; k < W.w.length; k++, p += 4) { var ww = W.w[k]; r0 += pre[p] * ww; g0 += pre[p + 1] * ww; b0 += pre[p + 2] * ww; a0 += pre[p + 3] * ww; } var q = to + xx * 4; tmp[q] = r0; tmp[q + 1] = g0; tmp[q + 2] = b0; tmp[q + 3] = a0; }
    }
    var wy = weights(sh, dh, flt);
    for (var y2 = 0; y2 < dh; y2++) {
      if ((y2 & 255) === 0) post({ op: 'prog', pct: 50 + Math.round(y2 / dh * 50) });
      var V = wy[y2];
      for (var x2 = 0; x2 < dw; x2++) {
        var r1 = 0, g1 = 0, b1 = 0, a1 = 0, pp = (V.l * dw + x2) * 4, st = dw * 4;
        for (var k2 = 0; k2 < V.w.length; k2++, pp += st) { var w2 = V.w[k2]; r1 += tmp[pp] * w2; g1 += tmp[pp + 1] * w2; b1 += tmp[pp + 2] * w2; a1 += tmp[pp + 3] * w2; }
        var d = (y2 * dw + x2) * 4, al = a1 / 255;
        if (al > 0.001) { dst[d] = r1 / al; dst[d + 1] = g1 / al; dst[d + 2] = b1 / al; } dst[d + 3] = a1;
      }
    }
    return dst;
  }
  // ---------- blur gaussian terpisah pada float planar
  function gaussK(sigma) { var r = Math.max(1, Math.ceil(sigma * 3)), k = new Float32Array(r * 2 + 1), s = 0; for (var i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); s += k[i + r]; } for (var j = 0; j < k.length; j++) k[j] /= s; return k; }
  function blurPlane(p, w, h, sigma) {
    var k = gaussK(sigma), r = (k.length - 1) / 2, t = new Float32Array(w * h), o = new Float32Array(w * h);
    for (var y = 0; y < h; y++) { var row = y * w; for (var x = 0; x < w; x++) { var s = 0; for (var i = -r; i <= r; i++) { var xx = x + i; xx = xx < 0 ? 0 : xx >= w ? w - 1 : xx; s += p[row + xx] * k[i + r]; } t[row + x] = s; } }
    for (var y2 = 0; y2 < h; y2++) for (var x2 = 0; x2 < w; x2++) { var s2 = 0; for (var j = -r; j <= r; j++) { var yy = y2 + j; yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy; s2 += t[yy * w + x2] * k[j + r]; } o[y2 * w + x2] = s2; }
    return o;
  }
  // ---------- YCbCr (deblur/sharpen di luminance saja: lebih cepat, warna tidak belang)
  function toY(d, n) { var Y = new Float32Array(n); for (var i = 0; i < n; i++) Y[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; return Y; }
  function applyY(d, n, Y0, Y1) { for (var i = 0; i < n; i++) { var dv = Y1[i] - Y0[i]; d[i * 4] += dv; d[i * 4 + 1] += dv; d[i * 4 + 2] += dv; } }
  function unsharp(d, w, h, amount, radius, threshold) {
    var n = w * h, Y = toY(d, n), B = blurPlane(Y, w, h, radius), Y1 = new Float32Array(n);
    for (var i = 0; i < n; i++) { var diff = Y[i] - B[i]; Y1[i] = Math.abs(diff) > threshold ? Y[i] + amount * diff : Y[i]; }
    applyY(d, n, Y, Y1);
  }
  // PSF gerak: garis panjang L dengan sudut deg, disampling bilinear
  function motionConv(p, w, h, L, deg) {
    var o = new Float32Array(w * h), n = Math.max(2, Math.round(L)), dx = Math.cos(deg * Math.PI / 180), dy = Math.sin(deg * Math.PI / 180);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var s = 0;
      for (var k = 0; k < n; k++) {
        var t = k - (n - 1) / 2, fx = x + t * dx, fy = y + t * dy;
        var x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
        var X0 = x0 < 0 ? 0 : x0 >= w ? w - 1 : x0, X1 = x0 + 1 < 0 ? 0 : x0 + 1 >= w ? w - 1 : x0 + 1, Y0 = y0 < 0 ? 0 : y0 >= h ? h - 1 : y0, Y1 = y0 + 1 < 0 ? 0 : y0 + 1 >= h ? h - 1 : y0 + 1;
        s += (p[Y0 * w + X0] * (1 - ax) + p[Y0 * w + X1] * ax) * (1 - ay) + (p[Y1 * w + X0] * (1 - ax) + p[Y1 * w + X1] * ax) * ay;
      }
      o[y * w + x] = s / n;
    }
    return o;
  }
  function deconv(d, w, h, kind, a, b, iters) {
    var n = w * h, Y = toY(d, n), obs = new Float32Array(n), u = new Float32Array(n);
    for (var i = 0; i < n; i++) { obs[i] = Math.max(1, Y[i]); u[i] = obs[i]; }
    var conv = kind === 'motion' ? function (p) { return motionConv(p, w, h, a, b); } : function (p) { return blurPlane(p, w, h, a); };
    for (var it = 0; it < iters; it++) {
      post({ op: 'prog', pct: Math.round(it / iters * 100) });
      var c = conv(u), ratio = new Float32Array(n);
      for (var j = 0; j < n; j++) ratio[j] = obs[j] / Math.max(1e-3, c[j]);
      var cr = conv(ratio);
      for (var k = 0; k < n; k++) { var v = u[k] * cr[k]; u[k] = v < 0 ? 0 : v > 255 ? 255 : v; }
    }
    applyY(d, n, Y, u);
  }
  function denoise(d, w, h, strength) {
    var src = d.slice(), sr = strength, R = 2, ss = 2 * 1.5 * 1.5, sr2 = 2 * sr * sr;
    var sw = new Float32Array((2 * R + 1) * (2 * R + 1)), q = 0;
    for (var j = -R; j <= R; j++) for (var i = -R; i <= R; i++) sw[q++] = Math.exp(-(i * i + j * j) / ss);
    for (var y = 0; y < h; y++) {
      if ((y & 127) === 0) post({ op: 'prog', pct: Math.round(y / h * 100) });
      for (var x = 0; x < w; x++) {
        var c = (y * w + x) * 4, r0 = src[c], g0 = src[c + 1], b0 = src[c + 2], sr0 = 0, sg = 0, sb = 0, sw0 = 0, m = 0;
        for (var dy = -R; dy <= R; dy++) { var yy = y + dy; yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy; for (var dx = -R; dx <= R; dx++, m++) { var xx = x + dx; xx = xx < 0 ? 0 : xx >= w ? w - 1 : xx; var p = (yy * w + xx) * 4, dr = src[p] - r0, dg = src[p + 1] - g0, db = src[p + 2] - b0, wgt = sw[m] * Math.exp(-(dr * dr + dg * dg + db * db) / (3 * sr2)); sr0 += src[p] * wgt; sg += src[p + 1] * wgt; sb += src[p + 2] * wgt; sw0 += wgt; } }
        d[c] = sr0 / sw0; d[c + 1] = sg / sw0; d[c + 2] = sb / sw0;
      }
    }
  }
  function autoContrast(d, n) {
    var hist = new Uint32Array(256);
    for (var i = 0; i < n; i++) hist[Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2])]++;
    var lo = 0, hi = 255, c = 0, cut = n * 0.005;
    for (; lo < 255; lo++) { c += hist[lo]; if (c > cut) break; }
    c = 0; for (; hi > 0; hi--) { c += hist[hi]; if (c > cut) break; }
    if (hi - lo < 10) return;
    var s = 255 / (hi - lo);
    for (var k = 0; k < n; k++) { d[k * 4] = (d[k * 4] - lo) * s; d[k * 4 + 1] = (d[k * 4 + 1] - lo) * s; d[k * 4 + 2] = (d[k * 4 + 2] - lo) * s; }
  }
  self.onmessage = function (e) {
    var m = e.data, d = new Uint8ClampedArray(m.buf), w = m.w, h = m.h;
    try {
      var t0 = Date.now();
      if (m.op === 'resize') { var out = resize(d, w, h, m.dw, m.dh, m.alg); post({ op: 'done', id: m.id, buf: out.buffer, w: m.dw, h: m.dh, ms: Date.now() - t0 }, [out.buffer]); return; }
      (m.steps || []).forEach(function (s) {
        post({ op: 'step', name: s.op });
        if (s.op === 'denoise') denoise(d, w, h, s.v);
        else if (s.op === 'deconv') deconv(d, w, h, s.kind, s.a, s.b, s.iters);
        else if (s.op === 'unsharp') unsharp(d, w, h, s.amount, s.radius, s.threshold);
        else if (s.op === 'auto') autoContrast(d, w * h);
      });
      post({ op: 'done', id: m.id, buf: d.buffer, w: w, h: h, ms: Date.now() - t0 }, [d.buffer]);
    } catch (err) { post({ op: 'error', id: m.id, msg: String((err && err.message) || err) }); }
  };
}
// ---------- EXIF/metadata: baca tag penting (JPEG APP1, PNG eXIf/tEXt, WebP EXIF)
function imgMeta(buf) {
  const b = new Uint8Array(buf), out = { tags: [], gps: null, has: false };
  const dv = new DataView(buf);
  function tiff(off, len) {
    if (off + 8 > b.length) return;
    const le = b[off] === 0x49, g16 = o => dv.getUint16(off + o, le), g32 = o => dv.getUint32(off + o, le);
    const NAMES = { 0x010f: 'Make', 0x0110: 'Model', 0x0131: 'Software', 0x0132: 'DateTime', 0x013b: 'Artist', 0x8298: 'Copyright', 0x9003: 'DateTimeOriginal', 0xa430: 'CameraOwnerName', 0xa431: 'BodySerialNumber', 0xa434: 'LensModel', 0x0112: 'Orientation' };
    const gpsv = {};
    function val(type, cnt, vo) {
      const sz = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[type] || 1, p = sz * cnt > 4 ? g32(vo) : vo;
      if (type === 2) { let s = ''; for (let i = 0; i < cnt - 1 && off + p + i < b.length; i++) s += String.fromCharCode(b[off + p + i]); return s.trim(); }
      if (type === 3) return g16(p);
      if (type === 4) return g32(p);
      if (type === 5) { const a = []; for (let i = 0; i < cnt; i++) a.push(g32(p + i * 8) / (g32(p + i * 8 + 4) || 1)); return a.length === 1 ? a[0] : a; }
      return null;
    }
    function ifd(io, gps, depth) {
      if (depth > 3 || io + 2 > len) return;
      const n = g16(io);
      for (let i = 0; i < n && i < 300; i++) {
        const e = io + 2 + i * 12, tag = g16(e), type = g16(e + 2), cnt = g32(e + 4);
        if (gps) { gpsv[tag] = val(type, cnt, e + 8); continue; }
        if (tag === 0x8769) ifd(g32(e + 8), false, depth + 1);
        else if (tag === 0x8825) ifd(g32(e + 8), true, depth + 1);
        else if (NAMES[tag]) { const v = val(type, cnt, e + 8); if (v !== null && v !== '') out.tags.push([NAMES[tag], String(v)]); }
      }
    }
    try { ifd(g32(4), false, 0); } catch (e) { /* EXIF rusak */ }
    const dms = a => (Array.isArray(a) ? a[0] + a[1] / 60 + a[2] / 3600 : null);
    if (gpsv[2] && gpsv[4]) { let la = dms(gpsv[2]), lo = dms(gpsv[4]); if (gpsv[1] === 'S') la = -la; if (gpsv[3] === 'W') lo = -lo; if (la !== null && lo !== null) out.gps = { lat: +la.toFixed(6), lon: +lo.toFixed(6) }; }
  }
  try {
    if (b[0] === 0xff && b[1] === 0xd8) {
      let p = 2;
      while (p + 4 < b.length && b[p] === 0xff) {
        const mk = b[p + 1], ln = (b[p + 2] << 8) | b[p + 3];
        if (mk === 0xe1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) { out.has = true; tiff(p + 10, ln - 8); }
        else if (mk === 0xe1 || mk === 0xed || mk === 0xe2) out.has = true;
        if (mk === 0xda) break;
        p += 2 + ln;
      }
    } else if (b[0] === 0x89 && b[1] === 0x50) {
      let p = 8;
      while (p + 8 < b.length) {
        const ln = dv.getUint32(p), ty = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
        if (ty === 'eXIf') { out.has = true; tiff(p + 8, ln); }
        if (ty === 'tEXt' || ty === 'iTXt' || ty === 'zTXt') { out.has = true; let k = ''; for (let i = p + 8; i < p + 8 + ln && b[i]; i++) k += String.fromCharCode(b[i]); out.tags.push(['PNG ' + ty, k]); }
        if (ty === 'IEND') break;
        p += 12 + ln;
      }
    } else if (b[0] === 0x52 && b[8] === 0x57) {
      let p = 12;
      while (p + 8 < b.length) {
        const ty = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]), ln = dv.getUint32(p + 4, true);
        if (ty === 'EXIF') { out.has = true; const o = b[p + 8] === 0x45 ? p + 14 : p + 8; tiff(o, ln); }
        if (ty === 'XMP ') out.has = true;
        p += 8 + ln + (ln & 1);
      }
    }
  } catch (e) { /* abaikan */ }
  return out;
}
const IMG_ORT_SRC = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/ort.all.min.js';
const IMG_ORT_WASM = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
const IMG_W2X_BASE = 'https://huggingface.co/deepghs/waifu2x_onnx/resolve/main/20250502/onnx_models/swin_unet/';
const IMG_MODELS = [
  { key: 'w2x_photo', label: 'waifu2x swin_unet — foto (±19 MB)', kind: 'w2x', style: 'photo' },
  { key: 'w2x_art', label: 'waifu2x swin_unet — anime/ilustrasi (±17-19 MB)', kind: 'w2x', style: 'art' },
  { key: 'w2x_scan', label: 'waifu2x swin_unet — hasil scan/foto ilustrasi (±19 MB)', kind: 'w2x', style: 'art_scan' },
  { key: 'x4v3', label: 'Real-ESRGAN general x4v3 (4,6 MB)', url: 'https://huggingface.co/jonathanst29/tinier-upscale-models/resolve/main/realesr-general-x4v3.onnx', scale: 4 },
  { key: 'x4plus', label: 'Real-ESRGAN x4plus (64 MB, lebih detail, lambat)', url: 'https://huggingface.co/jonathanst29/tinier-upscale-models/resolve/main/realesrgan-x4plus.onnx', scale: 4 }
];
const IMG_AI_PROVIDERS = [
  { key: 'openai', label: 'OpenAI (gpt-image)', model: 'gpt-image-1.5' },
  { key: 'gemini', label: 'Google Gemini (image)', model: 'gemini-2.5-flash-image' },
  { key: 'openrouter', label: 'OpenRouter (model gambar)', model: 'google/gemini-2.5-flash-image' },
  { key: 'stab_fast', label: 'Stability Upscale Fast ×4', model: '' },
  { key: 'stab_cons', label: 'Stability Upscale Conservative', model: '' }
];
const IMG_PREFS_KEY = 'scaImgPrefs';
function imgLoadScript(src) {
  return new Promise((res, rej) => { if (window.ort) { res(); return; } const s = document.createElement('script'); s.src = src; s.crossOrigin = 'anonymous'; s.onload = () => res(); s.onerror = () => rej(new Error('CDN ' + src)); document.head.appendChild(s); });
}
async function imgModelBytes(m, onProg) {
  const cacheName = 'scaImgModels';
  try { const c = await caches.open(cacheName); const hit = await c.match(m.url); if (hit) return new Uint8Array(await hit.arrayBuffer()); } catch (e) { /* Cache API tidak ada (file://) */ }
  const r = await fetch(m.url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const total = +r.headers.get('content-length') || 0, rd = r.body.getReader(), parts = [];
  let got = 0;
  for (;;) { const x = await rd.read(); if (x.done) break; parts.push(x.value); got += x.value.length; onProg(total ? Math.round(got / total * 100) : 0, got); }
  const out = new Uint8Array(got); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; });
  try { const c = await caches.open(cacheName); await c.put(m.url, new Response(out.slice(), { headers: { 'content-type': 'application/octet-stream' } })); } catch (e) { /* abaikan */ }
  return out;
}

const IM_I18N = {
  id: {
    tab_img: 'Studio Gambar', im_title: 'Studio Gambar — kompres, perbesar, perjelas, sensor, hapus EXIF',
    im_intro: 'Tempel (Ctrl+V), drop, atau pilih gambar. Kompres dengan ukuran asli langsung terlihat, resize dengan algoritma pilihan, perjelas gambar buram, upscale AI lokal (Real-ESRGAN di browser) atau lewat API AI dengan token Anda, sensor area sensitif, dan metadata EXIF/GPS dibuang saat disimpan.',
    im_drop: 'Ctrl+V untuk tempel, drop, atau klik untuk pilih gambar', im_drop_sub: 'JPG, PNG, WebP, AVIF, GIF, BMP',
    im_paste: 'Tempel dari clipboard', im_undo: 'Batal', im_reset: 'Kembali ke asli', im_no_clip: 'Tidak ada gambar di clipboard (atau izin clipboard ditolak). Coba Ctrl+V di halaman ini.',
    im_err_load: 'Gambar tidak bisa dibuka:', im_now: 'sekarang', im_map: 'peta',
    im_meta_found: 'Metadata ditemukan:', im_meta_strip: 'Semua metadata (EXIF, GPS, XMP, teks PNG) dibuang otomatis saat gambar disimpan dari sini.', im_meta_none: 'Tidak ada metadata EXIF/GPS.',
    im_t_compress: 'Kompres', im_t_resize: 'Resize', im_t_fix: 'Perbaiki buram', im_t_ailocal: 'Upscale AI lokal', im_t_aiapi: 'AI via API', im_t_redact: 'Sensor area',
    im_target: 'Target ukuran maks', im_fit: 'Cari pengaturan', im_table_btn: 'Tabel perkiraan ukuran', im_encoding: 'meng-encode...',
    im_fmt: 'Format', im_quality: 'Kualitas', im_dims: 'Dimensi', im_size: 'Ukuran', im_saving: 'Hemat', im_use: 'pakai',
    im_compress_note: 'Ukuran di tabel adalah hasil encode sungguhan di browser ini, bukan tebakan. Klik baris untuk memakai pengaturannya. WebP biasanya 25-35% lebih kecil dari JPG pada kualitas setara; PNG cocok untuk screenshot berisi teks.',
    im_target_ok: 'Pas: kualitas {q}, {w}×{h}.', im_target_fail: 'Target terlalu kecil untuk gambar ini.',
    im_width: 'Lebar', im_height: 'Tinggi', im_lock: 'Kunci rasio', im_apply: 'Terapkan', im_quick: 'Cepat',
    im_a_lanczos3: 'Lanczos3 (paling tajam)', im_a_lanczos3_tip: 'Terbaik untuk foto, perkecil maupun perbesar. Detail tajam, sedikit halo di tepi kontras.',
    im_a_lanczos2: 'Lanczos2', im_a_lanczos2_tip: 'Mirip Lanczos3, halo lebih sedikit.',
    im_a_catmull: 'Bicubic Catmull-Rom', im_a_catmull_tip: 'Tajam dan natural, standar banyak editor.',
    im_a_mitchell: 'Bicubic Mitchell', im_a_mitchell_tip: 'Paling halus tanpa artefak; sedikit lebih lembut.',
    im_a_bilinear: 'Bilinear', im_a_bilinear_tip: 'Cepat dan lembut.',
    im_a_area: 'Area (box)', im_a_area_tip: 'Untuk memperkecil: rata-rata piksel, bebas gerigi/moire.',
    im_a_nearest: 'Nearest (piksel tajam)', im_a_nearest_tip: 'Untuk screenshot UI/teks/pixel art: perbesar ×2/×3/×4 tanpa blur.',
    im_preset: 'Preset', im_p_light: 'Ringan', im_p_medium: 'Sedang', im_p_strong: 'Kuat', im_p_text: 'Teks / dokumen',
    im_denoise: 'Kurangi noise', im_denoise_tip: 'Filter bilateral: menghaluskan bintik/noise JPEG tanpa mengaburkan tepi.',
    im_deconv: 'Deblur', im_none: 'tidak', im_dc_gauss: 'buram fokus (Gaussian)', im_dc_motion: 'buram gerak', im_len: 'Panjang', im_angle: 'Sudut', im_iters: 'Iterasi',
    im_sharpen: 'Pertajam', im_radius: 'Radius', im_threshold: 'Ambang', im_auto: 'Kontras otomatis',
    im_fix_note: 'Deblur = dekonvolusi Richardson-Lucy pada kecerahan (warna tidak belang). Efektif untuk buram ringan-sedang; iterasi tinggi menambah detail tapi juga noise/cincin. Buram berat tidak bisa dipulihkan secara klasik: coba Upscale AI.',
    im_step_resize: 'resize...', im_step_denoise: 'mengurangi noise...', im_step_deconv: 'deblur...', im_step_unsharp: 'mempertajam...', im_step_auto: 'kontras...', im_working: 'memproses...', im_done: 'Selesai dalam {s} dtk.', im_too_big: 'Gambar terlalu besar untuk operasi ini.',
    im_ai_out: 'Hasil', im_noise: 'Denoise', im_noise_tip: 'Level pengurangan noise/artefak JPEG waifu2x: 0 ringan … 3 kuat. "tidak" = hanya perbesar.', im_noise_only: 'denoise saja', im_w2x_need: 'Untuk ×1 pilih level denoise 0-3.', im_tile_tip: 'Ukuran potongan per proses. Lebih besar = lebih cepat di WebGPU, tapi butuh memori GPU lebih banyak.', im_ai_go: 'Upscale',
    im_ai_note: 'waifu2x swin_unet (MIT, model dari nagadomi/nunif, mirror Hugging Face) sama dengan model di unlimited.waifu2x.net: bagus untuk foto/ilustrasi dengan noise atau artefak JPEG, ×2/×4. Real-ESRGAN (BSD-3) lebih agresif menajamkan tekstur. Keduanya jalan di perangkat Anda lewat onnxruntime-web (WebGPU, atau WASM bila GPU tidak tersedia). Runtime (~10 MB, jsDelivr) dan model (Hugging Face) diunduh sekali lalu disimpan di cache browser; gambar tidak dikirim ke mana pun. Hasil ×2/×3 = ×4 lalu diperkecil Lanczos.',
    im_ai_runtime: 'memuat runtime...', im_ai_model: 'mengunduh model...', im_ai_init: 'menyiapkan model...', im_ai_run: 'tile {d}/{t}, sisa ±{s} dtk', im_ai_fail: 'Upscale AI gagal:', im_ai_big: 'Gambar terlalu besar untuk ×4 (hasil > 64 MP). Perkecil dulu atau pilih ×2.',
    im_api_key_ph: 'disimpan di memori saja', im_api_go: 'Proses dengan AI', im_api_nokey: 'Isi API key dulu.', im_api_send: 'mengirim ke API...', im_api_ok: 'Hasil AI diterima ({w}×{h}).', im_api_fail: 'API gagal:', im_api_noimg: 'Respons tidak berisi gambar.', im_api_net: 'koneksi diblokir (key salah/kedaluwarsa sering muncul begini karena respons error tanpa header CORS, atau jaringan/proxy kantor memblokir).',
    im_api_prompt_def: 'Perbaiki gambar ini: pertajam, kurangi buram dan noise, tingkatkan resolusi dan detail. Jangan mengubah isi, teks, angka, wajah, warna, atau komposisi.',
    im_api_warn: 'AI generatif menggambar ulang gambar: teks, angka, atau wajah bisa berubah. Jangan dipakai sebagai bukti pentest/laporan bug. Stability Conservative paling setia pada gambar asli.',
    im_api_note: 'Gambar dikirim langsung dari browser ke penyedia yang dipilih memakai key Anda (biaya dari akun Anda). Key tidak disimpan; pilihan penyedia, model, dan prompt diingat di browser ini.',
    im_ai_label: 'Gambar ini hasil AI generatif: bukan bukti asli.',
    im_redact_how: 'Tarik kotak di pratinjau. Mode:', im_r_black: 'Blok hitam', im_r_pixel: 'Pixelate', im_r_blur: 'Blur', im_r_undo: 'Hapus kotak terakhir', im_r_clear: 'Hapus semua kotak',
    im_redact_note: 'Untuk token/password/NIK pakai blok hitam: blur dan pixelate pada teks kadang masih bisa ditebak ulang. Sensor diterapkan pada file yang diunduh/disalin.',
    im_cmp: 'Bandingkan dengan asli', im_cmp_tip: 'Geser: bagian kiri garis = gambar asli, kanan = hasil.', im_actual: 'Ukuran asli (100%)',
    im_outscale: 'Skala output', im_vs_orig: 'dari file asli', im_out_meta: 'metadata masih ada', im_out_clean: 'tanpa metadata ✓', im_download: 'Unduh', im_copy: 'Salin PNG', im_copied: 'Tersalin ke clipboard.',
    im_note: 'Semua proses klasik jalan lokal di browser (Web Worker). Hanya Upscale AI lokal (unduh runtime/model sekali) dan AI via API yang memakai jaringan.',
    grp_img_title: 'Studio Gambar', grp_img_desc: 'Lokal di browser. Opsional: runtime + model Real-ESRGAN dari jsDelivr/Hugging Face, dan API AI pilihan Anda (OpenAI, Gemini, OpenRouter, Stability) dengan key Anda.'
  },
  en: {
    tab_img: 'Image Studio', im_title: 'Image Studio — compress, upscale, sharpen, redact, strip EXIF',
    im_intro: 'Paste (Ctrl+V), drop or pick an image. Compress with the real output size shown instantly, resize with a chosen algorithm, sharpen blurry images, upscale with local AI (Real-ESRGAN in the browser) or via an AI API with your own key, redact sensitive areas, and EXIF/GPS metadata is stripped on save.',
    im_drop: 'Ctrl+V to paste, drop, or click to pick an image', im_drop_sub: 'JPG, PNG, WebP, AVIF, GIF, BMP',
    im_paste: 'Paste from clipboard', im_undo: 'Undo', im_reset: 'Back to original', im_no_clip: 'No image on the clipboard (or clipboard permission denied). Try Ctrl+V on this page.',
    im_err_load: 'Could not open the image:', im_now: 'now', im_map: 'map',
    im_meta_found: 'Metadata found:', im_meta_strip: 'All metadata (EXIF, GPS, XMP, PNG text) is removed automatically when the image is saved from here.', im_meta_none: 'No EXIF/GPS metadata.',
    im_t_compress: 'Compress', im_t_resize: 'Resize', im_t_fix: 'Fix blur', im_t_ailocal: 'Local AI upscale', im_t_aiapi: 'AI via API', im_t_redact: 'Redact',
    im_target: 'Max target size', im_fit: 'Find settings', im_table_btn: 'Size estimate table', im_encoding: 'encoding...',
    im_fmt: 'Format', im_quality: 'Quality', im_dims: 'Dimensions', im_size: 'Size', im_saving: 'Saved', im_use: 'use',
    im_compress_note: 'Sizes in the table come from real encodes in this browser, not guesses. Click a row to use its settings. WebP is usually 25-35% smaller than JPG at similar quality; PNG suits screenshots with text.',
    im_target_ok: 'Fits: quality {q}, {w}×{h}.', im_target_fail: 'Target is too small for this image.',
    im_width: 'Width', im_height: 'Height', im_lock: 'Lock ratio', im_apply: 'Apply', im_quick: 'Quick',
    im_a_lanczos3: 'Lanczos3 (sharpest)', im_a_lanczos3_tip: 'Best for photos, both down and up. Sharp detail, slight halo on hard edges.',
    im_a_lanczos2: 'Lanczos2', im_a_lanczos2_tip: 'Like Lanczos3 with less halo.',
    im_a_catmull: 'Bicubic Catmull-Rom', im_a_catmull_tip: 'Sharp and natural, the default in many editors.',
    im_a_mitchell: 'Bicubic Mitchell', im_a_mitchell_tip: 'Smoothest without artifacts; slightly softer.',
    im_a_bilinear: 'Bilinear', im_a_bilinear_tip: 'Fast and soft.',
    im_a_area: 'Area (box)', im_a_area_tip: 'For downscaling: averages pixels, no jaggies/moire.',
    im_a_nearest: 'Nearest (crisp pixels)', im_a_nearest_tip: 'For UI screenshots/text/pixel art: enlarge ×2/×3/×4 without blur.',
    im_preset: 'Preset', im_p_light: 'Light', im_p_medium: 'Medium', im_p_strong: 'Strong', im_p_text: 'Text / document',
    im_denoise: 'Denoise', im_denoise_tip: 'Bilateral filter: smooths grain/JPEG noise without blurring edges.',
    im_deconv: 'Deblur', im_none: 'off', im_dc_gauss: 'focus blur (Gaussian)', im_dc_motion: 'motion blur', im_len: 'Length', im_angle: 'Angle', im_iters: 'Iterations',
    im_sharpen: 'Sharpen', im_radius: 'Radius', im_threshold: 'Threshold', im_auto: 'Auto contrast',
    im_fix_note: 'Deblur = Richardson-Lucy deconvolution on luminance (no color fringing). Works for light-to-medium blur; more iterations add detail but also noise/ringing. Heavy blur cannot be recovered classically: try AI upscale.',
    im_step_resize: 'resizing...', im_step_denoise: 'denoising...', im_step_deconv: 'deblurring...', im_step_unsharp: 'sharpening...', im_step_auto: 'contrast...', im_working: 'processing...', im_done: 'Done in {s} s.', im_too_big: 'Image too large for this operation.',
    im_ai_out: 'Output', im_noise: 'Denoise', im_noise_tip: 'waifu2x noise/JPEG artifact reduction level: 0 light … 3 strong. "off" = upscale only.', im_noise_only: 'denoise only', im_w2x_need: 'For ×1 choose a denoise level 0-3.', im_tile_tip: 'Size of each processed piece. Larger = faster on WebGPU but needs more GPU memory.', im_ai_go: 'Upscale',
    im_ai_note: 'waifu2x swin_unet (MIT, models from nagadomi/nunif, Hugging Face mirror) is the same model used by unlimited.waifu2x.net: good for photos/illustrations with noise or JPEG artifacts, ×2/×4. Real-ESRGAN (BSD-3) sharpens textures more aggressively. Both run on your device via onnxruntime-web (WebGPU, or WASM when no GPU). The runtime (~10 MB, jsDelivr) and model (Hugging Face) are downloaded once and cached; the image is not sent anywhere. ×2/×3 output = ×4 then downscaled with Lanczos.',
    im_ai_runtime: 'loading runtime...', im_ai_model: 'downloading model...', im_ai_init: 'preparing model...', im_ai_run: 'tile {d}/{t}, ~{s} s left', im_ai_fail: 'AI upscale failed:', im_ai_big: 'Image too large for ×4 (output > 64 MP). Downscale first or choose ×2.',
    im_api_key_ph: 'kept in memory only', im_api_go: 'Process with AI', im_api_nokey: 'Enter an API key first.', im_api_send: 'sending to API...', im_api_ok: 'AI result received ({w}×{h}).', im_api_fail: 'API failed:', im_api_noimg: 'The response contains no image.', im_api_net: 'request blocked (an invalid/expired key often shows up like this because the error response has no CORS header, or a network/office proxy blocks it).',
    im_api_prompt_def: 'Improve this image: sharpen, reduce blur and noise, increase resolution and detail. Do not change the content, text, numbers, faces, colors or composition.',
    im_api_warn: 'Generative AI redraws the image: text, numbers or faces may change. Do not use it as pentest/bug report evidence. Stability Conservative stays closest to the original.',
    im_api_note: 'The image is sent straight from the browser to the chosen provider with your key (billed to your account). The key is not stored; provider, model and prompt are remembered in this browser.',
    im_ai_label: 'This image is generative AI output: not original evidence.',
    im_redact_how: 'Drag a box on the preview. Mode:', im_r_black: 'Black box', im_r_pixel: 'Pixelate', im_r_blur: 'Blur', im_r_undo: 'Remove last box', im_r_clear: 'Remove all boxes',
    im_redact_note: 'Use a black box for tokens/passwords/IDs: blurred or pixelated text can sometimes be reconstructed. Redaction is applied to the downloaded/copied file.',
    im_cmp: 'Compare with original', im_cmp_tip: 'Slide: left of the line = original, right = result.', im_actual: 'Actual size (100%)',
    im_outscale: 'Output scale', im_vs_orig: 'vs original file', im_out_meta: 'metadata still present', im_out_clean: 'no metadata ✓', im_download: 'Download', im_copy: 'Copy PNG', im_copied: 'Copied to clipboard.',
    im_note: 'All classic processing runs locally in the browser (Web Worker). Only local AI upscale (one-time runtime/model download) and AI via API use the network.',
    grp_img_title: 'Image Studio', grp_img_desc: 'Local in the browser. Optional: Real-ESRGAN runtime + model from jsDelivr/Hugging Face, and the AI API of your choice (OpenAI, Gemini, OpenRouter, Stability) with your key.'
  }
};
Object.keys(IM_I18N).forEach(l => { I18N[l] = Object.assign({}, IM_I18N[l], I18N[l] || {}); });
const CLK_ALIAS_RAW = 'Jakarta,WIB,Indonesia,Bandung,Bogor,Bekasi,Depok,Tangerang,Surabaya,Semarang,Yogyakarta,Jogja,Solo,Malang,Medan,Palembang,Padang,Pekanbaru,Lampung,Batam,Aceh,Jambi,Bengkulu,Serang=Asia/Jakarta;Pontianak,Palangkaraya=Asia/Pontianak;'
  + 'WITA,Makassar,Bali,Denpasar,Balikpapan,Samarinda,Banjarmasin,Manado,Palu,Kendari,Mataram,Lombok,Kupang,NTT,NTB=Asia/Makassar;WIT,Jayapura,Papua,Ambon,Maluku,Sorong,Merauke,Ternate=Asia/Jayapura;'
  + 'Malaysia,Kuala Lumpur,MYT=Asia/Kuala_Lumpur;Singapura,Singapore,SGT=Asia/Singapore;Thailand,ICT=Asia/Bangkok;Vietnam,Hanoi,Saigon=Asia/Ho_Chi_Minh;Filipina,Philippines,PHT=Asia/Manila;Brunei=Asia/Brunei;Timor Leste,Dili=Asia/Dili;'
  + 'Myanmar=Asia/Yangon;Kamboja,Cambodia=Asia/Phnom_Penh;Laos=Asia/Vientiane;Jepang,Japan,Osaka,Kyoto,JST=Asia/Tokyo;Korea Selatan,South Korea,Korea,Busan,KST=Asia/Seoul;China,Tiongkok,Beijing,Shenzhen,Guangzhou,CST China=Asia/Shanghai;'
  + 'Hong Kong,HKT=Asia/Hong_Kong;Taiwan=Asia/Taipei;India,Mumbai,Delhi,New Delhi,Bangalore,Bengaluru,Chennai,IST=Asia/Kolkata;Pakistan=Asia/Karachi;Bangladesh=Asia/Dhaka;Nepal=Asia/Kathmandu;Sri Lanka=Asia/Colombo;'
  + 'Arab Saudi,Saudi Arabia,Mekkah,Makkah,Mecca,Madinah,Medina,Jeddah,Riyadh=Asia/Riyadh;Uni Emirat Arab,UAE,Abu Dhabi,GST=Asia/Dubai;Qatar=Asia/Qatar;Kuwait=Asia/Kuwait;Bahrain=Asia/Bahrain;Oman,Muscat=Asia/Muscat;'
  + 'Turki,Turkey,Ankara=Europe/Istanbul;Iran=Asia/Tehran;Irak,Iraq=Asia/Baghdad;Yordania,Jordan=Asia/Amman;Lebanon=Asia/Beirut;Suriah,Syria=Asia/Damascus;Palestina,Palestine,Gaza=Asia/Gaza;Israel,Yerusalem=Asia/Jerusalem;'
  + 'Mesir,Egypt=Africa/Cairo;Inggris,UK,United Kingdom,England,Manchester,BST=Europe/London;Prancis,France,CET,CEST=Europe/Paris;Jerman,Germany,Munich,Frankfurt=Europe/Berlin;Belanda,Netherlands=Europe/Amsterdam;'
  + 'Belgia,Belgium=Europe/Brussels;Spanyol,Spain=Europe/Madrid;Italia,Italy,Roma,Milan=Europe/Rome;Swiss,Switzerland,Zurich,Geneva=Europe/Zurich;Austria=Europe/Vienna;Swedia,Sweden=Europe/Stockholm;Norwegia,Norway=Europe/Oslo;'
  + 'Denmark=Europe/Copenhagen;Finlandia,Finland=Europe/Helsinki;Polandia,Poland=Europe/Warsaw;Rusia,Russia,MSK=Europe/Moscow;Ukraina,Ukraine,Kyiv,Kiev=Europe/Kyiv;Yunani,Greece=Europe/Athens;Portugal=Europe/Lisbon;Irlandia,Ireland=Europe/Dublin;'
  + 'Amerika,USA,US,Amerika Serikat,United States,New York,Washington,Boston,Miami,Atlanta,EST,EDT,ET=America/New_York;Texas,Dallas,Houston,CST,CDT,CT=America/Chicago;Colorado,MST,MDT=America/Denver;Arizona=America/Phoenix;'
  + 'California,San Francisco,San Jose,Silicon Valley,Seattle,Las Vegas,PST,PDT,PT=America/Los_Angeles;Hawaii=Pacific/Honolulu;Alaska=America/Anchorage;Kanada,Canada,Ottawa,Montreal=America/Toronto;'
  + 'Meksiko,Mexico=America/Mexico_City;Brasil,Brazil,Rio de Janeiro=America/Sao_Paulo;Argentina=America/Argentina/Buenos_Aires;Chili,Chile=America/Santiago;Kolombia,Colombia=America/Bogota;Peru=America/Lima;'
  + 'Australia,Canberra,AEST,AEDT=Australia/Sydney;Selandia Baru,New Zealand,Wellington,NZST=Pacific/Auckland;Papua Nugini,Papua New Guinea=Pacific/Port_Moresby;Afrika Selatan,South Africa,Cape Town=Africa/Johannesburg;'
  + 'Nigeria=Africa/Lagos;Kenya=Africa/Nairobi;Maroko,Morocco=Africa/Casablanca;Mongolia=Asia/Ulaanbaatar;Kazakhstan=Asia/Almaty;Uzbekistan=Asia/Tashkent;Afghanistan=Asia/Kabul;UTC,GMT,Greenwich,Zulu=UTC';
const clkFmtCache = new Map();
function clkValid(tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; } }
function clkNorm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_/]+/g, ' ').replace(/\s+/g, ' ').trim(); }
let clkIndexCache = null;
function clkIndex() {
  if (clkIndexCache) return clkIndexCache;
  const out = [], seen = new Set();
  CLK_ALIAS_RAW.split(';').forEach(grp => {
    const i = grp.indexOf('='); if (i < 0) return;
    const tz = grp.slice(i + 1);
    if (!clkValid(tz)) return;
    grp.slice(0, i).split(',').forEach(n => out.push({ label: n, tz, key: clkNorm(n), alias: true }));
  });
  let zones = [];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch (e) { zones = []; }
  zones.forEach(tz => {
    if (seen.has(tz)) return; seen.add(tz);
    const city = tz.split('/').pop().replace(/_/g, ' ');
    out.push({ label: city, tz, key: clkNorm(city), full: clkNorm(tz) });
  });
  clkIndexCache = out;
  return out;
}
// Offset (menit) zona tz pada waktu ms, termasuk DST.
function clkOffset(tz, ms) {
  let f = clkFmtCache.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); clkFmtCache.set(tz, f); }
  const p = {};
  f.formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60000);
}
function clkOff(item, ms) { return item.fixed != null ? item.fixed : clkOffset(item.tz, ms); }
function clkOffStr(min) { const s = min < 0 ? '-' : '+', a = Math.abs(min); return 'UTC' + s + String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0'); }
// "utc 7", "UTC+7", "gmt-5", "+05:30", "utc" -> menit; null bila bukan offset.
function clkParseOffset(q) {
  const s = String(q || '').trim().toLowerCase().replace(/\u2212/g, '-');
  const m = s.match(/^(?:(?:utc|gmt)\s*([+-]?)\s*(\d{1,2})(?:[:.]?(\d{2}))?|([+-])\s*(\d{1,2})(?:[:.]?(\d{2}))?|(utc|gmt))$/);
  if (!m) return null;
  if (m[7]) return 0;
  const sign = (m[1] || m[4]) === '-' ? -1 : 1, h = Number(m[2] || m[5]), mi = Number(m[3] || m[6] || 0);
  if (h > 14 || mi > 59) return null;
  return sign * (h * 60 + mi);
}
function clkSearch(q, ms) {
  q = String(q || '').trim();
  if (!q) return [];
  const off = clkParseOffset(q), out = [];
  if (off !== null) {
    // satu baris per zona; label alias (kota populer) didahulukan, Antarctica/Etc dilewati
    const byTz = new Map();
    clkIndex().forEach(x => { if (/\//.test(x.tz) && !/^(Antarctica|Etc)\//.test(x.tz) && !byTz.has(x.tz)) byTz.set(x.tz, { label: x.label, tz: x.tz, pop: !!x.alias }); });
    const same = [...byTz.values()].filter(x => clkOffset(x.tz, ms) === off).sort((a, b) => (b.pop - a.pop) || a.label.localeCompare(b.label));
    out.push({ label: clkOffStr(off), fixed: off, sub: same.slice(0, 6).map(x => x.label).join(', ') });
    same.slice(0, 10).forEach(x => out.push({ label: x.label, tz: x.tz, sub: x.tz }));
    return out;
  }
  const k = clkNorm(q), best = new Map();
  clkIndex().forEach(x => {
    let sc = 0;
    if (x.key === k) sc = 100; else if (x.key.indexOf(k) === 0) sc = 80; else if ((' ' + x.key).indexOf(' ' + k) >= 0) sc = 60; else if (x.key.indexOf(k) >= 0) sc = 40; else if (x.full && x.full.indexOf(k) >= 0) sc = 30;
    if (!sc) return;
    if (x.alias) sc += 5;
    const id = x.tz + '|' + x.label, cur = best.get(id);
    if (!cur || cur.sc < sc) best.set(id, { sc, label: x.label, tz: x.tz, sub: x.tz });
  });
  const seenTz = new Map();
  [...best.values()].sort((a, b) => b.sc - a.sc || a.label.localeCompare(b.label)).forEach(x => {
    const n = seenTz.get(x.tz) || 0;
    if (n < 2) { seenTz.set(x.tz, n + 1); out.push(x); }
  });
  return out.slice(0, 14);
}
// Waktu dinding (wall clock) item pada ms: {y,mo,d,h,mi,s,off}.
function clkWall(item, ms) {
  const off = clkOff(item, ms), d = new Date(ms + off * 60000);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), off, dms: ms + off * 60000 };
}
// "2026-11-03T14:30" sebagai jam dinding di item -> epoch ms (dua iterasi untuk transisi DST).
function clkFromWall(item, str) {
  const m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const w = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ms = w - clkOff(item, w) * 60000;
  ms = w - clkOff(item, ms) * 60000;
  return ms;
}
function clkToInput(item, ms) {
  const w = clkWall(item, ms), p = n => String(n).padStart(2, '0');
  return w.y + '-' + p(w.mo + 1) + '-' + p(w.d) + 'T' + p(w.h) + ':' + p(w.mi);
}
// Peta dunia titik-titik 144x72 (Natural Earth 110m, public domain) + koordinat zona IANA (tzdata zone.tab, public domain).
const CLK_MAP_W = 144, CLK_MAP_H = 72, CLK_LAND = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/5///gAAAAAAAAAAAAAAAAEz/P//8ABwAAAADAAAAAAAABKZAP//8AAAAA4AH4AAAAAAADwDQAP/8AAAAGAH/4AIAAgEAAfG/gH/4AAAAGHf//9/gAB///1Ds4H/gAAf4F6///////8/////w+H8BAB/0/////////AP////UcHwCAD3/////////+A////8BgDgAAPn////////74AeB//+B6AAAAPn///////4CAAIAf//h+AAACFP///////gOAAAAP//7/gAANH////////wMAAAAH////wAAD/////////wAAAAAD///04AAD/////////wAAAAAD///8AAAB//X3/////gAAAAAD///wAAAB6+Dv/////EAAAAAD///gAAAPhvbz////8IAAAAAB///AAAAPAp/z///+IIAAAAAB///AAAAA8Af/////EwAAAAAAf/+AAAAH8AP/////BAAAAAAAX/4AAAAP/uv/////gAAAAAAAP8EAAAAP///v////gAAAAAAAD4EAAAA///3z////AAAAAAAAB4AAAAA///3+H//+gAAAAAAAA4gAAAB///7/D+fgAAAAAAAAA9gYAAA///7+B8PQAAAAAAAAAHgAAAB///94B4HggAAAAAAAAA4AAAB////gAwHwwAAAAAAAAAAoAAA///+QAwFgAAAAAAAAAAF/AAAf///wAAEAIAAAAAAAAAB/gAAPv//wAICAAAAAAAAAAAB/8AAAD//gAAGGAAAAAAAAAAD/8AAAD//AAADOAAAAAAAAAAD//AAAD/+AAADOjAAAAAAAAAD//4AAD/8AAABAg8AAAAAAAAD//8AAB/8AAAAgAeAAAAAAAAD//8AAB/8AAAABoIAAAAAAAAB//4AAB/8AAAAAAAAAAAAAAAB//wAAB/8QAAAADAAAAAAAAAAf/wAAB/8wAAAAfkAAAAAAAAAP/wAAB/wwAAAAf+AAAAAAAAAP/wAAB/xgAAAD//AAAAAAAAAP/AAAA/xgAAAH//AAAAAAAAAP+AAAA/gAAAAH//gAAAAAAAAf8AAAAfgAAAAD//gAAAAAAAAf8AAAAfAAAAAD//gAAAAAAAAf4AAAAcAAAAADw/gAAAAAAAAfgAAAAAAAAAAAAPAAAAAAAAAfAAAAAAAAAAAAACACAAAAAAA8AAAAAAAAAAAAACAEAAAAAAAcAAAAAAAAAAAAAAAIAAAAAAA4AAAAAAAAAAAAAAAQAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAwgAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAACAAAAAAAGAABEAAAAAAAAAAAEAAAAAAR/8f////gAAAAAAAA+AAAF////5//////wAAABAf+/AAB////////////gAAP////wAAP///////////+AAT////+ADj/////////////gAD/////4AH////////////8AAB/////////////////////w////////////////////////////////////////////////';
const CLK_COORD_RAW = 'Africa/Abidjan:5.3,-4;Africa/Accra:5.5,-0.2;Africa/Addis_Ababa:9,38.7;Africa/Algiers:36.8,3;Africa/Asmara:15.3,38.9;Africa/Bamako:12.7,-8;Africa/Bangui:4.4,18.6;Africa/Banjul:13.5,-16.6;Africa/Bissau:11.8,-15.6;Africa/Blantyre:-15.8,35;Africa/Brazzaville:-4.3,15.3;Africa/Bujumbura:-3.4,29.4;Africa/Cairo:30.1,31.2;Africa/Casablanca:33.6,-7.6;Africa/Ceuta:35.9,-5.3;Africa/Conakry:9.5,-13.7;Africa/Dakar:14.7,-17.4;Africa/Dar_es_Salaam:-6.8,39.3;Africa/Djibouti:11.6,43.1;Africa/Douala:4,9.7;Africa/El_Aaiun:27.1,-13.2;Africa/Freetown:8.5,-13.2;Africa/Gaborone:-24.6,25.9;Africa/Harare:-17.8,31.1;Africa/Johannesburg:-26.2,28;Africa/Juba:4.8,31.6;Africa/Kampala:0.3,32.4;Africa/Khartoum:15.6,32.5;Africa/Kigali:-1.9,30.1;Africa/Kinshasa:-4.3,15.3;Africa/Lagos:6.5,3.4;Africa/Libreville:0.4,9.4;Africa/Lome:6.1,1.2;Africa/Luanda:-8.8,13.2;Africa/Lubumbashi:-11.7,27.5;Africa/Lusaka:-15.4,28.3;Africa/Malabo:3.8,8.8;Africa/Maputo:-26,32.6;Africa/Maseru:-29.5,27.5;Africa/Mbabane:-26.3,31.1;Africa/Mogadishu:2.1,45.4;Africa/Monrovia:6.3,-10.8;Africa/Nairobi:-1.3,36.8;Africa/Ndjamena:12.1,15.1;Africa/Niamey:13.5,2.1;Africa/Nouakchott:18.1,-15.9;Africa/Ouagadougou:12.4,-1.5;Africa/Porto-Novo:6.5,2.6;Africa/Sao_Tome:0.3,6.7;Africa/Tripoli:32.9,13.2;Africa/Tunis:36.8,10.2;Africa/Windhoek:-22.6,17.1;America/Adak:51.9,-176.7;America/Anchorage:61.2,-149.9;America/Anguilla:18.2,-63.1;America/Antigua:17.1,-61.8;America/Araguaina:-7.2,-48.2;America/Argentina/Buenos_Aires:-34.6,-58.5;America/Argentina/Catamarca:-28.5,-65.8;America/Argentina/Cordoba:-31.4,-64.2;America/Argentina/Jujuy:-24.2,-65.3;America/Argentina/La_Rioja:-29.4,-66.8;America/Argentina/Mendoza:-32.9,-68.8;America/Argentina/Rio_Gallegos:-51.6,-69.2;America/Argentina/Salta:-24.8,-65.4;America/Argentina/San_Juan:-31.5,-68.5;America/Argentina/San_Luis:-33.3,-66.3;America/Argentina/Tucuman:-26.8,-65.2;America/Argentina/Ushuaia:-54.8,-68.3;America/Aruba:12.5,-70;America/Asuncion:-25.3,-57.7;America/Atikokan:48.8,-91.6;America/Bahia:-13,-38.5;America/Bahia_Banderas:20.8,-105.2;America/Barbados:13.1,-59.6;America/Belem:-1.4,-48.5;America/Belize:17.5,-88.2;America/Blanc-Sablon:51.4,-57.1;America/Boa_Vista:2.8,-60.7;America/Bogota:4.6,-74.1;America/Boise:43.6,-116.2;America/Buenos_Aires:-34.6,-58.5;America/Cambridge_Bay:69.1,-105.1;America/Campo_Grande:-20.4,-54.6;America/Cancun:21.1,-86.8;America/Caracas:10.5,-66.9;America/Cayenne:4.9,-52.3;America/Cayman:19.3,-81.4;America/Chicago:41.9,-87.7;America/Chihuahua:28.6,-106.1;America/Ciudad_Juarez:31.7,-106.5;America/Costa_Rica:9.9,-84.1;America/Coyhaique:-45.6,-72.1;America/Creston:49.1,-116.5;America/Cuiaba:-15.6,-56.1;America/Curacao:12.2,-69;America/Danmarkshavn:76.8,-18.7;America/Dawson:64.1,-139.4;America/Dawson_Creek:55.8,-120.2;America/Denver:39.7,-105;America/Detroit:42.3,-83;America/Dominica:15.3,-61.4;America/Edmonton:53.5,-113.5;America/Eirunepe:-6.7,-69.9;America/El_Salvador:13.7,-89.2;America/Fort_Nelson:58.8,-122.7;America/Fortaleza:-3.7,-38.5;America/Glace_Bay:46.2,-60;America/Goose_Bay:53.3,-60.4;America/Grand_Turk:21.5,-71.1;America/Grenada:12.1,-61.8;America/Guadeloupe:16.2,-61.5;America/Guatemala:14.6,-90.5;America/Guayaquil:-2.2,-79.8;America/Guyana:6.8,-58.2;America/Halifax:44.6,-63.6;America/Havana:23.1,-82.4;America/Hermosillo:29.1,-111;America/Indiana/Indianapolis:39.8,-86.2;America/Indiana/Knox:41.3,-86.6;America/Indiana/Marengo:38.4,-86.3;America/Indiana/Petersburg:38.5,-87.3;America/Indiana/Tell_City:38,-86.8;America/Indiana/Vevay:38.7,-85.1;America/Indiana/Vincennes:38.7,-87.5;America/Indiana/Winamac:41.1,-86.6;America/Inuvik:68.3,-133.7;America/Iqaluit:63.7,-68.5;America/Jamaica:18,-76.8;America/Juneau:58.3,-134.4;America/Kentucky/Louisville:38.3,-85.8;America/Kentucky/Monticello:36.8,-84.8;America/Kralendijk:12.2,-68.3;America/La_Paz:-16.5,-68.2;America/Lima:-12.1,-77;America/Los_Angeles:34.1,-118.2;America/Lower_Princes:18.1,-63;America/Maceio:-9.7,-35.7;America/Managua:12.2,-86.3;America/Manaus:-3.1,-60;America/Marigot:18.1,-63.1;America/Martinique:14.6,-61.1;America/Matamoros:25.8,-97.5;America/Mazatlan:23.2,-106.4;America/Menominee:45.1,-87.6;America/Merida:21,-89.6;America/Metlakatla:55.1,-131.6;America/Mexico_City:19.4,-99.2;America/Miquelon:47,-56.3;America/Moncton:46.1,-64.8;America/Monterrey:25.7,-100.3;America/Montevideo:-34.9,-56.2;America/Montserrat:16.7,-62.2;America/Nassau:25.1,-77.3;America/New_York:40.7,-74;America/Nome:64.5,-165.4;America/Noronha:-3.9,-32.4;America/North_Dakota/Beulah:47.3,-101.8;America/North_Dakota/Center:47.1,-101.3;America/North_Dakota/New_Salem:46.8,-101.4;America/Nuuk:64.2,-51.7;America/Ojinaga:29.6,-104.4;America/Panama:9,-79.5;America/Paramaribo:5.8,-55.2;America/Phoenix:33.4,-112.1;America/Port-au-Prince:18.5,-72.3;America/Port_of_Spain:10.7,-61.5;America/Porto_Velho:-8.8,-63.9;America/Puerto_Rico:18.5,-66.1;America/Punta_Arenas:-53.1,-70.9;America/Rankin_Inlet:62.8,-92.1;America/Recife:-8.1,-34.9;America/Regina:50.4,-104.7;America/Resolute:74.7,-94.8;America/Rio_Branco:-10,-67.8;America/Santarem:-2.4,-54.9;America/Santiago:-33.5,-70.7;America/Santo_Domingo:18.5,-69.9;America/Sao_Paulo:-23.5,-46.6;America/Scoresbysund:70.5,-22;America/Sitka:57.2,-135.3;America/St_Barthelemy:17.9,-62.9;America/St_Johns:47.6,-52.7;America/St_Kitts:17.3,-62.7;America/St_Lucia:14,-61;America/St_Thomas:18.4,-64.9;America/St_Vincent:13.2,-61.2;America/Swift_Current:50.3,-107.8;America/Tegucigalpa:14.1,-87.2;America/Thule:76.6,-68.8;America/Tijuana:32.5,-117;America/Toronto:43.6,-79.4;America/Tortola:18.4,-64.6;America/Vancouver:49.3,-123.1;America/Whitehorse:60.7,-135.1;America/Winnipeg:49.9,-97.2;America/Yakutat:59.5,-139.7;Antarctica/Casey:-66.3,110.5;Antarctica/Davis:-68.6,78;Antarctica/DumontDUrville:-66.7,140;Antarctica/Macquarie:-54.5,158.9;Antarctica/Mawson:-67.6,62.9;Antarctica/McMurdo:-77.8,166.6;Antarctica/Palmer:-64.8,-64.1;Antarctica/Rothera:-67.6,-68.1;Antarctica/Syowa:-69,39.6;Antarctica/Troll:-72,2.5;Antarctica/Vostok:-78.4,106.9;Arctic/Longyearbyen:78,16;Asia/Aden:12.8,45.2;Asia/Almaty:43.2,77;Asia/Amman:31.9,35.9;Asia/Anadyr:64.8,177.5;Asia/Aqtau:44.5,50.3;Asia/Aqtobe:50.3,57.2;Asia/Ashgabat:38,58.4;Asia/Atyrau:47.1,51.9;Asia/Baghdad:33.4,44.4;Asia/Bahrain:26.4,50.6;Asia/Baku:40.4,49.9;Asia/Bangkok:13.8,100.5;Asia/Barnaul:53.4,83.8;Asia/Beirut:33.9,35.5;Asia/Bishkek:42.9,74.6;Asia/Brunei:4.9,114.9;Asia/Calcutta:22.5,88.4;Asia/Chita:52,113.5;Asia/Colombo:6.9,79.8;Asia/Damascus:33.5,36.3;Asia/Dhaka:23.7,90.4;Asia/Dili:-8.6,125.6;Asia/Dubai:25.3,55.3;Asia/Dushanbe:38.6,68.8;Asia/Famagusta:35.1,34;Asia/Gaza:31.5,34.5;Asia/Hebron:31.5,35.1;Asia/Ho_Chi_Minh:10.8,106.7;Asia/Hong_Kong:22.3,114.2;Asia/Hovd:48,91.7;Asia/Irkutsk:52.3,104.3;Asia/Jakarta:-6.2,106.8;Asia/Jayapura:-2.5,140.7;Asia/Jerusalem:31.8,35.2;Asia/Kabul:34.5,69.2;Asia/Kamchatka:53,158.7;Asia/Karachi:24.9,67;Asia/Kathmandu:27.7,85.3;Asia/Katmandu:27.7,85.3;Asia/Khandyga:62.7,135.6;Asia/Kolkata:22.5,88.4;Asia/Krasnoyarsk:56,92.8;Asia/Kuala_Lumpur:3.2,101.7;Asia/Kuching:1.6,110.3;Asia/Kuwait:29.3,48;Asia/Macau:22.2,113.5;Asia/Magadan:59.6,150.8;Asia/Makassar:-5.1,119.4;Asia/Manila:14.6,121;Asia/Muscat:23.6,58.6;Asia/Nicosia:35.2,33.4;Asia/Novokuznetsk:53.8,87.1;Asia/Novosibirsk:55,82.9;Asia/Omsk:55,73.4;Asia/Oral:51.2,51.4;Asia/Phnom_Penh:11.6,104.9;Asia/Pontianak:-0,109.3;Asia/Pyongyang:39,125.8;Asia/Qatar:25.3,51.5;Asia/Qostanay:53.2,63.6;Asia/Qyzylorda:44.8,65.5;Asia/Rangoon:16.8,96.2;Asia/Riyadh:24.6,46.7;Asia/Saigon:10.8,106.7;Asia/Sakhalin:47,142.7;Asia/Samarkand:39.7,66.8;Asia/Seoul:37.5,127;Asia/Shanghai:31.2,121.5;Asia/Singapore:1.3,103.8;Asia/Srednekolymsk:67.5,153.7;Asia/Taipei:25.1,121.5;Asia/Tashkent:41.3,69.3;Asia/Tbilisi:41.7,44.8;Asia/Tehran:35.7,51.4;Asia/Thimphu:27.5,89.7;Asia/Tokyo:35.7,139.7;Asia/Tomsk:56.5,85;Asia/Ulaanbaatar:47.9,106.9;Asia/Ulan_Bator:47.9,106.9;Asia/Urumqi:43.8,87.6;Asia/Ust-Nera:64.6,143.2;Asia/Vientiane:18,102.6;Asia/Vladivostok:43.2,131.9;Asia/Yakutsk:62,129.7;Asia/Yangon:16.8,96.2;Asia/Yekaterinburg:56.9,60.6;Asia/Yerevan:40.2,44.5;Atlantic/Azores:37.7,-25.7;Atlantic/Bermuda:32.3,-64.8;Atlantic/Canary:28.1,-15.4;Atlantic/Cape_Verde:14.9,-23.5;Atlantic/Faroe:62,-6.8;Atlantic/Madeira:32.6,-16.9;Atlantic/Reykjavik:64.2,-21.9;Atlantic/South_Georgia:-54.3,-36.5;Atlantic/St_Helena:-15.9,-5.7;Atlantic/Stanley:-51.7,-57.9;Australia/Adelaide:-34.9,138.6;Australia/Brisbane:-27.5,153;Australia/Broken_Hill:-31.9,141.4;Australia/Darwin:-12.5,130.8;Australia/Eucla:-31.7,128.9;Australia/Hobart:-42.9,147.3;Australia/Lindeman:-20.3,149;Australia/Lord_Howe:-31.6,159.1;Australia/Melbourne:-37.8,145;Australia/Perth:-31.9,115.8;Australia/Sydney:-33.9,151.2;Europe/Amsterdam:52.4,4.9;Europe/Andorra:42.5,1.5;Europe/Astrakhan:46.4,48;Europe/Athens:38,23.7;Europe/Belgrade:44.8,20.5;Europe/Berlin:52.5,13.4;Europe/Bratislava:48.1,17.1;Europe/Brussels:50.8,4.3;Europe/Bucharest:44.4,26.1;Europe/Budapest:47.5,19.1;Europe/Busingen:47.7,8.7;Europe/Chisinau:47,28.8;Europe/Copenhagen:55.7,12.6;Europe/Dublin:53.3,-6.2;Europe/Gibraltar:36.1,-5.3;Europe/Guernsey:49.5,-2.5;Europe/Helsinki:60.2,25;Europe/Isle_of_Man:54.1,-4.5;Europe/Istanbul:41,29;Europe/Jersey:49.2,-2.1;Europe/Kaliningrad:54.7,20.5;Europe/Kiev:50.4,30.5;Europe/Kirov:58.6,49.6;Europe/Kyiv:50.4,30.5;Europe/Lisbon:38.7,-9.1;Europe/Ljubljana:46,14.5;Europe/London:51.5,-0.1;Europe/Luxembourg:49.6,6.2;Europe/Madrid:40.4,-3.7;Europe/Malta:35.9,14.5;Europe/Mariehamn:60.1,19.9;Europe/Minsk:53.9,27.6;Europe/Monaco:43.7,7.4;Europe/Moscow:55.8,37.6;Europe/Oslo:59.9,10.8;Europe/Paris:48.9,2.3;Europe/Podgorica:42.4,19.3;Europe/Prague:50.1,14.4;Europe/Riga:57,24.1;Europe/Rome:41.9,12.5;Europe/Samara:53.2,50.1;Europe/San_Marino:43.9,12.5;Europe/Sarajevo:43.9,18.4;Europe/Saratov:51.6,46;Europe/Simferopol:45,34.1;Europe/Skopje:42,21.4;Europe/Sofia:42.7,23.3;Europe/Stockholm:59.3,18.1;Europe/Tallinn:59.4,24.8;Europe/Tirane:41.3,19.8;Europe/Ulyanovsk:54.3,48.4;Europe/Vaduz:47.1,9.5;Europe/Vatican:41.9,12.5;Europe/Vienna:48.2,16.3;Europe/Vilnius:54.7,25.3;Europe/Volgograd:48.7,44.4;Europe/Warsaw:52.2,21;Europe/Zagreb:45.8,16;Europe/Zurich:47.4,8.5;Indian/Antananarivo:-18.9,47.5;Indian/Chagos:-7.3,72.4;Indian/Christmas:-10.4,105.7;Indian/Cocos:-12.2,96.9;Indian/Comoro:-11.7,43.3;Indian/Kerguelen:-49.4,70.2;Indian/Mahe:-4.7,55.5;Indian/Maldives:4.2,73.5;Indian/Mauritius:-20.2,57.5;Indian/Mayotte:-12.8,45.2;Indian/Reunion:-20.9,55.5;Pacific/Apia:-13.8,-171.7;Pacific/Auckland:-36.9,174.8;Pacific/Bougainville:-6.2,155.6;Pacific/Chatham:-44,-176.6;Pacific/Chuuk:7.4,151.8;Pacific/Easter:-27.1,-109.4;Pacific/Efate:-17.7,168.4;Pacific/Fakaofo:-9.4,-171.2;Pacific/Fiji:-18.1,178.4;Pacific/Funafuti:-8.5,179.2;Pacific/Galapagos:-0.9,-89.6;Pacific/Gambier:-23.1,-134.9;Pacific/Guadalcanal:-9.5,160.2;Pacific/Guam:13.5,144.8;Pacific/Honolulu:21.3,-157.9;Pacific/Kanton:-2.8,-171.7;Pacific/Kiritimati:1.9,-157.3;Pacific/Kosrae:5.3,163;Pacific/Kwajalein:9.1,167.3;Pacific/Majuro:7.2,171.2;Pacific/Marquesas:-9,-139.5;Pacific/Midway:28.2,-177.4;Pacific/Nauru:-0.5,166.9;Pacific/Niue:-19,-169.9;Pacific/Norfolk:-29.1,168;Pacific/Noumea:-22.3,166.4;Pacific/Pago_Pago:-14.3,-170.7;Pacific/Palau:7.3,134.5;Pacific/Pitcairn:-25.1,-130.1;Pacific/Pohnpei:7,158.2;Pacific/Port_Moresby:-9.5,147.2;Pacific/Rarotonga:-21.2,-159.8;Pacific/Saipan:15.2,145.8;Pacific/Tahiti:-17.5,-149.6;Pacific/Tarawa:1.4,173;Pacific/Tongatapu:-21.1,-175.2;Pacific/Wake:19.3,166.6;Pacific/Wallis:-13.3,-176.2';
// Timestamp -> daftar {label, ms, note}: epoch s/ms/µs/ns, .NET ticks, ISO/RFC, "YYYY-MM-DD HH:mm" (zona patokan), JWT exp/iat/nbf, JSON.
const CLK_TS_KEYS = ['exp', 'iat', 'nbf', 'auth_time', 'updated_at', 'created_at', 'timestamp', 'time', 'ts'];
function clkNumStamp(n, raw) {
  const a = Math.abs(n), dig = String(raw || Math.trunc(a)).replace(/^-/, '').split('.')[0].length;
  if (dig >= 18 && a > 4e17 && a < 4e18) return { ms: (n - 621355968000000000) / 10000, unit: '.NET ticks' };
  if (a < 1e11) return { ms: n * 1000, unit: 'detik' };
  if (a < 1e14) return { ms: n, unit: 'milidetik' };
  if (a < 1e17) return { ms: n / 1000, unit: 'mikrodetik' };
  return { ms: n / 1e6, unit: 'nanodetik' };
}
function clkB64Json(part) {
  const b = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))));
}
function clkParseStamp(text, base) {
  const t = String(text || '').trim().replace(/^["']|["'],?$/g, '');
  if (!t) return { items: [] };
  const fromObj = (o, pre) => CLK_TS_KEYS.filter(k => typeof o[k] === 'number' || (typeof o[k] === 'string' && /^\d{9,19}$/.test(o[k])))
    .map(k => { const n = Number(o[k]), r = clkNumStamp(n, String(o[k])); return { label: pre + k, ms: r.ms, unit: r.unit }; });
  if (/^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*$/.test(t)) {
    try { const it = fromObj(clkB64Json(t.split('.')[1]), 'JWT '); return it.length ? { items: it } : { err: 'jwt' }; } catch (e) { return { err: 'jwt' }; }
  }
  if (t.charAt(0) === '{') {
    try { const it = fromObj(JSON.parse(t), ''); return it.length ? { items: it } : { err: 'json' }; } catch (e) { return { err: 'json' }; }
  }
  if (/^-?\d+(\.\d+)?$/.test(t)) { const r = clkNumStamp(Number(t), t); return { items: [{ label: 'epoch', ms: r.ms, unit: r.unit }] }; }
  const m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,3})\d*)?)?)?$/);
  if (m) {
    const z = n => String(n).padStart(2, '0');
    const ms = clkFromWall(base, m[1] + '-' + z(m[2]) + '-' + z(m[3]) + 'T' + z(m[4] || 0) + ':' + z(m[5] || 0));
    if (ms != null) return { items: [{ label: 'tanggal', ms: ms + Number(m[6] || 0) * 1000 + Number((m[7] || '0').padEnd(3, '0')), unit: 'zona' }] };
  }
  const d = Date.parse(t);
  if (!isNaN(d)) return { items: [{ label: 'tanggal', ms: d, unit: 'iso' }] };
  return { err: 'unknown' };
}
let clkLandBits = null, clkCoordMap = null;
function clkLand() {
  if (!clkLandBits) { const b = atob(CLK_LAND); clkLandBits = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) clkLandBits[i] = b.charCodeAt(i); }
  return clkLandBits;
}
function clkCoord(tz) {
  if (!clkCoordMap) { clkCoordMap = {}; CLK_COORD_RAW.split(';').forEach(x => { const i = x.indexOf(':'), ll = x.slice(i + 1).split(','); clkCoordMap[x.slice(0, i)] = [Number(ll[0]), Number(ll[1])]; }); }
  return clkCoordMap[tz] || null;
}
// Peta dunia titik-titik: daratan terang = siang, redup = malam (posisi matahari pada ms), penanda jam saya + pin.
function clkDrawMap(c, ms, marks) {
  const dpr = window.devicePixelRatio || 1, w = Math.max(240, c.clientWidth || 480), h = Math.round(w / 2);
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const d = new Date(ms), day = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000;
  const decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + day) / 365);
  const subLon = -15 * (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 - 12);
  const X = lon => (lon + 180) / 360 * w, Y = lat => (90 - lat) / 180 * h;
  const bits = clkLand(), cw = w / CLK_MAP_W, ch = h / CLK_MAP_H, r = Math.max(0.8, Math.min(cw, ch) * 0.36);
  for (let row = 0; row < CLK_MAP_H; row++) {
    const lat = 90 - (row + 0.5) * 180 / CLK_MAP_H, phi = lat * Math.PI / 180;
    for (let col = 0; col < CLK_MAP_W; col++) {
      const i = row * CLK_MAP_W + col;
      const land = (bits[i >> 3] >> (7 - (i & 7))) & 1;
      const lon = -180 + (col + 0.5) * 360 / CLK_MAP_W, H = (lon - subLon) * Math.PI / 180;
      const alt = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H);
      if (land) g.fillStyle = alt > 0.05 ? 'rgba(250,204,21,.85)' : alt > -0.1 ? 'rgba(148,163,184,.65)' : 'rgba(71,85,105,.75)';
      else { if (alt <= 0.05) continue; g.fillStyle = 'rgba(56,189,248,.10)'; }
      g.beginPath(); g.arc(col * cw + cw / 2, row * ch + ch / 2, land ? r : r * 0.7, 0, Math.PI * 2); g.fill();
    }
  }
  g.font = '600 11px system-ui, Segoe UI, sans-serif';
  const placed = [];
  marks.forEach(m => {
    const x = X(m.lon);
    if (m.line) { g.strokeStyle = m.color; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.setLineDash([]); }
    const y = m.line ? h * 0.5 : Y(m.lat);
    g.fillStyle = m.color; g.strokeStyle = '#0f172a'; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, m.me ? 6 : 4.5, 0, Math.PI * 2); g.fill(); g.stroke(); g.lineWidth = 1;
    if (m.me) { g.strokeStyle = m.color; g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.stroke(); }
    const txt = m.text, tw = g.measureText(txt).width + 8;
    let lx = Math.min(w - tw - 2, Math.max(2, x - tw / 2)), ly = y - 24;
    if (ly < 2) ly = y + 12;
    for (let k = 0; k < 8 && placed.some(p => lx < p.x + p.w && lx + tw > p.x && ly < p.y + 17 && ly + 17 > p.y); k++) ly += 18;
    placed.push({ x: lx, y: ly, w: tw });
    g.fillStyle = 'rgba(15,23,42,.88)'; g.fillRect(lx, ly, tw, 17);
    g.strokeStyle = m.color; g.strokeRect(lx + 0.5, ly + 0.5, tw - 1, 16);
    g.fillStyle = '#f8fafc'; g.fillText(txt, lx + 4, ly + 12.5);
  });
}
const CLK_I18N = {
  id: {
    tab_clock: 'Jam Dunia', clk_title: 'Jam Dunia — cek jam di kota / zona lain',
    clk_intro: 'Cari nama kota, negara, singkatan zona (WIB, WITA, JST, PST) atau offset (utc 7, UTC+7, GMT-5, +05:30). Jam di sana langsung tampil dibanding jam Anda, termasuk selisih dan hari (besok/kemarin). Pin kota yang sering dipakai; atur jam tertentu untuk konversi. Semua dihitung lokal di browser, DST otomatis.',
    clk_mine: 'Jam saya', clk_at: 'Waktu', clk_base: 'Patokan zona', clk_live: 'live (sekarang)', clk_fixed: 'waktu diatur manual', clk_now: 'Kembali ke sekarang',
    clk_search_ph: 'Cari: Tokyo, New York, Jepang, Bali, WITA, PST, utc 7, GMT-5 ...', clk_none: 'Tidak ketemu. Coba nama kota besar, negara, atau tulis offset seperti utc+7.',
    clk_th_place: 'Kota / zona', clk_th_time: 'Jam', clk_th_date: 'Tanggal', clk_th_diff: 'Selisih dari jam saya',
    clk_pin: 'Pin', clk_pinned: 'Sudah dipin', clk_unpin: 'Lepas pin', clk_pins: 'Kota yang dipin',
    clk_same: 'sama dengan jam saya', clk_ahead: '{d} lebih maju dari jam saya', clk_behind: '{d} lebih lambat dari jam saya',
    clk_h: '{n} jam', clk_m: '{n} mnt', clk_tomorrow: 'besok', clk_yesterday: 'kemarin', clk_dplus: '+{n} hari', clk_dminus: '-{n} hari',
    clk_plan: 'Perbandingan jam (24 jam)', clk_plan_desc: 'Baris pertama = jam saya hari ini. Klik satu kolom untuk melihat semua kota di jam itu.',
    clk_ts_title: 'Konverter timestamp', clk_ts_desc: 'paste epoch, tanggal, JWT, atau JSON; semua jam di bawah ikut pindah ke waktu itu.',
    clk_ts_ph: '1793678400 · 1793678400000 · 2026-11-03T10:00:00Z · 2026-11-03 17:00 · eyJhbGciOi... (JWT) · {"exp": 1793678400} · 638982720000000000 (.NET ticks)',
    clk_ts_src: 'Sumber', clk_ts_rel: 'Dari sekarang', clk_ts_use: 'Tampilkan', clk_ts_shown: 'Waktu yang tampil (epoch detik · ms · ISO)', clk_ts_copy: 'salin epoch',
    clk_ts_date: 'tanggal', clk_ts_now: 'sekarang', clk_ts_in: '{d} lagi', clk_ts_ago: '{d} lalu', clk_d: '{n} hari', clk_s: '{n} dtk',
    clk_ts_u_detik: 'epoch detik (Unix, JWT)', clk_ts_u_milidetik: 'epoch milidetik (JavaScript, Java)', clk_ts_u_mikrodetik: 'epoch mikrodetik', clk_ts_u_nanodetik: 'epoch nanodetik',
    clk_ts_u_netticks: '.NET DateTime.Ticks (UTC)', clk_ts_u_zona: 'tanpa zona: dibaca sebagai jam di "Patokan zona"', clk_ts_u_iso: 'tanggal dengan zona/format standar',
    clk_ts_err_jwt: 'JWT tidak terbaca atau tidak punya exp/iat/nbf.', clk_ts_err_json: 'JSON tidak valid atau tidak ada field waktu (exp, iat, nbf, timestamp, ...).', clk_ts_err_unknown: 'Format tidak dikenali. Contoh: 1793678400, 2026-11-03T10:00:00Z, 2026-11-03 17:00, atau token JWT.',
    clk_map_me: 'Saya', clk_map_legend: '🔵 jam saya · 🟠 kota yang dipin (garis putus = offset UTC tetap) · daratan kuning = siang, abu-abu = senja/fajar, gelap = malam.',
    clk_legend: 'Hijau = jam kerja (08-17), kuning = pagi/malam (06-22), gelap = tengah malam. ⁺¹ = besok, ⁻¹ = kemarin (dibanding tanggal saya). Kolom bergaris = jam yang sedang ditampilkan.',
    clk_note: 'Zona waktu memakai database bawaan browser (IANA), jadi jam musim panas (DST) di Eropa/Amerika/Australia ikut dihitung. Offset tetap (UTC+7 dll.) tidak punya DST.',
    grp_clock_title: 'Jam Dunia', grp_clock_desc: 'Tidak memakai API: zona waktu dari Intl bawaan browser.'
  },
  en: {
    tab_clock: 'World Clock', clk_title: 'World Clock — time in other cities / zones',
    clk_intro: 'Search a city, country, zone abbreviation (UTC, EST, JST, PST) or offset (utc 7, UTC+7, GMT-5, +05:30). The time there shows next to your own, with the difference and the day (tomorrow/yesterday). Pin cities you use often; set a specific time to convert. Everything runs locally in the browser, DST included.',
    clk_mine: 'My time', clk_at: 'Time', clk_base: 'Reference zone', clk_live: 'live (now)', clk_fixed: 'time set manually', clk_now: 'Back to now',
    clk_search_ph: 'Search: Tokyo, New York, Japan, London, PST, EST, utc 7, GMT-5 ...', clk_none: 'Not found. Try a big city, a country, or an offset like utc+7.',
    clk_th_place: 'City / zone', clk_th_time: 'Time', clk_th_date: 'Date', clk_th_diff: 'Difference from my time',
    clk_pin: 'Pin', clk_pinned: 'Pinned', clk_unpin: 'Unpin', clk_pins: 'Pinned cities',
    clk_same: 'same as my time', clk_ahead: '{d} ahead of my time', clk_behind: '{d} behind my time',
    clk_h: '{n} h', clk_m: '{n} min', clk_tomorrow: 'tomorrow', clk_yesterday: 'yesterday', clk_dplus: '+{n} days', clk_dminus: '-{n} days',
    clk_plan: 'Time comparison (24 h)', clk_plan_desc: 'First row = my hours today. Click a column to see every city at that hour.',
    clk_ts_title: 'Timestamp converter', clk_ts_desc: 'Paste an epoch timestamp, date, JWT, or JSON; every clock below jumps to that moment.',
    clk_ts_ph: '1793678400 · 1793678400000 · 2026-11-03T10:00:00Z · 2026-11-03 17:00 · eyJhbGciOi... (JWT) · {"exp": 1793678400} · 638982720000000000 (.NET ticks)',
    clk_ts_src: 'Source', clk_ts_rel: 'From now', clk_ts_use: 'Show', clk_ts_shown: 'Shown time (epoch seconds · ms · ISO)', clk_ts_copy: 'copy epoch',
    clk_ts_date: 'date', clk_ts_now: 'now', clk_ts_in: 'in {d}', clk_ts_ago: '{d} ago', clk_d: '{n} d', clk_s: '{n} s',
    clk_ts_u_detik: 'epoch seconds (Unix, JWT)', clk_ts_u_milidetik: 'epoch milliseconds (JavaScript, Java)', clk_ts_u_mikrodetik: 'epoch microseconds', clk_ts_u_nanodetik: 'epoch nanoseconds',
    clk_ts_u_netticks: '.NET DateTime.Ticks (UTC)', clk_ts_u_zona: 'no zone: read as wall time in "Reference zone"', clk_ts_u_iso: 'date with a zone / standard format',
    clk_ts_err_jwt: 'Invalid JWT or missing exp/iat/nbf claims.', clk_ts_err_json: 'Invalid JSON or no recognized timestamp fields (exp, iat, nbf, timestamp).', clk_ts_err_unknown: 'Unknown format. Examples: 1793678400, 2026-11-03T10:00:00Z, 2026-11-03 17:00, or a JWT.',
    clk_map_me: 'Me', clk_map_legend: '🔵 my time · 🟠 pinned cities (dashed line = fixed UTC offset) · yellow land = daytime, grey = dusk/dawn, dark = night.',
    clk_legend: 'Green = working hours (08-17), yellow = morning/evening (06-22), dark = night. ⁺¹ = tomorrow, ⁻¹ = yesterday (vs my date). The striped column = the time being shown.',
    clk_note: 'Time zones come from the browser\'s built-in database (IANA), so daylight saving time (DST) in Europe/America/Australia is included. Fixed offsets (UTC+7 etc.) have no DST.',
    grp_clock_title: 'World Clock', grp_clock_desc: 'Uses no server API: time zones come from the browser\'s built-in Intl.'
  }
};
Object.keys(CLK_I18N).forEach(l => { I18N[l] = Object.assign({}, CLK_I18N[l], I18N[l] || {}); });
const PING_I18N = {
  id: {
    tab_ping: 'Multi Ping', ping_title: 'Multi Ping — pantau server & API',
    ping_intro: 'Cek banyak URL sekaligus secara berkala, seperti dashboard server: tahu mana yang nyala/mati, cek VPN sudah konek (ping server intranet), dan dapat alarm suara saat server yang ditunggu nyala lagi. Daftar URL disimpan di browser ini (localStorage). Cek memakai request HTTP dari browser, bukan ICMP.',
    ping_mixed_warn: 'Target http:// diblokir browser karena halaman ini dibuka lewat https (mixed content). Status BLOCKED tidak dihitung gagal. Pilih salah satu:',
    ping_fix_local: 'Unduh versi lokal (satu file HTML), lalu klik sekali file itu di daftar unduhan Chrome (Ctrl+J). Dibuka sebagai file://, http dan https sama-sama bisa dicek.',
    ping_fix_allow: 'Atau tanpa unduh: klik ikon di kiri address bar → Site settings → Insecure content = Allow → reload. Server intranet/VPN mungkin memunculkan izin akses jaringan lokal; pilih Izinkan.',
    ping_dl_local: 'Unduh versi lokal', ping_dl_done: 'File scanner-security-lokal.html terunduh. Buka lewat Ctrl+J (klik sekali), daftar target perlu di-import ulang (Export JSON di sini → Import JSON di sana).',
    ping_dl_fail: 'Gagal membuat versi lokal:', ping_mixed_ok: 'Insecure content diizinkan untuk situs ini: target http ikut dicek.',
    ping_total: 'Total', ping_avg_all: 'Rata-rata', ping_alarm_up: 'Sudah nyala lagi:', ping_alarm_down: 'Mati:', ping_alarm_stop: 'Matikan alarm',
    ping_start: 'Mulai', ping_pause: 'Jeda', ping_paused: 'jeda', ping_check_now: 'Cek sekarang', ping_sound: 'Suara', ping_test_sound: 'Tes suara',
    ping_alarm_down_opt: 'Alarm juga saat ada yang mati', ping_notif: 'Notifikasi desktop',
    ping_add_title: '➕ Tambah server / API', ping_edit_title: '✎ Edit target', ping_f_name: 'Nama', ping_f_name_ph: 'mis. Server B',
    ping_f_group: 'Grup', ping_f_group_ph: 'mis. VPN Kantor', ping_f_interval: 'Interval (dtk)', ping_f_timeout: 'Timeout (ms)', ping_f_expect: 'Dianggap UP bila',
    ping_exp_any: 'server menjawab', ping_exp_lt500: 'status < 500', ping_exp_2xx: 'status 2xx/3xx',
    ping_save: 'Simpan', ping_add: 'Tambah', ping_cancel: 'Batal', ping_samples: 'Tambah contoh',
    ping_bulk_title: 'Tambah banyak sekaligus', ping_bulk_desc: 'Satu baris satu target: cukup URL/IP, atau "nama | url | grup | interval". Tanpa http(s):// → IP lokal pakai http, lainnya https.',
    ping_bulk_add: 'Tambah semua', ping_export: 'Export JSON', ping_import: 'Import JSON', ping_clear_all: 'Hapus semua',
    ping_search_ph: 'Cari nama / URL / grup', ping_f_all: 'Semua', ping_f_down: 'Mati saja', ping_f_up: 'Nyala saja',
    ping_th_name: 'Nama / URL', ping_th_last: 'Terakhir', ping_th_avg: 'Rata-rata', ping_th_code: 'Kode', ping_th_checked: 'Dicek', ping_th_graph: 'Grafik',
    ping_every: 'tiap', ping_detail: 'Detail & grafik', ping_edit: 'Edit', ping_delete: 'Hapus', ping_close: 'Tutup', ping_clear_hist: 'Hapus riwayat',
    ping_events: 'Perubahan status', ping_no_events: 'Belum ada perubahan status.',
    ping_added: '{n} target ditambahkan.', ping_skipped: '{n} baris dilewati (URL tidak valid / sudah ada).', ping_confirm_del: 'Hapus target "{n}"?', ping_confirm_all: 'Hapus semua {n} target?',
    ping_bad_url: 'URL tidak valid (harus http/https).', ping_imported: '{n} target di-import.', ping_import_bad: 'File bukan export Multi Ping.',
    ping_notif_denied: 'Notifikasi ditolak browser.',
    ping_st_up: 'UP', ping_st_down: 'DOWN', ping_st_wait: 'menunggu', ping_st_blocked: 'BLOCKED',
    ping_n_timeout: 'timeout: tidak ada jawaban sampai batas waktu', ping_n_neterr: 'gagal konek (host mati, port tertutup, DNS gagal, atau VPN belum konek)',
    ping_n_code: 'server menjawab tapi status tidak sesuai syarat', ping_n_mixed: 'http diblokir di halaman https (lihat cara di kotak ungu atas); tidak dihitung gagal', ping_n_opaque: 'server menjawab; kode HTTP tidak terbaca (server tidak kirim header CORS)',
    ping_tip_status: 'UP = server menjawab sesuai syarat. DOWN = gagal konek/timeout/status tidak sesuai. BLOCKED = diblokir browser.',
    ping_tip_ms: 'Waktu satu request HTTP (DNS + TCP + TLS + proses server sampai header diterima). Bukan ICMP ping, jadi biasanya lebih besar dari ping di terminal.',
    ping_tip_avg: 'Rata-rata ms dari request yang berhasil di riwayat.', ping_tip_uptime: 'Persen cek yang UP dari semua cek di riwayat.',
    ping_tip_code: 'Kode status HTTP. OK* = server menjawab tapi kodenya tidak bisa dibaca karena CORS.', ping_tip_opaque: 'Server menjawab, tapi tidak mengirim header CORS sehingga kode HTTP tidak terbaca. Tetap dihitung UP.',
    ping_tip_spark: 'Batang per cek: hijau < 200 ms, kuning < 800 ms, oranye lebih lambat, merah = gagal. Klik untuk detail.',
    ping_tip_group: 'Jumlah UP / total di grup ini. Contoh: grup VPN semuanya DOWN = VPN kemungkinan belum konek.',
    ping_tip_bell: 'Alarm: bunyi saat target ini nyala lagi setelah mati.', ping_tip_sound: 'Bunyi alarm saat server yang ditandai 🔔 nyala lagi. Klik sekali di halaman ini dulu supaya browser mengizinkan suara.',
    ping_tip_alarm_down: 'Bunyi juga saat target yang tadinya UP jadi DOWN.', ping_tip_expect: 'Server menjawab = status apa pun dianggap nyala. Status < 500 = error server (5xx, mis. 503 overload) dianggap mati.',
    ping_c_last: 'Terakhir', ping_c_avg: 'Rata-rata', ping_c_min: 'Min', ping_c_max: 'Max', ping_c_p95: 'p95', ping_c_jitter: 'Jitter', ping_c_uptime: 'Uptime', ping_c_loss: 'Gagal', ping_c_n: 'Jumlah cek', ping_c_code: 'Kode terakhir', ping_c_since: 'Status sejak',
    ping_tc_min: 'Low = request tercepat di riwayat.', ping_tc_max: 'High = request paling lambat di riwayat.', ping_tc_p95: '95% request lebih cepat dari angka ini; lebih mewakili "lambat yang sering" dibanding max.',
    ping_tc_jitter: 'Rata-rata selisih ms antar cek berurutan. Tinggi = koneksi naik-turun (tidak stabil).', ping_tc_loss: 'Persen cek yang gagal/timeout.', ping_tc_n: 'Jumlah cek di riwayat (maks 720 per target, 200 terakhir disimpan).', ping_tc_since: 'Lama status sekarang bertahan.',
    ping_help_title: 'ℹ️ Penjelasan angka & batasan',
    ping_h_ms_t: 'ms (latency)', ping_h_ms: 'waktu satu request HTTP dari browser: DNS + buka koneksi TCP + TLS (https) + server memproses sampai header balasan diterima. Cek pertama sering lebih lama karena DNS/TLS baru. Patokan kasar: < 200 ms cepat, 200-800 ms lumayan, > 800 ms lambat.',
    ping_h_up_t: 'UP / DOWN', ping_h_up: 'UP = ada jawaban HTTP (sesuai syarat "Dianggap UP bila"). DOWN = tidak bisa konek, timeout, atau status tidak sesuai (mis. 503 saat API overload bila syarat status < 500).',
    ping_h_stat_t: 'Rata-rata, p95, jitter, uptime', ping_h_stat: 'dihitung dari riwayat cek di browser ini. p95 = 95% request lebih cepat dari angka itu. Jitter = seberapa naik-turun ms antar cek. Uptime = persen cek yang UP.',
    ping_h_cors_t: 'Kode OK*', ping_h_cors: 'banyak server tidak mengizinkan halaman lain membaca responsnya (CORS). Browser tetap tahu server menjawab, jadi dihitung UP, tapi kode HTTP-nya tidak terlihat.',
    ping_h_vpn_t: 'Cek VPN', ping_h_vpn: 'buat grup berisi server intranet (mis. 10.x). Kalau semua di grup itu DOWN, kemungkinan VPN belum konek. Server intranet umumnya http, jadi buka index.html lokal (file://), bukan versi https online. Chrome bisa menanyakan izin akses jaringan lokal; pilih Izinkan.',
    ping_h_port_t: 'Batasan', ping_h_port: 'browser tidak bisa ICMP ping atau cek port non-HTTP (mis. SSH 22 diblokir browser). Ping server lewat port web/aplikasinya (mis. http://host:8080/health). Di tab latar, Chrome bisa memperlambat timer; ticker memakai Web Worker supaya tetap jalan, tapi biarkan tab ini terbuka.',
    ping_h_alarm_t: 'Alarm', ping_h_alarm: 'tandai target dengan 🔔. Saat statusnya berubah dari DOWN ke UP, bunyi alarm diulang tiap 8 dtk terus sampai tombol Matikan alarm diklik. Kalau target itu mati lagi sebelum alarm dimatikan, alarmnya berhenti sendiri (begitu juga alarm "mati" berhenti saat targetnya nyala lagi). Klik sekali di halaman ini dulu supaya browser mengizinkan suara.',
    ping_nogroup: '(tanpa grup)', ping_ago_s: '{n} dtk lalu', ping_ago_m: '{n} mnt lalu', ping_ago_h: '{n} jam lalu',
    grp_ping_title: 'Multi Ping — cek server', grp_ping_desc: 'Request HTTP langsung dari browser ke URL yang Anda daftarkan, tanpa layanan pihak ketiga.'
  },
  en: {
    tab_ping: 'Multi Ping', ping_title: 'Multi Ping — monitor servers & APIs',
    ping_intro: 'Check many URLs at once on a schedule, like a server dashboard: see what is up/down, check whether your VPN is connected (ping intranet servers), and get a sound alarm when the server you are waiting for comes back online. The URL list is stored in this browser (localStorage). Checks use HTTP requests from the browser, not ICMP.',
    ping_mixed_warn: 'http:// targets are blocked by the browser because this page is served over https (mixed content). BLOCKED is not counted as a failure. Pick one:',
    ping_fix_local: 'Download the local version (one HTML file), then click that file once in Chrome\'s downloads (Ctrl+J). Opened as file://, both http and https can be checked.',
    ping_fix_allow: 'Or without downloading: click the icon left of the address bar → Site settings → Insecure content = Allow → reload. Intranet/VPN servers may trigger a local network access prompt; choose Allow.',
    ping_dl_local: 'Download local version', ping_dl_done: 'scanner-security-lokal.html downloaded. Open it via Ctrl+J (one click); re-import your targets there (Export JSON here → Import JSON there).',
    ping_dl_fail: 'Could not build the local version:', ping_mixed_ok: 'Insecure content is allowed for this site: http targets are checked too.',
    ping_total: 'Total', ping_avg_all: 'Average', ping_alarm_up: 'Back online:', ping_alarm_down: 'Down:', ping_alarm_stop: 'Stop alarm',
    ping_start: 'Start', ping_pause: 'Pause', ping_paused: 'paused', ping_check_now: 'Check now', ping_sound: 'Sound', ping_test_sound: 'Test sound',
    ping_alarm_down_opt: 'Also alarm when a target goes down', ping_notif: 'Desktop notification',
    ping_add_title: '➕ Add server / API', ping_edit_title: '✎ Edit target', ping_f_name: 'Name', ping_f_name_ph: 'e.g. Server B',
    ping_f_group: 'Group', ping_f_group_ph: 'e.g. Office VPN', ping_f_interval: 'Interval (s)', ping_f_timeout: 'Timeout (ms)', ping_f_expect: 'Considered UP when',
    ping_exp_any: 'server responds', ping_exp_lt500: 'status < 500', ping_exp_2xx: 'status 2xx/3xx',
    ping_save: 'Save', ping_add: 'Add', ping_cancel: 'Cancel', ping_samples: 'Add samples',
    ping_bulk_title: 'Bulk add targets', ping_bulk_desc: 'One target per line: just a URL/IP, or "name | url | group | interval". Without http(s):// → local IPs use http, others https.',
    ping_bulk_add: 'Add all', ping_export: 'Export JSON', ping_import: 'Import JSON', ping_clear_all: 'Delete all',
    ping_search_ph: 'Search name / URL / group', ping_f_all: 'All', ping_f_down: 'Down only', ping_f_up: 'Up only',
    ping_th_name: 'Name / URL', ping_th_last: 'Last', ping_th_avg: 'Average', ping_th_code: 'Code', ping_th_checked: 'Checked', ping_th_graph: 'Graph',
    ping_every: 'every', ping_detail: 'Details & graph', ping_edit: 'Edit', ping_delete: 'Delete', ping_close: 'Close', ping_clear_hist: 'Clear history',
    ping_events: 'Status changes', ping_no_events: 'No status changes yet.',
    ping_added: '{n} targets added.', ping_skipped: '{n} lines skipped (invalid URL / already listed).', ping_confirm_del: 'Delete target "{n}"?', ping_confirm_all: 'Delete all {n} targets?',
    ping_bad_url: 'Invalid URL (must be http/https).', ping_imported: '{n} targets imported.', ping_import_bad: 'Not a Multi Ping export file.',
    ping_notif_denied: 'The browser denied notifications.',
    ping_st_up: 'UP', ping_st_down: 'DOWN', ping_st_wait: 'waiting', ping_st_blocked: 'BLOCKED',
    ping_n_timeout: 'timeout: no response within the time limit', ping_n_neterr: 'connection failed (host down, port closed, DNS error, or VPN disconnected)',
    ping_n_code: 'server responded but status does not match criteria', ping_n_mixed: 'HTTP target blocked on HTTPS page (mixed content; see purple box above); not counted as failure', ping_n_opaque: 'server responded; HTTP status code unreadable (no CORS headers)',
    ping_tip_status: 'UP = server responded as required. DOWN = connection failed / timeout / status mismatch. BLOCKED = blocked by the browser.',
    ping_tip_ms: 'Time of one HTTP request (DNS + TCP + TLS + server work until headers arrive). Not ICMP ping, so usually higher than ping in a terminal.',
    ping_tip_avg: 'Average ms of successful requests in the history.', ping_tip_uptime: 'Percentage of checks that were UP in the history.',
    ping_tip_code: 'HTTP status code. OK* = server responded but code cannot be read due to CORS.', ping_tip_opaque: 'Server responded without CORS headers, so HTTP status code is unreadable. Still counted as UP.',
    ping_tip_spark: 'One bar per check: green < 200 ms, yellow < 800 ms, orange slower, red = failed. Click for details.',
    ping_tip_group: 'UP / total in this group. Example: all servers DOWN = the VPN is probably disconnected.',
    ping_tip_bell: 'Alarm: sound when this target comes back online after being down.', ping_tip_sound: 'Play an alarm when a 🔔 server comes back online. Click once on this page first so the browser allows sound.',
    ping_tip_alarm_down: 'Also sound when a target goes from UP to DOWN.', ping_tip_expect: 'Server responds = any status counts as up. Status < 500 = server errors (5xx, e.g. 503 overload) count as down.',
    ping_c_last: 'Last', ping_c_avg: 'Average', ping_c_min: 'Min', ping_c_max: 'Max', ping_c_p95: 'p95', ping_c_jitter: 'Jitter', ping_c_uptime: 'Uptime', ping_c_loss: 'Failed', ping_c_n: 'Checks', ping_c_code: 'Last code', ping_c_since: 'Status since',
    ping_tc_min: 'Low = fastest request in the history.', ping_tc_max: 'High = slowest request in the history.', ping_tc_p95: '95% of requests were faster than this; better represents typical tail latency than max.',
    ping_tc_jitter: 'Average ms difference between consecutive checks. High = unstable connection.', ping_tc_loss: 'Percentage of checks that failed/timed out.', ping_tc_n: 'Checks in the history (max 720 per target, last 200 are saved).', ping_tc_since: 'How long the current status has lasted.',
    ping_help_title: 'ℹ️ What the numbers mean & limits',
    ping_h_ms_t: 'ms (latency)', ping_h_ms: 'Time for one HTTP request from the browser: DNS + TCP connect + TLS (https) + server processing until response headers arrive. The first check is often slower (fresh DNS/TLS). Rough guide: < 200 ms fast, 200-800 ms ok, > 800 ms slow.',
    ping_h_up_t: 'UP / DOWN', ping_h_up: 'UP = HTTP response received (matching "Considered UP when"). DOWN = connection failed, timeout, or status mismatch (e.g. 503 when an API is overloaded, with the status < 500 rule).',
    ping_h_stat_t: 'Average, p95, jitter, uptime', ping_h_stat: 'Computed from check history in this browser. p95 = 95% of requests were faster than that. Jitter = latency variation between consecutive checks. Uptime = percentage of checks that were UP.',
    ping_h_cors_t: 'Code OK*', ping_h_cors: 'Many servers do not allow cross-origin reads (CORS). The browser still knows the server responded, so it counts as UP, but HTTP status code is hidden.',
    ping_h_vpn_t: 'VPN check', ping_h_vpn: 'Create a group of intranet servers (e.g. 10.x). If all servers in that group are DOWN, the VPN is probably disconnected. Intranet servers are usually http, so open index.html locally (file://), not the https online copy. Chrome may ask for local network access; choose Allow.',
    ping_h_port_t: 'Limits', ping_h_port: 'Browsers cannot ICMP ping or probe non-HTTP ports (e.g. SSH 22 is blocked by the browser). Ping the server through its web/app port (e.g. http://host:8080/health). Chrome may throttle timers in background tabs; the ticker runs in a Web Worker to keep going, but keep this tab open.',
    ping_h_alarm_t: 'Alarm', ping_h_alarm: 'Mark a target with 🔔. When its status goes from DOWN to UP, the alarm repeats every 8 s until you click Stop alarm. If that target goes down again before you stop it, the alarm stops automatically (likewise a "down" alarm stops when the target comes back online). Click once on this page first so the browser allows sound.',
    ping_nogroup: '(no group)', ping_ago_s: '{n}s ago', ping_ago_m: '{n} min ago', ping_ago_h: '{n} h ago',
    grp_ping_title: 'Multi Ping — server checks', grp_ping_desc: 'HTTP requests straight from the browser to the URLs you list, no third-party service.'
  }
};
Object.keys(PING_I18N).forEach(l => { I18N[l] = Object.assign({}, PING_I18N[l], I18N[l] || {}); });
const SWAG_I18N = {
  id: {
    tab_swag: 'Swag', swag_title: 'Swag — Swagger/OpenAPI ke Postman & curl',
    swag_intro: 'Ubah halaman Swagger jadi Postman Collection v2.1, kumpulan curl, atau script PowerShell. Support spec lama dan baru (Swagger 2.0, OpenAPI 3.0/3.1, JSON/YAML), Swagger UI 2.x sampai 5, NSwag, dan ReDoc. Body contoh dibuat dari schema, auth jadi variabel {{token}}. Semua diproses di browser.',
    swag_opt1: 'Cara 1 — Bookmarklet di halaman Swagger (paling gampang)',
    swag_bm_desc: 'Drag tombol Swag ke bookmark bar, buka halaman Swagger (mis. /swagger/index.html), lalu klik bookmark-nya. Spec diambil langsung dari halaman itu, jadi cookie/login ikut dan tidak kena CORS. Pilih definisi dan tag, lalu unduh.',
    swag_opt2: 'Cara 2 — Dari file, teks, atau link spec',
    swag_drop: 'Drop swagger.json / openapi.yaml di sini, atau klik untuk pilih file',
    swag_url_ph: 'https://host/swagger/v1/swagger.json', swag_fetch: 'Ambil dari link', swag_samples: 'Contoh:',
    swag_sample_v2: 'Petstore (Swagger 2.0)', swag_sample_v3: 'Petstore (OpenAPI 3)',
    swag_paste_ph: 'Atau paste isi spec JSON/YAML di sini', swag_convert: 'Konversi', swag_src_paste: 'teks',
    swag_cors_hint: 'Kalau server tidak mengizinkan CORS, pakai bookmarklet Swag di halaman Swagger-nya.',
    swag_rel_warn: 'Base URL di spec masih relatif. Isi base URL lengkap (mis. https://host:port/api) supaya request bisa jalan.',
    swag_base: 'Base URL (variabel baseUrl)', swag_token: 'Token / API key (opsional, cuma di memori, ikut ditulis ke file hasil)',
    swag_tags: 'Tag / controller:', swag_all: 'Semua', swag_none: 'Kosongkan',
    swag_dl_pm: 'Unduh Postman (.json)', swag_dl_sh: 'Unduh curl (.sh)', swag_dl_ps: 'Unduh PowerShell (.ps1)',
    swag_preview: 'Preview:', swag_copy: 'Salin', swag_more: '... dan {n} endpoint lain (semua tetap ikut di file).',
    swag_th_method: 'Method', swag_th_path: 'Path', swag_th_name: 'Nama', swag_th_tag: 'Tag', swag_th_auth: 'Auth',
    swag_auth_none: 'tanpa auth', swag_auth_inherit: '-',
    swag_note: 'Import di Postman: Import → pilih file .json. Isi nilai baseUrl/token di tab Variables collection. Swagger 1.x belum didukung.',
    grp_swag_title: 'Swag — Swagger ke Postman/curl', grp_swag_desc: 'Tidak memakai API publik: spec diproses lokal. Ambil dari link memakai "Link langsung" (butuh CORS); bookmarklet membaca spec di tab Swagger itu sendiri.'
  },
  en: {
    tab_swag: 'Swag', swag_title: 'Swag — Swagger/OpenAPI to Postman & curl',
    swag_intro: 'Turn a Swagger page into a Postman Collection v2.1, a set of curl commands, or a PowerShell script. Works with old and new specs (Swagger 2.0, OpenAPI 3.0/3.1, JSON/YAML), Swagger UI 2.x to 5, NSwag and ReDoc. Example bodies are built from the schema, auth becomes a {{token}} variable. Everything runs in the browser.',
    swag_opt1: 'Option 1 — Bookmarklet on the Swagger page (easiest)',
    swag_bm_desc: 'Drag the Swag button to the bookmarks bar, open the Swagger page (e.g. /swagger/index.html), then click the bookmark. The spec is read directly from that page, preserving cookies and login without CORS issues. Pick definitions and tags, then download.',
    swag_opt2: 'Option 2 — From a file, text, or spec link',
    swag_drop: 'Drop swagger.json / openapi.yaml here, or click to pick a file',
    swag_url_ph: 'https://host/swagger/v1/swagger.json', swag_fetch: 'Fetch from link', swag_samples: 'Samples:',
    swag_sample_v2: 'Petstore (Swagger 2.0)', swag_sample_v3: 'Petstore (OpenAPI 3)',
    swag_paste_ph: 'Or paste the JSON/YAML spec here', swag_convert: 'Convert', swag_src_paste: 'text',
    swag_cors_hint: 'If the server does not allow CORS, use the Swag bookmarklet on its Swagger page.',
    swag_rel_warn: 'The base URL in the spec is relative. Enter a full base URL (e.g. https://host:port/api) so requests can run.',
    swag_base: 'Base URL (baseUrl variable)', swag_token: 'Token / API key (optional, memory only, written into the output file)',
    swag_tags: 'Tag / controller:', swag_all: 'All', swag_none: 'None',
    swag_dl_pm: 'Download Postman (.json)', swag_dl_sh: 'Download curl (.sh)', swag_dl_ps: 'Download PowerShell (.ps1)',
    swag_preview: 'Preview:', swag_copy: 'Copy', swag_more: '... and {n} more endpoints (all are still in the file).',
    swag_th_method: 'Method', swag_th_path: 'Path', swag_th_name: 'Name', swag_th_tag: 'Tag', swag_th_auth: 'Auth',
    swag_auth_none: 'no auth', swag_auth_inherit: '-',
    swag_note: 'Import into Postman: Import → select the .json file. Set baseUrl/token in the collection Variables tab. Swagger 1.x is not supported.',
    grp_swag_title: 'Swag — Swagger to Postman/curl', grp_swag_desc: 'Uses no public API: the spec is processed locally. Fetching from a link uses "Direct link" (needs CORS); the bookmarklet reads the spec on the Swagger tab itself.'
  }
};
Object.keys(SWAG_I18N).forEach(l => { I18N[l] = Object.assign({}, SWAG_I18N[l], I18N[l] || {}); });
Object.assign(TEXT_EN, {
  'Mencari spec Swagger/OpenAPI di halaman ini...': 'Looking for a Swagger/OpenAPI spec on this page...', 'Definisi': 'Definition',
  'Ikut token dari tombol Authorize (default: kosong, aman dibagikan)': 'Include the token from the Authorize button (default: empty, safe to share)',
  'Semua': 'All', 'Kosongkan': 'None', 'Muat': 'Load', 'Mencoba ': 'Trying ', 'Memuat ': 'Loading ',
  'Bukan spec Swagger 2.0 / OpenAPI 3.x.': 'Not a Swagger 2.0 / OpenAPI 3.x spec.', 'Spec kosong atau tidak terbaca.': 'The spec is empty or unreadable.',
  'Swagger 1.x belum didukung (upgrade ke Swagger 2.0 / OpenAPI 3).': 'Swagger 1.x is not supported yet (upgrade to Swagger 2.0 / OpenAPI 3).',
  'Spec tidak ditemukan otomatis. Isi URL spec di bawah lalu klik Muat.': 'No spec found automatically. Enter the spec URL below and click Load.',
  'base URL relatif, cek isiannya': 'relative base URL, check it', 'Pilih minimal satu tag.': 'Select at least one tag.',
  'Clipboard ditolak browser. Pakai tombol unduh.': 'The browser blocked the clipboard. Use the download buttons.',
  'Salin Postman': 'Copy Postman', 'Salin curl': 'Copy curl', 'opsional': 'optional', '-Form butuh PowerShell 7+': '-Form needs PowerShell 7+',
  ' pesan · ': ' msgs · ', ' chat · 🔗': ' chats · 🔗', ' · terkirim ': ' · sent ',
  'Scanner dibuka dari file lokal: pakai Salin/Unduh JSON lalu Import di tab WA Hook.': 'Scanner opened from a local file: use Copy/Download JSON then Import on the WA Hook tab.',
  'Popup diblokir: izinkan popup untuk WhatsApp Web, lalu klik Buka tabel.': 'Popup blocked: allow popups for WhatsApp Web, then click Open table.',
  'Buka salah satu chat di WhatsApp Web lalu scroll.': 'Open a chat in WhatsApp Web and scroll.',
  'Tidak ada pesan baru di layar ini.': 'No new messages on this screen.',
  'Auto-scroll ke atas berjalan... klik Stop untuk berhenti.': 'Auto-scrolling up... click Stop to halt.',
  'Auto-scroll dihentikan.': 'Auto-scroll stopped.',
  'Auto-scroll selesai / sudah mentok atas.': 'Auto-scroll finished / reached the top.',
  'Buka/hubungkan tab scanner (tabel WA Hook)': 'Open/connect the scanner tab (WA Hook table)',
  'Scroll otomatis ke atas perlahan untuk mengumpulkan riwayat chat yang sedang dibuka': 'Slowly auto-scroll upward to collect the open chat history',
  'Hook aktif. Buka chat & scroll untuk mengumpulkan pesan.': 'Hook active. Open a chat & scroll to collect messages.',
  'Buka halaman web.whatsapp.com terlebih dahulu.': 'Open web.whatsapp.com first.'
});

// ============================================================
//  DAST tambahan: Clickjacking PoC + JS Bundle Recon
// ============================================================
// Status perlindungan framing dari header respons (hasil HackerTarget di dastCheck).
// frame-ancestors (CSP) mengalahkan X-Frame-Options di browser modern; ALLOW-FROM sudah diabaikan browser.
function cjVerdict(headers) {
  if (!headers || !headers.hdr) return { state: 'unknown', detail: '' };
  const H = headers.hdr;
  const xfo = String(H['x-frame-options'] || '').trim();
  let fa = null;
  String(H['content-security-policy'] || '').split(';').forEach(d => {
    const t = d.trim().split(/\s+/);
    if (t[0] && t[0].toLowerCase() === 'frame-ancestors') fa = t.slice(1).join(' ');
  });
  const parts = [];
  if (xfo) parts.push('X-Frame-Options: ' + xfo);
  if (fa !== null) parts.push('frame-ancestors ' + fa);
  const detail = parts.join(' · ');
  if (fa !== null) {
    const weak = fa.split(/\s+/).some(s => s === '*' || s === 'https:' || s === 'http:' || s === 'data:');
    return { state: weak ? 'weak' : 'safe', detail };
  }
  const x = xfo.toLowerCase();
  if (x === 'deny' || x === 'sameorigin') return { state: 'safe', detail };
  if (x) return { state: 'weak', detail };
  return { state: 'vuln', detail };
}
// Halaman PoC mandiri (file .html) untuk lampiran laporan pentest: target di iframe transparan di atas tombol umpan.
function cjPocHtml(url, L2) {
  const u = esc(url);
  return '<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><title>Clickjacking PoC - ' + u + '</title>\n<style>\n' +
    'body{font-family:system-ui,sans-serif;margin:20px;background:#f8fafc;color:#0f172a}\n' +
    '.stage{position:relative;width:100%;max-width:1000px;height:600px;border:2px dashed #dc2626;background:#fff}\n' +
    '.bait{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:0;background:#dc2626;color:#fff;padding:14px 28px;border-radius:8px;font-size:18px;font-weight:700}\n' +
    'iframe{position:absolute;inset:0;width:100%;height:100%;border:0;z-index:1;opacity:.5}\n' +
    '</style></head><body>\n<h2>Clickjacking PoC</h2>\n<p>Target: <code>' + u + '</code></p>\n<p>' + esc(L2.howto) + '</p>\n' +
    '<label>Opacity <input id="op" type="range" min="0" max="1" step="0.05" value="0.5"></label>\n' +
    '<div class="stage"><div class="bait">' + esc(L2.bait) + '</div><iframe id="f" src="' + u + '"></iframe></div>\n' +
    '<script>document.getElementById("op").addEventListener("input",function(e){document.getElementById("f").style.opacity=e.target.value;});<\/script>\n' +
    '</body></html>\n';
}
const CJ_STATE_SEV = { vuln: 'MEDIUM', weak: 'LOW', safe: '', unknown: '' };
// Bagian laporan "Clickjacking PoC": verdict header + konfirmasi visual + PoC hidup (iframe) + kode PoC.
function cjReportHtml(results, marks) {
  const byUrl = {};
  results.forEach(r => { if (r.url) byUrl[r.url] = r; });
  const urls = Object.keys(byUrl).concat(Object.keys(marks || {}).filter(u => !byUrl[u]));
  if (!urls.length) return '';
  let h = '<h2>' + tr('cj_rep_h') + '</h2><p class="cap">' + tr('cj_rep_note') + '</p>';
  h += '<table><thead><tr>' + ['rep_th_no', 'cj_th_url', 'cj_th_header', 'cj_th_visual', 'rep_th_suggestion'].map(k => '<th>' + tr(k) + '</th>').join('') + '</tr></thead><tbody>';
  urls.forEach((u, i) => {
    const r = byUrl[u], v = cjVerdict(r && r.headers), m = (marks || {})[u] || '';
    const sev = m === 'shown' ? 'MEDIUM' : CJ_STATE_SEV[v.state];
    const hv = tr('cj_state_' + v.state) + (v.detail ? ' (' + esc(v.detail) + ')' : '');
    const vis = m ? tr('cj_vis_' + m) : tr('cj_vis_none');
    const fix = sev ? L("Tambahkan CSP frame-ancestors 'none' (atau 'self') dan X-Frame-Options: DENY untuk browser lama.") : '-';
    h += '<tr><td>' + (i + 1) + '</td><td class="mono">' + esc(u) + '</td><td>' + (sev ? badge(sev) + ' ' : '') + hv + '</td><td>' + vis + '</td><td>' + esc(fix) + '</td></tr>';
  });
  h += '</tbody></table>';
  urls.forEach(u => {
    const poc = cjPocHtml(u, { howto: tr('cj_poc_howto'), bait: tr('cj_bait') });
    h += '<details style="margin-top:10px"><summary>' + tr('cj_rep_live') + ' <span class="mono">' + esc(u) + '</span></summary>' +
      '<div style="position:relative;height:420px;border:2px dashed #dc2626;margin:8px 0;background:#fff">' +
      '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;font-weight:700">' + esc(tr('cj_bait')) + '</div>' +
      '<iframe loading="lazy" src="' + esc(u) + '" sandbox="allow-scripts allow-forms allow-same-origin" style="position:absolute;inset:0;width:100%;height:100%;border:0;opacity:.5"></iframe></div>' +
      '<div class="cap">' + tr('cj_rep_code') + '</div><pre>' + esc(poc) + '</pre></details>';
  });
  return h;
}

// ---- JS Bundle Recon: bookmarklet di tab target (ES5, mandiri, aman untuk CSP halaman).
// Mengambil file JS yang dimuat halaman (origin & site yang sama), source map (komentar sourceMappingURL,
// header SourceMap, atau tebakan <file>.map), lalu mengirim teksnya ke tab scanner untuk dianalisis.
function jsrHookMain(cfg) {
  var T = cfg.L || {};
  if (window.__jsrHook && window.__jsrHook.panel) { try { window.__jsrHook.panel.remove(); } catch (e) { /* abaikan */ } }
  var S = window.__jsrHook = { w: null, ack: false, data: null, panel: null };
  var target = cfg.origin && cfg.origin !== 'null' ? cfg.origin : '*';
  var MAX_FILES = 80, MAX_BYTES = 4000000;
  var panel = document.createElement('div');
  S.panel = panel;
  Object.assign(panel.style, { position: 'fixed', right: '12px', bottom: '12px', width: '340px', background: '#1c1612', color: '#f3ece4', font: '12px/1.45 Consolas,monospace', border: '1px solid #453429', borderRadius: '10px', boxShadow: '0 12px 30px rgba(0,0,0,.55)', zIndex: 2147483647, padding: '10px' });
  var title = document.createElement('b'); title.textContent = 'JS Bundle Recon';
  var info = document.createElement('div'); info.style.margin = '6px 0'; info.textContent = T.collecting || 'Collecting JS files...';
  var bar = document.createElement('div'); bar.style.display = 'flex'; bar.style.gap = '6px'; bar.style.flexWrap = 'wrap';
  function mkBtn(label, fn) {
    var b = document.createElement('button'); b.textContent = label;
    Object.assign(b.style, { background: '#2c211b', color: '#f3ece4', border: '1px solid #453429', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px' });
    b.onclick = fn; return b;
  }
  var sendBtn = mkBtn(T.send || 'Send to scanner', function () { openApp(); send(); });
  var dlBtn = mkBtn(T.download || 'Download JSON', function () {
    if (!S.data) return;
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S.data)], { type: 'application/json' }));
    a.download = 'js-recon-' + location.hostname + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  });
  var closeBtn = mkBtn('×', function () { panel.remove(); });
  bar.appendChild(sendBtn); bar.appendChild(dlBtn); bar.appendChild(closeBtn);
  panel.appendChild(title); panel.appendChild(info); panel.appendChild(bar);
  document.body.appendChild(panel);

  function site(h) { var p = String(h).split('.'); return p.length > 2 ? p.slice(-2).join('.') : h; }
  var mySite = site(location.hostname);
  function urls() {
    var seen = {}, out = [], skipped = [];
    function add(u) {
      try { u = new URL(u, location.href).href.split('#')[0]; } catch (e) { return; }
      if (!/^https?:/i.test(u) || seen[u]) return;
      seen[u] = 1;
      var h = new URL(u).hostname;
      if (site(h) === mySite) out.push(u); else skipped.push(u);
    }
    Array.prototype.forEach.call(document.scripts, function (s) { if (s.src) add(s.src); });
    try { performance.getEntriesByType('resource').forEach(function (r) { if (r.initiatorType === 'script' || /\.m?js(\?|$)/i.test(r.name)) add(r.name); }); } catch (e) { /* abaikan */ }
    return { list: out.slice(0, MAX_FILES), skipped: skipped.slice(0, 200), more: Math.max(0, out.length - MAX_FILES) };
  }
  function getText(u) {
    return fetch(u, { credentials: 'same-origin' }).then(function (r) {
      return r.text().then(function (t) { return { status: r.status, text: t, sm: r.headers.get('sourcemap') || r.headers.get('x-sourcemap') || '', ct: r.headers.get('content-type') || '' }; });
    }).catch(function (e) { return { status: 0, text: '', err: String((e && e.message) || e) }; });
  }
  function cut(t) { return t.length > MAX_BYTES ? t.slice(0, MAX_BYTES) : t; }
  function readMap(txt) {
    var j = null;
    try { j = JSON.parse(txt); } catch (e) { return null; }
    if (!j || typeof j !== 'object' || (!j.mappings && !j.sections) || !Array.isArray(j.sources || [])) return null;
    var src = j.sources || [], sc = j.sourcesContent || [], parts = [], n = 0;
    for (var i = 0; i < src.length; i++) {
      if (typeof sc[i] === 'string') { n++; parts.push('/* ==== ' + src[i] + ' ==== */\n' + sc[i]); }
    }
    return { sources: src.slice(0, 400).map(String), nSources: src.length, withContent: n, content: cut(parts.join('\n')) };
  }
  function mapFor(f, u) {
    var ref = f.sm, m = f.text.slice(-4000).match(/[#@]\s*sourceMappingURL\s*=\s*(\S+)\s*(?:\*\/)?\s*$/);
    if (!ref && m) ref = m[1];
    if (ref && ref.indexOf('data:') === 0) {
      var b = ref.indexOf('base64,'), txt = '';
      try { txt = b >= 0 ? atob(ref.slice(b + 7)) : decodeURIComponent(ref.slice(ref.indexOf(',') + 1)); } catch (e) { txt = ''; }
      var inl = readMap(txt);
      return Promise.resolve({ url: '(inline data:)', inline: true, status: 200, exposed: !!inl, guessed: false, info: inl });
    }
    var mu, guessed = !ref;
    try { mu = new URL(ref || (u.split('?')[0] + '.map'), u).href; } catch (e) { return Promise.resolve(null); }
    return getText(mu).then(function (r) {
      var inf = r.status === 200 ? readMap(r.text) : null;
      return { url: mu, inline: false, status: r.status, exposed: !!inf, guessed: guessed, info: inf, err: r.err || '' };
    });
  }
  function run() {
    var u = urls(), files = [], i = 0;
    var inline = [];
    Array.prototype.forEach.call(document.scripts, function (s) { if (!s.src && s.textContent) inline.push(s.textContent); });
    if (inline.length) files.push({ url: location.href.split('#')[0] + ' (inline <script> x' + inline.length + ')', status: 200, size: inline.join('\n').length, text: cut(inline.join('\n;\n')), inline: true, map: null });
    function next() {
      if (i >= u.list.length) return Promise.resolve();
      var batch = u.list.slice(i, i + 6); i += 6;
      info.textContent = (T.fetching || 'Fetching') + ' ' + Math.min(i, u.list.length) + '/' + u.list.length + '...';
      return Promise.all(batch.map(function (url) {
        return getText(url).then(function (f) {
          var rec = { url: url, status: f.status, size: f.text.length, text: cut(f.text), err: f.err || '', map: null };
          files.push(rec);
          if (f.status !== 200 || !f.text) return null;
          return mapFor(f, url).then(function (m) { rec.map = m; });
        });
      })).then(next);
    }
    return next().then(function () {
      S.data = { kind: 'js-recon', page: location.href, origin: location.origin, at: Date.now(), files: files, skipped: u.skipped, more: u.more };
      var maps = files.filter(function (f) { return f.map && f.map.exposed; }).length;
      info.textContent = files.length + ' ' + (T.files || 'JS files') + ', ' + maps + ' ' + (T.maps || 'source maps exposed') + '. ' + (S.ack ? '' : (T.hint || ''));
      send();
    });
  }
  var pings = 0;
  function openApp() {
    if (S.w && !S.w.closed) return;
    if (!cfg.app) { info.textContent = T.local || 'Scanner is a local file: use Download JSON, then Import.'; return; }
    try { S.w = window.open(cfg.app.split('#')[0] + '#jsr-hook', 'scaJsRecon'); } catch (e) { S.w = null; }
    if (!S.w) { info.textContent = T.popup || 'Popup blocked: allow popups, then click Send.'; return; }
    S.ack = false; pings = 0;
    (function p() {
      if (S.ack || !S.w || S.w.closed || ++pings > 40) return;
      try { S.w.postMessage({ type: 'jsr-hello' }, target); } catch (e) { /* belum siap */ }
      setTimeout(p, 400);
    })();
  }
  function send() {
    if (!S.data || !S.w || S.w.closed || !S.ack) return;
    try { S.w.postMessage({ type: 'jsr-data', data: S.data }, target); info.textContent = T.sent || 'Sent to the scanner tab.'; } catch (e) { info.textContent = 'Error: ' + e.message; }
  }
  window.addEventListener('message', function (e) {
    if (!e.data || e.source !== S.w || (target !== '*' && e.origin !== target)) return;
    if (e.data.type === 'jsr-ack') { if (!S.ack) { S.ack = true; send(); } }
  });
  openApp();
  run();
}

// ---- Analisis JS Recon (di tab scanner). Semua regex dipakai lewat matchAll (bukan exec).
const JSR_SECRET_RULES = [
  { re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g, sev: 'HIGH', rule: 'Private key di file JS', fix: 'Keluarkan private key dari bundle, ganti (rotate) kuncinya, simpan hanya di server.' },
  { re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, sev: 'HIGH', rule: 'AWS access key di file JS', fix: 'Cabut key ini di AWS IAM; akses AWS dari frontend lewat backend atau kredensial sementara (Cognito/STS).' },
  { re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_\w{40,})/g, sev: 'HIGH', rule: 'GitHub token di file JS', fix: 'Cabut token di GitHub, pindahkan pemanggilan ke backend.' },
  { re: /\bxox[abposr]-[A-Za-z0-9-]{10,}|https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/g, sev: 'HIGH', rule: 'Slack token/webhook di file JS', fix: 'Cabut token/webhook di Slack dan kirim notifikasi dari backend.' },
  { re: /\b(?:sk|rk)_live_[0-9A-Za-z]{16,}/g, sev: 'HIGH', rule: 'Stripe secret key di file JS', fix: 'Cabut key di dashboard Stripe; frontend hanya boleh memakai publishable key (pk_).' },
  { re: /\bhttps?:\/\/[^\s:@/"'`]+:[^\s:@/"'`]+@[^\s"'`/]+/g, sev: 'HIGH', rule: 'Username:password di URL', fix: 'Hapus kredensial dari URL, ganti password-nya, pakai autentikasi di backend.' },
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, sev: 'MEDIUM', rule: 'JWT ter-hardcode di file JS', fix: 'Cek isinya di tab JWT; bila token aktif, cabut dan jangan simpan token di bundle.' },
  { re: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g, sev: 'MEDIUM', rule: 'Bearer token ter-hardcode', fix: 'Ambil token saat login (runtime), bukan ditulis di kode.' },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/g, sev: 'LOW', rule: 'Google API key di file JS', fix: 'Key Google di frontend memang publik: batasi per HTTP referrer dan per API di Google Cloud Console.' },
  { re: /\b(?:api[_-]?key|apikey|secret|client[_-]?secret|access[_-]?token|auth[_-]?token|password|passwd)\b["']?\s*[:=]\s*["'`]([^"'`\s]{8,200})["'`]/gi, sev: 'MEDIUM', rule: 'Secret/password ter-hardcode', fix: 'Jangan taruh secret di frontend; pindahkan ke backend atau secret manager lalu ganti nilainya.', group: 1 }
];
const JSR_INTERNAL_RULES = [
  { re: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d{2,5})?\b/g, sev: 'LOW', rule: 'IP internal di file JS', fix: 'Hapus alamat internal dari bundle produksi (pakai konfigurasi per environment).' },
  { re: /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|[a-z0-9.-]+\.(?:local|internal|intranet|corp|lan)|(?:[a-z0-9-]+\.)*[a-z0-9-]*(?:dev|staging|stg|uat|sit|qa|internal)[a-z0-9-]*\.[a-z0-9.-]+)(?::\d+)?(?:\/[^\s"'`<>\\]*)?/gi, sev: 'LOW', rule: 'URL dev/staging/internal di file JS', fix: 'Pastikan build produksi tidak membawa URL environment lain; cek apakah host itu terbuka ke publik.' }
];
const JSR_NOISE_HOST = /(?:^|\.)(?:w3\.org|reactjs\.org|react\.dev|fb\.me|vuejs\.org|angular\.io|mozilla\.org|schema\.org|json-schema\.org|example\.com|jquery\.com|lodash\.com|momentjs\.com|feross\.org|npmjs\.org|nodejs\.org|tc39\.es|whatwg\.org|ecma-international\.org)$/i;
const JSR_STATIC = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|bmp|css|scss|less|woff2?|ttf|eot|otf|mp4|mp3|webm|wav|ogg|pdf)(?:[?#]|$)/i;
const JSR_HOT = /admin|internal|debug|test|upload|token|auth|login|logout|register|user|account|config|setting|graphql|swagger|openapi|actuator|backup|export|import|password|secret|private|key|payment|report/i;
const JSR_EP_RE = /["'`]((?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:\/[^"'`\s<>\\]*)?|\/(?!\/)[A-Za-z0-9_.~%$@!+,;=-]+(?:\/[A-Za-z0-9_.~%$@!+,;={}:-]*)*(?:\?[^"'`\s<>\\]*)?|(?:api|rest|graphql|v\d+)\/[A-Za-z0-9_.~%/{}:-]*(?:\?[^"'`\s<>\\]*)?)["'`]/g;
function jsrMask(v) { v = String(v); return v.length <= 10 ? v.slice(0, 2) + '***' : v.slice(0, 4) + '…' + v.slice(-4); }
function jsrSecretOk(v) {
  if (/\$\{|^\s*$|^(?:true|false|null|undefined)$/i.test(v)) return false;
  if (/^(.)\1+$/.test(v) || /^[A-Z_]+$/.test(v)) return false;
  if (/^(?:AIza|AKIA|ASIA|sk_live_|rk_live_|eyJ|gh[pousr]_|github_pat_|xox)/.test(v)) return false;
  return /\d/.test(v) && /[A-Za-z]/.test(v);
}
function jsrScanText(text, file, add, eps) {
  if (!text) return;
  JSR_SECRET_RULES.concat(JSR_INTERNAL_RULES).forEach(r => {
    let n = 0;
    for (const m of text.matchAll(r.re)) {
      const v = r.group ? m[r.group] : m[0];
      if (r.group && !jsrSecretOk(v)) continue;
      if (r.rule.indexOf('IP internal') === 0 && v.split(':')[0].split('.').some(o => +o > 255)) continue;
      add({ sev: r.sev, kind: r.rule.indexOf('IP internal') === 0 || r.rule.indexOf('URL dev') === 0 ? 'internal' : 'secret', rule: r.rule, value: v.slice(0, 300), file, fix: r.fix });
      if (++n > 200) break;
    }
  });
  let n = 0;
  for (const m of text.matchAll(JSR_EP_RE)) {
    let p = m[1];
    if (p.length < 3 || p.length > 300 || JSR_STATIC.test(p) || /\s/.test(p)) continue;
    if (/^(?:https?:)?\/\//i.test(p)) {
      let h = '';
      try { h = new URL(p, 'https://x.invalid/').hostname; } catch (e) { continue; }
      if (JSR_NOISE_HOST.test(h)) continue;
    } else if (/^\/[a-z]{1,3}$/i.test(p) || /^\/[-+*=.]+$/.test(p)) continue;
    eps(p, file);
    if (++n > 3000) break;
  }
}
// data = {page, origin, at, files:[{url,status,size,text,err,inline,map:{url,status,exposed,guessed,inline,info:{sources,nSources,withContent,content}}}], skipped, more}
function jsrAnalyze(data) {
  const findings = [], fKey = {}, epMap = {};
  const add = f => {
    const k = f.rule + '\u0001' + f.value;
    if (fKey[k]) { if (fKey[k].files.indexOf(f.file) < 0 && fKey[k].files.length < 5) fKey[k].files.push(f.file); return; }
    f.files = [f.file]; fKey[k] = f; findings.push(f);
  };
  const eps = (p, file) => {
    const e = epMap[p] || (epMap[p] = { path: p, files: [], hot: JSR_HOT.test(p), abs: /^(?:https?:)?\/\//i.test(p) });
    if (e.files.indexOf(file) < 0 && e.files.length < 5) e.files.push(file);
  };
  const files = (data.files || []).map(f => {
    jsrScanText(f.text || '', f.url, add, eps);
    const m = f.map;
    if (m && m.exposed) {
      add({ sev: m.inline ? 'LOW' : 'MEDIUM', kind: 'map', rule: m.inline ? 'Source map inline di bundle produksi' : 'Source map terekspos', value: (m.inline ? f.url : m.url) + ' (' + m.info.nSources + ' source, ' + m.info.withContent + ' ' + L('berisi kode asli') + ')', file: f.url, fix: 'Matikan source map di build produksi (mis. productionSourceMap:false / devtool:false / sourcemap:false) atau blokir akses *.map dari publik.' });
      jsrScanText(m.info.content || '', m.inline ? f.url + ' (map)' : m.url, add, eps);
    }
    return { url: f.url, status: f.status, size: f.size || 0, err: f.err || '', inline: !!f.inline, map: m ? { url: m.url, status: m.status, exposed: !!m.exposed, guessed: !!m.guessed, inline: !!m.inline, nSources: m.info ? m.info.nSources : 0, withContent: m.info ? m.info.withContent : 0, sources: m.info ? m.info.sources.slice(0, 400) : [] } : null };
  });
  findings.forEach(f => { f.rule = L(f.rule); f.fix = L(f.fix); });
  findings.sort((a, b) => SEV_ORDER[b.sev] - SEV_ORDER[a.sev]);
  const endpoints = Object.keys(epMap).map(k => epMap[k]).sort((a, b) => (b.hot - a.hot) || a.path.localeCompare(b.path));
  return { page: data.page || '', origin: data.origin || '', at: data.at || Date.now(), files, skipped: data.skipped || [], more: data.more || 0, findings, endpoints };
}
// Bersihkan data kiriman bookmarklet/import (asal bisa origin mana pun): batasi jumlah & tipe.
function jsrClean(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.files)) return null;
  const s = (v, n) => String(v == null ? '' : v).slice(0, n);
  const files = d.files.slice(0, 200).map(f => {
    if (!f || typeof f !== 'object') return null;
    const m = f.map && typeof f.map === 'object' ? f.map : null;
    const inf = m && m.info && typeof m.info === 'object' ? m.info : null;
    return {
      url: s(f.url, 2000), status: +f.status || 0, size: +f.size || 0, text: s(f.text, 6000000), err: s(f.err, 300), inline: !!f.inline,
      map: m ? { url: s(m.url, 2000), status: +m.status || 0, exposed: !!(m.exposed && inf), guessed: !!m.guessed, inline: !!m.inline,
        info: inf ? { sources: (Array.isArray(inf.sources) ? inf.sources : []).slice(0, 400).map(x => s(x, 500)), nSources: +inf.nSources || 0, withContent: +inf.withContent || 0, content: s(inf.content, 6000000) } : null } : null
    };
  }).filter(Boolean);
  return { page: s(d.page, 2000), origin: s(d.origin, 300), at: +d.at || Date.now(), files, skipped: (Array.isArray(d.skipped) ? d.skipped : []).slice(0, 200).map(x => s(x, 2000)), more: +d.more || 0 };
}
// OpenAPI minimal dari endpoint relatif (untuk tab Swag): GET per path, query dibuang, ${...} jadi {param}.
function jsrOpenApi(res) {
  const paths = {};
  let base = res.origin || '';
  res.endpoints.forEach(e => {
    let p = e.path;
    if (e.abs) {
      try { const u = new URL(p, base || 'https://x.invalid/'); if (u.origin !== base) return; p = u.pathname; } catch (err) { return; }
    }
    p = p.split('?')[0].replace(/\$\{[^}]*\}/g, '{param}');
    if (p[0] !== '/') p = '/' + p;
    if (p.length < 2 || paths[p]) return;
    const params = [];
    for (const m of p.matchAll(/\{([^}/]+)\}/g)) params.push({ name: m[1], in: 'path', required: true, schema: { type: 'string' } });
    paths[p] = { get: { summary: e.files[0] || '', tags: [e.hot ? 'js-recon-hot' : 'js-recon'], parameters: params, responses: { 200: { description: 'OK' } } } };
  });
  return { openapi: '3.0.0', info: { title: 'JS Recon ' + (base || res.page), version: '1' }, servers: base ? [{ url: base }] : [], paths };
}
// Bagian laporan DAST "JS Bundle Recon".
function jsrReportHtml(res) {
  if (!res) return '';
  const c = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  res.findings.forEach(f => { c[f.sev] = (c[f.sev] || 0) + 1; });
  const maps = res.files.filter(f => f.map && f.map.exposed).length;
  let h = '<h2>' + tr('jsr_rep_h') + '</h2><p class="cap">' + tr('jsr_rep_page') + ' <span class="mono">' + esc(res.page) + '</span> · ' + esc(new Date(res.at).toLocaleString(LANG === 'en' ? 'en-US' : 'id-ID')) + '</p>';
  h += '<div class="cards"><div class="card"><b>' + res.files.length + '</b><span>' + tr('jsr_c_files') + '</span></div><div class="card ' + (maps ? 'm' : '') + '"><b>' + maps + '</b><span>' + tr('jsr_c_maps') + '</span></div>' +
    '<div class="card h"><b>' + c.HIGH + '</b><span>' + sevL('HIGH') + '</span></div><div class="card m"><b>' + c.MEDIUM + '</b><span>' + sevL('MEDIUM') + '</span></div><div class="card l"><b>' + c.LOW + '</b><span>' + sevL('LOW') + '</span></div>' +
    '<div class="card"><b>' + res.endpoints.length + '</b><span>' + tr('jsr_c_eps') + '</span></div></div>';
  h += '<h3>' + tr('jsr_rep_find') + '</h3>';
  if (!res.findings.length) h += '<p class="cap">' + tr('jsr_none') + '</p>';
  else {
    h += '<p class="cap">' + tr('jsr_rep_mask') + '</p><table><thead><tr>' + ['rep_th_no', 'rep_th_sev', 'rep_th_finding', 'jsr_th_value', 'jsr_th_file', 'rep_th_suggestion'].map(k => '<th>' + tr(k) + '</th>').join('') + '</tr></thead><tbody>';
    res.findings.forEach((f, i) => { h += '<tr><td>' + (i + 1) + '</td><td>' + badge(f.sev) + '</td><td>' + esc(f.rule) + '</td><td class="mono">' + esc(f.kind === 'secret' ? jsrMask(f.value) : f.value) + '</td><td class="mono">' + f.files.map(esc).join('<br>') + '</td><td>' + esc(f.fix) + '</td></tr>'; });
    h += '</tbody></table>';
  }
  h += '<h3>' + tr('jsr_rep_files') + '</h3><table><thead><tr>' + ['rep_th_no', 'jsr_th_file', 'jsr_th_status', 'jsr_th_size', 'jsr_th_map'].map(k => '<th>' + tr(k) + '</th>').join('') + '</tr></thead><tbody>';
  res.files.forEach((f, i) => {
    const m = f.map;
    const ms = !m ? '-' : m.exposed ? '⚠ ' + esc(m.url) + ' (' + m.nSources + ' source)' : esc(tr('jsr_map_no')) + ' (HTTP ' + m.status + (m.guessed ? ', ' + tr('jsr_map_guess') : '') + ')';
    h += '<tr><td>' + (i + 1) + '</td><td class="mono">' + esc(f.url) + '</td><td>' + (f.status || esc(f.err || 'ERR')) + '</td><td>' + Math.round(f.size / 1024) + ' KB</td><td class="mono">' + ms + '</td></tr>';
  });
  h += '</tbody></table>';
  if (res.skipped.length) h += '<details><summary>' + tr('jsr_rep_skipped') + ' (' + res.skipped.length + ')</summary><pre>' + esc(res.skipped.join('\n')) + '</pre></details>';
  const sm = res.files.filter(f => f.map && f.map.exposed && f.map.sources.length);
  if (sm.length) h += '<details><summary>' + tr('jsr_rep_sources') + '</summary><pre>' + esc(sm.map(f => '# ' + f.map.url + '\n' + f.map.sources.join('\n')).join('\n\n')) + '</pre></details>';
  if (res.endpoints.length) {
    h += '<h3>' + tr('jsr_rep_eps') + ' (' + res.endpoints.length + ')</h3><table><thead><tr>' + ['rep_th_no', 'jsr_th_ep', 'jsr_th_hot', 'jsr_th_file'].map(k => '<th>' + tr(k) + '</th>').join('') + '</tr></thead><tbody>';
    res.endpoints.slice(0, 1500).forEach((e, i) => { h += '<tr><td>' + (i + 1) + '</td><td class="mono">' + esc(e.path) + '</td><td>' + (e.hot ? '★' : '') + '</td><td class="mono">' + e.files.map(esc).join('<br>') + '</td></tr>'; });
    h += '</tbody></table>';
  }
  return h;
}
const JSR_I18N = {
  id: {
    cj_head: '🎯 Clickjacking PoC', cj_desc: 'Muat URL di iframe dengan tombol umpan di bawahnya. Kalau halaman tampil, berarti bisa di-frame (X-Frame-Options / frame-ancestors bolong). Tandai hasilnya supaya masuk laporan, atau unduh file PoC untuk lampiran pentest.',
    cj_url_ph: 'https://situs-target.go.id/login', cj_load: 'Muat di iframe', cj_dl: '⬇ Unduh PoC HTML', cj_bait: 'KLAIM HADIAH', cj_opacity: 'Opacity iframe',
    cj_ask: 'Halaman target tampil di iframe?', cj_mark_shown: 'Tampil (rentan)', cj_mark_blocked: 'Kosong / diblokir', cj_marked: 'Tercatat:',
    cj_mixed: 'Target http dari halaman https akan diblokir browser (mixed content), jadi hasilnya kosong walau situsnya rentan. Buka scanner lewat file lokal atau http://localhost untuk target http.',
    cj_bad_url: 'URL tidak valid (harus http/https).',
    cj_rep_h: 'Clickjacking PoC', cj_rep_note: 'Header dibaca dari hasil cek header di atas; kolom visual diisi dari tanda yang dipilih di tab DAST. Buka "PoC hidup" untuk melihat target di iframe transparan di atas tombol umpan.',
    cj_th_url: 'URL', cj_th_header: 'Dari header', cj_th_visual: 'Uji iframe (visual)', cj_rep_live: 'PoC hidup:', cj_rep_code: 'Kode PoC (simpan sebagai .html):',
    cj_state_vuln: 'Tanpa perlindungan', cj_state_weak: 'Perlindungan lemah', cj_state_safe: 'Terlindungi', cj_state_unknown: 'Header tidak terbaca',
    cj_vis_shown: '⚠ Tampil di iframe (rentan)', cj_vis_blocked: '✓ Diblokir', cj_vis_none: 'Belum diuji',
    cj_poc_howto: 'Geser opacity ke 0: target jadi tak terlihat tapi tetap menerima klik di atas tombol umpan. Kalau target tampil di sini, situs bisa di-clickjacking.',
    jsr_head: '🧩 JS Bundle Recon', jsr_desc: 'Bookmarklet ini dijalankan di tab situs target. Isinya: ambil semua file JS dari situs yang sama (plus source map), lalu kirim ke sini. Scanner mencari API key/secret, IP & URL internal, daftar endpoint API, dan file .map yang terekspos.',
    jsr_bm: '🧩 JS Recon', jsr_import: 'Import JSON / file .js / .map', jsr_report: '📄 Buat laporan DAST (+ temuan ini)',
    jsr_got: 'Diterima dari {p}: {n} file JS.', jsr_bad: 'File/JSON tidak dikenali.', jsr_show_full: 'Tampilkan nilai penuh',
    jsr_c_files: 'file JS', jsr_c_maps: 'source map terekspos', jsr_c_eps: 'endpoint', jsr_none: 'Tidak ada secret/URL internal yang terdeteksi.',
    jsr_th_value: 'Nilai', jsr_th_file: 'File', jsr_th_status: 'HTTP', jsr_th_size: 'Ukuran', jsr_th_map: 'Source map', jsr_th_ep: 'Endpoint', jsr_th_hot: 'Menarik',
    jsr_map_no: 'tidak ada', jsr_map_guess: 'tebakan .map', jsr_ep_filter: 'Filter endpoint...', jsr_only_hot: 'Hanya yang menarik (★)',
    jsr_copy_eps: '📋 Salin endpoint', jsr_to_swag: '➡ Kirim ke Swag', jsr_copied: 'Disalin.', jsr_clear: '🗑 Hapus hasil',
    jsr_rep_h: 'JS Bundle Recon', jsr_rep_page: 'Halaman:', jsr_rep_find: 'Secret & alamat internal', jsr_rep_mask: 'Nilai secret disamarkan di laporan.',
    jsr_rep_files: 'File JS yang diperiksa', jsr_rep_skipped: 'Script pihak ketiga (tidak diambil)', jsr_rep_sources: 'Daftar file asli dari source map', jsr_rep_eps: 'Endpoint dari kode JS',
    jsr_steps: 'Cara pakai: seret tombol ke bookmark bar → buka situs target (login dulu bila perlu) → klik bookmark → tab scanner terbuka dan hasil masuk otomatis. Kalau tab tidak terbuka (scanner dari file lokal / popup diblokir), pakai Unduh JSON di panel lalu Import di sini.',
    jsr_bm_collecting: 'Mengumpulkan file JS...', jsr_bm_send: 'Kirim ke scanner', jsr_bm_download: 'Unduh JSON', jsr_bm_fetching: 'Mengambil', jsr_bm_files: 'file JS', jsr_bm_maps: 'source map terekspos',
    jsr_bm_hint: 'Menunggu tab scanner...', jsr_bm_local: 'Scanner dibuka dari file lokal: pakai Unduh JSON lalu Import di tab DAST.', jsr_bm_popup: 'Popup diblokir: izinkan popup, lalu klik Kirim ke scanner.', jsr_bm_sent: 'Terkirim ke tab scanner.'
  },
  en: {
    cj_head: '🎯 Clickjacking PoC', cj_desc: 'Loads the URL in an iframe with a bait button underneath. If the page shows up, it can be framed (X-Frame-Options / frame-ancestors missing). Mark the result so it lands in the report, or download the PoC file for your pentest evidence.',
    cj_url_ph: 'https://target-site.example.com/login', cj_load: 'Load in iframe', cj_dl: '⬇ Download PoC HTML', cj_bait: 'CLAIM PRIZE', cj_opacity: 'Iframe opacity',
    cj_ask: 'Does the target page show up in the iframe?', cj_mark_shown: 'Shows (vulnerable)', cj_mark_blocked: 'Empty / blocked', cj_marked: 'Recorded:',
    cj_mixed: 'An http target from an https page is blocked by the browser (mixed content), so it stays empty even if the site is vulnerable. Open the scanner from a local file or http://localhost for http targets.',
    cj_bad_url: 'Invalid URL (must be http/https).',
    cj_rep_h: 'Clickjacking PoC', cj_rep_note: 'Headers come from the header check above; the visual column comes from the mark chosen in the DAST tab. Open "Live PoC" to see the target in a transparent iframe over the bait button.',
    cj_th_url: 'URL', cj_th_header: 'From headers', cj_th_visual: 'Iframe test (visual)', cj_rep_live: 'Live PoC:', cj_rep_code: 'PoC code (save as .html):',
    cj_state_vuln: 'No protection', cj_state_weak: 'Weak protection', cj_state_safe: 'Protected', cj_state_unknown: 'Headers not available',
    cj_vis_shown: '⚠ Shows in iframe (vulnerable)', cj_vis_blocked: '✓ Blocked', cj_vis_none: 'Not tested',
    cj_poc_howto: 'Slide opacity to 0: the target becomes invisible but still receives the click on top of the bait button. If the target shows here, the site can be clickjacked.',
    jsr_head: '🧩 JS Bundle Recon', jsr_desc: 'Run this bookmarklet on the target site tab. It grabs every JS file from the same site (plus source maps) and sends them here. The scanner looks for API keys/secrets, internal IPs & URLs, API endpoints and exposed .map files.',
    jsr_bm: '🧩 JS Recon', jsr_import: 'Import JSON / .js / .map files', jsr_report: '📄 Build DAST report (+ these findings)',
    jsr_got: 'Received from {p}: {n} JS files.', jsr_bad: 'File/JSON not recognized.', jsr_show_full: 'Show full values',
    jsr_c_files: 'JS files', jsr_c_maps: 'exposed source maps', jsr_c_eps: 'endpoints', jsr_none: 'No secrets/internal URLs detected.',
    jsr_th_value: 'Value', jsr_th_file: 'File', jsr_th_status: 'HTTP', jsr_th_size: 'Size', jsr_th_map: 'Source map', jsr_th_ep: 'Endpoint', jsr_th_hot: 'Interesting',
    jsr_map_no: 'none', jsr_map_guess: 'guessed .map', jsr_ep_filter: 'Filter endpoints...', jsr_only_hot: 'Interesting only (★)',
    jsr_copy_eps: '📋 Copy endpoints', jsr_to_swag: '➡ Send to Swag', jsr_copied: 'Copied.', jsr_clear: '🗑 Clear results',
    jsr_rep_h: 'JS Bundle Recon', jsr_rep_page: 'Page:', jsr_rep_find: 'Secrets & internal addresses', jsr_rep_mask: 'Secret values are masked in the report.',
    jsr_rep_files: 'JS files checked', jsr_rep_skipped: 'Third-party scripts (not fetched)', jsr_rep_sources: 'Original files listed in source maps', jsr_rep_eps: 'Endpoints from JS code',
    jsr_steps: 'How to use: drag the button to the bookmarks bar → open the target site (log in first if needed) → click the bookmark → the scanner tab opens and results arrive automatically. If no tab opens (scanner from a local file / popup blocked), use Download JSON in the panel and Import it here.',
    jsr_bm_collecting: 'Collecting JS files...', jsr_bm_send: 'Send to scanner', jsr_bm_download: 'Download JSON', jsr_bm_fetching: 'Fetching', jsr_bm_files: 'JS files', jsr_bm_maps: 'exposed source maps',
    jsr_bm_hint: 'Waiting for the scanner tab...', jsr_bm_local: 'Scanner opened from a local file: use Download JSON, then Import in the DAST tab.', jsr_bm_popup: 'Popup blocked: allow popups, then click Send to scanner.', jsr_bm_sent: 'Sent to the scanner tab.'
  }
};
Object.keys(JSR_I18N).forEach(l => { I18N[l] = Object.assign({}, JSR_I18N[l], I18N[l] || {}); });
// Padanan Inggris untuk teks aturan/saran yang lewat L().
Object.assign(TEXT_EN, {
  "Tambahkan CSP frame-ancestors 'none' (atau 'self') dan X-Frame-Options: DENY untuk browser lama.": "Add CSP frame-ancestors 'none' (or 'self') plus X-Frame-Options: DENY for older browsers.",
  'Private key di file JS': 'Private key in JS file', 'Keluarkan private key dari bundle, ganti (rotate) kuncinya, simpan hanya di server.': 'Remove the private key from the bundle, rotate it, keep it on the server only.',
  'AWS access key di file JS': 'AWS access key in JS file', 'Cabut key ini di AWS IAM; akses AWS dari frontend lewat backend atau kredensial sementara (Cognito/STS).': 'Revoke this key in AWS IAM; reach AWS from the frontend through a backend or temporary credentials (Cognito/STS).',
  'GitHub token di file JS': 'GitHub token in JS file', 'Cabut token di GitHub, pindahkan pemanggilan ke backend.': 'Revoke the token on GitHub and move the call to the backend.',
  'Slack token/webhook di file JS': 'Slack token/webhook in JS file', 'Cabut token/webhook di Slack dan kirim notifikasi dari backend.': 'Revoke the token/webhook in Slack and send notifications from the backend.',
  'Stripe secret key di file JS': 'Stripe secret key in JS file', 'Cabut key di dashboard Stripe; frontend hanya boleh memakai publishable key (pk_).': 'Revoke the key in the Stripe dashboard; the frontend may only use the publishable key (pk_).',
  'Username:password di URL': 'Username:password in URL', 'Hapus kredensial dari URL, ganti password-nya, pakai autentikasi di backend.': 'Remove the credentials from the URL, change the password, authenticate on the backend.',
  'JWT ter-hardcode di file JS': 'Hardcoded JWT in JS file', 'Cek isinya di tab JWT; bila token aktif, cabut dan jangan simpan token di bundle.': 'Inspect it in the JWT tab; if the token is live, revoke it and never ship tokens in the bundle.',
  'Bearer token ter-hardcode': 'Hardcoded Bearer token', 'Ambil token saat login (runtime), bukan ditulis di kode.': 'Obtain the token at login (runtime) instead of writing it in code.',
  'Google API key di file JS': 'Google API key in JS file', 'Key Google di frontend memang publik: batasi per HTTP referrer dan per API di Google Cloud Console.': 'Google keys in a frontend are public by design: restrict them by HTTP referrer and API in Google Cloud Console.',
  'Secret/password ter-hardcode': 'Hardcoded secret/password', 'Jangan taruh secret di frontend; pindahkan ke backend atau secret manager lalu ganti nilainya.': 'Never put secrets in the frontend; move them to the backend or a secret manager and rotate the value.',
  'IP internal di file JS': 'Internal IP in JS file', 'Hapus alamat internal dari bundle produksi (pakai konfigurasi per environment).': 'Remove internal addresses from the production bundle (use per-environment config).',
  'URL dev/staging/internal di file JS': 'Dev/staging/internal URL in JS file', 'Pastikan build produksi tidak membawa URL environment lain; cek apakah host itu terbuka ke publik.': "Make sure the production build does not carry other environments' URLs; check whether that host is publicly reachable.",
  'Source map inline di bundle produksi': 'Inline source map in production bundle', 'Source map terekspos': 'Exposed source map', 'berisi kode asli': 'with original code',
  'Matikan source map di build produksi (mis. productionSourceMap:false / devtool:false / sourcemap:false) atau blokir akses *.map dari publik.': 'Turn off source maps in production builds (e.g. productionSourceMap:false / devtool:false / sourcemap:false) or block public access to *.map.'
});

// ============================================================
//  Skip Link: bookmarklet di halaman shortlink/safelink. Halaman dikosongkan (iklan tidak tampil,
//  window.open dimatikan agar popunder tidak muncul), lalu langkah-langkah dijalankan lewat API
//  milik situs itu sendiri di latar belakang. Waktu tunggu yang dihitung server tetap dijalani.
//  Captcha aktif tidak dilewati: user diminta mengisinya sendiri.
// ============================================================
function skipLinkMain(cfg) {
  var T = cfg.L || {};
  var HOSTS = /(?:^|\.)(?:gofile\.io|drive\.google\.com|docs\.google\.com|mediafire\.com|pixeldrain\.com|mega\.nz|terabox\.com|1fichier\.com|dropbox\.com|sfile\.mobi|krakenfiles\.com|buzzheavier\.com|qiwi\.gg|send\.cm|workupload\.com|github\.com|onedrive\.live\.com|1drv\.ms)$/i;
  if (window.__skipLink && window.__skipLink.running) return;
  var S = window.__skipLink = { running: true };
  var panel = document.createElement('div');
  Object.assign(panel.style, { position: 'fixed', inset: '0', background: '#14100d', color: '#f3ece4', font: '14px/1.5 system-ui,Segoe UI,sans-serif', zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center' });
  var box = document.createElement('div');
  Object.assign(box.style, { width: 'min(560px, 92vw)', background: '#211914', border: '1px solid #453429', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 12px 30px rgba(0,0,0,.55)' });
  var title = document.createElement('div'); title.textContent = '⏩ Skip Link'; Object.assign(title.style, { fontWeight: '700', fontSize: '18px', marginBottom: '6px' });
  var status = document.createElement('div'); status.style.margin = '6px 0';
  var log = document.createElement('div'); Object.assign(log.style, { font: '12px/1.45 Consolas,monospace', color: '#b8a89a', maxHeight: '40vh', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' });
  var out = document.createElement('div'); out.style.marginTop = '10px';
  box.appendChild(title); box.appendChild(status); box.appendChild(out); box.appendChild(log);
  panel.appendChild(box);
  function say(t) { status.textContent = t; }
  function note(t) { var d = document.createElement('div'); d.textContent = t; log.appendChild(d); log.scrollTop = log.scrollHeight; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function mkBtn(label, fn) {
    var b = document.createElement('button'); b.textContent = label;
    Object.assign(b.style, { background: '#b56833', color: '#fff', border: '0', borderRadius: '6px', padding: '7px 14px', cursor: 'pointer', marginRight: '8px', fontSize: '13px' });
    b.onclick = fn; return b;
  }
  // Kosongkan halaman (iklan, iframe, video) dan jaga agar tetap kosong.
  function wipe() {
    try { window.open = function () { return null; }; } catch (e) { /* abaikan */ }
    document.documentElement.appendChild(panel);
    if (document.body) Array.prototype.slice.call(document.body.children).forEach(function (c) { c.remove(); });
    Array.prototype.slice.call(document.querySelectorAll('iframe,video,audio,embed,object')).forEach(function (e) { if (!panel.contains(e)) e.remove(); });
    var mo = new MutationObserver(function () {
      if (document.body) Array.prototype.slice.call(document.body.children).forEach(function (c) { c.remove(); });
      Array.prototype.slice.call(document.querySelectorAll('iframe,video,audio,embed,object')).forEach(function (e) { if (!panel.contains(e)) e.remove(); });
      if (panel.parentNode !== document.documentElement) document.documentElement.appendChild(panel);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    S.mo = mo;
  }
  function finish(url) {
    S.running = false;
    var isFile = false;
    try { isFile = HOSTS.test(new URL(url).hostname); } catch (e) { /* abaikan */ }
    say((isFile ? (T.done || 'Done:') : (T.final || 'Last link:')) + ' ' + url);
    out.textContent = '';
    out.appendChild(mkBtn(T.open || 'Open', function () { location.href = url; }));
    out.appendChild(mkBtn(T.copy || 'Copy', function () { try { navigator.clipboard.writeText(url); } catch (e) { /* abaikan */ } }));
    if (isFile && cfg.auto) setTimeout(function () { location.href = url; }, 1200);
  }
  // Halaman berikutnya beda origin: harus dibuka (fetch lintas origin diblokir CORS), lalu bookmarklet diklik lagi.
  function hop(url) {
    S.running = false;
    var host = '';
    try { host = new URL(url).hostname; } catch (e) { /* abaikan */ }
    if (HOSTS.test(host)) { finish(url); return; }
    say((T.hop || 'Next page is on another site. After it opens, click the bookmarklet again:') + ' ' + host);
    out.textContent = '';
    out.appendChild(mkBtn(T.open || 'Open', function () { location.href = url; }));
    setTimeout(function () { location.href = url; }, 1500);
  }
  function fail(t) { S.running = false; say('⚠ ' + t); }
  function flowData(html) {
    var m = html.match(/<script id="flow-data" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return null; }
  }
  function postJson(url, body) {
    return fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(function (r) { return r.json(); });
  }
  // Keluarga SafelinkEarn: flow-data + POST act_url {action, nonce}. Server menegakkan urutan & jeda.
  function runFlow(D, page) {
    var nonce = D.nonce, guard = 0, origin = location.origin;
    function step() {
      if (++guard > 60) { fail(T.too_many || 'Too many steps.'); return; }
      var s = D.steps[D.click - (D.offset || 0)] || D.steps[D.click];
      if (!s) { fail((T.no_step || 'Unknown step') + ' #' + D.click); return; }
      if (D.captcha && D.turnstile_site_key && D.click === 0) { fail(T.captcha || 'Captcha is active: solve it on the page, then click the bookmarklet again.'); return; }
      var wait = s.gap_ms || 0;
      var until = Date.now() + wait;
      (function tick() {
        var left = Math.ceil((until - Date.now()) / 1000);
        say((T.waiting || 'Waiting for server') + (left > 0 ? ' ' + left + 's' : '') + ' · ' + (T.step || 'step') + ' ' + (D.click + (D.offset || 0) + 1) + (D.total ? '/' + D.total : '') + ' (' + s.action + ')');
        if (left > 0) setTimeout(tick, 500);
      })();
      sleep(wait + 400).then(function () { return send(s.action, 0); }).then(function (j) {
        note('#' + (D.click + 1) + ' ' + s.action + ' -> ' + JSON.stringify(j).slice(0, 160));
        if (j.redirect) {
          var u = new URL(j.redirect, page);
          if (u.origin !== origin) { hop(u.href); return; }
          return fetch(u.href, { credentials: 'include' }).then(function (r) { return r.text(); }).then(function (html) {
            var d2 = flowData(html);
            if (!d2) { hop(u.href); return; }
            D = d2; nonce = D.nonce; page = u.href; step();
          });
        }
        if (j.ok) { nonce = j.nonce; D.click = j.click; var n = D.steps[D.click - (D.offset || 0)]; if (n) n.gap_ms = j.wait_ms || n.gap_ms || 0; step(); return; }
        if (j.error === 'out_of_order') { nonce = j.nonce; D.click = j.click; var n2 = D.steps[D.click - (D.offset || 0)]; if (n2) n2.gap_ms = j.wait_ms || 0; step(); return; }
        if (j.error === 'expired') { fail(T.expired || 'Session expired: open the link again from the start.'); return; }
        if (j.error === 'captcha') { fail(T.captcha || 'Captcha required.'); return; }
        if (j.error === 'adblock') { fail(T.adblock || 'The site detected an ad blocker: turn it off for this site, reload, and click the bookmarklet again.'); return; }
        fail(JSON.stringify(j).slice(0, 200));
      }).catch(function (e) { fail(String((e && e.message) || e)); });
    }
    function send(action, tries) {
      return postJson(new URL(D.act_url, page).href, { action: action, nonce: nonce, token: null }).then(function (j) {
        if (j.error === 'too_early' && tries < 10) return sleep((j.retry_ms || 500) + 100).then(function () { return send(action, tries + 1); });
        return j;
      });
    }
    step();
  }
  // Halaman akhir SafelinkEarn: /go/<id> -> POST /go/<id>/reveal -> {url}
  function reveal(tries) {
    say(T.revealing || 'Getting the destination link...');
    postJson(location.pathname.replace(/\/$/, '') + '/reveal').then(function (j) {
      if (j.url) { finish(j.url); return; }
      if (j.error === 'too_early' && tries < 10) { sleep((j.retry_ms || 1000) + 100).then(function () { reveal(tries + 1); }); return; }
      fail(JSON.stringify(j).slice(0, 200));
    }).catch(function (e) { fail(String((e && e.message) || e)); });
  }
  // Link tujuan yang sudah ada di URL (base64 / encode) atau di halaman.
  function fromUrl() {
    var found = null;
    new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, '')).forEach(function (v) {
      if (found || !v) return;
      var c = [v];
      try { c.push(atob(v.replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { /* bukan base64 */ }
      try { c.push(decodeURIComponent(v)); } catch (e) { /* abaikan */ }
      c.forEach(function (x) { if (!found && /^https?:\/\/[^\s]+$/i.test(x) && x.indexOf(location.host) < 0) found = x; });
    });
    return found;
  }
  function fromPage() {
    var list = [];
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function (a) {
      try { if (HOSTS.test(new URL(a.href).hostname) && list.indexOf(a.href) < 0) list.push(a.href); } catch (e) { /* abaikan */ }
    });
    return list;
  }

  // ---- pilih mode
  var fd = document.getElementById('flow-data');
  var D = fd ? flowData('<script id="flow-data" type="application/json">' + fd.textContent + '</script>') : null;
  if (D && D.captcha && D.turnstile_site_key && D.click === 0) { alert(T.captcha || 'Captcha is active: solve it on the page, then click the bookmarklet again.'); S.running = false; return; }
  var inline = Array.prototype.map.call(document.scripts, function (s) { return s.src ? '' : s.textContent; }).join('\n');
  var urlHit = fromUrl(), pageHits = fromPage();
  // ambil form gerbang SEBELUM halaman dikosongkan
  var form = Array.prototype.filter.call(document.forms, function (f) { return /\/v\/go\b/.test(f.action); })[0];
  wipe();
  if (D) { note(T.mode_flow || 'Mode: step API (SafelinkEarn)'); runFlow(D, location.href); return; }
  if (/^\/go\/[^/]+\/?$/.test(location.pathname) && inline.indexOf('/reveal') >= 0) { note(T.mode_reveal || 'Mode: final page'); reveal(0); return; }
  if (form) {
    note(T.mode_gate || 'Mode: gate page (Continue)');
    say(T.gate || 'Passing the gate page...');
    fetch(form.action, { method: 'POST', credentials: 'include', body: new URLSearchParams(new FormData(form)) }).then(function (r) {
      return r.text().then(function (html) { return { url: r.url, html: html }; });
    }).then(function (x) {
      var d = flowData(x.html);
      if (d) { runFlow(d, x.url); return; }
      hop(x.url);
    }).catch(function () {
      // redirect lintas origin: biarkan browser yang pindah halaman
      S.running = false; form.style.display = 'none'; document.documentElement.appendChild(form); HTMLFormElement.prototype.submit.call(form);
    });
    return;
  }
  if (urlHit) { note(T.mode_param || 'Mode: link inside the URL'); finish(urlHit); return; }
  if (pageHits.length) { note(T.mode_page || 'Mode: download link on the page'); pageHits.slice(1).forEach(function (h) { note(h); }); finish(pageHits[0]); return; }
  fail(T.unsupported || 'This site is not supported yet.');
}
// Dekode link tujuan dari URL shortlink (parameter base64/encode) - dipakai di tab, tanpa membuka situsnya.
function skipDecodeUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch (e) { return []; }
  const out = [];
  const take = v => {
    const c = [v];
    try { c.push(atob(v.replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { /* bukan base64 */ }
    try { c.push(decodeURIComponent(v)); } catch (e) { /* abaikan */ }
    c.forEach(x => { if (/^https?:\/\/\S+$/i.test(x) && out.indexOf(x) < 0 && x.indexOf(u.host) < 0) out.push(x); });
  };
  new URLSearchParams(u.search).forEach(v => { if (v) take(v); });
  if (u.hash.length > 1) new URLSearchParams(u.hash.slice(1)).forEach((v, k) => { take(v || k); });
  u.pathname.split('/').filter(p => p.length > 12).forEach(take);
  return out;
}
const SKIP_I18N = {
  id: {
    tab_skip: 'Skip Link', grp_skip_title: 'Skip Link', grp_skip_desc: 'Tidak memanggil API apa pun dari sini: bookmarklet berjalan di halaman shortlink yang Anda buka sendiri.',
    skip_title: 'Skip Link — lewati halaman shortlink sampai link download',
    skip_intro: 'Bookmarklet ini dijalankan di halaman shortlink/safelink. Halamannya langsung dikosongkan (iklan tidak tampil, popup/popunder dimatikan), lalu langkah "Click to Verify / Please Wait / Next / Get Link" dijalankan di latar belakang lewat API situs itu sendiri. Hasil akhirnya link download (Gofile, Drive, Mediafire, dll.).',
    skip_step1: 'Seret tombol ⏩ Skip Link ke bookmark bar.',
    skip_step2: 'Buka link shortlink seperti biasa (mis. sfe.ad/...), lalu klik bookmark itu di halaman pertama yang muncul.',
    skip_step3: 'Tunggu ±1 menit. Kalau pindah ke situs lain (mis. safelinkearn.com/go/...), klik bookmark sekali lagi di halaman itu. Selesai: link download tampil dan dibuka otomatis.',
    skip_auto: 'Buka link download otomatis setelah ketemu',
    skip_support: 'Didukung: keluarga SafelinkEarn (sfe.ad, halaman "Click to Verify" + /v/act), halaman akhir /go/<id>, link tujuan yang disimpan di URL (base64/encode), dan link download yang sudah ada di halaman.',
    skip_limits: 'Batasan: waktu tunggu yang dihitung server (±30 detik) tetap harus dijalani; captcha aktif harus diisi sendiri; situs shortlink lain mungkin belum didukung. Situs seperti ini sering membawa iklan berbahaya — jangan jalankan file .exe/.apk dari sana.',
    skip_decode_head: 'Dekode link dari URL', skip_decode_desc: 'Banyak safelink menyimpan link tujuan di URL dalam bentuk base64. Tempel URL-nya di sini, tidak perlu membuka situsnya.',
    skip_decode_ph: 'https://safelink.contoh/?url=aHR0cHM6Ly9nb2ZpbGUuaW8vZC94eHg=', skip_decode_none: 'Tidak ada link tujuan di URL ini. Pakai bookmarklet di halamannya.',
    skip_bm_done: 'Selesai:', skip_bm_final: 'Link terakhir:', skip_bm_open: 'Buka', skip_bm_copy: 'Salin', skip_bm_hop: 'Halaman berikutnya ada di situs lain. Setelah terbuka, klik bookmarklet lagi:',
    skip_bm_waiting: 'Menunggu server', skip_bm_step: 'langkah', skip_bm_too_many: 'Langkah terlalu banyak, dihentikan.', skip_bm_no_step: 'Langkah tidak dikenal',
    skip_bm_captcha: 'Captcha aktif: isi captcha di halaman, klik Verify, lalu klik bookmarklet lagi.', skip_bm_expired: 'Sesi kedaluwarsa: buka link dari awal lagi.',
    skip_bm_adblock: 'Situs mendeteksi ad blocker: matikan untuk situs ini, muat ulang, lalu klik bookmarklet lagi.', skip_bm_revealing: 'Mengambil link tujuan...',
    skip_bm_gate: 'Melewati halaman gerbang...', skip_bm_unsupported: 'Situs ini belum didukung.',
    skip_bm_mode_flow: 'Mode: API langkah (SafelinkEarn)', skip_bm_mode_reveal: 'Mode: halaman akhir', skip_bm_mode_gate: 'Mode: halaman gerbang (Continue)', skip_bm_mode_param: 'Mode: link di dalam URL', skip_bm_mode_page: 'Mode: link download di halaman'
  },
  en: {
    tab_skip: 'Skip Link', grp_skip_title: 'Skip Link', grp_skip_desc: 'Calls no API from here: the bookmarklet runs on the shortlink page you open yourself.',
    skip_title: 'Skip Link — get past shortlink pages to the download link',
    skip_intro: 'Run this bookmarklet on a shortlink/safelink page. The page is blanked right away (no ads shown, popups/popunders disabled), then the "Click to Verify / Please Wait / Next / Get Link" steps run in the background through the site\'s own API. The result is the download link (Gofile, Drive, Mediafire, etc.).',
    skip_step1: 'Drag the ⏩ Skip Link button to your bookmarks bar.',
    skip_step2: 'Open the shortlink as usual (e.g. sfe.ad/...), then click the bookmark on the first page that shows up.',
    skip_step3: 'Wait about 1 minute. If it moves to another site (e.g. safelinkearn.com/go/...), click the bookmark once more there. Done: the download link is shown and opened automatically.',
    skip_auto: 'Open the download link automatically when found',
    skip_support: 'Supported: the SafelinkEarn family (sfe.ad, "Click to Verify" pages + /v/act), the final /go/<id> page, destination links stored in the URL (base64/encoded), and download links already on the page.',
    skip_limits: 'Limits: waits counted by the server (about 30 seconds) still apply; an active captcha must be solved by you; other shortlink sites may not be supported yet. These sites often carry malicious ads — never run .exe/.apk files from them.',
    skip_decode_head: 'Decode a link from the URL', skip_decode_desc: 'Many safelinks keep the destination in the URL as base64. Paste the URL here; no need to open the site.',
    skip_decode_ph: 'https://safelink.example/?url=aHR0cHM6Ly9nb2ZpbGUuaW8vZC94eHg=', skip_decode_none: 'No destination link in this URL. Use the bookmarklet on its page.',
    skip_bm_done: 'Done:', skip_bm_final: 'Last link:', skip_bm_open: 'Open', skip_bm_copy: 'Copy', skip_bm_hop: 'The next page is on another site. Once it opens, click the bookmarklet again:',
    skip_bm_waiting: 'Waiting for server', skip_bm_step: 'step', skip_bm_too_many: 'Too many steps, stopped.', skip_bm_no_step: 'Unknown step',
    skip_bm_captcha: 'Captcha is active: solve it on the page, click Verify, then click the bookmarklet again.', skip_bm_expired: 'Session expired: open the link again from the start.',
    skip_bm_adblock: 'The site detected an ad blocker: turn it off for this site, reload, and click the bookmarklet again.', skip_bm_revealing: 'Getting the destination link...',
    skip_bm_gate: 'Passing the gate page...', skip_bm_unsupported: 'This site is not supported yet.',
    skip_bm_mode_flow: 'Mode: step API (SafelinkEarn)', skip_bm_mode_reveal: 'Mode: final page', skip_bm_mode_gate: 'Mode: gate page (Continue)', skip_bm_mode_param: 'Mode: link inside the URL', skip_bm_mode_page: 'Mode: download link on the page'
  }
};
Object.keys(SKIP_I18N).forEach(l => { I18N[l] = Object.assign({}, SKIP_I18N[l], I18N[l] || {}); });

// ============================================================
//  Tab VPN Docker: panduan + unduhan vpn-docker.zip (VPN FortiGate di container, SOCKS5 untuk Chrome/SSH)
// ============================================================
const VPN_STEPS = [
  { k: 1, cmds: ['cd C:\\path\\vpn-docker', '.\\run_vpn_docker.ps1 -Setup -Config "C:\\path\\vpn_backup.conf" -ChromeEmail "nama@gmail.com" -ProxyDomains "kantor.co.id"'], notes: ['vpn_s1_n1', 'vpn_s1_n2'] },
  { k: 2, cmds: ['.\\run_vpn_docker.ps1 -List', '.\\run_vpn_docker.ps1 -Name "Nama Profil"', '.\\run_vpn_docker.ps1 -Status', '.\\run_vpn_docker.ps1 -Stop'], notes: ['vpn_s2_n1', 'vpn_s2_n2', 'vpn_s2_n3', 'vpn_s2_n4'] },
  { k: 3, cmds: ['.\\run_vpn_docker.ps1 -Chrome'], notes: ['vpn_s3_n1', 'vpn_s3_n2', 'vpn_s3_n3', 'vpn_s3_n4'] },
  { k: 4, cmds: ['Host 10.*\n    ProxyCommand "C:/Program Files/Git/mingw64/bin/connect.exe" -S 127.0.0.1:1080 %h %p', "ssh -o ProxyCommand='connect -S 127.0.0.1:1080 %h %p' user@10.x.x.x", 'docker exec vpn-forti ping -c 2 10.x.x.x'], notes: ['vpn_s4_n1', 'vpn_s4_n2', 'vpn_s4_n3', 'vpn_s4_n4'] },
  { k: 5, cmds: ['git -c http.proxy=socks5h://127.0.0.1:1080 pull', 'git -c http.proxy=socks5h://127.0.0.1:1080 push', 'git config --global alias.vpn "!git -c http.proxy=socks5h://127.0.0.1:1080"', 'git vpn pull', 'git -c core.sshCommand="ssh -o ProxyCommand=\'connect -S 127.0.0.1:1080 %h %p\'" pull'], notes: ['vpn_s5_n1', 'vpn_s5_n2', 'vpn_s5_n3', 'vpn_s5_n4'] }
];
const VPN_TROUBLE = [1, 2, 3, 4, 5];
const VPN_I18N = {
  id: {
    tab_vpn: 'VPN Docker', grp_vpn_title: 'VPN Docker', grp_vpn_desc: 'Tidak memanggil API: hanya panduan dan file unduhan untuk dijalankan di PC Anda.',
    vpn_title: 'VPN Docker — hanya Chrome & SSH yang lewat VPN kantor',
    vpn_intro: 'VPN kantor (FortiGate SSL VPN, login password/OTP atau SAML) dijalankan di dalam container Docker dan dibuka sebagai proxy SOCKS5 127.0.0.1:1080. PC tidak ikut ter-VPN: hanya Chrome (lewat extension, per profil) dan SSH/MobaXterm/PuTTY/DBeaver yang masuk jaringan kantor. Internet biasa tetap langsung.',
    vpn_flow_direct: 'internet biasa', vpn_download: 'Unduh vpn-docker.zip',
    vpn_need: 'Butuh: Windows + Docker Desktop + file backup FortiClient (vpn_backup.conf). Isi zip: run_vpn_docker.ps1, extension vpn_proxy_ext, README.md.',
    vpn_copy: 'Salin', vpn_copied: 'Disalin',
    vpn_s1_title: '1. Setelan awal (sekali)', vpn_s1_desc: 'Ekstrak zip, buka PowerShell di folder vpn-docker, lalu simpan lokasi backup, email profil Chrome, dan domain kantor.',
    vpn_s1_n1: 'Backup diambil dari FortiClient → Settings → Backup. Script hanya membaca nama profil, gateway, dan jenis login. Username/password terenkripsi di backup tidak dibuka.',
    vpn_s1_n2: 'Setelan disimpan di %LOCALAPPDATA%\\vpn_docker\\settings.json, di luar folder ini. Jangan bagikan atau commit vpn_backup.conf.',
    vpn_s2_title: '2. Nyalakan VPN', vpn_s2_desc: 'Pilih profil dari menu atau langsung dengan -Name. Docker Desktop dinyalakan otomatis, image dibuat sekali.',
    vpn_s2_n1: 'Login password: username, password, dan pilihan OTP ditanya sekali, disimpan terenkripsi DPAPI (hanya akun Windows ini). Kode OTP ditanya saat diminta, atau pakai -Otp 123456. Ganti akun: -Reset.',
    vpn_s2_n2: 'Login SAML (mis. Microsoft): browser terbuka ke halaman login FortiGate, lalu kembali ke 127.0.0.1:8020 dan tunnel tersambung. Kalau sesi Microsoft masih aktif, login lewat sendiri.',
    vpn_s2_n3: 'Sertifikat gateway baru langsung dipercaya dan diingat (-AskTrust untuk ditanya dulu). Kalau sertifikat berubah, selalu muncul peringatan.',
    vpn_s2_n4: 'Satu VPN aktif pada satu waktu. Profil password tanpa OTP menyambung ulang sendiri; SAML/OTP dijalankan ulang kalau putus. Log: -Logs.',
    vpn_s3_title: '3. Pasang extension di Chrome (sekali per profil)', vpn_s3_desc: 'Perintah ini membuka profil Chrome milik email di setelan. Kalau extension belum ada, yang terbuka chrome://extensions.',
    vpn_s3_n1: 'Nyalakan Developer mode (kanan atas), klik Load unpacked, pilih folder vpn-docker\\vpn_proxy_ext.',
    vpn_s3_n2: 'Ikon VPN Docker Proxy dengan badge hijau "VPN" = aktif. Popup: on/off, port SOCKS, "semua situs lewat VPN", daftar domain kantor.',
    vpn_s3_n3: '10.x, 172.16–31.x, 192.168.x dan domain di daftar lewat VPN; situs lain langsung. Hanya berlaku di profil tempat extension dipasang.',
    vpn_s3_n4: 'Kalau VPN mati, alamat internal dicoba langsung (Chrome tidak macet). Tanpa extension: -Chrome -ChromeEmail "" membuka Chrome terpisah dengan proxy.',
    vpn_s4_title: '4. SSH lewat proxy', vpn_s4_desc: 'Arahkan klien SSH ke SOCKS5 127.0.0.1:1080. Untuk OpenSSH, cara paling aman lewat %USERPROFILE%\\.ssh\\config (baris pertama), lalu cukup ssh user@10.x.x.x.',
    vpn_s4_n1: 'MobaXterm: Session → SSH → tab Network settings → Proxy SOCKS5, host 127.0.0.1, port 1080.',
    vpn_s4_n2: 'PuTTY: Connection → Proxy → SOCKS 5, 127.0.0.1:1080, "Do DNS name lookup at proxy end" = Yes. WinSCP: Advanced → Connection → Proxy → SOCKS5.',
    vpn_s4_n3: 'DBeaver / klien DB: tab Proxy (atau SSH → Proxy) → SOCKS5 127.0.0.1:1080. Baris kedua untuk Git Bash (connect.exe bawaan Git).',
    vpn_s4_n4: 'Ping dari Windows tidak lewat proxy (SOCKS hanya TCP). Cek jaringan dengan perintah ketiga.',
    vpn_s5_title: '5. Git pull/push ke server git kantor', vpn_s5_desc: 'Proxy dipasang per perintah dengan -c, jadi tidak ada setelan global yang perlu dikembalikan. git commit tidak butuh proxy (tidak pakai jaringan).',
    vpn_s5_n1: 'Remote HTTPS: baris 1-2. socks5h (bukan socks5) supaya nama host kantor di-resolve DNS kantor di dalam container.',
    vpn_s5_n2: 'Biar singkat: buat alias sekali (baris 3), lalu pakai git vpn pull / git vpn push (baris 4). git pull biasa tetap tanpa proxy, alias hanya aktif kalau mengetik git vpn.',
    vpn_s5_n3: 'Remote SSH (git@server:...): baris 5, jalankan dari Git Bash (connect ada di Git). Atau pasang ProxyCommand di ~/.ssh/config seperti langkah 4, lalu git pull/push biasa.',
    vpn_s5_n4: 'Kalau container VPN mati, pull/push ke server kantor gagal koneksi: nyalakan dulu run_vpn_docker.ps1. Server dengan sertifikat self-signed: tambahkan -c http.sslVerify=false di perintah yang sama.',
    vpn_trouble: 'Masalah yang sering muncul', vpn_th_sym: 'Gejala', vpn_th_fix: 'Penyebab / solusi',
    vpn_t1_a: 'Couldn\'t set tty to PPP discipline', vpn_t1_b: 'Container perlu izin SYS_MODULE untuk memuat modul ppp_async. Versi script di zip sudah memakainya.',
    vpn_t2_a: 'Browser "localhost refused to connect" setelah login SAML', vpn_t2_b: 'Port 8020 dipakai aplikasi lain atau container berhenti. Cek -Logs.',
    vpn_t3_a: 'Login ditolak', vpn_t3_b: 'Username/password salah: jalankan -Reset. Jangan diulang terus supaya akun tidak terkunci.',
    vpn_t4_a: 'Login sukses tapi langsung putus', vpn_t4_b: 'FortiGate mewajibkan FortiClient asli (EMS/compliance); cara ini tidak bisa untuk profil itu.',
    vpn_t5_a: 'ports are not available', vpn_t5_b: 'Port 1080/8020 bentrok atau masuk range yang direservasi Windows. Pakai -SocksPort lain dan samakan port di extension; port 8020 dipakai FortiGate untuk SAML.',
    vpn_policy: 'Pastikan pemakaian split seperti ini sesuai kebijakan IT kantor.',
    vpn_d_lane: 'Lewat VPN kantor', vpn_d_chrome: 'Chrome + extension', vpn_d_chrome2: 'hanya alamat kantor', vpn_d_ssh: 'SSH / MobaXterm / DB', vpn_d_ssh2: 'proxy SOCKS5',
    vpn_d_docker: 'Docker: openfortivpn', vpn_d_docker2: 'tunnel ppp0 di container', vpn_d_forti: 'FortiGate kantor', vpn_d_forti2: 'password/OTP/SAML',
    vpn_d_int: 'Server internal', vpn_d_int2: '10.x / intranet', vpn_d_sep: 'Di luar VPN', vpn_d_other: 'Tab & aplikasi lain', vpn_d_other2: 'Windows tidak ikut VPN',
    vpn_d_direct: 'langsung, tanpa VPN', vpn_d_caption: 'VPN kantor hanya dipakai Chrome & SSH. PC tetap memakai internet biasa, tanpa FortiClient.'
  },
  en: {
    tab_vpn: 'VPN Docker', grp_vpn_title: 'VPN Docker', grp_vpn_desc: 'Calls no API: just a guide and a download to run on your PC.',
    vpn_title: 'VPN Docker — only Chrome & SSH go through the office VPN',
    vpn_intro: 'The office VPN (FortiGate SSL VPN, password/OTP or SAML login) runs inside a Docker container and is exposed as a SOCKS5 proxy on 127.0.0.1:1080. The PC itself is not on the VPN: only Chrome (through an extension, per profile) and SSH/MobaXterm/PuTTY/DBeaver reach the office network. Normal internet traffic stays direct.',
    vpn_flow_direct: 'normal internet', vpn_download: 'Download vpn-docker.zip',
    vpn_need: 'Needs: Windows + Docker Desktop + a FortiClient backup file (vpn_backup.conf). The zip holds run_vpn_docker.ps1, the vpn_proxy_ext extension and README.md.',
    vpn_copy: 'Copy', vpn_copied: 'Copied',
    vpn_s1_title: '1. First-time setup', vpn_s1_desc: 'Extract the zip, open PowerShell in the vpn-docker folder, then save the backup location, the Chrome profile email and your office domains.',
    vpn_s1_n1: 'Export the backup from FortiClient → Settings → Backup. The script only reads profile names, gateways and login types. Encrypted usernames/passwords in the backup are never opened.',
    vpn_s1_n2: 'Settings are stored in %LOCALAPPDATA%\\vpn_docker\\settings.json, outside this folder. Never share or commit vpn_backup.conf.',
    vpn_s2_title: '2. Start the VPN', vpn_s2_desc: 'Pick a profile from the menu or pass -Name. Docker Desktop is started automatically and the image is built once.',
    vpn_s2_n1: 'Password login: username, password and the OTP choice are asked once and stored with DPAPI encryption (this Windows account only). OTP codes are asked when needed, or pass -Otp 123456. Switch account: -Reset.',
    vpn_s2_n2: 'SAML login (e.g. Microsoft): the browser opens the FortiGate login page, then returns to 127.0.0.1:8020 and the tunnel comes up. If your Microsoft session is still active, it signs in by itself.',
    vpn_s2_n3: 'A new gateway certificate is trusted and remembered automatically (-AskTrust to be asked first). A changed certificate always shows a warning.',
    vpn_s2_n4: 'One VPN at a time. Password profiles without OTP reconnect by themselves; rerun SAML/OTP profiles when they drop. Logs: -Logs.',
    vpn_s3_title: '3. Install the Chrome extension (once per profile)', vpn_s3_desc: 'This command opens the Chrome profile of the email in your settings. If the extension is not installed yet, it opens chrome://extensions.',
    vpn_s3_n1: 'Turn on Developer mode (top right), click Load unpacked and pick the vpn-docker\\vpn_proxy_ext folder.',
    vpn_s3_n2: 'The VPN Docker Proxy icon with a green "VPN" badge means active. Popup: on/off, SOCKS port, "all sites through VPN", office domain list.',
    vpn_s3_n3: '10.x, 172.16–31.x, 192.168.x and the listed domains go through the VPN; other sites go direct. It only applies to the profile where the extension is installed.',
    vpn_s3_n4: 'If the VPN is down, internal addresses are tried directly (Chrome does not hang). Without the extension: -Chrome -ChromeEmail "" opens a separate Chrome with the proxy set.',
    vpn_s4_title: '4. SSH through the proxy', vpn_s4_desc: 'Point your SSH client at SOCKS5 127.0.0.1:1080. For OpenSSH the safest way is %USERPROFILE%\\.ssh\\config (first block), then just ssh user@10.x.x.x.',
    vpn_s4_n1: 'MobaXterm: Session → SSH → Network settings tab → Proxy SOCKS5, host 127.0.0.1, port 1080.',
    vpn_s4_n2: 'PuTTY: Connection → Proxy → SOCKS 5, 127.0.0.1:1080, "Do DNS name lookup at proxy end" = Yes. WinSCP: Advanced → Connection → Proxy → SOCKS5.',
    vpn_s4_n3: 'DBeaver / DB clients: Proxy tab (or SSH → Proxy) → SOCKS5 127.0.0.1:1080. The second line is for Git Bash (connect.exe ships with Git).',
    vpn_s4_n4: 'Ping from Windows does not use the proxy (SOCKS is TCP only). Check the network with the third command.',
    vpn_s5_title: '5. Git pull/push to the office git server', vpn_s5_desc: 'The proxy is set per command with -c, so there is no global setting to undo. git commit needs no proxy (no network).',
    vpn_s5_n1: 'HTTPS remote: lines 1-2. Use socks5h (not socks5) so office host names are resolved by the office DNS inside the container.',
    vpn_s5_n2: 'Shortcut: create the alias once (line 3), then use git vpn pull / git vpn push (line 4). Plain git pull stays direct; the alias only applies when you type git vpn.',
    vpn_s5_n3: 'SSH remote (git@server:...): line 5, run it from Git Bash (connect ships with Git). Or put the ProxyCommand in ~/.ssh/config as in step 4, then plain git pull/push.',
    vpn_s5_n4: 'If the VPN container is down, pull/push to the office server fails to connect: start run_vpn_docker.ps1 first. Self-signed server: add -c http.sslVerify=false to the same command.',
    vpn_trouble: 'Common problems', vpn_th_sym: 'Symptom', vpn_th_fix: 'Cause / fix',
    vpn_t1_a: 'Couldn\'t set tty to PPP discipline', vpn_t1_b: 'The container needs SYS_MODULE to load the ppp_async module. The script in the zip already uses it.',
    vpn_t2_a: 'Browser shows "localhost refused to connect" after the SAML login', vpn_t2_b: 'Port 8020 is used by another app or the container stopped. Check -Logs.',
    vpn_t3_a: 'Login rejected', vpn_t3_b: 'Wrong username/password: run -Reset. Do not retry over and over or the account may get locked.',
    vpn_t4_a: 'Login succeeds but drops right away', vpn_t4_b: 'The FortiGate requires the real FortiClient (EMS/compliance); this method cannot be used for that profile.',
    vpn_t5_a: 'ports are not available', vpn_t5_b: 'Port 1080/8020 is taken or inside a range reserved by Windows. Use another -SocksPort and set the same port in the extension; port 8020 is fixed by the FortiGate for SAML.',
    vpn_policy: 'Make sure this kind of split access is allowed by your office IT policy.',
    vpn_d_lane: 'Through the office VPN', vpn_d_chrome: 'Chrome + extension', vpn_d_chrome2: 'office addresses only', vpn_d_ssh: 'SSH / MobaXterm / DB', vpn_d_ssh2: 'SOCKS5 proxy',
    vpn_d_docker: 'Docker: openfortivpn', vpn_d_docker2: 'ppp0 tunnel in a container', vpn_d_forti: 'Office FortiGate', vpn_d_forti2: 'password/OTP/SAML',
    vpn_d_int: 'Internal servers', vpn_d_int2: '10.x / intranet', vpn_d_sep: 'Outside the VPN', vpn_d_other: 'Other tabs & apps', vpn_d_other2: 'Windows stays off the VPN',
    vpn_d_direct: 'direct, no VPN', vpn_d_caption: 'The office VPN is used only by Chrome & SSH. The PC keeps its normal internet, no FortiClient needed.'
  }
};
Object.keys(VPN_I18N).forEach(l => { I18N[l] = Object.assign({}, VPN_I18N[l], I18N[l] || {}); });

// ============================================================
//  Tab Text to Speech: Web Speech API (speechSynthesis) bawaan browser, tanpa unduhan model.
// ============================================================
const TTS_PREFS_KEY = 'scaTtsPrefs';
const TTS_MAX_CHUNK = 200;
// Pecah teks per kalimat (dan potong kalimat yang terlalu panjang) supaya Chrome tidak berhenti di tengah teks panjang.
function ttsSplit(text) {
  const out = [];
  String(text || '').replace(/\r\n?/g, '\n').split(/\n+/).forEach(par => {
    const p = par.trim();
    if (!p) return;
    let first = true;
    p.split(/(?<=[.!?…。！？])\s+/).forEach(sen => {
      let s = sen.trim();
      while (s.length > TTS_MAX_CHUNK) {
        let cut = s.lastIndexOf(', ', TTS_MAX_CHUNK);
        if (cut < 60) cut = s.lastIndexOf(' ', TTS_MAX_CHUNK);
        if (cut < 60) cut = TTS_MAX_CHUNK;
        out.push({ t: s.slice(0, cut + 1).trim(), p: first }); first = false;
        s = s.slice(cut + 1).trim();
      }
      if (s) { out.push({ t: s, p: first }); first = false; }
    });
  });
  return out;
}
// Tebakan bahasa sederhana (Indonesia vs Inggris) dari kata-kata umum.
const TTS_ID_WORDS = new Set(['yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'tidak', 'ini', 'itu', 'adalah', 'akan', 'bisa', 'pada', 'juga', 'saya', 'kami', 'anda', 'atau', 'sudah', 'karena', 'dalam', 'ada', 'oleh', 'seperti']);
const TTS_EN_WORDS = new Set(['the', 'and', 'of', 'to', 'is', 'in', 'that', 'for', 'with', 'this', 'are', 'was', 'be', 'it', 'on', 'not', 'you', 'have', 'from', 'or', 'by', 'will', 'can', 'your', 'an']);
function ttsGuessLang(text) {
  let id = 0, en = 0;
  String(text || '').toLowerCase().split(/[^a-z]+/).slice(0, 400).forEach(w => { if (TTS_ID_WORDS.has(w)) id++; else if (TTS_EN_WORDS.has(w)) en++; });
  if (!id && !en) return '';
  return id >= en ? 'id' : 'en';
}
const TTS_I18N = {
  id: {
    tab_tts: 'Text to Speech', grp_tts_title: 'Text to Speech', grp_tts_desc: 'Memakai suara bawaan browser/OS. Suara bertanda ☁ online diproses di server Google/Microsoft (teks ikut terkirim); suara 🔒 lokal tidak.',
    tts_title: 'Text to Speech — bacakan teks panjang', tts_intro: 'Tempel teks (Ctrl+V) atau klik "Tempel & bacakan" untuk langsung membacakan isi clipboard. Teks dipotong per kalimat, kalimat yang sedang dibaca disorot, dan Anda bisa klik kalimat mana saja untuk lompat. Tanpa unduhan model: memakai suara bawaan browser/Windows.',
    tts_paste_play: 'Tempel & bacakan', tts_play: 'Bacakan', tts_pause: 'Jeda', tts_resume: 'Lanjut', tts_stop: 'Stop', tts_prev: 'Kalimat sebelumnya', tts_next: 'Kalimat berikutnya', tts_clear: 'Kosongkan',
    tts_ph: 'Tempel atau ketik teks di sini…', tts_auto_paste: 'Bacakan otomatis saat teks di-paste ke kotak ini',
    tts_voice: 'Suara', tts_voice_auto: 'Otomatis (ikuti bahasa teks)', tts_lang: 'Bahasa', tts_lang_all: 'Semua bahasa', tts_rate: 'Kecepatan', tts_pitch: 'Nada', tts_volume: 'Volume',
    tts_local: '🔒 lokal', tts_online: '☁ online', tts_online_warn: 'Suara ini online: teks yang dibacakan dikirim ke server penyedia suara. Pilih suara 🔒 lokal untuk teks rahasia.',
    tts_stats: '{c} karakter · {s} kalimat · ±{m} menit', tts_reading: 'Membaca kalimat {i} dari {n}', tts_detected: 'bahasa teks: {l}',
    tts_no_api: 'Browser ini tidak mendukung Web Speech API (speechSynthesis).', tts_no_voice: 'Belum ada suara yang tersedia. Di Windows: Settings → Time & language → Speech → Add voices (mis. Indonesian).',
    tts_e_clip: 'Browser menolak baca clipboard. Tempel dengan Ctrl+V di kotak teks.', tts_e_empty: 'Clipboard / teks kosong.', tts_e_speak: 'Gagal membacakan',
    tts_sentences: 'Teks per kalimat (klik untuk lompat)', tts_tip: 'Tips: suara "Natural" di Microsoft Edge terdengar paling manusiawi. Suara yang tersedia berbeda per browser dan per PC.'
  },
  en: {
    tab_tts: 'Text to Speech', grp_tts_title: 'Text to Speech', grp_tts_desc: 'Uses the browser/OS built-in voices. Voices marked ☁ online are processed on Google/Microsoft servers (the text is sent); 🔒 local voices are not.',
    tts_title: 'Text to Speech — read long text aloud', tts_intro: 'Paste text (Ctrl+V) or click "Paste & read" to read the clipboard right away. Text is split into sentences, the sentence being read is highlighted, and you can click any sentence to jump to it. No model download: it uses the browser/Windows built-in voices.',
    tts_paste_play: 'Paste & read', tts_play: 'Read', tts_pause: 'Pause', tts_resume: 'Resume', tts_stop: 'Stop', tts_prev: 'Previous sentence', tts_next: 'Next sentence', tts_clear: 'Clear',
    tts_ph: 'Paste or type text here…', tts_auto_paste: 'Read automatically when text is pasted into this box',
    tts_voice: 'Voice', tts_voice_auto: 'Auto (follow the text language)', tts_lang: 'Language', tts_lang_all: 'All languages', tts_rate: 'Speed', tts_pitch: 'Pitch', tts_volume: 'Volume',
    tts_local: '🔒 local', tts_online: '☁ online', tts_online_warn: 'This voice is online: the text being read is sent to the voice provider. Pick a 🔒 local voice for confidential text.',
    tts_stats: '{c} characters · {s} sentences · ~{m} min', tts_reading: 'Reading sentence {i} of {n}', tts_detected: 'text language: {l}',
    tts_no_api: 'This browser does not support the Web Speech API (speechSynthesis).', tts_no_voice: 'No voices available yet. On Windows: Settings → Time & language → Speech → Add voices (e.g. Indonesian).',
    tts_e_clip: 'The browser blocked clipboard access. Paste with Ctrl+V in the text box.', tts_e_empty: 'Clipboard / text is empty.', tts_e_speak: 'Failed to read aloud',
    tts_sentences: 'Text by sentence (click to jump)', tts_tip: 'Tip: the "Natural" voices in Microsoft Edge sound the most human. Available voices differ per browser and per PC.'
  }
};
Object.keys(TTS_I18N).forEach(l => { I18N[l] = Object.assign({}, TTS_I18N[l], I18N[l] || {}); });
