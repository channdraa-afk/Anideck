import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const ROOT_DIR = process.cwd();
const ANIME_DIR = path.join(ROOT_DIR, 'anime');
const WATCH_LATER_DIR = path.join(ROOT_DIR, '.watch_later');
const STATE_FILE = path.join(ROOT_DIR, 'anideck-state.json');
const DOCS_FILE = path.join(ROOT_DIR, 'DOKUMENTASI.md');

const MPV_WINGET_PATH =
  'C:\\Users\\chand\\AppData\\Local\\Microsoft\\WinGet\\Packages\\mpv-player.mpv-CI.MSVC_Microsoft.Winget.Source_8wekyb3d8bbwe\\mpv.exe';
const IPC_PIPE = '\\\\.\\pipe\\anideck-mpv-ipc';

export interface EpisodeFile {
  id: string;
  part: string;
  episodeNum: number;
  episodeLabel: string;
  fileName: string;
  fullPath: string;
  sizeMB: number;
}

export interface EpisodeProgress {
  seconds: number;
  duration: number;
  updatedAt: string;
}

export interface AnimeEntry {
  id: string;
  title: string;
  aliases: string[];
  status: 'watching' | 'completed' | 'plan' | 'on_hold';
  currentEpisode: number;
  currentEpisodeLabel: string;
  currentSeconds: number;
  durationSeconds: number;
  totalEpisodes: number;
  folderName?: string;
  malId?: number;
  posterUrl?: string;
  score?: number;
  personalRating?: number;
  studio?: string;
  genres?: string[];
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  watchedEpisodes: string[];
  episodeProgress: Record<string, { seconds: number; duration: number }>;
}

interface LiveMpvState {
  active: boolean;
  animeId: string | null;
  episodeLabel: string | null;
  fileName: string | null;
  seconds: number;
  duration: number;
}

let liveMpv: LiveMpvState = {
  active: false,
  animeId: null,
  episodeLabel: null,
  fileName: null,
  seconds: 0,
  duration: 1420,
};

const DEFAULT_STATE: { animes: AnimeEntry[] } = {
  animes: [
    {
      id: '86-eighty-six',
      title: '86 - EIGHTY SIX',
      aliases: ['Lapan Enam', 'Eighty Six', '86'],
      status: 'watching',
      currentEpisode: 1,
      currentEpisodeLabel: '01',
      currentSeconds: 0,
      durationSeconds: 1420,
      totalEpisodes: 26,
      folderName: '86',
      malId: 41457,
      posterUrl: 'https://cdn.myanimelist.net/images/anime/1987/117507l.jpg',
      score: 8.72,
      studio: 'A-1 Pictures',
      genres: ['Action', 'Drama', 'Sci-Fi', 'Mecha'],
      startedAt: '2026-09-20',
      notes: 'BD 1080p MKV 10-bit (Sub Indo ASS) — Part 1 & Part 2',
      watchedEpisodes: [],
      episodeProgress: {},
    },
  ],
};

function loadState(): { animes: AnimeEntry[] } {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {
    // Fallback to default
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf-8');
  return DEFAULT_STATE;
}

function saveState(state: { animes: AnimeEntry[] }) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  syncMarkdownLedger(state);
}

function formatMMSS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function syncMarkdownLedger(state: { animes: AnimeEntry[] }) {
  try {
    if (!fs.existsSync(DOCS_FILE)) return;
    const raw = fs.readFileSync(DOCS_FILE, 'utf-8');
    const markerStart = '<!-- ANIDECK_LEDGER_START -->';
    const markerEnd = '<!-- ANIDECK_LEDGER_END -->';
    const startIdx = raw.indexOf(markerStart);
    const endIdx = raw.indexOf(markerEnd);
    if (startIdx === -1 || endIdx === -1) return;

    const watching = state.animes.filter((a) => a.status === 'watching');
    const completed = state.animes.filter((a) => a.status === 'completed');
    const plan = state.animes.filter((a) => a.status === 'plan');
    const onHold = state.animes.filter((a) => a.status === 'on_hold');

    const watchingRows =
      watching.length > 0
        ? watching
            .map(
              (a, i) =>
                `| **${i + 1}** | **${a.title}** | ${a.aliases.join(', ') || '-'} | Eps **${a.currentEpisodeLabel}** / ${a.totalEpisodes || '?'} | **${formatMMSS(a.currentSeconds)}** / ${formatMMSS(a.durationSeconds)} | ${a.watchedEpisodes.length} Eps Selesai | ${a.notes || '-'} |`
            )
            .join('\n')
        : '| - | *(Belum ada anime yang sedang ditonton)* | - | - | - | - | - |';

    const completedRows =
      completed.length > 0
        ? completed
            .map(
              (a, i) =>
                `| **${i + 1}** | **${a.title}** | ${a.totalEpisodes || '?'} Eps | ${a.completedAt || '-'} | ${a.personalRating ? `⭐ ${a.personalRating}/10` : '-'} | ${a.notes || '-'} |`
            )
            .join('\n')
        : '| - | *(Belum ada entri tamat)* | - | - | - | - |';

    const planRows =
      plan.length > 0
        ? plan
            .map(
              (a, i) =>
                `| **${i + 1}** | **${a.title}** | ${(a.genres || []).join(', ') || '-'} | ${a.totalEpisodes || '?'} Eps | ${a.notes || '-'} |`
            )
            .join('\n')
        : '| - | *(Daftar rencana tonton kosong)* | - | - | - |';

    const holdRows =
      onHold.length > 0
        ? onHold
            .map(
              (a, i) =>
                `| **${i + 1}** | **${a.title}** | Eps ${a.currentEpisodeLabel} (${formatMMSS(a.currentSeconds)}) | ${a.notes || '-'} |`
            )
            .join('\n')
        : '| - | *(Kosong)* | - | - |';

    const ledgerBlock = `${markerStart}
### 🟢 1. Sedang Ditonton (Currently Watching)

| No | Judul Kanonikal | Alias | Posisi Episode | Menit Terakhir | Progres | Catatan |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
${watchingRows}

### 🏆 2. Riwayat Tamat (Completed)

| No | Judul Kanonikal | Total Episode | Tanggal Tamat | Rating Pribadi | Ulasan / Catatan |
| :---: | :--- | :---: | :---: | :---: | :--- |
${completedRows}

### 📋 3. Rencana Tonton (Plan to Watch)

| No | Judul Kanonikal | Genre | Total Episode | Catatan |
| :---: | :--- | :--- | :---: | :--- |
${planRows}

### ⏸️ 4. Ditunda / On-Hold

| No | Judul Kanonikal | Posisi Terakhir | Alasan / Catatan |
| :---: | :--- | :---: | :--- |
${holdRows}
${markerEnd}`;

    const updated =
      raw.slice(0, startIdx) + ledgerBlock + raw.slice(endIdx + markerEnd.length);
    fs.writeFileSync(DOCS_FILE, updated, 'utf-8');
  } catch {
    // Ignore doc sync errors
  }
}

// Natural Float Episode Parser (Fixes 18.5.mkv before 18.mkv ASCII bug)
function parseEpisodeFromFilename(fileName: string): {
  num: number;
  label: string;
} {
  const withoutExt = fileName.replace(/\.(mkv|mp4|avi)$/i, '');
  // Look for patterns like " - 18.5", " - 11 END", " - 11.5 OVA", "Ep 05"
  const dashMatch = withoutExt.match(/-\s*(\d+(?:\.\d+)?)\s*(OVA|END|SP|Recap)?$/i);
  if (dashMatch) {
    const num = parseFloat(dashMatch[1]);
    const suffix = dashMatch[2] ? ` ${dashMatch[2].toUpperCase()}` : '';
    return { num, label: `${dashMatch[1]}${suffix}` };
  }
  const allNumbers = [...withoutExt.matchAll(/(\d+(?:\.\d+)?)/g)];
  if (allNumbers.length > 0) {
    const last = allNumbers[allNumbers.length - 1][1];
    return { num: parseFloat(last), label: last };
  }
  return { num: 0, label: withoutExt };
}

function scanAnimeFolder(folderName: string): EpisodeFile[] {
  const targetDir = path.join(ANIME_DIR, folderName);
  if (!fs.existsSync(targetDir)) return [];

  const results: EpisodeFile[] = [];

  function walk(currentDir: string, partLabel: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, entry.name);
      } else if (/\.(mkv|mp4|avi)$/i.test(entry.name)) {
        const stat = fs.statSync(fullPath);
        const { num, label } = parseEpisodeFromFilename(entry.name);
        results.push({
          id: `${partLabel}-${label}`,
          part: partLabel,
          episodeNum: num,
          episodeLabel: label,
          fileName: entry.name,
          fullPath,
          sizeMB: Math.round(stat.size / (1024 * 1024)),
        });
      }
    }
  }

  walk(targetDir, 'Main');

  // Sort by Part name then numeric float episodeNum (so 18 comes before 18.5!)
  results.sort((a, b) => {
    if (a.part !== b.part) {
      return a.part.localeCompare(b.part, undefined, { numeric: true });
    }
    return a.episodeNum - b.episodeNum;
  });

  return results;
}

function autoDiscoverFolders(state: { animes: AnimeEntry[] }): boolean {
  if (!fs.existsSync(ANIME_DIR)) {
    fs.mkdirSync(ANIME_DIR, { recursive: true });
  }
  const dirs = fs
    .readdirSync(ANIME_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'));

  let changed = false;
  for (const d of dirs) {
    const existing = state.animes.find(
      (a) =>
        a.folderName?.toLowerCase() === d.name.toLowerCase() ||
        a.title.toLowerCase() === d.name.toLowerCase() ||
        a.aliases.some((al) => al.toLowerCase() === d.name.toLowerCase())
    );
    if (!existing) {
      const files = scanAnimeFolder(d.name);
      state.animes.unshift({
        id: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: d.name,
        aliases: [],
        status: 'watching',
        currentEpisode: 1,
        currentEpisodeLabel: files[0]?.episodeLabel || '01',
        currentSeconds: 0,
        durationSeconds: 1420,
        totalEpisodes: files.length || 12,
        folderName: d.name,
        startedAt: new Date().toISOString().slice(0, 10),
        notes: 'Terdeteksi otomatis dari folder anime/',
        watchedEpisodes: [],
        episodeProgress: {},
      });
      changed = true;
    } else if (!existing.folderName) {
      existing.folderName = d.name;
      changed = true;
    }
  }
  return changed;
}

function queryMpvProperty(property: string): Promise<number | null> {
  return new Promise((resolve) => {
    const client = net.connect(IPC_PIPE, () => {
      const cmd = JSON.stringify({ command: ['get_property', property] }) + '\n';
      client.write(cmd);
    });
    let resolved = false;
    client.on('data', (chunk) => {
      if (resolved) return;
      resolved = true;
      try {
        const lines = chunk.toString().trim().split('\n');
        const parsed = JSON.parse(lines[0]);
        resolve(typeof parsed.data === 'number' ? parsed.data : null);
      } catch {
        resolve(null);
      }
      client.end();
    });
    client.on('error', () => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        client.destroy();
        resolve(null);
      }
    }, 600);
  });
}

function anideckLocalApi(): Plugin {
  return {
    name: 'anideck-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        res.setHeader('Content-Type', 'application/json');

        const readBody = (): Promise<any> =>
          new Promise((resolve) => {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch {
                resolve({});
              }
            });
          });

        // GET /api/library
        if (req.url === '/api/library' && req.method === 'GET') {
          const state = loadState();
          if (autoDiscoverFolders(state)) {
            saveState(state);
          }
          const enriched = state.animes.map((anime) => {
            const files = anime.folderName ? scanAnimeFolder(anime.folderName) : [];
            return {
              ...anime,
              hasLocalFiles: files.length > 0,
              localFiles: files,
            };
          });
          res.end(
            JSON.stringify({
              animeDir: ANIME_DIR,
              animes: enriched,
              liveMpv,
            })
          );
          return;
        }

        // GET /api/mpv-status
        if (req.url === '/api/mpv-status' && req.method === 'GET') {
          if (liveMpv.active && liveMpv.animeId && liveMpv.episodeLabel) {
            const [pos, dur] = await Promise.all([
              queryMpvProperty('time-pos'),
              queryMpvProperty('duration'),
            ]);
            if (pos !== null) {
              liveMpv.seconds = Math.floor(pos);
              if (dur && dur > 0) liveMpv.duration = Math.floor(dur);

              const state = loadState();
              const anime = state.animes.find((a) => a.id === liveMpv.animeId);
              if (anime) {
                anime.currentEpisodeLabel = liveMpv.episodeLabel;
                const parsedNum = parseFloat(liveMpv.episodeLabel);
                if (!Number.isNaN(parsedNum)) anime.currentEpisode = parsedNum;
                anime.currentSeconds = liveMpv.seconds;
                anime.durationSeconds = liveMpv.duration;
                anime.episodeProgress[liveMpv.episodeLabel] = {
                  seconds: liveMpv.seconds,
                  duration: liveMpv.duration,
                };
                // Auto-mark watched when >= 85% of episode duration
                if (
                  liveMpv.duration > 60 &&
                  liveMpv.seconds / liveMpv.duration >= 0.85 &&
                  !anime.watchedEpisodes.includes(liveMpv.episodeLabel)
                ) {
                  anime.watchedEpisodes.push(liveMpv.episodeLabel);
                }
                saveState(state);
              }
            }
          }
          res.end(JSON.stringify(liveMpv));
          return;
        }

        // POST /api/play
        if (req.url === '/api/play' && req.method === 'POST') {
          const { animeId, episodeLabel, fullPath, startSeconds } = await readBody();
          if (!fullPath || !fs.existsSync(fullPath)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'File video tidak ditemukan di disk.' }));
            return;
          }

          if (!fs.existsSync(WATCH_LATER_DIR)) {
            fs.mkdirSync(WATCH_LATER_DIR, { recursive: true });
          }

          const mpvBin = fs.existsSync(MPV_WINGET_PATH) ? MPV_WINGET_PATH : 'mpv';
          const args = [
            `--input-ipc-server=${IPC_PIPE}`,
            '--save-position-on-quit',
            `--watch-later-directory=${WATCH_LATER_DIR}`,
            '--write-filename-in-watch-later-config',
          ];

          if (typeof startSeconds === 'number' && startSeconds > 5) {
            args.push(`--start=${Math.floor(startSeconds)}`);
          }

          args.push(fullPath);

          liveMpv = {
            active: true,
            animeId,
            episodeLabel,
            fileName: path.basename(fullPath),
            seconds: typeof startSeconds === 'number' ? Math.floor(startSeconds) : 0,
            duration: 1420,
          };

          const state = loadState();
          const anime = state.animes.find((a) => a.id === animeId);
          if (anime) {
            anime.currentEpisodeLabel = episodeLabel;
            const parsedNum = parseFloat(episodeLabel);
            if (!Number.isNaN(parsedNum)) anime.currentEpisode = parsedNum;
            if (typeof startSeconds === 'number') {
              anime.currentSeconds = Math.floor(startSeconds);
            }
            saveState(state);
          }

          const child = spawn(mpvBin, args, {
            detached: true,
            stdio: 'ignore',
          });

          child.on('exit', () => {
            liveMpv.active = false;
            const finalState = loadState();
            saveState(finalState);
          });

          child.unref();
          res.end(JSON.stringify({ ok: true, liveMpv }));
          return;
        }

        // POST /api/update-anime
        if (req.url === '/api/update-anime' && req.method === 'POST') {
          const payload = await readBody();
          const state = loadState();
          const idx = state.animes.findIndex((a) => a.id === payload.id);
          if (idx !== -1) {
            state.animes[idx] = { ...state.animes[idx], ...payload };
          } else {
            state.animes.unshift(payload);
          }
          saveState(state);
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        // POST /api/delete-anime
        if (req.url === '/api/delete-anime' && req.method === 'POST') {
          const { id } = await readBody();
          const state = loadState();
          state.animes = state.animes.filter((a) => a.id !== id);
          saveState(state);
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        // POST /api/open-folder
        if (req.url === '/api/open-folder' && req.method === 'POST') {
          const { folderName } = await readBody();
          const target = folderName ? path.join(ANIME_DIR, folderName) : ANIME_DIR;
          if (!fs.existsSync(target)) {
            fs.mkdirSync(target, { recursive: true });
          }
          spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref();
          res.end(JSON.stringify({ ok: true, opened: target }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), anideckLocalApi()],
  server: {
    port: 5177,
    strictPort: true,
    watch: {
      ignored: ['**/anime/**', '**/.watch_later/**', '**/anideck-state.json'],
    },
  },
});
