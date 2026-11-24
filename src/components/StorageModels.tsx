import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import chestUrl from '../../assets/models/chest.glb';
import chestSafeUrl from '../../assets/models/chest-safe.glb';
import furnaceUrl from '../../assets/models/furnace.glb';
import furnaceKitchenUrl from '../../assets/models/furnace-kitchen.glb';
import furnaceMaterialsUrl from '../../assets/models/furnace-materials.glb';

function StorageGlb({ url, height }: { url: string; height: number }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const bounds = new Box3().setFromObject(clone);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const scale = height / Math.max(size.y, 0.001);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    return clone;
  }, [scene, height]);
  return <primitive object={model} />;
}

export function ChestGlb({ variant = 0 }: { variant?: number }) {
  return <StorageGlb url={variant % 2 === 1 ? chestSafeUrl : chestUrl} height={0.95} />;
}

export function FurnaceGlb({ variant = 0 }: { variant?: number }) {
  const url = variant % 3 === 1 ? furnaceKitchenUrl : variant % 3 === 2 ? furnaceMaterialsUrl : furnaceUrl;
  return <StorageGlb url={url} height={1} />;
}
