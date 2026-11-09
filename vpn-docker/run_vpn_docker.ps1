# VPN FortiGate (SSL VPN) di dalam container Docker, keluar sebagai SOCKS5 di 127.0.0.1.
# PC tidak ikut ter-VPN: hanya aplikasi yang diarahkan ke SOCKS (Chrome via -Chrome / extension, MobaXterm, dll.).
#
# Panduan lengkap: README.md di folder ini.
# Contoh:
#   .\run_vpn_docker.ps1 -Setup -Config "D:\vpn_backup.conf" -ChromeEmail "nama@gmail.com" -ProxyDomains "kantor.co.id"
#                                         # simpan setelan pribadi (sekali) di %LOCALAPPDATA%\vpn_docker\settings.json
#   .\run_vpn_docker.ps1                 # pilih profil dari menu lalu konek
#   .\run_vpn_docker.ps1 -List           # daftar profil di vpn_backup.conf
#   .\run_vpn_docker.ps1 -Name "VPN Kantor" # langsung konek profil itu
#   .\run_vpn_docker.ps1 -Name "VPN Kantor" -Otp 123456
#   .\run_vpn_docker.ps1 -Chrome         # buka profil Chrome milik ChromeEmail (proxy via extension vpn_proxy_ext)
#   .\run_vpn_docker.ps1 -Chrome -ChromeEmail ""   # Chrome terpisah dengan PAC (tanpa extension)
#   Sertifikat gateway baru langsung dipercaya; -AskTrust untuk ditanya dulu. Sertifikat yang BERUBAH selalu ditanya.
#   .\run_vpn_docker.ps1 -Status | -Logs | -Stop
#   .\run_vpn_docker.ps1 -Name "VPN Kantor" -Reset   # ganti username/password/setelan OTP profil itu
#
# Username/password disimpan terenkripsi DPAPI (hanya bisa dibuka akun Windows ini) di
# %LOCALAPPDATA%\vpn_docker, bukan di folder ini. Ke container dikirim lewat stdin ke tmpfs (tidak ada di env/disk).
param(
  [string]$Name = "",
  [string]$Config = "",
  [string]$Otp = "",
  [int]$SocksPort = 1080,
  [int]$SamlPort = 8020,
  [string]$ProxyDomains = "",
  [switch]$AllViaVpn,
  [switch]$List,
  [switch]$Status,
  [switch]$Logs,
  [switch]$Stop,
  [switch]$Chrome,
  [switch]$Reset,
  [switch]$AutoTrust,  # (default sudah aktif; dibiarkan agar perintah lama tetap jalan)
  [switch]$AskTrust,   # tanya dulu sebelum mempercayai sertifikat gateway baru (default: langsung dipercaya)
  [string]$ChromeEmail = "",  # -Chrome membuka profil Chrome milik email ini; -ChromeEmail "" = Chrome terpisah
  [switch]$Setup              # simpan -Config / -ChromeEmail / -ProxyDomains sebagai default pribadi
)
$ErrorActionPreference = "Continue"            # docker (native) menulis ke stderr; dicek lewat $LASTEXITCODE
$PSDefaultParameterValues["*:ErrorAction"] = "Stop"  # cmdlet PowerShell tetap berhenti saat error
$TrustNew = -not $AskTrust   # sertifikat gateway baru dipercaya otomatis (yang BERUBAH tetap ditanya)
$Container = "vpn-forti"
$Image = "vpn-forti:local"
$Store = Join-Path $env:LOCALAPPDATA "vpn_docker"
$ProfilesFile = Join-Path $Store "profiles.json"
$SettingsFile = Join-Path $Store "settings.json"
New-Item -ItemType Directory -Force -Path $Store | Out-Null
# Setelan pribadi (lokasi backup, email profil Chrome, domain kantor) ada di luar repo.
$Settings = @{ config = ""; chromeEmail = ""; proxyDomains = "" }
if (Test-Path $SettingsFile) {
  $o = Get-Content -Raw $SettingsFile | ConvertFrom-Json
  foreach ($k in @("config", "chromeEmail", "proxyDomains")) { if ($o.$k) { $Settings[$k] = [string]$o.$k } }
}
if ($Setup) {
  if ($PSBoundParameters.ContainsKey("Config")) { $Settings.config = (Resolve-Path $Config).Path }
  if ($PSBoundParameters.ContainsKey("ChromeEmail")) { $Settings.chromeEmail = $ChromeEmail }
  if ($PSBoundParameters.ContainsKey("ProxyDomains")) { $Settings.proxyDomains = $ProxyDomains }
  ($Settings | ConvertTo-Json) | Set-Content -Encoding UTF8 $SettingsFile
  Write-Host "Setelan disimpan di ${SettingsFile}:" -ForegroundColor Green
  $Settings | Format-Table -AutoSize | Out-String | Write-Host
  return
}
if (-not $Config) { $Config = $Settings.config }
if (-not $Config) { $Config = Join-Path $PSScriptRoot "vpn_backup.conf" }
if (-not $PSBoundParameters.ContainsKey("ChromeEmail")) { $ChromeEmail = $Settings.chromeEmail }
if (-not $PSBoundParameters.ContainsKey("ProxyDomains")) { $ProxyDomains = $Settings.proxyDomains }

function Say($msg, $color = "Gray") { Write-Host $msg -ForegroundColor $color }

# ---------- profil dari backup FortiClient ----------
function Get-VpnList {
  if (-not (Test-Path $Config)) { throw "File backup tidak ada: $Config" }
  [xml]$x = Get-Content -Raw -Encoding UTF8 $Config
  $out = @()
  foreach ($c in $x.SelectNodes("//sslvpn/connections/connection")) {
    $srv = [string]$c.server
    $h = $srv; $p = "443"
    if ($srv -match '^(.+):(\d+)$') { $h = $Matches[1]; $p = $Matches[2] }
    $out += [pscustomobject]@{ Name = [string]$c.name; Host = $h; Port = $p; Saml = ([string]$c.sso_enabled -eq "1"); Desc = [string]$c.description }
  }
  return $out
}
function Show-VpnList($vpns) {
  $i = 1
  foreach ($v in $vpns) {
    $t = if ($v.Saml) { "SAML/SSO" } else { "user+password" }
    Say ("{0,3}. {1,-18} {2,-26} {3}" -f $i, $v.Name, ($v.Host + ":" + $v.Port), $t)
    $i++
  }
}

# ---------- penyimpanan setelan + kredensial (DPAPI) ----------
function Read-Profiles {
  if (Test-Path $ProfilesFile) {
    $o = Get-Content -Raw $ProfilesFile | ConvertFrom-Json
    $h = @{}; foreach ($p in $o.PSObject.Properties) { $h[$p.Name] = $p.Value }; return $h
  }
  return @{}
}
function Save-Profiles($h) { ($h | ConvertTo-Json -Depth 4) | Set-Content -Encoding UTF8 $ProfilesFile }
function CredPath($vpnName) { return Join-Path $Store ("cred_" + (($vpnName -replace '[^A-Za-z0-9_-]', '_')) + ".xml") }

# ---------- Docker ----------
function Ensure-Docker {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) { return }
  $exe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path $exe)) { throw "Docker Desktop tidak ditemukan." }
  Say "Menyalakan Docker Desktop..." Yellow
  Start-Process $exe
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep 3
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { Say "Docker siap." Green; return }
  }
  throw "Docker belum siap setelah 3 menit."
}

$Dockerfile = @'
FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends openfortivpn microsocks socat ca-certificates iproute2 iputils-ping curl \
 && rm -rf /var/lib/apt/lists/*
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
'@
$Entrypoint = @'
#!/bin/sh
# Menunggu config dari host (tmpfs /run/vpn), lalu menjalankan openfortivpn.
# SOCKS5 (microsocks) di :1080, penerus SAML :8021 -> 127.0.0.1:8020 (server login SAML openfortivpn).
[ -e /dev/ppp ] || mknod /dev/ppp c 108 0
microsocks -i 0.0.0.0 -p 1080 &
socat TCP-LISTEN:8021,fork,reuseaddr TCP:127.0.0.1:8020 &
echo "[vpn] menunggu config..."
while [ ! -s /run/vpn/config ]; do sleep 1; done
ARGS="$(cat /run/vpn/args 2>/dev/null)"
while true; do
  openfortivpn -c /run/vpn/config $ARGS 2>&1 | tee /run/vpn/last.log
  # sambung ulang hanya jika tadi sempat tersambung, tanpa OTP/SAML (hindari akun terkunci karena salah password)
  if ! grep -q "Tunnel is up" /run/vpn/last.log || grep -q '^otp' /run/vpn/config || [ -n "$ARGS" ]; then
    echo "[vpn] berhenti."; exit 1
  fi
  echo "[vpn] putus, sambung ulang 5 detik lagi..."; sleep 5
done
'@
function Ensure-Image {
  $hash = [BitConverter]::ToString((New-Object Security.Cryptography.SHA256Managed).ComputeHash([Text.Encoding]::UTF8.GetBytes($Dockerfile + $Entrypoint))).Replace("-", "").Substring(0, 16)
  $cur = docker image inspect $Image --format '{{.Config.Labels.vpnfortihash}}' 2>$null
  if ($LASTEXITCODE -eq 0 -and $cur -eq $hash) { return }
  Say "Membangun image $Image (sekali saja)..." Yellow
  $dir = Join-Path $Store "build"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  [IO.File]::WriteAllText((Join-Path $dir "Dockerfile"), $Dockerfile.Replace("`r`n", "`n"))
  [IO.File]::WriteAllText((Join-Path $dir "entrypoint.sh"), $Entrypoint.Replace("`r`n", "`n"))
  docker build -q --label "vpnfortihash=$hash" -t $Image $dir | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "docker build gagal." }
}

function Get-VpnLog { return (docker exec $Container sh -c 'cat /run/vpn/last.log 2>/dev/null' 2>$null) -join "`n" }

function Start-Vpn($v, $prof, $otpCode) {
  docker rm -f $Container *> $null
  docker run -d --name $Container --label "vpnname=$($v.Name)" `
    --cap-add NET_ADMIN --cap-add MKNOD --cap-add SYS_MODULE --device-cgroup-rule "c 108:0 rwm" `
    --tmpfs /run/vpn:mode=700 `
    -p "127.0.0.1:${SocksPort}:1080" -p "127.0.0.1:${SamlPort}:8021" `
    $Image | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "docker run gagal (port $SocksPort/$SamlPort dipakai?)." }

  $lines = @("host = $($v.Host)", "port = $($v.Port)", "set-dns = 1", "pppd-use-peerdns = 1")
  if ($prof.cert) { $lines += "trusted-cert = $($prof.cert)" }
  $args2 = ""
  if ($v.Saml) {
    $args2 = "--saml-login=8020"
  } else {
    $cred = Import-Clixml (CredPath $v.Name)
    $lines += "username = $($cred.UserName)"
    $lines += "password = $($cred.GetNetworkCredential().Password)"
    if ($otpCode) { $lines += "otp = $otpCode" }
  }
  # args dulu, lalu config (entrypoint mulai begitu config ada). CR dibuang: pipa PowerShell 5 memakai CRLF.
  ($args2) | docker exec -i $Container sh -c "tr -d '\r' > /run/vpn/args"
  ($lines -join "`n") | docker exec -i $Container sh -c "umask 077; tr -d '\r' > /run/vpn/config.tmp && mv /run/vpn/config.tmp /run/vpn/config"
  $lines = $null
}

function Wait-Vpn($v, [int]$seconds) {
  if ($v.Saml) {
    $url = "https://$($v.Host):$($v.Port)/remote/saml/start?redirect=1"
    Say "Login SAML: browser dibuka ke $url" Yellow
    Say "Selesaikan login di browser; FortiGate akan kembali ke http://127.0.0.1:$SamlPort (container)." Yellow
    Start-Process $url
    $seconds = 180
  }
  for ($i = 0; $i -lt $seconds; $i += 2) {
    Start-Sleep 2
    $running = (docker inspect -f '{{.State.Running}}' $Container 2>$null) -eq "true"
    if ($running) { $log = Get-VpnLog } else { $log = (docker logs --tail 40 $Container 2>&1) -join "`n" }
    if ($log -match "Tunnel is up") { return @{ state = "up"; log = $log } }
    if ($log -match "trusted-cert = ([0-9a-f]{64})") { return @{ state = "cert"; cert = $Matches[1]; log = $log } }
    if ($log -match "(?i)two-factor|\botp\b|token code") { return @{ state = "otp"; log = $log } }
    if ($log -match "(?i)could not authenticate|authentication failed|permission denied|invalid credentials") { return @{ state = "auth"; log = $log } }
    if (-not $running) { return @{ state = "exit"; log = $log } }
  }
  return @{ state = "timeout"; log = (Get-VpnLog) }
}

function Start-ChromeProxy {
  $chromeExe = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $chromeExe) { throw "Chrome tidak ditemukan." }
  if ($ChromeEmail) {
    # Profil Chrome yang sudah ada: proxy diatur extension vpn_proxy_ext (berlaku hanya di profil itu, tanpa restart Chrome).
    $ls = Get-Content -Raw -Encoding UTF8 (Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\Local State") | ConvertFrom-Json
    $dir = $null
    foreach ($p in $ls.profile.info_cache.PSObject.Properties) {
      if ([string]$p.Value.user_name -like "*$ChromeEmail*") { $dir = $p.Name; Say "Profil Chrome: $($p.Name) ($($p.Value.user_name))" Cyan; break }
    }
    if (-not $dir) { throw "Profil Chrome dengan email '$ChromeEmail' tidak ditemukan." }
    $ext = Join-Path $PSScriptRoot "vpn_proxy_ext"
    $prefs = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\$dir\Secure Preferences"
    $installed = (Test-Path $prefs) -and ((Get-Content -Raw $prefs) -match [regex]::Escape(($ext -replace '\\', '\\')))
    if ($installed) {
      Start-Process $chromeExe -ArgumentList @("--profile-directory=`"$dir`"", "http://10.0.0.10")
      Say "Chrome profil $dir dibuka. Extension VPN Docker Proxy sudah terpasang: alamat internal lewat VPN." Green
    } else {
      Start-Process $chromeExe -ArgumentList @("--profile-directory=`"$dir`"", "chrome://extensions")
      Say "Extension belum terpasang di profil ini (sekali saja):" Yellow
      Say "  1. Di tab chrome://extensions yang terbuka, nyalakan Developer mode (kanan atas)." Yellow
      Say "  2. Klik 'Load unpacked', pilih folder: $ext" Yellow
      Say "  3. Ikon VPN Docker Proxy muncul dengan badge 'VPN' = aktif." Yellow
    }
    return
  }
  $proxy = "SOCKS5 127.0.0.1:$SocksPort"
  if ($AllViaVpn) {
    $pac = "function FindProxyForURL(url, host) { return '$proxy'; }"
  } else {
    $doms = ($ProxyDomains -split ',' | ForEach-Object { $_.Trim().TrimStart('.') } | Where-Object { $_ } | ForEach-Object { "'$_'" }) -join ","
    $pac = "function FindProxyForURL(url, host) { var P = '$proxy'; var d = [$doms];" +
      " if (isPlainHostName(host)) return P;" +
      " if (shExpMatch(host, '10.*') || shExpMatch(host, '192.168.*') || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return P;" +
      " for (var i = 0; i < d.length; i++) { if (host === d[i] || dnsDomainIs(host, '.' + d[i])) return P; }" +
      " return 'DIRECT'; }"
  }
  $pacUrl = "data:application/x-ns-proxy-autoconfig;base64," + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pac))
  $profileDir = Join-Path $Store "chrome-profile"
  Start-Process $chromeExe -ArgumentList @("--user-data-dir=`"$profileDir`"", "--proxy-pac-url=`"$pacUrl`"", "--no-first-run", "chrome://version")
  if ($AllViaVpn) { Say "Chrome VPN dibuka: SEMUA traffic tab itu lewat VPN." Green }
  else { Say "Chrome VPN dibuka (profil terpisah): 10.x, 172.16-31.x, 192.168.x, $ProxyDomains lewat VPN; sisanya langsung." Green }
}

# ================= main =================
if ($Stop) { docker rm -f $Container *> $null; Say "VPN dihentikan." Green; return }
if ($Logs) { docker logs -f $Container; return }
if ($Status) {
  $n = docker inspect -f '{{.Config.Labels.vpnname}} | running={{.State.Running}}' $Container 2>$null
  if (-not $n) { Say "VPN tidak jalan." Yellow; return }
  Say "Profil: $n" Cyan
  docker exec $Container sh -c 'ip -brief addr show ppp0 2>/dev/null || echo "ppp0 belum ada"; ip route | grep ppp0 | head -15; tail -5 /run/vpn/last.log 2>/dev/null'
  Say "SOCKS5: 127.0.0.1:$SocksPort" Cyan
  return
}

$vpns = Get-VpnList
if ($List) { Show-VpnList $vpns; return }
if ($Chrome -and -not $Name) { Start-ChromeProxy; return }

if (-not $Name) {
  Show-VpnList $vpns
  $pick = Read-Host "Pilih nomor VPN"
  $idx = 0
  if (-not [int]::TryParse($pick, [ref]$idx) -or $idx -lt 1 -or $idx -gt $vpns.Count) { throw "Pilihan tidak valid." }
  $v = $vpns[$idx - 1]
} else {
  $v = $vpns | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
  if (-not $v) { throw "Profil '$Name' tidak ada. Lihat -List." }
}
Say "Profil: $($v.Name)  ($($v.Host):$($v.Port), $(if ($v.Saml) { 'SAML' } else { 'user+password' }))" Cyan

$profiles = Read-Profiles
$prof = $profiles[$v.Name]
if (-not $prof -or $Reset) { $prof = [pscustomobject]@{ cert = ""; otp = $false } }

if (-not $v.Saml) {
  if ($Reset -or -not (Test-Path (CredPath $v.Name))) {
    $u = Read-Host "Username VPN untuk '$($v.Name)'"
    $p = Read-Host "Password" -AsSecureString
    (New-Object System.Management.Automation.PSCredential($u, $p)) | Export-Clixml (CredPath $v.Name)
    $ans = Read-Host "Profil ini minta OTP/2FA (FortiToken/SMS/email)? (y/N)"
    $prof.otp = ($ans -match '^[yY]')
  }
}
$profiles[$v.Name] = $prof; Save-Profiles $profiles

Ensure-Docker
Ensure-Image

$otpCode = $Otp
# SAML: cek sertifikat gateway SEBELUM membuka browser, supaya tidak perlu login Microsoft/SSO dua kali.
if ($v.Saml -and -not $prof.cert) {
  $probe = @'
v=$(curl -s -m 10 -o /dev/null -w '%{ssl_verify_result}' https://HOSTPORT/remote/login); d=$(echo | openssl s_client -connect HOSTPORT 2>/dev/null | openssl x509 -noout -fingerprint -sha256 | cut -d= -f2 | tr -d : | tr A-F a-f); echo $v $d
'@
  $res = (docker run --rm --entrypoint sh $Image -c ($probe.Trim().Replace("HOSTPORT", "$($v.Host):$($v.Port)")) 2>$null) -join " "
  $parts = $res.Trim() -split '\s+'
  if ($parts.Count -ge 2 -and $parts[0] -ne "0" -and $parts[1] -match '^[0-9a-f]{64}$') {
    Say "Sertifikat gateway tidak dipercaya CA. Digest SHA-256:" Yellow
    Say "  $($parts[1])" White
    $ok = ""
    if ($TrustNew) { $ok = "y"; Say "Sertifikat dipercaya otomatis (pakai -AskTrust untuk ditanya dulu)." Yellow }
    else { try { $ok = [string](Read-Host "Percayai sertifikat ini untuk '$($v.Name)'? (y/N)") } catch { $ok = "" } }
    if ($null -eq $ok) { $ok = "" }
    if ($ok.Trim() -notmatch '^[yY]$') { throw "Dibatalkan." }
    $prof.cert = $parts[1]; $profiles[$v.Name] = $prof; Save-Profiles $profiles
  }
}
for ($attempt = 1; $attempt -le 4; $attempt++) {
  if (-not $v.Saml -and $prof.otp -and -not $otpCode) { $otpCode = Read-Host "Kode OTP" }
  Say "Menyambungkan..." Yellow
  Start-Vpn $v $prof $otpCode
  $r = Wait-Vpn $v 45
  switch ($r.state) {
    "up" {
      Say "VPN '$($v.Name)' tersambung. SOCKS5: 127.0.0.1:$SocksPort" Green
      docker exec $Container sh -c 'ip route | grep ppp0 | head -10'
      Say "Pakai: .\run_vpn_docker.ps1 -Chrome   |  MobaXterm: Network settings -> Proxy SOCKS5 127.0.0.1:$SocksPort" Cyan
      if ($Chrome) { Start-ChromeProxy }
      return
    }
    "cert" {
      Say "Sertifikat gateway belum dikenal. Digest SHA-256:" Yellow
      Say "  $($r.cert)" White
      $ok = ""
      $changed = [bool]$prof.cert -and $prof.cert -ne $r.cert
      if ($changed) { Say "PERINGATAN: sertifikat BERUBAH dari yang disimpan ($($prof.cert)). Bisa karena sertifikat diperbarui, atau ada penyadapan (MITM)." Red }
      if ($TrustNew -and -not $changed) { $ok = "y"; Say "Sertifikat dipercaya otomatis (pakai -AskTrust untuk ditanya dulu)." Yellow }
      else { try { $ok = [string](Read-Host "Percayai sertifikat ini untuk '$($v.Name)'? (y/N)") } catch { $ok = "" } }
      if ($null -eq $ok) { $ok = "" }
      if ($ok.Trim() -notmatch '^[yY]$') { docker rm -f $Container *> $null; throw "Dibatalkan." }
      $prof.cert = $r.cert; $profiles[$v.Name] = $prof; Save-Profiles $profiles
      $otpCode = $Otp  # OTP lama tidak terpakai karena belum sampai login
    }
    "otp" {
      Say "Gateway meminta OTP/2FA." Yellow
      $prof.otp = $true; $profiles[$v.Name] = $prof; Save-Profiles $profiles
      $otpCode = ""
    }
    "auth" {
      docker rm -f $Container *> $null
      Say ($r.log -split "`n" | Select-Object -Last 8 | Out-String) DarkGray
      throw "Login ditolak. Ulangi dengan -Reset untuk mengganti username/password (hati-hati akun terkunci)."
    }
    default {
      Say ($r.log -split "`n" | Select-Object -Last 15 | Out-String) DarkGray
      docker rm -f $Container *> $null
      throw "VPN gagal ($($r.state)). Log di atas."
    }
  }
}
throw "Terlalu banyak percobaan."
