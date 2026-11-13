import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import { addVoxel, chunkCoordinate, getBlockIndex, removeVoxel, replaceVoxel } from '../chunks';
import { spawnBomb } from '../bombLifecycle';
import { spawnSapling } from '../saplingLifecycle';
import { isBed, isChest, isCrop, isDoor, isFurnace, isGlass, isLadder, isRail, isSapling, isSign, isStair, isTrafficSign, isTrapdoor, signFacing } from '../extraBlocks';
import { useSignStore } from '../signs';
import { startSleep } from './sleepSystem';
import { openChest, openFurnace } from '../containers';
import { cropDefinition } from '../crops';
import { pickUpFood } from '../foods';
import { consumeActions, isMouseDown, stopMining } from '../input';
import { MAX_BUILD_Y, MIN_WORLD_Y } from '../levels';
import { useGameStore } from '../store';
import { getItemMeta, isSword, isWoodBlock, miningSpeed } from '../items';
import { changeInventory, hasInventory } from '../inventory';
import { BlockTarget, Chunk, ChunkData, Player, PlayerPosition, TargetMesh } from '../traits';
import { BLOCK_HARDNESS, BlockKind, isWaterBlock, raycastVoxel, voxelKey } from '../voxel';
import type { VoxelHit } from '../voxel';
import { miningMultiplier } from '../effects';
import { fireProjectile } from './projectileSystem';
import { isPirateObjective } from '../pirates';
import { requestPirateObjectiveHit } from '../piratesClient';
import { playSound } from '../audio';
import { dropBlock } from '../droppedItems';

const direction = new Vector3();
const origin = new Vector3();

function intersectsPlayer(x: number, y: number, z: number, player: Vector3) {
  const horizontal = Math.abs(player.x - x) < 0.86 && Math.abs(player.z - z) < 0.86;
  const vertical = y - 0.5 < player.y + 1.8 && y + 0.5 > player.y;
  return horizontal && vertical;
}

function attachGrowth(world: World, kind: BlockKind, x: number, y: number, z: number) {
  const sapling = spawnSapling(world, kind, x, y, z);
  const cx = chunkCoordinate(x);
  const cz = chunkCoordinate(z);
  for (const chunkEntity of world.query(Chunk, ChunkData)) {
    const chunk = chunkEntity.get(Chunk)!;
    if (chunk.x !== cx || chunk.z !== cz) continue;
    chunkEntity.get(ChunkData)!.saplings.push(sapling);
    break;
  }
}

export function blockSystem(world: World, camera: Camera, dt: number, disabled = false, pendingActions?: { place: number; harvest: number }) {
  const playerEntity = world.queryFirst(Player);
  const targetEntity = world.queryFirst(BlockTarget);
  const player = playerEntity?.get(PlayerPosition);
  const target = targetEntity?.get(BlockTarget);
  if (!player || !target) return;

  origin.copy(player);
  origin.y += 1.62;
  camera.getWorldDirection(direction);
  const allBlocks = getBlockIndex(world);
  const store = useGameStore.getState();
  const blocks = allBlocks;
  if (disabled) {
    target.visible = false;
    target.miningKey = '';
    target.miningProgress = 0;
    const mesh = targetEntity?.get(TargetMesh)?.value;
    if (mesh) mesh.visible = false;
    if (store.miningProgress !== 0) store.setMiningProgress(0);
    consumeActions();
    return;
  }
  if (store.blockCount !== allBlocks.size) store.setBlockCount(allBlocks.size);
  const hit = raycastVoxel(blocks, origin, direction, 6, store.gameplayMode === 'pirates' || typeof store.selected === 'number' || store.selected === 'bucket' || store.selected === 'empty_bucket');

  target.visible = hit !== null;
  if (hit) {
    target.position.set(hit.x, hit.y, hit.z);
    target.normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
  }

  const mesh = targetEntity?.get(TargetMesh)?.value;
  if (mesh) {
    mesh.visible = target.visible;
    mesh.position.copy(target.position);
  }

  const kind = hit?.block.kind;
  const ranged = typeof store.selected === 'string' && ['gun', 'bow'].includes(getItemMeta(store.selected).category);
  const canMine = hit?.block.protected !== true && !ranged && !isWaterBlock(kind) && (store.gameplayMode === 'creative' || store.gameplayMode !== 'football' && store.gameplayMode !== 'maze' && ((store.selected === 'hand' && store.gameplayMode !== 'battle') || store.gameplayMode === 'survival' || typeof store.selected === 'number' || isSword(store.selected)
    || (typeof store.selected === 'string' && (['pickaxe', 'shovel'].includes(getItemMeta(store.selected).category) || getItemMeta(store.selected).shape === 'shears'))));
  const mining = canMine && isMouseDown(0) && hit !== null && useGameStore.getState().mode === 'play';
  if (mining && hit && kind !== undefined) {
    const key = voxelKey(hit.x, hit.y, hit.z);
    if (target.miningKey !== key) {
      target.miningKey = key;
      target.miningProgress = 0;
    }
    target.miningProgress += dt;
    const progress = Math.min(1, target.miningProgress / (store.gameplayMode === 'creative' ? 0.18 : BLOCK_HARDNESS[kind] / (miningSpeed(store.selected, kind) * miningMultiplier())));
    if (Math.abs(store.miningProgress - progress) >= 0.01) store.setMiningProgress(progress);

    if (progress >= 1) {
      if (isPirateObjective(hit.x, hit.y, hit.z)) {
        requestPirateObjectiveHit('melee', { x: hit.x, y: hit.y, z: hit.z });
        removeVoxel(world, hit);
        playSound('breakWood', 0.5);
        target.visible = false;
        target.miningKey = '';
        target.miningProgress = 0;
        store.setMiningProgress(0);
        if (mesh) mesh.visible = false;
        return;
      }
      if (kind === BlockKind.Food) pickUpFood(world, hit);
      else {
        removeVoxel(world, hit);
        if (store.gameplayMode === 'survival') dropBlock(world, hit.block);
      }
      playSound(isGlass(hit.block.kind) ? 'breakGlass' : isWoodBlock(hit.block.kind) ? 'breakWood' : 'breakBlock', 0.5);
      target.visible = false;
      target.miningKey = '';
      target.miningProgress = 0;
      store.setMiningProgress(0);
      if (mesh) mesh.visible = false;
      return;
    }
  } else {
    if (canMine) stopMining();
    target.miningKey = '';
    target.miningProgress = 0;
    if (store.miningProgress !== 0) store.setMiningProgress(0);
  }

  const actions = pendingActions ?? consumeActions();
  if (useGameStore.getState().mode !== 'play' || !hit) return;
  if ((actions.place > 0 || actions.harvest > 0) && isSign(hit.block.kind)) {
    useSignStore.getState().openSign(hit, hit.block.text ?? '', hit.block.kind);
    if (document.pointerLockElement) document.exitPointerLock();
    return;
  }

  if ((actions.place > 0 || actions.harvest > 0) && isBed(hit.block.kind)) {
    startSleep(world, hit.x, hit.y, hit.z, hit.block.facing);
    return;
  }
  if ((actions.place > 0 || actions.harvest > 0) && isChest(hit.block.kind)) {
    openChest(world, hit);
    return;
  }
  if ((actions.place > 0 || actions.harvest > 0) && isFurnace(hit.block.kind)) {
    if (store.gameplayMode === 'pirates') {
      fireProjectile(world, origin, direction, 'bomb', 3);
      return;
    }
    openFurnace(hit);
    return;
  }

  if ((actions.place > 0 || actions.harvest > 0) && (isDoor(hit.block.kind) || isTrapdoor(hit.block.kind))) {
    replaceVoxel(world, hit, hit.block.kind, !hit.block.open);
    return;
  }

  if ((actions.place > 0 || actions.harvest > 0) && isCrop(hit.block.kind)) {
    const definition = cropDefinition(hit.block.kind);
    if ((hit.block.growth ?? 3) < 3) {
      store.setNotice(`${definition.name} pousse encore…`);
      return;
    }
    store.setItemCount(definition.food, store.itemCounts[definition.food] + definition.yield);
    store.setNotice(`${definition.name} récolté : +${definition.yield} dans le sac.`);
    if (definition.regrows) {
      replaceVoxel(world, hit, hit.block.kind, undefined, 0);
      attachGrowth(world, hit.block.kind, hit.x, hit.y, hit.z);
    } else {
      removeVoxel(world, hit);
      target.visible = false;
      if (mesh) mesh.visible = false;
    }
    return;
  }

  if (actions.harvest > 0 && hit.block.kind === BlockKind.Apple) {
    replaceVoxel(world, hit, BlockKind.Leaves);
    store.collectApple();
    target.visible = false;
    if (mesh) mesh.visible = false;
    return;
  }

  if (actions.place > 0 || actions.harvest > 0) {
    const replacingWater = isWaterBlock(hit.block.kind);
    const x = hit.x + (replacingWater ? 0 : hit.normal.x);
    const y = hit.y + (replacingWater ? 0 : hit.normal.y);
    const z = hit.z + (replacingWater ? 0 : hit.normal.z);
    const inBounds = y >= MIN_WORLD_Y && y <= MAX_BUILD_Y;

    if (inBounds && (replacingWater || !blocks.has(voxelKey(x, y, z))) && !intersectsPlayer(x, y, z, player)) {
      const kind = useGameStore.getState().selected;
      if (typeof kind !== 'number') return;
      if (!hasInventory(kind, store)) {
        store.setNotice('Récolte ou fabrique ce bloc avant de le poser.');
        return;
      }
      if (isCrop(kind)) {
        const soil = hit.block.kind === BlockKind.Grass || hit.block.kind === BlockKind.Dirt || hit.block.kind === BlockKind.ForestGrass || hit.block.kind === BlockKind.AutumnGrass || hit.block.kind === BlockKind.JungleGrass;
        if (hit.normal.y !== 1 || !soil) {
          store.setNotice('Les graines se plantent sur le dessus d’un bloc d’herbe ou de terre.');
          return;
        }
        const planted = addVoxel(world, x, y, z, kind, 0);
        if (planted) {
          attachGrowth(world, kind, x, y, z);
          if (store.gameplayMode === 'survival') changeInventory(kind, -1);
        }
        store.setNotice(`${cropDefinition(kind).name} planté. La récolte sera prête dans 24 secondes.`);
        return;
      }
      const facing = isLadder(kind)
        ? hit.normal.x === 1 ? 'east' : hit.normal.x === -1 ? 'west' : hit.normal.z === 1 ? 'south' : 'north'
        : isStair(kind) ? Math.abs(direction.x) > Math.abs(direction.z) ? direction.x > 0 ? 'east' : 'west' : direction.z > 0 ? 'north' : 'south'
        : isSign(kind) || isTrafficSign(kind) ? signFacing(direction, hit.normal)
          : kind === BlockKind.TrafficLight
            ? Math.abs(direction.x) > Math.abs(direction.z) ? direction.x > 0 ? 'west' : 'east' : direction.z > 0 ? 'south' : 'north'
            : Math.abs(direction.x) > Math.abs(direction.z) ? direction.x > 0 ? 'west' : 'east' : direction.z > 0 ? 'north' : 'south';
      const placed = addVoxel(world, x, y, z, kind, undefined, isLadder(kind) || isDoor(kind) || isTrapdoor(kind) || isRail(kind) || isSign(kind) || isBed(kind) || isStair(kind) || kind === BlockKind.TrafficLight || isTrafficSign(kind) ? facing : undefined);
      if (placed) playSound('placeBlock', 0.45);
      if (placed && store.gameplayMode === 'survival') changeInventory(kind, -1);
      if (kind === BlockKind.Tnt) {
        const bomb = spawnBomb(world, x, y, z);
        const cx = chunkCoordinate(x);
        const cz = chunkCoordinate(z);
        for (const chunkEntity of world.query(Chunk, ChunkData)) {
          const chunk = chunkEntity.get(Chunk)!;
          if (chunk.x !== cx || chunk.z !== cz) continue;
          chunkEntity.get(ChunkData)!.bombs.push(bomb);
          break;
        }
      }
      if (isSapling(kind)) attachGrowth(world, kind, x, y, z);
    }
  }
}
