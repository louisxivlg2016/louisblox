import { create } from 'zustand';
import type { World } from 'koota';
import { DEEP_CHESTS, DEEP_SURFACE_Y, DEEP_VENDOR } from './deepArena';
import { addVoxel, getBlockIndex, removeVoxel } from './chunks';
import { Player, PlayerPosition } from './traits';
import { useGameStore } from './store';
import { BlockKind, voxelKey } from './voxel';
import { releasePointerForOverlay } from './input';
import { readModeProgress, writeModeProgress } from './modeProgress';
import { world } from './world';
import { translate } from './language';
import { useCharacterStore } from './characterStore';

const initial = { coins: 0, findings: 0, gear: 0, oxygen: 60, opened: {} as Record<string, number>, depth: 0 };
export const useDeepStore = create<typeof initial>(() => ({ ...initial, opened: {} }));
let loadedWorld = '';
let lastPersist = 0;

export function deepMaxOxygen(gear: number) {
  return gear >= 3 ? 480 : gear === 2 ? 240 : gear === 1 ? 120 : 60;
}

function nearVendor(player: { x: number; y: number; z: number }) {
  return player.y >= DEEP_SURFACE_Y - 1 && Math.hypot(player.x - DEEP_VENDOR.x, player.z - DEEP_VENDOR.z) <= 3;
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
  useCharacterStore.getState().setOutfit('diver');
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
  if (!player || !nearVendor(player)) {
    useGameStore.getState().setNotice(translate('Remonte au stand VENTE & OXYGÈNE pour vendre.', 'Return to the SALES & OXYGEN stand to sell.'));
    return;
  }
  if (state.findings <= 0) return;
  useDeepStore.setState({ coins: state.coins + state.findings, findings: 0 });
  useGameStore.getState().setNotice(translate(`Trouvailles vendues · ${state.coins + state.findings} pièces.`, `Findings sold · ${state.coins + state.findings} coins.`));
  persist();
}

export function buyDeepGear() {
  ensureDeep();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player || !nearVendor(player)) {
    useGameStore.getState().setNotice(translate('Achète ton équipement au stand VENTE & OXYGÈNE.', 'Buy your gear at the SALES & OXYGEN stand.'));
    return;
  }
  const state = useDeepStore.getState();
  const next = state.gear + 1;
  const cost = next === 1 ? 150 : next === 2 ? 400 : 900;
  if (next > 3 || state.coins < cost) return;
  useDeepStore.setState({ gear: next, coins: state.coins - cost, oxygen: deepMaxOxygen(next) });
  useGameStore.getState().setNotice(translate(`Équipement niveau ${next} · ${deepMaxOxygen(next)} s d’oxygène.`, `Gear level ${next} · ${deepMaxOxygen(next)} s of oxygen.`));
  persist();
}

export function buyDeepOxygen() {
  ensureDeep();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player || !nearVendor(player)) {
    useGameStore.getState().setNotice(translate('Remonte au stand VENTE & OXYGÈNE pour recharger.', 'Return to the SALES & OXYGEN stand to refill.'));
    return;
  }
  const state = useDeepStore.getState();
  if (state.coins < 25) return;
  useDeepStore.setState({ coins: state.coins - 25, oxygen: state.oxygen + 30 });
  useGameStore.getState().setNotice(translate('+30 secondes d’oxygène.', '+30 seconds of oxygen.'));
  persist();
}

export function deepControlSystem(world: World, _dt: number, actions: { harvest: number; tap: number; interact: number }) {
  if (useGameStore.getState().gameplayMode !== 'deep-dive') return false;
  ensureDeep();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return true;
  const state = useDeepStore.getState();
  const maximum = deepMaxOxygen(state.gear);
  const oxygen = Math.max(state.oxygen, maximum);
  const depth = Math.max(0, DEEP_SURFACE_Y - player.y);
  const now = Date.now();
  useDeepStore.setState({ oxygen, depth });
  if (nearVendor(player) && (actions.harvest > 0 || actions.tap > 0 || actions.interact > 0)) {
    useGameStore.setState({ shopOpen: true, mode: 'pause' });
    releasePointerForOverlay();
    return true;
  }
  const chest = DEEP_CHESTS.find((entry) => Math.hypot(player.x - entry.x, player.y - entry.y, player.z - entry.z) <= 3);
  if (chest && (actions.harvest > 0 || actions.tap > 0 || actions.interact > 0)) {
    if ((state.opened[chest.id] ?? 0) > now) useGameStore.getState().setNotice(translate('Ce coffre réapparaîtra dans une minute.', 'This chest will respawn in one minute.'));
    else if (state.gear < chest.gear) useGameStore.getState().setNotice(translate(`Équipement de plongée niveau ${chest.gear} requis.`, `Diving gear level ${chest.gear} required.`));
    else {
      useDeepStore.setState({ findings: state.findings + chest.value, opened: { ...state.opened, [chest.id]: now + 60000 } });
      const block = getBlockIndex(world).get(voxelKey(chest.x, chest.y, chest.z));
      if (block) removeVoxel(world, { block, x: chest.x, y: chest.y, z: chest.z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, true);
      useGameStore.getState().setNotice(translate(`${chest.name} ouvert · +${chest.value} de trouvailles.`, `${chest.name} opened · +${chest.value} findings.`));
      persist();
    }
  }
  for (const chest of DEEP_CHESTS) {
    if (!state.opened[chest.id] || state.opened[chest.id] > now) continue;
    if (!getBlockIndex(world).has(voxelKey(chest.x, chest.y, chest.z))) addVoxel(world, chest.x, chest.y, chest.z, BlockKind.Chest, undefined, undefined, 0, undefined, undefined, false, true);
    const opened = { ...useDeepStore.getState().opened };
    delete opened[chest.id];
    useDeepStore.setState({ opened });
  }
  if (now - lastPersist >= 5000) {
    lastPersist = now;
    persist();
  }
  return true;
}
