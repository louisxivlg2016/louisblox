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

export const useSeasonStore = create<{ season: Season; setSeason: (season: Season) => void }>((set) => ({
  season: initialSeason(),
  setSeason: (season) => {
    try {
      localStorage.setItem('louisblox-season', season);
    } catch {
    }
    set({ season });
  },
}));

export function isSeason(value: unknown): value is Season {
  return typeof value === 'string' && (SEASONS as readonly string[]).includes(value);
}
