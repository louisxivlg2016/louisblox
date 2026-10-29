import type { World } from 'koota';
import { Mesh } from 'three';
import { getWorldSeed } from '../chunks';
import { heightAt, SEA_LEVEL } from '../levels';
import { Animal, AnimalHit, AnimalMesh, AnimalMotion, AnimalPosition, HorseRider, Player, PlayerHealth, PlayerPosition } from '../traits';
import { damagePlayer } from '../combat';

function tint(mesh: import('three').Object3D, color: string) {
  mesh.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.color.set(color);
  });
}

export function animalSystem(world: World, dt: number) {
  const seed = getWorldSeed(world);
  const playerEntity = world.queryFirst(Player);
  const player = playerEntity?.get(PlayerPosition);
  const health = playerEntity?.get(PlayerHealth);

  world.query(Animal, AnimalHit, AnimalPosition, AnimalMotion, AnimalMesh).updateEach(([animal, hit, position, motion, mesh], entity) => {
    if (entity.get(HorseRider)?.mounted) return;
    hit.time = Math.max(0, hit.time - dt);
    hit.panic = Math.max(0, hit.panic - dt);
    hit.attackIn = Math.max(0, hit.attackIn - dt);
    const aggressive = animal.kind === 'bear' || animal.kind === 'snowBear' || animal.kind === 'wolf' || animal.kind === 'snowWolf';
    if (aggressive && playerEntity && player && health && hit.attackIn <= 0 && position.distanceToSquared(player) < 2.2 * 2.2) {
      hit.attackIn = 1.2;
      damagePlayer(world, 1);
    }
    if (mesh.value) {
      if (hit.time > 0 && !hit.flashed) {
        tint(mesh.value, '#ff3028');
        hit.flashed = true;
      } else if (hit.time === 0 && hit.flashed) {
        tint(mesh.value, '#ffffff');
        hit.flashed = false;
      }
    }

    motion.idle = Math.max(0, motion.idle - dt);
    motion.turnIn -= motion.idle > 0 ? 0 : dt;
    motion.phase += dt * 3;
    if (hit.panic > 0) {
      motion.idle = 0;
      motion.turnIn = Math.min(motion.turnIn, 0.3);
      motion.yaw += Math.sin(entity * 3.17 + motion.phase * 2) * dt * 2;
    }
    if (motion.turnIn <= 0) {
      motion.yaw += Math.sin(entity * 17.31 + motion.phase) * 1.8;
      motion.turnIn = hit.panic > 0 ? 0.3 : 2 + (Math.sin(entity * 7.13) + 1) * 1.5;
      if (hit.panic === 0 && Math.sin(entity * 5.73 + motion.phase) > 0.25) {
        motion.idle = 1 + (Math.sin(entity * 9.37 + motion.phase) + 1) * 1.25;
      }
    }

    const baseSpeed = animal.kind === 'duck' ? motion.speed * 0.35 : motion.speed;
    const normalSpeed = motion.idle > 0 ? 0 : baseSpeed;
    const speed = hit.panic > 0 ? Math.min(animal.kind === 'duck' ? 0.65 : 1.4, baseSpeed * 1.8) : normalSpeed;
    let x = position.x + Math.sin(motion.yaw) * speed * dt;
    let z = position.z + Math.cos(motion.yaw) * speed * dt;
    const ground = heightAt(Math.round(x), Math.round(z), seed);
    const ahead = heightAt(
      Math.round(x + Math.sin(motion.yaw) * 0.55),
      Math.round(z + Math.cos(motion.yaw) * 0.55),
      seed,
    );

    if (animal.kind === 'duck') {
      if (ground >= SEA_LEVEL || ahead < SEA_LEVEL) {
        motion.yaw += Math.PI * 0.7;
        x = position.x;
        z = position.z;
      }
      position.set(x, SEA_LEVEL + 0.35 + Math.sin(motion.phase) * 0.05, z);
    } else if (ground <= SEA_LEVEL + 1 || ahead <= SEA_LEVEL + 1 || ground > 25) {
      motion.yaw += Math.PI;
      x = position.x;
      z = position.z;
    } else {
      position.set(x, ground + 0.5, z);
    }

    if (mesh.value) {
      mesh.value.position.copy(position);
      mesh.value.rotation.y = motion.yaw;
    }
  });
}
