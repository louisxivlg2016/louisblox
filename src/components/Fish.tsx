import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useQuery } from 'koota/react';
import type { Entity } from 'koota';
import { Box3, Mesh, NearestFilter, Vector3 } from 'three';
import { Fish as FishTrait, FishMesh, FishPosition } from '../game/traits';
import type { FishKind } from '../game/fish';
import salmonUrl from '../../assets/models/fish-salmon.glb';
import clownfishUrl from '../../assets/models/fish-clownfish.glb';
import blueTangUrl from '../../assets/models/fish-blue-tang.glb';

const models: Record<FishKind, string> = {
  salmon: salmonUrl,
  clownfish: clownfishUrl,
  blueTang: blueTangUrl,
};
const heights: Record<FishKind, number> = { salmon: 0.45, clownfish: 0.5, blueTang: 0.55 };

function FishGlb({ kind }: { kind: FishKind }) {
  const { scene } = useGLTF(models[kind]);
  const model = useMemo(() => {
    const clone = scene.clone(true);
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
    clone.rotation.y = -Math.PI / 2;
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const scale = heights[kind] / Math.max(size.y, 0.001);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    return clone;
  }, [scene, kind]);
  return <primitive object={model} />;
}

function FishView({ entity }: { entity: Entity }) {
  const kind = entity.get(FishTrait)!.kind;
  const position = entity.get(FishPosition)!;
  return (
    <group
      ref={(group) => {
        const holder = entity.get(FishMesh);
        if (holder) holder.value = group;
      }}
      position={[position.x, position.y, position.z]}
    >
      <Suspense fallback={null}><FishGlb kind={kind} /></Suspense>
    </group>
  );
}

export function Fish() {
  const fish = useQuery(FishTrait);
  return fish.map((entity) => <FishView key={entity} entity={entity} />);
}
