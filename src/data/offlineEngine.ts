import rawCatalog from './offlineCatalog.json';
import type { AnimeEntry, JikanAnimeItem } from '../types/anime';

export interface OfflineCatalogEntry {
  mal_id: number;
  title: string;
  title_english: string;
  title_synonyms: string[];
  episodes: number;
  score: number;
  year: number;
  genres: string[];
  studio: string;
  poster: string;
}

export interface RecommendedAnimeItem extends JikanAnimeItem {
  reason: string;
  matchScore: number;
  year?: number;
}

const catalog = rawCatalog as OfflineCatalogEntry[];

export const OFFLINE_CATALOG_COUNT = catalog.length;

function toJikanItem(entry: OfflineCatalogEntry): JikanAnimeItem {
  return {
    mal_id: entry.mal_id,
    title: entry.title,
    title_english: entry.title_english,
    title_synonyms: entry.title_synonyms,
    episodes: entry.episodes,
    score: entry.score,
    studios: entry.studio ? [{ name: entry.studio }] : [],
    genres: entry.genres.map((g) => ({ name: g })),
    images: {
      jpg: {
        image_url: entry.poster,
        large_image_url: entry.poster,
      },
    },
  };
}

// Fast character bigram similarity (Dice coefficient) so even typos work 100% offline!
function bigramSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s2.includes(s1) || s1.includes(s2)) return 0.9;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = new Set<string>();
  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.slice(i, i + 2));
  }
  let matches = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    if (bigrams1.has(s2.slice(i, i + 2))) {
      matches++;
    }
  }
  return (2 * matches) / (s1.length - 1 + (s2.length - 1));
}

export function searchOfflineCatalog(query: string, limit = 8): JikanAnimeItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const scored: { entry: OfflineCatalogEntry; sim: number }[] = [];

  for (const entry of catalog) {
    const candidates = [
      entry.title_english,
      entry.title,
      ...(entry.title_synonyms || []),
    ].filter(Boolean);

    let bestSim = 0;
    for (const c of candidates) {
      const cLow = c.toLowerCase();
      if (cLow === q) {
        bestSim = 1.2;
        break;
      }
      if (cLow.startsWith(q)) {
        bestSim = Math.max(bestSim, 1.05);
      } else if (cLow.includes(q)) {
        bestSim = Math.max(bestSim, 0.92);
      } else {
        // Check word-by-word or full string bigram similarity for typos (e.g. "Friren" -> "Frieren")
        const words = cLow.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
        for (const w of words) {
          bestSim = Math.max(bestSim, bigramSimilarity(q, w));
        }
        bestSim = Math.max(bestSim, bigramSimilarity(q, cLow));
      }
    }

    if (bestSim >= 0.45) {
      // Slightly boost by score so main seasons rank above obscure spin-offs
      const finalScore = bestSim + (entry.score || 7.5) * 0.015;
      scored.push({ entry, sim: finalScore });
    }
  }

  scored.sort((a, b) => b.sim - a.sim);
  return scored.slice(0, limit).map((s) => toJikanItem(s.entry));
}

function getBaseFranchiseKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/season\s*\d+|part\s*\d+|2nd\s*season|3rd\s*season|final\s*season|cour\s*\d+/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 14);
}

export function getOfflineRecommendations(
  userAnimes: AnimeEntry[],
  limit = 10
): RecommendedAnimeItem[] {
  // Gather user's favorite genres & studios from Watching and Completed anime
  const seedAnimes = userAnimes.filter(
    (a) => a.status === 'watching' || a.status === 'completed'
  );
  const activeSeeds = seedAnimes.length > 0 ? seedAnimes : userAnimes;

  const genreWeights = new Map<string, { weight: number; sourceTitle: string }>();
  const studioWeights = new Map<string, string>();
  const ownedIds = new Set<number>();
  const ownedFranchises = new Set<string>();

  for (const a of userAnimes) {
    if (a.malId) ownedIds.add(a.malId);
    ownedFranchises.add(getBaseFranchiseKey(a.title));
    for (const al of a.aliases || []) {
      ownedFranchises.add(getBaseFranchiseKey(al));
    }
  }

  for (const a of activeSeeds) {
    const mult = a.personalRating ? a.personalRating / 8 : 1.1;
    for (const g of a.genres || []) {
      const prev = genreWeights.get(g);
      const nextWeight = (prev?.weight || 0) + 2.2 * mult;
      genreWeights.set(g, {
        weight: nextWeight,
        sourceTitle: prev?.sourceTitle || a.title,
      });
    }
    if (a.studio) {
      studioWeights.set(a.studio.toLowerCase(), a.title);
    }
  }

  const results: RecommendedAnimeItem[] = [];
  const seenFranchises = new Set<string>();

  for (const entry of catalog) {
    if (ownedIds.has(entry.mal_id)) continue;
    const fKey = getBaseFranchiseKey(entry.title_english || entry.title);
    const fKeyRomaji = getBaseFranchiseKey(entry.title);
    if (ownedFranchises.has(fKey) || ownedFranchises.has(fKeyRomaji)) continue;
    // Deduplicate sequel seasons in recommendations so user gets 10 distinct anime franchises
    if (seenFranchises.has(fKey) || seenFranchises.has(fKeyRomaji)) continue;

    let affinity = (entry.score || 8.0) * 0.9;
    const matchedGenres: string[] = [];
    let seedReference = activeSeeds[0]?.title || 'Koleksimu';

    for (const g of entry.genres || []) {
      const gw = genreWeights.get(g);
      if (gw) {
        affinity += gw.weight;
        matchedGenres.push(g);
        seedReference = gw.sourceTitle;
      }
    }

    const studioMatch =
      entry.studio && studioWeights.get(entry.studio.toLowerCase());
    if (studioMatch) {
      affinity += 2.5;
    }

    // Require at least 1 shared genre if user has genres in their collection
    if (genreWeights.size > 0 && matchedGenres.length === 0 && !studioMatch) {
      continue;
    }

    seenFranchises.add(fKey);
    seenFranchises.add(fKeyRomaji);

    const reason =
      matchedGenres.length > 0
        ? `Karena kamu tonton ${seedReference} • ${matchedGenres.slice(0, 2).join(' & ')}`
        : studioMatch
          ? `Satu studio dengan ${studioMatch} (${entry.studio})`
          : `Top Rated Anime • ★ ${entry.score}`;

    results.push({
      ...toJikanItem(entry),
      reason,
      matchScore: affinity,
      year: entry.year,
    });
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  return results.slice(0, limit);
}
