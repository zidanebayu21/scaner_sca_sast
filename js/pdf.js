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
  pdfInit() { this.pdfSrc = []; this.pdfSeq = 0; this.pdfThumbRun = false; },
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
    let n = 1, thumb = '';
    if (src.kind === 'pdf') {
      try { src.doc = await window.PDFLib.PDFDocument.load(src.bytes); } catch (e) { throw new Error(f.name + ': ' + (/encrypt/i.test(e.message) ? this.t('pdf_e_enc') : this.t('pdf_e_open'))); }
      n = src.doc.getPageCount();
    } else {
      // format selain PNG/JPG (WebP, GIF, BMP, ...) diubah ke PNG karena PDF hanya menerima PNG/JPG
      if (src.kind === 'img') { src.bytes = await pdfCanvasBytes(await pdfImageCanvas(src.bytes, 1), 'image/png'); src.kind = 'png'; }
      thumb = src.url = URL.createObjectURL(new Blob([src.bytes], { type: src.kind === 'jpg' ? 'image/jpeg' : 'image/png' }));
    }
    if (this.pdf.pages.length + n > PDF_LIM.pages) throw new Error(this.t('pdf_e_many').replace('{n}', PDF_LIM.pages));
    const si = this.pdfSrc.push(src) - 1;
    for (let i = 0; i < n; i++) this.pdf.pages.push({ id: ++this.pdfSeq, src: si, n: i, rot: 0, sel: false, thumb });
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
  pdfRot(list) { list.forEach(x => { x.rot = (x.rot + 90) % 360; }); },
  pdfDel(list) { const ids = new Set(list.map(x => x.id)); this.pdf.pages = this.pdf.pages.filter(x => !ids.has(x.id)); },
  pdfMove(from, to) { const a = this.pdf.pages; if (to < 0 || to >= a.length || from === to) return; a.splice(to, 0, a.splice(from, 1)[0]); },
  pdfDropOn(i, ev) {
    const from = this.pdf.drag; this.pdf.drag = -1;
    if (from >= 0) this.pdfMove(from, i); else this.onPdfDrop(ev);
  },
  pdfClear() {
    this.pdfSrc.forEach(s => { if (s.url) URL.revokeObjectURL(s.url); if (s.js) s.js.then(d => d.destroy()).catch(() => { /* sudah ditutup */ }); });
    this.pdfSrc = []; this.pdf.pages = []; this.pdf.err = ''; this.pdf.msg = '';
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
    const bmp = await createImageBitmap(new Blob([src.bytes])), w = bmp.width * 0.75, h = bmp.height * 0.75, page = out.addPage([w, h]);
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
      for (let i = 0; i < list.length; i++) {
        p.busy = this.t('pdf_building').replace('{i}', i + 1).replace('{n}', list.length); p.prog = Math.round(i / list.length * 100);
        const page = await this.pdfOutPage(out, list[i]);
        if (wm) pdfWatermark(page, font, wm, p.wm);
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
    pdf_e_many: 'Terlalu banyak halaman (maksimal {n}).', pdf_e_build: 'Gagal menyusun PDF:', pdf_e_wm: 'teks watermark hanya mendukung huruf Latin.'
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
    pdf_e_many: 'Too many pages (maximum {n}).', pdf_e_build: 'Failed to build the PDF:', pdf_e_wm: 'watermark text only supports Latin letters.'
  }
};
Object.keys(PDF_I18N).forEach(l => { I18N[l] = Object.assign({}, PDF_I18N[l], I18N[l] || {}); });
