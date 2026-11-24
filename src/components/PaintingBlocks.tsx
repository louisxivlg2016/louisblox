import { CanvasTexture, DoubleSide, LinearFilter, SRGBColorSpace } from 'three';
import { BlockKind } from '../game/voxel';
import type { Voxel } from '../game/voxel';
import { drawPainting } from '../game/paintingArt';
import { facingYaw } from '../game/extraBlocks';
import { wallMount } from '../game/wallMount';
import { PixelPart } from './ItemModel';
import { DecorationCulling } from './DecorationCulling';

const textures = new Map<BlockKind, CanvasTexture>();

function paintingTexture(kind: BlockKind) {
  const cached = textures.get(kind);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  drawPainting(canvas.getContext('2d')!, kind);
  const texture = new CanvasTexture(canvas);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  textures.set(kind, texture);
  return texture;
}

export function PaintingModel({ kind }: { kind: BlockKind }) {
  const texture = paintingTexture(kind);
  return (
    <group name={`painting-${kind}`}>
      <PixelPart position={[0, 0, 0]} size={[1, 0.78, 0.08]} color="#5d3c25" />
      <mesh name="painting-canvas" position={[0, 0, 0.046]}>
        <planeGeometry args={[0.88, 0.64]} />
        <meshBasicMaterial map={texture} toneMapped={false} side={DoubleSide} />
      </mesh>
      <PixelPart position={[0, 0.385, 0.035]} size={[1.05, 0.055, 0.11]} color="#c29a4b" />
      <PixelPart position={[0, -0.385, 0.035]} size={[1.05, 0.055, 0.11]} color="#a77c38" />
      <PixelPart position={[-0.5, 0, 0.035]} size={[0.055, 0.78, 0.11]} color="#b88c42" />
      <PixelPart position={[0.5, 0, 0.035]} size={[0.055, 0.78, 0.11]} color="#b88c42" />
    </group>
  );
}

export function PaintingBlocks({ blocks, blockIndex }: { blocks: Voxel[]; blockIndex: ReadonlyMap<string, Voxel> }) {
  return <DecorationCulling distance={55}>{blocks.map((block) => {
    const mount = wallMount(blockIndex, block, facingYaw(block.facing));
    return <group key={`${block.x},${block.y},${block.z}`} position={[block.x - Math.sin(mount.rotation) * mount.offset, block.y, block.z - Math.cos(mount.rotation) * mount.offset]} rotation={[0, mount.rotation, 0]} userData={{ wallMounted: mount.mounted }}><PaintingModel kind={block.kind} /></group>;
  })}</DecorationCulling>;
}
