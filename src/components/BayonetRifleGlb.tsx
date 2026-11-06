import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Mesh, NearestFilter } from 'three';
import rifleUrl from '../../assets/models/bayonet-rifle.glb';

useGLTF.preload(rifleUrl);

export function BayonetRifleGlb() {
  const { scene } = useGLTF(rifleUrl);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.name = 'flintlock-rifle';
    clone.userData.source = 'Hunyuan';
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material.map) continue;
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    return clone;
  }, [scene]);
  return <primitive object={model} />;
}

export function BayonetRifleWithFallback() {
  return <Suspense fallback={null}><BayonetRifleGlb /></Suspense>;
}
