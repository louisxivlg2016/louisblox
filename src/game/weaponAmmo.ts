import { create } from 'zustand';
import { useGameStore } from './store';

export const BOMB_MAGAZINE_SIZE = 10;
export const BOMB_RELOAD_SECONDS = 3;
export const PIRATE_BOMB_RELOAD_SECONDS = 20;

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
  const reloadSeconds = useGameStore.getState().gameplayMode === 'pirates' ? PIRATE_BOMB_RELOAD_SECONDS : BOMB_RELOAD_SECONDS;
  useBombLauncherStore.setState({ ammo, reloadUntil: ammo === 0 ? now + reloadSeconds * 1000 : null });
  return true;
}

export function resetBombLauncher() {
  useBombLauncherStore.setState({ ammo: BOMB_MAGAZINE_SIZE, reloadUntil: null });
}
