import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import { addVoxel, chunkCoordinate, getBlockIndex, removeVoxel, replaceVoxel } from '../chunks';
import { spawnBomb } from '../bombLifecycle';
import { spawnSapling } from '../saplingLifecycle';
import { isSapling } from '../extraBlocks';
import { consumeActions, isMouseDown, stopMining } from '../input';
import { MAX_BUILD_Y, MIN_WORLD_Y } from '../levels';
import { useGameStore } from '../store';
import { BlockTarget, Chunk, ChunkData, Player, PlayerPosition, TargetMesh } from '../traits';
import { BLOCK_HARDNESS, BlockKind, raycastVoxel, voxelKey } from '../voxel';

const direction = new Vector3();
const origin = new Vector3();

function intersectsPlayer(x: number, y: number, z: number, player: Vector3) {
  const horizontal = Math.abs(player.x - x) < 0.86 && Math.abs(player.z - z) < 0.86;
  const vertical = y - 0.5 < player.y + 1.8 && y + 0.5 > player.y;
  return horizontal && vertical;
}

export function blockSystem(world: World, camera: Camera, dt: number, disabled = false) {
  const playerEntity = world.queryFirst(Player);
  const targetEntity = world.queryFirst(BlockTarget);
  const player = playerEntity?.get(PlayerPosition);
  const target = targetEntity?.get(BlockTarget);
  if (!player || !target) return;

  origin.copy(player);
  origin.y += 1.62;
  camera.getWorldDirection(direction);
  const blocks = getBlockIndex(world);
  const store = useGameStore.getState();
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
  if (store.blockCount !== blocks.size) store.setBlockCount(blocks.size);
  const hit = raycastVoxel(blocks, origin, direction);

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
  const mining = isMouseDown(0) && hit !== null && useGameStore.getState().mode === 'play';
  if (mining && hit && kind !== undefined) {
    const key = voxelKey(hit.x, hit.y, hit.z);
    if (target.miningKey !== key) {
      if (target.miningKey !== '') stopMining();
      target.miningKey = key;
      target.miningProgress = 0;
    }
    target.miningProgress += dt;
    const progress = Math.min(1, target.miningProgress / BLOCK_HARDNESS[kind]);
    if (Math.abs(store.miningProgress - progress) >= 0.01) store.setMiningProgress(progress);

    if (progress >= 1) {
      stopMining();
      removeVoxel(world, hit);
      target.visible = false;
      target.miningKey = '';
      target.miningProgress = 0;
      store.setMiningProgress(0);
      if (mesh) mesh.visible = false;
      return;
    }
  } else {
    if (target.miningKey !== '') stopMining();
    target.miningKey = '';
    target.miningProgress = 0;
    if (store.miningProgress !== 0) store.setMiningProgress(0);
  }

  const actions = consumeActions();
  if (useGameStore.getState().mode !== 'play' || !hit) return;

  if (actions.harvest > 0 && hit.block.kind === BlockKind.Apple) {
    replaceVoxel(world, hit, BlockKind.Leaves);
    store.collectApple();
    target.visible = false;
    if (mesh) mesh.visible = false;
    return;
  }

  if (actions.place > 0 || actions.harvest > 0) {
    const x = hit.x + hit.normal.x;
    const y = hit.y + hit.normal.y;
    const z = hit.z + hit.normal.z;
    const inBounds = y >= MIN_WORLD_Y && y <= MAX_BUILD_Y;

    if (inBounds && !blocks.has(voxelKey(x, y, z)) && !intersectsPlayer(x, y, z, player)) {
      const kind = useGameStore.getState().selected;
      addVoxel(world, x, y, z, kind);
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
      if (isSapling(kind)) {
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
    }
  }
}
