# Scanner Security

Aplikasi HTML-only (Vue 3 via CDN) untuk memeriksa keamanan proyek langsung di browser:

- **SCA (Software Composition Analysis)**: tempel `package.json`, dependency dicek ke database kerentanan [OSV.dev](https://osv.dev).
- **SAST (Static Application Security Testing)**: tempel kode JS/TS, dicek terhadap pola berbahaya (eval, new Function, innerHTML, document.write, v-html, dll).

## Tema & Bahasa

Di kanan atas ada dua toggle: **tema terang/gelap** (☀️/🌙, tersimpan di browser) dan **bahasa** (ID/EN). Default Bahasa Indonesia; versi Inggris dibuka di `/en/` — mis. `https://zidanebayu21.github.io/scaner_sca_sast/en/`. Bahasa dideteksi dari query `?lang=` → path `/en/` → localStorage → default `id`. `en/index.html` **bukan** salinan, melainkan stub kecil yang mengarahkan ke `../?lang=en`, jadi `index.html` tetap satu-satunya sumber dan tak perlu disalin ulang saat berubah.

Kamus terjemahan dipisah di **`i18n/i18n.js`** (bukan `.json`, karena `fetch` file lokal diblokir browser saat `index.html` dibuka langsung lewat `file://`; file `.js` yang dimuat `<script>` jalan di GitHub Pages maupun `file://`). Teks UI di tab memakai `t('key')` dengan fallback ke Indonesia bila sebuah key belum diterjemahkan.

## Cara Pakai

Buka `index.html` di browser (tidak perlu build / server).

1. Seret & lepas (atau pilih / tempel teks) satu atau beberapa file: `package-lock.json`, `package.json`, `composer.lock`, `packages.lock.json`, `*.csproj`, atau `Dockerfile`.
2. Klik **Scan & buka laporan**. Laporan HTML terbuka di tab baru (bisa diunduh, ada tautan CSV).

**SCA**: package dicek ke OSV.dev lengkap dengan versi aman (diverifikasi ulang), jenis update, severity (GHSA/CVSS), CWE, EPSS, status CISA KEV, dan perintah perbaikan. Package tanpa versi aman ditandai merah.

**Dockerfile**: status EOL base image (endoflife.date), temuan konfigurasi (tanpa USER, secret di ENV, `curl | sh`, `:latest`, dll.), serta kerentanan paket yang dipin (`apk`, `apt`, `npm`, `pip`). Pemindaian image penuh (paket OS di dalam image) butuh Docker dan tidak bisa dilakukan di browser.

**Project tersimpan**: file yang diimpor dipadatkan (lockfile hanya disimpan sebagai daftar package) lalu disimpan di localStorage per nama project; bila penuh, file baru tidak ikut tersimpan dan hilang saat halaman dimuat ulang, jadi scan berikutnya tidak perlu mengunggah ulang. Mengunggah file dengan project + nama file yang sama menggantikan yang lama. Centang kolom **Scan** untuk menonaktifkan file tanpa menghapusnya.

Lebar panel kiri bisa digeser (tarik pegangan di tepinya, klik dua kali untuk reset); ukuran diingat di browser.

Tab **Hook Debug**: mencatat tiap request fetch/XHR saat aplikasi target dipakai seperti biasa — **bekerja untuk endpoint biasa maupun yang terenkripsi**. Tiap entri menampilkan **method, URL, header request, body, status, dan header response**. Untuk endpoint yang pakai enkripsi sekali pakai per-request (ECDH ephemeral) — di mana curl bekas tidak bisa dipakai ulang walau header lengkap karena kuncinya hanya hidup sesaat di memori tab asli — juga ditampilkan payload sebelum dienkripsi (sadapan `crypto.subtle.encrypt`), apa yang benar-benar dikirim, dan hasil dekripsi response-nya (sadapan `crypto.subtle.decrypt`) — ditampilkan apa adanya, tidak dipotong. Karena merekam semua panggilan, panel ini sekaligus berfungsi seperti **crawler**: request berulang ke **method + URL yang sama digabung** jadi satu entri dengan penghitung `×N` (tidak dobel), dan tombol **export json** mengunduh seluruh daftar unik (link, method, header, body, status, response, jumlah hit) sebagai satu file JSON. Skrip ini ditempel lewat Console (atau bookmarklet, seret sekali lalu klik berkali-kali) di tab aplikasi target; muncul panel kecil di sana. Tiap entri bisa dibuka/ditutup (atau sekaligus lewat "buka semua"), ada tombol salin, dan tombol edit (↻) yang membuka form ala Postman untuk mengubah Method/URL/Headers/Body lalu mengirim ulang request itu dari tab target (same-origin, cookie sesi ikut); hasilnya muncul sebagai entri baru bertanda ↻. Body `data=` yang terenkripsi tidak bisa diedit manual karena kunci turunannya per-sesi — yang berguna diubah adalah query/header. Panel bisa diubah ukurannya (tarik sudut kanan-bawah), digeser (tarik dari judul panel), dan diperkecil sementara (tombol minimize) kalau menutupi elemen di halaman target.

Tab **JWT Decode** menampilkan header, payload, dan status exp/nbf/iat token JWT langsung di browser (signature tidak diverifikasi).

Tab **Rate Limiter (dari curl)**: seperti Postman, khusus cek rate limiter. Tempel curl satu endpoint, tentukan jumlah & jeda. **Opsi 1 — hit langsung dari halaman ini**: paling simpel, jalan kalau server mengizinkan CORS (cookie sesi tidak ikut, cocok untuk endpoint berotentikasi header/token). **Opsi 2 — skrip di tab aplikasi target**: untuk endpoint yang diblokir CORS atau butuh cookie sesi, sama prinsipnya dengan Hook (same-origin). Kedua opsi mencatat status, waktu, dan header `Retry-After` tiap percobaan, dengan tombol stop dan salin CSV. Hanya untuk sistem yang Anda berwenang menguji.

Tab **RTO (kirim lambat)**: menguji apakah server menerapkan *request read timeout*. Tempel curl satu endpoint berbody (POST/PUT/PATCH), atur laju kirim (2–100000 kbps) dan ukuran payload; body dikirim menetes lewat streaming upload (`fetch` + `ReadableStream`). Kalau server menunggu data terlalu lama ia akan menutup koneksi — itulah RTO yang diukur, dilaporkan sebagai "diputus server (kemungkinan read timeout)" lengkap dengan waktu dan byte terkirim. Ini satu koneksi lambat untuk diagnostik timeout (OWASP Slow HTTP / CWE-400), bukan membanjiri server; server yang sehat *seharusnya* memutus klien lambat. Sama seperti Rate Limiter ada dua opsi: **Opsi 1** hit langsung dari halaman (butuh HTTPS/HTTP-2 + CORS, tanpa cookie), **Opsi 2** skrip same-origin di tab target (cookie sesi ikut). Hanya untuk sistem yang Anda berwenang menguji.

Tab **SAST** memeriksa pola kode berbahaya dari teks yang ditempel.

**Bahasa/ekosistem SCA yang didukung** (semua lewat OSV.dev): JavaScript (package-lock, yarn.lock, pnpm-lock.yaml, package.json), PHP (composer.lock), .NET (packages.lock.json, *.csproj, packages.config), Java (pom.xml, build.gradle(.kts), gradle.lockfile), Rust (Cargo.lock, Cargo.toml), Go (go.mod), Python (requirements.txt, poetry.lock, uv.lock, Pipfile.lock), Ruby (Gemfile.lock), Dart (pubspec.lock), Elixir (mix.lock), dan paket yang dipin di Dockerfile. File berbentuk lockfile memuat dependency transitif; pom.xml, build.gradle, Cargo.toml, dan requirements.txt hanya dependency langsung/yang dipin.

Tab **DAST pasif (URL)**: masukkan URL situs publik; laporan HTML berisi nilai MDN HTTP Observatory dan analisis header respons (HSTS, CSP, cookie, dll.) dari HackerTarget. Opsi **info domain & port** (default aktif) menambah resolusi DNS pasif (Google DNS-over-HTTPS: A/AAAA/NS/MX/TXT) dan data **Shodan InternetDB** untuk IP hasil resolusi — port terbuka, CVE diketahui, teknologi (CPE), dan tag. Semuanya **pasif** (membaca basis data yang sudah ada, bukan scan/nmap langsung ke target) dan tanpa API key. Host lokal/VPN tidak bisa dijangkau; data Shodan bisa tidak mutakhir.

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
