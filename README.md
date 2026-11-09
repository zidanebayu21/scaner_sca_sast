# Scanner Security

Aplikasi client-side mandiri (Vue 3 lokal offline, tanpa build step) untuk memeriksa keamanan proyek, jaringan, dan otomasi langsung di browser:

- **Pipa Log (Inbound & Outbound Inspector)**: Pencatat lalu lintas data HTTP, WebSocket, CDN, Inbound Hook (WA/Shopee/Sheet/Pup/Debug), dan operasi IndexedDB/localStorage secara transparan dan persisten di browser (IndexedDB `scaPipeLog`). Dilengkapi mini-widget live log 2-baris di header dan floating inspector detail.
- **SCA & SAST Mandiri**: Software Composition Analysis (OSV.dev, EPSS, KEV, lisensi dependency) dan Static Code Analysis lokal (zero-outbound) tanpa backend.
- **Smart Diff & Secret Masker**: Pembanding file/JSON/.env lokal berdampingan dengan auto-redact rahasia/token/kunci sensitif (14 pola deteksi).
- **Master Hook**: 1 bookmarklet cerdas yang mendeteksi otomatis halaman target (WhatsApp Web, Shopee, Google Sheets, Swagger) atau membuka peluncur 6 alat interaktif.
- **Reset Full & Backup**: Penghitung total volume data browser dari seluruh hook/fitur dan penghapusan menyeluruh (Factory Wipe) dengan 1 klik cadangan `.json`.
- **100% Offline Ready**: Berjalan langsung via `file://` atau GitHub Pages dengan 0 request CDN eksternal saat dibuka, serta ekspor laporan HTML mandiri 1-file.

- **SCA (Software Composition Analysis)**: tempel `package.json`, dependency dicek ke database kerentanan [OSV.dev](https://osv.dev).
- **SAST (Static Application Security Testing)**: tempel kode JS/TS, dicek terhadap pola berbahaya (eval, new Function, setTimeout berisi string, innerHTML/outerHTML, document.write, v-html, child_process, RegExp.exec) dan secret ter-hardcode (AWS key, private key, token GitHub/Slack/Stripe/Google, password/secret). Komentar dan isi string diabaikan untuk pola eksekusi kode, tetapi tetap diperiksa untuk secret.

## Tema & Bahasa

Di kanan atas ada dua toggle: **tema terang/gelap** (☀️/🌙, tersimpan di browser) dan **bahasa** (ID/EN). Default Bahasa Indonesia; versi Inggris dibuka di `/en/` — mis. `https://zidanebayu21.github.io/scaner_sca_sast/en/`. Bahasa dideteksi dari query `?lang=` → path `/en/` → localStorage → default `id`. `en/index.html` **bukan** salinan, melainkan stub kecil yang mengarahkan ke `../?lang=en`, jadi `index.html` tetap satu-satunya sumber dan tak perlu disalin ulang saat berubah.

Kamus terjemahan dipisah di **`i18n/i18n.js`** (bukan `.json`, karena `fetch` file lokal diblokir browser saat `index.html` dibuka langsung lewat `file://`; file `.js` yang dimuat `<script>` jalan di GitHub Pages maupun `file://`). Teks UI di tab memakai `t('key')` dengan fallback ke Indonesia bila sebuah key belum diterjemahkan.

## Cara Pakai

Buka `index.html` di browser (tidak perlu build / server).

1. Seret & lepas (atau pilih / tempel teks) satu atau beberapa file: `package-lock.json`, `package.json`, `composer.lock`, `packages.lock.json`, `*.csproj`, atau `Dockerfile`.
2. Klik **Scan & buka laporan**. Laporan HTML terbuka di tab baru (bisa diunduh, ada tautan CSV).

**SCA**: package dicek ke OSV.dev lengkap dengan versi aman (diverifikasi ulang), jenis update, severity (GHSA/CVSS), CWE, EPSS, status CISA KEV, dan perintah perbaikan. Package tanpa versi aman ditandai merah.

**Dockerfile**: status EOL base image (endoflife.date), temuan konfigurasi (tanpa USER, secret di ENV, `curl | sh`, `:latest`, dll.), serta kerentanan paket yang dipin (`apk`, `apt`, `npm`, `pip`). Pemindaian image penuh (paket OS di dalam image) butuh Docker dan tidak bisa dilakukan di browser.

**Project tersimpan**: file yang diimpor dipadatkan (lockfile hanya disimpan sebagai daftar package) lalu disimpan di localStorage per nama project; bila penuh, file baru tidak ikut tersimpan dan hilang saat halaman dimuat ulang, jadi scan berikutnya tidak perlu mengunggah ulang. Mengunggah file dengan project + nama file yang sama menggantikan yang lama. Centang kolom **Scan** untuk menonaktifkan file tanpa menghapusnya. Klik dua kali sel **Project**/**File** untuk mengubahnya (Enter simpan, Esc batal); tombol **Unggah ulang** mengganti isi satu file dengan versi terbaru tanpa mengubah project & centangnya.

Lebar panel kiri bisa digeser (tarik pegangan di tepinya, klik dua kali untuk reset); ukuran diingat di browser.

Tab **Hook Debug**: mencatat tiap request fetch/XHR saat aplikasi target dipakai seperti biasa — **bekerja untuk endpoint biasa maupun yang terenkripsi**. Tiap entri menampilkan **method, URL, header request, body, status, dan header response**. Untuk endpoint yang pakai enkripsi sekali pakai per-request (ECDH ephemeral) — di mana curl bekas tidak bisa dipakai ulang walau header lengkap karena kuncinya hanya hidup sesaat di memori tab asli — juga ditampilkan payload sebelum dienkripsi (sadapan `crypto.subtle.encrypt`), apa yang benar-benar dikirim, dan hasil dekripsi response-nya (sadapan `crypto.subtle.decrypt`) — ditampilkan apa adanya, tidak dipotong. Karena merekam semua panggilan, panel ini sekaligus berfungsi seperti **crawler**: request berulang ke **method + URL yang sama digabung** jadi satu entri dengan penghitung `×N` (tidak dobel), dan tombol **export json** mengunduh seluruh daftar unik (link, method, header, body, status, response, jumlah hit) sebagai satu file JSON. Skrip ini ditempel lewat Console (atau bookmarklet, seret sekali lalu klik berkali-kali) di tab aplikasi target; muncul panel kecil di sana. Tiap entri bisa dibuka/ditutup (atau sekaligus lewat "buka semua"), ada tombol salin, dan tombol edit (↻) yang membuka form ala Postman untuk mengubah Method/URL/Headers/Body lalu mengirim ulang request itu dari tab target (same-origin, cookie sesi ikut); hasilnya muncul sebagai entri baru bertanda ↻. Body `data=` yang terenkripsi tidak bisa diedit manual karena kunci turunannya per-sesi — yang berguna diubah adalah query/header. Panel bisa diubah ukurannya (tarik sudut kanan-bawah), digeser (tarik dari judul panel), dan diperkecil sementara (tombol minimize) kalau menutupi elemen di halaman target.

Tab **Puppeteer Record**: satu bookmarklet **Pup** (panel Rekam / Putar). Rekam mencatat klik, ketikan, pilihan, Enter/Tab, scroll, hover menu (mouse diam >= 350 ms di elemen interaktif yang memunculkan menu), navigasi, dan **jeda asli** antar langkah (format JSON Chrome DevTools Recorder; isi field password diganti `{{password}}`). Saat Stop, rekaman dikirim ke tab scanner lewat `postMessage` dan disimpan di **IndexedDB** browser, masuk ke **grup** (mis. per project) yang bisa disembunyikan/ditampilkan. Tabel menampilkan ukuran tiap rekaman, per grup, dan total; rekaman bisa dipilih per grup/semua, dihapus, dipindah grup, diganti nama, dilihat per langkah (dengan jeda), diekspor (Recorder JSON, bundle JSON berisi waktu + grup untuk dibagikan, atau script **Puppeteer** `.js` dengan jeda asli, `PUP_SPEED`), dan di-import. **Putar** membuka situs target di tab baru; klik bookmark **Pup** di tab itu dan pemutaran langsung jalan dengan kursor visual (kecepatan waktu asli / 2x / jeda tetap). Aplikasi non-SPA: klik bookmark Pup lagi di tiap halaman baru, rekaman tersambung dan pemutaran lanjut otomatis. Bila popup diblokir / situs memakai COOP, pakai Salin/Unduh JSON di panel lalu Import.

**Penjaga reload (semua skrip bookmarklet: Hook, Rate Limiter, RTO, Cek Middleware, Pup)**: selama panel masih tampil, reload atau pindah halaman yang tidak dipicu user (auto-reload aplikasi saat koneksi gagal, redirect dari skrip) memunculkan dialog konfirmasi bawaan browser: Muat ulang (hook berhenti) atau Batal (tetap di halaman, hook jalan terus). Klik/tombol user sesaat sebelumnya dianggap sengaja, jadi navigasi biasa tidak ditanya. Teks dialog ditentukan browser.

Tab **JWT Decode** dinonaktifkan sejak v1.12 karena sudah tercakup di **Smart Decode**: tempel token JWT (boleh dengan awalan `Bearer `, `Authorization:`, atau dari cookie) untuk melihat header, payload, dan status exp/nbf/iat (signature tidak diverifikasi); JWT rusak juga diberi tahu alasannya.

Tab **Smart Decode**: tempel string apa pun, lalu lapisan encoding dibuka otomatis bertingkat (maks 5; base64/base64url, base32, hex, URL `%xx`, HTML entity, `\uXXXX`/`\xXX`, quoted-printable, gzip/zlib) dan ditampilkan sebagai daftar langkah lengkap dengan tingkat keyakinan, panjang byte, entropi Shannon, dan tombol salin. Format token/container dikenali dari strukturnya: JWT, JWE, CryptoJS/OpenSSL `Salted__`, Laravel `encrypt()`, Fernet, ASP.NET Data Protection, Java/PHP serialized (diberi peringatan deserialization), PEM/DER (jenis kunci/sertifikat, subject, issuer, masa berlaku), public key EC, dan hash (MD5/SHA/bcrypt/Argon2/sha512crypt). Ciphertext tanpa penanda ditebak dari panjang + entropi (AES-CBC/ECB/GCM, ditandai jelas sebagai TEBAKAN). Form dekripsi muncul sesuai temuan (passphrase, APP_KEY, key Fernet, atau key/IV/mode/tag/AAD), dengan tombol "Coba semua variasi"; hasil yang berhasil didekode ulang. Semua lewat WebCrypto di browser, key/IV hanya di memori. Tombol contoh mengisi sampel dummy (key/passphrase demo ditampilkan di layar).

Tab **OCR Gambar** (v1.25): tempel screenshot dengan Ctrl+V, drop, atau pilih gambar, lalu ambil teksnya. Ada tiga mode: **Simple: Tesseract.js** (jalan di browser lewat CDN jsDelivr, bahasa Indonesia/English, gambar tidak dikirim ke mana-mana), **Simple: OCR.space API** (API publik gratis, key demo atau key sendiri, gambar otomatis diperkecil ke <=1 MB), dan **Advance: AI** (endpoint OpenAI-compatible milik Anda: preset OpenRouter/OpenAI/Gemini/Ollama/custom, isi Base URL + model vision + token; hasil Detail = teks + tabel Markdown + ringkasan, atau Teks saja; prompt bisa diubah). Token/API key hanya di memori, Base URL & model diingat. Hasil bisa di-copy, diunduh .txt, atau langsung dikirim ke Smart Decode / SAST.

Tab **Color Picker** (v1.27): ambil warna dari layar (EyeDropper Chrome/Edge, atau screenshot layar via getDisplayMedia), gambar yang ditempel (Ctrl+V)/drop/pilih, contoh gambar (Mockup UI, Spektrum, Senja), palet (color input, input HEX/rgb()/hsl(), swatch Tailwind). Klik gambar untuk ambil warna (sampel 1px/3x3/5x5, kaca pembesar), warna dominan dihitung otomatis. Warna aktif ditampilkan dalam HEX, HEX8, RGB(A), HSL(A), HSV, CMYK, CSS var, Flutter, plus Tailwind terdekat, kontras WCAG vs putih/hitam, dan tint/shade. Warna bisa dikumpulkan ke koleksi dengan peran (primary, secondary, background, text, ...; ada isi peran otomatis), lalu diekspor sebagai prompt untuk AI (warna dasar website), CSS variables, Tailwind config, atau JSON. Koleksi, riwayat (tabel dengan thumbnail gambar sumber + koordinat), dan thumbnail disimpan di localStorage. Tanpa API.

Tab **Swag** (v1.30): ubah halaman Swagger jadi **Postman Collection v2.1**, kumpulan **curl** (bash), atau script **PowerShell**. Support spec lama dan baru: Swagger 2.0, OpenAPI 3.0/3.1 (JSON/YAML), Swagger UI 2.x sampai 5 (Swashbuckle Core/.NET Framework, NSwag, Springfox, springdoc), ReDoc, dan file spec mentah. Cara 1: bookmarklet **Swag** di halaman Swagger (spec dibaca dari halaman itu, cookie ikut, tanpa CORS; bisa pilih definisi v1/v2 dan tag, opsi ikut token dari tombol Authorize). Cara 2: drop/paste file spec atau ambil dari link. Body contoh dibuat dari schema (`$ref`, allOf/oneOf, enum, format), path/query/header param terisi, auth jadi variabel `{{baseUrl}}`/`{{token}}`/`{{apiKey}}`. Tanpa API.

Tab **Multi Ping** (v1.31): pantau banyak server/API sekaligus seperti dashboard. Target (nama, URL, grup, interval, timeout, syarat UP: server menjawab / status < 500 / 2xx) disimpan di localStorage; tambah satu-satu, banyak sekaligus (`nama | url | grup | interval` per baris, IP lokal otomatis http), contoh, atau import/export JSON. Tiap cek = request HTTP dari browser (CORS terbaca -> kode HTTP; tidak -> mode no-cors, server menjawab = UP). Tabel per grup (jumlah UP per grup, cocok untuk cek VPN), grafik mini per target, panel detail dengan grafik ms + kartu Terakhir/Rata-rata/Min/Max/p95/Jitter/Uptime/Gagal/Status sejak (ada penjelasan tiap angka), log perubahan status. Alarm suara (WebAudio) + kedip judul tab + notifikasi desktop opsional saat target bertanda 🔔 nyala lagi (DOWN -> UP), opsional juga saat ada yang mati. Ticker di Web Worker. Batasan: bukan ICMP, port non-HTTP (mis. SSH 22) tidak bisa dicek, target http:// diblokir di versi https (buka index.html lokal). Tanpa API pihak ketiga.

Tab **Jam Dunia** (v1.33): cari kota, negara (nama Indonesia/Inggris), singkatan zona (WIB, WITA, WIT, JST, PST, CET, ...) atau offset (`utc 7`, `UTC+7`, `GMT-5`, `+05:30`) dan lihat jam di sana dibanding jam Anda: selisih (mis. "2 jam lebih maju"), tanggal + penanda besok/kemarin, offset UTC, siang/malam. Pencarian offset menampilkan kota populer di offset itu. Kota bisa dipin (localStorage), atur waktu tertentu dengan patokan zona mana pun untuk konversi, plus tabel perbandingan 24 jam (jam kerja/malam, klik kolom untuk lompat ke jam itu). Zona dari Intl browser (IANA, DST otomatis). Tanpa API.

Tab **Git Lens** (v1.38): drop folder repo / `.git` (beberapa repo sekaligus) dan semua commit dibaca langsung dari `.git` di browser: loose object + packfile (`.idx` v1/v2, delta OFS/REF), semua ref (branch, remote, tag, packed-refs, HEAD). Atau paste output `git log` (format yang disarankan bisa disalin; output default juga terbaca). Tampilan: tabel commit dengan **graph** branch/merge (urutan `--date-order`), badge ref, pencarian banyak kata (pesan, hash, author, email, ref), filter author/project/merge/tanggal, tanggal author/commit dengan timestamp jam saya + zona asli + relatif, detail commit (pesan penuh, parent, file berubah A/M/D, kirim ke Jam Dunia). **Statistik & pola**: kartu (commit, merge, hari aktif, hari tersibuk, rata-rata jam commit pertama/terakhir, jam/hari tersibuk), grafik commit per hari/bulan, heatmap hari x jam (klik sel untuk filter), tabel author. **Laporan harian** per tanggal + project (jumlah, jam pertama/terakhir, judul commit dirapikan) export CSV/HTML. Tanpa API.

Tab **Analisis file**: seret file apa pun (PDF, foto, audio, video, Office, arsip, SVG, executable; maks 256 MB) — semua dibaca di browser, tidak diunggah. Menampilkan jenis asli dari **magic bytes** dibanding ekstensi (file disamarkan, ekstensi ganda/RTLO), **hash** MD5/SHA-1/SHA-256/SHA-512 dengan kolom verifikasi checksum (hex, baris `hash  file`, atau SRI), **integritas** struktur (PDF %%EOF/startxref, PNG CRC/IEND, JPEG EOI, ZIP central directory, box MP4/moov, ukuran RIFF/BMP, JSON/XML valid, plus uji dekode gambar/media oleh Chrome), **temuan keamanan** (script/event handler/XXE di SVG/XML, JavaScript/OpenAction/Launch/EmbeddedFile & nama hex-escape di PDF termasuk object stream, macro VBA/ActiveX/template jarak jauh di Office, Zip Slip/zip bomb, polyglot/ZIP tertempel, webshell PHP), dan **metadata** (EXIF termasuk lokasi GPS dengan tautan peta, XMP, info PDF, properti Office/ODF, tag ID3, info WAV, durasi/resolusi video, header PE/ELF). Hasil bisa diunduh sebagai JSON. Rujukan: OWASP File Upload Cheat Sheet, ASVS V12.2.1, CWE-434/22/409/611/359.

Tab **Rate Limiter (dari curl)**: seperti Postman, khusus cek rate limiter. Tempel curl satu endpoint, tentukan jumlah & jeda. **Opsi 1 — hit langsung dari halaman ini**: paling simpel, jalan kalau server mengizinkan CORS (cookie sesi tidak ikut, cocok untuk endpoint berotentikasi header/token). **Opsi 2 — skrip di tab aplikasi target**: untuk endpoint yang diblokir CORS atau butuh cookie sesi, sama prinsipnya dengan Hook (same-origin). Kedua opsi mencatat status, waktu, dan header `Retry-After` tiap percobaan, dengan tombol stop dan salin CSV. Hanya untuk sistem yang Anda berwenang menguji.

Tab **RTO (kirim lambat)**: menguji apakah server menerapkan *request read timeout*. Tempel curl satu endpoint berbody (POST/PUT/PATCH), atur laju kirim (2–100000 kbps) dan ukuran payload; body dikirim menetes lewat streaming upload (`fetch` + `ReadableStream`). Kalau server menunggu data terlalu lama ia akan menutup koneksi — itulah RTO yang diukur, dilaporkan sebagai "diputus server (kemungkinan read timeout)" lengkap dengan waktu dan byte terkirim. Ini satu koneksi lambat untuk diagnostik timeout (OWASP Slow HTTP / CWE-400), bukan membanjiri server; server yang sehat *seharusnya* memutus klien lambat. Sama seperti Rate Limiter ada dua opsi: **Opsi 1** hit langsung dari halaman (butuh HTTPS/HTTP-2 + CORS, tanpa cookie), **Opsi 2** skrip same-origin di tab target (cookie sesi ikut). Hanya untuk sistem yang Anda berwenang menguji.

Tab **SAST** memeriksa pola kode berbahaya dari teks yang ditempel; `eval(x)` di komentar atau di dalam string tidak lagi dilaporkan.

Tab **Colab Server** (v2.2): menjalankan server tool yang terlalu berat untuk browser di **Google Colab**, dibuka ke internet lewat **Cloudflare quick tunnel** (tanpa akun). Isi pertama: **SonarQube** — [notebook Colab](https://colab.research.google.com/drive/1_Mx-FfnXU9aqYy6UqIzlX7myA3ysdwSt?usp=sharing).
1. Buka notebook, **Connect**, lalu jalankan cell (`Ctrl+Enter`). Progress tampil per tahap: install Java 21 + SonarQube Community Build + cloudflared, start server (`STARTING` → `UP`, ±3-5 menit), ganti password admin default, buat token analysis, buka tunnel. Bila server mati, log error langsung ditampilkan.
2. Output terakhir berisi URL publik, login admin, dan baris siap pakai:
   ```powershell
   $env:SONAR_TOKEN = "sqa_..."; sonar-scanner "-Dsonar.host.url=https://xxx.trycloudflare.com"
   ```
3. Tempel baris itu di form tab Colab Server (URL & token terisi otomatis, project key opsional) untuk menyalin versi PowerShell atau Bash, lalu jalankan di folder project dengan [SonarScanner CLI](https://docs.sonarsource.com/sonarqube-server/latest/analyzing-source-code/scanners/sonarscanner/).

Catatan: runtime Colab gratis terputus saat idle; setiap runtime baru URL, token, password admin, dan hasil scan berganti/hilang (database H2 bawaan). Penyesuaian di notebook: port web 9100 (9000 dipakai Colab) dan log JVM dialihkan ke stderr (warning cgroup Colab merusak launch descriptor Elasticsearch). Halaman ini sendiri tidak memanggil API; token hanya di memori.

**Bahasa/ekosistem SCA yang didukung** (semua lewat OSV.dev): JavaScript (package-lock, yarn.lock, pnpm-lock.yaml, package.json), PHP (composer.lock), .NET (packages.lock.json, *.csproj, packages.config), Java (pom.xml, build.gradle(.kts), gradle.lockfile), Rust (Cargo.lock, Cargo.toml), Go (go.mod), Python (requirements.txt, poetry.lock, uv.lock, Pipfile.lock), Ruby (Gemfile.lock), Dart (pubspec.lock), Elixir (mix.lock), dan paket yang dipin di Dockerfile. File berbentuk lockfile memuat dependency transitif; pom.xml, build.gradle, Cargo.toml, dan requirements.txt hanya dependency langsung/yang dipin.

Tab **EOL runtime/framework**: memeriksa apakah runtime/framework proyek sudah **End-of-Life** (tidak lagi dapat patch keamanan) — kategori *Insecure Deployment: Unpatched Application* (OWASP A06:2021, CWE-1104). Diambil dari file package yang sudah diimpor di tab SCA: Node (`engines.node`/`.nvmrc`), Go (`go.mod`), .NET (`TargetFramework`, termasuk .NET Framework), PHP (`composer.json`), serta Angular/Vue/Laravel/Symfony/Next/Nuxt/Django/Rails dari versi dependency-nya. Status EOL dari endoflife.date, plus kolom **lisensi** tiap komponen (SPDX) dengan ringkasan **boleh** (hak) dan **batasan** (kondisi/limitasi, mengikuti kategori choosealicense.com). Tab ini menampilkan seluruh data tersimpan (localStorage) beserta runtime/framework yang terdeteksi per file, dan bisa langsung mengunggah file baru atau **unggah ulang** per baris. Runtime ditangkap saat file diimpor; file lama yang sudah dipadatkan ditandai "unggah ulang untuk deteksi runtime".

**Lisensi & SBOM** (tab SCA): opsi *Cek lisensi dependency + matriks risiko* mengambil lisensi tiap dependency dari lockfile (npm, Composer) atau deps.dev, lalu laporan menampilkan **License Risk Matrix** — Permissive (MIT/Apache/BSD, hijau), Weak copyleft (LGPL/MPL, kuning, perhatikan modul derivatif), Strong copyleft/viral (GPL/AGPL, merah, waspada untuk aplikasi komersial tertutup), dan Tidak diketahui (abu-abu). Ekspresi SPDX dinilai sesuai logikanya (`A OR B` = yang teringan, `A AND B` = yang terberat). Tombol **Unduh SBOM CycloneDX (JSON)** / **SPDX (JSON)** menyusun Software Bill of Materials (CycloneDX 1.5 / SPDX 2.3, lengkap dengan purl & lisensi) dari dependency file aktif, untuk kebutuhan kepatuhan ISO 27001 / BSSN.

Tab **DAST pasif (URL)**: masukkan URL situs publik; laporan HTML berisi nilai MDN HTTP Observatory dan analisis header respons (HSTS, CSP, cookie, dll.) dari HackerTarget. Opsi **info domain & port** (default aktif) menambah resolusi DNS pasif (Google DNS-over-HTTPS: A/AAAA/NS/MX/TXT) dan data **Shodan InternetDB** untuk IP hasil resolusi — port terbuka, CVE diketahui, teknologi (CPE), dan tag. Semuanya **pasif** (membaca basis data yang sudah ada, bukan scan/nmap langsung ke target) dan tanpa API key. Host lokal/VPN tidak bisa dijangkau; data Shodan bisa tidak mutakhir.

Di tab yang sama ada **Clickjacking PoC** dan **JS Bundle Recon**:
- **Clickjacking PoC**: URL dimuat di iframe dengan tombol umpan di bawahnya, plus slider opacity. Hasilnya ditandai (tampil/diblokir), lalu masuk laporan bersama status X-Frame-Options / frame-ancestors dari header. Ada juga file PoC HTML yang bisa diunduh untuk lampiran pentest.
- **JS Bundle Recon** (bookmarklet di tab target): mengambil file JS dari situs yang sama + source map (komentar `sourceMappingURL`, header `SourceMap`, atau tebakan `<file>.map`), lalu mengirimnya ke tab scanner. Hasilnya: API key/secret (disamarkan di laporan), IP & URL internal/staging, source map yang terekspos (beserta daftar file aslinya), dan daftar endpoint API ala LinkFinder. Endpoint bisa disalin atau dikirim ke tab Swag. Kalau popup diblokir, pakai Unduh JSON di panel lalu Import; file .js/.map juga bisa langsung di-import.

Tab **Skip Link**: bookmarklet untuk halaman shortlink/safelink. Saat diklik, halaman langsung dikosongkan (iklan, iframe, video dibuang dan popup/popunder dimatikan), lalu langkah "Click to Verify / Next / Get Link" dijalankan di latar belakang lewat API situs itu sendiri sampai keluar link download (Gofile, Drive, Mediafire, dll.). Yang didukung: keluarga SafelinkEarn (sfe.ad, `/v/act`), halaman akhir `/go/<id>` (`/reveal`), link tujuan yang disimpan di URL (base64/encode), dan link download yang sudah ada di halaman. Waktu tunggu yang dihitung server tetap dijalani (±30 detik), captcha aktif harus diisi sendiri, dan bila rantainya pindah ke situs lain bookmarklet perlu diklik sekali lagi. Ada juga kotak dekode link dari URL tanpa membuka situsnya.

Tab **Cek Basic Middleware**: menguji apakah security-middleware sebuah endpoint (milik sendiri / yang Anda berwenang uji) benar-benar **memblokir** input buruk — konformансi defensif ala active-scan ZAP, bukan serangan. Dari satu URL target, dikirim ~26 request sengaja-buruk yang *seharusnya* ditolak: **parameter/header/cookie/JSON key ganda**, **buffer berjenjang** (nilai/body 2 → 10 → 500 KB; berhenti begitu ada yang terblok), **batas panjang/jumlah** query & header, **Content-Type** non-JSON & **JSON** invalid/nesting terlalu dalam, serta **sanitize** SQLi/XSS/command injection dan karakter kontrol. Tiap probe diberi verdict **LULUS** (server membalas 400/413/431 — pertahanan bekerja), **GAGAL** (lolos ke aplikasi — celah), atau **ERROR** (CORS/TLS). Ada **editor manual ala Postman** (ubah method/URL/header/body lalu kirim ulang), tombol **Jalankan semua** (sekuensial), **Ulangi yang GAGAL saja**, dan salin CSV/JSON. Seperti Rate Limiter/RTO ada dua opsi: **Opsi 1** hit langsung dari halaman (butuh CORS, tanpa cookie, bisa gagal untuk TLS IP self-signed), **Opsi 2** skrip same-origin di tab aplikasi target (cookie sesi ikut; wajib untuk uji cookie/duplikat header). Rujukan: OWASP ASVS V5 (Validation/Sanitization), A03:2021 Injection, CWE-20. Hanya untuk sistem yang Anda berwenang menguji.

---

# Vibe Code Contest November 2026

**Status:** Open for entries

> Express your idea and build something different.

## Stages

| Stage | Date |
|---|---|
| Before it opens | Until 26 Oct |
| **Contest open (current stage)** | 26 Oct – 8 Nov |
| Gallery and voting | 8 Nov – 10 Nov |
| Judging | From 10 Nov |
| Winners announced | Expected 16 Nov |

**Enrollment closes:** Fri 30 Oct, 23:59 WIB

## About this contest

Express your idea and build something different. A tool, an experiment or something nobody has tried yet: anything goes, as long as you build it with AI-assisted "vibe coding".

## Timeline (WIB)

- **Contest open:** 26 October – 8 November 2026. Enroll, build and submit your entry.
- **Last day to enroll:** 30 October 2026, 23:59 WIB.
- **Gallery and voting:** 9 – 10 November 2026. Everyone at Indocyber can try the demos and vote.
- **Judging:** 9 – 13 November 2026. The judging panel scores every entry on the rubric below.
- **Winners announced:** 16 November 2026.

## Rules

- Solo entries only, one entry per person. Judges can't enter.
- Enroll by 30 October 2026, 23:59 WIB. After that, nobody new can enroll.
- Build your entry during the contest period, 26 October – 8 November 2026.
- Submit before 8 November 2026, 23:59 WIB. You can edit your entry until then.
- Your demo must run in the browser (HTML) or be shown in a short video (up to 5 minutes).
- Keep your name out of the entry: voting is blind until the results are published.
- The judging panel's decision is final. Staff votes decide People's Choice only.

## Prizes

| Place | Prize |
|---|---|
| 1st place | Rp 1.500.000 |
| 2nd place | Rp 1.000.000 |
| 3rd place | Rp 500.000 |
| People's Choice (most staff votes) | Rp 300.000 |

## How entries are judged

Each judge on the panel scores every entry from 1 to 10 on each criterion. The weights turn those scores into a total out of 100, and an entry's score is the average across the panel.

| Criterion | Weight | Description |
|---|---|---|
| Creativity | 25% | An original idea or a fresh take on a familiar problem. |
| Usefulness | 25% | Solves a real problem for Indocyber staff or customers. |
| Execution | 30% | The demo works, feels polished and handles mistakes well. |
| Presentation | 20% | A clear demo and write-up that show what it does and why. |

**Judges:** Hendra, Hari Sabintang, Dendry Pamungkas, Tabita Dewi, Achmad Rodhi and Contest Admin. The staff vote decides People's Choice and doesn't change the score.

## Folder vpn-docker (alat terpisah, di luar index.html)

`vpn-docker/` berisi `run_vpn_docker.ps1` dan extension Chrome `vpn_proxy_ext`. Gunanya menjalankan VPN kantor (FortiGate SSL VPN, login password/OTP atau SAML) di dalam container Docker dan membukanya sebagai SOCKS5 `127.0.0.1:1080`. Jadi hanya Chrome (lewat extension, per profil) dan SSH/MobaXterm/PuTTY/DBeaver yang masuk jaringan kantor; PC tidak ikut ter-VPN. Profil dibaca dari backup FortiClient (`vpn_backup.conf`, jangan di-commit). Kredensial disimpan terenkripsi DPAPI di `%LOCALAPPDATA%\vpn_docker`. Panduan lengkap (setelan awal, menyalakan VPN, pasang extension, SSH lewat proxy) ada di `vpn-docker/README.md`.
