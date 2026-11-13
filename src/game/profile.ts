import { create } from 'zustand';
import { useGameStore } from './store';

const PLAYTIME_KEY = 'louisblox-playtime-v1';
const CREATED_KEY = 'louisblox-account-created-v1';
let remainder = 0;

function savedCreatedAt() {
  try {
    const saved = Number(localStorage.getItem(CREATED_KEY));
    if (Number.isFinite(saved) && saved > 0) return saved;
    const worlds = JSON.parse(localStorage.getItem('louisblox-worlds-v1') ?? '[]');
    const firstWorld = Array.isArray(worlds) ? worlds.reduce((earliest, world) => {
      const updatedAt = typeof world?.updatedAt === 'number' && Number.isFinite(world.updatedAt) && world.updatedAt > 0 ? world.updatedAt : Infinity;
      return Math.min(earliest, updatedAt);
    }, Infinity) : Infinity;
    const createdAt = Number.isFinite(firstWorld) ? firstWorld : Date.now();
    localStorage.setItem(CREATED_KEY, String(createdAt));
    return createdAt;
  } catch {
    return Date.now();
  }
}

function savedSeconds() {
  try {
    const value = Number(localStorage.getItem(PLAYTIME_KEY));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export const useProfileStore = create<{ seconds: number; createdAt: number; addSeconds: (amount: number) => void }>((set) => ({
  seconds: savedSeconds(),
  createdAt: savedCreatedAt(),
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
