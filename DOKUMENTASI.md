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
  - **Solution / State**: Ditambahkan *Live Debounced Search* di modal tambah anime, tombol **`🖼️ Ganti Poster / Pilih Ulang MAL`** (`forceOverwritePoster`) di halaman detail untuk menimpa file `.jpg` lokal kapan saja, tombol **`📂 Siapkan Folder Video di anime/`** (`/api/prepare-folder`) + **`+1 Episode Selesai`** untuk anime tanpa file `.mkv`, serta *Smart Fuzzy Folder Linker* (`isFolderMatchingAnime`) yang otomatis menyatukan folder `.mkv` baru dengan entri *Rencana Tonton* yang sudah ada.
- [x] **100% Offline Catalog (950 Anime) + Offline Recommendation Engine + Penyatuan Cara 1 & Cara 2 + Penghapusan Tombol Suara** (28 September 2026):
  - **Problem**: Pencarian judul anime dan pembuatan Watchlist (`Rencana Tonton`) sebelumnya bergantung pada API Jikan eksternal, belum ada fitur rekomendasi anime yang bisa berjalan tanpa internet, dan tombol speaker/suara klik di navigasi atas tidak diperlukan.
  - **Solution / State**: Ditanamkan database lokal [`src/data/offlineCatalog.json`](file:///c:/My%20Project/Anideck/src/data/offlineCatalog.json) berisi **950 Anime Terbaik & Terpopuler** (lengkap dengan judul English/Romaji, sinonim, genre, studio, skor, tahun, jumlah episode) beserta mesin pencari & pemberi rekomendasi lokal [`src/data/offlineEngine.ts`](file:///c:/My%20Project/Anideck/src/data/offlineEngine.ts) (*Genre & Studio Affinity Scoring*) dan endpoint `/api/cached-poster` yang menyimpan poster otomatis ke SSD. Tombol suara dihapus total, dan Modal Tambah Anime kini menyatukan **Cara 1 (Scan Folder `.mkv` Lokal)** serta **Cara 2 (Cari dari 950 Database Anime Offline / Buat Watchlist)**.
- [x] **Overhaul UI 13 Platform Flagship (0% Emoji AI-Slop) & 9 Fitur Fungsional (Steam-Style `.mkv` Storage Cleaner + Watched Archive)** (28 September 2026):
  - **Problem**: Penggunaan emoji Unicode di tombol/badge membuat UI berkesan *AI-slop*, serta penghapusan file video `.mkv` setelah selesai menonton belum memiliki fitur terdedikasi yang menjamin poster lokal dan riwayat di tab *Completed / Watched* tetap utuh.
  - **Solution / State**: Seluruh emoji Unicode di komponen UI dihapus (0%) dan diganti arsitektur 13 platform (*Apple TV+ Ambient Poster Bleed*, *Netflix Billboard Hero*, *Letterboxd 1px Inner Glass Ring*, *Linear Segmented Controls & Dual Grid/Table View*). Ditambahkan 9 fitur fungsional lokal: (1) `POST /api/delete-videos` (*Steam-Style Storage Cleaner*: hapus semua `.mkv` seri atau khusus episode yang sudah ditonton demi melegakan SSD tanpa pernah menghapus `anime/.posters/<id>.jpg` & riwayat di *Completed / Watched*), (2) *Live MPV IPC Remote* (`Pause`, `Skip OP +85s`, `-10s`), (3) *Scene Timestamp Bookmarks*, (4) *Smart Auto-Advance Next Episode*, (5) *Collector Watch-Time & Disk Analytics*, (6) *Surprise Me / Random Pick*, (7) *Multi-Facet Genre/Studio/Short-Series Filter & Sort*, (8) *Dual Grid/Table View + Shortcut `/` & `Ctrl+K`*, dan (9) *1-Click Portable JSON Backup/Restore*.

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
