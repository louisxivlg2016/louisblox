import type { World } from 'koota';
import type { Vector3 } from 'three';
import { spawnAnimal } from './animals';
import type { AnimalKind } from './animals';
import { findAnimalTarget, removeAnimal } from './combat';
import { addVoxel, batchVoxelEdits, chunkCoordinate, getBlockIndex, growSapling, removeVoxel, replaceVoxel, setVoxelText } from './chunks';
import { cropDefinition } from './crops';
import { isCrop, isSapling, signFacing } from './extraBlocks';
import { GALLERY_ITEMS } from './galleryCatalog';
import { getItemMeta, isAnimalPoison } from './items';
import type { GalleryItemId } from './items';
import { SEA_LEVEL } from './levels';
import { spawnSapling } from './saplingLifecycle';
import { useGameStore } from './store';
import { Animal, Chunk, ChunkData, Player, PlayerBody, PlayerPosition, PlayerState, PlayerVelocity } from './traits';
import { BlockKind, isWaterBlock, raycastVoxel, voxelKey } from './voxel';
import { groundAt } from './vehicles';
import { moveVoxelCharacter } from './systems/collisionSystem';
import { fireProjectile } from './systems/projectileSystem';
import { usePotion } from './effects';
import { useEatingStore } from './eating';
import { paintballColor } from './paintball';
import { reportAnimalSpawn } from './animalSync';

const caughtAnimals = new WeakMap<World, Map<string, AnimalKind>>();

function animalForName(name: string): AnimalKind {
  const value = name.toLowerCase();
  if (value.includes('snow') && value.includes('bear')) return 'snowBear';
  if (value.includes('snow') || value.includes('spectral')) return 'snowWolf';
  if (value.includes('bear') || value.includes('gorilla') || value.includes('golem')) return 'bear';
  if (value.includes('wolf') || value.includes('zombie') || value.includes('skeleton')) return 'wolf';
  if (value.includes('stag') || value.includes('deer')) return 'deer';
  if (value.includes('horse')) return 'horse';
  if (value.includes('cow')) return 'cow';
  if (value.includes('sheep')) return 'sheep';
  if (value.includes('chicken')) return 'chicken';
  if (value.includes('duck')) return 'duck';
  if (value.includes('camel')) return 'camel';
  return 'pig';
}

function bedForName(name: string): BlockKind {
  const value = name.toLowerCase();
  const colors: Array<[string, BlockKind]> = [
    ['white', BlockKind.BedWhite], ['orange', BlockKind.BedOrange], ['magenta', BlockKind.BedMagenta],
    ['light blue', BlockKind.BedLightBlue], ['yellow', BlockKind.BedYellow], ['lime', BlockKind.BedLime],
    ['pink', BlockKind.BedPink], ['gray', BlockKind.BedGray], ['cyan', BlockKind.BedCyan],
    ['purple', BlockKind.BedPurple], ['blue', BlockKind.BedBlue], ['brown', BlockKind.BedBrown],
    ['green', BlockKind.BedGreen], ['red', BlockKind.BedRed], ['black', BlockKind.BedBlack],
  ];
  return colors.find(([color]) => value.includes(color))?.[1] ?? (value.includes('leaf') ? BlockKind.BedGreen : BlockKind.Bed);
}

function concreteForName(name: string): BlockKind {
  const value = name.toLowerCase();
  const colors: Array<[string, BlockKind]> = [
    ['white', BlockKind.ConcreteWhite], ['orange', BlockKind.ConcreteOrange], ['magenta', BlockKind.ConcreteMagenta],
    ['light blue', BlockKind.ConcreteLightBlue], ['yellow', BlockKind.ConcreteYellow], ['lime', BlockKind.ConcreteLime],
    ['pink', BlockKind.ConcretePink], ['gray', BlockKind.ConcreteGray], ['cyan', BlockKind.ConcreteCyan],
    ['purple', BlockKind.ConcretePurple], ['blue', BlockKind.ConcreteBlue], ['brown', BlockKind.ConcreteBrown],
    ['green', BlockKind.ConcreteGreen], ['red', BlockKind.ConcreteRed], ['black', BlockKind.ConcreteBlack],
  ];
  return colors.find(([color]) => value.includes(color))?.[1] ?? BlockKind.ConcreteLightGray;
}

function attachGrowth(world: World, kind: BlockKind, x: number, y: number, z: number) {
  const sapling = spawnSapling(world, kind, x, y, z);
  const cx = chunkCoordinate(x);
  const cz = chunkCoordinate(z);
  for (const entity of world.query(Chunk, ChunkData)) {
    const chunk = entity.get(Chunk)!;
    if (chunk.x === cx && chunk.z === cz) entity.get(ChunkData)!.saplings.push(sapling);
  }
}

export function useShears(world: World, origin: Vector3, direction: Vector3) {
  const store = useGameStore.getState();
  const blocks = getBlockIndex(world);
  const hit = raycastVoxel(blocks, origin, direction, 6);
  if (hit && ([BlockKind.Leaves, BlockKind.PineLeaves, BlockKind.AutumnLeaves, BlockKind.JungleLeaves, BlockKind.JungleVine] as BlockKind[]).includes(hit.block.kind)) {
    removeVoxel(world, hit);
    store.setNotice('Feuillage taillé avec les cisailles.');
    return true;
  }
  if (hit?.normal.y === 1) {
    const x = hit.x + hit.normal.x;
    const y = hit.y + hit.normal.y;
    const z = hit.z + hit.normal.z;
    if (blocks.has(voxelKey(x, y, z))) {
      store.setNotice('Cet emplacement est déjà occupé. Vise un endroit libre au-dessus du sol.');
      return true;
    }
    const grass = ([BlockKind.Grass, BlockKind.ForestGrass, BlockKind.AutumnGrass, BlockKind.JungleGrass] as BlockKind[]).includes(hit.block.kind) ? hit.block.kind : BlockKind.Grass;
    if (addVoxel(world, x, y, z, grass)) {
      store.setNotice('Herbe reproduite avec les cisailles.');
      return true;
    }
  }
  store.setNotice('Vise le dessus libre d’un bloc d’herbe ou du sol avec les cisailles.');
  return true;
}

export function useGalleryItem(world: World, selected: GalleryItemId, origin: Vector3, direction: Vector3) {
  const meta = getItemMeta(selected);
  const shape = meta.shape ?? 'resource';
  const store = useGameStore.getState();
  const playerEntity = world.queryFirst(Player);
  const player = playerEntity?.get(PlayerPosition);
  if (!playerEntity || !player) return true;
  if (isAnimalPoison(selected)) {
    const target = findAnimalTarget(world, origin, direction, 6);
    if (!target) {
      store.setNotice('Vise un animal avec le poison pour le faire disparaître.');
      return true;
    }
    removeAnimal(world, target.entity);
    if (store.gameplayMode === 'survival') store.setItemCount(selected, (store.itemCounts[selected] ?? 1) - 1);
    store.setNotice('Poison utilisé : l’animal a disparu.');
    return true;
  }
  const blocks = getBlockIndex(world);
  const hit = raycastVoxel(blocks, origin, direction, 6, meta.name === 'Empty Bottle');
  const x = hit ? hit.x + hit.normal.x : Math.round(player.x + direction.x * 2);
  const z = hit ? hit.z + hit.normal.z : Math.round(player.z + direction.z * 2);
  const ground = groundAt(world, x, z, player.y + 4);
  const y = hit ? hit.y + hit.normal.y : Math.floor(ground + 0.5);
  const empty = !blocks.has(voxelKey(x, y, z));
  const requiresSurface = ['bed', 'plant', 'flower', 'mushroom', 'seed', 'pod', 'banner', 'arrow_sign', 'tower'].includes(shape);
  if (requiresSurface && (hit?.normal.y !== 1 || !empty)) {
    store.setNotice('Vise le dessus libre d’un bloc pour utiliser cet objet.');
    return true;
  }

  if (shape === 'hoe') {
    if (hit && ([BlockKind.Grass, BlockKind.ForestGrass, BlockKind.AutumnGrass, BlockKind.JungleGrass, BlockKind.Dirt] as BlockKind[]).includes(hit.block.kind)) {
      replaceVoxel(world, hit, BlockKind.ForestGrass);
      store.setNotice('Terre labourée : tu peux maintenant planter des graines.');
    } else store.setNotice('Vise un bloc d’herbe ou de terre avec la houe.');
    return true;
  }
  if (shape === 'shears') return useShears(world, origin, direction);
  if (shape === 'bone_meal') {
    if (hit && isSapling(hit.block.kind)) {
      growSapling(world, hit.block.kind, hit.x, hit.y, hit.z);
      store.setNotice('La pousse a grandi grâce à la poudre d’os.');
    } else if (hit && isCrop(hit.block.kind)) {
      replaceVoxel(world, hit, hit.block.kind, undefined, 3);
      store.setNotice('La culture est prête à être récoltée.');
    } else store.setNotice('Vise une pousse ou une culture avec la poudre d’os.');
    return true;
  }
  if (shape === 'plant') {
    const kind = /pine|cedar|spruce/i.test(meta.name) ? BlockKind.PineSapling : /maple|autumn/i.test(meta.name) ? BlockKind.AutumnSapling : BlockKind.OakSapling;
    addVoxel(world, x, y, z, kind);
    attachGrowth(world, kind, x, y, z);
    store.setNotice(`${meta.name} planté.`);
    return true;
  }
  if (shape === 'flower' || shape === 'mushroom' || shape === 'pod') {
    addVoxel(world, x, y, z, shape === 'flower' ? BlockKind.AutumnLeaves : BlockKind.Leaves);
    store.setNotice(`${meta.name} placé comme décoration.`);
    return true;
  }
  if (shape === 'seed') {
    const name = meta.name.toLowerCase();
    const kind = name.includes('carrot') ? BlockKind.Carrot : name.includes('melon') ? BlockKind.Watermelon : name.includes('corn') ? BlockKind.Corn : name.includes('tomato') ? BlockKind.Tomato : BlockKind.Wheat;
    addVoxel(world, x, y, z, kind, 0);
    attachGrowth(world, kind, x, y, z);
    store.setNotice(`${cropDefinition(kind).name} planté.`);
    return true;
  }
  if (shape === 'bed') {
    const facing = Math.abs(direction.x) > Math.abs(direction.z) ? direction.x > 0 ? 'west' : 'east' : direction.z > 0 ? 'north' : 'south';
    addVoxel(world, x, y, z, bedForName(meta.name), undefined, facing);
    store.setNotice('Lit placé. Appuie sur E en le visant pour dormir.');
    return true;
  }
  if (shape === 'banner' || shape === 'arrow_sign') {
    const facing = signFacing(direction, hit?.normal);
    addVoxel(world, x, y, z, BlockKind.Sign, undefined, facing);
    setVoxelText(world, { x, y, z }, shape === 'arrow_sign' ? '→' : meta.name);
    store.setNotice('Panneau placé. Vise-le avec E pour écrire dessus.');
    return true;
  }
  if (shape === 'compass' || shape === 'map') {
    store.setNotice(`Position X ${Math.round(player.x)} · Y ${Math.round(player.y)} · Z ${Math.round(player.z)} · ${store.environment.biome}`);
    return true;
  }
  if (shape === 'clock') {
    const totalMinutes = Math.floor(store.environment.dayProgress * 24 * 60);
    store.setNotice(`Heure du monde : ${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`);
    return true;
  }
  if (shape === 'fishing_rod') {
    for (let distance = 1; distance <= 6; distance += 0.5) {
      const waterX = Math.round(origin.x + direction.x * distance);
      const waterY = Math.round(origin.y + direction.y * distance);
      const waterZ = Math.round(origin.z + direction.z * distance);
      if (!isWaterBlock(blocks.get(voxelKey(waterX, waterY, waterZ))?.kind)) continue;
      const caughtFish = GALLERY_ITEMS.find((item) => item.name === 'Caught Fish')?.id;
      if (!caughtFish) return true;
      store.setItemCount(caughtFish, (store.itemCounts[caughtFish] ?? 0) + 1);
      store.setNotice('Poisson pêché ! Il est dans ton sac et peut être mangé.');
      return true;
    }
    store.setNotice('Vise l’eau avec la canne à pêche.');
    return true;
  }
  if (shape === 'potion') {
    if (meta.name === 'Empty Bottle') {
      if (isWaterBlock(hit?.block.kind)) {
        const bottle = GALLERY_ITEMS.find((item) => item.name === 'Water Bottle');
        if (bottle) store.setItemCount(bottle.id, (store.itemCounts[bottle.id] ?? 0) + 1);
        if (store.gameplayMode === 'survival') store.setItemCount(selected, (store.itemCounts[selected] ?? 1) - 1);
        store.setNotice('Bouteille remplie avec de l’eau.');
      } else store.setNotice('Vise de l’eau avec la bouteille vide pour la remplir.');
      return true;
    }
    const result = usePotion(world, meta.name);
    if (result.used) {
      if (store.gameplayMode === 'survival') store.setItemCount(selected, (store.itemCounts[selected] ?? 1) - 1);
      useEatingStore.getState().startEating(selected);
    }
    store.setNotice(result.message);
    return true;
  }
  if (shape === 'splash_potion' || shape === 'arrow_potion') {
    const result = usePotion(world, meta.name);
    if (result.used) {
      if (store.gameplayMode === 'survival') store.setItemCount(selected, (store.itemCounts[selected] ?? 1) - 1);
      useEatingStore.getState().startEating(selected);
    }
    store.setNotice(result.message);
    return true;
  }
  if (shape === 'firecracker' || shape === 'bomb') {
    fireProjectile(world, origin, direction, 'bomb', 1, paintballColor(selected));
    return true;
  }
  if (shape === 'arrow' || shape === 'ball' || shape === 'pebble') {
    fireProjectile(world, origin, direction, 'bullet', 1, paintballColor(selected));
    return true;
  }
  if (shape === 'updraft' || shape === 'snowdash') {
    const next = player.clone();
    moveVoxelCharacter(blocks, next, { x: shape === 'snowdash' ? direction.x * 4 : 0, y: shape === 'updraft' ? 2 : 0, z: shape === 'snowdash' ? direction.z * 4 : 0 }, false);
    player.copy(next);
    playerEntity.get(PlayerBody)?.value?.setTranslation(next, true);
    playerEntity.get(PlayerVelocity)?.set(0, shape === 'updraft' ? 7 : 0, 0);
    store.setNotice(shape === 'updraft' ? 'Courant ascendant !' : 'Glisse rapide !');
    return true;
  }
  if (shape === 'hang_glider' || shape === 'balloon') {
    const flying = !playerEntity.get(PlayerState)!.flying;
    playerEntity.set(PlayerState, { flying });
    store.setFlying(flying);
    store.setNotice(flying ? `${meta.name} : vol activé. Espace/C pour monter et descendre.` : `${meta.name} rangé : vol désactivé.`);
    return true;
  }
  if (shape === 'ice_bridge') {
    const stepX = Math.abs(direction.x) > Math.abs(direction.z) ? Math.sign(direction.x) : 0;
    const stepZ = stepX === 0 ? Math.sign(direction.z) : 0;
    batchVoxelEdits(world, () => {
      for (let index = 1; index <= 5; index += 1) {
        const bridgeX = Math.round(player.x + stepX * index);
        const bridgeZ = Math.round(player.z + stepZ * index);
        const floor = groundAt(world, bridgeX, bridgeZ, player.y + 3);
        addVoxel(world, bridgeX, floor < SEA_LEVEL ? SEA_LEVEL : Math.floor(floor + 0.5), bridgeZ, BlockKind.Ice);
      }
    });
    store.setNotice('Un pont de glace de cinq blocs apparaît.');
    return true;
  }
  if (shape === 'tower') {
    batchVoxelEdits(world, () => {
      for (let index = 0; index < 4; index += 1) addVoxel(world, x, y + index, z, concreteForName(meta.name));
    });
    store.setNotice('Tour de quatre blocs construite.');
    return true;
  }
  if (shape === 'spawn_orb' || shape === 'spawner') {
    if (ground < SEA_LEVEL + 0.5) {
      store.setNotice('Vise la terre ferme pour faire apparaître cet animal.');
      return true;
    }
    const kind = animalForName(meta.name);
    spawnAnimal(world, kind, x, ground, z, Math.floor(performance.now()));
    store.setNotice(`${meta.name} apparaît.`);
    return true;
  }
  if (shape === 'catcher') {
    let captured = caughtAnimals.get(world);
    if (!captured) {
      captured = new Map();
      caughtAnimals.set(world, captured);
    }
    const saved = captured.get(selected);
    const target = findAnimalTarget(world, origin, direction, 5.5);
    if (target && !saved) {
      captured.set(selected, target.kind);
      removeAnimal(world, target.entity);
      store.setNotice(`${target.kind} capturé. Utilise encore l’objet pour le relâcher.`);
    } else if (saved && ground >= SEA_LEVEL + 0.5) {
      const released = spawnAnimal(world, saved, x, ground, z, Math.floor(performance.now()), `pet:${saved}:${crypto.randomUUID()}`);
      if (released) {
        reportAnimalSpawn(released);
        captured.delete(selected);
        store.setNotice(`${saved} relâché.`);
      } else store.setNotice('Cet animal ne peut pas être relâché ici.');
    } else store.setNotice('Vise un animal pour le capturer, puis un endroit libre pour le relâcher.');
    return true;
  }
  store.setNotice(`${meta.name} est une ressource à conserver dans ton sac.`);
  return true;
}
