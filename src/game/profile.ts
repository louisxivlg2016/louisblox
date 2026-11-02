import { create } from 'zustand';
import { useGameStore } from './store';

const PLAYTIME_KEY = 'louisblox-playtime-v1';
let remainder = 0;

function savedSeconds() {
  try {
    const value = Number(localStorage.getItem(PLAYTIME_KEY));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export const useProfileStore = create<{ seconds: number; addSeconds: (amount: number) => void }>((set) => ({
  seconds: savedSeconds(),
  addSeconds: (amount) => set((state) => {
    const seconds = state.seconds + amount;
    if (seconds % 10 < amount) {
      try {
        localStorage.setItem(PLAYTIME_KEY, String(seconds));
      } catch {
      }
    }
    return { seconds };
  }),
}));

export function recordPlaytime(delta: number) {
  if (useGameStore.getState().mode !== 'play') {
    remainder = 0;
    return;
  }
  remainder += delta;
  const seconds = Math.floor(remainder);
  if (seconds <= 0) return;
  remainder -= seconds;
  useProfileStore.getState().addSeconds(seconds);
}

export function flushPlaytime() {
  try {
    localStorage.setItem(PLAYTIME_KEY, String(useProfileStore.getState().seconds));
  } catch {
  }
}
