import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import appleUrl from '../../assets/models/apple.glb';

export function AppleGlb() {
  const { scene } = useGLTF(appleUrl);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.name = 'hunyuan-apple';
    const bounds = new Box3().setFromObject(clone);
    const center = bounds.getCenter(new Vector3());
    const height = Math.max(0.001, bounds.max.y - bounds.min.y);
    const scale = 0.7 / height;
    center.multiplyScalar(scale);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x, -center.y, -center.z);
    return clone;
  }, [scene]);
  return <primitive object={model} />;
}
