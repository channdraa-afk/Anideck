# 🎬 SUB-KITAB OPERASIONAL & LEDGER KOLEKSI ANIME: ANIDECK

> *"Markas terpadu aplikasi monitor tontonan anime, pelacak menit terakhir MPV, dan buku induk riwayat tontonan Chandra (@channdraa-afk)."*

---

## 🛠️ PILAR 1: HOW-TO SETUP & ARSITEKTUR SISTEM

### 1.1. Identitas & Lokasi Proyek
- **Nama Proyek**: **Anideck** (*Tactile Anime Watchlist & MPV Resume Cockpit*)
- **Lokasi Proyek**: `c:\My Project\Anideck`
- **Lokasi Gudang Video `.mkv`**: `c:\My Project\Anideck\anime\` (Dikecualikan secara ketat di `.gitignore` agar file video bergiga-giga tidak pernah masuk ke Git).
- **Shortcut Desktop**: `Anideck.lnk` di Desktop Windows (menjalankan [`launch.vbs`](file:///c:/My%20Project/Anideck/launch.vbs) dalam mode *Standalone App Window* `--app=http://localhost:5177`).

### 1.2. Perintah Operasional
```powershell
# Instalasi dependensi
npm install

# Menjalankan server lokal Anideck (Port 5177)
npm run dev

# Verifikasi TypeScript & Build Produksi
npm run build
```

### 1.3. Standar Direktori & SOP Koleksi Video Lokal
1. **Prinsip Nama Kanonikal**: Pencatatan di dalam Anideck menggunakan nama asli/kanonikal anime (contoh: **`86 - EIGHTY SIX`**), dengan daftar nama alias tersimpan untuk deteksi anti-duplikat.
2. **Organisasi Multi-Season & Split-Cour**: Setiap anime ditaruh di `c:\My Project\Anideck\anime\<nama-anime>\` (bisa memiliki subfolder `Part 1`, `Part 2`, dst.).
3. **Pemutar Utama**: **MPV Media Player** (`C:\Users\chand\AppData\Local\Microsoft\WinGet\Packages\mpv-player.mpv-CI.MSVC_Microsoft.Winget.Source_8wekyb3d8bbwe\mpv.exe`).

---

## 📦 PILAR 2: STACK & DEPENDENCIES

- **Frontend Core**: React 19 + TypeScript + Vite 6
- **Styling & Estetika**: Tailwind CSS v3, Google Font **Nunito**, *The Warm Tactile Baseline* (`#FFFDF8` Cream Alabaster & `#1E293B` Espresso Slate, tombol 3D amblas bebas `transition-all`).
- **Local Systems Bridge (`vite.config.ts`)**:
  - `node:fs` & `node:path`: Pemindai otomatis berkas `.mkv` beserta *Natural Float Episode Parser* (`18` ➔ `18.5` ➔ `19`).
  - `node:child_process` & `node:net`: Peluncur `mpv.exe` dengan `--start=<detik>` dan pembacaan *Windows Named Pipe IPC* (`\\.\pipe\anideck-mpv-ipc`) untuk memantau menit pemutaran secara *live*.
- **Audio & Selebrasi**: Pure Web Audio API Synthesizer (`src/lib/sound.ts`) & `canvas-confetti`.

---

## 📍 PILAR 3: STATE TRACKER & ANIME WATCHLIST LEDGER

### 3.1. Catatan Rekayasa (ADR-Lite)
- [x] Peleburan `Anime Sanctuary` & `Tactilab` Menjadi **Anideck** (28 September 2026):
  - **Problem**: Menonton berkas `.mkv` lokal di MPV tidak memiliki pencatat otomatis untuk posisi episode & menit terakhir (`MM:SS`), serta riwayat anime yang sudah tamat rawan hilang jika berkas `.mkv` dihapus.
  - **Solution / State**: Dibangun aplikasi desktop-web lokal **Anideck** di `c:\My Project\Anideck` dengan folder video terintegrasi di `c:\My Project\Anideck\anime\` (terlindungi `.gitignore`), pelacak detik real-time via MPV Named Pipe IPC, memori riwayat permanen (`anideck-state.json` + sinkronisasi Markdown otomatis), pencarian Jikan MyAnimeList berfitur *Anti-Duplicate Guard*, dan shortcut Desktop `Anideck.lnk`.
- [x] Optimasi Peluncur Firefox & Eliminasi Lag Klik 0ms (28 September 2026):
  - **Problem**: Membuka via Microsoft Edge `--app` terasa berat (*lag*), ditambah `fs.statSync` berulang ke 26 berkas `.mkv` serta penulisan sinkron ke `DOKUMENTASI.md` yang memicu Vite HMR reload setiap kali tombol diklik.
  - **Solution / State**: Target [`launch.vbs`](file:///c:/My%20Project/Anideck/launch.vbs) dialihkan ke `C:\Program Files\Mozilla Firefox\firefox.exe`. Ditambahkan *In-Memory MKV Scan Cache*, *debounced async disk write*, pengecualian `DOKUMENTASI.md` dari `server.watch.ignored`, serta penghentian polling `/api/mpv-status` saat MPV tidak aktif.
- [x] Transformasi **Professional Cinema Dark UI (Netflix × Crunchyroll × IMDb)** & **100% Local Poster Vault** (28 September 2026):
  - **Problem**: Tampilan krem terang kurang nyaman untuk suasana menonton anime dan langsung membuka detail 1 anime tanpa memilih dari menu katalog terlebih dahulu; selain itu URL poster eksternal membutuhkan koneksi internet.
  - **Solution / State**: Dirombak ke tema **Cinema Obsidian Dark (`#0B0F19` & `#131B2E`)** dengan aksen *Crunchyroll Orange (`#F97316`)* & *Soft Warm Amber (`#FDBA74`)*. Navigasi dibagi menjadi 2 tahap (**Menu Utama Katalog + Continue Watching Strip** ➔ klik kartu baru masuk **Halaman Detail & Daftar Episode**). Ditambahkan *Auto-Download Poster Engine* di [`vite.config.ts`](file:///c:/My%20Project/Anideck/vite.config.ts) yang menyimpan file poster ke `anime/.posters/<id>.jpg` agar 100% bebas internet selamanya.
- [x] Branding: **Soft Minimalist App Icon** (`public/icon.png` + `anideck.ico` di `Anideck.lnk`), penghapusan badge `PRO` di header, dan penghalusan warna aksen dari kuning emas tajam ke *Soft Warm Peach/Cream (`#FDBA74` / `#FFFDF8`)*.
- [x] **Anti-Typo Poster Rematcher** & **Siklus Anime Belum Di-download (Tracker Mode + Smart Fuzzy Folder Linker)** (28 September 2026):
  - **Problem**: Nama folder yang typo berisiko mengunduh poster MAL yang salah tanpa tombol koreksi, serta anime yang ditambahkan sebelum di-download belum memiliki tombol penyiap folder lokal dan rawan melahirkan kartu duplikat saat foldernya dibuat belakangan.
  - **Solution / State**: Ditambahkan *Live Debounced Search (400ms)* di modal tambah anime, tombol **`🖼️ Ganti Poster / Pilih Ulang MAL`** (`forceOverwritePoster`) di halaman detail untuk menimpa file `.jpg` lokal kapan saja, tombol **`📂 Siapkan Folder Video di anime/`** (`/api/prepare-folder`) + **`+1 Episode Selesai`** untuk anime tanpa file `.mkv`, serta *Smart Fuzzy Folder Linker* (`isFolderMatchingAnime`) yang otomatis menyatukan folder `.mkv` baru dengan entri *Rencana Tonton* yang sudah ada.

---

### 3.2. Buku Induk Tontonan Chandra (Auto-Synced Ledger)

<!-- ANIDECK_LEDGER_START -->
### 🟢 1. Sedang Ditonton (Currently Watching)

| No | Judul Kanonikal | Alias | Posisi Episode | Menit Terakhir | Progres | Catatan |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| **1** | **86 - EIGHTY SIX** | Lapan Enam, Eighty Six, 86 | Eps **12** / 26 | **13:34** / 23:41 | 0 Eps Selesai | BD 1080p MKV 10-bit (Sub Indo ASS) — Part 1 & Part 2 |

### 🏆 2. Riwayat Tamat (Completed)

| No | Judul Kanonikal | Total Episode | Tanggal Tamat | Rating Pribadi | Ulasan / Catatan |
| :---: | :--- | :---: | :---: | :---: | :--- |
| - | *(Belum ada entri tamat)* | - | - | - | - |

### 📋 3. Rencana Tonton (Plan to Watch)

| No | Judul Kanonikal | Genre | Total Episode | Catatan |
| :---: | :--- | :--- | :---: | :--- |
| - | *(Daftar rencana tonton kosong)* | - | - | - |

### ⏸️ 4. Ditunda / On-Hold

| No | Judul Kanonikal | Posisi Terakhir | Alasan / Catatan |
| :---: | :--- | :---: | :--- |
| - | *(Kosong)* | - | - |
<!-- ANIDECK_LEDGER_END -->
