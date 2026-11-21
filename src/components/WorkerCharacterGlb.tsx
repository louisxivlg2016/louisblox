import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import workerUrl from '../../assets/models/full-worker.glb';
import { WorkerHeadlamp } from './WorkerGear';

export function WorkerCharacterGlb() {
  const { scene } = useGLTF(workerUrl);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.name = 'hunyuan-worker-model';
    const bounds = new Box3().setFromObject(clone);
    const center = bounds.getCenter(new Vector3());
    const scale = 2.05 / Math.max(0.001, bounds.max.y - bounds.min.y);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    return clone;
  }, [scene]);
  return (
    <group name="full-character" userData={{ outfit: 'worker', source: 'Hunyuan', whole: true }} rotation={[0, Math.PI, 0]}>
      <primitive object={model} />
      <group scale={0.45} position={[0, 1.76, 0.3]}>
        <WorkerHeadlamp showHelmet={false} />
      </group>
    </group>
  );
}
