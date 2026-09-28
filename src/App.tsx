import React, { useEffect, useState, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Play,
  CheckCircle2,
  Clock,
  FolderOpen,
  Plus,
  Search,
  Trophy,
  Tv,
  Bookmark,
  PauseCircle,
  RefreshCw,
  Volume2,
  VolumeX,
  Star,
  AlertTriangle,
  Film,
  ChevronRight,
  ChevronLeft,
  CheckCheck,
  Trash2,
  Sparkles,
  X,
} from 'lucide-react';
import { TactileButton } from './components/TactileButton';
import { sound } from './lib/sound';
import type { AnimeEntry, EpisodeFile, LiveMpvState, JikanAnimeItem } from './types/anime';

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const App: React.FC = () => {
  const [animes, setAnimes] = useState<AnimeEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'watching' | 'completed' | 'plan' | 'on_hold'>('watching');
  const [selectedPart, setSelectedPart] = useState<string>('ALL');
  const [liveMpv, setLiveMpv] = useState<LiveMpvState>({
    active: false,
    animeId: null,
    episodeLabel: null,
    fileName: null,
    seconds: 0,
    duration: 1420,
  });
  const [muted, setMuted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);

  // Manual minute:second input states
  const [editMin, setEditMin] = useState<string>('00');
  const [editSec, setEditSec] = useState<string>('00');

  // Add / Search Anime Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [jikanResults, setJikanResults] = useState<JikanAnimeItem[]>([]);
  const [searchingMal, setSearchingMal] = useState<boolean>(false);
  const [newStatus, setNewStatus] = useState<'watching' | 'completed' | 'plan'>('watching');
  const [newEp, setNewEp] = useState<number>(1);
  const [newMin, setNewMin] = useState<number>(0);
  const [newRating, setNewRating] = useState<number>(9);
  const [newNotes, setNewNotes] = useState<string>('');

  // Complete Anime Modal
  const [completingAnime, setCompletingAnime] = useState<AnimeEntry | null>(null);
  const [completeRating, setCompleteRating] = useState<number>(9);
  const [completeReview, setCompleteReview] = useState<string>('');

  const showNotice = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const fetchLibrary = useCallback(async (forceRescan = false) => {
    try {
      const res = await fetch(forceRescan ? '/api/library?rescan=1' : '/api/library');
      const data = await res.json();
      if (data.animes) {
        setAnimes(data.animes);
        setSelectedId((prev) => {
          if (prev && data.animes.some((a: AnimeEntry) => a.id === prev)) return prev;
          const firstWatching = data.animes.find((a: AnimeEntry) => a.status === 'watching');
          return firstWatching ? firstWatching.id : data.animes[0]?.id || '';
        });
      }
      if (data.liveMpv) {
        setLiveMpv(data.liveMpv);
      }
    } catch {
      // Fallback if offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Poll live MPV status ONLY when MPV is actively playing
  useEffect(() => {
    if (!liveMpv.active) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/mpv-status');
        const status: LiveMpvState = await res.json();
        setLiveMpv((prev) => {
          if (prev.active && !status.active) {
            fetchLibrary();
          }
          return status;
        });
        if (status.active && status.animeId) {
          setAnimes((prev) =>
            prev.map((a) =>
              a.id === status.animeId
                ? {
                    ...a,
                    currentEpisodeLabel: status.episodeLabel || a.currentEpisodeLabel,
                    currentSeconds: status.seconds,
                    durationSeconds: status.duration || a.durationSeconds,
                  }
                : a
            )
          );
        }
      } catch {
        // Ignore
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [liveMpv.active, fetchLibrary]);

  const selectedAnime = useMemo(
    () => animes.find((a) => a.id === selectedId) || animes[0] || null,
    [animes, selectedId]
  );

  // Sync manual MM:SS inputs when selectedAnime changes
  useEffect(() => {
    if (!selectedAnime) return;
    const s = Math.max(0, Math.floor(selectedAnime.currentSeconds || 0));
    setEditMin(String(Math.floor(s / 60)).padStart(2, '0'));
    setEditSec(String(s % 60).padStart(2, '0'));
  }, [selectedAnime?.id, selectedAnime?.currentSeconds, selectedAnime?.currentEpisodeLabel]);

  const parts = useMemo(() => {
    if (!selectedAnime?.localFiles?.length) return [];
    const unique = Array.from(new Set(selectedAnime.localFiles.map((f) => f.part)));
    return unique;
  }, [selectedAnime]);

  const filteredEpisodes = useMemo(() => {
    if (!selectedAnime?.localFiles) return [];
    if (selectedPart === 'ALL') return selectedAnime.localFiles;
    return selectedAnime.localFiles.filter((f) => f.part === selectedPart);
  }, [selectedAnime, selectedPart]);

  const saveAnimeUpdate = async (updated: AnimeEntry, silent = false) => {
    setAnimes((prev) => {
      const exists = prev.some((a) => a.id === updated.id);
      return exists ? prev.map((a) => (a.id === updated.id ? updated : a)) : [updated, ...prev];
    });
    await fetch('/api/update-anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (!silent) {
      showNotice(`Tersimpan: ${updated.title} • Eps ${updated.currentEpisodeLabel} (${formatTime(updated.currentSeconds)})`);
    }
  };

  const handlePlayMpv = async (anime: AnimeEntry, ep?: EpisodeFile, customStartSec?: number) => {
    sound.playPop();
    const targetEp =
      ep ||
      anime.localFiles?.find((f) => f.episodeLabel === anime.currentEpisodeLabel) ||
      anime.localFiles?.[0];

    if (!targetEp) {
      showNotice('File .mkv lokal tidak ditemukan di folder anime/');
      return;
    }

    const startSeconds =
      typeof customStartSec === 'number'
        ? customStartSec
        : targetEp.episodeLabel === anime.currentEpisodeLabel
          ? anime.currentSeconds
          : anime.episodeProgress?.[targetEp.episodeLabel]?.seconds || 0;

    const res = await fetch('/api/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        animeId: anime.id,
        episodeLabel: targetEp.episodeLabel,
        fullPath: targetEp.fullPath,
        startSeconds,
      }),
    });

    if (res.ok) {
      showNotice(`▶ Membuka MPV: Eps ${targetEp.episodeLabel} (Mulai ${formatTime(startSeconds)})`);
      fetchLibrary();
    } else {
      sound.playWarning();
      showNotice('Gagal membuka MPV. Pastikan file video tersedia.');
    }
  };

  const handleManualTimeSave = () => {
    if (!selectedAnime) return;
    sound.playClick(true);
    const mins = Math.max(0, parseInt(editMin || '0', 10) || 0);
    const secs = Math.min(59, Math.max(0, parseInt(editSec || '0', 10) || 0));
    const totalSec = mins * 60 + secs;
    const epLabel = selectedAnime.currentEpisodeLabel;

    const updated: AnimeEntry = {
      ...selectedAnime,
      currentSeconds: totalSec,
      episodeProgress: {
        ...selectedAnime.episodeProgress,
        [epLabel]: {
          seconds: totalSec,
          duration: selectedAnime.durationSeconds || 1420,
        },
      },
    };
    saveAnimeUpdate(updated);
  };

  const handleStepEpisode = (delta: number) => {
    if (!selectedAnime) return;
    sound.playClick(delta > 0);
    const files = selectedAnime.localFiles || [];
    if (files.length > 0) {
      const currIdx = files.findIndex((f) => f.episodeLabel === selectedAnime.currentEpisodeLabel);
      const nextIdx = Math.min(files.length - 1, Math.max(0, (currIdx === -1 ? 0 : currIdx) + delta));
      const nextFile = files[nextIdx];
      const savedSec = selectedAnime.episodeProgress?.[nextFile.episodeLabel]?.seconds || 0;
      const updated: AnimeEntry = {
        ...selectedAnime,
        currentEpisode: nextFile.episodeNum,
        currentEpisodeLabel: nextFile.episodeLabel,
        currentSeconds: savedSec,
      };
      saveAnimeUpdate(updated);
    } else {
      const nextEp = Math.max(1, Math.min(selectedAnime.totalEpisodes || 999, Math.floor(selectedAnime.currentEpisode) + delta));
      const label = String(nextEp).padStart(2, '0');
      const savedSec = selectedAnime.episodeProgress?.[label]?.seconds || 0;
      const updated: AnimeEntry = {
        ...selectedAnime,
        currentEpisode: nextEp,
        currentEpisodeLabel: label,
        currentSeconds: savedSec,
      };
      saveAnimeUpdate(updated);
    }
  };

  const handleToggleWatchedEpisode = (anime: AnimeEntry, epLabel: string) => {
    const isWatched = anime.watchedEpisodes.includes(epLabel);
    sound.playClick(!isWatched);
    const nextWatched = isWatched
      ? anime.watchedEpisodes.filter((e) => e !== epLabel)
      : [...anime.watchedEpisodes, epLabel];

    // If marking watched, advance to next episode automatically if it matches current
    let nextEpLabel = anime.currentEpisodeLabel;
    let nextEpNum = anime.currentEpisode;
    let nextSeconds = anime.currentSeconds;

    if (!isWatched && anime.localFiles?.length) {
      const idx = anime.localFiles.findIndex((f) => f.episodeLabel === epLabel);
      if (idx !== -1 && idx + 1 < anime.localFiles.length) {
        const nextFile = anime.localFiles[idx + 1];
        nextEpLabel = nextFile.episodeLabel;
        nextEpNum = nextFile.episodeNum;
        nextSeconds = 0;
      }
    }

    saveAnimeUpdate({
      ...anime,
      watchedEpisodes: nextWatched,
      currentEpisodeLabel: nextEpLabel,
      currentEpisode: nextEpNum,
      currentSeconds: nextSeconds,
    });
  };

  const handleMarkWatchedUpTo = (anime: AnimeEntry, targetEpLabel: string) => {
    if (!anime.localFiles?.length) return;
    sound.playSuccess();
    const targetIdx = anime.localFiles.findIndex((f) => f.episodeLabel === targetEpLabel);
    if (targetIdx === -1) return;

    const labelsUpTo = anime.localFiles.slice(0, targetIdx + 1).map((f) => f.episodeLabel);
    const merged = Array.from(new Set([...anime.watchedEpisodes, ...labelsUpTo]));
    const nextFile = anime.localFiles[targetIdx + 1] || anime.localFiles[targetIdx];

    saveAnimeUpdate({
      ...anime,
      watchedEpisodes: merged,
      currentEpisodeLabel: nextFile.episodeLabel,
      currentEpisode: nextFile.episodeNum,
      currentSeconds: 0,
    });
    showNotice(`✓ Episode 01 s/d ${targetEpLabel} ditandai selesai!`);
  };

  const handleCompleteAnimeConfirm = async () => {
    if (!completingAnime) return;
    sound.playSuccess();
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });

    const allLabels =
      completingAnime.localFiles?.map((f) => f.episodeLabel) || completingAnime.watchedEpisodes;

    const updated: AnimeEntry = {
      ...completingAnime,
      status: 'completed',
      personalRating: completeRating,
      notes: completeReview || completingAnime.notes,
      completedAt: new Date().toISOString().slice(0, 10),
      currentEpisode: completingAnime.totalEpisodes || completingAnime.currentEpisode,
      currentEpisodeLabel: String(completingAnime.totalEpisodes || completingAnime.currentEpisode).padStart(2, '0'),
      currentSeconds: 0,
      watchedEpisodes: Array.from(new Set(allLabels)),
    };

    await saveAnimeUpdate(updated);
    setCompletingAnime(null);
    setActiveTab('completed');
    showNotice(`🏆 Selamat! "${updated.title}" resmi masuk Riwayat Tamat!`);
  };

  const handleOpenExplorer = async (folderName?: string) => {
    await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderName }),
    });
    showNotice('📂 Membuka folder anime di Windows File Explorer...');
  };

  const handleSearchMal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchingMal(true);
    try {
      const res = await fetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchQuery.trim())}&limit=6&sfw=true`
      );
      const data = await res.json();
      setJikanResults(data.data || []);
    } catch {
      showNotice('Gagal menghubungi Jikan API. Kamu tetap bisa tambah manual!');
    } finally {
      setSearchingMal(false);
    }
  };

  // Anti-Duplicate Guard check
  const checkDuplicate = useCallback(
    (title: string, malId?: number): AnimeEntry | undefined => {
      const clean = title.toLowerCase().trim();
      return animes.find(
        (a) =>
          (malId && a.malId === malId) ||
          a.title.toLowerCase() === clean ||
          a.aliases.some((al) => al.toLowerCase() === clean)
      );
    },
    [animes]
  );

  const handleAddFromJikan = async (item: JikanAnimeItem) => {
    const canonicalTitle = item.title_english || item.title;
    const dup = checkDuplicate(canonicalTitle, item.mal_id);
    if (dup) {
      sound.playWarning();
      showNotice(
        `⚠️ Anti-Duplikat: "${dup.title}" sudah ada di daftar (${dup.status === 'completed' ? 'Sudah Tamat' : 'Sedang Ditonton'})!`
      );
      setSelectedId(dup.id);
      setShowAddModal(false);
      return;
    }

    sound.playSuccess();
    const totalEps = item.episodes || 12;
    const epLabel = String(newStatus === 'completed' ? totalEps : newEp).padStart(2, '0');
    const entry: AnimeEntry = {
      id: `${item.mal_id}-${canonicalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: canonicalTitle,
      aliases: Array.from(new Set([item.title, ...(item.title_synonyms || [])])).slice(0, 4),
      status: newStatus,
      currentEpisode: newStatus === 'completed' ? totalEps : newEp,
      currentEpisodeLabel: epLabel,
      currentSeconds: newStatus === 'watching' ? newMin * 60 : 0,
      durationSeconds: 1420,
      totalEpisodes: totalEps,
      malId: item.mal_id,
      posterUrl: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url,
      score: item.score,
      personalRating: newStatus === 'completed' ? newRating : undefined,
      studio: item.studios?.[0]?.name,
      genres: item.genres?.map((g) => g.name).slice(0, 4),
      startedAt: new Date().toISOString().slice(0, 10),
      completedAt: newStatus === 'completed' ? new Date().toISOString().slice(0, 10) : undefined,
      notes: newNotes || (newStatus === 'completed' ? 'Tamat & tercatat di Anideck' : ''),
      watchedEpisodes:
        newStatus === 'completed'
          ? Array.from({ length: totalEps }, (_, i) => String(i + 1).padStart(2, '0'))
          : [],
      episodeProgress: {},
    };

    await saveAnimeUpdate(entry);
    setSelectedId(entry.id);
    setActiveTab(newStatus);
    setShowAddModal(false);
    setSearchQuery('');
    setJikanResults([]);
  };

  const handleAddManual = async () => {
    if (!searchQuery.trim()) return;
    const dup = checkDuplicate(searchQuery.trim());
    if (dup) {
      sound.playWarning();
      showNotice(`⚠️ "${dup.title}" sudah pernah dicatat di Anideck!`);
      return;
    }
    sound.playSuccess();
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
    setSelectedId(entry.id);
    setActiveTab(newStatus);
    setShowAddModal(false);
    setSearchQuery('');
  };

  const handleDeleteAnime = async (anime: AnimeEntry) => {
    if (!window.confirm(`Hapus catatan "${anime.title}" dari memori Anideck? (File video .mkv tidak akan dihapus)`)) {
      return;
    }
    await fetch('/api/delete-anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: anime.id }),
    });
    fetchLibrary();
    showNotice(`Catatan "${anime.title}" dihapus.`);
  };

  const toggleMute = () => {
    sound.muted = !muted;
    setMuted(!muted);
  };

  const tabCounts = useMemo(
    () => ({
      watching: animes.filter((a) => a.status === 'watching').length,
      completed: animes.filter((a) => a.status === 'completed').length,
      plan: animes.filter((a) => a.status === 'plan').length,
      on_hold: animes.filter((a) => a.status === 'on_hold').length,
    }),
    [animes]
  );

  const filteredAnimes = useMemo(
    () => animes.filter((a) => a.status === activeTab),
    [animes, activeTab]
  );

  const progressPct = useMemo(() => {
    if (!selectedAnime) return 0;
    const dur = selectedAnime.durationSeconds || 1420;
    return Math.min(100, Math.round((selectedAnime.currentSeconds / dur) * 100));
  }, [selectedAnime]);

  return (
    <div className="min-h-screen bg-[#FFFDF8] text-[#1E293B] pb-16">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl border-2 border-slate-950 shadow-[0_5px_0_0_#020617] flex items-center gap-3 font-extrabold text-sm">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Tactile Header */}
      <header className="sticky top-0 z-30 bg-[#FFFDF8] border-b-2 border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400 border-2 border-slate-900 shadow-[0_3px_0_0_#0f172a] flex items-center justify-center text-2xl">
              🎬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-900">ANIDECK</h1>
                <span className="px-2.5 py-0.5 text-[11px] font-black uppercase rounded-full bg-emerald-100 text-emerald-900 border-2 border-emerald-700">
                  MPV Cockpit
                </span>
              </div>
              <p className="text-xs font-bold text-slate-600">
                Monitor Riwayat Anime, Posisi Episode &amp; Menit Terakhir Chandra
              </p>
            </div>
          </div>

          {/* Live MPV Telemetry Pill */}
          {liveMpv.active && (
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-emerald-500 text-white border-2 border-emerald-900 shadow-[0_3px_0_0_#064e3b]">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              <span className="text-xs font-black tracking-wide">
                LIVE MPV: Eps {liveMpv.episodeLabel} • {formatTime(liveMpv.seconds)} /{' '}
                {formatTime(liveMpv.duration)}
              </span>
            </div>
          )}

          {/* Header Actions */}
          <div className="flex items-center gap-2.5">
            <TactileButton
              variant="white"
              size="sm"
              onClick={() => handleOpenExplorer()}
              title="Buka folder c:\My Project\Anideck\anime di File Explorer"
            >
              <FolderOpen className="w-4 h-4 text-amber-600" />
              <span>Buka Folder Anime</span>
            </TactileButton>

            <TactileButton
              variant="white"
              size="sm"
              onClick={() => {
                fetchLibrary(true);
                showNotice('🔄 Memindai ulang folder anime/...');
              }}
              title="Scan ulang file .mkv baru"
            >
              <RefreshCw className="w-4 h-4 text-sky-600" />
              <span className="hidden sm:inline">Scan MKV</span>
            </TactileButton>

            <TactileButton variant="amber" size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              <span>Tambah / Cari Anime</span>
            </TactileButton>

            <button
              onClick={toggleMute}
              className="p-2 rounded-xl bg-white border-2 border-slate-800 shadow-[0_3px_0_0_#1e293b] active:translate-y-0.5 active:shadow-none cursor-pointer"
              title={muted ? 'Nyalakan Efek Suara' : 'Bisukan Efek Suara'}
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-600" /> : <Volume2 className="w-4 h-4 text-slate-800" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
        {/* HERO SECTION: FOCUS MONITOR (EPISODE BERAPA & MENIT BERAPA) */}
        {selectedAnime && (
          <section className="bg-white rounded-3xl border-2 border-slate-900 shadow-[0_6px_0_0_#1e293b] p-5 sm:p-7">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Poster Column */}
              <div className="lg:col-span-3 flex flex-col items-center sm:items-start">
                <div className="relative w-44 sm:w-full max-w-[220px] aspect-[3/4] rounded-2xl overflow-hidden border-2 border-slate-900 shadow-[0_4px_0_0_#1e293b] bg-slate-100">
                  {selectedAnime.posterUrl ? (
                    <img
                      src={selectedAnime.posterUrl}
                      alt={selectedAnime.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-amber-50">
                      <Film className="w-12 h-12 text-amber-600 mb-2" />
                      <span className="font-black text-sm text-slate-800">{selectedAnime.title}</span>
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl text-[11px] font-black uppercase bg-slate-900/90 text-white border border-white/20">
                    {selectedAnime.status === 'watching' && '🟢 Sedang Ditonton'}
                    {selectedAnime.status === 'completed' && '🏆 Sudah Tamat'}
                    {selectedAnime.status === 'plan' && '📋 Rencana Tonton'}
                    {selectedAnime.status === 'on_hold' && '⏸️ Ditunda'}
                  </div>
                </div>
              </div>

              {/* Main Telemetry & Controls Column */}
              <div className="lg:col-span-9 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-200 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {selectedAnime.studio && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-sky-100 text-sky-900 border border-sky-400 text-xs font-extrabold">
                          {selectedAnime.studio}
                        </span>
                      )}
                      {selectedAnime.score && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-400 text-xs font-extrabold flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                          MAL {selectedAnime.score}
                        </span>
                      )}
                      {selectedAnime.hasLocalFiles ? (
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-500 text-xs font-extrabold">
                          💿 {selectedAnime.localFiles?.length} File MKV Tersedia
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-300 text-xs font-extrabold">
                          ☁️ Tersimpan di Memori Riwayat
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {selectedAnime.title}
                    </h2>
                    {selectedAnime.aliases?.length > 0 && (
                      <p className="text-xs font-bold text-slate-500 mt-0.5">
                        Alias: {selectedAnime.aliases.join(' • ')}
                      </p>
                    )}
                  </div>

                  {/* Status Switcher & Complete Button */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedAnime.status}
                      onChange={(e) =>
                        saveAnimeUpdate({
                          ...selectedAnime,
                          status: e.target.value as AnimeEntry['status'],
                        })
                      }
                      className="px-3 py-2 rounded-xl bg-amber-50 border-2 border-slate-800 text-xs font-black text-slate-900 cursor-pointer"
                    >
                      <option value="watching">🟢 Sedang Ditonton</option>
                      <option value="completed">🏆 Sudah Ditonton (Tamat)</option>
                      <option value="plan">📋 Rencana Tonton</option>
                      <option value="on_hold">⏸️ Ditunda / On-Hold</option>
                    </select>

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
                        <Trophy className="w-4 h-4" />
                        <span>Tandai Tamat!</span>
                      </TactileButton>
                    )}
                  </div>
                </div>

                {/* BIG TRACKING READOUT: EPISODE BERAPA & MENIT BERAPA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Box 1: Episode Berapa */}
                  <div className="p-4 rounded-2xl bg-[#FFFDF8] border-2 border-slate-800 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Tv className="w-4 h-4 text-sky-600" />
                        SEKARANG DI EPISODE BERAPA?
                      </span>
                      <span className="text-xs font-extrabold text-emerald-700">
                        {selectedAnime.watchedEpisodes.length} / {selectedAnime.totalEpisodes || '?'}{' '}
                        Selesai
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-black text-slate-900">
                          EPS {selectedAnime.currentEpisodeLabel}
                        </span>
                        <span className="text-sm font-extrabold text-slate-500">
                          dari {selectedAnime.totalEpisodes || '?'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <TactileButton
                          variant="white"
                          size="sm"
                          onClick={() => handleStepEpisode(-1)}
                          title="Mundur 1 Episode"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </TactileButton>
                        <TactileButton
                          variant="white"
                          size="sm"
                          onClick={() => handleStepEpisode(1)}
                          title="Maju 1 Episode"
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
                        className="w-full px-3 py-1.5 rounded-xl bg-white border-2 border-slate-300 text-xs font-extrabold text-slate-800 cursor-pointer"
                      >
                        {selectedAnime.localFiles.map((f) => (
                          <option key={f.id} value={f.episodeLabel}>
                            [{f.part}] Episode {f.episodeLabel} — {f.fileName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Box 2: Menit Berapa */}
                  <div className="p-4 rounded-2xl bg-[#FFFDF8] border-2 border-slate-800 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-600" />
                        BERHENTI DI MENIT BERAPA?
                      </span>
                      <span className="text-xs font-extrabold text-amber-700">
                        {progressPct}% Durasi Episode
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-black text-amber-600">
                          {formatTime(selectedAnime.currentSeconds)}
                        </span>
                        <span className="text-sm font-extrabold text-slate-500">
                          / {formatTime(selectedAnime.durationSeconds || 1420)}
                        </span>
                      </div>

                      {/* Manual MM:SS Quick Input */}
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={180}
                          value={editMin}
                          onChange={(e) => setEditMin(e.target.value)}
                          className="w-14 px-2 py-1 text-center font-black text-sm rounded-xl bg-white border-2 border-slate-800"
                          title="Menit"
                        />
                        <span className="font-black text-slate-800">:</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={editSec}
                          onChange={(e) => setEditSec(e.target.value)}
                          className="w-14 px-2 py-1 text-center font-black text-sm rounded-xl bg-white border-2 border-slate-800"
                          title="Detik"
                        />
                        <TactileButton variant="amber" size="sm" onClick={handleManualTimeSave}>
                          Simpan
                        </TactileButton>
                      </div>
                    </div>

                    {/* Visual Progress Scrubber */}
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
                        className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      />
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-500">
                        <button
                          onClick={() =>
                            saveAnimeUpdate({ ...selectedAnime, currentSeconds: 0 })
                          }
                          className="hover:text-slate-900 underline cursor-pointer"
                        >
                          Reset 00:00
                        </button>
                        <span>Geser bar atau ketik menit terakhir jika menonton manual</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary CTA Row: Launch MPV & Quick Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedAnime.hasLocalFiles ? (
                      <>
                        <TactileButton
                          variant="emerald"
                          size="lg"
                          onClick={() => handlePlayMpv(selectedAnime)}
                        >
                          <Play className="w-5 h-5 fill-white" />
                          <span>
                            Lanjut Tonton di MPV (Eps {selectedAnime.currentEpisodeLabel} •{' '}
                            {formatTime(selectedAnime.currentSeconds)})
                          </span>
                        </TactileButton>

                        {selectedAnime.currentSeconds > 10 && (
                          <TactileButton
                            variant="white"
                            size="md"
                            onClick={() => handlePlayMpv(selectedAnime, undefined, 0)}
                          >
                            <span>Putar Ulang dari 00:00</span>
                          </TactileButton>
                        )}
                      </>
                    ) : (
                      <div className="px-4 py-2.5 rounded-2xl bg-amber-50 border-2 border-amber-700 text-xs font-extrabold text-amber-900 flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 shrink-0" />
                        <span>
                          Anime ini tercatat di memori tontonanmu (tanpa file .mkv lokal di folder{' '}
                          <code>anime/</code>).
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedAnime.folderName && (
                      <TactileButton
                        variant="white"
                        size="sm"
                        onClick={() => handleOpenExplorer(selectedAnime.folderName)}
                      >
                        <FolderOpen className="w-4 h-4 text-slate-700" />
                        <span>Folder {selectedAnime.folderName}</span>
                      </TactileButton>
                    )}
                    <button
                      onClick={() => handleDeleteAnime(selectedAnime)}
                      className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-300 cursor-pointer"
                      title="Hapus catatan anime dari memori"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* LOCAL MKV EPISODE GRID (If Local Files Exist) */}
            {selectedAnime.hasLocalFiles && selectedAnime.localFiles && (
              <div className="mt-7 pt-6 border-t-2 border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <span>🎞️ Daftar Berkas Episode Lokal ({selectedAnime.localFiles.length} MKV)</span>
                    </h3>
                    <p className="text-xs font-bold text-slate-500">
                      Klik <strong>Play MPV</strong> untuk memutar, atau klik{' '}
                      <strong>Tandai Selesai s/d Sini</strong> untuk melompati episode yang sudah kamu
                      tonton.
                    </p>
                  </div>

                  {/* Part Filter Tabs (Part 1, Part 2) */}
                  {parts.length > 1 && (
                    <div className="flex items-center gap-2">
                      <TactileButton
                        variant={selectedPart === 'ALL' ? 'slate' : 'white'}
                        size="sm"
                        onClick={() => setSelectedPart('ALL')}
                      >
                        Semua ({selectedAnime.localFiles.length})
                      </TactileButton>
                      {parts.map((p) => (
                        <TactileButton
                          key={p}
                          variant={selectedPart === p ? 'slate' : 'white'}
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
                  {filteredEpisodes.map((ep) => {
                    const isCurrent = selectedAnime.currentEpisodeLabel === ep.episodeLabel;
                    const isWatched = selectedAnime.watchedEpisodes.includes(ep.episodeLabel);
                    const epProg = selectedAnime.episodeProgress?.[ep.episodeLabel];
                    const savedSec = isCurrent
                      ? selectedAnime.currentSeconds
                      : epProg?.seconds || 0;

                    return (
                      <div
                        key={ep.id}
                        className={`p-3.5 rounded-2xl border-2 flex flex-col justify-between gap-3 ${
                          isCurrent
                            ? 'bg-amber-50/90 border-slate-900 shadow-[0_4px_0_0_#1e293b]'
                            : isWatched
                              ? 'bg-emerald-50/50 border-emerald-700/60'
                              : 'bg-[#FFFDF8] border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-white text-xs font-black">
                                EPS {ep.episodeLabel}
                              </span>
                              {ep.part !== 'Main' && (
                                <span className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-800 text-[11px] font-extrabold">
                                  {ep.part}
                                </span>
                              )}
                              <span className="text-[11px] font-bold text-slate-500">
                                {ep.sizeMB} MB
                              </span>
                            </div>
                            <p
                              className="text-xs font-bold text-slate-700 mt-1.5 line-clamp-1"
                              title={ep.fileName}
                            >
                              {ep.fileName}
                            </p>
                          </div>

                          {isWatched ? (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Selesai
                            </span>
                          ) : savedSec > 5 ? (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3" />
                              {formatTime(savedSec)}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <TactileButton
                            variant={isCurrent ? 'emerald' : 'sky'}
                            size="sm"
                            onClick={() => handlePlayMpv(selectedAnime, ep, savedSec)}
                            className="flex-1"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>
                              {savedSec > 5 ? `Lanjut ${formatTime(savedSec)}` : 'Play MPV'}
                            </span>
                          </TactileButton>

                          <button
                            onClick={() => handleToggleWatchedEpisode(selectedAnime, ep.episodeLabel)}
                            className={`px-2.5 py-1.5 rounded-xl border-2 text-xs font-extrabold cursor-pointer ${
                              isWatched
                                ? 'bg-emerald-600 text-white border-emerald-900'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                            title="Tandai episode ini sudah ditonton"
                          >
                            ✓
                          </button>

                          {!isWatched && (
                            <button
                              onClick={() => handleMarkWatchedUpTo(selectedAnime, ep.episodeLabel)}
                              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-slate-700 border-2 border-slate-300 text-xs font-extrabold cursor-pointer"
                              title={`Tandai Episode 01 sampai ${ep.episodeLabel} sudah selesai ditonton`}
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* WATCHLIST LEDGER TABS (MEMORI PERMANEN TONTONAN CHANDRA) */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <TactileButton
                variant={activeTab === 'watching' ? 'emerald' : 'white'}
                size="md"
                onClick={() => setActiveTab('watching')}
              >
                <Tv className="w-4 h-4" />
                <span>Sedang Ditonton ({tabCounts.watching})</span>
              </TactileButton>

              <TactileButton
                variant={activeTab === 'completed' ? 'amber' : 'white'}
                size="md"
                onClick={() => setActiveTab('completed')}
              >
                <Trophy className="w-4 h-4" />
                <span>Sudah Ditonton / Tamat ({tabCounts.completed})</span>
              </TactileButton>

              <TactileButton
                variant={activeTab === 'plan' ? 'sky' : 'white'}
                size="md"
                onClick={() => setActiveTab('plan')}
              >
                <Bookmark className="w-4 h-4" />
                <span>Rencana Tonton ({tabCounts.plan})</span>
              </TactileButton>

              <TactileButton
                variant={activeTab === 'on_hold' ? 'slate' : 'white'}
                size="md"
                onClick={() => setActiveTab('on_hold')}
              >
                <PauseCircle className="w-4 h-4" />
                <span>Ditunda ({tabCounts.on_hold})</span>
              </TactileButton>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center font-extrabold text-slate-500">
              Memuat memori tontonan Chandra...
            </div>
          ) : filteredAnimes.length === 0 ? (
            <div className="bg-white rounded-3xl border-2 border-slate-800 p-10 text-center space-y-3">
              <p className="text-lg font-black text-slate-800">
                Belum ada anime di kategori ini
              </p>
              <p className="text-xs font-bold text-slate-500 max-w-md mx-auto">
                Kamu bisa klik tombol <strong>Tambah / Cari Anime</strong> di kanan atas untuk
                mencatat anime yang sudah pernah kamu tonton atau taruh folder video baru di{' '}
                <code>Anideck/anime/</code>.
              </p>
              <TactileButton variant="amber" size="md" onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4" />
                <span>Tambah Anime ke Daftar</span>
              </TactileButton>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAnimes.map((anime) => {
                const isSelected = selectedAnime?.id === anime.id;
                return (
                  <div
                    key={anime.id}
                    onClick={() => {
                      sound.playClick(true);
                      setSelectedId(anime.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`group cursor-pointer bg-white rounded-3xl border-2 p-4 flex gap-4 transition-transform duration-75 active:translate-y-0.5 ${
                      isSelected
                        ? 'border-slate-900 shadow-[0_5px_0_0_#1e293b] ring-2 ring-amber-400'
                        : 'border-slate-800 shadow-[0_4px_0_0_#1e293b] hover:bg-amber-50/30'
                    }`}
                  >
                    <div className="w-20 h-28 rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-100 shrink-0">
                      {anime.posterUrl ? (
                        <img
                          src={anime.posterUrl}
                          alt={anime.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-amber-100">
                          <Film className="w-6 h-6 text-amber-700" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-300">
                            {anime.hasLocalFiles ? '💿 MKV Lokal' : '☁️ Memori'}
                          </span>
                          {anime.personalRating && (
                            <span className="text-xs font-black text-amber-600 flex items-center gap-0.5">
                              ⭐ {anime.personalRating}/10
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-base text-slate-900 truncate mt-1">
                          {anime.title}
                        </h4>
                        {anime.notes && (
                          <p className="text-xs font-bold text-slate-500 line-clamp-1 mt-0.5">
                            {anime.notes}
                          </p>
                        )}
                      </div>

                      {anime.status === 'completed' ? (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs font-extrabold text-emerald-700">
                          <span>🏆 Tamat ({anime.totalEpisodes || '?'} Eps)</span>
                          <span>{anime.completedAt || ''}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                          <span className="text-xs font-black text-slate-900">
                            Eps {anime.currentEpisodeLabel} / {anime.totalEpisodes || '?'}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-400 text-xs font-black">
                            ⏱️ {formatTime(anime.currentSeconds)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* MODAL 1: TAMBAH / CARI ANIME (JIKAN MYANIMELIST + ANTI-DUPLICATE GUARD) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF8] w-full max-w-2xl rounded-3xl border-2 border-slate-900 shadow-[0_8px_0_0_#0f172a] p-6 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  ➕ Tambah Anime &amp; Catat Riwayat Tontonan
                </h3>
                <p className="text-xs font-bold text-slate-500">
                  Cari dari database MyAnimeList (otomatis lengkap dengan poster &amp; deteksi
                  anti-duplikat)
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl bg-white border-2 border-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Kategori & Posisi Awal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-white border-2 border-slate-800">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                  Masuk ke Kategori:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as 'watching' | 'completed' | 'plan')}
                  className="w-full px-3 py-2 rounded-xl bg-amber-50 border-2 border-slate-800 text-xs font-black"
                >
                  <option value="watching">🟢 Sedang Ditonton</option>
                  <option value="completed">🏆 Sudah Ditonton (Tamat)</option>
                  <option value="plan">📋 Rencana Tonton</option>
                </select>
              </div>

              {newStatus === 'watching' && (
                <>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                      Sekarang di Episode:
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newEp}
                      onChange={(e) => setNewEp(parseInt(e.target.value || '1', 10))}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border-2 border-slate-800 text-sm font-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                      Menit Terakhir:
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newMin}
                      onChange={(e) => setNewMin(parseInt(e.target.value || '0', 10))}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border-2 border-slate-800 text-sm font-black"
                      placeholder="Contoh: 14"
                    />
                  </div>
                </>
              )}

              {newStatus === 'completed' && (
                <>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                      Rating Pribadi (1-10):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newRating}
                      onChange={(e) => setNewRating(parseInt(e.target.value || '9', 10))}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border-2 border-slate-800 text-sm font-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                      Kesan Singkat:
                    </label>
                    <input
                      type="text"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="Masterpiece!"
                      className="w-full px-3 py-1.5 rounded-xl bg-white border-2 border-slate-800 text-sm font-bold"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearchMal} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik judul anime (misal: Frieren, Jujutsu Kaisen, Cyberpunk)..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border-2 border-slate-800 text-sm font-extrabold"
                  autoFocus
                />
              </div>
              <TactileButton type="submit" variant="sky" size="md" disabled={searchingMal}>
                {searchingMal ? 'Mencari...' : 'Cari Anime'}
              </TactileButton>
              <TactileButton type="button" variant="white" size="md" onClick={handleAddManual}>
                Simpan Manual
              </TactileButton>
            </form>

            {/* Results List */}
            <div className="space-y-2.5">
              {jikanResults.map((item) => {
                const canonicalTitle = item.title_english || item.title;
                const existing = checkDuplicate(canonicalTitle, item.mal_id);
                return (
                  <div
                    key={item.mal_id}
                    className="p-3 rounded-2xl bg-white border-2 border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.images?.jpg?.image_url}
                        alt={item.title}
                        className="w-12 h-16 object-cover rounded-xl border border-slate-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-black text-sm text-slate-900 truncate">
                          {canonicalTitle}
                        </h4>
                        <p className="text-xs font-bold text-slate-500 truncate">
                          {item.title} • {item.episodes || '?'} Eps • ⭐ {item.score || '-'}
                        </p>
                        {existing && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-500 text-[11px] font-black">
                            <AlertTriangle className="w-3 h-3" />
                            Sudah ada di {existing.status === 'completed' ? 'Riwayat Tamat' : 'Daftar Tontonan'}!
                          </span>
                        )}
                      </div>
                    </div>

                    <TactileButton
                      variant={existing ? 'white' : 'emerald'}
                      size="sm"
                      onClick={() => handleAddFromJikan(item)}
                    >
                      {existing ? 'Buka' : '+ Tambahkan'}
                    </TactileButton>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TANDAI ANIME TAMAT (COMPLETED) */}
      {completingAnime && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF8] w-full max-w-md rounded-3xl border-2 border-slate-900 shadow-[0_8px_0_0_#0f172a] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-500" />
                <span>Tamatkan Anime!</span>
              </h3>
              <button
                onClick={() => setCompletingAnime(null)}
                className="p-1.5 rounded-xl border-2 border-slate-800 bg-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm font-bold text-slate-600">
              Pindahkan <strong>{completingAnime.title}</strong> ke daftar{' '}
              <strong>🏆 Sudah Ditonton (Tamat)</strong>. Meskipun nanti file <code>.mkv</code>-nya
              kamu hapus dari laptop, riwayat ini akan tetap tersimpan abadi!
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black uppercase text-slate-600 mb-1">
                  Rating Pribadimu (1 - 10):
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={completeRating}
                  onChange={(e) => setCompleteRating(parseInt(e.target.value || '9', 10))}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border-2 border-slate-800 font-black text-base"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-600 mb-1">
                  Ulasan / Kesan Singkat:
                </label>
                <textarea
                  rows={3}
                  value={completeReview}
                  onChange={(e) => setCompleteReview(e.target.value)}
                  placeholder="Ceritanya gila banget, ending Part 2 bikin merinding..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white border-2 border-slate-800 font-bold text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <TactileButton variant="white" size="md" onClick={() => setCompletingAnime(null)}>
                Batal
              </TactileButton>
              <TactileButton variant="emerald" size="md" onClick={handleCompleteAnimeConfirm}>
                <Trophy className="w-4 h-4" />
                <span>Simpan ke Riwayat Tamat</span>
              </TactileButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
