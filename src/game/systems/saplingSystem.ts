import type { Entity, World } from 'koota';
import { getBlockIndex, growSapling } from '../chunks';
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
    sapling.age += dt;
    if (sapling.age < 30) return;
    growSapling(world, sapling.kind, position.x, position.y, position.z);
    removeSapling(world, entity);
  });
}
