import { BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';

export type ConstructionWriter = (x: number, y: number, z: number, kind: BlockKind, options?: Pick<Voxel, 'facing' | 'growth' | 'text'>) => void;

function silo(put: ConstructionWriter, centerX: number, ground: number, centerZ: number) {
  for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
    const distance = dx * dx + dz * dz;
    if (distance > 6) continue;
    put(centerX + dx, ground + 1, centerZ + dz, BlockKind.Stone);
    if (distance < 3) continue;
    for (let y = ground + 2; y <= ground + 17; y += 1) {
      const band = (y - ground) % 5 === 0;
      const rib = dx === 0 || dz === 0;
      put(centerX + dx, y, centerZ + dz, band || rib ? BlockKind.ConcreteGray : BlockKind.ConcreteLightGray);
    }
    put(centerX + dx, ground + 18, centerZ + dz, BlockKind.ConcreteLightGray);
  }
  for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) put(centerX + dx, ground + 19, centerZ + dz, BlockKind.ConcreteLightGray);
  put(centerX, ground + 20, centerZ, BlockKind.ConcreteWhite);
  put(centerX, ground + 2, centerZ + 2, BlockKind.DoorBrown, { facing: 'north' });
}

export function writeFarm(put: ConstructionWriter, barnX: number, ground: number, barnZ: number, includeField = false) {
  for (let dx = -10; dx <= 24; dx += 1) for (let dz = -8; dz <= 15; dz += 1) put(barnX + dx, ground, barnZ + dz, BlockKind.Dirt);

  const roofHeights = [14, 14, 13, 12, 12, 11, 10, 9, 8];
  for (let dx = -8; dx <= 8; dx += 1) for (let dz = -6; dz <= 6; dz += 1) {
    put(barnX + dx, ground + 1, barnZ + dz, BlockKind.OakPlanks);
    const edge = dx === -8 || dx === 8 || dz === -6 || dz === 6;
    const doorway = dz === 6 && Math.abs(dx) <= 2;
    for (let y = ground + 2; y <= ground + 7; y += 1) {
      if (!edge || doorway && y <= ground + 6) continue;
      const trim = (dx === -8 || dx === 8) && (dz === -6 || dz === 6);
      put(barnX + dx, y, barnZ + dz, trim ? BlockKind.ConcreteWhite : BlockKind.ConcreteRed);
    }
    if (dz === -6 || dz === 6) {
      const roofY = ground + roofHeights[Math.abs(dx)];
      for (let y = ground + 8; y < roofY; y += 1) put(barnX + dx, y, barnZ + dz, BlockKind.ConcreteRed);
    }
  }
  for (let dx = -8; dx <= 8; dx += 1) for (let dz = -7; dz <= 7; dz += 1) {
    const y = ground + roofHeights[Math.abs(dx)];
    put(barnX + dx, y, barnZ + dz, Math.abs(dz) === 7 ? BlockKind.ConcreteWhite : BlockKind.ConcreteBlack);
  }
  for (const side of [-1, 1]) {
    for (const dz of [-3, 3]) put(barnX + side * 8, ground + 4, barnZ + dz, BlockKind.Glass);
    for (let y = ground + 2; y <= ground + 7; y += 1) put(barnX + side * 3, y, barnZ + 6, BlockKind.ConcreteWhite);
  }
  for (let dx = -3; dx <= 3; dx += 1) put(barnX + dx, ground + 7, barnZ + 6, BlockKind.ConcreteWhite);
  put(barnX, ground + 2, barnZ + 6, BlockKind.DoorBrown, { facing: 'north' });
  for (const y of [ground + 10, ground + 11]) {
    put(barnX, y, barnZ + 6, BlockKind.Glass);
    put(barnX - 1, y, barnZ + 6, BlockKind.ConcreteWhite);
    put(barnX + 1, y, barnZ + 6, BlockKind.ConcreteWhite);
  }
  put(barnX, ground + 9, barnZ + 6, BlockKind.ConcreteWhite);
  put(barnX, ground + 12, barnZ + 6, BlockKind.ConcreteWhite);
  for (const side of [-1, 1]) {
    put(barnX + side * 6, ground + 2, barnZ - 4, BlockKind.OakPlanks);
    put(barnX + side * 6, ground + 3, barnZ - 4, BlockKind.OakPlanks);
    put(barnX + side * 4, ground + 2, barnZ - 4, BlockKind.Chest);
  }

  silo(put, barnX + 14, ground, barnZ + 1);
  silo(put, barnX + 20, ground, barnZ + 1);

  const shedX = barnX + 14;
  const shedZ = barnZ + 10;
  for (let dx = -3; dx <= 3; dx += 1) for (let dz = -3; dz <= 3; dz += 1) {
    put(shedX + dx, ground + 1, shedZ + dz, BlockKind.OakPlanks);
    for (let y = ground + 2; y <= ground + 5; y += 1) {
      const edge = dx === -3 || dx === 3 || dz === -3 || dz === 3;
      const doorway = dz === 3 && dx === 0 && y <= ground + 3;
      if (edge && !doorway) put(shedX + dx, y, shedZ + dz, BlockKind.ConcreteRed);
    }
    for (let layer = 0; layer < 4; layer += 1) if (Math.abs(dx) <= 3 - layer) put(shedX + dx, ground + 6 + layer, shedZ + dz, BlockKind.ConcreteBlack);
  }
  put(shedX, ground + 2, shedZ + 3, BlockKind.DoorBrown, { facing: 'north' });
  for (const side of [-1, 1]) put(shedX + side * 3, ground + 3, shedZ, BlockKind.Glass);

  if (!includeField) return;
  const fieldX = barnX + 36;
  const fieldZ = barnZ + 4;
  const crops = [BlockKind.Wheat, BlockKind.Corn, BlockKind.Tomato, BlockKind.Carrot] as const;
  for (let dx = -10; dx <= 10; dx += 1) for (let dz = -8; dz <= 8; dz += 1) {
    const border = Math.abs(dx) === 10 || Math.abs(dz) === 8;
    if (border) {
      if ((dx + dz) % 2 === 0) put(fieldX + dx, ground + 1, fieldZ + dz, BlockKind.OakPlanks);
    } else if (dx % 5 === 0) put(fieldX + dx, ground, fieldZ + dz, BlockKind.CalmWater);
    else {
      put(fieldX + dx, ground, fieldZ + dz, BlockKind.Dirt);
      if (dz % 2 === 0) put(fieldX + dx, ground + 1, fieldZ + dz, crops[Math.floor((dx + 10) / 5) % crops.length], { growth: 3 });
    }
  }
}

export function writeChurch(put: ConstructionWriter, centerX: number, ground: number, centerZ: number) {
  const glass = [BlockKind.GlassBlue, BlockKind.GlassRed, BlockKind.GlassYellow] as const;
  for (let dx = -8; dx <= 8; dx += 1) for (let dz = -13; dz <= 10; dz += 1) put(centerX + dx, ground + 1, centerZ + dz, (dx + dz) % 2 === 0 ? BlockKind.ConcreteLightGray : BlockKind.GrayBrick);

  for (let dz = -13; dz <= 8; dz += 1) for (const side of [-1, 1]) {
    for (let y = ground + 2; y <= ground + 10; y += 1) put(centerX + side * 6, y, centerZ + dz, BlockKind.ConcreteRed);
    for (let y = ground + 2; y <= ground + 6; y += 1) put(centerX + side * 8, y, centerZ + dz, BlockKind.ConcreteRed);
  }
  for (let dx = -6; dx <= 6; dx += 1) for (let y = ground + 2; y <= ground + 10; y += 1) put(centerX + dx, y, centerZ - 13, BlockKind.ConcreteRed);

  for (const [index, dz] of [-10, -6, -2, 2, 6].entries()) {
    for (const side of [-1, 1]) {
      for (let y = ground + 4; y <= ground + 8; y += 1) put(centerX + side * 6, y, centerZ + dz, glass[(index + (side > 0 ? 1 : 0)) % glass.length]);
      put(centerX + side * 6, ground + 9, centerZ + dz, glass[index % glass.length]);
      for (let y = ground + 2; y <= ground + 9; y += 1) put(centerX + side * 9, y, centerZ + dz, y === ground + 9 ? BlockKind.BeigeBrick : BlockKind.ConcreteRed);
      put(centerX + side * 8, ground + 7, centerZ + dz, BlockKind.ConcreteBlack);
      put(centerX + side * 9, ground + 10, centerZ + dz, BlockKind.ConcreteBlack);
    }
  }

  for (let dx = -7; dx <= 7; dx += 1) {
    const roofY = ground + 11 + (7 - Math.abs(dx));
    for (let dz = -14; dz <= 8; dz += 1) put(centerX + dx, roofY, centerZ + dz, BlockKind.ConcreteBlack);
    for (const dz of [-13, 8]) for (let y = ground + 11; y < roofY; y += 1) put(centerX + dx, y, centerZ + dz, BlockKind.ConcreteRed);
  }
  for (const side of [-1, 1]) for (let dz = -13; dz <= 8; dz += 1) {
    put(centerX + side * 7, ground + 10, centerZ + dz, BlockKind.ConcreteBlack);
    put(centerX + side * 8, ground + 8, centerZ + dz, BlockKind.ConcreteBlack);
  }

  for (let dx = -3; dx <= 3; dx += 1) for (let y = ground + 2; y <= ground + 12; y += 1) {
    const doorway = Math.abs(dx) <= 1 && y <= ground + 5;
    if (!doorway) put(centerX + dx, y, centerZ + 10, BlockKind.ConcreteRed);
  }
  for (const side of [-1, 1]) for (let y = ground + 2; y <= ground + 7; y += 1) put(centerX + side * 2, y, centerZ + 10, BlockKind.BeigeBrick);
  for (let dx = -2; dx <= 2; dx += 1) put(centerX + dx, ground + 6, centerZ + 10, BlockKind.BeigeBrick);
  put(centerX, ground + 2, centerZ + 10, BlockKind.DoorBrown, { facing: 'north' });
  for (let dx = -2; dx <= 2; dx += 1) for (let y = ground + 7; y <= ground + 11; y += 1) {
    if (Math.abs(dx) === 2 || y === ground + 7 || y === ground + 11) put(centerX + dx, y, centerZ + 10, BlockKind.BeigeBrick);
  }
  for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
    if (Math.abs(dx) + Math.abs(dy) <= 1) put(centerX + dx, ground + 9 + dy, centerZ + 10, glass[(dx - dy + 3) % glass.length]);
  }
  for (let dz = 11; dz <= 13; dz += 1) for (let dx = -3; dx <= 3; dx += 1) put(centerX + dx, ground + 1, centerZ + dz, BlockKind.GrayBrick);

  for (const towerX of [centerX - 6, centerX + 6]) {
    const towerZ = centerZ + 8;
    for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
      for (let y = ground + 2; y <= ground + 24; y += 1) {
        if (dx !== -2 && dx !== 2 && dz !== -2 && dz !== 2) continue;
        const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
        const band = (y - ground) % 6 === 0;
        put(towerX + dx, y, towerZ + dz, corner || band ? BlockKind.BeigeBrick : BlockKind.ConcreteRed);
      }
    }
    for (const [start, end] of [[6, 9], [14, 17], [20, 22]] as const) {
      for (let y = ground + start; y <= ground + end; y += 1) {
        put(towerX, y, towerZ + 2, BlockKind.GlassBlue);
        put(towerX, y, towerZ - 2, BlockKind.GlassBlue);
        put(towerX - 2, y, towerZ, BlockKind.GlassBlue);
        put(towerX + 2, y, towerZ, BlockKind.GlassBlue);
      }
    }
    for (let layer = 0; layer <= 7; layer += 1) {
      const radius = layer < 2 ? 2 : layer < 6 ? 1 : 0;
      for (let dx = -radius; dx <= radius; dx += 1) for (let dz = -radius; dz <= radius; dz += 1) put(towerX + dx, ground + 25 + layer, towerZ + dz, BlockKind.ConcreteBlack);
    }
    for (let y = ground + 33; y <= ground + 35; y += 1) put(towerX, y, towerZ, BlockKind.GoldOre);
    put(towerX - 1, ground + 34, towerZ, BlockKind.GoldOre);
    put(towerX + 1, ground + 34, towerZ, BlockKind.GoldOre);
  }

  for (const [index, dz] of [-10, -6, -2, 2, 6].entries()) {
    for (const side of [-1, 1]) {
      for (let y = ground + 4; y <= ground + 8; y += 1) {
        put(centerX + side * 6, y, centerZ + dz - 1, BlockKind.BeigeBrick);
        put(centerX + side * 6, y, centerZ + dz + 1, BlockKind.BeigeBrick);
      }
      put(centerX + side * 6, ground + 10, centerZ + dz, BlockKind.BeigeBrick);
      for (let step = 0; step < 4; step += 1) {
        put(centerX + side * (9 + step), ground + 8 - step * 2, centerZ + dz, step === 3 ? BlockKind.GrayBrick : BlockKind.ConcreteRed);
        if (step < 3) put(centerX + side * (9 + step), ground + 9 - step * 2, centerZ + dz, BlockKind.BeigeBrick);
      }
      put(centerX + side * 11, ground + 2, centerZ + dz, BlockKind.GrayBrick);
      if (index % 2 === 0) put(centerX + side * 10, ground + 4, centerZ + dz, BlockKind.BeigeBrick);
    }
  }
  for (const side of [-1, 1]) for (const dz of [-9, -3, 3]) {
    const x = centerX + side * 5;
    put(x, ground + 14, centerZ + dz, BlockKind.GlassBlue);
    put(x, ground + 14, centerZ + dz - 1, BlockKind.ConcreteRed);
    put(x, ground + 14, centerZ + dz + 1, BlockKind.ConcreteRed);
    put(x, ground + 15, centerZ + dz, BlockKind.ConcreteBlack);
    put(x - side, ground + 15, centerZ + dz, BlockKind.ConcreteBlack);
    put(x, ground + 16, centerZ + dz, BlockKind.GoldOre);
  }
  for (const dz of [-12, -6, 0, 6]) {
    put(centerX, ground + 19, centerZ + dz, BlockKind.GrayBrick);
    put(centerX, ground + 20, centerZ + dz, BlockKind.GoldOre);
  }
  for (const side of [-1, 1]) {
    for (let y = ground + 7; y <= ground + 8; y += 1) put(centerX + side * 2, y, centerZ + 10, BlockKind.BeigeBrick);
    put(centerX + side, ground + 8, centerZ + 10, BlockKind.BeigeBrick);
    put(centerX + side, ground + 9, centerZ + 10, BlockKind.BeigeBrick);
  }

  for (const towerX of [centerX - 6, centerX + 6]) {
    const towerZ = centerZ + 8;
    for (const [start, end] of [[6, 9], [14, 17], [20, 22]] as const) {
      for (let y = ground + start; y <= ground + end; y += 1) {
        put(towerX - 1, y, towerZ + 2, BlockKind.BeigeBrick);
        put(towerX + 1, y, towerZ + 2, BlockKind.BeigeBrick);
        put(towerX - 1, y, towerZ - 2, BlockKind.BeigeBrick);
        put(towerX + 1, y, towerZ - 2, BlockKind.BeigeBrick);
        put(towerX - 2, y, towerZ - 1, BlockKind.BeigeBrick);
        put(towerX - 2, y, towerZ + 1, BlockKind.BeigeBrick);
        put(towerX + 2, y, towerZ - 1, BlockKind.BeigeBrick);
        put(towerX + 2, y, towerZ + 1, BlockKind.BeigeBrick);
      }
      put(towerX, ground + end + 1, towerZ + 2, BlockKind.BeigeBrick);
      put(towerX, ground + end + 1, towerZ - 2, BlockKind.BeigeBrick);
      put(towerX - 2, ground + end + 1, towerZ, BlockKind.BeigeBrick);
      put(towerX + 2, ground + end + 1, towerZ, BlockKind.BeigeBrick);
    }
    for (const dx of [-2, 2]) for (const dz of [-2, 2]) {
      for (let y = ground + 25; y <= ground + 27; y += 1) put(towerX + dx, y, towerZ + dz, BlockKind.BeigeBrick);
      put(towerX + dx, ground + 28, towerZ + dz, BlockKind.ConcreteBlack);
      put(towerX + dx, ground + 29, towerZ + dz, BlockKind.GoldOre);
    }
  }

  for (const dz of [-5, -1, 3]) for (const side of [-1, 1]) for (const dx of [2, 3, 4]) put(centerX + side * dx, ground + 2, centerZ + dz, BlockKind.OakPlanks);
  for (let dx = -2; dx <= 2; dx += 1) put(centerX + dx, ground + 2, centerZ - 10, BlockKind.WhiteBrick);
  put(centerX, ground + 3, centerZ - 10, BlockKind.Candle);
  for (const side of [-1, 1]) put(centerX + side * 4, ground + 2, centerZ + 6, BlockKind.Lantern);
}

export function writeVillageChurch(put: ConstructionWriter, centerX: number, ground: number, centerZ: number) {
  const roofHeights = [9, 9, 8, 7, 6];
  for (let dx = -4; dx <= 4; dx += 1) for (let dz = -6; dz <= 6; dz += 1) {
    put(centerX + dx, ground + 1, centerZ + dz, BlockKind.OakPlanks);
    for (let y = ground + 2; y <= ground + 6; y += 1) {
      const edge = dx === -4 || dx === 4 || dz === -6 || dz === 6;
      const doorway = dz === 6 && dx === 0 && y <= ground + 4;
      if (!edge || doorway) continue;
      const trim = Math.abs(dx) === 4 && Math.abs(dz) === 6 || y === ground + 6;
      put(centerX + dx, y, centerZ + dz, trim ? BlockKind.BeigeBrick : BlockKind.ConcreteRed);
    }
    if (dz === -6 || dz === 6) {
      const roofY = ground + roofHeights[Math.abs(dx)];
      for (let y = ground + 7; y < roofY; y += 1) put(centerX + dx, y, centerZ + dz, BlockKind.ConcreteRed);
    }
  }
  for (let dx = -4; dx <= 4; dx += 1) for (let dz = -7; dz <= 7; dz += 1) put(centerX + dx, ground + roofHeights[Math.abs(dx)], centerZ + dz, Math.abs(dz) === 7 ? BlockKind.BeigeBrick : BlockKind.ConcreteBlack);
  put(centerX, ground + 2, centerZ + 6, BlockKind.DoorBrown, { facing: 'north' });
  for (const side of [-1, 1]) {
    for (const dz of [-3, 1]) {
      for (let y = ground + 3; y <= ground + 5; y += 1) put(centerX + side * 4, y, centerZ + dz, dz === -3 ? BlockKind.GlassBlue : BlockKind.GlassYellow);
      put(centerX + side * 4, ground + 6, centerZ + dz, BlockKind.BeigeBrick);
    }
    for (const dz of [-4, 0, 4]) {
      put(centerX + side * 5, ground + 2, centerZ + dz, BlockKind.GrayBrick);
      put(centerX + side * 5, ground + 3, centerZ + dz, BlockKind.ConcreteRed);
      put(centerX + side * 4, ground + 5, centerZ + dz, BlockKind.BeigeBrick);
    }
    for (const dz of [-2, 2]) put(centerX + side * 2, ground + 2, centerZ + dz, BlockKind.OakPlanks);
  }
  put(centerX, ground + 8, centerZ + 6, BlockKind.GlassRed);
  put(centerX - 1, ground + 8, centerZ + 6, BlockKind.BeigeBrick);
  put(centerX + 1, ground + 8, centerZ + 6, BlockKind.BeigeBrick);
  put(centerX, ground + 9, centerZ + 6, BlockKind.BeigeBrick);
  for (let dx = -2; dx <= 2; dx += 1) for (let dz = 7; dz <= 8; dz += 1) put(centerX + dx, ground + 1, centerZ + dz, BlockKind.GrayBrick);
  for (let dx = -1; dx <= 1; dx += 1) put(centerX + dx, ground + 2, centerZ - 4, BlockKind.WhiteBrick);
  put(centerX, ground + 3, centerZ - 4, BlockKind.Candle);

  const towerZ = centerZ + 4;
  for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
    if (dx !== -1 && dx !== 1 && dz !== -1 && dz !== 1) continue;
    for (let y = ground + 7; y <= ground + 14; y += 1) put(centerX + dx, y, towerZ + dz, (y - ground) % 4 === 0 ? BlockKind.BeigeBrick : BlockKind.ConcreteRed);
  }
  for (let y = ground + 10; y <= ground + 12; y += 1) {
    put(centerX, y, towerZ + 1, BlockKind.GlassBlue);
    put(centerX, y, towerZ - 1, BlockKind.GlassBlue);
    put(centerX - 1, y, towerZ, BlockKind.GlassBlue);
    put(centerX + 1, y, towerZ, BlockKind.GlassBlue);
  }
  for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
    put(centerX + dx, ground + 15, towerZ + dz, BlockKind.ConcreteBlack);
    put(centerX + dx, ground + 16, towerZ + dz, BlockKind.ConcreteBlack);
  }
  put(centerX, ground + 17, towerZ, BlockKind.ConcreteBlack);
  put(centerX, ground + 18, towerZ, BlockKind.ConcreteBlack);
  for (let y = ground + 19; y <= ground + 21; y += 1) put(centerX, y, towerZ, BlockKind.GoldOre);
  put(centerX - 1, ground + 20, towerZ, BlockKind.GoldOre);
  put(centerX + 1, ground + 20, towerZ, BlockKind.GoldOre);
}

function ruinDamage(x: number, y: number, z: number) {
  const value = Math.sin(x * 127.1 + y * 269.5 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function writeRuinedChurch(put: ConstructionWriter, centerX: number, ground: number, centerZ: number) {
  const blocks = new Map<string, Voxel>();
  writeChurch((x, y, z, kind, options = {}) => blocks.set(voxelKey(x, y, z), { x, y, z, kind, ...options }), 0, 0, 0);
  for (const block of blocks.values()) {
    const { x, y, z, kind } = block;
    const hole = ((x - 6) / 3) ** 2 + ((z + 2) / 3) ** 2 < 1 && y >= 3;
    const brokenSpire = x >= 4 && z >= 5 && y >= 29 + Math.floor(ruinDamage(x, 0, z) * 3);
    const brokenGlass = ([BlockKind.Glass, BlockKind.GlassBlue, BlockKind.GlassRed, BlockKind.GlassYellow, BlockKind.GlassLightBlue] as BlockKind[]).includes(kind) && ruinDamage(x, y, z) > 0.62;
    const chippedWall = y > 5 && ([BlockKind.ConcreteRed, BlockKind.ConcreteBlack, BlockKind.BeigeBrick] as BlockKind[]).includes(kind) && ruinDamage(x, y, z) > 0.965;
    const brokenBench = kind === BlockKind.OakPlanks && y === 2 && ruinDamage(x, y, z) > 0.7;
    if (hole || brokenSpire || brokenGlass || chippedWall || brokenBench || kind === BlockKind.DoorBrown) continue;
    put(centerX + x, y + ground, centerZ + z, kind, block);
  }
  for (let x = -5; x <= 5; x += 1) for (let z = -11; z <= 7; z += 1) {
    if (ruinDamage(x, 2, z) > 0.6) put(centerX + x, ground + 2, centerZ + z, BlockKind.Grass, { growth: 0 });
  }
  for (let z = -11; z <= 7; z += 1) for (let y = ground + 2; y <= ground + 7; y += 1) {
    if (ruinDamage(-7, y, z) > 0.77) put(centerX - 7, y, centerZ + z, BlockKind.JungleVine);
    if (ruinDamage(9, y, z) > 0.82) put(centerX + 9, y, centerZ + z, BlockKind.JungleVine);
  }
  for (let x = 3; x <= 9; x += 1) for (let z = -5; z <= 2; z += 1) {
    const damage = ruinDamage(x, ground + 2, z);
    if (damage > 0.56) put(centerX + x, ground + 2, centerZ + z, damage > 0.84 ? BlockKind.ConcreteBlack : damage > 0.7 ? BlockKind.ConcreteRed : BlockKind.GrayBrick);
  }
  for (let x = 6; x <= 11; x += 1) for (let z = 10; z <= 13; z += 1) {
    if (ruinDamage(x, ground + 2, z) > 0.58) put(centerX + x, ground + 2, centerZ + z, ruinDamage(x, 4, z) > 0.5 ? BlockKind.ConcreteRed : BlockKind.ConcreteBlack);
  }
}

export function constructionTemplate(kind: 'church' | 'farm') {
  const blocks = new Map<string, Voxel>();
  const put: ConstructionWriter = (x, y, z, blockKind, options = {}) => blocks.set(voxelKey(x, y, z), { x, y, z, kind: blockKind, ...options });
  if (kind === 'church') writeChurch(put, 0, 0, 0);
  else writeFarm(put, 0, 0, 0, true);
  return [...blocks.values()];
}
