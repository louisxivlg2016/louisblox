import { Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useQuery, useTrait, useWorld } from 'koota/react';
import type { Entity } from 'koota';
import { Mesh } from 'three';
import { Animal, AnimalMesh, AnimalPosition, AnimalTame, HorseRider } from '../game/traits';
import { useRemotePlayerStore } from '../game/multiplayerStore';
import { syncRemoteMounts } from '../game/animalMountSync';
import { AnimalGlb } from './AnimalGlb';
import { SaddleModel } from './ItemModel';
import { AnimalFriendship } from './AnimalFriendship';

function AnimalView({ entity }: { entity: Entity }) {
  const animal = entity.get(Animal);
  const position = entity.get(AnimalPosition);
  const rider = useTrait(entity, HorseRider);
  const tame = useTrait(entity, AnimalTame);
  if (!animal || !position) return null;
  const kind = animal.kind;
  return (
    <group
      scale={tame?.baby ? 0.55 : 1}
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
        <AnimalGlb entity={entity} kind={kind} />
      </Suspense>
      {kind === 'horse' && rider?.saddled && <group name="horse-saddle" position={[0, 0.4, -0.15]} scale={0.85}><SaddleModel /></group>}
      <AnimalFriendship entity={entity} />
    </group>
  );
}

function RemoteHorseSync() {
  const world = useWorld();
  const previous = useRef(new Set<Entity>());
  useFrame(() => {
    previous.current = syncRemoteMounts(world, useRemotePlayerStore.getState().players, previous.current);
  });
  return null;
}

export function Animals() {
  const animals = useQuery(Animal);
  return <><RemoteHorseSync />{animals.map((entity) => <AnimalView key={entity} entity={entity} />)}</>;
}
