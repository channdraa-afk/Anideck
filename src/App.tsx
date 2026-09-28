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
  PauseCircle,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCheck,
  ArrowLeft,
  HardDrive,
  Archive,
  Shuffle,
  Download,
  Upload,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';
import { TactileButton } from './components/TactileButton';
import {
  searchOfflineCatalog,
  getOfflineRecommendations,
  getRandomOfflinePick,
  OFFLINE_CATALOG_COUNT,
  POPULAR_GENRES,
  type RecommendedAnimeItem,
} from './data/offlineEngine';
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

export function App() {
  const [animes, setAnimes] = useState<AnimeEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'watching' | 'completed' | 'plan' | 'on_hold'>(
    'all'
  );
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedPart, setSelectedPart] = useState<string>('ALL');
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('ALL');
  const [selectedStudio, setSelectedStudio] = useState<string>('');
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

  // Add / Search / Rematch Poster Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [rematchingAnime, setRematchingAnime] = useState<AnimeEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalGenreFilter, setModalGenreFilter] = useState<string>('ALL');
  const [modalShortOnly, setModalShortOnly] = useState<boolean>(false);
  const [jikanResults, setJikanResults] = useState<JikanAnimeItem[]>([]);
  const [searchingMal, setSearchingMal] = useState(false);
  const [newStatus, setNewStatus] = useState<'watching' | 'completed' | 'plan'>('plan');
  const [newEp, setNewEp] = useState<number>(1);
  const [newMin, setNewMin] = useState<number>(0);
  const [newRating, setNewRating] = useState<number>(9);
  const [newNotes, setNewNotes] = useState<string>('');

  // Random Pick ("Surprise Me") Modal state
  const [randomPick, setRandomPick] = useState<RecommendedAnimeItem | null>(null);

  // Mark Completed Modal state
  const [completingAnime, setCompletingAnime] = useState<AnimeEntry | null>(null);
  const [completeRating, setCompleteRating] = useState<number>(9);
  const [completeReview, setCompleteReview] = useState<string>('');
  const [deleteFilesOnComplete, setDeleteFilesOnComplete] = useState<boolean>(false);

  // Steam-style Storage Cleaner Modal state
  const [cleaningAnime, setCleaningAnime] = useState<AnimeEntry | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileImportRef = useRef<HTMLInputElement | null>(null);

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3400);
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

  // Keyboard shortcuts: '/' or 'Ctrl+K' to focus catalog search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
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
        setCleaningAnime(null);
        setRandomPick(null);
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

  const parts = useMemo(() => {
    if (!selectedAnime?.localFiles) return [];
    const set = new Set<string>();
    selectedAnime.localFiles.forEach((f) => set.add(f.part));
    return Array.from(set);
  }, [selectedAnime]);

  const filteredEpisodes = useMemo(() => {
    if (!selectedAnime?.localFiles) return [];
    if (selectedPart === 'ALL') return selectedAnime.localFiles;
    return selectedAnime.localFiles.filter((f) => f.part === selectedPart);
  }, [selectedAnime, selectedPart]);

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
        showNotice(`Saved "${updated.title}" — Ep ${updated.currentEpisodeLabel} (${formatTime(updated.currentSeconds)})`);
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

  // Helper to detect if current episode is >=85% done and find the next episode
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
    } else if (anime.currentEpisode < (anime.totalEpisodes || 999)) {
      const nextNum = Math.floor(anime.currentEpisode + 1);
      return {
        episodeNum: nextNum,
        episodeLabel: String(nextNum).padStart(2, '0'),
        file: undefined,
      };
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
          `Launching MPV: ${anime.title} — Ep ${targetFile.episodeLabel} at ${formatTime(startSeconds)}`
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

  const handleAddBookmark = () => {
    if (!selectedAnime) return;
    const labelText =
      bookmarkNote.trim() || `Highlighted Scene (Ep ${selectedAnime.currentEpisodeLabel})`;
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

  // Steam-style Storage Cleaner execution
  const handleDeleteVideos = async (
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
            `Archived "${anime.title}" in Completed — Freed ${formatDiskSize(data.freedMB)} (Poster & Watch Log Preserved)`
          );
        } else if (mode === 'watched_only') {
          showNotice(
            `Cleaned ${data.deletedCount} watched .mkv files — Freed ${formatDiskSize(data.freedMB)}`
          );
        } else {
          showNotice(
            `Deleted Ep ${epFile?.episodeLabel} .mkv file — Freed ${formatDiskSize(data.freedMB)}`
          );
        }
      }
    } catch {
      showNotice('Failed to clean video files.');
    } finally {
      setCleaningAnime(null);
    }
  };

  const handleConfirmComplete = async () => {
    if (!completingAnime) return;
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });

    if (deleteFilesOnComplete && completingAnime.hasLocalFiles) {
      await handleDeleteVideos(
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
        showNotice(`Prepared folder "anime/${data.folderName}" — Drop .mkv files & click Scan`);
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
    showNotice('Exported portable Anideck backup (.json).');
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
        showNotice(`Restored ${data.count} anime records from backup.`);
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
    const localMatches = searchOfflineCatalog(trimmed, {
      genre: modalGenreFilter,
      maxEpisodes: modalShortOnly ? 13 : undefined,
      limit: 12,
    });
    setJikanResults(localMatches);

    if (trimmed && localMatches.length < 3) {
      setSearchingMal(true);
      try {
        const res = await fetch(
          `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(trimmed)}&limit=6&sfw=true`
        );
        if (res.ok) {
          const data = await res.json();
          const onlineList: JikanAnimeItem[] = data.data || [];
          const seenIds = new Set(localMatches.map((m) => m.mal_id));
          const merged = [
            ...localMatches,
            ...onlineList.filter((o) => !seenIds.has(o.mal_id)),
          ];
          setJikanResults(merged.slice(0, 12));
        }
      } catch {
        // 100% offline safe
      } finally {
        setSearchingMal(false);
      }
    } else {
      setSearchingMal(false);
    }
  };

  const handleSearchMal = async (e: React.FormEvent) => {
    e.preventDefault();
    await runMalSearch(searchQuery);
  };

  useEffect(() => {
    if (!showAddModal && !rematchingAnime) return;
    runMalSearch(searchQuery);
  }, [searchQuery, modalGenreFilter, modalShortOnly, showAddModal, rematchingAnime]);

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
    showNotice(`Updated local poster & metadata for "${canonicalTitle}"`);
    setRematchingAnime(null);
    setSearchQuery('');
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
      setRandomPick(null);
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
      notes:
        newNotes ||
        (targetStatus === 'plan'
          ? 'Added to Watchlist'
          : targetStatus === 'completed'
            ? 'Completed & logged in Anideck'
            : ''),
      watchedEpisodes:
        targetStatus === 'completed'
          ? Array.from({ length: totalEps }, (_, i) => String(i + 1).padStart(2, '0'))
          : [],
      episodeProgress: {},
    };

    await saveAnimeUpdate(entry, Boolean(overrideStatus));
    if (overrideStatus === 'plan') {
      showNotice(`Added "${canonicalTitle}" to Watchlist.`);
    } else if (overrideStatus === 'watching') {
      showNotice(`Added "${canonicalTitle}" to Currently Watching.`);
    }
    setShowAddModal(false);
    setRandomPick(null);
    setSearchQuery('');
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

  const handleDeleteAnime = async (anime: AnimeEntry) => {
    if (
      !window.confirm(
        `Remove the card "${anime.title}" from Anideck memory? (To delete .mkv video files while keeping the poster & history in Completed, use "Free Disk Space" instead.)`
      )
    ) {
      return;
    }
    await fetch('/api/delete-anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: anime.id }),
    });
    setSelectedId(null);
    fetchLibrary();
    showNotice(`Removed "${anime.title}" from library.`);
  };

  const watchingAnimes = useMemo(
    () => animes.filter((a) => a.status === 'watching'),
    [animes]
  );

  // Featured Hero Spotlight Anime (Netflix / Apple TV+ Billboard)
  const heroAnime = useMemo(
    () => watchingAnimes[0] || animes[0] || null,
    [watchingAnimes, animes]
  );

  // Collector Analytics Telemetry (AniList / Letterboxd / Steam Storage Manager)
  const collectorStats = useMemo(() => {
    let totalWatchedEps = 0;
    let totalDiskMB = 0;
    let totalFiles = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    const genreCounts = new Map<string, number>();

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
      for (const g of a.genres || []) {
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
      }
    }

    let topGenre = 'Sci-Fi & Action';
    let bestCount = 0;
    genreCounts.forEach((cnt, g) => {
      if (cnt > bestCount) {
        bestCount = cnt;
        topGenre = g;
      }
    });

    const hoursWatched = Math.round(((totalWatchedEps * 24) / 60) * 10) / 10;
    const avgScore = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : '-';

    return {
      totalWatchedEps,
      hoursWatched,
      avgScore,
      totalDiskMB,
      totalFiles,
      topGenre,
    };
  }, [animes]);

  // 100% Offline Genre & Studio Affinity Recommendations
  const recommendations = useMemo<RecommendedAnimeItem[]>(
    () => getOfflineRecommendations(animes, 10, selectedGenre),
    [animes, selectedGenre]
  );

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

    if (selectedGenre !== 'ALL') {
      list = list.filter((a) =>
        a.genres?.some((g) => g.toLowerCase() === selectedGenre.toLowerCase())
      );
    }
    if (selectedStudio.trim()) {
      list = list.filter(
        (a) => a.studio?.toLowerCase() === selectedStudio.toLowerCase().trim()
      );
    }
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
  }, [animes, activeTab, catalogSearch, selectedGenre, selectedStudio, sortBy]);

  const progressPct = useMemo(() => {
    if (!selectedAnime) return 0;
    const dur = selectedAnime.durationSeconds || 1420;
    return Math.min(100, Math.round((selectedAnime.currentSeconds / dur) * 100));
  }, [selectedAnime]);

  const activeAmbientPoster = selectedAnime?.posterUrl || heroAnime?.posterUrl;

  return (
    <div className="relative min-h-screen bg-[#090C15] text-[#F8FAFC] pb-24 selection:bg-[#F97316] selection:text-[#090C15] overflow-x-hidden">
      {/* APPLE TV+ DYNAMIC AMBIENT POSTER BLEED (60FPS STATIC COMPOSITOR LAYER) */}
      {activeAmbientPoster && (
        <div className="pointer-events-none fixed inset-x-0 top-0 h-[520px] z-0 overflow-hidden">
          <img
            src={activeAmbientPoster}
            alt=""
            className="w-full h-full object-cover blur-3xl opacity-[0.16] scale-125"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#090C15]/40 via-[#090C15]/85 to-[#090C15]" />
        </div>
      )}

      {/* Hidden File Input for Portable JSON Backup Restore */}
      <input
        ref={fileImportRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportBackup}
      />

      {/* Toast Notification (Zero Emoji, Crisp Vector Icon) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#131B2E]/95 backdrop-blur-md text-white px-5 py-3.5 rounded-2xl border border-[#F97316]/50 shadow-[0_12px_35px_rgba(0,0,0,0.75)] flex items-center gap-3 font-extrabold text-xs sm:text-sm">
          <Sparkles className="w-4 h-4 text-[#F97316] shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* TOP NAVIGATION BAR (APPLE TV+ FROSTED GLASS × LINEAR PRECISION HEADER) */}
      <header className="sticky top-0 z-30 bg-[#090C15]/85 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setSelectedId(null);
                setSelectedPart('ALL');
              }}
              className="flex items-center gap-3 cursor-pointer group text-left"
              title="Return to Anideck Home"
            >
              <img
                src="/icon.png"
                alt="Anideck"
                className="w-9 h-9 rounded-xl ring-1 ring-white/15 shadow-md group-active:translate-y-0.5 object-contain"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black tracking-wider text-[#FFFDF8]">
                    ANIDECK
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-[10px] font-extrabold text-slate-400 tabular-nums">
                    <HardDrive className="w-3 h-3 text-emerald-400" />
                    {OFFLINE_CATALOG_COUNT} Offline DB
                  </span>
                </div>
                <p className="text-[11px] font-bold text-slate-400">
                  Local Cinema OS &amp; MPV Progress Cockpit
                </p>
              </div>
            </button>

            {selectedId && (
              <TactileButton
                variant="slate"
                size="sm"
                onClick={() => {
                  setSelectedId(null);
                  setSelectedPart('ALL');
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#FDBA74]" />
                <span>Back to Library</span>
              </TactileButton>
            )}
          </div>

          {/* LIVE MPV REMOTE CONTROL BAR (SPOTIFY DESKTOP / PLEX IPC CONTROLLER) */}
          {liveMpv.active && (
            <div className="flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-emerald-950/90 text-emerald-200 border border-emerald-500/40 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-black tracking-wide tabular-nums mr-1">
                MPV LIVE • Ep {liveMpv.episodeLabel} • {formatTime(liveMpv.seconds)} /{' '}
                {formatTime(liveMpv.duration)}
              </span>

              <div className="flex items-center gap-1 border-l border-emerald-700/60 pl-2">
                <button
                  onClick={() => handleSendMpvCommand(['seek', -10, 'relative'], 'MPV Rewind -10s')}
                  className="p-1 rounded-lg hover:bg-emerald-900/80 text-emerald-200 cursor-pointer"
                  title="Rewind 10s"
                >
                  <Rewind className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleSendMpvCommand(['cycle', 'pause'], 'Toggled MPV Pause/Play')}
                  className="p-1 rounded-lg hover:bg-emerald-900/80 text-emerald-200 cursor-pointer"
                  title="Pause / Resume MPV"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    handleSendMpvCommand(['seek', 85, 'relative'], 'Skipped Opening (+85s)')
                  }
                  className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-[10px] font-black text-emerald-200 cursor-pointer flex items-center gap-1"
                  title="Skip Anime Opening (+85 seconds)"
                >
                  <FastForward className="w-3 h-3" />
                  <span>Skip OP +85s</span>
                </button>
              </div>
            </div>
          )}

          {/* RIGHT ACTION TOOLBAR */}
          <div className="flex items-center gap-2">
            <TactileButton
              variant="white"
              size="sm"
              onClick={() => setRandomPick(getRandomOfflinePick(animes, selectedGenre))}
              title="Pick a random anime from your Watchlist / 950 Offline Catalog"
            >
              <Shuffle className="w-3.5 h-3.5 text-[#FDBA74]" />
              <span className="hidden lg:inline">Surprise Me</span>
            </TactileButton>

            <TactileButton
              variant="white"
              size="sm"
              onClick={() => handleOpenExplorer()}
              title="Open c:\My Project\Anideck\anime in Windows Explorer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#F97316]" />
              <span className="hidden md:inline">Anime Folder</span>
            </TactileButton>

            <TactileButton
              variant="white"
              size="sm"
              onClick={() => {
                fetchLibrary(true);
                showNotice('Scanning anime/ directory & syncing local posters...');
              }}
              title="Rescan local anime/ folder & sync posters"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#FDBA74]" />
              <span className="hidden sm:inline">Scan Disk</span>
            </TactileButton>

            <TactileButton
              variant="amber"
              size="sm"
              onClick={() => setShowAddModal(true)}
              title="Search 950 Offline Catalog or add Watchlist (Ctrl+K)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Anime</span>
            </TactileButton>
          </div>
        </div>
      </header>

      {/* =====================================================================
          SCREEN 1: HOME CATALOG LOBBY (NETFLIX BILLBOARD × ANILIST × STEAM LIBRARY)
         ===================================================================== */}
      {!selectedAnime ? (
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-9">
          {/* 1. NETFLIX / APPLE TV+ HERO BILLBOARD SPOTLIGHT */}
          {heroAnime && (
            <section className="relative rounded-3xl bg-[#111624]/90 border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden">
              {heroAnime.posterUrl && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <img
                    src={heroAnime.posterUrl}
                    alt=""
                    className="w-full h-full object-cover blur-2xl opacity-15 scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F19] via-[#0B0F19]/90 to-[#0B0F19]/60" />
                </div>
              )}

              <div className="relative p-5 sm:p-8 flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                {/* 2:3 Poster Frame with Letterboxd 1px Inner Glass Ring */}
                <div
                  onClick={() => {
                    setSelectedId(heroAnime.id);
                    setSelectedPart('ALL');
                  }}
                  className="relative w-36 sm:w-44 aspect-[2/3] rounded-2xl overflow-hidden bg-slate-900 ring-1 ring-inset ring-white/15 shadow-2xl shrink-0 cursor-pointer group"
                >
                  {heroAnime.posterUrl ? (
                    <img
                      src={heroAnime.posterUrl}
                      alt={heroAnime.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-10 h-10 text-slate-600" />
                    </div>
                  )}
                </div>

                {/* Billboard Editorial Copy & Telemetry */}
                <div className="flex-1 min-w-0 space-y-4 text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F97316]/15 text-[#FB923C] border border-[#F97316]/30 text-[11px] font-black uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
                      {heroAnime.status === 'watching' ? 'Continue Watching' : 'Featured Series'}
                    </span>

                    {heroAnime.score && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FDBA74]/15 text-[#FDBA74] border border-[#FDBA74]/30 text-[11px] font-black tabular-nums">
                        <Star className="w-3 h-3 fill-[#FDBA74]" />
                        {heroAnime.score}
                      </span>
                    )}

                    {heroAnime.studio && (
                      <button
                        onClick={() =>
                          setSelectedStudio((prev) =>
                            prev === heroAnime.studio ? '' : heroAnime.studio || ''
                          )
                        }
                        className="px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08] text-[11px] font-extrabold cursor-pointer"
                        title="Filter library by studio"
                      >
                        {heroAnime.studio}
                      </button>
                    )}

                    {heroAnime.hasLocalFiles ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 text-[11px] font-extrabold tabular-nums">
                        <HardDrive className="w-3 h-3" />
                        {heroAnime.localFiles?.length} MKV • {formatDiskSize(heroAnime.totalDiskMB)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.05] text-slate-300 border border-white/[0.08] text-[11px] font-bold">
                        <Archive className="w-3 h-3 text-[#FDBA74]" />
                        {heroAnime.archivedAt ? 'Archived in Vault' : 'Watchlist Tracker'}
                      </span>
                    )}
                  </div>

                  <div>
                    <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                      {heroAnime.title}
                    </h1>
                    {heroAnime.genres && heroAnime.genres.length > 0 && (
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-2">
                        {heroAnime.genres.map((g) => (
                          <button
                            key={g}
                            onClick={() =>
                              setSelectedGenre((prev) => (prev === g ? 'ALL' : g))
                            }
                            className="text-xs font-bold text-slate-400 hover:text-[#FDBA74] px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] cursor-pointer"
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Episode Scrubber & Time Remaining Readout (Netflix Style) */}
                  <div className="max-w-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-extrabold tabular-nums">
                      <span className="text-white">
                        Episode {heroAnime.currentEpisodeLabel}{' '}
                        <span className="text-slate-400">
                          of {heroAnime.totalEpisodes || '?'}
                        </span>
                      </span>
                      <span className="text-[#FDBA74]">
                        {formatTime(heroAnime.currentSeconds)} /{' '}
                        {formatTime(heroAnime.durationSeconds || 1420)}
                        <span className="text-slate-400 ml-2">
                          (
                          {Math.max(
                            1,
                            Math.ceil(
                              ((heroAnime.durationSeconds || 1420) - heroAnime.currentSeconds) /
                                60
                            )
                          )}
                          m left)
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full bg-[#F97316]"
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

                  {/* Primary Action Row with Smart Auto-Advance ("Up Next") */}
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
                                  variant="slate"
                                  size="md"
                                  onClick={() => handlePlayMpv(heroAnime)}
                                >
                                  <Clock className="w-4 h-4 text-[#FDBA74]" />
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
                        <span>Prepare Local Video Folder</span>
                      </TactileButton>
                    )}

                    <TactileButton
                      variant="slate"
                      size="md"
                      onClick={() => {
                        setSelectedId(heroAnime.id);
                        setSelectedPart('ALL');
                      }}
                    >
                      <span>Episodes &amp; Details</span>
                      <ChevronRight className="w-4 h-4" />
                    </TactileButton>

                    <TactileButton
                      variant="white"
                      size="md"
                      onClick={() => handleQuickIncrementEpisode(heroAnime)}
                      title="Mark current episode watched and advance +1 episode"
                    >
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>+1 Ep</span>
                    </TactileButton>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 2. COLLECTOR ANALYTICS & STEAM STORAGE TELEMETRY BAR */}
          <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#111624] border border-white/[0.07] flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#F97316]/10 text-[#F97316]">
                <Tv className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Watch Time
                </p>
                <p className="text-sm sm:text-base font-black text-white tabular-nums">
                  {collectorStats.hoursWatched} hrs{' '}
                  <span className="text-xs font-bold text-slate-400">
                    ({collectorStats.totalWatchedEps} eps)
                  </span>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#111624] border border-white/[0.07] flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-[#FDBA74]">
                <Star className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Mean Score
                </p>
                <p className="text-sm sm:text-base font-black text-white tabular-nums">
                  {collectorStats.avgScore}{' '}
                  <span className="text-xs font-bold text-slate-400">/ 10</span>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#111624] border border-white/[0.07] flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Local SSD Storage
                </p>
                <p className="text-sm sm:text-base font-black text-white tabular-nums">
                  {formatDiskSize(collectorStats.totalDiskMB)}{' '}
                  <span className="text-xs font-bold text-slate-400">
                    ({collectorStats.totalFiles} mkv)
                  </span>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#111624] border border-white/[0.07] flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Top Affinity
                </p>
                <p className="text-sm font-black text-white truncate">
                  {collectorStats.topGenre}
                </p>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-4 lg:col-span-1 p-3.5 rounded-2xl bg-[#111624] border border-white/[0.07] flex items-center justify-between lg:justify-center gap-2">
              <button
                onClick={handleExportBackup}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-extrabold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                title="Export portable JSON backup of your entire library"
              >
                <Download className="w-3.5 h-3.5 text-[#FDBA74]" />
                <span>Backup</span>
              </button>
              <button
                onClick={() => fileImportRef.current?.click()}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-extrabold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                title="Restore or merge from a JSON backup file"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Restore</span>
              </button>
            </div>
          </section>

          {/* 3. MAIN LIBRARY & WATCHLIST VAULT (LINEAR SEGMENTED CONTROLS × LETTERBOXD GRID) */}
          <section className="space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              {/* Segmented Status Tabs (Zero Emoji, Pure Architectural Pills) */}
              <div className="inline-flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-[#111624] border border-white/[0.07]">
                {(
                  [
                    { id: 'all', label: 'All Library', count: tabCounts.all, dot: 'bg-slate-400' },
                    {
                      id: 'watching',
                      label: 'Watching',
                      count: tabCounts.watching,
                      dot: 'bg-[#F97316]',
                    },
                    {
                      id: 'completed',
                      label: 'Completed / Watched',
                      count: tabCounts.completed,
                      dot: 'bg-emerald-400',
                    },
                    {
                      id: 'plan',
                      label: 'Watchlist',
                      count: tabCounts.plan,
                      dot: 'bg-[#FDBA74]',
                    },
                    {
                      id: 'on_hold',
                      label: 'On Hold',
                      count: tabCounts.on_hold,
                      dot: 'bg-sky-400',
                    },
                  ] as const
                ).map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-opacity ${
                        active
                          ? 'bg-[#1D263B] text-white border border-white/15 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />
                      <span>{tab.label}</span>
                      <span className="px-1.5 py-0.2 rounded-md bg-black/30 text-[10px] font-black text-slate-300 tabular-nums">
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right Filter, Sort, & View Switcher Bar */}
              <div className="flex flex-wrap items-center gap-2.5">
                {selectedStudio && (
                  <button
                    onClick={() => setSelectedStudio('')}
                    className="px-2.5 py-1.5 rounded-xl bg-[#F97316]/15 border border-[#F97316]/40 text-xs font-extrabold text-[#FDBA74] flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Studio: {selectedStudio}</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Filter library... (Press /)"
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#111624] border border-white/[0.08] text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F97316]"
                  />
                </div>

                {/* Sort Segmented Pill */}
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#111624] border border-white/[0.08] text-[11px] font-extrabold">
                  <SlidersHorizontal className="w-3 h-3 text-slate-400 ml-1.5 mr-0.5" />
                  {(
                    [
                      { id: 'recent', label: 'Recent' },
                      { id: 'score', label: 'Score' },
                      { id: 'disk', label: 'Disk' },
                      { id: 'title', label: 'A-Z' },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSortBy(s.id)}
                      className={`px-2 py-1 rounded-lg cursor-pointer ${
                        sortBy === s.id
                          ? 'bg-[#1D263B] text-[#FDBA74]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* View Mode Switcher (Poster Grid vs Compact Table) */}
                <div className="inline-flex items-center p-1 rounded-xl bg-[#111624] border border-white/[0.08]">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-[#1D263B] text-[#FDBA74]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Cinema Poster Grid View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      viewMode === 'table'
                        ? 'bg-[#1D263B] text-[#FDBA74]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Compact Collector Table View"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Genre Filter Chips (Spotify / Max Style) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedGenre('ALL')}
                className={`px-3 py-1 rounded-full text-xs font-extrabold shrink-0 cursor-pointer border ${
                  selectedGenre === 'ALL'
                    ? 'bg-[#FFFDF8] text-[#090C15] border-white'
                    : 'bg-[#111624] text-slate-400 hover:text-white border-white/[0.07]'
                }`}
              >
                All Genres
              </button>
              {POPULAR_GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() =>
                    setSelectedGenre((prev) => (prev === genre ? 'ALL' : genre))
                  }
                  className={`px-3 py-1 rounded-full text-xs font-extrabold shrink-0 cursor-pointer border ${
                    selectedGenre === genre
                      ? 'bg-[#F97316] text-[#090C15] border-[#FDBA74]'
                      : 'bg-[#111624] text-slate-400 hover:text-white border-white/[0.07]'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="p-16 text-center font-extrabold text-slate-400">
                Loading Anideck Library...
              </div>
            ) : filteredAnimes.length === 0 ? (
              <div className="bg-[#111624] rounded-3xl border border-white/[0.07] p-12 text-center space-y-3">
                <Film className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-base font-black text-white">
                  No anime found in this view
                </p>
                <p className="text-xs font-bold text-slate-400 max-w-md mx-auto">
                  Click <strong>Add Anime</strong> to search the 950-anime offline database or place
                  a video folder inside <code>Anideck/anime/</code>.
                </p>
                <TactileButton variant="amber" size="md" onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4" />
                  <span>Explore 950 Offline Catalog</span>
                </TactileButton>
              </div>
            ) : viewMode === 'grid' ? (
              /* VIEW 1: GALLERY-GRADE 2:3 POSTER GRID (LETTERBOXD × CRUNCHYROLL) */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {filteredAnimes.map((anime) => {
                  const dur = anime.durationSeconds || 1420;
                  const pct = Math.min(100, Math.round((anime.currentSeconds / dur) * 100));

                  return (
                    <div
                      key={anime.id}
                      onClick={() => {
                        setSelectedId(anime.id);
                        setSelectedPart('ALL');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="group bg-[#111624] rounded-2xl border border-white/[0.08] hover:border-[#F97316]/70 overflow-hidden cursor-pointer flex flex-col justify-between transition-transform duration-150 hover:-translate-y-1 shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
                    >
                      {/* 2:3 Poster Image with 1px Inner Ring */}
                      <div className="relative aspect-[2/3] w-full bg-slate-900 overflow-hidden ring-1 ring-inset ring-white/10">
                        {anime.posterUrl ? (
                          <img
                            src={anime.posterUrl}
                            alt={anime.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                            <Film className="w-10 h-10 text-slate-600 mb-2" />
                            <span className="text-xs font-black text-slate-400">{anime.title}</span>
                          </div>
                        )}

                        {/* Top-Left Score Badge */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
                          {(anime.personalRating || anime.score) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#090C15]/90 backdrop-blur-md text-[#FDBA74] border border-white/10 text-[11px] font-black tabular-nums">
                              <Star className="w-3 h-3 fill-[#FDBA74]" />
                              {anime.personalRating ? `${anime.personalRating}/10` : anime.score}
                            </span>
                          )}
                        </div>

                        {/* Top-Right Storage / Archive Telemetry Pill */}
                        <div className="absolute top-2.5 right-2.5">
                          {anime.hasLocalFiles ? (
                            <span className="px-2 py-0.5 rounded-md bg-[#090C15]/90 backdrop-blur-md text-emerald-400 border border-emerald-500/30 text-[10px] font-black tabular-nums">
                              {formatDiskSize(anime.totalDiskMB)}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-[#090C15]/90 backdrop-blur-md text-slate-300 border border-white/10 text-[10px] font-bold">
                              {anime.status === 'completed' ? 'Archived' : 'Tracker'}
                            </span>
                          )}
                        </div>

                        {/* Hover Quick-Action Overlay (Netflix / AniList Circular Controls) */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute inset-x-2.5 bottom-14 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-between gap-1.5 bg-[#090C15]/90 backdrop-blur-md p-1.5 rounded-xl border border-white/15"
                        >
                          {anime.hasLocalFiles ? (
                            <button
                              onClick={() => handlePlayMpv(anime)}
                              className="flex-1 py-1 px-2 rounded-lg bg-[#F97316] text-[#090C15] text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Play</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedId(anime.id);
                                setSelectedPart('ALL');
                              }}
                              className="flex-1 py-1 px-2 rounded-lg bg-white/10 text-white text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>Open</span>
                            </button>
                          )}

                          {anime.status !== 'completed' && (
                            <button
                              onClick={(e) => handleQuickIncrementEpisode(anime, e)}
                              className="py-1 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-black cursor-pointer tabular-nums"
                              title="Advance +1 Episode"
                            >
                              +1 Ep
                            </button>
                          )}

                          {anime.hasLocalFiles && (
                            <button
                              onClick={() => setCleaningAnime(anime)}
                              className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 cursor-pointer"
                              title="Free Up Disk Space (Delete .mkv • Keep Poster & Watched Record)"
                            >
                              <HardDrive className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Bottom Gradient Title & Status Pill */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#090C15] via-[#090C15]/85 to-transparent p-3 pt-10">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                anime.status === 'watching'
                                  ? 'bg-[#F97316]'
                                  : anime.status === 'completed'
                                    ? 'bg-emerald-400'
                                    : anime.status === 'plan'
                                      ? 'bg-[#FDBA74]'
                                      : 'bg-sky-400'
                              }`}
                            />
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                              {anime.status === 'watching' && `EP ${anime.currentEpisodeLabel}`}
                              {anime.status === 'completed' &&
                                (anime.hasLocalFiles ? 'COMPLETED' : 'WATCHED • ARCHIVED')}
                              {anime.status === 'plan' && 'WATCHLIST'}
                              {anime.status === 'on_hold' && 'ON HOLD'}
                            </span>
                          </div>
                          <h3 className="font-black text-sm text-white line-clamp-1 group-hover:text-[#FDBA74]">
                            {anime.title}
                          </h3>
                        </div>
                      </div>

                      {/* Card Footer Telemetry */}
                      <div className="p-3 bg-[#111624] space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-400 tabular-nums">
                          <span>
                            {anime.status === 'completed'
                              ? `${anime.totalEpisodes || '?'} Eps Watched`
                              : `Ep ${anime.currentEpisodeLabel} / ${anime.totalEpisodes || '?'}`}
                          </span>
                          {anime.status !== 'completed' ? (
                            <span className="text-[#FDBA74] font-black">
                              {formatTime(anime.currentSeconds)}
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-extrabold text-[11px]">
                              {anime.completedAt || 'Completed'}
                            </span>
                          )}
                        </div>

                        {/* Signature Crunchyroll 2px Progress Bar */}
                        <div className="w-full h-1 rounded-full bg-white/[0.07] overflow-hidden">
                          <div
                            className={`h-full ${
                              anime.status === 'completed' ? 'bg-emerald-400' : 'bg-[#F97316]'
                            }`}
                            style={{
                              width: `${
                                anime.status === 'completed' ? 100 : Math.max(5, pct)
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
              /* VIEW 2: COMPACT COLLECTOR TABLE VIEW (LINEAR × ANILIST LEDGER) */
              <div className="bg-[#111624] rounded-2xl border border-white/[0.08] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-[10px] font-black uppercase tracking-wider text-slate-400 bg-[#0D111C]">
                        <th className="py-3 px-4">Series</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Progress</th>
                        <th className="py-3 px-3">Timestamp</th>
                        <th className="py-3 px-3">Score</th>
                        <th className="py-3 px-3">Storage</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06] text-xs font-bold">
                      {filteredAnimes.map((anime) => (
                        <tr
                          key={anime.id}
                          onClick={() => {
                            setSelectedId(anime.id);
                            setSelectedPart('ALL');
                          }}
                          className="hover:bg-white/[0.03] cursor-pointer"
                        >
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={anime.posterUrl}
                                alt={anime.title}
                                className="w-9 h-12 rounded-lg object-cover bg-slate-900 ring-1 ring-white/10 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-black text-white truncate max-w-xs">
                                  {anime.title}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {anime.studio || 'Studio'} •{' '}
                                  {anime.genres?.slice(0, 2).join(', ') || 'Anime'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-[11px] font-extrabold text-slate-200 uppercase">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  anime.status === 'watching'
                                    ? 'bg-[#F97316]'
                                    : anime.status === 'completed'
                                      ? 'bg-emerald-400'
                                      : 'bg-[#FDBA74]'
                                }`}
                              />
                              {anime.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-white font-black">
                            Ep {anime.currentEpisodeLabel} / {anime.totalEpisodes || '?'}
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-[#FDBA74] font-black">
                            {anime.status === 'completed'
                              ? 'Done'
                              : formatTime(anime.currentSeconds)}
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-white">
                            {anime.personalRating || anime.score || '-'}
                          </td>
                          <td className="py-2.5 px-3 tabular-nums">
                            {anime.hasLocalFiles ? (
                              <span className="text-emerald-400">
                                {formatDiskSize(anime.totalDiskMB)}
                              </span>
                            ) : (
                              <span className="text-slate-500">Archived</span>
                            )}
                          </td>
                          <td
                            className="py-2.5 px-4 text-right"
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
                              {anime.status !== 'completed' && (
                                <TactileButton
                                  variant="white"
                                  size="sm"
                                  onClick={(e) => handleQuickIncrementEpisode(anime, e)}
                                >
                                  <span>+1 Ep</span>
                                </TactileButton>
                              )}
                              {anime.hasLocalFiles && (
                                <button
                                  onClick={() => setCleaningAnime(anime)}
                                  className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 cursor-pointer"
                                  title="Free Up Disk Space (Keep Poster in Watched)"
                                >
                                  <HardDrive className="w-3.5 h-3.5" />
                                </button>
                              )}
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

          {/* 4. OFFLINE RECOMMENDATION ENGINE (ANILIST AFFINITY % × LETTERBOXD CARDS) */}
          {recommendations.length > 0 && (
            <section className="space-y-4 pt-4 border-t border-white/[0.08]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-6 rounded-full bg-[#FDBA74]" />
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                        Recommended For You
                      </h2>
                      <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-700/50">
                        <Sparkles className="w-3 h-3" />
                        100% Offline Engine ({OFFLINE_CATALOG_COUNT} Anime)
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-400">
                      Computed locally with zero internet based on genre &amp; studio affinity with
                      your library
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <TactileButton
                    variant="white"
                    size="sm"
                    onClick={() => setRandomPick(getRandomOfflinePick(animes, selectedGenre))}
                  >
                    <Shuffle className="w-3.5 h-3.5 text-[#FDBA74]" />
                    <span>Random Pick</span>
                  </TactileButton>
                  <TactileButton
                    variant="slate"
                    size="sm"
                    onClick={() => {
                      setNewStatus('plan');
                      setShowAddModal(true);
                    }}
                  >
                    <Search className="w-3.5 h-3.5 text-[#FDBA74]" />
                    <span>Browse All {OFFLINE_CATALOG_COUNT} Anime</span>
                  </TactileButton>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {recommendations.map((rec) => {
                  const title = rec.title_english || rec.title;
                  const rawPoster =
                    rec.images?.jpg?.large_image_url || rec.images?.jpg?.image_url || '';
                  const cachedPosterUrl = rawPoster
                    ? `/api/cached-poster?id=${rec.mal_id}&url=${encodeURIComponent(rawPoster)}`
                    : '';

                  return (
                    <div
                      key={rec.mal_id}
                      className="group bg-[#111624] rounded-2xl border border-white/[0.08] hover:border-[#FDBA74]/60 overflow-hidden shadow-[0_8px_22px_rgba(0,0,0,0.45)] flex flex-col justify-between transition-transform duration-150 hover:-translate-y-1"
                    >
                      <div>
                        <div className="relative aspect-[2/3] w-full bg-slate-900 overflow-hidden ring-1 ring-inset ring-white/10">
                          {cachedPosterUrl ? (
                            <img
                              src={cachedPosterUrl}
                              alt={title}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center p-4 text-center">
                              <Film className="w-10 h-10 text-slate-700" />
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-[#090C15] via-[#090C15]/20 to-transparent" />

                          {/* Top Match % & Score Badges */}
                          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 tabular-nums">
                              {rec.matchPercent}% Match
                            </span>
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-[#090C15]/90 text-[#FDBA74] border border-white/10 tabular-nums">
                              <Star className="w-2.5 h-2.5 fill-[#FDBA74]" />
                              {rec.score || '-'}
                            </span>
                          </div>

                          {/* Bottom Affinity Reason */}
                          <div className="absolute bottom-2 left-2.5 right-2.5">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#090C15]/90 backdrop-blur-md text-slate-200 border border-white/10 line-clamp-1">
                              {rec.reason}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 space-y-1">
                          <h3
                            className="font-black text-sm text-white line-clamp-1 group-hover:text-[#FDBA74]"
                            title={title}
                          >
                            {title}
                          </h3>
                          <p className="text-[11px] font-bold text-slate-400 line-clamp-1 tabular-nums">
                            {rec.studios?.[0]?.name || 'Anime Studio'} • {rec.episodes || '?'} Eps
                            {rec.year ? ` • ${rec.year}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="p-3 pt-0 flex items-center gap-1.5">
                        <TactileButton
                          variant="amber"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAddFromJikan(rec, 'plan')}
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>Watchlist</span>
                        </TactileButton>
                        <button
                          onClick={() => handleAddFromJikan(rec, 'watching')}
                          className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] text-slate-200 border border-white/[0.08] cursor-pointer"
                          title="Start Watching Now"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      ) : (
        /* =====================================================================
           SCREEN 2: SERIES DETAIL, STORAGE MANAGER, SCENE BOOKMARKS & EPISODES
           ===================================================================== */
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
          <section className="bg-[#111624]/95 rounded-3xl border border-white/[0.08] shadow-[0_16px_45px_rgba(0,0,0,0.6)] p-5 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
              {/* Left Column: 2:3 Cinema Poster + Rematch & Storage Actions */}
              <div className="lg:col-span-3 flex flex-col items-center sm:items-start gap-3">
                <div className="relative w-48 sm:w-full max-w-[230px] aspect-[2/3] rounded-2xl overflow-hidden ring-1 ring-inset ring-white/15 shadow-2xl bg-slate-900">
                  {selectedAnime.posterUrl ? (
                    <img
                      src={selectedAnime.posterUrl}
                      alt={selectedAnime.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                      <Film className="w-12 h-12 text-slate-600 mb-2" />
                      <span className="font-black text-sm text-slate-300">
                        {selectedAnime.title}
                      </span>
                    </div>
                  )}
                  {selectedAnime.posterUrl?.startsWith('/api/poster/') && (
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-[#090C15]/90 backdrop-blur-md border border-emerald-500/30 text-emerald-300 text-[10px] font-black flex items-center justify-center gap-1.5">
                      <HardDrive className="w-3 h-3" />
                      <span>Local Poster Locked</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setRematchingAnime(selectedAnime);
                    setSearchQuery(selectedAnime.title);
                  }}
                  className="w-48 sm:w-full max-w-[230px] px-3 py-2 rounded-xl bg-[#090C15] hover:bg-slate-800/80 border border-white/[0.08] text-xs font-extrabold text-slate-300 hover:text-[#FDBA74] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#FDBA74]" />
                  <span>Change Poster / Metadata</span>
                </button>

                {/* Steam-style Storage Manager Card on Left Column */}
                <div className="w-48 sm:w-full max-w-[230px] p-3.5 rounded-2xl bg-[#090C15] border border-white/[0.08] space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-extrabold">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                      Disk Space
                    </span>
                    <span className="text-white tabular-nums">
                      {selectedAnime.hasLocalFiles
                        ? formatDiskSize(selectedAnime.totalDiskMB)
                        : '0 MB (Archived)'}
                    </span>
                  </div>

                  {selectedAnime.hasLocalFiles ? (
                    <TactileButton
                      variant="slate"
                      size="sm"
                      className="w-full"
                      onClick={() => setCleaningAnime(selectedAnime)}
                    >
                      <Archive className="w-3.5 h-3.5 text-[#FDBA74]" />
                      <span>Free Disk Space (.mkv)</span>
                    </TactileButton>
                  ) : (
                    <p className="text-[11px] font-bold text-emerald-400/90 leading-relaxed">
                      Poster, rating &amp; watch history are permanently saved in your library.
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Series Metadata & Precision Episode/Timestamp Monitor */}
              <div className="lg:col-span-9 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedAnime.score && (
                        <span className="px-2.5 py-0.5 rounded-md bg-[#FDBA74] text-[#090C15] text-xs font-black flex items-center gap-1 tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-[#090C15]" />
                          Score {selectedAnime.score}
                        </span>
                      )}
                      {selectedAnime.personalRating && (
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-400/15 text-emerald-300 border border-emerald-500/30 text-xs font-black tabular-nums">
                          Your Rating: {selectedAnime.personalRating}/10
                        </span>
                      )}
                      {selectedAnime.studio && (
                        <span className="px-2.5 py-0.5 rounded-md bg-white/[0.06] text-slate-200 border border-white/[0.08] text-xs font-extrabold">
                          {selectedAnime.studio}
                        </span>
                      )}
                      {selectedAnime.genres?.map((g) => (
                        <span
                          key={g}
                          className="px-2.5 py-0.5 rounded-md bg-white/[0.03] text-slate-400 border border-white/[0.06] text-xs font-bold"
                        >
                          {g}
                        </span>
                      ))}
                    </div>

                    <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                      {selectedAnime.title}
                    </h2>

                    {selectedAnime.aliases?.length > 0 && (
                      <p className="text-xs font-bold text-slate-400">
                        Alternate Titles: {selectedAnime.aliases.join(' • ')}
                      </p>
                    )}
                  </div>

                  {/* Segmented Status Control & Mark Completed Button */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center p-1 rounded-xl bg-[#090C15] border border-white/[0.08]">
                      {(
                        [
                          { id: 'watching', label: 'Watching' },
                          { id: 'completed', label: 'Completed' },
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
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                            selectedAnime.status === st.id
                              ? 'bg-[#1D263B] text-white border border-white/15'
                              : 'text-slate-400 hover:text-white'
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
                        <span>Mark Completed</span>
                      </TactileButton>
                    )}
                  </div>
                </div>

                {/* DUAL TELEMETRY CARDS: EPISODE COUNTER & TIMESTAMP SCRUBBER */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Current Episode */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#090C15] border border-white/[0.08] flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Tv className="w-4 h-4 text-[#F97316]" />
                        CURRENT EPISODE
                      </span>
                      <span className="text-xs font-extrabold text-emerald-400 tabular-nums">
                        {selectedAnime.watchedEpisodes.length} / {selectedAnime.totalEpisodes || '?'}{' '}
                        Watched
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2 tabular-nums">
                        <span className="text-3xl sm:text-4xl font-black text-white">
                          EP {selectedAnime.currentEpisodeLabel}
                        </span>
                        <span className="text-sm font-extrabold text-slate-500">
                          of {selectedAnime.totalEpisodes || '?'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <TactileButton
                          variant="slate"
                          size="sm"
                          onClick={() => handleStepEpisode(-1)}
                          title="Previous Episode"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </TactileButton>
                        <TactileButton
                          variant="slate"
                          size="sm"
                          onClick={() => handleStepEpisode(1)}
                          title="Next Episode (+1)"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </TactileButton>
                      </div>
                    </div>

                    {selectedAnime.localFiles && selectedAnime.localFiles.length > 0 && (
                      <select
                        value={selectedAnime.currentEpisodeLabel}
                        onChange={(e) => {
                          const found = selectedAnime.localFiles?.find(
                            (f) => f.episodeLabel === e.target.value
                          );
                          if (found) {
                            const savedSec =
                              selectedAnime.episodeProgress?.[found.episodeLabel]?.seconds || 0;
                            saveAnimeUpdate({
                              ...selectedAnime,
                              currentEpisode: found.episodeNum,
                              currentEpisodeLabel: found.episodeLabel,
                              currentSeconds: savedSec,
                            });
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-[#111624] border border-white/[0.08] text-xs font-bold text-slate-200 cursor-pointer"
                      >
                        {selectedAnime.localFiles.map((f) => (
                          <option key={f.id} value={f.episodeLabel}>
                            [{f.part}] Episode {f.episodeLabel} — {f.fileName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Card 2: Timestamp Scrubber */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#090C15] border border-white/[0.08] flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#FDBA74]" />
                        SAVED TIMESTAMP
                      </span>
                      <span className="text-xs font-extrabold text-[#FDBA74] tabular-nums">
                        {progressPct}% Elapsed
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2 tabular-nums">
                        <span className="text-3xl sm:text-4xl font-black text-[#FDBA74]">
                          {formatTime(selectedAnime.currentSeconds)}
                        </span>
                        <span className="text-sm font-extrabold text-slate-500">
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
                          className="w-14 px-2 py-1 text-center font-black text-sm rounded-xl bg-[#111624] border border-white/[0.08] text-white"
                          title="Minutes"
                        />
                        <span className="font-black text-slate-400">:</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={editSec}
                          onChange={(e) => setEditSec(e.target.value)}
                          className="w-14 px-2 py-1 text-center font-black text-sm rounded-xl bg-[#111624] border border-white/[0.08] text-white"
                          title="Seconds"
                        />
                        <TactileButton variant="amber" size="sm" onClick={handleManualTimeSave}>
                          Save
                        </TactileButton>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <input
                        type="range"
                        min={0}
                        max={selectedAnime.durationSeconds || 1420}
                        value={selectedAnime.currentSeconds}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setAnimes((prev) =>
                            prev.map((a) =>
                              a.id === selectedAnime.id
                                ? {
                                    ...a,
                                    currentSeconds: val,
                                    episodeProgress: {
                                      ...a.episodeProgress,
                                      [a.currentEpisodeLabel]: {
                                        seconds: val,
                                        duration: a.durationSeconds || 1420,
                                      },
                                    },
                                  }
                                : a
                            )
                          );
                        }}
                        onMouseUp={() => saveAnimeUpdate(selectedAnime, true)}
                        onTouchEnd={() => saveAnimeUpdate(selectedAnime, true)}
                        className="w-full accent-[#F97316] cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                        <button
                          onClick={() =>
                            saveAnimeUpdate({ ...selectedAnime, currentSeconds: 0 })
                          }
                          className="hover:text-white underline cursor-pointer"
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
                          className="hover:text-[#FDBA74] underline cursor-pointer"
                        >
                          +85s (Skip OP)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PRIMARY PLAY & ARCHIVE ACTIONS */}
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
                            variant="slate"
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
                              : 'Prepare Video Folder in anime/'}
                          </span>
                        </TactileButton>

                        <TactileButton
                          variant="emerald"
                          size="md"
                          onClick={() => handleStepEpisode(1)}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>+1 Episode Completed</span>
                        </TactileButton>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedAnime.folderName && selectedAnime.hasLocalFiles && (
                      <TactileButton
                        variant="slate"
                        size="sm"
                        onClick={() => handleOpenExplorer(selectedAnime.folderName)}
                      >
                        <FolderOpen className="w-4 h-4 text-[#F97316]" />
                        <span>Open Explorer</span>
                      </TactileButton>
                    )}

                    {selectedAnime.hasLocalFiles && (
                      <TactileButton
                        variant="slate"
                        size="sm"
                        onClick={() => setCleaningAnime(selectedAnime)}
                        title="Delete .mkv video files to free SSD space while keeping poster & watched history"
                      >
                        <Archive className="w-4 h-4 text-[#FDBA74]" />
                        <span>Free Disk Space (.mkv)</span>
                      </TactileButton>
                    )}

                    <button
                      onClick={() => handleDeleteAnime(selectedAnime)}
                      className="p-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/70 text-rose-400 border border-rose-800/50 cursor-pointer"
                      title="Remove series card from library"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* SCENE TIMESTAMP BOOKMARKS (POTPLAYER / PLEX CHAPTERS) */}
                <div className="p-4 rounded-2xl bg-[#090C15] border border-white/[0.08] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-[#FDBA74]" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-white">
                        Scene Timestamp Bookmarks
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 flex-1 sm:flex-initial max-w-md">
                      <input
                        type="text"
                        value={bookmarkNote}
                        onChange={(e) => setBookmarkNote(e.target.value)}
                        placeholder={`Note for Ep ${selectedAnime.currentEpisodeLabel} at ${formatTime(selectedAnime.currentSeconds)}...`}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-[#111624] border border-white/[0.08] text-xs font-bold text-white"
                      />
                      <TactileButton variant="slate" size="sm" onClick={handleAddBookmark}>
                        <Plus className="w-3.5 h-3.5 text-[#FDBA74]" />
                        <span>Bookmark Scene</span>
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
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111624] border border-white/[0.08] text-xs font-bold"
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
                              className="flex items-center gap-1.5 text-left hover:text-[#FDBA74] cursor-pointer"
                            >
                              <Play className="w-3 h-3 text-[#F97316] fill-current" />
                              <span className="font-black text-[#FDBA74] tabular-nums">
                                Ep {bm.episodeLabel} • {formatTime(bm.seconds)}
                              </span>
                              <span className="text-slate-200">— {bm.label}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteBookmark(bm.id)}
                              className="text-slate-500 hover:text-rose-400 cursor-pointer"
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

            {/* EPISODE LIST VAULT (CRUNCHYROLL × PLEX FILE INSPECTOR) */}
            {selectedAnime.hasLocalFiles && selectedAnime.localFiles && (
              <div className="mt-8 pt-7 border-t border-white/[0.08] space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <span>Episodes ({selectedAnime.localFiles.length} Local MKV Files)</span>
                    </h3>
                    <p className="text-xs font-bold text-slate-400">
                      Click <strong>Play MPV</strong> to launch at your saved timestamp, or clean
                      individual watched episodes to save SSD space.
                    </p>
                  </div>

                  {parts.length > 1 && (
                    <div className="flex items-center gap-2">
                      <TactileButton
                        variant={selectedPart === 'ALL' ? 'amber' : 'white'}
                        size="sm"
                        onClick={() => setSelectedPart('ALL')}
                      >
                        All ({selectedAnime.localFiles.length})
                      </TactileButton>
                      {parts.map((p) => (
                        <TactileButton
                          key={p}
                          variant={selectedPart === p ? 'amber' : 'white'}
                          size="sm"
                          onClick={() => setSelectedPart(p)}
                        >
                          {p}
                        </TactileButton>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredEpisodes.map((file) => {
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
                        className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
                          isCurrent
                            ? 'bg-[#172036] border-[#F97316]'
                            : isWatched
                              ? 'bg-[#090C15]/90 border-emerald-800/40 opacity-85'
                              : 'bg-[#090C15] border-white/[0.07] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              onClick={() => toggleWatchedEpisode(file.episodeLabel)}
                              title="Toggle episode watched state"
                              className={`w-11 h-11 rounded-xl border flex flex-col items-center justify-center shrink-0 font-black cursor-pointer tabular-nums ${
                                isWatched
                                  ? 'bg-emerald-500 text-[#090C15] border-emerald-400'
                                  : isCurrent
                                    ? 'bg-[#F97316] text-[#090C15] border-amber-300'
                                    : 'bg-[#111624] text-slate-200 border-white/10'
                              }`}
                            >
                              {isWatched ? (
                                <Check className="w-5 h-5 stroke-[3]" />
                              ) : (
                                <span className="text-sm">{file.episodeLabel}</span>
                              )}
                            </button>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-black text-white">
                                  Episode {file.episodeLabel}
                                </span>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 rounded bg-[#F97316] text-[#090C15] text-[10px] font-black uppercase">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p
                                className="text-[11px] font-bold text-slate-400 truncate"
                                title={file.fileName}
                              >
                                {file.part} • {file.sizeMB} MB
                              </p>
                              <p className="text-[11px] font-extrabold text-[#FDBA74] mt-0.5 tabular-nums">
                                {savedSec > 5
                                  ? `Stopped at ${formatTime(savedSec)} (${epPct}%)`
                                  : isWatched
                                    ? 'Completed'
                                    : 'Not started'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => markWatchedUpTo(file)}
                              title={`Mark Episodes 01 to ${file.episodeLabel} as watched`}
                              className="p-1.5 rounded-lg bg-[#111624] hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-white/[0.08] cursor-pointer"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete Episode ${file.episodeLabel} video file (${file.sizeMB} MB) from disk and mark it as Watched?`
                                  )
                                ) {
                                  handleDeleteVideos(selectedAnime, 'single', file);
                                }
                              }}
                              title={`Delete Ep ${file.episodeLabel} .mkv file (${file.sizeMB} MB) to save disk space`}
                              className="p-1.5 rounded-lg bg-[#111624] hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-white/[0.08] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <TactileButton
                              variant={isCurrent ? 'amber' : 'slate'}
                              size="sm"
                              onClick={() => handlePlayMpv(selectedAnime, file)}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Play</span>
                            </TactileButton>
                          </div>
                        </div>

                        <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className={`h-full ${
                              isWatched ? 'bg-emerald-400' : 'bg-[#F97316]'
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
          MODAL 1: ADD / SEARCH ANIME (UNIFIED CARA 1 + CARA 2 • 950 OFFLINE DB)
         ===================================================================== */}
      {(showAddModal || rematchingAnime) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111624] w-full max-w-2xl rounded-3xl border border-white/15 shadow-2xl p-6 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  {rematchingAnime
                    ? `Change Poster & Metadata: "${rematchingAnime.title}"`
                    : 'Add Anime to Library (100% Offline Engine)'}
                </h3>
                <p className="text-xs font-bold text-slate-400">
                  {rematchingAnime
                    ? 'Select a match below to overwrite the local poster in anime/.posters/'
                    : `Powered by ${OFFLINE_CATALOG_COUNT} embedded anime records (0ms offline search) + Local MKV Auto-Scanner`}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setRematchingAnime(null);
                }}
                className="p-2 rounded-xl bg-[#090C15] border border-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!rematchingAnime && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#090C15] border border-emerald-500/30 flex flex-col justify-between gap-2.5">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-700/50 mb-1">
                      <HardDrive className="w-3 h-3" />
                      Method 1 • Have Local .MKV Files
                    </span>
                    <h4 className="text-xs font-black text-white">
                      Place Anime Folder in <code className="text-emerald-300">Anideck/anime/</code>
                    </h4>
                    <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                      Drop your downloaded <code>.mkv</code> folder and click Scan. Episodes, MPV
                      timestamps, and posters link automatically.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TactileButton
                      type="button"
                      variant="slate"
                      size="sm"
                      onClick={() => handleOpenExplorer()}
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-[#FDBA74]" />
                      <span>Open anime/</span>
                    </TactileButton>
                    <TactileButton
                      type="button"
                      variant="emerald"
                      size="sm"
                      onClick={() => {
                        setShowAddModal(false);
                        fetchLibrary(true);
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Auto-Scan Now</span>
                    </TactileButton>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#090C15] border border-amber-500/30 flex flex-col justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-950 text-[#FDBA74] border border-amber-700/50 mb-1">
                      <Bookmark className="w-3 h-3" />
                      Method 2 • Build Watchlist / Log History
                    </span>
                    <h4 className="text-xs font-black text-white">
                      Search {OFFLINE_CATALOG_COUNT} Offline Anime Database Below
                    </h4>
                    <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                      Add any anime to your Watchlist or Completed vault without needing video
                      files. Auto-links if you download the videos later.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!rematchingAnime && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#090C15] border border-white/[0.08]">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Target Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) =>
                      setNewStatus(e.target.value as 'watching' | 'completed' | 'plan')
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#111624] border border-white/10 text-xs font-black text-white"
                  >
                    <option value="plan">Watchlist (Plan to Watch)</option>
                    <option value="watching">Currently Watching</option>
                    <option value="completed">Completed / Watched</option>
                  </select>
                </div>

                {newStatus === 'watching' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                        Current Episode
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={newEp}
                        onChange={(e) => setNewEp(parseInt(e.target.value || '1', 10))}
                        className="w-full px-3 py-1.5 rounded-xl bg-[#111624] border border-white/10 text-sm font-black text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                        Last Minute
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={newMin}
                        onChange={(e) => setNewMin(parseInt(e.target.value || '0', 10))}
                        className="w-full px-3 py-1.5 rounded-xl bg-[#111624] border border-white/10 text-sm font-black text-white"
                      />
                    </div>
                  </>
                )}

                {newStatus === 'completed' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                        Personal Rating (1-10)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={newRating}
                        onChange={(e) => setNewRating(parseInt(e.target.value || '9', 10))}
                        className="w-full px-3 py-1.5 rounded-xl bg-[#111624] border border-white/10 text-sm font-black text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                        Short Review
                      </label>
                      <input
                        type="text"
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        placeholder="Masterpiece!"
                        className="w-full px-3 py-1.5 rounded-xl bg-[#111624] border border-white/10 text-sm font-bold text-white"
                      />
                    </div>
                  </>
                )}

                {newStatus === 'plan' && (
                  <div className="sm:col-span-2 flex items-center text-xs font-bold text-slate-400">
                    Save series to your Watchlist now; if you download the .mkv folder later,
                    Anideck will automatically link it.
                  </div>
                )}
              </div>
            )}

            {/* Search Input + Quick Catalog Filters */}
            <div className="space-y-2.5">
              <form onSubmit={handleSearchMal} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${OFFLINE_CATALOG_COUNT} offline anime by title or studio (e.g., Frieren, MAPPA, Steins;Gate)...`}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#090C15] border border-white/10 text-sm font-extrabold text-white"
                    autoFocus
                  />
                </div>
                {!rematchingAnime && searchQuery.trim() && (
                  <TactileButton type="button" variant="slate" size="md" onClick={handleAddManual}>
                    Save Manual
                  </TactileButton>
                )}
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setModalGenreFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                      modalGenreFilter === 'ALL'
                        ? 'bg-[#F97316] text-[#090C15]'
                        : 'bg-[#090C15] text-slate-400 hover:text-white border border-white/[0.07]'
                    }`}
                  >
                    All
                  </button>
                  {POPULAR_GENRES.slice(0, 6).map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() =>
                        setModalGenreFilter((prev) => (prev === g ? 'ALL' : g))
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                        modalGenreFilter === g
                          ? 'bg-[#F97316] text-[#090C15]'
                          : 'bg-[#090C15] text-slate-400 hover:text-white border border-white/[0.07]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setModalShortOnly((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer ${
                    modalShortOnly
                      ? 'bg-emerald-400/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-[#090C15] text-slate-400 border-white/[0.07]'
                  }`}
                >
                  Short Series (&le;13 Eps)
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
                <span>
                  {searchQuery.trim()
                    ? `Instant Results (${jikanResults.length} Matches)`
                    : `Top Curated in Local Database (${OFFLINE_CATALOG_COUNT} Offline)`}
                </span>
                <span>{searchingMal ? 'Checking...' : '0ms Local Engine'}</span>
              </div>

              {jikanResults.map((item) => {
                const canonicalTitle = item.title_english || item.title;
                const existing = !rematchingAnime
                  ? checkDuplicate(canonicalTitle, item.mal_id)
                  : undefined;
                const rawThumb =
                  item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '';
                const thumbUrl = rawThumb
                  ? `/api/cached-poster?id=${item.mal_id}&url=${encodeURIComponent(rawThumb)}`
                  : '';

                return (
                  <div
                    key={item.mal_id}
                    className="p-3 rounded-2xl bg-[#090C15] border border-white/[0.08] hover:border-white/20 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={thumbUrl}
                        alt={item.title}
                        loading="lazy"
                        className="w-12 h-16 object-cover rounded-lg ring-1 ring-white/10 shrink-0 bg-slate-900"
                      />
                      <div className="min-w-0">
                        <h4 className="font-black text-sm text-white truncate">
                          {canonicalTitle}
                        </h4>
                        <p className="text-xs font-bold text-slate-400 truncate tabular-nums">
                          {item.studios?.[0]?.name || item.title} • {item.episodes || '?'} Eps •
                          Score {item.score || '-'}
                        </p>
                        {item.genres && item.genres.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.genres.slice(0, 3).map((g) => (
                              <span
                                key={g.name}
                                className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#111624] text-slate-300 border border-white/[0.06]"
                              >
                                {g.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {existing && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-amber-950 text-[#FDBA74] border border-amber-700/50 text-[10px] font-black">
                            <AlertTriangle className="w-3 h-3" />
                            Already in {existing.status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!rematchingAnime && !existing && newStatus !== 'plan' && (
                        <TactileButton
                          variant="slate"
                          size="sm"
                          onClick={() => handleAddFromJikan(item, 'plan')}
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>Watchlist</span>
                        </TactileButton>
                      )}
                      <TactileButton
                        variant={existing ? 'slate' : 'emerald'}
                        size="sm"
                        onClick={() => handleAddFromJikan(item)}
                      >
                        {rematchingAnime
                          ? 'Use This Poster'
                          : existing
                            ? 'Open'
                            : newStatus === 'plan'
                              ? '+ Watchlist'
                              : newStatus === 'completed'
                                ? '+ Completed'
                                : '+ Watching'}
                      </TactileButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: MARK COMPLETED + OPTIONAL STEAM-STYLE .MKV STORAGE CLEANER
         ===================================================================== */}
      {completingAnime && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111624] w-full max-w-md rounded-3xl border border-white/15 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#FDBA74]" />
                <span>Mark Series Completed</span>
              </h3>
              <button
                onClick={() => setCompletingAnime(null)}
                className="p-1.5 rounded-xl border border-white/10 bg-[#090C15] text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-300">
              Logging <strong>{completingAnime.title}</strong> into your permanent{' '}
              <strong>Completed / Watched</strong> archive.
            </p>

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-1">
                Personal Score (1 - 10)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={completeRating}
                onChange={(e) =>
                  setCompleteRating(
                    Math.max(1, Math.min(10, parseInt(e.target.value || '10', 10)))
                  )
                }
                className="w-full px-3.5 py-2 rounded-xl bg-[#090C15] border border-white/10 font-black text-lg text-[#FDBA74]"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-1">
                Review / Notes
              </label>
              <textarea
                rows={3}
                value={completeReview}
                onChange={(e) => setCompleteReview(e.target.value)}
                placeholder="Write your thoughts or favorite moments..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#090C15] border border-white/10 font-bold text-sm text-white"
              />
            </div>

            {completingAnime.hasLocalFiles && (
              <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#090C15] border border-amber-500/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteFilesOnComplete}
                  onChange={(e) => setDeleteFilesOnComplete(e.target.checked)}
                  className="mt-1 accent-[#F97316]"
                />
                <div className="text-xs">
                  <span className="font-black text-white block">
                    Also delete local .mkv video files ({formatDiskSize(completingAnime.totalDiskMB)})
                  </span>
                  <span className="font-bold text-slate-400">
                    Frees up SSD space while keeping the poster, rating &amp; watch record
                    permanently in Completed.
                  </span>
                </div>
              </label>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <TactileButton
                variant="slate"
                size="md"
                onClick={() => setCompletingAnime(null)}
              >
                Cancel
              </TactileButton>
              <TactileButton variant="emerald" size="md" onClick={handleConfirmComplete}>
                <Check className="w-4 h-4" />
                <span>Save to Completed</span>
              </TactileButton>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: STEAM-STYLE STORAGE CLEANER (DELETE .MKV • KEEP POSTER & LOG)
         ===================================================================== */}
      {cleaningAnime && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111624] w-full max-w-lg rounded-3xl border border-white/15 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-lg font-black text-white">
                    Storage Manager &amp; Watched Archive
                  </h3>
                  <p className="text-xs font-bold text-slate-400">
                    {cleaningAnime.title} • {cleaningAnime.localFiles?.length || 0} MKV Files (
                    {formatDiskSize(cleaningAnime.totalDiskMB)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCleaningAnime(null)}
                className="p-1.5 rounded-xl bg-[#090C15] border border-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs font-bold text-emerald-200 leading-relaxed">
              Your local poster (<code>anime/.posters/</code>), personal rating, and watch history
              are <strong>100% protected</strong> and will remain visible in your{' '}
              <strong>Completed / Watched</strong> tab even after video files are deleted.
            </div>

            <div className="space-y-3">
              {/* Option A: Archive Entire Series to Completed & Delete All .mkv */}
              <div className="p-4 rounded-2xl bg-[#090C15] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-white">
                    Archive Series &amp; Delete All .MKV Videos
                  </h4>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">
                    Frees <strong>{formatDiskSize(cleaningAnime.totalDiskMB)}</strong> and moves{' '}
                    {cleaningAnime.title} to <strong>Completed / Watched</strong> with poster intact.
                  </p>
                </div>
                <TactileButton
                  variant="amber"
                  size="sm"
                  className="shrink-0"
                  onClick={() => handleDeleteVideos(cleaningAnime, 'all')}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive &amp; Free {formatDiskSize(cleaningAnime.totalDiskMB)}</span>
                </TactileButton>
              </div>

              {/* Option B: Clean Only Watched Episodes */}
              {cleaningAnime.watchedEpisodes.length > 0 && (
                <div className="p-4 rounded-2xl bg-[#090C15] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-black text-white">
                      Clean Watched Episodes Only ({cleaningAnime.watchedEpisodes.length} Eps)
                    </h4>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">
                      Deletes only the .mkv files for episodes you have already finished watching;
                      keeps remaining unwatched episodes untouched.
                    </p>
                  </div>
                  <TactileButton
                    variant="slate"
                    size="sm"
                    className="shrink-0"
                    onClick={() => handleDeleteVideos(cleaningAnime, 'watched_only')}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Clean Watched Only</span>
                  </TactileButton>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: "SURPRISE ME / RANDOM PICK" SPOTLIGHT MODAL
         ===================================================================== */}
      {randomPick && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111624] w-full max-w-lg rounded-3xl border border-white/15 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Shuffle className="w-5 h-5 text-[#FDBA74]" />
                <h3 className="text-lg font-black text-white">
                  Random Curated Pick
                </h3>
              </div>
              <button
                onClick={() => setRandomPick(null)}
                className="p-1.5 rounded-xl bg-[#090C15] border border-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5 bg-[#090C15] p-4 rounded-2xl border border-white/[0.08]">
              <img
                src={`/api/cached-poster?id=${randomPick.mal_id}&url=${encodeURIComponent(
                  randomPick.images?.jpg?.large_image_url ||
                    randomPick.images?.jpg?.image_url ||
                    ''
                )}`}
                alt={randomPick.title}
                className="w-28 aspect-[2/3] object-cover rounded-xl ring-1 ring-white/15 shrink-0"
              />
              <div className="space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-black">
                    {randomPick.matchPercent}% Match
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#FDBA74] text-[#090C15] text-[10px] font-black">
                    Score {randomPick.score}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/10 text-slate-200 text-[10px] font-bold">
                    {randomPick.episodes || '?'} Eps
                  </span>
                </div>
                <h4 className="text-xl font-black text-white">
                  {randomPick.title_english || randomPick.title}
                </h4>
                <p className="text-xs font-bold text-slate-400">
                  {randomPick.studios?.[0]?.name || 'Anime Studio'}{' '}
                  {randomPick.year ? `• ${randomPick.year}` : ''}
                </p>
                <p className="text-xs font-extrabold text-[#FDBA74]">{randomPick.reason}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <TactileButton
                variant="white"
                size="sm"
                onClick={() => setRandomPick(getRandomOfflinePick(animes, selectedGenre))}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Spin Again</span>
              </TactileButton>
              <div className="flex items-center gap-2">
                <TactileButton
                  variant="slate"
                  size="sm"
                  onClick={() => handleAddFromJikan(randomPick, 'plan')}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>+ Watchlist</span>
                </TactileButton>
                <TactileButton
                  variant="amber"
                  size="sm"
                  onClick={() => handleAddFromJikan(randomPick, 'watching')}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Watching</span>
                </TactileButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
