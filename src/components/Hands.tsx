import { useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { SelectedKind } from '../game/items';
import { useEatingStore } from '../game/eating';
import { CanvasTexture, Color, NearestFilter, SRGBColorSpace } from 'three';
import { useCharacterStore } from '../game/characterStore';
import type { MeshLambertMaterial } from 'three';
import { getItemMeta } from '../game/items';
import { useGameStore } from '../game/store';
import { blockGeometry, blockMaterials } from '../game/textures';
import { BlockKind } from '../game/voxel';
import { ItemModel, isWeaponItem, itemGripOffset } from './ItemModel';
import { BombModel, CandleModel, CampfireModel } from './SpecialBlocks';
import { UtilityBlockModel } from './UtilityBlocks';
import { isUtilityBlock } from '../game/extraBlocks';

function createSkinTexture(base: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const context = canvas.getContext('2d')!;
  const color = new Color(base);
  const colors = [color.getStyle(), color.clone().offsetHSL(0, 0, 0.04).getStyle(), color.clone().offsetHSL(0, 0, -0.04).getStyle(), color.clone().offsetHSL(0, 0, 0.08).getStyle()];
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

function EatingHand({ kind, startedAt }: { kind: Exclude<SelectedKind, number>; startedAt: number }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    if (!group.current) return;
    const progress = Math.min(1, (performance.now() - startedAt) / 850);
    const bite = Math.sin(progress * Math.PI);
    group.current.position.set(0.36 - bite * 0.34, -0.3 + bite * 0.2, -0.78 + bite * 0.33);
    group.current.rotation.set(-bite * 0.75, 0.15, bite * 0.2);
  });
  return <group ref={group} name="eating-animation" scale={0.65}><ItemModel kind={kind} held /></group>;
}

export function Hands() {
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const selected = useGameStore((state) => state.selected);
  const eating = useEatingStore((state) => state.eating);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const riding = useGameStore((state) => state.riding);
  const sleeping = useGameStore((state) => state.sleepProgress !== null);
  const skinColor = useCharacterStore((state) => state.appearance.skinColor);
  const skinTexture = useMemo(() => createSkinTexture(skinColor), [skinColor]);
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

  if (cameraMode !== 'first' || sleeping || riding === 'car') return null;
  return createPortal(
    <>
      <group visible={!eating}>
      {[-0.43, 0.42].map((x) => (
        <mesh key={x} position={[x, -0.45, -0.72]} rotation={[-0.35, x * 0.2, x * 0.5]} renderOrder={10} frustumCulled={false}>
          <boxGeometry args={[0.2, 0.52, 0.2]} />
          <meshLambertMaterial map={skinTexture} depthTest={false} depthWrite={false} fog={false} transparent opacity={1} />
        </mesh>
      ))}
      {typeof selected === 'number' ? (
        selected === BlockKind.Tnt || selected === BlockKind.Candle || selected === BlockKind.Campfire || selected === BlockKind.Wildfire ? (
          <group position={[0.36, -0.3, -1.04]} rotation={[0.08, 0.15, 0]} scale={0.32}>
            {selected === BlockKind.Tnt ? <BombModel /> : selected === BlockKind.Candle ? <CandleModel /> : <CampfireModel destructive={selected === BlockKind.Wildfire} />}
          </group>
        ) : isUtilityBlock(selected) ? (
          <group position={[0.36, -0.3, -1]} scale={0.32}><UtilityBlockModel kind={selected} withLight={false} held /></group>
        ) : (
          <mesh args={[blockGeometry, heldMaterials]} position={[0.36, -0.28, -0.86]} rotation={[0.2, 0.55, 0.05]} scale={0.16} renderOrder={11} frustumCulled={false} />
        )
      ) : (
        <group name="held-item" position={isWeaponItem(selected) ? [0.36, -0.58 - itemGripOffset(selected) * (getItemMeta(selected).category === 'vehicle' ? 0.1972 : 0.754), -0.78] : [0.36, -0.3, -1.02]} rotation={[0.08, 0.15, 0]} scale={getItemMeta(selected).category === 'vehicle' ? 0.34 : 1.3}>
          <ItemModel kind={selected} held flipGuns />
        </group>
      )}
      </group>
      {eating && <EatingHand kind={eating.kind} startedAt={eating.startedAt} />}
    </>,
    camera,
  );
}
