import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { CHUNK_SIZE } from './levels';
import { isFireBlock } from './extraBlocks';
import { Fire, FirePosition } from './traits';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';

export function spawnFire(world: World, block: Pick<Voxel, 'x' | 'y' | 'z' | 'kind'>, generation = 0): Entity | null {
  if (!isFireBlock(block.kind)) return null;
  const existing = world.query(Fire, FirePosition).find((entity) => {
    const position = entity.get(FirePosition)!;
    return position.x === block.x && position.y === block.y && position.z === block.z;
  });
  if (existing) return existing;
  return world.spawn(
    Fire({
      kind: block.kind === BlockKind.Wildfire ? BlockKind.Wildfire : BlockKind.Campfire,
      age: 0,
      spreadIn: block.kind === BlockKind.Wildfire ? 1.2 : 2.4,
      generation,
    }),
    FirePosition(new Vector3(block.x, block.y, block.z)),
  );
}

export function extinguishFireAt(world: World, x: number, y: number, z: number) {
  for (const entity of world.query(Fire, FirePosition)) {
    const position = entity.get(FirePosition)!;
    if (position.x === x && position.y === y && position.z === z) entity.destroy();
  }
}

export function extinguishFiresInChunk(world: World, cx: number, cz: number) {
  for (const entity of world.query(Fire, FirePosition)) {
    const position = entity.get(FirePosition)!;
    if (Math.floor((position.x + 0.5) / CHUNK_SIZE) === cx && Math.floor((position.z + 0.5) / CHUNK_SIZE) === cz) entity.destroy();
  }
}

export function clearFires(world: World) {
  for (const entity of world.query(Fire)) entity.destroy();
}
