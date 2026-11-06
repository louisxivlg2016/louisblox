import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Mesh, NearestFilter, Vector3 } from 'three';
import type { AnimalKind } from '../game/animals';
import type { Entity } from 'koota';
import { ReferenceAnimal } from './ReferenceAnimals';
import zombieUrl from '../../assets/models/zombie.glb';

export function AnimalGlb({ entity, kind }: { entity: Entity; kind: AnimalKind }) {
  if (kind !== 'zombie') return <ReferenceAnimal entity={entity} kind={kind} />;
  const { scene } = useGLTF(zombieUrl);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material.map) {
          material.map.magFilter = NearestFilter;
          material.map.minFilter = NearestFilter;
          material.map.generateMipmaps = false;
          material.map.needsUpdate = true;
        }
      }
    });
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const scale = 1.9 / Math.max(size.y, 0.001);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    return clone;
  }, [scene]);

  return <primitive object={model} />;
}
