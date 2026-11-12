// Pemisah penyimpanan per versi. Disisipkan saat build ke tiap folder /<versi>/ (akar tidak diberi, jadi data lama tetap aman).
// Semua versi satu origin; tanpa ini localStorage/IndexedDB/Cache/BroadcastChannel dipakai bersama dan skema antar versi bisa bentrok.
(function () {
  var P = 'v__VER__:';
  function wrap(real) {
    function own() { var r = []; for (var i = 0; i < real.length; i++) { var k = real.key(i); if (k.indexOf(P) === 0) r.push(k); } return r; }
    return {
      getItem: function (k) { return real.getItem(P + k); },
      setItem: function (k, v) { real.setItem(P + k, v); },
      removeItem: function (k) { real.removeItem(P + k); },
      key: function (i) { var a = own(); return i < a.length ? a[i].slice(P.length) : null; },
      get length() { return own().length; },
      clear: function () { own().forEach(function (k) { real.removeItem(k); }); }
    };
  }
  ['localStorage', 'sessionStorage'].forEach(function (name) {
    try { var w = wrap(window[name]); Object.defineProperty(window, name, { configurable: true, get: function () { return w; } }); } catch (e) { /* storage tidak tersedia */ }
  });
  try {
    var f = IDBFactory.prototype, open = f.open, del = f.deleteDatabase;
    f.open = function (n) { var a = Array.prototype.slice.call(arguments); a[0] = P + n; return open.apply(this, a); };
    f.deleteDatabase = function (n) { return del.call(this, P + n); };
  } catch (e) { /* tanpa IndexedDB */ }
  try {
    var c = CacheStorage.prototype, copen = c.open, cdel = c.delete, chas = c.has;
    c.open = function (n) { return copen.call(this, P + n); };
    c.delete = function (n) { return cdel.call(this, P + n); };
    c.has = function (n) { return chas.call(this, P + n); };
  } catch (e) { /* tanpa Cache API */ }
  try { var B = window.BroadcastChannel; window.BroadcastChannel = function (n) { return new B(P + n); }; } catch (e) { /* tanpa BroadcastChannel */ }
})();
