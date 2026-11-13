import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Mesh, NearestFilter, Vector3 } from 'three';
import type { Entity } from 'koota';
import type { Group } from 'three';
import { AnimalMesh, AnimalMotion, AnimalPosition, Trader } from '../game/traits';
import { createCharacterRig } from '../game/characterRig';
import type { AnimalKind } from '../game/animals';
import cowUrl from '../../assets/models/reference-cow.glb';
import chickenUrl from '../../assets/models/reference-chicken.glb';
import sheepUrl from '../../assets/models/reference-sheep.glb';
import pigUrl from '../../assets/models/reference-pig.glb';
import horseUrl from '../../assets/models/reference-horse.glb';
import camelUrl from '../../assets/models/reference-camel.glb';
import duckUrl from '../../assets/models/reference-duck.glb';
import wolfUrl from '../../assets/models/reference-wolf.glb';
import snowWolfUrl from '../../assets/models/reference-snowWolf.glb';
import bearUrl from '../../assets/models/reference-bear.glb';
import snowBearUrl from '../../assets/models/reference-snowBear.glb';
import deerUrl from '../../assets/models/reference-deer.glb';
import snowDeerUrl from '../../assets/models/reference-snowDeer.glb';
import singeUrl from '../../assets/models/reference-singe.glb';
import ocelotUrl from '../../assets/models/reference-ocelot.glb';
import girafeUrl from '../../assets/models/reference-girafe.glb';
import elephantUrl from '../../assets/models/reference-elephant.glb';
import traderUrl from '../../assets/models/full-trader.glb';

const hunyuanAnimals = { cow: cowUrl, chicken: chickenUrl, sheep: sheepUrl, pig: pigUrl, horse: horseUrl, camel: camelUrl, duck: duckUrl, wolf: wolfUrl, snowWolf: snowWolfUrl, bear: bearUrl, snowBear: snowBearUrl, deer: deerUrl, snowDeer: snowDeerUrl, monkey: singeUrl, ocelot: ocelotUrl, giraffe: girafeUrl, elephant: elephantUrl };
for (const model of [...Object.values(hunyuanAnimals), traderUrl]) useGLTF.preload(model);

function useAnimalLegs(entity: Entity, bird = false, yawOffset = 0) {
  const renderPosition = useRef<Vector3 | null>(null);
  const previousPosition = useRef<Vector3 | null>(null);
  const renderYaw = useRef<number | null>(null);
  const phase = useRef(0);
  useFrame((_, delta) => {
    const position = entity.get(AnimalPosition);
    const motion = entity.get(AnimalMotion);
    const mesh = entity.get(AnimalMesh)?.value;
    if (position && mesh) {
      const moved = previousPosition.current ? position.distanceTo(previousPosition.current) : 0;
      if (!previousPosition.current) previousPosition.current = position.clone();
      else previousPosition.current.copy(position);
      const smoothing = 1 - Math.exp(-delta * 30);
      if (!renderPosition.current || renderPosition.current.distanceToSquared(position) > 16) renderPosition.current = position.clone();
      renderPosition.current.lerp(position, smoothing);
      mesh.position.copy(renderPosition.current);
      mesh.userData.actualSpeed = delta > 0 ? moved / delta : 0;
      if (motion) {
        const currentYaw = renderYaw.current ?? motion.displayYaw;
        const targetYaw = motion.displayYaw + yawOffset;
        const angle = Math.atan2(Math.sin(targetYaw - currentYaw), Math.cos(targetYaw - currentYaw));
        renderYaw.current = currentYaw + angle * smoothing;
        mesh.rotation.y = renderYaw.current;
      }
    }
    const moving = (motion?.speed ?? 0) > 0 && (motion?.idle ?? 0) <= 0;
    if (moving) phase.current += delta * (bird ? 10 : 8) * (motion?.running ? 1.5 : 1);
    const swing = moving ? Math.sin(phase.current) * (bird ? 0.35 : motion?.running ? 0.6 : 0.44) : 0;
    for (let index = 0; index < 4; index += 1) {
      const leg = mesh?.getObjectByName(`animal-leg-${index}`);
      if (leg) leg.rotation.x += (swing * (index === 0 || index === 3 ? 1 : -1) - leg.rotation.x) * (1 - Math.exp(-delta * 12));
    }
  });
}

function HunyuanAnimal({ entity, kind }: { entity: Entity; kind: keyof typeof hunyuanAnimals }) {
  const { scene } = useGLTF(hunyuanAnimals[kind]);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material.map) continue;
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    clone.quaternion.identity();
    if (kind === 'camel') clone.position.y += 0.72;
    return clone;
  }, [scene, kind]);
  useAnimalLegs(entity, kind === 'chicken' || kind === 'duck', kind === 'giraffe' ? Math.PI : 0);
  return <group name={`reference-${kind}`} userData={{ source: 'Hunyuan' }}><primitive object={model} /></group>;
}

export function ReferenceAnimal({ entity, kind }: { entity: Entity; kind: AnimalKind }) {
  if (kind in hunyuanAnimals) return <HunyuanAnimal entity={entity} kind={kind as keyof typeof hunyuanAnimals} />;
  return null;
}

type TraderRig = { leftArm?: Group; rightArm?: Group; leftLeg?: Group; rightLeg?: Group };

export function ReferenceTrader({ entity }: { entity: Entity }) {
  const { scene } = useGLTF(traderUrl);
  const character = useMemo(() => {
    const model = createCharacterRig(scene, 'explorer', 1);
    const rig = model.userData.rig as TraderRig;
    if (rig.leftLeg) rig.leftLeg.name = 'trader-left-leg';
    if (rig.rightLeg) rig.rightLeg.name = 'trader-right-leg';
    rig.leftArm?.rotation.set(0, 0, 0);
    rig.rightArm?.rotation.set(0, 0, 0);
    return model;
  }, [scene]);
  const rig = character.userData.rig as TraderRig;
  const phase = useRef(0);
  useFrame((_, delta) => {
    rig.leftArm?.rotation.set(0, 0, 0);
    rig.rightArm?.rotation.set(0, 0, 0);
    if (entity.get(Trader)?.walking) phase.current += delta * 6;
    const swing = entity.get(Trader)?.walking ? Math.sin(phase.current) * 0.42 : 0;
    if (rig.leftLeg) rig.leftLeg.rotation.x = swing;
    if (rig.rightLeg) rig.rightLeg.rotation.x = -swing;
  });
  return <group name="reference-trader" userData={{ source: 'Hunyuan' }}><primitive object={character} /></group>;
}
