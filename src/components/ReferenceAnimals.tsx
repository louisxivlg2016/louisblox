import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Mesh, NearestFilter } from 'three';
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
import traderUrl from '../../assets/models/full-trader.glb';

const hunyuanAnimals = { cow: cowUrl, chicken: chickenUrl, sheep: sheepUrl, pig: pigUrl, horse: horseUrl, camel: camelUrl, duck: duckUrl, wolf: wolfUrl, snowWolf: snowWolfUrl, bear: bearUrl, snowBear: snowBearUrl, deer: deerUrl, snowDeer: snowDeerUrl };
for (const model of [...Object.values(hunyuanAnimals), traderUrl]) useGLTF.preload(model);

function useAnimalLegs(entity: Entity, bird = false) {
  const last = useRef<{ x: number; z: number } | null>(null);
  const phase = useRef(0);
  useFrame((_, delta) => {
    const position = entity.get(AnimalPosition);
    const motion = entity.get(AnimalMotion);
    const moving = Boolean(position && last.current && Math.hypot(position.x - last.current.x, position.z - last.current.z) > 0.0002 && (motion?.idle ?? 0) <= 0);
    if (position) last.current = { x: position.x, z: position.z };
    if (moving) phase.current += delta * (bird ? 10 : 8);
    const swing = moving ? Math.sin(phase.current) * (bird ? 0.35 : 0.44) : 0;
    for (let index = 0; index < 4; index += 1) {
      const leg = entity.get(AnimalMesh)?.value?.getObjectByName(`animal-leg-${index}`);
      if (leg) leg.rotation.x = swing * (index % 2 === 0 ? 1 : -1);
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
    return clone;
  }, [scene]);
  useAnimalLegs(entity, kind === 'chicken' || kind === 'duck');
  return <group name={`reference-${kind}`} rotation={[0, kind === 'horse' ? 0 : Math.PI, 0]} userData={{ source: 'Hunyuan' }}><primitive object={model} /></group>;
}

export function ReferenceAnimal({ entity, kind }: { entity: Entity; kind: AnimalKind }) {
  if (kind in hunyuanAnimals) return <HunyuanAnimal entity={entity} kind={kind as keyof typeof hunyuanAnimals} />;
  return null;
}

export function ReferenceTrader({ entity }: { entity: Entity }) {
  const { scene } = useGLTF(traderUrl);
  const character = useMemo(() => {
    const model = createCharacterRig(scene, 'explorer', 1);
    const rig = model.userData.rig as { leftLeg?: Group; rightLeg?: Group };
    if (rig.leftLeg) rig.leftLeg.name = 'trader-left-leg';
    if (rig.rightLeg) rig.rightLeg.name = 'trader-right-leg';
    return model;
  }, [scene]);
  const rig = character.userData.rig as { leftLeg?: Group; rightLeg?: Group };
  const phase = useRef(0);
  useFrame((_, delta) => {
    if (entity.get(Trader)?.walking) phase.current += delta * 6;
    const swing = entity.get(Trader)?.walking ? Math.sin(phase.current) * 0.42 : 0;
    if (rig.leftLeg) rig.leftLeg.rotation.x = swing;
    if (rig.rightLeg) rig.rightLeg.rotation.x = -swing;
  });
  return <group name="reference-trader" userData={{ source: 'Hunyuan' }}><primitive object={character} /></group>;
}
