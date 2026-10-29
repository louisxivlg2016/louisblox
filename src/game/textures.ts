import { BoxGeometry, CanvasTexture, LinearFilter, MeshBasicMaterial, MeshLambertMaterial, NearestFilter, SRGBColorSpace } from 'three';
import type { Material } from 'three';
import { BlockKind } from './voxel';
import { EXTRA_BLOCK_META, isSapling } from './extraBlocks';
import type { ExtraBlockKind } from './extraBlocks';

function random(x: number, y: number, seed: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

export function texture(kind: BlockKind, face: 'side' | 'top' | 'bottom') {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d')!;

  const palettes: Record<number, string[]> = {
    [BlockKind.Grass]: ['#5d983d', '#69a947', '#76b653', '#4f8a36', '#83b95b'],
    [BlockKind.Dirt]: ['#805536', '#8f6240', '#765033', '#9b6c47', '#6e472e'],
    [BlockKind.Stone]: ['#7e7e7e', '#8c8c8c', '#747474', '#969696', '#696969'],
    [BlockKind.Sand]: ['#d8c785', '#e2d393', '#cdbc7c', '#eadb9e', '#d3c182'],
    [BlockKind.Wood]: ['#805b35', '#916a3d', '#75502f', '#9d7444', '#68472b'],
    [BlockKind.Leaves]: ['#397636', '#438541', '#4b9046', '#326a30', '#559a4d'],
    [BlockKind.PineLeaves]: ['#244c38', '#2d5b40', '#35684a', '#1f4232', '#3b7250'],
    [BlockKind.Snow]: ['#f3f7f8', '#e5eef2', '#ffffff', '#d9e5eb', '#edf3f5'],
    [BlockKind.Cactus]: ['#397443', '#43844c', '#32683b', '#4c9055', '#2d6037'],
    [BlockKind.Apple]: ['#b92f2b', '#cf3c32', '#dc4a3d', '#a92725', '#e35648'],
    [BlockKind.AutumnLeaves]: ['#bd5729', '#d8752f', '#e68c36', '#a84824', '#ef9f45'],
    [BlockKind.AutumnGrass]: ['#b69443', '#c8a44e', '#d4b65d', '#a98a3b', '#dec474'],
    [BlockKind.ForestGrass]: ['#315e30', '#386c36', '#427a3d', '#2b522a', '#4a8544'],
    [BlockKind.CoalOre]: ['#7e7e7e', '#8c8c8c', '#747474', '#969696', '#696969'],
    [BlockKind.IronOre]: ['#7e7e7e', '#8c8c8c', '#747474', '#969696', '#696969'],
    [BlockKind.GoldOre]: ['#7e7e7e', '#8c8c8c', '#747474', '#969696', '#696969'],
    [BlockKind.DiamondOre]: ['#7e7e7e', '#8c8c8c', '#747474', '#969696', '#696969'],
    [BlockKind.Bedrock]: ['#292929', '#383838', '#454545', '#202020', '#505050'],
    [BlockKind.Ice]: ['#287fc4', '#3599dc', '#4caceb', '#226db1', '#69c2f2'],
    [BlockKind.Tnt]: ['#b52e29', '#c93d32', '#a92522', '#dc4b3c', '#93201e'],
    [BlockKind.Candle]: ['#e6c877', '#f2d68a', '#d9b965', '#ffe6a0', '#cfa954'],
    [BlockKind.Water]: ['#2c8bc4', '#3b9bd5', '#55b5e8', '#2578b0', '#6ac6ef'],
  };

  for (const [kind, meta] of Object.entries(EXTRA_BLOCK_META)) palettes[Number(kind) as BlockKind] = meta.palette;
  const grassy = kind === BlockKind.Grass || kind === BlockKind.AutumnGrass || kind === BlockKind.ForestGrass;
  const foliage = kind === BlockKind.Leaves || kind === BlockKind.PineLeaves || kind === BlockKind.AutumnLeaves;
  const sapling = isSapling(kind);
  let palette = palettes[kind];
  if (grassy && face !== 'top') palette = palettes[BlockKind.Dirt];

  for (let x = 0; x < 16; x += 1) {
    for (let y = 0; y < 16; y += 1) {
      const value = random(x, y, kind * 17 + face.length);
      if ((foliage || sapling) && value < 0.09) continue;
      context.fillStyle = palette[Math.floor(value * palette.length)];
      context.fillRect(x, y, 1, 1);
    }
  }

  if (grassy && face === 'side') {
    for (let x = 0; x < 16; x += 1) {
      const depth = 3 + Math.floor(random(x, 2, 93) * 3);
      for (let y = 0; y < depth; y += 1) {
        context.fillStyle = palettes[kind][Math.floor(random(x, y, 27) * 5)];
        context.fillRect(x, y, 1, 1);
      }
    }
  }

  if (kind === BlockKind.BeigeBrick || kind === BlockKind.WhiteBrick || kind === BlockKind.GrayBrick) {
    paintBricks(context, kind);
  }

  if (kind === BlockKind.OakPlanks || kind === BlockKind.PinePlanks || kind === BlockKind.AutumnPlanks) {
    paintPlanks(context, kind);
  }

  if (kind === BlockKind.Glass) {
    context.clearRect(0, 0, 16, 16);
    context.fillStyle = 'rgba(160, 215, 235, 0.12)';
    context.fillRect(0, 0, 16, 16);
    context.fillStyle = 'rgba(225, 250, 255, 0.72)';
    context.fillRect(0, 0, 16, 1);
    context.fillRect(0, 15, 16, 1);
    context.fillRect(0, 0, 1, 16);
    context.fillRect(15, 0, 1, 16);
    for (let index = 3; index < 10; index += 1) context.fillRect(index, index - 1, 1, 1);
  }

  if (kind === BlockKind.Apple) {
    context.fillStyle = '#654126';
    context.fillRect(7, 0, 2, 4);
    context.fillStyle = 'rgba(255, 255, 255, 0.38)';
    context.fillRect(3, 4, 2, 3);
  }

  const oreColor = kind === BlockKind.CoalOre ? '#252525'
    : kind === BlockKind.IronOre ? '#b88b6a'
      : kind === BlockKind.GoldOre ? '#e3bd32'
        : kind === BlockKind.DiamondOre ? '#45c8cf' : null;
  if (oreColor) {
    context.fillStyle = oreColor;
    for (let index = 0; index < 12; index += 1) {
      const x = Math.floor(random(index, kind, 31) * 14);
      const y = Math.floor(random(index, kind, 47) * 14);
      context.fillRect(x, y, 2, 2);
    }
  }

  if ((kind === BlockKind.Wood || kind === BlockKind.Cactus) && face === 'side') {
    for (let x = 1; x < 16; x += 4) {
      context.fillStyle = kind === BlockKind.Wood ? 'rgba(63, 39, 22, 0.32)' : 'rgba(18, 66, 30, 0.38)';
      context.fillRect(x, 0, 1, 16);
    }
  }

  if (kind === BlockKind.Wood && face !== 'side') {
    const rings = ['#684824', '#b18b54', '#92703f'];
    for (let x = 0; x < 16; x += 1) {
      for (let y = 0; y < 16; y += 1) {
        const distance = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        context.fillStyle = rings[Math.floor(distance) % rings.length];
        if (random(x, y, 112) > 0.86) context.fillStyle = '#c09a61';
        context.fillRect(x, y, 1, 1);
      }
    }
  }

  const map = new CanvasTexture(canvas);
  map.magFilter = NearestFilter;
  map.minFilter = NearestFilter;
  map.generateMipmaps = false;
  map.colorSpace = SRGBColorSpace;
  return map;
}

function paintPlanks(context: CanvasRenderingContext2D, kind: BlockKind) {
  const styles: Record<number, { boards: string[]; seam: string; dark: string; light: string }> = {
    [BlockKind.OakPlanks]: { boards: ['#ad874f', '#b58e55', '#a47b45', '#bd955c'], seam: '#654728', dark: '#89653a', light: '#c5a066' },
    [BlockKind.PinePlanks]: { boards: ['#725136', '#7c5839', '#69492f', '#896441'], seam: '#3f2c1e', dark: '#543b27', light: '#9c744b' },
    [BlockKind.AutumnPlanks]: { boards: ['#a66c3d', '#b07540', '#976033', '#b98048'], seam: '#5b3924', dark: '#7d4e2d', light: '#c88d52' },
  };
  const style = styles[kind];
  context.clearRect(0, 0, 16, 16);
  for (let row = 0; row < 4; row += 1) {
    const joint = row % 2 === 0 ? 8 : 4;
    const boards = [[0, joint - 1], [joint + 1, 15]];
    boards.forEach(([start, end], index) => {
      context.fillStyle = style.boards[(row + index) % style.boards.length];
      context.fillRect(start, row * 4, end - start + 1, 4);
      for (let line = 0; line < 3; line += 1) {
        const width = Math.min(end - start, 2 + Math.floor(random(row, start + line, kind) * 3));
        const x = start + 1 + Math.floor(random(start + line, row, kind + 13) * Math.max(1, end - start - width));
        const y = row * 4 + 1 + (line % 2);
        context.fillStyle = line === 1 ? style.light : style.dark;
        context.fillRect(x, y, width, 1);
      }
    });
    context.fillStyle = style.seam;
    context.fillRect(joint, row * 4, 1, 4);
  }
  context.fillStyle = style.seam;
  for (const y of [0, 4, 8, 12, 15]) context.fillRect(0, y, 16, 1);
}

function paintBricks(context: CanvasRenderingContext2D, kind: BlockKind) {
  const styles: Record<number, { base: string; alternate: string; mortar: string }> = {
    [BlockKind.WhiteBrick]: { base: '#dedecd', alternate: '#d6d7c4', mortar: '#919487' },
    [BlockKind.BeigeBrick]: { base: '#c5b183', alternate: '#bda879', mortar: '#82704f' },
    [BlockKind.GrayBrick]: { base: '#85888a', alternate: '#7c8083', mortar: '#45494d' },
  };
  const style = styles[kind];
  const size = context.canvas.width;
  const mortar = Math.max(1, Math.round(size / 32));
  const pattern = document.createElement('canvas');
  pattern.width = size;
  pattern.height = size;
  const brush = pattern.getContext('2d')!;
  for (let row = 0; row < 2; row += 1) {
    const joint = row === 0 ? size / 2 : size / 4;
    brush.fillStyle = style.base;
    brush.fillRect(0, row * size / 2, size, size / 2);
    brush.fillStyle = style.alternate;
    brush.fillRect(joint + mortar, row * size / 2, size - joint - mortar, size / 2);
    brush.fillStyle = style.mortar;
    brush.fillRect(joint, row * size / 2, mortar, size / 2);
    brush.fillRect(0, row * size / 2, size, mortar);
  }
  brush.fillRect(0, size - mortar, size, mortar);
  context.clearRect(0, 0, size, size);
  context.save();
  context.translate(size / 2, size / 2);
  context.rotate(Math.PI / 2);
  context.drawImage(pattern, -size / 2, -size / 2);
  context.restore();
}

const brickTextures = new Map<BlockKind, CanvasTexture>();

export function brickTexture(kind: BlockKind) {
  let map = brickTextures.get(kind);
  if (!map) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    paintBricks(canvas.getContext('2d')!, kind);
    map = new CanvasTexture(canvas);
    map.magFilter = LinearFilter;
    map.minFilter = LinearFilter;
    map.colorSpace = SRGBColorSpace;
    brickTextures.set(kind, map);
  }
  return map;
}

function material(kind: BlockKind, face: 'side' | 'top' | 'bottom') {
  if (kind === BlockKind.BeigeBrick || kind === BlockKind.WhiteBrick) {
    return new MeshBasicMaterial({ map: brickTexture(kind) });
  }
  if (kind === BlockKind.GrayBrick) {
    return new MeshLambertMaterial({ map: brickTexture(kind) });
  }
  if (kind >= BlockKind.ConcreteWhite && kind <= BlockKind.ConcreteBlack) {
    return new MeshLambertMaterial({ color: EXTRA_BLOCK_META[kind as ExtraBlockKind].color });
  }
  const foliage = kind === BlockKind.Leaves || kind === BlockKind.PineLeaves || kind === BlockKind.AutumnLeaves;
  const glass = kind === BlockKind.Glass;
  return new MeshLambertMaterial({
    map: texture(kind, face),
    alphaTest: foliage || isSapling(kind) ? 0.35 : glass ? 0.05 : 0,
    transparent: glass || kind === BlockKind.Water,
    opacity: glass ? 0.7 : kind === BlockKind.Water ? 0.55 : 1,
    depthWrite: !(glass || kind === BlockKind.Water),
  });
}

function repeated(value: Material) {
  return [value, value, value, value, value, value];
}

const dirt = material(BlockKind.Dirt, 'side');
const grassSide = material(BlockKind.Grass, 'side');
const grassTop = material(BlockKind.Grass, 'top');
const autumnGrassSide = material(BlockKind.AutumnGrass, 'side');
const autumnGrassTop = material(BlockKind.AutumnGrass, 'top');
const forestGrassSide = material(BlockKind.ForestGrass, 'side');
const forestGrassTop = material(BlockKind.ForestGrass, 'top');
const woodSide = material(BlockKind.Wood, 'side');
const woodTop = material(BlockKind.Wood, 'top');

const baseBlockMaterials = {
  [BlockKind.Grass]: [grassSide, grassSide, grassTop, dirt, grassSide, grassSide],
  [BlockKind.Dirt]: repeated(dirt),
  [BlockKind.Stone]: repeated(material(BlockKind.Stone, 'side')),
  [BlockKind.Sand]: repeated(material(BlockKind.Sand, 'side')),
  [BlockKind.Wood]: [woodSide, woodSide, woodTop, woodTop, woodSide, woodSide],
  [BlockKind.Leaves]: repeated(material(BlockKind.Leaves, 'side')),
  [BlockKind.PineLeaves]: repeated(material(BlockKind.PineLeaves, 'side')),
  [BlockKind.Snow]: repeated(material(BlockKind.Snow, 'side')),
  [BlockKind.Cactus]: repeated(material(BlockKind.Cactus, 'side')),
  [BlockKind.Apple]: repeated(material(BlockKind.Apple, 'side')),
  [BlockKind.AutumnLeaves]: repeated(material(BlockKind.AutumnLeaves, 'side')),
  [BlockKind.AutumnGrass]: [autumnGrassSide, autumnGrassSide, autumnGrassTop, dirt, autumnGrassSide, autumnGrassSide],
  [BlockKind.ForestGrass]: [forestGrassSide, forestGrassSide, forestGrassTop, dirt, forestGrassSide, forestGrassSide],
  [BlockKind.CoalOre]: repeated(material(BlockKind.CoalOre, 'side')),
  [BlockKind.IronOre]: repeated(material(BlockKind.IronOre, 'side')),
  [BlockKind.GoldOre]: repeated(material(BlockKind.GoldOre, 'side')),
  [BlockKind.DiamondOre]: repeated(material(BlockKind.DiamondOre, 'side')),
  [BlockKind.Bedrock]: repeated(material(BlockKind.Bedrock, 'side')),
  [BlockKind.Ice]: repeated(material(BlockKind.Ice, 'side')),
  [BlockKind.Tnt]: repeated(material(BlockKind.Tnt, 'side')),
  [BlockKind.Candle]: repeated(material(BlockKind.Candle, 'side')),
  [BlockKind.Water]: repeated(material(BlockKind.Water, 'side')),
};

export const blockMaterials = {
  ...baseBlockMaterials,
  ...Object.fromEntries(Object.keys(EXTRA_BLOCK_META).map((kind) => [kind, repeated(material(Number(kind) as BlockKind, 'side'))])),
} as unknown as Record<BlockKind, Material[]>;

export const blockGeometry = new BoxGeometry(1, 1, 1);
