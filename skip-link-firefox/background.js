// Tombol ekstensi (menu ⋮ > Ekstensi > Skip Link di Firefox Android): jalankan Skip Link di tab aktif.
browser.browserAction.onClicked.addListener(function (tab) {
  browser.tabs.executeScript(tab.id, { code: 'window.__skipManual = true;' })
    .then(function () { return browser.tabs.executeScript(tab.id, { file: 'content.js' }); })
    .catch(function (e) { console.warn('Skip Link:', e); });
});
