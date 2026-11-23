import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Vector3 } from 'three';
import type { AnimalKind } from '../game/animals';
import type { Entity } from 'koota';
import { PixelPart } from './ItemModel';
import { ReferenceAnimal } from './ReferenceAnimals';
import { AnimalMesh, AnimalMotion, AnimalPosition } from '../game/traits';

function ZombieModel({ entity }: { entity: Entity }) {
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const previousPosition = useRef<Vector3 | null>(null);
  const renderYaw = useRef<number | null>(null);
  useFrame(({ clock }, delta) => {
    const motion = entity.get(AnimalMotion);
    const position = entity.get(AnimalPosition);
    const mesh = entity.get(AnimalMesh)?.value;
    let moving = false;
    if (position && mesh) {
      const moved = previousPosition.current ? Math.hypot(position.x - previousPosition.current.x, position.z - previousPosition.current.z) : 0;
      moving = moved > 0.0005;
      if (renderYaw.current === null) renderYaw.current = motion?.displayYaw ?? 0;
      if (moving && previousPosition.current) {
        const movementYaw = Math.atan2(position.x - previousPosition.current.x, position.z - previousPosition.current.z);
        renderYaw.current = movementYaw;
        if (motion) motion.displayYaw = movementYaw;
      }
      if (!previousPosition.current) previousPosition.current = position.clone();
      else previousPosition.current.copy(position);
      mesh.rotation.y = renderYaw.current ?? 0;
    }
    const swing = moving ? Math.sin(clock.elapsedTime * 8) * 0.5 : 0;
    const amount = Math.min(1, delta * 12);
    const arm = moving ? -Math.PI / 2 + swing * 0.12 : 0;
    for (const part of [leftArm.current, rightArm.current]) {
      if (part) part.rotation.x += (arm - part.rotation.x) * amount;
    }
    if (leftLeg.current) leftLeg.current.rotation.x += (swing - leftLeg.current.rotation.x) * amount;
    if (rightLeg.current) rightLeg.current.rotation.x += (-swing - rightLeg.current.rotation.x) * amount;
  });
  return (
    <group>
      <PixelPart position={[0, 1.62, 0]} size={[0.52, 0.52, 0.52]} color="#5a8f4c" />
      <PixelPart position={[-0.11, 1.66, 0.266]} size={[0.1, 0.06, 0.025]} color="#18251b" />
      <PixelPart position={[0.11, 1.66, 0.266]} size={[0.1, 0.06, 0.025]} color="#18251b" />
      <PixelPart position={[0, 1.5, 0.266]} size={[0.2, 0.05, 0.025]} color="#315c35" />
      <PixelPart position={[0, 1.04, 0]} size={[0.58, 0.66, 0.32]} color="#3e8266" />
      <group ref={leftArm} position={[-0.4, 1.34, 0]}>
        <PixelPart position={[0, -0.32, 0]} size={[0.2, 0.64, 0.24]} color="#5a8f4c" />
      </group>
      <group ref={rightArm} position={[0.4, 1.34, 0]}>
        <PixelPart position={[0, -0.32, 0]} size={[0.2, 0.64, 0.24]} color="#5a8f4c" />
      </group>
      <group ref={leftLeg} position={[-0.16, 0.72, 0]}>
        <PixelPart position={[0, -0.36, 0]} size={[0.26, 0.72, 0.3]} color="#334e8c" />
      </group>
      <group ref={rightLeg} position={[0.16, 0.72, 0]}>
        <PixelPart position={[0, -0.36, 0]} size={[0.26, 0.72, 0.3]} color="#334e8c" />
      </group>
    </group>
  );
}

export function AnimalGlb({ entity, kind }: { entity: Entity; kind: AnimalKind }) {
  if (kind === 'zombie') return <ZombieModel entity={entity} />;
  return <ReferenceAnimal entity={entity} kind={kind} />;
}
