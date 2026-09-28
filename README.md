# 🎬 Anideck

> **Tactile Local Anime Watchlist Tracker & MPV Media Player IPC Cockpit**

Anideck is a tactile desktop-web companion engineered for local `.mkv` anime enthusiasts who use **MPV Media Player**. It bridges the gap between local high-bitrate 10-bit video playback and modern streaming conveniences by tracking exact episode numbers, resume timestamps (`MM:SS`), and permanent watch history.

---

## ✨ Key Features

- **⏱️ Exact Episode & Timestamp Tracking**: Always know which episode you are on and the exact minute and second (`MM:SS`) where you stopped watching.
- **🔌 Real-Time MPV Named Pipe IPC Bridge**: Launch episodes directly in `mpv` starting at your last saved timestamp (`--start=MM:SS`) while reading live playback telemetry (`time-pos` and `duration`) over a local IPC socket.
- **🧠 Permanent Watchlist Memory**: Keep a lifelong record of **Currently Watching**, **Completed**, **Plan to Watch**, and **On-Hold** series—even after deleting heavy `.mkv` archives to free up disk space.
- **🔢 Natural Float Episode Parser**: Accurately sorts multi-cour folders (`Part 1`, `Part 2`), OVAs, and decimal recap episodes (e.g., `11` ➔ `11.5 OVA`, `18` ➔ `18.5` ➔ `19`).
- **🛡️ Anti-Duplicate Watchlist Guard**: Integrated with the **Jikan v4 (MyAnimeList) API** to fetch canonical titles, studio metadata, and high-resolution posters while warning you if a series is already in your watch history.
- **🎹 Pure Web Audio API Synthesizer**: Zero-dependency tactile button clicks and completion fanfare synthesized in real time.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Canvas Confetti
- **Local Runtime Bridge**: Vite Server Middleware (`node:fs`, `node:child_process`, `node:net`)
- **Media Player Integration**: MPV Media Player (`--input-ipc-server`, `--save-position-on-quit`)
- **Metadata API**: Jikan REST API v4 (MyAnimeList)

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/channdraa-afk/Anideck.git
cd Anideck

# Install dependencies
npm install

# Start the local cockpit
npm run dev
```

Place your local anime folders inside the `anime/` directory (automatically ignored by Git) to enable one-click MPV playback and automatic episode discovery.
