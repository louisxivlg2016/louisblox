import { isCrop, isDoor, isLadder, isRail, isTrapdoor } from '../extraBlocks';
import { BlockKind, voxelKey } from '../voxel';
import type { Voxel } from '../voxel';

type Vector = { x: number; y: number; z: number };
type Axis = keyof Vector;

const RADIUS = 0.35;
const HEIGHT = 1.8;
const EPSILON = 0.0001;
const MAX_SUBSTEP = 0.18;

export function isCollidable(block: Voxel | undefined) {
  if (!block || block.kind === BlockKind.Water || isCrop(block.kind) || isLadder(block.kind) || isRail(block.kind)) return false;
  return !(isDoor(block.kind) || isTrapdoor(block.kind)) || !block.open;
}

function collides(blocks: ReadonlyMap<string, Voxel>, position: Vector) {
  const minX = Math.ceil(position.x - RADIUS - 0.5 + EPSILON);
  const maxX = Math.floor(position.x + RADIUS + 0.5 - EPSILON);
  const minY = Math.ceil(position.y - 0.5 + EPSILON);
  const maxY = Math.floor(position.y + HEIGHT + 0.5 - EPSILON);
  const minZ = Math.ceil(position.z - RADIUS - 0.5 + EPSILON);
  const maxZ = Math.floor(position.z + RADIUS + 0.5 - EPSILON);
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        if (isCollidable(blocks.get(voxelKey(x, y, z)))) return true;
      }
    }
  }
  return false;
}

function slide(blocks: ReadonlyMap<string, Voxel>, position: Vector, axis: Axis, amount: number) {
  if (amount === 0) return false;
  const start = position[axis];
  position[axis] = start + amount;
  if (!collides(blocks, position)) return false;
  let safe = 0;
  let blocked = 1;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const middle = (safe + blocked) / 2;
    position[axis] = start + amount * middle;
    if (collides(blocks, position)) blocked = middle;
    else safe = middle;
  }
  position[axis] = start + amount * safe;
  return true;
}

function onGround(blocks: ReadonlyMap<string, Voxel>, position: Vector) {
  return collides(blocks, { ...position, y: position.y - 0.055 });
}

export function moveVoxelCharacter(
  blocks: ReadonlyMap<string, Voxel>,
  position: Vector,
  movement: Vector,
  canStep: boolean,
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
    const hitX = slide(blocks, position, 'x', x);
    const hitZ = slide(blocks, position, 'z', z);
    const horizontalHit = hitX || hitZ;
    let climbed = false;

    if (canStep && y <= 0 && horizontalHit) {
      const candidate = { ...start, y: Math.floor(start.y + 0.5) + 0.5 + EPSILON };
      if (candidate.y - start.y <= 1.05 && !collides(blocks, candidate)) {
        slide(blocks, candidate, 'x', x);
        slide(blocks, candidate, 'z', z);
        slide(blocks, candidate, 'y', -0.15);
        if (!collides(blocks, candidate) && onGround(blocks, candidate)) {
          Object.assign(position, candidate);
          climbed = true;
          stepped = true;
          grounded = true;
        }
      }
    }

    if (!climbed) {
      const verticalHit = slide(blocks, position, 'y', y);
      if (verticalHit && y < 0) grounded = true;
      if (verticalHit && y > 0) hitCeiling = true;
    }
  }

  return { grounded: grounded || (movement.y <= 0 && onGround(blocks, position)), hitCeiling, stepped };
}
