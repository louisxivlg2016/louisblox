import { isCrop, isDoor, isGrassPlate, isLadder, isRail, isStair, isTrapdoor, isUpsideDownStair } from '../extraBlocks';
import { BlockKind, isWaterBlock, voxelKey } from '../voxel';
import type { Voxel } from '../voxel';
import type { CabinDefinition } from '../vehicleTypes';

type Vector = { x: number; y: number; z: number };
type Axis = keyof Vector;

const RADIUS = 0.35;
const HEIGHT = 1.8;
const EPSILON = 0.0001;
const MAX_SUBSTEP = 0.18;

export function isCollidable(block: Voxel | undefined) {
  if (!block || isGrassPlate(block) || isWaterBlock(block.kind) || block.kind === BlockKind.Food || block.kind === BlockKind.JungleVine || isCrop(block.kind) || isLadder(block.kind) || isRail(block.kind)) return false;
  return !(isDoor(block.kind) || isTrapdoor(block.kind)) || !block.open;
}

function stairCollides(block: Voxel, position: Vector, height: number) {
  const overlaps = (minA: number, maxA: number, minB: number, maxB: number) => minA < maxB - EPSILON && maxA > minB + EPSILON;
  const xOverlap = overlaps(position.x - RADIUS, position.x + RADIUS, block.x - 0.5, block.x + 0.5);
  const zOverlap = overlaps(position.z - RADIUS, position.z + RADIUS, block.z - 0.5, block.z + 0.5);
  const upsideDown = isUpsideDownStair(block);
  const lowerOverlap = overlaps(position.y, position.y + height, upsideDown ? block.y : block.y - 0.5, upsideDown ? block.y + 0.5 : block.y);
  if (xOverlap && zOverlap && lowerOverlap) return true;
  const upperX = block.facing === 'east' ? [block.x, block.x + 0.5] : block.facing === 'west' ? [block.x - 0.5, block.x] : [block.x - 0.5, block.x + 0.5];
  const upperZ = block.facing === 'north' ? [block.z, block.z + 0.5] : block.facing === 'south' || !block.facing ? [block.z - 0.5, block.z] : [block.z - 0.5, block.z + 0.5];
  return overlaps(position.x - RADIUS, position.x + RADIUS, upperX[0], upperX[1])
    && overlaps(position.z - RADIUS, position.z + RADIUS, upperZ[0], upperZ[1])
    && overlaps(position.y, position.y + height, upsideDown ? block.y - 0.5 : block.y, upsideDown ? block.y : block.y + 0.5);
}

function collides(blocks: ReadonlyMap<string, Voxel>, position: Vector, cabin?: CabinDefinition, height = HEIGHT) {
  if (cabin) {
    return Math.abs(position.x) + RADIUS > cabin.halfWidth
      || position.z - RADIUS < cabin.front || position.z + RADIUS > cabin.rear
      || position.y < cabin.floor || position.y + height > cabin.ceiling;
  }
  const minX = Math.ceil(position.x - RADIUS - 0.5 + EPSILON);
  const maxX = Math.floor(position.x + RADIUS + 0.5 - EPSILON);
  const minY = Math.ceil(position.y - 0.5 + EPSILON);
  const maxY = Math.floor(position.y + height + 0.5 - EPSILON);
  const minZ = Math.ceil(position.z - RADIUS - 0.5 + EPSILON);
  const maxZ = Math.floor(position.z + RADIUS + 0.5 - EPSILON);
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        const block = blocks.get(voxelKey(x, y, z));
        if (!isCollidable(block)) continue;
        if (block && isStair(block.kind)) {
          if (stairCollides(block, position, height)) return true;
          continue;
        }
        return true;
      }
    }
  }
  return false;
}

export function canOccupyVoxelCharacter(blocks: ReadonlyMap<string, Voxel>, position: Vector) {
  return !collides(blocks, position);
}

function slide(blocks: ReadonlyMap<string, Voxel>, position: Vector, axis: Axis, amount: number, cabin?: CabinDefinition, height = HEIGHT) {
  if (amount === 0) return false;
  const start = position[axis];
  position[axis] = start + amount;
  if (!collides(blocks, position, cabin, height)) return false;
  let safe = 0;
  let blocked = 1;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const middle = (safe + blocked) / 2;
    position[axis] = start + amount * middle;
    if (collides(blocks, position, cabin, height)) blocked = middle;
    else safe = middle;
  }
  position[axis] = start + amount * safe;
  return true;
}

function onGround(blocks: ReadonlyMap<string, Voxel>, position: Vector, cabin?: CabinDefinition, height = HEIGHT) {
  return collides(blocks, { ...position, y: position.y - 0.055 }, cabin, height);
}

export function moveVoxelCharacter(
  blocks: ReadonlyMap<string, Voxel>,
  position: Vector,
  movement: Vector,
  canStep: boolean,
  cabin?: CabinDefinition,
  height = HEIGHT,
) {
  const substeps = Math.max(1, Math.ceil(Math.max(Math.abs(movement.x), Math.abs(movement.y), Math.abs(movement.z)) / MAX_SUBSTEP));
  let grounded = false;
  let hitCeiling = false;
  let stepped = false;

  for (let step = 0; step < substeps; step += 1) {
    const start = { ...position };
    const x = movement.x / substeps;
    const y = movement.y / substeps;
    const z = movement.z / substeps;
    const hitX = slide(blocks, position, 'x', x, cabin, height);
    const hitZ = slide(blocks, position, 'z', z, cabin, height);
    const horizontalHit = hitX || hitZ;
    let climbed = false;

    if (canStep && y <= 0 && horizontalHit) {
      const candidateHeights = [...new Set([Math.round((start.y - 0.5) * 2) / 2 + 1 + EPSILON, Math.round(start.y - 0.5) + 1.5 + EPSILON])];
      for (const candidateY of candidateHeights) {
        const candidate = { ...start, y: candidateY };
        if (candidate.y - start.y > 1.05 || collides(blocks, candidate, cabin, height)) continue;
        slide(blocks, candidate, 'x', x, cabin, height);
        slide(blocks, candidate, 'z', z, cabin, height);
        slide(blocks, candidate, 'y', -0.15, cabin, height);
        if (collides(blocks, candidate, cabin, height) || !onGround(blocks, candidate, cabin, height)) continue;
        Object.assign(position, candidate);
        climbed = true;
        stepped = true;
        grounded = true;
        break;
      }
    }

    if (!climbed) {
      const verticalHit = slide(blocks, position, 'y', y, cabin, height);
      if (verticalHit && y < 0) grounded = true;
      if (verticalHit && y > 0) hitCeiling = true;
    }
  }

  return { grounded: grounded || (movement.y <= 0 && onGround(blocks, position, cabin, height)), hitCeiling, stepped };
}
