import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Mesh, NearestFilter, Vector3 } from 'three';
import type { AnimalKind } from '../game/animals';
import camelUrl from '../../assets/models/camel.glb';
import cowUrl from '../../assets/models/cow.glb';
import horseUrl from '../../assets/models/horse.glb';
import pigUrl from '../../assets/models/pig.glb';
import sheepUrl from '../../assets/models/sheep.glb';
import chickenUrl from '../../assets/models/chicken.glb';
import duckUrl from '../../assets/models/duck.glb';
import bearUrl from '../../assets/models/bear.glb';
import deerUrl from '../../assets/models/deer.glb';
import wolfUrl from '../../assets/models/wolf.glb';
import snowWolfUrl from '../../assets/models/snowWolf.glb';
import snowBearUrl from '../../assets/models/snowBear.glb';

const models: Record<AnimalKind, string> = {
  camel: camelUrl,
  cow: cowUrl,
  horse: horseUrl,
  pig: pigUrl,
  sheep: sheepUrl,
  chicken: chickenUrl,
  duck: duckUrl,
  bear: bearUrl,
  deer: deerUrl,
  wolf: wolfUrl,
  snowWolf: snowWolfUrl,
  snowBear: snowBearUrl,
};

const heights: Record<AnimalKind, number> = {
  camel: 1.85,
  cow: 1.35,
  horse: 1.65,
  pig: 0.85,
  sheep: 1.1,
  chicken: 0.75,
  duck: 0.65,
  bear: 1.8,
  deer: 1.55,
  wolf: 1.05,
  snowWolf: 1.1,
  snowBear: 2,
};

export function AnimalGlb({ kind }: { kind: AnimalKind }) {
  const { scene } = useGLTF(models[kind]);
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
    clone.rotation.y = -Math.PI / 2;
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const scale = heights[kind] / Math.max(size.y, 0.001);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    return clone;
  }, [scene, kind]);

  return <primitive object={model} />;
}
