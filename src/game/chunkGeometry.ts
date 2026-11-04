import { BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, MeshBasicMaterial, MeshLambertMaterial, NearestFilter, SRGBColorSpace } from 'three';
import type { Material } from 'three';
import { brickTexture, texture } from './textures';
import { EXTRA_BLOCK_META, isCrop, isDoor, isGlass, isSapling, isSign, isTrapdoor, isUtilityBlock } from './extraBlocks';
import { getVitrailDesign, getVitrailTexture } from './vitrailDesigns';
import type { ExtraBlockKind } from './extraBlocks';
import { BlockKind, isWaterBlock, voxelKey } from './voxel';
import type { Voxel } from './voxel';

const TILE_SIZE = 16;
const ATLAS_COLUMNS = 16;
const WHITE_TILE = 'white';
const tileIndices = new Map<string, number>();
const glassDesignKinds = new Map<string, BlockKind>();
for (const kind of Object.values(BlockKind)) {
  const design = isGlass(kind) ? getVitrailDesign(kind) : undefined;
  if (design) glassDesignKinds.set(design.url, kind);
}
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
      if (!isGlass(kind)) context.drawImage(texture(kind, face).image, (index % ATLAS_COLUMNS) * TILE_SIZE, Math.floor(index / ATLAS_COLUMNS) * TILE_SIZE);
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

// Un cache par combinaison de miroirs (U, V) pour éviter de construire une clé par face.
const tileCoordinates = [0, 1, 2, 3].map(() => new Map<string, ReturnType<typeof calculateTileUV>>());

function calculateTileUV(key: string, mirrorU: boolean, mirrorV: boolean) {
  if (isGlass(Number(key.split(':')[0]) as BlockKind)) {
    return { left: mirrorU ? 1 : 0, right: mirrorU ? 0 : 1, top: mirrorV ? 0 : 1, bottom: mirrorV ? 1 : 0 };
  }
  const index = tileIndices.get(key)!;
  const x = (index % ATLAS_COLUMNS) * TILE_SIZE;
  const y = Math.floor(index / ATLAS_COLUMNS) * TILE_SIZE;
  const canvas = createAtlas().image as HTMLCanvasElement;
  const padding = 0.04;
  return {
    left: (mirrorU ? x + TILE_SIZE - padding : x + padding) / canvas.width,
    right: (mirrorU ? x + padding : x + TILE_SIZE - padding) / canvas.width,
    top: 1 - (mirrorV ? y + TILE_SIZE - padding : y + padding) / canvas.height,
    bottom: 1 - (mirrorV ? y + padding : y + TILE_SIZE - padding) / canvas.height,
  };
}

function tileUV(key: string, mirrorU = false, mirrorV = false) {
  const cache = tileCoordinates[(mirrorU ? 2 : 0) + (mirrorV ? 1 : 0)];
  let coordinates = cache.get(key);
  if (!coordinates) {
    coordinates = calculateTileUV(key, mirrorU, mirrorV);
    cache.set(key, coordinates);
  }
  return coordinates;
}

function isBrick(kind: BlockKind) {
  return kind >= BlockKind.BeigeBrick && kind <= BlockKind.GrayBrick;
}

function groupFor(kind: BlockKind) {
  if (isWaterBlock(kind)) return 'water';
  if (isGlass(kind)) return `glass:${glassDesignKinds.get(getVitrailDesign(kind)?.url ?? '') ?? kind}`;
  if (kind === BlockKind.Leaves || kind === BlockKind.PineLeaves || kind === BlockKind.AutumnLeaves) return 'foliage';
  if (isBrick(kind)) return `brick:${kind}`;
  return 'opaque';
}

const separateModelKinds = new Map<number, boolean>();

function usesSeparateModel(kind: BlockKind) {
  let separate = separateModelKinds.get(kind);
  if (separate === undefined) {
    separate = computeSeparateModel(kind);
    separateModelKinds.set(kind, separate);
  }
  return separate;
}

function computeSeparateModel(kind: BlockKind) {
  return kind === BlockKind.Candle || kind === BlockKind.Campfire || kind === BlockKind.Wildfire || kind === BlockKind.Food || isCrop(kind) || isSapling(kind) || isDoor(kind) || isTrapdoor(kind) || isUtilityBlock(kind) || isSign(kind);
}

function visibleFace(block: Voxel, neighbor: Voxel | undefined) {
  if (!neighbor || neighbor.open) return true;
  if (usesSeparateModel(neighbor.kind)) return !isWaterBlock(block.kind) && !isGlass(block.kind);
  if (isGlass(block.kind)) return !isGlass(neighbor.kind);
  if (isWaterBlock(block.kind)) return neighbor.kind !== block.kind;
  return isWaterBlock(neighbor.kind) || isGlass(neighbor.kind);
}

// Clés de texture [côté, dessus, dessous] par type de bloc, calculées une seule fois.
const faceTextureKeys = new Map<number, readonly [string, string, string]>();

function faceTexture(block: Voxel, direction: readonly number[]) {
  let keys = faceTextureKeys.get(block.kind);
  if (!keys) {
    const kind = block.kind;
    keys = kind === BlockKind.Grass || kind === BlockKind.AutumnGrass || kind === BlockKind.ForestGrass
      ? [`${kind}:side`, `${kind}:top`, `${BlockKind.Dirt}:side`]
      : kind === BlockKind.Wood || kind === BlockKind.Tnt
        ? [`${kind}:side`, `${kind}:top`, `${kind}:bottom`]
        : [`${kind}:side`, `${kind}:side`, `${kind}:side`];
    faceTextureKeys.set(kind, keys);
  }
  return direction[1] === 0 ? keys[0] : direction[1] > 0 ? keys[1] : keys[2];
}

export type ChunkLookup = (x: number, y: number, z: number) => Voxel | undefined;

// Grille locale du chunk : les voisins se trouvent par index numérique au lieu de construire
// une clé "x,y,z" par recherche. Une case vide ou hors grille retombe sur l'index global,
// ce qui garde exactement le même résultat (blocs des chunks voisins compris).
export function createChunkLookup(blocks: Voxel[], blockIndex: Map<string, Voxel>): ChunkLookup {
  const fallback: ChunkLookup = (x, y, z) => blockIndex.get(voxelKey(x, y, z));
  if (blocks.length === 0) return fallback;
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const block of blocks) {
    if (block.x < minX) minX = block.x;
    if (block.x > maxX) maxX = block.x;
    if (block.y < minY) minY = block.y;
    if (block.y > maxY) maxY = block.y;
    if (block.z < minZ) minZ = block.z;
    if (block.z > maxZ) maxZ = block.z;
  }
  const sizeY = maxY - minY + 1;
  const sizeZ = maxZ - minZ + 1;
  const cellCount = (maxX - minX + 1) * sizeY * sizeZ;
  if (!Number.isFinite(cellCount) || cellCount > 4_000_000) return fallback;
  const cells = new Int32Array(cellCount).fill(-1);
  blocks.forEach((block, index) => {
    // Seuls les blocs qui sont aussi ceux de l'index global vont dans la grille.
    if (blockIndex.get(voxelKey(block.x, block.y, block.z)) !== block) return;
    cells[((block.x - minX) * sizeY + (block.y - minY)) * sizeZ + (block.z - minZ)] = index;
  });
  return (x, y, z) => {
    if (x >= minX && x <= maxX && y >= minY && y <= maxY && z >= minZ && z <= maxZ) {
      const index = cells[((x - minX) * sizeY + (y - minY)) * sizeZ + (z - minZ)];
      if (index >= 0) return blocks[index];
    }
    return fallback(x, y, z);
  };
}

const fullFaceUV = { left: 0, right: 1, top: 1, bottom: 0 };

function addFace(group: GeometryGroup, block: Voxel, face: (typeof faces)[number], uv: ReturnType<typeof tileUV>, color: Color | null) {
  const scale = block.kind === BlockKind.Apple ? 0.35 : 1;
  const offsetY = block.kind === BlockKind.Apple ? -0.28 : 0;
  const base = group.positions.length / 3;
  const tile = isBrick(block.kind) ? fullFaceUV : block.kind >= BlockKind.ConcreteWhite && block.kind <= BlockKind.ConcreteBlack ? tileUV(WHITE_TILE) : uv;
  const uvCorners = [[tile.left, tile.top], [tile.right, tile.top], [tile.right, tile.bottom], [tile.left, tile.bottom]];
  const [nx, ny, nz] = face.direction;
  for (let index = 0; index < 4; index += 1) {
    const corner = face.corners[index];
    group.positions.push(block.x + corner[0] * scale, block.y + corner[1] * scale + offsetY, block.z + corner[2] * scale);
    group.normals.push(nx, ny, nz);
    group.uvs.push(uvCorners[index][0], uvCorners[index][1]);
    if (color) group.colors.push(color.r, color.g, color.b);
    else group.colors.push(1, 1, 1);
  }
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
  };
  return materials;
}

const glassMaterials = new Map<BlockKind, Material>();

function glassMaterial(kind: BlockKind) {
  let material = glassMaterials.get(kind);
  if (!material) {
    material = new MeshLambertMaterial({ map: getVitrailTexture(kind), vertexColors: true, transparent: true, opacity: 0.94, depthWrite: true });
    glassMaterials.set(kind, material);
  }
  return material;
}

const brickMaterials = new Map<BlockKind, Material>();

function brickMaterial(kind: BlockKind) {
  let material = brickMaterials.get(kind);
  if (!material) {
    const map = brickTexture(kind);
    material = kind === BlockKind.GrayBrick
      ? new MeshLambertMaterial({ map, vertexColors: true })
      : new MeshBasicMaterial({ map, vertexColors: true });
    brickMaterials.set(kind, material);
  }
  return material;
}

const concreteColors = new Map<BlockKind, Color>();

export function buildChunkGeometry(blocks: Voxel[], blockIndex: Map<string, Voxel>, lookup = createChunkLookup(blocks, blockIndex)) {
  createAtlas();
  const groups = new Map<string, GeometryGroup>();
  for (const block of blocks) {
    if (usesSeparateModel(block.kind)) continue;
    const groupName = groupFor(block.kind);
    const concrete = block.kind >= BlockKind.ConcreteWhite && block.kind <= BlockKind.ConcreteBlack;
    let color: Color | null = null;
    if (concrete) {
      color = concreteColors.get(block.kind) ?? new Color(EXTRA_BLOCK_META[block.kind as ExtraBlockKind].color);
      concreteColors.set(block.kind, color);
    }
    for (const face of faces) {
      const [dx, dy, dz] = face.direction;
      const neighbor = lookup(block.x + dx, block.y + dy, block.z + dz);
      if (!visibleFace(block, neighbor)) continue;
      let group = groups.get(groupName);
      if (!group) {
        group = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
        groups.set(groupName, group);
      }
      const mirrorU = isGlass(block.kind) && (face.direction[0] !== 0 ? block.z % 2 !== 0 : block.x % 2 !== 0);
      const mirrorV = isGlass(block.kind) && (face.direction[1] !== 0 ? block.z % 2 !== 0 : block.y % 2 !== 0);
      addFace(group, block, face, tileUV(faceTexture(block, face.direction), mirrorU, mirrorV), color);
    }
  }
  const sharedMaterials = getMaterials();
  return [...groups.entries()].map(([name, group]) => ({
    geometry: makeGeometry(group),
    material: name.startsWith('brick:') ? brickMaterial(Number(name.slice(6)) as BlockKind) : name.startsWith('glass:') ? glassMaterial(Number(name.slice(6)) as BlockKind) : sharedMaterials[name],
  }));
}
