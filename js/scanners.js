// ============================================================
//  i18n: Bahasa Indonesia (default) + English (dipakai di path /en/).
//  t(key) mengembalikan teks bahasa aktif; jika belum diterjemahkan,
//  jatuh ke Indonesia (aplikasi tetap jalan saat terjemahan belum lengkap).
// ============================================================
const THEME_KEY = 'scaTheme', LANG_KEY = 'scaLang';
// Bahasa dari: query ?lang= > path /en/ > localStorage > default 'id'.
function detectLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'id') return q;
  } catch (e) { /* abaikan */ }
  if (/(^|\/)en(\/|$)/.test(location.pathname)) return 'en';
  try { const s = localStorage.getItem(LANG_KEY); if (s === 'en' || s === 'id') return s; } catch (e) { /* abaikan */ }
  return 'id';
}
function detectTheme() {
  try { const s = localStorage.getItem(THEME_KEY); if (s === 'light' || s === 'dark') return s; } catch (e) { /* abaikan */ }
  return 'dark';
}
const I18N = window.APP_I18N || { id: {}, en: {} };
const LANG = detectLang();
// tr(): versi non-Vue dari t(), bisa dipakai di builder laporan, pesan error, dll.
function tr(key) { return (I18N[LANG] && I18N[LANG][key]) || (I18N.id && I18N.id[key]) || key; }
// Teks data (grup/API) yang punya default Indonesia di array: pakai terjemahan
// bila ada untuk bahasa aktif, selain itu jatuh ke nilai Indonesia di data.
function trData(key, fallback) { const d = I18N[LANG]; return (d && d[key]) || fallback; }
// Teks berbahasa Indonesia di data/aturan (Dockerfile, DAST, SAST, JWT, skrip hook) diterjemahkan
// lewat kamus frasa I18N.text_en (kunci = teks Indonesia apa adanya); tanpa padanan -> teks asli.
const TEXT_EN = I18N.text_en || {};
function L(s) { return (LANG === 'en' && TEXT_EN[s]) || s; }
// L() + isi placeholder {nama} dari objek vars.
function Lf(s, vars) { return L(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)); }
// Skrip yang dipasang di tab lain: terjemahkan literal string "..." yang ada di kamus.
function localizeScript(src) {
  if (LANG !== 'en') return src;
  return src.replace(/"((?:[^"\\]|\\.)*)"/g,(m, s) => (TEXT_EN[s] ? JSON.stringify(TEXT_EN[s]) : m));
}

// ============================================================
//  Util
// ============================================================
const APP_VERSION = window.APP_VERSION || '';
// Ikon tab (favicon.ico inline base64, tanpa file luar) - dipakai juga di laporan Blob
const FAV_LINK = '<link rel="icon" type="image/x-icon" href="data:image/x-icon;base64,AAABAAMAEBAAAAAAIADfAgAANgAAABgYAAAAACAAggUAABUDAAAgIAAAAAAgAO0IAACXCAAAiVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAACpklEQVR4nFWRTWtUZxiG7+d5z9dMJpmTmcyko4kNkwh+pInBIKW0lbRgC21duioILlxGf4GL/oCuuyi4ENwIShXcBPzaBRI1ukiathmt5nucSebMnJk557zv4yK14L2/4Lq4SUQAiIAIQFz7Mwq3tVJIH1Z9Iy7BggEY/88CICJEsr7YfPZ7o7Eo1BWlNMcqM8bHZ9OfzvhiiJgOADJaiLH84N3Da007sVOKTVfbXuT4WnbccFVO/5o6eWlADBEDABMj2Auf3Ggh73KRQi/JThv3sBO8dYYvmoFvrOe/tOprATFEgAO75YVWLQIKaFnm9Kx7/rdPzt/M9YxyddEdv5oOQ1NdigHAfGjYriPpV6GR7Cgmf8wS7H+XAl3UqhTtNzX67W4kH0WnB7iTIYeoESGo6yRqbbxqDZ6VZsUsXA+9cQyc8EUETP8pHTvuiq/jjAqVunertv6qVp5ye3q8ynyqE2a9YcuwJqKDBjJGiMzcfG3uUezFPD0eBzvGVq5umPXnulA0uaG2aekzFw6VxnwIGASAvz3Te2oiMZnk2d8UCLwsupx8P5suz2jlJxHcp/ffBtUOCExAox0/fFE7coi/+8rKleh1oCp78EeMYbOx3e4ddLRjYiO1rTYA7sTJ49XdlZ223+u+a+vyiCmP6Q63V7Zw427yZi/V7PLQlKg+2+tlANY/1XB5p1tKOW8a9Nc+hR0+WbIDaQ5nmdwoaqmXa/rzSefLH4rZQgoAH8l7x4qplbp150Xs2FzotxY2zGqzR3v2pZ/6JiacXZ1eWHbII2YSAYs2S1tUbcvlr90r5wo/f5Ep5pNcPt7s8vymrsNYeV5v8B93awdX88pWZ61qJgZpeqQv6Mrtl3vlgjdzNHVhyu8kcSmHz0ZF+VTZRKWyT6TfAzSzSdTAHSi+AAAAAElFTkSuQmCCiVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAFSUlEQVR4nGXTy29c9RUH8HN+v999zcvj8cQTj+0k2HHixOAoTVXIAgM1SLRClap2UZF22QVL/oRu+w8g1ApV6gIi2FKSxkqbKg1uUkIC5OFXzTj22PG8Z+6dO/f3Ol04JVDO+uijo3O+B4kIvlXWAOMEgJa0HhAZEj5yAQAOAJAm4IgI3y/8BiKCg45mpVNZGrQ+T1QT9cCms0LkYficKP3IL85mADgZQv7/2BOIyCJC0k++eL9z/2KsHjmORmYRPY0JQYdbMs4YHfkFnnm7GOQDsMQY/x5EAGQTmVz63ePqJeblXJcbVIwz6xc0MQlA0PEGDz0amOz55OV3S9lyCiwAw+9ARIRIV9+r3vkT5AsOJJorDtrqrrE9x3cNZuXIgsk6zs6HXLd56Y3klT9MMOTICIAdQIwsIOLu1+0vr+pUyZPcGA8lh75Qo4t25rfam090z69+zA6/5o7/iiig2j/o0bUmMrLm6USCABDo7vXegBjPKZJoBwBCvvSWf3qxgIAy0Td+31j9I698os++la9ebsS7rHZbHvsxATyFGGNgjN2pMspy5ROkMbZw/KdsbnHEGrAaVGTaXaV9jxgOTQSp55jUTGkGwPFbkACAJNERMJtihlmSqNJqbDZtrSBjuMtvfLitFCu9EZvi4Ku/GQVguau1BDBA7JuhBAB4Hg+GqdHmjFnBSHm8vq8ZI+ayz5aq+Ul/dBq6vU5nRdx6pz9cBm8KCrMBABFahCchENYC5+LwM2J9R7uOIAZ8SHz1efzsC+FepacUpYbVxs2+rGeSbWsi0dk1zkxj8sVRooOr/W9HB2k+N+f7OTlw0HiIWaqH3vvvNYDT8JgdHc8u/mZif0uGoWszAA4fmSg8+KSBiEDsOxARlceGXl5Id0xCAZMCg6J89Wfp1Yfm2hK0W/jFcugWecRsRDZ/RheeU2s326uf7hERWQtET1/EWgI0V27Ur3xqPBB5x5RLsvPY9ptBczfhBnK+c+SEPj7Hly9VJ6c9TLzmdnT2J8X5xQkijvgEImOIc1zfqS/f6a9uUtgJhFVTE/ZImZ+ayW6tR42a/PmF8csXtzJZ5ChX/+7PPi+27lUX3jxVms6QBUEAQMg5Lq/Uw746edSfO0bVBt57KCo1VtkztUbkwuDkrBeHanu7PzXncmV7kVy/33WZv1vpl6YzBCAO/n7pXq3yODxacHvKJrEH3KQLsXGsGqTuruF02f77jr1+vSETrYxwhDvzihrOZx6vR6kcAQAiMIZ4e6u91YrJdbbr9ocnCtVO3IqTsycyI3k3d2gwczpOfFzZF3sDJ4TSbiPdjinI8zAyYY8HGQZgAYDFUi1XQmCi3bWHCu5OKzk2Gaw1+VpNLZxLZzM8wsH0UTg9SxRoL69bPb25I6WkQtF7/dfHJmeLRIgIwuGIDmt37fGSWKnzyw+SWFrBxeYG3d2PR3ze6uemnHhsNEwHTqttai1f9kSmzs6/lE+nAmuBMQAAtNb0pLp6r3HlP0wqkQE9P47lEV7rys06q0UEjB/NJheezx3KBRs70cUrYTJwkn1zekpdeHPccfhBGAUiPqiGf91AZPxwNvnlfDA/mUXkAPKDW42dR5B11FoPvu7qtUbUCfVQCbcfsUyJr2zS8r9aCy8eIiIAFMqof24qQ9yxcvGke+bIsDEAzH50t1Pt2dlRmsoLjuLaRqQk5h3DuKtcm1jkGffmZ9H5F4YcxwOyohnpRk9z9IccOjUaWCLO2V9Wm/f3orcXxv/8ZWuikP5BOTNfjnZ7g4Bbq80zRVi6bXMB63bdW7daZ+azqbT/X2bx+FrTBXcPAAAAAElFTkSuQmCCiVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAItElEQVR4nH1WSWyd1RU+5w7/8OZnv9iOkziOE9skJAFDGNLQBBKGqilFFLqD0lKJBatWYlGppWLTTdUVi06qggpIpVEoVUGUQqGQACUjzTzasY2neHjz+6c7nC5MQghpz/Lq6hx9wxmQiOB6QcYAcOQEgFc9WwAEsMYgEHBE4oBf+nBtiOvlBgIgbhmoubNx/WKcVCmsKulhttPlKVtck0kvcxA4gAEjgP+f/F8pYIxhHBHo3NvzZ1+Lq4eIypYZSQqQrAADjKirUtool26XAw+X3DTXioRAwutDwasosmQscpw+WT28qznxgXJUynMZQ0RtQVjgGlsMA8aU0DaJEsoOhbf9LL90S8lqlBwQr4PlcgECsho5DB+ovvfzMi+nWVYyijDhYAAVeW1GtEdkEGJSC1JNuinf0S0VY7TxOXfD9ztBI4r/XYAsIeLcZ9Xdz1xyqkXmaIiBW2LKQauQWUgEUwAsgpzKr9eprDf9mnV1ATFqtZItv0317ewkawEBEa/2BbusK1hSe18u60YOsmQQQJLl3HhaeTaKKIx0qIzRklUyk2+lRNFu/lU6EAtGMEdmD/9yIayFBhl8xZMMAMgCYzhyfGHkGLlFqbm1LhoXrWc18IipjvuSW55hfU9EYjCMwWSL3ukXovSAO/RsutlMRD5JRlIX/jrPMbEW6ctSC4BFQPo/+2ogfeUkoBE0cqMxklhs3v+j9JrN7Yufw0bw7rNzlY+tA9lTr9S+/tNlw38ej85w68DsYQVPGGL8GicxIkCEWkWNXeQsI5VjjSTrkBBuwMzmp701m9uVITJGx8rPisFHPOMKy7muI7PYeXc6tISOiAJA8BGvdSoDIABoNk0MgnywklsXrIuBpMyKcM2mPBEXCASCO3Dho+obz80aENBu3ZWETGRWWuUlwD2jjbIKL4v6BUWLCIIwCbkQHIEZY1Eq1Ilp7/RTaQcXmURCxH175tY+0IEUxUkQxnrfH8+pqsPQs64GREADwID41SqwRUy5vPQyWknHeEQSjGMpxWt1FTQ0ERIiArz++5H195Vu3OnyZREvkbXOmddtZbiS2RCHLSyu4xIlkL6mnRkgAkBbyc90UCi1cYRx0DiIaSxX5dljVUQiHb/50khbZ3r1Jv+dF8eE9TtW5GaPuVDLV8bavRUqc9v0wENLCNh1KEIAIpBc9K1xpuYS15WWISIDMiLLP3y31d5VP3Fgumcgn8+7e98Yvfuxjj2/CP3AEwJ5lmziTB0SXk9grQEAAnGtiwAAEYDozptTuXwcCSRpjQuGI6Zwvpx78XczfetKmSJNjFW+/fj6vg1Lb76fjIvoO9ZBjbZzg159c/fe56cREsbwmlb7HJElWlLKb9uWD0xoXGklWBcTxI6Vtad+vDwIo1dfauQ6C5dmGueOL9SbSL62Lg8VC7nue8DJD8S1sjn9/oLSMSKQJSC7mPmLaWqNBW7+9q9L+w7qrJtBrZOmGrqJ9XTTG7sbqJagiV1hdGQ8SjGtYhUPbpREyfxMo7MbTcDLk0lnv7/jyb5UEZDcxZ64UsCSBUJCtH/fO/v2fpOWjgug6uT6rfUDron07JTTqoDAJG463b3J7duy7SX6x+6J+ky4ZWfX8GHjIU+wnE2ntv/gBou4aNAroiMBMITExIYlO24XKa9RDpEyLMHUqWGToHvHDvn0T9oe/WFbtqt+94OlwY2lt/aUs4XsQ08Njg/XJk4zP5NdMdg+dqw2cbbOkMgSXNlohoAznK1Fb+2fXdub9i0TKBwf9x+JW3UntOmjF+jUhWjdmjjjY34JdSwV1sQWQGahGjTalqTHXXbqULU7DP1M7vzR+vK1mcXkYnEbcMTRcrhn7+Rd6wsS8MR4495buhrNKH8XPznc+mwadQhIqU9Pm+62Vnshtf9grTJjqlGtOYpBIF3Oi/3acxIuIdXFO5a7RIhIACistZzR6EJr97+nVnV741O1SJlvbOp4fs9UNiW50GFAqawutqXnZ2OWwrZlenrKP/mO5sSyXteK7tq2b/adOTjPnPod9/QffW9aSdVqBYiWiCOAYIih1q8emV23IjdaiYpOvp3HHYXChoGg3IzvHyo0mnjwRDhaa61b68zP6Eos50L0Sz4zSRQ549P5P7081VXSxZx3/vTkxMVIojs4lDHaMC4XZxEeuFgxwDvy/MKUnVgIupY55UYw1J9qWPGbt+sX51uPPlC4d33h3JTy8nFnSQ+tcwy2QgIlNXEmfFFpqDjRlUv6pi2lB5/s7V3fztDFz8ckUKLM+QY2DtS23+B15dwjI+q1A+VQkSM97eA/z6ijE5du6JGWuRfL8o7+pKcYKGL1uko5Gonm5kRQznZ2y53fahMoASQRXDkwkEhfrId/ObKweVnm+ETz8KzjaF86pJRGqwG0QQdAoEnSAjRif3vY5SaeKwu+e24sPnom6/lKaIrKOLQh+u53ljLmMPbFeYHWKgAem+QP7098ulAoeErFjtSNG7v50KpsYOKZ+eT8HCxEjAgJhAOtJ7cW15SyyJi24Stvzh0bQ8dIx2BUDndsd3bcs5SsQRRwmSKWGPXyxzPHyrm8RyahJZnokY2ZdctzAAwgA33q6ESw65Na7BV8VZ2NveMT4cp2cWI8DgLq7vVGq1GzJhG0k/c++jDuW11d1VMA+vyoFYgwPB8cmGIZH5TVksWPbS6uKmaMQQPgcHtyOtz1SWV5Qcwmta/10KHp5MMpOD8bj5ZhiWtNKBoJ9zw0MTHAOJAfvF/r/V4OABZ3gwCAkUsJgmREOjG397i9RVdbxhE4s8fnol37Fzb1Zm/tcX69v3znYPfm1Wq4rM7MRhtXumHcXJlzToyq4yOhcQQzwH0xOR3Uq2G+kAFrAZEZshfmQs7AAmfW9He4CJzAIuJkLX7hwPRAu/P4raWZBmZcNy2wq5Db0lfcujrjc7O1v3R2sv7wXfmtN9rEEEhCSaFK7f2oMj42FycxAf0XwOm+5hd1QMcAAAAASUVORK5CYII=">';
const SEV_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
const SEV_LABEL = {
  id: { CRITICAL: 'Kritis', HIGH: 'Tinggi', MEDIUM: 'Sedang', LOW: 'Rendah', UNKNOWN: 'N/A' },
  en: { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low', UNKNOWN: 'N/A' }
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Ambil kecocokan pertama tanpa RegExp.exec (re wajib berflag g)
function rx1(re, s) {
  for (const m of String(s).matchAll(re)) return m;
  return null;
}
function normSev(s) {
  s = String(s || '').toUpperCase();
  if (s === 'MODERATE') s = 'MEDIUM';
  return SEV_ORDER[s] !== undefined ? s : 'UNKNOWN';
}
function maxSev(list) {
  let best = 'UNKNOWN';
  list.forEach(s => { if (SEV_ORDER[s] > SEV_ORDER[best]) best = s; });
  return best;
}
async function pool(items, n, fn) {
  let i = 0;
  const workers = [];
  for (let w = 0; w < Math.min(n, items.length); w++) {
    workers.push((async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })());
  }
  await Promise.all(workers);
}

// Pesan error fetch yang mudah dipahami: browser menyamarkan kegagalan CORS,
// host mati, dan protokol sebagai "Failed to fetch" yang sama, jadi diberi
// dugaan + saran. Offline dideteksi lewat navigator.onLine.
function friendlyFetchError(e) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return tr('err_offline');
  if (e && e.name === 'AbortError') return tr('err_aborted');
  const m = (e && e.message) || String(e || '');
  if (/failed to fetch|networkerror|load failed|terminated/i.test(m)) return tr('err_network');
  return m || tr('err_unknown');
}

// ---- Perbandingan versi (semver longgar; juga revisi Alpine "-r0")
function parseVer(v) {
  v = String(v).trim();
  if (v[0] === 'v' || v[0] === 'V' || v[0] === '=') v = v.slice(1);
  const plus = v.indexOf('+'); if (plus >= 0) v = v.slice(0, plus);
  const dash = v.indexOf('-');
  let main = v, pre = '';
  if (dash >= 0) { main = v.slice(0, dash); pre = v.slice(dash + 1); }
  const nums = main.split('.').map(x => parseInt(x, 10) || 0);
  if (/^r\d+$/.test(pre)) { nums.push(parseInt(pre.slice(1), 10)); pre = ''; }
  return { nums, pre };
}
function cmpVer(a, b) {
  const x = parseVer(a), y = parseVer(b);
  const n = Math.max(x.nums.length, y.nums.length);
  for (let i = 0; i < n; i++) {
    const d = (x.nums[i] || 0) - (y.nums[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  const p = x.pre.split('.'), q = y.pre.split('.');
  for (let i = 0; i < Math.max(p.length, q.length); i++) {
    if (p[i] === undefined) return -1;
    if (q[i] === undefined) return 1;
    const pn = /^\d+$/.test(p[i]), qn = /^\d+$/.test(q[i]);
    if (pn && qn) { const d = parseInt(p[i], 10) - parseInt(q[i], 10); if (d) return d < 0 ? -1 : 1; }
    else if (pn) return -1;
    else if (qn) return 1;
    else if (p[i] !== q[i]) return p[i] < q[i] ? -1 : 1;
  }
  return 0;
}
function updateKind(from, to) {
  if (!to) return '';
  const a = parseVer(from).nums, b = parseVer(to).nums;
  if ((b[0] || 0) !== (a[0] || 0)) return 'major';
  if ((b[1] || 0) !== (a[1] || 0)) return 'minor';
  return 'patch';
}

// ---- CVSS v3 -> skor -> severity
function cvss3Score(vec) {
  const m = {};
  vec.split('/').forEach(p => { const kv = p.split(':'); m[kv[0]] = kv[1]; });
  const AV = { N: .85, A: .62, L: .55, P: .2 }[m.AV], AC = { L: .77, H: .44 }[m.AC], UI = { N: .85, R: .62 }[m.UI];
  const PR = (m.S === 'C' ? { N: .85, L: .68, H: .5 } : { N: .85, L: .62, H: .27 })[m.PR];
  const W = { H: .56, L: .22, N: 0 };
  if ([AV, AC, UI, PR, W[m.C], W[m.I], W[m.A]].some(x => x === undefined)) return 0;
  const iss = 1 - (1 - W[m.C]) * (1 - W[m.I]) * (1 - W[m.A]);
  const imp = m.S === 'U' ? 6.42 * iss : 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);
  if (imp <= 0) return 0;
  const ex = 8.22 * AV * AC * PR * UI;
  const raw = m.S === 'U' ? Math.min(imp + ex, 10) : Math.min(1.08 * (imp + ex), 10);
  return Math.ceil(raw * 10 - 1e-9) / 10;
}
function scoreToSev(sc) { return sc >= 9 ? 'CRITICAL' : sc >= 7 ? 'HIGH' : sc >= 4 ? 'MEDIUM' : sc > 0 ? 'LOW' : 'UNKNOWN'; }

// ============================================================
//  Daftar API publik + pencatat pemanggilan (ditampilkan di panel kiri & laporan)
// ============================================================
// Kelompok API: tiap sumber hanya muncul di satu kelompok supaya tidak tercampur
const API_GROUPS = [
  { key: 'sca', title: 'SCA — cek kerentanan package', desc: 'Dipakai saat scan lockfile / package.json / .csproj dan paket yang dipin di Dockerfile.' },
  { key: 'docker', title: 'Dockerfile — status EOL image', desc: 'Hanya dipakai saat scan Dockerfile.' },
  { key: 'scrape', title: 'Scraping — ambil file dari link', desc: 'Hanya dipakai saat memasukkan link repo/file GitHub, GitLab, atau URL. Hasilnya diteruskan ke scan SCA/Dockerfile.' },
  { key: 'dast', title: 'DAST pasif — cek header situs', desc: 'Hanya dipakai di tab DAST pasif. URL yang Anda masukkan dikirim ke layanan ini; keduanya hanya membaca respons publik situs, tidak menyerang.' },
  { key: 'sast', title: 'SAST — pemeriksaan kode', desc: 'Tidak memakai API apa pun: kode dicek lokal di browser dan tidak dikirim ke mana pun.', none: true },
  { key: 'colab', title: 'Colab Server — SonarQube & AI', desc: 'Hanya memanggil server Colab yang Anda jalankan sendiri: sonar-scanner di komputer Anda mengirim kode ke SonarQube, dan chat Tanya Kode mengirim pertanyaan ke gateway LLM (API key), keduanya lewat Cloudflare quick tunnel.', none: true },
  { key: 'ocr', title: 'OCR Gambar — baca teks dari gambar', desc: 'Hanya dipakai di tab OCR Gambar. Tesseract jalan di browser; OCR.space dan AI menerima gambar yang Anda kirim.' },
  { key: 'color', title: 'Color Picker', desc: 'Tidak memakai API: gambar dan warna diproses lokal di browser.', none: true },
  { key: 'img', title: 'Studio Gambar', desc: 'Lokal di browser. Opsional: runtime + model Real-ESRGAN dari jsDelivr/Hugging Face, dan API AI pilihan Anda (OpenAI, Gemini, OpenRouter, Stability) dengan key Anda.', none: true },
  { key: 'sheet', title: 'Sheet Viewer', desc: 'Tidak memakai API: file dibaca lokal di browser (Web Worker).', none: true },
  { key: 'shop', title: 'Shopee Hook', desc: 'Tidak memanggil API Shopee: data dari halaman Shopee yang Anda buka sendiri.', none: true },
  { key: 'wa', title: 'WA Hook', desc: 'Tidak memakai API: membaca pesan yang tampil saat Anda scroll di tab WhatsApp Web Anda sendiri, lalu menyimpannya di IndexedDB browser ini.', none: true },
  { key: 'git', title: 'Git Lens', desc: 'Tidak memakai API: folder .git / teks git log dibaca lokal di browser.', none: true },
  { key: 'clock', title: 'Jam Dunia', desc: 'Tidak memakai API: zona waktu dari Intl bawaan browser.', none: true },
  { key: 'ping', title: 'Multi Ping — cek server', desc: 'Request HTTP langsung dari browser ke URL yang Anda daftarkan, tanpa layanan pihak ketiga.', none: true },
  { key: 'swag', title: 'Swag — Swagger ke Postman/curl', desc: 'Tidak memakai API publik: spec diproses lokal. Ambil dari link memakai "Link langsung" (butuh CORS); bookmarklet membaca spec di tab Swagger itu sendiri.', none: true },
  { key: 'app', title: 'Aplikasi — library halaman', desc: 'Dimuat saat halaman dibuka, bukan bagian dari proses scan.' }
];
const API_LIST = [
  { key: 'osv-batch', group: 'sca', name: 'OSV.dev — querybatch', url: 'POST https://api.osv.dev/v1/querybatch', use: 'Mencocokkan package + versi ke daftar advisory (SCA).', sends: 'nama package, versi, ekosistem', when: 'Selalu (lockfile & paket di Dockerfile)' },
  { key: 'osv-vuln', group: 'sca', name: 'OSV.dev — detail advisory', url: 'GET https://api.osv.dev/v1/vulns/{id}', use: 'Severity, CWE, ringkasan, dan versi perbaikan per advisory.', sends: 'ID advisory (GHSA-…, ALPINE-CVE-…)', when: 'Selalu bila ada temuan' },
  { key: 'epss', group: 'sca', name: 'FIRST — EPSS', url: 'GET https://api.first.org/data/v1/epss?cve=…', use: 'Probabilitas sebuah CVE dieksploitasi.', sends: 'ID CVE', when: 'Opsi "EPSS & CISA KEV"' },
  { key: 'kev', group: 'sca', name: 'CISA KEV (mirror GitHub)', url: 'GET https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json', use: 'Daftar CVE yang sudah dieksploitasi di dunia nyata.', sends: 'tidak ada (hanya mengunduh daftar)', when: 'Opsi "EPSS & CISA KEV"' },
  { key: 'depsdev', group: 'sca', name: 'deps.dev (Open Source Insights)', url: 'GET https://api.deps.dev/v3/systems/{sistem}/packages/{nama}/versions/{versi}', use: 'Lisensi (SPDX) tiap dependency untuk matriks risiko lisensi & SBOM, bila lockfile tidak memuat lisensinya.', sends: 'nama package, versi, ekosistem', when: 'Opsi "Cek lisensi dependency"' },
  { key: 'eol', group: 'docker', name: 'endoflife.date', url: 'GET https://endoflife.date/api/{produk}.json', use: 'Status EOL base image Docker dan runtime/framework (Node, Go, .NET, PHP, Angular, Vue, Laravel, …).', sends: 'nama produk, mis. nodejs', when: 'Scan Dockerfile & tab EOL' },
  { key: 'gh-api', group: 'scrape', name: 'GitHub REST API', url: 'GET https://api.github.com/repos/{owner}/{repo}[/git/trees/{ref}]', use: 'Mencari file yang bisa di-scan di repo GitHub.', sends: 'owner/repo, branch; token bila diisi', when: 'Ambil dari link GitHub' },
  { key: 'gh-raw', group: 'scrape', name: 'GitHub raw', url: 'GET https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}', use: 'Mengunduh isi file dari repo publik.', sends: 'path file', when: 'Ambil dari link GitHub (publik)' },
  { key: 'gl-api', group: 'scrape', name: 'GitLab REST API', url: 'GET https://gitlab.com/api/v4/projects/{path}/repository/…', use: 'Daftar dan isi file repo GitLab.', sends: 'path proyek, branch; token bila diisi', when: 'Ambil dari link GitLab' },
  { key: 'url', group: 'scrape', name: 'Link langsung', url: 'GET {link yang Anda masukkan}', use: 'Mengunduh file raw dari URL lain (butuh CORS dari server tujuan).', sends: 'tidak ada', when: 'Link selain GitHub/GitLab' },
  { key: 'obs', group: 'dast', name: 'MDN HTTP Observatory', url: 'POST https://observatory-api.mdn.mozilla.net/api/v2/scan?host={host}', use: 'Nilai (A–F), skor, dan jumlah tes keamanan header yang lulus/gagal (CSP, HSTS, cookie, redirect, dll.).', sends: 'nama host situs (tanpa path)', when: 'Tab DAST pasif' },
  { key: 'ht', group: 'dast', name: 'HackerTarget — httpheaders', url: 'GET https://api.hackertarget.com/httpheaders/?q={url}', use: 'Mengambil header respons situs, lalu dianalisis di browser (HSTS, CSP, cookie, dll.). Batas gratis ±50 request/hari.', sends: 'URL yang dicek', when: 'Tab DAST pasif' },
  { key: 'dns', group: 'dast', name: 'Google DNS-over-HTTPS', url: 'GET https://dns.google/resolve?name={host}&type={A,AAAA,MX,NS,TXT}', use: 'Resolusi DNS pasif: IP (A/AAAA), name server, MX, dan TXT domain.', sends: 'nama host/domain', when: 'Tab DAST pasif — opsi domain & port' },
  { key: 'idb', group: 'dast', name: 'Shodan InternetDB', url: 'GET https://internetdb.shodan.io/{ip}', use: 'Data pasif per-IP: port terbuka, CVE diketahui, teknologi (CPE), dan tag — hasil scan Shodan sebelumnya, bukan nmap langsung.', sends: 'alamat IP hasil resolusi DNS', when: 'Tab DAST pasif — opsi domain & port' },
  { key: 'tess', group: 'ocr', name: 'Tesseract.js 5 (jsDelivr + tessdata)', url: 'GET https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1 + tessdata.projectnaptha.com', use: 'Library OCR (WASM) + data bahasa, jalan lokal di browser.', sends: 'tidak ada (hanya mengunduh library/data)', when: 'Tab OCR Gambar — mode Tesseract' },
  { key: 'ocrspace', group: 'ocr', name: 'OCR.space API', url: 'POST https://api.ocr.space/parse/image', use: 'API OCR publik (engine 2, bahasa otomatis).', sends: 'gambar (base64), API key', when: 'Tab OCR Gambar — mode OCR.space' },
  { key: 'aiocr', group: 'ocr', name: 'AI vision (OpenAI-compatible)', url: 'POST {Base URL}/chat/completions', use: 'Model vision membaca gambar; mode detail juga memberi tabel dan ringkasan.', sends: 'gambar (base64), prompt, token Anda', when: 'Tab OCR Gambar — mode AI' },
  { key: 'cdn', group: 'app', name: 'Vue 3.5.13 (Lokal Offline)', url: 'GET js/vue.global.prod.js', use: 'Library Vue lokal mandiri di browser, 0 outbound request.', sends: 'tidak ada (100% lokal)', when: 'Saat halaman dibuka' },
];
const apiStats = Vue.reactive({});
API_LIST.forEach(a => { apiStats[a.key] = { calls: 0, ok: 0, fail: 0, last: '' }; });
apiStats.cdn.calls = 1; apiStats.cdn.ok = 1;
// okStatus: status non-2xx yang wajar untuk API ini (mis. 404 = data tidak terdaftar), tidak dihitung gagal.
async function apiFetch(key, url, init, okStatus) {
  const s = apiStats[key];
  s.calls++;
  try {
    const res = await fetch(url, init);
    if (res.ok || (okStatus || []).includes(res.status)) s.ok++; else { s.fail++; s.last = 'HTTP ' + res.status; }
    return res;
  } catch (e) { s.fail++; s.last = e.message; throw e; }
}

// ============================================================
//  OSV client
// ============================================================
const OSV = 'https://api.osv.dev';
const vulnCache = {};

async function osvBatch(items) {
  // items: [{name, version, eco}] -> [[id,...], ...]
  const out = items.map(() => []);
  let todo = items.map((it, i) => ({ i, token: '' }));
  let guard = 0;
  while (todo.length && guard++ < 10) {
    const next = [];
    for (let s = 0; s < todo.length; s += 500) {
      const chunk = todo.slice(s, s + 500);
      const res = await apiFetch('osv-batch', OSV + '/v1/querybatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: chunk.map(c => {
            const it = items[c.i];
            const q = { package: { name: it.name, ecosystem: it.eco }, version: it.version };
            if (c.token) q.page_token = c.token;
            return q;
          })
        })
      });
      if (!res.ok) throw new Error('OSV HTTP ' + res.status);
      const data = await res.json();
      chunk.forEach((c, k) => {
        const r = data.results[k] || {};
        (r.vulns || []).forEach(v => out[c.i].push(v.id));
        if (r.next_page_token) next.push({ i: c.i, token: r.next_page_token });
      });
    }
    todo = next;
  }
  return out;
}
async function getVuln(id) {
  if (vulnCache[id]) return vulnCache[id];
  let lastErr;
  for (let t = 0; t < 3; t++) {
    try {
      const res = await apiFetch('osv-vuln', OSV + '/v1/vulns/' + encodeURIComponent(id));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      vulnCache[id] = await res.json();
      return vulnCache[id];
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// versi perbaikan untuk versi terpasang `ver` (null = belum ada)
function fixedFor(vuln, name, ver, eco) {
  let best = null, matched = false;
  const cands = [];
  // utamakan entri affected dengan ekosistem yang sama (mis. Alpine:v3.16, bukan cabang lain)
  const sameEco = (vuln.affected || []).some(a => a.package && a.package.ecosystem === eco && String(a.package.name).toLowerCase() === String(name).toLowerCase());
  (vuln.affected || []).forEach(a => {
    if (a.package && String(a.package.name).toLowerCase() !== String(name).toLowerCase()) return;
    if (sameEco && (!a.package || a.package.ecosystem !== eco)) return;
    (a.ranges || []).forEach(r => {
      if (r.type === 'GIT') return;
      const evs = (r.events || []).map(e => ({
        k: e.introduced !== undefined ? 'i' : e.fixed !== undefined ? 'f' : e.last_affected !== undefined ? 'l' : '',
        v: e.introduced !== undefined ? e.introduced : e.fixed !== undefined ? e.fixed : e.last_affected
      })).filter(e => e.k);
      evs.sort((p, q) => (p.v === '0' ? -1 : q.v === '0' ? 1 : cmpVer(p.v, q.v)));
      let active = false;
      for (const e of evs) {
        if (e.k === 'i') { if (cmpVer(ver, e.v) >= 0) active = true; }
        else if (e.k === 'f') {
          if (active && cmpVer(ver, e.v) < 0) { matched = true; cands.push(e.v); active = false; break; }
          active = false;
        } else if (e.k === 'l') { if (active && cmpVer(ver, e.v) > 0) active = false; }
      }
      if (active) matched = true;
    });
  });
  // utamakan versi perbaikan dengan qualifier yang sama dengan versi terpasang (mis. 30.0-jre -> 32.0.0-jre, bukan -android)
  const sfx = parseVer(ver).pre;
  const same = sfx ? cands.filter(c => parseVer(c).pre === sfx) : [];
  (same.length ? same : cands).forEach(c => { if (best === null || cmpVer(c, best) < 0) best = c; });
  // data advisory sering hanya menulis satu varian (mis. Guava 32.0.0-android); samakan dengan varian terpasang
  if (best !== null && !same.length && (sfx === 'jre' || sfx === 'android')) {
    const other = sfx === 'jre' ? '-android' : '-jre';
    if (best.endsWith(other)) best = best.slice(0, best.length - other.length) + '-' + sfx;
  }
  return matched ? best : null;
}
function analyzeVuln(v, name, ver, eco) {
  const aliases = v.aliases || [];
  const cves = [v.id].concat(aliases).filter(x => String(x).startsWith('CVE-'));
  let sev = normSev(v.database_specific && v.database_specific.severity);
  if (sev === 'UNKNOWN') {
    (v.severity || []).forEach(s => {
      if (String(s.score).startsWith('CVSS:3')) { const x = scoreToSev(cvss3Score(s.score)); if (SEV_ORDER[x] > SEV_ORDER[sev]) sev = x; }
    });
  }
  const cwes = (v.database_specific && v.database_specific.cwe_ids) || [];
  return {
    id: v.id, aliases, cves, severity: sev, cwes,
    summary: v.summary || (v.details ? String(v.details).split('\n')[0].slice(0, 160) : ''),
    fixed: fixedFor(v, name, ver, eco), epss: null, kev: false
  };
}
function buildVulns(ids, name, ver, eco) {
  const covered = new Set();
  const out = [];
  ids.slice().sort().forEach(id => {
    const raw = vulnCache[id];
    if (!raw) { out.push({ id, aliases: [], cves: [], severity: 'UNKNOWN', cwes: [], summary: L('(detail tidak berhasil diambil)'), fixed: null, epss: null, kev: false }); return; }
    const als = [raw.id].concat(raw.aliases || []);
    if (als.some(a => covered.has(a))) return;
    als.forEach(a => covered.add(a));
    out.push(analyzeVuln(raw, name, ver, eco));
  });
  return out;
}

// ============================================================
//  Inti SCA: package -> temuan + versi aman
// ============================================================
async function scanPackages(pkgs, log, opts) {
  const map = new Map();
  pkgs.forEach(p => {
    const k = p.eco + '|' + p.name + '|' + p.version;
    const e = map.get(k);
    if (e) { e.dev = e.dev && p.dev; e.direct = e.direct === true || p.direct === true ? true : e.direct; }
    else map.set(k, Object.assign({}, p, { vulns: [], updateTo: '', kind: '', partial: false, still: [] }));
  });
  const entries = Array.from(map.values());
  if (!entries.length) return entries;

  log(tr('log_osv_query').replace('{n}', entries.length));
  const idLists = await osvBatch(entries.map(e => ({ name: e.name, version: e.version, eco: e.eco })));
  const ids = new Set();
  idLists.forEach(l => l.forEach(i => ids.add(i)));
  log(Lf('{n} advisory unik, mengambil detail...', { n: ids.size }));
  await pool(Array.from(ids), 15, id => getVuln(id).catch(() => null));
  entries.forEach((e, i) => { e.vulns = buildVulns(idLists[i], e.name, e.version, e.eco); });

  // versi aman = fixed tertinggi, lalu diverifikasi ulang ke OSV
  const calc = e => {
    let cand = null; e.partial = false;
    e.vulns.forEach(v => { if (v.fixed === null) e.partial = true; else if (cand === null || cmpVer(v.fixed, cand) > 0) cand = v.fixed; });
    e.updateTo = cand || '';
  };
  entries.forEach(calc);
  for (let round = 0; round < 3; round++) {
    const todo = entries.filter(e => e.updateTo);
    if (!todo.length) break;
    const lists = await osvBatch(todo.map(e => ({ name: e.name, version: e.updateTo, eco: e.eco })));
    const need = [];
    lists.forEach((l, i) => { if (l.length) need.push([todo[i], l]); });
    if (!need.length) break;
    const nid = new Set();
    need.forEach(p => p[1].forEach(i => { if (!vulnCache[i]) nid.add(i); }));
    await pool(Array.from(nid), 15, id => getVuln(id).catch(() => null));
    let changed = false;
    need.forEach(p => {
      const e = p[0];
      const vs = buildVulns(p[1], e.name, e.updateTo, e.eco);
      let next = null;
      vs.forEach(v => { if (v.fixed !== null && (next === null || cmpVer(v.fixed, next) > 0)) next = v.fixed; });
      if (next && cmpVer(next, e.updateTo) > 0) { e.updateTo = next; changed = true; }
      else { e.still = vs.map(v => v.id); }
    });
    if (!changed) break;
  }
  entries.forEach(e => { e.kind = updateKind(e.version, e.updateTo); });

  // EPSS + KEV
  const cveSet = new Set();
  entries.forEach(e => e.vulns.forEach(v => v.cves.forEach(c => cveSet.add(c))));
  if (opts.enrich && cveSet.size) {
    const epss = {}, kev = new Set();
    try {
      log(tr('log_epss').replace('{n}', cveSet.size));
      const list = Array.from(cveSet), chunks = [];
      for (let i = 0; i < list.length; i += 50) chunks.push(list.slice(i, i + 50));
      await pool(chunks, 4, async ch => {
        const res = await apiFetch('epss', 'https://api.first.org/data/v1/epss?cve=' + ch.join(','));
        if (!res.ok) return;
        const j = await res.json();
        (j.data || []).forEach(d => { epss[d.cve] = parseFloat(d.epss); });
      });
    } catch (e) { log(tr('log_epss_fail') + e.message); }
    try {
      log(tr('log_kev'));
      const res = await apiFetch('kev', 'https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json');
      if (res.ok) { const j = await res.json(); (j.vulnerabilities || []).forEach(x => kev.add(x.cveID)); }
    } catch (e) { log(tr('log_kev_fail') + e.message); }
    entries.forEach(e => e.vulns.forEach(v => {
      v.cves.forEach(c => {
        if (epss[c] !== undefined && (v.epss === null || epss[c] > v.epss)) v.epss = epss[c];
        if (kev.has(c)) v.kev = true;
      });
    }));
  }
  return entries;
}

// ============================================================
//  Parser file
// ============================================================
function cleanRange(v) {
  v = String(v).trim();
  if (v.indexOf('||') >= 0) v = v.split('||')[0].trim();
  v = v.replace(/^[\^~>=<\s\[\(]+/, '');
  const cut = v.search(/[\s,\)\]]/);
  if (cut >= 0) v = v.slice(0, cut);
  return v;
}
function startsWithDigit(v) { return /^\d/.test(String(v)); }

function parseNpmLock(text) {
  const j = JSON.parse(text), out = [];
  if (j.packages) {
    const root = j.packages[''] || {};
    const direct = new Set(Object.keys(Object.assign({}, root.dependencies, root.devDependencies, root.optionalDependencies)));
    Object.keys(j.packages).forEach(path => {
      const p = j.packages[path];
      if (!path || !p || !p.version || p.link || !startsWithDigit(p.version)) return;
      const idx = path.lastIndexOf('node_modules/');
      const name = p.name || path.slice(idx + 13);
      out.push({ name, version: p.version, eco: 'npm', dev: !!p.dev, direct: path === 'node_modules/' + name && direct.has(name), license: typeof p.license === 'string' ? p.license : '' });
    });
  } else if (j.dependencies) {
    const walk = (deps, top) => Object.keys(deps).forEach(name => {
      const d = deps[name];
      if (d && d.version && startsWithDigit(d.version)) out.push({ name, version: d.version, eco: 'npm', dev: !!d.dev, direct: top ? null : false });
      if (d && d.dependencies) walk(d.dependencies, false);
    });
    walk(j.dependencies, true);
  }
  return out;
}
function parseNpmPackageJson(text) {
  const j = JSON.parse(text), out = [];
  [['dependencies', false], ['devDependencies', true], ['optionalDependencies', false]].forEach(pair => {
    const d = j[pair[0]] || {};
    Object.keys(d).forEach(name => {
      const v = cleanRange(d[name]);
      if (startsWithDigit(v)) out.push({ name, version: v, eco: 'npm', dev: pair[1], direct: true });
    });
  });
  return out;
}
function parseComposerLock(text) {
  const j = JSON.parse(text), out = [];
  [['packages', false], ['packages-dev', true]].forEach(pair => (j[pair[0]] || []).forEach(p => {
    let v = String(p.version || '');
    if (v[0] === 'v') v = v.slice(1);
    if (!startsWithDigit(v)) return;
    out.push({ name: p.name, version: v, eco: 'Packagist', dev: pair[1], direct: null, license: (p.license || []).join(' OR ') });
  }));
  return out;
}
function parseNugetLock(text) {
  const j = JSON.parse(text), out = [];
  Object.keys(j.dependencies || {}).forEach(tfm => {
    const d = j.dependencies[tfm];
    Object.keys(d).forEach(name => {
      const x = d[name];
      if (x.type === 'Project' || !x.resolved) return;
      out.push({ name, version: x.resolved, eco: 'NuGet', dev: false, direct: x.type === 'Direct' });
    });
  });
  return out;
}
// obj/project.assets.json (hasil dotnet restore): memuat seluruh package transitif.
// Hanya dibaca sebagai data (JSON.parse + Object.keys); tidak ada eval/HTML mentah (OWASP ASVS 5.2.4, 1.5.1).
function parseProjectAssets(text) {
  const j = JSON.parse(text), out = [], targets = j && j.targets;
  if (!targets || typeof targets !== 'object') throw new Error(tr('err_project_assets'));
  const fws = (j.project && j.project.frameworks) || {};
  const directNames = new Set();
  let isTest = false;
  Object.keys(fws).forEach(k => {
    const deps = fws[k].dependencies || {};
    Object.keys(deps).forEach(n => {
      if (n.toLowerCase() === 'microsoft.net.test.sdk') isTest = true;
      if (!deps[n].autoReferenced) directNames.add(n.toLowerCase());
    });
  });
  const keys = Object.keys(targets), plain = keys.filter(k => k.indexOf('/') < 0);
  (plain.length ? plain : keys).forEach(tk => {
    Object.keys(targets[tk]).forEach(nv => {
      const x = targets[tk][nv], i = nv.lastIndexOf('/');
      if (!x || x.type !== 'package' || i <= 0) return;
      const name = nv.slice(0, i), ver = nv.slice(i + 1);
      if (!startsWithDigit(ver)) return;
      out.push({ name, version: ver, eco: 'NuGet', dev: isTest, direct: directNames.has(name.toLowerCase()) });
    });
  });
  return out;
}
function parseCsproj(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error(tr('err_xml_invalid'));
  const out = [];
  doc.querySelectorAll('PackageReference, PackageVersion').forEach(n => {
    const name = n.getAttribute('Include') || n.getAttribute('Update');
    let ver = n.getAttribute('Version');
    if (!ver) { const c = n.querySelector('Version'); ver = c ? c.textContent : ''; }
    ver = cleanRange(ver || '');
    if (!name || !startsWithDigit(ver) || ver.indexOf('$(') >= 0) return;
    out.push({ name, version: ver, eco: 'NuGet', dev: false, direct: true });
  });
  // packages.config (format lama)
  doc.querySelectorAll('package').forEach(n => {
    const id = n.getAttribute('id'), v = cleanRange(n.getAttribute('version') || '');
    if (id && startsWithDigit(v)) out.push({ name: id, version: v, eco: 'NuGet', dev: n.getAttribute('developmentDependency') === 'true', direct: true });
  });
  return out;
}

// ---- Ekosistem tambahan: Java (Maven/Gradle), Rust, Go, Python, Ruby, Dart, Elixir, yarn, pnpm
function unq(v) { v = String(v).trim(); return (v[0] === '"' || v[0] === "'") && v.length > 1 ? v.slice(1, -1) : v; }
function pyName(n) { return String(n).toLowerCase().split('_').join('-').split('.').join('-'); }
function eachLine(text, fn) { text.replace(/\r/g, '').split('\n').forEach(fn); }

function parsePomXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error(tr('err_xml_invalid'));
  const txt = (el, tag) => { for (const c of el.children) if (c.localName === tag) return c.textContent.trim(); return ''; };
  const props = {}, managed = {}, out = [];
  for (const c of doc.documentElement.children) {
    if (c.localName === 'properties') for (const p of c.children) props[p.localName] = p.textContent.trim();
    if (c.localName === 'version') props['project.version'] = c.textContent.trim();
    if (c.localName === 'parent') { const pv = txt(c, 'version'); if (pv) { props['parent.version'] = pv; if (!props['project.version']) props['project.version'] = pv; } }
  }
  const sub = v => { let o = v, n = 0; while (o.indexOf('${') >= 0 && n++ < 5) o = o.replace(/\$\{([^}]+)\}/g, (all, k) => (props[k] !== undefined ? props[k] : all)); return o; };
  doc.querySelectorAll('dependencyManagement > dependencies > dependency').forEach(d => { managed[sub(txt(d, 'groupId')) + ':' + sub(txt(d, 'artifactId'))] = sub(txt(d, 'version')); });
  doc.querySelectorAll('dependency').forEach(d => {
    const g = sub(txt(d, 'groupId')), a = sub(txt(d, 'artifactId')), scope = txt(d, 'scope');
    if (!g || !a || scope === 'import') return;
    const v = cleanRange(sub(txt(d, 'version')) || managed[g + ':' + a] || '');
    if (!startsWithDigit(v) || v.indexOf('${') >= 0) return;
    out.push({ name: g + ':' + a, version: v, eco: 'Maven', dev: scope === 'test', direct: true });
  });
  return out;
}
function parseGradle(text) {
  const out = [];
  eachLine(text, line => {
    const t = line.trim();
    if (!t || t.startsWith('//')) return;
    const conf = (t.split(/[\s(]/)[0] || '').toLowerCase();
    for (const m of t.matchAll(/["']([A-Za-z0-9_.\-]+):([A-Za-z0-9_.\-]+):([A-Za-z0-9_.\-+]+)["']/g)) {
      if (startsWithDigit(m[3])) out.push({ name: m[1] + ':' + m[2], version: m[3], eco: 'Maven', dev: conf.indexOf('test') >= 0, direct: true });
    }
  });
  return out;
}
function parseGradleLock(text) {
  const out = [];
  eachLine(text, line => {
    const t = line.trim(), eq = t.indexOf('=');
    if (!t || t[0] === '#' || eq < 0) return;
    const parts = t.slice(0, eq).split(':');
    if (parts.length !== 3 || !startsWithDigit(parts[2])) return;
    const confs = t.slice(eq + 1).split(',');
    out.push({ name: parts[0] + ':' + parts[1], version: parts[2], eco: 'Maven', dev: confs.every(c => c.toLowerCase().indexOf('test') >= 0), direct: null });
  });
  return out;
}
// Format "[[package]]" dipakai Cargo.lock, poetry.lock, dan uv.lock
function parseTomlPackages(text, eco, nameFn, keep) {
  const out = [];
  let cur = null;
  const flush = () => { if (cur && cur.name && cur.version && keep(cur)) out.push({ name: nameFn(cur.name), version: cur.version, eco, dev: cur.category === 'dev', direct: null }); };
  eachLine(text, line => {
    const t = line.trim();
    if (t === '[[package]]') { flush(); cur = {}; return; }
    if (!cur) return;
    if (t[0] === '[') { flush(); cur = null; return; }
    const i = t.indexOf('=');
    if (i <= 0) return;
    const k = t.slice(0, i).trim();
    if (k === 'name' || k === 'version' || k === 'source' || k === 'category') cur[k] = unq(t.slice(i + 1));
  });
  flush();
  return out;
}
function parseCargoLock(text) { return parseTomlPackages(text, 'crates.io', n => n, c => !!c.source && c.source.indexOf('registry') === 0); }
function parsePythonTomlLock(text) { return parseTomlPackages(text, 'PyPI', pyName, c => !c.source || c.source.indexOf('registry') >= 0); }
function parseCargoToml(text) {
  const out = [];
  let sect = '';
  eachLine(text, line => {
    const t = line.trim();
    if (!t || t[0] === '#') return;
    if (t[0] === '[') { sect = t.split('[').join('').split(']').join('').trim().toLowerCase(); return; }
    const dev = sect.indexOf('dev-dependencies') >= 0;
    const i = t.indexOf('=');
    if (i <= 0) return;
    const key = t.slice(0, i).trim(), val = t.slice(i + 1).trim();
    if (sect.endsWith('dependencies')) {
      let v = '';
      if (val[0] === '"') v = unq(val);
      else if (val[0] === '{') { const m = rx1(/version\s*=\s*"([^"]+)"/g, val); if (m) v = m[1]; }
      v = cleanRange(v);
      if (startsWithDigit(v)) out.push({ name: key, version: v, eco: 'crates.io', dev, direct: true });
    } else if (sect.indexOf('dependencies.') >= 0 && key === 'version') {
      const v = cleanRange(unq(val));
      if (startsWithDigit(v)) out.push({ name: sect.slice(sect.indexOf('dependencies.') + 13), version: v, eco: 'crates.io', dev, direct: true });
    }
  });
  return out;
}
function parseGoMod(text) {
  const out = [];
  let block = false;
  eachLine(text, line => {
    let t = line.trim(), spec = '';
    if (t.startsWith('require (') || t === 'require(') { block = true; return; }
    if (block && t === ')') { block = false; return; }
    if (block) spec = t; else if (t.startsWith('require ')) spec = t.slice(8).trim(); else return;
    const indirect = spec.indexOf('// indirect') >= 0;
    spec = spec.split('//')[0].trim();
    const w = spec.split(/\s+/);
    if (w.length < 2 || w[1][0] !== 'v') return;
    out.push({ name: w[0], version: w[1].slice(1), eco: 'Go', dev: false, direct: !indirect });
  });
  return out;
}
function parseRequirements(text) {
  const out = [], loose = [];
  eachLine(text, line => {
    let t = line.split(' #')[0].trim();
    if (!t || t[0] === '#' || t[0] === '-') return;
    t = t.split(';')[0].trim();
    const m = rx1(/^([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?\s*===?\s*([A-Za-z0-9_.\-+!]+)/g, t);
    if (m && startsWithDigit(m[2])) out.push({ name: pyName(m[1]), version: m[2], eco: 'PyPI', dev: false, direct: true });
    else if (rx1(/^[A-Za-z0-9_.\-]+/g, t)) loose.push(t.slice(0, 80));
  });
  out.unpinned = loose.length;
  out.skipped = loose;
  return out;
}
function parsePipfileLock(text) {
  const j = JSON.parse(text), out = [];
  [['default', false], ['develop', true]].forEach(pair => {
    const d = j[pair[0]] || {};
    Object.keys(d).forEach(name => {
      const v = String(d[name].version || '').replace(/^==/, '');
      if (startsWithDigit(v)) out.push({ name: pyName(name), version: v, eco: 'PyPI', dev: pair[1], direct: null });
    });
  });
  return out;
}
function parseGemfileLock(text) {
  const out = [];
  let specs = false;
  eachLine(text, line => {
    if (!line.trim()) { specs = false; return; }
    if (line.trim() === 'specs:') { specs = true; return; }
    if (!specs) return;
    if (line[0] !== ' ') { specs = false; return; }
    const m = rx1(/^ {4}(\S+) \(([^)]+)\)\s*$/g, line);
    if (!m) return;
    const v = m[2].split('-')[0];
    if (startsWithDigit(v)) out.push({ name: m[1], version: v, eco: 'RubyGems', dev: false, direct: null });
  });
  return out;
}
function parseYarnLock(text) {
  const out = [];
  let cur = '';
  eachLine(text, line => {
    if (!line.trim() || line[0] === '#') return;
    if (line[0] !== ' ') {
      const spec = unq(line.replace(/:\s*$/, '').split(',')[0]);
      const at = spec.lastIndexOf('@');
      cur = at > 0 && spec.indexOf('@workspace:') < 0 ? spec.slice(0, at) : '';
      return;
    }
    const m = rx1(/^\s+version:?\s+"?([^"\s]+)"?/g, line);
    if (m && cur) {
      if (startsWithDigit(m[1]) && m[1].indexOf('0.0.0-use.local') < 0) out.push({ name: cur, version: m[1], eco: 'npm', dev: false, direct: null });
      cur = '';
    }
  });
  return out;
}
function parsePnpmLock(text) {
  const out = [];
  let sect = '';
  eachLine(text, line => {
    if (line && line[0] !== ' ' && line[0] !== '#') { sect = line.trim().replace(/:$/, ''); return; }
    if (sect !== 'packages' || !line.startsWith('  ') || line[2] === ' ') return;
    let k = line.trim();
    if (!k.endsWith(':')) return;
    k = unq(k.slice(0, -1));
    if (k[0] === '/') k = k.slice(1);
    const par = k.indexOf('(');
    if (par > 0) k = k.slice(0, par);
    let name, ver;
    const at = k.lastIndexOf('@');
    if (at > 0) { name = k.slice(0, at); ver = k.slice(at + 1); }
    else { const sl = k.lastIndexOf('/'); name = k.slice(0, sl); ver = k.slice(sl + 1).split('_')[0]; }
    if (name && startsWithDigit(ver)) out.push({ name, version: ver, eco: 'npm', dev: false, direct: null });
  });
  return out;
}
function parsePubspecLock(text) {
  const out = [];
  let inPk = false, cur = null;
  const flush = () => {
    if (cur && cur.version && cur.source === 'hosted') {
      const dep = cur.dependency || '';
      out.push({ name: cur.name, version: cur.version, eco: 'Pub', dev: dep.indexOf('dev') >= 0, direct: dep ? dep.indexOf('direct') === 0 : null });
    }
    cur = null;
  };
  eachLine(text, line => {
    if (line && line[0] !== ' ') { flush(); inPk = line.trim() === 'packages:'; return; }
    if (!inPk) return;
    if (line.startsWith('  ') && line[2] !== ' ') { flush(); cur = { name: line.trim().replace(/:$/, '') }; return; }
    const i = line.indexOf(':');
    if (cur && i > 0 && line.startsWith('    ') && line[4] !== ' ') {
      const k = line.slice(0, i).trim();
      if (k === 'version' || k === 'dependency' || k === 'source') cur[k] = unq(line.slice(i + 1));
    }
  });
  flush();
  return out;
}
function parseMixLock(text) {
  const out = [];
  for (const m of text.matchAll(/"([a-z0-9_]+)":\s*\{:hex,\s*:[a-z0-9_]+,\s*"([^"]+)"/g)) {
    if (startsWithDigit(m[2])) out.push({ name: m[1], version: m[2], eco: 'Hex', dev: false, direct: null });
  }
  return out;
}
const PARSERS = {
  'npm-lock': parseNpmLock, 'npm-pkg': parseNpmPackageJson, 'yarn': parseYarnLock, 'pnpm': parsePnpmLock,
  'composer': parseComposerLock, 'nuget-lock': parseNugetLock, 'nuget-assets': parseProjectAssets, 'nuget-proj': parseCsproj,
  'maven-pom': parsePomXml, 'gradle': parseGradle, 'gradle-lock': parseGradleLock,
  'cargo-lock': parseCargoLock, 'cargo-toml': parseCargoToml, 'go-mod': parseGoMod,
  'py-req': parseRequirements, 'py-toml-lock': parsePythonTomlLock, 'pipfile-lock': parsePipfileLock,
  'ruby': parseGemfileLock, 'pubspec': parsePubspecLock, 'mix': parseMixLock
};
const TYPE_NOTES = {
  'nuget-proj': '.csproj hanya memuat PackageReference langsung; package transitif TIDAK ikut di-scan, padahal kerentanan .NET umumnya ada di transitif. Jalankan dotnet restore lalu unggah obj/project.assets.json (atau packages.lock.json) untuk hasil lengkap.',
  'npm-pkg': 'package.json hanya memuat rentang versi; yang di-scan adalah versi dasarnya. Gunakan lockfile untuk versi yang benar-benar terpasang.',
  'maven-pom': 'pom.xml hanya memuat dependency langsung; dependency transitif tidak dihitung. Versi yang tidak bisa dihitung (mis. dari BOM eksternal) dilewati.',
  'gradle': 'build.gradle hanya memuat dependency langsung yang ditulis sebagai "group:artifact:versi". Untuk dependency transitif gunakan gradle.lockfile.',
  'cargo-toml': 'Cargo.toml memuat rentang versi; yang di-scan adalah versi dasarnya. Gunakan Cargo.lock untuk versi yang terpasang.',
  'py-req': 'Hanya baris yang dipin dengan == yang bisa di-scan.'
};
Object.keys(TYPE_NOTES).forEach(k => { TYPE_NOTES[k] = L(TYPE_NOTES[k]); });

// ============================================================
//  Dockerfile
// ============================================================
const CODENAMES = { trixie: '13', bookworm: '12', bullseye: '11', buster: '10' };
const EOL_SLUG = {
  node: 'nodejs', python: 'python', php: 'php', nginx: 'nginx', redis: 'redis', postgres: 'postgresql',
  mysql: 'mysql', mariadb: 'mariadb', golang: 'go', ruby: 'ruby', alpine: 'alpine-linux', debian: 'debian',
  ubuntu: 'ubuntu', 'eclipse-temurin': 'eclipse-temurin'
};
const eolCache = {};

function parseDockerfile(text) {
  const lines = text.replace(/\r/g, '').split('\n'), raw = [];
  let buf = '', start = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!buf) { if (!t || t[0] === '#') continue; start = i + 1; }
    else if (!t || t[0] === '#') continue;
    if (t.endsWith('\\')) { buf += (buf ? ' ' : '') + t.slice(0, -1).trim(); continue; }
    buf += (buf ? ' ' : '') + t;
    raw.push({ line: start, text: buf }); buf = '';
  }
  if (buf) raw.push({ line: start, text: buf });
  return raw.map(r => {
    const sp = r.text.search(/\s/);
    return { line: r.line, cmd: (sp < 0 ? r.text : r.text.slice(0, sp)).toUpperCase(), args: sp < 0 ? '' : r.text.slice(sp + 1).trim() };
  });
}
function splitImage(ref) {
  let digest = '';
  const at = ref.indexOf('@');
  if (at >= 0) { digest = ref.slice(at + 1); ref = ref.slice(0, at); }
  const slash = ref.lastIndexOf('/');
  const colon = ref.indexOf(':', slash + 1);
  return { name: colon >= 0 ? ref.slice(0, colon) : ref, tag: colon >= 0 ? ref.slice(colon + 1) : '', digest };
}
function osEcosystem(img) {
  const short = img.name.split('/').pop();
  const t = img.tag.toLowerCase();
  let m = rx1(/alpine(\d+\.\d+)/g, t);
  if (m) return 'Alpine:v' + m[1];
  if (short === 'alpine') { m = rx1(/^(\d+\.\d+)/g, t); if (m) return 'Alpine:v' + m[1]; }
  for (const c of Object.keys(CODENAMES)) if (t.indexOf(c) >= 0) return 'Debian:' + CODENAMES[c];
  if (short === 'debian') { m = rx1(/^(\d+)/g, t); if (m) return 'Debian:' + m[1]; }
  return '';
}
function eolTargets(img) {
  const out = [], short = img.name.split('/').pop(), t = img.tag.toLowerCase();
  const ver = (rx1(/^(\d+(?:\.\d+)*)/g, t) || [])[1] || '';
  if (img.name.indexOf('dotnet/') >= 0 && ver) out.push({ slug: 'dotnet', ver, label: '.NET' });
  else if (EOL_SLUG[short] && ver) out.push({ slug: EOL_SLUG[short], ver, label: short });
  const a = rx1(/alpine(\d+\.\d+)/g, t);
  if (a) out.push({ slug: 'alpine-linux', ver: a[1], label: 'Alpine' });
  for (const c of Object.keys(CODENAMES)) if (t.indexOf(c) >= 0) out.push({ slug: 'debian', ver: CODENAMES[c], label: 'Debian ' + c });
  return out;
}
async function checkEol(target) {
  if (!eolCache[target.slug]) {
    eolCache[target.slug] = apiFetch('eol', 'https://endoflife.date/api/' + target.slug + '.json').then(r => r.ok ? r.json() : []).catch(() => []);
  }
  const cycles = await eolCache[target.slug];
  if (!cycles.length) return { status: 'unknown', note: tr('ceol_nodata') };
  const parts = target.ver.split('.');
  let hit = null;
  for (const n of [3, 2, 1]) {
    const key = parts.slice(0, n).join('.');
    hit = cycles.find(c => String(c.cycle) === key);
    if (hit) break;
  }
  if (!hit) hit = cycles.find(c => String(c.cycle).startsWith(parts[0] + '.'));
  if (!hit) return { status: 'unknown', note: tr('ceol_nocycle_a') + target.ver + tr('ceol_nocycle_b') };
  const eol = hit.eol;
  if (eol === false) return { status: 'ok', cycle: hit.cycle, latest: hit.latest, note: tr('ceol_supported') };
  const d = new Date(eol), now = new Date();
  if (d <= now) return { status: 'eol', cycle: hit.cycle, latest: hit.latest, note: tr('ceol_eol_since') + eol };
  const days = Math.round((d - now) / 86400000);
  return { status: days < 180 ? 'soon' : 'ok', cycle: hit.cycle, latest: hit.latest, note: tr('ceol_eol_in').replace('{eol}', eol).replace('{d}', days) };
}

// ============================================================
//  Cek EOL runtime & framework dari file package (endoflife.date).
//  Kategori: Insecure Deployment — Unpatched Application
//  (OWASP A06:2021 Vulnerable & Outdated Components; CWE-1104 Use of
//  Unmaintained Third Party Components). Runtime/framework yang sudah EOL
//  tidak lagi menerima patch keamanan.
// ============================================================
function cleanVer(s) { const m = rx1(/(\d+(?:\.\d+)*)/g, String(s)); return m ? m[1] : ''; }
const EOL_RANK = { eol: 3, soon: 2, unknown: 1, ok: 0, loading: 0 };
// Lisensi tiap runtime/framework (SPDX) + ringkasan hak (boleh) dan batasan.
// Ringkasan mengikuti kategori choosealicense.com (permissions/conditions/limitations).
const COMPONENT_LICENSE = {
  nodejs: 'MIT', go: 'BSD-3-Clause', dotnet: 'MIT', dotnetfx: 'Proprietary', php: 'PHP-3.01',
  angular: 'MIT', vue: 'MIT', laravel: 'MIT', symfony: 'MIT', nextjs: 'MIT', nuxt: 'MIT', django: 'BSD-3-Clause', rails: 'MIT'
};
const LICENSE_INFO = {
  'MIT': { allow: ['commercial', 'modify', 'distribute', 'private'], limit: ['keep-copyright', 'no-warranty'] },
  'Apache-2.0': { allow: ['commercial', 'modify', 'distribute', 'private', 'patent'], limit: ['keep-copyright', 'state-changes', 'no-trademark', 'no-warranty'] },
  'BSD-3-Clause': { allow: ['commercial', 'modify', 'distribute', 'private'], limit: ['keep-copyright', 'no-endorsement', 'no-warranty'] },
  'BSD-2-Clause': { allow: ['commercial', 'modify', 'distribute', 'private'], limit: ['keep-copyright', 'no-warranty'] },
  'PHP-3.01': { allow: ['commercial', 'modify', 'distribute', 'private'], limit: ['keep-copyright', 'name-restriction', 'no-warranty'] },
  'GPL-3.0': { allow: ['commercial', 'modify', 'distribute', 'private', 'patent'], limit: ['disclose-source', 'same-license', 'state-changes', 'keep-copyright', 'no-warranty'] },
  'LGPL-3.0': { allow: ['commercial', 'modify', 'distribute', 'private', 'patent'], limit: ['disclose-source', 'same-license-lib', 'state-changes', 'keep-copyright', 'no-warranty'] },
  'MPL-2.0': { allow: ['commercial', 'modify', 'distribute', 'private', 'patent'], limit: ['disclose-source-file', 'keep-copyright', 'no-trademark', 'no-warranty'] },
  'Proprietary': { allow: ['private'], limit: ['no-redistribute', 'vendor-terms', 'no-warranty'] }
};
// Framework (dari daftar package) -> slug endoflife.date.
const FRAMEWORK_MAP = {
  '@angular/core': { slug: 'angular', label: 'Angular' }, 'vue': { slug: 'vue', label: 'Vue' },
  'laravel/framework': { slug: 'laravel', label: 'Laravel' }, 'symfony/symfony': { slug: 'symfony', label: 'Symfony' },
  'next': { slug: 'nextjs', label: 'Next.js' }, 'nuxt': { slug: 'nuxt', label: 'Nuxt' },
  'django': { slug: 'django', label: 'Django' }, 'rails': { slug: 'rails', label: 'Ruby on Rails' }
};
// Versi runtime level-manifest (hilang setelah dipadatkan, jadi diambil saat impor).
function extractRuntimes(type, name, text) {
  const out = [], n = String(name).toLowerCase();
  try {
    if (type === 'npm-pkg') {
      const node = (JSON.parse(text).engines || {}).node;
      if (node) out.push({ slug: 'nodejs', ver: cleanVer(node), label: 'Node.js', from: 'engines.node' });
    }
    if (n.endsWith('.nvmrc')) { const v = cleanVer(text); if (v) out.push({ slug: 'nodejs', ver: v, label: 'Node.js', from: '.nvmrc' }); }
    if (type === 'go-mod') { const m = rx1(/^go\s+(\d+(?:\.\d+)*)/gm, text); if (m) out.push({ slug: 'go', ver: m[1], label: 'Go', from: 'go.mod' }); }
    if (type === 'composer') {
      const j = JSON.parse(text), php = (j.require && j.require.php) || (((j.config || {}).platform || {}).php);
      if (php) out.push({ slug: 'php', ver: cleanVer(php), label: 'PHP', from: 'composer: php' });
    }
    if (type === 'nuget-proj') {
      [...String(text).matchAll(/<TargetFrameworks?>([^<]+)<\/TargetFrameworks?>/gi)].forEach(mm => {
        mm[1].split(';').forEach(raw => {
          const tf = raw.trim().toLowerCase();
          if (!tf || tf.indexOf('netstandard') === 0) return;
          if (tf.indexOf('netcoreapp') === 0) out.push({ slug: 'dotnet', ver: cleanVer(tf), label: '.NET Core', from: tf });
          else if (/^net\d+\.\d+/.test(tf)) out.push({ slug: 'dotnet', ver: cleanVer(tf), label: '.NET', from: tf });
          else { const fw = rx1(/^net(\d)(\d+)$/g, tf); if (fw) out.push({ slug: 'dotnetfx', ver: fw[1] + '.' + fw[2], label: '.NET Framework', from: tf }); }
        });
      });
    }
  } catch (e) { /* manifest tidak terparse: lewati */ }
  return out.filter(x => x.ver);
}
function itemPackages(it) {
  try { return it.compact ? expandCompact(it.text) : (PARSERS[it.type] ? PARSERS[it.type](it.text) : []); }
  catch (e) { return []; }
}
function frameworksOf(it) {
  const out = [];
  itemPackages(it).forEach(p => {
    const fw = FRAMEWORK_MAP[String(p.name).toLowerCase()];
    if (fw && p.version) out.push({ slug: fw.slug, label: fw.label, ver: cleanVer(p.version), from: p.name });
  });
  return out;
}
// Jenis file yang runtime-nya hanya terbaca saat impor (hilang bila sudah dipadatkan).
const RUNTIME_TYPES = ['npm-pkg', 'go-mod', 'composer', 'nuget-proj'];
// Runtime + framework satu file; di-cache per isi agar render tabel tidak mem-parse ulang lockfile.
const DETECT_CACHE = new WeakMap();
function detectedComponents(it) {
  const hit = DETECT_CACHE.get(it);
  if (hit && hit.text === it.text && hit.runtimes === it.runtimes) return hit.list;
  const list = [...(it.runtimes || []), ...frameworksOf(it)].filter(c => c.ver);
  DETECT_CACHE.set(it, { text: it.text, runtimes: it.runtimes, list });
  return list;
}
// Versi struktur-data dari checkEol untuk tab EOL (status + data mentah, agar bisa dilokalkan).
async function eolCheck(slug, ver) {
  if (!eolCache[slug]) eolCache[slug] = apiFetch('eol', 'https://endoflife.date/api/' + slug + '.json').then(r => r.ok ? r.json() : []).catch(() => []);
  const cycles = await eolCache[slug];
  if (!cycles.length) return { status: 'unknown' };
  const parts = String(ver).split('.');
  let hit = null;
  for (const n of [3, 2, 1]) { const key = parts.slice(0, n).join('.'); hit = cycles.find(c => String(c.cycle) === key); if (hit) break; }
  if (!hit) hit = cycles.find(c => String(c.cycle).startsWith(parts[0] + '.'));
  if (!hit) return { status: 'unknown' };
  const eol = hit.eol;
  if (eol === false || eol == null) return { status: 'ok', cycle: hit.cycle, latest: hit.latest, eol: null };
  if (eol === true) return { status: 'eol', cycle: hit.cycle, latest: hit.latest, eol: true };
  const d = new Date(eol), now = new Date();
  if (d <= now) return { status: 'eol', cycle: hit.cycle, latest: hit.latest, eol: eol };
  const days = Math.round((d - now) / 86400000);
  return { status: days < 180 ? 'soon' : 'ok', cycle: hit.cycle, latest: hit.latest, eol: eol, days: days };
}

// paket yang di-install lewat RUN
function extractPackages(cmdText) {
  const found = [];
  cmdText.split(/&&|\|\||;/).forEach(seg => {
    const tk = seg.trim().split(/\s+/).filter(Boolean);
    const tool = tk[0] === 'sudo' ? tk.slice(1) : tk;
    const head = tool[0], sub = tool[1];
    let kind = '';
    if (head === 'apk' && sub === 'add') kind = 'apk';
    else if ((head === 'apt-get' || head === 'apt') && sub === 'install') kind = 'apt';
    else if (head === 'npm' && ['install', 'i', 'add'].includes(sub)) kind = 'npm';
    else if ((head === 'pip' || head === 'pip3') && sub === 'install') kind = 'pip';
    if (!kind) return;
    let skipNext = false;
    for (let i = 2; i < tool.length; i++) {
      const x = tool[i];
      if (skipNext) { skipNext = false; continue; }
      if (x === '--virtual' || x === '-r' || x === '-t' || x === '--target') { skipNext = true; continue; }
      if (x[0] === '-' || x.indexOf('$') >= 0 || x[0] === '.' || x[0] === '/') continue;
      if (kind === 'apk' || kind === 'apt') {
        const eq = x.indexOf('=');
        found.push(eq > 0 ? { kind, name: x.slice(0, eq), version: x.slice(eq + 1) } : { kind, name: x, version: '' });
      } else if (kind === 'npm') {
        const at = x.lastIndexOf('@');
        found.push(at > 0 ? { kind, name: x.slice(0, at), version: x.slice(at + 1) } : { kind, name: x, version: '' });
      } else if (kind === 'pip') {
        const m = rx1(/^([A-Za-z0-9_.\-]+)(==|>=|<=|~=|>|<)?(.*)$/g, x);
        if (m) found.push({ kind, name: m[1], version: m[2] === '==' ? m[3] : '' });
      }
    }
  });
  return found;
}

async function analyzeDocker(text, log, opts) {
  const ins = parseDockerfile(text);
  const args = {}, stages = [], findings = [];
  const add = (line, rule, severity, detail, fix) => findings.push({ line, rule: L(rule), severity, detail: L(detail), fix: L(fix || '') });
  const sub = s => s.replace(/\$\{(\w+)(?::-([^}]*))?\}|\$(\w+)/g, (all, a, def, b) => {
    const k = a || b; return args[k] !== undefined ? args[k] : (def || '');
  });
  let cur = null, hasHealth = false;

  ins.forEach(i => {
    if (i.cmd === 'ARG' && !cur) {
      const eq = i.args.indexOf('=');
      if (eq > 0) args[i.args.slice(0, eq).trim()] = i.args.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      return;
    }
    if (i.cmd === 'FROM') {
      const tk = sub(i.args).split(/\s+/).filter(x => x.indexOf('--') !== 0);
      const asIdx = tk.findIndex(x => x.toLowerCase() === 'as');
      const ref = tk[0] || '';
      const img = splitImage(ref);
      cur = { line: i.line, name: asIdx > 0 ? tk[asIdx + 1] : '', ref, img, internal: stages.some(s => s.name && s.name === ref) || ref === 'scratch', user: '', runs: [] };
      stages.push(cur);
      if (!cur.internal) {
        if (!img.tag && !img.digest) add(i.line, 'Base image tanpa tag (latest)', 'MEDIUM', Lf('{x} memakai tag latest.', { x: ref }), Lf('Pin tag versi tertentu, mis. {x}:<versi>.', { x: ref }));
        else if (img.tag === 'latest') add(i.line, 'Base image memakai :latest', 'MEDIUM', Lf('{x} tidak bisa direproduksi.', { x: ref }), 'Pin tag versi tertentu.');
      }
      return;
    }
    if (!cur) return;
    if (i.cmd === 'USER') cur.user = sub(i.args).split(':')[0].trim();
    else if (i.cmd === 'HEALTHCHECK') { if (i.args.toUpperCase().indexOf('NONE') !== 0) hasHealth = true; }
    else if (i.cmd === 'ADD') {
      const src = i.args.split(/\s+/)[0] || '';
      const remote = /^https?:\/\//.test(src), archive = /\.(tar|tgz|gz|bz2|xz|zip)$/i.test(src);
      if (!remote && !archive) add(i.line, 'ADD dipakai untuk file lokal', 'LOW', i.args, 'Gunakan COPY.');
      if (remote) add(i.line, 'ADD mengunduh URL jarak jauh', 'MEDIUM', i.args, 'Unduh dengan curl + verifikasi checksum di RUN.');
    } else if (i.cmd === 'EXPOSE') {
      if (i.args.split(/\s+/).some(p => p.split('/')[0] === '22')) add(i.line, 'Port SSH (22) di-EXPOSE', 'MEDIUM', i.args, 'Hapus EXPOSE 22; akses kontainer lewat docker exec.');
    } else if (i.cmd === 'ENV' || i.cmd === 'ARG') {
      const m = rx1(/^([A-Za-z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY)[A-Za-z0-9_]*)\s*[= ]\s*(\S+)/gi, i.args);
      if (m && m[2].indexOf('$') < 0 && m[2] !== '""' && m[2] !== "''") add(i.line, Lf('Secret di {x}', { x: i.cmd }), 'HIGH', Lf('{x} berisi nilai langsung di Dockerfile.', { x: m[1] }), 'Gunakan runtime secret / env saat run, bukan di image.');
    } else if (i.cmd === 'RUN') {
      cur.runs.push({ line: i.line, text: i.args });
      const a = i.args;
      if (/(curl|wget)[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/.test(a)) add(i.line, 'Download langsung di-pipe ke shell', 'HIGH', a.slice(0, 120), 'Unduh ke file, verifikasi checksum/GPG, baru jalankan.');
      if (/chmod\s+(-R\s+)?0?777/.test(a)) add(i.line, 'chmod 777', 'MEDIUM', a.slice(0, 120), 'Beri izin minimal yang dibutuhkan.');
      if (/(--no-check-certificate|curl\s[^|;&]*\s-k\b|--insecure)/.test(a)) add(i.line, 'Verifikasi TLS dimatikan', 'MEDIUM', a.slice(0, 120), 'Hapus opsi yang menonaktifkan verifikasi sertifikat.');
      if (/\bsudo\b/.test(a)) add(i.line, 'Penggunaan sudo di RUN', 'LOW', a.slice(0, 120), 'Build sebagai root lalu turunkan dengan USER; tidak perlu sudo.');
      if (/apt(-get)?\s+install/.test(a)) {
        if (a.indexOf('--no-install-recommends') < 0) add(i.line, 'apt-get install tanpa --no-install-recommends', 'LOW', a.slice(0, 120), 'Tambahkan --no-install-recommends.');
        if (a.indexOf('/var/lib/apt/lists') < 0) add(i.line, 'Cache apt tidak dibersihkan', 'LOW', a.slice(0, 120), 'Akhiri RUN dengan rm -rf /var/lib/apt/lists/*.');
      }
      if (/apk\s+add/.test(a) && a.indexOf('--no-cache') < 0) add(i.line, 'apk add tanpa --no-cache', 'LOW', a.slice(0, 120), 'Gunakan apk add --no-cache.');
    }
  });

  const last = stages[stages.length - 1];
  if (last && !last.internal) {
    if (!last.user || last.user === 'root' || last.user === '0') add(last.line, 'Stage akhir berjalan sebagai root (tanpa USER)', 'HIGH', 'Stage akhir tidak memiliki USER non-root.', 'Tambahkan USER non-root sebelum CMD/ENTRYPOINT.');
    if (!hasHealth) add(last.line, 'Tidak ada HEALTHCHECK', 'LOW', 'Image tidak mendefinisikan HEALTHCHECK.', 'Tambahkan HEALTHCHECK.');
  }

  // base image: EOL + paket
  const bases = [], pkgs = [], unpinned = [];
  for (const st of stages) {
    if (st.internal) continue;
    const row = { line: st.line, stage: st.name || '-', image: st.img.name, tag: st.img.tag || (st.img.digest ? '@digest' : '(latest)'), checks: [] };
    for (const t of eolTargets(st.img)) {
      log(tr('log_eol_check').replace('{x}', t.label + ' ' + t.ver));
      const r = await checkEol(t);
      row.checks.push(Object.assign({ label: t.label, ver: t.ver }, r));
      if (r.status === 'eol') add(st.line, Lf('Base image sudah EOL: {x}', { x: t.label + ' ' + t.ver }), 'HIGH', r.note, 'Naikkan ke versi yang masih didukung.');
      else if (r.status === 'soon') add(st.line, Lf('Base image segera EOL: {x}', { x: t.label + ' ' + t.ver }), 'MEDIUM', r.note, 'Rencanakan upgrade.');
    }
    bases.push(row);
    const osEco = osEcosystem(st.img);
    st.runs.forEach(run => extractPackages(run.text).forEach(p => {
      let eco = '';
      if (p.kind === 'apk' || p.kind === 'apt') eco = osEco;
      else if (p.kind === 'npm') eco = 'npm';
      else if (p.kind === 'pip') eco = 'PyPI';
      if (!p.version || !startsWithDigit(p.version)) { unpinned.push({ line: run.line, name: p.name, kind: p.kind }); return; }
      if (!eco) return;
      pkgs.push({ name: p.name, version: p.version, eco, dev: false, direct: true, origin: Lf('baris {x}', { x: run.line }) });
    }));
  }
  if (unpinned.length) {
    const byLine = {};
    unpinned.forEach(u => { (byLine[u.line] = byLine[u.line] || []).push(u.kind + ':' + u.name); });
    Object.keys(byLine).forEach(l => add(parseInt(l, 10), 'Paket tidak dipin ke versi', 'LOW', byLine[l].join(', '), 'Pin versi persis (pkg=versi / pkg@versi / pkg==versi).'));
  }
  findings.sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity] || a.line - b.line);

  const entries = pkgs.length ? await scanPackages(pkgs, log, opts) : [];
  return { bases, findings, entries, pinned: pkgs.length, unpinned: unpinned.length };
}

// ============================================================
//  Deteksi jenis file
// ============================================================
const TYPE_LABELS = {
  'npm-lock': 'npm — package-lock.json', 'npm-pkg': 'npm — package.json', 'composer': 'Composer — composer.lock',
  'nuget-lock': 'NuGet — packages.lock.json', 'nuget-assets': 'NuGet — obj/project.assets.json', 'nuget-proj': 'NuGet — .csproj / .props / packages.config',
  'yarn': 'npm — yarn.lock', 'pnpm': 'npm — pnpm-lock.yaml',
  'maven-pom': 'Java — Maven pom.xml', 'gradle': 'Java — build.gradle(.kts)', 'gradle-lock': 'Java — gradle.lockfile',
  'cargo-lock': 'Rust — Cargo.lock', 'cargo-toml': 'Rust — Cargo.toml', 'go-mod': 'Go — go.mod',
  'py-req': 'Python — requirements.txt', 'py-toml-lock': 'Python — poetry.lock / uv.lock', 'pipfile-lock': 'Python — Pipfile.lock',
  'ruby': 'Ruby — Gemfile.lock', 'pubspec': 'Dart — pubspec.lock', 'mix': 'Elixir — mix.lock',
  'docker': 'Dockerfile', 'unknown': L('(tidak dikenali)')
};
function detectType(name, text) {
  const n = String(name).toLowerCase();
  if (n.endsWith('package-lock.json') || n.endsWith('npm-shrinkwrap.json')) return 'npm-lock';
  if (n.endsWith('composer.lock')) return 'composer';
  if (n.endsWith('packages.lock.json')) return 'nuget-lock';
  if (n.endsWith('project.assets.json')) return 'nuget-assets';
  if (n.endsWith('package.json')) return 'npm-pkg';
  if (n.endsWith('yarn.lock')) return 'yarn';
  if (n.endsWith('pnpm-lock.yaml')) return 'pnpm';
  if (n.endsWith('pom.xml') || n.endsWith('.pom')) return 'maven-pom';
  if (n.endsWith('gradle.lockfile')) return 'gradle-lock';
  if (n.endsWith('build.gradle') || n.endsWith('build.gradle.kts')) return 'gradle';
  if (n.endsWith('cargo.lock')) return 'cargo-lock';
  if (n.endsWith('cargo.toml')) return 'cargo-toml';
  if (n.endsWith('go.mod')) return 'go-mod';
  if (n.endsWith('pipfile.lock')) return 'pipfile-lock';
  if (n.endsWith('poetry.lock') || n.endsWith('uv.lock')) return 'py-toml-lock';
  if (n.indexOf('requirements') >= 0 && n.endsWith('.txt')) return 'py-req';
  if (n.endsWith('gemfile.lock')) return 'ruby';
  if (n.endsWith('pubspec.lock')) return 'pubspec';
  if (n.endsWith('mix.lock')) return 'mix';
  if (n.endsWith('packages.config')) return 'nuget-proj';
  if (n.endsWith('.csproj') || n.endsWith('.fsproj') || n.endsWith('.vbproj') || n.endsWith('.props')) return 'nuget-proj';
  if (n.indexOf('dockerfile') >= 0 || n.endsWith('.dockerfile')) return 'docker';
  const t = text.trim();
  if (t[0] === '{') {
    try {
      const j = JSON.parse(t);
      if (j.lockfileVersion !== undefined) return 'npm-lock';
      if (j['content-hash'] !== undefined || Array.isArray(j.packages)) return 'composer';
      if (j.version === 1 && j.dependencies) return 'nuget-lock';
      if (j.version === 3 && j.targets && j.libraries) return 'nuget-assets';
      if (j._meta && (j.default || j.develop)) return 'pipfile-lock';
      if (j.dependencies || j.devDependencies) return 'npm-pkg';
    } catch (e) { /* bukan JSON */ }
  }
  if (t[0] === '<' && t.indexOf('PackageReference') >= 0) return 'nuget-proj';
  if (t[0] === '<' && t.indexOf('<dependency>') >= 0 && t.indexOf('<artifactId>') >= 0) return 'maven-pom';
  if (t.indexOf('# yarn lockfile') >= 0 || t.indexOf('__metadata:') >= 0) return 'yarn';
  if (/^lockfileVersion:/m.test(t) && t.indexOf('packages:') >= 0) return 'pnpm';
  if (/^module\s+\S+/m.test(t) && /^go\s+\d/m.test(t)) return 'go-mod';
  if (t.indexOf('[[package]]') >= 0) return /^checksum\s*=/m.test(t) || t.indexOf('registry+https://github.com/rust-lang') >= 0 ? 'cargo-lock' : 'py-toml-lock';
  if (/^GEM\s*$/m.test(t) && t.indexOf('specs:') >= 0) return 'ruby';
  if (/^packages:\s*$/m.test(t) && t.indexOf('sdks:') >= 0) return 'pubspec';
  if (t.indexOf(':hex,') >= 0) return 'mix';
  if (/^\s*FROM\s/im.test(t)) return 'docker';
  return 'unknown';
}

// ============================================================
//  Drag folder: ambil hanya file dependency yang dikenali, lewati folder berat
//  (node_modules, .git, dll.) supaya tidak perlu cari/pilih file manual.
// ============================================================
// Folder yang tidak perlu ditelusuri (hasil build / dependency terpasang / VCS).
const IGNORE_DIRS = new Set(['node_modules', 'bower_components', 'vendor', '.git', '.svn', '.hg',
  '.idea', '.vscode', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt', '__pycache__',
  '.venv', 'venv', 'env', '.gradle', '.terraform', '.cache', 'tmp']);
// File penting = yang dikenali detectType dari NAMANYA saja (tanpa perlu baca isi).
function isImportantByName(name) { return detectType(String(name).split('/').pop(), '') !== 'unknown'; }
// Baca satu FileSystemFileEntry menjadi File (null bila gagal).
function entryToFile(entry) { return new Promise(res => entry.file(f => res(f), () => res(null))); }
// Telusuri entry drag (file/folder) secara rekursif; panggil onFile untuk tiap file.
async function walkEntry(entry, onFile, depth) {
  if (!entry || depth > 12) return;
  if (entry.isFile) { const f = await entryToFile(entry); if (f) onFile(f); return; }
  if (!entry.isDirectory || IGNORE_DIRS.has(entry.name.toLowerCase())) return;
  const reader = entry.createReader();
  const readBatch = () => new Promise(res => reader.readEntries(res, () => res([])));
  let batch;
  // readEntries wajib dipanggil berulang sampai mengembalikan array kosong.
  while ((batch = await readBatch()).length) {
    for (const e of batch) await walkEntry(e, onFile, depth + 1);
  }
}

// ============================================================
//  Laporan HTML
// ============================================================
// Penjelasan yang muncul saat kursor diarahkan ke judul kolom / kartu / label tingkat di laporan
const TIPS = {
  id: {
  'No': 'Nomor urut. Pada tabel SCA, satu baris = satu package yang perlu diperbarui.',
  'Package': 'Nama package beserta ekosistemnya (npm, Maven, PyPI, crates.io, Go, dll.).',
  'Terpasang → Update ke': 'Versi yang terpasang sekarang → versi aman minimal. Versi aman dihitung dari data OSV lalu dicek ulang ke OSV. Baris merah berarti belum ada versi yang aman.',
  'Jenis': 'Seberapa besar lompatan versinya. patch (x.y.Z): perbaikan kecil, biasanya aman. minor (x.Y.0): fitur baru yang masih kompatibel. major (X.0.0): bisa mengubah perilaku, uji dulu sebelum update.',
  'Tingkat': 'Keparahan tertinggi di antara semua advisory package ini, berdasarkan skor CVSS: Kritis 9.0-10, Tinggi 7.0-8.9, Sedang 4.0-6.9, Rendah 0.1-3.9.',
  'CVE': 'Common Vulnerabilities and Exposures: nomor ID publik standar untuk satu kerentanan (format CVE-tahun-nomor). Klik untuk membaca detailnya di NVD.',
  'CWE': 'Common Weakness Enumeration: jenis kelemahan yang menjadi penyebab, mis. CWE-79 = XSS, CWE-1321 = prototype pollution, CWE-400 = konsumsi sumber daya berlebih. Klik untuk definisinya.',
  'Advisory': 'Laporan kerentanan dari database keamanan (GHSA = GitHub Security Advisory, dll.) berisi ringkasan dan versi perbaikan. Klik jumlahnya untuk melihat daftar.',
  'EPSS': 'Exploit Prediction Scoring System (FIRST.org): perkiraan peluang kerentanan ini dieksploitasi dalam 30 hari ke depan. Nilai tertinggi dari semua CVE package ini. Di atas 10% sebaiknya didahulukan.',
  'KEV': 'CISA Known Exploited Vulnerabilities: YA berarti kerentanan ini sudah terbukti dieksploitasi penyerang di dunia nyata. Prioritaskan perbaikannya.',
  'Tipe': 'prod = dipakai di aplikasi yang berjalan, dev = hanya untuk development/test. Langsung = dependency yang Anda tulis sendiri, transitif = ikut terbawa package lain.',
  'Baris': 'Nomor baris di file sumber (Dockerfile).',
  'Stage': 'Nama stage pada multi-stage build (FROM ... AS nama). Tanda - berarti stage tanpa nama.',
  'Image': 'Nama base image yang dipakai pada instruksi FROM.',
  'Tag': 'Versi/varian image. Tag latest atau tanpa tag berubah-ubah dan tidak bisa direproduksi.',
  'Status dukungan (endoflife.date)': 'Apakah versi ini masih mendapat patch keamanan. EOL (End Of Life) = sudah tidak di-maintain vendor, naikkan versinya.',
  'Aturan': 'Aturan keamanan/praktik terbaik Dockerfile yang dilanggar.',
  'Detail': 'Potongan nilai/kode yang memicu temuan.',
  'Saran': 'Langkah perbaikan yang disarankan.',
  'Header': 'Nama HTTP header respons yang diperiksa.',
  'Temuan': 'Masalah yang ditemukan pada header tersebut.',
  'Kelompok': 'Jenis pemeriksaan yang memakai API ini (SCA, Dockerfile, DAST pasif, dst.).',
  'API': 'Layanan publik yang dipanggil dari browser Anda.',
  'Endpoint': 'Alamat API yang dipanggil.',
  'Tujuan': 'Untuk apa API ini dipakai.',
  'Data yang dikirim': 'Data yang keluar dari browser Anda ke layanan ini. Isi file tidak dikirim, hanya data pada kolom ini.',
  'Panggilan': 'Jumlah request pada sesi ini (berhasil / gagal).',
  'package di-scan': 'Jumlah package unik (nama + versi) yang diperiksa.',
  'package rentan': 'Package yang punya minimal satu advisory.',
  'advisory unik': 'Jumlah laporan kerentanan berbeda (duplikat antar-package dihitung sekali).',
  'Kritis': 'CVSS 9.0-10.0. Bisa dieksploitasi dengan dampak sangat besar; perbaiki segera.',
  'Tinggi': 'CVSS 7.0-8.9. Dampak besar; jadwalkan perbaikan cepat.',
  'Sedang': 'CVSS 4.0-6.9. Perlu syarat tertentu agar bisa dieksploitasi.',
  'Rendah': 'CVSS 0.1-3.9. Dampak kecil atau sulit dieksploitasi.',
  'di CISA KEV': 'Jumlah advisory yang CVE-nya masuk daftar CISA KEV (sudah dieksploitasi di dunia nyata).',
  'tanpa versi aman': 'Package yang belum punya versi perbaikan. Pantau rilis upstream, ganti package, atau catat sebagai accepted risk.',
  'nilai Observatory': 'Nilai A+ sampai F dari MDN HTTP Observatory berdasarkan kelengkapan header keamanan situs.',
  'tes Observatory lulus': 'Jumlah tes header keamanan Observatory yang lulus dari total tes.',
  'Keyakinan': 'Tingkat keyakinan deteksi: valid = struktur/penanda cocok persis, kemungkinan = cocok sebagian, tebakan = hanya dari panjang/entropi.',
  'Entropi': 'Entropi Shannon (0-8 bit per byte). Teks biasa ~4-5; data terkompresi/terenkripsi/acak mendekati 8 (untuk data pendek maksimum log2(panjang)).',
  'Panjang': 'Jumlah byte hasil langkah ini. Kelipatan 16 sering menandakan blok AES (CBC/ECB).'
  },
  en: {
  'No': 'Row number. In the SCA table, one row = one package that needs updating.',
  'Package': 'Package name with its ecosystem (npm, Maven, PyPI, crates.io, Go, etc.).',
  'Installed → Update to': 'Currently installed version → minimum safe version. The safe version is computed from OSV data then re-checked against OSV. A red row means no clean version exists yet.',
  'Bump': 'How big the version jump is. patch (x.y.Z): small fix, usually safe. minor (x.Y.0): new but compatible features. major (X.0.0): may change behavior, test before updating.',
  'Severity': 'Highest severity among all advisories for this package, by CVSS score: Critical 9.0-10, High 7.0-8.9, Medium 4.0-6.9, Low 0.1-3.9.',
  'CVE': 'Common Vulnerabilities and Exposures: standard public ID for a single vulnerability (CVE-year-number). Click to read details on NVD.',
  'CWE': 'Common Weakness Enumeration: the underlying weakness type, e.g. CWE-79 = XSS, CWE-1321 = prototype pollution, CWE-400 = uncontrolled resource consumption. Click for the definition.',
  'Advisory': 'A vulnerability report from a security database (GHSA = GitHub Security Advisory, etc.) with a summary and fixed version. Click the count to see the list.',
  'EPSS': 'Exploit Prediction Scoring System (FIRST.org): estimated probability this vulnerability is exploited in the next 30 days. The highest across all CVEs of this package. Above 10% should be prioritized.',
  'KEV': 'CISA Known Exploited Vulnerabilities: YES means this vulnerability is proven exploited by attackers in the wild. Prioritize fixing it.',
  'Scope': 'prod = used in the running app, dev = only for development/test. Direct = a dependency you declared yourself, transitive = pulled in by another package.',
  'Line': 'Line number in the source file (Dockerfile).',
  'Stage': 'Multi-stage build name (FROM ... AS name). A - means an unnamed stage.',
  'Image': 'Base image name used in the FROM instruction.',
  'Tag': 'Image version/variant. The latest tag or no tag is mutable and not reproducible.',
  'Support status (endoflife.date)': 'Whether this version still gets security patches. EOL (End Of Life) = no longer maintained by the vendor, bump the version.',
  'Rule': 'The Dockerfile security/best-practice rule that was violated.',
  'Detail': 'The value/code snippet that triggered the finding.',
  'Suggestion': 'The recommended remediation step.',
  'Header': 'Name of the response HTTP header checked.',
  'Finding': 'The problem found on that header.',
  'Group': 'The kind of check that uses this API (SCA, Dockerfile, passive DAST, etc.).',
  'API': 'The public service called from your browser.',
  'Endpoint': 'The API address called.',
  'Purpose': 'What this API is used for.',
  'Data sent': 'Data leaving your browser to this service. File contents are not sent, only the data in this column.',
  'Calls': 'Number of requests this session (success / failure).',
  'packages scanned': 'Number of unique packages (name + version) checked.',
  'vulnerable packages': 'Packages with at least one advisory.',
  'unique advisories': 'Number of distinct vulnerability reports (duplicates across packages counted once).',
  'Critical': 'CVSS 9.0-10.0. Exploitable with very high impact; fix immediately.',
  'High': 'CVSS 7.0-8.9. High impact; schedule a quick fix.',
  'Medium': 'CVSS 4.0-6.9. Needs certain conditions to be exploited.',
  'Low': 'CVSS 0.1-3.9. Small impact or hard to exploit.',
  'in CISA KEV': 'Number of advisories whose CVE is on the CISA KEV list (already exploited in the wild).',
  'no safe version': 'Packages with no fixed version yet. Watch upstream releases, replace the package, or record as accepted risk.',
  'Observatory grade': 'A+ to F grade from MDN HTTP Observatory based on how complete the site security headers are.',
  'Observatory tests passed': 'Number of Observatory security-header tests passed out of the total.',
  'Confidence': 'Detection confidence: valid = structure/marker matches exactly, likely = partial match, guess = based on length/entropy only.',
  'Entropy': 'Shannon entropy (0-8 bits per byte). Plain text ~4-5; compressed/encrypted/random data approaches 8 (short data maxes at log2(length)).',
  'Length': 'Number of bytes produced by this step. Multiples of 16 often indicate AES blocks (CBC/ECB).'
  }
};
function tipify(html) {
  const attr = t => esc(t), T = tips();
  return html
    .replace(/<th>([^<]*)<\/th>/g, (all, label) => (T[label] ? '<th data-tip="' + attr(T[label]) + '">' + label + '</th>' : all))
    .replace(/(<div class="card[^"]*"[^>]*)>(<b[^>]*>[^<]*<\/b><span>)([^<]+)(<\/span>)/g, (all, a, b, label, c) => {
      const key = label.replace(/\s*\(\d+\/100\)\s*$/, '');
      return T[key] ? a + ' data-tip="' + attr(T[key]) + '">' + b + label + c : all;
    });
}
function hint() { return '<div class="cap">' + tr('rep_hint') + '</div>'; }

const REPORT_CSS = `
  body{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#1e1713;background:linear-gradient(180deg,#faf6f1 0%,#f5efe8 100%)}
  h1{margin:0 0 4px;font-size:24px;color:#18120e} h2{margin:32px 0 6px;font-size:19px;border-bottom:2px solid #9a5225;padding-bottom:4px;color:#2a1d15}
  h3{margin:20px 0 6px;font-size:15px}
  .sub{color:#6b5748;font-size:13px;margin-bottom:14px}
  .cards{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
  .card{border:1px solid #d9cbbd;border-radius:10px;padding:10px 16px;background:linear-gradient(165deg,#ffffff 0%,#fbf6f0 100%);min-width:110px;box-shadow:0 2px 8px rgba(42,26,14,.06)}
  .card b{display:block;font-size:22px} .card span{font-size:12px;color:#6b5748}
  .card.c{border-color:#7f1d1d;background:#fef2f2} .card.h{border-color:#dc2626;background:#fef2f2}
  .card.m{border-color:#d97706;background:#fffbeb} .card.l{border-color:#b8652c;background:#fdf4ec}
  .cap{font-size:13px;color:#524136;margin:6px 0}
  table{border-collapse:collapse;width:100%;font-size:13px;background:#fff}
  th{background:linear-gradient(135deg,#6e3b1c 0%,#4e2a14 100%);color:#fbf6f0;text-align:left;padding:7px 8px;border:1px solid #462511}
  td{border:1px solid #ddd0c3;padding:6px 8px;vertical-align:top}
  tr:nth-child(even) td{background:#f7f1ea}
  tr.nofix td{background:#fee2e2}
  .b{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:700;color:#fff}
  .CRITICAL{background:#7f1d1d}.HIGH{background:#dc2626}.MEDIUM{background:#d97706}.LOW{background:#a65521}.UNKNOWN{background:#786557}
  .okb{background:#16a34a}.eolb{background:#dc2626}.soonb{background:#d97706}
  .b.lic-strong{background:#dc2626}.b.lic-weak{background:#d97706}.b.lic-unknown{background:#786557}.b.lic-permissive{background:#16a34a}
  .card.lic-strong{border-color:#dc2626;background:#fef2f2}.card.lic-weak{border-color:#d97706;background:#fffbeb}.card.lic-permissive{border-color:#16a34a;background:#f0fdf4}
  .mono{font-family:Consolas,monospace;font-size:12px}
  .nums{white-space:nowrap}
  details summary{cursor:pointer;color:#9a5225}
  pre{background:#181310;color:#f3ece4;border:1px solid #382a21;padding:12px;border-radius:8px;overflow:auto;font-size:12px}
  .note{background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:8px 12px;font-size:13px;margin:10px 0}
  a{color:#9a5225}
  th[data-tip]{position:relative;cursor:help;text-decoration:underline dotted rgba(255,255,255,.65);text-underline-offset:3px}
  th[data-tip]:hover::after,.card[data-tip]:hover::after,.b[data-tip]:hover::after{content:attr(data-tip);position:absolute;left:0;top:100%;z-index:20;width:300px;max-width:80vw;white-space:normal;text-align:left;text-decoration:none;font-family:Segoe UI,Arial,sans-serif;font-weight:400;font-size:12px;line-height:1.5;color:#f3ece4;background:#181310;border:1px solid #423227;padding:8px 11px;border-radius:8px;box-shadow:0 8px 22px rgba(18,12,8,.42);margin-top:4px}
  th[data-tip]:nth-last-child(-n+3):hover::after{left:auto;right:0}
  .card[data-tip],.b[data-tip]{position:relative;cursor:help}
  thead th{position:relative;cursor:pointer;user-select:none}
  thead th[data-sort-dir]::after{content:attr(data-sort-dir);margin-left:5px;font-size:10px}
  thead th.rz-hover{cursor:col-resize!important}
  tbody tr:hover td{filter:brightness(.97)}
`;
const REPORT_TABLE_JS = '<scr' + 'ipt>(function(){const SEV={KRITIS:4,CRITICAL:4,TINGGI:3,HIGH:3,SEDANG:2,MEDIUM:2,RENDAH:1,LOW:1};const val=(tr,i)=>{const td=tr.children[i];if(!td)return"";const s=(td.innerText||td.textContent||"").trim(),u=s.toUpperCase();if(SEV[u])return SEV[u];const m=s.match(/^[-+]?\\d+(?:[.,]\\d+)?(?=\\s*(?:%|ms|KB|MB|×|$))/i);return m?parseFloat(m[0].replace(",",".")):s.toLowerCase()};document.addEventListener("pointermove",e=>{const th=e.target.closest&&e.target.closest("thead th");if(!th)return;const r=th.getBoundingClientRect();th.classList.toggle("rz-hover",r.right-e.clientX<=7)});document.addEventListener("pointerdown",e=>{const th=e.target.closest&&e.target.closest("thead th");if(!th)return;const r=th.getBoundingClientRect();if(r.right-e.clientX>7)return;e.preventDefault();const x0=e.clientX,w0=r.width;const mv=ev=>{const w=Math.max(44,Math.round(w0+ev.clientX-x0));th.style.width=th.style.minWidth=th.style.maxWidth=w+"px"};const up=()=>{window.removeEventListener("pointermove",mv);window.removeEventListener("pointerup",up);th._rz=Date.now()};window.addEventListener("pointermove",mv);window.addEventListener("pointerup",up)});document.addEventListener("click",e=>{const th=e.target.closest&&e.target.closest("thead th");if(!th||(th._rz&&Date.now()-th._rz<250))return;const tr0=th.parentElement,tb=th.closest("table")&&th.closest("table").tBodies[0];if(!tb)return;const idx=[].indexOf.call(tr0.children,th),asc=th.getAttribute("data-sort-dir")!=="▲";[].forEach.call(tr0.children,h=>h.removeAttribute("data-sort-dir"));th.setAttribute("data-sort-dir",asc?"▲":"▼");const rows=[].slice.call(tb.rows);rows.sort((a,b)=>{const va=val(a,idx),vb=val(b,idx);const c=typeof va==="number"&&typeof vb==="number"?va-vb:String(va).localeCompare(String(vb),undefined,{numeric:true,sensitivity:"base"});return asc?c:-c});rows.forEach(r=>tb.appendChild(r))})})();</scr' + 'ipt>';
function sevL(sev) { return (SEV_LABEL[LANG] || SEV_LABEL.id)[sev] || sev; }
function tips() { return TIPS[LANG] || TIPS.id; }
function badge(sev) { const lbl = sevL(sev), tip = tips()[lbl]; return '<span class="b ' + sev + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + esc(lbl) + '</span>'; }
function advLink(id, url) {
  const u = url || (id.startsWith('CVE-') ? 'https://nvd.nist.gov/vuln/detail/' + id : 'https://osv.dev/vulnerability/' + id);
  return '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(id) + '</a>';
}
function groupByName(entries) {
  const g = new Map();
  entries.forEach(e => { const k = e.eco + '|' + e.name; if (!g.has(k)) g.set(k, { eco: e.eco, name: e.name, items: [] }); g.get(k).items.push(e); });
  return Array.from(g.values());
}
function countAdvisories(entries) {
  const seen = new Set(), c = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
  let kev = 0;
  entries.forEach(e => e.vulns.forEach(v => {
    if (seen.has(v.id)) return; seen.add(v.id);
    c[v.severity]++; if (v.kev) kev++;
  }));
  return { c, total: seen.size, kev };
}
function fixCommand(g, e) {
  const eco = g.eco, to = e.updateTo;
  if (eco === 'npm') return e.direct === false ? 'overrides: "' + g.name + '": "' + to + '"' : 'npm install ' + (e.dev ? '-D ' : '') + g.name + '@' + to;
  if (eco === 'Packagist') return 'composer require ' + (e.dev ? '--dev ' : '') + g.name + ':' + to;
  if (eco === 'NuGet') return 'dotnet add package ' + g.name + ' --version ' + to;
  if (eco.startsWith('Alpine')) return 'apk add --no-cache ' + g.name + '=' + to;
  if (eco.startsWith('Debian')) return 'apt-get install -y --no-install-recommends ' + g.name + '=' + to;
  if (eco === 'PyPI') return 'pip install ' + g.name + '==' + to;
  if (eco === 'Maven') return 'Maven/Gradle: ubah versi ' + g.name + ' menjadi ' + to;
  if (eco === 'crates.io') return 'cargo update -p ' + g.name + ' --precise ' + to;
  if (eco === 'Go') return 'go get ' + g.name + '@v' + to;
  if (eco === 'RubyGems') return 'bundle update ' + g.name + '   # target minimal ' + to;
  if (eco === 'Pub') return 'dart pub add ' + g.name + ':^' + to;
  if (eco === 'Hex') return 'mix deps.update ' + g.name + '   # target minimal ' + to;
  return '';
}
function renderVulnTable(entries, label) {
  const vulnerable = entries.filter(e => e.vulns.length);
  const groups = groupByName(vulnerable).map(g => {
    g.items.sort((a, b) => cmpVer(a.version, b.version));
    g.sev = maxSev(g.items.map(i => maxSev(i.vulns.map(v => v.severity))));
    g.nofix = g.items.some(i => !i.updateTo);
    g.kev = g.items.some(i => i.vulns.some(v => v.kev));
    return g;
  }).sort((a, b) => SEV_ORDER[b.sev] - SEV_ORDER[a.sev] || (b.kev - a.kev) || a.name.localeCompare(b.name));
  if (!groups.length) return '<p class="cap">' + tr('rep_no_vuln') + esc(label) + '.</p>';

  let html = '<table><thead><tr>' + ['rep_th_no', 'rep_th_package', 'rep_th_installed', 'rep_th_bump', 'rep_th_sev', 'rep_th_cve', 'rep_th_cwe', 'rep_th_adv', 'rep_th_epss', 'rep_th_kev', 'rep_th_scope'].map(k => '<th>' + tr(k) + '</th>').join('') + '</tr></thead><tbody>';
  const listCell = (arr, mk) => !arr.length ? '-' : arr.length <= 3 ? arr.map(x => '<div>' + mk(x) + '</div>').join('') : '<details><summary>' + arr.length + ' item</summary>' + arr.map(x => '<div>' + mk(x) + '</div>').join('') + '</details>';
  const cveLink = c => '<a class="mono" href="https://nvd.nist.gov/vuln/detail/' + esc(c) + '" target="_blank" rel="noopener noreferrer">' + esc(c) + '</a>';
  const cweLink = c => '<a class="mono" href="https://cwe.mitre.org/data/definitions/' + esc(String(c).replace('CWE-', '')) + '.html" target="_blank" rel="noopener noreferrer">' + esc(c) + '</a>';
  groups.forEach((g, idx) => {
    const verCol = g.items.map(i => '<div class="mono nums">' + esc(i.version) + ' → ' + (i.updateTo ? '<b>' + esc(i.updateTo) + '</b>' : '<b style="color:#b91c1c">' + tr('rep_no_safe') + '</b>') + (i.partial && i.updateTo ? ' <span title="' + tr('rep_partial_tip') + '">⚠</span>' : '') + '</div>').join('');
    const kindCol = g.items.map(i => '<div>' + esc(i.kind || '-') + '</div>').join('');
    const seenAdv = new Set();
    let advList = '', advN = 0, maxEpss = null;
    g.items.forEach(i => i.vulns.forEach(v => {
      if (seenAdv.has(v.id)) return; seenAdv.add(v.id); advN++;
      if (v.epss !== null && (maxEpss === null || v.epss > maxEpss)) maxEpss = v.epss;
      advList += '<div style="margin:3px 0">' + badge(v.severity) + ' ' + advLink(v.id, v.url) + (v.cves.length && v.cves[0] !== v.id ? ' (' + esc(v.cves.join(', ')) + ')' : '') +
        ' — ' + esc(String(v.summary).slice(0, 140)) + (v.cwes.length ? ' <span class="mono">[' + esc(v.cwes.join(', ')) + ']</span>' : '') +
        (v.fixed ? ' <span class="mono">fix ' + esc(v.fixed) + '</span>' : ' <span class="mono" style="color:#b91c1c">no fix</span>') + '</div>';
    }));
    const tipe = g.items.map(i => '<div>' + (i.dev ? 'dev' : 'prod') + (i.direct === true ? tr('rep_direct') : i.direct === false ? tr('rep_transitive') : '') + '</div>').join('');
    const still = g.items.filter(i => i.still.length).map(i => '<div class="mono" style="color:#b91c1c">' + esc(i.updateTo) + tr('rep_still') + esc(i.still.join(', ')) + '</div>').join('');
    const cveAll = [], cweAll = [];
    g.items.forEach(i => i.vulns.forEach(v => { v.cves.forEach(c => { if (cveAll.indexOf(c) < 0) cveAll.push(c); }); v.cwes.forEach(c => { if (cweAll.indexOf(c) < 0) cweAll.push(c); }); }));
    cweAll.sort((a, b) => parseInt(String(a).replace(/\D/g, ''), 10) - parseInt(String(b).replace(/\D/g, ''), 10));
    html += '<tr class="' + (g.nofix ? 'nofix' : '') + '"><td>' + (idx + 1) + '</td><td><b>' + esc(g.name) + '</b><div class="mono">' + esc(g.eco) + '</div></td><td>' + verCol + still + '</td><td>' + kindCol + '</td><td>' + badge(g.sev) + '</td>' +
      '<td>' + listCell(cveAll, cveLink) + '</td><td>' + listCell(cweAll, cweLink) + '</td>' +
      '<td><details><summary>' + advN + tr('rep_advN') + '</summary>' + advList + '</details></td><td>' + (maxEpss === null ? '-' : (maxEpss * 100).toFixed(1) + '%') + '</td><td>' + (g.kev ? '<b style="color:#b91c1c">' + tr('rep_yes') + '</b>' : '-') + '</td><td>' + tipe + '</td></tr>';
  });
  html += '</tbody></table>';
  if (groups.some(g => g.nofix)) html += '<div class="note">' + tr('rep_nofix_note') + '</div>';

  const cmds = [];
  groups.forEach(g => g.items.forEach(i => { if (i.updateTo) { const c = fixCommand(g, i); if (c && cmds.indexOf(c) < 0) cmds.push(c); } }));
  if (cmds.length) html += '<h3>' + tr('rep_fix_cmds') + '</h3><pre>' + esc(cmds.join('\n')) + '</pre>';
  if (groups.some(g => g.eco.startsWith('Alpine') || g.eco.startsWith('Debian'))) html += '<div class="note">' + tr('rep_os_note') + '</div>';
  return html;
}
function cards(entries) {
  const a = countAdvisories(entries);
  const vulnPk = groupByName(entries.filter(e => e.vulns.length)).length;
  const nofix = groupByName(entries.filter(e => e.vulns.length && !e.updateTo)).length;
  return '<div class="cards">' +
    '<div class="card"><b>' + entries.length + '</b><span>' + tr('rep_c_scanned') + '</span></div>' +
    '<div class="card"><b>' + vulnPk + '</b><span>' + tr('rep_c_vuln') + '</span></div>' +
    '<div class="card"><b>' + a.total + '</b><span>' + tr('rep_c_adv') + '</span></div>' +
    '<div class="card c"><b>' + a.c.CRITICAL + '</b><span>' + sevL('CRITICAL') + '</span></div>' +
    '<div class="card h"><b>' + a.c.HIGH + '</b><span>' + sevL('HIGH') + '</span></div>' +
    '<div class="card m"><b>' + a.c.MEDIUM + '</b><span>' + sevL('MEDIUM') + '</span></div>' +
    '<div class="card l"><b>' + a.c.LOW + '</b><span>' + sevL('LOW') + '</span></div>' +
    '<div class="card"><b>' + a.kev + '</b><span>' + tr('rep_c_kev') + '</span></div>' +
    '<div class="card"><b>' + nofix + '</b><span>' + tr('rep_c_nofix') + '</span></div></div>';
}
function csvEscape(s) { s = String(s == null ? '' : s); return '"' + s.replace(/"/g, '""') + '"'; }
function buildCsv(results) {
  const rows = [['file', 'package', 'ekosistem', 'terpasang', 'update_ke', 'jenis_update', 'severity', 'advisory', 'cve', 'epss_max', 'kev', 'dev', 'langsung'].map(L)];
  results.forEach(r => (r.entries || []).concat(r.docker ? r.docker.entries : []).forEach(e => {
    if (!e.vulns.length) return;
    const ep = e.vulns.reduce((m, v) => (v.epss !== null && v.epss > m ? v.epss : m), 0);
    rows.push([r.name, e.name, e.eco, e.version, e.updateTo || L('BELUM ADA'), e.kind, maxSev(e.vulns.map(v => v.severity)),
      e.vulns.map(v => v.id).join(' '), e.vulns.map(v => v.cves.join(' ')).join(' ').trim(), ep ? (ep * 100).toFixed(2) + '%' : '',
      e.vulns.some(v => v.kev) ? L('ya') : '', e.dev ? 'dev' : 'prod', e.direct === true ? L('langsung') : e.direct === false ? L('transitif') : '']);
  }));
  return '\ufeff' + rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
}
function renderDocker(r, multi) {
  const d = r.docker;
  let html = '<h3>' + tr('rep_base_image') + '</h3>';
  if (!d.bases.length) html += '<p class="cap">' + tr('rep_no_from') + '</p>';
  else {
    html += '<table><thead><tr>' + ['rep_th_line', 'rep_th_stage', 'rep_th_image', 'rep_th_tag', 'rep_th_support'].map(k => '<th>' + tr(k) + '</th>').join('') + '</tr></thead><tbody>';
    d.bases.forEach(b => {
      const chk = b.checks.length ? b.checks.map(c => '<div><span class="b ' + (c.status === 'eol' ? 'eolb' : c.status === 'soon' ? 'soonb' : c.status === 'ok' ? 'okb' : 'UNKNOWN') + '">' + esc(c.label + ' ' + c.ver) + '</span> ' + esc(c.note) + '</div>').join('') : '<span class="cap">' + tr('rep_unknown_prod') + '</span>';
      html += '<tr><td>' + b.line + '</td><td>' + esc(b.stage) + '</td><td class="mono">' + esc(b.image) + '</td><td class="mono">' + esc(b.tag) + '</td><td>' + chk + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  html += '<h3>' + tr('rep_docker_findings') + '</h3>';
  if (!d.findings.length) html += '<p class="cap">' + tr('rep_no_findings') + '</p>';
  else {
    html += '<table><thead><tr>' + ['rep_th_no', 'rep_th_line', 'rep_th_sev', 'rep_th_rule', 'rep_th_detail', 'rep_th_suggestion'].map(k => '<th>' + tr(k) + '</th>').join('') + '</tr></thead><tbody>';
    d.findings.forEach((f, i) => { html += '<tr><td>' + (i + 1) + '</td><td>' + f.line + '</td><td>' + badge(f.severity) + '</td><td>' + esc(f.rule) + '</td><td class="mono">' + esc(f.detail) + '</td><td>' + esc(f.fix) + '</td></tr>'; });
    html += '</tbody></table>';
  }
  html += '<h3>' + tr('rep_pinned_pre') + d.pinned + tr('rep_pinned_post') + '</h3>';
  html += d.entries.length ? (multi ? cards(d.entries) : '') + renderVulnTable(d.entries, tr('rep_pinned_pkg')) : '<p class="cap">' + tr('rep_no_pinned') + '</p>';
  html += '<div class="note">' + tr('rep_docker_limit') + '</div>';
  return html;
}
// ============================================================
//  Lisensi dependency + SBOM (CycloneDX 1.5 / SPDX 2.3)
//  Lisensi: dari lockfile (npm, Composer) bila ada, selain itu deps.dev (CORS terbuka).
// ============================================================
const DEPSDEV_SYSTEM = { npm: 'npm', PyPI: 'pypi', Maven: 'maven', 'crates.io': 'cargo', Go: 'go', NuGet: 'nuget', RubyGems: 'rubygems' };
const licenseCache = {};
function fetchLicense(p) {
  const sys = DEPSDEV_SYSTEM[p.eco];
  if (!sys) return Promise.resolve('');
  const ver = sys === 'go' && p.version[0] !== 'v' ? 'v' + p.version : p.version;
  const k = sys + '|' + p.name + '|' + ver;
  if (!(k in licenseCache)) {
    licenseCache[k] = apiFetch('depsdev', 'https://api.deps.dev/v3/systems/' + sys + '/packages/' + encodeURIComponent(p.name) + '/versions/' + encodeURIComponent(ver), undefined, [404])
      .then(r => (r.ok ? r.json() : {})).then(j => (j.licenses || []).join(' AND ')).catch(() => '');
  }
  return licenseCache[k];
}
async function enrichLicenses(pkgs, log) {
  const todo = pkgs.filter(p => !p.license && DEPSDEV_SYSTEM[p.eco]);
  if (todo.length) log(tr('log_lic_fetch').replace('{n}', todo.length));
  await pool(todo, 8, async p => { p.license = await fetchLicense(p); });
}
// Risiko lisensi (License Risk Matrix): strong copyleft > weak copyleft > tidak diketahui > permissive.
// Ekspresi SPDX: "A OR B" = boleh pilih (ambil yang teringan), "A AND B" = keduanya berlaku (ambil yang terberat).
const LIC_LEVELS = ['strong', 'weak', 'unknown', 'permissive'];
const LIC_TERM_RISK = [
  ['weak', /\b(LGPL|MPL|EPL|CDDL|CPL|MS-RL|CECILL-C)/i],
  ['strong', /\b(AGPL|GPL|SSPL|EUPL|OSL|RPL|CPAL|CC-BY-SA|CECILL)/i],
  ['permissive', /^(MIT|MIT-0|ISC|0BSD|BSD-\d-Clause[\w-]*|Apache-[12]\.\d|Unlicense|CC0-1\.0|Zlib|BlueOak-1\.0\.0|Python-2\.0|PSF-2\.0|WTFPL|BSL-1\.0|X11|PostgreSQL|Artistic-2\.0|Ruby|PHP-3\.0?1?|CC-BY-[34]\.0)$/i]
];
function termRisk(term) {
  const t = term.replace(/[()]/g, '').trim().split(/\s+WITH\s+/i)[0];
  const hit = LIC_TERM_RISK.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'unknown';
}
function licenseRisk(expr) {
  if (!expr || /^(NOASSERTION|non-standard|UNKNOWN)$/i.test(expr.trim())) return 'unknown';
  const rank = l => LIC_LEVELS.indexOf(l);
  return expr.split(/\s+OR\s+/i)
    .map(alt => alt.split(/\s+AND\s+/i).map(termRisk).reduce((a, b) => (rank(a) < rank(b) ? a : b)))
    .reduce((a, b) => (rank(a) > rank(b) ? a : b));
}
function renderLicenseMatrix(results) {
  const rows = [];
  results.forEach(r => (r.entries || []).forEach(e => rows.push({ file: r.name, e, lvl: licenseRisk(e.license) })));
  if (!rows.length) return '';
  const n = l => rows.filter(x => x.lvl === l).length;
  let h = '<h2>' + tr('licm_title') + '</h2><div class="cards">' +
    LIC_LEVELS.map(l => '<div class="card lic-' + l + '"><b>' + n(l) + '</b><span>' + tr('licm_' + l) + '</span></div>').join('') + '</div>' +
    '<div class="note">' + tr('licm_note') + '</div>';
  const risky = rows.filter(x => x.lvl !== 'permissive').sort((a, b) => LIC_LEVELS.indexOf(a.lvl) - LIC_LEVELS.indexOf(b.lvl));
  if (!risky.length) return h;
  h += '<table><thead><tr>' + ['rep_th_package', 'licm_th_license', 'licm_th_level', 'licm_th_action', 'th_file'].map(k => '<th>' + tr(k) + '</th>').join('') + '</tr></thead><tbody>' +
    risky.map(x => '<tr><td>' + esc(x.e.name) + ' <span class="mono">' + esc(x.e.version) + ' · ' + esc(x.e.eco) + (x.e.dev ? ' · dev' : '') + '</span></td><td class="mono">' + esc(x.e.license || '—') +
      '</td><td><span class="b lic-' + x.lvl + '">' + tr('licm_' + x.lvl) + '</span></td><td>' + tr('licm_act_' + x.lvl) + '</td><td>' + esc(x.file) + '</td></tr>').join('') + '</tbody></table>';
  return h;
}
// Package URL (purl-spec) untuk SBOM.
const PURL_TYPE = { npm: 'npm', PyPI: 'pypi', Maven: 'maven', 'crates.io': 'cargo', Go: 'golang', NuGet: 'nuget', RubyGems: 'gem', Packagist: 'composer', Pub: 'pub', Hex: 'hex' };
function purlOf(p) {
  const type = PURL_TYPE[p.eco];
  if (!type) return '';
  let ns = '', name = type === 'pypi' ? p.name.toLowerCase() : p.name;
  if (type === 'maven') [ns, name] = name.split(':');
  else if (name.lastIndexOf('/') > 0) { const i = name.lastIndexOf('/'); ns = name.slice(0, i); name = name.slice(i + 1); }
  const seg = s => s.split('/').map(encodeURIComponent).join('/');
  return 'pkg:' + type + '/' + (ns ? seg(ns) + '/' : '') + encodeURIComponent(name) + '@' + encodeURIComponent(type === 'golang' ? 'v' + p.version : p.version);
}
const isSpdxExpr = lic => !!lic && licenseRisk(lic) !== 'unknown';
function buildCycloneDx(pkgs, project) {
  return {
    bomFormat: 'CycloneDX', specVersion: '1.5', serialNumber: 'urn:uuid:' + crypto.randomUUID(), version: 1,
    metadata: { timestamp: new Date().toISOString(), tools: { components: [{ type: 'application', name: 'Scanner Security', version: APP_VERSION }] }, component: { type: 'application', name: project } },
    components: pkgs.map(p => {
      const purl = purlOf(p), c = { type: 'library', 'bom-ref': purl || p.eco + ':' + p.name + '@' + p.version, name: p.name, version: p.version, scope: p.dev ? 'optional' : 'required' };
      if (purl) c.purl = purl;
      if (p.license) c.licenses = /\s(AND|OR|WITH)\s/i.test(p.license) ? [{ expression: p.license }] : [{ license: isSpdxExpr(p.license) ? { id: p.license } : { name: p.license } }];
      return c;
    })
  };
}
function buildSpdx(pkgs, project) {
  const id = i => 'SPDXRef-Package-' + i;
  return {
    spdxVersion: 'SPDX-2.3', dataLicense: 'CC0-1.0', SPDXID: 'SPDXRef-DOCUMENT', name: project,
    documentNamespace: 'https://spdx.org/spdxdocs/' + encodeURIComponent(project) + '-' + crypto.randomUUID(),
    creationInfo: { created: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), creators: ['Tool: Scanner Security-' + APP_VERSION] },
    packages: pkgs.map((p, i) => {
      const purl = purlOf(p);
      return { name: p.name, SPDXID: id(i), versionInfo: p.version, downloadLocation: 'NOASSERTION', filesAnalyzed: false, licenseConcluded: 'NOASSERTION',
        licenseDeclared: isSpdxExpr(p.license) ? p.license : 'NOASSERTION',
        externalRefs: purl ? [{ referenceCategory: 'PACKAGE-MANAGER', referenceType: 'purl', referenceLocator: purl }] : [] };
    }),
    relationships: pkgs.map((p, i) => ({ spdxElementId: 'SPDXRef-DOCUMENT', relationshipType: 'DESCRIBES', relatedSpdxElement: id(i) }))
  };
}

function buildReport(results, opts) {
  const now = new Date().toLocaleString(LANG === 'en' ? 'en-US' : 'id-ID');
  let body = '<h1>' + tr('rep_h1') + '</h1><div class="sub">' + tr('rep_created') + ' ' + esc(now) + ' · ' + results.length + ' ' + tr('rep_files') + ' · ' + tr('rep_source') + ': OSV.dev' + (opts.enrich ? ', FIRST EPSS, CISA KEV' : '') + ', endoflife.date' + (opts.license ? ', deps.dev' : '') + (opts.omitDev ? ' · ' + tr('rep_omitdev') : '') + '</div>';
  const all = results.reduce((a, r) => a.concat(r.entries || [], r.docker ? r.docker.entries : []), []);
  body += cards(all);
  results.forEach(r => {
    body += '<h2>' + esc(r.name) + ' <span class="mono">(' + esc(TYPE_LABELS[r.type] || r.type) + ')</span></h2>';
    if (r.error) { body += '<div class="note">' + tr('rep_fail_process') + esc(r.error) + '</div>'; return; }
    if (r.docker) { body += renderDocker(r, results.length > 1); return; }
    body += '<div class="cap">' + r.entries.length + ' ' + tr('rep_unique_pkg') + (r.skipped ? ' · ' + r.skipped + ' ' + tr('rep_skipped_dev') : '') + '</div>' + (r.note ? '<div class="note">' + esc(r.note) + '</div>' : '') + (results.length > 1 ? cards(r.entries) : '') + renderVulnTable(r.entries, r.name);
  });
  if (opts.license) body += renderLicenseMatrix(results);
  const csv = buildCsv(results);
  const gname = Object.fromEntries(API_GROUPS.map(g => [g.key, trData('grp_' + g.key + '_title', g.title)]));
  const used = API_LIST.filter(a => apiStats[a.key].calls && a.group !== 'app');
  body += '<h2>' + tr('rep_api_title') + '</h2><table><thead><tr>' + ['rep_th_group', 'rep_th_api', 'rep_th_endpoint', 'rep_th_purpose', 'rep_th_datasent', 'rep_th_calls'].map(k => '<th>' + tr(k) + '</th>').join('') + '</tr></thead><tbody>' +
    used.map(a => '<tr><td>' + esc(gname[a.group]) + '</td><td>' + esc(a.name) + '</td><td class="mono">' + esc(a.url) + '</td><td>' + esc(trData('api_' + a.key + '_use', a.use)) + '</td><td>' + esc(trData('api_' + a.key + '_sends', a.sends)) + '</td><td>' + apiStats[a.key].calls + '× (' + apiStats[a.key].ok + ' ok' + (apiStats[a.key].fail ? ', ' + apiStats[a.key].fail + ' ' + tr('failed').toLowerCase() : '') + ')</td></tr>').join('') + '</tbody></table>';
  body += '<div class="note">' + tr('rep_note_osv') + '</div>';
  body += '<p style="margin-top:28px"><a download="laporan_scan.csv" href="data:text/csv;charset=utf-8,' + encodeURIComponent(csv) + '">' + tr('rep_dl_csv') + '</a></p>';
  return '<!DOCTYPE html><html lang="' + LANG + '"><head><meta charset="UTF-8"><title>' + tr('rep_report_title') + '</title>' + FAV_LINK + '<style>' + REPORT_CSS + '</style></head><body>' + hint() + tipify(body) + REPORT_TABLE_JS + '</body></html>';
}

// ============================================================
//  Ambil file dari link GitHub / GitLab / URL langsung
// ============================================================
const MAX_REPO_FILES = 40;
const SKIP_DIRS = ['node_modules', 'vendor', '.git', 'dist', 'bin', 'obj', 'bower_components'];

function parseSourceUrl(raw) {
  let u;
  try { u = new URL(raw.trim()); } catch (e) { throw new Error(tr('err_link_invalid') + raw); }
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (host === 'github.com' || host === 'www.github.com') {
    if (parts.length < 2) throw new Error(tr('err_gh_ownerrepo') + raw);
    const o = { kind: 'github', owner: parts[0], repo: parts[1].replace(/\.git$/, ''), ref: '', path: '', isFile: false };
    if (['blob', 'tree', 'raw'].includes(parts[2]) && parts[3]) {
      o.ref = parts[3]; o.path = parts.slice(4).join('/'); o.isFile = parts[2] !== 'tree' && !!o.path;
    }
    return o;
  }
  if (host === 'raw.githubusercontent.com' && parts.length >= 4) {
    return { kind: 'github', owner: parts[0], repo: parts[1], ref: parts[2], path: parts.slice(3).join('/'), isFile: true };
  }
  if (host === 'gitlab.com' || host.indexOf('gitlab') >= 0) {
    const full = u.pathname.replace(/^\//, '');
    const sep = full.indexOf('/-/');
    const projPath = (sep >= 0 ? full.slice(0, sep) : full).replace(/\.git$/, '').replace(/\/$/, '');
    const o = { kind: 'gitlab', host, project: decodeURIComponent(projPath), ref: '', path: '', isFile: false };
    if (sep >= 0) {
      const rest = full.slice(sep + 3).split('/').map(decodeURIComponent);
      if (['blob', 'tree', 'raw'].includes(rest[0]) && rest[1]) {
        o.ref = rest[1]; o.path = rest.slice(2).join('/'); o.isFile = rest[0] !== 'tree' && !!o.path;
      }
    }
    if (o.project.split('/').length < 2) throw new Error(tr('err_gl_groupproj') + raw);
    return o;
  }
  return { kind: 'url', url: u.href, path: parts[parts.length - 1] || u.hostname };
}

function pickScannable(paths, prefix) {
  const set = new Set(paths);
  const picked = [];
  paths.forEach(p => {
    if (prefix && p !== prefix && !p.startsWith(prefix.replace(/\/$/, '') + '/')) return;
    const segs = p.split('/');
    const base = segs[segs.length - 1].toLowerCase();
    if (segs.slice(0, -1).some(s => SKIP_DIRS.includes(s.toLowerCase()))) return;
    const dir = segs.slice(0, -1).join('/');
    const sibling = n => set.has(dir ? dir + '/' + n : n);
    // Cargo.toml anggota workspace sudah tercakup Cargo.lock di folder induk
    const hasCargoLockAbove = parts => { for (let k = parts.length - 1; k >= 0; k--) { const d2 = parts.slice(0, k).join('/'); if (set.has(d2 ? d2 + '/Cargo.lock' : 'Cargo.lock')) return true; } return false; };
    const NPM_LOCKS = ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml'];
    const FIXED = ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock', 'packages.lock.json', 'directory.packages.props',
      'pom.xml', 'gradle.lockfile', 'cargo.lock', 'go.mod', 'poetry.lock', 'uv.lock', 'pipfile.lock', 'gemfile.lock', 'pubspec.lock', 'mix.lock', 'packages.config'];
    const ok = FIXED.includes(base)
      || base.endsWith('.csproj') || base.endsWith('.fsproj') || base.endsWith('.vbproj')
      || base.startsWith('dockerfile') || base.endsWith('.dockerfile')
      || (base.startsWith('requirements') && base.endsWith('.txt'))
      || (base === 'package.json' && !NPM_LOCKS.some(sibling))
      || ((base === 'build.gradle' || base === 'build.gradle.kts') && !sibling('gradle.lockfile'))
      || (base === 'cargo.toml' && !hasCargoLockAbove(segs));
    if (ok) picked.push(p);
  });
  picked.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  return picked;
}

async function httpErr(res, what, hasToken) {
  const v = { x: what, s: res.status };
  if (res.status === 404) return new Error(Lf('{x} tidak ditemukan', v) + L(hasToken ? ' (cek token/izin)' : ' atau private (isi token read-only)'));
  if (res.status === 401) return new Error(Lf('{x}: token ditolak (401)', v));
  if (res.status === 403 || res.status === 429) return new Error(Lf('{x}: kena batas request/izin (HTTP {s}). Tanpa token GitHub dibatasi 60 request per jam; isi token untuk menaikkan.', v));
  return new Error(what + ': HTTP ' + res.status);
}

async function fetchGithub(src, token, log) {
  const hdr = { Accept: 'application/vnd.github+json' };
  if (token) hdr.Authorization = 'Bearer ' + token;
  const base = 'https://api.github.com/repos/' + encodeURIComponent(src.owner) + '/' + encodeURIComponent(src.repo);
  const fileUrl = (ref, path) => {
    if (token) return { key: 'gh-api', url: base + '/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(ref), init: { headers: { Accept: 'application/vnd.github.raw+json', Authorization: 'Bearer ' + token } } };
    return { key: 'gh-raw', url: 'https://raw.githubusercontent.com/' + src.owner + '/' + src.repo + '/' + ref + '/' + path.split('/').map(encodeURIComponent).join('/'), init: undefined };
  };
  const get = async (ref, path) => {
    const f = fileUrl(ref, path);
    const res = await apiFetch(f.key, f.url, f.init);
    if (!res.ok) throw await httpErr(res, path, !!token);
    return res.text();
  };
  if (src.isFile) {
    let ref = src.ref;
    if (!ref) { const r = await apiFetch('gh-api', base, { headers: hdr }); if (!r.ok) throw await httpErr(r, src.owner + '/' + src.repo, !!token); ref = (await r.json()).default_branch; }
    log('GitHub: ' + src.path);
    return [{ name: src.repo + '/' + src.path, text: await get(ref, src.path) }];
  }
  const r = await apiFetch('gh-api', base, { headers: hdr });
  if (!r.ok) throw await httpErr(r, src.owner + '/' + src.repo, !!token);
  const info = await r.json();
  const ref = src.ref || info.default_branch;
  log('GitHub ' + info.full_name + ' (' + (info.private ? tr('lbl_private') : tr('lbl_public')) + ', branch ' + ref + ')');
  const treeRes = await apiFetch('gh-api', base + '/git/trees/' + encodeURIComponent(ref) + '?recursive=1', { headers: hdr });
  if (!treeRes.ok) throw await httpErr(treeRes, L('Daftar file'), !!token);
  const tj = await treeRes.json();
  if (tj.truncated) log(tr('log_repo_truncated'));
  const paths = (tj.tree || []).filter(x => x.type === 'blob').map(x => x.path);
  return await downloadPicked(pickScannable(paths, src.path), src.repo, (p) => get(ref, p), log);
}

async function fetchGitlab(src, token, log) {
  const api = 'https://' + src.host + '/api/v4/projects/' + encodeURIComponent(src.project);
  const init = token ? { headers: { Authorization: 'Bearer ' + token } } : undefined;
  const name = src.project.split('/').pop();
  const r = await apiFetch('gl-api', api, init);
  if (!r.ok) throw await httpErr(r, src.project, !!token);
  const info = await r.json();
  const ref = src.ref || info.default_branch;
  const get = async (path) => {
    const res = await apiFetch('gl-api', api + '/repository/files/' + encodeURIComponent(path) + '/raw?ref=' + encodeURIComponent(ref), init);
    if (!res.ok) throw await httpErr(res, path, !!token);
    return res.text();
  };
  log('GitLab ' + info.path_with_namespace + ' (' + info.visibility + ', branch ' + ref + ')');
  if (src.isFile) return [{ name: name + '/' + src.path, text: await get(src.path) }];
  const paths = [];
  for (let page = 1; page <= 30; page++) {
    const treeRes = await apiFetch('gl-api', api + '/repository/tree?recursive=true&per_page=100&page=' + page + '&ref=' + encodeURIComponent(ref), init);
    if (!treeRes.ok) throw await httpErr(treeRes, L('Daftar file'), !!token);
    const arr = await treeRes.json();
    arr.forEach(x => { if (x.type === 'blob') paths.push(x.path); });
    if (arr.length < 100) break;
  }
  return await downloadPicked(pickScannable(paths, src.path), name, get, log);
}

async function downloadPicked(picked, repoName, getFn, log) {
  if (!picked.length) { log(tr('log_no_scannable')); return []; }
  if (picked.length > MAX_REPO_FILES) log(tr('log_found_files').replace('{n}', picked.length).replace('{m}', MAX_REPO_FILES));
  const list = picked.slice(0, MAX_REPO_FILES), out = [];
  await pool(list, 5, async p => {
    try { out.push({ name: repoName + '/' + p, text: await getFn(p) }); log('  + ' + p); }
    catch (e) { log('  ! ' + p + ': ' + e.message); }
  });
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function fetchDirect(src, log) {
  log(tr('log_download').replace('{x}', src.url));
  let res;
  try { res = await apiFetch('url', src.url); }
  catch (e) { throw new Error(tr('err_download_cors') + src.url); }
  if (!res.ok) throw await httpErr(res, src.path, false);
  return [{ name: src.path, text: await res.text() }];
}

async function fetchFromUrl(raw, token, log) {
  const src = parseSourceUrl(raw);
  if (src.kind === 'github') return fetchGithub(src, token, log);
  if (src.kind === 'gitlab') return fetchGitlab(src, token, log);
  return fetchDirect(src, log);
}

// ============================================================
//  DAST pasif: header respons (HackerTarget) + nilai MDN Observatory
//  Hanya membaca respons publik situs; tidak ada payload serangan.
// ============================================================
function isPrivateHost(h) {
  h = h.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.lan') || h.startsWith('[')) return true;
  const m = rx1(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/g, h);
  if (m) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    return a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  return h.indexOf('.') < 0;
}
function parseHeaders(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  const hdr = {}, cookies = [];
  lines.slice(1).forEach(l => {
    const i = l.indexOf(':');
    if (i <= 0) return;
    const k = l.slice(0, i).trim().toLowerCase(), v = l.slice(i + 1).trim();
    if (k === 'set-cookie') cookies.push(v);
    hdr[k] = hdr[k] !== undefined ? hdr[k] + ', ' + v : v;
  });
  return { status: lines[0] || '', hdr, cookies, raw: lines };
}
async function fetchHeaders(url) {
  const res = await apiFetch('ht', 'https://api.hackertarget.com/httpheaders/?q=' + encodeURIComponent(url));
  const t = await res.text();
  if (!/^\s*HTTP\//i.test(t)) {
    if (/quota|exceeded|limit/i.test(t)) throw new Error(tr('err_ht_quota'));
    throw new Error('HackerTarget: ' + t.trim().slice(0, 120));
  }
  return parseHeaders(t);
}
async function observatoryScan(host) {
  const res = await apiFetch('obs', 'https://observatory-api.mdn.mozilla.net/api/v2/scan?host=' + encodeURIComponent(host), { method: 'POST' });
  if (!res.ok) throw new Error('Observatory HTTP ' + res.status);
  const j = await res.json();
  if (j.error) throw new Error('Observatory: ' + (j.message || j.error));
  return j;
}
function analyzeHeaders(u, p) {
  const f = [], H = p.hdr, https = u.protocol === 'https:';
  const add = (sev, header, rule, detail, fix) => f.push({ sev, header, rule: L(rule), detail: detail || '', fix: L(fix || '') });
  if (!https) add('HIGH', '-', 'Situs diakses lewat HTTP (tanpa TLS)', u.href, 'Sajikan seluruh situs lewat HTTPS dan alihkan HTTP ke HTTPS.');
  const hsts = H['strict-transport-security'];
  if (https) {
    if (!hsts) add('MEDIUM', 'Strict-Transport-Security', 'HSTS tidak ada', '', 'Tambahkan Strict-Transport-Security: max-age=31536000; includeSubDomains.');
    else {
      const ma = rx1(/max-age=(\d+)/gi, hsts);
      if (!ma || parseInt(ma[1], 10) < 15552000) add('LOW', 'Strict-Transport-Security', 'HSTS max-age terlalu pendek', hsts, 'Pakai max-age minimal 15552000 (idealnya 31536000).');
    }
  }
  const csp = H['content-security-policy'];
  if (!csp) add('MEDIUM', 'Content-Security-Policy', 'CSP tidak ada', '', 'Tambahkan Content-Security-Policy yang membatasi sumber script/style.');
  else {
    const dir = {};
    csp.split(';').forEach(d => { const t = d.trim().split(/\s+/); if (t[0]) dir[t[0].toLowerCase()] = t.slice(1).join(' '); });
    const scriptSrc = dir['script-src'] !== undefined ? dir['script-src'] : (dir['default-src'] || '');
    const styleSrc = dir['style-src'] !== undefined ? dir['style-src'] : (dir['default-src'] || '');
    // browser mengabaikan 'unsafe-inline' bila ada nonce/hash/strict-dynamic di script-src
    const protectedInline = scriptSrc.indexOf("'nonce-") >= 0 || scriptSrc.indexOf("'sha") >= 0 || scriptSrc.indexOf("'strict-dynamic'") >= 0;
    if (scriptSrc.indexOf("'unsafe-inline'") >= 0 && !protectedInline) add('MEDIUM', 'Content-Security-Policy', "script-src memakai 'unsafe-inline'", scriptSrc.slice(0, 160), 'Ganti dengan nonce/hash per-request.');
    if (scriptSrc.indexOf("'unsafe-eval'") >= 0) add('LOW', 'Content-Security-Policy', "script-src memakai 'unsafe-eval'", scriptSrc.slice(0, 160), 'Hapus unsafe-eval.');
    if (styleSrc.indexOf("'unsafe-inline'") >= 0) add('LOW', 'Content-Security-Policy', "style-src memakai 'unsafe-inline' (risiko lebih rendah dari script-src)", styleSrc.slice(0, 160), 'Pakai nonce untuk <style> jika framework UI mendukung.');
  }
  if ((H['x-content-type-options'] || '').toLowerCase().indexOf('nosniff') < 0) add('LOW', 'X-Content-Type-Options', 'nosniff tidak ada', '', 'Tambahkan X-Content-Type-Options: nosniff.');
  if (!H['x-frame-options'] && !(csp && csp.indexOf('frame-ancestors') >= 0)) add('LOW', 'X-Frame-Options', 'Tidak ada perlindungan clickjacking', '', "Tambahkan X-Frame-Options: DENY atau CSP frame-ancestors 'none'.");
  if (!H['referrer-policy']) add('LOW', 'Referrer-Policy', 'Referrer-Policy tidak ada', '', 'Tambahkan Referrer-Policy: strict-origin-when-cross-origin.');
  if (!H['permissions-policy']) add('LOW', 'Permissions-Policy', 'Permissions-Policy tidak ada', '', 'Batasi fitur browser (kamera, mikrofon, geolokasi) yang tidak dipakai.');
  if (H['server'] && /\d/.test(H['server'])) add('LOW', 'Server', 'Header Server membuka versi', H['server'], 'Sembunyikan versi perangkat lunak.');
  ['x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version'].forEach(k => { if (H[k]) add('LOW', k, 'Header membuka teknologi/versi', H[k], 'Hapus header ini.'); });
  if (H['access-control-allow-origin'] === '*') add('LOW', 'Access-Control-Allow-Origin', 'CORS terbuka untuk semua origin (*)', '', 'Batasi ke origin yang dibutuhkan bila respons berisi data sensitif.');
  p.cookies.forEach(c => {
    const name = c.split('=')[0].trim(), lc = c.toLowerCase();
    if (https && lc.indexOf('; secure') < 0) add('MEDIUM', 'Set-Cookie', Lf('Cookie tanpa flag Secure: {x}', { x: name }), '', 'Tambahkan atribut Secure.');
    if (lc.indexOf('httponly') < 0) add('MEDIUM', 'Set-Cookie', Lf('Cookie tanpa flag HttpOnly: {x}', { x: name }), '', 'Tambahkan atribut HttpOnly.');
    if (lc.indexOf('samesite') < 0) add('LOW', 'Set-Cookie', Lf('Cookie tanpa SameSite: {x}', { x: name }), '', 'Tambahkan SameSite=Lax atau Strict.');
  });
  f.sort((a, b) => SEV_ORDER[b.sev] - SEV_ORDER[a.sev]);
  return f;
}
// ---- Info domain & port (pasif, tanpa API key) ----
// DNS over HTTPS (Google) -> daftar nilai record untuk host+type.
const DNS_TYPE = { A: 1, AAAA: 28, MX: 15, NS: 2, TXT: 16 };
async function dohResolve(host, type) {
  const res = await apiFetch('dns', 'https://dns.google/resolve?name=' + encodeURIComponent(host) + '&type=' + type);
  if (!res.ok) throw new Error('DNS HTTP ' + res.status);
  const j = await res.json();
  return (j.Answer || []).filter(a => a.type === DNS_TYPE[type]).map(a => String(a.data).replace(/^"|"$/g, ''));
}
// Shodan InternetDB: data "mirip nmap" pasif untuk satu IP (port/CVE/CPE/tag)
// dari hasil pindai Shodan sebelumnya — bukan scan langsung. 404 = IP tak ada
// di basis data (dianggap bersih). Tanpa API key.
async function internetDb(ip) {
  const res = await apiFetch('idb', 'https://internetdb.shodan.io/' + encodeURIComponent(ip));
  if (res.status === 404) return { ports: [], vulns: [], cpes: [], tags: [], hostnames: [], empty: true };
  if (!res.ok) throw new Error('InternetDB HTTP ' + res.status);
  const j = await res.json();
  return { ports: j.ports || [], vulns: j.vulns || [], cpes: j.cpes || [], tags: j.tags || [], hostnames: j.hostnames || [] };
}
async function netScan(host) {
  const net = { ips: [], aaaa: [], mx: [], ns: [], txt: [], idb: null, idbErr: '', dnsErr: '' };
  const [a, aaaa, mx, ns, txt] = await Promise.allSettled([
    dohResolve(host, 'A'), dohResolve(host, 'AAAA'), dohResolve(host, 'MX'), dohResolve(host, 'NS'), dohResolve(host, 'TXT')
  ]);
  if (a.status === 'fulfilled') net.ips = a.value; else net.dnsErr = a.reason.message;
  if (aaaa.status === 'fulfilled') net.aaaa = aaaa.value;
  if (mx.status === 'fulfilled') net.mx = mx.value;
  if (ns.status === 'fulfilled') net.ns = ns.value;
  if (txt.status === 'fulfilled') net.txt = txt.value;
  if (net.ips.length) { try { net.idb = await internetDb(net.ips[0]); } catch (e) { net.idbErr = friendlyFetchError(e); } }
  return net;
}
// Target DAST: URL http(s) dengan nama host bertitik (kata biasa seperti "url" bukan host), bukan host internal.
function dastTarget(raw) {
  let u;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw); } catch (e) { return { error: tr('err_url_invalid') }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: tr('err_only_http') };
  const h = u.hostname;
  if (h !== 'localhost' && !h.startsWith('[') && h.indexOf('.') < 0) return { error: tr('err_url_invalid') };
  if (isPrivateHost(h)) return { error: tr('err_private_host') };
  return { url: u };
}
async function dastCheck(raw, log, opts) {
  const res = { input: raw, error: '', findings: [], obs: null, obsErr: '', headers: null, hdrErr: '', net: null };
  const target = dastTarget(raw);
  if (target.error) { res.error = target.error; return res; }
  const u = target.url;
  res.url = u.href; res.host = u.hostname;
  log(tr('log_checking').replace('{x}', u.href));
  const [o, h] = await Promise.allSettled([observatoryScan(u.hostname), fetchHeaders(u.href)]);
  if (o.status === 'fulfilled') res.obs = o.value; else res.obsErr = o.reason.message;
  if (h.status === 'fulfilled') { res.headers = h.value; res.findings = analyzeHeaders(u, h.value); } else res.hdrErr = h.reason.message;
  log('  Observatory: ' + (res.obs ? tr('log_grade') + res.obs.grade + ' (' + res.obs.score + ')' : tr('log_fail_dash') + res.obsErr) + ' · header: ' + (res.headers ? res.findings.length + tr('log_findings') : tr('log_fail_dash') + res.hdrErr));
  if (opts && opts.net) {
    res.net = await netScan(res.host);
    const idb = res.net.idb;
    log('  DNS: ' + (res.net.ips.length ? res.net.ips.join(', ') : '-') + ' · port: ' + (idb ? (idb.empty ? tr('log_idb_empty') : idb.ports.join(', ')) : tr('log_fail_dash') + res.net.idbErr));
  }
  return res;
}
const GRADE_COLOR = { A: '#16a34a', B: '#65a30d', C: '#d97706', D: '#ea580c', E: '#dc2626', F: '#7f1d1d' };
// Bagian "Domain & port (pasif)" per URL: hasil DNS + Shodan InternetDB.
function dastNetHtml(r) {
  const n = r.net;
  if (!n) return '';
  let h = '<h3>' + tr('drep_net_title') + '</h3>';
  const rows = [];
  if (n.ips.length) rows.push(['A (IPv4)', esc(n.ips.join(', '))]);
  if (n.aaaa.length) rows.push(['AAAA (IPv6)', esc(n.aaaa.join(', '))]);
  if (n.ns.length) rows.push(['NS', esc(n.ns.join(', '))]);
  if (n.mx.length) rows.push(['MX', esc(n.mx.join(', '))]);
  if (n.txt.length) rows.push(['TXT', n.txt.map(esc).join('<br>')]);
  if (rows.length) h += '<table><tbody>' + rows.map(d => '<tr><td class="mono" style="width:110px">' + d[0] + '</td><td class="mono">' + d[1] + '</td></tr>').join('') + '</tbody></table>';
  if (n.dnsErr) h += '<div class="note">' + tr('drep_dns_fail') + esc(n.dnsErr) + '</div>';
  const idb = n.idb;
  if (n.idbErr) h += '<div class="note">' + tr('drep_idb_fail') + esc(n.idbErr) + '</div>';
  else if (idb && idb.empty) h += '<p class="cap">IP <span class="mono">' + esc(n.ips[0]) + '</span>' + tr('drep_idb_empty') + '</p>';
  else if (idb) {
    h += '<p class="cap">' + tr('drep_idb_from').replace('{ip}', '<span class="mono">' + esc(n.ips[0]) + '</span>') + '</p>';
    h += '<div class="cards"><div class="card"><b>' + idb.ports.length + '</b><span>' + tr('drep_open_ports') + '</span></div>' +
      '<div class="card ' + (idb.vulns.length ? 'h' : '') + '"><b>' + idb.vulns.length + '</b><span>' + tr('drep_known_cve') + '</span></div></div>';
    if (idb.ports.length) h += '<p><b>' + tr('drep_ports') + '</b> <span class="mono">' + idb.ports.slice().sort((a, b) => a - b).join(', ') + '</span></p>';
    if (idb.cpes.length) h += '<p><b>' + tr('drep_cpe') + '</b> <span class="mono">' + idb.cpes.map(esc).join(', ') + '</span></p>';
    if (idb.tags.length) h += '<p><b>' + tr('drep_tag') + '</b> <span class="mono">' + idb.tags.map(esc).join(', ') + '</span></p>';
    if (idb.vulns.length) h += '<p><b>' + tr('drep_cve') + '</b> ' + idb.vulns.map(v => '<a href="https://nvd.nist.gov/vuln/detail/' + esc(v) + '" target="_blank" rel="noopener noreferrer" class="mono">' + esc(v) + '</a>').join(', ') + '</p>';
  }
  return h;
}
function buildDastReport(results, extra) {
  extra = extra || {};
  const now = new Date().toLocaleString(LANG === 'en' ? 'en-US' : 'id-ID');
  const srcNet = results.some(r => r.net) ? ', Google DoH, Shodan InternetDB' : '';
  let body = '<h1>' + tr('drep_h1') + '</h1><div class="sub">' + tr('rep_created') + ' ' + esc(now) + ' · ' + results.length + ' URL · ' + tr('rep_source') + ': MDN HTTP Observatory, HackerTarget httpheaders' + srcNet + '</div>';
  body += '<div class="note">' + tr('drep_passive_note') + '</div>';
  results.forEach(r => {
    body += '<h2>' + esc(r.url || r.input) + '</h2>';
    if (r.error) { body += '<div class="note">' + tr('drep_skipped') + esc(r.error) + '</div>'; return; }
    const c = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    r.findings.forEach(x => { c[x.sev] = (c[x.sev] || 0) + 1; });
    body += '<div class="cards">';
    if (r.obs) {
      const g = String(r.obs.grade || '?'), col = GRADE_COLOR[g[0]] || '#64748b';
      body += '<div class="card" style="border-color:' + col + '"><b style="color:' + col + '">' + esc(g) + '</b><span>' + tr('drep_obs_grade_label') + ' (' + esc(r.obs.score) + '/100)</span></div>' +
        '<div class="card"><b>' + esc(r.obs.tests_passed) + '/' + esc(r.obs.tests_quantity) + '</b><span>' + tr('drep_obs_passed') + '</span></div>';
    }
    if (r.headers) {
      body += '<div class="card h"><b>' + c.HIGH + '</b><span>' + sevL('HIGH') + '</span></div><div class="card m"><b>' + c.MEDIUM + '</b><span>' + sevL('MEDIUM') + '</span></div><div class="card l"><b>' + c.LOW + '</b><span>' + sevL('LOW') + '</span></div>';
    }
    body += '</div>';
    if (r.obs) body += '<p class="cap">' + tr('drep_obs_scanned') + '<span class="mono">' + esc(r.host) + '</span>' + tr('drep_obs_notpath') + '<a href="' + esc(r.obs.details_url) + '" target="_blank" rel="noopener noreferrer">' + tr('drep_obs_details') + '</a>' + tr('drep_obs_httpstatus') + esc(r.obs.status_code) + '.</p>';
    else body += '<div class="note">' + tr('drep_obs_fail') + esc(r.obsErr) + '</div>';
    if (r.headers) {
      body += '<h3>' + tr('drep_header_findings') + '</h3>';
      if (!r.findings.length) body += '<p class="cap">' + tr('drep_no_findings_rules') + '</p>';
      else {
        body += '<table><thead><tr>' + ['rep_th_no', 'rep_th_sev', 'rep_th_header', 'rep_th_finding', 'rep_th_detail', 'rep_th_suggestion'].map(k => '<th>' + tr(k) + '</th>').join('') + '</tr></thead><tbody>';
        r.findings.forEach((x, i) => { body += '<tr><td>' + (i + 1) + '</td><td>' + badge(x.sev) + '</td><td class="mono">' + esc(x.header) + '</td><td>' + esc(x.rule) + '</td><td class="mono">' + esc(x.detail) + '</td><td>' + esc(x.fix) + '</td></tr>'; });
        body += '</tbody></table>';
      }
      body += '<details style="margin-top:10px"><summary>' + tr('drep_raw_headers_a') + r.headers.raw.length + tr('drep_raw_headers_b') + '</summary><pre>' + esc(r.headers.raw.join('\n')) + '</pre></details>';
    } else body += '<div class="note">' + tr('drep_header_fail') + esc(r.hdrErr) + '</div>';
    body += dastNetHtml(r);
  });
  body += cjReportHtml(results, extra.cj || {});
  body += jsrReportHtml(extra.jsr);
  const used = API_LIST.filter(a => a.group === 'dast' && apiStats[a.key].calls);
  body += '<h2>' + tr('rep_api_title') + '</h2><table><thead><tr>' + ['rep_th_api', 'rep_th_endpoint', 'rep_th_datasent', 'rep_th_calls'].map(k => '<th>' + tr(k) + '</th>').join('') + '</tr></thead><tbody>' +
    used.map(a => '<tr><td>' + esc(a.name) + '</td><td class="mono">' + esc(a.url) + '</td><td>' + esc(trData('api_' + a.key + '_sends', a.sends)) + '</td><td>' + apiStats[a.key].calls + '× (' + apiStats[a.key].ok + ' ok' + (apiStats[a.key].fail ? ', ' + apiStats[a.key].fail + ' ' + tr('failed').toLowerCase() : '') + ')</td></tr>').join('') + '</tbody></table>';
  return '<!DOCTYPE html><html lang="' + LANG + '"><head><meta charset="UTF-8"><title>' + tr('drep_title') + '</title>' + FAV_LINK + '<style>' + REPORT_CSS + '</style></head><body>' + hint() + tipify(body) + REPORT_TABLE_JS + '</body></html>';
}

// ============================================================
//  Aplikasi Vue
// ============================================================
const { createApp } = Vue;
// SAST berbasis pola (OWASP ASVS V5.2/V5.3 injeksi & XSS, V2.10/V6.4 secret ter-hardcode, CWE-95/79/78/798).
// view: 'code' = komentar & isi string dikosongkan (eval di komentar/teks tidak dilapor),
//       'text' = hanya komentar dikosongkan (URL/template di string), 'raw' = apa adanya (secret di komentar tetap bocor).
const SAST_RULES = [
  { re: /\beval\s*\(/, view: 'code', rule: 'Penggunaan eval()', severity: 'HIGH', fix: 'Hindari eval(); parse data dengan JSON.parse atau gunakan pemetaan fungsi (lookup table).' },
  { re: /\bnew\s+Function\s*\(/, view: 'code', rule: 'Penggunaan new Function()', severity: 'HIGH', fix: 'Hindari new Function(); ganti dengan fungsi biasa atau pemetaan fungsi.' },
  { re: /\bset(?:Timeout|Interval)\s*\(\s*['"`]/, view: 'code', rule: 'setTimeout/setInterval dengan string (eval terselubung)', severity: 'HIGH', fix: 'Kirim fungsi, bukan string: setTimeout(() => doIt(), ms).' },
  { re: /\b(?:child_process['"`]?\)?|cp)\.(?:exec|execSync|execFile|spawn|spawnSync)\s*\(|\bexecSync\s*\(/, view: 'text', rule: 'Eksekusi perintah OS (child_process)', severity: 'HIGH', fix: 'Pakai execFile/spawn dengan array argumen (tanpa shell) dan validasi input dengan allowlist.' },
  { re: /\.innerHTML\s*\+?=(?!=)/, view: 'code', rule: 'Penulisan innerHTML (XSS)', severity: 'HIGH', fix: 'Pakai textContent, atau bangun elemen dengan createElement; jika harus HTML, sanitasi dengan DOMPurify.' },
  { re: /\.outerHTML\s*\+?=(?!=)|\.insertAdjacentHTML\s*\(/, view: 'code', rule: 'Penulisan outerHTML (XSS)', severity: 'HIGH', fix: 'Pakai createElement/replaceWith; jika harus HTML, sanitasi dengan DOMPurify.' },
  { re: /\bdocument\.write(?:ln)?\s*\(/, view: 'code', rule: 'document.write()', severity: 'MEDIUM', fix: 'Ganti dengan manipulasi DOM (createElement, append) atau data binding framework.' },
  { re: /\bv-html\s*=/, view: 'text', rule: 'Directive v-html (XSS)', severity: 'MEDIUM', fix: 'Tampilkan sebagai teks dengan {{ }}; jika HTML wajib, sanitasi dulu (DOMPurify).' },
  { re: /\bdangerouslySetInnerHTML\b/, view: 'code', rule: 'dangerouslySetInnerHTML (XSS)', severity: 'MEDIUM', fix: 'Render sebagai teks/komponen React; jika HTML wajib, sanitasi dulu (DOMPurify).' },
  { re: /\blocalStorage\.setItem\s*\(/, view: 'code', rule: 'Simpan data di localStorage', severity: 'LOW', fix: 'Jangan simpan token/data sensitif di localStorage (terbaca skrip XSS); pakai cookie HttpOnly + Secure + SameSite.' },
  { re: /(?<!\b(?:child_process['"`]?\)?|cp))\.exec\s*\(/, view: 'text', rule: 'RegExp.exec() (konvensi proyek)', severity: 'LOW', fix: 'Sesuai konvensi kode proyek, ambil kecocokan dengan matchAll()/rx1() alih-alih RegExp.exec (hindari bug lastIndex pada regex /g).' },
  { re: /http:\/\/(?!localhost\b|127\.0\.0\.1\b|www\.w3\.org\/)/, view: 'text', rule: 'URL tanpa HTTPS', severity: 'LOW', fix: 'Gunakan https:// agar traffic terenkripsi.' },
  { re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, view: 'raw', rule: 'AWS access key ter-hardcode', severity: 'HIGH', fix: 'Cabut (rotate) key ini di AWS IAM, lalu ambil kredensial dari environment/secret manager.' },
  { re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/, view: 'raw', rule: 'Private key ter-hardcode', severity: 'HIGH', fix: 'Keluarkan private key dari kode, ganti (rotate) kuncinya, simpan di secret manager.' },
  { re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_\w{30,}|xox[abposr]-[A-Za-z0-9-]{10,}|sk_live_[0-9A-Za-z]{16,}|AIza[0-9A-Za-z_-]{35})/, view: 'raw', rule: 'Token/API key ter-hardcode', severity: 'HIGH', fix: 'Cabut token ini di penyedia layanan, lalu baca dari environment/secret manager.' },
  { re: /\b(?:pass(?:word|wd)?|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b["']?\s*[:=]\s*["'`](?![$<{*]|process\.env)[^"'`\s]{4,}["'`]|\b(?:password|passwd|pwd)=(?![$<{*%])[^&;'"`\s]{3,}/i, view: 'raw', rule: 'Password/secret ter-hardcode', severity: 'HIGH', fix: 'Jangan simpan password/secret di kode; baca dari environment variable atau secret manager.' }
];
// Lexer ringan JS/TS: kosongkan komentar (dan isi string bila maskStrings) tanpa menggeser baris/kolom.
// Regex literal dikenali dari token sebelumnya agar tanda kutip di dalamnya tidak dianggap string.
function maskJs(src, maskStrings) {
  const out = src.split('');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0, prev = '';
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); const end = e < 0 ? src.length : e; blank(i, end); i = end; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; blank(i, end); i = end; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c && !(c !== '`' && src[j] === '\n')) j += src[j] === '\\' ? 2 : 1;
      if (maskStrings) blank(i + 1, j);
      i = j + 1; prev = c; continue;
    }
    if (c === '/' && (!prev || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev))) {
      let j = i + 1, cls = false;
      while (j < src.length && src[j] !== '\n' && (cls || src[j] !== '/')) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; j++; }
      i = j + 1; prev = '/'; continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join('');
}
function sastScan(src) {
  const views = { raw: src.split('\n'), text: maskJs(src, false).split('\n'), code: maskJs(src, true).split('\n') };
  const findings = [];
  views.raw.forEach((line, idx) => {
    SAST_RULES.forEach(r => {
      if (r.re.test(views[r.view][idx] || '')) findings.push({ line: idx + 1, rule: L(r.rule), severity: r.severity, snippet: line.trim().slice(0, 300), fix: L(r.fix) });
    });
  });
  return findings;
}

// Dekode JWT (tanpa verifikasi signature). Isi token tidak tepercaya: hanya ditampilkan sebagai teks.
const JWT_TIME_CLAIMS = [
  ['iat', 'diterbitkan'], ['nbf', 'berlaku mulai'], ['exp', 'kedaluwarsa']
];
function b64urlJson(part) {
  const b = part.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '='.repeat((4 - b.length % 4) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))));
}
function relTime(sec) {
  const a = Math.abs(sec), u = a >= 86400 ? [Math.floor(a / 86400), 'hari'] : a >= 3600 ? [Math.floor(a / 3600), 'jam'] : a >= 60 ? [Math.floor(a / 60), 'menit'] : [a, 'detik'];
  return u[0] + ' ' + L(u[1]);
}
function jwtClaims(payload, now) {
  return JWT_TIME_CLAIMS.filter(([k]) => typeof payload[k] === 'number').map(([k, label]) => {
    const diff = payload[k] - now;
    const past = diff <= 0;
    const x = { x: relTime(diff) };
    const status = k === 'exp' ? Lf(past ? 'Kedaluwarsa {x} lalu' : 'Berlaku, sisa {x}', x)
      : k === 'nbf' ? (past ? L('Sudah berlaku') : Lf('Belum berlaku, {x} lagi', x))
      : Lf(past ? '{x} lalu' : 'Di masa depan ({x})', x);
    return { key: k, label: L(label), value: payload[k], date: new Date(payload[k] * 1000).toLocaleString(LANG === 'en' ? 'en-US' : 'id-ID'), status, ok: k === 'exp' ? !past : k === 'nbf' ? past : past };
  });
}
function decodeJwt(raw) {
  const token = raw.trim().replace(/^bearer\s+/i, '').replace(/\s+/g, '');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2 || parts.length > 3) return { error: L('Format JWT tidak valid: harus berupa header.payload[.signature].') };
  try {
    const header = b64urlJson(parts[0]), payload = b64urlJson(parts[1]);
    const alg = String(header.alg || '');
    const warnings = [];
    if (!alg || alg.toLowerCase() === 'none') warnings.push(L('Algoritma "none": token tidak ditandatangani.'));
    else if (!parts[2]) warnings.push(Lf('Signature kosong padahal algoritma {x}.', { x: alg }));
    if (/^HS/i.test(alg)) warnings.push(Lf('Algoritma {x} memakai secret bersama; pastikan secret kuat dan tidak bocor.', { x: alg }));
    if (typeof payload.exp !== 'number') warnings.push(L('Tidak ada klaim exp: token tidak pernah kedaluwarsa.'));
    return { header, payload, headerText: JSON.stringify(header, null, 2), payloadText: JSON.stringify(payload, null, 2), signature: parts[2] || '', claims: jwtClaims(payload, Date.now() / 1000), warnings };
  } catch (e) { return { error: L('Gagal decode token (bukan base64url/JSON yang valid).') }; }
}

// ============================================================
//  Smart Decode: deteksi otomatis lapisan encoding, token/container, dan tebakan
//  ciphertext, lalu dekripsi opsional via WebCrypto. Semua di browser; key/IV hanya
//  di memori (tidak pernah ke localStorage) - OWASP ASVS V6.4 / V8.3.
//  Isi yang didekode tidak tepercaya: hanya ditampilkan sebagai teks (interpolasi Vue).
// ============================================================
// @@DECODE-START (penanda ekstraksi untuk uji node)
const DECODE_I18N = {
  id: {
    tab_decode: 'Smart Decode', dec_title: 'Smart Decode',
    dec_intro: 'Tempel string apa pun (token, cookie, parameter, payload). Encoding berlapis di-decode otomatis (maks 5 level), format token/container dikenali dari strukturnya, dan raw ciphertext ditebak dari panjang + entropi. Semua diproses di browser; key/IV hanya disimpan di memori.',
    dec_ph: 'Tempel string di sini, mis. %48%34%73... / eyJhbGciOi... / U2FsdGVkX1... / gAAAAA...',
    dec_samples: 'Contoh:', dec_clear: 'Bersihkan', dec_input: 'Input', dec_found: 'Terdeteksi',
    dec_conf_high: 'valid', dec_conf_med: 'kemungkinan', dec_conf_low: 'tebakan',
    dec_lbl_conf: 'Keyakinan', dec_lbl_ent: 'Entropi', dec_lbl_len: 'Panjang',
    dec_copy: 'salin', dec_download: 'unduh', dec_more_bytes: '... (+{n} byte lagi)', dec_more_text: '... (dipotong, salin untuk teks lengkap)',
    dec_no_more: 'Tidak ada encoding lain yang dikenali.', dec_max_depth: 'Sudah 5 level (batas maksimum); decode dihentikan.',
    dec_fmt_url: 'URL-encoding (%xx)', dec_fmt_html: 'HTML entity', dec_fmt_esc: 'Escape \\uXXXX / \\xXX', dec_fmt_qp: 'Quoted-printable',
    dec_err_generic: 'Gagal memproses: {e}', dec_err_inflate: 'Data kompresi rusak / gagal di-decompress: {e}',
    dec_err_toobig: 'Hasil decompress lebih dari 20 MB; dihentikan (cegah decompression bomb).',
    dec_err_nodecomp: 'Browser tidak mendukung DecompressionStream.', dec_err_nosubtle: 'WebCrypto (crypto.subtle) tidak tersedia; buka lewat https:// atau file lokal.',
    dec_err_op: 'Gagal: key/IV salah, padding tidak valid, atau tag autentikasi tidak cocok.',
    dec_err_keylen: 'Key terbaca sebagai {enc} = {n} byte, padahal {mode} butuh {want} byte. Ganti format key (hex/base64/utf8) atau cek panjangnya.',
    dec_fmt_quotes: 'Tanda kutip dihapus', dec_fmt_prefix: 'Prefix "{x}" dihapus', dec_fmt_cookie: 'Nilai cookie/parameter (nama= dan atribut dihapus)',
    dec_jwt_broken: 'JWT rusak', dec_uuid_note: 'UUID hanya penanda unik, bukan data terenkripsi; v1/v6/v7 menyimpan waktu pembuatan.', dec_d_uuid_ver: 'Versi', dec_d_uuid_time: 'Waktu dibuat', dec_err_enc: 'Nilai bukan {enc} yang valid.',
    dec_err_iv: 'IV dibutuhkan: isi IV atau centang "IV di depan ciphertext".', dec_err_block: 'Panjang ciphertext bukan kelipatan 16 byte.',
    dec_err_mac: 'MAC tidak cocok: APP_KEY salah atau payload diubah.', dec_err_fernet_mac: 'HMAC Fernet tidak cocok: key salah atau token diubah.',
    dec_err_pem: 'Isi PEM bukan base64 yang valid.', dec_mac_bad_but_ok: 'Peringatan: MAC tidak cocok walau dekripsi berhasil (payload mungkin diubah).',
    dec_bad_plain: 'Berhasil didekripsi, tapi hasilnya bukan teks/JSON/format yang dikenal (mungkin key/IV/mode salah).',
    dec_ok_json: 'Berhasil: JSON valid', dec_ok_text: 'Berhasil: teks UTF-8 valid', dec_ok_file: 'Berhasil: data biner berformat dikenal',
    dec_file_note: 'File biner dikenali dari magic bytes. Isi tidak ditampilkan; pakai tombol unduh (hati-hati saat membukanya).',
    dec_bin_unknown: 'Biner tidak dikenali', dec_guess_title: 'Mungkin raw ciphertext (TEBAKAN)',
    dec_guess_warn: 'Ini hanya TEBAKAN dari panjang + entropi. Tanpa key yang benar, data tidak bisa didekripsi.',
    dec_guess_digest: 'Panjang ini juga cocok untuk digest hash (MD5 16, SHA-1 20, SHA-256 32, SHA-512 64 byte) atau raw key.',
    dec_guess_cbc: 'Kelipatan 16 byte: kemungkinan AES-CBC/ECB (key 16/24/32 byte; CBC butuh IV 16 byte, sering ditaruh di 16 byte pertama).',
    dec_guess_ecb: 'Ada blok 16 byte yang berulang: kemungkinan mode ECB (lemah, pola plaintext terlihat) - OWASP ASVS V6.2.',
    dec_guess_gcm: 'Bukan kelipatan 16 dan >= 28 byte: kemungkinan AES-GCM dengan IV 12 byte di depan dan tag 16 byte di belakang.',
    dec_guess_ctr: 'Bukan kelipatan 16: bisa juga cipher stream (AES-CTR / ChaCha20).',
    dec_guess_lowent: 'Entropi rendah: kemungkinan bukan ciphertext (data biner terstruktur / encoding lain).',
    dec_salted_note: 'Format OpenSSL enc / CryptoJS.AES.encrypt(teks, passphrase): cukup passphrase (key & IV dibentuk dari passphrase via EVP_BytesToKey).',
    dec_java_warn: 'Objek Java serialized: jangan deserialize data dari sumber tidak tepercaya (risiko RCE gadget chain) - OWASP A08:2021, ASVS V5.5.',
    dec_d_classes: 'Kelas', dec_fernet_note: 'Token Fernet (Python cryptography): butuh key Fernet 32 byte base64url (16 byte HMAC + 16 byte AES-128).',
    dec_d_time: 'Waktu dibuat', dec_ec_unc: 'Kemungkinan public key EC tidak terkompresi (0x04 || X || Y) untuk ECDH/ECDSA.',
    dec_ec_comp: 'Kemungkinan public key EC P-256 terkompresi (0x02/0x03 || X).',
    dec_jwt_note: 'Di-decode tanpa verifikasi signature. Jangan langsung percaya isi klaim sebelum signature diverifikasi di server (RFC 7519, RFC 8725).',
    dec_jwe_note: 'JWE terenkripsi (RFC 7516): butuh key sesuai alg={alg} / enc={enc} (dir = key simetris langsung; RSA-OAEP = private key RSA; ECDH-ES = private key EC; A*KW = key AES untuk key wrapping).',
    dec_aspnet_note: 'ASP.NET Core Data Protection: dienkripsi dengan key ring di server (purpose + key id). Tidak bisa didekripsi di browser tanpa salinan key ring + algoritma server.',
    dec_php_warn: 'PHP serialize(): jangan unserialize() data dari sumber tidak tepercaya (object injection / POP chain) - OWASP A08:2021, ASVS V5.5.',
    dec_pwhash_note: 'Hash satu arah: tidak bisa didekripsi, hanya bisa ditebak lewat cracking. Pastikan password di-hash dengan algoritma lambat (ASVS V2.4).',
    dec_hexhash_note: 'Identifikasi dari panjang saja; bisa juga raw key/IV/ciphertext dalam hex. Hash tidak bisa didekripsi.',
    dec_pem_enc: 'Private key terenkripsi (butuh passphrase).', dec_pem_priv: 'Berisi PRIVATE KEY: jangan dibagikan / di-commit (ASVS V6.4).',
    dec_asn_cert: 'Sertifikat X.509', dec_asn_csr: 'Certificate Signing Request (CSR)', dec_asn_spki: 'Public key (SubjectPublicKeyInfo)',
    dec_asn_pkcs8: 'Private key (PKCS#8)', dec_asn_epkcs8: 'Private key terenkripsi (PKCS#8)', dec_asn_rsapriv: 'Private key RSA (PKCS#1)',
    dec_asn_rsapub: 'Public key RSA (PKCS#1)', dec_asn_ecpriv: 'Private key EC (SEC1)', dec_asn_generic: 'struktur SEQUENCE (jenis tidak dikenali)',
    dec_d_subject: 'Subject', dec_d_issuer: 'Issuer', dec_d_from: 'Berlaku mulai', dec_d_to: 'Berlaku sampai', dec_d_expired: 'KEDALUWARSA',
    dec_d_serial: 'Serial', dec_d_key: 'Key', dec_d_sigalg: 'Algoritma signature', dec_d_alg: 'Algoritma', dec_d_der: 'Panjang DER',
    dec_d_salt: 'Salt', dec_d_ct: 'Ciphertext', dec_d_cipher: 'Cipher', dec_d_iv: 'IV', dec_d_cost: 'Cost',
    dec_laravel_note: 'Payload Laravel encrypt()/Crypt: butuh APP_KEY (base64:...). CBC diverifikasi dengan MAC HMAC-SHA256(iv+value); GCM bila ada tag.',
    dec_smp_pass: 'Contoh CryptoJS - passphrase demo: {p}', dec_smp_key: 'Contoh AES-256-GCM (IV 12 byte di depan) - key demo (hex): {k}',
    dec_smp_appkey: 'Contoh Laravel - APP_KEY demo: {k}', dec_smp_fernet: 'Contoh Fernet - key demo: {k}',
    dec_smp_bcrypt: 'Contoh hash bcrypt publik (hanya identifikasi, tidak bisa didekripsi).', dec_smp_chain: 'Contoh rantai urlencode(base64(gzip(JSON))).',
    dec_smp_jwt: 'Contoh JWT dummy (signature palsu).', dec_smp_hash: 'Contoh SHA-256 (hex) dari teks "contoh".',
    dec_chain_title: 'Hasil dekripsi ({v}) - di-decode lagi', dec_form_title: 'Dekripsi',
    dec_type_cryptojs: 'CryptoJS / OpenSSL passphrase', dec_type_laravel: 'Laravel encrypt()', dec_type_fernet: 'Fernet', dec_type_aes: 'AES (tebakan)',
    dec_f_key: 'Key', dec_f_iv: 'IV', dec_f_mode: 'Mode', dec_f_pass: 'Passphrase', dec_f_tag: 'Tag (GCM)', dec_f_aad: 'AAD (teks)',
    dec_f_ivprefix: 'IV di depan ciphertext', dec_f_auto: 'auto',
    dec_btn_dec: 'Dekripsi', dec_btn_all: 'Coba semua variasi', dec_th_variant: 'Variasi', dec_th_result: 'Hasil',
    dec_mem_note: 'Key/IV/passphrase hanya di memori tab ini dan tidak disimpan.'
  },
  en: {
    tab_decode: 'Smart Decode', dec_title: 'Smart Decode',
    dec_intro: 'Paste any string (token, cookie, parameter, payload). Encoding layers are unwrapped automatically (up to 5 levels), token/container formats are recognized by structure, and raw ciphertext is guessed from length + entropy. Everything runs in the browser; keys/IVs stay in memory only.',
    dec_ph: 'Paste a string here, e.g. %48%34%73... / eyJhbGciOi... / U2FsdGVkX1... / gAAAAA...',
    dec_samples: 'Samples:', dec_clear: 'Clear', dec_input: 'Input', dec_found: 'Detected',
    dec_conf_high: 'valid', dec_conf_med: 'likely', dec_conf_low: 'guess',
    dec_lbl_conf: 'Confidence', dec_lbl_ent: 'Entropy', dec_lbl_len: 'Length',
    dec_copy: 'copy', dec_download: 'download', dec_more_bytes: '... (+{n} more bytes)', dec_more_text: '... (truncated, copy for the full text)',
    dec_no_more: 'No further encoding layer recognized.', dec_max_depth: '5-level limit reached; decoding stopped.',
    dec_fmt_url: 'URL encoding (%xx)', dec_fmt_html: 'HTML entity', dec_fmt_esc: 'Escape \\uXXXX / \\xXX', dec_fmt_qp: 'Quoted-printable',
    dec_err_generic: 'Processing failed: {e}', dec_err_inflate: 'Compressed data is corrupt / decompression failed: {e}',
    dec_err_toobig: 'Decompressed output exceeds 20 MB; stopped (decompression bomb guard).',
    dec_err_nodecomp: 'This browser does not support DecompressionStream.', dec_err_nosubtle: 'WebCrypto (crypto.subtle) is unavailable; open via https:// or a local file.',
    dec_err_op: 'Failed: wrong key/IV, invalid padding, or authentication tag mismatch.',
    dec_err_keylen: 'Key read as {enc} = {n} bytes, but {mode} needs {want} bytes. Change the key format (hex/base64/utf8) or check its length.',
    dec_fmt_quotes: 'Quotes removed', dec_fmt_prefix: 'Prefix "{x}" removed', dec_fmt_cookie: 'Cookie/parameter value (name= and attributes removed)',
    dec_jwt_broken: 'Broken JWT', dec_uuid_note: 'A UUID is only a unique identifier, not encrypted data; v1/v6/v7 embed their creation time.', dec_d_uuid_ver: 'Version', dec_d_uuid_time: 'Created', dec_err_enc: 'Value is not valid {enc}.',
    dec_err_iv: 'IV required: fill in the IV or tick "IV prepended to ciphertext".', dec_err_block: 'Ciphertext length is not a multiple of 16 bytes.',
    dec_err_mac: 'MAC mismatch: wrong APP_KEY or tampered payload.', dec_err_fernet_mac: 'Fernet HMAC mismatch: wrong key or tampered token.',
    dec_err_pem: 'PEM body is not valid base64.', dec_mac_bad_but_ok: 'Warning: MAC mismatch although decryption succeeded (payload may be tampered).',
    dec_bad_plain: 'Decrypted, but output is not text/JSON or a known format (likely wrong key/IV/mode).',
    dec_ok_json: 'Success: valid JSON', dec_ok_text: 'Success: valid UTF-8 text', dec_ok_file: 'Success: binary data in a known format',
    dec_file_note: 'Binary file recognized by magic bytes; content not shown, use the download button (open with care).',
    dec_bin_unknown: 'Unrecognized binary', dec_guess_title: 'Possibly raw ciphertext (GUESS)',
    dec_guess_warn: 'This is a GUESS from length + entropy, not a certainty. Without the right key, data cannot be decrypted.',
    dec_guess_digest: 'This length also fits a hash digest (MD5 16, SHA-1 20, SHA-256 32, SHA-512 64 bytes) or a raw key.',
    dec_guess_cbc: 'Multiple of 16 bytes: possibly AES-CBC/ECB (16/24/32-byte key; CBC needs a 16-byte IV, often in the first 16 bytes).',
    dec_guess_ecb: 'A repeated 16-byte block exists: possibly ECB mode (weak, leaks plaintext patterns) - OWASP ASVS V6.2.',
    dec_guess_gcm: 'Not a multiple of 16 and >= 28 bytes: possibly AES-GCM with a 12-byte leading IV and 16-byte trailing tag.',
    dec_guess_ctr: 'Not a multiple of 16: could also be a stream cipher (AES-CTR / ChaCha20).',
    dec_guess_lowent: 'Low entropy: probably not ciphertext (structured binary / other encoding).',
    dec_salted_note: 'OpenSSL enc / CryptoJS.AES.encrypt(text, passphrase) format: only the passphrase is needed (key & IV derived via EVP_BytesToKey).',
    dec_java_warn: 'Java serialized object: never deserialize untrusted data (RCE gadget chain risk) - OWASP A08:2021, ASVS V5.5.',
    dec_d_classes: 'Classes', dec_fernet_note: 'Fernet token (Python cryptography): needs a 32-byte base64url Fernet key (16-byte HMAC + 16-byte AES-128).',
    dec_d_time: 'Created at', dec_ec_unc: 'Possibly an uncompressed EC public key (0x04 || X || Y) for ECDH/ECDSA.',
    dec_ec_comp: 'Possibly a compressed EC P-256 public key (0x02/0x03 || X).',
    dec_jwt_note: 'Decoded without signature verification. Do not trust the claims until the signature is verified server-side (RFC 7519, RFC 8725).',
    dec_jwe_note: 'Encrypted JWE (RFC 7516): needs the key matching alg={alg} / enc={enc} (dir = direct symmetric key; RSA-OAEP = RSA private key; ECDH-ES = EC private key; A*KW = AES wrapping key).',
    dec_aspnet_note: 'ASP.NET Core Data Protection: encrypted with the server key ring (purpose + key id). Cannot be decrypted in the browser without a copy of the key ring + server algorithms.',
    dec_php_warn: 'PHP serialize(): never unserialize() untrusted data (object injection / POP chain) - OWASP A08:2021, ASVS V5.5.',
    dec_pwhash_note: 'One-way hash: cannot be decrypted, only tested by guessing (cracking). Make sure passwords use a slow hash (ASVS V2.4).',
    dec_hexhash_note: 'Identified by length only; may also be a raw key/IV/ciphertext in hex. Hashes cannot be decrypted.',
    dec_pem_enc: 'Encrypted private key (passphrase required).', dec_pem_priv: 'Contains a PRIVATE KEY: do not share / commit it (ASVS V6.4).',
    dec_asn_cert: 'X.509 certificate', dec_asn_csr: 'Certificate Signing Request (CSR)', dec_asn_spki: 'Public key (SubjectPublicKeyInfo)',
    dec_asn_pkcs8: 'Private key (PKCS#8)', dec_asn_epkcs8: 'Encrypted private key (PKCS#8)', dec_asn_rsapriv: 'RSA private key (PKCS#1)',
    dec_asn_rsapub: 'RSA public key (PKCS#1)', dec_asn_ecpriv: 'EC private key (SEC1)', dec_asn_generic: 'SEQUENCE structure (unknown type)',
    dec_d_subject: 'Subject', dec_d_issuer: 'Issuer', dec_d_from: 'Valid from', dec_d_to: 'Valid until', dec_d_expired: 'EXPIRED',
    dec_d_serial: 'Serial', dec_d_key: 'Key', dec_d_sigalg: 'Signature algorithm', dec_d_alg: 'Algorithm', dec_d_der: 'DER length',
    dec_d_salt: 'Salt', dec_d_ct: 'Ciphertext', dec_d_cipher: 'Cipher', dec_d_iv: 'IV', dec_d_cost: 'Cost',
    dec_laravel_note: 'Laravel encrypt()/Crypt payload: needs APP_KEY (base64:...). CBC is verified with MAC HMAC-SHA256(iv+value); GCM when a tag is present.',
    dec_smp_pass: 'CryptoJS sample - demo passphrase: {p}', dec_smp_key: 'AES-256-GCM sample (12-byte IV prepended) - demo key (hex): {k}',
    dec_smp_appkey: 'Laravel sample - demo APP_KEY: {k}', dec_smp_fernet: 'Fernet sample - demo key: {k}',
    dec_smp_bcrypt: 'Public bcrypt hash sample (identification only, cannot be decrypted).', dec_smp_chain: 'Sample nested encoding: urlencode(base64(gzip(JSON))).',
    dec_smp_jwt: 'Dummy JWT sample (fake signature).', dec_smp_hash: 'SHA-256 (hex) sample of the text "contoh".',
    dec_chain_title: 'Decryption result ({v}) - recursive decode', dec_form_title: 'Decrypt',
    dec_type_cryptojs: 'CryptoJS / OpenSSL passphrase', dec_type_laravel: 'Laravel encrypt()', dec_type_fernet: 'Fernet', dec_type_aes: 'AES (guess)',
    dec_f_key: 'Key', dec_f_iv: 'IV', dec_f_mode: 'Mode', dec_f_pass: 'Passphrase', dec_f_tag: 'Tag (GCM)', dec_f_aad: 'AAD (text)',
    dec_f_ivprefix: 'IV prepended to ciphertext', dec_f_auto: 'auto',
    dec_btn_dec: 'Decrypt', dec_btn_all: 'Try all variants', dec_th_variant: 'Variant', dec_th_result: 'Result',
    dec_mem_note: 'Keys/IVs/passphrases live only in this tab\'s memory and are never stored.'
  }
};
// Kamus i18n.js tetap menang bila kelak kunci yang sama ditambahkan di sana.
Object.keys(DECODE_I18N).forEach(l => { I18N[l] = Object.assign({}, DECODE_I18N[l], I18N[l] || {}); });
function dtr(key, vars) { return tr(key).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m)); }

const DEC_TE = new TextEncoder();
const DEC_MAX_DEPTH = 5, DEC_MAX_OUT = 20 * 1024 * 1024, DEC_VIEW_MAX = 50000;
// ---- Util byte
function utf8Strict(b) { try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return null; } }
// Teks "terbaca": hampir tanpa karakter kontrol (selain tab/CR/LF) dan tanpa U+FFFD.
function isReadable(s) {
  if (!s) return false;
  let bad = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if ((c < 32 && c !== 9 && c !== 10 && c !== 13) || (c >= 0x7f && c < 0xa0) || c === 0xfffd) bad++;
  }
  return bad / s.length <= 0.02;
}
function bytesToText(b) { const s = utf8Strict(b); return s !== null && isReadable(s) ? s : null; }
function decVal(bytes) { return { bytes, text: bytesToText(bytes) }; }
function shannon(b) {
  if (!b.length) return 0;
  const f = new Array(256).fill(0);
  for (const x of b) f[x]++;
  return f.reduce((h, n) => (n ? h - (n / b.length) * Math.log2(n / b.length) : h), 0);
}
const hx2 = x => (x < 16 ? '0' : '') + x.toString(16);
function toHex(b) { return Array.from(b, hx2).join(''); }
function fromHex(s) { const out = new Uint8Array(s.length >> 1); for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16); return out; }
function b64ToBytes(s) {
  let c = String(s).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  c += '='.repeat((4 - c.length % 4) % 4);
  return Uint8Array.from(atob(c), ch => ch.charCodeAt(0));
}
function bytesToB64(b) { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
function bytesToB64u(b, keepPad) { const s = bytesToB64(b).replace(/\+/g, '-').replace(/\//g, '_'); return keepPad ? s : s.replace(/=+$/, ''); }
function concatBytes(list) {
  const out = new Uint8Array(list.reduce((n, a) => n + a.length, 0));
  let o = 0;
  list.forEach(a => { out.set(a, o); o += a.length; });
  return out;
}
function startsWithBytes(b, sig) { return b.length >= sig.length && sig.every((x, i) => b[i] === x); }
function sameBytes(a, b) { return a.length === b.length && a.every((x, i) => x === b[i]); }
function pushAll(out, arr) { for (const x of arr) out.push(x); }
function hexdump(b, max) {
  const n = Math.min(b.length, max || 256), lines = [];
  for (let i = 0; i < n; i += 16) {
    const row = b.subarray(i, Math.min(i + 16, n));
    const asc = Array.from(row, x => (x >= 32 && x < 127 ? String.fromCharCode(x) : '.')).join('');
    lines.push(i.toString(16).padStart(6, '0') + '  ' + Array.from(row, hx2).join(' ').padEnd(47) + '  ' + asc);
  }
  if (b.length > n) lines.push(dtr('dec_more_bytes', { n: b.length - n }));
  return lines.join('\n');
}
function clipText(s) { return s.length > DEC_VIEW_MAX ? s.slice(0, DEC_VIEW_MAX) + '\n' + tr('dec_more_text') : s; }
// Jalankan TransformStream (de/kompresi) dengan batas ukuran hasil (cegah decompression bomb).
async function streamBytes(b, ts) {
  const reader = new Blob([b]).stream().pipeThrough(ts).getReader(), parts = [];
  let total = 0;
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    total += r.value.length;
    if (total > DEC_MAX_OUT) { reader.cancel().catch(() => { /* abaikan */ }); throw new Error(tr('dec_err_toobig')); }
    parts.push(r.value);
  }
  return concatBytes(parts);
}
function inflateBytes(b, fmt) {
  if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error(tr('dec_err_nodecomp')));
  return streamBytes(b, new DecompressionStream(fmt));
}

// ---- Magic bytes
const DEC_MAGIC = [
  { sig: [0x25, 0x50, 0x44, 0x46], name: 'PDF', mime: 'application/pdf', ext: 'pdf' },
  { sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], name: 'PNG', mime: 'image/png', ext: 'png' },
  { sig: [0xff, 0xd8, 0xff], name: 'JPEG', mime: 'image/jpeg', ext: 'jpg' },
  { sig: [0x47, 0x49, 0x46, 0x38], name: 'GIF', mime: 'image/gif', ext: 'gif' },
  { sig: [0x50, 0x4b, 0x03, 0x04], name: 'ZIP (PK) / docx / jar / apk', mime: 'application/zip', ext: 'zip' },
  { sig: [0x50, 0x4b, 0x05, 0x06], name: 'ZIP (PK, kosong)', mime: 'application/zip', ext: 'zip' }
];
const SIG_SALTED = Array.from('Salted__', c => c.charCodeAt(0)), SIG_JAVA = [0xac, 0xed, 0x00, 0x05];
function fileMagic(b) { return DEC_MAGIC.find(m => startsWithBytes(b, m.sig)) || null; }
function compressFmt(b) {
  if (b.length > 10 && b[0] === 0x1f && b[1] === 0x8b) return 'gzip';
  if (b.length > 2 && b[0] === 0x78 && ((b[0] << 8) | b[1]) % 31 === 0) return 'deflate';
  return '';
}

// ---- ASN.1 DER minimal (TLV, panjang definit)
function asn1(b, off, end, depth) {
  const out = [];
  if (depth > 24) throw new Error('asn1 depth');
  while (off < end) {
    const tag = b[off++];
    if ((tag & 0x1f) === 0x1f || off >= end) throw new Error('asn1 tag');
    let len = b[off++];
    if (len & 0x80) {
      const n = len & 0x7f;
      if (!n || n > 4) throw new Error('asn1 len');
      len = 0;
      for (let i = 0; i < n; i++) len = len * 256 + b[off++];
    }
    const node = { tag, vs: off, ve: off + len, kids: null };
    if (node.ve > end) throw new Error('asn1 overflow');
    if (tag & 0x20) node.kids = asn1(b, node.vs, node.ve, depth + 1);
    out.push(node);
    off = node.ve;
  }
  return out;
}
function derTop(b) {
  if (b[0] !== 0x30 || b.length < 8) return null;
  try { const t = asn1(b, 0, b.length, 0); return t.length === 1 ? t[0] : null; } catch (e) { return null; }
}
const OID_NAMES = {
  '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.10': 'O', '2.5.4.11': 'OU', '1.2.840.113549.1.9.1': 'E',
  '1.2.840.113549.1.1.1': 'RSA', '1.2.840.10045.2.1': 'EC', '1.3.101.112': 'Ed25519', '1.3.101.110': 'X25519',
  '1.2.840.10045.3.1.7': 'P-256', '1.3.132.0.34': 'P-384', '1.3.132.0.35': 'P-521',
  '1.2.840.113549.1.1.5': 'sha1WithRSA', '1.2.840.113549.1.1.11': 'sha256WithRSA', '1.2.840.113549.1.1.12': 'sha384WithRSA',
  '1.2.840.113549.1.1.13': 'sha512WithRSA', '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256', '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
  '1.2.840.113549.1.5.13': 'PBES2'
};
function oidStr(b, n) {
  const v = b.subarray(n.vs, n.ve), parts = [Math.floor(v[0] / 40), v[0] % 40];
  let x = 0;
  for (let i = 1; i < v.length; i++) { x = x * 128 + (v[i] & 0x7f); if (!(v[i] & 0x80)) { parts.push(x); x = 0; } }
  return parts.join('.');
}
function oidName(b, n) { if (!n || n.tag !== 6) return '-'; const o = oidStr(b, n); return OID_NAMES[o] || o; }
function asnStr(b, n) { const v = b.subarray(n.vs, n.ve); return utf8Strict(v) || String.fromCharCode.apply(null, v); }
function asnName(b, n) {
  const parts = [];
  ((n && n.kids) || []).forEach(set => (set.kids || []).forEach(atv => {
    const [o, v] = atv.kids || [];
    if (o && v) parts.push(oidName(b, o) + '=' + asnStr(b, v));
  }));
  return parts.join(', ') || '-';
}
function asnTime(b, n) {
  const s = asnStr(b, n), full = n.tag === 0x17 ? (Number(s.slice(0, 2)) < 50 ? '20' : '19') + s : s;
  const m = rx1(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?/g, full);
  if (!m) return { text: s, ms: NaN };
  const iso = m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + (m[6] || '00') + 'Z';
  return { text: iso.replace('T', ' '), ms: Date.parse(iso) };
}
function intBits(b, n) { let i = n.vs; while (i < n.ve - 1 && b[i] === 0) i++; return (n.ve - i) * 8; }
// Jenis kunci dari AlgorithmIdentifier (+ panjang modulus RSA bila BIT STRING tersedia).
function keyInfo(b, spki) {
  const [alg, bits] = (spki && spki.kids) || [];
  if (!alg || !alg.kids) return '-';
  const algName = oidName(b, alg.kids[0]), p = alg.kids[1];
  let s = algName + (p && p.tag === 6 ? ' ' + oidName(b, p) : '');
  if (algName === 'RSA' && bits && bits.tag === 3) {
    try { s += ' ' + intBits(b, asn1(b, bits.vs + 1, bits.ve, 0)[0].kids[0]) + ' bit'; } catch (e) { /* abaikan */ }
  }
  return s;
}
function describeSigned(b, k, add) {
  const tbs = k[0].kids || [], o = tbs[0] && tbs[0].tag === 0xa0 ? 1 : 0, val = tbs[o + 3];
  add('dec_d_sigalg', oidName(b, k[1].kids && k[1].kids[0]));
  if (tbs[o] && tbs[o].tag === 2 && val && val.kids && val.kids.length === 2) {
    const to = asnTime(b, val.kids[1]);
    add('dec_d_subject', asnName(b, tbs[o + 4]));
    add('dec_d_issuer', asnName(b, tbs[o + 2]));
    add('dec_d_from', asnTime(b, val.kids[0]).text);
    add('dec_d_to', to.text + (to.ms < Date.now() ? ' (' + tr('dec_d_expired') + ')' : ''));
    add('dec_d_serial', toHex(b.subarray(tbs[o].vs, tbs[o].ve)));
    add('dec_d_key', keyInfo(b, tbs[o + 5]));
    return 'dec_asn_cert';
  }
  add('dec_d_subject', asnName(b, tbs[1]));
  add('dec_d_key', keyInfo(b, tbs[2]));
  return 'dec_asn_csr';
}
// Kenali jenis struktur DER (sertifikat / public key / private key); kembalikan kunci i18n jenisnya.
function describeDer(step, b, top) {
  const k = top.kids || [], tg = i => (k[i] ? k[i].tag : -1), add = (l, v) => step.details.push([tr(l), v]);
  add('dec_d_der', b.length + ' byte');
  try {
    if (k.length === 3 && tg(0) === 0x30 && tg(1) === 0x30 && tg(2) === 3) return describeSigned(b, k, add);
    if (k.length === 2 && tg(0) === 0x30 && tg(1) === 3) { add('dec_d_key', keyInfo(b, top)); return 'dec_asn_spki'; }
    if (k.length >= 3 && tg(0) === 2 && tg(1) === 0x30 && tg(2) === 4) { add('dec_d_key', keyInfo(b, { kids: [k[1]] })); return 'dec_asn_pkcs8'; }
    if (k.length === 2 && tg(0) === 0x30 && tg(1) === 4) { add('dec_d_alg', oidName(b, k[0].kids && k[0].kids[0])); return 'dec_asn_epkcs8'; }
    if (k.length === 9 && k.every(n => n.tag === 2)) { add('dec_d_key', 'RSA ' + intBits(b, k[1]) + ' bit'); return 'dec_asn_rsapriv'; }
    if (k.length === 2 && k.every(n => n.tag === 2)) { add('dec_d_key', 'RSA ' + intBits(b, k[0]) + ' bit'); return 'dec_asn_rsapub'; }
    if (k.length >= 2 && tg(0) === 2 && tg(1) === 4 && b[k[0].vs] === 1) return 'dec_asn_ecpriv';
  } catch (e) { /* struktur tak lazim: jatuh ke generik */ }
  return 'dec_asn_generic';
}
function applyDer(step, b, top, prefix) {
  const kind = describeDer(step, b, top);
  setFound(step, (prefix || 'ASN.1 DER') + ': ' + tr(kind), kind === 'dec_asn_generic' ? 'low' : 'high');
  if (/priv/.test(kind)) step.warnings.push(tr('dec_pem_priv'));
}

// ---- Langkah (satu node pohon hasil)
function decStep(format, conf, v) {
  const isText = v.text !== null;
  return { format, conf, byteLen: v.bytes.length, entropy: shannon(v.bytes).toFixed(2), isText,
    view: isText ? clipText(v.text) : hexdump(v.bytes), copyText: isText ? v.text : toHex(v.bytes),
    found: '', foundConf: '', notes: [], warnings: [], details: [], crypto: null, file: null, bytes: v.bytes };
}
function setFound(step, name, conf) { step.found = name; step.foundConf = conf; }

// ---- Pengenalan token/container dari teks (true = berhenti di sini)
function recPem(step, s) {
  const m = rx1(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g, s);
  if (!m) return false;
  const label = m[1], body = m[2].split(/\r?\n/).filter(l => l && !l.includes(':')).join('');
  let der = null;
  try { der = b64ToBytes(body); } catch (e) { step.warnings.push(tr('dec_err_pem')); }
  const top = der && derTop(der);
  if (top) applyDer(step, der, top, 'PEM ' + label);
  else setFound(step, 'PEM ' + label, 'med');
  if (/Proc-Type:\s*4,ENCRYPTED/.test(m[2]) || /ENCRYPTED/.test(label)) step.warnings.push(tr('dec_pem_enc'));
  if (/PRIVATE KEY/.test(label) && !step.warnings.includes(tr('dec_pem_priv'))) step.warnings.push(tr('dec_pem_priv'));
  return true;
}
function recJwt(step, s) {
  // Diawali eyJ ({"…) dan bertitik = bentuk JWT (JWE yang valid sudah ditangani recJwe lebih dulu).
  if (!/^eyJ[\w-]*\./.test(s)) return false;
  const j = /^eyJ[\w-]*\.[\w-]+\.[\w-]*$/.test(s) ? decodeJwt(s) : { error: L('Format JWT tidak valid: harus berupa header.payload[.signature].') };
  if (!j) return false;
  if (j.error) { setFound(step, tr('dec_jwt_broken'), 'med'); step.warnings.push(j.error); return true; }
  setFound(step, 'JWT (JWS)', 'high');
  step.details.push(['alg', String(j.header.alg || '-')]);
  j.claims.forEach(c => step.details.push([c.key + ' (' + c.label + ')', c.value + ' → ' + c.date + ' · ' + c.status]));
  j.warnings.forEach(w => step.warnings.push(w));
  step.notes.push(tr('dec_jwt_note'));
  step.view = clipText('Header:\n' + j.headerText + '\n\nPayload:\n' + j.payloadText);
  return true;
}
function recJwe(step, s) {
  if (!/^eyJ[\w-]*(?:\.[\w-]*){4}$/.test(s)) return false;
  let h;
  try { h = JSON.parse(utf8Strict(b64ToBytes(s.split('.')[0]))); } catch (e) { return false; }
  setFound(step, 'JWE compact', 'high');
  ['alg', 'enc', 'kid', 'zip'].forEach(k => { if (h[k] !== undefined) step.details.push([k, String(h[k])]); });
  step.notes.push(dtr('dec_jwe_note', { alg: h.alg || '?', enc: h.enc || '?' }));
  step.view = clipText(JSON.stringify(h, null, 2));
  return true;
}
function recAspNet(step, s) {
  if (!/^CfDJ8[\w-]{20,}$/.test(s)) return false;
  setFound(step, 'ASP.NET Core Data Protection', 'high');
  step.notes.push(tr('dec_aspnet_note'));
  return true;
}
function recPhpSer(step, s) {
  if (!/^(?:a:\d+:\{|[OC]:\d+:"|s:\d+:"|i:-?\d+;|b:[01];|d:-?[\d.E+-]+;|N;)/.test(s)) return false;
  setFound(step, 'PHP serialize()', 'high');
  step.warnings.push(tr('dec_php_warn'));
  const cls = [...new Set(Array.from(s.matchAll(/[OC]:\d+:"([^"]{1,200})"/g), m => m[1]))];
  if (cls.length) step.details.push([tr('dec_d_classes'), cls.slice(0, 10).join(', ')]);
  return true;
}
const PW_HASHES = [
  [/^\$2[abxy]?\$\d{2}\$[./A-Za-z0-9]{53}$/, 'bcrypt'], [/^\$argon2(?:id|i|d)\$/, 'Argon2'],
  [/^\$6\$/, 'sha512crypt'], [/^\$5\$/, 'sha256crypt'], [/^\$1\$/, 'md5crypt'], [/^\$y\$/, 'yescrypt'],
  [/^pbkdf2_sha(?:1|256)\$\d+\$/, 'PBKDF2 (Django)'], [/^\$pbkdf2(?:-sha\d+)?\$/, 'PBKDF2 (passlib)']
];
const HEX_HASHES = { 32: 'MD5 / NTLM', 40: 'SHA-1', 64: 'SHA-256 / SHA3-256', 128: 'SHA-512 / SHA3-512' };
function recPwHash(step, s) {
  const hit = PW_HASHES.find(([re]) => re.test(s));
  if (!hit) return false;
  setFound(step, 'Hash password ' + hit[1], 'high');
  if (hit[1] === 'bcrypt') step.details.push([tr('dec_d_cost'), s.split('$')[2]]);
  step.notes.push(tr('dec_pwhash_note'));
  return true;
}
function recHexHash(step, s) {
  if (!HEX_HASHES[s.length] || !/^[0-9a-fA-F]+$/.test(s) || bytesToText(fromHex(s))) return false;
  setFound(step, 'Hash ' + HEX_HASHES[s.length] + ' (hex)', 'med');
  step.notes.push(tr('dec_hexhash_note'));
  return true;
}
// UUID (RFC 9562): versi & variant; v1/v6 = 100 ns sejak 1582-10-15, v7 = milidetik Unix di 48 bit awal.
function recUuid(step, s) {
  const m = rx1(/^\{?([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\}?$/gi, s);
  if (!m) return false;
  const ver = parseInt(m[3][0], 16), variant = parseInt(m[4][0], 16);
  setFound(step, 'UUID' + (ver >= 1 && ver <= 8 ? ' v' + ver : ''), 'high');
  step.details.push([tr('dec_d_uuid_ver'), String(ver)], ['Variant', variant >= 8 && variant <= 11 ? 'RFC 9562' : variant < 8 ? 'NCS' : 'Microsoft']);
  let ms = null;
  if (ver === 1 || ver === 6) {
    const hex = ver === 1 ? m[3].slice(1) + m[2] + m[1] : m[1] + m[2] + m[3].slice(1);
    ms = Number((BigInt('0x' + hex) - 122192928000000000n) / 10000n);
  } else if (ver === 7) ms = parseInt(m[1] + m[2], 16);
  if (ms !== null && ms > 0) step.details.push([tr('dec_d_uuid_time'), new Date(ms).toISOString()]);
  step.notes.push(tr('dec_uuid_note'));
  return true;
}
const DEC_TEXT_RULES = [recPem, recJwe, recJwt, recUuid, recAspNet, recPhpSer, recPwHash, recHexHash];
// Pembungkus yang sering ikut tersalin dari header/cookie/JSON: kutip, "Authorization:", "Bearer ", "nama=…; Path=/".
const WRAP_SCHEME_RE = /^(Bearer|Token|JWT|Basic|Digest|Negotiate)\s+(\S+)$/gi;
const WRAP_HEADER_RE = /^(Authorization|Proxy-Authorization|Cookie|Set-Cookie|X-[\w-]+|Api-?Key|Token)\s*:\s*(\S[\s\S]*)$/gi;
const WRAP_COOKIE_RE = /^[\w.!#$%&'*+^|~-]{1,64}=([^;\s]{8,})(?:\s*;[\s\S]*)?$/g;
const wrapStep = (format, text) => ({ format, conf: 'high', val: decVal(DEC_TE.encode(text)) });
function layerWrapper(s) {
  const q = s[0];
  if (s.length > 2 && (q === '"' || q === "'" || q === '`') && s.endsWith(q)) return wrapStep(tr('dec_fmt_quotes'), s.slice(1, -1).trim());
  let m = rx1(WRAP_SCHEME_RE, s);
  if (m) return wrapStep(dtr('dec_fmt_prefix', { x: m[1] }), m[2]);
  m = rx1(WRAP_HEADER_RE, s);
  if (m) return wrapStep(dtr('dec_fmt_prefix', { x: m[1] + ':' }), m[2].trim());
  // Bukan bila seluruhnya sudah berbentuk base64 (padding "=" di akhir bukan pemisah nama=nilai),
  // dan bukan hash format $id$... (Argon2/bcrypt/crypt memuat "=" seperti $v=19$m=65536).
  m = !/^[A-Za-z0-9+/_-]+={0,2}$/.test(s) && !/^\$[a-z0-9-]+\$/i.test(s) && rx1(WRAP_COOKIE_RE, s);
  return m ? wrapStep(tr('dec_fmt_cookie'), m[1]) : null;
}
// JSON -> tampil rapi; objek {iv, value, mac[, tag]} = payload Laravel encrypt().
function applyJson(step, s) {
  if (!/^[[{]/.test(s)) return false;
  let o;
  try { o = JSON.parse(s); } catch (e) { return false; }
  setFound(step, 'JSON', 'high');
  step.view = clipText(JSON.stringify(o, null, 2));
  if (o && typeof o === 'object' && ['iv', 'value', 'mac'].every(k => typeof o[k] === 'string')) {
    const gcm = typeof o.tag === 'string' && o.tag !== '';
    let ivLen = '?';
    try { ivLen = b64ToBytes(o.iv).length; } catch (e) { /* abaikan */ }
    setFound(step, 'Laravel encrypt() payload', 'high');
    step.details.push([tr('dec_d_iv'), ivLen + ' byte'], [tr('dec_d_cipher'), gcm ? 'AES-256-GCM' : 'AES-256-CBC / AES-128-CBC'], ['mac', o.mac ? 'HMAC-SHA256' : '-']);
    step.notes.push(tr('dec_laravel_note'));
    step.crypto = { type: 'laravel', payload: o };
  }
  return true;
}

// ---- Lapisan encoding teks -> { format, conf, val } atau null
// Token %xx / =XX (bagian ganjil hasil split) jadi byte; sisanya di-encode UTF-8.
function splitToBytes(s, re) {
  const out = [];
  s.split(re).forEach((p, i) => { if (i % 2) out.push(parseInt(p.slice(1), 16)); else pushAll(out, DEC_TE.encode(p)); });
  return Uint8Array.from(out);
}
function layerUrl(s) {
  const hits = s.match(/%[0-9a-fA-F]{2}/g);
  if (!hits) return null;
  return { format: tr('dec_fmt_url'), conf: hits.length >= 2 ? 'high' : 'med', val: decVal(splitToBytes(s, /(%[0-9a-fA-F]{2})/)) };
}
const HTML_ENT = new Map([['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"], ['nbsp', '\u00a0']]);
function layerHtml(s) {
  let n = 0;
  const out = s.replace(/&(#[xX][0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z]+);/g, (m, e) => {
    let ch = HTML_ENT.get(e.toLowerCase());
    if (e[0] === '#') {
      const cp = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      ch = cp <= 0x10ffff ? String.fromCodePoint(cp) : undefined;
    }
    if (ch === undefined) return m;
    n++;
    return ch;
  });
  return n ? { format: tr('dec_fmt_html'), conf: n >= 2 ? 'high' : 'med', val: decVal(DEC_TE.encode(out)) } : null;
}
function layerEscape(s) {
  if (!/\\(?:u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]{1,6}\}|x[0-9a-fA-F]{2})/.test(s)) return null;
  const out = [], simple = { n: '\n', r: '\r', t: '\t', 0: '\0' };
  let pend = '';
  const flush = () => { pushAll(out, DEC_TE.encode(pend)); pend = ''; };
  s.split(/(\\u\{[0-9a-fA-F]{1,6}\}|\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}|\\[nrt0"'\\/])/).forEach((p, i) => {
    if (i % 2 === 0) { pend += p; return; }
    const c = p[1];
    if (c === 'x') { flush(); out.push(parseInt(p.slice(2), 16)); return; }
    if (c === 'u') { const cp = parseInt(p[2] === '{' ? p.slice(3, -1) : p.slice(2), 16); pend += cp <= 0x10ffff ? String.fromCodePoint(cp) : p; return; }
    pend += simple[c] || c;
  });
  flush();
  return { format: tr('dec_fmt_esc'), conf: 'high', val: decVal(Uint8Array.from(out)) };
}
function layerQp(s) {
  const hits = s.match(/=[0-9A-F]{2}/g);
  if (!hits || (hits.length < 2 && !/=\r?\n/.test(s)) || /[^\t\r\n\x20-\x7e]/.test(s)) return null;
  return { format: tr('dec_fmt_qp'), conf: /=\r?\n/.test(s) ? 'high' : 'med', val: decVal(splitToBytes(s.replace(/=\r?\n/g, ''), /(=[0-9A-F]{2})/)) };
}
function layerHex(s) {
  const h = s.replace(/^0x/i, '').replace(/[\s:]/g, '');
  if (h.length < 4 || h.length % 2 || !/^[0-9a-fA-F]+$/.test(h)) return null;
  const b = fromHex(h), txt = bytesToText(b), letters = /[a-fA-F]/.test(h);
  if (!txt && !(letters && h.length >= 16) && !(letters && /\d/.test(h) && h.length >= 8)) return null;
  return { format: 'Hex', conf: txt || h.length >= 32 ? 'high' : 'med', val: decVal(b) };
}
function b32ToBytes(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', out = [];
  let bits = 0, val = 0;
  for (const ch of s.replace(/=+$/, '')) {
    val = ((val << 5) | A.indexOf(ch)) & 0x1fff;
    bits += 5;
    if (bits >= 8) { bits -= 8; out.push((val >>> bits) & 255); }
  }
  return Uint8Array.from(out);
}
function isKnownBinary(b) { return !!(fileMagic(b) || compressFmt(b) || DEC_BIN_RULES.some(r => r.test(b))); }
function layerB32(s) {
  const c = s.replace(/\s+/g, '');
  if (c.length < 8 || !/^[A-Z2-7]+=*$/.test(c) || (c.includes('=') && c.length % 8)) return null;
  const b = b32ToBytes(c);
  if (!bytesToText(b) && !isKnownBinary(b)) return null;
  return { format: 'Base32', conf: c.length % 8 === 0 ? 'high' : 'med', val: decVal(b) };
}
function layerB64(s) {
  const c = s.replace(/[\r\n]+/g, ''), body = c.replace(/=+$/, '');
  const std = /^[A-Za-z0-9+/]+={0,2}$/.test(c), url = /^[A-Za-z0-9_-]+={0,2}$/.test(c);
  if (!(std || url) || c.length < 4 || body.length % 4 === 1 || (c !== body && c.length % 4) || /^\d+$/.test(body)) return null;
  let b;
  try { b = b64ToBytes(c); } catch (e) { return null; }
  const txt = bytesToText(b), known = isKnownBinary(b);
  if (!txt && !known && c.length < 16) return null;
  // Hanya huruf (kata/nama biasa, mis. "Supercalifragilistic") hampir pasti bukan base64 data acak.
  if (!txt && !known && /^[A-Za-z]+$/.test(body) && (body.length < 32 || /^[A-Z]?[a-z]+$|^[A-Z]+$/.test(body))) return null;
  const padOk = c.length % 4 === 0;
  let conf = 'low';
  if ((txt || known) && padOk) conf = 'high';
  else if (txt || known || (padOk && shannon(b) > 3)) conf = 'med';
  return { format: url && !std ? 'Base64 URL-safe' : 'Base64', conf, val: decVal(b) };
}
const DEC_TEXT_LAYERS = [layerUrl, layerHtml, layerEscape, layerQp, layerHex, layerB32, layerB64];

// ---- Pengenalan biner (struktur/magic) -> isi step; test() juga dipakai layerB64
const DEC_BIN_RULES = [
  { test: b => b.length >= 32 && startsWithBytes(b, SIG_SALTED) && b.length % 16 === 0,
    apply(step, b) {
      setFound(step, 'OpenSSL/CryptoJS "Salted__" (AES passphrase)', 'high');
      step.details.push([tr('dec_d_salt'), toHex(b.subarray(8, 16))], [tr('dec_d_ct'), (b.length - 16) + ' byte']);
      step.notes.push(tr('dec_salted_note'));
      step.crypto = { type: 'cryptojs', salt: b.slice(8, 16), ct: b.slice(16) };
    } },
  { test: b => startsWithBytes(b, SIG_JAVA),
    apply(step, b) {
      setFound(step, 'Java serialized object', 'high');
      step.warnings.push(tr('dec_java_warn'));
      const names = [];
      // TC_CLASSDESC (0x72) + panjang u16 + nama kelas
      for (let i = 4; i < b.length - 3 && names.length < 8; i++) {
        if (b[i] !== 0x72) continue;
        const n = (b[i + 1] << 8) | b[i + 2], txt = n > 0 && n < 256 && i + 3 + n <= b.length ? bytesToText(b.subarray(i + 3, i + 3 + n)) : null;
        if (txt && /^[\w.$[;]+$/.test(txt)) { names.push(txt); i += 2 + n; }
      }
      if (names.length) step.details.push([tr('dec_d_classes'), names.join(', ')]);
    } },
  // Fernet: 0x80 | ts(8) | iv(16) | ct(16n) | hmac(32)
  { test: b => b[0] === 0x80 && b.length >= 73 && (b.length - 57) % 16 === 0,
    apply(step, b) {
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), ts = dv.getUint32(1) * 4294967296 + dv.getUint32(5);
      setFound(step, 'Fernet token', 'high');
      step.details.push([tr('dec_d_time'), ts + ' → ' + new Date(ts * 1000).toISOString()], [tr('dec_d_ct'), (b.length - 57) + ' byte']);
      step.notes.push(tr('dec_fernet_note'));
      step.crypto = { type: 'fernet', token: b.slice() };
    } },
  { test: b => !!derTop(b), apply(step, b) { applyDer(step, b, derTop(b)); } },
  { test: b => (b.length === 65 || b.length === 97) && b[0] === 4,
    apply(step, b) {
      setFound(step, 'EC public key ' + (b.length === 65 ? 'P-256' : 'P-384') + ' (uncompressed)', 'med');
      step.notes.push(tr('dec_ec_unc'));
      const n = (b.length - 1) / 2;
      step.details.push(['X', toHex(b.subarray(1, 1 + n))], ['Y', toHex(b.subarray(1 + n))]);
    } },
  { test: b => b.length === 33 && (b[0] === 2 || b[0] === 3),
    apply(step, b) { setFound(step, 'EC public key P-256 (compressed)', 'med'); step.notes.push(tr('dec_ec_comp')); step.details.push(['X', toHex(b.subarray(1))]); } }
];
function hasRepeatBlock(b) {
  const seen = new Set();
  for (let i = 0; i + 16 <= b.length; i += 16) { const k = toHex(b.subarray(i, i + 16)); if (seen.has(k)) return true; seen.add(k); }
  return false;
}
// Tebakan ciphertext mentah dari panjang + entropi (dinormalisasi terhadap panjang data).
function guessCipher(step, b) {
  const n = b.length, norm = n > 1 ? shannon(b) / Math.min(8, Math.log2(n)) : 0, ecb = n % 16 === 0 && hasRepeatBlock(b);
  if (n < 16 || (norm < 0.85 && !ecb)) {
    setFound(step, tr('dec_bin_unknown'), 'low');
    if (n >= 16) step.notes.push(tr('dec_guess_lowent'));
    return;
  }
  setFound(step, tr('dec_guess_title'), 'low');
  step.warnings.push(tr('dec_guess_warn'));
  if ([16, 20, 32, 48, 64].includes(n)) step.notes.push(tr('dec_guess_digest'));
  if (n % 16 === 0) {
    step.notes.push(tr('dec_guess_cbc'));
    if (ecb) step.warnings.push(tr('dec_guess_ecb'));
    step.crypto = { type: 'aes', ct: b, mode: ecb ? 'ECB' : 'CBC' };
    return;
  }
  step.notes.push(tr('dec_guess_ctr'));
  if (n >= 28) step.notes.push(tr('dec_guess_gcm'));
  step.crypto = { type: 'aes', ct: b, mode: n >= 28 ? 'GCM' : 'CTR' };
}
async function analyzeBinary(step, b) {
  const fmt = compressFmt(b);
  if (fmt) {
    try { return { format: fmt === 'gzip' ? 'gzip' : 'zlib/deflate', conf: 'high', val: decVal(await inflateBytes(b, fmt)) }; }
    catch (e) { setFound(step, fmt, 'med'); step.warnings.push(dtr('dec_err_inflate', { e: e.message || e })); return null; }
  }
  const rule = DEC_BIN_RULES.find(r => r.test(b));
  if (rule) rule.apply(step, b);
  else guessCipher(step, b);
  return null;
}
async function analyzeStep(step, v) {
  // Magic bytes dicek dulu: PDF bisa saja seluruhnya ASCII sehingga lolos sebagai teks.
  const fm = fileMagic(v.bytes);
  if (fm) { setFound(step, fm.name, 'high'); step.file = fm; step.notes.push(tr('dec_file_note')); return null; }
  if (v.text === null) return analyzeBinary(step, v.bytes);
  const s = v.text.trim();
  const wrapped = layerWrapper(s);
  if (wrapped) return wrapped;
  if (DEC_TEXT_RULES.some(r => r(step, s)) || applyJson(step, s)) return null;
  for (const layer of DEC_TEXT_LAYERS) { const r = layer(s); if (r) return r; }
  step.notes.push(tr('dec_no_more'));
  return null;
}
// Buka lapisan bertingkat; input = string (dari textarea) atau Uint8Array (hasil dekripsi).
async function smartDecode(input) {
  let v = typeof input === 'string' ? { bytes: DEC_TE.encode(input), text: input } : decVal(input);
  let step = decStep(tr('dec_input'), 'high', v);
  const steps = [step];
  for (let depth = 0; ; depth++) {
    let next = null;
    try { next = await analyzeStep(step, v); } catch (e) { step.warnings.push(dtr('dec_err_generic', { e: (e && e.message) || e })); }
    if (!next || sameBytes(next.val.bytes, v.bytes)) break;
    if (depth >= DEC_MAX_DEPTH) { step.notes.push(tr('dec_max_depth')); break; }
    v = next.val;
    step = decStep(next.format, next.conf, v);
    steps.push(step);
  }
  return steps;
}

// ---- Kripto (WebCrypto). MD5 hanya untuk EVP_BytesToKey kompatibel CryptoJS/OpenSSL lama (RFC 1321).
function md5(bytes) {
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const n = bytes.length, total = Math.ceil((n + 9) / 64) * 64, buf = new Uint8Array(total), dv = new DataView(buf.buffer);
  buf.set(bytes);
  buf[n] = 0x80;
  dv.setUint32(total - 8, (n * 8) >>> 0, true);
  dv.setUint32(total - 4, Math.floor(n / 0x20000000), true);
  const h = [0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476];
  for (let off = 0; off < total; off += 64) {
    let [a, b, c, d] = h;
    for (let i = 0; i < 64; i++) {
      const r = i >> 4;
      let f, g;
      if (r === 0) { f = (b & c) | (~b & d); g = i; }
      else if (r === 1) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15; }
      else if (r === 2) { f = b ^ c ^ d; g = (3 * i + 5) & 15; }
      else { f = c ^ (b | ~d); g = (7 * i) & 15; }
      f = (f + a + K[i] + dv.getInt32(off + g * 4, true)) | 0;
      const s = S[r * 4 + (i & 3)];
      a = d; d = c; c = b;
      b = (b + ((f << s) | (f >>> (32 - s)))) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
  }
  const out = new Uint8Array(16), ov = new DataView(out.buffer);
  h.forEach((x, i) => ov.setInt32(i * 4, x, true));
  return out;
}
function subtleApi() {
  const s = globalThis.crypto && globalThis.crypto.subtle;
  if (!s) throw new Error(tr('dec_err_nosubtle'));
  return s;
}
async function sha256(b) { return new Uint8Array(await subtleApi().digest('SHA-256', b)); }
async function hmacSha256(key, data) {
  const S = subtleApi(), k = await S.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await S.sign('HMAC', k, data));
}
// AES CBC/GCM/CTR via WebCrypto (op = 'encrypt' | 'decrypt'). GCM: tag 16 byte di akhir data.
async function aesCrypt(op, mode, key, iv, data, aad) {
  const S = subtleApi(), name = 'AES-' + mode;
  const algo = mode === 'CTR' ? { name, counter: iv, length: 64 } : { name, iv };
  if (mode === 'GCM' && aad && aad.length) algo.additionalData = aad;
  const k = await S.importKey('raw', key, { name }, false, [op]);
  return new Uint8Array(await S[op](algo, k, data));
}
// ECB tidak ada di WebCrypto: D(C) = blok pertama CBC-decrypt(IV=0, C || E(C xor 0x10..)),
// blok tambahan itu membuat padding PKCS#7 penuh sehingga WebCrypto tidak menolak. Hanya untuk analisis (ECB lemah).
async function aesEcbDecrypt(key, data) {
  if (!data.length || data.length % 16) throw new Error(tr('dec_err_block'));
  const S = subtleApi(), zero = new Uint8Array(16), out = new Uint8Array(data.length);
  const k = await S.importKey('raw', key, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
  for (let i = 0; i < data.length; i += 16) {
    const c = data.subarray(i, i + 16);
    const x = new Uint8Array(await S.encrypt({ name: 'AES-CBC', iv: zero }, k, c.map(v => v ^ 16))).subarray(0, 16);
    out.set(new Uint8Array(await S.decrypt({ name: 'AES-CBC', iv: zero }, k, concatBytes([c, x]))), i);
  }
  const p = out[out.length - 1];
  return p >= 1 && p <= 16 && out.subarray(out.length - p).every(v => v === p) ? out.slice(0, out.length - p) : out;
}
function aesDecrypt(mode, key, iv, data, aad) { return mode === 'ECB' ? aesEcbDecrypt(key, data) : aesCrypt('decrypt', mode, key, iv, data, aad); }
// EVP_BytesToKey 1 iterasi (OpenSSL enc / CryptoJS) -> key 32 + IV 16.
async function evpKdf(pass, salt, hash) {
  let d = new Uint8Array(0), out = new Uint8Array(0);
  while (out.length < 48) {
    const blk = concatBytes([d, pass, salt]);
    d = hash === 'md5' ? md5(blk) : await sha256(blk);
    out = concatBytes([out, d]);
  }
  return { key: out.slice(0, 32), iv: out.slice(32, 48) };
}
async function pbkdf2Kdf(pass, salt) {
  const S = subtleApi(), k = await S.importKey('raw', pass, 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await S.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 10000 }, k, 384));
  return { key: bits.slice(0, 32), iv: bits.slice(32) };
}
// Nilai key/IV/tag: hex / base64 / utf8 (auto = pilih tafsiran yang panjangnya sesuai 'want').
function parseBin(s, enc, want) {
  let v = String(s || '').trim(), e = enc || 'auto';
  if (v.startsWith('base64:')) { v = v.slice(7); if (e === 'auto') e = 'base64'; }
  const dec = {
    hex: x => { const h = x.replace(/^0x/i, ''); return /^(?:[0-9a-fA-F]{2})+$/.test(h) ? fromHex(h) : null; },
    base64: x => { if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(x)) return null; try { return b64ToBytes(x); } catch (err) { return null; } },
    utf8: x => DEC_TE.encode(x)
  };
  if (e !== 'auto') { const b = dec[e] && dec[e](v); if (!b) throw new Error(dtr('dec_err_enc', { enc: e })); return { bytes: b, enc: e }; }
  const cands = ['hex', 'base64', 'utf8'].map(k => ({ enc: k, bytes: dec[k](v) })).filter(c => c.bytes);
  return cands.find(c => want.includes(c.bytes.length)) || cands[0];
}
function plainKind(b) {
  const s = bytesToText(b);
  if (s !== null) { try { JSON.parse(s); return 'json'; } catch (e) { return 'text'; } }
  return fileMagic(b) || compressFmt(b) ? 'file' : '';
}
function cryptoErr(e) { return e && e.name === 'OperationError' ? tr('dec_err_op') : (e && e.message) || String(e); }
async function tryVariant(v) {
  try {
    const r = await v.fn(), bytes = r instanceof Uint8Array ? r : r.bytes, kind = plainKind(bytes);
    return { label: v.label, ok: !!kind, bytes, msg: kind ? tr('dec_ok_' + kind) : tr('dec_bad_plain'), note: r.note || '' };
  } catch (e) { return { label: v.label, ok: false, bytes: null, msg: cryptoErr(e), note: '' }; }
}
const AES_KEY_LENS = [16, 24, 32];
// Sebut format yang terbaca (auto ditandai) dan panjang yang diharapkan.
function keyLenErr(k, enc, mode, want) {
  return dtr('dec_err_keylen', { enc: k ? k.enc + (enc === 'auto' ? ' (auto)' : '') : '-', n: k ? k.bytes.length : 0, mode, want });
}
function cryptojsVariants(t, f, all) {
  const pass = DEC_TE.encode(f.passphrase || '');
  const kdfs = [['EVP_BytesToKey MD5 (CryptoJS)', () => evpKdf(pass, t.salt, 'md5')]];
  if (all) kdfs.push(['EVP_BytesToKey SHA-256 (openssl >= 1.1)', () => evpKdf(pass, t.salt, 'sha256')], ['PBKDF2-SHA256 10000 (openssl -pbkdf2)', () => pbkdf2Kdf(pass, t.salt)]);
  return kdfs.map(([label, kdf]) => ({ label: 'AES-256-CBC, ' + label, fn: async () => { const k = await kdf(); return aesDecrypt('CBC', k.key, k.iv, t.ct); } }));
}
function laravelVariants(t, f) {
  return [{ label: 'Laravel ' + (t.payload.tag ? 'AES-GCM' : 'AES-CBC + HMAC-SHA256'), fn: async () => {
    const key = parseBin(f.key, f.keyEnc, [32, 16]).bytes, p = t.payload;
    if (key.length !== 32 && key.length !== 16) throw new Error(keyLenErr(parseBin(f.key, f.keyEnc, [32, 16]), f.keyEnc, 'Laravel AES', '16/32'));
    const iv = b64ToBytes(p.iv), ct = b64ToBytes(p.value);
    if (p.tag) return aesDecrypt('GCM', key, iv, concatBytes([ct, b64ToBytes(p.tag)]));
    const macOk = !p.mac || toHex(await hmacSha256(key, DEC_TE.encode(p.iv + p.value))) === p.mac.toLowerCase();
    let bytes;
    try { bytes = await aesDecrypt('CBC', key, iv, ct); } catch (e) { throw macOk ? e : new Error(tr('dec_err_mac')); }
    return { bytes, note: macOk ? '' : tr('dec_mac_bad_but_ok') };
  } }];
}
function fernetVariants(t, f) {
  return [{ label: 'Fernet (HMAC-SHA256 + AES-128-CBC)', fn: async () => {
    const key = parseBin(f.key, f.keyEnc === 'auto' ? 'base64' : f.keyEnc, [32]).bytes, tok = t.token, end = tok.length - 32;
    if (key.length !== 32) throw new Error(keyLenErr({ enc: 'base64', bytes: key }, f.keyEnc, 'Fernet', '32'));
    if (!sameBytes(await hmacSha256(key.slice(0, 16), tok.slice(0, end)), tok.slice(end))) throw new Error(tr('dec_err_fernet_mac'));
    return aesDecrypt('CBC', key.slice(16), tok.slice(9, 25), tok.slice(25, end));
  } }];
}
// Ciphertext mentah: kombinasi key (apa adanya / SHA-256 teks), mode, dan letak IV/tag.
function aesVariants(t, f, all) {
  const ct = t.ct, keys = [], out = [];
  const k = f.key ? parseBin(f.key, f.keyEnc, AES_KEY_LENS) : null;
  if (k && AES_KEY_LENS.includes(k.bytes.length)) keys.push({ label: 'key ' + k.enc, get: () => Promise.resolve(k.bytes) });
  if (all && f.key) keys.push({ label: 'SHA-256(key)', get: () => sha256(DEC_TE.encode(f.key.trim())) });
  if (!keys.length) throw new Error(keyLenErr(k, f.keyEnc, 'AES', '16/24/32'));
  const ivSep = f.iv ? parseBin(f.iv, f.ivEnc, [16, 12]).bytes : null;
  const tag = f.tag ? parseBin(f.tag, f.tagEnc, [16]).bytes : null;
  const aad = f.aad ? DEC_TE.encode(f.aad) : null;
  const modes = all ? ['CBC', 'GCM', 'CTR', 'ECB'] : [f.mode];
  keys.forEach(key => modes.forEach(mode => {
    const add = (where, iv, data) => out.push({ label: 'AES-' + mode + ', ' + key.label + where,
      fn: async () => aesDecrypt(mode, await key.get(), iv, mode === 'GCM' && tag ? concatBytes([data, tag]) : data, aad) });
    if (mode === 'ECB') { add('', null, ct); return; }
    const ivLen = mode === 'GCM' ? 12 : 16;
    if ((all || f.ivPrefix) && ct.length > ivLen) add(', IV prefix ' + ivLen + 'B', ct.slice(0, ivLen), ct.slice(ivLen));
    if (ivSep && (all || !f.ivPrefix)) add(', IV terpisah', ivSep, ct);
  }));
  if (!out.length) throw new Error(tr('dec_err_iv'));
  return out;
}
const DEC_VARIANTS = { cryptojs: cryptojsVariants, laravel: laravelVariants, fernet: fernetVariants, aes: aesVariants };
// Jalankan satu (all=false) atau semua variasi dekripsi; hasil: [{ label, ok, bytes, msg, note }].
async function decryptTarget(t, f, all) {
  let list;
  try { list = DEC_VARIANTS[t.type](t, f, all); } catch (e) { return [{ label: '-', ok: false, bytes: null, msg: cryptoErr(e), note: '' }]; }
  const res = [];
  for (const v of list) res.push(await tryVariant(v));
  return res;
}

// ---- Sampel demo deterministik (semua key/passphrase di sini dummy, bukan rahasia)
const DEC_SAMPLES = [
  { key: 'chain', label: 'URL+Base64+gzip' }, { key: 'jwt', label: 'JWT' }, { key: 'cryptojs', label: 'CryptoJS AES' },
  { key: 'gcm', label: 'AES-GCM' }, { key: 'laravel', label: 'Laravel' }, { key: 'fernet', label: 'Fernet' },
  { key: 'bcrypt', label: 'bcrypt' }, { key: 'sha256', label: 'SHA-256' }
];
function decFormDefault() {
  return { key: '', keyEnc: 'auto', iv: '', ivEnc: 'auto', mode: 'CBC', ivPrefix: true, tag: '', tagEnc: 'auto', aad: '', passphrase: '' };
}
async function buildDecodeSample(key) {
  const enc = s => DEC_TE.encode(s), seq = (n, start) => Uint8Array.from({ length: n }, (_, i) => (start + i) & 255);
  if (key === 'chain') {
    const json = JSON.stringify({ user: 'demo', role: 'auditor', note: 'contoh data dummy', items: [1, 2, 3] });
    return { text: encodeURIComponent(bytesToB64(await streamBytes(enc(json), new CompressionStream('gzip')))), note: tr('dec_smp_chain') };
  }
  if (key === 'jwt') {
    const parts = [{ alg: 'HS256', typ: 'JWT' }, { sub: 'demo-user', name: 'Contoh Dummy', iat: 1700000000, exp: 1900000000 }].map(o => bytesToB64u(enc(JSON.stringify(o))));
    return { text: parts.join('.') + '.' + bytesToB64u(enc('bukan-signature-asli')), note: tr('dec_smp_jwt') };
  }
  if (key === 'cryptojs') {
    const pass = 'contoh-passphrase', salt = seq(8, 1), k = await evpKdf(enc(pass), salt, 'md5');
    const ct = await aesCrypt('encrypt', 'CBC', k.key, k.iv, enc('{"pesan":"halo dari CryptoJS (contoh)"}'));
    return { text: bytesToB64(concatBytes([SIG_SALTED, salt, ct].map(a => Uint8Array.from(a)))), note: dtr('dec_smp_pass', { p: pass }), form: { passphrase: pass } };
  }
  if (key === 'gcm') {
    const k = seq(32, 0), iv = seq(12, 0xa0), ct = await aesCrypt('encrypt', 'GCM', k, iv, enc('{"demo":"AES-GCM","ok":true}'));
    return { text: bytesToB64(concatBytes([iv, ct])), note: dtr('dec_smp_key', { k: toHex(k) }), form: { key: toHex(k), mode: 'GCM' } };
  }
  if (key === 'laravel') {
    const k = enc('contoh-app-key-32-byte-demo-only'), iv = seq(16, 0x30), appKey = 'base64:' + bytesToB64(k);
    const ivS = bytesToB64(iv), valS = bytesToB64(await aesCrypt('encrypt', 'CBC', k, iv, enc('s:13:"halo, Laravel";')));
    const mac = toHex(await hmacSha256(k, enc(ivS + valS)));
    return { text: bytesToB64(enc(JSON.stringify({ iv: ivS, value: valS, mac, tag: '' }))), note: dtr('dec_smp_appkey', { k: appKey }), form: { key: appKey } };
  }
  if (key === 'fernet') {
    const k = enc('contoh-fernet-key-32-byte-demo!!'), head = new Uint8Array(9);
    head[0] = 0x80;
    new DataView(head.buffer).setUint32(5, 1700000000);
    const body = concatBytes([head, seq(16, 0x50), await aesCrypt('encrypt', 'CBC', k.slice(16), seq(16, 0x50), enc('halo dari Fernet (contoh)'))]);
    const fkey = bytesToB64u(k, true);
    return { text: bytesToB64u(concatBytes([body, await hmacSha256(k.slice(0, 16), body)]), true), note: dtr('dec_smp_fernet', { k: fkey }), form: { key: fkey } };
  }
  if (key === 'bcrypt') return { text: '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW', note: tr('dec_smp_bcrypt') };
  return { text: toHex(await sha256(enc('contoh'))), note: tr('dec_smp_hash') };
}
// @@DECODE-END

// ============================================================
//  Analisis file (lokal, drag-drop): cocokkan magic bytes vs ekstensi, hash (MD5/SHA-1/
//  SHA-256/SHA-512) + verifikasi checksum, cek integritas struktur, konten berbahaya
//  (script di SVG, JavaScript/aksi otomatis di PDF, macro Office, GPS di EXIF), dan metadata.
//  Isi file hanya dibaca di browser dan tidak dikirim ke mana pun; hasil ditampilkan
//  sebagai teks (interpolasi Vue), XML diurai DOMParser (tidak memuat entitas eksternal).
//  Rujukan: OWASP File Upload Cheat Sheet; OWASP ASVS 4.0.3 V12.2.1 (tipe file divalidasi
//  dari isi, bukan ekstensi), V12.1, V8.3.4 (data sensitif tersembunyi); CWE-434, CWE-22
//  (Zip Slip), CWE-409 (zip bomb), CWE-611 (XXE), CWE-359 (lokasi GPS); RFC 1321 (MD5),
//  FIPS 180-4 (SHA), RFC 2083 (PNG), ISO 32000 (PDF), CIPA DC-008 (EXIF), PKWARE APPNOTE (ZIP).
// ============================================================
// @@FILE-START (penanda ekstraksi untuk uji node)
const FI_I18N = {
  id: {
    fi_m_dim: 'Dimensi (header)', fi_m_comment: 'Komentar JPEG', fi_m_created: 'Dibuat (mvhd)', fi_m_duration: 'Durasi (mvhd)', fi_m_compiled: 'Waktu kompilasi', fi_m_pdfver: 'Versi PDF', fi_m_pages: 'Jumlah halaman', fi_m_entries: 'Jumlah entri', fi_m_unzipped: 'Total ukuran asli', fi_m_encoding: 'Encoding', fi_m_lines: 'Baris', fi_m_resolution: 'Resolusi video', fi_m_duration_b: 'Durasi (browser)', fi_k_text: 'Teks',
    tab_file: 'Analisis file', fi_title: 'Analisis file (magic bytes, hash, metadata)',
    fi_intro: 'Seret file apa pun (PDF, foto, audio, video, dokumen Office, arsip, SVG, executable, …). Dicek <b>di browser ini saja</b>: jenis asli dari <b>magic bytes</b> dibanding ekstensi, <b>hash</b> MD5/SHA-1/SHA-256/SHA-512 untuk dicocokkan dengan checksum resmi, <b>integritas</b> struktur (rusak/terpotong), <b>konten berbahaya</b> (script di SVG, JavaScript/aksi otomatis di PDF, macro di Office, data tersisip), dan <b>metadata</b> (EXIF/GPS foto, info PDF, properti Office, tag audio, durasi video).',
    fi_drop: '<b>Seret file ke sini</b> atau klik untuk memilih (bisa banyak sekaligus, maks 256 MB per file)',
    fi_busy: 'Menganalisis…', fi_export: 'Unduh hasil (JSON)', fi_clear: 'Bersihkan', fi_copy: 'salin', fi_copied: 'tersalin',
    fi_v_ok: 'Aman', fi_v_warn: 'Perlu dicek', fi_v_danger: 'Berbahaya',
    fi_id_name: 'Nama', fi_id_size: 'Ukuran', fi_id_modified: 'Terakhir diubah (sistem)', fi_id_browser: 'MIME dari browser',
    fi_id_detected: 'Jenis asli (magic bytes)', fi_id_expect: 'Ekstensi yang cocok', fi_id_magic: 'Byte awal (hex)', fi_id_entropy: 'Entropi',
    fi_unknown: 'tidak dikenali', fi_none: '(tanpa ekstensi)',
    fi_hash_title: 'Hash & verifikasi checksum',
    fi_verify_ph: 'Tempel checksum resmi (hex MD5/SHA-1/SHA-256/SHA-512, baris "hash  nama-file", atau SRI sha256-…/sha512-…)',
    fi_hash_match: '✓ Cocok dengan {x} — file identik dengan yang dipublikasikan.',
    fi_hash_mismatch: '✗ Tidak cocok ({x}) — file berbeda: rusak saat unduh, versi lain, atau sudah diubah.',
    fi_hash_badinput: 'Format checksum tidak dikenali.',
    fi_hash_note: 'MD5/SHA-1 cukup untuk mendeteksi file rusak, tetapi tidak untuk membuktikan keaslian (rentan collision). Untuk keaslian, cocokkan SHA-256/SHA-512 dari sumber resmi (HTTPS) atau verifikasi tanda tangan digital (GPG/Authenticode).',
    fi_integ_title: 'Integritas struktur', fi_find_title: 'Temuan keamanan', fi_find_none: 'Tidak ada temuan.', fi_th_finding: 'Temuan',
    fi_meta_title: 'Metadata', fi_map: 'Buka lokasi di OpenStreetMap', fi_sev_info: 'Info',
    fi_note: 'Batasan: analisis statis tanpa antivirus — "Aman" berarti tidak ada pola berbahaya yang dikenali, bukan jaminan bebas malware. Objek PDF yang terkompresi dibuka bila memungkinkan; file terenkripsi tidak bisa diperiksa isinya.',
    fi_err_big: 'File lebih dari 256 MB — dilewati.', fi_err_empty: 'File kosong (0 byte) — kemungkinan download/copy gagal atau file rusak.', fi_err_read: 'Gagal membaca file: {x}',
    // integritas
    fi_i_ok_struct: 'Struktur {x} utuh.', fi_i_trunc: 'File terpotong/rusak: {x}.',
    fi_i_pdf_eof: 'penanda akhir %%EOF tidak ada', fi_i_pdf_xref: 'startxref tidak ditemukan (tabel referensi silang hilang)',
    fi_i_png_iend: 'chunk IEND tidak ada', fi_i_png_crc: '{x} chunk dengan CRC salah', fi_i_jpeg_eoi: 'penanda akhir JPEG (FFD9) tidak ada',
    fi_i_gif_end: 'byte trailer GIF (0x3B) tidak ada', fi_i_size_decl: 'ukuran di header {x} byte, file sebenarnya lebih kecil',
    fi_i_zip_eocd: 'End of Central Directory ZIP tidak ditemukan', fi_i_zip_cd: 'central directory ZIP tidak lengkap/rusak', fi_i_zip_local: '{x} entri ZIP menunjuk ke header lokal yang salah',
    fi_i_zip64: 'ZIP64 — daftar isi tidak di-parse',
    fi_i_box: 'box "{x}" melewati akhir file', fi_i_moov: 'box moov (indeks video) tidak ada — rekaman tidak selesai atau rusak',
    fi_i_pe: 'header PE tidak valid', fi_i_json: 'JSON tidak valid: {x}', fi_i_xml: 'XML tidak valid', fi_i_text_ok: 'Teks valid ({x}).',
    fi_i_img_ok: 'Gambar berhasil dibuka browser ({x}).', fi_i_img_fail: 'Browser gagal membuka gambar — mungkin rusak atau formatnya tidak didukung.',
    fi_i_media_ok: 'Media berhasil dibaca browser (durasi {x}).', fi_i_media_fail: 'Browser tidak bisa membaca media — rusak, terpotong, atau codec tidak didukung Chrome.',
    fi_i_unknown: 'Format tidak dikenali — integritas struktur tidak bisa dicek (hash tetap bisa dipakai).',
    fi_i_nosubtle: 'WebCrypto tidak tersedia (halaman bukan HTTPS/file lokal) — hanya MD5 yang dihitung.',
    // temuan
    fi_s_mismatch: 'Ekstensi .{x} tidak cocok dengan isi file ({y}).',
    fi_s_disguised: 'File {y} disamarkan dengan ekstensi .{x} — pola umum unggahan berbahaya (CWE-434).',
    fi_s_double_ext: 'Ekstensi ganda/menipu: "{x}".', fi_s_rtlo: 'Nama file memakai karakter kontrol arah (RTLO) untuk menyamarkan ekstensi.',
    fi_s_exec: 'File executable ({x}) — jangan dijalankan bila sumbernya tidak tepercaya.',
    fi_s_polyglot: 'Kode skrip "{x}" ditemukan di dalam file biner (offset {y}) — kemungkinan polyglot/webshell.',
    fi_s_appended_zip: 'Ada arsip ZIP yang disisipkan setelah akhir {x} (polyglot/steganografi).',
    fi_s_trailing: '{x} byte data tambahan setelah penanda akhir file.',
    fi_s_svg_script: 'SVG berisi \x3Cscript> — ikut jalan bila SVG dibuka langsung/di-serve dari domain Anda (stored XSS).',
    fi_s_svg_event: 'SVG/HTML berisi event handler ({x}) yang bisa menjalankan JavaScript.',
    fi_s_js_uri: 'Ada URI javascript: di dalam file.', fi_s_foreign: 'SVG memakai <foreignObject> (bisa menyisipkan HTML).',
    fi_s_xxe: 'Deklarasi DOCTYPE/ENTITY — berisiko XXE bila di-parse server (CWE-611).', fi_s_ext_ref: '{x} referensi ke sumber eksternal (http/https).',
    fi_s_html: 'File HTML — bila diunggah lalu di-serve dari domain Anda, script di dalamnya ikut berjalan.',
    fi_s_php: 'Kode PHP{x} — berpotensi webshell bila diunggah ke server.', fi_s_script: 'Skrip shell/interpreter (shebang {x}).',
    fi_s_pdf_js: 'PDF berisi JavaScript (/JavaScript atau /JS).', fi_s_pdf_open: 'PDF punya aksi otomatis saat dibuka (/OpenAction).',
    fi_s_pdf_aa: 'PDF punya aksi tambahan otomatis (/AA) pada halaman/field.', fi_s_pdf_launch: 'PDF bisa menjalankan program eksternal (/Launch).',
    fi_s_pdf_embed: 'PDF berisi file tertanam (/EmbeddedFile).', fi_s_pdf_rich: 'PDF berisi konten RichMedia/Flash.',
    fi_s_pdf_submit: 'PDF berisi form yang mengirim data (/SubmitForm).', fi_s_pdf_xfa: 'PDF memakai formulir XFA.',
    fi_s_pdf_hexname: 'Nama objek PDF disamarkan dengan escape hex (mis. /J#61vaScript) — teknik umum PDF berbahaya.',
    fi_s_pdf_uri: '{x} link (/URI) di dalam PDF.', fi_s_pdf_enc: 'PDF terenkripsi — sebagian isi tidak bisa diperiksa.',
    fi_s_macro: 'Dokumen berisi macro VBA ({x}).{y}', fi_s_macro_ext: ' Ekstensi .{x} biasanya tanpa macro — mencurigakan.',
    fi_s_activex: 'Dokumen berisi kontrol ActiveX.', fi_s_ole_embed: '{x} objek OLE tertanam.',
    fi_s_remote_tpl: 'Relasi eksternal "{x}" → {y} (remote template/objek, teknik CVE-2017-0199/Follina).',
    fi_s_ext_links: '{x} hyperlink eksternal di dokumen.', fi_s_rtf_obj: 'RTF berisi objek OLE tertanam{x}.',
    fi_s_zip_slip: 'Entri arsip dengan path traversal: "{x}" (Zip Slip, CWE-22).', fi_s_zip_enc: '{x} entri arsip terenkripsi (tidak bisa diperiksa).',
    fi_s_zip_bomb: 'Rasio kompresi {x}× — indikasi zip bomb (CWE-409).', fi_s_zip_exec: 'Arsip berisi file executable/skrip: {x}.',
    fi_s_gps: 'Lokasi GPS tersimpan di metadata: {x} — hapus sebelum dibagikan (privasi, CWE-359).',
    fi_s_exif_owner: 'Metadata berisi identitas pemilik/serial perangkat: {x}.'
  },
  en: {
    fi_m_dim: 'Dimensions (header)', fi_m_comment: 'JPEG comment', fi_m_created: 'Created (mvhd)', fi_m_duration: 'Duration (mvhd)', fi_m_compiled: 'Compile time', fi_m_pdfver: 'PDF version', fi_m_pages: 'Pages', fi_m_entries: 'Entries', fi_m_unzipped: 'Total uncompressed size', fi_m_encoding: 'Encoding', fi_m_lines: 'Lines', fi_m_resolution: 'Video resolution', fi_m_duration_b: 'Duration (browser)', fi_k_text: 'Text',
    tab_file: 'File Analysis', fi_title: 'File Analysis (magic bytes, hash, metadata)',
    fi_intro: 'Drop any file (PDF, photo, audio, video, Office document, archive, SVG, executable, …). Checked <b>in this browser only</b>: real type from <b>magic bytes</b> vs. extension, MD5/SHA-1/SHA-256/SHA-512 <b>hashes</b> to compare with the official checksum, structural <b>integrity</b> (corrupt/truncated), <b>dangerous content</b> (script in SVG, JavaScript/auto actions in PDF, Office macros, appended data), and <b>metadata</b> (photo EXIF/GPS, PDF info, Office properties, audio tags, video duration).',
    fi_drop: '<b>Drop files here</b> or click to choose (multiple allowed, max 256 MB each)',
    fi_busy: 'Analyzing…', fi_export: 'Download results (JSON)', fi_clear: 'Clear', fi_copy: 'copy', fi_copied: 'copied',
    fi_v_ok: 'Safe', fi_v_warn: 'Review', fi_v_danger: 'Dangerous',
    fi_id_name: 'Name', fi_id_size: 'Size', fi_id_modified: 'Last modified (system)', fi_id_browser: 'Browser MIME',
    fi_id_detected: 'Real type (magic bytes)', fi_id_expect: 'Matching extensions', fi_id_magic: 'First bytes (hex)', fi_id_entropy: 'Entropy',
    fi_unknown: 'unrecognized', fi_none: '(no extension)',
    fi_hash_title: 'Hash & checksum verification',
    fi_verify_ph: 'Paste the official checksum (hex MD5/SHA-1/SHA-256/SHA-512, a "hash  file-name" line, or SRI sha256-…/sha512-…)',
    fi_hash_match: '✓ Matches {x} — the file is identical to the published one.',
    fi_hash_mismatch: '✗ Does not match ({x}) — the file differs: corrupted download, another version, or modified.',
    fi_hash_badinput: 'Checksum format not recognized.',
    fi_hash_note: 'MD5/SHA-1 are fine for detecting corruption but not for proving authenticity (collision-prone). For authenticity compare SHA-256/SHA-512 from an official (HTTPS) source or verify a digital signature (GPG/Authenticode).',
    fi_integ_title: 'Structural integrity', fi_find_title: 'Security findings', fi_find_none: 'No findings.', fi_th_finding: 'Finding',
    fi_meta_title: 'Metadata', fi_map: 'Open location in OpenStreetMap', fi_sev_info: 'Info',
    fi_note: 'Limitations: static analysis, not an antivirus — "Safe" means no known dangerous pattern was found, not a malware-free guarantee. Compressed PDF objects are inflated when possible; encrypted files cannot be inspected.',
    fi_err_big: 'File larger than 256 MB — skipped.', fi_err_empty: 'Empty file (0 bytes) — failed download/copy or corrupt file.', fi_err_read: 'Failed to read the file: {x}',
    fi_i_ok_struct: '{x} structure is intact.', fi_i_trunc: 'File truncated/corrupt: {x}.',
    fi_i_pdf_eof: '%%EOF end marker missing', fi_i_pdf_xref: 'startxref not found (cross-reference table missing)',
    fi_i_png_iend: 'IEND chunk missing', fi_i_png_crc: '{x} chunk(s) with a bad CRC', fi_i_jpeg_eoi: 'JPEG end marker (FFD9) missing',
    fi_i_gif_end: 'GIF trailer byte (0x3B) missing', fi_i_size_decl: 'Header declares {x} bytes, but file is smaller',
    fi_i_zip_eocd: 'ZIP End of Central Directory not found', fi_i_zip_cd: 'ZIP central directory incomplete/corrupt', fi_i_zip_local: '{x} ZIP entries point to a wrong local header',
    fi_i_zip64: 'ZIP64 — entry list not parsed',
    fi_i_box: 'Box "{x}" runs past end of file', fi_i_moov: 'moov box (video index) missing — unfinished recording or corrupt',
    fi_i_pe: 'Invalid PE header', fi_i_json: 'Invalid JSON: {x}', fi_i_xml: 'Invalid XML', fi_i_text_ok: 'Valid text ({x}).',
    fi_i_img_ok: 'Image decoded by the browser ({x}).', fi_i_img_fail: 'The browser failed to decode the image — likely corrupt or unsupported format.',
    fi_i_media_ok: 'Media read by the browser (duration {x}).', fi_i_media_fail: 'The browser cannot read the media — corrupt, truncated, or a codec Chrome does not support.',
    fi_i_unknown: 'Unrecognized format — structure cannot be checked (hashes still apply).',
    fi_i_nosubtle: 'WebCrypto unavailable (page not HTTPS/local file) — only MD5 computed.',
    fi_s_mismatch: 'Extension .{x} does not match the content ({y}).',
    fi_s_disguised: '{y} file disguised with a .{x} extension — a common malicious upload pattern (CWE-434).',
    fi_s_double_ext: 'Double/deceptive extension: "{x}".', fi_s_rtlo: 'File name uses a right-to-left override (RTLO) character to disguise the extension.',
    fi_s_exec: 'Executable file ({x}) — do not run it if the source is untrusted.',
    fi_s_polyglot: 'Script code "{x}" found inside a binary file (offset {y}) — possible polyglot/webshell.',
    fi_s_appended_zip: 'A ZIP archive is appended after the end of the {x} (polyglot/steganography).',
    fi_s_trailing: '{x} bytes of extra data after the end-of-file marker.',
    fi_s_svg_script: 'SVG contains \x3Cscript> — runs when the SVG is opened directly/served from your domain (stored XSS).',
    fi_s_svg_event: 'SVG/HTML contains event handlers ({x}) that can run JavaScript.',
    fi_s_js_uri: 'A javascript: URI is present in the file.', fi_s_foreign: 'SVG uses <foreignObject> (can embed HTML).',
    fi_s_xxe: 'DOCTYPE/ENTITY declaration — XXE risk if parsed server-side (CWE-611).', fi_s_ext_ref: '{x} reference(s) to external (http/https) resources.',
    fi_s_html: 'HTML file — if uploaded and served from your domain, its scripts run too.',
    fi_s_php: 'PHP code{x} — potential webshell if uploaded to a server.', fi_s_script: 'Shell/interpreter script (shebang {x}).',
    fi_s_pdf_js: 'PDF contains JavaScript (/JavaScript or /JS).', fi_s_pdf_open: 'PDF has an automatic action on open (/OpenAction).',
    fi_s_pdf_aa: 'PDF has automatic additional actions (/AA) on pages/fields.', fi_s_pdf_launch: 'PDF can launch an external program (/Launch).',
    fi_s_pdf_embed: 'PDF contains embedded files (/EmbeddedFile).', fi_s_pdf_rich: 'PDF contains RichMedia/Flash content.',
    fi_s_pdf_submit: 'PDF contains a form that submits data (/SubmitForm).', fi_s_pdf_xfa: 'PDF uses XFA forms.',
    fi_s_pdf_hexname: 'PDF object names are hex-escaped (e.g. /J#61vaScript) — a common malicious-PDF technique.',
    fi_s_pdf_uri: '{x} link(s) (/URI) in the PDF.', fi_s_pdf_enc: 'PDF is encrypted — part of its content cannot be inspected.',
    fi_s_macro: 'Document contains VBA macros ({x}).{y}', fi_s_macro_ext: ' The .{x} extension normally has no macros — suspicious.',
    fi_s_activex: 'Document contains ActiveX controls.', fi_s_ole_embed: '{x} embedded OLE object(s).',
    fi_s_remote_tpl: 'External relationship "{x}" → {y} (remote template/object, CVE-2017-0199/Follina technique).',
    fi_s_ext_links: '{x} external hyperlink(s) in the document.', fi_s_rtf_obj: 'RTF contains an embedded OLE object{x}.',
    fi_s_zip_slip: 'Archive entry with path traversal: "{x}" (Zip Slip, CWE-22).', fi_s_zip_enc: '{x} encrypted archive entries (cannot be inspected).',
    fi_s_zip_bomb: 'Compression ratio {x}× — zip bomb indicator (CWE-409).', fi_s_zip_exec: 'Archive contains executables/scripts: {x}.',
    fi_s_gps: 'GPS location stored in metadata: {x} — strip it before sharing (privacy, CWE-359).',
    fi_s_exif_owner: 'Metadata contains owner/device serial identity: {x}.'
  }
};
Object.keys(FI_I18N).forEach(l => { I18N[l] = Object.assign({}, FI_I18N[l], I18N[l] || {}); });

const FI_MAX_BYTES = 256 * 1024 * 1024;
const FI_SCAN_SLICE = 32 * 1024 * 1024; // pola teks dicari di 32 MB awal + 32 MB akhir
const FI_XML_MAX = 4 * 1024 * 1024;
const u16le = (b, o) => b[o] | (b[o + 1] << 8);
const u16be = (b, o) => (b[o] << 8) | b[o + 1];
const u32le = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u32be = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const syncsafe = (b, o) => ((b[o] & 127) << 21) | ((b[o + 1] & 127) << 14) | ((b[o + 2] & 127) << 7) | (b[o + 3] & 127);
function latin1(b, s, e) {
  let out = '';
  const end = Math.min(e === undefined ? b.length : e, b.length);
  for (let i = s || 0; i < end; i += 0x8000) out += String.fromCharCode.apply(null, b.subarray(i, Math.min(end, i + 0x8000)));
  return out;
}
const sigBytes = s => (typeof s === 'string' ? Array.from(s, c => c.charCodeAt(0)) : s);
function humanSize(n) {
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return (i ? v.toFixed(2) : v) + ' ' + u[i] + (i ? ' (' + n.toLocaleString() + ' B)' : '');
}
function fmtDuration(s) {
  if (!isFinite(s)) return '?';
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = (s % 60).toFixed(s < 10 ? 2 : 0);
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(sec.includes('.') ? 5 : 2, '0');
}
let crcTable = null;
function crc32(b) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ---- Tanda tangan magic bytes. exec = executable, script = teks yang bisa dieksekusi.
const FI_TIFF_EXT = ['tif', 'tiff', 'dng', 'nef', 'cr2', 'arw', 'orf', 'rw2'];
const FI_ZIP_EXT = ['zip', 'docx', 'docm', 'dotx', 'dotm', 'xlsx', 'xlsm', 'xltx', 'xltm', 'xlsb', 'pptx', 'pptm', 'potx', 'ppsx', 'ppsm', 'odt', 'ods', 'odp', 'odg', 'epub', 'jar', 'war', 'ear', 'apk', 'aab', 'xpi', 'vsix', 'nupkg', 'whl', 'ipa', 'kmz', '3mf', 'cbz'];
const FI_SIGS = [
  { id: 'pdf', label: 'PDF', ext: ['pdf', 'ai'], mime: 'application/pdf', sig: '%PDF-' },
  { id: 'png', label: 'PNG', ext: ['png', 'apng'], mime: 'image/png', sig: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], img: true },
  { id: 'jpeg', label: 'JPEG', ext: ['jpg', 'jpeg', 'jpe', 'jfif'], mime: 'image/jpeg', sig: [0xFF, 0xD8, 0xFF], img: true },
  { id: 'gif', label: 'GIF', ext: ['gif'], mime: 'image/gif', sig: 'GIF8', img: true },
  { id: 'bmp', label: 'BMP', ext: ['bmp', 'dib'], mime: 'image/bmp', sig: 'BM', img: true },
  { id: 'tiff', label: 'TIFF', ext: FI_TIFF_EXT, mime: 'image/tiff', sig: [0x49, 0x49, 0x2A, 0x00] },
  { id: 'tiff', label: 'TIFF', ext: FI_TIFF_EXT, mime: 'image/tiff', sig: [0x4D, 0x4D, 0x00, 0x2A] },
  { id: 'ico', label: 'ICO', ext: ['ico', 'cur'], mime: 'image/x-icon', sig: [0, 0, 1, 0], img: true },
  { id: 'psd', label: 'Photoshop PSD', ext: ['psd', 'psb'], sig: '8BPS' },
  { id: 'riff', label: 'RIFF', ext: [], sig: 'RIFF' },
  { id: 'zip', label: 'ZIP', ext: FI_ZIP_EXT, mime: 'application/zip', sig: 'PK\x03\x04' },
  { id: 'zip', label: 'ZIP', ext: FI_ZIP_EXT, mime: 'application/zip', sig: 'PK\x05\x06' },
  { id: 'rar', label: 'RAR', ext: ['rar'], sig: 'Rar!\x1A\x07' },
  { id: '7z', label: '7-Zip', ext: ['7z'], sig: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C] },
  { id: 'gz', label: 'GZIP', ext: ['gz', 'tgz', 'svgz'], sig: [0x1F, 0x8B] },
  { id: 'bz2', label: 'BZIP2', ext: ['bz2', 'tbz2'], sig: 'BZh' },
  { id: 'xz', label: 'XZ', ext: ['xz', 'txz'], sig: [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00] },
  { id: 'mp3', label: 'MP3 (ID3)', ext: ['mp3'], mime: 'audio/mpeg', sig: 'ID3', media: true },
  { id: 'mp3', label: 'MP3', ext: ['mp3', 'mp2'], mime: 'audio/mpeg', test: b => b[0] === 0xFF && (b[1] & 0xE0) === 0xE0 && (b[1] & 0x06) !== 0, media: true },
  { id: 'aac', label: 'AAC (ADTS)', ext: ['aac'], mime: 'audio/aac', test: b => b[0] === 0xFF && (b[1] & 0xF6) === 0xF0, media: true },
  { id: 'ogg', label: 'Ogg', ext: ['ogg', 'oga', 'ogv', 'opus', 'spx'], mime: 'audio/ogg', sig: 'OggS', media: true },
  { id: 'flac', label: 'FLAC', ext: ['flac'], mime: 'audio/flac', sig: 'fLaC', media: true },
  { id: 'bmff', label: 'MP4', ext: [], test: b => latin1(b, 4, 8) === 'ftyp' },
  { id: 'mkv', label: 'Matroska/WebM', ext: ['mkv', 'webm', 'mka', 'mk3d'], mime: 'video/webm', sig: [0x1A, 0x45, 0xDF, 0xA3], media: true },
  { id: 'pe', label: 'Windows PE (EXE/DLL)', ext: ['exe', 'dll', 'sys', 'scr', 'com', 'cpl', 'ocx', 'drv', 'efi', 'mui'], sig: 'MZ', exec: true },
  { id: 'elf', label: 'ELF (Linux/Android)', ext: ['', 'so', 'elf', 'bin', 'o', 'out', 'ko'], sig: [0x7F, 0x45, 0x4C, 0x46], exec: true },
  { id: 'macho', label: 'Mach-O (macOS)', ext: ['', 'dylib', 'bundle'], test: b => [0xFEEDFACE, 0xFEEDFACF, 0xCEFAEDFE, 0xCFFAEDFE].includes(u32be(b, 0)), exec: true },
  { id: 'class', label: 'Java class', ext: ['class'], sig: [0xCA, 0xFE, 0xBA, 0xBE], exec: true },
  { id: 'ole', label: 'OLE2 (Office lama: doc/xls/ppt, MSI, MSG)', ext: ['doc', 'dot', 'xls', 'xlt', 'ppt', 'pot', 'pps', 'msi', 'msg', 'vsd', 'pub'], sig: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] },
  { id: 'rtf', label: 'RTF', ext: ['rtf', 'doc'], sig: '{\\rtf' },
  { id: 'sqlite', label: 'SQLite', ext: ['sqlite', 'sqlite3', 'db', 'db3', 's3db'], sig: 'SQLite format 3\0' },
  { id: 'wasm', label: 'WebAssembly', ext: ['wasm'], sig: '\0asm', exec: true },
  { id: 'woff', label: 'WOFF', ext: ['woff'], sig: 'wOFF' },
  { id: 'woff2', label: 'WOFF2', ext: ['woff2'], sig: 'wOF2' },
  { id: 'font', label: 'TrueType/OpenType', ext: ['ttf', 'otf', 'ttc'], test: b => [0x00010000, 0x4F54544F, 0x74746366, 0x74727565].includes(u32be(b, 0)) },
  { id: 'lnk', label: 'Windows shortcut (LNK)', ext: ['lnk'], sig: [0x4C, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00], exec: true },
  { id: 'iso', label: 'ISO 9660', ext: ['iso'], test: b => latin1(b, 0x8001, 0x8006) === 'CD001' }
];
// Sub-jenis RIFF dan ISO BMFF (ftyp brand).
const FI_RIFF = {
  WAVE: { label: 'WAV', ext: ['wav'], mime: 'audio/wav', media: true },
  WEBP: { label: 'WebP', ext: ['webp'], mime: 'image/webp', img: true },
  'AVI ': { label: 'AVI', ext: ['avi'], mime: 'video/x-msvideo', media: true }
};
const FI_BRANDS = [
  [/^qt/, { label: 'QuickTime MOV', ext: ['mov', 'qt', 'mp4'], mime: 'video/quicktime', media: true }],
  [/^(heic|heix|hevc|heim|heis|mif1|msf1)/, { label: 'HEIC/HEIF', ext: ['heic', 'heif', 'hif'], mime: 'image/heic' }],
  [/^avi[fs]/, { label: 'AVIF', ext: ['avif'], mime: 'image/avif', img: true }],
  [/^M4[AB]/, { label: 'M4A (AAC)', ext: ['m4a', 'm4b', 'mp4'], mime: 'audio/mp4', media: true }],
  [/^3g/, { label: '3GP', ext: ['3gp', '3g2', 'mp4'], mime: 'video/3gpp', media: true }],
  [/^crx/, { label: 'Canon CR3', ext: ['cr3'] }],
  [/./, { label: 'MP4', ext: ['mp4', 'm4v', 'm4a', 'mov', 'f4v'], mime: 'video/mp4', media: true }]
];
const FI_TEXT_EXT = ['txt', 'csv', 'tsv', 'md', 'log', 'ini', 'cfg', 'conf', 'yml', 'yaml', 'toml', 'js', 'mjs', 'cjs', 'ts', 'css', 'scss', 'sql', 'env', 'properties', 'gradle', 'mod', 'sum', 'lock', 'gitignore', 'dockerfile', 'srt', 'vtt', 'ics', 'vcf', 'bat', 'cmd', 'ps1', 'vbs', 'reg', 'c', 'h', 'cpp', 'cs', 'java', 'go', 'rs', 'kt', 'swift', 'dart', 'vue', 'jsx', 'tsx', 'eml', 'pem', 'crt', 'key', 'asc', 'sig', ''];
const FI_TEXT_KINDS = {
  svg: { label: 'SVG', ext: ['svg'], mime: 'image/svg+xml', script: true },
  html: { label: 'HTML', ext: ['html', 'htm', 'xhtml', 'shtml', 'hta'], mime: 'text/html', script: true },
  php: { label: 'PHP', ext: ['php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'phar', 'inc'], mime: 'application/x-php', script: true },
  script: { label: 'Script (shebang)', ext: ['sh', 'bash', 'zsh', 'py', 'pl', 'rb', 'js', 'cgi', ''], script: true },
  xml: { label: 'XML', ext: ['xml', 'xsd', 'xsl', 'xslt', 'rss', 'atom', 'plist', 'config', 'csproj', 'props', 'resx', 'xaml', 'kml', 'gpx', 'xlf', 'pom', 'wsdl'], mime: 'application/xml' },
  json: { label: 'JSON', ext: ['json', 'map', 'webmanifest', 'ipynb', 'geojson', 'har', 'lock', 'jsonld'], mime: 'application/json' },
  text: { label: 'Text', ext: FI_TEXT_EXT, mime: 'text/plain' }
};
// Ekstensi milik format biner: teks berekstensi ini berarti salah jenis.
const FI_BINARY_EXT = new Set(FI_SIGS.flatMap(s => s.ext).concat(Object.values(FI_RIFF).flatMap(s => s.ext), FI_BRANDS.flatMap(([, s]) => s.ext)).filter(Boolean));

function fiDetect(b) {
  const s = FI_SIGS.find(x => (x.test ? b.length > 8 && x.test(b) : startsWithBytes(b, sigBytes(x.sig))));
  if (s) {
    if (s.id === 'riff') return { ...s, ...(FI_RIFF[latin1(b, 8, 12)] || {}), sub: latin1(b, 8, 12) };
    if (s.id === 'bmff') { const brand = latin1(b, 8, 12); return { ...s, ...FI_BRANDS.find(([re]) => re.test(brand))[1], brand }; }
    return { ...s };
  }
  return fiTextKind(b);
}
function fiTextKind(b) {
  const head = b.subarray(0, 8192);
  let enc = 'utf-8';
  if (head[0] === 0xFF && head[1] === 0xFE) enc = 'utf-16le';
  else if (head[0] === 0xFE && head[1] === 0xFF) enc = 'utf-16be';
  else if (head.includes(0)) return { id: 'unknown', label: tr('fi_unknown'), ext: [] };
  const lo = new TextDecoder(enc).decode(head).replace(/^﻿/, '').trimStart().slice(0, 2048).toLowerCase();
  let kind = 'text';
  if (/<svg[\s>]/.test(lo)) kind = 'svg';
  else if (lo.includes('<?php')) kind = 'php';
  else if (/^(<!doctype html|<html|<head|<body|<script)/.test(lo)) kind = 'html';
  else if (lo.startsWith('<?xml') || /^<[a-z][\w:.-]*[\s>]/.test(lo)) kind = 'xml';
  else if (lo.startsWith('#!')) kind = 'script';
  else if (/^[{[]/.test(lo)) kind = 'json';
  return { id: kind, enc, text: true, ...FI_TEXT_KINDS[kind], label: kind === 'text' ? tr('fi_k_text') : FI_TEXT_KINDS[kind].label };
}

// ---- Konteks analisis: kumpulan integritas / temuan / metadata.
function fiContext(file, b) {
  const r = { name: file.name, size: file.size, browserType: file.type || '—', modified: file.lastModified, det: null, hashes: {}, integ: [], finds: [], meta: [], verify: '', busy: false };
  const full = b.length <= 2 * FI_SCAN_SLICE;
  return {
    file, b, n: b.length, r, full,
    text: full ? latin1(b) : latin1(b, 0, FI_SCAN_SLICE) + latin1(b, b.length - FI_SCAN_SLICE),
    good: (k, v) => r.integ.push({ ok: true, msg: dtr(k, v) }),
    bad: (k, v) => r.integ.push({ ok: false, msg: dtr(k, v) }),
    warnI: (k, v) => r.integ.push({ ok: null, msg: dtr(k, v) }),
    trunc: what => r.integ.push({ ok: false, msg: dtr('fi_i_trunc', { x: what }) }),
    find: (sev, k, v, link) => r.finds.push({ sev, msg: dtr(k, v), link: link || '' }),
    meta: (k, v) => { if (v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && isNaN(v))) r.meta.push([k, String(Array.isArray(v) ? v.join(', ') : v).slice(0, 600)]); }
  };
}
// Data setelah penanda akhir (JPEG/PNG/GIF): ZIP tertempel = polyglot, selain itu catatan ringan.
function fiTrailing(ctx, from, what) {
  const extra = ctx.n - from;
  if (extra <= 0) return;
  if (latin1(ctx.b, from, Math.min(ctx.n, from + 1048576)).includes('PK\x03\x04')) ctx.find('HIGH', 'fi_s_appended_zip', { x: what });
  else if (extra > 16) ctx.find('LOW', 'fi_s_trailing', { x: extra.toLocaleString() });
}

// ---- EXIF (TIFF IFD) — dipakai JPEG, PNG eXIf, WebP EXIF, TIFF.
const EXIF_TAGS = {
  0x010E: 'ImageDescription', 0x010F: 'Make', 0x0110: 'Model', 0x0112: 'Orientation', 0x0131: 'Software', 0x0132: 'DateTime',
  0x013B: 'Artist', 0x8298: 'Copyright', 0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized', 0x9010: 'OffsetTime',
  0x829A: 'ExposureTime', 0x829D: 'FNumber', 0x8827: 'ISO', 0x920A: 'FocalLength', 0xA002: 'PixelXDimension', 0xA003: 'PixelYDimension',
  0xA420: 'ImageUniqueID', 0xA430: 'CameraOwnerName', 0xA431: 'BodySerialNumber', 0xA433: 'LensMake', 0xA434: 'LensModel', 0xA435: 'LensSerialNumber'
};
const EXIF_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
function fiTiff(b, base) {
  if (base + 8 > b.length) return null;
  const le = b[base] === 0x49, u16 = o => (le ? u16le : u16be)(b, base + o), u32 = o => (le ? u32le : u32be)(b, base + o);
  if (u16(2) !== 42) return null;
  const tags = {}, gps = {};
  const one = (type, off, i) => {
    if (type === 3) return u16(off + i * 2);
    if (type === 4 || type === 9) return u32(off + i * 4);
    if (type === 5 || type === 10) return u32(off + i * 8) / (u32(off + i * 8 + 4) || 1);
    return b[base + off + i];
  };
  const value = (type, count, at) => {
    const size = (EXIF_SIZES[type] || 1) * count, off = size <= 4 ? at : u32(at);
    if (base + off + size > b.length) return undefined;
    if (type === 2) return latin1(b, base + off, base + off + count).replace(/\0+$/, '').trim();
    const arr = [];
    for (let i = 0; i < Math.min(count, 8); i++) arr.push(one(type, off, i));
    return count === 1 ? arr[0] : arr;
  };
  const ifd = (off, sink, names, depth) => {
    if (!off || depth > 3 || base + off + 2 > b.length) return;
    const cnt = u16(off);
    for (let i = 0; i < cnt && i < 512; i++) {
      const e = off + 2 + i * 12;
      if (base + e + 12 > b.length) break;
      const tag = u16(e);
      if (tag === 0x8769) ifd(u32(e + 8), sink, names, depth + 1);
      else if (tag === 0x8825) ifd(u32(e + 8), gps, null, depth + 1);
      else if (!names || names[tag]) { const v = value(u16(e + 2), u32(e + 4), e + 8); if (v !== undefined && v !== '') sink[names ? names[tag] : tag] = v; }
    }
  };
  ifd(u32(4), tags, EXIF_TAGS, 0);
  return { tags, gps };
}
const fiNum = v => (typeof v === 'number' ? +v.toFixed(4) : v);
function fiExif(ctx, base) {
  const ex = fiTiff(ctx.b, base);
  if (!ex) return;
  Object.keys(ex.tags).forEach(k => ctx.meta('EXIF ' + k, Array.isArray(ex.tags[k]) ? ex.tags[k].map(fiNum) : fiNum(ex.tags[k])));
  const owner = ['CameraOwnerName', 'BodySerialNumber', 'LensSerialNumber', 'Artist'].filter(k => ex.tags[k]).map(k => k + '=' + ex.tags[k]);
  if (owner.length) ctx.find('LOW', 'fi_s_exif_owner', { x: owner.join(', ') });
  const g = ex.gps, dms = a => (Array.isArray(a) ? a[0] + a[1] / 60 + a[2] / 3600 : a);
  if (Array.isArray(g[2]) && Array.isArray(g[4])) {
    const lat = dms(g[2]) * (g[1] === 'S' ? -1 : 1), lon = dms(g[4]) * (g[3] === 'W' ? -1 : 1);
    if (isFinite(lat) && isFinite(lon) && (lat || lon)) fiGps(ctx, lat, lon, typeof g[6] === 'number' ? g[6] : null);
  }
}
function fiGps(ctx, lat, lon, alt) {
  const txt = lat.toFixed(6) + ', ' + lon.toFixed(6) + (alt !== null ? ' (alt ' + alt.toFixed(1) + ' m)' : '');
  ctx.meta('GPS', txt);
  ctx.find('MEDIUM', 'fi_s_gps', { x: txt }, 'https://www.openstreetmap.org/?mlat=' + lat.toFixed(6) + '&mlon=' + lon.toFixed(6) + '#map=16/' + lat.toFixed(6) + '/' + lon.toFixed(6));
}

// ---- Penangan per format
function fiJpeg(ctx) {
  const b = ctx.b;
  let o = 2;
  while (o + 4 <= ctx.n && b[o] === 0xFF) {
    const m = b[o + 1];
    if (m === 0xD9 || m === 0xDA) break;
    if (m === 0xFF || m === 0x01 || (m >= 0xD0 && m <= 0xD8)) { o += m === 0xFF ? 1 : 2; continue; }
    const len = u16be(b, o + 2);
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) ctx.meta(tr('fi_m_dim'), u16be(b, o + 7) + ' × ' + u16be(b, o + 5));
    if (m === 0xE1 && latin1(b, o + 4, o + 10) === 'Exif\0\0') fiExif(ctx, o + 10);
    if (m === 0xE1 && latin1(b, o + 4, o + 32) === 'http://ns.adobe.com/xap/1.0/') fiXmp(ctx, latin1(b, o + 33, o + 2 + len));
    if (m === 0xFE) ctx.meta(tr('fi_m_comment'), utf8Strict(b.subarray(o + 4, o + 2 + len)) || '');
    o += 2 + len;
  }
  let eoi = -1;
  for (let i = ctx.n - 2; i >= Math.max(2, ctx.n - 64 * 1024 * 1024); i--) if (b[i] === 0xFF && b[i + 1] === 0xD9) { eoi = i; break; }
  if (eoi < 0) { ctx.trunc(tr('fi_i_jpeg_eoi')); return; }
  ctx.good('fi_i_ok_struct', { x: 'JPEG' });
  fiTrailing(ctx, eoi + 2, 'JPEG');
}
function fiXmp(ctx, xml) {
  [['xmp:CreatorTool', 'XMP CreatorTool'], ['photoshop:DateCreated', 'XMP DateCreated'], ['dc:creator', 'XMP Creator'], ['pdf:Producer', 'XMP Producer']].forEach(([tag, label]) => {
    const m = rx1(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>|' + tag + '="([^"]*)"', 'g'), xml);
    if (m) ctx.meta(label, (m[1] || m[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  });
  const lat = rx1(/exif:GPSLatitude="([^"]+)"/g, xml);
  if (lat) ctx.meta('XMP GPSLatitude', lat[1]);
}
function fiPng(ctx) {
  const b = ctx.b;
  let o = 8, iend = false, crcBad = 0;
  while (o + 12 <= ctx.n) {
    const len = u32be(b, o), type = latin1(b, o + 4, o + 8), d = o + 8;
    if (d + len + 4 > ctx.n) { ctx.trunc(dtr('fi_i_box', { x: type })); return; }
    if (crc32(b.subarray(o + 4, d + len)) !== u32be(b, d + len)) crcBad++;
    if (type === 'IHDR') { ctx.meta(tr('fi_m_dim'), u32be(b, d) + ' × ' + u32be(b, d + 4)); ctx.meta('Bit depth / color type', b[d + 8] + ' / ' + b[d + 9]); }
    if (type === 'tEXt' || type === 'iTXt') {
      const z = b.indexOf(0, d);
      if (z > d && z < d + len) {
        const key = latin1(b, d, z);
        const val = type === 'tEXt' ? latin1(b, z + 1, d + len) : (b[z + 1] ? '(compressed)' : utf8Strict(b.subarray(b.indexOf(0, b.indexOf(0, z + 3) + 1) + 1, d + len)) || '');
        if (key === 'XML:com.adobe.xmp') fiXmp(ctx, val); else ctx.meta('PNG ' + key, val);
      }
    }
    if (type === 'eXIf') fiExif(ctx, d);
    o = d + len + 4;
    if (type === 'IEND') { iend = true; break; }
  }
  if (!iend) ctx.trunc(tr('fi_i_png_iend'));
  if (crcBad) ctx.bad('fi_i_trunc', { x: dtr('fi_i_png_crc', { x: crcBad }) });
  if (iend && !crcBad) ctx.good('fi_i_ok_struct', { x: 'PNG' });
  if (iend) fiTrailing(ctx, o, 'PNG');
}
function fiGif(ctx) {
  ctx.meta(tr('fi_m_dim'), u16le(ctx.b, 6) + ' × ' + u16le(ctx.b, 8));
  ctx.meta('Version', latin1(ctx.b, 0, 6));
  let end = ctx.n - 1;
  while (end > 6 && ctx.b[end] === 0) end--;
  if (ctx.b[end] === 0x3B) ctx.good('fi_i_ok_struct', { x: 'GIF' }); else ctx.trunc(tr('fi_i_gif_end'));
}
function fiDeclaredSize(ctx, declared, label) {
  if (declared > ctx.n) ctx.trunc(dtr('fi_i_size_decl', { x: declared.toLocaleString() }));
  else { ctx.good('fi_i_ok_struct', { x: label }); if (ctx.n - declared > 16) ctx.find('LOW', 'fi_s_trailing', { x: (ctx.n - declared).toLocaleString() }); }
}
function fiBmp(ctx) {
  const b = ctx.b, dv = new DataView(b.buffer, b.byteOffset);
  ctx.meta(tr('fi_m_dim'), dv.getInt32(18, true) + ' × ' + Math.abs(dv.getInt32(22, true)));
  ctx.meta('Bits per pixel', u16le(b, 28));
  fiDeclaredSize(ctx, u32le(b, 2), 'BMP');
}
function fiRiff(ctx) {
  const b = ctx.b;
  fiDeclaredSize(ctx, u32le(b, 4) + 8, ctx.r.det.label);
  for (let o = 12; o + 8 <= ctx.n;) {
    const id = latin1(b, o, o + 4), size = u32le(b, o + 4), d = o + 8;
    if (id === 'fmt ' && ctx.r.det.sub === 'WAVE') { ctx.meta('Channels', u16le(b, d + 2)); ctx.meta('Sample rate', u32le(b, d + 4) + ' Hz'); ctx.meta('Bits per sample', u16le(b, d + 14)); }
    if (id === 'LIST' && latin1(b, d, d + 4) === 'INFO') {
      for (let p = d + 4; p + 8 <= Math.min(ctx.n, d + size);) {
        const sid = latin1(b, p, p + 4), ss = u32le(b, p + 4);
        ctx.meta('RIFF ' + sid, latin1(b, p + 8, p + 8 + ss).replace(/\0+$/, ''));
        p += 8 + ss + (ss & 1);
      }
    }
    if (id === 'EXIF') fiExif(ctx, latin1(b, d, d + 6) === 'Exif\0\0' ? d + 6 : d);
    if (id === 'XMP ') fiXmp(ctx, latin1(b, d, d + size));
    o = d + size + (size & 1);
  }
}
// QuickTime: string atom (©xyz, ©mak, ©mod, ©swr) = [len u16][lang u16][teks].
function fiQtString(b, text, start, tag) {
  const i = text.indexOf('\xA9' + tag);
  if (i < 0) return '';
  const p = start + i + 4, len = u16be(b, p);
  return len > 0 && len < 512 ? (utf8Strict(b.subarray(p + 4, p + 4 + len)) || '') : '';
}
function fiBmff(ctx) {
  const b = ctx.b, boxes = [];
  let o = 0, moov = null, ok = true;
  while (o + 8 <= ctx.n) {
    let size = u32be(b, o), hdr = 8;
    const type = latin1(b, o + 4, o + 8);
    if (size === 1) { size = u32be(b, o + 8) * 4294967296 + u32be(b, o + 12); hdr = 16; } else if (size === 0) size = ctx.n - o;
    if (size < hdr || o + size > ctx.n) { ctx.trunc(dtr('fi_i_box', { x: type })); ok = false; break; }
    boxes.push(type);
    if (type === 'moov') moov = [o + hdr, o + size];
    o += size;
  }
  ctx.meta('Brand (ftyp)', ctx.r.det.brand);
  ctx.meta('Top-level boxes', boxes.slice(0, 20).join(' '));
  const isImage = /HEIC|AVIF|CR3/.test(ctx.r.det.label);
  if (!moov) { if (!isImage) { ctx.bad('fi_i_moov'); ok = false; } }
  else {
    const text = latin1(b, moov[0], Math.min(moov[1], moov[0] + 64 * 1024 * 1024)), mv = text.indexOf('mvhd');
    if (mv >= 0) {
      const p = moov[0] + mv + 4, v1 = b[p] === 1;
      const ct = v1 ? u32be(b, p + 4) * 4294967296 + u32be(b, p + 8) : u32be(b, p + 4);
      const ts = u32be(b, p + (v1 ? 20 : 12)), dur = v1 ? u32be(b, p + 24) * 4294967296 + u32be(b, p + 28) : u32be(b, p + 16);
      if (ct > 2082844800) ctx.meta(tr('fi_m_created'), new Date((ct - 2082844800) * 1000).toISOString());
      if (ts) ctx.meta(tr('fi_m_duration'), fmtDuration(dur / ts));
    }
    [['mak', 'Make'], ['mod', 'Model'], ['swr', 'Software'], ['day', 'Date']].forEach(([tag, label]) => ctx.meta(label, fiQtString(b, text, moov[0], tag)));
    const loc = fiQtString(b, text, moov[0], 'xyz') || (text.includes('ISO6709') && (rx1(/[+-]\d{1,2}\.\d{3,}[+-]\d{1,3}\.\d{3,}[^\0]{0,12}/g, text) || [''])[0]);
    const m = loc && rx1(/([+-]\d{1,2}\.\d+)([+-]\d{1,3}\.\d+)([+-]\d+(?:\.\d+)?)?/g, loc);
    if (m) fiGps(ctx, parseFloat(m[1]), parseFloat(m[2]), m[3] ? parseFloat(m[3]) : null);
  }
  if (ok && (moov || isImage)) ctx.good('fi_i_ok_struct', { x: ctx.r.det.label });
}
const ID3_NAMES = { TIT2: 'Title', TPE1: 'Artist', TPE2: 'Album artist', TALB: 'Album', TDRC: 'Year', TYER: 'Year', TCON: 'Genre', TRCK: 'Track', TSSE: 'Encoder', TENC: 'Encoded by', TCOP: 'Copyright', TPUB: 'Publisher', COMM: 'Comment' };
function fiId3Text(d, comm) {
  const enc = d[0], body = d.subarray(comm ? 4 : 1);
  const s = new TextDecoder(['latin1', 'utf-16', 'utf-16be', 'utf-8'][enc] || 'latin1').decode(body).replace(/\0+$/, '');
  return comm ? s.split('\0').pop() : s.replace(/\0/g, ' / ');
}
function fiMp3(ctx) {
  const b = ctx.b;
  if (ctx.r.det.sig !== 'ID3') return;
  const ver = b[3], end = Math.min(ctx.n, 10 + syncsafe(b, 6));
  ctx.meta('ID3', 'v2.' + ver);
  let o = 10;
  if (b[5] & 0x40) o += ver === 4 ? syncsafe(b, 10) : u32be(b, 10) + 4;
  while (ver >= 3 && o + 10 <= end) {
    const id = latin1(b, o, o + 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const sz = ver === 4 ? syncsafe(b, o + 4) : u32be(b, o + 4), d = b.subarray(o + 10, o + 10 + sz);
    if (ID3_NAMES[id]) ctx.meta(ID3_NAMES[id], fiId3Text(d, id === 'COMM'));
    if (id === 'APIC') ctx.meta('Cover art', (sz / 1024).toFixed(1) + ' KB');
    o += 10 + sz;
  }
  if (10 + syncsafe(b, 6) > ctx.n) ctx.trunc(dtr('fi_i_size_decl', { x: (10 + syncsafe(b, 6)).toLocaleString() }));
}
const PE_MACHINE = { 0x14C: 'x86', 0x8664: 'x64', 0xAA64: 'ARM64', 0x1C0: 'ARM', 0x1C4: 'ARMv7' };
function fiPe(ctx) {
  const b = ctx.b, pe = u32le(b, 0x3C);
  if (pe + 24 > ctx.n || latin1(b, pe, pe + 4) !== 'PE\0\0') { ctx.bad('fi_i_pe'); return; }
  const ts = u32le(b, pe + 8), chars = u16le(b, pe + 22), opt = u16le(b, pe + 24);
  ctx.meta('Machine', PE_MACHINE[u16le(b, pe + 4)] || '0x' + u16le(b, pe + 4).toString(16));
  ctx.meta(tr('fi_m_compiled'), ts ? new Date(ts * 1000).toISOString() : '');
  ctx.meta('Type', (chars & 0x2000 ? 'DLL' : 'EXE') + (opt === 0x20B ? ' (PE32+)' : ' (PE32)'));
  const net = ctx.text.includes('BSJB') && ctx.text.includes('mscoree.dll');
  if (net) ctx.meta('Runtime', '.NET (CLR)');
  ctx.good('fi_i_ok_struct', { x: 'PE' });
}
function fiElf(ctx) {
  ctx.meta('Class', ctx.b[4] === 2 ? '64-bit' : '32-bit');
  ctx.meta('Type', ({ 1: 'relocatable', 2: 'executable', 3: 'shared object', 4: 'core' })[u16le(ctx.b, 16)] || '?');
}
function fiOle(ctx) {
  const t = ctx.text, u = s => s.split('').join('\0');
  const vba = t.includes(u('_VBA_PROJECT')) || t.includes(u('VBA')) && t.includes(u('dir'));
  if (vba) ctx.find('HIGH', 'fi_s_macro', { x: 'VBA (OLE)', y: '' });
  if (t.includes(u('Ole10Native')) || t.includes(u('ObjectPool'))) ctx.find('MEDIUM', 'fi_s_ole_embed', { x: '≥1' });
  if (t.includes(u('SummaryInformation'))) ctx.meta('OLE streams', 'SummaryInformation');
  ctx.good('fi_i_ok_struct', { x: 'OLE2' });
}
function fiRtf(ctx) {
  if (/\\object\b|\\objdata\b/.test(ctx.text)) ctx.find(/\\objupdate\b/.test(ctx.text) ? 'HIGH' : 'MEDIUM', 'fi_s_rtf_obj', { x: /\\objupdate\b/.test(ctx.text) ? ' (\\objupdate)' : '' });
  ['author', 'operator', 'company', 'title', 'creatim', 'revtim'].forEach(k => {
    const m = rx1(new RegExp('\\{\\\\' + k + '\\s?([^}]*)\\}', 'g'), ctx.text);
    if (m) ctx.meta('RTF ' + k, m[1].replace(/\\(yr|mo|dy|hr|min)/g, ' ').trim());
  });
}

// ---- PDF
const PDF_RISKS = [
  [/\/(JavaScript|JS)\b/, 'HIGH', 'fi_s_pdf_js'], [/\/Launch\b/, 'HIGH', 'fi_s_pdf_launch'], [/\/OpenAction\b/, 'MEDIUM', 'fi_s_pdf_open'],
  [/\/AA\b/, 'MEDIUM', 'fi_s_pdf_aa'], [/\/EmbeddedFiles?\b/, 'MEDIUM', 'fi_s_pdf_embed'], [/\/(RichMedia|Flash)\b/, 'MEDIUM', 'fi_s_pdf_rich'],
  [/\/SubmitForm\b/, 'LOW', 'fi_s_pdf_submit'], [/\/XFA\b/, 'LOW', 'fi_s_pdf_xfa']
];
function pdfString(raw) {
  if (raw[0] === '<') {
    const hex = raw.slice(1, -1).replace(/\s+/g, '');
    const bytes = fromHex(hex.length % 2 ? hex + '0' : hex);
    return bytes[0] === 0xFE && bytes[1] === 0xFF ? new TextDecoder('utf-16be').decode(bytes.subarray(2)) : latin1(bytes);
  }
  const s = raw.slice(1, -1).replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (m, c) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' })[c] || (/^[0-7]+$/.test(c) ? String.fromCharCode(parseInt(c, 8)) : c));
  return s.startsWith('\xFE\xFF') ? new TextDecoder('utf-16be').decode(Uint8Array.from(s.slice(2), ch => ch.charCodeAt(0))) : s;
}
function pdfDate(s) {
  const m = rx1(/D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Z+-][\d']*)?/g, s);
  return m ? m[1] + '-' + (m[2] || '01') + '-' + (m[3] || '01') + ' ' + (m[4] || '00') + ':' + (m[5] || '00') + ':' + (m[6] || '00') + ' ' + (m[7] || '').replace(/'/g, '') : s;
}
// Object stream (ObjStm) dibuka agar kunci /JavaScript, /OpenAction, dll. di dalamnya ikut terbaca.
async function pdfInflated(ctx) {
  if (!ctx.full) return '';
  let out = '', count = 0;
  for (const m of ctx.text.matchAll(/\/ObjStm\b[\s\S]{0,600}?stream\r?\n/g)) {
    if (count++ > 400 || out.length > 16 * 1024 * 1024) break;
    const start = m.index + m[0].length, end = ctx.text.indexOf('endstream', start);
    if (end < 0 || end - start > 4 * 1024 * 1024) continue;
    try { out += '\n' + latin1(await inflateBytes(ctx.b.subarray(start, end), 'deflate')); } catch (e) { /* stream bukan zlib/rusak: lewati */ }
  }
  return out;
}
async function fiPdf(ctx) {
  const t = ctx.text, head = rx1(/%PDF-(\d\.\d)/g, t.slice(0, 1024));
  ctx.meta(tr('fi_m_pdfver'), head ? head[1] : '?');
  const tail = latin1(ctx.b, Math.max(0, ctx.n - 2048));
  let ok = true;
  if (!tail.includes('%%EOF')) { ctx.trunc(tr('fi_i_pdf_eof')); ok = false; }
  if (!t.includes('startxref')) { ctx.bad('fi_i_trunc', { x: tr('fi_i_pdf_xref') }); ok = false; }
  if (ok) ctx.good('fi_i_ok_struct', { x: 'PDF' });
  const all = t + (await pdfInflated(ctx));
  const unhex = nm => nm.replace(/#([0-9A-Fa-f]{2})/g, (x, h) => String.fromCharCode(parseInt(h, 16)));
  const hexRe = /\/[A-Za-z0-9]*#[0-9A-Fa-f]{2}[A-Za-z0-9#]*/g;
  if ([...all.matchAll(hexRe)].some(m => /^\/(JavaScript|JS|OpenAction|Launch|AA|EmbeddedFiles?|URI|ObjStm)$/.test(unhex(m[0])))) ctx.find('MEDIUM', 'fi_s_pdf_hexname');
  const deobf = all.replace(hexRe, unhex);
  PDF_RISKS.forEach(([re, sev, key]) => { if (re.test(deobf)) ctx.find(sev, key); });
  const uris = [...deobf.matchAll(/\/URI\s*\(/g)].length;
  if (uris) ctx.find('INFO', 'fi_s_pdf_uri', { x: uris });
  if (/\/Encrypt\b/.test(t)) ctx.find('INFO', 'fi_s_pdf_enc');
  const pages = [...deobf.matchAll(/\/Type\s*\/Page(?![s\w])/g)].length;
  ctx.meta(tr('fi_m_pages'), pages || '?');
  ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate'].forEach(k => {
    const m = rx1(new RegExp('/' + k + '\\s*(\\((?:\\\\.|[^\\\\)])*\\)|<[0-9A-Fa-f\\s]*>)', 'g'), deobf);
    if (m) { const v = pdfString(m[1]); ctx.meta('PDF ' + k, /Date$/.test(k) ? pdfDate(v) : v); }
  });
  const xmp = rx1(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/g, all.slice(0, 8 * 1024 * 1024));
  if (xmp) fiXmp(ctx, xmp[0]);
}

// ---- ZIP / Office / JAR / APK / ODF / EPUB
const OOXML_KIND = [['word/', 'Word (OOXML)', ['docx', 'docm', 'dotx', 'dotm']], ['xl/', 'Excel (OOXML)', ['xlsx', 'xlsm', 'xltx', 'xltm', 'xlsb']], ['ppt/', 'PowerPoint (OOXML)', ['pptx', 'pptm', 'potx', 'potm', 'ppsx', 'ppsm']], ['visio/', 'Visio (OOXML)', ['vsdx', 'vsdm']]];
const ZIP_EXEC_RE = /\.(exe|dll|scr|com|bat|cmd|ps1|vbs|vbe|js|jse|wsf|hta|lnk|msi|jar|sh|apk|iso|img)$/i;
const REMOTE_REL_RE = /(attachedTemplate|oleObject|frame|subDocument|externalLinkPath)$/i;
function zipEntries(ctx) {
  const b = ctx.b;
  let eocd = -1;
  for (let i = ctx.n - 22; i >= Math.max(0, ctx.n - 65557); i--) if (u32le(b, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) { ctx.trunc(tr('fi_i_zip_eocd')); return null; }
  const count = u16le(b, eocd + 10), cdSize = u32le(b, eocd + 12), cdOff = u32le(b, eocd + 16);
  if (cdOff === 0xFFFFFFFF || count === 0xFFFF) { ctx.warnI('fi_i_zip64'); return null; }
  if (cdOff + cdSize > ctx.n) { ctx.trunc(tr('fi_i_zip_cd')); return null; }
  const list = [];
  for (let p = cdOff, k = 0; k < count && p + 46 <= ctx.n && u32le(b, p) === 0x02014b50; k++) {
    const nl = u16le(b, p + 28);
    list.push({ name: new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl)), flags: u16le(b, p + 8), method: u16le(b, p + 10), csize: u32le(b, p + 20), size: u32le(b, p + 24), local: u32le(b, p + 42) });
    p += 46 + nl + u16le(b, p + 30) + u16le(b, p + 32);
  }
  if (list.length !== count) ctx.bad('fi_i_trunc', { x: tr('fi_i_zip_cd') });
  const badLocal = list.filter(e => e.local + 30 > ctx.n || u32le(b, e.local) !== 0x04034b50).length;
  if (badLocal) ctx.bad('fi_i_trunc', { x: dtr('fi_i_zip_local', { x: badLocal }) });
  else if (list.length === count) ctx.good('fi_i_ok_struct', { x: 'ZIP' });
  return list;
}
async function zipText(ctx, e) {
  if (!e || e.size > FI_XML_MAX || e.flags & 1) return '';
  const p = e.local, off = p + 30 + u16le(ctx.b, p + 26) + u16le(ctx.b, p + 28), data = ctx.b.subarray(off, off + e.csize);
  try { return new TextDecoder().decode(e.method === 0 ? data : await inflateBytes(data, 'deflate-raw')); } catch (err) { return ''; }
}
const xmlDoc = s => new DOMParser().parseFromString(s, 'application/xml');
const xmlVal = (doc, tag) => { const el = doc.getElementsByTagNameNS('*', tag)[0]; return el ? el.textContent.trim() : ''; };
async function fiZip(ctx) {
  const list = zipEntries(ctx);
  if (!list) return;
  const names = list.map(e => e.name), byName = n => list.find(e => e.name === n), ext = ctx.r.ext;
  const total = list.reduce((s, e) => s + e.size, 0), comp = list.reduce((s, e) => s + e.csize, 0);
  ctx.meta(tr('fi_m_entries'), list.length);
  ctx.meta(tr('fi_m_unzipped'), humanSize(total));
  const kind = OOXML_KIND.find(([dir]) => names.includes('[Content_Types].xml') && names.some(n => n.startsWith(dir)));
  const mimetype = byName('mimetype') ? (await zipText(ctx, byName('mimetype'))).trim() : '';
  if (kind) Object.assign(ctx.r.det, { label: kind[1], ext: kind[2] });
  else if (mimetype === 'application/epub+zip') Object.assign(ctx.r.det, { label: 'EPUB', ext: ['epub'] });
  else if (mimetype.includes('opendocument')) Object.assign(ctx.r.det, { label: 'OpenDocument', ext: ['odt', 'ods', 'odp', 'odg', 'odf', 'ott'] });
  else if (names.includes('AndroidManifest.xml')) Object.assign(ctx.r.det, { label: 'Android APK', ext: ['apk', 'aab', 'xapk'], exec: true });
  else if (names.includes('META-INF/MANIFEST.MF')) Object.assign(ctx.r.det, { label: 'Java JAR', ext: ['jar', 'war', 'ear'], exec: true });
  if (mimetype) ctx.meta('mimetype', mimetype);
  // Keamanan arsip
  const slip = names.find(n => /(^|[\\/])\.\.([\\/]|$)/.test(n) || /^([a-z]:)?[\\/]/i.test(n));
  if (slip) ctx.find('HIGH', 'fi_s_zip_slip', { x: slip });
  const enc = list.filter(e => e.flags & 1).length;
  if (enc) ctx.find('LOW', 'fi_s_zip_enc', { x: enc });
  if (comp && total / comp > 100 && total > 100 * 1024 * 1024) ctx.find('HIGH', 'fi_s_zip_bomb', { x: Math.round(total / comp) });
  const execs = names.filter(n => ZIP_EXEC_RE.test(n));
  if (execs.length && !ctx.r.det.exec) ctx.find('MEDIUM', 'fi_s_zip_exec', { x: execs.slice(0, 5).join(', ') + (execs.length > 5 ? ' …' : '') });
  // Office: macro, ActiveX, OLE, relasi eksternal, properti dokumen
  const vba = names.filter(n => /vbaProject\.bin$/i.test(n));
  if (vba.length) ctx.find('HIGH', 'fi_s_macro', { x: vba.join(', '), y: /^(docx|xlsx|pptx|dotx|xltx|potx|ppsx)$/.test(ext) ? dtr('fi_s_macro_ext', { x: ext }) : '' });
  if (names.some(n => /(^|\/)activeX\//i.test(n))) ctx.find('MEDIUM', 'fi_s_activex');
  const ole = names.filter(n => /\/embeddings\/.*\.(bin|ole)$/i.test(n) || /oleObject\d*\.bin$/i.test(n)).length;
  if (ole) ctx.find('MEDIUM', 'fi_s_ole_embed', { x: ole });
  let links = 0;
  for (const e of list.filter(x => /\.rels$/i.test(x.name)).slice(0, 80)) {
    for (const m of (await zipText(ctx, e)).matchAll(/<Relationship\b[^>]*>/g)) {
      if (!/TargetMode\s*=\s*"External"/i.test(m[0])) continue;
      const type = (rx1(/Type\s*=\s*"([^"]*)"/g, m[0]) || [])[1] || '', target = (rx1(/Target\s*=\s*"([^"]*)"/g, m[0]) || [])[1] || '';
      if (REMOTE_REL_RE.test(type)) ctx.find('HIGH', 'fi_s_remote_tpl', { x: type.split('/').pop(), y: target.slice(0, 200) });
      else links++;
    }
  }
  if (links) ctx.find('INFO', 'fi_s_ext_links', { x: links });
  const core = await zipText(ctx, byName('docProps/core.xml')), app = await zipText(ctx, byName('docProps/app.xml')), odf = await zipText(ctx, byName('meta.xml'));
  if (core) { const d = xmlDoc(core); ['title', 'subject', 'creator', 'keywords', 'description', 'lastModifiedBy', 'revision', 'created', 'modified', 'lastPrinted'].forEach(k => ctx.meta('Office ' + k, xmlVal(d, k))); }
  if (app) { const d = xmlDoc(app); ['Application', 'AppVersion', 'Company', 'Manager', 'Template', 'Pages', 'Words', 'Slides', 'TotalTime'].forEach(k => ctx.meta('Office ' + k, xmlVal(d, k))); }
  if (odf) { const d = xmlDoc(odf); ['generator', 'title', 'initial-creator', 'creator', 'creation-date', 'date', 'editing-duration'].forEach(k => ctx.meta('ODF ' + k, xmlVal(d, k))); }
}

// ---- File teks (SVG/HTML/XML/PHP/JSON/skrip)
const TEXT_RISKS = [
  [/<script[\s>]/i, 'HIGH', 'fi_s_svg_script', ['svg']], [/javascript\s*:/i, 'HIGH', 'fi_s_js_uri', ['svg', 'xml']],
  [/<foreignObject[\s>]/i, 'MEDIUM', 'fi_s_foreign', ['svg']], [/<!ENTITY\s|<!DOCTYPE[^>]*(SYSTEM|PUBLIC|\[)/i, 'HIGH', 'fi_s_xxe', ['svg', 'xml']]
];
function fiText(ctx) {
  const det = ctx.r.det, b = ctx.b.subarray(0, Math.min(ctx.n, 16 * 1024 * 1024));
  const s = new TextDecoder(det.enc || 'utf-8').decode(b).replace(/^﻿/, '');
  const lines = s.split('\n').length, crlf = s.includes('\r\n');
  ctx.meta(tr('fi_m_encoding'), (det.enc || 'utf-8') + (ctx.b[0] === 0xEF || ctx.b[0] === 0xFF || ctx.b[0] === 0xFE ? ' (BOM)' : ''));
  ctx.meta(tr('fi_m_lines'), lines.toLocaleString() + (crlf ? ' (CRLF)' : ' (LF)'));
  if (det.id === 'json') {
    try { JSON.parse(s); ctx.good('fi_i_text_ok', { x: 'JSON' }); } catch (e) { ctx.bad('fi_i_json', { x: e.message }); }
  } else if (det.id === 'xml' || det.id === 'svg') {
    const d = xmlDoc(s);
    if (d.getElementsByTagName('parsererror').length) ctx.bad('fi_i_trunc', { x: tr('fi_i_xml') }); else ctx.good('fi_i_text_ok', { x: det.label });
    if (det.id === 'svg') {
      const root = d.documentElement;
      ['width', 'height', 'viewBox'].forEach(a => ctx.meta('SVG ' + a, root && root.getAttribute(a)));
      const gen = rx1(/<!--\s*Generator:\s*([^-]*)-->/g, s);
      if (gen) ctx.meta('Generator', gen[1].trim());
    }
  } else if (utf8Strict(b) !== null || det.enc !== 'utf-8') ctx.good('fi_i_text_ok', { x: det.enc || 'UTF-8' });
  TEXT_RISKS.forEach(([re, sev, key, kinds]) => { if (kinds.includes(det.id) && re.test(s)) ctx.find(sev, key); });
  if (det.id === 'svg' || det.id === 'xml') {
    const ev = [...new Set([...s.matchAll(/\s(on[a-z]+)\s*=/gi)].map(m => m[1].toLowerCase()))];
    if (ev.length) ctx.find('HIGH', 'fi_s_svg_event', { x: ev.slice(0, 6).join(', ') });
    const ext = [...s.matchAll(/(?:xlink:)?href\s*=\s*["']\s*(?:https?:)?\/\//gi)].length;
    if (ext) ctx.find('LOW', 'fi_s_ext_ref', { x: ext });
  }
  if (det.id === 'html') ctx.find('MEDIUM', 'fi_s_html');
  if (det.id === 'php') {
    const fns = [...new Set([...s.matchAll(/\b(eval|assert|system|exec|shell_exec|passthru|popen|proc_open|base64_decode|gzinflate|str_rot13|move_uploaded_file)\s*\(/gi)].map(m => m[1].toLowerCase()))];
    ctx.find('HIGH', 'fi_s_php', { x: fns.length ? ': ' + fns.join(', ') : '' });
  }
  if (det.id === 'script') ctx.find('MEDIUM', 'fi_s_script', { x: s.split('\n')[0].slice(0, 80) });
}

// ---- Pemeriksaan umum: ekstensi, nama menipu, polyglot
const DECEPTIVE_EXT_RE = /\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|gif|txt|mp[34]|zip)\.(exe|scr|com|bat|cmd|pif|js|jse|vbs|vbe|wsf|hta|ps1|jar|lnk|msi|php\d?|phtml|asp|aspx|jsp|svg|html?)$/i;
function fiCheckName(ctx) {
  const det = ctx.r.det, ext = ctx.r.ext, show = det.label;
  if (/[‪-‮⁦-⁩]/.test(ctx.r.name)) ctx.find('HIGH', 'fi_s_rtlo');
  if (DECEPTIVE_EXT_RE.test(ctx.r.name)) ctx.find('HIGH', 'fi_s_double_ext', { x: ctx.r.name });
  if (det.exec) ctx.find(det.ext.includes(ext) ? 'MEDIUM' : 'HIGH', 'fi_s_exec', { x: det.label });
  if (det.id === 'unknown') return;
  const okExt = det.text && !det.script ? !FI_BINARY_EXT.has(ext) || det.ext.includes(ext) : det.ext.includes(ext);
  if (okExt) return;
  ctx.find(det.exec || det.script ? 'HIGH' : 'MEDIUM', det.exec || det.script ? 'fi_s_disguised' : 'fi_s_mismatch', { x: ext || tr('fi_none'), y: show });
}
// Pola sengaja panjang/berkonteks: data terkompresi/terenkripsi (FLAC, MP4, PDF terenkripsi) berisi byte acak,
// sehingga token pendek seperti "<%" atau "<script>" bisa muncul kebetulan (false positive).
const POLYGLOT_RE = /<\?php[\s/]|<script[\s>][^\0]{0,2000}?<\/script>|<%@\s*(page|language|import)\b|<%=?\s*(eval|execute|response\.write|request[.([])|\b(eval|assert)\s*\(\s*(base64_decode|gzinflate|str_rot13|atob)\s*\(|\b(system|shell_exec|passthru)\s*\(\s*\$_(GET|POST|REQUEST)/gi;
function fiPolyglot(ctx) {
  if (ctx.r.det.text || ['zip', 'gz', 'bz2', 'xz', '7z', 'rar', 'pe', 'elf', 'macho', 'wasm', 'class', 'sqlite', 'ole', 'unknown'].includes(ctx.r.det.id)) return;
  const m = rx1(POLYGLOT_RE, ctx.text);
  if (m) ctx.find('HIGH', 'fi_s_polyglot', { x: m[0].trim(), y: '0x' + m.index.toString(16) });
}
// ---- Dekode oleh browser (Chrome): bukti gambar/media bisa dibaca = tidak rusak.
async function fiBrowserImage(ctx) {
  try {
    const bmp = await createImageBitmap(ctx.file);
    ctx.good('fi_i_img_ok', { x: bmp.width + ' × ' + bmp.height });
    bmp.close();
  } catch (e) { ctx.bad('fi_i_img_fail'); }
}
function fiBrowserMedia(ctx) {
  return new Promise(resolve => {
    const el = document.createElement('video'), url = URL.createObjectURL(ctx.file);
    const done = ok => {
      clearTimeout(timer);
      if (ok === true) {
        const dur = fmtDuration(el.duration);
        ctx.good('fi_i_media_ok', { x: dur });
        ctx.meta(tr('fi_m_duration_b'), dur);
        if (el.videoWidth) ctx.meta(tr('fi_m_resolution'), el.videoWidth + ' × ' + el.videoHeight);
      } else if (ok === false) ctx.warnI('fi_i_media_fail');
      el.removeAttribute('src'); el.load(); URL.revokeObjectURL(url);
      resolve();
    };
    const timer = setTimeout(() => done(null), 10000);
    el.preload = 'metadata'; el.muted = true;
    el.onloadedmetadata = () => done(true);
    el.onerror = () => done(false);
    el.src = url;
  });
}
const FI_HANDLERS = { jpeg: fiJpeg, png: fiPng, gif: fiGif, bmp: fiBmp, riff: fiRiff, bmff: fiBmff, mp3: fiMp3, pe: fiPe, elf: fiElf, ole: fiOle, rtf: fiRtf, pdf: fiPdf, zip: fiZip,
  tiff: ctx => fiExif(ctx, 0), svg: fiText, html: fiText, php: fiText, script: fiText, xml: fiText, json: fiText, text: fiText };
const FI_HASH_ALGOS = ['SHA-1', 'SHA-256', 'SHA-512'];
async function fiHashes(ctx) {
  const out = { MD5: toHex(md5(ctx.b)) };
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) { ctx.warnI('fi_i_nosubtle'); return out; }
  for (const a of FI_HASH_ALGOS) out[a] = toHex(new Uint8Array(await subtle.digest(a, ctx.b)));
  return out;
}
async function inspectFile(file) {
  const ext = (rx1(/\.([^./\\]+)$/g, file.name) || ['', ''])[1].toLowerCase();
  if (!file.size) {
    const r = { name: file.name, size: 0, ext, det: { label: '—', ext: [] }, hashes: {}, integ: [{ ok: false, msg: tr('fi_err_empty') }], finds: [], meta: [], verify: '' };
    r.hashes = await fiHashes({ b: new Uint8Array(0), warnI: k => r.integ.push({ ok: null, msg: tr(k) }) });
    return r;
  }
  if (file.size > FI_MAX_BYTES) return { name: file.name, size: file.size, ext, det: { label: '—', ext: [] }, hashes: {}, integ: [{ ok: false, msg: tr('fi_err_big') }], finds: [], meta: [], verify: '' };
  const b = new Uint8Array(await file.arrayBuffer()), ctx = fiContext(file, b), r = ctx.r;
  r.ext = ext;
  r.det = fiDetect(b);
  r.magic = toHex(b.subarray(0, 16)).replace(/(..)/g, '$1 ').trim();
  r.entropy = shannon(b.subarray(0, Math.min(b.length, 4 * 1024 * 1024))).toFixed(2) + ' bit/byte';
  const handler = FI_HANDLERS[r.det.id];
  if (handler) await handler(ctx); else if (r.det.id === 'unknown') ctx.warnI('fi_i_unknown');
  fiCheckName(ctx);
  fiPolyglot(ctx);
  if (r.det.img) await fiBrowserImage(ctx);
  if (r.det.media) await fiBrowserMedia(ctx);
  r.hashes = await fiHashes(ctx);
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };
  r.finds.sort((a, c) => rank[a.sev] - rank[c.sev]);
  return r;
}
function fiVerdict(r) {
  if (r.finds.some(f => f.sev === 'HIGH')) return 'danger';
  return r.finds.some(f => f.sev === 'MEDIUM') || r.integ.some(x => x.ok === false) ? 'warn' : 'ok';
}
// Checksum: hex (MD5/SHA-1/SHA-256/SHA-512, juga baris "hash  file"), atau SRI sha256-/sha512- (base64).
const HASH_BY_LEN = { 32: 'MD5', 40: 'SHA-1', 64: 'SHA-256', 128: 'SHA-512' };
function fiVerify(hashes, input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const sri = rx1(/^(sha256|sha512)-([A-Za-z0-9+/]+={0,2})$/gi, s);
  const cands = sri ? [toHex(b64ToBytes(sri[2]))] : [...s.matchAll(/\b[0-9a-f]{32,128}\b/gi)].map(m => m[0].toLowerCase()).filter(h => HASH_BY_LEN[h.length]);
  if (!cands.length) return { ok: false, text: tr('fi_hash_badinput') };
  const hit = Object.keys(hashes).find(a => cands.includes(hashes[a]));
  return hit ? { ok: true, text: dtr('fi_hash_match', { x: hit }) } : { ok: false, text: dtr('fi_hash_mismatch', { x: HASH_BY_LEN[cands[0].length] || '?' }) };
}
// @@FILE-END
