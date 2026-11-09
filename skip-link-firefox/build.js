// Susun content.js dari skipLinkMain di js/hooks-ops.js (satu sumber dengan bookmarklet),
// lalu kemas jadi skip-link-firefox.xpi di root repo.
// Jalankan dari root repo: node skip-link-firefox/build.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = __dirname;
const root = path.join(dir, '..');
const src = fs.readFileSync(path.join(root, 'js/hooks-ops.js'), 'utf8');

const start = src.indexOf('function skipLinkMain(cfg) {');
const end = src.indexOf('\n}\n', start);
if (start < 0 || end < 0) throw new Error('skipLinkMain tidak ditemukan di js/hooks-ops.js');
const main = src.slice(start, end + 2);

// Teks skip_bm_* per bahasa: kamus pertama = id, kedua = en.
const dicts = [{}, {}];
const re = /skip_bm_(\w+):\s*'((?:[^'\\]|\\.)*)'/g;
let m, seen = {};
while ((m = re.exec(src))) {
  const i = seen[m[1]] ? 1 : 0;
  seen[m[1]] = true;
  // Di ekstensi tidak ada bookmarklet: arahkan ke tombol Skip Link.
  dicts[i][m[1]] = Function("return '" + m[2] + "'")().replace(/(the )?bookmarklet/g, 'Skip Link');
}

const content = `// FILE HASIL BUILD - jangan diedit. Sumber: skipLinkMain di js/hooks-ops.js, build: node skip-link-firefox/build.js
(function () {
  var L = ${JSON.stringify({ id: dicts[0], en: dicts[1] })};
  var lang = /^id\\b/i.test(navigator.language) ? 'id' : 'en';
  var manual = !!window.__skipManual;
  window.__skipManual = false;
  // Firefox: fetch dari origin halaman (cookie & header Origin sama seperti situsnya), bukan dari origin ekstensi.
  var fetch = (typeof content !== 'undefined' && content.fetch) ? content.fetch.bind(content) : window.fetch.bind(window);
  // window.open di halaman asli (bukan sandbox content script) dimatikan agar popunder tidak muncul.
  try { exportFunction(function () { return null; }, window.wrappedJSObject, { defineAs: 'open' }); } catch (e) { /* abaikan */ }
  ${main.replace(/\n/g, '\n  ')}
  browser.storage.local.get({ autorun: true, auto: true }).then(function (o) {
    if (!manual) {
      // Jalan otomatis hanya di halaman yang memang dikenali, supaya halaman lain di situs itu tidak dikosongkan.
      if (!o.autorun) return;
      var known = document.getElementById('flow-data') || /^\\/go\\/[^/]+\\/?$/.test(location.pathname) ||
        Array.prototype.some.call(document.forms, function (f) { return /\\/v\\/go\\b/.test(f.action); });
      if (!known) return;
    }
    skipLinkMain({ auto: o.auto, L: L[lang] });
  });
})();
`;
fs.writeFileSync(path.join(dir, 'content.js'), content);

const xpi = path.join(root, 'skip-link-firefox.xpi');
if (fs.existsSync(xpi)) fs.unlinkSync(xpi);
execFileSync('zip', ['-q', '-X', xpi, 'manifest.json', 'background.js', 'content.js', 'options.html', 'options.js', 'icon.svg'], { cwd: dir });
console.log('OK:', path.relative(root, xpi), fs.statSync(xpi).size, 'byte');
