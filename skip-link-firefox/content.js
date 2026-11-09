// FILE HASIL BUILD - jangan diedit. Sumber: skipLinkMain di js/hooks-ops.js, build: node skip-link-firefox/build.js
(function () {
  var L = {"id":{"done":"Selesai:","final":"Link terakhir:","open":"Buka","copy":"Salin","hop":"Halaman berikutnya ada di situs lain. Setelah terbuka, klik Skip Link lagi:","waiting":"Menunggu server","step":"langkah","too_many":"Langkah terlalu banyak, dihentikan.","no_step":"Langkah tidak dikenal","captcha":"Captcha aktif: isi captcha di halaman, klik Verify, lalu klik Skip Link lagi.","expired":"Sesi kedaluwarsa: buka link dari awal lagi.","adblock":"Situs mendeteksi ad blocker: matikan untuk situs ini, muat ulang, lalu klik Skip Link lagi.","revealing":"Mengambil link tujuan...","gate":"Melewati halaman gerbang...","unsupported":"Situs ini belum didukung.","mode_flow":"Mode: API langkah (SafelinkEarn)","mode_reveal":"Mode: halaman akhir","mode_gate":"Mode: halaman gerbang (Continue)","mode_param":"Mode: link di dalam URL","mode_page":"Mode: link download di halaman"},"en":{"done":"Done:","final":"Last link:","open":"Open","copy":"Copy","hop":"The next page is on another site. Once it opens, click Skip Link again:","waiting":"Waiting for server","step":"step","too_many":"Too many steps, stopped.","no_step":"Unknown step","captcha":"Captcha is active: solve it on the page, click Verify, then click Skip Link again.","expired":"Session expired: open the link again from the start.","adblock":"The site detected an ad blocker: turn it off for this site, reload, and click Skip Link again.","revealing":"Getting the destination link...","gate":"Passing the gate page...","unsupported":"This site is not supported yet.","mode_flow":"Mode: step API (SafelinkEarn)","mode_reveal":"Mode: final page","mode_gate":"Mode: gate page (Continue)","mode_param":"Mode: link inside the URL","mode_page":"Mode: download link on the page"}};
  var lang = /^id\b/i.test(navigator.language) ? 'id' : 'en';
  var manual = !!window.__skipManual;
  window.__skipManual = false;
  // Firefox: fetch dari origin halaman (cookie & header Origin sama seperti situsnya), bukan dari origin ekstensi.
  var fetch = (typeof content !== 'undefined' && content.fetch) ? content.fetch.bind(content) : window.fetch.bind(window);
  // window.open di halaman asli (bukan sandbox content script) dimatikan agar popunder tidak muncul.
  try { exportFunction(function () { return null; }, window.wrappedJSObject, { defineAs: 'open' }); } catch (e) { /* abaikan */ }
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
  browser.storage.local.get({ autorun: true, auto: true }).then(function (o) {
    if (!manual) {
      // Jalan otomatis hanya di halaman yang memang dikenali, supaya halaman lain di situs itu tidak dikosongkan.
      if (!o.autorun) return;
      var known = document.getElementById('flow-data') || /^\/go\/[^/]+\/?$/.test(location.pathname) ||
        Array.prototype.some.call(document.forms, function (f) { return /\/v\/go\b/.test(f.action); });
      if (!known) return;
    }
    skipLinkMain({ auto: o.auto, L: L[lang] });
  });
})();
