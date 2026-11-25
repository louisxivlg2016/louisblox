import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import { addVoxel, chunkCoordinate, getBlockIndex, removeVoxel, replaceVoxel, setVoxelFloodSource } from '../chunks';
import { spawnBomb } from '../bombLifecycle';
import { spawnSapling } from '../saplingLifecycle';
import { isBed, isCeilingLight, isChest, isCrop, isDoor, isFurnace, isGlass, isLadder, isPainting, isRadio, isRail, isSapling, isSign, isSlab, isStair, isTrafficSign, isTrapdoor, signFacing, slabSource } from '../extraBlocks';
import { useSignStore } from '../signs';
import { startSleep } from './sleepSystem';
import { openChest, openFurnace } from '../containers';
import { cropDefinition } from '../crops';
import { pickUpFood } from '../foods';
import { consumeActions, isMouseDown, releasePointerForOverlay, stopMining } from '../input';
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
import { translate } from '../language';
import { toggleVehicleRadio } from '../radio';
import { useShopBlock } from '../shops';
import { useCustomPaintingStore } from '../customPainting';
import { collapseHeistGravel, consumeHeistGadget, hasHeistGadget, heistMiningDuration, notifyHeistAlarm } from '../heistClient';

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

export function miningTarget(blocks: ReadonlyMap<string, import('../voxel').Voxel>, currentHit: VoxelHit | null, target: { miningKey: string; normal: { x: number; y: number; z: number } }, mouseDown: boolean) {
  if (!mouseDown || !target.miningKey) return currentHit;
  const [x, y, z] = target.miningKey.split(',').map(Number);
  const block = blocks.get(target.miningKey);
  return block ? { block, x, y, z, normal: { ...target.normal }, distance: 0 } : currentHit;
}

export function blockSystem(world: World, camera: Camera, dt: number, disabled = false, pendingActions?: { place: number; harvest: number; interact?: number }) {
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
  const hit = miningTarget(blocks, raycastVoxel(blocks, origin, direction, 6, store.gameplayMode === 'pirates' || typeof store.selected === 'number' || store.selected === 'bucket' || store.selected === 'empty_bucket'), target, isMouseDown(0));

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
  const canMine = hit?.block.protected !== true && !ranged && !isWaterBlock(kind) && !['bucket', 'water_bucket', 'empty_bucket'].includes(store.selected as string) && (store.gameplayMode === 'creative' || store.gameplayMode !== 'football' && store.gameplayMode !== 'maze' && ((store.selected === 'hand' && store.gameplayMode !== 'battle') || store.gameplayMode === 'survival' || typeof store.selected === 'number' || isSword(store.selected)
    || (typeof store.selected === 'string' && (['pickaxe', 'shovel'].includes(getItemMeta(store.selected).category) || getItemMeta(store.selected).shape === 'shears'))));
  const mining = canMine && isMouseDown(0) && hit !== null && useGameStore.getState().mode === 'play';
  if (mining && hit && kind !== undefined) {
    const key = voxelKey(hit.x, hit.y, hit.z);
    if (target.miningKey !== key) {
      target.miningKey = key;
      target.miningProgress = 0;
    }
    target.miningProgress += dt;
    const miningDuration = store.gameplayMode === 'heist' ? heistMiningDuration(kind, store.selected, hit) : store.gameplayMode === 'creative' ? 0.18 : BLOCK_HARDNESS[kind] / (miningSpeed(store.selected, kind) * miningMultiplier());
    const progress = Math.min(1, target.miningProgress / miningDuration);
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
        if (store.gameplayMode === 'heist') {
          if (kind === BlockKind.Glass && hit.x >= -46 && hit.x <= -25 && hit.z >= -34 && hit.z <= -17) notifyHeistAlarm(hit);
          if (kind === BlockKind.Sand) collapseHeistGravel(world, hit);
        }
        if (store.gameplayMode === 'survival') {
          dropBlock(world, hit.block);
          const sapling = kind === BlockKind.Leaves || kind === BlockKind.JungleLeaves ? BlockKind.OakSapling : kind === BlockKind.PineLeaves ? BlockKind.PineSapling : kind === BlockKind.AutumnLeaves ? BlockKind.AutumnSapling : null;
          if (sapling) changeInventory(sapling, 1 + Math.floor(Math.random() * 2));
        }
      }
      const dirtBlock = hit.block.kind === BlockKind.Dirt || hit.block.kind === BlockKind.Sand || hit.block.kind === BlockKind.Grass || hit.block.kind === BlockKind.ForestGrass || hit.block.kind === BlockKind.AutumnGrass || hit.block.kind === BlockKind.JungleGrass;
      playSound(dirtBlock ? 'breakDirt' : isGlass(hit.block.kind) ? 'breakGlass' : isWoodBlock(hit.block.kind) ? 'breakWood' : 'breakBlock', 0.5);
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
  if ((actions.place > 0 || actions.harvest > 0 || (actions.interact ?? 0) > 0) && hit.block.shop && useShopBlock(world, hit.block)) return;
  if ((actions.place > 0 || actions.harvest > 0) && (hit.block.kind === BlockKind.PaintingCustom || hit.block.kind === BlockKind.DrawingPainting)) {
    useCustomPaintingStore.getState().openPainting(hit, hit.block.image, hit.block.kind === BlockKind.DrawingPainting);
    releasePointerForOverlay();
    return;
  }
  if ((actions.place > 0 || actions.harvest > 0) && isSign(hit.block.kind)) {
    useSignStore.getState().openSign(hit, hit.block.text ?? '', hit.block.kind, hit.block.textSize);
    if (document.pointerLockElement) document.exitPointerLock();
    return;
  }
  if ((actions.place > 0 || actions.harvest > 0) && isRadio(hit.block.kind)) {
    toggleVehicleRadio(true);
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

  const interacting = actions.place > 0 || actions.harvest > 0 || (actions.interact ?? 0) > 0;
  const interactionHit = interacting && isWaterBlock(hit.block.kind) ? raycastVoxel(blocks, origin, direction, 6, false) : hit;
  if (interacting && interactionHit && (isDoor(interactionHit.block.kind) || isTrapdoor(interactionHit.block.kind))) {
    replaceVoxel(world, interactionHit, interactionHit.block.kind, !interactionHit.block.open);
    return;
  }

  if ((actions.place > 0 || actions.harvest > 0) && isCrop(hit.block.kind)) {
    const definition = cropDefinition(hit.block.kind);
    if ((hit.block.growth ?? 3) < 3) {
      store.setNotice(`${definition.name} pousse encore…`);
      return;
    }
    changeInventory(definition.food, definition.yield);
    store.setNotice(translate(`${definition.name} récolté : +${definition.yield} dans le sac.`, `${definition.name} harvested: +${definition.yield} in backpack.`));
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
    changeInventory('apple', 1);
    target.visible = false;
    if (mesh) mesh.visible = false;
    return;
  }

  if (actions.place > 0 || actions.harvest > 0) {
    const kind = useGameStore.getState().selected;
    const replacingWater = isWaterBlock(hit.block.kind) && kind !== BlockKind.Water;
    const x = hit.x + (replacingWater ? 0 : hit.normal.x);
    const y = hit.y + (replacingWater ? 0 : hit.normal.y);
    const z = hit.z + (replacingWater ? 0 : hit.normal.z);
    const inBounds = y >= MIN_WORLD_Y && y <= MAX_BUILD_Y;

    if (inBounds && (replacingWater || !blocks.has(voxelKey(x, y, z))) && !intersectsPlayer(x, y, z, player)) {
      if (typeof kind !== 'number') return;
      if (store.gameplayMode === 'heist' && (kind === BlockKind.Ladder || kind === BlockKind.Tnt) && !hasHeistGadget(kind)) {
        store.setNotice(translate('Achète ce gadget dans la boutique de braquage.', 'Buy this gadget from the heist shop.'));
        return;
      }
      if (kind === BlockKind.Lantern && hit.normal.y === 0 || kind === BlockKind.ModernCeilingLight && hit.normal.y !== -1) {
        store.setNotice(translate('Cette lumière se fixe au sol ou sous un plafond.', 'This light attaches to the ground or the underside of a ceiling.', 'Esta luz se fija al suelo o debajo de un techo.'));
        return;
      }
      if (isPainting(kind) && hit.normal.y !== 0) {
        store.setNotice(translate('Un tableau se pose sur la paroi verticale d’un bloc.', 'A painting must be placed on the vertical side of a block.'));
        return;
      }
      if (!hasInventory(kind, store)) {
        store.setNotice(translate('Récolte ou fabrique ce bloc avant de le poser.', 'Gather or craft this block before placing it.'));
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
        store.setNotice(translate(`${cropDefinition(kind).name} planté. La récolte sera prête dans 24 secondes.`, `${cropDefinition(kind).name} planted. The crop will be ready in 24 seconds.`));
        return;
      }
      const uprightGlassSlab = isSlab(kind) && isGlass(slabSource(kind) ?? kind);
      const extendingWallSlab = isSlab(kind) && isSlab(hit.block.kind) && hit.block.growth === 2 && hit.normal.y !== 0;
      const facing = extendingWallSlab ? hit.block.facing
        : isLadder(kind) || isSlab(kind)
          ? hit.normal.x === 1 ? 'east' : hit.normal.x === -1 ? 'west' : hit.normal.z === 1 ? 'south' : 'north'
        : isStair(kind) ? Math.abs(direction.x) > Math.abs(direction.z) ? direction.x > 0 ? 'east' : 'west' : direction.z > 0 ? 'north' : 'south'
        : isSign(kind) || isTrafficSign(kind) || isPainting(kind) ? signFacing(direction, hit.normal)
          : kind === BlockKind.TrafficLight
            ? Math.abs(direction.x) > Math.abs(direction.z) ? direction.x > 0 ? 'west' : 'east' : direction.z > 0 ? 'south' : 'north'
            : Math.abs(direction.x) > Math.abs(direction.z) ? direction.x > 0 ? 'west' : 'east' : direction.z > 0 ? 'north' : 'south';
      const orientation = isSlab(kind) ? uprightGlassSlab || extendingWallSlab ? 2 : hit.normal.y === -1 ? 1 : hit.normal.y === 0 ? 2 : 0 : isStair(kind) && hit.normal.y === -1 ? 1 : undefined;
      const placed = addVoxel(world, x, y, z, kind, orientation, isLadder(kind) || isDoor(kind) || isTrapdoor(kind) || isRail(kind) || isSign(kind) || isBed(kind) || isStair(kind) || isSlab(kind) || isPainting(kind) || kind === BlockKind.TrafficLight || isTrafficSign(kind) ? facing : undefined);
      if (placed) playSound('placeBlock', 0.45);
      if (placed && store.gameplayMode === 'heist' && (kind === BlockKind.Ladder || kind === BlockKind.Tnt)) consumeHeistGadget(kind);
      if (placed && (kind === BlockKind.PaintingCustom || kind === BlockKind.DrawingPainting)) {
        useCustomPaintingStore.getState().openPainting({ x, y, z }, placed.image, kind === BlockKind.DrawingPainting);
        releasePointerForOverlay();
      }
      if (placed && kind === BlockKind.Water) setVoxelFloodSource(world, placed, true);
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
