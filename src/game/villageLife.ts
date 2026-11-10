import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { getBlockIndex, getWorldSeed } from './chunks';
import { getFireSources, nearestFire } from './hazards';
import { groundAt } from './vehicles';
import { isDoor } from './extraBlocks';
import { Environment, Trader, TraderMesh, TraderPosition } from './traits';
import { replaceVoxel } from './chunks';
import { villageBeds } from './villages';
import { openRestaurant, useTradeStore } from './trading';
import { useGameStore } from './store';

function wake(world: World, entity: Entity) {
  const trader = entity.get(Trader);
  const position = entity.get(TraderPosition);
  const mesh = entity.get(TraderMesh)?.value;
  if (!trader || !position) return;
  if (trader.bedY !== null) position.y = groundAt(world, position.x, position.z, trader.bedY + 2) + 0.02;
  entity.set(Trader, { sleeping: false, bedDoorReached: false });
  if (mesh) {
    mesh.position.copy(position);
    mesh.rotation.x = 0;
  }
}

function openDoors(world: World, position: Vector3) {
  const blocks = getBlockIndex(world);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = Math.round(position.x + dx);
        const y = Math.round(position.y + dy);
        const z = Math.round(position.z + dz);
        const block = blocks.get(`${x},${y},${z}`);
        if (!block || !isDoor(block.kind) || block.open) continue;
        replaceVoxel(world, { block, x, y, z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, block.kind, true);
      }
    }
  }
}

export function assignMerchantBed(world: World, entity: Entity) {
  const trader = entity.get(Trader);
  if (!trader || trader.bedX !== null) return;
  const site = { x: trader.destinationX ?? trader.homeX, z: trader.destinationZ ?? trader.homeZ };
  const occupied = new Set(world.query(Trader).filter((entity) => entity.get(Trader)?.villager).map((entity) => `${entity.get(Trader)!.bedX},${entity.get(Trader)!.bedZ}`));
  const position = entity.get(TraderPosition);
  const beds = villageBeds(site, getWorldSeed(world), true).filter((candidate) => !occupied.has(`${candidate.x},${candidate.z}`));
  const available = position ? beds.sort((a, b) => Math.hypot(a.x - position.x, a.z - position.z) - Math.hypot(b.x - position.x, b.z - position.z)) : beds;
  const bed = available[0] ?? villageBeds(site, getWorldSeed(world), true)[0];
  if (bed) entity.set(Trader, { bedX: bed.x, bedY: bed.y, bedZ: bed.z });
}

export function updateVillageSleep(world: World, entity: Entity, dt: number, talkingTo: Entity | null) {
  const trader = entity.get(Trader);
  const position = entity.get(TraderPosition);
  const mesh = entity.get(TraderMesh)?.value;
  if (!trader || !position || (!trader.villager && !trader.arrived)) return false;
  if (trader.arrived && trader.bedX === null) assignMerchantBed(world, entity);
  const fire = nearestFire(getFireSources(world), position);
  if (talkingTo === entity || fire) {
    if (trader.sleeping) wake(world, entity);
    return false;
  }
  const dayProgress = world.queryFirst(Environment)?.get(Environment)?.dayProgress ?? 0.38;
  const night = dayProgress >= 0.78 || dayProgress < 0.22;
  if (!night) {
    if (trader.sleeping) wake(world, entity);
    return false;
  }
  if (!trader.villager && !trader.restaurantInvited) {
    entity.set(Trader, { restaurantInvited: true, walking: false });
    openRestaurant();
    useTradeStore.setState({ open: true, traderId: entity, restaurantAvailable: true });
    useGameStore.getState().setMode('pause');
    if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
    return false;
  }
  if (trader.bedX === null || trader.bedY === null || trader.bedZ === null) return false;
  const doorDistance = Math.hypot(trader.bedX - position.x, trader.bedZ + 3 - position.z);
  const doorReached = trader.bedDoorReached || doorDistance <= 1.2;
  if (doorReached && !trader.bedDoorReached) entity.set(Trader, { bedDoorReached: true });
  const targetZ = position.z > trader.bedZ + 1 && !doorReached ? trader.bedZ + 3 : trader.bedZ + 0.55;
  const dx = trader.bedX - position.x;
  const dz = targetZ - position.z;
  if (Math.hypot(dx, dz) > 0.24) {
    openDoors(world, position);
    const distance = Math.hypot(dx, dz);
    const step = Math.min(distance, dt * 1.25);
    const nextX = position.x + dx / distance * step;
    const nextZ = position.z + dz / distance * step;
    const ground = Math.max(groundAt(world, nextX, nextZ, position.y + 2.05), trader.bedY - 0.5);
    if (ground !== null) {
      position.set(nextX, ground, nextZ);
      if (mesh) {
        mesh.position.copy(position);
        mesh.rotation.y = Math.atan2(dx, dz);
        mesh.rotation.x = 0;
      }
    }
    if (trader.sleeping) entity.set(Trader, { sleeping: false });
    entity.set(Trader, { walking: true });
    return true;
  }
  position.set(trader.bedX, trader.bedY + 0.42, trader.bedZ + 0.55);
  if (!trader.sleeping || trader.walking) entity.set(Trader, { sleeping: true, walking: false });
  if (mesh) {
    mesh.position.copy(position);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.y = 0;
  }
  return true;
}
