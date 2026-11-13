import { BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';

function wear(x: number, y: number, z: number) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function churchBlocks(centerX: number, centerZ: number, baseY: number, weathered = false): Voxel[] {
  const blocks = new Map<string, Voxel>();
  const put = (x: number, y: number, z: number, kind: BlockKind, damage = 0, facing?: Voxel['facing']) => {
    if (weathered && damage > 0 && wear(x, y, z) < damage) return;
    blocks.set(voxelKey(x, y, z), { x, y, z, kind, ...(facing ? { facing } : {}) });
  };
  const wall = BlockKind.BeigeBrick;
  const trim = BlockKind.WhiteBrick;
  const roof = BlockKind.PinePlanks;
  const floorY = baseY - 1;

  for (let x = centerX - 11; x <= centerX + 11; x++) {
    for (let z = centerZ - 30; z <= centerZ + 30; z++) {
      if (weathered) for (let y = baseY - 12; y < floorY; y++) put(x, y, z, BlockKind.GrayBrick);
      put(x, floorY, z, x === centerX ? BlockKind.WhiteBrick : BlockKind.OakPlanks);
    }
  }

  for (let x = centerX - 11; x <= centerX + 11; x++) {
    for (let z = centerZ - 30; z <= centerZ + 30; z++) {
      if (Math.abs(x - centerX) !== 11 && Math.abs(z - centerZ) !== 30) continue;
      for (let y = baseY; y <= baseY + 8; y++) {
        const doorway = z === centerZ - 30 && Math.abs(x - centerX) <= 1 && y <= baseY + 2;
        if (!doorway) put(x, y, z, y === baseY || y === baseY + 8 ? trim : wall, 0.025);
      }
    }
  }
  put(centerX, baseY, centerZ - 30, BlockKind.DoorBrown, 0, 'south');
  put(centerX, baseY + 2, centerZ - 30, wall);
  for (const side of [-1, 1]) for (let y = baseY; y <= baseY + 2; y++) put(centerX + side, y, centerZ - 30, wall);

  for (const offset of [-24, -18, -12, -6, 0, 6, 12, 18, 24]) {
    for (const side of [-1, 1]) {
      for (let dy = 0; dy < 4; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dy === 3 && dz !== 0) continue;
          const kind = dy === 2 && dz === 0 ? BlockKind.GlassYellow : dz === 0 ? BlockKind.GlassBlue : (offset + dy) % 2 === 0 ? BlockKind.GlassRed : BlockKind.GlassLightBlue;
          put(centerX + side * 11, baseY + 3 + dy, centerZ + offset + dz, kind);
        }
      }
    }
  }

  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      if (Math.abs(dx) + Math.abs(dy) > 2) continue;
      const kind = dx === 0 && dy === 0 ? BlockKind.GlassYellow : (Math.abs(dx) + Math.abs(dy)) % 2 === 0 ? BlockKind.GlassRed : BlockKind.GlassBlue;
      put(centerX + dx, baseY + 5 + dy, centerZ + 30, kind);
    }
  }

  for (const z of [-24, -18, -12, -6, 0, 6, 12, 18, 24]) {
    for (const x of [-8, 8]) {
      put(centerX + x, baseY, centerZ + z, BlockKind.GrayBrick);
      for (let y = baseY + 1; y <= baseY + 8; y++) put(centerX + x, y, centerZ + z, trim);
    }
  }
  for (const z of [-24, -20, -16, -12, -8, -4, 0, 4, 8, 12, 16, 20, 24]) {
    for (const side of [-1, 1]) {
      for (let x = 3; x <= 7; x++) {
        put(centerX + side * x, baseY, centerZ + z, BlockKind.PinePlanks);
        put(centerX + side * x, baseY + 1, centerZ + z - 1, BlockKind.OakPlanks);
      }
    }
  }
  for (let x = centerX - 2; x <= centerX + 2; x++) {
    put(x, baseY, centerZ + 25, trim);
    put(x, baseY + 1, centerZ + 25, trim);
  }
  for (const side of [-1, 1]) put(centerX + side, baseY + 2, centerZ + 25, BlockKind.Candle);
  for (let y = baseY + 3; y <= baseY + 6; y++) put(centerX, y, centerZ + 27, BlockKind.OakPlanks);
  for (const x of [-1, 1]) put(centerX + x, baseY + 5, centerZ + 27, BlockKind.OakPlanks);

  for (let dx = -12; dx <= 12; dx++) {
    const roofY = baseY + 9 + (12 - Math.abs(dx));
    for (let z = centerZ - 31; z <= centerZ + 31; z++) put(centerX + dx, roofY, z, roof, 0.045);
    for (const side of [-1, 1]) {
      for (let y = baseY + 9; y < roofY; y++) put(centerX + dx, y, centerZ + side * 30, wall, 0.025);
    }
  }

  const towerZ = centerZ - 32;
  for (const towerX of [centerX - 8, centerX + 8]) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) !== 2 && Math.abs(dz) !== 2) continue;
        for (let y = baseY; y <= baseY + 18; y++) {
          const belfry = y >= baseY + 15 && y <= baseY + 17 && (dx === 0 || dz === 0);
          const door = dz === -2 && dx === 0 && y <= baseY + 2;
          if (!belfry && !door) put(towerX + dx, y, towerZ + dz, y === baseY + 13 || y === baseY + 18 ? trim : wall);
        }
      }
    }
    put(towerX, baseY, towerZ - 2, BlockKind.DoorBrown, 0, 'south');
    put(towerX, baseY + 2, towerZ - 2, wall);
    for (let y = baseY + 6; y <= baseY + 8; y++) put(towerX, y, towerZ - 2, BlockKind.GlassBlue);
    put(towerX, baseY + 16, towerZ, BlockKind.GoldOre);
    put(towerX, baseY + 17, towerZ, BlockKind.OakPlanks);
    for (let tier = 0; tier < 5; tier++) {
      const radius = 3 - Math.floor(tier / 2);
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) put(towerX + dx, baseY + 19 + tier, towerZ + dz, roof);
      }
    }
    for (let y = baseY + 24; y <= baseY + 27; y++) put(towerX, y, towerZ, BlockKind.OakPlanks);
    for (const side of [-1, 1]) put(towerX + side, baseY + 26, towerZ, BlockKind.OakPlanks);
    for (let z = towerZ - 4; z <= towerZ - 3; z++) {
      for (let x = towerX - 2; x <= towerX + 2; x++) put(x, floorY, z, BlockKind.GrayBrick);
    }
  }
  return [...blocks.values()];
}
