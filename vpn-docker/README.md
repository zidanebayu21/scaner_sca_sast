# VPN FortiGate di Docker → hanya Chrome/SSH yang lewat VPN

PC tidak ikut ter-VPN. VPN kantor (FortiGate SSL VPN) jalan di dalam container Docker dan keluar sebagai proxy **SOCKS5 `127.0.0.1:1080`**. Hanya aplikasi yang diarahkan ke proxy itu yang masuk jaringan kantor:
- Chrome, lewat extension `vpn_proxy_ext`;
- SSH (MobaXterm, PuTTY, OpenSSH), WinSCP, DBeaver, dan sejenisnya.

```
Chrome / SSH ──► SOCKS5 127.0.0.1:1080 ──► container: openfortivpn (ppp0) ──► FortiGate kantor ──► server 10.x
internet biasa ─────────────────────────────────────────────────────────────► langsung
```

Isi folder:
- `run_vpn_docker.ps1`: menyalakan Docker, membuat image, memilih profil VPN, login, dan menjalankan SOCKS.
- `vpn_proxy_ext/`: extension Chrome (proxy per profil Chrome).

## Kebutuhan
- Windows + Docker Desktop. Script menyalakannya sendiri kalau belum jalan.
- File backup FortiClient (`vpn_backup.conf`): FortiClient → Settings → **Backup**. Script hanya membaca nama profil, gateway, dan jenis login (password atau SAML). Username/password terenkripsi di backup **tidak** dibuka.
- Jangan commit `vpn_backup.conf` ke repo. Simpan di luar folder ini.

## 1. Setelan pribadi (sekali)
```powershell
cd <repo>\vpn-docker
.\run_vpn_docker.ps1 -Setup -Config "C:\path\vpn_backup.conf" -ChromeEmail "nama@gmail.com" -ProxyDomains "kantor.co.id,intranet.kantor.id"
```
Disimpan di `%LOCALAPPDATA%\vpn_docker\settings.json`, di luar repo:
- `-Config`: lokasi backup FortiClient;
- `-ChromeEmail`: profil Chrome yang dipakai oleh `-Chrome` (cukup sebagian email);
- `-ProxyDomains`: domain kantor yang lewat VPN, selain 10.x / 172.16–31.x / 192.168.x.

## 2. Nyalakan VPN
```powershell
.\run_vpn_docker.ps1 -List                 # daftar profil dari backup
.\run_vpn_docker.ps1                       # menu pilih nomor
.\run_vpn_docker.ps1 -Name "Nama Profil"   # langsung
```

Profil **user+password**:
- Login pertama menanyakan username, password, dan apakah butuh OTP. Disimpan terenkripsi DPAPI di `%LOCALAPPDATA%\vpn_docker` (hanya bisa dibuka akun Windows ini).
- OTP/FortiToken: script menanyakan kodenya saat diminta. Bisa juga langsung `-Otp 123456`.
- Ganti akun: `-Reset`.

Profil **SAML/SSO** (misalnya login Microsoft):
- Browser terbuka ke halaman login FortiGate. Setelah login, FortiGate kembali ke `http://127.0.0.1:8020` (container) dan tunnel tersambung.
- Kalau sesi Microsoft di browser masih aktif, login lewat sendiri.

Sertifikat gateway:
- Sertifikat baru (FortiGate dengan sertifikat bawaan) langsung dipercaya dan diingat. Pakai `-AskTrust` kalau mau ditanya dulu.
- Kalau sertifikat **berubah**, selalu muncul peringatan dan pertanyaan, untuk jaga-jaga penyadapan.

Lain-lain:
```powershell
.\run_vpn_docker.ps1 -Status   # profil aktif, IP ppp0, route
.\run_vpn_docker.ps1 -Logs     # log openfortivpn
.\run_vpn_docker.ps1 -Stop     # matikan VPN
```
- Satu VPN aktif pada satu waktu.
- Profil password tanpa OTP menyambung ulang otomatis kalau putus.
- SAML/OTP harus dijalankan ulang kalau putus.

## 3. Pasang extension di Chrome (sekali per profil)
1. Jalankan `.\run_vpn_docker.ps1 -Chrome`. Profil Chrome milik `ChromeEmail` terbuka di `chrome://extensions`.
2. Nyalakan **Developer mode** di kanan atas.
3. Klik **Load unpacked**, lalu pilih folder `vpn-docker\vpn_proxy_ext`.
4. Ikon **VPN Docker Proxy** muncul dengan badge hijau `VPN`. Klik ikonnya untuk:
   - on/off;
   - port SOCKS (default 1080);
   - "semua situs lewat VPN";
   - daftar domain kantor (satu per baris).

Setelah terpasang, `.\run_vpn_docker.ps1 -Chrome` langsung membuka profil itu.

Cara kerja extension:
- Setelan proxy dari extension hanya berlaku di profil tempat ia dipasang. Profil Chrome lain tidak terpengaruh.
- Kalau VPN mati, alamat internal dicoba langsung, jadi Chrome tidak macet.
- Tanpa extension: `.\run_vpn_docker.ps1 -Chrome -ChromeEmail ""` membuka Chrome terpisah (profil baru) yang proxy-nya sudah diatur.

## 4. SSH lewat proxy
Pastikan VPN menyala (`-Status`). Lalu pilih salah satu.

**MobaXterm**
1. Session → SSH → isi Remote host (misalnya `10.x.x.x`) dan username.
2. Tab **Network settings** → **Proxy settings** → Proxy type **SOCKS5**, Host `127.0.0.1`, Port `1080`.
3. OK. Bisa disimpan sebagai bookmark session.

**PuTTY / WinSCP**
- PuTTY: Connection → Proxy → **SOCKS 5**, Proxy hostname `127.0.0.1`, Port `1080`.
- WinSCP: Advanced → Connection → Proxy → SOCKS5, `127.0.0.1:1080`.

**OpenSSH (PowerShell/CMD)**, memakai `connect.exe` bawaan Git for Windows. Cara paling aman lewat file config, karena perintah satu baris di PowerShell sering rusak gara-gara tanda kutip. Tambahkan ke `%USERPROFILE%\.ssh\config` (pakai garis miring `/`):
```
Host 10.*
    ProxyCommand "C:/Program Files/Git/mingw64/bin/connect.exe" -S 127.0.0.1:1080 %h %p
```
Lalu cukup `ssh user@10.x.x.x`. Ini berlaku untuk ssh bawaan Windows maupun ssh Git. Untuk host dengan nama domain, tambahkan baris `Host *.kantor.co.id` dengan ProxyCommand yang sama.

Satu baris dari **Git Bash**:
```bash
ssh -o ProxyCommand='connect -S 127.0.0.1:1080 %h %p' user@10.x.x.x
```

**DBeaver / klien DB**: Connection → tab **Proxy** (atau SSH → Proxy) → SOCKS5 `127.0.0.1:1080`.

Catatan:
- Ping dari Windows ke 10.x **tidak** lewat proxy, karena SOCKS hanya meneruskan TCP. Untuk cek jaringan:
  ```
  docker exec vpn-forti ping -c 2 10.x.x.x
  ```
- Hostname internal (DNS kantor) di-resolve di dalam container. Di MobaXterm/PuTTY pakai SOCKS5 dengan opsi DNS remote: di PuTTY "Do DNS name lookup at proxy end" = Yes.

## Masalah yang sering muncul
| Gejala | Penyebab / solusi |
|---|---|
| `Couldn't set tty to PPP discipline` | Container perlu `SYS_MODULE` untuk memuat modul `ppp_async`. Script versi ini sudah memakainya. |
| Browser "localhost refused to connect" setelah login SAML | Port 8020 dipakai aplikasi lain, atau container berhenti. Cek `-Logs`. |
| `Login ditolak` | Username/password salah. Jalankan `-Reset`. Jangan diulang terus supaya akun tidak terkunci. |
| Login sukses tapi langsung putus | FortiGate mewajibkan FortiClient asli (EMS/compliance). Cara ini tidak bisa dipakai untuk profil itu. |
| `ports are not available` | Port 1080/8020 bentrok atau masuk range yang direservasi Windows (`netsh int ipv4 show excludedportrange protocol=tcp`). Untuk 1080 pakai `-SocksPort` lain dan samakan port di extension. Port 8020 ditentukan FortiGate untuk SAML, jadi tutup aplikasi yang memakainya. |

Sebelum memakai split seperti ini, pastikan sesuai kebijakan IT kantor.
