export interface EpisodeFile {
  id: string;
  part: string;
  episodeNum: number;
  episodeLabel: string;
  fileName: string;
  fullPath: string;
  sizeMB: number;
}

export interface SceneBookmark {
  id: string;
  episodeLabel: string;
  seconds: number;
  label: string;
  createdAt: string;
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
  bookmarks?: SceneBookmark[];
  hasLocalFiles?: boolean;
  localFiles?: EpisodeFile[];
  totalDiskMB?: number;
}

export interface LiveMpvState {
  active: boolean;
  animeId: string | null;
  episodeLabel: string | null;
  fileName: string | null;
  seconds: number;
  duration: number;
}

export interface JikanAnimeItem {
  mal_id: number;
  title: string;
  title_english?: string;
  title_synonyms?: string[];
  episodes?: number;
  score?: number;
  year?: number;
  images?: {
    jpg?: {
      large_image_url?: string;
      image_url?: string;
    };
  };
  studios?: { name: string }[];
  genres?: { name: string }[];
}

