import { create } from 'zustand';
import type { World } from 'koota';
import { DEEP_CHESTS, DEEP_SPAWN, DEEP_SURFACE_Y } from './deepArena';
import { getBlockIndex } from './chunks';
import { getSwimState } from './swimming';
import { Player, PlayerPosition } from './traits';
import { useGameStore } from './store';
import { readModeProgress, writeModeProgress } from './modeProgress';
import { respawnAtBase } from './battle';
import { world } from './world';
import { translate } from './language';

const initial = { coins: 0, findings: 0, gear: 0, oxygen: 60, opened: {} as Record<string, number>, depth: 0 };
export const useDeepStore = create<typeof initial>(() => ({ ...initial, opened: {} }));
let loadedWorld = '';
let lastPersist = 0;

export function deepMaxOxygen(gear: number) {
  return gear >= 3 ? 480 : gear === 2 ? 240 : gear === 1 ? 120 : 60;
}
function persist() {
  const worldId = useGameStore.getState().worldId;
  if (worldId) writeModeProgress('deep-dive', worldId, useDeepStore.getState());
}
export function clearDeep() {
  loadedWorld = '';
  useDeepStore.setState({ ...initial, opened: {} });
}
function ensureDeep() {
  const game = useGameStore.getState();
  if (loadedWorld === game.worldId) return;
  loadedWorld = game.worldId;
  const saved = readModeProgress('deep-dive', game.worldId, initial);
  const gear = typeof saved.gear === 'number' ? Math.max(0, Math.min(3, Math.floor(saved.gear))) : 0;
  useDeepStore.setState({
    coins: typeof saved.coins === 'number' ? Math.max(0, Math.floor(saved.coins)) : 0,
    findings: typeof saved.findings === 'number' ? Math.max(0, Math.floor(saved.findings)) : 0,
    gear,
    oxygen: deepMaxOxygen(gear),
    opened: saved.opened && typeof saved.opened === 'object' ? saved.opened : {},
    depth: 0,
  });
}

export function sellDeepFindings() {
  ensureDeep();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const state = useDeepStore.getState();
  if (!player || player.y < DEEP_SURFACE_Y - 1 || Math.hypot(player.x, player.z) > 7) {
    useGameStore.getState().setNotice(translate('Remonte sur la plateforme pour vendre.', 'Return to the surface platform to sell.'));
    return;
  }
  if (state.findings <= 0) return;
  useDeepStore.setState({ coins: state.coins + state.findings, findings: 0 });
  useGameStore.getState().setNotice(translate(`Trouvailles vendues · ${state.coins + state.findings} pièces.`, `Findings sold · ${state.coins + state.findings} coins.`));
  persist();
}

export function buyDeepGear() {
  ensureDeep();
  const state = useDeepStore.getState();
  const next = state.gear + 1;
  const cost = next === 1 ? 150 : next === 2 ? 400 : 900;
  if (next > 3 || state.coins < cost) return;
  useDeepStore.setState({ gear: next, coins: state.coins - cost, oxygen: deepMaxOxygen(next) });
  useGameStore.getState().setNotice(translate(`Équipement niveau ${next} · ${deepMaxOxygen(next)} s d’oxygène.`, `Gear level ${next} · ${deepMaxOxygen(next)} s of oxygen.`));
  persist();
}

export function deepControlSystem(world: World, dt: number, actions: { harvest: number; tap: number; interact: number }) {
  if (useGameStore.getState().gameplayMode !== 'deep-dive') return false;
  ensureDeep();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return true;
  const state = useDeepStore.getState();
  const swimming = getSwimState(getBlockIndex(world), player);
  const maximum = deepMaxOxygen(state.gear);
  const oxygen = swimming.underwater ? Math.max(0, state.oxygen - dt) : maximum;
  const depth = Math.max(0, DEEP_SURFACE_Y - player.y);
  const now = Date.now();
  useDeepStore.setState({ oxygen, depth });
  if (oxygen <= 0) {
    const findings = Math.floor(state.findings / 2);
    useDeepStore.setState({ findings, oxygen: maximum });
    respawnAtBase(world, null, DEEP_SPAWN);
    useGameStore.getState().setNotice(translate('Oxygène épuisé · la moitié des trouvailles est perdue.', 'Out of oxygen · half of your findings were lost.'));
    persist();
    return true;
  }
  if (player.y >= DEEP_SURFACE_Y - 1 && Math.hypot(player.x, player.z) <= 7 && (actions.harvest > 0 || actions.tap > 0 || actions.interact > 0)) {
    sellDeepFindings();
    return true;
  }
  const chest = DEEP_CHESTS.find((entry) => Math.hypot(player.x - entry.x, player.y - entry.y, player.z - entry.z) <= 3);
  if (chest && (actions.harvest > 0 || actions.tap > 0 || actions.interact > 0)) {
    if ((state.opened[chest.id] ?? 0) > now) useGameStore.getState().setNotice(translate('Ce coffre réapparaîtra dans une minute.', 'This chest will respawn in one minute.'));
    else if (state.gear < chest.gear) useGameStore.getState().setNotice(translate(`Équipement de plongée niveau ${chest.gear} requis.`, `Diving gear level ${chest.gear} required.`));
    else {
      useDeepStore.setState({ findings: state.findings + chest.value, opened: { ...state.opened, [chest.id]: now + 60000 } });
      useGameStore.getState().setNotice(translate(`${chest.name} ouvert · +${chest.value} de trouvailles.`, `${chest.name} opened · +${chest.value} findings.`));
      persist();
    }
  }
  if (now - lastPersist >= 5000) {
    lastPersist = now;
    persist();
  }
  return true;
}
