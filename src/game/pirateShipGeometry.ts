import { BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';

export const PIRATE_CHEST_OFFSETS = [[-1, 0, -2], [1, 0, -2], [-1, 0, 0], [1, 0, 0], [-1, 0, 2], [1, 0, 2]] as const;

export function addPirateShip(blocks: Voxel[], center: number, team: 'red' | 'blue') {
  const ship = new Map<string, Voxel>();
  const put = (x: number, y: number, z: number, kind: BlockKind, facing?: Voxel['facing']) => {
    ship.set(voxelKey(x, y, z), { x, y, z, kind, facing });
  };
  const teamColor = team === 'red' ? BlockKind.ConcreteRed : BlockKind.ConcreteBlue;
  const widthAt = (z: number) => Math.max(2, 6 - Math.floor(Math.max(0, Math.abs(z) - 10) * 0.6));

  for (let z = -16; z <= 16; z++) {
    const deckWidth = widthAt(z);
    for (let y = 4; y <= 8; y++) {
      const width = Math.max(1, deckWidth - Math.max(0, 7 - y));
      for (let x = -width; x <= width; x++) {
        if (Math.abs(x) === width || y === 4 || Math.abs(z) === 16) put(center + x, y, z, BlockKind.Wood);
      }
    }
    for (let x = -deckWidth; x <= deckWidth; x++) {
      if ((x !== 0 || z !== 0) && !(x === 2 && z >= 1 && z <= 4)) put(center + x, 9, z, BlockKind.OakPlanks);
    }
    if (Math.abs(z) < 16) {
      for (const side of [-1, 1]) {
        put(center + side * deckWidth, 10, z, BlockKind.Wood);
        if (z % 3 === 0) put(center + side * deckWidth, 11, z, teamColor);
      }
    }
  }

  for (let x = -2; x <= 2; x++) put(center + x, 10, 16, BlockKind.Wood);

  for (let z = -20; z <= -17; z++) put(center, 9 + Math.floor((z + 20) / 2), z, BlockKind.Wood);
  put(center, 10, -18, BlockKind.GoldOre);

  for (let x = -4; x <= 4; x++) {
    for (let z = 8; z <= 13; z++) {
      put(center + x, 12, z, BlockKind.OakPlanks);
      for (let y = 10; y <= 12; y++) {
        const wall = Math.abs(x) === 4 || z === 13;
        const doorway = z === 8 && x === 0 && y <= 11;
        if (wall && !doorway) put(center + x, y, z, y === 11 && Math.abs(x) === 4 && z % 3 === 0 ? BlockKind.Glass : BlockKind.Wood);
      }
    }
  }
  for (let x = -4; x <= 4; x++) for (let z = 8; z <= 13; z++) put(center + x, 13, z, BlockKind.PinePlanks);
  for (let x = -4; x <= 4; x++) {
    for (let z = 8; z <= 13; z++) {
      if (Math.abs(x) > 1) put(center + x, 14, z, BlockKind.PinePlanks);
    }
  }
  for (let step = 0; step < 4; step++) {
    for (let x = -1; x <= 1; x++) {
      for (let y = 9; y <= 10 + step; y++) put(center + x, y, 5 + step, BlockKind.OakPlanks);
    }
  }
  for (let step = 0; step < 3; step++) {
    for (let x = -1; x <= 1; x++) {
      for (let y = 9; y <= 10 + step; y++) put(center + x, y, -10 - step, BlockKind.OakPlanks);
    }
  }
  for (let z = -16; z <= -13; z++) {
    const width = widthAt(z);
    for (let x = -width; x <= width; x++) put(center + x, 12, z, BlockKind.OakPlanks);
  }

  for (let y = 5; y <= 9; y++) put(center, y, 0, BlockKind.Ladder, 'south');
  for (let step = 0; step < 5; step++) {
    for (let y = 5; y <= 5 + step; y++) put(center + 2, y, 4 - step, BlockKind.OakPlanks);
  }
  for (let step = 0; step < 5; step++) {
    for (const side of [-1, 1]) for (let y = 9; y <= 10 + step; y++) put(center + side * 2, y, -5 + step, BlockKind.OakPlanks);
  }
  for (const side of [-1, 1]) {
    for (const z of [-5, 5]) put(center + side, 5, z, BlockKind.OakPlanks);
    for (const z of [-6, 0, 6]) {
      put(center + side * 6, 10, z, BlockKind.ConcreteBlack);
    }
    put(center + side * 3, 13, 11, BlockKind.Candle);
  }

  const mast = (z: number, top: number) => {
    for (let y = 10; y <= top; y++) put(center, y, z, BlockKind.Wood);
    for (let y = 10; y <= top - 2; y++) {
      put(center - 1, y, z, BlockKind.Ladder, 'west');
      put(center + 1, y, z, BlockKind.Ladder, 'east');
    }
    for (let x = -2; x <= 2; x++) put(center + x, top + 1, z, x === 0 ? teamColor : BlockKind.ConcreteBlack);
    put(center, top + 2, z, teamColor);
  };
  const sail = (z: number, bottom: number, height: number, width: number, skull: boolean) => {
    const top = bottom + height;
    for (let x = -width - 1; x <= width + 1; x++) {
      if (z !== 0 || Math.abs(x) > 1) put(center + x, top + 1, z, BlockKind.Wood);
    }
    for (let x = -width; x <= width; x++) {
      if (z === 0 && Math.abs(x) <= 1) continue;
      const bulge = Math.round((1 - Math.abs(x) / (width + 1)) * 1.4);
      for (let y = bottom; y <= top; y++) {
        const skullPixel = skull && ((y === bottom + 4 && Math.abs(x) <= 2) || (y === bottom + 3 && Math.abs(x) <= 2) || (y === bottom + 2 && Math.abs(x) === 1) || (y === bottom + 1 && (x === -2 || x === 0 || x === 2)));
        const eyeHole = skull && y === bottom + 3 && Math.abs(x) === 1;
        const border = Math.abs(x) === width || y === bottom || y === top;
        put(center + x, y, z + bulge, skullPixel && !eyeHole ? BlockKind.ConcreteBlack : border || y === bottom + 1 ? teamColor : BlockKind.ConcreteWhite);
      }
    }
  };

  mast(-8, 22);
  sail(-8, 14, 6, 4, false);
  mast(0, 30);
  sail(0, 23, 5, 5, false);
  sail(0, 14, 6, 5, true);
  mast(15, 23);
  sail(15, 14, 6, 4, false);
  for (const side of [-1, 1]) put(center + side * 2, 14, 0, BlockKind.OakPlanks);

  for (const [dx, dy, dz] of PIRATE_CHEST_OFFSETS) put(center + dx, 7 + dy, dz, BlockKind.Chest, 'south');

  const first = blocks[0];
  if (!first) return;
  const merged = new Map(blocks.map((block) => [voxelKey(block.x, block.y, block.z), block]));
  for (const block of ship.values()) {
    if (block.x < first.x || block.x > first.x + 15 || block.z < first.z || block.z > first.z + 15) continue;
    merged.set(voxelKey(block.x, block.y, block.z), block);
  }
  blocks.splice(0, blocks.length, ...merged.values());
}
