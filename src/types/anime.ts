export interface EpisodeFile {
  id: string;
  part: string;
  episodeNum: number;
  episodeLabel: string;
  fileName: string;
  fullPath: string;
  sizeMB: number;
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
  hasLocalFiles?: boolean;
  localFiles?: EpisodeFile[];
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
  images?: {
    jpg?: {
      large_image_url?: string;
      image_url?: string;
    };
  };
  studios?: { name: string }[];
  genres?: { name: string }[];
}
