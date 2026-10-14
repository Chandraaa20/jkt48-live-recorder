# 🔴 JKT48 Live & Cloud Recorder (Full Online Architecture)

Aplikasi mobile-first super ringan (PWA / Capacitor Android Ready) dengan backend **Supabase**, mesin pemantau live **Cloudflare Worker (Adapter Pattern)**, dan mesin perekam otomatis cloud tanpa batas **GitHub Actions + Telegram Archive**.

---

## 🏗️ Arsitektur "Benang Merah" Sistem

```
┌────────────────────────────────────────────────────────┐
│                   IDN LIVE & SHOWROOM                  │
└───────────────────────────┬────────────────────────────┘
                            │ (Polling setiap 1 menit)
                            ▼
┌────────────────────────────────────────────────────────┐
│      CLOUDFLARE WORKER (Adapter Pattern)               │
│  - IdnAdapter & ShowroomAdapter                        │
│  - Filter ketat: Hanya member JKT48 terdaftar di DB    │
│  - Cek: Apakah member is_auto_record === true?         │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
 (Sync status) │                          │ (Jika auto-record aktif)
               ▼                          ▼
┌────────────────────────┐      ┌────────────────────────┐
│   SUPABASE DATABASE    │      │ GITHUB ACTIONS RECORDER│
│  - members             │      │  - Runner Ubuntu FFmpeg│
│  - active_lives        │◄─────┤  - Split < 2GB         │
│  - recordings (arsip)  │      │  - Upload Telegram     │
└──────────────▲─────────┘      └────────────┬───────────┘
               │                             │
 (Realtime)    │                             ▼
┌──────────────┴─────────┐      ┌────────────────────────┐
│   FRONTEND WEB / PWA   │      │ TELEGRAM CLOUD ARCHIVE │
│  - Pemutar HLS .m3u8   │      │  - Penyimpanan gratis  │
│  - Saklar Auto-Record  │      │  - Link video otomatis │
│  - Picu Rekam Manual   │      └────────────────────────┘
└────────────────────────┘
```

---

## 🚀 Panduan Setup 3 Langkah Cepat

### Langkah 1: Setup Supabase Database
1. Buat project baru di [supabase.com](https://supabase.com) (Gratis).
2. Buka menu **SQL Editor** di dashboard Supabase.
3. Buka file `supabase/schema.sql` di project ini (atau klik tombol **Salin SQL** di tab **Pengaturan** aplikasi), lalu tempel (*paste*) dan klik **Run**.
4. Salin **Project URL** dan **anon public key** dari menu *Project Settings -> API* di Supabase.
5. Buka tab **Pengaturan** di aplikasi web kita, masukkan URL dan Key tersebut, lalu klik **Simpan Pengaturan** & **Uji Koneksi**.

---

### Langkah 2: Deploy Cloudflare Worker (Pemantau Live Otomatis)
Worker ini bertugas memantau siaran IDN Live & Showroom setiap 1 menit menggunakan **Adapter Pattern**, mencocokkannya dengan database member JKT48 di Supabase, dan jika ada member dengan `is_auto_record = true`, worker akan memicu GitHub Actions runner.

#### Cara A: Menggunakan Wrangler CLI (Rekomendasi)
```bash
cd "cloud-backend/cloudflare-worker"

# Login ke Cloudflare (jika belum)
npx wrangler login

# Set secret environment variables
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put GITHUB_REPO

# Deploy worker
npx wrangler deploy
```

#### Cara B: Menggunakan Cloudflare Dashboard
1. Buka [dash.cloudflare.com](https://dash.cloudflare.com) -> *Workers & Pages* -> *Create Worker*.
2. Beri nama `jkt48-live-watcher` lalu klik *Deploy*.
3. Klik *Edit code*, lalu salin isi file [cloud-backend/cloudflare-worker/worker.js](file:///g:/Chandra/Aplikasi/live%20jkt/cloud-backend/cloudflare-worker/worker.js) dan klik *Save and deploy*.
4. Buka tab *Settings -> Variables -> Secrets*, tambahkan:
   - `SUPABASE_URL`: URL project Supabase Anda.
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key dari Supabase.
   - `GITHUB_TOKEN`: Personal Access Token (PAT) GitHub Anda (izin `repo` atau `workflow`).
   - `GITHUB_REPO`: `username/nama-repo` GitHub Anda.
5. Buka tab *Settings -> Triggers -> Cron Triggers*, tambahkan cron: `* * * * *` (setiap 1 menit).
6. Salin URL Worker Anda (contoh: `https://jkt48-live-watcher.yourname.workers.dev`) dan masukkan ke tab **Pengaturan** aplikasi di bagian **Cloudflare Worker URL**.

---

### Langkah 3: Setup GitHub Actions Cloud Recorder (Runner FFmpeg)
Workflow di [.github/workflows/recorder.yml](file:///g:/Chandra/Aplikasi/live%20jkt/.github/workflows/recorder.yml) akan otomatis berjalan di cloud saat dipicu oleh Worker atau saat user menekan **Picu Rekam Manual** di aplikasi.

1. Push repository ini ke GitHub akun Anda.
2. Di repository GitHub Anda, buka menu **Settings -> Secrets and variables -> Actions**.
3. Klik **New repository secret** dan tambahkan secret berikut:
   - `SUPABASE_URL`: URL project Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key Supabase.
   - `TELEGRAM_BOT_TOKEN`: Token bot Telegram Anda dari [@BotFather](https://t.me/BotFather).
   - `TELEGRAM_CHAT_ID`: ID Channel/Grup Telegram penyimpanan (contoh: `@jkt48_recordings_channel` atau `-100xxxxxxxxxx`). Pastikan bot telah dijadikan **Admin** di channel tersebut.
4. Buat **Personal Access Token (PAT)** di GitHub:
   - Buka *GitHub Settings -> Developer Settings -> Personal access tokens (Tokens classic)*.
   - Berikan scope `repo` dan `workflow`.
   - Masukkan token dan nama repo (`username/repo`) di tab **Pengaturan** aplikasi web kita.

---

## 🎯 Cara Menguji Alur Rekam Manual & Otomatis

1. **Uji Coba Manual**:
   - Di tab **Sedang Live**, buka salah satu siaran member (atau klik **Simulasi Live** jika tidak ada yang siaran).
   - Klik tombol **Picu Rekam Manual**.
   - Sistem akan otomatis mencatat sesi rekaman di tabel `recordings` dan memicu GitHub Actions runner.
   - Di GitHub repository Anda, buka tab **Actions** untuk melihat proses recording FFmpeg berlangsung.
   - Setelah siaran selesai, video akan diunggah ke channel Telegram dan status di aplikasi otomatis berubah menjadi **Selesai & Arsip** dengan tombol langsung membuka video!

2. **Uji Coba Otomatis**:
   - Di tab **Member**, aktifkan saklar **REC ON** pada member tertentu (misalnya Freya atau Christy).
   - Saat member tersebut mulai live di IDN Live / Showroom, Cloudflare Worker akan mendeteksi dan secara otomatis mengirim perintah rekam ke GitHub Actions tanpa perlu ada aplikasi yang terbuka di HP!

---

## 📱 Menjalankan Aplikasi & Build Android APK (Capacitor)

### Menjalankan di Browser (Development)
```bash
cd "live jkt"
npm run dev
```
Akses di: `http://localhost:5173`

### Membungkus ke Android APK
```bash
# 1. Build bundle produksi
npm run build

# 2. Tambah platform Android (jika pertama kali)
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android

# 3. Sinkronkan asset
npx cap sync android

# 4. Buka di Android Studio untuk build APK
npx cap open android
```
