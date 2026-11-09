var ID = /^id\b/i.test(navigator.language);
var TX = ID
  ? { l1: 'Jalankan otomatis di situs shortlink yang dikenal (sfe.ad, safelinkearn.com)', l2: 'Buka link download otomatis setelah ketemu', saved: 'Tersimpan.' }
  : { l1: 'Run automatically on known shortlink sites (sfe.ad, safelinkearn.com)', l2: 'Open the download link automatically when found', saved: 'Saved.' };
document.getElementById('l1').textContent = TX.l1;
document.getElementById('l2').textContent = TX.l2;
var boxes = ['autorun', 'auto'];
browser.storage.local.get({ autorun: true, auto: true }).then(function (o) {
  boxes.forEach(function (k) { document.getElementById(k).checked = !!o[k]; });
});
boxes.forEach(function (k) {
  document.getElementById(k).addEventListener('change', function (e) {
    var v = {}; v[k] = e.target.checked;
    browser.storage.local.set(v).then(function () { document.getElementById('saved').textContent = TX.saved; });
  });
});
