import { create } from 'zustand';
import { Vector3 } from 'three';
import type { World } from 'koota';
import { getBlockIndex, removeVoxel } from './chunks';
import { extinguishFireAt } from './fireLifecycle';
import { isFireBlock } from './extraBlocks';
import { getFireSources } from './hazards';
import { raycastVoxel, voxelKey } from './voxel';
import { useGameStore } from './store';

export type ExtinguisherSpray = { id: number; origin: Vector3; direction: Vector3; age: number };
export const useExtinguisherStore = create<{ sprays: ExtinguisherSpray[] }>(() => ({ sprays: [] }));
let nextSprayId = 0;

function spray(origin: Vector3, direction: Vector3) {
  useExtinguisherStore.setState((state) => ({ sprays: [...state.sprays.filter((item) => item.age < 0.75), { id: ++nextSprayId, origin: origin.clone(), direction: direction.clone(), age: 0 }] }));
}

export function useFireExtinguisher(world: World, origin: Vector3, direction: Vector3) {
  const blocks = getBlockIndex(world);
  let target: { position: Vector3; distance: number } | null = null;
  for (const position of getFireSources(world)) {
    const offset = position.clone().sub(origin);
    const distance = offset.length();
    if (distance < 0.2 || distance > 6 || offset.normalize().dot(direction) < 0.72) continue;
    if (target && distance >= target.distance) continue;
    const obstruction = raycastVoxel(blocks, origin, offset, distance);
    if (obstruction && obstruction.distance < distance - 0.6 && (obstruction.x !== position.x || obstruction.y !== position.y || obstruction.z !== position.z)) continue;
    target = { position, distance };
  }
  spray(origin, direction);
  if (!target) {
    useGameStore.getState().setNotice('Vise un feu pour l’éteindre avec l’extincteur.');
    return false;
  }
  const { x, y, z } = target.position;
  const block = blocks.get(voxelKey(x, y, z));
  if (block && isFireBlock(block.kind)) removeVoxel(world, { block, x, y, z, normal: { x: 0, y: 1, z: 0 }, distance: target.distance });
  else extinguishFireAt(world, x, y, z);
  useGameStore.getState().setNotice('Feu éteint avec l’extincteur.');
  return true;
}
