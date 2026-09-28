import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const ROOT_DIR = process.cwd();
const ANIME_DIR = path.join(ROOT_DIR, 'anime');
const POSTERS_DIR = path.join(ANIME_DIR, '.posters');
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
  year?: number;
  startedAt?: string;
  completedAt?: string;
  archivedAt?: string;
  notes?: string;
  watchedEpisodes: string[];
  episodeProgress: Record<string, { seconds: number; duration: number }>;
  bookmarks?: {
    id: string;
    episodeLabel: string;
    seconds: number;
    label: string;
    createdAt: string;
  }[];
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

// In-Memory RAM Caches for 0ms response time
let memoryState: { animes: AnimeEntry[] } | null = null;
const folderScanCache = new Map<string, EpisodeFile[]>();
const syncingIds = new Set<string>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function ensureDirectories() {
  if (!fs.existsSync(ANIME_DIR)) fs.mkdirSync(ANIME_DIR, { recursive: true });
  if (!fs.existsSync(POSTERS_DIR)) fs.mkdirSync(POSTERS_DIR, { recursive: true });
}

function loadState(): { animes: AnimeEntry[] } {
  ensureDirectories();
  if (memoryState) return memoryState;
  try {
    if (fs.existsSync(STATE_FILE)) {
      memoryState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      return memoryState!;
    }
  } catch {
    // Fallback to default
  }
  memoryState = structuredClone(DEFAULT_STATE);
  fs.writeFileSync(STATE_FILE, JSON.stringify(memoryState, null, 2), 'utf-8');
  return memoryState;
}

function saveState(state: { animes: AnimeEntry[] }) {
  memoryState = state;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.promises
      .writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8')
      .then(() => syncMarkdownLedger(state))
      .catch(() => {});
  }, 150);
}

// Download remote image URL directly to local disk (anime/.posters/<id>.jpg)
async function downloadPosterToLocal(
  animeId: string,
  remoteUrl: string,
  forceOverwrite = false
): Promise<string | null> {
  try {
    ensureDirectories();
    const safeFile = `${animeId.replace(/[^a-z0-9-_]/gi, '_')}.jpg`;
    const localPath = path.join(POSTERS_DIR, safeFile);
    if (!forceOverwrite && fs.existsSync(localPath) && fs.statSync(localPath).size > 1000) {
      return `/api/poster/${safeFile}`;
    }
    const res = await fetch(remoteUrl);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return null;
    await fs.promises.writeFile(localPath, buffer);
    return forceOverwrite ? `/api/poster/${safeFile}?v=${Date.now()}` : `/api/poster/${safeFile}`;
  } catch {
    return null;
  }
}

// Automatically fetch MAL metadata & cache poster locally on disk so it works 100% offline forever
async function ensureLocalPosterAndMetadata(
  anime: AnimeEntry,
  state: { animes: AnimeEntry[] },
  forceOverwrite = false
) {
  if (syncingIds.has(anime.id)) return;
  ensureDirectories();
  const safeFile = `${anime.id.replace(/[^a-z0-9-_]/gi, '_')}.jpg`;
  const localPath = path.join(POSTERS_DIR, safeFile);

  // If local poster file already exists on disk and not forcing overwrite, point posterUrl to local endpoint
  if (!forceOverwrite && fs.existsSync(localPath) && fs.statSync(localPath).size > 1000) {
    const localUrl = `/api/poster/${safeFile}`;
    if (!anime.posterUrl || !anime.posterUrl.startsWith('/api/poster/')) {
      anime.posterUrl = localUrl;
      saveState(state);
    }
    return;
  }

  syncingIds.add(anime.id);
  try {
    // Case 1: Anime already has remote http(s) posterUrl -> download it to local disk
    if (anime.posterUrl && /^https?:\/\//i.test(anime.posterUrl)) {
      const localUrl = await downloadPosterToLocal(anime.id, anime.posterUrl, forceOverwrite);
      if (localUrl) {
        anime.posterUrl = localUrl;
        saveState(state);
        return;
      }
    }

    // Case 2: Newly discovered folder or manual entry without metadata/poster
    const query = (anime.folderName || anime.title || '').trim();
    const res = await fetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1&sfw=true`
    );
    if (!res.ok) return;
    const data: any = await res.json();
    const item = data?.data?.[0];
    if (!item) return;

    const canonical = item.title_english || item.title;
    if (anime.title === anime.folderName && canonical) {
      anime.title = canonical;
    }
    anime.malId = anime.malId || item.mal_id;
    anime.score = anime.score || item.score;
    anime.studio = anime.studio || item.studios?.[0]?.name;
    anime.genres = anime.genres?.length
      ? anime.genres
      : item.genres?.map((g: { name: string }) => g.name).slice(0, 4);
    if (!anime.aliases.includes(item.title)) {
      anime.aliases = Array.from(new Set([...anime.aliases, item.title])).slice(0, 4);
    }

    const remoteImg = item.images?.jpg?.large_image_url || item.images?.jpg?.image_url;
    if (remoteImg) {
      const localUrl = await downloadPosterToLocal(anime.id, remoteImg, forceOverwrite);
      anime.posterUrl = localUrl || remoteImg;
    }
    saveState(state);
  } catch {
    // Offline or rate-limited: silently skip until next online session
  } finally {
    syncingIds.delete(anime.id);
  }
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

function parseEpisodeFromFilename(fileName: string): {
  num: number;
  label: string;
} {
  const withoutExt = fileName.replace(/\.(mkv|mp4|avi)$/i, '');
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

function scanAnimeFolder(folderName: string, forceRescan = false): EpisodeFile[] {
  if (!forceRescan && folderScanCache.has(folderName)) {
    return folderScanCache.get(folderName)!;
  }

  const targetDir = path.join(ANIME_DIR, folderName);
  if (!fs.existsSync(targetDir)) {
    folderScanCache.set(folderName, []);
    return [];
  }

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

  results.sort((a, b) => {
    if (a.part !== b.part) {
      return a.part.localeCompare(b.part, undefined, { numeric: true });
    }
    return a.episodeNum - b.episodeNum;
  });

  folderScanCache.set(folderName, results);
  return results;
}

function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isFolderMatchingAnime(folderName: string, anime: AnimeEntry): boolean {
  const fLower = folderName.toLowerCase().trim();
  if (
    anime.folderName?.toLowerCase() === fLower ||
    anime.title.toLowerCase() === fLower ||
    anime.aliases.some((al) => al.toLowerCase() === fLower)
  ) {
    return true;
  }

  // Fuzzy match for anime entries that don't have a linked folder yet
  if (!anime.folderName) {
    const fNorm = normalizeForMatch(folderName);
    if (fNorm.length >= 3) {
      const candidates = [anime.title, ...anime.aliases].map(normalizeForMatch).filter(Boolean);
      if (candidates.some((c) => c.includes(fNorm) || fNorm.includes(c))) {
        return true;
      }
    }
  }
  return false;
}

function autoDiscoverFolders(state: { animes: AnimeEntry[] }, forceRescan = false): boolean {
  ensureDirectories();
  const dirs = fs
    .readdirSync(ANIME_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'));

  let changed = false;
  for (const d of dirs) {
    const existing = state.animes.find((a) => isFolderMatchingAnime(d.name, a));
    const files = scanAnimeFolder(d.name, forceRescan);
    if (!existing) {
      const newEntry: AnimeEntry = {
        id: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: d.name,
        aliases: [d.name],
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
      };
      state.animes.unshift(newEntry);
      changed = true;
    } else {
      if (!existing.folderName) {
        existing.folderName = d.name;
        changed = true;
      }
      // If user previously added this anime as "Plan to Watch" (undownloaded) and now downloaded .mkv files into its folder, auto-promote to "Watching"!
      if (existing.status === 'plan' && files.length > 0) {
        existing.status = 'watching';
        changed = true;
      }
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
    }, 350);
  });
}

function sendMpvCommand(command: any[]): Promise<boolean> {
  return new Promise((resolve) => {
    const client = net.connect(IPC_PIPE, () => {
      const cmd = JSON.stringify({ command }) + '\n';
      client.write(cmd);
      client.end();
      resolve(true);
    });
    client.on('error', () => resolve(false));
    setTimeout(() => {
      client.destroy();
      resolve(false);
    }, 350);
  });
}

function anideckLocalApi(): Plugin {
  return {
    name: 'anideck-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        // GET /api/poster/:filename -> Serve locally cached poster from disk (100% offline!)
        if (req.url.startsWith('/api/poster/') && req.method === 'GET') {
          const rawName = decodeURIComponent(req.url.replace('/api/poster/', '').split('?')[0]);
          const safeName = path.basename(rawName);
          const filePath = path.join(POSTERS_DIR, safeName);
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            fs.createReadStream(filePath).pipe(res);
            return;
          }
          res.statusCode = 404;
          res.end('Poster not found');
          return;
        }

        // GET /api/cached-poster?id=<mal_id>&url=<remote_url> -> Auto-cache recommendation & catalog posters to local SSD!
        if (req.url.startsWith('/api/cached-poster') && req.method === 'GET') {
          ensureDirectories();
          const u = new URL(req.url, 'http://localhost:5177');
          const id = (u.searchParams.get('id') || '0').replace(/[^a-z0-9-_]/gi, '_');
          const remoteUrl = u.searchParams.get('url') || '';
          const safeName = `mal_${id}.jpg`;
          const filePath = path.join(POSTERS_DIR, safeName);

          if (fs.existsSync(filePath) && fs.statSync(filePath).size > 500) {
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            fs.createReadStream(filePath).pipe(res);
            return;
          }

          if (remoteUrl && /^https?:\/\//i.test(remoteUrl)) {
            try {
              const r = await fetch(remoteUrl);
              if (r.ok) {
                const buf = Buffer.from(await r.arrayBuffer());
                if (buf.length > 500) {
                  await fs.promises.writeFile(filePath, buf);
                  res.setHeader('Content-Type', 'image/jpeg');
                  res.setHeader('Cache-Control', 'public, max-age=31536000');
                  res.end(buf);
                  return;
                }
              }
            } catch {
              // Offline fallback
            }
          }
          res.statusCode = 404;
          res.end('Offline poster not cached yet');
          return;
        }

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
        if (req.url.startsWith('/api/library') && req.method === 'GET') {
          const forceRescan = req.url.includes('rescan=1');
          if (forceRescan) folderScanCache.clear();

          const state = loadState();
          if (autoDiscoverFolders(state, forceRescan)) {
            saveState(state);
          }

          // Trigger background local poster & metadata caching for any entry missing local poster
          for (const anime of state.animes) {
            ensureLocalPosterAndMetadata(anime, state);
          }

          const enriched = state.animes.map((anime) => {
            const files = anime.folderName
              ? scanAnimeFolder(anime.folderName, forceRescan)
              : [];
            const totalDiskMB = Math.round(files.reduce((sum, f) => sum + (f.sizeMB || 0), 0));
            return {
              ...anime,
              hasLocalFiles: files.length > 0,
              localFiles: files,
              totalDiskMB,
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
            saveState(loadState());
          });

          child.unref();
          res.end(JSON.stringify({ ok: true, liveMpv }));
          return;
        }

        // POST /api/update-anime
        if (req.url === '/api/update-anime' && req.method === 'POST') {
          const payload = await readBody();
          const { localFiles, hasLocalFiles, forceOverwritePoster, ...cleanPayload } = payload;
          const state = loadState();
          const idx = state.animes.findIndex((a) => a.id === cleanPayload.id);
          let targetEntry: AnimeEntry;
          if (idx !== -1) {
            state.animes[idx] = { ...state.animes[idx], ...cleanPayload };
            targetEntry = state.animes[idx];
          } else {
            state.animes.unshift(cleanPayload);
            targetEntry = cleanPayload;
          }
          // Immediately cache poster to disk if remote URL provided (or overwrite when user changes poster)
          if (targetEntry.posterUrl && /^https?:\/\//i.test(targetEntry.posterUrl)) {
            const localUrl = await downloadPosterToLocal(
              targetEntry.id,
              targetEntry.posterUrl,
              Boolean(forceOverwritePoster)
            );
            if (localUrl) targetEntry.posterUrl = localUrl;
          } else if (!targetEntry.posterUrl) {
            // If user clicked "Simpan Manual" without selecting a poster, auto-fetch closest MAL poster
            await ensureLocalPosterAndMetadata(targetEntry, state, true);
          }
          saveState(state);
          res.end(
            JSON.stringify({
              ok: true,
              posterUrl: targetEntry.posterUrl,
              anime: targetEntry,
            })
          );
          return;
        }

        // POST /api/prepare-folder -> Create clean local folder in anime/ for an undownloaded anime & open Explorer
        if (req.url === '/api/prepare-folder' && req.method === 'POST') {
          const { id, title } = await readBody();
          const safeFolder = String(title || id || 'Anime')
            .replace(/[<>:"/\\|?*]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const targetDir = path.join(ANIME_DIR, safeFolder);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          const state = loadState();
          const anime = state.animes.find((a) => a.id === id);
          if (anime) {
            anime.folderName = safeFolder;
            saveState(state);
          }
          spawn('explorer.exe', [targetDir], { detached: true, stdio: 'ignore' }).unref();
          res.end(JSON.stringify({ ok: true, folderName: safeFolder, opened: targetDir }));
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

        // POST /api/delete-videos -> Steam-style Storage Cleaner: delete .mkv video files while keeping Poster & Watched History 100% intact!
        if (req.url === '/api/delete-videos' && req.method === 'POST') {
          const { id, mode, fullPath, episodeLabel, rating, review } = await readBody();
          const state = loadState();
          const anime = state.animes.find((a) => a.id === id);
          if (!anime) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Anime entry not found' }));
            return;
          }

          let deletedCount = 0;
          let freedMB = 0;
          const files = anime.folderName ? scanAnimeFolder(anime.folderName, true) : [];

          if (mode === 'single' && fullPath) {
            const resolvedTarget = path.resolve(fullPath);
            const resolvedAnimeDir = path.resolve(ANIME_DIR);
            const resolvedPostersDir = path.resolve(POSTERS_DIR);
            if (
              resolvedTarget.startsWith(resolvedAnimeDir) &&
              !resolvedTarget.startsWith(resolvedPostersDir) &&
              fs.existsSync(resolvedTarget)
            ) {
              const stat = fs.statSync(resolvedTarget);
              freedMB = Math.round((stat.size / (1024 * 1024)) * 10) / 10;
              fs.unlinkSync(resolvedTarget);
              deletedCount = 1;
              if (episodeLabel && !anime.watchedEpisodes.includes(episodeLabel)) {
                anime.watchedEpisodes.push(episodeLabel);
              }
            }
          } else if (mode === 'watched_only') {
            const watchedSet = new Set(anime.watchedEpisodes || []);
            for (const f of files) {
              if (watchedSet.has(f.episodeLabel) && fs.existsSync(f.fullPath)) {
                freedMB += f.sizeMB || 0;
                fs.unlinkSync(f.fullPath);
                deletedCount++;
              }
            }
          } else {
            // mode === 'all': Delete all .mkv video files for this anime & archive permanently in Completed (Watched) with Poster intact!
            for (const f of files) {
              if (fs.existsSync(f.fullPath)) {
                freedMB += f.sizeMB || 0;
                fs.unlinkSync(f.fullPath);
                deletedCount++;
              }
            }
            // Remove empty series directory inside anime/ (never touching anime/.posters/)
            if (anime.folderName) {
              const seriesDir = path.resolve(path.join(ANIME_DIR, anime.folderName));
              const resolvedAnimeDir = path.resolve(ANIME_DIR);
              const resolvedPostersDir = path.resolve(POSTERS_DIR);
              if (
                seriesDir.startsWith(resolvedAnimeDir) &&
                seriesDir !== resolvedAnimeDir &&
                !seriesDir.startsWith(resolvedPostersDir) &&
                fs.existsSync(seriesDir)
              ) {
                try {
                  fs.rmSync(seriesDir, { recursive: true, force: true });
                } catch {
                  // Ignore if locked
                }
              }
            }

            const today = new Date().toISOString().slice(0, 10);
            const totalEps = Math.max(anime.totalEpisodes || 0, files.length || 12);
            const allLabels =
              files.length > 0
                ? files.map((f) => f.episodeLabel)
                : Array.from({ length: totalEps }, (_, i) => String(i + 1).padStart(2, '0'));

            anime.status = 'completed';
            anime.totalEpisodes = totalEps;
            anime.currentEpisode = totalEps;
            anime.currentEpisodeLabel = allLabels[allLabels.length - 1] || String(totalEps).padStart(2, '0');
            anime.currentSeconds = anime.durationSeconds || 1420;
            anime.watchedEpisodes = Array.from(new Set([...(anime.watchedEpisodes || []), ...allLabels]));
            anime.completedAt = anime.completedAt || today;
            anime.archivedAt = today;
            if (typeof rating === 'number') anime.personalRating = rating;
            if (typeof review === 'string' && review.trim()) anime.notes = review.trim();
          }

          folderScanCache.clear();
          saveState(state);
          res.end(
            JSON.stringify({
              ok: true,
              deletedCount,
              freedMB: Math.round(freedMB),
              anime,
            })
          );
          return;
        }

        // POST /api/mpv-command -> Live MPV Remote Control via Named Pipe IPC
        if (req.url === '/api/mpv-command' && req.method === 'POST') {
          const { command } = await readBody();
          if (Array.isArray(command)) {
            const ok = await sendMpvCommand(command);
            res.end(JSON.stringify({ ok }));
            return;
          }
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid MPV command array' }));
          return;
        }

        // POST /api/import-backup -> Restore or merge portable JSON backup
        if (req.url === '/api/import-backup' && req.method === 'POST') {
          const { animes: importedAnimes } = await readBody();
          if (!Array.isArray(importedAnimes)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid backup format' }));
            return;
          }
          const state = loadState();
          const byId = new Map(state.animes.map((a) => [a.id, a]));
          for (const item of importedAnimes) {
            if (item && item.id && item.title) {
              const { localFiles, hasLocalFiles, totalDiskMB, ...clean } = item;
              byId.set(clean.id, { ...(byId.get(clean.id) || {}), ...clean });
            }
          }
          state.animes = Array.from(byId.values());
          saveState(state);
          res.end(JSON.stringify({ ok: true, count: state.animes.length }));
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
  optimizeDeps: {
    include: ['lucide-react', 'canvas-confetti'],
  },
  server: {
    port: 5177,
    strictPort: true,
    watch: {
      ignored: ['**/anime/**', '**/.watch_later/**', '**/anideck-state.json', '**/DOKUMENTASI.md'],
    },
  },
});
