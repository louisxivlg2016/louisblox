import { create } from 'zustand';

export const MAX_HOMES = 5;
export const NO_HOMES: Home[] = [];
const STORAGE_KEY = 'louisblox-homes-v1';

export type Home = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
};

type HomePosition = Omit<Home, 'id' | 'name'>;
type HomeResult = { home: Home; error?: never } | { home?: never; error: string };

type HomeState = {
  open: boolean;
  homes: Record<string, Home[]>;
  setOpen: (open: boolean) => void;
  createHome: (worldId: string, name: string, position: HomePosition) => HomeResult;
  renameHome: (worldId: string, id: string, name: string) => boolean;
  deleteHome: (worldId: string, id: string) => void;
};

function parseHome(value: unknown): Home | null {
  if (!value || typeof value !== 'object') return null;
  const home = value as Record<string, unknown>;
  if (typeof home.id !== 'string' || home.id.length < 1 || home.id.length > 80) return null;
  if (typeof home.name !== 'string' || !home.name.trim() || home.name.trim().length > 32) return null;
  if (!['x', 'y', 'z', 'yaw', 'pitch'].every((key) => typeof home[key] === 'number' && Number.isFinite(home[key]))) return null;
  return {
    id: home.id,
    name: home.name.trim(),
    x: home.x as number,
    y: home.y as number,
    z: home.z as number,
    yaw: home.yaw as number,
    pitch: home.pitch as number,
  };
}

function readHomes(): Record<string, Home[]> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    const homes: Record<string, Home[]> = {};
    for (const [worldId, entries] of Object.entries(saved).slice(0, 128)) {
      if (!Array.isArray(entries)) continue;
      homes[worldId] = entries.slice(0, MAX_HOMES).map(parseHome).filter((home): home is Home => home !== null);
    }
    return homes;
  } catch {
    return {};
  }
}

function saveHomes(homes: Record<string, Home[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(homes));
  } catch {
  }
}

export const useHomeStore = create<HomeState>((set, get) => {
  const update = (worldId: string, homes: Home[]) => {
    const next = { ...get().homes, [worldId]: homes };
    saveHomes(next);
    set({ homes: next });
  };
  return {
    open: false,
    homes: readHomes(),
    setOpen: (open) => set({ open }),
    createHome: (worldId, name, position) => {
      const trimmed = name.trim().slice(0, 32);
      if (!trimmed) return { error: 'Donne un nom à ta maison.' };
      if (!Object.values(position).every((value) => Number.isFinite(value))) return { error: 'Cette position est invalide.' };
      const current = get().homes[worldId] ?? NO_HOMES;
      if (current.length >= MAX_HOMES) return { error: 'Tu as déjà 5 maisons dans ce monde. Supprime-en une pour en créer une autre.' };
      const home = { id: crypto.randomUUID(), name: trimmed, ...position };
      update(worldId, [...current, home]);
      return { home };
    },
    renameHome: (worldId, id, name) => {
      const trimmed = name.trim().slice(0, 32);
      if (!trimmed || !get().homes[worldId]?.some((home) => home.id === id)) return false;
      update(worldId, get().homes[worldId].map((home) => home.id === id ? { ...home, name: trimmed } : home));
      return true;
    },
    deleteHome: (worldId, id) => {
      const current = get().homes[worldId];
      if (current) update(worldId, current.filter((home) => home.id !== id));
    },
  };
});
