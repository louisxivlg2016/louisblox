import { create } from 'zustand';

export const SEASONS = ['auto', 'spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

function initialSeason(): Season {
  try {
    const saved = localStorage.getItem('louisblox-season');
    return (SEASONS as readonly string[]).includes(saved ?? '') ? saved as Season : 'auto';
  } catch {
    return 'auto';
  }
}

function initialMixedSeasons(): Season[] {
  try {
    const saved = JSON.parse(localStorage.getItem('louisblox-mixed-seasons') ?? '[]');
    return Array.isArray(saved) ? saved.filter((season): season is Season => isSeason(season) && season !== 'auto').slice(0, 4) : [];
  } catch {
    return [];
  }
}

export const useSeasonStore = create<{ season: Season; mixedSeasons: Season[]; setSeason: (season: Season) => void; setMixedSeasons: (seasons: Season[]) => void }>((set) => ({
  season: initialSeason(),
  mixedSeasons: initialMixedSeasons(),
  setSeason: (season) => {
    try {
      localStorage.setItem('louisblox-season', season);
    } catch {
    }
    set({ season });
  },
  setMixedSeasons: (seasons) => {
    const mixedSeasons = [...new Set(seasons.filter((season) => season !== 'auto'))].slice(0, 4);
    try {
      localStorage.setItem('louisblox-mixed-seasons', JSON.stringify(mixedSeasons));
    } catch {
    }
    set({ mixedSeasons });
  },
}));

export function isSeason(value: unknown): value is Season {
  return typeof value === 'string' && (SEASONS as readonly string[]).includes(value);
}
