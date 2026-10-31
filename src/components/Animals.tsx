import { Suspense } from 'react';
import { useQuery, useTrait } from 'koota/react';
import type { Entity } from 'koota';
import { Mesh } from 'three';
import { Animal, AnimalMesh, AnimalPosition, HorseRider } from '../game/traits';
import { AnimalGlb } from './AnimalGlb';
import { SaddleModel } from './ItemModel';

function AnimalView({ entity }: { entity: Entity }) {
  const kind = entity.get(Animal)!.kind;
  const position = entity.get(AnimalPosition)!;
  const rider = useTrait(entity, HorseRider);
  return (
    <group
      ref={(group) => {
        if (group && !group.userData.flashReady) {
          group.traverse((object) => {
            if (!(object instanceof Mesh)) return;
            if (Array.isArray(object.material)) object.material = object.material.map((material) => material.clone());
            else object.material = object.material.clone();
          });
          group.userData.flashReady = true;
        }
        const holder = entity.get(AnimalMesh);
        if (holder) holder.value = group;
      }}
      position={[position.x, position.y, position.z]}
    >
      <Suspense fallback={null}>
        <AnimalGlb kind={kind} />
      </Suspense>
      {kind === 'horse' && rider?.saddled && <group position={[0, 1.28, 0]} scale={0.85}><SaddleModel /></group>}
    </group>
  );
}

export function Animals() {
  const animals = useQuery(Animal);
  return animals.map((entity) => <AnimalView key={entity} entity={entity} />);
}
