import { create } from 'zustand';

export const BOMB_MAGAZINE_SIZE = 10;
export const BOMB_RELOAD_SECONDS = 3;
const BOMB_RELOAD_MS = BOMB_RELOAD_SECONDS * 1000;

type BombLauncherState = {
  ammo: number;
  reloadUntil: number | null;
};

export const useBombLauncherStore = create<BombLauncherState>(() => ({
  ammo: BOMB_MAGAZINE_SIZE,
  reloadUntil: null,
}));

export function updateBombLauncher(now = performance.now()) {
  const state = useBombLauncherStore.getState();
  if (state.reloadUntil === null || now < state.reloadUntil) return;
  useBombLauncherStore.setState({ ammo: BOMB_MAGAZINE_SIZE, reloadUntil: null });
}

export function tryFireBombLauncher(now = performance.now()) {
  updateBombLauncher(now);
  const state = useBombLauncherStore.getState();
  if (state.reloadUntil !== null || state.ammo <= 0) return false;
  const ammo = state.ammo - 1;
  useBombLauncherStore.setState({ ammo, reloadUntil: ammo === 0 ? now + BOMB_RELOAD_MS : null });
  return true;
}

export function resetBombLauncher() {
  useBombLauncherStore.setState({ ammo: BOMB_MAGAZINE_SIZE, reloadUntil: null });
}
