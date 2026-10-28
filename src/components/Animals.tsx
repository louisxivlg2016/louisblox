import { Suspense } from 'react';
import { useQuery } from 'koota/react';
import type { Entity } from 'koota';
import { Mesh } from 'three';
import { Animal, AnimalMesh, AnimalPosition } from '../game/traits';
import { AnimalGlb } from './AnimalGlb';

function AnimalView({ entity }: { entity: Entity }) {
  const kind = entity.get(Animal)!.kind;
  const position = entity.get(AnimalPosition)!;

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
    </group>
  );
}

export function Animals() {
  const animals = useQuery(Animal);
  return animals.map((entity) => <AnimalView key={entity} entity={entity} />);
}
