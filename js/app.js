const SIDE_KEY = 'scaSideWidth', SIDE_OPEN_KEY = 'scaSideOpen', SIDE_MIN = 220, SIDE_MAX = 720;
const TBL_SIZE_KEY = 'scaTblSize';
const ITEMS_KEY = 'scaItems';
// Daftar tab atas + kunci localStorage untuk setelan tab mana yang ditampilkan.
const TABS_KEY = 'scaVisibleTabs';
const TAB_ORDER_KEY = 'scaTabOrder';
const PIN_KEY = 'scaPinnedTabs';
const TAB_LIST = [
  { key: 'sca', label: 'SCA & Dockerfile' },
  { key: 'eol', label: 'EOL runtime/framework' },
  { key: 'dast', label: 'DAST pasif (URL)' },
  { key: 'sast', label: 'SAST (Kode)' },
  { key: 'colab', label: 'Colab Server' },
  { key: 'file', label: 'Analisis file' },
  // { key: 'jwt', label: 'JWT Decode' }, -- dinonaktifkan, pakai Smart Decode
  { key: 'decode', label: 'Smart Decode' },
  { key: 'diff', label: 'Diff & Sensor Secret' },
  { key: 'ocr', label: 'OCR Gambar' },
  { key: 'color', label: 'Color Picker' },
  { key: 'dbg', label: 'Hook Debug' },
  { key: 'rate', label: 'Rate Limiter (dari curl)' },
  { key: 'rto', label: 'RTO (kirim lambat)' },
  { key: 'mw', label: 'Cek Basic Middleware' },
  { key: 'swag', label: 'Swag' },
  { key: 'ping', label: 'Multi Ping' },
  { key: 'clock', label: 'Jam Dunia' },
  { key: 'git', label: 'Git Lens' },
  { key: 'shop', label: 'Shopee Hook' },
  { key: 'wa', label: 'WA Hook' },
  { key: 'skip', label: 'Skip Link' },
  { key: 'vpn', label: 'VPN Docker' },
  { key: 'sheet', label: 'Sheet Viewer' },
  { key: 'img', label: 'Studio Gambar' },
  { key: 'pup', label: 'Puppeteer Record' }
];
const COLAB_SONAR_URL = 'https://colab.research.google.com/drive/1_Mx-FfnXU9aqYy6UqIzlX7myA3ysdwSt?usp=sharing';
const COLAB_AI_URL = 'https://colab.research.google.com/drive/1J0ikc9KemPid4dzbdNQeQkHDRRovoTBP?usp=sharing';
// Potongan jawaban dari satu baris SSE chat completions ("data: {...}"); baris lain diabaikan.
function aiDelta(line) {
  const d = line.replace(/^data:\s*/, '').trim();
  if (!d || d === '[DONE]') return '';
  try { return JSON.parse(d).choices[0].delta.content || ''; } catch (e) { return ''; }
}
const DEFAULT_PROJECT = 'Tanpa nama';
// Nama project dari isi file (field "name"/artifactId/module); kosong bila tidak ada.
function projectFromContent(type, text) {
  let m = null;
  try {
    if (type === 'npm-pkg' || type === 'npm-lock') {
      const d = JSON.parse(text);
      return String(d.name || (d.packages && d.packages[''] && d.packages[''].name) || '').trim();
    }
    if (type === 'maven-pom') m = text.replace(/<parent>[\s\S]*?<\/parent>/, '').match(/<artifactId>\s*([^<\s]+)\s*<\/artifactId>/);
    else if (type === 'cargo-toml') m = text.match(/\[package\][^[]*?\bname\s*=\s*"([^"]+)"/);
    else if (type === 'go-mod') m = text.match(/^module\s+(\S+)/m);
  } catch (e) { return ''; }
  return m ? m[1].split('/').pop() : '';
}
// Batas aman ~5 juta karakter localStorage (disisakan untuk kunci lain).
const STORAGE_BUDGET = 4500000;

// Lockfile besar dipadatkan menjadi daftar package saja: [nama, versi, ekosistem, dev, direct, lisensi].
// File non-package (mis. Dockerfile) atau yang gagal diparse disimpan apa adanya.
function toStoredForm(type, text) {
  const parse = PARSERS[type];
  if (!parse) return { text, compact: false, parseError: '' };
  try {
    const pkgs = parse(text);
    if (!pkgs.length) return { text, compact: false, parseError: '' };
    const rows = pkgs.map(p => [p.name, p.version, p.eco, p.dev ? 1 : 0, p.direct == null ? null : +!!p.direct, p.license || null]);
    return { text: JSON.stringify({ unpinned: pkgs.unpinned || 0, skipped: pkgs.skipped || [], pkgs: rows }), compact: true, parseError: '' };
  } catch (e) { return { text, compact: false, parseError: e.message || String(e) }; }
}
const MAX_FILE_BYTES = 20 * 1024 * 1024;
// Isi item dari file: jenis, bentuk simpan, dan runtime (ditangkap sebelum dipadatkan, untuk cek EOL).
function itemContent(name, text) {
  const type = detectType(name, text);
  return { name, type, ...toStoredForm(type, text), runtimes: extractRuntimes(type, name, text) };
}
// Kunci unik item = project + nama file, tanpa beda huruf besar/kecil.
function sameItemKey(a, b) {
  return a.project.toLowerCase() === b.project.toLowerCase() && a.name.toLowerCase() === b.name.toLowerCase();
}
function expandCompact(text) {
  const d = JSON.parse(text);
  const out = d.pkgs.map(r => ({ name: r[0], version: r[1], eco: r[2], dev: !!r[3], direct: r[4] == null ? null : !!r[4], license: r[5] || '' }));
  out.unpinned = d.unpinned;
  out.skipped = d.skipped || [];
  return out;
}
// Nama project dari link repo: segmen terakhir sebelum /-/, /blob/, atau /tree/.
function projectFromLink(link) {
  try {
    const path = new URL(link).pathname.split(/\/(?:-\/|blob\/|tree\/)/)[0];
    return path.split('/').filter(Boolean).pop().replace(/\.git$/, '') || DEFAULT_PROJECT;
  } catch (e) { return DEFAULT_PROJECT; }
}

createApp({
  data() {
    return {
      tab: 'sca', over: false, items: [], nextId: 1, typeLabels: TYPE_LABELS,
      lang: detectLang(), theme: detectTheme(), tblSort: {}, tblSize: 'm',
      topMenuOpen: false, cmdOpen: false, cmdQ: '', cmdIdx: 0, toast: { msg: '', err: false },
      tabList: TAB_LIST.slice(), visibleTabs: {}, pinnedTabs: {}, dragTab: null, overTab: null,
      masterModal: false, masterCopied: false,
      pipe: {
        open: false, mini: false, floating: false, x: 140, y: 72, w: 780, h: 520,
        on: window.AppPipe ? window.AppPipe.isEnabled() : true,
        filter: 'all', q: '',
        logs: window.AppPipe ? window.AppPipe.getLogs() : [],
        stats: window.AppPipe ? window.AppPipe.getStats() : { outCount: 0, inCount: 0, idbCount: 0, outBytes: 0, inBytes: 0, idbBytes: 0 },
        sel: null, detTab: 'meta'
      },
      storage: { openDetail: false, resetModal: false, lsBytes: 0, quotaUsed: 0 },
      diff: {
        sub: 'diff', fmt: 'raw', view: 'split', left: '', right: '',
        ignoreTrim: false, ignoreCase: false, onlyChanged: false,
        maskIn: '',
        rules: { env: true, jwt: true, apikey: true, conn: true, pem: true, email: true, phone: true, ip: false }
      },
      apis: API_LIST, groups: API_GROUPS, stats: apiStats, dastText: '', dastNet: true, dastBusy: false, dastLogs: [], dastUrl: '', dastName: 'laporan_dast.html', dastError: '', vpn: { copied: '' }, vpnSteps: VPN_STEPS, vpnTrouble: VPN_TROUBLE, skip: { auto: localStorage.getItem('scaSkipAuto') !== '0', url: '', msg: '' }, dastLast: null, cj: { url: '', shown: '', op: 0.5, marks: {}, err: '' }, jsr: { res: null, msg: '', err: '', full: false, q: '', hot: false }, apiOpen: false, menuOpen: false, sideOpen: true, openKeys: {}, urlText: '', token: '', urlBusy: false, urlLogs: [],
      hookCopied: false, hookMsg: '',
      im: { src: {}, cur: {}, meta: null, hist: 0, tool: 'compress', busy: '', prog: 0, err: '', msg: '', over: false, fmt: 'image/webp', q: 82, outScale: 1, outSize: 0, outW: 0, outH: 0, outMeta: null, encBusy: false, avif: false, table: [], tableBusy: false, target: 500, cmp: 0, actual: false, aiGen: false,
        rs: { pct: 100, w: 0, h: 0, lock: true, alg: 'lanczos3' },
        fx: { preset: '', denoise: 0, deconv: 'none', sigma: 1.2, len: 9, angle: 0, iters: 10, amount: 0.6, radius: 1.0, threshold: 2, auto: false },
        ai: { model: 'w2x_photo', out: 2, noise: 1, tile: 192, ep: '' }, api: { prov: 'openai', key: '', prompt: '', models: {} }, boxes: [], boxMode: 'black' },
      sv: { books: [], cur: null, mode: 'sheet', q: '', gbook: '', gtotal: 0, gper: [], gbusy: false, inq: '', header: true, filters: {}, sort: { c: -1, desc: false }, total: 0, busy: '', scroll: 0, scrollX: 0, rowsVer: 0, hl: -1, stats: null, colW: 160, over: false, msg: '', err: '', recent: [], showDiff: false, dcfg: { a: '', b: '', keys: [], ic: true }, diff: null, dbusy: '', donly: '', dtotal: 0 },
      shp: { list: [], q: '', kw: '', level: '', mall: false, star: false, noAd: false, minSold: 0, minRate: 0, pMin: 0, pMax: 0, sort: 'sold', desc: true, page: 300, msg: '', err: '', paste: '' },
      wa: { list: [], q: '', chat: '', kind: '', dir: '', from: '', to: '', page: 300, msg: '', err: '', paste: '' },
      gl: { sources: [], commits: [], order: {}, binfo: {}, leak: {}, leakVer: 0, leakShow: false, leakSev: '', branch: '', zoom: 0, q: '', author: '', project: '', merge: 'all', from: '', to: '', heat: null, dateKind: 'a', view: 'list', page: 300, sel: null, files: null, filesBusy: false, busy: false, prog: '', err: '', msg: '', paste: '', pasteName: '', over: false, max: 20000, repNoMerge: true, copied: false },
      clock: { q: '', pins: [], now: Date.now(), live: true, fixedMs: null, base: 'mine', ts: '', copied: false },
      colab: { sonarUrl: COLAB_SONAR_URL, paste: '', url: '', token: '', key: '', copied: '', aiNotebook: COLAB_AI_URL,
        ai: { url: '', key: '', model: '', msg: '', err: '', q: '', msgs: [], busy: false } },
      ping: { targets: [], collapsed: {}, form: { name: '', url: '', group: '', interval: 10, timeout: 5000, expect: 'any', method: 'GET' }, editId: null, bulk: '', bulkGroup: '', bulkInterval: 10, filter: 'all', q: '', selId: null, sound: true, alarmDown: false, notif: false, running: true, tick: 0, now: Date.now(), alarm: null, err: '', msg: '', mixedOk: location.protocol !== 'https:', mixedTesting: false, mixedAt: 0, dlBusy: false },
      swag: { url: '', text: '', over: false, busy: false, err: '', msg: '', model: null, src: '', baseUrl: '', token: '', tags: {}, fmt: 'pm', copied: false, scriptCopied: false },
      rl: { err: '', curl: '', method: 'GET', url: '', headers: [], body: '', count: 20, delay: 150, copied: false, msg: '', busy: false, stop: false, results: [], csvCopied: false },
      rto: { err: '', curl: '', method: 'POST', url: '', headers: [], body: '', kbps: 8, sizeKb: 64, count: 1, delay: 500, copied: false, csvCopied: false, msg: '', busy: false, stop: false, ctl: null, results: [] },
      // Cek Basic Middleware: target punya user sendiri; default dapat diedit.
      mw: { url: 'https://httpbin.org/post', method: 'POST', delayMs: 150, sizesKb: [2, 10, 500], busy: false, stop: false, copied: false, csvCopied: false, jsonCopied: false, msg: '', editor: { method: 'POST', url: 'https://httpbin.org/post', headers: 'Content-Type: application/json', body: '{"username":"test","password":"test"}', busy: false, status: null, respHeaders: '', respBody: '', error: '', msg: '' } },
      mwResults: [],
      pup: { list: [], sel: {}, view: null, edit: { id: null, value: '' }, gapEdit: { id: null, i: -1, value: '' }, msg: '', err: '', usage: '', hidden: {}, newGroup: '', moveTo: '' },
      sideW: 330, resizing: false, persistedIds: [], unsavedIds: [], project: '', pasteName: '', pasteText: '', omitDev: false, enrich: true,
      scanning: false, logs: [], error: '', dropMsg: '', reportUrl: '', reportName: 'laporan_scan.html',
      codeText: 'const el = document.getElementById("out");\nel.innerHTML = userInput;\nconst r = eval(expr);',
      sastResults: [], sastDone: false,
      eolResults: [], eolBusy: false, eolDone: false,
      license: true, sbomBusy: false, appVersion: APP_VERSION,
      editFields: ['project', 'name'], edit: { id: null, field: '', value: '' }, reupId: null,
      // Smart Decode: key/IV di form hanya di memori (tidak pernah ke localStorage)
      fi: { results: [], busy: false, over: false, copied: '' },
      ocr: { engine: 'tess', lang: 'ind+eng', imgUrl: '', imgInfo: '', busy: false, progress: '', text: '', done: false, used: '', error: '', copied: false, over: false, spaceKey: '', spaceEngine: '', ai: { preset: 'openrouter', baseUrl: OCR_PRESETS[0].baseUrl, model: OCR_PRESETS[0].model, token: '', mode: 'detail', prompt: '' } },
      ocrEngines: ['tess', 'space', 'ai'], ocrPresets: OCR_PRESETS,
      col: { imgUrl: '', imgId: '', imgName: '', imgW: 0, imgH: 0, avg: 1, over: false, msg: '', err: '', hover: null, dominant: [], cur: null, alphaPct: 100, manual: '', copied: '', coll: [], hist: [], thumbs: {}, exp: 'ai', histLimit: 50 },
      colSampleList: ['ui', 'spectrum', 'sunset'], colTw: COL_TW, colRoles: COL_ROLES,
      dec: { input: '', busy: false, chains: [], error: '', copied: '', note: '', form: decFormDefault(), tries: [], tryBusy: false },
      decSamples: DEC_SAMPLES, decEncs: ['auto', 'hex', 'base64', 'utf8'], decModes: ['CBC', 'GCM', 'CTR', 'ECB']
    };
  },
  computed: {
    allDetailOpen() { return this.apis.every(a => this.openKeys[a.key]); },
    shownTabs() {
      const vis = this.tabList.filter(t => this.visibleTabs[t.key]);
      const pinned = vis.filter(t => this.pinnedTabs[t.key]);
      const rest = vis.filter(t => !this.pinnedTabs[t.key]);
      return pinned.concat(rest);
    },
    tabOrderChanged() { return this.tabList.some((t, i) => t.key !== TAB_LIST[i].key); },
    // Perintah sonar-scanner dari URL + token output notebook Colab (token hanya di memori).
    colabCmd() {
      const c = this.colab, url = c.url.trim() || '<URL>', token = c.token.trim() || '<TOKEN>', key = c.key.trim();
      return {
        ps: `$env:SONAR_TOKEN = "${token}"; sonar-scanner "-Dsonar.host.url=${url}"` + (key ? ` "-Dsonar.projectKey=${key}"` : ''),
        sh: `SONAR_TOKEN="${token}" sonar-scanner -Dsonar.host.url=${url}` + (key ? ` -Dsonar.projectKey=${key}` : '')
      };
    },
    cmdList() {
      const catTab = this.t('cmdCatTab'), catAct = this.t('cmdCatAct');
      const tabs = this.tabList.map(t => ({
        id: 't:' + t.key,
        label: (this.pinnedTabs[t.key] ? '★ ' : '') + this.t('tab_' + t.key),
        sub: t.key + (this.pinnedTabs[t.key] ? ' pin fav' : ''),
        cat: catTab,
        run: () => { this.visibleTabs[t.key] = true; this.tab = t.key; this.saveVisibleTabs(); }
      }));
      const acts = [
        { id: 'a:master', label: '⚡ ' + this.t('masterHookMenu'), sub: 'master hook bookmarklet all in one wa shopee sheet swag', cat: catAct, run: () => this.openMasterHook() },
        { id: 'a:pipe', label: '⇅ ' + this.t('pipeTitle'), sub: 'pipe inbound outbound network traffic log interceptor', cat: catAct, run: () => this.togglePipePanel() },
        { id: 'a:pin', label: (this.pinnedTabs[this.tab] ? '☆ ' : '★ ') + this.t(this.pinnedTabs[this.tab] ? 'unpinTip' : 'pinTip'), sub: 'pin favorite star tab', cat: catAct, run: () => this.togglePinTab(this.tab) },
        { id: 'a:side', label: (this.sideOpen ? '◧ ' : '▢ ') + this.t(this.sideOpen ? 'sideHideTip' : 'sideShowTip'), sub: 'sidebar', cat: catAct, run: () => this.toggleSide() },
        { id: 'a:theme', label: (this.theme === 'light' ? '🌙 ' : '☀️ ') + this.t('themeTip'), sub: 'theme dark light', cat: catAct, run: () => this.toggleTheme() },
        { id: 'a:lang', label: '🌐 ' + this.t('langTip'), sub: 'language id en', cat: catAct, run: () => this.toggleLang() },
        { id: 'a:tbls', label: '⊞ ' + this.t('menuTblSize') + ': S', sub: 'table compact', cat: catAct, run: () => this.setTblSize('s') },
        { id: 'a:tblm', label: '⊞ ' + this.t('menuTblSize') + ': M', sub: 'table normal', cat: catAct, run: () => this.setTblSize('m') },
        { id: 'a:tbll', label: '⊞ ' + this.t('menuTblSize') + ': L', sub: 'table large', cat: catAct, run: () => this.setTblSize('l') },
        { id: 'a:export', label: '⬇ ' + this.t('backupExport'), sub: 'backup export json', cat: catAct, run: () => this.exportAllData() },
        { id: 'a:import', label: '⬆ ' + this.t('backupImport'), sub: 'restore import json', cat: catAct, run: () => this.$refs.backupFile && this.$refs.backupFile.click() },
        { id: 'a:reset', label: '🗑 ' + this.t('resetFullBtn'), sub: 'reset full clear factory wipe storage', cat: catAct, run: () => { this.storage.resetModal = true; } }
      ];
      return tabs.concat(acts);
    },
    cmdFiltered() {
      const toks = this.cmdQ.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!toks.length) return this.cmdList;
      return this.cmdList.filter(c => {
        const hay = (c.label + ' ' + (c.sub || '') + ' ' + c.cat).toLowerCase();
        return toks.every(k => hay.indexOf(k) >= 0);
      });
    },
    colHex6() { return this.col.cur ? colToHex(this.col.cur) : '#b8652c'; },
    colCss() { const c = this.col.cur || { r: 0, g: 0, b: 0, a: 1 }; return { rgba: 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + c.a + ')' }; },
    colInfo() {
      const c = this.col.cur;
      if (!c) return {};
      const W = { r: 255, g: 255, b: 255 }, K = { r: 0, g: 0, b: 0 };
      const cWhite = colContrast(c, W), cBlack = colContrast(c, K);
      const scale = [0.8, 0.6, 0.4, 0.2].map(t => colToHex(colMix(c, W, t))).concat([colToHex(c)], [0.2, 0.4, 0.6, 0.8].map(t => colToHex(colMix(c, K, t))));
      return { cWhite, cBlack, textOn: cWhite >= cBlack ? '#ffffff' : '#000000', nearest: colNearestTw(c), scale };
    },
    colFormats() {
      const c = this.col.cur;
      if (!c) return [];
      const h = colToHsl(c), a = c.a;
      const mx = Math.max(c.r, c.g, c.b) / 255, mn = Math.min(c.r, c.g, c.b) / 255;
      const hsv = 'hsv(' + h.h + ', ' + Math.round(mx ? (mx - mn) / mx * 100 : 0) + '%, ' + Math.round(mx * 100) + '%)';
      const k = 1 - mx, cm = v => Math.round(k >= 1 ? 0 : (1 - v / 255 - k) / (1 - k) * 100);
      return [
        ['HEX', colToHex(c)], ['HEX8', colToHex(c, true)],
        ['RGB', 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')'], ['RGBA', 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + a + ')'],
        ['HSL', 'hsl(' + h.h + ', ' + h.s + '%, ' + h.l + '%)'], ['HSLA', 'hsla(' + h.h + ', ' + h.s + '%, ' + h.l + '%, ' + a + ')'],
        ['HSV', hsv], ['CMYK', 'cmyk(' + cm(c.r) + '%, ' + cm(c.g) + '%, ' + cm(c.b) + '%, ' + Math.round(k * 100) + '%)'],
        ['CSS var', '--color-primary: ' + colToHex(c, a < 1) + ';'], ['Flutter', 'Color(0x' + colToHex(c, true).slice(7).toUpperCase() + colToHex(c).slice(1).toUpperCase() + ')']
      ];
    },
    colHistShown() { return this.col.hist.slice(0, this.col.histLimit); },
    colExport() {
      const list = this.col.coll;
      if (!list.length) return '';
      const name = (x, i) => x.role || ('color' + (i + 1));
      const val = x => (x.hex8.endsWith('ff') ? x.hex : x.hex8);
      if (this.col.exp === 'css') return ':root {\n' + list.map((x, i) => '  --' + name(x, i) + ': ' + val(x) + ';').join('\n') + '\n}\n';
      if (this.col.exp === 'tw') return '// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n' + list.map((x, i) => "        '" + name(x, i) + "': '" + val(x) + "',").join('\n') + '\n      }\n    }\n  }\n};\n';
      if (this.col.exp === 'json') return JSON.stringify(Object.fromEntries(list.map((x, i) => [name(x, i), { hex: val(x), rgba: x.rgba, hsl: x.hsl }])), null, 2) + '\n';
      return tr('col_ai_head') + '\n' + list.map(x => '- ' + (x.role || tr('col_ai_norole')) + ': ' + val(x) + ' (' + x.rgba + ', ' + x.hsl + ')').join('\n') + '\n\n' + tr('col_ai_tail') + '\n';
    },
    ocrDefaultPrompt() { return tr('ocr_prompt_' + this.ocr.ai.mode); },
    hookScript() { return HOOK_SCRIPT; },
    hookBookmarklet() { return 'javascript:' + encodeURIComponent(HOOK_SCRIPT); },
    rateScript() { return this.rl.url.trim() && !rateCfgError(this.rl) ? buildRateScript(this.rl) : ''; },
    rateBookmarklet() { return this.rateScript ? 'javascript:' + encodeURIComponent(this.rateScript) : ''; },
    rateCounts() {
      const c = {};
      this.rl.results.forEach(r => {
        const key = r.status === 'error' ? 'error' : r.status === 429 ? '429' : r.status >= 500 ? '5xx' : r.status >= 400 ? '4xx' : '2xx/3xx';
        c[key] = (c[key] || 0) + 1;
      });
      return Object.entries(c).map(([k, n]) => k + ':' + n).join('  ');
    },
    rateErrorHint() {
      const r = this.rl.results, errs = r.filter(x => x.status === 'error');
      if (!errs.length) return '';
      if (errs.length === r.length) return tr('rate_hint_all').replace('{n}', r.length) + (errs[0].error || '') + ' ' + tr('rate_hint_all2');
      return tr('rate_hint_some').replace('{e}', errs.length).replace('{n}', r.length) + (errs[0].error || '');
    },
    rtoScript() { return this.rto.url.trim() ? buildRtoScript(this.rto) : ''; },
    rtoBookmarklet() { return this.rtoScript ? 'javascript:' + encodeURIComponent(this.rtoScript) : ''; },
    rtoEta() {
      const secs = (clampNum(this.rto.sizeKb, 1, 10240) * 1024 * 8) / (clampNum(this.rto.kbps, 2, 100000) * 1000);
      if (!isFinite(secs) || secs <= 0) return '—';
      return secs < 90 ? secs.toFixed(1) + L(' dtk') : (secs / 60).toFixed(1) + L(' mnt');
    },
    rtoErrorHint() {
      const r = this.rto.results, errs = r.filter(x => x.outcome === 'error');
      if (!errs.length) return '';
      if (errs.length === r.length) return tr('rto_hint_all').replace('{n}', r.length) + (errs[0].label || '') + ' ' + tr('rto_hint_all2');
      return tr('rto_hint_some').replace('{e}', errs.length).replace('{n}', r.length) + (errs[0].label || '');
    },
    mwScript() { return this.mw.url.trim() ? buildMwScript(this.mw) : ''; },
    mwBookmarklet() { return this.mwScript ? 'javascript:' + encodeURIComponent(this.mwScript) : ''; },
    mwSummary() {
      const c = { LULUS: 0, GAGAL: 0, ERROR: 0 };
      this.mwResults.forEach(r => { c[r.verdict] = (c[r.verdict] || 0) + 1; });
      return tr('mw_sum_pass') + ': ' + c.LULUS + ' · ' + tr('mw_sum_fail') + ': ' + c.GAGAL + ' · ' + tr('mw_sum_err') + ': ' + c.ERROR;
    },
    glLogCmd() { return GL_LOG_CMD; },
    glDays() { return LANG === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']; },
    glAuthors() {
      const m = new Map();
      this.gl.commits.forEach(c => { if (this.gl.project && c.project !== this.gl.project) return; const k = (c.ae || c.an || '').toLowerCase(); const a = m.get(k) || { key: k, name: c.an, n: 0 }; a.n++; m.set(k, a); });
      return [...m.values()].sort((a, b) => b.n - a.n);
    },
    glFilterOn() { const g = this.gl; return !!(g.q.trim() || g.author || g.merge !== 'all' || g.from || g.to || g.heat); },
    glAnyFilter() { return this.glFilterOn || !!this.gl.branch; },
    glBaseList() {
      const g = this.gl;
      if (g.branch) {
        const [sid, k] = g.branch.split(':'), bi = g.binfo[sid], list = g.order[sid] || [], bit = Number(k);
        if (!bi) return [];
        const w = bit >> 5, m = 1 << (bit & 31);
        return list.filter((c, i) => bi.bits[i * bi.W + w] & m);
      }
      if (g.project) { const s = g.sources.find(x => x.name === g.project); return s ? (g.order[s.id] || []) : []; }
      return g.sources.length === 1 ? (g.order[g.sources[0].id] || []) : g.commits;
    },
    glLeakState() {
      void this.gl.leakVer;
      const g = this.gl, ids = g.sources.filter(s => s.kind === 'git' && !(g.project && s.name !== g.project)).map(s => s.id);
      let done = 0, total = 0, run = false, any = false, blobs = 0;
      ids.forEach(id => { const st = g.leak[id]; if (!st) return; any = true; done += st.done; total += st.total; blobs += st.blobs; if (st.state === 'run') run = true; });
      return { any, run, done, total, blobs, pct: total ? Math.floor(done / total * 100) : 0, err: ids.map(id => g.leak[id] && g.leak[id].err).filter(Boolean).join('; ') };
    },
    glLeaks() {
      void this.gl.leakVer;
      const g = this.gl, out = [];
      g.sources.forEach(s => { if (g.project && s.name !== g.project) return; (this.glLeakItems[s.id] || []).forEach(it => out.push(it)); });
      const sev = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return out.filter(x => !g.leakSev || x.severity === g.leakSev).sort((a, b) => (sev[a.severity] - sev[b.severity]) || (a.status === 'head' ? -1 : 0) - (b.status === 'head' ? -1 : 0) || b.at - a.at);
    },
    glLeakCount() { void this.gl.leakVer; let n = 0; this.gl.sources.forEach(s => { if (!this.gl.project || s.name === this.gl.project) n += (this.glLeakItems[s.id] || []).length; }); return n; },
    glBranchOpts() {
      const g = this.gl, out = [];
      g.sources.forEach(s => {
        if (g.project && s.name !== g.project) return;
        const bi = g.binfo[s.id];
        if (!bi) return;
        bi.names.forEach((n, k) => out.push({ v: s.id + ':' + k, label: (g.sources.length > 1 && !g.project ? s.name + ' · ' : '') + n + (bi.kinds[k] === 'tag' ? ' (tag)' : bi.kinds[k] === 'remote' ? ' (remote)' : '') }));
      });
      return out;
    },
    glGanttSrc() {
      const g = this.gl;
      const s = g.branch ? g.sources.find(x => x.id === g.branch.split(':')[0]) : g.project ? g.sources.find(x => x.name === g.project) : (g.sources.length === 1 ? g.sources[0] : null);
      return s && g.binfo[s.id] ? s : null;
    },
    glGantt() {
      if (this.gl.view !== 'gantt' || !this.glGanttSrc) return null;
      let list = this.glFiltered;
      const capped = list.length > 6000;
      if (capped) list = list.slice(0, 6000);
      if (!list.length) return null;
      const bi = this.gl.binfo[this.glGanttSrc.id], tOf = c => this.glT(c);
      let span = 1; { let a = Infinity, b = -Infinity; list.forEach(c => { const t = tOf(c); a = Math.min(a, t); b = Math.max(b, t); }); span = Math.max(1, (b - a) / 86400); }
      const ppd = this.gl.zoom || Math.max(3, Math.min(48, Math.floor(24000 / span)));
      const pr = new Map();
      bi.names.forEach((n, i) => { [n, n.replace(/^[^/]+\//, '')].forEach(k => { if (!pr.has(k)) pr.set(k, i); }); });
      const lay = glGanttLayout(list, bi.owner, tOf, ppd, n => (pr.has(n) ? pr.get(n) : n === 'stash' ? 2000 : 1000), LANG === 'en' ? 'en-GB' : 'id-ID');
      lay.capped = capped; lay.ppd = ppd;
      return Vue.markRaw(lay);
    },
    glFiltered() {
      const g = this.gl, toks = g.q.toLowerCase().split(/\s+/).filter(Boolean);
      const fromT = g.from ? new Date(g.from + 'T00:00:00').getTime() / 1000 : null, toT = g.to ? new Date(g.to + 'T23:59:59').getTime() / 1000 : null;
      if (!this.glFilterOn) return this.glBaseList;
      return this.glBaseList.filter(c => {
        if (g.author && (c.ae || c.an || '').toLowerCase() !== g.author) return false;
        if (g.merge === 'no' && c.isMerge) return false;
        if (g.merge === 'only' && !c.isMerge) return false;
        const t = this.glT(c);
        if (fromT != null && t < fromT) return false;
        if (toT != null && t > toT) return false;
        if (g.heat) { const d = new Date(t * 1000); if ((d.getDay() + 6) % 7 !== g.heat.d || d.getHours() !== g.heat.h) return false; }
        return toks.every(k => c.hay.indexOf(k) >= 0);
      });
    },
    glPage() {
      const sorted = this.sortBy('glCommits', this.glFiltered, { msg: 'subject', branch: 'owner', author: 'an', date: c => this.glT(c), sha: 'sha', project: 'project' });
      return sorted.slice(0, this.gl.page);
    },
    glGraphOn() {
      const g = this.gl;
      if (this.glFilterOn || this.tblSort.glCommits) return false;
      const s = g.branch ? g.sources.find(x => x.id === g.branch.split(':')[0]) : g.project ? g.sources.find(x => x.name === g.project) : (g.sources.length === 1 ? g.sources[0] : null);
      return !!(s && s.graph);
    },
    glGraphData() { return this.glGraphOn ? glGraph(this.glBaseList) : { rows: new Map(), w: 0 }; },
    glSel() { const s = this.gl.sel; return s ? (this.gl.commits.find(c => c.sha === s) || null) : null; },
    glStats() {
      const L = this.glFiltered, z = n => String(n).padStart(2, '0');
      const dk = d => d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
      const days = new Map(), heat = Array.from({ length: 7 }, () => new Array(24).fill(0)), au = new Map();
      let merges = 0, first = Infinity, last = 0;
      L.forEach(c => {
        const t = this.glT(c), d = new Date(t * 1000), k = dk(d), hm = d.getHours() * 60 + d.getMinutes();
        const day = days.get(k) || { n: 0, min: 1e9, max: -1 };
        day.n++; day.min = Math.min(day.min, hm); day.max = Math.max(day.max, hm); days.set(k, day);
        heat[(d.getDay() + 6) % 7][d.getHours()]++;
        if (c.isMerge) merges++;
        first = Math.min(first, t); last = Math.max(last, t);
        const ak = (c.ae || c.an || '').toLowerCase(), a = au.get(ak) || { key: ak, name: c.an, email: c.ae, n: 0, m: 0, first: t, last: t, dset: new Set() };
        a.n++; if (c.isMerge) a.m++; a.first = Math.min(a.first, t); a.last = Math.max(a.last, t); a.dset.add(k); au.set(ak, a);
      });
      const span = L.length ? (last - first) / 86400 : 0, byMonth = span > 200, bars = [];
      if (L.length) {
        const cur = new Date(first * 1000); cur.setHours(0, 0, 0, 0); if (byMonth) cur.setDate(1);
        const end = new Date(last * 1000);
        const mcount = new Map();
        if (byMonth) days.forEach((v, k) => { const mk = k.slice(0, 7); mcount.set(mk, (mcount.get(mk) || 0) + v.n); });
        for (let i = 0; cur <= end && i < 2000; i++) {
          const k = dk(cur);
          if (byMonth) { bars.push({ label: k.slice(0, 7), n: mcount.get(k.slice(0, 7)) || 0 }); cur.setMonth(cur.getMonth() + 1); }
          else { bars.push({ label: k.slice(5), n: (days.get(k) || { n: 0 }).n }); cur.setDate(cur.getDate() + 1); }
        }
      }
      let heatMax = 1, hourTop = 0, dowTop = 0;
      const hours = new Array(24).fill(0), dows = new Array(7).fill(0);
      heat.forEach((row, d) => row.forEach((n, h) => { heatMax = Math.max(heatMax, n); hours[h] += n; dows[d] += n; }));
      hours.forEach((n, h) => { if (n > hours[hourTop]) hourTop = h; });
      dows.forEach((n, d) => { if (n > dows[dowTop]) dowTop = d; });
      let busy = null;
      days.forEach((v, k) => { if (!busy || v.n > busy.n) busy = { k, n: v.n }; });
      const dv = [...days.values()], avg = f => { if (!dv.length) return '—'; const m = Math.round(dv.reduce((a, v) => a + f(v), 0) / dv.length); return z(Math.floor(m / 60)) + ':' + z(m % 60); };
      const cards = [
        { k: 'n', label: tr('gl_c_commits'), val: L.length }, { k: 'm', label: tr('gl_c_merges'), val: merges },
        { k: 'a', label: tr('gl_c_authors'), val: au.size }, { k: 'd', label: tr('gl_c_days'), val: days.size },
        { k: 'avg', label: tr('gl_c_avg'), val: days.size ? (L.length / days.size).toFixed(1) : '—' },
        { k: 'busy', label: tr('gl_c_busiest'), val: busy ? busy.k + ' (' + busy.n + ')' : '—' },
        { k: 'st', label: tr('gl_c_start'), val: avg(v => v.min), tip: tr('gl_tip_first') }, { k: 'en', label: tr('gl_c_end'), val: avg(v => v.max) },
        { k: 'hr', label: tr('gl_c_hour'), val: L.length ? z(hourTop) + ':00' : '—' }, { k: 'dw', label: tr('gl_c_dow'), val: L.length ? this.glDays[dowTop] : '—' },
        { k: 'f', label: tr('gl_c_first'), val: L.length ? this.glFmt(first) : '—' }, { k: 'l', label: tr('gl_c_last'), val: L.length ? this.glFmt(last) : '—' }
      ];
      const authors = [...au.values()].map(a => ({ key: a.key, name: a.name, email: a.email, n: a.n, m: a.m, first: a.first, last: a.last, days: a.dset.size })).sort((a, b) => b.n - a.n);
      return { cards, bars, byMonth, heat, heatMax, authors };
    },
    glReport() {
      const z = n => String(n).padStart(2, '0'), map = new Map(), loc = LANG === 'en' ? 'en-GB' : 'id-ID';
      this.glFiltered.forEach(c => {
        if (this.gl.repNoMerge && c.isMerge) return;
        const t = this.glT(c), d = new Date(t * 1000), date = d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()), k = date + '|' + c.project;
        const r = map.get(k) || { key: k, date, project: c.project, n: 0, min: t, max: t, au: new Set(), items: [], dow: d.toLocaleDateString(loc, { weekday: 'long' }) };
        r.n++; r.min = Math.min(r.min, t); r.max = Math.max(r.max, t); r.au.add(c.an); r.items.push({ t, s: glTidy(c.subject) });
        map.set(k, r);
      });
      const hm = t => { const d = new Date(t * 1000); return z(d.getHours()) + ':' + z(d.getMinutes()); };
      return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.project.localeCompare(b.project))).map(r => ({
        key: r.key, date: r.date, dow: r.dow, project: r.project, n: r.n, first: hm(r.min), last: hm(r.max), authors: [...r.au].join(', '),
        titles: [...new Set(r.items.sort((a, b) => a.t - b.t).map(x => x.s).filter(Boolean))]
      }));
    },
    clkMineTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } },
    clkMs() { return this.clock.live ? this.clock.now : this.clock.fixedMs; },
    clkBaseItem() { return this.clock.base === 'mine' ? { tz: this.clkMineTz } : (this.clock.pins[Number(this.clock.base)] || { tz: this.clkMineTz }); },
    clkAtInput() { return clkToInput(this.clkBaseItem, this.clkMs); },
    clkTs() {
      const r = clkParseStamp(this.clock.ts, this.clkBaseItem);
      if (r.err) return { err: tr('clk_ts_err_' + r.err), rows: [] };
      const loc = LANG === 'en' ? 'en-GB' : 'id-ID', now = this.clock.live ? this.clock.now : Date.now();
      return {
        err: '',
        rows: (r.items || []).filter(x => isFinite(x.ms) && Math.abs(x.ms) < 8.64e15).map(x => {
          const ms = Math.round(x.ms), mine = new Date(ms);
          let mineTxt = '';
          try { mineTxt = new Intl.DateTimeFormat(loc, { timeZone: this.clkMineTz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(mine); } catch (e) { mineTxt = mine.toString(); }
          const diff = ms - now;
          return {
            label: x.label === 'tanggal' ? tr('clk_ts_date') : x.label, ms, mine: mineTxt, iso: mine.toISOString(), sec: Math.floor(ms / 1000), msTxt: ms,
            note: tr('clk_ts_u_' + x.unit.replace(/[^a-z]/gi, '').toLowerCase()), past: diff < 0,
            rel: Math.abs(diff) < 1000 ? tr('clk_ts_now') : tr(diff > 0 ? 'clk_ts_in' : 'clk_ts_ago').replace('{d}', this.clkRel(Math.abs(diff)))
          };
        })
      };
    },
    clkMineView() { return this.clkView({ label: tr('clk_mine'), tz: this.clkMineTz }); },
    clkResults() {
      return clkSearch(this.clock.q, this.clkMs).map((it, i) => Object.assign(this.clkView(it), { id: 'r' + i + it.label, item: it, pinned: this.clock.pins.some(p => p.label === it.label && p.tz === it.tz && p.fixed === it.fixed) }));
    },
    clkPinsView() { return this.clock.pins.map((p, i) => Object.assign(this.clkView(p), { id: 'p' + i + p.label })); },
    clkDayStart() {
      const mine = { tz: this.clkMineTz }, w = clkWall(mine, this.clkMs), z = n => String(n).padStart(2, '0');
      return clkFromWall(mine, w.y + '-' + z(w.mo + 1) + '-' + z(w.d) + 'T00:00');
    },
    clkPlanCol() { return clkWall({ tz: this.clkMineTz }, this.clkMs).h; },
    clkPlan() {
      const start = this.clkDayStart, mine = { tz: this.clkMineTz }, md = clkWall(mine, this.clkMs);
      const loc = LANG === 'en' ? 'en-GB' : 'id-ID';
      const rows = [{ id: 'mine', label: tr('clk_mine'), item: mine }].concat(this.clock.pins.map((p, i) => ({ id: 'p' + i, label: p.label, item: p })));
      return rows.map(r => ({
        id: r.id, label: r.label,
        cells: Array.from({ length: 24 }, (x, h) => {
          const w = clkWall(r.item, start + h * 3600000);
          const dd = Math.round((Date.UTC(w.y, w.mo, w.d) - Date.UTC(md.y, md.mo, md.d)) / 86400000);
          const txt = w.mi ? w.h + ':' + String(w.mi).padStart(2, '0') : String(w.h);
          let title = '';
          try { title = new Intl.DateTimeFormat(loc, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(w.dms)); } catch (e) { title = txt; }
          return { txt: txt + (dd > 0 ? '⁺¹' : dd < 0 ? '⁻¹' : ''), title, cls: w.h >= 8 && w.h < 17 ? 'work' : w.h >= 6 && w.h < 22 ? 'eve' : 'night' };
        })
      }));
    },
    pingHttpsBlocked() { return location.protocol === 'https:' && this.ping.mixedOk !== true && this.ping.targets.some(x => x.enabled && /^http:/i.test(x.url)); },
    pingCount() {
      const on = this.ping.targets.filter(x => x.enabled), ups = on.filter(x => x.status === 'up' && x.ms != null);
      return { all: this.ping.targets.length, up: on.filter(x => x.status === 'up').length, down: on.filter(x => x.status === 'down').length, blocked: on.filter(x => x.status === 'blocked').length, avg: ups.length ? Math.round(ups.reduce((a, x) => a + x.ms, 0) / ups.length) : null };
    },
    pingGroups() {
      const map = {}, order = [], q = this.ping.q.trim().toLowerCase(), f = this.ping.filter;
      this.ping.targets.forEach(x => {
        const k = x.group || '';
        if (!map[k]) { map[k] = { key: k, name: k || tr('ping_nogroup'), items: [], shown: [], up: 0, down: 0, anyOn: false }; order.push(k); }
        const g = map[k];
        g.items.push(x);
        if (x.enabled) { g.anyOn = true; if (x.status === 'up') g.up++; else if (x.status === 'down') g.down++; }
        const hit = !q || (x.name + ' ' + x.url + ' ' + k).toLowerCase().indexOf(q) >= 0;
        const st = f === 'all' || (f === 'down' ? x.status !== 'up' : x.status === 'up');
        if (hit && st) g.shown.push(x);
      });
      return order.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b))).map(k => map[k]);
    },
    pingGroupsShown() { return this.pingGroups.filter(g => g.shown.length); },
    pingSel() { return this.ping.targets.find(x => x.id === this.ping.selId) || null; },
    pingHelpKeys() { return ['ms', 'up', 'stat', 'cors', 'vpn', 'port', 'alarm']; },
    pingCards() {
      const t0 = this.pingSel;
      if (!t0) return [];
      const s = this.pingStatOf(t0.id), ms = v => (v != null ? v + ' ms' : '—'), pc = v => (v != null ? v + '%' : '—');
      return [
        { k: 'last', label: tr('ping_c_last'), val: ms(t0.ms), tip: tr('ping_tip_ms') },
        { k: 'avg', label: tr('ping_c_avg'), val: ms(s.avg), tip: tr('ping_tip_avg') },
        { k: 'min', label: tr('ping_c_min'), val: ms(s.min), tip: tr('ping_tc_min') },
        { k: 'max', label: tr('ping_c_max'), val: ms(s.max), tip: tr('ping_tc_max') },
        { k: 'p95', label: tr('ping_c_p95'), val: ms(s.p95), tip: tr('ping_tc_p95') },
        { k: 'jit', label: tr('ping_c_jitter'), val: ms(s.jitter), tip: tr('ping_tc_jitter') },
        { k: 'up', label: tr('ping_c_uptime'), val: pc(s.uptime), tip: tr('ping_tip_uptime') },
        { k: 'loss', label: tr('ping_c_loss'), val: pc(s.loss), tip: tr('ping_tc_loss') },
        { k: 'n', label: tr('ping_c_n'), val: String(s.n), tip: tr('ping_tc_n') },
        { k: 'code', label: tr('ping_c_code'), val: t0.code != null ? String(t0.code) : (t0.kind === 'opaque' ? 'OK*' : '—'), tip: tr('ping_tip_code') },
        { k: 'since', label: tr('ping_c_since'), val: t0.since ? this.pingDur(this.ping.now - t0.since) : '—', tip: tr('ping_tc_since') }
      ];
    },
    swagBookmarklet() { return 'javascript:' + encodeURIComponent(swagScript()); },
    swagOpts() {
      const s = this.swag;
      return { baseUrl: s.baseUrl.trim(), tags: Object.keys(s.tags).filter(k => s.tags[k]), creds: s.token ? { token: s.token, apiKey: s.token } : {}, L };
    },
    swagSel() { return this.swag.model ? swagPick(this.swag.model, this.swagOpts) : []; },
    swagTagCount() { const c = {}; (this.swag.model ? this.swag.model.ops : []).forEach(o => { c[o.tag] = (c[o.tag] || 0) + 1; }); return c; },
    swagRelative() { return !!this.swag.model && !/^https?:\/\//i.test(this.swag.baseUrl.trim()); },
    swagPreview() {
      if (!this.swag.model || !this.swagSel.length) return '';
      const txt = this.swagOut(this.swag.fmt).text;
      return txt.length > 200000 ? txt.slice(0, 200000) + '\n...' : txt;
    },
    skipBookmarklet() {
      const L2 = {};
      ['done', 'final', 'open', 'copy', 'hop', 'waiting', 'step', 'too_many', 'no_step', 'captcha', 'expired', 'adblock', 'revealing', 'gate', 'unsupported', 'mode_flow', 'mode_reveal', 'mode_gate', 'mode_param', 'mode_page'].forEach(k => { L2[k] = this.t('skip_bm_' + k); });
      return 'javascript:' + encodeURIComponent('(' + skipLinkMain.toString() + ')(' + JSON.stringify({ auto: this.skip.auto, L: L2 }) + ');');
    },
    skipDecoded() { return this.skip.url.trim() ? skipDecodeUrl(this.skip.url) : null; },
    jsrBookmarklet() {
      const L2 = {};
      ['collecting', 'send', 'download', 'fetching', 'files', 'maps', 'hint', 'local', 'popup', 'sent'].forEach(k => { L2[k] = this.t('jsr_bm_' + k); });
      return 'javascript:' + encodeURIComponent('(' + jsrHookMain.toString() + ')(' + JSON.stringify(Object.assign(pupAppCfg(), { L: L2 })) + ');');
    },
    jsrEps() {
      const r = this.jsr.res;
      if (!r) return [];
      const q = this.jsr.q.trim().toLowerCase();
      return r.endpoints.filter(e => (!this.jsr.hot || e.hot) && (!q || e.path.toLowerCase().indexOf(q) >= 0));
    },
    jsrMaps() { const r = this.jsr.res; return r ? r.files.filter(f => f.map && f.map.exposed).length : 0; },
    cjTarget() {
      const raw = String(this.cj.url || this.dastText.split(/[\s,]+/).filter(Boolean)[0] || '').trim();
      if (!raw) return '';
      try { const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw); return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : ''; } catch (e) { return ''; }
    },
    cjMixed() { return location.protocol === 'https:' && this.cj.shown.indexOf('http:') === 0; },
    shpBookmarklet() { return 'javascript:' + encodeURIComponent(localizeScript('(' + hookGuardInstall.toString() + ')();\n(' + shpHookMain.toString() + ')(' + JSON.stringify(pupAppCfg()) + ');')); },
    shpKeywords() { const set = new Set(); this.shp.list.forEach(r => String(r.q || '').split(', ').forEach(k => { if (k) set.add(k); })); return [...set].sort(); },
    shpFilterOn() { const f = this.shp; return !!(f.q.trim() || f.kw || f.level || f.mall || f.star || f.noAd || f.minSold || f.minRate || f.pMin || f.pMax); },
    shpCols() {
      return [
        { k: 'name', label: this.t('shp_c_name') }, { k: 'price', label: this.t('shp_c_price') }, { k: 'sold', label: this.t('shp_c_sold') },
        { k: 'rating', label: 'Rating' }, { k: 'badge', label: this.t('shp_c_shop') }, { k: 'loc', label: this.t('shp_c_loc') },
        { k: 'score', label: this.t('shp_c_score'), tip: this.t('shp_score_tip') }, { k: 'tips', label: this.t('shp_c_tips') },
        { k: 'q', label: this.t('shp_c_kw') }, { k: 'seen', label: this.t('shp_c_seen') }
      ];
    },
    shpRows() {
      const f = this.shp, toks = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      const med = {};
      this.shp.list.forEach(r => { const k = (r.q || '').split(', ')[0]; (med[k] = med[k] || []).push(r.price); });
      Object.keys(med).forEach(k => { med[k] = shpMedian(med[k].filter(v => v)); });
      const rows = [];
      this.shp.list.forEach(r0 => {
        const a = shpAssess(r0, med[(r0.q || '').split(', ')[0]]);
        const r = Object.assign({}, r0, a, { url: 'https://' + (r0.host || 'shopee.co.id') + '/product/' + r0.shopid + '/' + r0.itemid, badge: r0.mall ? 3 : r0.starPlus ? 2 : r0.star ? 1 : 0 });
        const pos = a.notes.filter(n => n.v > 0).map(n => this.t(n.k)), neg = a.notes.filter(n => n.v <= 0).map(n => this.t(n.k));
        r.tipsShort = neg.concat(pos).join('; ');
        r.tips = a.notes.map(n => (n.v > 0 ? '+' : '') + n.v + ' ' + this.t(n.k)).join('\n');
        if (f.kw && String(r.q || '').split(', ').indexOf(f.kw) < 0) return;
        if (f.level && r.level !== f.level) return;
        if (f.mall && !r.mall) return;
        if (f.star && !(r.star || r.starPlus || r.mall)) return;
        if (f.noAd && r.ad) return;
        if (f.minSold && (r.sold || 0) < f.minSold) return;
        if (f.minRate && (r.rating || 0) < f.minRate) return;
        if (f.pMin && (r.price || 0) < f.pMin) return;
        if (f.pMax && (r.price || 0) > f.pMax) return;
        if (toks.length) { const hay = (r.name + ' ' + r.shop + ' ' + r.loc + ' ' + r.brand + ' ' + r.q + ' ' + r.tipsShort).toLowerCase(); if (!toks.every(k => hay.indexOf(k) >= 0)) return; }
        rows.push(r);
      });
      const k = f.sort, dir = f.desc ? -1 : 1, key = k === 'tips' ? 'score' : k;
      rows.sort((a, b) => { const x = a[key], y = b[key]; if (x === y) return 0; if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir; });
      return rows;
    },
    waScript() { return localizeScript('(' + hookGuardInstall.toString() + ')();\n(' + waHookMain.toString() + ')(' + JSON.stringify(pupAppCfg()) + ');'); },
    waBookmarklet() { return 'javascript:' + encodeURIComponent(this.waScript); },
    waChats() {
      const map = new Map();
      this.wa.list.forEach(r => { if (r.chat) map.set(r.chat, (map.get(r.chat) || 0) + 1); });
      return [...map.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    },
    waStats() {
      let links = 0, docs = 0;
      this.wa.list.forEach(r => {
        if (r.links && r.links.length) links++;
        if ((r.docs && r.docs.length) || waHasDocLink(r.links)) docs++;
      });
      return { links, docs };
    },
    waFilterOn() {
      const f = this.wa;
      return !!(f.q.trim() || f.chat || f.kind || f.dir || f.from || f.to);
    },
    waFiltered() {
      const f = this.wa, toks = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      const fromMs = f.from ? new Date(f.from + 'T00:00:00').getTime() : null;
      const toMs = f.to ? new Date(f.to + 'T23:59:59.999').getTime() : null;
      const out = this.wa.list.filter(r => {
        if (f.chat && r.chat !== f.chat) return false;
        if (f.dir && r.dir !== f.dir) return false;
        const hasLink = !!(r.links && r.links.length);
        const hasAtt = !!(r.docs && r.docs.length);
        const hasDoc = hasAtt || waHasDocLink(r.links);
        if (f.kind === 'doc' && !hasDoc) return false;
        if (f.kind === 'link' && !hasLink) return false;
        if (f.kind === 'att' && !hasAtt) return false;
        if (f.kind === 'media' && !r.media) return false;
        if (f.kind === 'text' && (!r.text || hasLink || hasAtt || r.media)) return false;
        const t = r.ts || r.seen || 0;
        if (fromMs !== null && t < fromMs) return false;
        if (toMs !== null && t > toMs) return false;
        if (toks.length) {
          const hay = (r.chat + ' ' + r.sender + ' ' + r.text + ' ' + r.quote + ' ' + (r.docs || []).join(' ') + ' ' + (r.links || []).join(' ') + ' ' + (r.timeText || '')).toLowerCase();
          if (!toks.every(k => hay.indexOf(k) >= 0)) return false;
        }
        return true;
      });
      const getT = r => {
        let t = r ? (r.ts || r.seen || 0) : 0;
        const nowLimit = Date.now() + 43200000;
        if (t > nowLimit) {
          const d = new Date(t);
          const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
          if (day >= 1 && day <= 12 && m >= 1 && m <= 31) {
            const sw = new Date(y, day - 1, m, d.getHours(), d.getMinutes(), d.getSeconds());
            if (sw.getTime() <= nowLimit) return sw.getTime();
          }
          return r.seen || Date.now();
        }
        return t;
      };
      out.sort((a, b) => getT(b) - getT(a));
      return out;
    },
    waRows() {
      const getT = r => {
        let t = r ? (r.ts || r.seen || 0) : 0;
        const nowLimit = Date.now() + 43200000;
        if (t > nowLimit) {
          const d = new Date(t);
          const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
          if (day >= 1 && day <= 12 && m >= 1 && m <= 31) {
            const sw = new Date(y, day - 1, m, d.getHours(), d.getMinutes(), d.getSeconds());
            if (sw.getTime() <= nowLimit) return sw.getTime();
          }
          return r.seen || Date.now();
        }
        return t;
      };
      return this.sortBy('wa', this.waFiltered, {
        ts: r => getT(r),
        chat: 'chat',
        sender: r => r.sender || (r.dir === 'out' ? this.t('wa_me') : r.chat),
        text: 'text',
        docs: r => ((r.docs || []).join(' ') + ' ' + (r.links || []).join(' ')).trim()
      });
    },
    imTools() { return [{ k: 'compress', label: '🗜 ' + this.t('im_t_compress') }, { k: 'resize', label: '↔ ' + this.t('im_t_resize') }, { k: 'fix', label: '🔍 ' + this.t('im_t_fix') }, { k: 'ailocal', label: '✨ ' + this.t('im_t_ailocal') }, { k: 'aiapi', label: '🤖 ' + this.t('im_t_aiapi') }, { k: 'redact', label: '⬛ ' + this.t('im_t_redact') }]; },
    imAlgs() { return ['lanczos3', 'lanczos2', 'catmull', 'mitchell', 'bilinear', 'area', 'nearest'].map(k => ({ k, label: this.t('im_a_' + k), tip: this.t('im_a_' + k + '_tip') })); },
    imModels() { return IMG_MODELS; },
    imProviders() { return IMG_AI_PROVIDERS; },
    svSheet() { const c = this.sv.cur; if (!c) return null; const b = this.svBook(c.book); return b && b.sheets[c.sheet] ? Object.assign({ bookName: b.name }, b.sheets[c.sheet]) : null; },
    svCols() {
      const sh = this.svSheet; if (!sh) return [];
      const out = [];
      for (let i = 0; i < sh.cols; i++) out.push({ i, letter: this.svColName(i), name: this.sv.header ? (sh.header[i] || '') : '' });
      return out;
    },
    svWin() {
      const sv = this.sv, RH = 28, VIEW = 560, MAX = 12000000;
      const total = sv.mode === 'global' ? sv.gtotal : sv.mode === 'diff' ? (sv.diff ? (sv.donly ? sv.diff[sv.donly] : sv.diff.total) : 0) : sv.total;
      const full = total * RH, scaled = full > MAX, H = scaled ? MAX : full, vis = Math.ceil(VIEW / RH) + 1;
      const start = !total ? 0 : scaled ? Math.min(total - 1, Math.round(sv.scroll / Math.max(1, H - VIEW) * Math.max(0, total - vis))) : Math.min(Math.max(0, total - 1), Math.floor(sv.scroll / RH));
      return { total, H: Math.max(H, 1), scaled, start, vis, top: scaled ? sv.scroll : start * RH };
    },
    svVisible() {
      void this.sv.rowsVer;
      const w = this.svWin, sv = this.sv, out = [];
      const cache = sv.mode === 'global' ? this.svGRows : sv.mode === 'diff' ? this.svDRows : this.svRows;
      if (!cache) return out;
      for (let i = w.start; i < Math.min(w.total, w.start + w.vis); i++) out.push(cache[i] || { i, loading: true });
      return out;
    },
    svTotalRows() { let n = 0; this.sv.books.forEach(b => b.sheets.forEach(s => { n += s.rows; })); return n; },
    svSheetOpts() { const out = []; this.sv.books.forEach(b => { if (!b.loading) b.sheets.forEach((s, i) => out.push({ v: b.id + ':' + i, label: (this.sv.books.length > 1 ? b.name + ' › ' : '') + s.name + ' (' + s.rows.toLocaleString() + ')' })); }); return out; },
    svDiffKeyOpts() { const a = this.sv.dcfg.a; if (!a) return []; const [bb, ss] = a.split(':'), b = this.svBook(bb); return b && b.sheets[+ss] ? b.sheets[+ss].header.filter(Boolean) : []; },
    svGMaxCols() { let n = 0; (this.svVisible || []).forEach(r => { if (r.c && r.c.length > n) n = r.c.length; }); return Math.min(n, 30); },
    sheetBookmarklet() { return 'javascript:' + encodeURIComponent(localizeScript('(' + sheetHookMain.toString() + ')(' + JSON.stringify(pupAppCfg()) + ');')); },
    pupBookmarklet() { return 'javascript:' + encodeURIComponent(pupScript()); },
    masterScript() { return masterHookScript(); },
    masterBookmarklet() { return 'javascript:' + encodeURIComponent(this.masterScript); },
    pipeTop3() {
      return (this.pipe.logs || []).slice(0, 2);
    },
    pipeFiltered() {
      const f = this.pipe.filter, q = this.pipe.q.trim().toLowerCase();
      return (this.pipe.logs || []).filter(e => {
        if (f === 'OUT' && e.dir !== 'OUT') return false;
        if (f === 'IN' && e.dir !== 'IN') return false;
        if (f === 'IDB' && e.dir !== 'IDB') return false;
        if (!q) return true;
        const hay = [e.method, e.kind, e.target, e.feature, e.status, e.reqBody, e.resBody].join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      });
    },
    storageSummary() {
      const wa = this.wa.list ? this.wa.list.length : 0;
      const shp = this.shp.list ? this.shp.list.length : 0;
      const svList = this.sv.recent || [];
      const sv = svList.length;
      const svBytes = svList.reduce((n, r) => n + (r.size || 0), 0);
      const pup = this.pup.list ? this.pup.list.length : 0;
      const files = this.items ? this.items.length : 0;
      const ping = this.ping.targets ? this.ping.targets.length : 0;
      const col = (this.col.coll ? this.col.coll.length : 0) + (this.col.hist ? this.col.hist.length : 0);
      const totalItems = wa + shp + sv + pup + files + ping + col;
      const est = (this.storage.lsBytes || 0) + svBytes + (this.pupTotalSize || 0) + wa * 380 + shp * 420;
      const bytes = Math.max(this.storage.quotaUsed || 0, est);
      return { wa, shp, sv, pup, files, ping, col, totalItems, bytes };
    },
    diffOut() {
      if (!window.AppDiff) return { splitRows: [], uniRows: [], added: 0, removed: 0, unchanged: 0, identical: true, warn: '' };
      return window.AppDiff.computeDiff(this.diff.left, this.diff.right, {
        fmt: this.diff.fmt,
        ignoreTrim: this.diff.ignoreTrim,
        ignoreCase: this.diff.ignoreCase,
        onlyChanged: this.diff.onlyChanged
      });
    },
    maskOut() {
      if (!window.AppDiff) return { output: '', total: 0, counts: {} };
      return window.AppDiff.redactSecrets(this.diff.maskIn, this.diff.rules);
    },
    // Rekaman dikelompokkan per grup (urut nama; "Tanpa grup" paling akhir) + ukuran per grup.
    pupGroups() {
      const map = {};
      this.pup.list.forEach(r => { const g = r.group || ''; (map[g] = map[g] || []).push(r); });
      return Object.keys(map).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
        .map(name => ({ name, recs: map[name], size: map[name].reduce((n, r) => n + (r.size || 0), 0) }));
    },
    pupGroupNames() { return this.pupGroups.map(g => g.name).filter(Boolean); },
    pupTotalSize() { return this.pup.list.reduce((n, r) => n + (r.size || 0), 0); },
    pupSelIds() { return this.pup.list.filter(r => this.pup.sel[r.id]).map(r => r.id); },
    pupAllSel() { return this.pup.list.length > 0 && this.pupSelIds.length === this.pup.list.length; },
    activeItems() { return this.items.filter(it => it.enabled); },
    allEnabled() { return this.items.length > 0 && this.activeItems.length === this.items.length; },
    projectNames() { return [...new Set(this.items.map(it => it.project))]; },
    // Target dekripsi = temuan kripto pertama pada rantai input (bukan rantai hasil dekripsi).
    decTarget() {
      const c = this.dec.chains[0], s = c && c.steps.find(x => x.crypto);
      return s ? s.crypto : null;
    },
    decFields() {
      const t = this.decTarget, m = this.dec.form.mode;
      if (!t) return [];
      if (t.type === 'cryptojs') return ['passphrase'];
      if (t.type !== 'aes') return ['key'];
      return ['key', 'mode', ...(m === 'ECB' ? [] : ['iv']), ...(m === 'GCM' ? ['tag', 'aad'] : [])];
    },
    decReady() { return !!(this.decTarget && (this.decTarget.type === 'cryptojs' ? this.dec.form.passphrase : this.dec.form.key.trim())); },
  },
  created() {
    this.applyTheme();
    try { const ts = localStorage.getItem(TBL_SIZE_KEY); if (ts === 's' || ts === 'm' || ts === 'l') this.tblSize = ts; } catch (e) { /* abaikan */ }
    this.applyTblSize();
    this.pingInit();
    this.clkInit();
    try {
      const qt = new URLSearchParams(location.search).get('tab');
      if (qt && TAB_LIST.some(x => x.key === qt)) { this.visibleTabs[qt] = true; this.tab = qt; }
    } catch (e) { /* abaikan */ }
    this.glRepos = {}; this.glLeakItems = {};
    try { document.documentElement.lang = this.lang; } catch (e) { /* abaikan */ }
    try { const w = parseInt(localStorage.getItem(SIDE_KEY), 10); if (w) this.sideW = Math.min(SIDE_MAX, Math.max(SIDE_MIN, w)); } catch (e) { /* abaikan */ }
    try { if (localStorage.getItem(SIDE_OPEN_KEY) === '0') this.sideOpen = false; } catch (e) { /* abaikan */ }
    // Setelan tab yang tampil; localStorage kosong/rusak -> semua tab tampil.
    let savedTabs = null;
    try { savedTabs = JSON.parse(localStorage.getItem(TABS_KEY) || 'null'); } catch (e) { savedTabs = null; }
    const vis = {};
    TAB_LIST.forEach(t => { vis[t.key] = savedTabs && typeof savedTabs[t.key] === 'boolean' ? savedTabs[t.key] : true; });
    this.visibleTabs = vis;
    try {
      const savedPins = JSON.parse(localStorage.getItem(PIN_KEY) || '{}');
      if (savedPins && typeof savedPins === 'object') this.pinnedTabs = savedPins;
    } catch (e) { this.pinnedTabs = {}; }
    window.__scaActiveTab = this.tab;
    try { if (localStorage.getItem('scaPipeMin') === '1') this.pipe.mini = true; } catch (e) { /* abaikan */ }
    if (window.AppPipe) {
      window.AppPipe.subscribe((logs, st) => {
        this.pipe.logs = logs;
        this.pipe.stats = st;
        if (this.pipe.sel) {
          const found = logs.find(x => x.id === this.pipe.sel.id);
          if (found) this.pipe.sel = found;
        }
      });
    }
    // Urutan menu tersimpan; tab baru (belum ada di simpanan) ditaruh di akhir.
    try {
      const ord = JSON.parse(localStorage.getItem(TAB_ORDER_KEY) || 'null');
      if (Array.isArray(ord)) {
        const pos = k => { const n = ord.indexOf(k); return n < 0 ? ord.length + TAB_LIST.findIndex(t => t.key === k) : n; };
        this.tabList = TAB_LIST.slice().sort((a, b) => pos(a.key) - pos(b.key));
      }
    } catch (e) { /* simpanan rusak: pakai urutan bawaan */ }
    if (!vis[this.tab]) { const first = this.tabList.find(t => vis[t.key]); if (first) this.tab = first.key; }
    this.colabAiFromHash();
    // Hapus token Sonatype yang pernah tersimpan oleh versi sebelumnya.
    try { localStorage.removeItem('scaSonatype'); } catch (e) { /* localStorage tidak tersedia: abaikan */ }
    try {
      const saved = JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]');
      if (Array.isArray(saved)) {
        this.items = saved.filter(it => it && it.name && typeof it.text === 'string')
          .map(it => ({ ...it, project: it.project || DEFAULT_PROJECT, enabled: it.enabled !== false,
            ...(it.compact ? {} : { runtimes: it.runtimes || extractRuntimes(it.type, it.name, it.text), ...toStoredForm(it.type, it.text) }) }));
        this.persistedIds = this.items.map(it => it.id);
        this.nextId = this.items.reduce((m, it) => Math.max(m, it.id || 0), 0) + 1;
      }
    } catch (e) { /* data rusak / localStorage tidak tersedia: mulai kosong */ }
    this.pupInit();
    this.shpInit();
    this.jsrInit();
    this.waInit();
    this.svInit();
    this.imInit();
    this.ocrLoadPrefs();
    document.addEventListener('paste', e => { this.onOcrPaste(e); });
    this.colLoad();
    document.addEventListener('paste', e => { this.onColPaste(e); });
    // Geser batas kanan header tabel untuk atur lebar kolom + klik header untuk urutkan (ASC -> DESC -> reset).
    document.addEventListener('pointermove', e => {
      const th = e.target.closest && e.target.closest('thead th');
      if (!th) return;
      const r = th.getBoundingClientRect();
      th.classList.toggle('rz-hover', r.right - e.clientX <= 7);
    });
    document.addEventListener('pointerdown', e => {
      const th = e.target.closest && e.target.closest('thead th');
      if (!th) return;
      const r = th.getBoundingClientRect();
      if (r.right - e.clientX > 7) return;
      e.preventDefault(); e.stopPropagation();
      const x0 = e.clientX, w0 = r.width, tbl = th.closest('table'), idx = [].indexOf.call(th.parentElement.children, th);
      const col = tbl && tbl.querySelector('colgroup') && tbl.querySelector('colgroup').children[idx];
      const mv = ev => {
        const w = Math.max(44, Math.round(w0 + ev.clientX - x0));
        if (col) col.style.width = w + 'px';
        else th.style.width = th.style.minWidth = th.style.maxWidth = w + 'px';
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); th._rzAt = Date.now(); };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
    document.addEventListener('dblclick', e => {
      const th = e.target.closest && e.target.closest('thead th');
      if (!th) return;
      const r = th.getBoundingClientRect();
      if (r.right - e.clientX > 9) return;
      e.preventDefault(); e.stopPropagation();
      th.style.width = th.style.minWidth = th.style.maxWidth = '';
      th._rzAt = Date.now();
    });
    document.addEventListener('click', e => {
      if (e.target.closest && e.target.closest('input,select,button,a')) return;
      const th = e.target.closest && e.target.closest('table[data-sort] thead th');
      if (!th || (th._rzAt && Date.now() - th._rzAt < 250)) return;
      const tbl = th.closest('table[data-sort]'), id = tbl && tbl.getAttribute('data-sort');
      if (!id || !th.textContent.trim()) return;
      const col = th.getAttribute('data-col') || [].indexOf.call(th.parentElement.children, th);
      const cur = this.tblSort[id];
      if (!cur || String(cur.col) !== String(col)) this.tblSort[id] = { col, dir: 1 };
      else if (cur.dir === 1) this.tblSort[id] = { col, dir: -1 };
      else delete this.tblSort[id];
      this.$nextTick(() => this.syncSortHeaders());
    });
    document.addEventListener('click', () => { if (this.topMenuOpen) this.topMenuOpen = false; });
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (this.cmdOpen) this.cmdOpen = false;
        else this.openCmd();
      } else if (e.key === 'Escape') {
        if (this.cmdOpen) this.cmdOpen = false;
        if (this.topMenuOpen) this.topMenuOpen = false;
        if (this.masterModal) this.masterModal = false;
        if (this.storage.resetModal) this.storage.resetModal = false;
        if (this.pipe.open && !this.pipe.floating) this.pipe.open = false;
      }
    });
    this.refreshStorageStats();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText && !navigator.clipboard._scaHooked) {
        const origWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
        navigator.clipboard.writeText = txt => origWrite(txt).then(res => { this.showToast('✓ ' + this.t('copied')); return res; });
        navigator.clipboard._scaHooked = true;
      }
    } catch (e) { /* abaikan */ }
  },
  watch: {
    cmdQ() { this.cmdIdx = 0; },
    topMenuOpen(v) { if (v) this.refreshStorageStats(); },
    // Tab aktif ikut ke URL (?tab=) agar refresh / link langsung membuka tab itu.
    tab(v) {
      window.__scaActiveTab = v;
      if (v === 'img') this.$nextTick(() => this.imDraw());
      try { const u = new URL(location.href); if (u.searchParams.get('tab') !== v) { u.searchParams.set('tab', v); history.replaceState(history.state, '', u.href); } } catch (e) { /* abaikan */ }
    },
    items: { deep: true, handler() { this.saveItems(); } },
    'gl.sel'() { this.gl.files = null; const c = this.glSel; if (c && c.kind === 'git') this.glLoadDiff(c); },
    'gl.q'() { this.gl.page = 300; }, 'gl.branch'() { this.gl.page = 300; },
    'gl.view'(v) { if (v === 'gantt') this.glGanttEnd(); }, 'gl.zoom'() { if (this.gl.view === 'gantt') this.glGanttEnd(); }, 'gl.author'() { this.gl.page = 300; }, 'gl.project'() { this.gl.page = 300; },
    'wa.q'() { this.wa.page = 300; }, 'wa.chat'() { this.wa.page = 300; }, 'wa.kind'() { this.wa.page = 300; }, 'wa.dir'() { this.wa.page = 300; }, 'wa.from'() { this.wa.page = 300; }, 'wa.to'() { this.wa.page = 300; },
    // Deteksi otomatis saat ketik/tempel (debounce 300 ms).
    'dec.input'() {
      clearTimeout(this.decTimer);
      this.decTimer = setTimeout(() => { this.runDecode(); }, 300);
    }
  },
  updated() {
    this.syncSortHeaders();
    if (this.tab === 'ping') this.pingDrawSoon();
    if (this.tab === 'clock') this.clkDrawSoon();
    if (this.tab === 'git' && this.gl.view === 'stats' && !this.glRaf) this.glRaf = requestAnimationFrame(() => { this.glRaf = 0; this.glDrawBars(); });
  },
  methods: {
    log(m) { this.logs.push(m); },
    showToast(msg, err) {
      this.toast = { msg, err: !!err };
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { this.toast = { msg: '', err: false }; }, 2800);
    },
    openCmd() {
      this.topMenuOpen = false;
      this.cmdQ = '';
      this.cmdIdx = 0;
      this.cmdOpen = true;
      this.$nextTick(() => { if (this.$refs.cmdInput) this.$refs.cmdInput.focus(); });
    },
    cmdMove(d) {
      const n = this.cmdFiltered.length;
      if (!n) return;
      this.cmdIdx = (this.cmdIdx + d + n) % n;
    },
    runCmd(c) {
      if (!c) return;
      this.cmdOpen = false;
      c.run();
    },
    setTblSize(sz) {
      if (sz !== 's' && sz !== 'm' && sz !== 'l') return;
      this.tblSize = sz;
      this.applyTblSize();
      try { localStorage.setItem(TBL_SIZE_KEY, sz); } catch (e) { /* abaikan */ }
    },
    async exportAllData() {
      this.topMenuOpen = false;
      const ls = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && /^sca/i.test(k)) ls[k] = localStorage.getItem(k);
        }
      } catch (e) { /* abaikan */ }
      let pup = [], shopee = [], wa = [], sheetMeta = [];
      try { pup = await pupAll(); } catch (e) { pup = []; }
      try { shopee = await shpAll(); } catch (e) { shopee = []; }
      try { wa = await waAll(); } catch (e) { wa = []; }
      try { sheetMeta = await svRecentList(); } catch (e) { sheetMeta = []; }
      const payload = {
        app: 'Scanner Security',
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        localStorage: ls,
        indexedDB: { pup, shopee, wa, sheetMeta }
      };
      const d = new Date(), p2 = n => String(n).padStart(2, '0');
      const fname = 'scanner-security-backup-' + d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + '.json';
      pupDownload(fname, JSON.stringify(payload, null, 2), 'application/json');
      this.showToast(this.t('backupExportOk').replace('{n}', Object.keys(ls).length).replace('{p}', pup.length).replace('{s}', shopee.length).replace('{w}', wa.length).replace('{v}', sheetMeta.length));
    },
    async importAllData(ev) {
      this.topMenuOpen = false;
      const f = ev.target && ev.target.files && ev.target.files[0];
      if (ev.target) ev.target.value = '';
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || typeof data !== 'object' || (!data.localStorage && !data.indexedDB)) throw new Error('bad');
        let nKeys = 0, nPup = 0, nShp = 0, nWa = 0;
        if (data.localStorage && typeof data.localStorage === 'object') {
          Object.entries(data.localStorage).forEach(([k, v]) => {
            if (/^sca/i.test(k) && typeof v === 'string') {
              try { localStorage.setItem(k, v); nKeys++; } catch (e) { /* abaikan */ }
            }
          });
        }
        if (data.indexedDB && Array.isArray(data.indexedDB.pup) && data.indexedDB.pup.length) {
          try { await pupPutMany(data.indexedDB.pup); nPup = data.indexedDB.pup.length; } catch (e) { /* abaikan */ }
        }
        if (data.indexedDB && Array.isArray(data.indexedDB.shopee) && data.indexedDB.shopee.length) {
          try {
            await shpTx('readwrite', st => { data.indexedDB.shopee.forEach(it => { if (it && it.id) st.put(it); }); });
            nShp = data.indexedDB.shopee.length;
          } catch (e) { /* abaikan */ }
        }
        if (data.indexedDB && Array.isArray(data.indexedDB.wa) && data.indexedDB.wa.length) {
          try {
            const wlist = data.indexedDB.wa.map(waClean).filter(Boolean);
            if (wlist.length) { await waPutMany(wlist); nWa = wlist.length; }
          } catch (e) { /* abaikan */ }
        }
        this.theme = detectTheme(); this.applyTheme();
        try { const ts = localStorage.getItem(TBL_SIZE_KEY); if (ts === 's' || ts === 'm' || ts === 'l') this.tblSize = ts; } catch (e) { /* abaikan */ }
        this.applyTblSize();
        try { const w = parseInt(localStorage.getItem(SIDE_KEY), 10); if (w) this.sideW = Math.min(SIDE_MAX, Math.max(SIDE_MIN, w)); } catch (e) { /* abaikan */ }
        try { this.sideOpen = localStorage.getItem(SIDE_OPEN_KEY) !== '0'; } catch (e) { /* abaikan */ }
        try {
          const savedTabs = JSON.parse(localStorage.getItem(TABS_KEY) || 'null');
          const vis = {};
          TAB_LIST.forEach(t => { vis[t.key] = savedTabs && typeof savedTabs[t.key] === 'boolean' ? savedTabs[t.key] : true; });
          this.visibleTabs = vis;
        } catch (e) { /* abaikan */ }
        try {
          const ord = JSON.parse(localStorage.getItem(TAB_ORDER_KEY) || 'null');
          if (Array.isArray(ord)) {
            const pos = k => { const n = ord.indexOf(k); return n < 0 ? ord.length + TAB_LIST.findIndex(t => t.key === k) : n; };
            this.tabList = TAB_LIST.slice().sort((a, b) => pos(a.key) - pos(b.key));
          }
        } catch (e) { /* abaikan */ }
        try {
          const saved = JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]');
          if (Array.isArray(saved)) {
            this.items = saved.filter(it => it && it.name && typeof it.text === 'string').map(it => ({ ...it, project: it.project || DEFAULT_PROJECT, enabled: it.enabled !== false }));
            this.persistedIds = this.items.map(it => it.id);
            this.nextId = this.items.reduce((m, it) => Math.max(m, it.id || 0), 0) + 1;
          }
        } catch (e) { /* abaikan */ }
        this.pingInit();
        this.clkInit();
        this.colLoad();
        this.ocrLoadPrefs();
        try { this.pup.hidden = JSON.parse(localStorage.getItem('scaPupHidden') || '{}') || {}; this.pup.newGroup = localStorage.getItem('scaPupGroup') || ''; } catch (e) { /* abaikan */ }
        try {
          const savedPins = JSON.parse(localStorage.getItem(PIN_KEY) || '{}');
          if (savedPins && typeof savedPins === 'object') this.pinnedTabs = savedPins;
        } catch (e) { /* abaikan */ }
        this.pupLoad();
        this.shpLoad();
        this.waLoad();
        this.refreshStorageStats();
        const nSv = Array.isArray(data.indexedDB && data.indexedDB.sheetMeta) ? data.indexedDB.sheetMeta.length : (this.sv.recent || []).length;
        this.showToast(this.t('backupImportOk').replace('{n}', nKeys).replace('{p}', nPup).replace('{s}', nShp).replace('{w}', nWa).replace('{v}', nSv));
      } catch (e) {
        this.showToast(this.t('backupImportErr'), true);
      }
    },
    applyTblSize() {
      try {
        if (this.tblSize === 'm') document.documentElement.removeAttribute('data-tbl');
        else document.documentElement.setAttribute('data-tbl', this.tblSize);
      } catch (e) { /* abaikan */ }
    },
    cycleTblSize() {
      const order = ['s', 'm', 'l'];
      this.tblSize = order[(order.indexOf(this.tblSize) + 1) % order.length];
      this.applyTblSize();
      try { localStorage.setItem(TBL_SIZE_KEY, this.tblSize); } catch (e) { /* abaikan */ }
    },
    sortBy(id, list, cols) {
      if (!Array.isArray(list) || list.length < 2) return list;
      const st = this.tblSort[id];
      if (!st) return list;
      const getter = cols && cols[st.col];
      if (!getter) return list;
      const get = typeof getter === 'function' ? getter : (x => (x ? x[getter] : ''));
      const d = st.dir || 1;
      return list.slice().sort((a, b) => {
        const va = get(a), vb = get(b);
        if (va == null && vb == null) return 0;
        if (va == null || va === '') return 1;
        if (vb == null || vb === '') return -1;
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * d;
        return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * d;
      });
    },
    syncSortHeaders() {
      document.querySelectorAll('table[data-sort]').forEach(tbl => {
        const id = tbl.getAttribute('data-sort'), st = this.tblSort[id];
        tbl.querySelectorAll('thead th').forEach((th, idx) => {
          const col = th.getAttribute('data-col') || idx;
          if (st && String(st.col) === String(col)) th.setAttribute('data-sort-dir', st.dir === 1 ? '▲' : '▼');
          else th.removeAttribute('data-sort-dir');
        });
      });
    },
    // ---- Git Lens
    glCopy(v) { navigator.clipboard.writeText(v).then(() => { this.gl.copied = true; setTimeout(() => { this.gl.copied = false; }, 1200); }); },
    glT(c) { return this.gl.dateKind === 'c' ? (c.ct || c.at) : c.at; },
    glTz(c) { return this.gl.dateKind === 'c' ? (c.ctz || c.atz) : c.atz; },
    glFmt(t) {
      if (!t) return '—';
      const d = new Date(t * 1000), z = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
    },
    glFmtFull(t, tz) {
      if (!t) return '—';
      const off = glTzOff(tz), w = new Date((t + off * 60) * 1000), z = n => String(n).padStart(2, '0');
      const orig = w.getUTCFullYear() + '-' + z(w.getUTCMonth() + 1) + '-' + z(w.getUTCDate()) + ' ' + z(w.getUTCHours()) + ':' + z(w.getUTCMinutes()) + ':' + z(w.getUTCSeconds()) + ' ' + (tz || '');
      return this.glFmt(t) + ' (' + tr('gl_local') + ') · ' + orig + ' (' + tr('gl_orig') + ') · ' + this.glRel(t);
    },
    glRel(t) {
      const s = Math.floor(Date.now() / 1000) - t;
      if (s < 3600) return tr('clk_ts_ago').replace('{d}', tr('clk_m').replace('{n}', Math.max(1, Math.floor(s / 60))));
      if (s < 86400) return tr('clk_ts_ago').replace('{d}', tr('clk_h').replace('{n}', Math.floor(s / 3600)));
      if (s < 86400 * 60) return tr('clk_ts_ago').replace('{d}', tr('clk_d').replace('{n}', Math.floor(s / 86400)));
      return '';
    },
    glAddSource(name, kind, commits, refList, graph, repo) {
      const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const byRef = new Map();
      (refList || []).forEach(r => { if (!byRef.has(r.sha)) byRef.set(r.sha, []); byRef.get(r.sha).push({ short: r.head ? 'HEAD → ' + r.short : r.short, kind: r.head ? 'head' : r.kind }); });
      let base = name, k = 2;
      while (this.gl.sources.some(s => s.name === name)) name = base + ' (' + (k++) + ')';
      commits.forEach(c => {
        c.srcId = id; c.project = name; c.kind = kind; c.isMerge = c.parents.length > 1 || !!c.merge;
        c.refs = byRef.get(c.sha) || (c.refsTxt ? c.refsTxt.split(',').map(x => x.trim()).filter(Boolean).map(x => ({ short: x.replace(/^tag: /, ''), kind: /^HEAD/.test(x) ? 'head' : /^tag: /.test(x) ? 'tag' : /\//.test(x) ? 'remote' : 'branch' })) : []);
        c.hay = (c.sha + ' ' + c.subject + ' ' + c.msg + ' ' + c.an + ' ' + c.ae + ' ' + c.refs.map(r => r.short).join(' ')).toLowerCase();
      });
      if (repo) this.glRepos[id] = repo;
      this.gl.sources.push({ id, name, kind, count: commits.length, refs: (refList || []).length, graph });
      const all = this.gl.commits.concat(commits);
      this.gl.commits = Vue.markRaw(all.sort((a, b) => b.at - a.at));
      this.gl.order[id] = Vue.markRaw(commits);
      if (graph) {
        const tips = (refList || []).map(r => ({ name: r.short, kind: r.kind, sha: r.sha, head: r.head }));
        if (!refList) commits.forEach(c => c.refs.forEach(r => tips.push({ name: r.short.replace(/^HEAD\s*->\s*/, ''), kind: r.kind === 'head' ? 'branch' : r.kind, sha: c.sha, head: r.kind === 'head' && /->/.test(r.short) })));
        const bi = glBranchInfo(commits, tips.filter(x => x.name && x.name !== 'HEAD'));
        commits.forEach(c => { c.owner = bi.owner.get(c.sha) || ''; c.hay += ' ' + c.owner.toLowerCase(); });
        this.gl.binfo[id] = Vue.markRaw(bi);
      }
      this.gl.page = 300;
      this.gl.msg = tr('gl_loaded').replace('{n}', commits.length).replace('{p}', name);
      return id;
    },
    glRemove(id) {
      this.gl.sources = this.gl.sources.filter(s => s.id !== id);
      this.gl.commits = Vue.markRaw(this.gl.commits.filter(c => c.srcId !== id));
      if (this.gl.leak[id]) this.gl.leak[id].stop = true;
      delete this.glRepos[id]; delete this.gl.order[id]; delete this.gl.binfo[id]; delete this.gl.leak[id]; delete this.glLeakItems[id]; this.gl.leakVer++;
      if (this.gl.branch.split(':')[0] === id) this.gl.branch = '';
      if (this.gl.project && !this.gl.sources.some(s => s.name === this.gl.project)) this.gl.project = '';
      this.gl.sel = null;
    },
    async glLoadFiles(list) {
      // list: [{path (relatif ke folder yang dipilih), file}]
      this.gl.err = ''; this.gl.msg = '';
      const files = new Map();
      let repoName = '';
      list.forEach(({ path, file }) => {
        const p = path.replace(/\\/g, '/').replace(/^\/+/, '');
        const i = p.indexOf('.git/');
        let rel, nm;
        if (i === 0 || (i > 0 && p.charAt(i - 1) === '/')) { rel = p.slice(i + 5); nm = p.slice(0, i).replace(/\/$/, '').split('/').pop(); }
        else { const s = p.indexOf('/'); rel = s >= 0 ? p.slice(s + 1) : p; nm = s >= 0 ? p.slice(0, s).replace(/\.git$/, '') : ''; }
        if (/^(HEAD|packed-refs|config)$/.test(rel) || /^refs\//.test(rel) || /^objects\/pack\/pack-[0-9a-f]+\.(idx|pack)$/.test(rel) || /^objects\/[0-9a-f]{2}\/[0-9a-f]{38}$/.test(rel)) { files.set(rel, file); if (nm && !repoName) repoName = nm; }
      });
      if (!files.has('HEAD')) { this.gl.err = tr('gl_err_nogit'); return; }
      if (!window.DecompressionStream) { this.gl.err = tr('gl_err_browser'); return; }
      this.gl.busy = true; this.gl.prog = tr('gl_prog_open');
      try {
        const repo = await glOpenRepo(files);
        if (!repoName || repoName === '.git') {
          const cfg = await repo.text('config'), m = cfg.match(/url\s*=\s*\S*?([^/\\:\s]+?)(?:\.git)?\s*$/m);
          repoName = m ? m[1] : 'repo';
        }
        const refs = await glRefs(repo);
        if (!refs.length) throw new Error(tr('gl_err_norefs'));
        const max = Math.max(100, Math.min(200000, Number(this.gl.max) || 20000));
        const list2 = await glWalk(repo, refs, max, async n => { this.gl.prog = tr('gl_prog_walk').replace('{n}', n); await new Promise(r => setTimeout(r, 0)); });
        this.gl.prog = tr('gl_prog_sort');
        await new Promise(r => setTimeout(r, 0));
        const ordered = glTopo(list2);
        const sid = this.glAddSource(repoName, 'git', ordered, refs, true, repo);
        this.$nextTick(() => setTimeout(() => this.glScanLeaks(sid), 400));
        if (list2.length >= max) this.gl.msg += ' ' + tr('gl_capped').replace('{n}', max);
      } catch (e) { this.gl.err = tr('gl_err_read') + ' ' + (e.message || e); }
      finally { this.gl.busy = false; this.gl.prog = ''; }
    },
    onGlPick(e) {
      const list = Array.from(e.target.files || []).map(f => ({ path: f.webkitRelativePath || f.name, file: f }));
      e.target.value = '';
      if (list.length) this.glLoadFiles(list);
    },
    async onGlDrop(e) {
      this.gl.over = false;
      const items = Array.from(e.dataTransfer.items || []).map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
      const out = [];
      const readAll = dir => new Promise(res => { const r = dir.createReader(), acc = []; const step = () => r.readEntries(b => { if (!b.length) res(acc); else { acc.push(...b); step(); } }, () => res(acc)); step(); });
      const fileOf = en => new Promise(res => en.file(res, () => res(null)));
      const walk = async (en, pre) => {
        if (en.isFile) { const f = await fileOf(en); if (f) out.push({ path: pre + en.name, file: f }); return; }
        for (const ch of await readAll(en)) await walk(ch, pre + en.name + '/');
      };
      const gitDirOf = dir => new Promise(res => dir.getDirectory('.git', {}, res, () => res(null)));
      this.gl.busy = true; this.gl.prog = tr('gl_prog_scan');
      for (const en of items) {
        if (!en.isDirectory) continue;
        if (en.name === '.git') { await walk(en, ''); continue; }
        const g = await gitDirOf(en);
        if (g) await walk(g, en.name + '/'); else await walk(en, '');
      }
      this.gl.busy = false;
      // kelompokkan per repo bila beberapa folder di-drop sekaligus
      const groups = new Map();
      out.forEach(x => { const p = x.path, i = p.indexOf('.git/'), k = i >= 0 ? p.slice(0, i) : p.split('/')[0]; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
      if (!groups.size) { this.gl.err = tr('gl_err_nogit'); return; }
      for (const g of groups.values()) await this.glLoadFiles(g);
    },
    glLoadPaste() {
      const r = glParseLog(this.gl.paste);
      if (!r.commits.length) { this.gl.err = tr('gl_err_paste'); return; }
      this.gl.err = '';
      const name = this.gl.pasteName.trim() || 'log';
      this.glAddSource(name, 'log', r.graph ? glTopo(r.commits) : r.commits, null, r.graph, null);
      this.gl.paste = '';
    },
    glResetFilter() { Object.assign(this.gl, { q: '', author: '', project: '', merge: 'all', from: '', to: '', heat: null, branch: '' }); },
    // Scan secret di seluruh riwayat: commit lama -> baru, blob baru per commit (dibanding parent pertama), tiap blob sekali.
    async glScanLeaks(id) {
      const repo = this.glRepos[id], list = this.gl.order[id];
      if (!repo || !list) return;
      if (this.gl.leak[id] && this.gl.leak[id].state === 'run') return;
      const st = { state: 'run', done: 0, total: list.length, blobs: 0, stop: false, t0: Date.now() };
      this.gl.leak[id] = st;
      const items = [], byKey = new Map(), seen = new Set(), bySha = new Map(list.map(c => [c.sha, c]));
      this.glLeakItems[id] = items;
      const old = list.slice().reverse();
      let tick = Date.now();
      try {
        for (let i = 0; i < old.length && !st.stop; i++) {
          const c = old[i];
          let pt = null;
          if (c.parents[0]) { const pc = bySha.get(c.parents[0]); if (pc) pt = pc.tree; else { const o = await repo.readObject(c.parents[0]); const m = o && repo.dec.decode(o.data).match(/^tree ([0-9a-f]{40})/); pt = m ? m[1] : null; } }
          const diff = await glTreeDiff(repo, c.tree, pt);
          for (const f of diff) {
            if (st.stop) break;
            if (f.st === 'D' || !f.sha || seen.has(f.sha)) continue;
            seen.add(f.sha);
            if (GL_SKIP_EXT.test(f.path) || GL_SKIP_NAME.test(f.path)) continue;
            const o = await repo.readObject(f.sha);
            if (!o || o.type !== 'blob' || o.data.length > 1500000) continue;
            const head = o.data.subarray(0, 8000);
            if (head.indexOf(0) >= 0) continue;
            st.blobs++;
            const hits = glScanText(repo.dec.decode(o.data));
            hits.forEach(h => {
              const k = h.rule + '|' + h.value;
              const ex = byKey.get(k);
              if (ex) { ex.count++; if (ex.paths.indexOf(f.path) < 0 && ex.paths.length < 20) ex.paths.push(f.path); ex.lastSha = c.sha; ex.lastAt = c.at; return; }
              const it = { id: id + ':' + items.length, srcId: id, project: c.project, rule: h.rule, severity: h.severity, fix: h.fix, value: h.value, text: h.text, path: f.path, line: h.line, sha: c.sha, an: c.an, at: c.at, count: 1, paths: [f.path], lastSha: c.sha, lastAt: c.at, status: '' };
              byKey.set(k, it); items.push(it);
            });
          }
          st.done = i + 1;
          if (Date.now() - tick > 40) { this.gl.leakVer++; await new Promise(r => setTimeout(r, 0)); tick = Date.now(); }
        }
        // Masih ada di versi terbaru (HEAD)? cek file yang sama di tree HEAD.
        const heads = (this.gl.binfo[id] && list.length) ? list : [];
        const headC = heads.find(c => c.refs.some(r => r.kind === 'head')) || heads[0];
        if (headC) for (const it of items) {
          if (st.stop) break;
          const b = await glBlobAt(repo, headC.tree, it.path);
          let present = false;
          if (b) { const o = await repo.readObject(b); present = !!(o && o.type === 'blob' && repo.dec.decode(o.data).indexOf(it.value) >= 0); }
          it.status = present ? 'head' : 'history';
        }
        st.state = st.stop ? 'stop' : 'done';
      } catch (e) { st.state = 'error'; st.err = String(e.message || e); }
      st.ms = Date.now() - st.t0;
      this.gl.leakVer++;
    },
    glMask(v) { return glMask(v); },
    glStopLeaks() { Object.values(this.gl.leak).forEach(s => { if (s.state === 'run') s.stop = true; }); },
    glRescanLeaks() { this.gl.sources.filter(s => s.kind === 'git' && !(this.gl.project && s.name !== this.gl.project)).forEach(s => this.glScanLeaks(s.id)); },
    glLeakOpen(it) { this.gl.sel = it.sha; this.gl.view = 'list'; },
    glExportLeaks(kind) {
      const R = this.glLeaks, show = this.gl.leakShow;
      const head = ['Severity', tr('gl_lk_rule'), tr('gl_lk_value'), tr('gl_lk_file'), tr('gl_lk_first'), 'Author', tr('gl_th_day'), tr('gl_lk_count'), 'Status', tr('gl_lk_fix')];
      const row = r => [r.severity, L(r.rule), show ? r.value : glMask(r.value), r.path + ':' + r.line, r.sha.slice(0, 10), r.an, this.glFmt(r.at), r.count, tr('gl_lk_st_' + (r.status || 'history')), L(r.fix)];
      if (kind === 'csv') { pupDownload('git-secret-leaks.csv', '\ufeff' + glCsv([head].concat(R.map(row))), 'text/csv'); return; }
      const body = R.map(r => '<tr>' + row(r).map((v, i) => '<td' + (i === 0 ? ' class="s-' + esc(r.severity) + '"' : '') + '>' + esc(String(v)) + '</td>').join('') + '</tr>').join('');
      const html = '<!DOCTYPE html><html lang="' + LANG + '"><head><meta charset="UTF-8"><title>' + esc(tr('gl_lk_title')) + '</title>' + FAV_LINK + '<style>'
        + 'body{font:14px/1.5 Segoe UI,system-ui,sans-serif;margin:24px;color:#1e1713;background:linear-gradient(180deg,#faf6f1 0%,#f5efe8 100%)}table{border-collapse:collapse;width:100%;background:#fff}'
        + 'caption{caption-side:top;text-align:left;font-size:18px;font-weight:700;padding:10px 12px;background:#7f1d1d;color:#fff;border-radius:8px 8px 0 0}'
        + 'th{background:#991b1b;color:#fff;padding:8px;border:1px solid #7f1d1d;text-align:left;position:relative;cursor:pointer;user-select:none}th[data-sort-dir]::after{content:attr(data-sort-dir);margin-left:5px;font-size:10px}th.rz-hover{cursor:col-resize!important}td{padding:7px 8px;border:1px solid #ddd0c3;vertical-align:top;word-break:break-word}'
        + 'tr:nth-child(even) td{background:#f7f1ea}.s-HIGH{color:#b91c1c;font-weight:700}.s-MEDIUM{color:#b45309;font-weight:700}.note{color:#6b5748;margin-top:12px}</style></head><body>'
        + '<table><caption>' + esc(tr('gl_lk_title')) + ' · ' + R.length + '</caption><thead><tr>' + head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table>'
        + '<p class="note">' + esc(tr('gl_lk_advice')) + '</p>' + REPORT_TABLE_JS + '</body></html>';
      pupDownload('git-secret-leaks.html', html, 'text/html');
    },
    glGanttEnd() { this.$nextTick(() => { const el = this.$refs.glGanttScroll; if (el) el.scrollLeft = el.scrollWidth; }); },
    glGanttTip(c) { return this.glFmt(this.glT(c)) + ' · ' + c.sha.slice(0, 8) + ' · ' + c.an + '\n' + c.subject; },
    glSelect(c) { this.gl.sel = this.gl.sel === c.sha ? null : c.sha; },
    async glLoadDiff(c) {
      this.gl.files = null;
      const repo = this.glRepos[c.srcId];
      if (!repo) return;
      this.gl.filesBusy = true;
      try {
        let pt = null;
        if (c.parents[0]) { const o = await repo.readObject(c.parents[0]); const m = o && repo.dec.decode(o.data).match(/^tree ([0-9a-f]{40})/); pt = m ? m[1] : null; }
        const f = await glTreeDiff(repo, c.tree, pt);
        if (this.gl.sel === c.sha) this.gl.files = Vue.markRaw(f);
      } catch (e) { this.gl.files = []; this.gl.err = tr('gl_err_read') + ' ' + (e.message || e); }
      finally { this.gl.filesBusy = false; }
    },
    glSendClock(c) { this.clock.ts = String(c.at); this.tab = 'clock'; this.$nextTick(() => this.clkTsApply()); },
    glHeatPick(d, h) { this.gl.view = 'list'; this.gl.q = ''; this.gl.heat = { d, h }; },
    glDrawBars() {
      const c = this.$refs.glBars;
      if (!c) return;
      const st = this.glStats, H = 180, dpr = window.devicePixelRatio || 1, w = Math.max(200, c.clientWidth || 600);
      c.width = Math.round(w * dpr); c.height = Math.round(H * dpr);
      const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, H);
      const bars = st.bars, mx = Math.max(1, ...bars.map(b => b.n)), L = 30, B = 20, pw = w - L - 4, bw = pw / Math.max(1, bars.length);
      const muted = pingCss('--muted', '#94a3b8');
      g.font = '11px Consolas, monospace'; g.fillStyle = muted;
      g.fillText(String(mx), 2, 12); g.fillText('0', 2, H - B);
      bars.forEach((b, i) => {
        const hh = Math.round(b.n / mx * (H - B - 8));
        g.fillStyle = b.n ? '#22c55e' : 'rgba(100,116,139,.25)';
        g.fillRect(L + i * bw, H - B - Math.max(1, hh), Math.max(1, bw - 1), Math.max(1, hh));
      });
      const step = Math.max(1, Math.ceil(bars.length / 8));
      g.fillStyle = muted;
      bars.forEach((b, i) => { if (i % step === 0) g.fillText(b.label, L + i * bw, H - 5); });
    },
    glExportCommits() {
      const rows = [['project', 'hash', 'parents', 'author', 'email', 'author_date', 'author_tz', 'commit_date', 'merge', 'refs', 'subject']];
      this.glFiltered.forEach(c => rows.push([c.project, c.sha, c.parents.join(' '), c.an, c.ae, new Date(c.at * 1000).toISOString(), c.atz, new Date((c.ct || c.at) * 1000).toISOString(), c.isMerge ? 'ya' : '', c.refs.map(r => r.short).join(' '), c.subject]));
      pupDownload('git-commits.csv', '\ufeff' + glCsv(rows), 'text/csv');
    },
    glExportReport(kind) {
      const R = this.glReport;
      if (kind === 'csv') {
        const rows = [[tr('gl_th_day'), 'Project', 'Author', 'Commit', tr('gl_first_time'), tr('gl_last_time'), tr('gl_work')]];
        R.forEach(r => rows.push([r.date, r.project, r.authors, r.n, r.first, r.last, r.titles.join('; ')]));
        pupDownload('laporan-pekerjaan-git.csv', '\ufeff' + glCsv(rows), 'text/csv');
        return;
      }
      const range = R.length ? R[R.length - 1].date + ' – ' + R[0].date : '';
      const head = [tr('gl_th_day'), 'Project', 'Author', 'Commit', tr('gl_first_time'), tr('gl_last_time'), tr('gl_work')].map(h => '<th>' + esc(h) + '</th>').join('');
      const body = R.map(r => '<tr><td><b>' + esc(r.date) + '</b><br><small>' + esc(r.dow) + '</small></td><td>' + esc(r.project) + '</td><td>' + esc(r.authors) + '</td><td style="text-align:center">' + r.n + '</td><td>' + esc(r.first) + '</td><td>' + esc(r.last) + '</td><td>' + r.titles.map(x => '• ' + esc(x)).join('<br>') + '</td></tr>').join('');
      const html = '<!DOCTYPE html><html lang="' + LANG + '"><head><meta charset="UTF-8"><title>' + esc(tr('gl_rep_title')) + '</title>' + FAV_LINK + '<style>'
        + 'body{font:14px/1.5 Segoe UI,system-ui,sans-serif;margin:24px;color:#1e1713;background:linear-gradient(180deg,#faf6f1 0%,#f5efe8 100%)}table{border-collapse:collapse;width:100%;background:#fff}'
        + 'caption{caption-side:top;text-align:left;font-size:18px;font-weight:700;padding:10px 12px;background:linear-gradient(135deg,#6e3b1c 0%,#4e2a14 100%);color:#fbf6f0;border-radius:8px 8px 0 0}'
        + 'th{background:#854822;color:#fbf6f0;padding:8px;border:1px solid #5c3116;text-align:left;position:relative;cursor:pointer;user-select:none}th[data-sort-dir]::after{content:attr(data-sort-dir);margin-left:5px;font-size:10px}th.rz-hover{cursor:col-resize!important}td{padding:7px 8px;border:1px solid #ddd0c3;vertical-align:top}'
        + 'tr:nth-child(even) td{background:#f7f1ea}small{color:#786557}.meta{color:#6b5748;margin:8px 0 14px}</style></head><body>'
        + '<table><caption>' + esc(tr('gl_rep_title')) + (range ? ' · ' + esc(range) : '') + '</caption><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>'
        + '<p class="meta">' + esc(tr('gl_rep_meta').replace('{n}', R.reduce((a, r) => a + r.n, 0)).replace('{d}', new Set(R.map(r => r.date)).size)) + '</p>' + REPORT_TABLE_JS + '</body></html>';
      pupDownload('laporan-pekerjaan-git.html', html, 'text/html');
    },
    // ---- Studio Gambar
    imInit() {
      this.imOrig = null; this.imCur = null; this.imHist = []; this.imOrigBuf = null; this.imBlob = null; this.imSess = null; this.imSessKey = '';
      try { const p = JSON.parse(localStorage.getItem(IMG_PREFS_KEY) || '{}'); if (p && typeof p === 'object') { ['prov', 'prompt'].forEach(k => { if (typeof p[k] === 'string') this.im.api[k] = p[k]; }); if (p.models && typeof p.models === 'object') this.im.api.models = Object.assign({}, this.im.api.models, p.models); if (p.fmt) this.im.fmt = p.fmt; if (p.q) this.im.q = p.q; } } catch (e) { /* abaikan */ }
      document.addEventListener('paste', e => {
        if (this.tab !== 'img') return;
        const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(x => x.type.indexOf('image/') === 0);
        if (it) { e.preventDefault(); this.imLoad(it.getAsFile()); }
      });
      const c = document.createElement('canvas');
      c.toBlob(b => { this.im.avif = !!(b && b.type === 'image/avif'); }, 'image/avif', 0.5);
    },
    imSavePrefs() { try { localStorage.setItem(IMG_PREFS_KEY, JSON.stringify({ prov: this.im.api.prov, prompt: this.im.api.prompt, models: this.im.api.models, fmt: this.im.fmt, q: this.im.q })); } catch (e) { /* abaikan */ } },
    imW() {
      if (this.imWorker) return this.imWorker;
      const w = this.imWorker = new Worker(URL.createObjectURL(new Blob(['(' + imgWorkerMain.toString() + ')();'], { type: 'text/javascript' })));
      w.onmessage = e => { const m = e.data; if (m.op === 'prog') this.im.prog = m.pct; else if (m.op === 'step') this.im.busy = this.t('im_step_' + m.name); else if (this.imPend) { const f = this.imPend; this.imPend = null; f(m); } };
      return w;
    },
    imRun(msg) { return new Promise((res, rej) => { this.imPend = m => (m.op === 'error' ? rej(new Error(m.msg)) : res(m)); this.imW().postMessage(msg, [msg.buf]); }); },
    onImDrop(ev) { this.im.over = false; const f = [...(ev.dataTransfer.files || [])].find(x => x.type.indexOf('image/') === 0); if (f) this.imLoad(f); },
    onImPick(ev) { const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (f) this.imLoad(f); },
    async imPasteBtn() {
      try { const items = await navigator.clipboard.read(); for (const it of items) { const ty = it.types.find(t => t.indexOf('image/') === 0); if (ty) { this.imLoad(new File([await it.getType(ty)], 'paste.' + ty.split('/')[1], { type: ty })); return; } } this.im.err = this.t('im_no_clip'); } catch (e) { this.im.err = this.t('im_no_clip'); }
    },
    async imLoad(file) {
      const im = this.im;
      im.err = ''; im.msg = ''; im.boxes = []; im.aiGen = false; im.outScale = 1;
      try {
        this.imOrigBuf = await file.arrayBuffer();
        im.meta = imgMeta(this.imOrigBuf);
        const bmp = await createImageBitmap(new Blob([this.imOrigBuf], { type: file.type || 'image/png' }));
        const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0);
        this.imOrig = c; this.imCur = c; this.imHist = [];
        im.src = { name: file.name || 'gambar', size: file.size, type: file.type || '?', w: c.width, h: c.height };
        im.cur = { w: c.width, h: c.height }; im.hist = 0;
        im.rs.w = c.width; im.rs.h = c.height; im.rs.pct = 100;
        this.$nextTick(() => { this.imDraw(); this.imEncodeSoon(); });
      } catch (e) { im.err = this.t('im_err_load') + ' ' + (e.message || e); }
    },
    imSetCur(c, label) {
      this.imHist.push(this.imCur); if (this.imHist.length > 6) this.imHist.shift();
      this.imCur = c; this.im.cur = { w: c.width, h: c.height }; this.im.hist = this.imHist.length; this.im.msg = label || '';
      this.im.rs.w = c.width; this.im.rs.h = c.height; this.im.rs.pct = 100;
      this.$nextTick(() => { this.imDraw(); this.imEncodeSoon(); });
    },
    imUndo() { if (!this.imHist.length) return; this.imCur = this.imHist.pop(); this.im.cur = { w: this.imCur.width, h: this.imCur.height }; this.im.hist = this.imHist.length; this.im.aiGen = false; this.imDraw(); this.imEncodeSoon(); },
    imReset() { if (!this.imOrig) return; this.imHist = []; this.imCur = this.imOrig; this.im.cur = { w: this.imOrig.width, h: this.imOrig.height }; this.im.hist = 0; this.im.boxes = []; this.im.aiGen = false; this.im.outScale = 1; this.imDraw(); this.imEncodeSoon(); },
    imData(c) { return c.getContext('2d').getImageData(0, 0, c.width, c.height); },
    imCanvasFrom(buf, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buf), w, h), 0, 0); return c; },
    // gambar akhir = gambar kerja + sensor area (+ skala output dari mode target ukuran)
    imComposite(scale) {
      const src = this.imCur, s = scale || 1, w = Math.max(1, Math.round(src.width * s)), h = Math.max(1, Math.round(src.height * s));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
      this.im.boxes.forEach(b => {
        const x = Math.round(b.x * s), y = Math.round(b.y * s), bw = Math.max(1, Math.round(b.w * s)), bh = Math.max(1, Math.round(b.h * s));
        if (b.mode === 'black') { g.fillStyle = '#000'; g.fillRect(x, y, bw, bh); return; }
        if (b.mode === 'pixel') {
          const n = Math.max(6, Math.round(Math.min(bw, bh) / 8)), t = document.createElement('canvas'); t.width = Math.max(1, Math.round(bw / n)); t.height = Math.max(1, Math.round(bh / n));
          t.getContext('2d').drawImage(c, x, y, bw, bh, 0, 0, t.width, t.height);
          g.save(); g.imageSmoothingEnabled = false; g.drawImage(t, 0, 0, t.width, t.height, x, y, bw, bh); g.restore(); return;
        }
        g.save(); g.beginPath(); g.rect(x, y, bw, bh); g.clip(); g.filter = 'blur(' + Math.max(6, Math.round(Math.min(bw, bh) / 6)) + 'px)'; g.drawImage(c, 0, 0); g.restore();
      });
      return c;
    },
    imDraw() {
      const v = this.$refs.imView; if (!v || !this.imCur) return;
      const comp = this.imComposite(1);
      v.width = comp.width; v.height = comp.height;
      const g = v.getContext('2d'); g.drawImage(comp, 0, 0);
      if (this.im.cmp > 0 && this.imOrig) {
        const cx = Math.round(v.width * this.im.cmp / 100);
        g.save(); g.beginPath(); g.rect(0, 0, cx, v.height); g.clip(); g.imageSmoothingQuality = 'high'; g.drawImage(this.imOrig, 0, 0, v.width, v.height); g.restore();
        g.fillStyle = '#f59e0b'; g.fillRect(cx - 1, 0, 2, v.height);
      }
      g.strokeStyle = '#ef4444'; g.lineWidth = Math.max(2, v.width / 600);
      this.im.boxes.forEach(b => g.strokeRect(b.x, b.y, b.w, b.h));
      if (this.imDrag) { const d = this.imDrag; g.setLineDash([6, 4]); g.strokeRect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0)); g.setLineDash([]); }
    },
    imPt(ev) { const v = this.$refs.imView, r = v.getBoundingClientRect(); return { x: Math.max(0, Math.min(v.width, (ev.clientX - r.left) * v.width / r.width)), y: Math.max(0, Math.min(v.height, (ev.clientY - r.top) * v.height / r.height)) }; },
    imDown(ev) { if (this.im.tool !== 'redact' || !this.imCur) return; const p = this.imPt(ev); this.imDrag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; ev.target.setPointerCapture && ev.target.setPointerCapture(ev.pointerId); },
    imMove(ev) { if (!this.imDrag) return; const p = this.imPt(ev); this.imDrag.x1 = p.x; this.imDrag.y1 = p.y; if (!this.imRaf) this.imRaf = requestAnimationFrame(() => { this.imRaf = 0; this.imDraw(); }); },
    imUp() {
      const d = this.imDrag; this.imDrag = null; if (!d) return;
      const b = { x: Math.round(Math.min(d.x0, d.x1)), y: Math.round(Math.min(d.y0, d.y1)), w: Math.round(Math.abs(d.x1 - d.x0)), h: Math.round(Math.abs(d.y1 - d.y0)), mode: this.im.boxMode };
      if (b.w > 3 && b.h > 3) this.im.boxes.push(b);
      this.imDraw(); this.imEncodeSoon();
    },
    imEncode(c, fmt, q) { return new Promise(res => c.toBlob(b => res(b), fmt, q / 100)); },
    imEncodeSoon() { clearTimeout(this.imET); this.imET = setTimeout(() => this.imEncodeNow(), 350); },
    async imEncodeNow() {
      if (!this.imCur) return;
      const im = this.im; im.encBusy = true;
      const c = this.imComposite(im.outScale), b = await this.imEncode(c, im.fmt, im.q);
      this.imBlob = b; im.outSize = b ? b.size : 0; im.outW = c.width; im.outH = c.height; im.encBusy = false;
      try { im.outMeta = imgMeta(await b.arrayBuffer()); } catch (e) { im.outMeta = null; }
      this.imSavePrefs();
    },
    async imTable() {
      if (!this.imCur) return;
      const im = this.im, fmts = ['image/jpeg', 'image/webp'].concat(im.avif ? ['image/avif'] : []), qs = [92, 82, 70, 55, 40], rows = [];
      im.table = []; im.tableBusy = true;
      const c = this.imComposite(im.outScale);
      for (const f of fmts) for (const q of qs) { const b = await this.imEncode(c, f, q); rows.push({ f, q, s: 1, size: b.size }); im.table = rows.slice(); }
      const png = await this.imEncode(c, 'image/png', 100); rows.push({ f: 'image/png', q: 100, s: 1, size: png.size });
      for (const s of [0.75, 0.5, 0.25]) { const cs = this.imComposite(im.outScale * s), b = await this.imEncode(cs, im.fmt, im.q); rows.push({ f: im.fmt, q: im.q, s, size: b.size, w: cs.width, h: cs.height }); }
      im.table = rows; im.tableBusy = false;
    },
    imPickRow(r) { this.im.fmt = r.f; this.im.q = r.q; if (r.s !== 1) this.im.outScale = Math.round(this.im.outScale * r.s * 1000) / 1000; this.imEncodeNow(); },
    // cari kualitas (lalu skala) supaya ukuran <= target KB
    async imFitTarget() {
      if (!this.imCur) return;
      const im = this.im, lim = im.target * 1024, f = im.fmt === 'image/png' ? 'image/webp' : im.fmt;
      im.fmt = f; im.tableBusy = true;
      let scale = im.outScale, best = null;
      for (let round = 0; round < 10 && !best; round++) {
        const c = this.imComposite(scale);
        let lo = 5, hi = 100, ok = null;
        while (lo <= hi) { const mid = (lo + hi) >> 1, b = await this.imEncode(c, f, mid); if (b.size <= lim) { ok = { q: mid, size: b.size }; lo = mid + 1; } else hi = mid - 1; }
        if (ok && ok.q >= 35) best = { q: ok.q, scale };
        else if (ok && scale <= 0.15) best = { q: ok.q, scale };
        else scale = Math.round(scale * 0.8 * 1000) / 1000;
      }
      im.tableBusy = false;
      if (!best) { im.err = this.t('im_target_fail'); return; }
      im.q = best.q; im.outScale = best.scale; im.err = '';
      await this.imEncodeNow();
      im.msg = this.t('im_target_ok').replace('{q}', best.q).replace('{w}', im.outW).replace('{h}', im.outH);
    },
    imDownload() {
      if (!this.imBlob) return;
      const ext = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif', 'image/png': 'png' }[this.im.fmt] || 'img';
      const a = document.createElement('a'); a.href = URL.createObjectURL(this.imBlob);
      a.download = (this.im.src.name || 'gambar').replace(/\.[^.]+$/, '') + (this.im.aiGen ? '-ai' : '-edit') + '.' + ext;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    },
    async imCopy() {
      try { const b = await this.imEncode(this.imComposite(this.im.outScale), 'image/png', 100); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); this.im.msg = this.t('im_copied'); } catch (e) { this.im.err = String(e.message || e); }
    },
    imRsSync(from) {
      const rs = this.im.rs, c = this.im.cur; if (!c.w) return;
      if (from === 'pct') { rs.w = Math.max(1, Math.round(c.w * rs.pct / 100)); rs.h = Math.max(1, Math.round(c.h * rs.pct / 100)); }
      else if (from === 'w' && rs.lock) { rs.h = Math.max(1, Math.round(rs.w * c.h / c.w)); rs.pct = Math.round(rs.w / c.w * 1000) / 10; }
      else if (from === 'h' && rs.lock) { rs.w = Math.max(1, Math.round(rs.h * c.w / c.h)); rs.pct = Math.round(rs.h / c.h * 1000) / 10; }
    },
    async imResize() {
      const im = this.im, rs = im.rs;
      if (!this.imCur || !rs.w || !rs.h) return;
      if (rs.w * rs.h > 100e6) { im.err = this.t('im_too_big'); return; }
      im.busy = this.t('im_step_resize'); im.prog = 0; im.err = '';
      try {
        const d = this.imData(this.imCur), t0 = Date.now();
        const m = await this.imRun({ op: 'resize', id: 1, buf: d.data.buffer, w: d.width, h: d.height, dw: +rs.w, dh: +rs.h, alg: rs.alg });
        this.imSetCur(this.imCanvasFrom(m.buf, m.w, m.h), this.t('im_done').replace('{s}', ((Date.now() - t0) / 1000).toFixed(1)));
      } catch (e) { im.err = String(e.message || e); }
      im.busy = '';
    },
    imPreset(k) {
      const fx = this.im.fx;
      const P = {
        light: { denoise: 0, deconv: 'none', amount: 0.7, radius: 1.0, threshold: 2, auto: false },
        medium: { denoise: 12, deconv: 'gauss', sigma: 1.2, iters: 8, amount: 0.4, radius: 1.0, threshold: 3, auto: false },
        strong: { denoise: 20, deconv: 'gauss', sigma: 1.8, iters: 15, amount: 0.6, radius: 1.2, threshold: 3, auto: true },
        text: { denoise: 0, deconv: 'gauss', sigma: 0.9, iters: 10, amount: 0.8, radius: 0.8, threshold: 1, auto: true }
      }[k];
      Object.assign(fx, P, { preset: k });
    },
    async imFix() {
      const im = this.im, fx = im.fx;
      if (!this.imCur) return;
      const steps = [];
      if (fx.denoise > 0) steps.push({ op: 'denoise', v: +fx.denoise });
      if (fx.deconv === 'gauss') steps.push({ op: 'deconv', kind: 'gauss', a: +fx.sigma, iters: +fx.iters });
      if (fx.deconv === 'motion') steps.push({ op: 'deconv', kind: 'motion', a: +fx.len, b: +fx.angle, iters: +fx.iters });
      if (fx.amount > 0) steps.push({ op: 'unsharp', amount: +fx.amount, radius: +fx.radius, threshold: +fx.threshold });
      if (fx.auto) steps.push({ op: 'auto' });
      if (!steps.length) return;
      if (this.imCur.width * this.imCur.height > 30e6) { im.err = this.t('im_too_big'); return; }
      im.busy = this.t('im_working'); im.prog = 0; im.err = '';
      try {
        const d = this.imData(this.imCur), t0 = Date.now();
        const m = await this.imRun({ op: 'fx', id: 2, buf: d.data.buffer, w: d.width, h: d.height, steps });
        this.imSetCur(this.imCanvasFrom(m.buf, m.w, m.h), this.t('im_done').replace('{s}', ((Date.now() - t0) / 1000).toFixed(1)));
      } catch (e) { im.err = String(e.message || e); }
      im.busy = '';
    },
    // ---- upscale AI lokal (Real-ESRGAN, onnxruntime-web), per tile
    async imAiLocal() {
      const im = this.im, ai = im.ai, base = IMG_MODELS.find(m => m.key === ai.model) || IMG_MODELS[0];
      if (!this.imCur) return;
      let mdl = base;
      if (base.kind === 'w2x') {
        const sc = +ai.out === 1 ? 1 : (+ai.out === 2 ? 2 : 4), nz = +ai.noise;
        if (sc === 1 && nz < 0) { im.err = this.t('im_w2x_need'); return; }
        const name = sc === 1 ? 'noise' + nz : (nz >= 0 ? 'noise' + nz + '_scale' + sc + 'x' : 'scale' + sc + 'x');
        mdl = Object.assign({}, base, { key: base.key + '/' + name, url: IMG_W2X_BASE + base.style + '/' + name + '.onnx', scale: sc });
      }
      const W = this.imCur.width, H = this.imCur.height;
      if (W * H * 16 > 64e6 && ai.out === 4) { im.err = this.t('im_ai_big'); return; }
      im.err = ''; im.prog = 0;
      try {
        im.busy = this.t('im_ai_runtime');
        await imgLoadScript(IMG_ORT_SRC);
        const ort = window.ort; ort.env.wasm.wasmPaths = IMG_ORT_WASM; ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
        if (!this.imSess || this.imSessKey !== mdl.key) {
          im.busy = this.t('im_ai_model');
          const bytes = await imgModelBytes(mdl, (p, got) => { im.prog = p; im.busy = this.t('im_ai_model') + ' ' + (got / 1048576).toFixed(1) + ' MB'; });
          im.busy = this.t('im_ai_init');
          if (this.imSess) { try { await this.imSess.release(); } catch (e) { /* abaikan */ } this.imSess = null; }
          const eps = navigator.gpu ? ['webgpu', 'wasm'] : ['wasm'];
          this.imSess = await ort.InferenceSession.create(bytes, { executionProviders: eps, graphOptimizationLevel: 'all' });
          this.imSessKey = mdl.key; ai.ep = navigator.gpu ? 'WebGPU' : 'WASM';
        }
        const sess = this.imSess, inName = sess.inputNames[0], outName = sess.outputNames[0];
        const src = this.imData(this.imCur).data, S = mdl.scale, PAD = 10;
        const out = new Uint8ClampedArray(W * S * H * S * 4);
        if (mdl.kind === 'w2x') {
          // swin_unet: tile input T (T-16 kelipatan 48), output = S*(T-16) untuk inti tile (margin 8 px, pad reflection)
          const T = { 128: 112, 192: 208, 256: 256, 384: 400 }[+ai.tile] || 208, M = 8, C = T - 2 * M;
          const rf = (i, n) => { if (n === 1) return 0; for (;;) { if (i < 0) i = -i; else if (i >= n) i = 2 * n - 2 - i; else return i; } };
          const tilesX = Math.ceil(W / C), tilesY = Math.ceil(H / C), total = tilesX * tilesY, t0w = Date.now(), plane = T * T;
          let done = 0;
          for (let ty = 0; ty < tilesY; ty++) for (let tx = 0; tx < tilesX; tx++) {
            const ox = tx * C - M, oy = ty * C - M, inp = new Float32Array(3 * plane);
            for (let y = 0; y < T; y++) { const sy = rf(oy + y, H); for (let x = 0; x < T; x++) { const si = (sy * W + rf(ox + x, W)) * 4, di = y * T + x; inp[di] = src[si] / 255; inp[plane + di] = src[si + 1] / 255; inp[2 * plane + di] = src[si + 2] / 255; } }
            const res = await sess.run({ [inName]: new ort.Tensor('float32', inp, [1, 3, T, T]) });
            const o = res[outName].data, ow = C * S, op = ow * ow;
            const bx = tx * C * S, by = ty * C * S, ex = Math.min(W * S, bx + ow), ey = Math.min(H * S, by + ow);
            for (let gy = by; gy < ey; gy++) for (let gx = bx; gx < ex; gx++) {
              const si = (gy - by) * ow + (gx - bx), di = (gy * W * S + gx) * 4;
              out[di] = o[si] * 255; out[di + 1] = o[op + si] * 255; out[di + 2] = o[2 * op + si] * 255;
              out[di + 3] = src[(Math.min(H - 1, Math.floor(gy / S)) * W + Math.min(W - 1, Math.floor(gx / S))) * 4 + 3];
            }
            done++; im.prog = Math.round(done / total * 100);
            im.busy = this.t('im_ai_run').replace('{d}', done).replace('{t}', total).replace('{s}', Math.ceil((Date.now() - t0w) / done * (total - done) / 1000));
            await new Promise(r => setTimeout(r, 0));
          }
          let c = this.imCanvasFrom(out.buffer, W * S, H * S);
          if (+ai.out !== S) {
            im.busy = this.t('im_step_resize');
            const d = this.imData(c), m = await this.imRun({ op: 'resize', id: 3, buf: d.data.buffer, w: d.width, h: d.height, dw: Math.round(W * ai.out), dh: Math.round(H * ai.out), alg: 'lanczos3' });
            c = this.imCanvasFrom(m.buf, m.w, m.h);
          }
          this.imSetCur(c, this.t('im_done').replace('{s}', ((Date.now() - t0w) / 1000).toFixed(1)) + ' · waifu2x · ' + ai.ep);
          im.busy = ''; return;
        }
        const T = +ai.tile;
        const tilesX = Math.ceil(W / T), tilesY = Math.ceil(H / T), total = tilesX * tilesY, t0 = Date.now();
        let done = 0;
        for (let ty = 0; ty < tilesY; ty++) for (let tx = 0; tx < tilesX; tx++) {
          const x0 = tx * T, y0 = ty * T, x1 = Math.min(W, x0 + T), y1 = Math.min(H, y0 + T);
          const px0 = Math.max(0, x0 - PAD), py0 = Math.max(0, y0 - PAD), px1 = Math.min(W, x1 + PAD), py1 = Math.min(H, y1 + PAD), tw = px1 - px0, th = py1 - py0;
          const inp = new Float32Array(3 * tw * th), plane = tw * th;
          for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const si = ((py0 + y) * W + px0 + x) * 4, di = y * tw + x; inp[di] = src[si] / 255; inp[plane + di] = src[si + 1] / 255; inp[2 * plane + di] = src[si + 2] / 255; }
          const res = await sess.run({ [inName]: new ort.Tensor('float32', inp, [1, 3, th, tw]) });
          const o = res[outName].data, ow = tw * S, op = ow * th * S;
          for (let y = (y0 - py0) * S; y < (y1 - py0) * S; y++) for (let x = (x0 - px0) * S; x < (x1 - px0) * S; x++) {
            const gx = px0 * S + x, gy = py0 * S + y, di = (gy * W * S + gx) * 4, si = y * ow + x;
            out[di] = o[si] * 255; out[di + 1] = o[op + si] * 255; out[di + 2] = o[2 * op + si] * 255;
            const ax = Math.min(W - 1, Math.floor(gx / S)), ay = Math.min(H - 1, Math.floor(gy / S)); out[di + 3] = src[(ay * W + ax) * 4 + 3];
          }
          done++; im.prog = Math.round(done / total * 100);
          const eta = (Date.now() - t0) / done * (total - done) / 1000;
          im.busy = this.t('im_ai_run').replace('{d}', done).replace('{t}', total).replace('{s}', Math.ceil(eta));
          await new Promise(r => setTimeout(r, 0));
        }
        let c = this.imCanvasFrom(out.buffer, W * S, H * S);
        if (+ai.out !== S) {
          im.busy = this.t('im_step_resize');
          const d = this.imData(c), dw = Math.round(W * ai.out), dh = Math.round(H * ai.out);
          const m = await this.imRun({ op: 'resize', id: 3, buf: d.data.buffer, w: d.width, h: d.height, dw, dh, alg: 'lanczos3' });
          c = this.imCanvasFrom(m.buf, m.w, m.h);
        }
        this.imSetCur(c, this.t('im_done').replace('{s}', ((Date.now() - t0) / 1000).toFixed(1)) + ' · ' + ai.ep);
      } catch (e) { im.err = this.t('im_ai_fail') + ' ' + (e.message || e); }
      im.busy = '';
    },
    // ---- AI lewat API milik user (key hanya di memori)
    imAiModelChg() { if (this.im.ai.model.indexOf('w2x') !== 0 && +this.im.ai.out === 1) this.im.ai.out = 4; },
    imApiModel() { const p = this.im.api; return (p.models && p.models[p.prov]) || (IMG_AI_PROVIDERS.find(x => x.key === p.prov) || {}).model || ''; },
    async imAiApi() {
      const im = this.im, a = im.api, key = String(a.key || '').trim();
      if (!this.imCur) return;
      if (!key) { im.err = this.t('im_api_nokey'); return; }
      im.err = ''; im.busy = this.t('im_api_send'); this.imSavePrefs();
      try {
        const png = await this.imEncode(this.imCur, 'image/png', 100);
        const prompt = a.prompt || this.t('im_api_prompt_def'), model = this.imApiModel();
        let outBlob = null;
        if (a.prov === 'openai') {
          const fd = new FormData(); fd.append('model', model); fd.append('image', png, 'image.png'); fd.append('prompt', prompt); fd.append('size', 'auto'); fd.append('quality', 'high');
          const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd });
          const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || 'HTTP ' + r.status);
          outBlob = await (await fetch('data:image/png;base64,' + j.data[0].b64_json)).blob();
        } else if (a.prov === 'gemini') {
          const b64 = await this.imB64(png);
          const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/png', data: b64 } }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } }) });
          const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || 'HTTP ' + r.status);
          const part = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.find(p => p.inlineData || p.inline_data);
          if (!part) throw new Error(this.t('im_api_noimg'));
          const d = part.inlineData || part.inline_data;
          outBlob = await (await fetch('data:' + (d.mimeType || d.mime_type || 'image/png') + ';base64,' + d.data)).blob();
        } else if (a.prov === 'openrouter') {
          const b64 = await this.imB64(png);
          const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ model, modalities: ['image', 'text'], messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64 } }] }] }) });
          const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || 'HTTP ' + r.status);
          const imgs = (((j.choices || [])[0] || {}).message || {}).images || [];
          if (!imgs.length) throw new Error(this.t('im_api_noimg'));
          outBlob = await (await fetch(imgs[0].image_url.url)).blob();
        } else {
          const fd = new FormData(); fd.append('image', png, 'image.png'); fd.append('output_format', 'png');
          if (a.prov === 'stab_cons') fd.append('prompt', prompt);
          const r = await fetch('https://api.stability.ai/v2beta/stable-image/upscale/' + (a.prov === 'stab_cons' ? 'conservative' : 'fast'), { method: 'POST', headers: { Authorization: 'Bearer ' + key, Accept: 'image/*' }, body: fd });
          if (!r.ok) { let msg = 'HTTP ' + r.status; try { const j = await r.json(); msg = (j.errors && j.errors.join('; ')) || j.message || msg; } catch (e) { /* abaikan */ } throw new Error(msg); }
          outBlob = await r.blob();
        }
        const bmp = await createImageBitmap(outBlob), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0);
        this.imSetCur(c, this.t('im_api_ok').replace('{w}', c.width).replace('{h}', c.height));
        im.aiGen = a.prov.indexOf('stab') !== 0;
      } catch (e) { im.err = this.t('im_api_fail') + ' ' + (e.message || e) + (/Failed to fetch|NetworkError/i.test(String(e.message)) ? ' — ' + this.t('im_api_net') : ''); }
      im.busy = '';
    },
    imB64(blob) { return new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); }); },
    imFmtB(n) { return pupFmtBytes(n); },
    imFmtName(f) { return { 'image/jpeg': 'JPG', 'image/webp': 'WebP', 'image/avif': 'AVIF', 'image/png': 'PNG' }[f] || f; },
    // ---- Sheet Viewer
    svW() {
      if (this.svWorker) return this.svWorker;
      const url = URL.createObjectURL(new Blob(['(' + sheetWorkerMain.toString() + ')();'], { type: 'text/javascript' }));
      const w = this.svWorker = new Worker(url);
      w.onmessage = e => this.svOnMsg(e.data);
      w.onerror = e => { this.sv.err = String(e.message || e); this.sv.busy = ''; };
      return w;
    },
    svInit() {
      this.svRows = {}; this.svGRows = {}; this.svDRows = {}; this.svSeq = 0; this.svJump = null;
      window.addEventListener('message', e => {
        const d = e.data;
        if (!d || typeof d !== 'object' || e.origin !== 'https://docs.google.com' || !e.source) return;
        if (d.type === 'sheet-hello') { try { e.source.postMessage({ type: 'sheet-ready' }, e.origin); if (window.AppPipe) window.AppPipe.recordPostOut(e.origin, { type: 'sheet-ready' }, 'Sheet Hook'); } catch (err) { /* abaikan */ } this.visibleTabs.sheet = true; this.tab = 'sheet'; }
        if (d.type === 'sheet-file' && d.buf instanceof ArrayBuffer) {
          const name = String(d.name || 'sheet.xlsx').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
          this.svLoadFiles([new File([d.buf], /\.xlsx$/i.test(name) ? name : name + '.xlsx')]);
        }
      });
      if (location.hash === '#sheet-hook') { this.visibleTabs.sheet = true; this.tab = 'sheet'; try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* abaikan */ } }
      svRecentList().then(l => { this.sv.recent = l; }).catch(() => {});
    },
    onSvDrop(ev) { this.sv.over = false; this.svLoadFiles([...(ev.dataTransfer.files || [])]); },
    onSvPick(ev) { const f = [...(ev.target.files || [])]; ev.target.value = ''; this.svLoadFiles(f); },
    svLoadFiles(files) {
      files = files.filter(f => /\.(xlsx|xlsm|csv|tsv|txt)$/i.test(f.name));
      if (!files.length) { this.sv.err = this.t('sv_err_type'); return; }
      this.sv.err = '';
      files.forEach(f => {
        const id = 'b' + (++this.svSeq);
        this.sv.books.push({ id, name: f.name, size: f.size, sheets: [], loading: true, prog: '' });
        this.svW().postMessage({ op: 'load', id, file: f });
        svRecentPut(f).then(() => svRecentList()).then(l => { this.sv.recent = l; }).catch(() => {});
      });
    },
    svOpenRecent(r) { svRecentGet(r.id).then(f => { if (f) this.svLoadFiles([f]); }); },
    svForgetRecent(r) { svRecentDel(r.id).then(() => svRecentList()).then(l => { this.sv.recent = l; }); },
    svBook(id) { return this.sv.books.find(b => b.id === id); },
    svOnMsg(m) {
      const sv = this.sv;
      if (m.op === 'prog') { const b = this.svBook(m.id); if (b) b.prog = m.phase === 'strings' ? this.t('sv_p_strings') : this.t('sv_p_sheet').replace('{s}', m.sheet).replace('{i}', m.si + 1).replace('{n}', m.sn).replace('{r}', m.rows.toLocaleString()); return; }
      if (m.op === 'loaded') {
        const b = this.svBook(m.id); if (!b) return;
        Object.assign(b, { sheets: m.book.sheets, loading: false, prog: '', ms: m.ms });
        if (!sv.cur) this.svPick(m.id, Math.max(0, m.book.sheets.findIndex(s => s.rows && !s.hidden)));
        if (sv.q.trim()) this.svSearch();
        return;
      }
      if (m.op === 'error') { sv.err = m.msg === 'not-zip' ? this.t('sv_err_zip') : m.msg; const b = this.svBook(m.id); if (b && b.loading) sv.books.splice(sv.books.indexOf(b), 1); sv.busy = ''; return; }
      if (m.op === 'vprog') { if (m.req === this.svReq) sv.busy = this.t('sv_filtering') + ' ' + m.pct + '%'; return; }
      if (m.op === 'view') { if (m.req !== this.svReq) return; sv.total = m.total; sv.busy = ''; this.svRows = {}; sv.rowsVer++; this.svFetch(); if (this.svJump !== null) { this.svW().postMessage({ op: 'locate', vid: 'sheet', ri: this.svJump, req: m.req }); this.svJump = null; } if (sv.stats) this.svStats(sv.stats.c); return; }
      if (m.op === 'search') { if (m.req !== this.svSReq) return; sv.gtotal = m.total; sv.gper = m.per; sv.gbusy = false; this.svGRows = {}; sv.rowsVer++; this.svFetch(); return; }
      if (m.op === 'rows') { const cache = m.vid === 'global' ? this.svGRows : this.svRows; m.rows.forEach(r => { cache[r.i] = r; }); sv.rowsVer++; return; }
      if (m.op === 'locate') { if (m.pos >= 0) this.$nextTick(() => this.svScrollTo(m.pos)); return; }
      if (m.op === 'stats') { sv.stats = m; return; }
      if (m.op === 'dprog') { sv.dbusy = this.t('sv_comparing') + ' ' + m.pct + '%'; return; }
      if (m.op === 'diff') { sv.diff = m; sv.dbusy = ''; this.svDRows = {}; sv.rowsVer++; this.svFetch(); return; }
      if (m.op === 'drows') { m.rows.forEach(r => { this.svDRows[r.i] = r; }); sv.dtotal = m.total; sv.rowsVer++; return; }
      if (m.op === 'export') { const a = document.createElement('a'); a.href = URL.createObjectURL(m.blob); a.download = (this.svSheet ? this.svSheet.name : 'sheet') + '.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
    },
    svPick(book, sheet, jumpRi) {
      const sv = this.sv;
      sv.cur = { book, sheet }; sv.filters = {}; sv.sort = { c: -1, desc: false }; sv.stats = null; sv.mode = 'sheet';
      this.svJump = jumpRi === undefined ? null : jumpRi;
      const el = this.$refs.svScroll; if (el) el.scrollTop = 0; sv.scroll = 0;
      this.svBuild();
    },
    svBuild() {
      const sv = this.sv; if (!sv.cur) return;
      this.svReq = (this.svReq || 0) + 1; sv.busy = this.t('sv_filtering');
      const filters = Object.keys(sv.filters).map(c => ({ c: +c, v: String(sv.filters[c] || '') }));
      this.svW().postMessage({ op: 'view', vid: 'sheet', req: this.svReq, book: sv.cur.book, sheet: sv.cur.sheet, header: sv.header, filters, sort: { c: sv.sort.c, desc: sv.sort.desc }, q: sv.inq });
    },
    svBuildSoon() { clearTimeout(this.svT); this.svT = setTimeout(() => this.svBuild(), 350); },
    svSearch() {
      const sv = this.sv;
      clearTimeout(this.svST);
      this.svST = setTimeout(() => {
        if (!sv.q.trim()) { sv.gtotal = 0; sv.gper = []; if (sv.mode === 'global') sv.mode = 'sheet'; return; }
        this.svSReq = (this.svSReq || 0) + 1; sv.gbusy = true; sv.mode = 'global';
        const el = this.$refs.svScroll; if (el) el.scrollTop = 0; sv.scroll = 0;
        this.svW().postMessage({ op: 'search', req: this.svSReq, q: sv.q, book: sv.gbook });
      }, 300);
    },
    svSortBy(c) { const s = this.sv.sort; if (s.c === c) { if (s.desc) this.sv.sort = { c: -1, desc: false }; else s.desc = true; } else this.sv.sort = { c, desc: false }; this.svBuild(); },
    svStats(c) { this.svW().postMessage({ op: 'stats', vid: 'sheet', c, req: 0 }); },
    svFilterVal(c, v) { this.sv.filters[c] = '=' + v; this.svBuild(); },
    svOnScroll(ev) { this.sv.scroll = ev.target.scrollTop; this.sv.scrollX = ev.target.scrollLeft; if (!this.svRaf) this.svRaf = requestAnimationFrame(() => { this.svRaf = 0; this.svFetch(); }); },
    svFetch() {
      const sv = this.sv, w = this.svWin;
      if (!w.total) return;
      const vid = sv.mode === 'global' ? 'global' : sv.mode === 'diff' ? 'diff' : 'sheet';
      const cache = vid === 'global' ? this.svGRows : vid === 'diff' ? this.svDRows : this.svRows;
      const a = Math.max(0, w.start - 40), b = Math.min(w.total, w.start + w.vis + 80);
      let need = false; for (let i = w.start; i < Math.min(w.total, w.start + w.vis); i++) if (!cache[i]) { need = true; break; }
      if (!need) return;
      if (Object.keys(cache).length > 4000) { Object.keys(cache).forEach(k => { if (k < a || k >= b) delete cache[k]; }); }
      if (vid === 'diff') this.svW().postMessage({ op: 'drows', start: a, end: b, only: sv.donly, req: 0 });
      else this.svW().postMessage({ op: 'rows', vid, start: a, end: b, req: 0 });
    },
    svScrollTo(pos) {
      const el = this.$refs.svScroll, w = this.svWin; if (!el) return;
      const H = w.H, viewH = el.clientHeight;
      el.scrollTop = w.scaled ? (pos / Math.max(1, w.total - w.vis)) * Math.max(1, H - viewH) : pos * 28;
      this.sv.hl = pos;
    },
    svOpenHit(r) { this.sv.q = ''; this.sv.gtotal = 0; this.sv.mode = 'sheet'; this.sv.inq = ''; this.svPick(r.book, r.sheet, r.ri); },
    svCloseBook(b) {
      this.svW().postMessage({ op: 'drop', id: b.id });
      this.sv.books.splice(this.sv.books.indexOf(b), 1);
      if (this.sv.cur && this.sv.cur.book === b.id) { this.sv.cur = null; this.sv.total = 0; const n = this.sv.books.find(x => !x.loading); if (n) this.svPick(n.id, 0); }
      if (this.sv.q.trim()) this.svSearch();
    },
    svExport() { this.svW().postMessage({ op: 'export', vid: 'sheet', header: this.sv.header, req: 0 }); },
    svRunDiff() {
      const d = this.sv.dcfg;
      if (!d.a || !d.b) return;
      const [ab, as] = d.a.split(':'), [bb, bs] = d.b.split(':');
      this.sv.mode = 'diff'; this.sv.diff = null; this.sv.dbusy = this.t('sv_comparing'); this.sv.donly = '';
      const el = this.$refs.svScroll; if (el) el.scrollTop = 0; this.sv.scroll = 0;
      this.svW().postMessage({ op: 'diff', req: 1, a: { book: ab, sheet: +as }, b: { book: bb, sheet: +bs }, keys: [...d.keys], header: this.sv.header, ignoreCase: d.ic });
    },
    svDiffOnly(t) { this.sv.donly = this.sv.donly === t ? '' : t; this.svDRows = {}; this.sv.dtotal = this.sv.donly ? this.sv.diff[this.sv.donly] : this.sv.diff.total; const el = this.$refs.svScroll; if (el) el.scrollTop = 0; this.sv.scroll = 0; this.sv.rowsVer++; this.$nextTick(() => this.svFetch()); },
    svColName(i) { let s = '', n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; },
    svFmtN(n) { return n === null || n === undefined ? '—' : (Math.round(n * 100) / 100).toLocaleString(); },
    svOpenSheetHits(p) { const q = this.sv.q; this.sv.q = ''; this.sv.gtotal = 0; this.sv.inq = q; this.svPick(p.book, p.sheet); },
    // ---- Shopee Hook
    shpInit() {
      this.shpLoad();
      try { this.shpBc = new BroadcastChannel('scaShopee'); this.shpBc.onmessage = () => { this.shpLoad(); }; } catch (e) { this.shpBc = null; }
      window.addEventListener('message', e => { this.shpOnMessage(e); });
      if (location.hash === '#shp-hook') { this.visibleTabs.shop = true; this.tab = 'shop'; try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* abaikan */ } }
    },
    shpOnMessage(e) {
      const d = e.data;
      if (!d || typeof d !== 'object' || !SHP_ORIGIN.test(e.origin || '') || !e.source) return;
      if (d.type === 'shp-hello') { try { e.source.postMessage({ type: 'shp-ack' }, e.origin); if (window.AppPipe) window.AppPipe.recordPostOut(e.origin, { type: 'shp-ack' }, 'Shopee Hook'); } catch (err) { /* tab ditutup */ } if (this.tab !== 'shop') { this.visibleTabs.shop = true; this.tab = 'shop'; } return; }
      if (d.type === 'shp-items' && Array.isArray(d.items)) {
        const list = d.items.slice(0, 2000).map(shpClean).filter(Boolean);
        if (!list.length) return;
        shpPutMany(list).then(() => this.shpLoad()).then(() => {
          this.shp.msg = this.t('shp_got').replace('{n}', list.length);
          try { e.source.postMessage({ type: 'shp-saved', total: this.shp.list.length }, e.origin); if (window.AppPipe) window.AppPipe.recordPostOut(e.origin, { type: 'shp-saved', total: this.shp.list.length }, 'Shopee Hook'); } catch (err) { /* abaikan */ }
          try { if (this.shpBc) this.shpBc.postMessage('changed'); } catch (err) { /* abaikan */ }
        }).catch(err => { this.shp.err = String(err.message || err); });
      }
    },
    shpLoad() { return shpAll().then(list => { this.shp.list = Vue.markRaw(list); }).catch(err => { this.shp.err = String(err.message || err); }); },
    shpImportText(txt) {
      let data;
      try { data = JSON.parse(txt); } catch (e) { this.shp.err = this.t('shp_bad_json'); return; }
      const arr = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : []);
      const list = arr.slice(0, 20000).map(shpClean).filter(Boolean);
      if (!list.length) { this.shp.err = this.t('shp_bad_json'); return; }
      this.shp.err = '';
      shpPutMany(list).then(() => this.shpLoad()).then(() => { this.shp.msg = this.t('shp_got').replace('{n}', list.length); this.shp.paste = ''; try { if (this.shpBc) this.shpBc.postMessage('changed'); } catch (e) { /* abaikan */ } });
    },
    shpImportFile(ev) { const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (f) f.text().then(t => this.shpImportText(t)); },
    shpDelete() {
      const ids = this.shpFilterOn ? this.shpRows.map(r => r.id) : null;
      if (!confirm(this.t('shp_del_confirm').replace('{n}', ids ? ids.length : this.shp.list.length))) return;
      shpClear(ids).then(() => this.shpLoad()).then(() => { try { if (this.shpBc) this.shpBc.postMessage('changed'); } catch (e) { /* abaikan */ } });
    },
    shpSort(k) { if (this.shp.sort === k) this.shp.desc = !this.shp.desc; else { this.shp.sort = k; this.shp.desc = k !== 'name' && k !== 'loc' && k !== 'q'; } },
    shpRp(v) { return v === null || v === undefined ? '—' : 'Rp' + Math.round(v).toLocaleString('id-ID'); },
    shpTime(t) { return t ? new Date(t).toLocaleString(LANG === 'en' ? 'en-GB' : 'id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; },
    shpExport() {
      const head = [this.t('shp_c_name'), 'Shop', this.t('shp_c_price'), this.t('shp_c_sold'), 'Rating', 'Rating count', 'Mall', 'Star+', 'Star', this.t('shp_c_loc'), this.t('shp_c_score'), this.t('shp_c_tips'), this.t('shp_c_kw'), 'URL'];
      const rows = this.shpRows.map(r => [r.name, r.shop, r.price, r.sold, r.rating, r.ratingCount, r.mall ? 1 : 0, r.starPlus ? 1 : 0, r.star ? 1 : 0, r.loc, r.score, r.tipsShort, r.q, r.url]);
      pupDownload('shopee-hook.csv', '\ufeff' + glCsv([head].concat(rows)), 'text/csv');
    },
    // ---- WA Hook
    waInit() {
      this.waLoad();
      try { this.waBc = new BroadcastChannel('scaWaHook'); this.waBc.onmessage = () => { this.waLoad(); }; } catch (e) { this.waBc = null; }
      window.addEventListener('message', e => { this.waOnMessage(e); });
      if (location.hash === '#wa-hook') { this.visibleTabs.wa = true; this.tab = 'wa'; try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* abaikan */ } }
    },
    waOnMessage(e) {
      const d = e.data;
      if (!d || typeof d !== 'object' || !WA_ORIGIN.test(e.origin || '') || !e.source) return;
      if (d.type === 'wa-hello') {
        try { e.source.postMessage({ type: 'wa-ack' }, e.origin); if (window.AppPipe) window.AppPipe.recordPostOut(e.origin, { type: 'wa-ack' }, 'WA Hook'); } catch (err) { /* tab ditutup */ }
        if (this.tab !== 'wa') { this.visibleTabs.wa = true; this.tab = 'wa'; }
        return;
      }
      if (d.type === 'wa-items' && Array.isArray(d.items)) {
        const list = d.items.slice(0, 5000).map(waClean).filter(Boolean);
        if (!list.length) return;
        waPutMany(list).then(() => this.waLoad()).then(() => {
          this.wa.msg = this.t('wa_got').replace('{n}', list.length);
          try { e.source.postMessage({ type: 'wa-saved', total: this.wa.list.length }, e.origin); if (window.AppPipe) window.AppPipe.recordPostOut(e.origin, { type: 'wa-saved', total: this.wa.list.length }, 'WA Hook'); } catch (err) { /* abaikan */ }
          try { if (this.waBc) this.waBc.postMessage('changed'); } catch (err) { /* abaikan */ }
        }).catch(err => { this.wa.err = String(err.message || err); });
      }
    },
    waLoad() {
      return waAll().then(list => {
        const dirty = [];
        const cleaned = (list || []).map(item => {
          const c = waClean(item);
          if (c && item && (c.ts !== item.ts || c.timeText !== item.timeText)) dirty.push(c);
          return c;
        }).filter(Boolean);
        if (dirty.length) {
          waPutMany(dirty).catch(() => {});
        }
        this.wa.list = Vue.markRaw(cleaned);
      }).catch(err => { this.wa.err = String(err.message || err); });
    },
    copyWaScript() {
      navigator.clipboard.writeText(this.waScript).catch(() => {});
    },
    waImportText(txt) {
      let data;
      try { data = JSON.parse(txt); } catch (e) { this.wa.err = this.t('wa_bad_json'); return; }
      const arr = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : (data && data.indexedDB && Array.isArray(data.indexedDB.wa) ? data.indexedDB.wa : []));
      const list = arr.slice(0, 50000).map(waClean).filter(Boolean);
      if (!list.length) { this.wa.err = this.t('wa_bad_json'); return; }
      this.wa.err = '';
      waPutMany(list).then(() => this.waLoad()).then(() => {
        this.wa.msg = this.t('wa_got').replace('{n}', list.length);
        this.wa.paste = '';
        try { if (this.waBc) this.waBc.postMessage('changed'); } catch (e) { /* abaikan */ }
      });
    },
    waImportFile(ev) {
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (f) f.text().then(t => this.waImportText(t));
    },
    waDeleteOne(id) {
      waClear([id]).then(() => this.waLoad()).then(() => { try { if (this.waBc) this.waBc.postMessage('changed'); } catch (e) { /* abaikan */ } });
    },
    waDelete() {
      const ids = this.waFilterOn ? this.waFiltered.map(r => r.id) : null;
      const cnt = ids ? ids.length : this.wa.list.length;
      if (!cnt || !confirm(this.t('wa_del_confirm').replace('{n}', cnt))) return;
      waClear(ids).then(() => this.waLoad()).then(() => { try { if (this.waBc) this.waBc.postMessage('changed'); } catch (e) { /* abaikan */ } });
    },
    waCopyRow(r) {
      const parts = ['[' + this.waTime(r) + '] ' + r.chat + ' — ' + (r.sender || (r.dir === 'out' ? this.t('wa_me') : r.chat))];
      if (r.quote) parts.push('> ' + r.quote);
      if (r.text) parts.push(r.text);
      if (r.docs && r.docs.length) parts.push('Dokumen: ' + r.docs.join(', '));
      if (r.links && r.links.length) parts.push('Link: ' + r.links.join(' '));
      navigator.clipboard.writeText(parts.join('\n')).catch(() => {});
    },
    waTime(r) {
      let t = r.ts || r.seen;
      const nowLimit = Date.now() + 43200000;
      if (t && t > nowLimit) {
        const d = new Date(t);
        const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
        if (day >= 1 && day <= 12 && m >= 1 && m <= 31) {
          const sw = new Date(y, day - 1, m, d.getHours(), d.getMinutes(), d.getSeconds());
          if (sw.getTime() <= nowLimit) t = sw.getTime();
          else t = r.seen || Date.now();
        } else {
          t = r.seen || Date.now();
        }
      }
      if (!t) return r.timeText || '—';
      return new Date(t).toLocaleString(LANG === 'en' ? 'en-GB' : 'id-ID', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    },
    waExportCsv() {
      const head = [this.t('wa_c_time'), this.t('wa_c_chat'), 'Group', this.t('wa_c_sender'), 'Dir', this.t('wa_c_msg'), 'Quote', 'Documents', 'Links', 'Media'];
      const rows = this.waRows.map(r => [
        r.timeText || this.waTime(r), r.chat, r.isGroup ? 1 : 0,
        r.sender || (r.dir === 'out' ? this.t('wa_me') : r.chat), r.dir,
        r.text, r.quote, (r.docs || []).join('; '), (r.links || []).join(' '), r.media
      ]);
      pupDownload('wa-hook-' + new Date().toISOString().slice(0, 10) + '.csv', '\ufeff' + glCsv([head].concat(rows)), 'text/csv');
    },
    waExportJson() {
      pupDownload('wa-hook-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ type: 'wa-export', exportedAt: new Date().toISOString(), items: this.waRows }, null, 2), 'application/json');
    },
    // ---- Jam Dunia
    clkInit() {
      try { const j = JSON.parse(localStorage.getItem(CLK_KEY) || 'null'); if (j && Array.isArray(j.pins)) this.clock.pins = j.pins.filter(p => p && (p.fixed != null || (p.tz && clkValid(p.tz)))).slice(0, 40); } catch (e) { /* abaikan */ }
      if (!this.clkTimer) this.clkTimer = setInterval(() => { if (this.tab === 'clock' && this.clock.live) this.clock.now = Date.now(); }, 1000);
    },
    clkDrawSoon() {
      if (this.clkRaf) return;
      this.clkRaf = requestAnimationFrame(() => { this.clkRaf = 0; this.clkDrawMapNow(); });
    },
    clkDrawMapNow() {
      const c = this.$refs.clkMap;
      if (!c || this.tab !== 'clock') return;
      const ms = this.clkMs, z = n => String(n).padStart(2, '0'), hm = it => { const w = clkWall(it, ms); return z(w.h) + ':' + z(w.mi); };
      const marks = [];
      this.clock.pins.forEach(p => {
        if (p.fixed != null) marks.push({ lon: Math.max(-179, Math.min(179, p.fixed / 4)), line: true, color: '#f59e0b', text: p.label + ' ' + hm(p) });
        else { const ll = clkCoord(p.tz); if (ll) marks.push({ lat: ll[0], lon: ll[1], color: '#f59e0b', text: p.label + ' ' + hm(p) }); }
      });
      const mine = { tz: this.clkMineTz }, me = clkCoord(this.clkMineTz);
      if (me) marks.push({ lat: me[0], lon: me[1], color: '#38bdf8', me: true, text: tr('clk_map_me') + ' ' + hm(mine) });
      else marks.push({ lon: Math.max(-179, Math.min(179, clkWall(mine, ms).off / 4)), line: true, me: true, color: '#38bdf8', text: tr('clk_map_me') + ' ' + hm(mine) });
      clkDrawMap(c, ms, marks);
    },
    clkSave() { try { localStorage.setItem(CLK_KEY, JSON.stringify({ pins: this.clock.pins })); } catch (e) { /* abaikan */ } },
    clkDur(min) {
      const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
      return [h ? tr('clk_h').replace('{n}', h) : '', m ? tr('clk_m').replace('{n}', m) : ''].filter(Boolean).join(' ');
    },
    clkView(item) {
      const ms = this.clkMs, w = clkWall(item, ms), me = clkWall({ tz: this.clkMineTz }, ms), z = n => String(n).padStart(2, '0');
      const loc = LANG === 'en' ? 'en-GB' : 'id-ID';
      let date = '', abbr = '';
      try { date = new Intl.DateTimeFormat(loc, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(w.dms)); } catch (e) { date = w.y + '-' + z(w.mo + 1) + '-' + z(w.d); }
      if (item.tz) {
        try { const pt = new Intl.DateTimeFormat(loc, { timeZone: item.tz, timeZoneName: 'short' }).formatToParts(new Date(ms)).find(x => x.type === 'timeZoneName'); if (pt && !/^(GMT|UTC)/.test(pt.value)) abbr = pt.value; } catch (e) { /* abaikan */ }
      }
      const dm = w.off - me.off, dd = Math.round((Date.UTC(w.y, w.mo, w.d) - Date.UTC(me.y, me.mo, me.d)) / 86400000);
      return {
        label: item.label, sub: item.sub || item.tz || '', offStr: clkOffStr(w.off), off: w.off, dm, abbr,
        time: z(w.h) + ':' + z(w.mi) + (this.clock.live ? ':' + z(w.s) : ''), date,
        icon: w.h >= 6 && w.h < 18 ? '☀️' : w.h >= 18 && w.h < 21 ? '🌆' : '🌙',
        diffTxt: !dm ? tr('clk_same') : tr(dm > 0 ? 'clk_ahead' : 'clk_behind').replace('{d}', this.clkDur(dm)),
        dayTxt: dd === 1 ? tr('clk_tomorrow') : dd === -1 ? tr('clk_yesterday') : dd > 1 ? tr('clk_dplus').replace('{n}', dd) : dd < -1 ? tr('clk_dminus').replace('{n}', -dd) : ''
      };
    },
    clkOffStrOf(p) { return clkOffStr(clkOff(p, this.clkMs)); },
    clkSetAt(v) { const ms = clkFromWall(this.clkBaseItem, v); if (ms != null && isFinite(ms)) { this.clock.fixedMs = ms; this.clock.live = false; } },
    clkSetBase(v) { if (this.clock.live) this.clock.fixedMs = this.clock.now; this.clock.base = v; },
    clkRel(ms) {
      const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      const parts = [];
      if (d) parts.push(tr('clk_d').replace('{n}', d));
      if (h) parts.push(tr('clk_h').replace('{n}', h));
      if (m && d < 30) parts.push(tr('clk_m').replace('{n}', m));
      if (!d && !h) parts.push(tr('clk_s').replace('{n}', sec));
      return parts.slice(0, 3).join(' ');
    },
    clkUseMs(ms) { this.clock.fixedMs = ms; this.clock.live = false; },
    clkTsApply() { const r = this.clkTs.rows; if (r.length) this.clkUseMs(r[0].ms); },
    clkCopy(v) { navigator.clipboard.writeText(v).then(() => { this.clock.copied = true; setTimeout(() => { this.clock.copied = false; }, 1200); }); },
    clkLive() { this.clock.live = true; this.clock.fixedMs = null; this.clock.now = Date.now(); },
    clkPin(it) {
      if (this.clock.pins.some(p => p.label === it.label && p.tz === it.tz && p.fixed === it.fixed)) return;
      const p = { label: it.label, sub: it.sub || it.tz || '' };
      if (it.fixed != null) p.fixed = it.fixed; else p.tz = it.tz;
      this.clock.pins.push(p); this.clkSave();
    },
    clkUnpin(i) { this.clock.base = 'mine'; this.clock.pins.splice(i, 1); this.clkSave(); },
    clkMove(i, d) {
      const j = i + d, a = this.clock.pins;
      if (j < 0 || j >= a.length) return;
      const x = a[i]; a.splice(i, 1); a.splice(j, 0, x);
      this.clock.base = 'mine'; this.clkSave();
    },
    clkPickHour(h) { this.clock.fixedMs = this.clkDayStart + h * 3600000; this.clock.live = false; },
    // ---- Multi Ping
    pingInit() {
      this.pingHist = {}; this.pingStatCache = { tick: -1, map: {} }; this.pingAudio = null; this.pingRaf = 0; this.pingSaveT = 0; this.pingHistAt = Date.now();
      try {
        const j = JSON.parse(localStorage.getItem(PING_KEY) || 'null');
        if (j && Array.isArray(j.targets)) {
          this.ping.targets = j.targets.filter(x => x && x.url).map(x => this.pingNewTarget(x));
          ['sound', 'alarmDown', 'notif', 'running'].forEach(k => { if (typeof j[k] === 'boolean') this.ping[k] = j[k]; });
          if (j.collapsed && typeof j.collapsed === 'object') this.ping.collapsed = j.collapsed;
        }
      } catch (e) { /* simpanan rusak: mulai kosong */ }
      try {
        const h = JSON.parse(localStorage.getItem(PING_HIST_KEY) || 'null') || {};
        Object.keys(h).forEach(id => { if (Array.isArray(h[id])) this.pingHist[id] = h[id].map(a => ({ t: a[0], ms: a[1], ok: !!a[2], code: a[3] })); });
      } catch (e) { /* abaikan */ }
      // Riwayat lama (<= v1.33) target http di halaman https isinya cek yang diblokir browser, bukan data server: buang.
      if (location.protocol === 'https:') this.ping.targets.forEach(x => { const h = this.pingHist[x.id]; if (/^http:/i.test(x.url) && h && h.every(e => !e.ok && e.ms == null)) delete this.pingHist[x.id]; });
      if (this.ping.notif && !(window.Notification && Notification.permission === 'granted')) this.ping.notif = false;
      if (!this.pingTick) {
        this.pingTick = pingTicker(() => this.pingOnTick());
        window.addEventListener('beforeunload', () => { this.pingSaveHist(); });
      }
    },
    pingNewTarget(o) {
      const num = (v, a, b, d) => { v = Number(v); return isFinite(v) && v > 0 ? Math.min(b, Math.max(a, Math.round(v))) : d; };
      return {
        id: o.id || pingId(), name: String(o.name || o.url).slice(0, 120), url: String(o.url), group: String(o.group || '').slice(0, 60),
        interval: num(o.interval, 2, 3600, 10), timeout: num(o.timeout, 1000, 60000, 5000),
        expect: ['any', 'lt500', '2xx'].indexOf(o.expect) >= 0 ? o.expect : 'any', method: o.method === 'HEAD' ? 'HEAD' : 'GET',
        enabled: o.enabled !== false, alarmUp: !!o.alarmUp, status: 'wait', ms: o.ms != null ? o.ms : null, code: o.code != null ? o.code : null,
        kind: '', note: '', lastAt: o.lastAt || 0, since: 0, fails: 0, events: Array.isArray(o.events) ? o.events.slice(-50) : [], nextAt: 0, busy: false, cors: undefined
      };
    },
    pingSave() {
      clearTimeout(this.pingSaveT);
      this.pingSaveT = setTimeout(() => {
        const keep = ['id', 'name', 'url', 'group', 'interval', 'timeout', 'expect', 'method', 'enabled', 'alarmUp', 'ms', 'code', 'lastAt', 'events'];
        const p = this.ping, data = { targets: p.targets.map(x => { const o = {}; keep.forEach(k => { o[k] = x[k]; }); return o; }), sound: p.sound, alarmDown: p.alarmDown, notif: p.notif, running: p.running, collapsed: p.collapsed };
        try { localStorage.setItem(PING_KEY, JSON.stringify(data)); } catch (e) { this.ping.err = String(e.message || e); }
      }, 400);
    },
    pingSaveHist() {
      const pack = n => { const o = {}; this.ping.targets.forEach(x => { const h = this.pingHist[x.id]; if (h && h.length) o[x.id] = h.slice(-n).map(a => [a.t, a.ms, a.ok ? 1 : 0, a.code]); }); return JSON.stringify(o); };
      try { localStorage.setItem(PING_HIST_KEY, pack(PING_KEEP)); } catch (e) { try { localStorage.setItem(PING_HIST_KEY, pack(40)); } catch (e2) { /* penuh: lewati */ } }
      this.pingHistAt = Date.now();
    },
    pingOnTick() {
      const now = Date.now(), p = this.ping;
      if (this.tab === 'ping') p.now = now;
      if (p.running) p.targets.forEach(x => { if (x.enabled && !x.busy && now >= x.nextAt) this.pingRun(x); });
      const a = p.alarm;
      if (a) {
        // bunyi terus tiap 8 dtk sampai user klik Matikan alarm (atau targetnya berubah status lagi)
        if (p.sound && now >= a.next) { this.pingEnsureAudio(); pingBeep(this.pingAudio, a.kind); a.next = now + 8000; }
        document.title = (document.title.indexOf('🔔 ') === 0 ? '' : '🔔 ') + document.title.replace(/^🔔 /, '');
      }
      if (now - this.pingHistAt > 30000) this.pingSaveHist();
    },
    async testPingHttpPerm() {
      const p = this.ping;
      if (p.mixedTesting) return;
      p.mixedTesting = true;
      try {
        const ok = await pingMixedTest();
        const was = p.mixedOk;
        p.mixedOk = ok;
        if (ok) {
          if (was !== true) p.targets.forEach(x => { if (x.status === 'blocked') x.nextAt = 0; });
          this.showToast('✓ ' + this.t('pingTestHttpOk'));
        } else {
          this.showToast(this.t('pingTestHttpBlocked'), true);
        }
      } finally {
        p.mixedTesting = false;
      }
    },
    async pingRun(x) {
      if (x.busy) return;
      x.busy = true;
      x.nextAt = Date.now() + x.interval * 1000;
      let r;
      try { r = await pingProbe(x, this.ping.mixedOk === true); } catch (e) { r = { ok: false, ms: null, code: null, kind: 'error', note: String(e.message || e) }; }
      x.busy = false;
      if (!this.ping.targets.includes(x)) return;
      const now = Date.now();
      if (r.cors !== undefined) x.cors = r.cors;
      // BLOCKED = browser menolak sebelum request dikirim: bukan data server, tidak masuk riwayat/uptime.
      if (!r.blocked) {
        const h = this.pingHist[x.id] || (this.pingHist[x.id] = []);
        h.push({ t: now, ms: r.ms, ok: r.ok, code: r.code });
        if (h.length > PING_MAX) h.splice(0, h.length - PING_MAX);
      }
      x.ms = r.ms; x.code = r.code; x.kind = r.kind; x.note = r.note || (r.kind === 'opaque' ? 'opaque' : ''); x.lastAt = now;
      x.fails = r.ok || r.blocked ? 0 : x.fails + 1;
      const to = r.blocked ? 'blocked' : r.ok ? 'up' : 'down', from = x.status;
      if (to !== from) {
        x.events.push({ t: now, from, to, note: r.ok ? (r.code != null ? 'HTTP ' + r.code + ' · ' : '') + r.ms + ' ms' : this.pingNoteText(x) });
        if (x.events.length > 50) x.events.splice(0, x.events.length - 50);
        x.since = now; x.status = to;
        this.pingAlarmDrop(x, to);
        if (from === 'down' && to === 'up' && x.alarmUp) this.pingFire('up', x);
        if (from === 'up' && to === 'down' && this.ping.alarmDown) this.pingFire('down', x);
        this.pingSave();
      } else if (!x.since) x.since = now;
      this.ping.tick++;
    },
    pingFire(kind, x) {
      const a = this.ping.alarm;
      if (a && a.kind === kind) { if (a.ids.indexOf(x.id) < 0) { a.ids.push(x.id); a.names.push(x.name); } a.at = Date.now(); }
      else this.ping.alarm = { kind, ids: [x.id], names: [x.name], at: Date.now(), next: 0 };
      try {
        if (this.ping.notif && window.Notification && Notification.permission === 'granted') new Notification((kind === 'up' ? '🟢 ' + tr('ping_alarm_up') : '🔴 ' + tr('ping_alarm_down')) + ' ' + x.name, { body: x.url });
      } catch (e) { /* abaikan */ }
    },
    // Alarm "nyala" berhenti sendiri bila target itu mati lagi; alarm "mati" berhenti bila target nyala lagi.
    pingAlarmDrop(x, to) {
      const a = this.ping.alarm;
      if (!a) return;
      const i = a.ids.indexOf(x.id);
      if (i < 0 || (a.kind === 'up' ? to === 'up' : to !== 'up')) return;
      a.ids.splice(i, 1); a.names.splice(i, 1);
      if (!a.ids.length) this.pingStopAlarm();
    },
    async pingDownloadLocal() {
      this.ping.dlBusy = true; this.ping.err = '';
      try {
        pupDownload('scanner-security-lokal.html', await pingLocalHtml(), 'text/html');
        this.ping.msg = tr('ping_dl_done');
      } catch (e) { this.ping.err = tr('ping_dl_fail') + ' ' + (e.message || e); }
      finally { this.ping.dlBusy = false; }
    },
    pingStopAlarm() { this.ping.alarm = null; document.title = document.title.replace(/^🔔 /, ''); },
    pingEnsureAudio() {
      try {
        if (!this.pingAudio) { const C = window.AudioContext || window.webkitAudioContext; if (C) this.pingAudio = new C(); }
        if (this.pingAudio && this.pingAudio.state === 'suspended') this.pingAudio.resume();
      } catch (e) { /* tanpa suara */ }
    },
    pingTestSound() { this.pingEnsureAudio(); pingBeep(this.pingAudio, 'up'); },
    pingNotifToggle() {
      if (!this.ping.notif) { this.pingSave(); return; }
      if (!window.Notification) { this.ping.notif = false; this.ping.err = tr('ping_notif_denied'); return; }
      Notification.requestPermission().then(r => { if (r !== 'granted') { this.ping.notif = false; this.ping.err = tr('ping_notif_denied'); } this.pingSave(); });
    },
    pingSetRunning(v) { this.ping.running = v; if (v) this.ping.targets.forEach(x => { x.nextAt = 0; }); this.pingSave(); },
    pingCheckAll(key) { this.ping.targets.filter(x => key === undefined || x.group === key).forEach(x => this.pingRun(x)); },
    pingGroupEnable(key, v) { this.ping.targets.forEach(x => { if (x.group === key) { x.enabled = v; if (v) x.nextAt = 0; } }); this.pingSave(); },
    pingToggleGroup(name) { this.ping.collapsed[name] = !this.ping.collapsed[name]; this.pingSave(); },
    pingSubmit() {
      const f = this.ping.form, url = pingNormUrl(f.url);
      this.ping.err = ''; this.ping.msg = '';
      if (!url) { this.ping.err = tr('ping_bad_url'); return; }
      let host = url;
      try { host = new URL(url).host; } catch (e) { /* abaikan */ }
      const base = { name: f.name.trim() || host, url, group: f.group.trim(), interval: f.interval, timeout: f.timeout, expect: f.expect, method: f.method };
      const ed = this.ping.targets.find(x => x.id === this.ping.editId);
      if (ed) {
        const n = this.pingNewTarget(Object.assign({}, base, { id: ed.id, enabled: ed.enabled, alarmUp: ed.alarmUp }));
        ['name', 'url', 'group', 'interval', 'timeout', 'expect', 'method'].forEach(k => { ed[k] = n[k]; });
        ed.cors = undefined; ed.nextAt = 0;
      } else this.ping.targets.push(this.pingNewTarget(base));
      this.ping.editId = null;
      Object.assign(f, { name: '', url: '' });
      this.pingSave();
    },
    pingEdit(x) {
      this.ping.editId = x.id;
      Object.assign(this.ping.form, { name: x.name, url: x.url, group: x.group, interval: x.interval, timeout: x.timeout, expect: x.expect, method: x.method });
      this.$nextTick(() => { const b = this.$refs.pingFormBox; if (b) { b.open = true; b.scrollIntoView({ block: 'start', behavior: 'smooth' }); } });
    },
    pingCancelEdit() { this.ping.editId = null; Object.assign(this.ping.form, { name: '', url: '' }); },
    pingDelete(x) {
      if (!confirm(tr('ping_confirm_del').replace('{n}', x.name))) return;
      this.ping.targets = this.ping.targets.filter(y => y.id !== x.id);
      this.pingAlarmDrop(x, this.ping.alarm && this.ping.alarm.kind === 'up' ? 'down' : 'up');
      delete this.pingHist[x.id];
      if (this.ping.selId === x.id) this.ping.selId = null;
      this.pingSave(); this.pingSaveHist();
    },
    pingClearAll() {
      if (!confirm(tr('ping_confirm_all').replace('{n}', this.ping.targets.length))) return;
      this.ping.targets = []; this.pingHist = {}; this.ping.selId = null; this.ping.alarm = null;
      this.pingSave(); this.pingSaveHist();
    },
    pingToggle(x) {
      x.enabled = !x.enabled;
      if (x.enabled) { x.nextAt = 0; x.status = 'wait'; } else this.pingAlarmDrop(x, this.ping.alarm && this.ping.alarm.kind === 'up' ? 'down' : 'up');
      this.pingSave();
    },
    pingToggleBell(x) { x.alarmUp = !x.alarmUp; this.pingEnsureAudio(); this.pingSave(); },
    pingSelect(id) { this.ping.selId = this.ping.selId === id ? null : id; },
    pingClearHist(x) { this.pingHist[x.id] = []; x.events = []; this.ping.tick++; this.pingSave(); this.pingSaveHist(); },
    pingAddList(list) {
      const have = new Set(this.ping.targets.map(x => x.url + '|' + x.group));
      let n = 0, skip = 0;
      list.forEach(o => {
        const k = o.url + '|' + (o.group || '');
        if (have.has(k)) { skip++; return; }
        have.add(k); this.ping.targets.push(this.pingNewTarget(o)); n++;
      });
      this.ping.msg = tr('ping_added').replace('{n}', n) + (skip ? ' ' + tr('ping_skipped').replace('{n}', skip) : '');
      this.pingSave();
      return n;
    },
    pingAddBulk() {
      this.ping.err = '';
      const lines = this.ping.bulk.split(/\r?\n/).filter(l => l.trim() && l.trim().charAt(0) !== '#').length;
      const list = pingParseBulk(this.ping.bulk, this.ping.bulkGroup.trim(), this.ping.bulkInterval || 10);
      const n = this.pingAddList(list);
      if (lines - list.length > 0) this.ping.msg += ' ' + tr('ping_skipped').replace('{n}', lines - list.length);
      if (n) this.ping.bulk = '';
    },
    pingAddSamples() {
      this.pingAddList([
        { name: 'Google', url: 'https://www.google.com/generate_204', group: 'Internet', interval: 10 },
        { name: 'Cloudflare', url: 'https://1.1.1.1/cdn-cgi/trace', group: 'Internet', interval: 10 },
        { name: 'GitHub API', url: 'https://api.github.com/', group: 'Internet', interval: 30 },
        { name: 'Gemini API', url: 'https://generativelanguage.googleapis.com/', group: 'AI', interval: 30, expect: 'lt500' },
        { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1/models', group: 'AI', interval: 60, expect: 'lt500', method: 'HEAD' }
      ]);
    },
    pingExport() {
      const keep = ['name', 'url', 'group', 'interval', 'timeout', 'expect', 'method', 'enabled', 'alarmUp'];
      const data = { type: 'multi-ping', version: 1, exported: new Date().toISOString(), targets: this.ping.targets.map(x => { const o = {}; keep.forEach(k => { o[k] = x[k]; }); return o; }) };
      pupDownload('multi-ping.json', JSON.stringify(data, null, 2), 'application/json');
    },
    pingImport(e) {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const j = JSON.parse(String(r.result || ''));
          if (!j || j.type !== 'multi-ping' || !Array.isArray(j.targets)) throw new Error('bad');
          const list = j.targets.filter(x => x && pingNormUrl(x.url)).map(x => Object.assign({}, x, { url: pingNormUrl(x.url), id: undefined }));
          const n = this.pingAddList(list);
          this.ping.msg = tr('ping_imported').replace('{n}', n);
        } catch (err) { this.ping.err = tr('ping_import_bad'); }
      };
      r.readAsText(f);
    },
    pingStatOf(id) {
      const c = this.pingStatCache;
      if (c.tick !== this.ping.tick) { c.tick = this.ping.tick; c.map = {}; }
      return c.map[id] || (c.map[id] = pingStats(this.pingHist[id]));
    },
    pingStatusLabel(x) { return tr('ping_st_' + x.status); },
    pingNoteText(x) { return ['timeout', 'neterr', 'code', 'mixed', 'opaque'].indexOf(x.note) >= 0 ? tr('ping_n_' + x.note) : (x.note || ''); },
    pingAgo(ts) {
      if (!ts) return '—';
      const s = Math.max(0, Math.round((this.ping.now - ts) / 1000));
      if (s < 60) return tr('ping_ago_s').replace('{n}', s);
      if (s < 3600) return tr('ping_ago_m').replace('{n}', Math.floor(s / 60));
      return tr('ping_ago_h').replace('{n}', Math.floor(s / 3600));
    },
    pingDur(ms) {
      const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      return h ? h + 'h ' + m + 'm' : m ? m + 'm ' + (s % 60) + 's' : s + 's';
    },
    pingTime(ts) { try { return new Date(ts).toLocaleString(); } catch (e) { return String(ts); } },
    pingDrawSoon() {
      if (this.pingRaf) return;
      this.pingRaf = requestAnimationFrame(() => { this.pingRaf = 0; this.pingDrawAll(); });
    },
    pingDrawAll() {
      if (this.tab !== 'ping') return;
      document.querySelectorAll('canvas[data-ping]').forEach(c => pingDrawSpark(c, this.pingHist[c.getAttribute('data-ping')]));
      if (this.ping.selId && this.$refs.pingBig) pingDrawBig(this.$refs.pingBig, this.pingHist[this.ping.selId]);
    },
    // ---- Swag (Swagger/OpenAPI -> Postman/curl/PowerShell)
    swagLoad(text, url, name) {
      this.swag.err = '';
      try {
        const m = swagBuild(swagParse(text), { pageUrl: '', specUrl: url || '' });
        const tg = {};
        m.tags.forEach(x => { tg[x] = true; });
        this.swag.tags = tg;
        this.swag.baseUrl = m.baseUrl;
        this.swag.src = name || url || '';
        this.swag.model = Vue.markRaw(m);
      } catch (e) { this.swag.model = null; this.swag.err = L(e.message || String(e)); }
    },
    swagReadFile(f) {
      if (!f) return;
      const r = new FileReader();
      r.onload = () => this.swagLoad(String(r.result || ''), '', f.name);
      r.onerror = () => { this.swag.err = String(r.error || 'read error'); };
      r.readAsText(f);
    },
    onSwagDrop(e) { this.swag.over = false; this.swagReadFile(e.dataTransfer && e.dataTransfer.files[0]); },
    onSwagPick(e) { this.swagReadFile(e.target.files[0]); e.target.value = ''; },
    async swagFetch(u) {
      const url = String(u || this.swag.url).trim();
      if (!url) return;
      this.swag.busy = true; this.swag.err = '';
      try {
        const res = await apiFetch('url', url, { headers: { Accept: 'application/json, application/yaml;q=0.9, */*;q=0.8' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        this.swagLoad(await res.text(), url, url);
      } catch (e) { this.swag.model = null; this.swag.err = (e.message || String(e)) + ' — ' + tr('swag_cors_hint'); }
      finally { this.swag.busy = false; }
    },
    swagSample(k) {
      this.swag.url = k === 'v2' ? 'https://petstore.swagger.io/v2/swagger.json' : 'https://petstore3.swagger.io/api/v3/openapi.json';
      this.swagFetch(this.swag.url);
    },
    swagAllTags(v) { Object.keys(this.swag.tags).forEach(k => { this.swag.tags[k] = v; }); },
    swagAuthLabel(a) {
      if (!a) return tr('swag_auth_inherit');
      if (a.type === 'none') return tr('swag_auth_none');
      return a.type === 'apikey' ? 'API key (' + a['in'] + ': ' + a.name + ')' : a.type === 'basic' ? 'Basic' : 'Bearer';
    },
    swagOut(kind) {
      const m = this.swag.model, o = this.swagOpts;
      const base = swagSlug(m.title + (m.version ? '-' + m.version : ''));
      if (kind === 'pm') return { name: base + '.postman_collection.json', text: swagPostman(m, o), type: 'application/json' };
      if (kind === 'sh') return { name: base + '.curl.sh', text: swagCurl(m, o), type: 'text/x-shellscript' };
      return { name: base + '.ps1', text: swagPwsh(m, o), type: 'text/plain' };
    },
    swagDownload(kind) { const r = this.swagOut(kind); pupDownload(r.name, r.text, r.type); },
    swagCopy(kind) {
      navigator.clipboard.writeText(this.swagOut(kind).text).then(() => { this.swag.copied = true; setTimeout(() => { this.swag.copied = false; }, 1500); }, () => { this.swag.err = L('Clipboard ditolak browser. Pakai tombol unduh.'); });
    },
    copySwagScript() {
      navigator.clipboard.writeText(swagScript()).then(() => { this.swag.scriptCopied = true; setTimeout(() => { this.swag.scriptCopied = false; }, 1500); });
    },
    // ---- Colab Server: ambil URL & token dari baris output cell yang ditempel
    colabParse() {
      const s = this.colab.paste;
      const url = s.match(/sonar\.host\.url=([^\s"']+)/) || s.match(/https:\/\/[\w.-]+\.trycloudflare\.com/);
      const token = s.match(/\bsq[apu]_[0-9a-f]+/);
      if (url) this.colab.url = url[1] || url[0];
      if (token) this.colab.token = token[0];
    },
    colabCopy(kind) {
      navigator.clipboard.writeText(this.colabCmd[kind]).then(() => { this.colab.copied = kind; setTimeout(() => { this.colab.copied = ''; }, 1500); });
    },
    // ---- Colab Server: tanya kode ke LLM di notebook Colab (gateway OpenAI-compatible + API key)
    // Link dari notebook: ?tab=colab#ai=<url>&key=<key>; fragment tidak terkirim ke server dan langsung dihapus dari URL.
    colabAiFromHash() {
      const h = new URLSearchParams(location.hash.slice(1));
      if (!h.get('ai') || !h.get('key')) return;
      Object.assign(this.colab.ai, { url: h.get('ai'), key: h.get('key') });
      history.replaceState(null, '', location.pathname + location.search);
      this.visibleTabs.colab = true; this.tab = 'colab';
      this.aiConnect();
    },
    async aiFetch(path, init) {
      const ai = this.colab.ai, base = ai.url.trim().replace(/\/+$/, '').replace(/\/v1$/, '');
      const res = await fetch(base + path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ai.key.trim() } });
      if (res.ok) return res;
      let detail = '';
      try { const e = (await res.json()).error; detail = (e && e.message) || e || ''; } catch (e) { /* respons bukan JSON */ }
      throw new Error(res.status + ' ' + detail);
    },
    async aiConnect() {
      const ai = this.colab.ai;
      Object.assign(ai, { err: '', model: '', msg: this.t('colab_ai_checking') });
      try {
        const list = await (await this.aiFetch('/v1/models')).json();
        ai.model = (list.data && list.data[0] && list.data[0].id) || '';
        ai.msg = ai.model ? this.t('colab_ai_ok').replace('{m}', ai.model) : '';
        if (!ai.model) ai.err = this.t('colab_ai_nomodel');
      } catch (e) { Object.assign(ai, { msg: '', err: this.t('colab_ai_fail') + String(e.message || e) }); }
    },
    async aiSend() {
      const ai = this.colab.ai, q = ai.q.trim();
      if (!q || ai.busy) return;
      ai.msgs.push({ role: 'user', content: q });
      const messages = [{ role: 'system', content: this.t('colab_ai_system') }, ...ai.msgs.map(m => ({ role: m.role, content: m.content }))];
      ai.msgs.push({ role: 'assistant', content: '' });
      const reply = ai.msgs[ai.msgs.length - 1];
      Object.assign(ai, { q: '', err: '', busy: true });
      this.aiCtl = new AbortController();
      try {
        const res = await this.aiFetch('/v1/chat/completions', { method: 'POST', signal: this.aiCtl.signal, body: JSON.stringify({ model: ai.model, stream: true, messages }) });
        const reader = res.body.getReader(), dec = new TextDecoder();
        let buf = '';
        // Stream SSE: baris "data: {json}" berisi potongan jawaban di choices[0].delta.content
        for (let r = await reader.read(); !r.done; r = await reader.read()) {
          const lines = (buf + dec.decode(r.value, { stream: true })).split('\n');
          buf = lines.pop();
          reply.content += lines.map(aiDelta).join('');
        }
      } catch (e) {
        if (e.name !== 'AbortError') ai.err = String(e.message || e);
      } finally {
        ai.busy = false; this.aiCtl = null;
      }
    },
    aiStop() { if (this.aiCtl) this.aiCtl.abort(); },
    // ---- Color Picker
    colLoad() {
      try {
        const d = JSON.parse(localStorage.getItem(COL_KEY) || 'null');
        if (!d) return;
        if (Array.isArray(d.coll)) this.col.coll = d.coll.filter(x => x && x.hex);
        if (Array.isArray(d.hist)) this.col.hist = d.hist.filter(x => x && x.hex8).slice(0, COL_HIST_MAX);
        if (d.thumbs && typeof d.thumbs === 'object') this.col.thumbs = d.thumbs;
        if (d.exp) this.col.exp = d.exp;
      } catch (e) { /* data rusak: mulai kosong */ }
    },
    // Simpan koleksi + riwayat; thumbnail hanya untuk gambar yang masih dipakai di riwayat.
    colSave() {
      const c = this.col;
      if (c.hist.length > COL_HIST_MAX) c.hist.splice(COL_HIST_MAX);
      const used = [...new Set(c.hist.map(h => h.img).filter(Boolean))].slice(0, COL_THUMB_MAX);
      const thumbs = {};
      used.forEach(k => { if (c.thumbs[k] && c.thumbs[k].url) thumbs[k] = c.thumbs[k]; });
      try { localStorage.setItem(COL_KEY, JSON.stringify({ coll: c.coll, hist: c.hist, thumbs, exp: c.exp })); }
      catch (e) { try { localStorage.setItem(COL_KEY, JSON.stringify({ coll: c.coll, hist: c.hist.slice(0, 100), thumbs: {}, exp: c.exp })); } catch (e2) { /* penuh: abaikan */ } }
    },
    colSetCanvas(src, name) {
      // Batasi sisi terpanjang 4000 px supaya memori aman.
      const sc = Math.min(1, 4000 / Math.max(src.width, src.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(src.width * sc)); c.height = Math.max(1, Math.round(src.height * sc));
      c.getContext('2d', { willReadFrequently: true }).drawImage(src, 0, 0, c.width, c.height);
      this.colSrc = c;
      const t = document.createElement('canvas'), ts = 64 / c.height;
      t.width = Math.max(1, Math.round(c.width * ts)); t.height = 64;
      t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
      const id = 'img' + Date.now();
      this.col.thumbs[id] = { url: t.toDataURL('image/jpeg', 0.7), name };
      Object.assign(this.col, { imgUrl: id, imgId: id, imgName: name, imgW: c.width, imgH: c.height, err: '', msg: '', hover: null, dominant: colDominant(c, 8) });
      this.$nextTick(() => {
        const v = this.$refs.colCanvas;
        if (!v) return;
        v.width = c.width; v.height = c.height;
        v.getContext('2d').drawImage(c, 0, 0);
      });
    },
    async colSetBlob(blob, name) {
      this.col.err = '';
      if (!blob || !/^image\//.test(blob.type || '')) { this.col.err = tr('col_e_type'); return; }
      try { const bmp = await createImageBitmap(blob); this.colSetCanvas(bmp, name || 'gambar'); bmp.close && bmp.close(); }
      catch (e) { this.col.err = tr('col_e_type'); }
    },
    colSample(kind) { this.colSetCanvas(colSampleCanvas(kind), tr('col_sample_' + kind)); },
    colClearImg() { this.colSrc = null; Object.assign(this.col, { imgUrl: '', imgId: '', imgName: '', hover: null, dominant: [] }); },
    onColPick(e) { const f = e.target.files && e.target.files[0]; if (f) this.colSetBlob(f, f.name); e.target.value = ''; },
    onColDrop(e) {
      this.col.over = false;
      const f = [...((e.dataTransfer && e.dataTransfer.files) || [])].find(x => /^image\//.test(x.type));
      if (f) this.colSetBlob(f, f.name); else this.col.err = tr('col_e_type');
    },
    onColPaste(e) {
      if (this.tab !== 'color' || !e.clipboardData) return;
      const el = e.target, typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      const img = [...e.clipboardData.items].find(it => it.kind === 'file' && /^image\//.test(it.type));
      if (img) { e.preventDefault(); this.colSetBlob(img.getAsFile(), 'clipboard'); return; }
      // Teks warna (#hex / rgb() / hsl()) yang ditempel di luar input langsung dipakai.
      if (!typing) {
        const txt = e.clipboardData.getData('text');
        const c = colParse(txt);
        if (c) this.colPick(c, 'clipboard'); else this.col.err = tr('col_e_noimg');
      }
    },
    async colPasteBtn() {
      this.col.err = '';
      try {
        if (!navigator.clipboard || !navigator.clipboard.read) throw new Error('no api');
        const items = await navigator.clipboard.read();
        for (const it of items) {
          const type = it.types.find(x => /^image\//.test(x));
          if (type) { await this.colSetBlob(await it.getType(type), 'clipboard'); return; }
        }
        this.col.err = tr('col_e_noimg');
      } catch (e) { this.col.err = tr('col_e_clip'); }
    },
    // Ambil satu titik di layar mana pun (EyeDropper, Chrome/Edge); tanpa dukungan -> screenshot.
    async colScreen() {
      this.col.err = ''; this.col.msg = '';
      if (!window.EyeDropper) { this.col.msg = tr('col_eyedrop_fallback'); return this.colScreenshot(); }
      try {
        const r = await new window.EyeDropper().open();
        const c = colFromHex(r.sRGBHex) || colParse(r.sRGBHex);
        if (c) this.colPick(c, tr('col_src_screen'));
      } catch (e) { this.col.msg = tr('col_cancel'); }
    },
    // Screenshot satu layar/jendela/tab lewat getDisplayMedia, lalu dipakai seperti gambar biasa.
    async colScreenshot() {
      this.col.err = '';
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.srcObject = stream;
        await v.play();
        await new Promise(r => setTimeout(r, 350));
        const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        this.colSetCanvas(c, tr('col_src_shot'));
      } catch (e) { this.col.err = tr('col_e_screen') + ((e && e.message) || e); }
      finally { if (stream) stream.getTracks().forEach(tk => tk.stop()); }
    },
    colPos(e) {
      const v = this.$refs.colCanvas, src = this.colSrc;
      if (!v || !src) return null;
      const rc = v.getBoundingClientRect();
      const px = Math.floor((e.clientX - rc.left) / rc.width * src.width), py = Math.floor((e.clientY - rc.top) / rc.height * src.height);
      if (px < 0 || py < 0 || px >= src.width || py >= src.height) return null;
      return { px, py, x: e.clientX - rc.left, y: e.clientY - rc.top };
    },
    colSampleAt(px, py) {
      const src = this.colSrc, n = this.col.avg, h = Math.floor(n / 2);
      const x0 = colClamp(px - h, 0, src.width - 1), y0 = colClamp(py - h, 0, src.height - 1);
      const w = Math.min(n, src.width - x0), hh = Math.min(n, src.height - y0);
      const d = src.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, w, hh).data;
      let r = 0, g = 0, b = 0, a = 0; const cnt = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; a += d[i + 3]; }
      return { r: Math.round(r / cnt), g: Math.round(g / cnt), b: Math.round(b / cnt), a: Math.round(a / cnt / 255 * 100) / 100 };
    },
    colHover(e) {
      const p = this.colPos(e);
      if (!p) { this.col.hover = null; return; }
      const c = this.colSampleAt(p.px, p.py);
      this.col.hover = { x: p.x + 18, y: p.y + 18, px: p.px, py: p.py, hex: colToHex(c) };
      this.$nextTick(() => {
        const l = this.$refs.colLoupe;
        if (!l) return;
        const g = l.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, 110, 110);
        g.drawImage(this.colSrc, p.px - 5, p.py - 5, 11, 11, 0, 0, 110, 110);
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(50, 50, 10, 10);
        g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(48.5, 48.5, 13, 13);
      });
    },
    colClick(e) {
      const p = this.colPos(e);
      if (!p) return;
      this.colPick(this.colSampleAt(p.px, p.py), this.col.imgName, { img: this.col.imgId, px: p.px, py: p.py });
    },
    // Pilih warna aktif + catat di riwayat (preview=true: hanya ganti warna aktif, mis. saat geser color input).
    colPick(c, src, extra, preview) {
      this.col.cur = { r: c.r, g: c.g, b: c.b, a: c.a == null ? 1 : c.a };
      this.col.alphaPct = Math.round(this.col.cur.a * 100);
      this.col.err = '';
      if (preview) return;
      const last = this.col.hist[0];
      const e = colEntry(this.col.cur, src, extra);
      if (last && last.hex8 === e.hex8 && last.src === e.src && last.px === e.px && last.py === e.py) return;
      this.col.hist.unshift(e);
      this.colSave();
    },
    colPickHex(hex, src, preview) { const c = colFromHex(hex); if (c) this.colPick(c, src, null, preview); },
    colManual() {
      const c = colParse(this.col.manual);
      if (!c) { this.col.err = tr('col_e_parse'); return; }
      this.colPick(c, 'manual'); this.col.manual = '';
    },
    colSetAlpha() { if (this.col.cur) this.col.cur = { ...this.col.cur, a: this.col.alphaPct / 100 }; },
    colCollectHex(hex8) {
      const c = colFromHex(hex8);
      if (!c) return;
      const e = colEntry(c, '');
      if (this.col.coll.some(x => x.hex8 === e.hex8)) return;
      this.col.coll.push({ id: e.id, hex: e.hex, hex8: e.hex8, rgba: e.rgba, hsl: e.hsl, role: '' });
      this.colSave();
    },
    colCollect() { if (this.col.cur) this.colCollectHex(colToHex(this.col.cur, true)); },
    colAddAllDominant() { this.col.dominant.forEach(d => this.colCollectHex(d.hex + 'ff')); },
    // Peran otomatis untuk warna tanpa peran: paling terang = background, paling gelap = text,
    // paling jenuh = primary, lalu secondary/accent.
    colAutoRoles() {
      const free = this.col.coll.filter(x => !x.role);
      const taken = new Set(this.col.coll.map(x => x.role).filter(Boolean));
      const meta = free.map(x => { const c = colFromHex(x.hex), h = colToHsl(c); return { x, l: colLum(c), s: h.s * (1 - Math.abs(h.l - 50) / 50) }; });
      const give = (role, pick) => {
        if (taken.has(role) || !meta.length) return;
        const m = pick(); m.x.role = role; taken.add(role); meta.splice(meta.indexOf(m), 1);
      };
      give('background', () => meta.reduce((a, b) => (b.l > a.l ? b : a)));
      give('text', () => meta.reduce((a, b) => (b.l < a.l ? b : a)));
      ['primary', 'secondary', 'accent'].forEach(r => give(r, () => meta.reduce((a, b) => (b.s > a.s ? b : a))));
      this.colSave();
    },
    colClearColl() { if (confirm(tr('col_confirm_clear'))) { this.col.coll = []; this.colSave(); } },
    colClearHist() { if (confirm(tr('col_confirm_clear'))) { this.col.hist = []; this.col.thumbs = {}; this.colSave(); } },
    colDelHist(id) { this.col.hist = this.col.hist.filter(h => h.id !== id); this.colSave(); },
    colWcag(r) { return r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA large' : 'fail'; },
    colCopy(s) {
      const p = navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject(new Error('clipboard'));
      p.then(() => { this.col.copied = s; setTimeout(() => { if (this.col.copied === s) this.col.copied = ''; }, 1500); }).catch(() => { /* abaikan */ });
    },
    // ---- OCR Gambar
    ocrLoadPrefs() {
      try {
        const p = JSON.parse(localStorage.getItem(OCR_PREFS_KEY) || 'null');
        if (!p) return;
        if (['tess', 'space', 'ai'].includes(p.engine)) this.ocr.engine = p.engine;
        if (['ind+eng', 'eng', 'ind'].includes(p.lang)) this.ocr.lang = p.lang;
        if (OCR_PRESETS.some(x => x.key === p.preset)) this.ocr.ai.preset = p.preset;
        if (typeof p.baseUrl === 'string') this.ocr.ai.baseUrl = p.baseUrl;
        if (typeof p.model === 'string') this.ocr.ai.model = p.model;
        if (p.mode === 'text' || p.mode === 'detail') this.ocr.ai.mode = p.mode;
      } catch (e) { /* abaikan */ }
    },
    // Token & API key sengaja tidak ikut disimpan.
    ocrSavePrefs() {
      const a = this.ocr.ai;
      try { localStorage.setItem(OCR_PREFS_KEY, JSON.stringify({ engine: this.ocr.engine, lang: this.ocr.lang, preset: a.preset, baseUrl: a.baseUrl, model: a.model, mode: a.mode })); } catch (e) { /* abaikan */ }
    },
    ocrPreset() {
      const p = OCR_PRESETS.find(x => x.key === this.ocr.ai.preset);
      if (p && p.key !== 'custom') { this.ocr.ai.baseUrl = p.baseUrl; this.ocr.ai.model = p.model; }
      this.ocrSavePrefs();
    },
    ocrSetImage(blob, name) {
      this.ocr.error = '';
      if (!blob || !/^image\//.test(blob.type || '')) { this.ocr.error = tr('ocr_e_type'); return; }
      if (blob.size > MAX_FILE_BYTES) { this.ocr.error = tr('ocr_e_big'); return; }
      if (this.ocr.imgUrl) URL.revokeObjectURL(this.ocr.imgUrl);
      this.ocrBlob = blob;
      this.ocr.imgUrl = URL.createObjectURL(blob);
      this.ocr.imgInfo = (name || 'clipboard') + ' · ' + pupFmtBytes(blob.size) + ' · ' + blob.type;
      this.ocr.text = ''; this.ocr.done = false; this.ocr.progress = '';
    },
    ocrClear() {
      if (this.ocr.imgUrl) URL.revokeObjectURL(this.ocr.imgUrl);
      this.ocrBlob = null;
      Object.assign(this.ocr, { imgUrl: '', imgInfo: '', text: '', done: false, error: '', progress: '' });
    },
    onOcrPick(e) { const f = e.target.files && e.target.files[0]; if (f) this.ocrSetImage(f, f.name); e.target.value = ''; },
    onOcrDrop(e) {
      this.ocr.over = false;
      const f = [...((e.dataTransfer && e.dataTransfer.files) || [])].find(x => /^image\//.test(x.type));
      if (f) this.ocrSetImage(f, f.name); else this.ocr.error = tr('ocr_e_type');
    },
    // Ctrl+V di mana pun saat tab OCR aktif (kecuali sedang mengetik di input teks).
    onOcrPaste(e) {
      if (this.tab !== 'ocr' || !e.clipboardData) return;
      const img = [...e.clipboardData.items].find(it => it.kind === 'file' && /^image\//.test(it.type));
      if (!img) {
        const el = e.target;
        if (!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'))) this.ocr.error = tr('ocr_e_noimg');
        return;
      }
      e.preventDefault();
      const f = img.getAsFile();
      this.ocrSetImage(f, f && f.name && f.name !== 'image.png' ? f.name : 'clipboard');
    },
    async ocrPasteBtn() {
      this.ocr.error = '';
      try {
        if (!navigator.clipboard || !navigator.clipboard.read) throw new Error('no api');
        const items = await navigator.clipboard.read();
        for (const it of items) {
          const type = it.types.find(x => /^image\//.test(x));
          if (type) { this.ocrSetImage(await it.getType(type), 'clipboard'); return; }
        }
        this.ocr.error = tr('ocr_e_noimg');
      } catch (e) { this.ocr.error = tr('ocr_e_clip'); }
    },
    async runOcr() {
      if (!this.ocrBlob || this.ocr.busy) return;
      const o = this.ocr;
      o.busy = true; o.error = ''; o.text = ''; o.done = false; o.progress = ''; o.used = '';
      const t0 = performance.now();
      try {
        if (o.engine === 'tess') o.text = await this.ocrTesseract();
        else if (o.engine === 'space') o.text = await this.ocrSpace();
        else o.text = await this.ocrAi();
        o.text = (o.text || '').replace(/\r\n/g, '\n').trim();
        o.used = tr('ocr_eng_' + o.engine) + (o.engine === 'ai' ? ' (' + o.ai.model + ')' : o.engine === 'space' ? ' (engine ' + o.spaceEngine + ')' : '') + ' · ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s';
        o.done = true; o.progress = '';
      } catch (e) {
        o.error = (e && e.message) || String(e); o.progress = '';
      } finally { o.busy = false; }
    },
    async ocrTesseract() {
      const s = apiStats.tess;
      s.calls++;
      this.ocr.progress = tr('ocr_p_load');
      try {
        const T = await loadTesseract();
        const lang = this.ocr.lang;
        if (!this.tessWorker || this.tessLang !== lang) {
          if (this.tessWorker) { try { await this.tessWorker.terminate(); } catch (e) { /* abaikan */ } }
          this.tessWorker = null;
          this.tessWorker = await T.createWorker(lang, 1, {
            logger: m => { if (m && m.status) this.ocr.progress = m.status + (m.progress ? ' ' + Math.round(m.progress * 100) + '%' : ''); }
          });
          this.tessLang = lang;
        }
        const r = await this.tessWorker.recognize(this.ocrBlob);
        s.ok++;
        return (r && r.data && r.data.text) || '';
      } catch (e) { s.fail++; s.last = (e && e.message) || String(e); throw e; }
    },
    async ocrSpace() {
      this.ocr.progress = tr('ocr_p_resize');
      const blob = await ocrShrink(this.ocrBlob, 1000 * 1000);
      const img = await blobToDataUrl(blob);
      // Engine 2 (bahasa otomatis) dulu; bila server sibuk/menolak (mis. E551 key demo dibatasi), coba engine 1.
      let lastErr = '';
      for (const eng of ['2', '1']) {
        const fd = new FormData();
        fd.append('apikey', this.ocr.spaceKey.trim() || 'helloworld');
        fd.append('base64Image', img);
        fd.append('OCREngine', eng); fd.append('language', eng === '2' ? 'auto' : 'eng'); fd.append('scale', 'true'); fd.append('isOverlayRequired', 'false');
        this.ocr.progress = tr('ocr_p_send') + ' (engine ' + eng + ')';
        let res;
        try { res = await apiFetch('ocrspace', OCR_SPACE_URL, { method: 'POST', body: fd }); } catch (e) { throw new Error(tr('ocr_e_cors') + ' (' + e.message + ')'); }
        const d = await res.json().catch(() => null);
        if (res.ok && d && !d.IsErroredOnProcessing) {
          this.ocr.spaceEngine = eng;
          return (d.ParsedResults || []).map(p => p.ParsedText || '').join('\n');
        }
        if (res.ok) { apiStats.ocrspace.ok--; apiStats.ocrspace.fail++; }
        lastErr = (d && ([].concat(d.ErrorMessage || d.error || []).join(' ') || d.ErrorDetails)) || ('HTTP ' + res.status);
        apiStats.ocrspace.last = String(lastErr).slice(0, 160);
      }
      throw new Error('OCR.space: ' + lastErr);
    },
    async ocrAi() {
      const a = this.ocr.ai;
      if (!a.baseUrl || !a.model || !a.token.trim()) throw new Error(tr('ocr_e_cfg'));
      if (!/^https?:\/\//i.test(a.baseUrl)) throw new Error(tr('ocr_e_url'));
      this.ocr.progress = tr('ocr_p_resize');
      const blob = await ocrShrink(this.ocrBlob, 4 * 1024 * 1024, 2048);
      const body = {
        model: a.model, temperature: 0,
        messages: [{ role: 'user', content: [
          { type: 'text', text: a.prompt.trim() || this.ocrDefaultPrompt },
          { type: 'image_url', image_url: { url: await blobToDataUrl(blob) } }
        ] }]
      };
      this.ocr.progress = tr('ocr_p_send');
      const url = a.baseUrl.replace(/\/+$/, '') + '/chat/completions';
      let res;
      try {
        res = await apiFetch('aiocr', url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + a.token.trim() }, body: JSON.stringify(body) });
      } catch (e) { throw new Error(tr('ocr_e_cors') + ' (' + e.message + ')'); }
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        const m = d && (d.error && (d.error.message || d.error) || d.message);
        throw new Error('AI HTTP ' + res.status + (m ? ': ' + (typeof m === 'string' ? m : JSON.stringify(m)) : ''));
      }
      const ch = d && d.choices && d.choices[0];
      return aiContentText(ch && ch.message);
    },
    ocrCopy() {
      const p = navigator.clipboard ? navigator.clipboard.writeText(this.ocr.text) : Promise.reject(new Error('clipboard'));
      p.then(() => { this.ocr.copied = true; setTimeout(() => { this.ocr.copied = false; }, 1500); }).catch(() => { /* abaikan */ });
    },
    ocrDownload() {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([this.ocr.text], { type: 'text/plain;charset=utf-8' }));
      a.download = 'ocr.txt';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    },
    ocrSendTo(where) {
      if (where === 'decode') this.dec.input = this.ocr.text.trim();
      else this.codeText = this.ocr.text;
      this.visibleTabs[where] = true;
      this.tab = where;
    },
    // ---- Puppeteer Record
    pupStepTarget(s) { return pupStepTarget(s); },
    pupStepValue(s) { return pupStepValue(s); },
    pupErr(err) { this.pup.err = String((err && err.message) || err); },
    pupInit() {
      try { this.pup.hidden = JSON.parse(localStorage.getItem('scaPupHidden') || '{}') || {}; this.pup.newGroup = localStorage.getItem('scaPupGroup') || ''; } catch (e) { /* abaikan */ }
      this.pupLoad();
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* abaikan */ }
      try { this.pupBc = new BroadcastChannel('scaPupRec'); this.pupBc.onmessage = () => { this.pupLoad(); }; } catch (e) { this.pupBc = null; }
      window.addEventListener('message', e => { this.pupOnMessage(e); });
      if (location.hash !== '#pup-import') return;
      // Dibuka oleh bookmarklet Pup Rec: beri tahu tab target bahwa halaman ini siap menerima rekaman.
      this.tab = 'pup';
      try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* abaikan */ }
      if (!window.opener) return;
      let n = 0;
      const timer = setInterval(() => {
        if (++n > 30 || this.pupGot) { clearInterval(timer); return; }
        try { window.opener.postMessage({ type: 'pup-ready' }, '*'); } catch (e) { clearInterval(timer); }
      }, 300);
    },
    pupOnMessage(e) {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      const back = e.origin && e.origin !== 'null' ? e.origin : '*';
      if (d.type === 'pup-rec' && e.source && e.source === window.opener && !this.pupGot) {
        const r = pupNormalize(d.rec);
        if (!r) return;
        this.pupGot = true;
        r.group = String(this.pup.newGroup || '').trim().slice(0, 80);
        pupPutMany([r]).then(() => {
          this.pup.err = ''; this.pup.msg = this.t('pup_saved').replace('{t}', r.title);
          try { e.source.postMessage({ type: 'pup-saved' }, back); if (window.AppPipe) window.AppPipe.recordPostOut(back, { type: 'pup-saved' }, 'Puppeteer'); } catch (err) { /* tab target sudah ditutup */ }
          this.pupNotify();
          return this.pupLoad();
        }).catch(err => this.pupErr(err));
      }
      if (d.type === 'pup-need' && this.pupArmed && this.pupWin && e.source === this.pupWin) {
        const recPayload = pupRecorderJson(JSON.parse(JSON.stringify(this.pupArmed)), true);
        try { e.source.postMessage({ type: 'pup-play', rec: recPayload }, back); if (window.AppPipe) window.AppPipe.recordPostOut(back, { type: 'pup-play', steps: recPayload.steps ? recPayload.steps.length : 0 }, 'Puppeteer'); } catch (err) { this.pupErr(err); }
      }
    },
    pupNotify() { try { if (this.pupBc) this.pupBc.postMessage('changed'); } catch (e) { /* abaikan */ } },
    pupLoad() {
      return pupAll().then(list => {
        list.sort((a, b) => (b.created || 0) - (a.created || 0));
        const sel = {};
        list.forEach(r => { if (this.pup.sel[r.id]) sel[r.id] = true; });
        list.forEach(r => { r.size = pupSize(r); });
        this.pup.list = list; this.pup.sel = sel;
        if (navigator.storage && navigator.storage.estimate) {
          navigator.storage.estimate().then(est => { this.pup.usage = this.t('pup_usage').replace('{u}', pupFmtBytes(est.usage)).replace('{q}', pupFmtBytes(est.quota)); }).catch(() => { /* abaikan */ });
        }
      }).catch(err => this.pupErr(err));
    },
    pupToggleAll(on) {
      const sel = {};
      if (on) this.pup.list.forEach(r => { sel[r.id] = true; });
      this.pup.sel = sel;
    },
    pupDelete() {
      const ids = this.pupSelIds;
      if (!ids.length || !confirm(this.t('pup_confirm_del').replace('{n}', ids.length))) return;
      pupDelMany(ids).then(() => {
        this.pup.err = ''; this.pup.msg = this.t('pup_deleted').replace('{n}', ids.length);
        if (ids.includes(this.pup.view)) this.pup.view = null;
        this.pupNotify();
        return this.pupLoad();
      }).catch(err => this.pupErr(err));
    },
    pupExportSel() {
      const recs = this.pup.list.filter(r => this.pup.sel[r.id]);
      if (!recs.length) return;
      const bundle = { type: 'pup-bundle', version: 1, exported: new Date().toISOString(),
        recordings: recs.map(r => ({ title: r.title, group: r.group || '', url: r.url, origin: r.origin, created: r.created, steps: r.steps })) };
      pupDownload('puppeteer_record_' + recs.length + '.json', JSON.stringify(bundle, null, 2), 'application/json');
    },
    pupExportRecorder(r) { pupDownload(pupFileName(r.title, '.json'), JSON.stringify(pupRecorderJson(r), null, 2), 'application/json'); },
    pupExportJs(r) { pupDownload(pupFileName(r.title, '.js'), pupToPuppeteer(r), 'text/javascript'); },
    pupImport(ev) {
      const files = Array.from(ev.target.files || []);
      ev.target.value = '';
      if (!files.length) return;
      const bad = [];
      let n = 0;
      Promise.all(files.map(f => f.text().then(txt => {
        let o = null;
        try { o = JSON.parse(txt); } catch (e) { bad.push(f.name); return []; }
        const recs = pupFromFile(o);
        if (!recs.length) bad.push(f.name);
        return recs;
      }))).then(arr => {
        const all = [].concat(...arr);
        n = all.length;
        return all.length ? pupPutMany(all) : null;
      }).then(() => {
        this.pup.err = bad.length ? this.t('pup_import_bad').replace('{f}', bad.join(', ')) : '';
        this.pup.msg = this.t('pup_imported').replace('{n}', n);
        this.pupNotify();
        return this.pupLoad();
      }).catch(err => this.pupErr(err));
    },
    pupPlay(r) {
      const w = window.open(r.url || 'about:blank', '_blank');
      if (!w) { this.pup.err = this.t('pup_popup_blocked'); return; }
      this.pupWin = w; this.pupArmed = r;
      this.pup.err = ''; this.pup.msg = this.t('pup_play_msg').replace('{t}', r.title);
    },
    pupSaveNewGroup() { try { localStorage.setItem('scaPupGroup', String(this.pup.newGroup || '').trim()); } catch (e) { /* abaikan */ } },
    pupToggleGroup(name) {
      this.pup.hidden = Object.assign({}, this.pup.hidden, { [name || '-']: !this.pup.hidden[name || '-'] });
      try { localStorage.setItem('scaPupHidden', JSON.stringify(this.pup.hidden)); } catch (e) { /* abaikan */ }
    },
    pupGroupHidden(name) { return !!this.pup.hidden[name || '-']; },
    pupGroupAllSel(g) { return g.recs.every(r => this.pup.sel[r.id]); },
    pupSelectGroup(g, on) {
      const sel = Object.assign({}, this.pup.sel);
      g.recs.forEach(r => { if (on) sel[r.id] = true; else delete sel[r.id]; });
      this.pup.sel = sel;
    },
    pupMoveSel() {
      const g = String(this.pup.moveTo || '').trim().slice(0, 80);
      const recs = this.pup.list.filter(r => this.pup.sel[r.id]);
      if (!recs.length) return;
      const upd = recs.map(r => { const c = JSON.parse(JSON.stringify(r)); delete c.size; c.group = g; c.updated = Date.now(); return c; });
      pupPutMany(upd).then(() => {
        this.pup.err = ''; this.pup.msg = this.t('pup_moved').replace('{n}', upd.length).replace('{g}', g || this.t('pup_group_none'));
        this.pupNotify();
        return this.pupLoad();
      }).catch(err => this.pupErr(err));
    },
    pupFmt(n) { return pupFmtBytes(n); },
    // Lebar batang jeda (relatif terhadap jeda terpanjang di rekaman itu).
    pupGapPct(r, i) {
      const d = k => { const g = pupStepGap(r, k); return g ? g.ms : 0; };
      let max = 0;
      for (let k = 1; k < r.steps.length; k++) max = Math.max(max, d(k));
      return max && d(i) ? Math.max(2, Math.round(d(i) / max * 100)) : 0;
    },
    pupGap(r, i) {
      const g = pupStepGap(r, i);
      if (!g) return '';
      return '+' + (g.ms / 1000).toFixed(1) + ' s' + (g.edited ? ' ✎' : '');
    },
    pupStartGap(r, i) { const g = pupStepGap(r, i); if (!g) return; this.pup.gapEdit = { id: r.id, i, value: (g.ms / 1000).toFixed(1) }; },
    // Simpan jeda hasil edit sebagai 'wait' (ms) pada langkah itu; kosong = kembali ke jeda asli rekaman.
    pupSaveGap(r) {
      const e = this.pup.gapEdit;
      if (e.id !== r.id) return;
      this.pup.gapEdit = { id: null, i: -1, value: '' };
      const upd = JSON.parse(JSON.stringify(r));
      delete upd.size;
      const st = upd.steps[e.i];
      if (!st) return;
      const v = String(e.value).trim().replace(',', '.');
      if (v === '') delete st.wait;
      else { const sec = Number(v); if (!isFinite(sec) || sec < 0) return; st.wait = Math.round(sec * 1000); }
      upd.updated = Date.now();
      pupPutMany([upd]).then(() => { this.pupNotify(); return this.pupLoad(); }).catch(err => this.pupErr(err));
    },
    pupStartRename(r) { this.pup.edit = { id: r.id, value: r.title }; },
    pupSaveRename(r) {
      if (this.pup.edit.id !== r.id) return;
      const v = this.pup.edit.value.trim();
      this.pup.edit = { id: null, value: '' };
      if (!v || v === r.title) return;
      const upd = Object.assign(JSON.parse(JSON.stringify(r)), { title: v.slice(0, 200), updated: Date.now() });
      delete upd.size;
      pupPutMany([upd]).then(() => { this.pupNotify(); return this.pupLoad(); }).catch(err => this.pupErr(err));
    },
    // ---- Smart Decode
    tipOf(key) { return tips()[this.t(key)] || ''; },
    decConfClass(c) { return c === 'high' ? 'okp' : c === 'med' ? 'medp' : 'errp'; },
    decHas(f) { return this.decFields.includes(f); },
    // Blob URL untuk langkah berjenis file (unduh); dicabut saat rantai diganti.
    decChain(title, steps) {
      const urls = [];
      steps.forEach(s => {
        if (!s.file) return;
        s.fileUrl = URL.createObjectURL(new Blob([s.bytes], { type: s.file.mime }));
        s.fileName = 'decoded.' + s.file.ext;
        urls.push(s.fileUrl);
      });
      return { title, steps, urls };
    },
    setDecChains(chains) {
      this.dec.chains.forEach(ch => { if (!chains.includes(ch)) ch.urls.forEach(u => URL.revokeObjectURL(u)); });
      this.dec.chains = Vue.markRaw(chains);
    },
    async runDecode() {
      const id = (this.decRunId = (this.decRunId || 0) + 1), d = this.dec, input = d.input;
      d.error = ''; d.tries = [];
      if (!input.trim()) { this.setDecChains([]); d.busy = false; return; }
      d.busy = true;
      try {
        const steps = await smartDecode(input);
        if (id !== this.decRunId) return;
        this.setDecChains([this.decChain('', steps)]);
        const t = this.decTarget;
        if (t && t.type === 'aes') d.form.mode = t.mode;
      } catch (e) {
        if (id === this.decRunId) d.error = dtr('dec_err_generic', { e: (e && e.message) || e });
      } finally {
        if (id === this.decRunId) d.busy = false;
      }
    },
    // ---- Analisis file
    onFiPick(e) { const fl = Array.from(e.target.files); e.target.value = ''; this.inspectFiles(fl); },
    onFiDrop(e) { this.fi.over = false; this.inspectFiles(Array.from(e.dataTransfer.files)); },
    async inspectFiles(files) {
      if (!files.length) return;
      this.fi.busy = true;
      for (const f of files) {
        this.fi.results.unshift({ name: f.name, busy: true });
        let r;
        try { r = await inspectFile(f); } catch (err) { r = { name: f.name, det: { label: '—', ext: [] }, hashes: {}, integ: [{ ok: false, msg: dtr('fi_err_read', { x: err.message }) }], finds: [], meta: [], verify: '' }; }
        const i = this.fi.results.findIndex(x => x.busy && x.name === f.name);
        this.fi.results.splice(i, 1, r);
      }
      this.fi.busy = false;
    },
    fiVerdictOf(r) { return fiVerdict(r); },
    fiVerdictClass(r) { const v = fiVerdict(r); return v === 'ok' ? 'okp' : v === 'danger' ? 'errp' : 'warnp'; },
    fiVerifyOf(r) { return fiVerify(r.hashes, r.verify); },
    fiSevText(sev) { return sev === 'INFO' ? tr('fi_sev_info') : sevL(sev); },
    fiIdentity(r) {
      const rows = [[tr('fi_id_name'), r.name], [tr('fi_id_size'), humanSize(r.size || 0)]];
      if (r.modified) rows.push([tr('fi_id_modified'), new Date(r.modified).toLocaleString(LANG === 'en' ? 'en-US' : 'id-ID')]);
      rows.push([tr('fi_id_browser'), r.browserType || '—'], [tr('fi_id_detected'), r.det.label + (r.det.mime ? ' (' + r.det.mime + ')' : '')],
        [tr('fi_id_expect'), r.det.ext.length ? r.det.ext.map(x => (x ? '.' + x : tr('fi_none'))).join(' ') : '—']);
      if (r.magic) rows.push([tr('fi_id_magic'), r.magic], [tr('fi_id_entropy'), r.entropy]);
      return rows;
    },
    copyFiHash(h) {
      const p = navigator.clipboard ? navigator.clipboard.writeText(h) : Promise.reject(new Error('clipboard'));
      p.then(() => { this.fi.copied = h; setTimeout(() => { this.fi.copied = ''; }, 1500); }).catch(() => { /* clipboard ditolak: abaikan */ });
    },
    downloadFiJson() {
      const data = this.fi.results.filter(r => !r.busy).map(r => ({ name: r.name, size: r.size, detected: r.det.label, extension: r.ext, verdict: fiVerdict(r), hashes: r.hashes, integrity: r.integ, findings: r.finds, metadata: Object.fromEntries(r.meta) }));
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'analisis_file.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    clearDecode() { this.dec.input = ''; this.dec.note = ''; this.dec.form = decFormDefault(); },
    async loadDecSample(key) {
      try {
        const s = await buildDecodeSample(key);
        this.dec.form = Object.assign(decFormDefault(), s.form || {});
        this.dec.note = s.note || '';
        this.dec.input = s.text;
      } catch (e) { this.dec.error = dtr('dec_err_generic', { e: (e && e.message) || e }); }
    },
    copyDec(s, id) {
      const done = () => { this.dec.copied = id; setTimeout(() => { if (this.dec.copied === id) this.dec.copied = ''; }, 2000); };
      const p = navigator.clipboard ? navigator.clipboard.writeText(s.copyText) : Promise.reject(new Error('clipboard'));
      p.then(done).catch(() => { this.dec.error = tr('clip_fail'); });
    },
    // Dekripsi (satu variasi / semua); hasil pertama yang valid diumpankan lagi ke detektor.
    async decRun(all) {
      const t = this.decTarget, d = this.dec, runId = this.decRunId;
      if (!t) return;
      d.tryBusy = true; d.tries = []; d.error = '';
      try {
        const res = await decryptTarget(t, { ...d.form }, all);
        if (runId !== this.decRunId) return;
        d.tries = res.map(r => ({ label: r.label, ok: r.ok, msg: r.msg, note: r.note }));
        const win = res.find(r => r.ok), head = d.chains.slice(0, 1);
        this.setDecChains(win ? [...head, this.decChain(dtr('dec_chain_title', { v: win.label }), await smartDecode(win.bytes))] : head);
      } catch (e) {
        d.error = dtr('dec_err_generic', { e: (e && e.message) || e });
      } finally {
        d.tryBusy = false;
      }
    },
    // Terjemahan teks UI; fallback ke Indonesia bila key belum ada di bahasa aktif.
    t(key) { return (I18N[this.lang] && I18N[this.lang][key]) || I18N.id[key] || key; },
    applyTheme() {
      document.documentElement.setAttribute('data-theme', this.theme === 'light' ? 'light' : 'dark');
    },
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(THEME_KEY, this.theme); } catch (e) { /* abaikan */ }
      this.applyTheme();
    },
    // Pindah bahasa secara portabel: cukup set ?lang= lalu muat ulang (jalan di
    // GitHub Pages maupun file lokal). URL /en/ hanya stub yang mengarah ke sini.
    toggleLang() {
      const next = this.lang === 'en' ? 'id' : 'en';
      try { localStorage.setItem(LANG_KEY, next); } catch (e) { /* abaikan */ }
      const u = new URL(location.href);
      u.pathname = u.pathname.replace(/\/en\/?$/, '/'); // kalau sempat di /en/, kembali ke akar
      u.searchParams.set('lang', next);
      location.href = u.href;
    },
    // Simpan setelan tab yang tampil; jaga minimal satu tetap tampil dan
    // pindahkan tab aktif bila yang sedang dibuka disembunyikan.
    onToggleTab(key) {
      if (!this.shownTabs.length) { this.visibleTabs[key] = true; return; }
      if (!this.visibleTabs[this.tab]) this.tab = this.shownTabs[0].key;
      this.saveVisibleTabs();
    },
    // ---- Urutan menu (drag & drop atau tombol naik/turun)
    moveTab(i, d) {
      const j = i + d;
      if (j < 0 || j >= this.tabList.length) return;
      const list = this.tabList.slice();
      const [it] = list.splice(i, 1);
      list.splice(j, 0, it);
      this.tabList = list;
      this.saveTabOrder();
    },
    onTabDragStart(ev, key) {
      this.dragTab = key;
      try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', key); } catch (e) { /* abaikan */ }
    },
    onTabDrop(key) {
      const from = this.tabList.findIndex(t => t.key === this.dragTab);
      const to = this.tabList.findIndex(t => t.key === key);
      this.dragTab = null; this.overTab = null;
      if (from < 0 || to < 0 || from === to) return;
      const list = this.tabList.slice();
      const [it] = list.splice(from, 1);
      list.splice(to, 0, it);
      this.tabList = list;
      this.saveTabOrder();
    },
    resetTabOrder() {
      this.tabList = TAB_LIST.slice();
      try { localStorage.removeItem(TAB_ORDER_KEY); } catch (e) { /* abaikan */ }
    },
    saveTabOrder() {
      try { localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(this.tabList.map(t => t.key))); } catch (e) { /* abaikan */ }
    },
    saveVisibleTabs() {
      try { localStorage.setItem(TABS_KEY, JSON.stringify(this.visibleTabs)); } catch (e) { /* abaikan */ }
    },
    isPinned(key) {
      return !!this.pinnedTabs[key];
    },
    togglePinTab(key) {
      if (!key) return;
      if (this.pinnedTabs[key]) delete this.pinnedTabs[key];
      else this.pinnedTabs[key] = true;
      this.pinnedTabs = Object.assign({}, this.pinnedTabs);
      try { localStorage.setItem(PIN_KEY, JSON.stringify(this.pinnedTabs)); } catch (e) { /* abaikan */ }
    },
    fmtBytes(n) {
      const b = Number(n) || 0;
      if (b < 1024) return b + ' B';
      if (b < 1048576) return (b / 1024).toFixed(b >= 10240 ? 0 : 1) + ' KB';
      return (b / 1048576).toFixed(2) + ' MB';
    },
    togglePipePanel() {
      this.topMenuOpen = false;
      this.pipe.open = !this.pipe.open;
      if (this.pipe.open && !this.pipe.sel && this.pipe.logs.length) {
        this.pipe.sel = this.pipe.logs[0];
      }
    },
    togglePipeMini() {
      this.pipe.mini = !this.pipe.mini;
      try { localStorage.setItem('scaPipeMin', this.pipe.mini ? '1' : '0'); } catch (e) { /* abaikan */ }
    },
    openPipeRowDetail(e) {
      if (!e) return;
      this.topMenuOpen = false;
      this.pipe.open = true;
      this.pipe.sel = e;
      if (this.pipe.detTab === 'req' && !e.reqBody && e.resBody) this.pipe.detTab = 'res';
      else if (this.pipe.detTab === 'res' && !e.resBody && e.reqBody) this.pipe.detTab = 'req';
    },
    togglePipeFloat() {
      this.pipe.floating = !this.pipe.floating;
      if (this.pipe.floating) {
        this.pipe.w = Math.min(Math.max(420, this.pipe.w), Math.max(420, window.innerWidth - 32));
        this.pipe.h = Math.min(Math.max(280, this.pipe.h), Math.max(280, window.innerHeight - 48));
        this.pipe.x = Math.min(Math.max(12, Math.round((window.innerWidth - this.pipe.w) / 2)), Math.max(12, window.innerWidth - this.pipe.w - 12));
        this.pipe.y = Math.min(Math.max(52, this.pipe.y), Math.max(52, window.innerHeight - this.pipe.h - 12));
      }
    },
    onPipeDragStart(ev) {
      if (!this.pipe.floating) return;
      if (ev.target && ev.target.closest && ev.target.closest('button,input,select,a')) return;
      ev.preventDefault();
      const x0 = ev.clientX, y0 = ev.clientY, sx = this.pipe.x, sy = this.pipe.y;
      const mv = e => {
        this.pipe.x = Math.min(Math.max(4, sx + e.clientX - x0), Math.max(4, window.innerWidth - 120));
        this.pipe.y = Math.min(Math.max(4, sy + e.clientY - y0), Math.max(4, window.innerHeight - 60));
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    },
    onPipeResizeStart(ev) {
      if (!this.pipe.floating) return;
      ev.preventDefault(); ev.stopPropagation();
      const x0 = ev.clientX, y0 = ev.clientY, sw = this.pipe.w, sh = this.pipe.h;
      const mv = e => {
        this.pipe.w = Math.min(Math.max(380, sw + e.clientX - x0), Math.max(380, window.innerWidth - this.pipe.x - 8));
        this.pipe.h = Math.min(Math.max(250, sh + e.clientY - y0), Math.max(250, window.innerHeight - this.pipe.y - 8));
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    },
    togglePipeEnabled() {
      const next = !this.pipe.on;
      this.pipe.on = next;
      if (window.AppPipe) window.AppPipe.setEnabled(next);
    },
    clearPipeLogs() {
      if (window.AppPipe) window.AppPipe.clear();
      this.pipe.logs = [];
      this.pipe.stats = { outCount: 0, inCount: 0, idbCount: 0, outBytes: 0, inBytes: 0, idbBytes: 0, totalLogs: 0, lastAt: 0 };
      this.pipe.sel = null;
      this.showToast('✓ ' + this.t('pipeClearedMsg'));
    },
    selectPipeRow(e) {
      if (this.pipe.sel && this.pipe.sel.id === e.id) {
        this.pipe.sel = null;
        return;
      }
      this.pipe.sel = e;
      if (this.pipe.detTab === 'req' && !e.reqBody && e.resBody) this.pipe.detTab = 'res';
      else if (this.pipe.detTab === 'res' && !e.resBody && e.reqBody) this.pipe.detTab = 'req';
    },
    pipeShortTarget(e) {
      if (!e || !e.target) return '';
      const raw = String(e.target).replace(/^(?:https?:\/\/|indexedDB:\/\/|localStorage:\/\/|local-file:\/\/)/i, '').split('?')[0];
      return raw.length > 26 ? raw.slice(0, 25) + '…' : raw;
    },
    pipeDetailMeta(s) {
      if (!s) return '';
      return '[' + s.dir + '] ' + s.method + ' ' + s.target
        + '\nWaktu: ' + (s.dateTime || s.time || '')
        + ' · Fitur: ' + s.feature + ' (' + s.kind + ')'
        + ' · Status: ' + s.status + ' · Ukuran: ' + this.fmtBytes(s.bytes)
        + (s.ms !== null && s.ms !== undefined ? ' · ' + s.ms + ' ms' : '')
        + '\n\n--- Info Request / Asal / Store ---\n' + this.fmtHeaders(s.reqHeaders)
        + (s.resHeaders && Object.keys(s.resHeaders).length ? '\n\n--- Response Headers ---\n' + this.fmtHeaders(s.resHeaders) : '');
    },
    copyPipeDetail() {
      const s = this.pipe.sel;
      if (!s) return;
      const txt = this.pipe.detTab === 'meta' ? this.pipeDetailMeta(s)
        : this.pipe.detTab === 'req' ? (s.reqBody || '') : (s.resBody || '');
      if (txt) navigator.clipboard.writeText(txt).catch(() => {});
    },
    exportPipeLogs() {
      const list = this.pipe.logs || [];
      const d = new Date(), p2 = n => String(n).padStart(2, '0');
      const fname = 'pipe-log-indexeddb-' + d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + '.json';
      const payload = {
        app: 'Scanner Security',
        version: APP_VERSION,
        database: 'scaPipeLog',
        exportedAt: d.toISOString(),
        stats: this.pipe.stats,
        count: list.length,
        logs: list
      };
      pupDownload(fname, JSON.stringify(payload, null, 2), 'application/json');
      this.showToast(this.t('pipeExportOk').replace('{n}', list.length));
    },
    fmtHeaders(obj) {
      if (!obj || typeof obj !== 'object') return '';
      const keys = Object.keys(obj);
      if (!keys.length) return this.t('pipeNoBody');
      return keys.map(k => k + ': ' + obj[k]).join('\n');
    },
    openMasterHook() {
      this.topMenuOpen = false;
      this.masterModal = true;
    },
    copyMasterScript() {
      navigator.clipboard.writeText(this.masterScript).then(() => {
        this.masterCopied = true;
        setTimeout(() => { this.masterCopied = false; }, 1800);
      }).catch(() => {});
    },
    refreshStorageStats() {
      let bytes = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && /^sca/i.test(k)) {
            const v = localStorage.getItem(k) || '';
            bytes += (k.length + v.length) * 2;
          }
        }
      } catch (e) { /* abaikan */ }
      this.storage.lsBytes = bytes;
      try {
        if (navigator.storage && typeof navigator.storage.estimate === 'function') {
          navigator.storage.estimate().then(est => {
            if (est && typeof est.usage === 'number') this.storage.quotaUsed = est.usage;
          }).catch(() => {});
        }
      } catch (e) { /* abaikan */ }
    },
    async resetFullAll() {
      this.storage.resetModal = false;
      this.topMenuOpen = false;
      try { if (this.pingTick) this.pingTick.stop(); } catch (e) { /* abaikan */ }
      try { if (window.AppPipe && window.AppPipe.closeDb) window.AppPipe.closeDb(); } catch (e) { /* abaikan */ }
      try {
        const rm = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && /^sca/i.test(k)) rm.push(k);
        }
        rm.forEach(k => localStorage.removeItem(k));
      } catch (e) { /* abaikan */ }
      try { sessionStorage.clear(); } catch (e) { /* abaikan */ }
      const dbs = [
        [PUP_DB, PUP_STORE],
        [SHP_DB, SHP_STORE],
        [WA_DB, WA_STORE],
        [SV_DB, SV_STORE],
        ['scaPipeLog', 'logs']
      ];
      for (const [dbName, storeName] of dbs) {
        try {
          await new Promise(res => {
            const req = indexedDB.open(dbName, 1);
            req.onsuccess = () => {
              const db = req.result;
              try {
                if (db.objectStoreNames.contains(storeName)) {
                  const tx = db.transaction(storeName, 'readwrite');
                  tx.objectStore(storeName).clear();
                  tx.oncomplete = () => { db.close(); res(); };
                  tx.onerror = () => { db.close(); res(); };
                } else { db.close(); res(); }
              } catch (e) { try { db.close(); } catch (e2) {} res(); }
            };
            req.onerror = () => res();
            req.onblocked = () => res();
          });
        } catch (e) { /* abaikan */ }
        try {
          await new Promise(res => {
            const del = indexedDB.deleteDatabase(dbName);
            const tm = setTimeout(res, 400);
            del.onsuccess = del.onerror = del.onblocked = () => { clearTimeout(tm); res(); };
          });
        } catch (e) { /* abaikan */ }
      }
      this.showToast('✓ ' + this.t('resetDoneMsg'));
      setTimeout(() => {
        const base = location.pathname + (this.lang === 'en' && !/(^|\/)en(\/|$)/.test(location.pathname) ? '?lang=en' : '');
        location.href = base || location.href.split('?')[0];
      }, 450);
    },
    swapDiff() {
      const tmp = this.diff.left;
      this.diff.left = this.diff.right;
      this.diff.right = tmp;
    },
    loadDiffSample() {
      if (this.diff.fmt === 'json') {
        this.diff.left = JSON.stringify({ service: 'payment-api', port: 8080, timeoutMs: 3000, features: { retry: false, webhook: true } }, null, 2);
        this.diff.right = JSON.stringify({ port: 8443, service: 'payment-api', timeoutMs: 5000, features: { webhook: true, retry: true, auditLog: true } }, null, 2);
      } else if (this.diff.fmt === 'env') {
        this.diff.left = 'PORT=8080\nLOG_LEVEL=debug\nCORS_ORIGIN=*\nRATE_LIMIT=100';
        this.diff.right = 'CORS_ORIGIN=https://app.internal.id\nLOG_LEVEL=info\nPORT=8443\nRATE_LIMIT=100\nSTRICT_TLS=true';
      } else {
        this.diff.left = 'const ALLOWED_ORIGIN = "*";\nconst MAX_RETRY = 2;\nfunction verify(token) {\n  return decodeJwt(token);\n}';
        this.diff.right = 'const ALLOWED_ORIGIN = "https://portal.example.co.id";\nconst MAX_RETRY = 5;\nfunction verify(token, secret) {\n  return verifyJwtHmac(token, secret);\n}';
      }
    },
    loadMaskSample() {
      this.diff.maskIn = [
        '# Contoh konfigurasi & log yang ingin dibagikan ke tim:',
        'DATABASE_URL=postgresql://admin:Sup3rS3cretDB!99@10.24.18.42:5432/prod_core',
        'STRIPE_SECRET_KEY=sk-test-sample_dummy_secret_key_1234567890',
        'ADMIN_EMAIL=budi.santoso@perusahaan.co.id',
        'ONCALL_WA=+62 812-3456-7890',
        'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMDI5MyIsInJvbGUiOiJhZG1pbiJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        'API_SECRET="my-ultra-secret-signing-key-2026"'
      ].join('\n');
    },
    copyMasked() {
      if (this.maskOut.output) navigator.clipboard.writeText(this.maskOut.output).catch(() => {});
    },
    sendMaskToDiff() {
      this.diff.left = this.diff.maskIn;
      this.diff.right = this.maskOut.output;
      this.diff.fmt = 'raw';
      this.diff.sub = 'diff';
    },
    copyHookScript() {
      navigator.clipboard.writeText(HOOK_SCRIPT)
        .then(() => { this.hookCopied = true; setTimeout(() => { this.hookCopied = false; }, 2000); })
        .catch(() => { this.hookMsg = tr('clip_fail'); });
    },
    // Isi target dari kotak curl. Kosong/bukan curl/tanpa URL = target dikosongkan, agar request
    // tidak pernah terkirim ke target lama.
    fillFromCurl(cfg, defMethod) {
      const txt = cfg.curl.trim(), r = /^curl\b/.test(txt) ? parseCurl(txt) : null;
      if (!txt) cfg.err = '';
      else if (!r) cfg.err = tr('curl_invalid');
      else cfg.err = r.url ? '' : tr('curl_nourl');
      cfg.method = (r && r.method) || defMethod; cfg.url = r ? r.url : ''; cfg.headers = r ? r.headers : []; cfg.body = r ? r.body : '';
      return r;
    },
    parseRlCurl() { this.fillFromCurl(this.rl, 'GET'); },
    copyRateScript() {
      navigator.clipboard.writeText(this.rateScript)
        .then(() => { this.rl.copied = true; setTimeout(() => { this.rl.copied = false; }, 2000); })
        .catch(() => { this.rl.msg = tr('clip_fail'); });
    },
    async runRateDirect() {
      const rl = this.rl, headers = {};
      rl.err = rateCfgError(rl);
      if (rl.err) return;
      rl.headers.forEach(([k, v]) => { if (!RATE_FORBIDDEN_HDR.test(k)) headers[k] = v; });
      const noBody = rl.method === 'GET' || rl.method === 'HEAD' || !rl.body;
      rl.busy = true; rl.stop = false; rl.results = [];
      for (let i = 1; i <= rl.count && !rl.stop; i++) {
        const t0 = performance.now();
        try {
          const res = await fetch(rl.url, { method: rl.method, headers, body: noBody ? undefined : rl.body, credentials: 'omit' });
          rl.results.push({ i, status: res.status, ms: Math.round(performance.now() - t0), retryAfter: res.headers.get('retry-after') });
        } catch (e) {
          rl.results.push({ i, status: 'error', ms: Math.round(performance.now() - t0), error: friendlyFetchError(e) });
        }
        if (i < rl.count && rl.delay && !rl.stop) await new Promise(r => setTimeout(r, rl.delay));
      }
      rl.busy = false;
    },
    copyRateCsv() {
      const lines = ['index,status,ms,retry_after', ...this.rl.results.map(r => [r.i, r.status, r.ms, r.retryAfter || ''].join(','))];
      navigator.clipboard.writeText(lines.join('\n'))
        .then(() => { this.rl.csvCopied = true; setTimeout(() => { this.rl.csvCopied = false; }, 2000); })
        .catch(() => { this.rl.msg = tr('clip_fail_short'); });
    },
    parseRtoCurl() {
      const r = this.fillFromCurl(this.rto, 'POST');
      this.rto.method = rtoMethod(this.rto.method);
      if (r && r.body) this.rto.sizeKb = clampNum(Math.ceil(new TextEncoder().encode(r.body).length / 1024), 1, 10240);
    },
    stopRto() { this.rto.stop = true; if (this.rto.ctl) this.rto.ctl.abort(); },
    async runRtoDirect() {
      const rto = this.rto, headers = {};
      rto.headers.forEach(([k, v]) => { if (!RATE_FORBIDDEN_HDR.test(k)) headers[k] = v; });
      rto.kbps = clampNum(rto.kbps, 2, 100000); rto.sizeKb = clampNum(rto.sizeKb, 1, 10240);
      rto.count = clampNum(rto.count, 1, 5); rto.delay = clampNum(rto.delay, 0, 10000);
      const method = rtoMethod(rto.method), bytes = rtoPayload(rto.body, rto.sizeKb);
      rto.busy = true; rto.stop = false; rto.results = [];
      for (let i = 1; i <= rto.count && !rto.stop; i++) {
        const ctl = new AbortController(); rto.ctl = ctl;
        let sent = 0; const t0 = performance.now();
        const body = slowBodyStream(bytes, rto.kbps, n => { sent = n; }, () => rto.stop);
        try {
          const res = await fetch(rto.url, { method, headers, body, duplex: 'half', credentials: 'omit', signal: ctl.signal });
          rto.results.push({ i, outcome: 'done', label: L('selesai (server tidak timeout)'), status: res.status, ms: Math.round(performance.now() - t0), sent, total: bytes.length });
        } catch (e) {
          const reset = !rto.stop && sent > 0 && sent < bytes.length;
          rto.results.push({ i, outcome: rto.stop ? 'stop' : reset ? 'reset' : 'error', status: '', ms: Math.round(performance.now() - t0), sent, total: bytes.length,
            label: rto.stop ? L('dihentikan') : reset ? L('koneksi diputus server (kemungkinan read timeout)') : friendlyFetchError(e) });
        }
        rto.ctl = null;
        if (i < rto.count && rto.delay && !rto.stop) await new Promise(r => setTimeout(r, rto.delay));
      }
      rto.busy = false;
    },
    copyRtoScript() {
      navigator.clipboard.writeText(this.rtoScript)
        .then(() => { this.rto.copied = true; setTimeout(() => { this.rto.copied = false; }, 2000); })
        .catch(() => { this.rto.msg = tr('clip_fail'); });
    },
    copyRtoCsv() {
      const lines = ['index,outcome,ms,sent,total,status', ...this.rto.results.map(r => [r.i, r.outcome, r.ms, r.sent, r.total, r.status].join(','))];
      navigator.clipboard.writeText(lines.join('\n'))
        .then(() => { this.rto.csvCopied = true; setTimeout(() => { this.rto.csvCopied = false; }, 2000); })
        .catch(() => { this.rto.msg = tr('clip_fail_short'); });
    },
    // ---- Cek Basic Middleware (uji konformansi defensif; ASVS V5 / CWE-20) ----
    mwSizes() { return mwSizeList(this.mw.sizesKb); },
    mwProbeName(p) {
      const base = tr('mw_p_' + (p.base || p.id));
      return p.payload ? base + ' · ' + p.payload : base;
    },
    mwVerdictClass(v) { return v === 'LULUS' ? 'ok' : v === 'GAGAL' ? 'sev-HIGH' : 'muted'; },
    mwUpsert(row) {
      const idx = this.mwResults.findIndex(r => r.key === row.key);
      if (idx >= 0) this.mwResults.splice(idx, 1, row); else this.mwResults.push(row);
    },
    mwDelay() { return new Promise(r => setTimeout(r, clampNum(this.mw.delayMs, 0, 5000))); },
    // Jalankan satu probe (opsional ukuran untuk keluarga escalating) lalu simpan hasilnya.
    async mwDo(probe, size) {
      const key = probe.id + (size != null ? '@' + size + 'kb' : '');
      const row = { key, probeId: probe.id, size: size || null, cat: probe.cat, name: this.mwProbeName(probe),
        surface: probe.surface, method: this.mw.method || 'POST', status: '', message: '', verdict: 'ERROR',
        expect: probe.st.join('/') + ' · ' + probe.msg };
      // Cookie-probe tak dapat diuji dari Opsi 1: browser melarang set header Cookie (gunakan Opsi 2).
      if (probe.cookie) { row.message = tr('mw_cookie_limited'); this.mwUpsert(row); return row; }
      const req = mwBuildReq(probe, this.mw, size || 2);
      try {
        const headers = new Headers();
        req.headers.forEach(([k, v]) => { try { headers.append(k, v); } catch (e) { /* header dilarang browser */ } });
        const noBody = req.method === 'GET' || req.method === 'HEAD';
        const res = await fetch(req.url, { method: req.method, headers, body: noBody ? undefined : req.body, credentials: 'omit' });
        row.status = res.status;
        let txt = ''; try { txt = await res.text(); } catch (e) { /* body tak terbaca */ }
        row.message = mwExtractMsg(txt);
        row.verdict = mwVerdictOf(res.status, false);
        // Header ganda via fetch digabung browser (bukan duplikat sejati) -> hasil kurang pasti.
        if (probe.limited === 'header') row.message = (row.message ? row.message + ' · ' : '') + tr('mw_header_merged');
      } catch (e) {
        row.status = 'error'; row.verdict = 'ERROR'; row.message = friendlyFetchError(e);
      }
      this.mwUpsert(row);
      return row;
    },
    // Jalankan semua probe sekuensial (ala spider ZAP) dengan jeda; keluarga escalating stop-on-first-block.
    async mwRunAll() {
      const mw = this.mw;
      mw.busy = true; mw.stop = false; this.mwResults = [];
      const sizes = this.mwSizes();
      for (const p of MW_PROBES) {
        if (mw.stop) break;
        if (p.escalating) {
          for (const sz of sizes) {
            if (mw.stop) break;
            const r = await this.mwDo(p, sz);
            if (r.verdict === 'LULUS') break; // sudah diblok -> ukuran lebih besar redundant
            await this.mwDelay();
          }
        } else {
          await this.mwDo(p, null);
        }
        if (!mw.stop) await this.mwDelay();
      }
      mw.busy = false;
    },
    // Ulangi hanya probe yang GAGAL/ERROR (tanpa mengganggu yang sudah LULUS).
    async mwRunFailed() {
      const mw = this.mw;
      const todo = this.mwResults.filter(r => r.verdict === 'GAGAL' || r.verdict === 'ERROR');
      mw.busy = true; mw.stop = false;
      for (const r of todo) {
        if (mw.stop) break;
        const p = MW_PROBES.find(x => x.id === r.probeId);
        if (p) { await this.mwDo(p, r.size); await this.mwDelay(); }
      }
      mw.busy = false;
    },
    mwStopRun() { this.mw.stop = true; },
    // Muat request satu probe ke editor manual (ala Postman) untuk diubah & dikirim ulang.
    mwLoadProbeToEditor(r) {
      const p = MW_PROBES.find(x => x.id === r.probeId);
      if (!p) return;
      const req = mwBuildReq(p, this.mw, r.size || 2);
      const ed = this.mw.editor;
      ed.method = req.method; ed.url = req.url;
      ed.headers = req.headers.map(([k, v]) => k + ': ' + v).join('\n');
      ed.body = (req.method === 'GET' || req.method === 'HEAD') ? '' : req.body;
      ed.msg = tr('mw_loaded');
    },
    async mwManualSend() {
      const ed = this.mw.editor;
      ed.busy = true; ed.error = ''; ed.status = null; ed.respHeaders = ''; ed.respBody = ''; ed.msg = '';
      try {
        const headers = new Headers();
        ed.headers.split(/\r?\n/).forEach(line => {
          const i = line.indexOf(':');
          if (i > 0) { try { headers.append(line.slice(0, i).trim(), line.slice(i + 1).trim()); } catch (e) { /* header dilarang */ } }
        });
        const noBody = ed.method === 'GET' || ed.method === 'HEAD' || !ed.body;
        const res = await fetch(ed.url, { method: ed.method || 'GET', headers, body: noBody ? undefined : ed.body, credentials: 'omit' });
        ed.status = res.status;
        const hs = []; res.headers.forEach((v, k) => hs.push(k + ': ' + v)); ed.respHeaders = hs.join('\n');
        ed.respBody = (await res.text()).slice(0, 4000);
      } catch (e) { ed.error = friendlyFetchError(e); }
      ed.busy = false;
    },
    copyMwScript() {
      navigator.clipboard.writeText(this.mwScript)
        .then(() => { this.mw.copied = true; setTimeout(() => { this.mw.copied = false; }, 2000); })
        .catch(() => { this.mw.msg = tr('clip_fail'); });
    },
    mwCopyCsv() {
      const head = ['category', 'name', 'method', 'surface', 'status', 'verdict', 'expect', 'message'];
      const rows = [head, ...this.mwResults.map(r => [r.cat, r.name, r.method, r.surface, r.status, r.verdict, r.expect, r.message])];
      const csv = '﻿' + rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
      navigator.clipboard.writeText(csv)
        .then(() => { this.mw.csvCopied = true; setTimeout(() => { this.mw.csvCopied = false; }, 2000); })
        .catch(() => { this.mw.msg = tr('clip_fail_short'); });
    },
    mwCopyJson() {
      navigator.clipboard.writeText(JSON.stringify(this.mwResults, null, 2))
        .then(() => { this.mw.jsonCopied = true; setTimeout(() => { this.mw.jsonCopied = false; }, 2000); })
        .catch(() => { this.mw.msg = tr('clip_fail_short'); });
    },
    toggleSide() {
      this.sideOpen = !this.sideOpen;
      try { localStorage.setItem(SIDE_OPEN_KEY, this.sideOpen ? '1' : '0'); } catch (e) { /* abaikan */ }
    },
    setSideW(w) {
      this.sideW = Math.min(SIDE_MAX, Math.max(SIDE_MIN, Math.round(w)));
      try { localStorage.setItem(SIDE_KEY, String(this.sideW)); } catch (e) { /* abaikan */ }
    },
    startResize(e) { this.resizing = true; e.target.setPointerCapture(e.pointerId); },
    doResize(e) {
      if (!this.resizing) return;
      // lebar panel kiri = posisi pointer dikurangi tepi kiri .layout (termasuk padding 20px)
      this.setSideW(e.clientX - e.target.closest('.layout').getBoundingClientRect().left - 20);
    },
    endResize() { this.resizing = false; },
    statLabel(a) {
      const s = this.stats[a.key];
      if (!s.calls) return tr('stat_notcalled');
      return s.calls + '× · ' + s.ok + ' ok' + (s.fail ? ' · ' + s.fail + ' ' + tr('stat_fail') : '');
    },
    grpText(g, f) { return trData('grp_' + g.key + '_' + f, g[f]); },
    apiText(a, f) { return trData('api_' + a.key + '_' + f, a[f]); },
    async runEol() {
      this.eolBusy = true; this.eolDone = false; this.eolResults = [];
      const seen = new Set(), rows = [];
      for (const it of this.activeItems) {
        detectedComponents(it).forEach(c => {
          if (!c.ver) return;
          const key = it.project + '|' + c.slug + '|' + c.ver;
          if (seen.has(key)) return;
          seen.add(key);
          rows.push({ project: it.project, file: it.name, slug: c.slug, label: c.label, ver: c.ver, from: c.from || '', license: COMPONENT_LICENSE[c.slug] || '', status: 'loading' });
        });
      }
      this.eolResults = rows;
      await pool(rows, 4, async row => { Object.assign(row, await eolCheck(row.slug, row.ver)); });
      rows.sort((a, b) => EOL_RANK[b.status] - EOL_RANK[a.status]);
      this.eolDone = true; this.eolBusy = false;
    },
    eolClass(s) { return s === 'eol' ? 'sev-HIGH' : s === 'soon' ? 'sev-MEDIUM' : s === 'ok' ? 'ok' : 'muted'; },
    licAllow(r) { const info = LICENSE_INFO[r.license]; return info ? info.allow.map(c => tr('lic_' + c)).join(', ') : '—'; },
    licLimit(r) { const info = LICENSE_INFO[r.license]; return info ? info.limit.map(c => tr('lic_' + c)).join(', ') : '—'; },
    eolStatusText(s) { return tr('eol_s_' + s); },
    eolDetail(r) {
      if (r.status === 'loading') return '…';
      if (r.status === 'unknown') return tr('eol_d_unknown');
      const latest = r.latest ? ' · ' + tr('eol_latest') + ' ' + r.latest : '';
      if (r.status === 'eol') return tr('eol_d_eol') + (r.eol && r.eol !== true ? ' (' + r.eol + ')' : '') + latest;
      if (r.status === 'soon') return tr('eol_d_soon').replace('{d}', r.days != null ? r.days : '?') + (r.eol ? ' (' + r.eol + ')' : '') + latest;
      return tr('eol_d_ok') + latest;
    },
    async runDast() {
      const links = this.dastText.split(/[\s,]+/).filter(Boolean).slice(0, 10);
      if (!links.length) return;
      // Validasi dulu: input salah tidak membuka tab laporan kosong.
      const bad = links.map(l => [l, dastTarget(l).error]).filter(x => x[1]);
      if (bad.length) { this.dastError = tr('dast_invalid_inputs') + bad.map(([l, e]) => '"' + l + '" (' + e + ')').join(', '); return; }
      const w = window.open('', '_blank');
      this.dastBusy = true; this.dastLogs = []; this.dastError = '';
      const log = m => this.dastLogs.push(m);
      try {
        const results = [];
        for (const l of links) results.push(await dastCheck(l, log, { net: this.dastNet }));
        this.dastLast = Vue.markRaw(results);
        const html = buildDastReport(results, this.dastExtra());
        if (this.dastUrl) URL.revokeObjectURL(this.dastUrl);
        this.dastUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        const d = new Date(), p2 = n => String(n).padStart(2, '0');
        this.dastName = d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '_' + p2(d.getHours()) + p2(d.getMinutes()) + '_laporan_dast.html';
        log(tr('log_done'));
        if (w) w.location.href = this.dastUrl; else log(tr('log_popup_blocked'));
      } catch (e) {
        this.dastError = Lf('Pemeriksaan gagal: {x}', { x: e.message });
        if (w) w.close();
      } finally { this.dastBusy = false; }
    },
    vpnCopy(text, id) {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(() => { this.vpn.copied = id; setTimeout(() => { if (this.vpn.copied === id) this.vpn.copied = ''; }, 1500); }).catch(() => { /* abaikan */ });
    },
    skipSaveAuto() { try { localStorage.setItem('scaSkipAuto', this.skip.auto ? '1' : '0'); } catch (e) { /* abaikan */ } },
    // ---- DAST: Clickjacking PoC + JS Bundle Recon
    dastExtra() { return { cj: Object.assign({}, this.cj.marks), jsr: this.jsr.res }; },
    jsrReportOpen() {
      const w = window.open('', '_blank');
      const html = buildDastReport(this.dastLast || [], this.dastExtra());
      if (this.dastUrl) URL.revokeObjectURL(this.dastUrl);
      this.dastUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      const d = new Date(), p2 = n => String(n).padStart(2, '0');
      this.dastName = d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '_' + p2(d.getHours()) + p2(d.getMinutes()) + '_laporan_dast.html';
      if (w) w.location.href = this.dastUrl; else this.dastLogs.push(tr('log_popup_blocked'));
    },
    cjLoad() {
      this.cj.err = '';
      if (!this.cjTarget) { this.cj.err = this.t('cj_bad_url'); return; }
      this.cj.shown = this.cjTarget;
    },
    cjMark(m) { if (this.cj.shown) this.cj.marks = Object.assign({}, this.cj.marks, { [this.cj.shown]: m }); },
    cjDownload() {
      const u = this.cjTarget;
      if (!u) return;
      pupDownload('clickjacking-poc-' + new URL(u).hostname + '.html', cjPocHtml(u, { howto: this.t('cj_poc_howto'), bait: this.t('cj_bait') }), 'text/html');
    },
    jsrInit() {
      window.addEventListener('message', e => { this.jsrOnMessage(e); });
      if (location.hash === '#jsr-hook') { this.visibleTabs.dast = true; this.tab = 'dast'; try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* abaikan */ } }
    },
    // Target bisa situs mana pun, jadi origin tidak di-allow-list; data hanya teks yang disanitasi (jsrClean) dan ditampilkan ter-escape.
    jsrOnMessage(e) {
      const d = e.data;
      if (!d || typeof d !== 'object' || !e.source || !/^https?:\/\//.test(e.origin || '')) return;
      if (d.type === 'jsr-hello') {
        try { e.source.postMessage({ type: 'jsr-ack' }, e.origin); if (window.AppPipe) window.AppPipe.recordPostOut(e.origin, { type: 'jsr-ack' }, 'JS Recon'); } catch (err) { /* tab ditutup */ }
        if (this.tab !== 'dast') { this.visibleTabs.dast = true; this.tab = 'dast'; }
        return;
      }
      if (d.type === 'jsr-data') this.jsrSet(d.data, e.origin);
    },
    jsrSet(raw, from) {
      const c = jsrClean(raw);
      if (!c || !c.files.length) { this.jsr.err = this.t('jsr_bad'); return; }
      if (from) c.origin = from;
      this.jsr.err = '';
      this.jsr.res = Vue.markRaw(jsrAnalyze(c));
      this.jsr.msg = this.t('jsr_got').replace('{p}', c.page || from || '-').replace('{n}', c.files.length);
    },
    async jsrPick(ev) {
      const fs = Array.from(ev.target.files || []);
      ev.target.value = '';
      if (!fs.length) return;
      const files = [];
      for (const f of fs) {
        const t = await f.text();
        let j = null;
        if (/\.(json|map)$/i.test(f.name)) { try { j = JSON.parse(t); } catch (e) { j = null; } }
        if (j && Array.isArray(j.files)) { this.jsrSet(j, ''); return; }
        if (j && (j.mappings !== undefined || j.sections)) {
          const src = Array.isArray(j.sources) ? j.sources : [], sc = Array.isArray(j.sourcesContent) ? j.sourcesContent : [], parts = [];
          src.forEach((x, i) => { if (typeof sc[i] === 'string') parts.push('/* ==== ' + x + ' ==== */\n' + sc[i]); });
          files.push({ url: f.name, status: 200, size: t.length, text: '', map: { url: f.name, status: 200, exposed: true, info: { sources: src, nSources: src.length, withContent: parts.length, content: parts.join('\n') } } });
        } else files.push({ url: f.name, status: 200, size: t.length, text: t, map: null });
      }
      this.jsrSet({ page: fs.map(f => f.name).join(', ').slice(0, 300), origin: '', at: Date.now(), files }, '');
    },
    jsrShow(f) { return f.kind === 'secret' && !this.jsr.full ? jsrMask(f.value) : f.value; },
    jsrCopyEps() { if (navigator.clipboard) navigator.clipboard.writeText(this.jsrEps.map(e => e.path).join('\n')).catch(() => { /* abaikan */ }); },
    jsrToSwag() {
      const r = this.jsr.res;
      if (!r) return;
      this.swagLoad(JSON.stringify(jsrOpenApi(Object.assign({}, r, { endpoints: this.jsrEps }))), '', 'js-recon.json');
      this.visibleTabs.swag = true;
      this.tab = 'swag';
    },
    groupApis(g) { return this.apis.filter(a => a.group === g.key); },
    toggleAllDetail() {
      const open = !this.allDetailOpen;
      this.apis.forEach(a => { this.openKeys[a.key] = open; });
    },
    async fetchUrls() {
      const links = this.urlText.split(/[\s,]+/).filter(Boolean);
      if (!links.length) return;
      this.urlBusy = true; this.urlLogs = []; this.error = '';
      const log = m => this.urlLogs.push(m);
      let added = 0;
      for (const link of links) {
        try {
          log('== ' + link);
          const files = await fetchFromUrl(link, this.token.trim(), log);
          files.forEach(f => { this.addItem(f.name, f.text, this.project.trim() || projectFromLink(link)); added++; });
        } catch (e) { log(tr('failed') + ': ' + e.message); }
      }
      log(added ? Lf('{n} file ditambahkan ke daftar. Klik "Scan & buka laporan".', { n: added }) : L('Tidak ada file yang ditambahkan.'));
      if (added) this.urlText = '';
      this.urlBusy = false;
    },
    // Kunci unik = project + nama file (tanpa beda huruf besar/kecil); duplikat menggantikan yang lama.
    addItem(name, text, project) {
      const c = itemContent(name, text);
      const proj = (project || this.project).trim() || projectFromContent(c.type, text) || DEFAULT_PROJECT;
      const old = this.items.find(x => sameItemKey(x, { project: proj, name }));
      const fresh = { id: old ? old.id : this.nextId++, project: proj, ...c, enabled: old ? old.enabled : true };
      if (old) Object.assign(old, fresh); else this.items.push(fresh);
      if (fresh.parseError) this.error = tr('it_parse_err_msg').replace('{x}', name).replace('{e}', fresh.parseError);
    },
    // Unggah ulang satu baris: isi diganti, project & status centang tetap; baris lain
    // dengan project + nama sama (bila nama file berubah) dibuang agar tidak duplikat.
    askReupload(it) { this.reupId = it.id; this.$refs.reup.click(); },
    async onReupload(e) {
      const f = e.target.files[0], it = this.items.find(x => x.id === this.reupId);
      e.target.value = ''; this.reupId = null; this.error = ''; this.dropMsg = '';
      if (!f || !it) return;
      if (f.size > MAX_FILE_BYTES) { this.error = tr('msg_files_big').replace('{n}', 1); return; }
      Object.assign(it, itemContent(f.name, await f.text()));
      this.items = this.items.filter(x => x === it || !sameItemKey(x, it));
      this.dropMsg = tr('it_reup_done').replace('{x}', f.name);
    },
    // Edit sel Project/File: klik dua kali, Enter simpan, Esc batal (blur ikut menyimpan).
    // Centang/lepas semua baris sekaligus (checkbox di header kolom Scan).
    setAllEnabled(on) { this.items.forEach(it => { it.enabled = on; }); },
    startEdit(it, field) { this.edit = { id: it.id, field, value: it[field] }; },
    isEditing(it, field) { return this.edit.id === it.id && this.edit.field === field; },
    cancelEdit() { this.edit = { id: null, field: '', value: '' }; },
    commitEdit() {
      const { id, field } = this.edit, v = String(this.edit.value).trim();
      if (id == null) return;
      this.cancelEdit();
      const it = this.items.find(x => x.id === id);
      if (!it || !v || v === it[field]) return;
      if (this.items.some(x => x.id !== id && sameItemKey(x, { ...it, [field]: v }))) { this.error = tr('it_edit_dup'); return; }
      it[field] = v; this.error = '';
    },
    detectedText(it) {
      const list = detectedComponents(it).map(c => c.label + ' ' + c.ver);
      if (!it.runtimes && RUNTIME_TYPES.includes(it.type)) list.push(tr('it_reup_hint'));
      return list.join(', ') || '—';
    },
    L(s) { return L(s); },
    // Yang sudah tersimpan diprioritaskan; file baru yang tidak muat tetap dipakai di sesi ini tetapi hilang saat halaman dimuat ulang.
    saveItems() {
      const kept = new Set(this.persistedIds);
      const ordered = [...this.items].sort((a, b) => (kept.has(b.id) - kept.has(a.id)) || a.id - b.id);
      const chosen = [];
      let used = 2;
      for (const it of ordered) {
        const n = JSON.stringify(it).length + 1;
        if (used + n <= STORAGE_BUDGET) { chosen.push(it); used += n; }
      }
      const write = list => { try { localStorage.setItem(ITEMS_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } };
      while (chosen.length && !write(chosen)) chosen.pop(); // kuota nyata lebih kecil dari perkiraan
      this.persistedIds = chosen.map(it => it.id);
      const saved = new Set(this.persistedIds);
      this.unsavedIds = this.items.filter(it => !saved.has(it.id)).map(it => it.id);
    },
    // filterImportant=true -> hanya file dependency yang dikenali yang diambil
    // (dipakai saat menyeret folder / banyak file sekaligus).
    async readFiles(list, filterImportant) {
      const toAdd = [];
      let skipped = 0, big = 0;
      for (const f of Array.from(list)) {
        if (filterImportant && !isImportantByName(f.name)) { skipped++; continue; }
        if (f.size > MAX_FILE_BYTES) { big++; continue; }
        toAdd.push(f);
      }
      for (const f of toAdd) this.addItem(f.name, await f.text());
      if (big) this.error = tr('msg_files_big').replace('{n}', big);
      else if (filterImportant && !toAdd.length) this.error = tr('msg_no_dep');
      this.dropMsg = filterImportant
        ? tr('msg_added').replace('{n}', toAdd.length) + (skipped ? tr('msg_skipped_auto').replace('{n}', skipped) : '')
        : '';
    },
    async onDrop(e) {
      this.over = false; this.error = ''; this.dropMsg = '';
      const dt = e.dataTransfer;
      // Ambil entry (file/folder) secara sinkron selagi event masih hidup.
      const entries = dt.items ? Array.from(dt.items).map(it => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean) : [];
      // Folder, atau banyak file: telusuri & saring ke file dependency saja.
      if (entries.length && (entries.some(en => en.isDirectory) || entries.length > 1)) {
        const picked = [];
        for (const en of entries) await walkEntry(en, f => picked.push(f), 0);
        this.readFiles(picked, true);
        return;
      }
      if (dt.files && dt.files.length) { this.readFiles(dt.files, dt.files.length > 1); return; }
      const link = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').trim();
      if (link.startsWith('http')) { this.urlText = link; this.fetchUrls(); }
    },
    onPick(e) { this.error = ''; this.dropMsg = ''; const fl = e.target.files; this.readFiles(fl, fl.length > 1); e.target.value = ''; },
    addPaste() {
      const name = this.pasteName.trim();
      this.addItem(name || 'tempelan', this.pasteText);
      this.pasteText = ''; this.pasteName = '';
    },
    async scanItem(it, opts) {
      const res = { name: it.project + ' / ' + it.name, type: it.type, entries: [], skipped: 0 };
      const log = m => this.log(m);
      try {
        if (it.type === 'docker') { res.docker = await analyzeDocker(it.text, log, opts); return res; }
        const parse = PARSERS[it.type];
        if (!parse) throw new Error(tr('err_unknown_type'));
        let pkgs = it.compact ? expandCompact(it.text) : parse(it.text);
        res.note = TYPE_NOTES[it.type] || '';
        const skipNote = pkgs.unpinned ? Lf('{n} baris tidak dipin dan dilewati.', { n: pkgs.unpinned }) + ((pkgs.skipped || []).length ? ' (' + pkgs.skipped.slice(0, 8).join(', ') + (pkgs.skipped.length > 8 ? ', …' : '') + ')' : '') : '';
        if (skipNote) res.note += ' ' + skipNote;
        if (opts.omitDev) { const n = pkgs.length; pkgs = pkgs.filter(p => !p.dev); res.skipped = n - pkgs.length; }
        log(Lf('{x}: {n} package terbaca', { x: it.name, n: pkgs.length }) + (skipNote ? ' — ' + skipNote : ''));
        if (!pkgs.length) throw new Error(tr('err_no_packages') + (TYPE_NOTES[it.type] ? ' ' + TYPE_NOTES[it.type] : ''));
        if (opts.license) await enrichLicenses(pkgs, log);
        res.entries = await scanPackages(pkgs, log, opts);
      } catch (e) { res.error = e.message; log('  ' + tr('failed') + ': ' + e.message); }
      return res;
    },
    async runScan() {
      // buka tab dulu (sinkron saat klik) supaya tidak diblokir popup blocker
      const w = window.open('', '_blank');
      this.scanning = true; this.error = ''; this.logs = [];
      const opts = { omitDev: this.omitDev, enrich: this.enrich, license: this.license };
      try {
        const results = [];
        for (const it of this.activeItems) { this.log('== ' + it.project + ' / ' + it.name); results.push(await this.scanItem(it, opts)); }
        const html = buildReport(results, opts);
        if (this.reportUrl) URL.revokeObjectURL(this.reportUrl);
        this.reportUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        const d = new Date(), p = n => String(n).padStart(2, '0');
        this.reportName = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + '_laporan_scan.html';
        this.log(tr('log_done'));
        if (w) w.location.href = this.reportUrl;
        else this.log(tr('log_popup_blocked'));
      } catch (e) {
        this.error = Lf('Scan gagal: {x}', { x: e.message });
        if (w) w.close();
      } finally { this.scanning = false; }
    },
    // SBOM dari file aktif (tanpa Dockerfile): package unik per ekosistem+nama+versi, lisensi dilengkapi bila opsi aktif.
    async downloadSbom(fmt) {
      this.sbomBusy = true; this.error = ''; this.logs = [];
      try {
        const uniq = new Map();
        this.activeItems.forEach(it => itemPackages(it).forEach(p => {
          if (this.omitDev && p.dev) return;
          const k = p.eco + '|' + p.name + '|' + p.version, old = uniq.get(k);
          if (old) { old.dev = old.dev && p.dev; old.license = old.license || p.license; } else uniq.set(k, { ...p });
        }));
        const pkgs = [...uniq.values()];
        if (!pkgs.length) throw new Error(tr('err_no_packages'));
        if (this.license) await enrichLicenses(pkgs, m => this.log(m));
        const project = [...new Set(this.activeItems.map(it => it.project))].join(', ');
        const doc = fmt === 'spdx' ? buildSpdx(pkgs, project) : buildCycloneDx(pkgs, project);
        const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url; a.download = project.replace(/[^\w.-]+/g, '_').slice(0, 60) + (fmt === 'spdx' ? '.spdx.json' : '.cdx.json');
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.log(tr('sbom_done').replace('{n}', pkgs.length));
      } catch (e) { this.error = e.message; } finally { this.sbomBusy = false; }
    },
    scanSast() {
      this.sastResults = sastScan(this.codeText);
      this.sastDone = true;
    }
  }
}).directive('focus', { mounted(el) { el.focus(); el.select(); } }).mount('#app');
