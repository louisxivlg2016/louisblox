import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Color, Mesh, NearestFilter, Vector3 } from 'three';
import type { OutfitKind, WigKind } from '../game/outfits';
import wigLouis14Url from '../../assets/models/wig-louis14.glb';
import wigLouis15Url from '../../assets/models/wig-louis15.glb';
import kingUrl from '../../assets/models/costume-king.glb';
import militaryUrl from '../../assets/models/costume-military.glb';
import knightUrl from '../../assets/models/costume-knight.glb';
import explorerUrl from '../../assets/models/costume-explorer.glb';
import princessUrl from '../../assets/models/costume-princess.glb';
import louis14Url from '../../assets/models/costume-louis14.glb';
import louis15Url from '../../assets/models/costume-louis15.glb';
import { PixelPart } from './ItemModel';

const wigModels: Record<WigKind, string> = { louis14: wigLouis14Url, louis15: wigLouis15Url };
const costumeModels: Partial<Record<OutfitKind, string>> = { king: kingUrl, military: militaryUrl, knight: knightUrl, explorer: explorerUrl, princess: princessUrl, louis14: louis14Url, louis15: louis15Url };

export function hasWardrobeModel(kind: OutfitKind) {
  return kind !== 'knight' && kind !== 'princess' && costumeModels[kind] !== undefined;
}

function Model({ url, width, height, depth, centerY, tint = null }: { url: string; width: number; height: number; depth: number; centerY: number; tint?: string | null }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (tint) material.color.lerp(new Color(tint), 0.65);
        if (!material.map) continue;
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    clone.rotation.y = Math.PI;
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    clone.scale.set(width / Math.max(size.x, 0.001), height / Math.max(size.y, 0.001), depth / Math.max(size.z, 0.001));
    clone.position.set(-center.x * clone.scale.x, centerY - center.y * clone.scale.y, -center.z * clone.scale.z);
    return clone;
  }, [url, width, height, depth, centerY, tint]);
  return <primitive object={model} />;
}

export function WigGlb({ kind }: { kind: WigKind }) {
  const large = kind === 'louis14';
  return (
    <Suspense fallback={null}>
      {large && <PixelPart position={[0, 1.98, 0]} size={[0.53, 0.14, 0.53]} color="#3c2a20" />}
      {large && <PixelPart position={[0, 1.68, 0.24]} size={[0.46, 0.5, 0.12]} color="#4b3528" />}
      <Model url={wigModels[kind]} width={large ? 0.68 : 0.6} height={large ? 0.88 : 0.5} depth={large ? 0.64 : 0.57} centerY={large ? 1.8 : 1.91} />
    </Suspense>
  );
}

export function CostumeGlb({ kind, color = null }: { kind: OutfitKind; color?: string | null }) {
  const url = costumeModels[kind];
  if (!url) return null;
  const shoulders = kind === 'knight' || kind === 'princess';
  return (
    <Suspense fallback={null}>
      <Model url={url} width={shoulders ? 0.94 : 0.7} height={shoulders ? 0.42 : 0.82} depth={0.44} centerY={shoulders ? 1.36 : 1.08} tint={color} />
    </Suspense>
  );
}
