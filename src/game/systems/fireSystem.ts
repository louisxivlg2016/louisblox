import type { World } from 'koota';
import { addVoxel, batchVoxelEdits, getBlockIndex, removeVoxel, replaceVoxel } from '../chunks';
import { isCrop, isSapling } from '../extraBlocks';
import { extinguishFireAt } from '../fireLifecycle';
import { Fire, FirePosition, Player, PlayerPosition } from '../traits';
import { BlockKind, isWaterBlock, voxelKey } from '../voxel';
import type { VoxelHit } from '../voxel';
import { damagePlayer } from '../combat';
import { fireHazardSystem } from '../hazards';

const directions = [
  [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0],
] as const;

const flammable = new Set<BlockKind>([
  BlockKind.Grass, BlockKind.ForestGrass, BlockKind.AutumnGrass, BlockKind.JungleGrass,
  BlockKind.Leaves, BlockKind.PineLeaves, BlockKind.AutumnLeaves, BlockKind.JungleLeaves, BlockKind.JungleVine,
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
const fireSpreadClocks = new WeakMap<World, { time: number; index: number }>();

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
  fireHazardSystem(world, dt);
  const fires = world.query(Fire, FirePosition);
  if (fires.length === 0) {
    fireSpreadClocks.delete(world);
    return;
  }

  batchVoxelEdits(world, () => {
    fires.updateEach(([fire, position]) => {
      const water = [[0, 0, 0], ...directions].map(([dx, dy, dz]) => blocks.get(voxelKey(position.x + dx, position.y + dy, position.z + dz))).find((block) => isWaterBlock(block?.kind));
      if (water) {
        const block = blocks.get(voxelKey(position.x, position.y, position.z));
        if (block) replaceVoxel(world, hitAt(block), water.kind);
        else extinguishFireAt(world, position.x, position.y, position.z);
        return;
      }
      fire.age += dt;
      fire.spreadIn = Math.max(0, fire.spreadIn - dt);
    });

    const clock = fireSpreadClocks.get(world) ?? { time: 0, index: 0 };
    fireSpreadClocks.set(world, clock);
    clock.time += dt;
    if (clock.time < 1.2) return;
    clock.time -= 1.2;
    const candidates = fires.flatMap((entity) => {
      const fire = entity.get(Fire);
      const position = entity.get(FirePosition);
      if (!fire || !position) return [];
      return fire.spreadIn <= 0 && blocks.get(voxelKey(position.x, position.y, position.z))?.kind === fire.kind ? [entity] : [];
    });
    for (let attempt = 0; attempt < candidates.length; attempt += 1) {
      const entity = candidates[clock.index % candidates.length];
      clock.index = (clock.index + 1) % candidates.length;
      const fire = entity.get(Fire)!;
      const position = entity.get(FirePosition)!;
      const start = Math.abs(Math.floor(fire.age * 1.7 + position.x * 3 + position.z * 5));
      let created = false;
      for (let index = 0; index < directions.length; index += 1) {
        const [dx, dy, dz] = directions[(start + index) % directions.length];
        const x = position.x + dx;
        const y = position.y + dy;
        const z = position.z + dz;
        const target = blocks.get(voxelKey(x, y, z)) ?? blocks.get(voxelKey(x, y - 1, z));
        if (!target || !isFlammable(target.kind)) continue;
        if (fire.kind === BlockKind.Campfire) {
          const flameY = blocks.has(voxelKey(x, y, z)) ? y + 1 : y;
          if (blocks.has(voxelKey(x, flameY, z))) continue;
          addVoxel(world, x, flameY, z, BlockKind.Campfire, undefined, undefined, fire.generation + 1);
        } else {
          removeVoxel(world, hitAt(target));
          addVoxel(world, target.x, target.y, target.z, BlockKind.Wildfire, undefined, undefined, fire.generation + 1);
        }
        fire.spreadIn = 1.2;
        created = true;
        break;
      }
      if (created) break;
    }
  });
}
