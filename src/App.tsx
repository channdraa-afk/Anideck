import React, { useEffect, useState, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Play,
  Pause,
  FastForward,
  Rewind,
  CheckCircle2,
  Clock,
  FolderOpen,
  Plus,
  Search,
  Star,
  Film,
  Tv,
  Sparkles,
  Trash2,
  RefreshCw,
  Check,
  X,
  Trophy,
  Bookmark,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCheck,
  ArrowLeft,
  HardDrive,
  Archive,
  Download,
  Upload,
  Minus,
} from 'lucide-react';
import { TactileButton } from './components/TactileButton';
import type {
  AnimeEntry,
  EpisodeFile,
  LiveMpvState,
  JikanAnimeItem,
  SceneBookmark,
} from './types/anime';

function formatTime(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 0) return '00:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDiskSize(sizeMB?: number): string {
  if (!sizeMB || sizeMB <= 0) return '0 MB';
  if (sizeMB >= 1024) {
    return `${(sizeMB / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(sizeMB)} MB`;
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Deduplicate Jikan search results so split parts (Part 2, Cour 2, OVA) don't clutter search
function deduplicateJikanParts(items: JikanAnimeItem[]): JikanAnimeItem[] {
  const seenBase = new Set<string>();
  const clean: JikanAnimeItem[] = [];

  for (const item of items) {
    const title = item.title_english || item.title || '';
    const baseKey = title
      .toLowerCase()
      .replace(/part\s*\d+|cour\s*\d+|2nd\s*season|3rd\s*season|season\s*\d+|ova|special/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 16);

    if (!baseKey || seenBase.has(baseKey)) continue;
    seenBase.add(baseKey);
    clean.push(item);
  }
  return clean;
}

export function App() {
  const [animes, setAnimes] = useState<AnimeEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'watching' | 'completed' | 'plan' | 'on_hold'>(
    'all'
  );
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent' | 'score' | 'title' | 'disk'>('recent');

  const [liveMpv, setLiveMpv] = useState<LiveMpvState>({
    active: false,
    animeId: null,
    episodeLabel: null,
    fileName: null,
    seconds: 0,
    duration: 1420,
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Manual MM:SS quick editor state
  const [editMin, setEditMin] = useState<string>('0');
  const [editSec, setEditSec] = useState<string>('0');

  // Scene Bookmark state
  const [bookmarkNote, setBookmarkNote] = useState<string>('');

  // Minimalist Add / Rematch Poster Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [rematchingAnime, setRematchingAnime] = useState<AnimeEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [jikanResults, setJikanResults] = useState<JikanAnimeItem[]>([]);
  const [searchingMal, setSearchingMal] = useState(false);
  const [newStatus, setNewStatus] = useState<'watching' | 'completed' | 'plan'>('plan');
  const [newEp, setNewEp] = useState<number>(1);
  const [newMin, setNewMin] = useState<number>(0);
  const [newRating, setNewRating] = useState<number>(9);
  const [newNotes, setNewNotes] = useState<string>('');

  // Mark Completed Modal state
  const [completingAnime, setCompletingAnime] = useState<AnimeEntry | null>(null);
  const [completeRating, setCompleteRating] = useState<number>(9);
  const [completeReview, setCompleteReview] = useState<string>('');
  const [deleteFilesOnComplete, setDeleteFilesOnComplete] = useState<boolean>(false);

  // Custom Delete / Move-to-Watched Modal state (ZERO window.confirm!)
  const [deletingTarget, setDeletingTarget] = useState<AnimeEntry | null>(null);
  const [deletingEpisode, setDeletingEpisode] = useState<{
    anime: AnimeEntry;
    file: EpisodeFile;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileImportRef = useRef<HTMLInputElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const fetchLibrary = async (rescan = false) => {
    try {
      const res = await fetch(rescan ? '/api/library?rescan=1' : '/api/library');
      const data = await res.json();
      const list: AnimeEntry[] = data.animes || [];
      setAnimes(list);
      if (data.liveMpv) setLiveMpv(data.liveMpv);
    } catch (e) {
      console.error('Failed to fetch Anideck library:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  // Keyboard shortcuts: '/' or 'Ctrl+K'
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowAddModal(true);
      } else if (e.key === '/' && !isInput && !showAddModal && !selectedId) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setShowAddModal(false);
        setRematchingAnime(null);
        setCompletingAnime(null);
        setDeletingTarget(null);
        setDeletingEpisode(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAddModal, selectedId]);

  // Poll live MPV status ONLY while MPV is actively playing
  useEffect(() => {
    if (!liveMpv.active) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/mpv-status');
        const status: LiveMpvState = await res.json();
        setLiveMpv(status);
        if (status.active && status.animeId && status.episodeLabel) {
          setAnimes((prev) =>
            prev.map((a) => {
              if (a.id !== status.animeId) return a;
              const updatedWatched =
                status.duration > 60 &&
                status.seconds / status.duration >= 0.85 &&
                !a.watchedEpisodes.includes(status.episodeLabel!)
                  ? [...a.watchedEpisodes, status.episodeLabel!]
                  : a.watchedEpisodes;
              return {
                ...a,
                currentEpisodeLabel: status.episodeLabel!,
                currentSeconds: status.seconds,
                durationSeconds: status.duration,
                watchedEpisodes: updatedWatched,
                episodeProgress: {
                  ...a.episodeProgress,
                  [status.episodeLabel!]: {
                    seconds: status.seconds,
                    duration: status.duration,
                  },
                },
              };
            })
          );
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [liveMpv.active]);

  const selectedAnime = useMemo(
    () => animes.find((a) => a.id === selectedId) || null,
    [animes, selectedId]
  );

  useEffect(() => {
    if (selectedAnime) {
      setEditMin(String(Math.floor((selectedAnime.currentSeconds || 0) / 60)));
      setEditSec(String(Math.floor((selectedAnime.currentSeconds || 0) % 60)));
    }
  }, [selectedAnime?.id, selectedAnime?.currentEpisodeLabel, selectedAnime?.currentSeconds]);

  // All episodes unified in a single continuous sequence (not split into pages per part!)
  const unifiedEpisodes = useMemo(() => {
    if (!selectedAnime?.localFiles) return [];
    return selectedAnime.localFiles;
  }, [selectedAnime]);

  const saveAnimeUpdate = async (
    updated: AnimeEntry,
    silent = false,
    forceOverwritePoster = false
  ) => {
    setAnimes((prev) => {
      const exists = prev.some((a) => a.id === updated.id);
      return exists
        ? prev.map((a) => (a.id === updated.id ? updated : a))
        : [updated, ...prev];
    });
    try {
      const res = await fetch('/api/update-anime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updated, forceOverwritePoster }),
      });
      const data = await res.json();
      if (data?.posterUrl && data.posterUrl !== updated.posterUrl) {
        setAnimes((prev) =>
          prev.map((a) => (a.id === updated.id ? { ...a, posterUrl: data.posterUrl } : a))
        );
      }
      if (!silent) {
        showNotice(
          `Saved "${updated.title}" — Ep ${updated.currentEpisodeLabel} (${formatTime(updated.currentSeconds)})`
        );
      }
    } catch (e) {
      console.error('Failed to save update:', e);
    }
  };

  const handleSendMpvCommand = async (command: any[], feedback?: string) => {
    try {
      await fetch('/api/mpv-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      if (feedback) showNotice(feedback);
    } catch {
      // Ignore
    }
  };

  const getSmartNextEpisode = (anime: AnimeEntry) => {
    const dur = anime.durationSeconds || 1420;
    const isCurrentNearlyDone =
      (dur > 60 && anime.currentSeconds / dur >= 0.85) ||
      anime.watchedEpisodes.includes(anime.currentEpisodeLabel);

    if (!isCurrentNearlyDone) return null;

    if (anime.localFiles && anime.localFiles.length > 0) {
      const idx = anime.localFiles.findIndex((f) => f.episodeLabel === anime.currentEpisodeLabel);
      if (idx !== -1 && idx + 1 < anime.localFiles.length) {
        const nextFile = anime.localFiles[idx + 1];
        return {
          episodeNum: nextFile.episodeNum,
          episodeLabel: nextFile.episodeLabel,
          file: nextFile,
        };
      }
    }
    return null;
  };

  const handlePlayMpv = async (
    anime: AnimeEntry,
    epFile?: EpisodeFile,
    customStartSeconds?: number
  ) => {
    const targetFile =
      epFile ||
      anime.localFiles?.find((f) => f.episodeLabel === anime.currentEpisodeLabel) ||
      anime.localFiles?.[0];

    if (!targetFile) {
      showNotice('No local .mkv file found in anime/ folder for this series.');
      return;
    }

    const savedEpSec = anime.episodeProgress?.[targetFile.episodeLabel]?.seconds;
    const startSeconds =
      typeof customStartSeconds === 'number'
        ? customStartSeconds
        : targetFile.episodeLabel === anime.currentEpisodeLabel
          ? anime.currentSeconds
          : savedEpSec || 0;

    try {
      const res = await fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animeId: anime.id,
          episodeLabel: targetFile.episodeLabel,
          fullPath: targetFile.fullPath,
          startSeconds,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setLiveMpv(data.liveMpv);
        showNotice(
          `Playing in MPV: ${anime.title} — Ep ${targetFile.episodeLabel} (${formatTime(startSeconds)})`
        );
        setAnimes((prev) =>
          prev.map((a) =>
            a.id === anime.id
              ? {
                  ...a,
                  status: a.status === 'plan' ? 'watching' : a.status,
                  currentEpisode: targetFile.episodeNum,
                  currentEpisodeLabel: targetFile.episodeLabel,
                  currentSeconds: startSeconds,
                }
              : a
          )
        );
      } else {
        showNotice(data.error || 'Failed to launch MPV.');
      }
    } catch {
      showNotice('Failed to contact local MPV launcher.');
    }
  };

  const handleManualTimeSave = () => {
    if (!selectedAnime) return;
    const m = Math.max(0, parseInt(editMin || '0', 10));
    const s = Math.max(0, Math.min(59, parseInt(editSec || '0', 10)));
    const totalSec = m * 60 + s;
    const updated: AnimeEntry = {
      ...selectedAnime,
      currentSeconds: totalSec,
      episodeProgress: {
        ...selectedAnime.episodeProgress,
        [selectedAnime.currentEpisodeLabel]: {
          seconds: totalSec,
          duration: selectedAnime.durationSeconds || 1420,
        },
      },
    };
    saveAnimeUpdate(updated);
  };

  // Custom Interactive Timeline Scrubber (Replaces ugly native <input type="range">)
  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedAnime || !scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur = selectedAnime.durationSeconds || 1420;
    const newSec = Math.round(ratio * dur);

    const updated: AnimeEntry = {
      ...selectedAnime,
      currentSeconds: newSec,
      episodeProgress: {
        ...selectedAnime.episodeProgress,
        [selectedAnime.currentEpisodeLabel]: {
          seconds: newSec,
          duration: dur,
        },
      },
    };
    saveAnimeUpdate(updated);
  };

  const handleAddBookmark = () => {
    if (!selectedAnime) return;
    const labelText =
      bookmarkNote.trim() || `Saved Scene (Ep ${selectedAnime.currentEpisodeLabel})`;
    const newBm: SceneBookmark = {
      id: `bm-${Date.now()}`,
      episodeLabel: selectedAnime.currentEpisodeLabel,
      seconds: selectedAnime.currentSeconds || 0,
      label: labelText,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const updated: AnimeEntry = {
      ...selectedAnime,
      bookmarks: [newBm, ...(selectedAnime.bookmarks || [])],
    };
    setBookmarkNote('');
    saveAnimeUpdate(updated, true);
    showNotice(
      `Bookmarked Ep ${newBm.episodeLabel} at ${formatTime(newBm.seconds)} — "${newBm.label}"`
    );
  };

  const handleDeleteBookmark = (bmId: string) => {
    if (!selectedAnime) return;
    const updated: AnimeEntry = {
      ...selectedAnime,
      bookmarks: (selectedAnime.bookmarks || []).filter((b) => b.id !== bmId),
    };
    saveAnimeUpdate(updated, true);
  };

  const handleQuickIncrementEpisode = (anime: AnimeEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const files = anime.localFiles || [];
    const prevEpLabel = anime.currentEpisodeLabel;
    const updatedWatched = anime.watchedEpisodes.includes(prevEpLabel)
      ? anime.watchedEpisodes
      : [...anime.watchedEpisodes, prevEpLabel];

    if (files.length > 0) {
      const idx = files.findIndex((f) => f.episodeLabel === anime.currentEpisodeLabel);
      const nextIdx = Math.min(files.length - 1, Math.max(0, idx + 1));
      const target = files[nextIdx];
      const savedSec = anime.episodeProgress?.[target.episodeLabel]?.seconds || 0;
      saveAnimeUpdate({
        ...anime,
        status: anime.status === 'plan' ? 'watching' : anime.status,
        currentEpisode: target.episodeNum,
        currentEpisodeLabel: target.episodeLabel,
        currentSeconds: savedSec,
        watchedEpisodes: updatedWatched,
      });
    } else {
      const nextEp = Math.min(anime.totalEpisodes || 999, Math.floor(anime.currentEpisode + 1));
      const nextLabel = String(nextEp).padStart(2, '0');
      saveAnimeUpdate({
        ...anime,
        status: anime.status === 'plan' ? 'watching' : anime.status,
        currentEpisode: nextEp,
        currentEpisodeLabel: nextLabel,
        currentSeconds: 0,
        watchedEpisodes: updatedWatched,
      });
    }
  };

  const handleStepEpisode = (delta: number) => {
    if (!selectedAnime) return;
    const files = selectedAnime.localFiles || [];
    const prevEpLabel = selectedAnime.currentEpisodeLabel;
    const updatedWatched =
      delta > 0 && !selectedAnime.watchedEpisodes.includes(prevEpLabel)
        ? [...selectedAnime.watchedEpisodes, prevEpLabel]
        : selectedAnime.watchedEpisodes;

    if (files.length > 0) {
      const idx = files.findIndex((f) => f.episodeLabel === selectedAnime.currentEpisodeLabel);
      const nextIdx = Math.max(0, Math.min(files.length - 1, (idx === -1 ? 0 : idx) + delta));
      const target = files[nextIdx];
      const savedSec = selectedAnime.episodeProgress?.[target.episodeLabel]?.seconds || 0;
      saveAnimeUpdate({
        ...selectedAnime,
        status: selectedAnime.status === 'plan' ? 'watching' : selectedAnime.status,
        currentEpisode: target.episodeNum,
        currentEpisodeLabel: target.episodeLabel,
        currentSeconds: savedSec,
        watchedEpisodes: updatedWatched,
      });
    } else {
      const nextEp = Math.max(
        1,
        Math.min(selectedAnime.totalEpisodes || 999, Math.floor(selectedAnime.currentEpisode + delta))
      );
      const nextLabel = String(nextEp).padStart(2, '0');
      saveAnimeUpdate({
        ...selectedAnime,
        status: selectedAnime.status === 'plan' ? 'watching' : selectedAnime.status,
        currentEpisode: nextEp,
        currentEpisodeLabel: nextLabel,
        currentSeconds: 0,
        watchedEpisodes: updatedWatched,
      });
    }
  };

  const toggleWatchedEpisode = (epLabel: string) => {
    if (!selectedAnime) return;
    const exists = selectedAnime.watchedEpisodes.includes(epLabel);
    const updatedWatched = exists
      ? selectedAnime.watchedEpisodes.filter((e) => e !== epLabel)
      : [...selectedAnime.watchedEpisodes, epLabel];

    saveAnimeUpdate(
      {
        ...selectedAnime,
        watchedEpisodes: updatedWatched,
      },
      true
    );
  };

  const markWatchedUpTo = (targetFile: EpisodeFile) => {
    if (!selectedAnime || !selectedAnime.localFiles) return;
    const targetIdx = selectedAnime.localFiles.findIndex((f) => f.id === targetFile.id);
    if (targetIdx === -1) return;

    const labelsUpTo = selectedAnime.localFiles
      .slice(0, targetIdx + 1)
      .map((f) => f.episodeLabel);
    const merged = Array.from(new Set([...selectedAnime.watchedEpisodes, ...labelsUpTo]));
    const nextFile = selectedAnime.localFiles[targetIdx + 1] || targetFile;
    const savedNextSec = selectedAnime.episodeProgress?.[nextFile.episodeLabel]?.seconds || 0;

    saveAnimeUpdate({
      ...selectedAnime,
      currentEpisode: nextFile.episodeNum,
      currentEpisodeLabel: nextFile.episodeLabel,
      currentSeconds: nextFile.id === targetFile.id ? selectedAnime.currentSeconds : savedNextSec,
      watchedEpisodes: merged,
    });
  };

  // Archive to Watched & Clean .MKV Videos (Poster & History 100% Preserved!)
  const handleArchiveAndCleanVideos = async (
    anime: AnimeEntry,
    mode: 'all' | 'watched_only' | 'single',
    epFile?: EpisodeFile,
    ratingOverride?: number,
    reviewOverride?: string
  ) => {
    try {
      const res = await fetch('/api/delete-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: anime.id,
          mode,
          fullPath: epFile?.fullPath,
          episodeLabel: epFile?.episodeLabel,
          rating: ratingOverride,
          review: reviewOverride,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchLibrary(true);
        if (mode === 'all') {
          showNotice(
            data.freedMB > 0
              ? `Moved "${anime.title}" to Watched & freed ${formatDiskSize(data.freedMB)} (Poster kept!)`
              : `Moved "${anime.title}" to Watched (Poster & record kept!)`
          );
        } else if (mode === 'watched_only') {
          showNotice(
            `Cleaned ${data.deletedCount} watched episodes — Freed ${formatDiskSize(data.freedMB)}`
          );
        } else {
          showNotice(
            `Deleted Ep ${epFile?.episodeLabel} video file — Freed ${formatDiskSize(data.freedMB)}`
          );
        }
      }
    } catch {
      showNotice('Failed to process archive action.');
    } finally {
      setDeletingTarget(null);
      setDeletingEpisode(null);
    }
  };

  // Permanent Card Removal (Only when user explicitly chooses Permanent Remove inside our custom modal)
  const handleConfirmPermanentDelete = async (anime: AnimeEntry) => {
    await fetch('/api/delete-anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: anime.id }),
    });
    if (selectedId === anime.id) {
      setSelectedId(null);
    }
    setDeletingTarget(null);
    fetchLibrary();
    showNotice(`Permanently removed "${anime.title}".`);
  };

  const handleConfirmComplete = async () => {
    if (!completingAnime) return;
    confetti({
      particleCount: 70,
      spread: 65,
      origin: { y: 0.6 },
    });

    if (deleteFilesOnComplete && completingAnime.hasLocalFiles) {
      await handleArchiveAndCleanVideos(
        completingAnime,
        'all',
        undefined,
        completeRating,
        completeReview
      );
      setCompletingAnime(null);
      setDeleteFilesOnComplete(false);
      return;
    }

    const allLabels =
      completingAnime.localFiles?.map((f) => f.episodeLabel) ||
      Array.from({ length: completingAnime.totalEpisodes || 12 }, (_, i) =>
        String(i + 1).padStart(2, '0')
      );

    const updated: AnimeEntry = {
      ...completingAnime,
      status: 'completed',
      personalRating: completeRating,
      notes: completeReview || completingAnime.notes,
      completedAt: new Date().toISOString().slice(0, 10),
      watchedEpisodes: Array.from(new Set([...completingAnime.watchedEpisodes, ...allLabels])),
    };

    await saveAnimeUpdate(updated);
    setCompletingAnime(null);
    setDeleteFilesOnComplete(false);
  };

  const handleOpenExplorer = async (folderName?: string) => {
    await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderName }),
    });
  };

  const handlePrepareFolder = async (anime: AnimeEntry) => {
    try {
      const res = await fetch('/api/prepare-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: anime.id, title: anime.title }),
      });
      const data = await res.json();
      if (data.ok) {
        setAnimes((prev) =>
          prev.map((a) => (a.id === anime.id ? { ...a, folderName: data.folderName } : a))
        );
        showNotice(`Folder "anime/${data.folderName}" ready — Drop .mkv files & click Sync`);
      }
    } catch {
      showNotice('Failed to prepare folder.');
    }
  };

  // Portable JSON Backup Export & Import
  const handleExportBackup = () => {
    const cleanExport = {
      exportedAt: new Date().toISOString(),
      version: '2.0',
      animes: animes.map(({ localFiles, hasLocalFiles, totalDiskMB, ...rest }) => rest),
    };
    const blob = new Blob([JSON.stringify(cleanExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anideck-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Exported Anideck backup (.json).');
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed.animes;
      if (!Array.isArray(list)) {
        showNotice('Invalid backup JSON file.');
        return;
      }
      const res = await fetch('/api/import-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animes: list }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchLibrary(true);
        showNotice(`Restored ${data.count} anime records.`);
      }
    } catch {
      showNotice('Failed to read backup file.');
    } finally {
      e.target.value = '';
    }
  };

  const checkDuplicate = (candidateTitle: string, malId?: number): AnimeEntry | undefined => {
    const norm = normalizeTitle(candidateTitle);
    return animes.find((a) => {
      if (malId && a.malId === malId) return true;
      if (normalizeTitle(a.title) === norm) return true;
      return a.aliases?.some((al) => normalizeTitle(al) === norm);
    });
  };

  const runMalSearch = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      setJikanResults([]);
      return;
    }
    setSearchingMal(true);
    try {
      const res = await fetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(trimmed)}&limit=10&sfw=true`
      );
      if (res.ok) {
        const data = await res.json();
        const rawList: JikanAnimeItem[] = data.data || [];
        setJikanResults(deduplicateJikanParts(rawList).slice(0, 6));
      }
    } catch {
      setJikanResults([]);
    } finally {
      setSearchingMal(false);
    }
  };

  const handleSearchMal = async (e: React.FormEvent) => {
    e.preventDefault();
    await runMalSearch(searchQuery);
  };

  useEffect(() => {
    if (!showAddModal && !rematchingAnime) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setJikanResults([]);
      return;
    }
    const timer = setTimeout(() => {
      runMalSearch(trimmed);
    }, 380);
    return () => clearTimeout(timer);
  }, [searchQuery, showAddModal, rematchingAnime]);

  const handleRematchPosterFromJikan = async (item: JikanAnimeItem) => {
    if (!rematchingAnime) return;
    const canonicalTitle = item.title_english || item.title;
    const remotePoster = item.images?.jpg?.large_image_url || item.images?.jpg?.image_url;
    const updated: AnimeEntry = {
      ...rematchingAnime,
      title: rematchingAnime.title,
      aliases: Array.from(
        new Set([
          ...(rematchingAnime.aliases || []),
          canonicalTitle,
          item.title,
          ...(item.title_synonyms || []),
        ])
      ).slice(0, 6),
      malId: item.mal_id,
      posterUrl: remotePoster,
      score: item.score || rematchingAnime.score,
      year: item.year || rematchingAnime.year,
      studio: item.studios?.[0]?.name || rematchingAnime.studio,
      genres: item.genres?.map((g) => g.name).slice(0, 4) || rematchingAnime.genres,
      totalEpisodes: rematchingAnime.hasLocalFiles
        ? rematchingAnime.totalEpisodes
        : item.episodes || rematchingAnime.totalEpisodes,
    };

    await saveAnimeUpdate(updated, true, true);
    showNotice(`Updated poster for "${rematchingAnime.title}"`);
    setRematchingAnime(null);
    setSearchQuery('');
    setJikanResults([]);
  };

  const handleAddFromJikan = async (
    item: JikanAnimeItem,
    overrideStatus?: 'watching' | 'completed' | 'plan'
  ) => {
    if (rematchingAnime) {
      await handleRematchPosterFromJikan(item);
      return;
    }
    const canonicalTitle = item.title_english || item.title;
    const dup = checkDuplicate(canonicalTitle, item.mal_id);
    if (dup) {
      showNotice(`"${dup.title}" is already in your library.`);
      setSelectedId(dup.id);
      setShowAddModal(false);
      return;
    }

    const targetStatus = overrideStatus || newStatus;
    const totalEps = item.episodes || 12;
    const epLabel = String(targetStatus === 'completed' ? totalEps : newEp).padStart(2, '0');
    const entry: AnimeEntry = {
      id: `${item.mal_id}-${canonicalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: canonicalTitle,
      aliases: Array.from(new Set([item.title, ...(item.title_synonyms || [])])).slice(0, 4),
      status: targetStatus,
      currentEpisode: targetStatus === 'completed' ? totalEps : newEp,
      currentEpisodeLabel: epLabel,
      currentSeconds: targetStatus === 'watching' ? newMin * 60 : 0,
      durationSeconds: 1420,
      totalEpisodes: totalEps,
      malId: item.mal_id,
      posterUrl: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url,
      score: item.score,
      year: item.year,
      personalRating: targetStatus === 'completed' ? newRating : undefined,
      studio: item.studios?.[0]?.name,
      genres: item.genres?.map((g) => g.name).slice(0, 4),
      startedAt: new Date().toISOString().slice(0, 10),
      completedAt: targetStatus === 'completed' ? new Date().toISOString().slice(0, 10) : undefined,
      notes: newNotes,
      watchedEpisodes:
        targetStatus === 'completed'
          ? Array.from({ length: totalEps }, (_, i) => String(i + 1).padStart(2, '0'))
          : [],
      episodeProgress: {},
    };

    await saveAnimeUpdate(entry, Boolean(overrideStatus));
    setShowAddModal(false);
    setSearchQuery('');
    setJikanResults([]);
  };

  const handleAddManual = async () => {
    if (!searchQuery.trim()) return;
    const dup = checkDuplicate(searchQuery.trim());
    if (dup) {
      showNotice(`"${dup.title}" is already in your library.`);
      return;
    }
    const title = searchQuery.trim();
    const entry: AnimeEntry = {
      id: `manual-${Date.now()}`,
      title,
      aliases: [],
      status: newStatus,
      currentEpisode: newEp,
      currentEpisodeLabel: String(newEp).padStart(2, '0'),
      currentSeconds: newMin * 60,
      durationSeconds: 1420,
      totalEpisodes: 12,
      personalRating: newStatus === 'completed' ? newRating : undefined,
      startedAt: new Date().toISOString().slice(0, 10),
      completedAt: newStatus === 'completed' ? new Date().toISOString().slice(0, 10) : undefined,
      notes: newNotes,
      watchedEpisodes: [],
      episodeProgress: {},
    };
    await saveAnimeUpdate(entry);
    setShowAddModal(false);
    setSearchQuery('');
  };

  const watchingAnimes = useMemo(
    () => animes.filter((a) => a.status === 'watching'),
    [animes]
  );

  const heroAnime = useMemo(
    () => watchingAnimes[0] || animes[0] || null,
    [watchingAnimes, animes]
  );

  const collectorStats = useMemo(() => {
    let totalWatchedEps = 0;
    let totalDiskMB = 0;
    let totalFiles = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    for (const a of animes) {
      const epsDone =
        a.status === 'completed'
          ? Math.max(a.totalEpisodes || 0, a.watchedEpisodes.length)
          : a.watchedEpisodes.length;
      totalWatchedEps += epsDone;
      totalDiskMB += a.totalDiskMB || 0;
      totalFiles += a.localFiles?.length || 0;
      const r = a.personalRating || a.score;
      if (r) {
        ratingSum += r;
        ratingCount++;
      }
    }

    const hoursWatched = Math.round(((totalWatchedEps * 24) / 60) * 10) / 10;
    const avgScore = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : '-';

    return {
      totalWatchedEps,
      hoursWatched,
      avgScore,
      totalDiskMB,
      totalFiles,
    };
  }, [animes]);

  const tabCounts = useMemo(
    () => ({
      all: animes.length,
      watching: animes.filter((a) => a.status === 'watching').length,
      completed: animes.filter((a) => a.status === 'completed').length,
      plan: animes.filter((a) => a.status === 'plan').length,
      on_hold: animes.filter((a) => a.status === 'on_hold').length,
    }),
    [animes]
  );

  const filteredAnimes = useMemo(() => {
    let list = activeTab === 'all' ? [...animes] : animes.filter((a) => a.status === activeTab);

    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.aliases?.some((al) => al.toLowerCase().includes(q)) ||
          a.studio?.toLowerCase().includes(q) ||
          a.genres?.some((g) => g.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'score') {
        return (b.personalRating || b.score || 0) - (a.personalRating || a.score || 0);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'disk') {
        return (b.totalDiskMB || 0) - (a.totalDiskMB || 0);
      }
      return 0;
    });

    return list;
  }, [animes, activeTab, catalogSearch, sortBy]);

  const progressPct = useMemo(() => {
    if (!selectedAnime) return 0;
    const dur = selectedAnime.durationSeconds || 1420;
    return Math.min(100, Math.round((selectedAnime.currentSeconds / dur) * 100));
  }, [selectedAnime]);

  return (
    <div className="min-h-screen bg-[#F5F3EE] text-[#1C1917] pb-24 selection:bg-[#E07A5F] selection:text-white">
      {/* Hidden File Input for Portable JSON Backup Restore */}
      <input
        ref={fileImportRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportBackup}
      />

      {/* Spring-Animated Toast Notification */}
      {toast && (
        <div className="animate-modal-pop fixed bottom-6 right-6 z-50 bg-[#1C1917] text-[#FAF8F5] px-5 py-3.5 rounded-2xl border border-[#E07A5F]/40 shadow-[0_16px_40px_rgba(28,25,23,0.28)] flex items-center gap-3 font-extrabold text-xs sm:text-sm">
          <Sparkles className="w-4 h-4 text-[#E07A5F] shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* MINIMALIST WARM STUDIO HEADER */}
      <header className="sticky top-0 z-30 bg-[#F5F3EE]/90 backdrop-blur-md border-b border-[#E5E0D8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-3 cursor-pointer group text-left"
              title="Back to Library"
            >
              <img
                src="/icon.png"
                alt="Anideck"
                className="w-9 h-9 rounded-xl shadow-sm group-hover:scale-105 transition-transform duration-200 object-contain"
              />
              <div>
                <span className="text-lg font-black tracking-tight text-[#1C1917]">
                  Anideck
                </span>
                <p className="text-[11px] font-bold text-[#78716C]">
                  Personal Anime &amp; MPV Companion
                </p>
              </div>
            </button>

            {selectedId && (
              <TactileButton
                variant="white"
                size="sm"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#E07A5F]" />
                <span>Library</span>
              </TactileButton>
            )}
          </div>

          {/* LIVE MPV REMOTE CONTROL PILL */}
          {liveMpv.active && (
            <div className="animate-modal-pop flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-[#1C1917] text-[#FAF8F5] shadow-md">
              <span className="w-2 h-2 rounded-full bg-[#2A9D8F] animate-ping" />
              <span className="text-xs font-black tracking-wide tabular-nums mr-1">
                MPV • Ep {liveMpv.episodeLabel} • {formatTime(liveMpv.seconds)}
              </span>

              <div className="flex items-center gap-1 border-l border-white/15 pl-2">
                <button
                  onClick={() => handleSendMpvCommand(['seek', -10, 'relative'], 'Rewind -10s')}
                  className="p-1 rounded-lg hover:bg-white/10 text-[#FAF8F5] cursor-pointer"
                  title="Rewind 10s"
                >
                  <Rewind className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleSendMpvCommand(['cycle', 'pause'], 'Toggled Pause/Play')}
                  className="p-1 rounded-lg hover:bg-white/10 text-[#FAF8F5] cursor-pointer"
                  title="Pause / Resume"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    handleSendMpvCommand(['seek', 85, 'relative'], 'Skipped Opening (+85s)')
                  }
                  className="px-2 py-0.5 rounded-lg bg-[#E07A5F] text-white text-[10px] font-black cursor-pointer flex items-center gap-1"
                  title="Skip Opening (+85s)"
                >
                  <FastForward className="w-3 h-3" />
                  <span>Skip OP</span>
                </button>
              </div>
            </div>
          )}

          {/* RIGHT ACTION TOOLBAR */}
          <div className="flex items-center gap-2">
            <TactileButton
              variant="white"
              size="sm"
              onClick={() => handleOpenExplorer()}
              title="Open local anime/ folder in Windows Explorer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#E07A5F]" />
              <span className="hidden sm:inline">Folder</span>
            </TactileButton>

            <TactileButton
              variant="white"
              size="sm"
              onClick={() => {
                fetchLibrary(true);
                showNotice('Synced anime/ folder & local posters.');
              }}
              title="Sync newly added folders in anime/"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#2A9D8F]" />
              <span>Sync</span>
            </TactileButton>

            <TactileButton
              variant="amber"
              size="sm"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Anime</span>
            </TactileButton>
          </div>
        </div>
      </header>

      {/* =====================================================================
          SCREEN 1: MINIMALIST HOME LIBRARY (WARM STONE CANVAS + ESPRESSO HERO)
         ===================================================================== */}
      {!selectedAnime ? (
        <main
          key="home-screen"
          className="animate-page-enter max-w-6xl mx-auto px-4 sm:px-6 pt-7 space-y-9"
        >
          {/* 1. CONTRASTING WARM ESPRESSO SPOTLIGHT STAGE ("NOW WATCHING") */}
          {heroAnime && (
            <section className="rounded-3xl bg-[#1C1917] text-[#FAF8F5] shadow-[0_20px_50px_-12px_rgba(28,25,23,0.25)] p-6 sm:p-8 transition-transform duration-300">
              <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                {/* 2:3 Poster Frame */}
                <div
                  onClick={() => setSelectedId(heroAnime.id)}
                  className="poster-card-spring relative w-36 sm:w-44 aspect-[2/3] rounded-2xl overflow-hidden bg-[#292524] ring-1 ring-white/15 shadow-xl shrink-0 cursor-pointer group"
                >
                  {heroAnime.posterUrl ? (
                    <img
                      src={heroAnime.posterUrl}
                      alt={heroAnime.title}
                      className="poster-img-zoom w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-10 h-10 text-stone-500" />
                    </div>
                  )}
                </div>

                {/* Spotlight Copy & Progress */}
                <div className="flex-1 min-w-0 space-y-4 text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E07A5F]/20 text-[#F4A261] text-[11px] font-black uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E07A5F]" />
                      {heroAnime.status === 'watching' ? 'Now Watching' : 'Featured Series'}
                    </span>

                    {heroAnime.score && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-[#FAF8F5] text-[11px] font-black tabular-nums">
                        <Star className="w-3 h-3 fill-[#F4A261] text-[#F4A261]" />
                        {heroAnime.score}
                      </span>
                    )}

                    {heroAnime.studio && (
                      <span className="px-2.5 py-1 rounded-full bg-white/5 text-stone-300 text-[11px] font-bold">
                        {heroAnime.studio}
                      </span>
                    )}

                    {heroAnime.hasLocalFiles && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#2A9D8F]/20 text-[#52B788] text-[11px] font-extrabold tabular-nums">
                        <HardDrive className="w-3 h-3" />
                        {heroAnime.localFiles?.length} Episodes •{' '}
                        {formatDiskSize(heroAnime.totalDiskMB)}
                      </span>
                    )}
                  </div>

                  <div>
                    <h1 className="text-2xl sm:text-4xl font-black text-[#FAF8F5] tracking-tight">
                      {heroAnime.title}
                    </h1>
                    {heroAnime.genres && heroAnime.genres.length > 0 && (
                      <p className="text-xs font-bold text-stone-400 mt-1">
                        {heroAnime.genres.join(' • ')}
                      </p>
                    )}
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="max-w-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-extrabold tabular-nums">
                      <span className="text-stone-200">
                        Episode {heroAnime.currentEpisodeLabel}{' '}
                        <span className="text-stone-400">
                          of {heroAnime.totalEpisodes || '?'}
                        </span>
                      </span>
                      <span className="text-[#F4A261]">
                        {formatTime(heroAnime.currentSeconds)} /{' '}
                        {formatTime(heroAnime.durationSeconds || 1420)}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="animate-bar-fill h-full bg-[#E07A5F] rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              4,
                              Math.round(
                                (heroAnime.currentSeconds /
                                  (heroAnime.durationSeconds || 1420)) *
                                  100
                              )
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
                    {heroAnime.hasLocalFiles ? (
                      <>
                        {(() => {
                          const smartNext = getSmartNextEpisode(heroAnime);
                          if (smartNext && smartNext.file) {
                            return (
                              <>
                                <TactileButton
                                  variant="amber"
                                  size="md"
                                  onClick={() => handlePlayMpv(heroAnime, smartNext.file, 0)}
                                >
                                  <Play className="w-4 h-4 fill-current" />
                                  <span>Play Next: Ep {smartNext.episodeLabel}</span>
                                </TactileButton>
                                <TactileButton
                                  variant="white"
                                  size="md"
                                  onClick={() => handlePlayMpv(heroAnime)}
                                >
                                  <span>
                                    Resume Ep {heroAnime.currentEpisodeLabel} (
                                    {formatTime(heroAnime.currentSeconds)})
                                  </span>
                                </TactileButton>
                              </>
                            );
                          }
                          return (
                            <TactileButton
                              variant="amber"
                              size="md"
                              onClick={() => handlePlayMpv(heroAnime)}
                            >
                              <Play className="w-4 h-4 fill-current" />
                              <span>
                                Resume Ep {heroAnime.currentEpisodeLabel} •{' '}
                                {formatTime(heroAnime.currentSeconds)}
                              </span>
                            </TactileButton>
                          );
                        })()}
                      </>
                    ) : (
                      <TactileButton
                        variant="amber"
                        size="md"
                        onClick={() => handlePrepareFolder(heroAnime)}
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>Prepare Folder in anime/</span>
                      </TactileButton>
                    )}

                    <TactileButton
                      variant="white"
                      size="md"
                      onClick={() => setSelectedId(heroAnime.id)}
                    >
                      <span>Open Episodes</span>
                      <ChevronRight className="w-4 h-4" />
                    </TactileButton>

                    <TactileButton
                      variant="emerald"
                      size="md"
                      onClick={() => handleQuickIncrementEpisode(heroAnime)}
                    >
                      <Check className="w-4 h-4" />
                      <span>+1 Ep</span>
                    </TactileButton>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 2. MINIMALIST SUMMARY BAR */}
          <section className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-white border border-[#E5E0D8] shadow-[0_4px_20px_-6px_rgba(28,25,23,0.05)]">
            <div className="flex flex-wrap items-center gap-6 text-xs font-extrabold">
              <div className="flex items-center gap-2">
                <span className="text-[#78716C]">Watch Time:</span>
                <span className="text-[#1C1917] font-black tabular-nums">
                  {collectorStats.hoursWatched} hrs ({collectorStats.totalWatchedEps} eps)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#78716C]">Avg Score:</span>
                <span className="text-[#1C1917] font-black tabular-nums">
                  {collectorStats.avgScore} / 10
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#78716C]">Local Disk:</span>
                <span className="text-[#2A9D8F] font-black tabular-nums">
                  {formatDiskSize(collectorStats.totalDiskMB)} ({collectorStats.totalFiles} mkv)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportBackup}
                className="px-3 py-1.5 rounded-xl bg-[#F5F3EE] hover:bg-[#EAE5DC] text-xs font-extrabold text-[#1C1917] flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-[#E07A5F]" />
                <span>Backup</span>
              </button>
              <button
                onClick={() => fileImportRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-[#F5F3EE] hover:bg-[#EAE5DC] text-xs font-extrabold text-[#1C1917] flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95"
              >
                <Upload className="w-3.5 h-3.5 text-[#2A9D8F]" />
                <span>Restore</span>
              </button>
            </div>
          </section>

          {/* 3. LIBRARY NAVIGATION & POSTER GALLERY */}
          <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Clean Segmented Tabs */}
              <div className="inline-flex flex-wrap items-center gap-1 p-1.5 rounded-2xl bg-[#EAE6DF]">
                {(
                  [
                    { id: 'all', label: 'All', count: tabCounts.all },
                    { id: 'watching', label: 'Watching', count: tabCounts.watching },
                    { id: 'completed', label: 'Watched', count: tabCounts.completed },
                    { id: 'plan', label: 'Watchlist', count: tabCounts.plan },
                    { id: 'on_hold', label: 'On Hold', count: tabCounts.on_hold },
                  ] as const
                ).map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer active:scale-95 ${
                        active
                          ? 'bg-white text-[#1C1917] shadow-sm'
                          : 'text-[#78716C] hover:text-[#1C1917]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-md text-[10px] font-black tabular-nums ${
                          active
                            ? 'bg-[#E07A5F]/15 text-[#E07A5F]'
                            : 'bg-black/5 text-[#78716C]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search, Sort & View Mode */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:w-52">
                  <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Filter library... (/)"
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-[#E5E0D8] text-xs font-bold text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#E07A5F]"
                  />
                </div>

                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EAE6DF] text-[11px] font-extrabold">
                  {(
                    [
                      { id: 'recent', label: 'Recent' },
                      { id: 'score', label: 'Score' },
                      { id: 'disk', label: 'Size' },
                      { id: 'title', label: 'A-Z' },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSortBy(s.id)}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                        sortBy === s.id
                          ? 'bg-white text-[#1C1917] shadow-sm'
                          : 'text-[#78716C] hover:text-[#1C1917]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="inline-flex items-center p-1 rounded-xl bg-[#EAE6DF]">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-white text-[#1C1917] shadow-sm'
                        : 'text-[#78716C]'
                    }`}
                    title="Poster Grid"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      viewMode === 'table'
                        ? 'bg-white text-[#1C1917] shadow-sm'
                        : 'text-[#78716C]'
                    }`}
                    title="Compact Table"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-16 text-center font-extrabold text-[#78716C]">
                Loading library...
              </div>
            ) : filteredAnimes.length === 0 ? (
              <div className="animate-page-enter bg-white rounded-3xl border border-[#E5E0D8] p-12 text-center space-y-3">
                <Film className="w-10 h-10 text-[#A8A29E] mx-auto" />
                <p className="text-base font-black text-[#1C1917]">
                  No anime in this tab yet
                </p>
                <p className="text-xs font-bold text-[#78716C] max-w-md mx-auto">
                  Drop an anime video folder into <code>Anideck/anime/</code> and click{' '}
                  <strong>Sync</strong>, or click <strong>Add Anime</strong> to add a title to your
                  Watchlist.
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              /* STAGGERED WAVE POSTER GALLERY */
              <div
                key={`grid-${activeTab}-${sortBy}`}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5"
              >
                {filteredAnimes.map((anime, index) => {
                  const dur = anime.durationSeconds || 1420;
                  const pct = Math.min(100, Math.round((anime.currentSeconds / dur) * 100));

                  return (
                    <div
                      key={anime.id}
                      style={{ animationDelay: `${index * 60}ms` }}
                      onClick={() => {
                        setSelectedId(anime.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="animate-card-wave poster-card-spring group bg-white rounded-2xl border border-[#E5E0D8] overflow-hidden cursor-pointer flex flex-col justify-between shadow-[0_10px_25px_-8px_rgba(28,25,23,0.08)] hover:shadow-[0_20px_35px_-10px_rgba(28,25,23,0.16)]"
                    >
                      <div className="relative aspect-[2/3] w-full bg-[#EAE6DF] overflow-hidden">
                        {anime.posterUrl ? (
                          <img
                            src={anime.posterUrl}
                            alt={anime.title}
                            className="poster-img-zoom w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                            <Film className="w-10 h-10 text-[#78716C] mb-2" />
                            <span className="text-xs font-black text-[#1C1917]">{anime.title}</span>
                          </div>
                        )}

                        {/* Top-Left Score Pill */}
                        {(anime.personalRating || anime.score) && (
                          <div className="absolute top-2.5 left-2.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#1C1917]/85 backdrop-blur-md text-[#FAF8F5] text-[11px] font-black tabular-nums">
                              <Star className="w-3 h-3 fill-[#F4A261] text-[#F4A261]" />
                              {anime.personalRating ? `${anime.personalRating}/10` : anime.score}
                            </span>
                          </div>
                        )}

                        {/* Top-Right Delete / Move to Watched Trigger */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingTarget(anime);
                          }}
                          className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        >
                          <button
                            className="p-1.5 rounded-lg bg-[#1C1917]/85 hover:bg-[#D9534F] text-white cursor-pointer shadow"
                            title="Move to Watched (Keep Poster) or Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Hover Quick Action Bar */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute inset-x-2.5 bottom-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 bg-[#1C1917]/90 backdrop-blur-md p-1.5 rounded-xl"
                        >
                          {anime.hasLocalFiles ? (
                            <button
                              onClick={() => handlePlayMpv(anime)}
                              className="flex-1 py-1.5 px-2 rounded-lg bg-[#E07A5F] text-white text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Play</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedId(anime.id)}
                              className="flex-1 py-1.5 px-2 rounded-lg bg-white/15 text-white text-[11px] font-extrabold cursor-pointer"
                            >
                              Details
                            </button>
                          )}

                          {anime.status !== 'completed' && (
                            <button
                              onClick={(e) => handleQuickIncrementEpisode(anime, e)}
                              className="py-1.5 px-2.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-black cursor-pointer tabular-nums"
                            >
                              +1 Ep
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Minimalist Card Footer */}
                      <div className="p-3.5 space-y-2 bg-white">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider ${
                                anime.status === 'completed'
                                  ? 'text-[#2A9D8F]'
                                  : anime.status === 'watching'
                                    ? 'text-[#E07A5F]'
                                    : 'text-[#78716C]'
                              }`}
                            >
                              {anime.status === 'completed'
                                ? 'Watched'
                                : anime.status === 'watching'
                                  ? `Ep ${anime.currentEpisodeLabel} of ${anime.totalEpisodes || '?'}`
                                  : 'Watchlist'}
                            </span>
                            <span className="text-[11px] font-extrabold text-[#78716C] tabular-nums">
                              {anime.status === 'completed'
                                ? `${anime.totalEpisodes || '?'} Eps`
                                : formatTime(anime.currentSeconds)}
                            </span>
                          </div>
                          <h3 className="font-black text-sm text-[#1C1917] line-clamp-1 group-hover:text-[#E07A5F]">
                            {anime.title}
                          </h3>
                        </div>

                        <div className="w-full h-1.5 rounded-full bg-[#EAE6DF] overflow-hidden">
                          <div
                            className={`animate-bar-fill h-full rounded-full ${
                              anime.status === 'completed' ? 'bg-[#2A9D8F]' : 'bg-[#E07A5F]'
                            }`}
                            style={{
                              width: `${
                                anime.status === 'completed' ? 100 : Math.max(6, pct)
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* COMPACT TABLE VIEW */
              <div className="animate-page-enter bg-white rounded-2xl border border-[#E5E0D8] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E0D8] text-[10px] font-black uppercase tracking-wider text-[#78716C] bg-[#FAF8F5]">
                        <th className="py-3 px-4">Series</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Progress</th>
                        <th className="py-3 px-3">Score</th>
                        <th className="py-3 px-3">Storage</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFECE6] text-xs font-bold">
                      {filteredAnimes.map((anime, index) => (
                        <tr
                          key={anime.id}
                          style={{ animationDelay: `${index * 40}ms` }}
                          onClick={() => setSelectedId(anime.id)}
                          className="animate-card-wave hover:bg-[#FAF8F5] cursor-pointer"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={anime.posterUrl}
                                alt={anime.title}
                                className="w-9 h-12 rounded-lg object-cover bg-[#EAE6DF] shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-black text-[#1C1917] truncate max-w-xs">
                                  {anime.title}
                                </p>
                                <p className="text-[11px] text-[#78716C] truncate">
                                  {anime.studio || 'Anime'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                anime.status === 'completed'
                                  ? 'bg-[#2A9D8F]/15 text-[#2A9D8F]'
                                  : anime.status === 'watching'
                                    ? 'bg-[#E07A5F]/15 text-[#E07A5F]'
                                    : 'bg-[#EAE6DF] text-[#78716C]'
                              }`}
                            >
                              {anime.status === 'completed' ? 'Watched' : anime.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 tabular-nums text-[#1C1917] font-black">
                            Ep {anime.currentEpisodeLabel} / {anime.totalEpisodes || '?'}
                          </td>
                          <td className="py-3 px-3 tabular-nums text-[#1C1917]">
                            {anime.personalRating || anime.score || '-'}
                          </td>
                          <td className="py-3 px-3 tabular-nums">
                            {anime.hasLocalFiles ? (
                              <span className="text-[#2A9D8F] font-extrabold">
                                {formatDiskSize(anime.totalDiskMB)}
                              </span>
                            ) : (
                              <span className="text-[#A8A29E]">Poster Saved</span>
                            )}
                          </td>
                          <td
                            className="py-3 px-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1.5">
                              {anime.hasLocalFiles && (
                                <TactileButton
                                  variant="amber"
                                  size="sm"
                                  onClick={() => handlePlayMpv(anime)}
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>Play</span>
                                </TactileButton>
                              )}
                              <button
                                onClick={() => setDeletingTarget(anime)}
                                className="p-2 rounded-xl bg-[#F5F3EE] hover:bg-[#D9534F] text-[#78716C] hover:text-white cursor-pointer"
                                title="Move to Watched or Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </main>
      ) : (
        /* =====================================================================
           SCREEN 2: MINIMALIST SERIES DETAIL & UNIFIED EPISODE LIST
           ===================================================================== */
        <main
          key={`detail-${selectedAnime.id}`}
          className="animate-page-enter max-w-6xl mx-auto px-4 sm:px-6 pt-7 space-y-8"
        >
          <section className="bg-white rounded-3xl border border-[#E5E0D8] shadow-[0_12px_35px_-10px_rgba(28,25,23,0.08)] p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Poster & Clean Actions */}
              <div className="lg:col-span-3 flex flex-col items-center sm:items-start gap-3">
                <div className="relative w-48 sm:w-full max-w-[220px] aspect-[2/3] rounded-2xl overflow-hidden shadow-lg bg-[#EAE6DF]">
                  {selectedAnime.posterUrl ? (
                    <img
                      src={selectedAnime.posterUrl}
                      alt={selectedAnime.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                      <Film className="w-12 h-12 text-[#78716C] mb-2" />
                      <span className="font-black text-sm text-[#1C1917]">
                        {selectedAnime.title}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setRematchingAnime(selectedAnime);
                    setSearchQuery(selectedAnime.title);
                  }}
                  className="w-48 sm:w-full max-w-[220px] px-3 py-2 rounded-xl bg-[#F5F3EE] hover:bg-[#EAE5DC] text-xs font-extrabold text-[#1C1917] flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#E07A5F]" />
                  <span>Change Poster</span>
                </button>
              </div>

              {/* Right Column: Metadata & Custom Scrubber */}
              <div className="lg:col-span-9 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#EFECE6] pb-5">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedAnime.score && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#F4A261]/20 text-[#B36529] text-xs font-black flex items-center gap-1 tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-[#E07A5F] text-[#E07A5F]" />
                          {selectedAnime.score}
                        </span>
                      )}
                      {selectedAnime.studio && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#F5F3EE] text-[#1C1917] text-xs font-extrabold">
                          {selectedAnime.studio}
                        </span>
                      )}
                      {selectedAnime.genres?.map((g) => (
                        <span
                          key={g}
                          className="px-2.5 py-0.5 rounded-full bg-[#F5F3EE] text-[#78716C] text-xs font-bold"
                        >
                          {g}
                        </span>
                      ))}
                      {selectedAnime.hasLocalFiles && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#2A9D8F]/15 text-[#2A9D8F] text-xs font-extrabold tabular-nums">
                          {formatDiskSize(selectedAnime.totalDiskMB)} on Disk
                        </span>
                      )}
                    </div>

                    <h2 className="text-2xl sm:text-4xl font-black text-[#1C1917] tracking-tight">
                      {selectedAnime.title}
                    </h2>
                  </div>

                  {/* Custom Segmented Status Bar (Zero <select>!) */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center p-1 rounded-xl bg-[#F5F3EE]">
                      {(
                        [
                          { id: 'watching', label: 'Watching' },
                          { id: 'completed', label: 'Watched' },
                          { id: 'plan', label: 'Watchlist' },
                          { id: 'on_hold', label: 'On Hold' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          onClick={() =>
                            saveAnimeUpdate({
                              ...selectedAnime,
                              status: st.id,
                            })
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer transition-transform active:scale-95 ${
                            selectedAnime.status === st.id
                              ? 'bg-white text-[#1C1917] shadow-sm'
                              : 'text-[#78716C] hover:text-[#1C1917]'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>

                    {selectedAnime.status !== 'completed' && (
                      <TactileButton
                        variant="emerald"
                        size="sm"
                        onClick={() => {
                          setCompletingAnime(selectedAnime);
                          setCompleteRating(selectedAnime.personalRating || 9);
                          setCompleteReview(selectedAnime.notes || '');
                        }}
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>Mark Watched</span>
                      </TactileButton>
                    )}
                  </div>
                </div>

                {/* CLEAN EPISODE & CUSTOM TIMELINE SCRUBBER (ZERO NATIVE <input type="range">) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Episode Stepper */}
                  <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-[#78716C] flex items-center gap-1.5">
                        <Tv className="w-4 h-4 text-[#E07A5F]" />
                        Episode Progress
                      </span>
                      <span className="text-xs font-extrabold text-[#2A9D8F] tabular-nums">
                        {selectedAnime.watchedEpisodes.length} /{' '}
                        {selectedAnime.totalEpisodes || '?'} Done
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2 tabular-nums">
                        <span className="text-3xl sm:text-4xl font-black text-[#1C1917]">
                          Ep {selectedAnime.currentEpisodeLabel}
                        </span>
                        <span className="text-sm font-extrabold text-[#78716C]">
                          of {selectedAnime.totalEpisodes || '?'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <TactileButton
                          variant="white"
                          size="sm"
                          onClick={() => handleStepEpisode(-1)}
                          title="Previous Episode"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </TactileButton>
                        <TactileButton
                          variant="white"
                          size="sm"
                          onClick={() => handleStepEpisode(1)}
                          title="Next Episode (+1)"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </TactileButton>
                      </div>
                    </div>
                  </div>

                  {/* Custom Interactive Timeline Scrubber */}
                  <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-[#78716C] flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#E07A5F]" />
                        Saved Timestamp
                      </span>
                      <span className="text-xs font-extrabold text-[#E07A5F] tabular-nums">
                        {progressPct}%
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2 tabular-nums">
                        <span className="text-3xl sm:text-4xl font-black text-[#1C1917]">
                          {formatTime(selectedAnime.currentSeconds)}
                        </span>
                        <span className="text-sm font-extrabold text-[#78716C]">
                          / {formatTime(selectedAnime.durationSeconds || 1420)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 tabular-nums">
                        <input
                          type="number"
                          min={0}
                          max={180}
                          value={editMin}
                          onChange={(e) => setEditMin(e.target.value)}
                          className="w-12 px-2 py-1 text-center font-black text-sm rounded-xl bg-white border border-[#DFD9CE] text-[#1C1917]"
                          title="Minutes"
                        />
                        <span className="font-black text-[#78716C]">:</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={editSec}
                          onChange={(e) => setEditSec(e.target.value)}
                          className="w-12 px-2 py-1 text-center font-black text-sm rounded-xl bg-white border border-[#DFD9CE] text-[#1C1917]"
                          title="Seconds"
                        />
                        <TactileButton variant="amber" size="sm" onClick={handleManualTimeSave}>
                          Set
                        </TactileButton>
                      </div>
                    </div>

                    {/* Bespoke Clickable Scrubber Track (Replaces native grey slider) */}
                    <div className="space-y-2">
                      <div
                        ref={scrubberRef}
                        onClick={handleScrubberClick}
                        className="group relative w-full h-3 rounded-full bg-[#E5E0D8] cursor-pointer overflow-hidden flex items-center"
                        title="Click anywhere on the timeline to jump to that minute"
                      >
                        <div
                          className="animate-bar-fill h-full bg-[#E07A5F] rounded-full transition-all duration-200"
                          style={{ width: `${Math.max(3, progressPct)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-[#78716C]">
                        <button
                          onClick={() =>
                            saveAnimeUpdate({ ...selectedAnime, currentSeconds: 0 })
                          }
                          className="hover:text-[#1C1917] cursor-pointer"
                        >
                          Reset 00:00
                        </button>
                        <button
                          onClick={() =>
                            saveAnimeUpdate({
                              ...selectedAnime,
                              currentSeconds: (selectedAnime.currentSeconds || 0) + 85,
                            })
                          }
                          className="hover:text-[#E07A5F] cursor-pointer"
                        >
                          +85s (Skip OP)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Play & Delete/Archive Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedAnime.hasLocalFiles ? (
                      <>
                        <TactileButton
                          variant="amber"
                          size="lg"
                          onClick={() => handlePlayMpv(selectedAnime)}
                        >
                          <Play className="w-5 h-5 fill-current" />
                          <span>
                            Play in MPV (Ep {selectedAnime.currentEpisodeLabel} •{' '}
                            {formatTime(selectedAnime.currentSeconds)})
                          </span>
                        </TactileButton>

                        {selectedAnime.currentSeconds > 10 && (
                          <TactileButton
                            variant="white"
                            size="md"
                            onClick={() => handlePlayMpv(selectedAnime, undefined, 0)}
                          >
                            <span>Start from 00:00</span>
                          </TactileButton>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2.5">
                        <TactileButton
                          variant="amber"
                          size="md"
                          onClick={() => handlePrepareFolder(selectedAnime)}
                        >
                          <FolderOpen className="w-4 h-4" />
                          <span>
                            {selectedAnime.folderName
                              ? `Open Folder "${selectedAnime.folderName}"`
                              : 'Prepare Folder in anime/'}
                          </span>
                        </TactileButton>

                        <TactileButton
                          variant="emerald"
                          size="md"
                          onClick={() => handleStepEpisode(1)}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>+1 Episode Done</span>
                        </TactileButton>
                      </div>
                    )}
                  </div>

                  {/* Unified Delete / Move to Watched Trigger */}
                  <div className="flex items-center gap-2">
                    <TactileButton
                      variant="white"
                      size="sm"
                      onClick={() => setDeletingTarget(selectedAnime)}
                    >
                      <Trash2 className="w-4 h-4 text-[#D9534F]" />
                      <span>Archive / Delete...</span>
                    </TactileButton>
                  </div>
                </div>

                {/* Scene Timestamp Bookmarks */}
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-[#E07A5F]" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#1C1917]">
                        Scene Bookmarks
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 flex-1 sm:flex-initial max-w-md">
                      <input
                        type="text"
                        value={bookmarkNote}
                        onChange={(e) => setBookmarkNote(e.target.value)}
                        placeholder={`Label for Ep ${selectedAnime.currentEpisodeLabel} at ${formatTime(selectedAnime.currentSeconds)}...`}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-[#DFD9CE] text-xs font-bold text-[#1C1917]"
                      />
                      <TactileButton variant="white" size="sm" onClick={handleAddBookmark}>
                        <Plus className="w-3.5 h-3.5 text-[#E07A5F]" />
                        <span>Save Scene</span>
                      </TactileButton>
                    </div>
                  </div>

                  {selectedAnime.bookmarks && selectedAnime.bookmarks.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedAnime.bookmarks.map((bm) => {
                        const epFile = selectedAnime.localFiles?.find(
                          (f) => f.episodeLabel === bm.episodeLabel
                        );
                        return (
                          <div
                            key={bm.id}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E5E0D8] text-xs font-bold shadow-sm"
                          >
                            <button
                              onClick={() => {
                                if (epFile) {
                                  handlePlayMpv(selectedAnime, epFile, bm.seconds);
                                } else {
                                  saveAnimeUpdate({
                                    ...selectedAnime,
                                    currentEpisodeLabel: bm.episodeLabel,
                                    currentSeconds: bm.seconds,
                                  });
                                }
                              }}
                              className="flex items-center gap-1.5 text-left hover:text-[#E07A5F] cursor-pointer"
                            >
                              <Play className="w-3 h-3 text-[#E07A5F] fill-current" />
                              <span className="font-black text-[#E07A5F] tabular-nums">
                                Ep {bm.episodeLabel} • {formatTime(bm.seconds)}
                              </span>
                              <span className="text-[#1C1917]">— {bm.label}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteBookmark(bm.id)}
                              className="text-[#A8A29E] hover:text-[#D9534F] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* UNIFIED EPISODE LIST (ALL EPISODES IN ONE CONTINUOUS LIST) */}
            {selectedAnime.hasLocalFiles && unifiedEpisodes.length > 0 && (
              <div className="mt-8 pt-7 border-t border-[#EFECE6] space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-[#1C1917]">
                      Episodes ({unifiedEpisodes.length})
                    </h3>
                    <p className="text-xs font-bold text-[#78716C]">
                      Click any episode to play in MPV from your last timestamp.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {unifiedEpisodes.map((file, idx) => {
                    const isCurrent = file.episodeLabel === selectedAnime.currentEpisodeLabel;
                    const isWatched = selectedAnime.watchedEpisodes.includes(file.episodeLabel);
                    const epProg = selectedAnime.episodeProgress?.[file.episodeLabel];
                    const savedSec = isCurrent
                      ? selectedAnime.currentSeconds
                      : epProg?.seconds || 0;
                    const epDur = epProg?.duration || selectedAnime.durationSeconds || 1420;
                    const epPct = Math.min(100, Math.round((savedSec / epDur) * 100));

                    return (
                      <div
                        key={file.id}
                        style={{ animationDelay: `${Math.min(idx * 30, 400)}ms` }}
                        className={`animate-card-wave poster-card-spring rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
                          isCurrent
                            ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917] shadow-md'
                            : isWatched
                              ? 'bg-[#FAF8F5] border-[#E5E0D8] opacity-85'
                              : 'bg-white border-[#E5E0D8]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              onClick={() => toggleWatchedEpisode(file.episodeLabel)}
                              title="Toggle episode watched"
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black cursor-pointer tabular-nums ${
                                isWatched
                                  ? 'bg-[#2A9D8F] text-white'
                                  : isCurrent
                                    ? 'bg-[#E07A5F] text-white'
                                    : 'bg-[#F5F3EE] text-[#1C1917]'
                              }`}
                            >
                              {isWatched ? (
                                <Check className="w-5 h-5 stroke-[3]" />
                              ) : (
                                <span className="text-sm">{file.episodeLabel}</span>
                              )}
                            </button>

                            <div className="min-w-0">
                              <span
                                className={`text-sm font-black block ${
                                  isCurrent ? 'text-white' : 'text-[#1C1917]'
                                }`}
                              >
                                Episode {file.episodeLabel}
                              </span>
                              <p
                                className={`text-[11px] font-bold truncate ${
                                  isCurrent ? 'text-stone-400' : 'text-[#78716C]'
                                }`}
                              >
                                {file.sizeMB} MB •{' '}
                                {savedSec > 5
                                  ? `Stopped at ${formatTime(savedSec)}`
                                  : isWatched
                                    ? 'Watched'
                                    : 'Unwatched'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => markWatchedUpTo(file)}
                              title={`Mark Episodes 01 to ${file.episodeLabel} as watched`}
                              className={`p-1.5 rounded-lg cursor-pointer ${
                                isCurrent
                                  ? 'bg-white/10 hover:bg-white/20 text-stone-300'
                                  : 'bg-[#F5F3EE] hover:bg-[#EAE5DC] text-[#78716C]'
                              }`}
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() =>
                                setDeletingEpisode({ anime: selectedAnime, file })
                              }
                              title={`Delete Ep ${file.episodeLabel} .mkv file (${file.sizeMB} MB)`}
                              className={`p-1.5 rounded-lg cursor-pointer ${
                                isCurrent
                                  ? 'bg-white/10 hover:bg-[#D9534F] text-stone-300 hover:text-white'
                                  : 'bg-[#F5F3EE] hover:bg-[#D9534F] text-[#78716C] hover:text-white'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <TactileButton
                              variant={isCurrent ? 'amber' : 'white'}
                              size="sm"
                              onClick={() => handlePlayMpv(selectedAnime, file)}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </TactileButton>
                          </div>
                        </div>

                        <div
                          className={`w-full h-1 rounded-full overflow-hidden ${
                            isCurrent ? 'bg-white/15' : 'bg-[#EAE6DF]'
                          }`}
                        >
                          <div
                            className={`animate-bar-fill h-full ${
                              isWatched ? 'bg-[#2A9D8F]' : 'bg-[#E07A5F]'
                            }`}
                            style={{
                              width: `${isWatched ? 100 : savedSec > 5 ? Math.max(6, epPct) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </main>
      )}

      {/* =====================================================================
          MODAL 1: ULTRA-CLEAN ADD ANIME / CHANGE POSTER (ZERO NESTED TUTORIAL BOXES!)
         ===================================================================== */}
      {(showAddModal || rematchingAnime) && (
        <div className="animate-backdrop-fade fixed inset-0 z-50 bg-[#1C1917]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="animate-modal-pop bg-white w-full max-w-xl rounded-3xl border border-[#E5E0D8] shadow-[0_25px_60px_-15px_rgba(28,25,23,0.3)] p-6 max-h-[88vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-[#EFECE6] pb-3.5">
              <div>
                <h3 className="text-lg font-black text-[#1C1917]">
                  {rematchingAnime
                    ? `Change Poster: ${rematchingAnime.title}`
                    : 'Add Anime to Library'}
                </h3>
                <p className="text-xs font-bold text-[#78716C]">
                  {rematchingAnime
                    ? 'Search and click a cover below to save it locally.'
                    : 'For downloaded .mkv videos, simply drop the folder in anime/ and click Sync.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setRematchingAnime(null);
                }}
                className="p-2 rounded-xl bg-[#F5F3EE] hover:bg-[#EAE5DC] text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!rematchingAnime && (
              <div className="space-y-3">
                {/* Custom Segmented Status Picker (No <select>!) */}
                <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-[#F5F3EE]">
                  {(
                    [
                      { id: 'plan', label: 'Watchlist' },
                      { id: 'watching', label: 'Watching' },
                      { id: 'completed', label: 'Watched' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setNewStatus(st.id)}
                      className={`flex-1 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-transform active:scale-95 ${
                        newStatus === st.id
                          ? 'bg-white text-[#1C1917] shadow-sm'
                          : 'text-[#78716C] hover:text-[#1C1917]'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {newStatus === 'watching' && (
                  <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#78716C]">Episode:</span>
                      <button
                        type="button"
                        onClick={() => setNewEp((p) => Math.max(1, p - 1))}
                        className="p-1 rounded-lg bg-white border border-[#DFD9CE] cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-black text-sm tabular-nums">
                        {newEp}
                      </span>
                      <button
                        type="button"
                        onClick={() => setNewEp((p) => p + 1)}
                        className="p-1 rounded-lg bg-white border border-[#DFD9CE] cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#78716C]">Minute:</span>
                      <input
                        type="number"
                        min={0}
                        value={newMin}
                        onChange={(e) => setNewMin(parseInt(e.target.value || '0', 10))}
                        className="w-14 px-2 py-1 text-center rounded-xl bg-white border border-[#DFD9CE] text-sm font-black"
                      />
                    </div>
                  </div>
                )}

                {newStatus === 'completed' && (
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#78716C]">Score:</span>
                      <button
                        type="button"
                        onClick={() => setNewRating((p) => Math.max(1, p - 1))}
                        className="p-1 rounded-lg bg-white border border-[#DFD9CE] cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-black text-sm tabular-nums">
                        {newRating}/10
                      </span>
                      <button
                        type="button"
                        onClick={() => setNewRating((p) => Math.min(10, p + 1))}
                        className="p-1 rounded-lg bg-white border border-[#DFD9CE] cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="Short review note..."
                      className="flex-1 min-w-[160px] px-3 py-1.5 rounded-xl bg-white border border-[#DFD9CE] text-xs font-bold"
                    />
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSearchMal} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type anime title..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF8F5] border border-[#DFD9CE] text-sm font-extrabold text-[#1C1917] focus:outline-none focus:border-[#E07A5F]"
                  autoFocus
                />
              </div>
              {!rematchingAnime && searchQuery.trim() && (
                <TactileButton type="button" variant="white" size="md" onClick={handleAddManual}>
                  Save Title
                </TactileButton>
              )}
            </form>

            {searchingMal && (
              <p className="text-xs font-bold text-[#78716C] text-center py-2">
                Searching poster...
              </p>
            )}

            {jikanResults.length > 0 && (
              <div className="space-y-2">
                {jikanResults.map((item, idx) => {
                  const canonicalTitle = item.title_english || item.title;
                  const existing = !rematchingAnime
                    ? checkDuplicate(canonicalTitle, item.mal_id)
                    : undefined;

                  return (
                    <div
                      key={item.mal_id}
                      style={{ animationDelay: `${idx * 45}ms` }}
                      className="animate-card-wave p-3 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.images?.jpg?.image_url}
                          alt={item.title}
                          className="w-11 h-16 object-cover rounded-lg bg-[#EAE6DF] shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="font-black text-sm text-[#1C1917] truncate">
                            {canonicalTitle}
                          </h4>
                          <p className="text-xs font-bold text-[#78716C] truncate tabular-nums">
                            {item.studios?.[0]?.name || 'Anime'} • {item.episodes || '?'} Eps •{' '}
                            {item.score || '-'}
                          </p>
                          {existing && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-extrabold text-[#E07A5F]">
                              <AlertTriangle className="w-3 h-3" />
                              Already in library
                            </span>
                          )}
                        </div>
                      </div>

                      <TactileButton
                        variant={existing ? 'white' : 'amber'}
                        size="sm"
                        onClick={() => handleAddFromJikan(item)}
                      >
                        {rematchingAnime
                          ? 'Use Poster'
                          : existing
                            ? 'Open'
                            : `+ Add`}
                      </TactileButton>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: UNIFIED DELETE / MOVE TO WATCHED MODAL (ZERO window.confirm!)
         ===================================================================== */}
      {deletingTarget && (
        <div className="animate-backdrop-fade fixed inset-0 z-50 bg-[#1C1917]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="animate-modal-pop bg-white w-full max-w-md rounded-3xl border border-[#E5E0D8] shadow-[0_25px_60px_-15px_rgba(28,25,23,0.3)] p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#EFECE6] pb-3">
              <div className="flex items-center gap-3">
                {deletingTarget.posterUrl && (
                  <img
                    src={deletingTarget.posterUrl}
                    alt={deletingTarget.title}
                    className="w-10 h-14 rounded-lg object-cover bg-[#EAE6DF]"
                  />
                )}
                <div>
                  <h3 className="text-base font-black text-[#1C1917]">
                    {deletingTarget.title}
                  </h3>
                  <p className="text-xs font-bold text-[#78716C]">
                    Choose how you want to clean or remove this series
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeletingTarget(null)}
                className="p-1.5 rounded-xl bg-[#F5F3EE] text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {/* PRIMARY CHOICE: Move to Watched & Keep Poster Forever */}
              <button
                onClick={() => handleArchiveAndCleanVideos(deletingTarget, 'all')}
                className="w-full p-4 rounded-2xl bg-[#FAF8F5] hover:bg-[#2A9D8F]/10 border-2 border-[#2A9D8F] text-left flex items-center justify-between gap-3 cursor-pointer transition-transform active:scale-[0.98]"
              >
                <div>
                  <span className="inline-block text-[10px] font-black uppercase tracking-wider text-[#2A9D8F] mb-0.5">
                    Recommended • Poster &amp; History Kept
                  </span>
                  <h4 className="text-sm font-black text-[#1C1917]">
                    Move to Watched {deletingTarget.hasLocalFiles ? '& Delete .MKV Files' : ''}
                  </h4>
                  <p className="text-xs font-bold text-[#78716C] mt-0.5">
                    {deletingTarget.hasLocalFiles
                      ? `Frees ${formatDiskSize(deletingTarget.totalDiskMB)} of disk space while keeping the poster & card in your Watched tab.`
                      : 'Moves this anime to your Watched (Completed) tab so its poster never disappears.'}
                  </p>
                </div>
                <Archive className="w-5 h-5 text-[#2A9D8F] shrink-0" />
              </button>

              {/* OPTIONAL CHOICE: Clean Watched Episodes Only */}
              {deletingTarget.hasLocalFiles && deletingTarget.watchedEpisodes.length > 0 && (
                <button
                  onClick={() => handleArchiveAndCleanVideos(deletingTarget, 'watched_only')}
                  className="w-full p-4 rounded-2xl bg-[#FAF8F5] hover:bg-[#F5F3EE] border border-[#E5E0D8] text-left flex items-center justify-between gap-3 cursor-pointer transition-transform active:scale-[0.98]"
                >
                  <div>
                    <h4 className="text-sm font-black text-[#1C1917]">
                      Clean Watched Episodes Only ({deletingTarget.watchedEpisodes.length} Eps)
                    </h4>
                    <p className="text-xs font-bold text-[#78716C] mt-0.5">
                      Deletes .mkv files for episodes you already finished; keeps unwatched episodes.
                    </p>
                  </div>
                  <HardDrive className="w-5 h-5 text-[#E07A5F] shrink-0" />
                </button>
              )}

              {/* DESTRUCTIVE CHOICE: Remove Card Completely */}
              <button
                onClick={() => handleConfirmPermanentDelete(deletingTarget)}
                className="w-full p-3.5 rounded-2xl bg-white hover:bg-[#D9534F]/10 border border-[#E5E0D8] hover:border-[#D9534F] text-left flex items-center justify-between gap-3 cursor-pointer transition-transform active:scale-[0.98]"
              >
                <div>
                  <h4 className="text-xs font-black text-[#D9534F]">
                    Remove Card Permanently from Anideck
                  </h4>
                  <p className="text-[11px] font-bold text-[#78716C]">
                    Completely erases this entry from your library memory.
                  </p>
                </div>
                <Trash2 className="w-4 h-4 text-[#D9534F] shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: CUSTOM SINGLE EPISODE DELETE MODAL (ZERO window.confirm!)
         ===================================================================== */}
      {deletingEpisode && (
        <div className="animate-backdrop-fade fixed inset-0 z-50 bg-[#1C1917]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="animate-modal-pop bg-white w-full max-w-sm rounded-3xl border border-[#E5E0D8] shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-black text-[#1C1917]">
              Clean Episode {deletingEpisode.file.episodeLabel} Video?
            </h3>
            <p className="text-xs font-bold text-[#78716C]">
              Deletes <code>{deletingEpisode.file.fileName}</code> ({deletingEpisode.file.sizeMB}{' '}
              MB) from your SSD and marks Episode {deletingEpisode.file.episodeLabel} as watched.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <TactileButton
                variant="white"
                size="sm"
                onClick={() => setDeletingEpisode(null)}
              >
                Cancel
              </TactileButton>
              <TactileButton
                variant="rose"
                size="sm"
                onClick={() =>
                  handleArchiveAndCleanVideos(
                    deletingEpisode.anime,
                    'single',
                    deletingEpisode.file
                  )
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete .MKV ({deletingEpisode.file.sizeMB} MB)</span>
              </TactileButton>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: MARK COMPLETED MODAL (CUSTOM STEPPER & CUSTOM TOGGLE SWITCH)
         ===================================================================== */}
      {completingAnime && (
        <div className="animate-backdrop-fade fixed inset-0 z-50 bg-[#1C1917]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="animate-modal-pop bg-white w-full max-w-md rounded-3xl border border-[#E5E0D8] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-[#1C1917] flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#E07A5F]" />
                <span>Move to Watched</span>
              </h3>
              <button
                onClick={() => setCompletingAnime(null)}
                className="p-1.5 rounded-xl bg-[#F5F3EE] text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8]">
              <span className="text-xs font-black uppercase text-[#78716C]">
                Personal Score
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setCompleteRating((r) => Math.max(1, r - 1))}
                  className="p-1.5 rounded-xl bg-white border border-[#DFD9CE] cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-xl font-black text-[#E07A5F] tabular-nums w-12 text-center">
                  {completeRating}/10
                </span>
                <button
                  type="button"
                  onClick={() => setCompleteRating((r) => Math.min(10, r + 1))}
                  className="p-1.5 rounded-xl bg-white border border-[#DFD9CE] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-[#78716C] mb-1.5">
                Review / Notes
              </label>
              <textarea
                rows={3}
                value={completeReview}
                onChange={(e) => setCompleteReview(e.target.value)}
                placeholder="Write your thoughts..."
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#FAF8F5] border border-[#DFD9CE] font-bold text-sm text-[#1C1917] focus:outline-none focus:border-[#E07A5F]"
              />
            </div>

            {/* Custom Animated Toggle Switch (No native <input type="checkbox">!) */}
            {completingAnime.hasLocalFiles && (
              <div
                onClick={() => setDeleteFilesOnComplete((prev) => !prev)}
                className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] cursor-pointer select-none"
              >
                <div className="text-xs">
                  <span className="font-black text-[#1C1917] block">
                    Also delete .mkv files ({formatDiskSize(completingAnime.totalDiskMB)})
                  </span>
                  <span className="font-bold text-[#78716C]">
                    Poster &amp; history stay permanently in your Watched tab.
                  </span>
                </div>
                <div
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 shrink-0 ${
                    deleteFilesOnComplete ? 'bg-[#2A9D8F]' : 'bg-[#D6D0C4]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                      deleteFilesOnComplete ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <TactileButton
                variant="white"
                size="md"
                onClick={() => setCompletingAnime(null)}
              >
                Cancel
              </TactileButton>
              <TactileButton variant="emerald" size="md" onClick={handleConfirmComplete}>
                <Check className="w-4 h-4" />
                <span>Save to Watched</span>
              </TactileButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
