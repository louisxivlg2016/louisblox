import { BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, MeshBasicMaterial, MeshLambertMaterial, NearestFilter, SRGBColorSpace } from 'three';
import type { Material } from 'three';
import { texture } from './textures';
import { EXTRA_BLOCK_META, isCrop, isDoor, isSapling, isTrapdoor, isUtilityBlock } from './extraBlocks';
import type { ExtraBlockKind } from './extraBlocks';
import { BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';

const TILE_SIZE = 16;
const ATLAS_COLUMNS = 16;
const WHITE_TILE = 'white';
const tileIndices = new Map<string, number>();
let atlas: CanvasTexture | null = null;
let materials: Record<string, Material> | null = null;

const faces = [
  { direction: [1, 0, 0], corners: [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]] },
  { direction: [-1, 0, 0], corners: [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5]] },
  { direction: [0, 1, 0], corners: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
  { direction: [0, -1, 0], corners: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
  { direction: [0, 0, 1], corners: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
  { direction: [0, 0, -1], corners: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
] as const;

type GeometryGroup = {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
};

function createAtlas() {
  if (atlas) return atlas;
  const kinds = Object.values(BlockKind);
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLUMNS * TILE_SIZE;
  canvas.height = Math.ceil((kinds.length * 3 + 1) / ATLAS_COLUMNS) * TILE_SIZE;
  const context = canvas.getContext('2d')!;
  let index = 0;
  for (const kind of kinds) {
    for (const face of ['side', 'top', 'bottom'] as const) {
      tileIndices.set(`${kind}:${face}`, index);
      context.drawImage(texture(kind, face).image, (index % ATLAS_COLUMNS) * TILE_SIZE, Math.floor(index / ATLAS_COLUMNS) * TILE_SIZE);
      index += 1;
    }
  }
  tileIndices.set(WHITE_TILE, index);
  context.fillStyle = '#ffffff';
  context.fillRect((index % ATLAS_COLUMNS) * TILE_SIZE, Math.floor(index / ATLAS_COLUMNS) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  atlas = new CanvasTexture(canvas);
  atlas.magFilter = NearestFilter;
  atlas.minFilter = NearestFilter;
  atlas.generateMipmaps = false;
  atlas.colorSpace = SRGBColorSpace;
  return atlas;
}

const tileCoordinates = new Map<string, ReturnType<typeof calculateTileUV>>();

function calculateTileUV(key: string) {
  const index = tileIndices.get(key)!;
  const x = (index % ATLAS_COLUMNS) * TILE_SIZE;
  const y = Math.floor(index / ATLAS_COLUMNS) * TILE_SIZE;
  const canvas = createAtlas().image as HTMLCanvasElement;
  return {
    left: x / canvas.width,
    right: (x + TILE_SIZE) / canvas.width,
    top: 1 - y / canvas.height,
    bottom: 1 - (y + TILE_SIZE) / canvas.height,
  };
}

function tileUV(key: string) {
  let coordinates = tileCoordinates.get(key);
  if (!coordinates) {
    coordinates = calculateTileUV(key);
    tileCoordinates.set(key, coordinates);
  }
  return coordinates;
}

function groupFor(kind: BlockKind) {
  if (kind === BlockKind.Water) return 'water';
  if (kind === BlockKind.Glass) return 'glass';
  if (kind === BlockKind.Leaves || kind === BlockKind.PineLeaves || kind === BlockKind.AutumnLeaves) return 'foliage';
  if (kind === BlockKind.WhiteBrick || kind === BlockKind.BeigeBrick) return 'unlit';
  return 'opaque';
}

function usesSeparateModel(kind: BlockKind) {
  return kind === BlockKind.Tnt || kind === BlockKind.Candle || isCrop(kind) || isSapling(kind) || isDoor(kind) || isTrapdoor(kind) || isUtilityBlock(kind);
}

function visibleFace(block: Voxel, neighbor: Voxel | undefined) {
  if (!neighbor || neighbor.open) return true;
  if (usesSeparateModel(neighbor.kind)) return block.kind !== BlockKind.Water && block.kind !== BlockKind.Glass;
  if (block.kind === BlockKind.Water || block.kind === BlockKind.Glass) return neighbor.kind === BlockKind.Water || neighbor.kind === BlockKind.Glass;
  return neighbor.kind === BlockKind.Water || neighbor.kind === BlockKind.Glass;
}

function faceTexture(block: Voxel, direction: readonly number[]) {
  if (block.kind === BlockKind.Grass || block.kind === BlockKind.AutumnGrass || block.kind === BlockKind.ForestGrass) {
    return direction[1] < 0 ? `${BlockKind.Dirt}:side` : direction[1] > 0 ? `${block.kind}:top` : `${block.kind}:side`;
  }
  if (block.kind === BlockKind.Wood) return direction[1] === 0 ? `${BlockKind.Wood}:side` : `${BlockKind.Wood}:top`;
  return `${block.kind}:side`;
}

function addFace(group: GeometryGroup, block: Voxel, face: (typeof faces)[number], uv: ReturnType<typeof tileUV>, color: Color | null) {
  const scale = block.kind === BlockKind.Apple ? 0.35 : 1;
  const offsetY = block.kind === BlockKind.Apple ? -0.28 : 0;
  const base = group.positions.length / 3;
  const tile = block.kind >= BlockKind.ConcreteWhite && block.kind <= BlockKind.ConcreteBlack ? tileUV(WHITE_TILE) : uv;
  const uvCorners = [[tile.left, tile.top], [tile.right, tile.top], [tile.right, tile.bottom], [tile.left, tile.bottom]];
  face.corners.forEach((corner, index) => {
    group.positions.push(block.x + corner[0] * scale, block.y + corner[1] * scale + offsetY, block.z + corner[2] * scale);
    group.normals.push(...face.direction);
    group.uvs.push(...uvCorners[index]);
    if (color) group.colors.push(color.r, color.g, color.b);
    else group.colors.push(1, 1, 1);
  });
  group.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function makeGeometry(group: GeometryGroup) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(group.positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(group.normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(group.uvs, 2));
  geometry.setAttribute('color', new Float32BufferAttribute(group.colors, 3));
  geometry.setIndex(group.indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function getMaterials() {
  if (materials) return materials;
  const map = createAtlas();
  materials = {
    opaque: new MeshLambertMaterial({ map, vertexColors: true }),
    unlit: new MeshBasicMaterial({ map, vertexColors: true }),
    foliage: new MeshLambertMaterial({ map, vertexColors: true, alphaTest: 0.35 }),
    water: new MeshLambertMaterial({ map, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }),
    glass: new MeshLambertMaterial({ map, vertexColors: true, alphaTest: 0.05, transparent: true, opacity: 0.7, depthWrite: false }),
  };
  return materials;
}

export function buildChunkGeometry(blocks: Voxel[], blockIndex: Map<string, Voxel>) {
  createAtlas();
  const groups = new Map<string, GeometryGroup>();
  for (const block of blocks) {
    if (usesSeparateModel(block.kind)) continue;
    const groupName = groupFor(block.kind);
    let group = groups.get(groupName);
    if (!group) {
      group = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
      groups.set(groupName, group);
    }
    const concrete = block.kind >= BlockKind.ConcreteWhite && block.kind <= BlockKind.ConcreteBlack;
    const color = concrete ? new Color(EXTRA_BLOCK_META[block.kind as ExtraBlockKind].color) : null;
    for (const face of faces) {
      const [dx, dy, dz] = face.direction;
      const neighbor = blockIndex.get(voxelKey(block.x + dx, block.y + dy, block.z + dz));
      if (!visibleFace(block, neighbor)) continue;
      addFace(group, block, face, tileUV(faceTexture(block, face.direction)), color);
    }
  }
  const sharedMaterials = getMaterials();
  return [...groups.entries()].map(([name, group]) => ({ geometry: makeGeometry(group), material: sharedMaterials[name] }));
}
