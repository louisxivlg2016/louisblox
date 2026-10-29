import type { Entity, World } from 'koota';
import { getBlockIndex, growSapling, replaceVoxel } from '../chunks';
import { cropDefinition } from '../crops';
import { isCrop } from '../extraBlocks';
import { ChunkData, Sapling, SaplingPosition } from '../traits';
import { voxelKey } from '../voxel';

function removeSapling(world: World, entity: Entity) {
  for (const chunkEntity of world.query(ChunkData)) {
    const data = chunkEntity.get(ChunkData)!;
    data.saplings = data.saplings.filter((sapling) => sapling !== entity);
  }
  entity.destroy();
}

export function saplingSystem(world: World, dt: number) {
  world.query(Sapling, SaplingPosition).updateEach(([sapling, position], entity) => {
    const block = getBlockIndex(world).get(voxelKey(position.x, position.y, position.z));
    if (!block || block.kind !== sapling.kind) {
      removeSapling(world, entity);
      return;
    }
    if (isCrop(sapling.kind)) {
      const stage = block.growth ?? 3;
      if (stage >= 3) {
        removeSapling(world, entity);
        return;
      }
      sapling.age += dt;
      if (sapling.age < cropDefinition(sapling.kind).growthTime) return;
      const nextStage = stage + 1;
      replaceVoxel(world, { block, x: position.x, y: position.y, z: position.z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, sapling.kind, undefined, nextStage);
      sapling.age = 0;
      if (nextStage >= 3) removeSapling(world, entity);
      return;
    }
    sapling.age += dt;
    if (sapling.age < 30) return;
    growSapling(world, sapling.kind, position.x, position.y, position.z);
    removeSapling(world, entity);
  });
}
