// Analisis statis APK / AAB / XAPK / IPA di browser (100% lokal, tanpa jaringan).
// Rujukan: OWASP MASVS v2 (STORAGE, CRYPTO, NETWORK, PLATFORM, CODE, RESILIENCE), OWASP MASTG, CWE, ASVS V5/V14.
// Berkas tidak tepercaya: semua pembacaan dibatasi (ukuran, jumlah, kedalaman) agar tidak hang/OOM (ASVS V12.1, CWE-400/CWE-770),
// dan semua teks hasil berupa teks biasa — UI memakai text node, bukan HTML (ASVS V5.3, CWE-79).
// Hasil adalah indikasi statis, bukan antivirus dan bukan verifikasi tanda tangan (pakai apksigner verify untuk itu).
(function (root) {
  'use strict';
  const LIM = { entry: 96 << 20, strings: 600000, nodes: 60000, depth: 64, files: 14, scanBytes: 24 << 20, budget: 320 << 20, splits: 6, show: 8 };
  const PLAY_TARGET_SDK = 35; // acuan batas targetSdk Play Store (Agustus 2025); perbarui tiap tahun
  const dec8 = new TextDecoder('utf-8'), dec16 = new TextDecoder('utf-16le'), decL = new TextDecoder('latin1');
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const hex = (b) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const uniq = (a) => [...new Set(a)];
  const mask = (v) => (v.length > 12 ? v.slice(0, 4) + '…' + v.slice(-2) : v.slice(0, 2) + '…'); // nilai secret tidak ditampilkan utuh (ASVS V7.1.1)
  const more = (a, n = LIM.show) => a.slice(0, n).join(', ') + (a.length > n ? ' … (+' + (a.length - n) + ')' : '');

  // ---------------------------------------------------------------- Teks (ID/EN)
  const M = {
    ak_parse_fail: ['Gagal membaca bagian {x}: berkas rusak atau tidak biasa.', 'Could not read {x}: the file is corrupt or unusual.'],
    ak_debuggable: ['Aplikasi debuggable (android:debuggable=true): debugger bisa menempel dan data privat terbaca lewat run-as (CWE-489, MASVS-RESILIENCE).', 'App is debuggable (android:debuggable=true): a debugger can attach and private data is readable via run-as (CWE-489, MASVS-RESILIENCE).'],
    ak_testonly: ['android:testOnly=true: build uji, bukan rilis (MASVS-CODE-2).', 'android:testOnly=true: a test build, not a release (MASVS-CODE-2).'],
    ak_backup: ['allowBackup aktif (default bila tidak diatur): data aplikasi bisa diekstrak lewat adb backup (CWE-530, MASVS-STORAGE-1).', 'allowBackup is on (the default when unset): app data can be extracted via adb backup (CWE-530, MASVS-STORAGE-1).'],
    ak_cleartext: ['usesCleartextTraffic=true: lalu lintas HTTP tanpa enkripsi diizinkan (CWE-319, MASVS-NETWORK-1).', 'usesCleartextTraffic=true: unencrypted HTTP traffic is allowed (CWE-319, MASVS-NETWORK-1).'],
    ak_cleartext_def: ['targetSdk {x} < 28: HTTP biasa diizinkan secara default (CWE-319).', 'targetSdk {x} < 28: plain HTTP is allowed by default (CWE-319).'],
    ak_legacystorage: ['requestLegacyExternalStorage=true: akses penyimpanan luas yang sudah dibatasi Android baru (MASVS-STORAGE-2).', 'requestLegacyExternalStorage=true: broad storage access that newer Android restricts (MASVS-STORAGE-2).'],
    ak_minsdk: ['minSdk {x} (Android {y}) sudah lama: perangkat itu tidak lagi menerima perbaikan keamanan (MASVS-CODE-1).', 'minSdk {x} (Android {y}) is old: those devices no longer get security fixes (MASVS-CODE-1).'],
    ak_targetsdk: ['targetSdk {x} tertinggal dari acuan Play Store {y}: perlindungan platform baru tidak berlaku bagi aplikasi ini (MASVS-CODE-1).', 'targetSdk {x} is behind the Play Store reference {y}: newer platform protections do not apply to this app (MASVS-CODE-1).'],
    ak_perm_high: ['Izin berisiko tinggi: {x}', 'High-risk permissions: {x}'],
    ak_perm_med: ['Izin sensitif: {x}', 'Sensitive permissions: {x}'],
    ak_perm_low: ['Izin yang perlu ditinjau: {x}', 'Permissions worth reviewing: {x}'],
    ak_perm_custom: ['Izin kustom dengan protectionLevel lemah (normal/dangerous): {x}. Aplikasi lain bisa memintanya (CWE-926).', 'Custom permissions with a weak protectionLevel (normal/dangerous): {x}. Other apps can request them (CWE-926).'],
    ak_export_provider: ['Content provider diekspor tanpa izin: {x} (CWE-926, MASVS-PLATFORM-1).', 'Content providers exported without a permission: {x} (CWE-926, MASVS-PLATFORM-1).'],
    ak_export_service: ['Service diekspor tanpa izin: {x} (CWE-926, MASVS-PLATFORM-1).', 'Services exported without a permission: {x} (CWE-926, MASVS-PLATFORM-1).'],
    ak_export_receiver: ['Broadcast receiver diekspor tanpa izin: {x} (CWE-926, MASVS-PLATFORM-1).', 'Broadcast receivers exported without a permission: {x} (CWE-926, MASVS-PLATFORM-1).'],
    ak_export_activity: ['Activity diekspor tanpa izin (selain launcher): {x}. Periksa input intent-nya (MASVS-PLATFORM-1).', 'Activities exported without a permission (besides the launcher): {x}. Check how they handle intents (MASVS-PLATFORM-1).'],
    ak_grant_uri: ['Provider dengan grantUriPermissions=true: {x} (CWE-266).', 'Providers with grantUriPermissions=true: {x} (CWE-266).'],
    ak_deeplink_custom: ['Deep link berskema kustom (bisa dibajak aplikasi lain): {x} (CWE-939, MASVS-PLATFORM-1).', 'Custom-scheme deep links (other apps can hijack them): {x} (CWE-939, MASVS-PLATFORM-1).'],
    ak_deeplink_web: ['App Link http(s) tanpa autoVerify: {x}.', 'http(s) App Links without autoVerify: {x}.'],
    ak_nsc_base: ['network_security_config: cleartextTrafficPermitted=true pada base-config (CWE-319, MASVS-NETWORK-1).', 'network_security_config: cleartextTrafficPermitted=true on base-config (CWE-319, MASVS-NETWORK-1).'],
    ak_nsc_domain: ['network_security_config: HTTP biasa diizinkan untuk domain {x} (CWE-319).', 'network_security_config: plain HTTP is allowed for domains {x} (CWE-319).'],
    ak_nsc_user: ['network_security_config: mempercayai sertifikat CA yang dipasang pengguna (src="user") — memudahkan intersepsi TLS (CWE-295, MASVS-NETWORK-2).', 'network_security_config: trusts user-installed CA certificates (src="user") — makes TLS interception easy (CWE-295, MASVS-NETWORK-2).'],
    ak_sig_none: ['Tidak ada tanda tangan APK: tidak bisa dipasang normal dan keasliannya tidak terjamin (MASVS-CODE-1).', 'No APK signature: it cannot be installed normally and its authenticity is not guaranteed (MASVS-CODE-1).'],
    ak_sig_debug: ['Ditandatangani sertifikat debug Android: ini build uji, bukan rilis (MASVS-CODE-1).', 'Signed with the Android debug certificate: a test build, not a release (MASVS-CODE-1).'],
    ak_sig_weak: ['Sertifikat penanda tangan memakai algoritma lemah {x} (CWE-327).', 'The signing certificate uses a weak algorithm {x} (CWE-327).'],
    ak_sig_small: ['Kunci penanda tangan {x} bit terlalu pendek (CWE-326).', 'The signing key is only {x} bits (CWE-326).'],
    ak_sig_v1only: ['Hanya tanda tangan v1 (JAR): rentan Janus (CVE-2017-13156) di Android 5.0-8.0. Pakai skema v2/v3.', 'Only a v1 (JAR) signature: vulnerable to Janus (CVE-2017-13156) on Android 5.0-8.0. Use scheme v2/v3.'],
    ak_hidden: ['File eksekusi tersembunyi di assets/res: {x} (pemuatan kode dinamis, MASVS-CODE-4).', 'Executable files hidden in assets/res: {x} (dynamic code loading, MASVS-CODE-4).'],
    ak_no64: ['Library native hanya untuk ABI 32-bit ({x}): tidak jalan di perangkat 64-bit murni dan memudahkan analisis.', 'Native libraries only for 32-bit ABIs ({x}): they will not run on 64-bit-only devices.'],
    ak_notobf: ['Kode Java/Kotlin tampak tidak diobfuscate ({x}% nama kelas pendek): logika mudah dibaca (MASVS-RESILIENCE-3).', 'Java/Kotlin code looks unobfuscated ({x}% short class names): logic is easy to read (MASVS-RESILIENCE-3).'],
    ak_rn_bundle: ['React Native: logika aplikasi ada di JS bundle ({x}). Analisis secret/URL-nya ikut dipindai, tetapi bytecode Hermes perlu alat khusus.', 'React Native: app logic lives in the JS bundle ({x}). Its secrets/URLs are scanned too, but Hermes bytecode needs dedicated tools.'],
    ak_s_secret: ['Secret/token ter-hardcode di {w}: {x} (CWE-798, MASVS-STORAGE-2). Cabut lalu ganti dengan secret manager/backend.', 'Hard-coded secret/token in {w}: {x} (CWE-798, MASVS-STORAGE-2). Revoke it and use a secret manager/backend.'],
    ak_s_privkey: ['Private key tertanam di {w}: {x} (CWE-321).', 'Private key embedded in {w}: {x} (CWE-321).'],
    ak_s_gkey: ['Google API key di {w}: {x}. Pastikan dibatasi per package + SHA-1 dan per API di Google Cloud Console.', 'Google API key in {w}: {x}. Make sure it is restricted by package + SHA-1 and by API in Google Cloud Console.'],
    ak_s_jwt: ['Token mirip JWT di {w}: {x}. Periksa apakah ini kredensial aktif (CWE-798).', 'JWT-like token in {w}: {x}. Check whether it is a live credential (CWE-798).'],
    ak_s_cred: ['Pola password/secret berbentuk kunci=nilai di {w}: {x} (kemungkinan, periksa manual; CWE-798).', 'password/secret key=value patterns in {w}: {x} (possible, review manually; CWE-798).'],
    ak_s_http: ['URL http:// (tanpa TLS) di {w}: {x} (CWE-319, MASVS-NETWORK-1).', 'http:// URLs (no TLS) in {w}: {x} (CWE-319, MASVS-NETWORK-1).'],
    ak_s_internal: ['Alamat internal/IP privat di {w}: {x} (kebocoran informasi, CWE-200).', 'Internal/private addresses in {w}: {x} (information exposure, CWE-200).'],
    ak_s_firebase: ['URL Firebase di {w}: {x}. Pastikan Realtime Database tidak publik; jangan diuji tanpa izin pemilik.', 'Firebase URLs in {w}: {x}. Make sure the Realtime Database is not public; do not test it without the owner\'s permission.'],
    ak_s_s3: ['Bucket S3 di {w}: {x}. Pastikan tidak bisa dibaca/ditulis publik; jangan diuji tanpa izin pemilik.', 'S3 buckets in {w}: {x}. Make sure they are not publicly readable/writable; do not test them without the owner\'s permission.'],
    ak_a_jsbridge: ['WebView memakai addJavascriptInterface: jembatan JS ke Java bisa disalahgunakan bila memuat konten tak tepercaya (CWE-749, MASVS-PLATFORM-2).', 'WebView uses addJavascriptInterface: the JS-to-Java bridge can be abused when untrusted content loads (CWE-749, MASVS-PLATFORM-2).'],
    ak_a_fileurl: ['WebView mengizinkan akses file:// lintas asal (setAllowUniversalAccess/FileAccessFromFileURLs) (CWE-200, MASVS-PLATFORM-2).', 'WebView allows cross-origin file:// access (setAllowUniversalAccess/FileAccessFromFileURLs) (CWE-200, MASVS-PLATFORM-2).'],
    ak_a_hostname: ['Verifier hostname menerima semua (ALLOW_ALL_HOSTNAME_VERIFIER/AllowAllHostnameVerifier): TLS tidak memeriksa nama server (CWE-297, MASVS-NETWORK-1).', 'Allow-all hostname verifier: TLS does not check the server name (CWE-297, MASVS-NETWORK-1).'],
    ak_a_sslerr: ['WebViewClient.onReceivedSslError ada: pastikan tidak memanggil proceed() (CWE-295, MASVS-NETWORK-1). Indikasi, periksa manual.', 'WebViewClient.onReceivedSslError exists: make sure it never calls proceed() (CWE-295, MASVS-NETWORK-1). Indication only, review manually.'],
    ak_a_trust: ['TrustManager kustom (X509TrustManager) ada: pastikan checkServerTrusted tidak kosong (CWE-295, MASVS-NETWORK-1). Indikasi, periksa manual.', 'Custom X509TrustManager exists: make sure checkServerTrusted is not empty (CWE-295, MASVS-NETWORK-1). Indication only, review manually.'],
    ak_a_ecb: ['Mode AES/ECB dipakai: pola plaintext terlihat di ciphertext (CWE-327, MASVS-CRYPTO-1).', 'AES/ECB mode is used: plaintext patterns show in the ciphertext (CWE-327, MASVS-CRYPTO-1).'],
    ak_a_des: ['Algoritma DES/3DES/RC4 dipakai: sudah lemah (CWE-327, MASVS-CRYPTO-1).', 'DES/3DES/RC4 is used: already weak (CWE-327, MASVS-CRYPTO-1).'],
    ak_a_hash: ['Hash MD5/SHA-1 muncul: aman hanya untuk checksum, bukan password/tanda tangan (CWE-328, MASVS-CRYPTO-1). Indikasi.', 'MD5/SHA-1 appears: fine only as a checksum, not for passwords/signatures (CWE-328, MASVS-CRYPTO-1). Indication.'],
    ak_a_dexload: ['DexClassLoader/PathClassLoader dinamis dipakai: kode bisa dimuat saat runtime (CWE-94, MASVS-CODE-4). Indikasi.', 'Dynamic DexClassLoader is used: code can be loaded at runtime (CWE-94, MASVS-CODE-4). Indication.'],
    ak_a_world: ['MODE_WORLD_READABLE/WRITEABLE dipakai: file bisa diakses aplikasi lain (CWE-276, MASVS-STORAGE-2).', 'MODE_WORLD_READABLE/WRITEABLE is used: files are accessible to other apps (CWE-276, MASVS-STORAGE-2).'],
    ak_a_extstore: ['Penyimpanan eksternal dipakai (getExternalStorageDirectory/getExternalFilesDir): file bisa dibaca aplikasi lain (CWE-922, MASVS-STORAGE-2). Indikasi.', 'External storage is used (getExternalStorageDirectory/getExternalFilesDir): files may be readable by other apps (CWE-922, MASVS-STORAGE-2). Indication.'],
    ak_a_root: ['Ada pola deteksi root (su/Magisk): perlindungan sisi klien yang bisa dilewati (MASVS-RESILIENCE-1).', 'Root detection patterns found (su/Magisk): client-side protection that can be bypassed (MASVS-RESILIENCE-1).'],
    ak_a_hook: ['Ada pola anti-hooking (Frida/Xposed) (MASVS-RESILIENCE-4).', 'Anti-hooking patterns found (Frida/Xposed) (MASVS-RESILIENCE-4).'],
    ak_ios_ats: ['NSAllowsArbitraryLoads=true: App Transport Security dimatikan, HTTP biasa diizinkan (CWE-319, MASVS-NETWORK-1).', 'NSAllowsArbitraryLoads=true: App Transport Security is off, plain HTTP is allowed (CWE-319, MASVS-NETWORK-1).'],
    ak_ios_ats_dom: ['Pengecualian ATS untuk domain: {x} (HTTP/TLS lemah diizinkan, CWE-319).', 'ATS exceptions for domains: {x} (plain HTTP/weak TLS allowed, CWE-319).'],
    ak_ios_share: ['UIFileSharingEnabled=true: isi folder Documents bisa dibaca lewat Files/iTunes (CWE-922, MASVS-STORAGE-2).', 'UIFileSharingEnabled=true: the Documents folder is readable via Files/iTunes (CWE-922, MASVS-STORAGE-2).'],
    ak_ios_taskallow: ['get-task-allow=true di provisioning profile: build debug, debugger bisa menempel (MASVS-RESILIENCE).', 'get-task-allow=true in the provisioning profile: a debug build, a debugger can attach (MASVS-RESILIENCE).'],
    ak_ios_enterprise: ['Provisioning enterprise (ProvisionsAllDevices): distribusi di luar App Store.', 'Enterprise provisioning (ProvisionsAllDevices): distributed outside the App Store.'],
    ak_ios_minos: ['MinimumOSVersion {x} sudah lama: tidak menerima perbaikan keamanan terbaru (MASVS-CODE-1).', 'MinimumOSVersion {x} is old: no longer receives the latest security fixes (MASVS-CODE-1).'],
    ak_ios_perm: ['Izin privasi yang diminta: {x}', 'Privacy permissions requested: {x}'],
    ak_ios_scheme: ['URL scheme kustom (bisa dibajak aplikasi lain): {x} (CWE-939, MASVS-PLATFORM-1).', 'Custom URL schemes (other apps can hijack them): {x} (CWE-939, MASVS-PLATFORM-1).']
  };
  const LBL = {
    kind: ['Jenis paket', 'Package kind'], pkg: ['Paket / Bundle ID', 'Package / Bundle ID'], ver: ['Versi', 'Version'], sdk: ['SDK min / target', 'SDK min / target'],
    perms: ['Izin', 'Permissions'], comps: ['Komponen', 'Components'], links: ['Deep link', 'Deep links'], sig: ['Tanda tangan', 'Signature'], cert: ['Sertifikat', 'Certificate'],
    dex: ['Berkas DEX', 'DEX files'], abi: ['ABI native', 'Native ABIs'], fw: ['Framework', 'Framework'], obf: ['Obfuscation', 'Obfuscation'], app: ['Application', 'Application'],
    split: ['Split APK', 'Split APKs'], ats: ['ATS', 'ATS'], schemes: ['URL scheme', 'URL schemes'], exec: ['Executable', 'Executable'], strs: ['String dipindai', 'Strings scanned']
  };
  if (typeof I18N !== 'undefined') {
    ['id', 'en'].forEach((l, i) => { const d = {}; Object.keys(M).forEach(k => { d[k] = M[k][i]; }); I18N[l] = Object.assign({}, d, I18N[l] || {}); });
  }

  // ---------------------------------------------------------------- ZIP mini (independen dari ctx)
  function zipList(b) {
    let e = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { e = i; break; }
    if (e < 0) return null;
    const cnt = u16(b, e + 10), cdSize = u32(b, e + 12), cdOff = u32(b, e + 16);
    if (cnt === 0xFFFF || cdOff + cdSize > b.length) return null;
    const out = [];
    for (let p = cdOff, k = 0; k < cnt && p + 46 <= b.length && u32(b, p) === 0x02014b50; k++) {
      const nl = u16(b, p + 28);
      out.push({ name: dec8.decode(b.subarray(p + 46, p + 46 + nl)), flags: u16(b, p + 8), method: u16(b, p + 10), csize: u32(b, p + 20), size: u32(b, p + 24), local: u32(b, p + 42) });
      p += 46 + nl + u16(b, p + 30) + u16(b, p + 32);
    }
    out.cdOff = cdOff;
    return out;
  }
  async function zipRead(c, e, max) {
    if (!e || (e.flags & 1) || e.size > (max || LIM.entry) || c.st.used + e.size > LIM.budget) return null;
    if (e.size > (8 << 20) && e.size > e.csize * 1000) return null; // rasio tak wajar = zip bomb (CWE-409)
    const b = c.b, p = e.local;
    if (p + 30 > b.length || u32(b, p) !== 0x04034b50) return null;
    const off = p + 30 + u16(b, p + 26) + u16(b, p + 28), data = b.subarray(off, off + e.csize);
    c.st.used += e.size;
    try { return e.method === 0 ? data : (e.method === 8 && c.inflate ? await c.inflate(data) : null); } catch (err) { return null; }
  }
  // Konteks arsip: nama virtual (alias dipakai AAB: base/dex/classes.dex -> classes.dex), pembaca entri, anggaran dekompresi.
  function mkCtx(b, o, alias) {
    const list = zipList(b);
    if (!list) return null;
    const by = new Map(), names = [];
    list.forEach(e => { const n = alias ? alias(e.name) : e.name; if (!by.has(n)) { by.set(n, e); names.push(n); } });
    const c = { b, list, names, by, inflate: o.inflate, st: o.st || { used: 0 }, o };
    c.read = (n, max) => zipRead(c, by.get(n), max);
    c.has = (re) => names.some(n => re.test(n));
    return c;
  }

  // ---------------------------------------------------------------- XML biner Android (AXML) + string pool
  const ATTR_BY_ID = { 0x01010003: 'name', 0x01010010: 'exported', 0x0101000f: 'debuggable', 0x01010006: 'permission', 0x0101020c: 'minSdkVersion', 0x01010270: 'targetSdkVersion', 0x0101021b: 'versionCode', 0x0101021c: 'versionName', 0x01010280: 'allowBackup', 0x010104ec: 'usesCleartextTraffic', 0x01010527: 'networkSecurityConfig' };
  function readPool(b, o, end) {
    const hdr = u16(b, o + 2), count = u32(b, o + 8), flags = u32(b, o + 16), start = u32(b, o + 20);
    if (count > LIM.strings || o + hdr + count * 4 > end) throw new Error('string pool');
    const out = new Array(count), base = o + start, utf8 = (flags & 0x100) !== 0;
    for (let i = 0; i < count; i++) {
      let p = base + u32(b, o + hdr + i * 4);
      if (p >= end) { out[i] = ''; continue; }
      if (utf8) {
        p += (b[p] & 0x80) ? 2 : 1;
        let bl = b[p]; if (bl & 0x80) { bl = ((bl & 0x7f) << 8) | b[p + 1]; p += 2; } else p += 1;
        out[i] = dec8.decode(b.subarray(p, Math.min(p + bl, end)));
      } else {
        let l = u16(b, p); p += 2;
        if (l & 0x8000) { l = ((l & 0x7fff) << 16) | u16(b, p); p += 2; }
        out[i] = dec16.decode(b.subarray(p, Math.min(p + l * 2, end)));
      }
    }
    return out;
  }
  function axmlValue(b, a, pool) {
    const raw = u32(b, a + 8), t = b[a + 15], d = u32(b, a + 16);
    if (raw !== 0xFFFFFFFF && pool[raw] !== undefined) return pool[raw];
    if (t === 3) return pool[d] || '';
    if (t === 0x12) return d ? 'true' : 'false';
    if (t === 0x10) return String(d | 0);
    if (t === 1) return '@0x' + d.toString(16);
    return '0x' + d.toString(16);
  }
  function parseAxml(b) {
    if (b.length < 8 || u16(b, 0) !== 3) throw new Error('bukan AXML');
    const end = Math.min(b.length, u32(b, 4)), top = { tag: '#', attrs: {}, children: [] }, stack = [top], ids = [];
    let pool = [], p = u16(b, 2), nodes = 0;
    while (p + 8 <= end) {
      const type = u16(b, p), hdr = u16(b, p + 2), size = u32(b, p + 4);
      if (size < 8 || p + size > end) break;
      if (type === 1) pool = readPool(b, p, p + size);
      else if (type === 0x180) { for (let q = p + hdr; q + 4 <= p + size && ids.length < LIM.strings; q += 4) ids.push(u32(b, q)); }
      else if (type === 0x102 && p + 36 <= end) {
        if (++nodes > LIM.nodes || stack.length > LIM.depth) throw new Error('XML terlalu besar');
        const ni = u32(b, p + 20), n = { tag: pool[ni] || ATTR_BY_ID[ids[ni]] || '', attrs: {}, children: [] };
        const as = p + 16 + u16(b, p + 24), asz = u16(b, p + 26) || 20, ac = u16(b, p + 28);
        for (let k = 0; k < ac && as + (k + 1) * asz <= p + size; k++) {
          const a = as + k * asz, ai = u32(b, a + 4), name = pool[ai] || ATTR_BY_ID[ids[ai]] || '';
          if (name) n.attrs[name] = axmlValue(b, a, pool);
        }
        stack[stack.length - 1].children.push(n); stack.push(n);
      } else if (type === 0x103 && stack.length > 1) stack.pop();
      p += size;
    }
    return top.children[0] || null;
  }
  // XML protobuf (manifest dan res/xml di dalam AAB).
  function varint(b, p) {
    let v = 0, m = 1;
    for (let i = 0; i < 10 && p < b.length; i++) { const c = b[p++]; v += (c & 0x7f) * m; if (!(c & 0x80)) return [v, p]; m *= 128; }
    throw new Error('varint');
  }
  function pb(b, s, e) {
    const out = []; let p = s, t, v;
    while (p < e) {
      [t, p] = varint(b, p);
      const f = Math.floor(t / 8), w = t % 8;
      if (w === 0) { [v, p] = varint(b, p); out.push({ f, v }); }
      else if (w === 2) { [v, p] = varint(b, p); if (p + v > e) throw new Error('protobuf'); out.push({ f, s: p, e: p + v }); p += v; }
      else if (w === 5) { out.push({ f, v: u32(b, p) }); p += 4; }
      else if (w === 1) p += 8;
      else throw new Error('protobuf');
      if (out.length > 200000) throw new Error('protobuf terlalu besar');
    }
    return out;
  }
  const pbStr = (b, x) => dec8.decode(b.subarray(x.s, x.e));
  function protoAttr(b, x) {
    const af = pb(b, x.s, x.e); let name = '', val = '';
    af.forEach(a => { if (a.f === 2) name = pbStr(b, a); else if (a.f === 3) val = pbStr(b, a); });
    const ci = af.find(a => a.f === 6), it = ci && pb(b, ci.s, ci.e).find(a => a.f === 7), pr = it && pb(b, it.s, it.e)[0];
    if (!val && pr) val = pr.f === 8 ? (pr.v ? 'true' : 'false') : (pr.f === 6 ? String(pr.v | 0) : '0x' + (pr.v || 0).toString(16));
    return [name, val];
  }
  function protoNode(b, s, e, depth, cnt) {
    const el = pb(b, s, e).find(x => x.f === 1);
    if (!el || depth > LIM.depth || ++cnt.n > LIM.nodes) return null;
    const n = { tag: '', attrs: {}, children: [] };
    pb(b, el.s, el.e).forEach(x => {
      if (x.f === 3) n.tag = pbStr(b, x);
      else if (x.f === 4) { const [k, v] = protoAttr(b, x); if (k) n.attrs[k] = v; }
      else if (x.f === 5) { const c = protoNode(b, x.s, x.e, depth + 1, cnt); if (c) n.children.push(c); }
    });
    return n;
  }
  const parseXml = (b) => ((b[0] === 3 && b[1] === 0) ? parseAxml(b) : protoNode(b, 0, b.length, 0, { n: 0 }));

  // ---------------------------------------------------------------- Manifest Android
  const kids = (n, tag) => n.children.filter(c => c.tag === tag);
  const num = (v) => { const n = /^0x/i.test(v || '') ? parseInt(v, 16) : parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
  const LAUNCH = 'android.intent.category.LAUNCHER';
  function manifestModel(rootNode) {
    const a = rootNode.attrs, sdk = (kids(rootNode, 'uses-sdk')[0] || { attrs: {} }).attrs, app = kids(rootNode, 'application')[0] || { attrs: {}, children: [] };
    const m = { pkg: a.package || '', vn: a.versionName || '', vc: a.versionCode || '', min: num(sdk.minSdkVersion), target: num(sdk.targetSdkVersion), app: app.attrs, perms: [], custom: [], comps: [] };
    if (!m.target) m.target = m.min || 1;
    m.perms = uniq(kids(rootNode, 'uses-permission').concat(kids(rootNode, 'uses-permission-sdk-23')).map(x => x.attrs.name).filter(Boolean));
    m.custom = kids(rootNode, 'permission').map(x => ({ name: x.attrs.name || '', level: x.attrs.protectionLevel || '0' }));
    ['activity', 'activity-alias', 'service', 'receiver', 'provider'].forEach(tag => kids(app, tag).forEach(c => {
      const filters = kids(c, 'intent-filter').map(f => ({
        actions: kids(f, 'action').map(x => x.attrs.name), cats: kids(f, 'category').map(x => x.attrs.name), auto: f.attrs.autoVerify === 'true',
        data: kids(f, 'data').map(d => ({ scheme: d.attrs.scheme || '', host: d.attrs.host || '' }))
      }));
      const ex = c.attrs.exported, isProv = tag === 'provider';
      m.comps.push({
        tag: tag === 'activity-alias' ? 'activity' : tag, name: c.attrs.name || '', filters,
        exported: ex !== undefined ? ex === 'true' : (filters.length > 0 || (isProv && m.target <= 16)),
        guarded: !!(c.attrs.permission || (isProv && c.attrs.readPermission && c.attrs.writePermission)),
        launcher: filters.some(f => f.actions.includes('android.intent.action.MAIN') && f.cats.includes(LAUNCH)),
        grant: c.attrs.grantUriPermissions === 'true'
      });
    }));
    return m;
  }
  // Izin: [tingkat, deskripsi ID, deskripsi EN]; nama tanpa awalan android.permission.
  const PERM = {
    BIND_ACCESSIBILITY_SERVICE: ['H', 'mengendalikan layar & membaca aplikasi lain', 'controls the screen and reads other apps'],
    MANAGE_EXTERNAL_STORAGE: ['H', 'akses ke semua file', 'access to all files'],
    READ_SMS: ['H', 'baca SMS/OTP', 'reads SMS/OTP'], RECEIVE_SMS: ['H', 'terima SMS/OTP', 'receives SMS/OTP'], SEND_SMS: ['H', 'kirim SMS', 'sends SMS'],
    READ_CALL_LOG: ['H', 'baca riwayat panggilan', 'reads the call log'], WRITE_CALL_LOG: ['H', 'ubah riwayat panggilan', 'edits the call log'], PROCESS_OUTGOING_CALLS: ['H', 'pantau panggilan keluar', 'monitors outgoing calls'],
    ACCESS_BACKGROUND_LOCATION: ['H', 'lokasi di latar belakang', 'background location'], READ_LOGS: ['H', 'baca log sistem', 'reads system logs'], BIND_DEVICE_ADMIN: ['H', 'admin perangkat', 'device admin'],
    WRITE_SECURE_SETTINGS: ['H', 'ubah setelan aman', 'edits secure settings'], INSTALL_PACKAGES: ['H', 'pasang aplikasi diam-diam', 'installs apps silently'],
    REQUEST_INSTALL_PACKAGES: ['M', 'memasang APK lain', 'installs other APKs'], SYSTEM_ALERT_WINDOW: ['M', 'overlay layar (tapjacking)', 'screen overlay (tapjacking)'],
    READ_CONTACTS: ['M', 'baca kontak', 'reads contacts'], WRITE_CONTACTS: ['M', 'ubah kontak', 'edits contacts'], GET_ACCOUNTS: ['M', 'daftar akun', 'lists accounts'],
    RECORD_AUDIO: ['M', 'merekam suara', 'records audio'], ACCESS_FINE_LOCATION: ['M', 'lokasi presisi', 'precise location'],
    READ_PHONE_STATE: ['M', 'identitas telepon', 'phone identity'], READ_PHONE_NUMBERS: ['M', 'nomor telepon', 'phone numbers'], CALL_PHONE: ['M', 'menelepon', 'places calls'],
    WRITE_EXTERNAL_STORAGE: ['M', 'tulis penyimpanan bersama', 'writes shared storage'], QUERY_ALL_PACKAGES: ['M', 'daftar semua aplikasi terpasang', 'lists all installed apps'],
    READ_CALENDAR: ['M', 'baca kalender', 'reads the calendar'], WRITE_CALENDAR: ['M', 'ubah kalender', 'edits the calendar'], BODY_SENSORS: ['M', 'sensor tubuh', 'body sensors'], DISABLE_KEYGUARD: ['M', 'matikan kunci layar', 'disables the keyguard'],
    CAMERA: ['L', 'kamera', 'camera'], ACCESS_COARSE_LOCATION: ['L', 'lokasi kasar', 'coarse location'], READ_EXTERNAL_STORAGE: ['L', 'baca penyimpanan bersama', 'reads shared storage'],
    READ_MEDIA_IMAGES: ['L', 'baca foto', 'reads photos'], READ_MEDIA_VIDEO: ['L', 'baca video', 'reads videos'], READ_MEDIA_AUDIO: ['L', 'baca audio', 'reads audio'],
    RECEIVE_BOOT_COMPLETED: ['L', 'jalan otomatis saat boot', 'autostarts on boot'], ACTIVITY_RECOGNITION: ['L', 'aktivitas fisik', 'physical activity'], USE_FULL_SCREEN_INTENT: ['L', 'layar penuh otomatis', 'full-screen intents'],
    BLUETOOTH_CONNECT: ['L', 'koneksi Bluetooth', 'Bluetooth connect'], BLUETOOTH_SCAN: ['L', 'pindai Bluetooth', 'Bluetooth scan'], CHANGE_WIFI_STATE: ['L', 'ubah Wi-Fi', 'changes Wi-Fi']
  };
  const permShort = (p) => p.replace(/^android\.permission\./, '');
  function permFinds(m, L, add) {
    const g = { H: [], M: [], L: [] };
    m.perms.forEach(p => { const r = PERM[permShort(p)]; if (r && /^android\.permission\./.test(p)) g[r[0]].push(permShort(p) + ' (' + r[1 + L] + ')'); });
    if (g.H.length) add('HIGH', 'ak_perm_high', { x: more(g.H, 12) });
    if (g.M.length) add('MEDIUM', 'ak_perm_med', { x: more(g.M, 12) });
    if (g.L.length) add('LOW', 'ak_perm_low', { x: more(g.L, 12) });
  }
  const weakLevel = (lv) => { const n = num(lv); return /^(normal|dangerous)$/i.test(lv) || (Number.isFinite(n) && /^[0-9]/.test(lv) && ((n & 0xf) === 0 || (n & 0xf) === 1)); };
  function compFinds(m, add) {
    const open = (tag) => m.comps.filter(c => c.tag === tag && c.exported && !c.guarded && !c.launcher).map(c => c.name.split('.').pop() || c.name);
    [['provider', 'HIGH'], ['service', 'MEDIUM'], ['receiver', 'MEDIUM'], ['activity', 'LOW']].forEach(([t, sev]) => { const l = open(t); if (l.length) add(sev, 'ak_export_' + t, { x: more(l) }); });
    const gr = m.comps.filter(c => c.tag === 'provider' && c.grant).map(c => c.name.split('.').pop());
    if (gr.length) add('MEDIUM', 'ak_grant_uri', { x: more(gr) });
    const bad = m.custom.filter(c => c.name && weakLevel(c.level)).map(c => c.name);
    if (bad.length) add('MEDIUM', 'ak_perm_custom', { x: more(bad) });
  }
  function linkFinds(m, add) {
    const custom = [], web = [], all = [];
    m.comps.forEach(c => c.filters.forEach(f => {
      if (!f.cats.includes('android.intent.category.BROWSABLE')) return;
      f.data.forEach(d => {
        if (!d.scheme) return;
        const u = d.scheme + '://' + (d.host || '*');
        all.push(u);
        if (/^https?$/.test(d.scheme)) { if (!f.auto) web.push(u); } else custom.push(u);
      });
    }));
    if (custom.length) add('LOW', 'ak_deeplink_custom', { x: more(uniq(custom)) });
    if (web.length) add('LOW', 'ak_deeplink_web', { x: more(uniq(web)) });
    return uniq(all);
  }
  const ANDROID_API = { 19: '4.4', 21: '5.0', 23: '6.0', 24: '7.0', 26: '8.0', 28: '9', 29: '10', 30: '11', 31: '12', 33: '13', 34: '14', 35: '15' };
  const apiName = (n) => ANDROID_API[n] || ANDROID_API[Object.keys(ANDROID_API).filter(k => +k <= n).pop()] || '?';
  function manifestFinds(m, L, add) {
    const a = m.app;
    if (a.debuggable === 'true') add('HIGH', 'ak_debuggable');
    if (a.testOnly === 'true') add('MEDIUM', 'ak_testonly');
    if (a.allowBackup !== 'false' && !a.dataExtractionRules && !a.fullBackupContent) add('MEDIUM', 'ak_backup');
    if (a.usesCleartextTraffic === 'true') add('MEDIUM', 'ak_cleartext');
    else if (a.usesCleartextTraffic === undefined && !a.networkSecurityConfig && m.target < 28) add('LOW', 'ak_cleartext_def', { x: m.target });
    if (a.requestLegacyExternalStorage === 'true') add('LOW', 'ak_legacystorage');
    if (m.min && m.min < 24) add(m.min < 21 ? 'MEDIUM' : 'LOW', 'ak_minsdk', { x: m.min, y: apiName(m.min) });
    if (m.target < PLAY_TARGET_SDK) add(m.target < 28 ? 'HIGH' : (m.target < 33 ? 'MEDIUM' : 'LOW'), 'ak_targetsdk', { x: m.target, y: PLAY_TARGET_SDK });
    permFinds(m, L, add); compFinds(m, add);
  }
  // network_security_config (res/xml/*.xml): cari berkas berakar <network-security-config>.
  async function nscFinds(c, m, add) {
    if (!m.app.networkSecurityConfig) return;
    const cands = c.names.filter(n => /^res\/.*\.xml$/i.test(n) && (c.by.get(n).size < 16384)).sort((x, y) => (/\/xml\//.test(y) ? 1 : 0) - (/\/xml\//.test(x) ? 1 : 0)).slice(0, 400);
    for (const n of cands) {
      const d = await c.read(n, 16384); let r = null;
      try { r = d && parseXml(d); } catch (e) { r = null; }
      if (!r || r.tag !== 'network-security-config') continue;
      const base = kids(r, 'base-config')[0];
      if (base && base.attrs.cleartextTrafficPermitted === 'true') add('MEDIUM', 'ak_nsc_base');
      const dom = kids(r, 'domain-config').filter(x => x.attrs.cleartextTrafficPermitted === 'true').flatMap(x => kids(x, 'domain').map(y => y.attrs.value || '?'));
      if (dom.length) add('LOW', 'ak_nsc_domain', { x: more(uniq(dom)) });
      const anchors = [].concat(...[base].concat(kids(r, 'domain-config')).filter(Boolean).map(x => kids(x, 'trust-anchors').flatMap(t => kids(t, 'certificates'))));
      if (anchors.some(x => x.attrs.src === 'user')) add('HIGH', 'ak_nsc_user');
      return;
    }
  }

  // ---------------------------------------------------------------- Tanda tangan (v1 PKCS#7, blok v2/v3) + parser DER mini
  const OID_NAME = { '2.5.4.3': 'CN', '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST' };
  const OID_SIG = { '1.2.840.113549.1.1.4': 'MD5withRSA', '1.2.840.113549.1.1.5': 'SHA1withRSA', '1.2.840.113549.1.1.11': 'SHA256withRSA', '1.2.840.113549.1.1.12': 'SHA384withRSA', '1.2.840.113549.1.1.13': 'SHA512withRSA', '1.2.840.10045.4.1': 'SHA1withECDSA', '1.2.840.10045.4.3.2': 'SHA256withECDSA', '1.2.840.10045.4.3.3': 'SHA384withECDSA', '1.2.840.10040.4.3': 'SHA1withDSA', '1.2.840.113549.1.1.10': 'RSASSA-PSS' };
  const OID_CURVE = { '1.2.840.10045.3.1.7': 256, '1.3.132.0.34': 384, '1.3.132.0.35': 521 };
  function der(b, o, end) {
    if (o + 2 > end) throw new Error('DER');
    let l = b[o + 1], h = 2;
    if (l & 0x80) { const n = l & 0x7f; if (n > 4 || o + 2 + n > end) throw new Error('DER'); l = 0; for (let i = 0; i < n; i++) l = l * 256 + b[o + 2 + i]; h = 2 + n; }
    if (o + h + l > end) throw new Error('DER');
    return { tag: b[o], o, s: o + h, e: o + h + l };
  }
  function dkids(b, n) {
    const out = [];
    for (let p = n.s; p < n.e && out.length < 64;) { const k = der(b, p, n.e); out.push(k); p = k.e; }
    return out;
  }
  function oid(b, n) {
    const a = []; let v = 0;
    for (let i = n.s; i < n.e; i++) { v = v * 128 + (b[i] & 0x7f); if (!(b[i] & 0x80)) { a.push(v); v = 0; } }
    const f = a.shift() || 0;
    return (f >= 80 ? [2, f - 80] : [Math.floor(f / 40), f % 40]).concat(a).join('.');
  }
  function dname(b, n) {
    return dkids(b, n).map(set => { const kv = dkids(b, dkids(b, set)[0]); return (OID_NAME[oid(b, kv[0])] || oid(b, kv[0])) + '=' + dec8.decode(b.subarray(kv[1].s, kv[1].e)); }).join(', ');
  }
  function dtime(b, n) {
    const s = decL.decode(b.subarray(n.s, n.e)), y = n.tag === 0x17 ? (+s.slice(0, 2) < 50 ? 2000 : 1900) + +s.slice(0, 2) : +s.slice(0, 4), r = n.tag === 0x17 ? s.slice(2) : s.slice(4);
    return y + '-' + r.slice(0, 2) + '-' + r.slice(2, 4);
  }
  async function certInfo(c) {
    const tk = dkids(c, dkids(c, der(c, 0, c.length))[0]), i = tk[0].tag === 0xA0 ? 1 : 0;
    const alg = oid(c, dkids(c, tk[i + 1])[0]), spki = dkids(c, tk[i + 5]), pa = dkids(c, spki[0]), kt = oid(c, pa[0]), bits = spki[1];
    let size = 0;
    if (kt === '1.2.840.113549.1.1.1') { const rsa = dkids(c, der(c, bits.s + 1, bits.e)), mod = rsa[0]; size = (mod.e - mod.s - (c[mod.s] === 0 ? 1 : 0)) * 8; }
    else if (pa[1] && pa[1].tag === 6) size = OID_CURVE[oid(c, pa[1])] || 0;
    const val = dkids(c, tk[i + 3]), subtle = root.crypto && root.crypto.subtle;
    return {
      subject: dname(c, tk[i + 4]), issuer: dname(c, tk[i + 2]), from: dtime(c, val[0]), to: dtime(c, val[1]), alg: OID_SIG[alg] || alg,
      kt: kt === '1.2.840.113549.1.1.1' ? 'RSA' : (kt === '1.2.840.10045.2.1' ? 'EC' : (kt === '1.2.840.10040.4.1' ? 'DSA' : kt)), size,
      sha: subtle ? hex(new Uint8Array(await subtle.digest('SHA-256', c))) : ''
    };
  }
  function pkcs7Cert(b) {
    const sd = dkids(b, dkids(b, der(b, 0, b.length))[1])[0], set = dkids(b, sd).find(x => x.tag === 0xA0);
    const c = dkids(b, set)[0];
    return b.subarray(c.o, c.e);
  }
  function sigBlock(b, cdOff) {
    if (cdOff < 32 || decL.decode(b.subarray(cdOff - 16, cdOff)) !== 'APK Sig Block 42') return null;
    const size = u32(b, cdOff - 24), start = cdOff - size - 8;
    if (start < 0 || u32(b, start) !== size) return null;
    const pairs = {};
    for (let p = start + 8; p + 12 <= cdOff - 24;) { const len = u32(b, p); if (len < 4 || p + 8 + len > cdOff - 24) break; pairs[u32(b, p + 8)] = p + 12; p += 8 + len; }
    return pairs;
  }
  function blockCert(b, vs) {
    let p = vs + 4 + 4 + 4; // panjang signers, panjang signer, panjang signed data
    p += 4 + u32(b, p); // digests
    p += 4; // panjang certificates
    const l = u32(b, p);
    return b.subarray(p + 4, p + 4 + l);
  }
  async function sigFinds(c, bundle, L, R, add) {
    const v1 = c.names.filter(n => /^META-INF\/[^/]+\.(RSA|DSA|EC)$/i.test(n));
    const blk = !bundle && c.list.cdOff ? sigBlock(c.b, c.list.cdOff) : null, sch = [];
    if (v1.length) sch.push('v1'); if (blk && blk[0x7109871a]) sch.push('v2'); if (blk && blk[0xf05368c0]) sch.push('v3'); if (blk && blk[0x1b93ad61]) sch.push('v3.1');
    if (!sch.length) { add('HIGH', 'ak_sig_none'); return; }
    let der0 = null;
    try {
      const at = blk && (blk[0xf05368c0] || blk[0x7109871a]);
      if (at) der0 = blockCert(c.b, at);
      else { const d = await c.read(v1[0], 65536); if (d) der0 = pkcs7Cert(d); }
    } catch (e) { der0 = null; }
    let ci = null;
    try { ci = der0 && await certInfo(der0); } catch (e) { ci = null; }
    R.meta.push([LBL.sig[L], sch.join(', ')]);
    if (ci) {
      R.meta.push([LBL.cert[L], ci.subject + ' | ' + ci.kt + (ci.size ? ' ' + ci.size : '') + ' | ' + ci.alg + ' | ' + ci.from + ' → ' + ci.to + (ci.sha ? ' | SHA-256 ' + ci.sha.match(/../g).join(':') : '')]);
      if (/CN=Android Debug/i.test(ci.subject)) add('HIGH', 'ak_sig_debug');
      if (/MD5|SHA1/i.test(ci.alg)) add(/MD5/i.test(ci.alg) ? 'HIGH' : 'MEDIUM', 'ak_sig_weak', { x: ci.alg });
      if (ci.kt === 'RSA' && ci.size && ci.size < 2048) add('MEDIUM', 'ak_sig_small', { x: ci.size });
    }
    if (sch.length === 1 && sch[0] === 'v1' && !bundle) add('MEDIUM', 'ak_sig_v1only');
  }

  // ---------------------------------------------------------------- Isi paket (layout) dan framework
  const FW = [[/^assets\/flutter_assets\/|\/libflutter\.so$/, 'Flutter'], [/(^|\/)index\.android\.bundle$|libreactnativejni\.so$|libhermes\.so$/, 'React Native'], [/^assets\/www\/|(^|\/)cordova\.js$/, 'Cordova'],
    [/^assets\/public\/index\.html$|capacitor\.config\.json$/, 'Capacitor/Ionic'], [/libunity\.so$|^assets\/bin\/Data\//, 'Unity'], [/^assemblies\/|libmonodroid\.so$/, 'Xamarin/.NET MAUI'], [/libNativeScript\.so$/, 'NativeScript']];
  function layoutFinds(c, L, R, add) {
    const n = c.names, dex = n.filter(x => /^classes\d*\.dex$/.test(x)), abis = uniq(n.map(x => (/^lib\/([^/]+)\//.exec(x) || [])[1]).filter(Boolean));
    R.meta.push([LBL.dex[L], dex.length]);
    if (abis.length) R.meta.push([LBL.abi[L], abis.join(', ')]);
    if (abis.length && !abis.some(a => /64/.test(a))) add('LOW', 'ak_no64', { x: abis.join(', ') });
    const fw = FW.filter(([re]) => n.some(x => re.test(x))).map(f => f[1]);
    if (fw.length) R.meta.push([LBL.fw[L], fw.join(', ')]);
    const hid = n.filter(x => /^(assets|res\/raw)\/.*\.(apk|dex|jar|so|odex|vdex)$/i.test(x));
    if (hid.length) add('MEDIUM', 'ak_hidden', { x: more(hid) });
    return fw;
  }

  // ---------------------------------------------------------------- Pemindai string (DEX, resources.arsc, aset teks)
  const SECRET = [
    [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, 'HIGH', 'ak_s_secret'], [/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_\w{30,}|xox[abprs]-[A-Za-z0-9-]{10,}|(?:sk|rk)_live_[0-9A-Za-z]{16,}|glpat-[\w-]{16,})/g, 'HIGH', 'ak_s_secret'],
    [/-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g, 'HIGH', 'ak_s_privkey'], [/\bAIza[0-9A-Za-z_-]{35}\b/g, 'LOW', 'ak_s_gkey'],
    [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, 'MEDIUM', 'ak_s_jwt'],
    [/\b(?:password|passwd|pwd|secret|api[_-]?key|client[_-]?secret|auth[_-]?token)["']?\s*[:=]\s*["']?[A-Za-z0-9_@#$%^&*!.+\/-]{8,}/gi, 'LOW', 'ak_s_cred'],
    [/https:\/\/[a-z0-9-]+(?:-default-rtdb)?\.firebaseio\.com/g, 'INFO', 'ak_s_firebase'], [/\b[a-z0-9][a-z0-9.-]{2,60}\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com\b/g, 'INFO', 'ak_s_s3']
  ];
  const URL_RE = /https?:\/\/[^\s"'<>\\^`{|}]{4,160}/g;
  const BENIGN = /^(?:schemas\.[a-z.]+|www\.w3\.org|ns\.adobe\.com|xml\.org|xmlpull\.org|(?:www\.)?apache\.org|java\.sun\.com|purl\.org|www\.opengis\.net|(?:www\.)?(?:iana|ietf|unicode|gnu|mozilla|eclipse)\.org|(?:www\.)?example\.(?:com|org)|(?:www\.|developer\.)?android\.com|[a-z.]*\.?xmlsoap\.org)$/i;
  const INTERNAL = /^(?:localhost|0\.0\.0\.0|(?:127|10)\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|[^/:]*\.(?:local|internal|lan|corp|intranet|test))(?::|\/|$)/i;
  const API = [
    [/addJavascriptInterface/, 'MEDIUM', 'ak_a_jsbridge'], [/setAllowUniversalAccessFromFileURLs|setAllowFileAccessFromFileURLs/, 'MEDIUM', 'ak_a_fileurl'],
    [/ALLOW_ALL_HOSTNAME_VERIFIER|AllowAllHostnameVerifier/, 'HIGH', 'ak_a_hostname'], [/onReceivedSslError/, 'MEDIUM', 'ak_a_sslerr'], [/Ljavax\/net\/ssl\/X509TrustManager;/, 'LOW', 'ak_a_trust'],
    [/AES\/ECB/, 'MEDIUM', 'ak_a_ecb'], [/^(?:DES|DESede|RC4|ARC4)(?:\/|$)/m, 'MEDIUM', 'ak_a_des'], [/^(?:MD5|SHA-?1)$/m, 'LOW', 'ak_a_hash'],
    [/Ldalvik\/system\/DexClassLoader;/, 'MEDIUM', 'ak_a_dexload'], [/MODE_WORLD_(?:READABLE|WRITEABLE)/, 'HIGH', 'ak_a_world'], [/getExternalStorageDirectory|getExternalFilesDir/, 'LOW', 'ak_a_extstore'],
    [/\/system\/(?:x?bin)\/su\b|Superuser\.apk|com\.topjohnwu\.magisk|RootBeer/, 'INFO', 'ak_a_root'], [/\bfrida\b|de\.robv\.android\.xposed|XposedBridge/i, 'INFO', 'ak_a_hook']
  ];
  const take = (text, re, max) => { const out = []; for (const m of text.matchAll(re)) { out.push(m[0]); if (out.length >= max) break; } return out; };
  function scanText(text, where, seen, add, doApi) {
    SECRET.forEach(([re, sev, key]) => {
      const hit = uniq(take(text, re, 40)).map(v => (key === 'ak_s_privkey' || key === 'ak_s_firebase' || key === 'ak_s_s3') ? v : mask(v)).filter(v => !seen.has(key + v));
      hit.forEach(v => seen.add(key + v));
      if (hit.length) add(sev, key, { w: where, x: more(hit) });
    });
    const urls = uniq(take(text, URL_RE, 4000).map(u => u.replace(/[.,;)]+$/, ''))), http = [], inter = [];
    urls.forEach(u => {
      const host = u.replace(/^https?:\/\//, '');
      if (/^[%{$<[]|%[sd]/.test(host.split('/')[0])) return; // templat format (http://%s/...), bukan alamat nyata
      if (INTERNAL.test(host)) inter.push(u); else if (/^http:/.test(u) && !BENIGN.test(host.split(/[/:?]/)[0])) http.push(u);
    });
    // Cukup asal (skema + host): string bytecode Hermes sering menempel sehingga path-nya tidak bisa dipercaya.
    const fresh = (a, k) => uniq(a.map(u => (/^https?:\/\/[^/?#]+/.exec(u) || [u])[0].slice(0, 70))).filter(u => !seen.has(k + u)).map(u => { seen.add(k + u); return u; });
    const h = fresh(http, 'h'), i = fresh(inter, 'i');
    if (h.length) add('MEDIUM', 'ak_s_http', { w: where, x: more(h) });
    if (i.length) add('LOW', 'ak_s_internal', { w: where, x: more(i) });
    if (doApi) API.forEach(([re, sev, key]) => { if (!seen.has(key) && re.test(text)) { seen.add(key); add(sev, key); } });
  }
  function dexStrings(d, out) {
    if (d.length < 0x70 || d[0] !== 0x64 || d[1] !== 0x65 || d[2] !== 0x78) return;
    const n = u32(d, 0x38), off = u32(d, 0x3c);
    for (let i = 0; i < n && out.length < LIM.strings && off + i * 4 + 4 <= d.length; i++) {
      let p = u32(d, off + i * 4);
      if (p >= d.length) continue;
      while (d[p] & 0x80) p++;
      p++;
      let q = p; const lim = Math.min(d.length, p + 4096);
      while (q < lim && d[q] !== 0) q++;
      out.push(dec8.decode(d.subarray(p, q)));
    }
  }
  const TEXT_ASSET = /^(?:assets\/.*\.(?:js|jsbundle|bundle|json|html?|txt|properties|xml|ya?ml|env|cfg|conf|ini|config|plist)|res\/raw\/[^/]+)$/i;
  async function stringFinds(c, L, R, add, fw) {
    const seen = new Set(), strs = [];
    let scanned = 0;
    for (const n of c.names.filter(x => /^classes\d*\.dex$/.test(x))) { const d = await c.read(n); if (d) dexStrings(d, strs); }
    const classes = strs.filter(s => /^L[\w$/]+;$/.test(s)).slice(0, 60000);
    if (strs.length) {
      scanned += strs.length;
      scanText(strs.join('\n'), 'DEX', seen, add, true);
      if (classes.length > 200) {
        const sh = classes.filter(s => (s.slice(0, -1).split('/').pop() || '').length <= 2).length, pct = Math.round(sh * 100 / classes.length);
        R.meta.push([LBL.obf[L], pct + '% ' + (L ? 'short class names' : 'nama kelas pendek')]);
        if (pct < 15 && !fw.includes('Flutter')) add('LOW', 'ak_notobf', { x: pct });
      }
    }
    const arsc = c.names.includes('resources.arsc') ? await c.read('resources.arsc') : null;
    if (arsc && arsc.length > 12) {
      try { const ps = readPool(arsc, u16(arsc, 2), arsc.length); scanned += ps.length; scanText(ps.join('\n'), 'resources.arsc', seen, add, false); } catch (e) { add('INFO', 'ak_parse_fail', { x: 'resources.arsc' }); }
    }
    for (const n of c.names.filter(x => TEXT_ASSET.test(x) || /(^|\/)index\.android\.bundle$/.test(x)).slice(0, LIM.files)) {
      const d = await c.read(n, LIM.scanBytes);
      if (!d) continue;
      if (/index\.android\.bundle$/.test(n)) add('INFO', 'ak_rn_bundle', { x: (d[0] === 0xC6 && d[1] === 0x1F && d[2] === 0xBC ? 'Hermes bytecode' : 'JavaScript') + ', ' + (d.length / 1048576).toFixed(1) + ' MB' });
      scanned += d.length;
      scanText(decL.decode(d), n, seen, add, false);
    }
    R.meta.push([LBL.strs[L], scanned.toLocaleString()]);
  }

  // ---------------------------------------------------------------- APK / AAB
  async function scanAndroid(c, R, L, bundle) {
    const add = (sev, key, vars) => R.finds.push({ sev, key, vars });
    let m = null;
    try {
      const mb = await c.read('AndroidManifest.xml', 8 << 20), rn = mb && parseXml(mb);
      if (rn) m = manifestModel(rn);
    } catch (e) { add('INFO', 'ak_parse_fail', { x: 'AndroidManifest.xml' }); }
    if (m) {
      R.meta.push([LBL.pkg[L], m.pkg]);
      R.meta.push([LBL.ver[L], m.vn + (m.vc ? ' (' + m.vc + ')' : '')]);
      R.meta.push([LBL.sdk[L], (m.min || '?') + ' / ' + m.target]);
      if (m.app.name) R.meta.push([LBL.app[L], m.app.name]);
      manifestFinds(m, L, add);
      const links = linkFinds(m, add);
      R.meta.push([LBL.perms[L] + ' (' + m.perms.length + ')', m.perms.map(permShort).join(', ')]);
      R.meta.push([LBL.comps[L], ['activity', 'service', 'receiver', 'provider'].map(t => t + ' ' + m.comps.filter(x => x.tag === t).length).join(', ')]);
      if (links.length) R.meta.push([LBL.links[L], more(links, 12)]);
      try { await nscFinds(c, m, add); } catch (e) { add('INFO', 'ak_parse_fail', { x: 'network_security_config' }); }
    }
    try { await sigFinds(c, bundle, L, R, add); } catch (e) { add('INFO', 'ak_parse_fail', { x: 'signature' }); }
    const fw = layoutFinds(c, L, R, add);
    try { await stringFinds(c, L, R, add, fw); } catch (e) { add('INFO', 'ak_parse_fail', { x: 'strings' }); }
  }
  const aabAlias = (n) => {
    if (!n.startsWith('base/')) return n;
    let v = n.slice(5);
    if (v === 'manifest/AndroidManifest.xml') return 'AndroidManifest.xml';
    if (v.startsWith('dex/')) v = v.slice(4);
    return v.startsWith('root/') ? v.slice(5) : v;
  };

  // ---------------------------------------------------------------- IPA (Info.plist biner/XML + provisioning profile)
  function bplist(b) {
    if (b.length < 40) throw new Error('bplist');
    const be = (o, l) => { let v = 0; for (let i = 0; i < l; i++) v = v * 256 + b[o + i]; return v; }; // big-endian
    const tl = b.length - 32, osz = b[tl + 6], rsz = b[tl + 7], n = be(tl + 8, 8), top = be(tl + 16, 8), tab = be(tl + 24, 8);
    if (n > 100000 || tab + n * osz > b.length || !osz || !rsz) throw new Error('bplist');
    const obj = (i, d) => {
      if (d > 32 || i >= n) throw new Error('bplist');
      let p = be(tab + i * osz, osz); const t = b[p] >> 4; let l = b[p] & 15; p++;
      if (t === 0) return l === 8 ? false : (l === 9 ? true : null);
      if (t === 1) return be(p, 1 << l);
      if (l === 15) { const k = 1 << (b[p] & 15); l = be(p + 1, k); p += 1 + k; }
      if (l > 1e6 || p + l > b.length) throw new Error('bplist');
      if (t === 5) return decL.decode(b.subarray(p, p + l));
      if (t === 6) return dec16.decode(Uint8Array.from({ length: l * 2 }, (_, k) => b[p + (k ^ 1)]));
      if (t === 10) return Array.from({ length: Math.min(l, 5000) }, (_, k) => obj(be(p + k * rsz, rsz), d + 1));
      if (t === 13) { const o = {}; for (let k = 0; k < Math.min(l, 5000); k++) o[obj(be(p + k * rsz, rsz), d + 1)] = obj(be(p + (l + k) * rsz, rsz), d + 1); return o; }
      return null;
    };
    return obj(top, 0);
  }
  function xplist(s) {
    const toks = (s.match(/<\/?[a-zA-Z]+\/?>|[^<]+/g) || []).filter(t => /\S/.test(t)).map(t => t.trim());
    let i = 0;
    const val = (d) => {
      if (d > 32 || i >= toks.length) return null;
      const t = toks[i++];
      if (t === '<true/>') return true;
      if (t === '<false/>') return false;
      if (t === '<dict/>') return {};
      if (t === '<array/>') return [];
      if (t === '<dict>') { const o = {}; while (i < toks.length && toks[i] !== '</dict>') { if (toks[i++] !== '<key>') continue; const k = toks[i++]; i++; o[k] = val(d + 1); } i++; return o; }
      if (t === '<array>') { const a = []; while (i < toks.length && toks[i] !== '</array>') a.push(val(d + 1)); i++; return a; }
      if (/^<(string|integer|real|date|data)>$/.test(t)) { const v = toks[i] && !/^</.test(toks[i]) ? toks[i++] : ''; i++; return t === '<integer>' ? Number(v) : v; }
      return null;
    };
    while (i < toks.length && toks[i] !== '<dict>') i++;
    return val(0);
  }
  const plistOf = (d) => (d[0] === 0x62 && d[1] === 0x70 ? bplist(d) : xplist(dec8.decode(d)));
  async function scanIpa(c, R, L) {
    const add = (sev, key, vars) => R.finds.push({ sev, key, vars });
    const pn = c.names.find(n => /^Payload\/[^/]+\.app\/Info\.plist$/.test(n));
    let pl = null;
    try { pl = plistOf(await c.read(pn, 4 << 20)); } catch (e) { add('INFO', 'ak_parse_fail', { x: 'Info.plist' }); }
    const dir = pn.replace(/Info\.plist$/, '');
    if (pl) {
      R.meta.push([LBL.pkg[L], pl.CFBundleIdentifier]);
      R.meta.push([LBL.ver[L], (pl.CFBundleShortVersionString || '') + (pl.CFBundleVersion ? ' (' + pl.CFBundleVersion + ')' : '')]);
      R.meta.push([LBL.sdk[L], 'iOS ' + (pl.MinimumOSVersion || '?') + ' / ' + (pl.DTPlatformVersion || '?')]);
      const ats = pl.NSAppTransportSecurity || {};
      if (ats.NSAllowsArbitraryLoads === true) add('HIGH', 'ak_ios_ats');
      const ex = ats.NSExceptionDomains || {}, exd = Object.keys(ex).filter(k => ex[k] && (ex[k].NSExceptionAllowsInsecureHTTPLoads === true || ex[k].NSTemporaryExceptionAllowsInsecureHTTPLoads === true));
      if (exd.length) add('MEDIUM', 'ak_ios_ats_dom', { x: more(exd) });
      if (pl.UIFileSharingEnabled === true) add('MEDIUM', 'ak_ios_share');
      if (num(pl.MinimumOSVersion) && num(pl.MinimumOSVersion) < 13) add('LOW', 'ak_ios_minos', { x: pl.MinimumOSVersion });
      const perms = Object.keys(pl).filter(k => /^NS.*UsageDescription$/.test(k)).map(k => k.replace(/^NS|UsageDescription$/g, ''));
      if (perms.length) add('INFO', 'ak_ios_perm', { x: more(perms, 14) });
      const sch = uniq([].concat(...(pl.CFBundleURLTypes || []).map(t => (t && t.CFBundleURLSchemes) || [])));
      if (sch.length) { R.meta.push([LBL.schemes[L], more(sch, 12)]); add('LOW', 'ak_ios_scheme', { x: more(sch) }); }
    }
    try {
      const pr = await c.read(dir + 'embedded.mobileprovision', 1 << 20), t = pr ? decL.decode(pr) : '';
      if (/<key>get-task-allow<\/key>\s*<true\/>/.test(t)) add('HIGH', 'ak_ios_taskallow');
      if (/<key>ProvisionsAllDevices<\/key>\s*<true\/>/.test(t)) add('MEDIUM', 'ak_ios_enterprise');
    } catch (e) { add('INFO', 'ak_parse_fail', { x: 'embedded.mobileprovision' }); }
    const seen = new Set(), exe = dir + (pl && pl.CFBundleExecutable ? pl.CFBundleExecutable : '');
    const fw = c.names.filter(n => n.startsWith(dir + 'Frameworks/') && /\.framework\/$/.test(n) && n.split('/').length === dir.split('/').length + 2);
    if (fw.length) R.meta.push([LBL.fw[L], fw.length]);
    for (const n of [exe].concat(c.names.filter(x => x.startsWith(dir) && /\.(jsbundle|bundle|json|js|plist|txt|html?)$/i.test(x) && x !== pn)).slice(0, LIM.files)) {
      const d = await c.read(n, LIM.scanBytes);
      if (d) scanText(decL.decode(d), n.slice(dir.length), seen, add, false);
    }
  }

  // ---------------------------------------------------------------- Pintu masuk
  function kind(names) {
    if (names.includes('AndroidManifest.xml') && names.some(n => /^classes\d*\.dex$/.test(n) || n === 'resources.arsc')) return { id: 'apk', label: 'Android APK', ext: ['apk'] };
    if (names.includes('base/manifest/AndroidManifest.xml')) return { id: 'aab', label: 'Android App Bundle (AAB)', ext: ['aab'] };
    if (names.some(n => /^Payload\/[^/]+\.app\/Info\.plist$/.test(n))) return { id: 'ipa', label: 'iOS IPA', ext: ['ipa'] };
    if (names.filter(n => /\.apk$/i.test(n)).length && (names.includes('manifest.json') || names.includes('info.json') || names.some(n => /^(base|split_config\.[^/]+)\.apk$/i.test(n)))) return { id: 'xapk', label: 'XAPK / split APKs', ext: ['xapk', 'apks', 'apkm'] };
    if (names.includes('AndroidManifest.xml')) return { id: 'apk', label: 'Android APK', ext: ['apk'] };
    return null;
  }
  async function scan(bytes, opts) {
    const o = Object.assign({ lang: 'id', inflate: null, name: '' }, opts), L = o.lang === 'en' ? 1 : 0, R = { kind: '', meta: [], finds: [] };
    o.st = { used: 0 };
    const c0 = mkCtx(bytes, o);
    if (!c0) throw new Error('ZIP');
    const k = kind(c0.names);
    if (!k) return R;
    R.kind = k.id;
    R.meta.push([LBL.kind[L], k.label]);
    if (k.id === 'apk') await scanAndroid(c0, R, L, false);
    else if (k.id === 'aab') await scanAndroid(mkCtx(bytes, o, aabAlias), R, L, true);
    else if (k.id === 'ipa') await scanIpa(c0, R, L);
    else {
      const apks = c0.list.filter(e => /\.apk$/i.test(e.name)).sort((a, b) => b.size - a.size), base = apks.find(e => /(^|\/)(base|package)[^/]*\.apk$/i.test(e.name)) || apks[0];
      R.meta.push([LBL.split[L], more(apks.slice(0, LIM.splits + 2).map(e => e.name), LIM.splits)]);
      const inner = await c0.read(base.name, LIM.entry), c1 = inner && mkCtx(inner, Object.assign({}, o, { st: o.st }));
      if (c1) await scanAndroid(c1, R, L, false); else R.finds.push({ sev: 'INFO', key: 'ak_parse_fail', vars: { x: base.name } });
    }
    const rank = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };
    R.finds.sort((a, b) => rank[a.sev] - rank[b.sev]);
    return R;
  }

  const api = { scan, kind, parseAxml, parseXml, readPool, zipList, bplist, xplist, M };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ApkScan = api;
})(globalThis);
