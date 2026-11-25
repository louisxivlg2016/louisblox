import { create } from 'zustand';
import type { World } from 'koota';
import { addVoxel, getBlockIndex } from './chunks';
import type { Camera } from 'three';
import { consumePendingPlanetTravel, getPlanetUniverse, readPlanetUniverseSnapshot, savePlanetUniverseSnapshot, setPendingPlanetTravel, setPlanetUniverse } from './planetUniverse';
import { ZOMBIE_PLANET_SPAWN, ZOMBIE_POSITIONS } from './zombiePlanetArena';
import { spawnAnimal } from './animals';
import { animalCombatSystem } from './systems/animalCombatSystem';
import { planetPeopleSystem, rescueGirl, rescueSurvivor, survivorPositions, usePlanetPeopleStore } from './planetPeople';
import { BlockKind, voxelKey } from './voxel';
import { PLANET_BIOMES, PLANET_ONE_BLOCK, PLANET_SPAWN } from './planetArena';
import { useGameStore } from './store';
import { changeInventory, inventoryCount } from './inventory';
import { readModeProgress, writeModeProgress } from './modeProgress';
import { respawnAtBase } from './battle';
import { createWorldSave } from './save';
import { Animal, AnimalHealth, Player, PlayerPosition } from './traits';
import { translate } from './language';

const initial = { mined: 0, coins: 0, tool: 0, rocket: false, biome: 'Planète mère', universe: 'home' as 'home' | 'zombie' };
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
  setPlanetUniverse('home', '');
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
    biome: saved.universe === 'zombie' ? 'Planète enneigée' : 'Planète mère',
    universe: saved.universe === 'zombie' ? 'zombie' : 'home',
  });
  setPlanetUniverse(usePlanetStore.getState().universe, game.worldId);
  if (usePlanetStore.getState().mined === 0 && usePlanetStore.getState().tool === 0) {
    useGameStore.setState({ hotbarSlots: ['pickaxe_wood', ...Array(9).fill(null)], selected: 'pickaxe_wood', selectedSlot: 0 });
    changeInventory(BlockKind.OakPlanks, 20);
  }
}

export function onPlanetMined(kind: BlockKind) {
  ensurePlanet();
  const state = usePlanetStore.getState();
  const bonus = kind === BlockKind.DiamondOre ? 50 : kind === BlockKind.GoldOre ? 25 : kind === BlockKind.IronOre ? 15 : kind === BlockKind.CoalOre ? 10 : 5;
  const resource = kind;
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
  for (let x = 2; x <= 4; x += 1) for (let z = -1; z <= 1; z += 1) addVoxel(world, x, 12, z, BlockKind.ConcreteWhite, undefined, undefined, 0, undefined, undefined, false, true);
  for (let y = 13; y <= 16; y += 1) addVoxel(world, 3, y, 0, BlockKind.ConcreteWhite, undefined, undefined, 0, undefined, undefined, false, true);
  addVoxel(world, 3, 17, 0, BlockKind.ConcreteOrange, undefined, undefined, 0, undefined, undefined, false, true);
  for (const [x, z] of [[2, 0], [4, 0], [3, -1], [3, 1]] as const) addVoxel(world, x, 13, z, BlockKind.ConcreteRed, undefined, undefined, 0, undefined, undefined, false, true);
  usePlanetStore.setState({ rocket: true });
  game.setNotice(translate('Fusée construite ! Approche-toi et appuie sur E pour voler vers l’univers zombie.', 'Rocket built! Get close and press E to fly to the zombie universe.'));
  persist();
}

export function travelPlanetUniverse(world: World, destination: 'home' | 'zombie') {
  ensurePlanet();
  if (destination === getPlanetUniverse()) return false;
  if (!usePlanetStore.getState().rocket) {
    useGameStore.getState().setNotice(translate('Construis d’abord la fusée dans l’atelier spatial.', 'Build the rocket in the space workshop first.'));
    return false;
  }
  const game = useGameStore.getState();
  const currentSave = createWorldSave(world);
  if (!currentSave) return false;
  const currentUniverse = getPlanetUniverse();
  savePlanetUniverseSnapshot(game.worldId, currentUniverse, currentSave);
  const spawn = destination === 'zombie' ? ZOMBIE_PLANET_SPAWN : PLANET_SPAWN;
  const savedDestination = readPlanetUniverseSnapshot(game.worldId, destination);
  const destinationSave = savedDestination ?? { ...currentSave, edits: [], vehicles: [], saddledHorses: [], paint: [], checkpoint: undefined, player: { ...currentSave.player, ...spawn } };
  setPendingPlanetTravel(game.worldId, destination, {
    ...destinationSave,
    selected: currentSave.selected,
    lives: currentSave.lives,
    hotbar: currentSave.hotbar,
    itemCounts: currentSave.itemCounts,
    equippedArmor: currentSave.equippedArmor,
    apples: currentSave.apples,
    coins: currentSave.coins,
    meat: currentSave.meat,
  });
  setPlanetUniverse(destination, game.worldId);
  usePlanetStore.setState({ universe: destination, biome: destination === 'zombie' ? 'Planète enneigée' : 'Planète mère' });
  persist();
  game.setNotice(destination === 'zombie' ? translate('Fusée arrivée · combats les zombies et libère la fille !', 'Rocket landed · fight the zombies and free the girl!') : translate('Retour sur la planète mère.', 'Back on the home planet.'));
  useGameStore.setState({ generation: game.generation + 1 });
  return true;
}

export function pendingPlanetTravelSave(worldId: string) {
  return consumePendingPlanetTravel(worldId);
}

export function planetControlSystem(world: World, camera: Camera, dt: number, actions: { place: number; harvest: number; tap: number; interact: number }) {
  if (useGameStore.getState().gameplayMode !== 'planet') return false;
  ensurePlanet();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (player && getPlanetUniverse() === 'home' && usePlanetStore.getState().rocket && actions.harvest > 0 && Math.hypot(player.x - 3, player.z) <= 4) {
    actions.harvest = 0;
    travelPlanetUniverse(world, 'zombie');
  }
  if (getPlanetUniverse() === 'zombie') {
    ZOMBIE_POSITIONS.forEach((position, index) => spawnAnimal(world, 'zombie', position.x, position.y, position.z, 7300 + index, `planet-zombie-${index}`, true));
    if (animalCombatSystem(world, camera, dt, actions.tap)) {
      actions.place = 0;
      actions.harvest = 0;
      actions.tap = 0;
      actions.interact = 0;
    }
    const alive = world.query(Animal, AnimalHealth).filter((entity) => entity.get(Animal)?.kind === 'zombie' && entity.get(AnimalHealth)!.value > 0).length;
    if (alive === 0) rescueGirl(world);
    if (player) for (const survivor of usePlanetPeopleStore.getState().survivors) {
      if (survivor.rescued || (actions.harvest <= 0 && actions.tap <= 0 && actions.interact <= 0)) continue;
      const position = survivorPositions.get(survivor.id) ?? survivor;
      const distance = Math.hypot(player.x - position.x, player.z - position.z);
      if (distance <= 3) {
        rescueSurvivor(survivor.id);
        actions.harvest = 0;
        actions.tap = 0;
        actions.interact = 0;
      }
    }
    planetPeopleSystem(world, dt);
    if (player && player.y < 3) {
      respawnAtBase(world, null, ZOMBIE_PLANET_SPAWN);
      useGameStore.getState().setNotice(translate('Chute dans le vide · retour sur la planète enneigée.', 'Fell into space · returned to the snowy planet.'));
    }
    return true;
  }
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
