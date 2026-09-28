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
  ArrowLeft,
  LayoutGrid,
  HardDrive,
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
  // Starts at null -> Opens Main Catalog Menu first (like Netflix / Crunchyroll / IMDb)!
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'watching' | 'completed' | 'plan' | 'on_hold'>('all');
  const [catalogSearch, setCatalogSearch] = useState<string>('');
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
      }
      if (data.liveMpv) {
        setLiveMpv(data.liveMpv);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
    // Refresh once after 2.5s on initial boot in case background poster download just completed
    const t = setTimeout(() => fetchLibrary(), 2500);
    return () => clearTimeout(t);
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
    () => (selectedId ? animes.find((a) => a.id === selectedId) || null : null),
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
    return Array.from(new Set(selectedAnime.localFiles.map((f) => f.part)));
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
    const res = await fetch('/api/update-anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    try {
      const data = await res.json();
      if (data.posterUrl && data.posterUrl !== updated.posterUrl) {
        setAnimes((prev) =>
          prev.map((a) => (a.id === updated.id ? { ...a, posterUrl: data.posterUrl } : a))
        );
      }
    } catch {
      // Ignore
    }
    if (!silent) {
      showNotice(
        `Tersimpan: ${updated.title} • Eps ${updated.currentEpisodeLabel} (${formatTime(updated.currentSeconds)})`
      );
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
      const nextIdx = Math.min(
        files.length - 1,
        Math.max(0, (currIdx === -1 ? 0 : currIdx) + delta)
      );
      const nextFile = files[nextIdx];
      const savedSec = selectedAnime.episodeProgress?.[nextFile.episodeLabel]?.seconds || 0;
      saveAnimeUpdate({
        ...selectedAnime,
        currentEpisode: nextFile.episodeNum,
        currentEpisodeLabel: nextFile.episodeLabel,
        currentSeconds: savedSec,
      });
    } else {
      const nextEp = Math.max(
        1,
        Math.min(selectedAnime.totalEpisodes || 999, Math.floor(selectedAnime.currentEpisode) + delta)
      );
      const label = String(nextEp).padStart(2, '0');
      const savedSec = selectedAnime.episodeProgress?.[label]?.seconds || 0;
      saveAnimeUpdate({
        ...selectedAnime,
        currentEpisode: nextEp,
        currentEpisodeLabel: label,
        currentSeconds: savedSec,
      });
    }
  };

  const handleToggleWatchedEpisode = (anime: AnimeEntry, epLabel: string) => {
    const isWatched = anime.watchedEpisodes.includes(epLabel);
    sound.playClick(!isWatched);
    const nextWatched = isWatched
      ? anime.watchedEpisodes.filter((e) => e !== epLabel)
      : [...anime.watchedEpisodes, epLabel];

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
      currentEpisodeLabel: String(
        completingAnime.totalEpisodes || completingAnime.currentEpisode
      ).padStart(2, '0'),
      currentSeconds: 0,
      watchedEpisodes: Array.from(new Set(allLabels)),
    };

    await saveAnimeUpdate(updated);
    setCompletingAnime(null);
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
      showNotice('Sedang offline — kamu tetap bisa klik Simpan Manual!');
    } finally {
      setSearchingMal(false);
    }
  };

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
    setShowAddModal(false);
    setSearchQuery('');
  };

  const handleDeleteAnime = async (anime: AnimeEntry) => {
    if (
      !window.confirm(
        `Hapus catatan "${anime.title}" dari memori Anideck? (File video .mkv tidak akan dihapus)`
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
    showNotice(`Catatan "${anime.title}" dihapus.`);
  };

  const toggleMute = () => {
    sound.muted = !muted;
    setMuted(!muted);
  };

  const watchingAnimes = useMemo(
    () => animes.filter((a) => a.status === 'watching'),
    [animes]
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
    const byTab = activeTab === 'all' ? animes : animes.filter((a) => a.status === activeTab);
    if (!catalogSearch.trim()) return byTab;
    const q = catalogSearch.toLowerCase().trim();
    return byTab.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.aliases?.some((al) => al.toLowerCase().includes(q)) ||
        a.studio?.toLowerCase().includes(q)
    );
  }, [animes, activeTab, catalogSearch]);

  const progressPct = useMemo(() => {
    if (!selectedAnime) return 0;
    const dur = selectedAnime.durationSeconds || 1420;
    return Math.min(100, Math.round((selectedAnime.currentSeconds / dur) * 100));
  }, [selectedAnime]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] pb-20">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#131B2E] text-white px-5 py-3.5 rounded-2xl border border-[#F97316]/60 shadow-[0_10px_30px_rgba(0,0,0,0.65)] flex items-center gap-3 font-extrabold text-sm">
          <Sparkles className="w-4 h-4 text-[#F97316] shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Cinema Navigation Bar (Netflix / Crunchyroll / IMDb Style) */}
      <header className="sticky top-0 z-30 bg-[#0F172A] border-b border-slate-800/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                sound.playClick(true);
                setSelectedId(null);
              }}
              className="flex items-center gap-3 cursor-pointer group text-left"
              title="Kembali ke Menu Utama Anideck"
            >
              <img
                src="/icon.png"
                alt="Anideck"
                className="w-10 h-10 rounded-xl shadow-md group-active:translate-y-0.5 object-contain"
              />
              <div>
                <span className="text-xl font-black tracking-wider text-[#FFFDF8]">ANIDECK</span>
                <p className="text-[11px] font-bold text-slate-400">
                  Local Anime Cinema &amp; MPV Progress Tracker
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
                <ArrowLeft className="w-4 h-4 text-[#FB923C]" />
                <span>Menu Utama</span>
              </TactileButton>
            )}
          </div>

          {/* Live MPV Telemetry Pill */}
          {liveMpv.active && (
            <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-xl bg-emerald-950/90 text-emerald-300 border border-emerald-500/50">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-black tracking-wide">
                MPV PLAYING: Eps {liveMpv.episodeLabel} • {formatTime(liveMpv.seconds)} /{' '}
                {formatTime(liveMpv.duration)}
              </span>
            </div>
          )}

          {/* Right Action Toolbar */}
          <div className="flex items-center gap-2.5">
            <TactileButton
              variant="white"
              size="sm"
              onClick={() => handleOpenExplorer()}
              title="Buka folder c:\My Project\Anideck\anime di Windows Explorer"
            >
              <FolderOpen className="w-4 h-4 text-[#FB923C]" />
              <span className="hidden md:inline">Folder Anime</span>
            </TactileButton>

            <TactileButton
              variant="white"
              size="sm"
              onClick={() => {
                fetchLibrary(true);
                showNotice('🔄 Memindai folder anime/ & memeriksa poster lokal...');
              }}
              title="Deteksi anime baru di folder anime/ & simpan poster ke lokal"
            >
              <RefreshCw className="w-4 h-4 text-[#FDBA74]" />
              <span className="hidden sm:inline">Scan &amp; Sync</span>
            </TactileButton>

            <TactileButton variant="amber" size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              <span>Tambah Anime</span>
            </TactileButton>

            <button
              onClick={toggleMute}
              className="p-2 rounded-xl bg-[#131B2E] hover:bg-[#1E293B] border border-slate-700 text-slate-300 cursor-pointer"
              title={muted ? 'Nyalakan Suara' : 'Bisukan Suara'}
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-slate-200" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          LAYAR 1: HOME CATALOG LOBBY (SEPERTI NETFLIX / CRUNCHYROLL / IMDB)
          Muncul pertama kali saat aplikasi dibuka (selectedId === null)
         ===================================================================== */}
      {!selectedAnime ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-7 space-y-10">
          {/* SECTION 1: CONTINUE WATCHING STRIP (NETFLIX / CRUNCHYROLL STYLE) */}
          {watchingAnimes.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-6 rounded-full bg-[#F97316]" />
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase">
                    Lanjutkan Menonton (Continue Watching)
                  </h2>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  Klik kartu untuk detail &amp; daftar episode, atau klik Play untuk langsung lanjut MPV
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {watchingAnimes.map((anime) => {
                  const dur = anime.durationSeconds || 1420;
                  const pct = Math.min(100, Math.round((anime.currentSeconds / dur) * 100));
                  const isLocalCached = anime.posterUrl?.startsWith('/api/poster/');

                  return (
                    <div
                      key={anime.id}
                      onClick={() => {
                        sound.playClick(true);
                        setSelectedId(anime.id);
                        setSelectedPart('ALL');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="group relative bg-[#131B2E] hover:bg-[#18223A] rounded-2xl border border-slate-800 hover:border-[#F97316]/60 overflow-hidden cursor-pointer transition-transform duration-150 hover:scale-[1.01] flex flex-col justify-between"
                    >
                      <div className="p-4 sm:p-5 flex gap-4 sm:gap-5 items-center">
                        {/* Poster Thumbnail */}
                        <div className="relative w-24 sm:w-28 aspect-[2/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                          {anime.posterUrl ? (
                            <img
                              src={anime.posterUrl}
                              alt={anime.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Film className="w-8 h-8 text-slate-600" />
                            </div>
                          )}
                          {anime.score && (
                            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#FDBA74] text-slate-950 text-[10px] font-black flex items-center gap-0.5">
                              ★ {anime.score}
                            </div>
                          )}
                        </div>

                        {/* Episode & Timestamp Readout */}
                        <div className="flex-1 min-w-0 space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-[#F97316]/20 text-[#FB923C] border border-[#F97316]/40 text-[11px] font-black uppercase">
                              EPS {anime.currentEpisodeLabel} / {anime.totalEpisodes || '?'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 text-[11px] font-black flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#FDBA74]" />
                              Menit {formatTime(anime.currentSeconds)} / {formatTime(dur)}
                            </span>
                            {isLocalCached && (
                              <span
                                className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700/50 text-[10px] font-extrabold flex items-center gap-1"
                                title="Poster sudah tersimpan di SSD lokal (100% Offline Ready)"
                              >
                                <HardDrive className="w-3 h-3" />
                                Offline Ready
                              </span>
                            )}
                          </div>

                          <div>
                            <h3 className="text-lg sm:text-xl font-black text-white truncate group-hover:text-[#F97316]">
                              {anime.title}
                            </h3>
                            <p className="text-xs font-bold text-slate-400 truncate">
                              {anime.studio || 'Studio'} • {anime.watchedEpisodes.length} dari{' '}
                              {anime.totalEpisodes || '?'} Episode Selesai
                            </p>
                          </div>

                          {/* Action Buttons */}
                          <div
                            className="flex flex-wrap items-center gap-2.5 pt-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {anime.hasLocalFiles && (
                              <TactileButton
                                variant="amber"
                                size="sm"
                                onClick={() => handlePlayMpv(anime)}
                              >
                                <Play className="w-3.5 h-3.5 fill-white" />
                                <span>
                                  Resume MPV (Eps {anime.currentEpisodeLabel} •{' '}
                                  {formatTime(anime.currentSeconds)})
                                </span>
                              </TactileButton>
                            )}

                            <TactileButton
                              variant="slate"
                              size="sm"
                              onClick={() => {
                                setSelectedId(anime.id);
                                setSelectedPart('ALL');
                              }}
                            >
                              <span>Pilih Episode &amp; Detail</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </TactileButton>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Netflix / Crunchyroll Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-800">
                        <div
                          className="h-full bg-[#F97316]"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* SECTION 2: MAIN ANIME CATALOG & WATCHLIST SHELVES (IMDB / CRUNCHYROLL GRID) */}
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <TactileButton
                  variant={activeTab === 'all' ? 'amber' : 'white'}
                  size="sm"
                  onClick={() => setActiveTab('all')}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Semua Koleksi ({tabCounts.all})</span>
                </TactileButton>

                <TactileButton
                  variant={activeTab === 'watching' ? 'amber' : 'white'}
                  size="sm"
                  onClick={() => setActiveTab('watching')}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Sedang Ditonton ({tabCounts.watching})</span>
                </TactileButton>

                <TactileButton
                  variant={activeTab === 'completed' ? 'sky' : 'white'}
                  size="sm"
                  onClick={() => setActiveTab('completed')}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Sudah Tamat ({tabCounts.completed})</span>
                </TactileButton>

                <TactileButton
                  variant={activeTab === 'plan' ? 'slate' : 'white'}
                  size="sm"
                  onClick={() => setActiveTab('plan')}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Rencana Tonton ({tabCounts.plan})</span>
                </TactileButton>

                <TactileButton
                  variant={activeTab === 'on_hold' ? 'slate' : 'white'}
                  size="sm"
                  onClick={() => setActiveTab('on_hold')}
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>On-Hold ({tabCounts.on_hold})</span>
                </TactileButton>
              </div>

              {/* Filter Search Input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Filter judul di koleksi..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#131B2E] border border-slate-700 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F97316]"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-16 text-center font-extrabold text-slate-400">
                Memuat katalog anime Chandra...
              </div>
            ) : filteredAnimes.length === 0 ? (
              <div className="bg-[#131B2E] rounded-2xl border border-slate-800 p-12 text-center space-y-3">
                <Film className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-base font-black text-white">
                  Belum ada anime di kategori ini
                </p>
                <p className="text-xs font-bold text-slate-400 max-w-md mx-auto">
                  Klik tombol <strong>Tambah Anime</strong> di atas untuk mencari dari MyAnimeList
                  (poster otomatis disimpan ke lokal) atau taruh folder video baru di{' '}
                  <code>Anideck/anime/</code>.
                </p>
                <TactileButton variant="amber" size="md" onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4" />
                  <span>Tambah Anime Baru</span>
                </TactileButton>
              </div>
            ) : (
              /* Poster Grid (2:3 Cinema Aspect Ratio like Netflix / Crunchyroll / IMDb) */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {filteredAnimes.map((anime) => {
                  const dur = anime.durationSeconds || 1420;
                  const pct = Math.min(100, Math.round((anime.currentSeconds / dur) * 100));

                  return (
                    <div
                      key={anime.id}
                      onClick={() => {
                        sound.playClick(true);
                        setSelectedId(anime.id);
                        setSelectedPart('ALL');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="group bg-[#131B2E] rounded-2xl border border-slate-800 hover:border-[#F97316] overflow-hidden cursor-pointer flex flex-col justify-between transition-transform duration-150 hover:scale-[1.02] shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
                    >
                      {/* 2:3 Poster Image */}
                      <div className="relative aspect-[2/3] w-full bg-slate-900 overflow-hidden">
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

                        {/* Top-Left IMDb Gold Score Badge */}
                        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                          {(anime.personalRating || anime.score) && (
                            <span className="px-2 py-0.5 rounded-md bg-[#FDBA74] text-slate-950 text-[11px] font-black shadow">
                              ★ {anime.personalRating ? `${anime.personalRating}/10` : anime.score}
                            </span>
                          )}
                        </div>

                        {/* Top-Right Local MKV Badge */}
                        <div className="absolute top-2.5 right-2.5">
                          {anime.hasLocalFiles ? (
                            <span className="px-2 py-0.5 rounded-md bg-slate-950/85 text-emerald-400 border border-emerald-500/40 text-[10px] font-black">
                              {anime.localFiles?.length} MKV
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-950/85 text-slate-300 border border-slate-700 text-[10px] font-bold">
                              Memory
                            </span>
                          )}
                        </div>

                        {/* Bottom Gradient Status Overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/80 to-transparent p-3 pt-10">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#F97316] text-white mb-1">
                            {anime.status === 'watching' && `EPS ${anime.currentEpisodeLabel}`}
                            {anime.status === 'completed' && '🏆 TAMAT'}
                            {anime.status === 'plan' && '📋 WATCHLIST'}
                            {anime.status === 'on_hold' && '⏸️ ON-HOLD'}
                          </span>
                          <h3 className="font-black text-sm text-white line-clamp-1 group-hover:text-[#F97316]">
                            {anime.title}
                          </h3>
                        </div>
                      </div>

                      {/* Card Footer Telemetry */}
                      <div className="p-3 bg-[#131B2E] space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                          <span>
                            {anime.status === 'completed'
                              ? `${anime.totalEpisodes || '?'} Eps Selesai`
                              : `Eps ${anime.currentEpisodeLabel} / ${anime.totalEpisodes || '?'}`}
                          </span>
                          {anime.status !== 'completed' && (
                            <span className="text-[#FDBA74] font-black">
                              ⏱️ {formatTime(anime.currentSeconds)}
                            </span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full ${
                              anime.status === 'completed' ? 'bg-emerald-500' : 'bg-[#F97316]'
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
            )}
          </section>
        </main>
      ) : (
        /* =====================================================================
           LAYAR 2: SERIES DETAIL & EPISODE VAULT (SAAT SALAH SATU ANIME DIKLIK)
           Gaya Halaman Seri Crunchyroll / Netflix / IMDb
           ===================================================================== */
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
          <section className="bg-[#131B2E] rounded-3xl border border-slate-800 shadow-[0_12px_35px_rgba(0,0,0,0.5)] p-5 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
              {/* Left Column: 2:3 Cinema Poster */}
              <div className="lg:col-span-3 flex flex-col items-center sm:items-start">
                <div className="relative w-48 sm:w-full max-w-[230px] aspect-[2/3] rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-900">
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
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-emerald-500/40 text-emerald-400 text-[10px] font-black flex items-center justify-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      <span>Tersimpan di Lokal (Offline Ready)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Series Metadata & Precision Episode/Timestamp Monitor */}
              <div className="lg:col-span-9 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedAnime.score && (
                        <span className="px-2.5 py-0.5 rounded-md bg-[#FDBA74] text-slate-950 text-xs font-black flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-slate-950" />
                          IMDb / MAL {selectedAnime.score}
                        </span>
                      )}
                      {selectedAnime.studio && (
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-xs font-extrabold">
                          {selectedAnime.studio}
                        </span>
                      )}
                      {selectedAnime.genres?.map((g) => (
                        <span
                          key={g}
                          className="px-2.5 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 text-xs font-bold"
                        >
                          {g}
                        </span>
                      ))}
                      {selectedAnime.hasLocalFiles ? (
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-700/50 text-xs font-extrabold">
                          💿 {selectedAnime.localFiles?.length} File MKV Lokal
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-400 text-xs font-bold">
                          ☁️ Tersimpan di Memori Riwayat
                        </span>
                      )}
                    </div>

                    <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                      {selectedAnime.title}
                    </h2>

                    {selectedAnime.aliases?.length > 0 && (
                      <p className="text-xs font-bold text-slate-400">
                        Judul Alternatif: {selectedAnime.aliases.join(' • ')}
                      </p>
                    )}
                  </div>

                  {/* Status Dropdown & Complete Button */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      value={selectedAnime.status}
                      onChange={(e) =>
                        saveAnimeUpdate({
                          ...selectedAnime,
                          status: e.target.value as AnimeEntry['status'],
                        })
                      }
                      className="px-3.5 py-2 rounded-xl bg-[#0B0F19] border border-slate-700 text-xs font-black text-white cursor-pointer"
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
                        <span>Tandai Tamat</span>
                      </TactileButton>
                    )}
                  </div>
                </div>

                {/* DUAL TELEMETRY CARDS: EPISODE BERAPA & MENIT BERAPA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Episode Berapa */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0F19] border border-slate-800 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Tv className="w-4 h-4 text-[#F97316]" />
                        SEKARANG DI EPISODE BERAPA?
                      </span>
                      <span className="text-xs font-extrabold text-emerald-400">
                        {selectedAnime.watchedEpisodes.length} / {selectedAnime.totalEpisodes || '?'}{' '}
                        Selesai
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-black text-white">
                          EPS {selectedAnime.currentEpisodeLabel}
                        </span>
                        <span className="text-sm font-extrabold text-slate-500">
                          dari {selectedAnime.totalEpisodes || '?'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <TactileButton
                          variant="slate"
                          size="sm"
                          onClick={() => handleStepEpisode(-1)}
                          title="Mundur 1 Episode"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </TactileButton>
                        <TactileButton
                          variant="slate"
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
                        className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                      >
                        {selectedAnime.localFiles.map((f) => (
                          <option key={f.id} value={f.episodeLabel}>
                            [{f.part}] Episode {f.episodeLabel} — {f.fileName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Card 2: Menit Berapa */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0F19] border border-slate-800 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#FDBA74]" />
                        BERHENTI DI MENIT BERAPA?
                      </span>
                      <span className="text-xs font-extrabold text-[#FDBA74]">
                        {progressPct}% Durasi
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-black text-[#FDBA74]">
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
                          className="w-14 px-2 py-1 text-center font-black text-sm rounded-xl bg-[#131B2E] border border-slate-700 text-white"
                          title="Menit"
                        />
                        <span className="font-black text-slate-400">:</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={editSec}
                          onChange={(e) => setEditSec(e.target.value)}
                          className="w-14 px-2 py-1 text-center font-black text-sm rounded-xl bg-[#131B2E] border border-slate-700 text-white"
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
                        <span>Otomatis tersimpan dari MPV atau geser manual</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary CTA Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedAnime.hasLocalFiles ? (
                      <>
                        <TactileButton
                          variant="amber"
                          size="lg"
                          onClick={() => handlePlayMpv(selectedAnime)}
                        >
                          <Play className="w-5 h-5 fill-white" />
                          <span>
                            Putar di MPV (Eps {selectedAnime.currentEpisodeLabel} •{' '}
                            {formatTime(selectedAnime.currentSeconds)})
                          </span>
                        </TactileButton>

                        {selectedAnime.currentSeconds > 10 && (
                          <TactileButton
                            variant="slate"
                            size="md"
                            onClick={() => handlePlayMpv(selectedAnime, undefined, 0)}
                          >
                            <span>Mulai dari 00:00</span>
                          </TactileButton>
                        )}
                      </>
                    ) : (
                      <div className="px-4 py-2.5 rounded-xl bg-[#0B0F19] border border-slate-800 text-xs font-bold text-slate-300 flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-[#F97316] shrink-0" />
                        <span>
                          Anime ini tercatat di memori riwayatmu (file <code>.mkv</code> lokal tidak
                          ada / sudah dihapus).
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedAnime.folderName && (
                      <TactileButton
                        variant="slate"
                        size="sm"
                        onClick={() => handleOpenExplorer(selectedAnime.folderName)}
                      >
                        <FolderOpen className="w-4 h-4 text-[#F97316]" />
                        <span>Buka Folder {selectedAnime.folderName}</span>
                      </TactileButton>
                    )}
                    <button
                      onClick={() => handleDeleteAnime(selectedAnime)}
                      className="p-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 border border-rose-800/60 cursor-pointer"
                      title="Hapus catatan anime dari memori"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* EPISODE LIST VAULT (CRUNCHYROLL / NETFLIX EPISODE CARDS) */}
            {selectedAnime.hasLocalFiles && selectedAnime.localFiles && (
              <div className="mt-8 pt-7 border-t border-slate-800 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <span>Daftar Episode ({selectedAnime.localFiles.length} Berkas MKV)</span>
                    </h3>
                    <p className="text-xs font-bold text-slate-400">
                      Klik <strong>Play MPV</strong> untuk memutar, atau klik ikon{' '}
                      <strong>✓✓</strong> untuk menandai selesai dari Episode 01 sampai episode
                      tersebut.
                    </p>
                  </div>

                  {parts.length > 1 && (
                    <div className="flex items-center gap-2">
                      <TactileButton
                        variant={selectedPart === 'ALL' ? 'amber' : 'white'}
                        size="sm"
                        onClick={() => setSelectedPart('ALL')}
                      >
                        Semua ({selectedAnime.localFiles.length})
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredEpisodes.map((ep) => {
                    const isCurrent = selectedAnime.currentEpisodeLabel === ep.episodeLabel;
                    const isWatched = selectedAnime.watchedEpisodes.includes(ep.episodeLabel);
                    const epProg = selectedAnime.episodeProgress?.[ep.episodeLabel];
                    const savedSec = isCurrent
                      ? selectedAnime.currentSeconds
                      : epProg?.seconds || 0;
                    const epDur = epProg?.duration || selectedAnime.durationSeconds || 1420;
                    const epPct = Math.min(100, Math.round((savedSec / epDur) * 100));

                    return (
                      <div
                        key={ep.id}
                        className={`rounded-2xl border overflow-hidden flex flex-col justify-between transition-transform duration-75 ${
                          isCurrent
                            ? 'bg-[#18223A] border-[#F97316] ring-1 ring-[#F97316]/50'
                            : isWatched
                              ? 'bg-[#0B0F19]/80 border-emerald-800/50'
                              : 'bg-[#0B0F19] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-black ${
                                    isCurrent
                                      ? 'bg-[#F97316] text-white'
                                      : 'bg-slate-800 text-slate-200'
                                  }`}
                                >
                                  EPS {ep.episodeLabel}
                                </span>
                                {ep.part !== 'Main' && (
                                  <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[11px] font-bold">
                                    {ep.part}
                                  </span>
                                )}
                                <span className="text-[11px] font-bold text-slate-500">
                                  {ep.sizeMB} MB
                                </span>
                              </div>
                              <p
                                className="text-xs font-bold text-slate-300 mt-1.5 truncate"
                                title={ep.fileName}
                              >
                                {ep.fileName}
                              </p>
                            </div>

                            {isWatched ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700/50 text-[11px] font-black flex items-center gap-1 shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Selesai
                              </span>
                            ) : savedSec > 5 ? (
                              <span className="px-2 py-0.5 rounded bg-amber-950/90 text-[#FDBA74] border border-amber-700/50 text-[11px] font-black flex items-center gap-1 shrink-0">
                                <Clock className="w-3 h-3" />
                                {formatTime(savedSec)}
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <TactileButton
                              variant={isCurrent ? 'amber' : 'slate'}
                              size="sm"
                              onClick={() => handlePlayMpv(selectedAnime, ep, savedSec)}
                              className="flex-1"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>
                                {savedSec > 5 ? `Resume ${formatTime(savedSec)}` : 'Play MPV'}
                              </span>
                            </TactileButton>

                            <button
                              onClick={() =>
                                handleToggleWatchedEpisode(selectedAnime, ep.episodeLabel)
                              }
                              className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                                isWatched
                                  ? 'bg-emerald-600 text-white border-emerald-500'
                                  : 'bg-[#131B2E] hover:bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                              title="Tandai episode ini selesai"
                            >
                              ✓
                            </button>

                            {!isWatched && (
                              <button
                                onClick={() =>
                                  handleMarkWatchedUpTo(selectedAnime, ep.episodeLabel)
                                }
                                className="px-2.5 py-1.5 rounded-xl bg-[#131B2E] hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-extrabold cursor-pointer"
                                title={`Tandai Episode 01 s/d ${ep.episodeLabel} sudah selesai`}
                              >
                                <CheckCheck className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Episode Bottom Progress Strip */}
                        <div className="w-full h-1 bg-slate-900">
                          <div
                            className={`h-full ${
                              isWatched ? 'bg-emerald-500' : 'bg-[#F97316]'
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

      {/* MODAL 1: TAMBAH / CARI ANIME (JIKAN MYANIMELIST + AUTO LOCAL POSTER DOWNLOAD) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#131B2E] w-full max-w-2xl rounded-3xl border border-slate-700 shadow-2xl p-6 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xl font-black text-white">
                  ➕ Tambah Anime &amp; Simpan Poster ke Lokal
                </h3>
                <p className="text-xs font-bold text-slate-400">
                  Begitu ditambahkan, poster otomatis diunduh ke harddisk lokalmu agar seterusnya
                  bebas internet!
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl bg-[#0B0F19] border border-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#0B0F19] border border-slate-800">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">
                  Kategori Status:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) =>
                    setNewStatus(e.target.value as 'watching' | 'completed' | 'plan')
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-slate-700 text-xs font-black text-white"
                >
                  <option value="watching">🟢 Sedang Ditonton</option>
                  <option value="completed">🏆 Sudah Ditonton (Tamat)</option>
                  <option value="plan">📋 Rencana Tonton</option>
                </select>
              </div>

              {newStatus === 'watching' && (
                <>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">
                      Episode Saat Ini:
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newEp}
                      onChange={(e) => setNewEp(parseInt(e.target.value || '1', 10))}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#131B2E] border border-slate-700 text-sm font-black text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">
                      Menit Terakhir:
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newMin}
                      onChange={(e) => setNewMin(parseInt(e.target.value || '0', 10))}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#131B2E] border border-slate-700 text-sm font-black text-white"
                      placeholder="Contoh: 14"
                    />
                  </div>
                </>
              )}

              {newStatus === 'completed' && (
                <>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">
                      Rating Pribadi (1-10):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newRating}
                      onChange={(e) => setNewRating(parseInt(e.target.value || '9', 10))}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#131B2E] border border-slate-700 text-sm font-black text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">
                      Ulasan Singkat:
                    </label>
                    <input
                      type="text"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="Masterpiece!"
                      className="w-full px-3 py-1.5 rounded-xl bg-[#131B2E] border border-slate-700 text-sm font-bold text-white"
                    />
                  </div>
                </>
              )}
            </div>

            <form onSubmit={handleSearchMal} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari judul anime di MyAnimeList (misal: Frieren, Solo Leveling)..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B0F19] border border-slate-700 text-sm font-extrabold text-white"
                  autoFocus
                />
              </div>
              <TactileButton type="submit" variant="amber" size="md" disabled={searchingMal}>
                {searchingMal ? 'Mencari...' : 'Cari MAL'}
              </TactileButton>
              <TactileButton type="button" variant="slate" size="md" onClick={handleAddManual}>
                Simpan Manual
              </TactileButton>
            </form>

            <div className="space-y-2.5">
              {jikanResults.map((item) => {
                const canonicalTitle = item.title_english || item.title;
                const existing = checkDuplicate(canonicalTitle, item.mal_id);
                return (
                  <div
                    key={item.mal_id}
                    className="p-3 rounded-2xl bg-[#0B0F19] border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.images?.jpg?.image_url}
                        alt={item.title}
                        className="w-12 h-16 object-cover rounded-lg border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-black text-sm text-white truncate">
                          {canonicalTitle}
                        </h4>
                        <p className="text-xs font-bold text-slate-400 truncate">
                          {item.title} • {item.episodes || '?'} Eps • ★ {item.score || '-'}
                        </p>
                        {existing && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-amber-950 text-[#FDBA74] border border-amber-700/50 text-[11px] font-black">
                            <AlertTriangle className="w-3 h-3" />
                            Sudah ada di{' '}
                            {existing.status === 'completed' ? 'Riwayat Tamat' : 'Koleksimu'}!
                          </span>
                        )}
                      </div>
                    </div>

                    <TactileButton
                      variant={existing ? 'slate' : 'emerald'}
                      size="sm"
                      onClick={() => handleAddFromJikan(item)}
                    >
                      {existing ? 'Buka' : '+ Tambah & Cache Poster'}
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
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#131B2E] w-full max-w-md rounded-3xl border border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Trophy className="w-6 h-6 text-[#FDBA74]" />
                <span>Tamatkan Anime!</span>
              </h3>
              <button
                onClick={() => setCompletingAnime(null)}
                className="p-1.5 rounded-xl border border-slate-700 bg-[#0B0F19] text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm font-bold text-slate-300">
              Pindahkan <strong>{completingAnime.title}</strong> ke daftar{' '}
              <strong>🏆 Sudah Tamat</strong>. Poster &amp; riwayat ini tetap tersimpan permanen di
              lokal meskipun file <code>.mkv</code>-nya kamu hapus!
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-1">
                  Rating Pribadimu (1 - 10):
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={completeRating}
                  onChange={(e) => setCompleteRating(parseInt(e.target.value || '9', 10))}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0B0F19] border border-slate-700 font-black text-base text-[#FDBA74]"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-1">
                  Ulasan / Kesan Singkat:
                </label>
                <textarea
                  rows={3}
                  value={completeReview}
                  onChange={(e) => setCompleteReview(e.target.value)}
                  placeholder="Ceritanya gila banget, ending Part 2 bikin merinding..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0B0F19] border border-slate-700 font-bold text-sm text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <TactileButton variant="slate" size="md" onClick={() => setCompletingAnime(null)}>
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
