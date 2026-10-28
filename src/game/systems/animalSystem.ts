import type { World } from 'koota';
import { getWorldSeed } from '../chunks';
import { heightAt, SEA_LEVEL } from '../levels';
import { Animal, AnimalMesh, AnimalMotion, AnimalPosition } from '../traits';

export function animalSystem(world: World, dt: number) {
  const seed = getWorldSeed(world);

  world.query(Animal, AnimalPosition, AnimalMotion, AnimalMesh).updateEach(([animal, position, motion, mesh], entity) => {
    motion.turnIn -= dt;
    motion.phase += dt * 3;
    if (motion.turnIn <= 0) {
      motion.yaw += Math.sin(entity * 17.31 + motion.phase) * 1.8;
      motion.turnIn = 2 + (Math.sin(entity * 7.13) + 1) * 1.5;
    }

    const speed = animal.kind === 'duck' ? motion.speed * 0.35 : motion.speed;
    let x = position.x + Math.sin(motion.yaw) * speed * dt;
    let z = position.z + Math.cos(motion.yaw) * speed * dt;
    const ground = heightAt(Math.round(x), Math.round(z), seed);

    if (animal.kind === 'duck') {
      if (ground >= SEA_LEVEL) {
        motion.yaw += Math.PI * 0.7;
        x = position.x;
        z = position.z;
      }
      position.set(x, SEA_LEVEL + 0.35 + Math.sin(motion.phase) * 0.05, z);
    } else if (ground <= SEA_LEVEL + 1 || ground > 25) {
      motion.yaw += Math.PI * 0.65;
    } else {
      position.set(x, ground + 0.5, z);
    }

    if (mesh.value) {
      mesh.value.position.copy(position);
      mesh.value.rotation.y = motion.yaw;
    }
  });
}
