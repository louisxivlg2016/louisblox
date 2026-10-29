import { useEffect, useMemo } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';
import type { MeshLambertMaterial } from 'three';
import { ITEM_META } from '../game/items';
import { useGameStore } from '../game/store';
import { blockGeometry, blockMaterials } from '../game/textures';
import { BlockKind } from '../game/voxel';
import { ItemModel } from './ItemModel';

function createSkinTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const context = canvas.getContext('2d')!;
  const colors = ['#e7a0aa', '#f0b0b7', '#d98e9b', '#f4bec2'];
  for (let x = 0; x < 8; x += 1) {
    for (let y = 0; y < 8; y += 1) {
      context.fillStyle = colors[(x * 3 + y * 5) % colors.length];
      context.fillRect(x, y, 1, 1);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function Hands() {
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const selected = useGameStore((state) => state.selected);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const skinTexture = useMemo(createSkinTexture, []);
  const selectedBlock = typeof selected === 'number' ? selected : BlockKind.Grass;
  const heldMaterials = useMemo(() => blockMaterials[selectedBlock].map((material) => {
    const clone = material.clone() as MeshLambertMaterial;
    clone.fog = false;
    clone.transparent = true;
    clone.opacity = 1;
    clone.depthTest = false;
    clone.depthWrite = false;
    return clone;
  }), [selectedBlock]);
  useEffect(() => {
    scene.add(camera);
    return () => { scene.remove(camera); };
  }, [camera, scene]);
  useEffect(() => () => heldMaterials.forEach((material) => material.dispose()), [heldMaterials]);

  if (cameraMode === 'third') return null;
  return createPortal(
    <group>
      {[-0.43, 0.42].map((x) => (
        <mesh key={x} position={[x, -0.45, -0.72]} rotation={[-0.35, x * 0.2, x * 0.5]} renderOrder={10} frustumCulled={false}>
          <boxGeometry args={[0.2, 0.52, 0.2]} />
          <meshLambertMaterial map={skinTexture} depthTest={false} depthWrite={false} fog={false} transparent opacity={1} />
        </mesh>
      ))}
      {typeof selected === 'number' ? (
        <mesh args={[blockGeometry, heldMaterials]} position={[0.36, -0.26, -0.72]} rotation={[0.2, 0.55, 0.05]} scale={0.24} renderOrder={11} frustumCulled={false} />
      ) : (
        <group position={[0.36, -0.32, -0.78]} rotation={[0.08, 0.15, 0]} scale={ITEM_META[selected].category === 'vehicle' ? 0.17 : 0.65}>
          <ItemModel kind={selected} held />
        </group>
      )}
    </group>,
    camera,
  );
}
