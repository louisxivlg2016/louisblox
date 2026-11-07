import type { World } from 'koota';
import { explodeVoxels } from '../chunks';
import {
  Bomb,
  BombPosition,
  ChunkData,
  Explosion,
  ExplosionMaterial,
  ExplosionMesh,
  ExplosionPosition,
} from '../traits';
import { playSound } from '../audio';
import { damageCreaturesInRadius } from '../hazards';
import { damagePirateObjectivesInRadius } from '../piratesClient';

export function bombSystem(world: World, dt: number) {
  world.query(Bomb, BombPosition).updateEach(([bomb, position], entity) => {
    bomb.fuse -= dt;
    if (bomb.fuse > 0) return;

    playSound('explosion', 0.6);
    explodeVoxels(world, position.x, position.y, position.z, 3);
    damageCreaturesInRadius(world, position, 4.5);
    damagePirateObjectivesInRadius(position, 3.5);
    world.spawn(
      Explosion({ time: 0.45, maxTime: 0.45 }),
      ExplosionPosition(position.clone()),
      ExplosionMesh(),
      ExplosionMaterial(),
    );
    for (const chunkEntity of world.query(ChunkData)) {
      const data = chunkEntity.get(ChunkData)!;
      data.bombs = data.bombs.filter((bombEntity) => bombEntity !== entity);
    }
    entity.destroy();
  });
}

export function explosionSystem(world: World, dt: number) {
  world.query(Explosion, ExplosionMesh, ExplosionMaterial).updateEach(([explosion, mesh, material], entity) => {
    if (explosion.paintColor) return;
    explosion.time -= dt;
    const progress = 1 - Math.max(0, explosion.time) / explosion.maxTime;
    if (mesh.value) mesh.value.scale.setScalar(1 + progress * 6);
    if (material.value) material.value.opacity = Math.max(0, explosion.time / explosion.maxTime) * 0.8;
    if (explosion.time <= 0) entity.destroy();
  });
}
