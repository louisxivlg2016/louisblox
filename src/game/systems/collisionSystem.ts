import type { World } from 'koota';
import type { useRapier } from '@react-three/rapier';
import { getBlockIndex, getWorldSeed } from '../chunks';
import { MIN_WORLD_Y } from '../levels';
import { isCrop, isDoor, isTrapdoor } from '../extraBlocks';
import { Chunk, Player, PlayerPosition } from '../traits';
import { BlockKind, voxelKey } from '../voxel';
import type { Voxel } from '../voxel';

type RapierWorld = ReturnType<typeof useRapier>['world'];
type RapierCollider = ReturnType<RapierWorld['createCollider']>;

type CollisionState = {
  key: string;
  physicsWorld: RapierWorld;
  colliders: Map<string, RapierCollider>;
};

const states = new WeakMap<World, CollisionState>();
const neighborOffsets = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

export function collisionSystem(
  world: World,
  physicsWorld: RapierWorld,
  rapier: ReturnType<typeof useRapier>['rapier'],
) {
  const position = world.queryFirst(Player)?.get(PlayerPosition);
  if (!position) return;

  const px = Math.floor(position.x + 0.5);
  const py = Math.floor(position.y + 0.5);
  const pz = Math.floor(position.z + 0.5);
  let revision = 0;
  const chunks = world.query(Chunk);
  for (const entity of chunks) revision += entity.get(Chunk)?.revision ?? 0;
  const key = `${getWorldSeed(world)}:${chunks.length}:${revision}:${px}:${py}:${pz}`;
  let state = states.get(world);

  if (state?.physicsWorld !== physicsWorld) {
    if (state) {
      for (const collider of state.colliders.values()) state.physicsWorld.removeCollider(collider, false);
    }
    state = undefined;
  }
  if (state?.key === key) return;
  if (!state) {
    state = { key, physicsWorld, colliders: new Map() };
    states.set(world, state);
  }
  state.key = key;

  const blocks = getBlockIndex(world);
  const desired = new Map<string, Voxel>();
  for (let x = px - 8; x <= px + 8; x += 1) {
    for (let y = Math.max(MIN_WORLD_Y, py - 7); y <= py + 7; y += 1) {
      for (let z = pz - 8; z <= pz + 8; z += 1) {
        const block = blocks.get(voxelKey(x, y, z));
        if (!block || block.kind === BlockKind.Water || isCrop(block.kind)) continue;
        if ((isDoor(block.kind) || isTrapdoor(block.kind)) && block.open) continue;
        const exposed = neighborOffsets.some(([dx, dy, dz]) => !blocks.has(voxelKey(x + dx, y + dy, z + dz)));
        if (exposed) desired.set(voxelKey(x, y, z), block);
      }
    }
  }

  for (const [positionKey, collider] of state.colliders) {
    if (desired.has(positionKey)) continue;
    physicsWorld.removeCollider(collider, false);
    state.colliders.delete(positionKey);
  }
  for (const [positionKey, block] of desired) {
    if (state.colliders.has(positionKey)) continue;
    const description = rapier.ColliderDesc.cuboid(0.5, 0.5, 0.5)
      .setTranslation(block.x, block.y, block.z)
      .setFriction(0);
    state.colliders.set(positionKey, physicsWorld.createCollider(description));
  }
}
