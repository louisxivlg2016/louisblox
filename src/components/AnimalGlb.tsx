import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Group, Mesh, NearestFilter, Vector3 } from 'three';
import type { AnimalKind } from '../game/animals';
import type { Entity } from 'koota';
import { PixelPart } from './ItemModel';
import { matteAnimalMaterial, ReferenceAnimal } from './ReferenceAnimals';
import { AnimalMesh, AnimalMotion, AnimalPosition } from '../game/traits';
import zombieUrl from '../../assets/models/zombie.glb';

useGLTF.preload(zombieUrl);

function ZombieModel({ entity }: { entity: Entity }) {
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const previousPosition = useRef<Vector3 | null>(null);
  const renderYaw = useRef<number | null>(null);
  const { scene } = useGLTF(zombieUrl);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        matteAnimalMaterial(material);
        if (!material.map) continue;
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const scale = 1.9 / Math.max(size.y, 0.001);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    return clone;
  }, [scene]);
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
    if (leftLeg.current) leftLeg.current.rotation.x += (swing - leftLeg.current.rotation.x) * amount;
    if (rightLeg.current) rightLeg.current.rotation.x += (-swing - rightLeg.current.rotation.x) * amount;
  });
  return (
    <group>
      <primitive object={model} />
      <group ref={leftLeg} name="left-leg" position={[-0.17, 0.7, 0]}><PixelPart position={[0, -0.35, 0]} size={[0.27, 0.7, 0.3]} color="#334e8c" /></group>
      <group ref={rightLeg} name="right-leg" position={[0.17, 0.7, 0]}><PixelPart position={[0, -0.35, 0]} size={[0.27, 0.7, 0.3]} color="#334e8c" /></group>
    </group>
  );
}

export function AnimalGlb({ entity, kind }: { entity: Entity; kind: AnimalKind }) {
  if (kind === 'zombie') return <ZombieModel entity={entity} />;
  return <ReferenceAnimal entity={entity} kind={kind} />;
}
