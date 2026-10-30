# Scanner Security

Aplikasi HTML-only (Vue 3 via CDN) untuk memeriksa keamanan proyek langsung di browser:

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

Tab **JWT Decode** dinonaktifkan sejak v1.12 karena sudah tercakup di **Smart Decode**: tempel token JWT (boleh dengan awalan `Bearer `, `Authorization:`, atau dari cookie) untuk melihat header, payload, dan status exp/nbf/iat (signature tidak diverifikasi); JWT rusak juga diberi tahu alasannya.

Tab **Smart Decode**: tempel string apa pun, lalu lapisan encoding dibuka otomatis bertingkat (maks 5; base64/base64url, base32, hex, URL `%xx`, HTML entity, `\uXXXX`/`\xXX`, quoted-printable, gzip/zlib) dan ditampilkan sebagai daftar langkah lengkap dengan tingkat keyakinan, panjang byte, entropi Shannon, dan tombol salin. Format token/container dikenali dari strukturnya: JWT, JWE, CryptoJS/OpenSSL `Salted__`, Laravel `encrypt()`, Fernet, ASP.NET Data Protection, Java/PHP serialized (diberi peringatan deserialization), PEM/DER (jenis kunci/sertifikat, subject, issuer, masa berlaku), public key EC, dan hash (MD5/SHA/bcrypt/Argon2/sha512crypt). Ciphertext tanpa penanda ditebak dari panjang + entropi (AES-CBC/ECB/GCM, ditandai jelas sebagai TEBAKAN). Form dekripsi muncul sesuai temuan (passphrase, APP_KEY, key Fernet, atau key/IV/mode/tag/AAD), dengan tombol "Coba semua variasi"; hasil yang berhasil didekode ulang. Semua lewat WebCrypto di browser, key/IV hanya di memori. Tombol contoh mengisi sampel dummy (key/passphrase demo ditampilkan di layar).

Tab **Analisis file**: seret file apa pun (PDF, foto, audio, video, Office, arsip, SVG, executable; maks 256 MB) — semua dibaca di browser, tidak diunggah. Menampilkan jenis asli dari **magic bytes** dibanding ekstensi (file disamarkan, ekstensi ganda/RTLO), **hash** MD5/SHA-1/SHA-256/SHA-512 dengan kolom verifikasi checksum (hex, baris `hash  file`, atau SRI), **integritas** struktur (PDF %%EOF/startxref, PNG CRC/IEND, JPEG EOI, ZIP central directory, box MP4/moov, ukuran RIFF/BMP, JSON/XML valid, plus uji dekode gambar/media oleh Chrome), **temuan keamanan** (script/event handler/XXE di SVG/XML, JavaScript/OpenAction/Launch/EmbeddedFile & nama hex-escape di PDF termasuk object stream, macro VBA/ActiveX/template jarak jauh di Office, Zip Slip/zip bomb, polyglot/ZIP tertempel, webshell PHP), dan **metadata** (EXIF termasuk lokasi GPS dengan tautan peta, XMP, info PDF, properti Office/ODF, tag ID3, info WAV, durasi/resolusi video, header PE/ELF). Hasil bisa diunduh sebagai JSON. Rujukan: OWASP File Upload Cheat Sheet, ASVS V12.2.1, CWE-434/22/409/611/359.

Tab **Rate Limiter (dari curl)**: seperti Postman, khusus cek rate limiter. Tempel curl satu endpoint, tentukan jumlah & jeda. **Opsi 1 — hit langsung dari halaman ini**: paling simpel, jalan kalau server mengizinkan CORS (cookie sesi tidak ikut, cocok untuk endpoint berotentikasi header/token). **Opsi 2 — skrip di tab aplikasi target**: untuk endpoint yang diblokir CORS atau butuh cookie sesi, sama prinsipnya dengan Hook (same-origin). Kedua opsi mencatat status, waktu, dan header `Retry-After` tiap percobaan, dengan tombol stop dan salin CSV. Hanya untuk sistem yang Anda berwenang menguji.

Tab **RTO (kirim lambat)**: menguji apakah server menerapkan *request read timeout*. Tempel curl satu endpoint berbody (POST/PUT/PATCH), atur laju kirim (2–100000 kbps) dan ukuran payload; body dikirim menetes lewat streaming upload (`fetch` + `ReadableStream`). Kalau server menunggu data terlalu lama ia akan menutup koneksi — itulah RTO yang diukur, dilaporkan sebagai "diputus server (kemungkinan read timeout)" lengkap dengan waktu dan byte terkirim. Ini satu koneksi lambat untuk diagnostik timeout (OWASP Slow HTTP / CWE-400), bukan membanjiri server; server yang sehat *seharusnya* memutus klien lambat. Sama seperti Rate Limiter ada dua opsi: **Opsi 1** hit langsung dari halaman (butuh HTTPS/HTTP-2 + CORS, tanpa cookie), **Opsi 2** skrip same-origin di tab target (cookie sesi ikut). Hanya untuk sistem yang Anda berwenang menguji.

Tab **SAST** memeriksa pola kode berbahaya dari teks yang ditempel; `eval(x)` di komentar atau di dalam string tidak lagi dilaporkan.

**Bahasa/ekosistem SCA yang didukung** (semua lewat OSV.dev): JavaScript (package-lock, yarn.lock, pnpm-lock.yaml, package.json), PHP (composer.lock), .NET (packages.lock.json, *.csproj, packages.config), Java (pom.xml, build.gradle(.kts), gradle.lockfile), Rust (Cargo.lock, Cargo.toml), Go (go.mod), Python (requirements.txt, poetry.lock, uv.lock, Pipfile.lock), Ruby (Gemfile.lock), Dart (pubspec.lock), Elixir (mix.lock), dan paket yang dipin di Dockerfile. File berbentuk lockfile memuat dependency transitif; pom.xml, build.gradle, Cargo.toml, dan requirements.txt hanya dependency langsung/yang dipin.

Tab **EOL runtime/framework**: memeriksa apakah runtime/framework proyek sudah **End-of-Life** (tidak lagi dapat patch keamanan) — kategori *Insecure Deployment: Unpatched Application* (OWASP A06:2021, CWE-1104). Diambil dari file package yang sudah diimpor di tab SCA: Node (`engines.node`/`.nvmrc`), Go (`go.mod`), .NET (`TargetFramework`, termasuk .NET Framework), PHP (`composer.json`), serta Angular/Vue/Laravel/Symfony/Next/Nuxt/Django/Rails dari versi dependency-nya. Status EOL dari endoflife.date, plus kolom **lisensi** tiap komponen (SPDX) dengan ringkasan **boleh** (hak) dan **batasan** (kondisi/limitasi, mengikuti kategori choosealicense.com). Tab ini menampilkan seluruh data tersimpan (localStorage) beserta runtime/framework yang terdeteksi per file, dan bisa langsung mengunggah file baru atau **unggah ulang** per baris. Runtime ditangkap saat file diimpor; file lama yang sudah dipadatkan ditandai "unggah ulang untuk deteksi runtime".

**Lisensi & SBOM** (tab SCA): opsi *Cek lisensi dependency + matriks risiko* mengambil lisensi tiap dependency dari lockfile (npm, Composer) atau deps.dev, lalu laporan menampilkan **License Risk Matrix** — Permissive (MIT/Apache/BSD, hijau), Weak copyleft (LGPL/MPL, kuning, perhatikan modul derivatif), Strong copyleft/viral (GPL/AGPL, merah, waspada untuk aplikasi komersial tertutup), dan Tidak diketahui (abu-abu). Ekspresi SPDX dinilai sesuai logikanya (`A OR B` = yang teringan, `A AND B` = yang terberat). Tombol **Unduh SBOM CycloneDX (JSON)** / **SPDX (JSON)** menyusun Software Bill of Materials (CycloneDX 1.5 / SPDX 2.3, lengkap dengan purl & lisensi) dari dependency file aktif, untuk kebutuhan kepatuhan ISO 27001 / BSSN.

Tab **DAST pasif (URL)**: masukkan URL situs publik; laporan HTML berisi nilai MDN HTTP Observatory dan analisis header respons (HSTS, CSP, cookie, dll.) dari HackerTarget. Opsi **info domain & port** (default aktif) menambah resolusi DNS pasif (Google DNS-over-HTTPS: A/AAAA/NS/MX/TXT) dan data **Shodan InternetDB** untuk IP hasil resolusi — port terbuka, CVE diketahui, teknologi (CPE), dan tag. Semuanya **pasif** (membaca basis data yang sudah ada, bukan scan/nmap langsung ke target) dan tanpa API key. Host lokal/VPN tidak bisa dijangkau; data Shodan bisa tidak mutakhir.

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
