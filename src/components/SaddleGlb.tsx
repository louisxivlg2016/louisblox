import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Mesh, NearestFilter } from 'three';
import saddleUrl from '../../assets/models/horse-saddle.glb';

useGLTF.preload(saddleUrl);

export function SaddleGlb() {
  const { scene } = useGLTF(saddleUrl);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.name = 'saddle-model';
    clone.userData.source = 'Hunyuan';
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material.map) continue;
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    return clone;
  }, [scene]);
  return <Suspense fallback={null}><primitive object={model} /></Suspense>;
}
