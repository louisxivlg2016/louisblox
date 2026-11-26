import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { FullCharacterGlb } from './FullCharacterGlb';
import { useHeistLifeStore } from '../game/heistLife';
import type { HeistCitizen } from '../game/heistLife';

function Citizen({ citizen }: { citizen: HeistCitizen }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    if (!group.current) return;
    group.current.position.set(citizen.x, citizen.y, citizen.z);
    group.current.rotation.y = citizen.yaw + Math.PI;
  });
  return <group ref={group} name={`heist-citizen-${citizen.id}`} position={[citizen.x, citizen.y, citizen.z]}><FullCharacterGlb outfit={citizen.outfit} moving remote /></group>;
}

export function HeistCityLife() {
  const citizens = useHeistLifeStore((state) => state.citizens);
  return <>{citizens.map((citizen) => <Citizen key={citizen.id} citizen={citizen} />)}</>;
}
