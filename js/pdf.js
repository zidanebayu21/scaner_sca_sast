// PDF Tools: gabung, pisah, putar, urutkan, kompres, dan watermark PDF di browser (file tidak diunggah).
// Library dimuat sekali dari jsDelivr saat tab dipakai: pdf-lib (menyusun PDF) dan pdf.js (thumbnail + kompres).
// Versi dikunci dan diberi SRI, jadi skrip CDN yang isinya berubah ditolak browser.
const PDF_CDN = 'https://cdn.jsdelivr.net/npm/';
const PDF_LIBS = {
  lib: { src: PDF_CDN + 'pdf-lib@1.17.1/dist/pdf-lib.min.js', sri: 'sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI' },
  js: { src: PDF_CDN + 'pdfjs-dist@3.11.174/build/pdf.min.js', sri: 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e' },
  worker: { src: PDF_CDN + 'pdfjs-dist@3.11.174/build/pdf.worker.min.js', sri: 'sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2' }
};
// batas agar file besar/berhalaman banyak tidak membuat tab kehabisan memori
const PDF_LIM = { size: 300 << 20, pages: 3000, thumbW: 150, pixels: 16e6 };
const PDF_LOADING = {};
function pdfLoadLib(k) {
  if (PDF_LOADING[k]) return PDF_LOADING[k];
  const lib = PDF_LIBS[k];
  PDF_LOADING[k] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = lib.src; s.integrity = lib.sri; s.crossOrigin = 'anonymous';
    s.onload = () => res(); s.onerror = () => { delete PDF_LOADING[k]; rej(new Error('CDN ' + lib.src)); };
    document.head.appendChild(s);
  }).then(() => (k === 'js' ? pdfWorkerSetup() : null));
  return PDF_LOADING[k];
}
// worker pdf.js diunduh lewat fetch ber-SRI lalu dijalankan dari blob (worker lintas-origin tidak bisa dimuat langsung)
async function pdfWorkerSetup() {
  const w = PDF_LIBS.worker, r = await fetch(w.src, { integrity: w.sri });
  if (!r.ok) throw new Error('CDN ' + w.src);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([await r.arrayBuffer()], { type: 'text/javascript' }));
}
function pdfKind(f) {
  const n = (f.name || '').toLowerCase(), t = f.type || '';
  if (t === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf';
  if (t === 'image/png') return 'png';
  if (t === 'image/jpeg') return 'jpg';
  return t.indexOf('image/') === 0 ? 'img' : '';
}
function pdfCanvasBytes(c, type, q) {
  return new Promise((res, rej) => c.toBlob(b => (b ? b.arrayBuffer().then(a => res(new Uint8Array(a))) : rej(new Error('canvas'))), type, q));
}
async function pdfImageCanvas(bytes, scale) {
  const bmp = await createImageBitmap(new Blob([bytes])), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(bmp.height * scale));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}
function pdfHexRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '') || [0, '80', '80', '80'];
  return window.PDFLib.rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}
// teks diagonal di tengah halaman, ukuran menyesuaikan lebar halaman
function pdfWatermark(page, font, text, wm) {
  const { width: w, height: h } = page.getSize(), a = Math.atan2(h, w);
  const size = Math.min(0.75 * Math.hypot(w, h) / font.widthOfTextAtSize(text, 1), h / 5), tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: w / 2 - Math.cos(a) * tw / 2 + Math.sin(a) * size * 0.35, y: h / 2 - Math.sin(a) * tw / 2 - Math.cos(a) * size * 0.35,
    size, font, color: pdfHexRgb(wm.color), opacity: Math.min(100, Math.max(5, wm.op || 25)) / 100, rotate: window.PDFLib.radians(a)
  });
}
const pdfAngle = a => ((a % 360) + 360) % 360;
// titik di tampilan halaman (kiri-atas, satuan pt, setelah diputar A derajat searah jarum jam) -> koordinat PDF (kiri-bawah, sebelum diputar)
const PDF_ROT_MAP = {
  0: (dx, dy, W, H) => [dx, H - dy],
  90: (dx, dy) => [dy, dx],
  180: (dx, dy, W) => [W - dx, dy],
  270: (dx, dy, W, H) => [W - dy, H - dx]
};
const PDF_INK = { orig: null, black: [17, 17, 17], blue: [29, 63, 168] };
// kecerahan piksel bila ditaruh di atas kertas putih (piksel transparan dianggap putih)
function pdfLum(p, i) { const a = p[i + 3] / 255; return (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) * a + 255 * (1 - a); }
// batas tinta/kertas otomatis (metode Otsu pada histogram kecerahan)
function pdfOtsu(p) {
  const hist = new Float64Array(256), n = p.length / 4;
  let sum = 0, sB = 0, wB = 0, best = 0, thr = 128;
  for (let i = 0; i < p.length; i += 4) hist[Math.round(pdfLum(p, i))]++;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  for (let t = 0; t < 256 && wB < n; t++) {
    wB += hist[t]; sB += t * hist[t];
    const wF = n - wB;
    if (wB && wF) { const v = wB * wF * (sB / wB - (sum - sB) / wF) ** 2; if (v > best) { best = v; thr = t; } }
  }
  return thr;
}
// latar tanda tangan dibuat transparan (tepi halus), tinta bisa diganti warna, lalu dipotong pas ke goresan
function pdfSigCut(src, thr, ink) {
  const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h), p = d.data, soft = Math.max(16, thr * 0.25), rgb = PDF_INK[ink];
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < p.length; i += 4) {
    const al = Math.max(0, Math.min(1, (thr - pdfLum(p, i)) / soft));
    if (rgb) { p[i] = rgb[0]; p[i + 1] = rgb[1]; p[i + 2] = rgb[2]; }
    p[i + 3] = Math.round(al * 255);
    if (al > 0.2) { const n = i >> 2, x = n % w, y = (n - x) / w; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (x1 < 0) return null;
  const full = document.createElement('canvas'); full.width = w; full.height = h; full.getContext('2d').putImageData(d, 0, 0);
  const cx = Math.max(0, x0 - 6), cy = Math.max(0, y0 - 6), cw = Math.min(w, x1 + 7) - cx, ch = Math.min(h, y1 + 7) - cy;
  const out = document.createElement('canvas'); out.width = cw; out.height = ch; out.getContext('2d').drawImage(full, cx, cy, cw, ch, 0, 0, cw, ch);
  return out;
}
function pdfDataBytes(url) { const b = atob(url.split(',')[1]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
// gambar pertama dari clipboard (tombol Tempel di panel tanda tangan)
async function clipImageFile() {
  for (const it of await navigator.clipboard.read()) {
    const ty = it.types.find(t => t.indexOf('image/') === 0);
    if (ty) return new File([await it.getType(ty)], 'paste.' + ty.split('/')[1], { type: ty });
  }
  return null;
}
// "1-3, 7, 10-" -> himpunan indeks (0-based) pada urutan halaman saat ini
function pdfParseRange(text, total) {
  const out = new Set();
  String(text || '').split(/[,;\s]+/).filter(Boolean).forEach(part => {
    const m = /^(\d*)(-?)(\d*)$/.exec(part); if (!m || (!m[1] && !m[3])) return;
    const a = m[1] ? +m[1] : 1, b = m[2] ? (m[3] ? +m[3] : total) : a;
    for (let i = Math.max(1, Math.min(a, b)); i <= Math.min(total, Math.max(a, b)); i++) out.add(i - 1);
  });
  return out;
}

const PDF_METHODS = {
  pdfInit() {
    this.pdfSrc = []; this.pdfSeq = 0; this.pdfThumbRun = false; this.pdfSigSrc = {}; this.pdfSigJust = 0;
    // Ctrl+V di tab PDF: gambar jadi tanda tangan saat panel tanda tangan terbuka, selain itu file jadi halaman baru
    document.addEventListener('paste', e => {
      const files = [...((e.clipboardData && e.clipboardData.files) || [])];
      if (this.tab !== 'pdf' || !files.length) return;
      e.preventDefault();
      const img = files.find(f => f.type.indexOf('image/') === 0);
      if (!this.pdf.sign.open) this.pdfAdd(files);
      else if (img) this.pdfSigLoad(img);
    });
  },
  onPdfDrop(ev) { this.pdf.over = false; this.pdfAdd([...(ev.dataTransfer.files || [])]); },
  onPdfPick(ev) { const files = [...(ev.target.files || [])]; ev.target.value = ''; this.pdfAdd(files); },
  async pdfAdd(files) {
    const p = this.pdf, ok = files.filter(f => pdfKind(f));
    p.err = ''; p.msg = '';
    if (!ok.length) { p.err = this.t('pdf_e_type'); return; }
    p.busy = this.t('pdf_loading'); p.prog = 0;
    try {
      await pdfLoadLib('lib');
      for (const f of ok) await this.pdfAddOne(f);
    } catch (e) { p.err = e.message || String(e); }
    p.busy = '';
    this.pdfThumbs();
  },
  async pdfAddOne(f) {
    if (f.size > PDF_LIM.size) throw new Error(f.name + ': ' + this.t('pdf_e_big'));
    const src = { name: f.name || 'file', kind: pdfKind(f), bytes: new Uint8Array(await f.arrayBuffer()) };
    let n = 1, thumb = '', ar = [];
    if (src.kind === 'pdf') {
      try { src.doc = await window.PDFLib.PDFDocument.load(src.bytes); } catch (e) { throw new Error(f.name + ': ' + (/encrypt/i.test(e.message) ? this.t('pdf_e_enc') : this.t('pdf_e_open'))); }
      n = src.doc.getPageCount();
      // rasio lebar/tinggi halaman seperti tampil (CropBox + rotasi bawaan), untuk posisi tanda tangan
      ar = src.doc.getPages().map(pp => { const b = pp.getCropBox(); return pdfAngle(pp.getRotation().angle) % 180 ? b.height / b.width : b.width / b.height; });
    } else {
      // format selain PNG/JPG (WebP, GIF, BMP, ...) diubah ke PNG karena PDF hanya menerima PNG/JPG
      if (src.kind === 'img') { src.bytes = await pdfCanvasBytes(await pdfImageCanvas(src.bytes, 1), 'image/png'); src.kind = 'png'; }
      const bmp = await createImageBitmap(new Blob([src.bytes]));
      src.w = bmp.width; src.h = bmp.height; ar = [bmp.width / bmp.height]; bmp.close();
      thumb = src.url = URL.createObjectURL(new Blob([src.bytes], { type: src.kind === 'jpg' ? 'image/jpeg' : 'image/png' }));
    }
    if (this.pdf.pages.length + n > PDF_LIM.pages) throw new Error(this.t('pdf_e_many').replace('{n}', PDF_LIM.pages));
    const si = this.pdfSrc.push(src) - 1;
    for (let i = 0; i < n; i++) this.pdf.pages.push({ id: ++this.pdfSeq, src: si, n: i, rot: 0, sel: false, thumb, ar: ar[i] || 1, signs: [] });
  },
  pdfJsDoc(src) { if (!src.js) src.js = window.pdfjsLib.getDocument({ data: src.bytes.slice() }).promise; return src.js; },
  // render satu halaman PDF ke canvas: opt.w = lebar piksel, atau opt.scale (1 = 72 dpi); opt.rot = putaran tambahan
  async pdfRender(pg, opt) {
    const page = await (await this.pdfJsDoc(this.pdfSrc[pg.src])).getPage(pg.n + 1), rotation = (page.rotate + (opt.rot || 0)) % 360;
    const base = page.getViewport({ scale: 1, rotation });
    const scale = Math.min(opt.w ? opt.w / base.width : opt.scale, Math.sqrt(PDF_LIM.pixels / (base.width * base.height)));
    const vp = page.getViewport({ scale, rotation }), c = document.createElement('canvas');
    c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    return { c, w: base.width, h: base.height };
  },
  // thumbnail dibuat satu per satu di latar; bila pdf.js gagal dimuat, halaman tetap bisa diatur tanpa thumbnail
  async pdfThumbs() {
    if (this.pdfThumbRun) return;
    this.pdfThumbRun = true;
    try {
      await pdfLoadLib('js');
      for (let pg; (pg = this.pdf.pages.find(x => !x.thumb));) {
        try { pg.thumb = (await this.pdfRender(pg, { w: PDF_LIM.thumbW })).c.toDataURL('image/jpeg', 0.7); } catch (e) { pg.thumb = '-'; }
      }
    } catch (e) { this.pdf.msg = this.t('pdf_no_thumb'); }
    this.pdfThumbRun = false;
  },
  pdfName(pg) { const s = this.pdfSrc[pg.src]; return s.kind === 'pdf' ? s.name + ' · ' + (pg.n + 1) : s.name; },
  pdfSelN() { return this.pdf.pages.filter(x => x.sel).length; },
  // aksi massal berlaku untuk halaman terpilih; bila tidak ada yang dipilih, berlaku untuk semua
  pdfScope() { const s = this.pdf.pages.filter(x => x.sel); return s.length ? s : this.pdf.pages; },
  pdfSelAll(v) { this.pdf.pages.forEach(x => { x.sel = v; }); },
  pdfSelRange() { const set = pdfParseRange(this.pdf.range, this.pdf.pages.length); this.pdf.pages.forEach((x, i) => { x.sel = set.has(i); }); },
  // putar 90° searah jarum jam; tanda tangan ikut berpindah supaya tetap di tempat yang sama pada isi halaman
  pdfRot(list) {
    list.forEach(x => {
      const d = this.pdfDisp(x);
      x.signs.forEach(s => { const cx = s.cx; s.cx = 1 - s.cy; s.cy = cx; s.fw = Math.min(1, s.fw * d); });
      x.rot = (x.rot + 90) % 360;
    });
    if (this.pdf.sign.open && list.some(x => x.id === this.pdf.sign.pid)) this.pdfSignShow();
  },
  pdfDel(list) {
    const ids = new Set(list.map(x => x.id));
    this.pdf.pages = this.pdf.pages.filter(x => !ids.has(x.id));
    if (this.pdf.sign.open && !this.pdfSignPage()) { this.pdf.sign.pid = this.pdf.pages.length ? this.pdf.pages[0].id : null; this.pdfSignShow(); }
  },
  pdfMove(from, to) { const a = this.pdf.pages; if (to < 0 || to >= a.length || from === to) return; a.splice(to, 0, a.splice(from, 1)[0]); },
  pdfDropOn(i, ev) {
    const from = this.pdf.drag; this.pdf.drag = -1;
    if (from >= 0) this.pdfMove(from, i); else this.onPdfDrop(ev);
  },
  pdfClear() {
    this.pdfSrc.forEach(s => { if (s.url) URL.revokeObjectURL(s.url); if (s.js) s.js.then(d => d.destroy()).catch(() => { /* sudah ditutup */ }); });
    this.pdfSrc = []; this.pdf.pages = []; this.pdf.err = ''; this.pdf.msg = '';
    Object.assign(this.pdf.sign, { open: false, pid: null, bg: '' });
  },
  // ---- tanda tangan: sumber (foto/tempel/gambar langsung) -> PNG transparan -> ditaruh per halaman
  pdfDisp(pg) { return pg.rot % 180 ? 1 / pg.ar : pg.ar; },
  pdfSigCur() { return this.pdf.sigs.find(x => x.id === this.pdf.sign.active) || null; },
  pdfSigById(id) { return this.pdf.sigs.find(x => x.id === id) || {}; },
  pdfSignPage() { return this.pdf.pages.find(x => x.id === this.pdf.sign.pid) || null; },
  pdfSignIdx() { return this.pdf.pages.findIndex(x => x.id === this.pdf.sign.pid); },
  onPdfSigPick(ev) { const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (f) this.pdfSigLoad(f); },
  async pdfSigPaste() {
    let f = null;
    try { f = await clipImageFile(); } catch (e) { /* izin clipboard ditolak */ }
    if (f) this.pdfSigLoad(f); else this.pdf.err = this.t('pdf_sig_no_clip');
  },
  async pdfSigLoad(file) {
    try {
      const bmp = await createImageBitmap(file), s = Math.min(1, 1400 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
      c.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
      this.pdfSigFrom(c);
    } catch (e) { this.pdf.err = this.t('pdf_sig_e_load') + ' ' + (e.message || e); }
  },
  pdfSigFrom(c) {
    const id = ++this.pdfSeq, otsu = pdfOtsu(c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data);
    this.pdfSigSrc[id] = c;
    this.pdf.sigs.push({ id, url: '', w: 1, h: 1, thr: Math.max(60, Math.min(235, otsu + 15)), ink: 'orig' });
    const sg = this.pdf.sigs[this.pdf.sigs.length - 1];
    if (this.pdfSigRedo(sg)) this.pdf.sign.active = id; else this.pdfSigDel(sg);
    if (!this.pdf.sign.pid && this.pdf.pages.length) this.pdfSignOpen(this.pdf.pages[0]);
  },
  pdfSigRedo(sg) {
    if (!sg) return false;
    const c = pdfSigCut(this.pdfSigSrc[sg.id], sg.thr, sg.ink);
    if (!c) { this.pdf.err = this.t('pdf_sig_empty'); return false; }
    this.pdf.err = ''; sg.url = c.toDataURL('image/png'); sg.w = c.width; sg.h = c.height;
    return true;
  },
  pdfSigSet(k, v) { const sg = this.pdfSigCur(); if (!sg) return; sg[k] = v; clearTimeout(this.pdfSigT); this.pdfSigT = setTimeout(() => this.pdfSigRedo(sg), 120); },
  pdfSigDel(sg) {
    this.pdf.sigs = this.pdf.sigs.filter(x => x.id !== sg.id);
    this.pdf.pages.forEach(pg => { pg.signs = pg.signs.filter(s => s.sig !== sg.id); });
    delete this.pdfSigSrc[sg.id];
    if (this.pdf.sign.active === sg.id) this.pdf.sign.active = this.pdf.sigs.length ? this.pdf.sigs[0].id : null;
  },
  async pdfSignOpen(pg) { this.pdf.sign.open = true; if (pg) this.pdf.sign.pid = pg.id; await this.pdfSignShow(); },
  pdfSignStep(d) { const pg = this.pdf.pages[this.pdfSignIdx() + d]; if (pg) this.pdfSignOpen(pg); },
  // pratinjau halaman (sudah diputar) sebagai latar editor tanda tangan
  async pdfSignShow() {
    const pg = this.pdfSignPage(), sign = this.pdf.sign;
    sign.bg = '';
    if (!pg) return;
    try {
      const src = this.pdfSrc[pg.src];
      let c;
      if (src.kind === 'pdf') { await pdfLoadLib('js'); c = (await this.pdfRender(pg, { w: 900, rot: pg.rot })).c; } else c = await this.pdfImgPreview(src, pg.rot, 900);
      if (sign.pid === pg.id) sign.bg = c.toDataURL('image/jpeg', 0.85);
    } catch (e) { this.pdf.err = this.t('pdf_no_thumb'); }
  },
  async pdfImgPreview(src, rot, w) {
    const bmp = await createImageBitmap(new Blob([src.bytes])), swap = rot % 180 !== 0, s = w / (swap ? bmp.height : bmp.width), c = document.createElement('canvas');
    c.width = Math.round((swap ? bmp.height : bmp.width) * s); c.height = Math.round((swap ? bmp.width : bmp.height) * s);
    const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate(rot * Math.PI / 180); g.drawImage(bmp, -bmp.width * s / 2, -bmp.height * s / 2, bmp.width * s, bmp.height * s); bmp.close();
    return c;
  },
  pdfSigFh(pg, s) { const sg = this.pdfSigById(s.sig); return s.fw * this.pdfDisp(pg) * (sg.h || 1) / (sg.w || 1); },
  pdfSigStyle(pg, s) { return { left: (s.cx - s.fw / 2) * 100 + '%', top: (s.cy - this.pdfSigFh(pg, s) / 2) * 100 + '%', width: s.fw * 100 + '%' }; },
  pdfStagePt(ev) { const r = this.$refs.pdfStage.getBoundingClientRect(); return { r, x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height }; },
  pdfSigPlace(ev) {
    const pg = this.pdfSignPage();
    if (!pg || Date.now() - this.pdfSigJust < 300) return;
    if (!this.pdfSigCur()) { this.pdf.err = this.t('pdf_sig_none'); return; }
    const p = this.pdfStagePt(ev);
    pg.signs.push({ id: ++this.pdfSeq, sig: this.pdf.sign.active, cx: p.x, cy: p.y, fw: 0.25 });
  },
  pdfSigDown(ev, s, mode) {
    ev.stopPropagation();
    this.pdfSigDrag = { s, mode, r: this.pdfStagePt(ev).r, x0: ev.clientX, y0: ev.clientY, cx: s.cx, cy: s.cy, fw: s.fw };
    if (ev.currentTarget.setPointerCapture) ev.currentTarget.setPointerCapture(ev.pointerId);
  },
  pdfSigMove(ev) {
    const d = this.pdfSigDrag; if (!d) return;
    const dx = (ev.clientX - d.x0) / d.r.width, dy = (ev.clientY - d.y0) / d.r.height, s = d.s, clamp = v => Math.max(0, Math.min(1, v));
    if (d.mode === 'move') { s.cx = clamp(d.cx + dx); s.cy = clamp(d.cy + dy); return; }
    // ubah ukuran dari pojok kanan bawah, pojok kiri atas tetap
    const pg = this.pdfSignPage(), left = d.cx - d.fw / 2, top = d.cy - this.pdfSigFh(pg, Object.assign({}, s, { fw: d.fw })) / 2;
    s.fw = Math.max(0.03, Math.min(1, d.fw + dx)); s.cx = left + s.fw / 2; s.cy = top + this.pdfSigFh(pg, s) / 2;
  },
  pdfSigUp() { if (this.pdfSigDrag) { this.pdfSigDrag = null; this.pdfSigJust = Date.now(); } },
  pdfSigRemove(pg, s) { pg.signs = pg.signs.filter(x => x.id !== s.id); },
  pdfSignCopyAll() {
    const cur = this.pdfSignPage(); if (!cur) return;
    this.pdf.pages.forEach(pg => { if (pg.id !== cur.id) pg.signs = cur.signs.map(s => Object.assign({}, s, { id: ++this.pdfSeq })); });
    this.pdf.msg = this.t('pdf_sig_copied').replace('{n}', this.pdf.pages.length - 1);
  },
  // kanvas gambar langsung (mouse/sentuh/pena)
  pdfPadPt(ev) { const c = this.$refs.pdfPad, r = c.getBoundingClientRect(); return [(ev.clientX - r.left) * c.width / r.width, (ev.clientY - r.top) * c.height / r.height]; },
  pdfPadDown(ev) {
    const g = this.$refs.pdfPad.getContext('2d'), [x, y] = this.pdfPadPt(ev);
    g.lineWidth = 5; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#111'; g.beginPath(); g.moveTo(x, y);
    this.pdfPadOn = true; ev.currentTarget.setPointerCapture(ev.pointerId);
  },
  pdfPadMove(ev) { if (!this.pdfPadOn) return; const g = this.$refs.pdfPad.getContext('2d'), [x, y] = this.pdfPadPt(ev); g.lineTo(x, y); g.stroke(); g.beginPath(); g.moveTo(x, y); },
  pdfPadUp() { this.pdfPadOn = false; },
  pdfPadClear() { const c = this.$refs.pdfPad; if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height); },
  pdfPadUse() {
    const p = this.$refs.pdfPad, c = document.createElement('canvas'); c.width = p.width; c.height = p.height;
    c.getContext('2d', { willReadFrequently: true }).drawImage(p, 0, 0);
    this.pdfSigFrom(c); this.pdfPadClear(); this.pdf.sign.pad = false;
  },
  // tempel tanda tangan ke halaman output; posisi disimpan relatif terhadap tampilan halaman (setelah diputar)
  async pdfStamp(out, page, signs, cache) {
    const a = pdfAngle(page.getRotation().angle), A = PDF_ROT_MAP[a] ? a : 0, b = page.getCropBox(), swap = A % 180 !== 0;
    const Dw = swap ? b.height : b.width, Dh = swap ? b.width : b.height;
    for (const s of signs) {
      const sg = this.pdfSigById(s.sig); if (!sg.url) continue;
      if (!cache.has(sg.id)) cache.set(sg.id, await out.embedPng(pdfDataBytes(sg.url)));
      const dw = s.fw * Dw, dh = dw * sg.h / sg.w, [x, y] = PDF_ROT_MAP[A](s.cx * Dw - dw / 2, s.cy * Dh + dh / 2, b.width, b.height);
      page.drawImage(cache.get(sg.id), { x: b.x + x, y: b.y + y, width: dw, height: dh, rotate: window.PDFLib.degrees(A) });
    }
  },
  // satu halaman output: salinan asli (tanpa kompres), atau JPEG hasil render (kompres / sumber gambar)
  async pdfOutPage(out, pg) {
    const L = window.PDFLib, src = this.pdfSrc[pg.src], cmp = this.pdf.comp, q = Math.min(95, Math.max(20, cmp.q || 70)) / 100, dpi = Math.min(300, Math.max(50, cmp.dpi || 110));
    if (src.kind === 'pdf' && !cmp.on) {
      const [page] = await out.copyPages(src.doc, [pg.n]);
      page.setRotation(L.degrees((page.getRotation().angle + pg.rot) % 360));
      return out.addPage(page);
    }
    if (src.kind === 'pdf') {
      const r = await this.pdfRender(pg, { scale: dpi / 72, rot: pg.rot }), page = out.addPage([r.w, r.h]);
      page.drawImage(await out.embedJpg(await pdfCanvasBytes(r.c, 'image/jpeg', q)), { x: 0, y: 0, width: r.w, height: r.h });
      return page;
    }
    // gambar: 96 px = 72 pt, jadi ukuran halaman = piksel x 0,75
    const img = cmp.on ? await out.embedJpg(await pdfCanvasBytes(await pdfImageCanvas(src.bytes, Math.min(1, dpi / 96)), 'image/jpeg', q))
      : await (src.kind === 'jpg' ? out.embedJpg(src.bytes) : out.embedPng(src.bytes));
    const w = src.w * 0.75, h = src.h * 0.75, page = out.addPage([w, h]);
    page.drawImage(img, { x: 0, y: 0, width: w, height: h });
    page.setRotation(L.degrees(pg.rot));
    return page;
  },
  async pdfBuild(onlySel) {
    const p = this.pdf, list = p.pages.filter(x => !onlySel || x.sel);
    if (!list.length || p.busy) return;
    p.err = ''; p.msg = '';
    try {
      await pdfLoadLib('lib');
      if (p.comp.on) await pdfLoadLib('js');
      const L = window.PDFLib, out = await L.PDFDocument.create(), wm = p.wm.text.trim();
      let font = null;
      if (wm) { font = await out.embedFont(L.StandardFonts.HelveticaBold); try { font.widthOfTextAtSize(wm, 1); } catch (e) { throw new Error(this.t('pdf_e_wm')); } }
      const sigCache = new Map();
      for (let i = 0; i < list.length; i++) {
        p.busy = this.t('pdf_building').replace('{i}', i + 1).replace('{n}', list.length); p.prog = Math.round(i / list.length * 100);
        const page = await this.pdfOutPage(out, list[i]);
        if (wm) pdfWatermark(page, font, wm, p.wm);
        if (list[i].signs.length) await this.pdfStamp(out, page, list[i].signs, sigCache);
      }
      const bytes = await out.save(), name = (p.name.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'dokumen').replace(/\.pdf$/i, '') + '.pdf';
      pupDownload(name, bytes, 'application/pdf');
      p.msg = this.t('pdf_done').replace('{f}', name).replace('{n}', list.length).replace('{s}', pupFmtBytes(bytes.length));
    } catch (e) { p.err = this.t('pdf_e_build') + ' ' + (e.message || e); }
    p.busy = ''; p.prog = 0;
  }
};

const PDF_I18N = {
  id: {
    tab_pdf: 'PDF Tools', grp_pdf_title: 'PDF Tools', grp_pdf_desc: 'File diproses lokal di browser dan tidak diunggah. Hanya mengunduh library pdf-lib dan pdf.js dari jsDelivr (versi dikunci + SRI).',
    pdf_title: 'PDF Tools — gabung, pisah, putar, urutkan, kompres, watermark',
    pdf_intro: 'Masukkan satu atau banyak PDF/gambar, atur halamannya, lalu unduh sebagai satu PDF. Semua diproses di browser: file tidak dikirim ke mana pun.',
    pdf_drop: 'Drop atau klik untuk pilih PDF / gambar (boleh banyak)', pdf_drop_sub: 'PDF, JPG, PNG, WebP — gambar jadi satu halaman',
    pdf_loading: 'Membuka file...', pdf_building: 'Menyusun halaman {i} dari {n}...', pdf_pages: 'halaman', pdf_selected: 'dipilih',
    pdf_sel_all: 'Pilih semua', pdf_sel_none: 'Batal pilih', pdf_range_ph: 'mis. 1-3, 7, 10-', pdf_range_go: 'Pilih nomor', pdf_rot: 'Putar 90°', pdf_del: 'Hapus', pdf_clear: 'Kosongkan',
    pdf_how: 'Klik halaman untuk memilih. Seret kartu untuk mengubah urutan, atau pakai ◀ ▶. Putar/Hapus berlaku untuk halaman terpilih (semua bila tidak ada yang dipilih). Untuk memisah PDF: pilih halamannya lalu Unduh yang dipilih.',
    pdf_t_left: 'Geser ke depan', pdf_t_right: 'Geser ke belakang', pdf_t_rot: 'Putar 90° searah jarum jam', pdf_t_del: 'Hapus halaman ini',
    pdf_out: 'Nama file', pdf_wm: 'Watermark', pdf_wm_ph: 'kosong = tanpa watermark', pdf_wm_op: 'Ketebalan', pdf_wm_color: 'Warna',
    pdf_comp: 'Kompres (halaman dijadikan gambar JPEG)', pdf_dpi: 'Resolusi', pdf_q: 'Kualitas',
    pdf_comp_note: 'Kompres cocok untuk PDF hasil scan/foto. Teks tidak lagi bisa dipilih atau dicari, dan untuk PDF berisi teks biasa hasilnya bisa lebih besar. Tanpa kompres, halaman disalin apa adanya (kualitas dan teks tetap).',
    pdf_dl_all: 'Unduh semua', pdf_dl_sel: 'Unduh yang dipilih',
    pdf_done: '{f} diunduh: {n} halaman, {s}.', pdf_no_thumb: 'Thumbnail tidak bisa dimuat (pdf.js dari CDN gagal). Halaman tetap bisa diatur dan diunduh.',
    pdf_e_type: 'Tidak ada file PDF atau gambar.', pdf_e_big: 'file lebih dari 300 MB.', pdf_e_enc: 'PDF terkunci password. Buka kuncinya dulu.', pdf_e_open: 'bukan PDF yang valid atau file rusak.',
    pdf_e_many: 'Terlalu banyak halaman (maksimal {n}).', pdf_e_build: 'Gagal menyusun PDF:', pdf_e_wm: 'teks watermark hanya mendukung huruf Latin.',
    pdf_sig: 'Tanda tangan', pdf_sig_open: 'Tanda tangan...', pdf_sig_close: 'Tutup panel',
    pdf_sig_how: 'Foto tanda tangan di kertas putih (atau tempel dengan Ctrl+V / gambar langsung). Latar kertas dibuat transparan otomatis. Pilih tanda tangan, klik di halaman untuk menaruhnya, seret untuk memindah, tarik pojok kanan bawah untuk mengubah ukuran. Bisa lebih dari satu per halaman.',
    pdf_sig_add: 'Pilih foto', pdf_sig_paste: 'Tempel dari clipboard', pdf_sig_draw: 'Gambar langsung', pdf_sig_pad_use: 'Pakai gambar ini', pdf_sig_pad_clear: 'Hapus coretan', pdf_sig_pad_hint: 'Tanda tangan di kotak ini dengan mouse, jari, atau pena.',
    pdf_sig_sens: 'Ambang latar', pdf_sig_sens_tip: 'Naikkan bila goresan tipis hilang, turunkan bila bayangan kertas ikut terbawa.', pdf_sig_ink: 'Warna tinta', pdf_sig_ink_orig: 'Asli', pdf_sig_ink_black: 'Hitam', pdf_sig_ink_blue: 'Biru',
    pdf_sig_del: 'Hapus tanda tangan ini', pdf_sig_rm: 'Lepas dari halaman', pdf_sig_prev: 'Halaman sebelumnya', pdf_sig_next: 'Halaman berikutnya', pdf_sig_page: 'Halaman {i} dari {n}', pdf_sig_all: 'Salin ke semua halaman', pdf_sig_loading: 'Memuat halaman...',
    pdf_sig_no_clip: 'Tidak ada gambar di clipboard (atau izin clipboard ditolak). Coba Ctrl+V di halaman ini.', pdf_sig_e_load: 'Gambar tanda tangan tidak bisa dibuka:', pdf_sig_empty: 'Tidak ada goresan yang terdeteksi. Pakai foto dengan tinta gelap di kertas terang, atau turunkan ambang latar.',
    pdf_sig_none: 'Tambahkan atau pilih tanda tangan dulu.', pdf_sig_copied: 'Tanda tangan disalin ke {n} halaman lain.', pdf_sig_warn: 'Tanda tangan ini hanya gambar, bukan tanda tangan digital bersertifikat. Pakai hanya untuk tanda tangan Anda sendiri.'
  },
  en: {
    tab_pdf: 'PDF Tools', grp_pdf_title: 'PDF Tools', grp_pdf_desc: 'Files are processed locally in the browser and never uploaded. Only downloads the pdf-lib and pdf.js libraries from jsDelivr (pinned versions + SRI).',
    pdf_title: 'PDF Tools — merge, split, rotate, reorder, compress, watermark',
    pdf_intro: 'Add one or many PDFs/images, arrange the pages, then download them as a single PDF. Everything runs in the browser: files are not sent anywhere.',
    pdf_drop: 'Drop or click to choose PDFs / images (multiple allowed)', pdf_drop_sub: 'PDF, JPG, PNG, WebP — an image becomes one page',
    pdf_loading: 'Opening files...', pdf_building: 'Building page {i} of {n}...', pdf_pages: 'pages', pdf_selected: 'selected',
    pdf_sel_all: 'Select all', pdf_sel_none: 'Clear selection', pdf_range_ph: 'e.g. 1-3, 7, 10-', pdf_range_go: 'Select numbers', pdf_rot: 'Rotate 90°', pdf_del: 'Delete', pdf_clear: 'Clear all',
    pdf_how: 'Click a page to select it. Drag a card to reorder, or use ◀ ▶. Rotate/Delete apply to the selected pages (all pages when none is selected). To split a PDF: select the pages, then Download selected.',
    pdf_t_left: 'Move earlier', pdf_t_right: 'Move later', pdf_t_rot: 'Rotate 90° clockwise', pdf_t_del: 'Delete this page',
    pdf_out: 'File name', pdf_wm: 'Watermark', pdf_wm_ph: 'empty = no watermark', pdf_wm_op: 'Opacity', pdf_wm_color: 'Color',
    pdf_comp: 'Compress (pages become JPEG images)', pdf_dpi: 'Resolution', pdf_q: 'Quality',
    pdf_comp_note: 'Compression suits scanned/photographed PDFs. Text can no longer be selected or searched, and for text-only PDFs the result may be larger. Without compression, pages are copied as they are (quality and text kept).',
    pdf_dl_all: 'Download all', pdf_dl_sel: 'Download selected',
    pdf_done: '{f} downloaded: {n} pages, {s}.', pdf_no_thumb: 'Thumbnails could not be loaded (pdf.js from the CDN failed). Pages can still be arranged and downloaded.',
    pdf_e_type: 'No PDF or image files.', pdf_e_big: 'file is larger than 300 MB.', pdf_e_enc: 'PDF is password-protected. Unlock it first.', pdf_e_open: 'not a valid PDF or the file is damaged.',
    pdf_e_many: 'Too many pages (maximum {n}).', pdf_e_build: 'Failed to build the PDF:', pdf_e_wm: 'watermark text only supports Latin letters.',
    pdf_sig: 'Signature', pdf_sig_open: 'Signature...', pdf_sig_close: 'Close panel',
    pdf_sig_how: 'Photograph your signature on white paper (or paste it with Ctrl+V / draw it). The paper background is made transparent automatically. Pick a signature, click on the page to place it, drag to move, drag the bottom-right corner to resize. You can place several per page.',
    pdf_sig_add: 'Choose photo', pdf_sig_paste: 'Paste from clipboard', pdf_sig_draw: 'Draw it', pdf_sig_pad_use: 'Use this drawing', pdf_sig_pad_clear: 'Clear', pdf_sig_pad_hint: 'Sign in this box with a mouse, finger, or pen.',
    pdf_sig_sens: 'Background threshold', pdf_sig_sens_tip: 'Raise it if thin strokes disappear, lower it if paper shadows are kept.', pdf_sig_ink: 'Ink color', pdf_sig_ink_orig: 'Original', pdf_sig_ink_black: 'Black', pdf_sig_ink_blue: 'Blue',
    pdf_sig_del: 'Delete this signature', pdf_sig_rm: 'Remove from page', pdf_sig_prev: 'Previous page', pdf_sig_next: 'Next page', pdf_sig_page: 'Page {i} of {n}', pdf_sig_all: 'Copy to all pages', pdf_sig_loading: 'Loading page...',
    pdf_sig_no_clip: 'No image in the clipboard (or clipboard permission denied). Try Ctrl+V on this page.', pdf_sig_e_load: 'The signature image could not be opened:', pdf_sig_empty: 'No strokes detected. Use a photo with dark ink on light paper, or lower the background threshold.',
    pdf_sig_none: 'Add or select a signature first.', pdf_sig_copied: 'Signature copied to {n} other pages.', pdf_sig_warn: 'This signature is only an image, not a certified digital signature. Use it only for your own signature.'
  }
};
Object.keys(PDF_I18N).forEach(l => { I18N[l] = Object.assign({}, PDF_I18N[l], I18N[l] || {}); });
