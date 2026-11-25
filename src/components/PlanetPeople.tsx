import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { Vector3 } from 'three';
import { FullCharacterGlb } from './FullCharacterGlb';
import { girlPosition, survivorPositions, usePlanetPeopleStore } from '../game/planetPeople';
import { getPlanetUniverse } from '../game/planetUniverse';

function PlanetPerson({ name, outfit, position }: { name: string; outfit: 'classic-girl' | 'worker' | 'police' | 'king'; position: Vector3 }) {
  const group = useRef<Group>(null);
  const [walking, setWalking] = useState(false);
  useFrame(() => {
    if (!group.current) return;
    const dx = position.x - group.current.position.x;
    const dz = position.z - group.current.position.z;
    const nextWalking = dx * dx + dz * dz > 0.000001;
    if (nextWalking !== walking) setWalking(nextWalking);
    if (nextWalking) group.current.rotation.y = Math.atan2(dx, dz);
    group.current.position.copy(position);
  });
  return <group ref={group} name={name} position={position.toArray()}><FullCharacterGlb outfit={outfit} moving={walking} airborne={false} remote /></group>;
}

export function PlanetPeople() {
  if (getPlanetUniverse() !== 'zombie') return null;
  const survivors = usePlanetPeopleStore((state) => state.survivors);
  return <>
    <PlanetPerson name="planet-girl" outfit="classic-girl" position={girlPosition} />
    {survivors.map((person) => <PlanetPerson key={person.id} name={`planet-survivor-${person.id}`} outfit={person.outfit} position={survivorPositions.get(person.id)!} />)}
  </>;
}
