import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Mesh, NearestFilter, Vector3 } from 'three';
import type { AnimalKind } from '../game/animals';
import type { Entity } from 'koota';
import { ReferenceAnimal } from './ReferenceAnimals';
import bearUrl from '../../assets/models/bear.glb';
import deerUrl from '../../assets/models/deer.glb';
import wolfUrl from '../../assets/models/wolf.glb';
import snowWolfUrl from '../../assets/models/snowWolf.glb';
import snowBearUrl from '../../assets/models/snowBear.glb';
import zombieUrl from '../../assets/models/zombie.glb';

type StandaloneAnimalKind = Exclude<AnimalKind, 'camel' | 'cow' | 'horse' | 'pig' | 'sheep' | 'chicken' | 'duck'>;

const models: Record<StandaloneAnimalKind, string> = {
  bear: bearUrl,
  deer: deerUrl,
  wolf: wolfUrl,
  snowWolf: snowWolfUrl,
  snowBear: snowBearUrl,
  zombie: zombieUrl,
};

const heights: Record<StandaloneAnimalKind, number> = {
  bear: 1.8,
  deer: 1.55,
  wolf: 1.05,
  snowWolf: 1.1,
  snowBear: 2,
  zombie: 1.9,
};

export function AnimalGlb({ entity, kind }: { entity: Entity; kind: AnimalKind }) {
  if (['cow', 'horse', 'pig', 'sheep', 'chicken', 'duck', 'camel'].includes(kind)) return <ReferenceAnimal entity={entity} kind={kind} />;
  const modelKind = kind as StandaloneAnimalKind;
  const { scene } = useGLTF(models[modelKind]);
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
    clone.rotation.y = modelKind === 'zombie' ? 0 : -Math.PI / 2;
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const scale = heights[modelKind] / Math.max(size.y, 0.001);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    return clone;
  }, [scene, modelKind]);

  return <primitive object={model} />;
}
