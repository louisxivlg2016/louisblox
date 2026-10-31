import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { getBlockIndex } from './chunks';
import { SEA_LEVEL } from './levels';
import type { WaterTile } from './levels';
import { Fish, FishMesh, FishMotion, FishPosition, Player, PlayerPosition } from './traits';
import { BlockKind, voxelKey } from './voxel';
import { turnToward } from './rotation';

export type FishKind = 'salmon' | 'clownfish' | 'blueTang';
const kinds: FishKind[] = ['salmon', 'clownfish', 'blueTang'];

function hash(x: number, z: number, seed: number) {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function spawnFish(world: World, kind: FishKind, x: number, y: number, z: number, seed: number) {
  return world.spawn(
    Fish({ kind }),
    FishPosition(new Vector3(x, y, z)),
    FishMotion({
      yaw: hash(x, z, seed + 1) * Math.PI * 2,
      turnIn: 2 + hash(x, z, seed + 2) * 4,
      phase: hash(x, z, seed + 3) * Math.PI * 2,
      speed: 0.65 + hash(x, z, seed + 4) * 0.65,
    }),
    FishMesh(),
  );
}

export function spawnChunkFish(world: World, cx: number, cz: number, water: WaterTile[], seed: number) {
  const entities: Entity[] = [];
  if (water.length === 0 || hash(cx, cz, seed + 910) < 0.45) return entities;
  const count = 1;
  for (let index = 0; index < count; index += 1) {
    const tile = water[Math.floor(hash(cx + index, cz, seed + 911) * water.length)];
    const blocks = getBlockIndex(world);
    if (blocks.get(voxelKey(tile.x, 3, tile.z))?.kind !== BlockKind.Water || blocks.get(voxelKey(tile.x, 4, tile.z))?.kind !== BlockKind.Water) continue;
    const kind = kinds[Math.floor(hash(tile.x, tile.z, seed + 912 + index) * kinds.length)];
    entities.push(spawnFish(world, kind, tile.x, SEA_LEVEL - 1.2, tile.z, seed + index));
  }
  return entities;
}

const distantClocks = new WeakMap<Vector3, number>();

export function fishSystem(world: World, dt: number) {
  const playerPosition = world.queryFirst(Player)?.get(PlayerPosition);
  const blocks = getBlockIndex(world);
  const isWater = (x: number, y: number, z: number) => blocks.get(voxelKey(Math.round(x), Math.round(y), Math.round(z)))?.kind === BlockKind.Water;
  world.query(Fish, FishPosition, FishMotion, FishMesh).updateEach(([, position, motion, mesh]) => {
    const distanceSquared = playerPosition ? position.distanceToSquared(playerPosition) : Infinity;
    if (mesh.value) mesh.value.visible = distanceSquared < 40 * 40;
    let stepDt = dt;
    if (distanceSquared > 25 * 25) {
      const remaining = (distantClocks.get(position) ?? 0) - dt;
      if (remaining > 0) {
        distantClocks.set(position, remaining);
        return;
      }
      stepDt -= remaining;
      distantClocks.set(position, 0.1);
    }
    motion.age += stepDt;
    motion.turnIn -= stepDt;
    if (motion.turnIn <= 0) {
      motion.yaw += (hash(Math.round(position.x * 10), Math.round(position.z * 10), Math.floor(motion.age * 100)) - 0.5) * 2.4;
      motion.turnIn = 2 + hash(Math.round(position.z), Math.round(position.x), Math.floor(motion.age)) * 4;
    }
    const x = position.x - Math.sin(motion.yaw) * motion.speed * stepDt;
    const z = position.z - Math.cos(motion.yaw) * motion.speed * stepDt;
    const y = Math.max(2.5, Math.min(4.2, SEA_LEVEL - 1.2 + Math.sin(motion.age * 1.8 + motion.phase) * 0.4));
    if (isWater(x, y, z) && isWater(x, y - 0.45, z)) {
      position.set(x, y, z);
    } else {
      motion.yaw += Math.PI * 0.75;
      motion.turnIn = 0.5;
    }
    if (mesh.value) {
      mesh.value.position.copy(position);
      mesh.value.rotation.y = turnToward(mesh.value.rotation.y, motion.yaw, stepDt * 3);
      mesh.value.rotation.z = Math.sin(motion.age * 3 + motion.phase) * 0.055;
    }
  });
}
