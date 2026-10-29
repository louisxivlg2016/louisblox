import { MeshBasicMaterial } from 'three';
import { BlockKind } from '../game/voxel';
import type { Voxel } from '../game/voxel';
import { PixelPart } from './ItemModel';
import { EXTRA_BLOCK_META, isBed } from '../game/extraBlocks';

const fire = new MeshBasicMaterial({ color: '#ff9a32' });

export function FurnaceModel() {
  return (
    <group>
      <PixelPart position={[0, 0.46, 0]} size={[0.92, 0.92, 0.9]} color="#666c72" />
      <PixelPart position={[0, 0.94, 0]} size={[0.96, 0.08, 0.94]} color="#81888d" />
      <PixelPart position={[0, 0.38, -0.461]} size={[0.62, 0.44, 0.035]} color="#292e34" />
      <PixelPart position={[0, 0.38, -0.485]} size={[0.46, 0.29, 0.02]} color="#131a20" />
      <mesh position={[0, 0.33, -0.502]} material={fire}><boxGeometry args={[0.34, 0.16, 0.025]} /></mesh>
      <PixelPart position={[0, 0.72, -0.466]} size={[0.55, 0.08, 0.025]} color="#353d44" />
      <PixelPart position={[0, 0.82, -0.466]} size={[0.55, 0.06, 0.025]} color="#353d44" />
      <PixelPart position={[-0.38, 0.4, -0.485]} size={[0.08, 0.5, 0.04]} color="#899096" />
      <PixelPart position={[0.38, 0.4, -0.485]} size={[0.08, 0.5, 0.04]} color="#899096" />
    </group>
  );
}

export function ChestModel() {
  return (
    <group>
      <PixelPart position={[0, 0.28, 0]} size={[0.9, 0.55, 0.8]} color="#9b6836" />
      <PixelPart position={[0, 0.69, 0]} size={[0.94, 0.27, 0.84]} color="#b07b3f" />
      <PixelPart position={[0, 0.55, -0.42]} size={[0.92, 0.08, 0.05]} color="#5f4127" />
      <PixelPart position={[-0.3, 0.42, -0.425]} size={[0.09, 0.8, 0.05]} color="#5c6061" />
      <PixelPart position={[0.3, 0.42, -0.425]} size={[0.09, 0.8, 0.05]} color="#5c6061" />
      <PixelPart position={[0, 0.46, -0.465]} size={[0.16, 0.22, 0.09]} color="#d1ae56" />
      <PixelPart position={[0, 0.46, -0.52]} size={[0.06, 0.09, 0.03]} color="#5b4930" />
      <PixelPart position={[0, 0.83, 0]} size={[0.9, 0.045, 0.8]} color="#c08c4c" />
    </group>
  );
}

export function LadderModel() {
  return (
    <group>
      <PixelPart position={[-0.33, 0.48, -0.43]} size={[0.11, 0.96, 0.11]} color="#876039" />
      <PixelPart position={[0.33, 0.48, -0.43]} size={[0.11, 0.96, 0.11]} color="#876039" />
      {[0.14, 0.4, 0.66, 0.9].map((y) => <PixelPart key={y} position={[0, y, -0.43]} size={[0.72, 0.09, 0.1]} color="#b18a50" />)}
    </group>
  );
}

export function BedModel({ kind }: { kind: BlockKind }) {
  const color = EXTRA_BLOCK_META[kind as keyof typeof EXTRA_BLOCK_META].color;
  return (
    <group scale={[1.12, 1, 1.12]}>
      <PixelPart position={[0, 0.14, 0]} size={[0.94, 0.22, 1.65]} color="#765035" />
      <PixelPart position={[0, 0.34, 0]} size={[0.88, 0.22, 1.55]} color="#e8e5d7" />
      <PixelPart position={[0, 0.51, 0.48]} size={[0.72, 0.14, 0.42]} color="#f7f4e8" />
      <PixelPart position={[0, 0.49, -0.28]} size={[0.9, 0.12, 0.94]} color={color} />
      <PixelPart position={[0, 0.57, 0.12]} size={[0.9, 0.08, 0.18]} color={color} />
      <PixelPart position={[-0.37, 0.06, -0.64]} size={[0.13, 0.13, 0.13]} color="#543a29" />
      <PixelPart position={[0.37, 0.06, -0.64]} size={[0.13, 0.13, 0.13]} color="#543a29" />
      <PixelPart position={[-0.37, 0.06, 0.64]} size={[0.13, 0.13, 0.13]} color="#543a29" />
      <PixelPart position={[0.37, 0.06, 0.64]} size={[0.13, 0.13, 0.13]} color="#543a29" />
    </group>
  );
}

export function UtilityBlockModel({ kind }: { kind: BlockKind }) {
  return kind === BlockKind.Furnace ? <FurnaceModel /> : kind === BlockKind.Chest ? <ChestModel /> : isBed(kind) ? <BedModel kind={kind} /> : <LadderModel />;
}

export function UtilityBlocks({ blocks }: { blocks: Voxel[] }) {
  return blocks.map((block) => {
    const oriented = block.kind === BlockKind.Ladder || isBed(block.kind);
    const rotation = !oriented ? 0 : block.facing === 'north' ? Math.PI : block.facing === 'east' ? -Math.PI / 2 : block.facing === 'west' ? Math.PI / 2 : 0;
    return <group key={`${block.x},${block.y},${block.z}`} position={[block.x, block.y - 0.5, block.z]} rotation={[0, rotation, 0]}><UtilityBlockModel kind={block.kind} /></group>;
  });
}
