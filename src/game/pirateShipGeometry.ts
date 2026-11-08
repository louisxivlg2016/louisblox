import { BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';

export function addPirateShip(blocks: Voxel[], center: number, team: 'red' | 'blue') {
  const ship = new Map<string, Voxel>();
  const put = (x: number, y: number, z: number, kind: BlockKind, facing?: Voxel['facing']) => {
    ship.set(voxelKey(x, y, z), { x, y, z, kind, facing });
  };
  const teamColor = team === 'red' ? BlockKind.ConcreteRed : BlockKind.ConcreteBlue;

  for (let z = -12; z <= 12; z += 1) {
    const taper = Math.max(0, Math.abs(z) - 7);
    const deckWidth = Math.max(1, 5 - Math.floor(taper * 0.7));
    for (let y = 4; y <= 8; y += 1) {
      const width = Math.max(0, deckWidth - (8 - y));
      for (let x = -width; x <= width; x += 1) {
        const shell = Math.abs(x) === width || y === 4 || y === 8 || Math.abs(z) === 12;
        if (!shell) continue;
        put(center + x, y, z, y === 8 ? BlockKind.OakPlanks : BlockKind.Wood);
      }
    }
    if (Math.abs(z) < 11) {
      for (const side of [-1, 1]) {
        put(center + side * deckWidth, 9, z, BlockKind.Wood);
        if (z % 2 === 0) put(center + side * deckWidth, 10, z, BlockKind.OakPlanks);
      }
    }
  }

  for (const side of [-1, 1]) {
    put(center + side * 5, 7, 0, BlockKind.OakPlanks);
    put(center + side * 6, 7, 0, BlockKind.OakPlanks);
    put(center + side * 7, 6, 0, BlockKind.OakPlanks);
    put(center + side * 8, 5, 0, BlockKind.OakPlanks);
  }

  for (let x = -3; x <= 3; x += 1) {
    for (let z = 6; z <= 10; z += 1) {
      put(center + x, 11, z, BlockKind.OakPlanks);
      for (let y = 9; y <= 10; y += 1) {
        const wall = Math.abs(x) === 3 || z === 10;
        const doorway = z === 6 && x === 0 && y <= 10;
        if (wall && !doorway) put(center + x, y, z, y === 10 && Math.abs(x) === 3 && z % 3 === 0 ? BlockKind.Glass : BlockKind.Wood);
      }
      if (Math.abs(x) === 3 || z === 10) put(center + x, 12, z, BlockKind.Wood);
    }
  }
  for (let x = -2; x <= 2; x += 1) {
    for (let z = -11; z <= -8; z += 1) put(center + x, 9, z, BlockKind.OakPlanks);
  }
  for (let z = -16; z <= -12; z += 1) put(center, 9 + Math.floor((z + 16) / 3), z, BlockKind.Wood);

  const mast = (z: number, top: number) => {
    for (let y = 9; y <= top; y += 1) put(center, y, z, BlockKind.Wood);
    put(center - 1, top - 1, z, BlockKind.OakPlanks);
    put(center + 1, top - 1, z, BlockKind.OakPlanks);
    put(center, top - 1, z - 1, BlockKind.OakPlanks);
    put(center, top - 1, z + 1, BlockKind.OakPlanks);
    for (let x = -2; x <= 2; x += 1) {
      put(center + x, top + 1, z, BlockKind.ConcreteBlack);
      if (Math.abs(x) <= 1) put(center + x, top + 2, z, x === 0 ? BlockKind.ConcreteWhite : teamColor);
    }
  };
  const sail = (z: number, bottom: number, height: number, width: number, skull: boolean) => {
    const top = bottom + height;
    for (let x = -width - 1; x <= width + 1; x += 1) put(center + x, top + 1, z, BlockKind.Wood);
    for (let x = -width; x <= width; x += 1) {
      const bulge = Math.round((1 - Math.abs(x) / (width + 1)) * 1.4);
      for (let y = bottom; y <= top; y += 1) {
        const skullPixel = skull && (
          (y === bottom + 4 && Math.abs(x) <= 2)
          || (y === bottom + 3 && Math.abs(x) <= 2)
          || (y === bottom + 2 && Math.abs(x) === 1)
          || (y === bottom + 1 && (x === -2 || x === 0 || x === 2))
        );
        const eyeHole = skull && y === bottom + 3 && Math.abs(x) === 1;
        const border = Math.abs(x) === width || y === bottom || y === top;
        put(center + x, y, z + bulge, skullPixel && !eyeHole ? BlockKind.ConcreteBlack : border || y === bottom + 1 ? teamColor : BlockKind.ConcreteWhite);
      }
    }
  };

  mast(-6, 18);
  sail(-6, 11, 5, 3, false);
  mast(0, 23);
  sail(0, 16, 4, 4, false);
  sail(0, 10, 5, 4, true);
  mast(8, 20);
  sail(8, 12, 5, 3, false);

  for (const side of [-1, 1]) {
    for (const z of [-5, 0, 5]) {
      put(center + side * 4, 9, z, BlockKind.Furnace, side === -1 ? 'west' : 'east');
      put(center + side * 5, 7, z, BlockKind.ConcreteBlack);
    }
    for (let y = 9; y <= 16; y += 1) {
      const z = Math.round(2 + (y - 9) * 0.55);
      put(center + side * 2, y, z, BlockKind.Ladder, side === -1 ? 'west' : 'east');
    }
    put(center + side * 3, 12, 9, BlockKind.Candle);
    put(center + side * 2, 6, -11, BlockKind.ConcreteWhite);
    put(center + side * 2, 7, -11, BlockKind.ConcreteWhite);
  }
  for (let z = 5; z <= 10; z += 1) put(center + 3, 9, z, BlockKind.OakPlanks);
  for (let x = -2; x <= 2; x += 1) put(center + x, 6, 0, BlockKind.OakPlanks);
  for (const side of [-1, 1]) {
    put(center + side, 5, -5, BlockKind.OakPlanks);
    put(center + side, 5, 5, BlockKind.OakPlanks);
  }
  put(center, 7, 0, BlockKind.Chest);
  put(center + 3, 9, 3, BlockKind.GoldOre);

  const first = blocks[0];
  if (!first) return;
  const merged = new Map(blocks.map((block) => [voxelKey(block.x, block.y, block.z), block]));
  for (const block of ship.values()) {
    if (block.x < first.x || block.x > first.x + 15 || block.z < first.z || block.z > first.z + 15) continue;
    merged.set(voxelKey(block.x, block.y, block.z), block);
  }
  blocks.splice(0, blocks.length, ...merged.values());
}
