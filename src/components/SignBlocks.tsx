import { useEffect, useMemo } from 'react';
import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';
import { BlockKind } from '../game/voxel';
import type { Voxel } from '../game/voxel';
import { facingYaw } from '../game/extraBlocks';
import { wallMount } from '../game/wallMount';
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

export function SignModel({ text = '', wallMounted = false }: { text?: string; wallMounted?: boolean }) {
  const texture = useMemo(() => signTexture(text), [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group>
      {!wallMounted && <PixelPart position={[0, -0.17, 0]} size={[0.13, 0.66, 0.13]} color="#765035" />}
      <PixelPart position={[0, 0.3, 0]} size={[1, 0.66, 0.12]} color="#bb925b" />
      <mesh name="sign-plaque" position={[0, 0.3, 0.066]}>
        <planeGeometry args={[0.96, 0.62]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function SignBlocks({ blocks, blockIndex }: { blocks: Voxel[]; blockIndex: ReadonlyMap<string, Voxel> }) {
  return blocks.map((block) => {
    const mount = wallMount(blockIndex, block, facingYaw(block.facing));
    return <group key={`${block.x},${block.y},${block.z}`} position={[block.x - Math.sin(mount.rotation) * mount.offset, block.y - 0.5, block.z - Math.cos(mount.rotation) * mount.offset]} rotation={[0, mount.rotation, 0]} scale={0.6} userData={{ wallMounted: mount.mounted }}>{block.kind === BlockKind.ParisStreetSign ? <ParisStreetSignModel text={block.text} /> : <SignModel text={block.text ?? ''} wallMounted={mount.mounted} />}</group>;
  });
}
