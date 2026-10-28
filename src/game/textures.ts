import { BoxGeometry, CanvasTexture, MeshLambertMaterial, NearestFilter, SRGBColorSpace } from 'three';
import type { Material } from 'three';
import { BlockKind } from './voxel';

function random(x: number, y: number, seed: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function texture(kind: BlockKind, face: 'side' | 'top' | 'bottom') {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d')!;

  const palettes: Record<BlockKind, string[]> = {
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
  };

  const grassy = kind === BlockKind.Grass || kind === BlockKind.AutumnGrass || kind === BlockKind.ForestGrass;
  const foliage = kind === BlockKind.Leaves || kind === BlockKind.PineLeaves || kind === BlockKind.AutumnLeaves;
  let palette = palettes[kind];
  if (grassy && face !== 'top') palette = palettes[BlockKind.Dirt];

  for (let x = 0; x < 16; x += 1) {
    for (let y = 0; y < 16; y += 1) {
      const value = random(x, y, kind * 17 + face.length);
      if (foliage && value < 0.09) continue;
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

function material(kind: BlockKind, face: 'side' | 'top' | 'bottom') {
  const foliage = kind === BlockKind.Leaves || kind === BlockKind.PineLeaves || kind === BlockKind.AutumnLeaves;
  return new MeshLambertMaterial({
    map: texture(kind, face),
    alphaTest: foliage ? 0.35 : 0,
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

export const blockMaterials: Record<BlockKind, Material[]> = {
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
};

export const blockGeometry = new BoxGeometry(1, 1, 1);
