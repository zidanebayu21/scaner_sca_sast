#!/usr/bin/env bash
# Menyusun situs GitHub Pages: akar = isi HEAD (versi terbaru), /<X.Y>/ = isi tag v<X.Y> (git archive, dengan badge versi disamakan dan penyimpanan browser dipisah), /versions/ = daftar versi.
# Pakai: scripts/build-pages.sh [folder_keluaran]   (perlu riwayat git + tag lengkap)
# Semua tag vX.Y (v1.0 sampai terbaru) diterbitkan; v1.x berupa satu file index.html, v2.0+ modular (js/, css/, i18n/).
set -euo pipefail
out="${1:-_site}"
rm -rf "$out"; mkdir -p "$out/versions"
git archive HEAD | tar -x -C "$out"

esc() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
rows=""
for tag in $(git tag --list 'v[0-9]*' --sort=-version:refname); do
  ver="${tag#v}"
  [[ "$ver" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] || continue
  mkdir -p "$out/$ver"; git archive "$tag" | tar -x -C "$out/$ver"
  # badge versi di dalam aplikasi mengikuti nama folder (mis. rilis yang dulu bernomor 3.0 kini 2.9.1)
  grep -q "APP_VERSION = '" "$out/$ver/index.html" && sed -i "s/APP_VERSION = '[^']*'/APP_VERSION = '$ver'/" "$out/$ver/index.html"
  # penyimpanan browser tiap versi dipisah (lihat scripts/scope-shim.js); noindex agar salinan versi lama tidak dianggap duplikat oleh mesin pencari (akar = satu-satunya yang diindeks)
  sed "s/__VER__/$ver/g" scripts/scope-shim.js > "$out/$ver/_scope.js"
  sed -i '0,/<head[^>]*>/s//&<meta name="robots" content="noindex"><script src="_scope.js"><\/script>/' "$out/$ver/index.html"
  day=$(git log -1 --format=%ad --date=short "$tag"); note=$(git log -1 --format=%s "$tag" | cut -c1-140 | esc)
  rows+="<tr><td><a href=\"../$ver/\">$ver</a></td><td>$day</td><td>$note</td></tr>"$'\n'
done

cat > "$out/versions/index.html" <<HTML
<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Versi Scanner</title>
<style>body{font:16px system-ui,sans-serif;max-width:60rem;margin:0 auto;padding:1rem 16px}table{border-collapse:collapse;width:100%}td,th{padding:.4rem .6rem;border-bottom:1px solid #8884;text-align:left;vertical-align:top}</style>
</head><body><h1>Versi Scanner</h1>
<p><a href="../">Versi terbaru</a>. Versi lama dibuka dari folder <code>/&lt;versi&gt;/</code>. Semua versi memakai satu origin, jadi data di browser (localStorage/IndexedDB) dipakai bersama.</p>
<table><thead><tr><th>Versi</th><th>Tanggal</th><th>Perubahan</th></tr></thead><tbody>
$rows</tbody></table></body></html>
HTML
echo "selesai: $(find "$out" -maxdepth 1 -type d | wc -l) folder di $out"
