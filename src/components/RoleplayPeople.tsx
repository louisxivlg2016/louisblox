import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Object3D } from 'three';
import type { Group, SpotLight } from 'three';
import { FullCharacterGlb } from './FullCharacterGlb';
import { useRoleplayLifeStore } from '../game/roleplayLife';
import type { RoleplayNpc } from '../game/roleplayLife';
import { useRoleplayStore } from '../game/roleplayClient';
import { useGameStore } from '../game/store';

function RoleplayPerson({ npc }: { npc: RoleplayNpc }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    if (!group.current) return;
    const dx = npc.x - group.current.position.x;
    const dz = npc.z - group.current.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.001) group.current.rotation.y = Math.atan2(dx, dz) + Math.PI;
    group.current.position.set(npc.x, npc.y, npc.z);
  });
  return <group ref={group} name={`roleplay-npc-${npc.id}`} position={[npc.x, npc.y, npc.z]}><FullCharacterGlb outfit={npc.outfit} moving={npc.action !== 'shopping'} airborne={false} remote /></group>;
}

export function RoleplayPeople() {
  const npcs = useRoleplayLifeStore((state) => state.npcs);
  return <>{npcs.map((npc) => <RoleplayPerson key={npc.id} npc={npc} />)}</>;
}

export function RoleplayPoliceLight() {
  const job = useRoleplayStore((state) => state.job);
  const progress = useGameStore((state) => state.environment.dayProgress);
  const camera = useThree((state) => state.camera);
  const target = useMemo(() => new Object3D(), []);
  const light = useRef<SpotLight>(null);
  const visible = job === 'police' && (progress >= 0.75 || progress < 0.22);
  useFrame(() => {
    light.current?.position.copy(camera.position);
    target.position.copy(camera.position);
    target.translateZ(-8);
    target.updateMatrixWorld();
  });
  if (!visible) return null;
  return <>
    <primitive object={target} />
    <spotLight ref={light} name="roleplay-police-flashlight" position={camera.position.toArray()} target={target} color="#fff0bd" intensity={140} distance={28} angle={0.55} penumbra={0.5} decay={2} />
    <pointLight position={camera.position.toArray()} color="#ffe8ad" intensity={12} distance={7} decay={2} />
  </>;
}
