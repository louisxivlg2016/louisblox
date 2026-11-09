import { useEffect, useMemo } from 'react';
import { useWorld } from 'koota/react';
import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';
import { BlockKind, voxelKey } from '../game/voxel';
import type { Voxel } from '../game/voxel';
import { getBlockIndex } from '../game/chunks';
import { facingYaw } from '../game/extraBlocks';
import { isCollidable } from '../game/systems/collisionSystem';
import { PixelPart } from './ItemModel';
import { ParisStreetSignModel } from './ParisStreetSign';

function signTexture(text: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#bb925b';
  context.fillRect(0, 0, 256, 160);
  context.fillStyle = '#a77d47';
  for (let y = 12; y < 160; y += 32) {
    for (let x = (y % 64) + 4; x < 256; x += 58) context.fillRect(x, y, 26, 3);
  }
  const lines = text.split('\n').flatMap((line) => {
    if (!line) return [''];
    const parts: string[] = [];
    for (let index = 0; index < line.length; index += 20) parts.push(line.slice(index, index + 20));
    return parts;
  }).slice(0, 6);
  context.fillStyle = '#30251c';
  context.font = 'bold 20px monospace';
  context.textAlign = 'center';
  lines.forEach((line, index) => context.fillText(line, 128, 30 + index * 24, 244));
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function SignModel({ text = '' }: { text?: string }) {
  const texture = useMemo(() => signTexture(text), [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group>
      <PixelPart position={[0, -0.17, 0]} size={[0.13, 0.66, 0.13]} color="#765035" />
      <PixelPart position={[0, 0.3, 0]} size={[1, 0.66, 0.12]} color="#bb925b" />
      <mesh name="sign-plaque" position={[0, 0.3, 0.066]}>
        <planeGeometry args={[0.96, 0.62]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function SignBlocks({ blocks }: { blocks: Voxel[] }) {
  const world = useWorld();
  const blockIndex = getBlockIndex(world);
  return blocks.map((block) => {
    let rotation = facingYaw(block.facing);
    const front = blockIndex.get(voxelKey(block.x + Math.round(Math.sin(rotation)), block.y, block.z + Math.round(Math.cos(rotation))));
    if (isCollidable(front)) {
      const reverse = rotation + Math.PI;
      const back = blockIndex.get(voxelKey(block.x + Math.round(Math.sin(reverse)), block.y, block.z + Math.round(Math.cos(reverse))));
      if (!isCollidable(back)) rotation = reverse;
    }
    return <group key={`${block.x},${block.y},${block.z}`} position={[block.x, block.y - 0.5, block.z]} rotation={[0, rotation, 0]} scale={0.6}>{block.kind === BlockKind.ParisStreetSign ? <ParisStreetSignModel text={block.text} /> : <SignModel text={block.text ?? ''} />}</group>;
  });
}
