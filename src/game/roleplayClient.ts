import { create } from 'zustand';
import type { World } from 'koota';
import { addVoxel } from './chunks';
import { BlockKind } from './voxel';
import { ROLEPLAY_FIRE_STATION, ROLEPLAY_HOMES, ROLEPLAY_MARKET, ROLEPLAY_MINE, ROLEPLAY_POLICE } from './roleplayCity';
import { useGameStore } from './store';
import { useMultiplayerStore } from './multiplayerStore';
import { readModeProgress, writeModeProgress } from './modeProgress';
import { useCharacterStore } from './characterStore';
import { world } from './world';
import { Player, PlayerPosition } from './traits';
import { translate } from './language';
import { arrestRoleplayThief, clearRoleplayLife, roleplayLifeSystem } from './roleplayLife';
import { selectedItemPrice } from './shops';
import { changeInventory, sellableInventoryCount } from './inventory';
import { selectionInfo } from './items';

export type RoleplayJob = 'miner' | 'merchant' | 'police' | 'builder' | 'firefighter';
const initial = { job: null as RoleplayJob | null, coins: 0, workReadyAt: 0, panelOpen: true };
export const useRoleplayStore = create<typeof initial>(() => ({ ...initial }));
let loadedWorld = '';
const respawns = new WeakMap<World, Array<{ x: number; y: number; z: number; kind: BlockKind; at: number }>>();

function persist() {
  const worldId = useGameStore.getState().worldId;
  const state = useRoleplayStore.getState();
  if (worldId) writeModeProgress('roleplay', worldId, { job: state.job, coins: state.coins });
}
export function clearRoleplay() {
  loadedWorld = '';
  clearRoleplayLife();
  useRoleplayStore.setState({ ...initial });
}

export function earnRoleplayCoins(amount: number) {
  ensureRoleplay();
  const state = useRoleplayStore.getState();
  useRoleplayStore.setState({ coins: state.coins + Math.max(0, Math.floor(amount)) });
  persist();
}
function ensureRoleplay() {
  const game = useGameStore.getState();
  if (loadedWorld === game.worldId) return;
  loadedWorld = game.worldId;
  const saved = readModeProgress('roleplay', game.worldId, { job: null as RoleplayJob | null, coins: 0 });
  const job = saved.job === 'miner' || saved.job === 'merchant' || saved.job === 'police' || saved.job === 'builder' || saved.job === 'firefighter' ? saved.job : null;
  useRoleplayStore.setState({ job, coins: typeof saved.coins === 'number' ? Math.max(0, Math.floor(saved.coins)) : 0, workReadyAt: 0, panelOpen: job === null });
  if (job) useCharacterStore.getState().setOutfit(job === 'merchant' ? 'trader' : job === 'police' ? 'police' : job === 'firefighter' ? 'firefighter' : 'worker');
}
export function chooseRoleplayJob(job: RoleplayJob) {
  ensureRoleplay();
  useRoleplayStore.setState({ job, panelOpen: false });
  useCharacterStore.getState().setOutfit(job === 'merchant' ? 'trader' : job === 'police' ? 'police' : job === 'firefighter' ? 'firefighter' : 'worker');
  if (job === 'police') useGameStore.setState({ hotbarSlots: ['handcuffs', 'pickaxe_wood', ...Array(8).fill(null)], selected: 'handcuffs', selectedSlot: 0 });
  if (job === 'miner') useGameStore.setState({ hotbarSlots: ['pickaxe_iron', ...Array(9).fill(null)], selected: 'pickaxe_iron', selectedSlot: 0 });
  persist();
}
export function roleplayHome() {
  const name = useMultiplayerStore.getState().playerName;
  const hash = [...name].reduce((total, letter) => (total * 31 + letter.charCodeAt(0)) >>> 0, 7);
  return ROLEPLAY_HOMES[hash % ROLEPLAY_HOMES.length];
}
export function canRoleplayBuildAt(x: number, z: number) {
  if (useGameStore.getState().gameplayMode !== 'roleplay') return true;
  if (useRoleplayStore.getState().job === 'builder') return true;
  const home = roleplayHome();
  return Math.abs(x - home.x) <= 6 && Math.abs(z - home.z) <= 6;
}
export function canRoleplayMineAt(x: number, z: number) {
  if (useGameStore.getState().gameplayMode !== 'roleplay') return true;
  const home = roleplayHome();
  return Math.abs(x - home.x) <= 6 && Math.abs(z - home.z) <= 6 || Math.hypot(x - ROLEPLAY_MINE.x, z - ROLEPLAY_MINE.z) <= 14;
}

export function onRoleplayMined(kind: BlockKind, x: number, y: number, z: number) {
  const state = useRoleplayStore.getState();
  if (state.job === 'miner' && Math.hypot(x - ROLEPLAY_MINE.x, z - ROLEPLAY_MINE.z) <= 14) {
    const reward = kind === BlockKind.IronOre ? 15 : kind === BlockKind.CoalOre ? 10 : 5;
    useRoleplayStore.setState({ coins: state.coins + reward });
    useGameStore.getState().setNotice(translate(`Travail de mineur · +${reward} pièces.`, `Miner work · +${reward} coins.`));
    persist();
  }
  const list = respawns.get(world) ?? [];
  list.push({ x, y, z, kind, at: Date.now() + 10000 });
  respawns.set(world, list);
}
export function onRoleplayPlaced() {
  const state = useRoleplayStore.getState();
  if (state.job !== 'builder' || state.workReadyAt > Date.now()) return;
  useRoleplayStore.setState({ coins: state.coins + 2, workReadyAt: Date.now() + 500 });
  persist();
}
export function performRoleplayWork() {
  ensureRoleplay();
  const state = useRoleplayStore.getState();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player || state.workReadyAt > Date.now()) return;
  const point = state.job === 'merchant' ? ROLEPLAY_MARKET : state.job === 'police' ? ROLEPLAY_POLICE : state.job === 'firefighter' ? ROLEPLAY_FIRE_STATION : null;
  if (!point || Math.hypot(player.x - point.x, player.y - point.y, player.z - point.z) > 5) {
    useGameStore.getState().setNotice(translate('Rapproche-toi de ton lieu de travail.', 'Move closer to your workplace.'));
    return;
  }
  useRoleplayStore.setState({ coins: state.coins + 20, workReadyAt: Date.now() + 10000 });
  useGameStore.getState().setNotice(translate('Travail terminé · +20 pièces.', 'Work complete · +20 coins.'));
  persist();
}
export function sellRoleplaySelected() {
  ensureRoleplay();
  const game = useGameStore.getState();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (useRoleplayStore.getState().job !== 'miner' || !player || Math.hypot(player.x - ROLEPLAY_MARKET.x, player.z - ROLEPLAY_MARKET.z) > 5) {
    game.setNotice(translate('Va vendre tes minerais au marchand ambulant du marché.', 'Sell your ores to the wandering merchant at the market.'));
    return false;
  }
  const kind = game.selected;
  const price = selectedItemPrice(kind);
  if (price <= 0 || sellableInventoryCount(kind, game) <= 0) {
    game.setNotice(translate('Sélectionne un minerai dans ta barre rapide pour le vendre.', 'Select an ore in your hotbar to sell it.'));
    return false;
  }
  const name = selectionInfo(kind).name;
  changeInventory(kind, -1);
  earnRoleplayCoins(price);
  game.setNotice(translate(`${name} vendu au marchand ambulant · +${price} pièces.`, `${name} sold to the wandering merchant · +${price} coins.`));
  return true;
}

export function roleplayControlSystem(world: World, actions: { harvest: number; tap: number; interact: number }, dt: number) {
  if (useGameStore.getState().gameplayMode !== 'roleplay') return false;
  ensureRoleplay();
  if (useRoleplayStore.getState().job === 'police' && (actions.harvest > 0 || actions.tap > 0 || actions.interact > 0) && useGameStore.getState().selected === 'handcuffs' && arrestRoleplayThief()) return true;
  if (['merchant', 'police', 'firefighter'].includes(useRoleplayStore.getState().job ?? '') && (actions.harvest > 0 || actions.tap > 0 || actions.interact > 0)) performRoleplayWork();
  roleplayLifeSystem(world, dt);
  const list = respawns.get(world);
  if (list?.length) {
    const remaining = list.filter((block) => {
      if (block.at > Date.now()) return true;
      addVoxel(world, block.x, block.y, block.z, block.kind, undefined, undefined, 0, undefined, undefined, false, true);
      return false;
    });
    respawns.set(world, remaining);
  }
  return true;
}
