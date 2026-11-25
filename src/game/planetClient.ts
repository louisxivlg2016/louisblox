import { create } from 'zustand';
import type { World } from 'koota';
import { addVoxel, getBlockIndex } from './chunks';
import { BlockKind, voxelKey } from './voxel';
import { PLANET_BIOMES, PLANET_ONE_BLOCK, PLANET_SPAWN } from './planetArena';
import { useGameStore } from './store';
import { changeInventory, inventoryCount } from './inventory';
import { readModeProgress, writeModeProgress } from './modeProgress';
import { respawnAtBase } from './battle';
import { Player, PlayerPosition } from './traits';
import { translate } from './language';

const initial = { mined: 0, coins: 0, tool: 0, rocket: false, biome: 'Planète mère' };
export const usePlanetStore = create<typeof initial>(() => ({ ...initial }));
let loadedWorld = '';
const seen = new WeakMap<World, boolean>();
const respawnAt = new WeakMap<World, number>();

function persist() {
  const worldId = useGameStore.getState().worldId;
  if (worldId) writeModeProgress('planet', worldId, usePlanetStore.getState());
}
export function clearPlanet() {
  loadedWorld = '';
  usePlanetStore.setState({ ...initial });
}
function ensurePlanet() {
  const game = useGameStore.getState();
  if (loadedWorld === game.worldId) return;
  loadedWorld = game.worldId;
  const saved = readModeProgress('planet', game.worldId, initial);
  usePlanetStore.setState({
    mined: typeof saved.mined === 'number' ? Math.max(0, Math.floor(saved.mined)) : 0,
    coins: typeof saved.coins === 'number' ? Math.max(0, Math.floor(saved.coins)) : 0,
    tool: typeof saved.tool === 'number' ? Math.max(0, Math.min(3, Math.floor(saved.tool))) : 0,
    rocket: saved.rocket === true,
    biome: 'Planète mère',
  });
  if (usePlanetStore.getState().mined === 0 && usePlanetStore.getState().tool === 0) {
    useGameStore.setState({ hotbarSlots: ['pickaxe_wood', ...Array(9).fill(null)], selected: 'pickaxe_wood', selectedSlot: 0 });
    changeInventory(BlockKind.OakPlanks, 20);
  }
}

export function onPlanetMined(kind: BlockKind) {
  ensurePlanet();
  const state = usePlanetStore.getState();
  const bonus = kind === BlockKind.DiamondOre ? 50 : kind === BlockKind.GoldOre ? 25 : kind === BlockKind.IronOre ? 15 : kind === BlockKind.CoalOre ? 10 : 5;
  const resource = kind === BlockKind.CoalOre || kind === BlockKind.IronOre || kind === BlockKind.GoldOre || kind === BlockKind.DiamondOre ? kind : BlockKind.Stone;
  usePlanetStore.setState({ mined: state.mined + 1, coins: state.coins + bonus });
  changeInventory(resource, 1);
  if (state.mined % 3 === 0) changeInventory(BlockKind.OakPlanks, 1);
  persist();
}

export function buyPlanetTool(tier: number) {
  ensurePlanet();
  const state = usePlanetStore.getState();
  const cost = tier === 1 ? 50 : tier === 2 ? 150 : 400;
  if (tier !== state.tool + 1 || state.coins < cost) return;
  const pickaxe = tier === 1 ? 'pickaxe_stone' : tier === 2 ? 'pickaxe_iron' : 'pickaxe_diamond';
  const previous = state.tool === 0 ? 'pickaxe_wood' : state.tool === 1 ? 'pickaxe_stone' : 'pickaxe_iron';
  const hotbarSlots = useGameStore.getState().hotbarSlots.map((kind) => kind === previous ? pickaxe : kind);
  usePlanetStore.setState({ tool: tier, coins: state.coins - cost });
  useGameStore.setState({ hotbarSlots, selected: pickaxe, selectedSlot: Math.max(0, hotbarSlots.indexOf(pickaxe)) });
  useGameStore.getState().setNotice(translate('Nouvelle pioche équipée !', 'New pickaxe equipped!'));
  persist();
}

export function buildPlanetRocket(world: World) {
  ensurePlanet();
  const state = usePlanetStore.getState();
  const game = useGameStore.getState();
  if (state.rocket) return;
  if (state.mined < 40 || inventoryCount(BlockKind.Stone, game) < 30 || inventoryCount(BlockKind.IronOre, game) < 15 || inventoryCount(BlockKind.GoldOre, game) < 8) {
    game.setNotice(translate('Fusée : 40 blocs minés, 30 pierres, 15 fers et 8 ors.', 'Rocket: mine 40 blocks, gather 30 stone, 15 iron and 8 gold.'));
    return;
  }
  changeInventory(BlockKind.Stone, -30);
  changeInventory(BlockKind.IronOre, -15);
  changeInventory(BlockKind.GoldOre, -8);
  for (let x = 2; x <= 4; x += 1) for (let z = -1; z <= 1; z += 1) addVoxel(world, x, 8, z, BlockKind.ConcreteWhite, undefined, undefined, 0, undefined, undefined, false, true);
  for (let y = 9; y <= 12; y += 1) addVoxel(world, 3, y, 0, BlockKind.ConcreteWhite, undefined, undefined, 0, undefined, undefined, false, true);
  addVoxel(world, 3, 13, 0, BlockKind.ConcreteOrange, undefined, undefined, 0, undefined, undefined, false, true);
  for (const [x, z] of [[2, 0], [4, 0], [3, -1], [3, 1]] as const) addVoxel(world, x, 9, z, BlockKind.ConcreteRed, undefined, undefined, 0, undefined, undefined, false, true);
  usePlanetStore.setState({ rocket: true });
  game.setNotice(translate('Fusée construite ! Les cinq planètes sont à toi.', 'Rocket built! All five planets are yours.'));
  persist();
}

export function planetControlSystem(world: World) {
  if (useGameStore.getState().gameplayMode !== 'planet') return false;
  ensurePlanet();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return true;
  if (player.y < 3) {
    respawnAtBase(world, null, PLANET_SPAWN);
    useGameStore.getState().setNotice(translate('Chute dans l’espace · retour sur la planète mère.', 'Fell into space · returned to the home planet.'));
  }
  const blocks = getBlockIndex(world);
  const key = voxelKey(PLANET_ONE_BLOCK.x, PLANET_ONE_BLOCK.y, PLANET_ONE_BLOCK.z);
  const block = blocks.get(key);
  if (block) seen.set(world, true);
  const pending = respawnAt.get(world) ?? 0;
  if (seen.get(world) && !block && !pending) respawnAt.set(world, Date.now() + 250);
  if (pending && Date.now() >= pending) {
    const mined = usePlanetStore.getState().mined;
    const kind = mined >= 80 ? BlockKind.DiamondOre : mined >= 40 ? BlockKind.GoldOre : mined >= 15 ? BlockKind.IronOre : mined >= 3 ? BlockKind.CoalOre : BlockKind.Stone;
    addVoxel(world, PLANET_ONE_BLOCK.x, PLANET_ONE_BLOCK.y, PLANET_ONE_BLOCK.z, kind, undefined, undefined, 0, undefined, undefined, false, true);
    respawnAt.delete(world);
  }
  const biome = PLANET_BIOMES.find((entry) => Math.hypot(player.x - entry.x, player.y - entry.y, player.z - entry.z) <= 8);
  const biomeName = biome?.name ?? 'Planète mère';
  if (usePlanetStore.getState().biome !== biomeName) usePlanetStore.setState({ biome: biomeName });
  return true;
}
