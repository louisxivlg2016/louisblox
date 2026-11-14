import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { AnimalKind } from '../game/animals';
import type { Entity } from 'koota';
import { PixelPart } from './ItemModel';
import { ReferenceAnimal } from './ReferenceAnimals';
import { AnimalMotion } from '../game/traits';

function ZombieModel({ entity }: { entity: Entity }) {
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  useFrame(({ clock }, delta) => {
    const motion = entity.get(AnimalMotion);
    const swing = motion?.running || (motion?.speed ?? 0) > 0.2 ? Math.sin(clock.elapsedTime * 8) * 0.5 : 0;
    const amount = Math.min(1, delta * 12);
    if (leftLeg.current) leftLeg.current.rotation.x += (swing - leftLeg.current.rotation.x) * amount;
    if (rightLeg.current) rightLeg.current.rotation.x += (-swing - rightLeg.current.rotation.x) * amount;
  });
  return (
    <group>
      <PixelPart position={[0, 1.55, 0]} size={[0.55, 0.55, 0.55]} color="#67945f" />
      <PixelPart position={[0, 1.02, 0]} size={[0.6, 0.65, 0.36]} color="#3b9ca8" />
      <PixelPart position={[-0.43, 1.08, -0.18]} size={[0.24, 0.62, 0.24]} color="#67945f" />
      <PixelPart position={[0.43, 1.08, -0.18]} size={[0.24, 0.62, 0.24]} color="#67945f" />
      <PixelPart position={[-0.13, 1.61, -0.285]} size={[0.09, 0.09, 0.025]} color="#18221b" />
      <PixelPart position={[0.13, 1.61, -0.285]} size={[0.09, 0.09, 0.025]} color="#18221b" />
      <PixelPart position={[0, 1.43, -0.285]} size={[0.17, 0.055, 0.025]} color="#3c5a3b" />
      <group ref={leftLeg} name="left-leg" position={[-0.17, 0.7, 0]}><PixelPart position={[0, -0.35, 0]} size={[0.27, 0.7, 0.3]} color="#334e8c" /></group>
      <group ref={rightLeg} name="right-leg" position={[0.17, 0.7, 0]}><PixelPart position={[0, -0.35, 0]} size={[0.27, 0.7, 0.3]} color="#334e8c" /></group>
    </group>
  );
}

export function AnimalGlb({ entity, kind }: { entity: Entity; kind: AnimalKind }) {
  if (kind === 'zombie') return <ZombieModel entity={entity} />;
  return <ReferenceAnimal entity={entity} kind={kind} />;
}
