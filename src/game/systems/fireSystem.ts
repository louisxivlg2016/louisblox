import type { World } from 'koota';
import { addVoxel, batchVoxelEdits, getBlockIndex, removeVoxel, replaceVoxel } from '../chunks';
import { isCrop, isSapling } from '../extraBlocks';
import { extinguishFireAt } from '../fireLifecycle';
import { Fire, FirePosition, Player, PlayerPosition } from '../traits';
import { BlockKind, isWaterBlock, voxelKey } from '../voxel';
import type { VoxelHit } from '../voxel';
import { damagePlayer } from '../combat';

const directions = [
  [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0],
] as const;

const flammable = new Set<BlockKind>([
  BlockKind.Grass, BlockKind.ForestGrass, BlockKind.AutumnGrass,
  BlockKind.Leaves, BlockKind.PineLeaves, BlockKind.AutumnLeaves,
  BlockKind.Wood, BlockKind.OakPlanks, BlockKind.PinePlanks, BlockKind.AutumnPlanks,
  BlockKind.Apple, BlockKind.Cactus,
]);

function isFlammable(kind: BlockKind) {
  return isCrop(kind) || isSapling(kind) || flammable.has(kind);
}

function hitAt(block: { x: number; y: number; z: number; kind: BlockKind }): VoxelHit {
  return { block, x: block.x, y: block.y, z: block.z, normal: { x: 0, y: 1, z: 0 }, distance: 0 };
}

const fireDamageClocks = new WeakMap<World, number>();

export function fireSystem(world: World, dt: number) {
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return;
  const blocks = getBlockIndex(world);
  const flame = blocks.get(voxelKey(Math.round(player.x), Math.round(player.y + 0.2), Math.round(player.z)));
  const touchingFire = flame?.kind === BlockKind.Campfire || flame?.kind === BlockKind.Wildfire;
  const damageIn = (fireDamageClocks.get(world) ?? 0) + dt;
  if (touchingFire && damageIn >= 1) {
    damagePlayer(world, 1, 'fire');
    fireDamageClocks.set(world, 0);
  } else fireDamageClocks.set(world, touchingFire ? damageIn : 0);
  const fires = world.query(Fire, FirePosition);
  if (fires.length === 0) return;

  batchVoxelEdits(world, () => {
    fires.updateEach(([fire, position]) => {
      if (position.distanceToSquared(player) > 64 * 64) return;
      const water = [[0, 0, 0], ...directions].map(([dx, dy, dz]) => blocks.get(voxelKey(position.x + dx, position.y + dy, position.z + dz))).find((block) => isWaterBlock(block?.kind));
      if (water) {
        const block = blocks.get(voxelKey(position.x, position.y, position.z));
        if (block) replaceVoxel(world, hitAt(block), water.kind);
        else extinguishFireAt(world, position.x, position.y, position.z);
        return;
      }
      fire.age += dt;
      fire.spreadIn -= dt;
      if (fire.spreadIn > 0 || fires.length >= 96 || fire.generation >= (fire.kind === BlockKind.Wildfire ? 6 : 3)) return;
      fire.spreadIn = fire.kind === BlockKind.Wildfire ? 1.2 : 2.8;
      const start = Math.abs(Math.floor(fire.age * 1.7 + position.x * 3 + position.z * 5));
      let created = 0;
      for (let index = 0; index < directions.length && created < (fire.kind === BlockKind.Wildfire ? 2 : 1); index += 1) {
        const [dx, dy, dz] = directions[(start + index) % directions.length];
        const x = position.x + dx;
        const y = position.y + dy;
        const z = position.z + dz;
        const target = blocks.get(voxelKey(x, y, z));
        if (fire.kind === BlockKind.Wildfire) {
          if (!target || !isFlammable(target.kind)) continue;
          removeVoxel(world, hitAt(target));
          addVoxel(world, x, y, z, BlockKind.Wildfire, undefined, undefined, fire.generation + 1);
          created += 1;
          continue;
        }
        if (target || (dy !== 0 && dy !== 1 && dy !== -1)) continue;
        const support = blocks.get(voxelKey(x, y - 1, z));
        if (!support || isWaterBlock(support.kind) || support.kind === BlockKind.Campfire || support.kind === BlockKind.Wildfire) continue;
        addVoxel(world, x, y, z, BlockKind.Campfire, undefined, undefined, fire.generation + 1);
        created += 1;
      }
    });
  });
}
