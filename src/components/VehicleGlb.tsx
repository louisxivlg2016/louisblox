import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Mesh, NearestFilter, Vector3 } from 'three';
import raceCarUrl from '../../assets/models/raceCar.glb';
import blueCarUrl from '../../assets/models/blueCar.glb';
import airplaneUrl from '../../assets/models/airplane.glb';
import trainUrl from '../../assets/models/train.glb';
import { CarModel } from './ItemModel';

const models = {
  raceCar: raceCarUrl,
  blueCar: blueCarUrl,
  airplane: airplaneUrl,
  train: trainUrl,
};
const dimensions = {
  raceCar: [1.8, 1.15, 3.3],
  blueCar: [1.9, 1.6, 3.6],
  airplane: [7.2, 2.5, 8.2],
  train: [2.8, 3.2, 10.5],
} as const;

function Model({ kind, color, interior }: { kind: 'car' | 'plane' | 'train'; color: string; interior: boolean }) {
  const modelKind = kind === 'car' && color.toLowerCase() === '#347cd0' ? 'blueCar' : kind === 'car' ? 'raceCar' : kind === 'plane' ? 'airplane' : 'train';
  const { scene } = useGLTF(models[modelKind]);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (interior && kind !== 'car') {
          material.transparent = true;
          material.opacity = Math.min(material.opacity, 0.18);
          material.depthWrite = false;
        }
        if (!material.map) continue;
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const [width, height, length] = dimensions[modelKind];
    clone.scale.set(width / Math.max(size.x, 0.001), height / Math.max(size.y, 0.001), length / Math.max(size.z, 0.001));
    clone.position.set(-center.x * clone.scale.x, -box.min.y * clone.scale.y, -center.z * clone.scale.z);
    return clone;
  }, [scene, modelKind, interior, kind]);
  return <primitive object={model} />;
}

export function VehicleGlb({ kind, color, interior = false }: { kind: 'car' | 'plane' | 'train'; color: string; interior?: boolean }) {
  return (
    <Suspense fallback={kind === 'car' ? <CarModel color={color} /> : null}>
      <Model kind={kind} color={color} interior={interior} />
    </Suspense>
  );
}
