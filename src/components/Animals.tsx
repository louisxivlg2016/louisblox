import { Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useQuery, useTrait, useWorld } from 'koota/react';
import type { Entity } from 'koota';
import { Mesh } from 'three';
import { Animal, AnimalId, AnimalMesh, AnimalMotion, AnimalPosition, HorseRider, Player, PlayerMount } from '../game/traits';
import { useRemotePlayerStore } from '../game/multiplayerStore';
import { spawnAnimal } from '../game/animals';
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
        <AnimalGlb entity={entity} kind={kind} />
      </Suspense>
      {kind === 'horse' && rider?.saddled && <group name="horse-saddle" position={[0, 0.55, -0.15]} scale={0.85}><SaddleModel /></group>}
    </group>
  );
}

function RemoteHorseSync() {
  const world = useWorld();
  const previous = useRef(new Set<Entity>());
  useFrame(() => {
    const current = new Set<Entity>();
    const localMount = world.queryFirst(Player)?.get(PlayerMount)?.vehicle;
    const horses = [...world.query(Animal, AnimalId, AnimalPosition, AnimalMotion, AnimalMesh)];
    for (const state of Object.values(useRemotePlayerStore.getState().players)) {
      const snapshot = state.horse;
      if (!snapshot) continue;
      let entity = horses.find((candidate) => candidate.get(AnimalId) === snapshot.id);
      if (entity === localMount) continue;
      if (!entity) {
        entity = spawnAnimal(world, 'horse', snapshot.x, snapshot.y, snapshot.z, 0);
        entity.set(AnimalId, snapshot.id);
        horses.push(entity);
      }
      current.add(entity);
      const rider = entity.get(HorseRider);
      if (rider) {
        if (!rider.saddled || !rider.mounted) entity.set(HorseRider, { saddled: true, mounted: true });
      } else {
        entity.add(HorseRider({ saddled: true, mounted: true }));
      }
      const position = entity.get(AnimalPosition)!;
      position.set(snapshot.x, snapshot.y, snapshot.z);
      entity.set(AnimalMotion, { yaw: snapshot.yaw, displayYaw: snapshot.yaw + Math.PI });
      const mesh = entity.get(AnimalMesh)?.value;
      if (mesh) {
        mesh.position.copy(position);
        mesh.rotation.y = snapshot.yaw + Math.PI;
      }
    }
    for (const entity of previous.current) {
      if (current.has(entity) || entity === localMount || !entity.get(HorseRider)) continue;
      const motion = entity.get(AnimalMotion);
      if (motion) entity.set(AnimalMotion, { yaw: motion.displayYaw });
      entity.set(HorseRider, { mounted: false, speed: 0 });
    }
    previous.current = current;
  });
  return null;
}

export function Animals() {
  const animals = useQuery(Animal);
  return <><RemoteHorseSync />{animals.map((entity) => <AnimalView key={entity} entity={entity} />)}</>;
}
