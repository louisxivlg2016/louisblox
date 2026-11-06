import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Mesh, NearestFilter } from 'three';
import type { Entity } from 'koota';
import type { Group } from 'three';
import { Animal, AnimalMesh, AnimalMotion, AnimalPosition, HorseRider, Trader } from '../game/traits';
import { createCharacterRig } from '../game/characterRig';
import { PixelPart } from './ItemModel';
import type { AnimalKind } from '../game/animals';
import cowUrl from '../../assets/models/reference-cow.glb';
import chickenUrl from '../../assets/models/reference-chicken.glb';
import sheepUrl from '../../assets/models/reference-sheep.glb';
import pigUrl from '../../assets/models/reference-pig.glb';
import camelUrl from '../../assets/models/reference-camel.glb';
import duckUrl from '../../assets/models/reference-duck.glb';
import traderUrl from '../../assets/models/full-trader.glb';

const hunyuanAnimals = { cow: cowUrl, chicken: chickenUrl, sheep: sheepUrl, pig: pigUrl, camel: camelUrl, duck: duckUrl };
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

function Legs({ entity, bird = false }: { entity: Entity; bird?: boolean }) {
  useAnimalLegs(entity, bird);
  const kind = entity.get(Animal)?.kind;
  const color = bird ? '#d5a52f' : kind === 'camel' ? '#b59458' : kind === 'pig' ? '#cb827c' : kind === 'sheep' ? '#c7b09a' : kind === 'cow' ? '#60452f' : '#76513b';
  return <>{[-1, 1].flatMap((side) => [-1, 1].map((front, index) => (
    <group key={`${side}-${front}`} name={`animal-leg-${index}`} position={[side * (bird ? 0.18 : 0.29), bird ? 0.49 : 0.66, front * (bird ? 0.12 : 0.44)]}>
      <PixelPart position={[0, bird ? -0.23 : -0.31, 0]} size={bird ? [0.09, 0.47, 0.1] : [0.24, 0.64, 0.26]} color={color} />
      <PixelPart position={[0, bird ? -0.47 : -0.61, -0.045]} size={bird ? [0.18, 0.09, 0.23] : [0.27, 0.14, 0.3]} color={bird ? '#b88523' : '#302b2b'} />
    </group>
  )))}</>;
}

function Eyes({ y, z, width = 0.2 }: { y: number; z: number; width?: number }) {
  return <>{[-1, 1].map((side) => <group key={side}>
    <PixelPart position={[side * width, y, z]} size={[0.15, 0.15, 0.035]} color="#f2f1e6" />
    <PixelPart position={[side * width, y, z - 0.026]} size={[0.065, 0.1, 0.028]} color="#15221d" />
  </group>)}</>;
}

function Quadruped({ entity, kind }: { entity: Entity; kind: 'cow' | 'horse' | 'pig' | 'sheep' | 'camel' }) {
  const cow = kind === 'cow';
  const horse = kind === 'horse';
  const pig = kind === 'pig';
  const sheep = kind === 'sheep';
  const camel = kind === 'camel';
  const body = cow ? '#60452f' : horse ? '#87573d' : pig ? '#d98d87' : sheep ? '#e0e2dc' : '#c5a264';
  const face = pig ? '#d28b83' : sheep ? '#c7b09a' : body;
  const scale = cow ? 0.85 : horse ? 0.88 : pig ? 0.58 : sheep ? 0.74 : 0.87;
  const mounted = entity.get(HorseRider)?.mounted === true;
  return (
    <group scale={scale} rotation={[0, mounted ? 0 : Math.PI, 0]} name={`reference-${kind}`}>
      <PixelPart position={[0, 0.99, 0.12]} size={[0.96, 0.74, 1.42]} color={body} />
      {!horse && !camel && <PixelPart position={[0, 1.2, -0.87]} size={[0.73, 0.72, 0.74]} color={face} />}
      {!horse && !camel && <PixelPart position={[0, 1.03, -1.29]} size={[0.64, 0.29, 0.26]} color={pig || cow ? '#d99b95' : face} />}
      {!horse && !camel && <Eyes y={1.31} z={-1.255} width={0.21} />}
      <Legs entity={entity} />
      {cow && <>
        <PixelPart position={[0.19, 1.16, -0.89]} size={[0.27, 0.38, 0.75]} color="#e4e4d9" />
        <PixelPart position={[-0.49, 1.07, 0.15]} size={[0.035, 0.4, 0.6]} color="#e6e6dd" />
        <PixelPart position={[0.49, 1.12, -0.17]} size={[0.035, 0.36, 0.43]} color="#e6e6dd" />
        {[-1, 1].map((side) => <PixelPart key={side} position={[side * 0.29, 1.66, -0.77]} size={[0.13, 0.29, 0.14]} color="#e4e1cf" />)}
        <PixelPart position={[0, 0.81, -1.45]} size={[0.3, 0.035, 0.045]} color="#835b53" />
      </>}
      {pig && <>
        {[-1, 1].map((side) => <PixelPart key={side} position={[side * 0.1, 1.04, -1.43]} size={[0.07, 0.1, 0.035]} color="#77483f" />)}
        <PixelPart position={[0, 1.15, 0.94]} size={[0.12, 0.13, 0.28]} color="#c67671" />
      </>}
      {sheep && <>
        <PixelPart position={[0, 1.39, 0.15]} size={[0.88, 0.18, 1.12]} color="#f0f0e6" />
        <PixelPart position={[0, 1.58, -0.87]} size={[0.72, 0.17, 0.69]} color="#eceee6" />
        {[-1, 1].map((side) => <PixelPart key={side} position={[side * 0.41, 1.22, -0.86]} size={[0.23, 0.16, 0.3]} color="#b6a38f" />)}
      </>}
      {horse && <>
        <PixelPart position={[0, 1.38, -0.55]} size={[0.46, 0.78, 0.43]} color="#87573d" />
        <PixelPart position={[0, 1.66, -0.95]} size={[0.58, 0.49, 0.68]} color="#956247" />
        <PixelPart position={[0, 1.63, -1.31]} size={[0.39, 0.28, 0.08]} color="#e3e2d5" />
        <Eyes y={1.76} z={-1.3} width={0.19} />
        <PixelPart position={[0, 1.67, -0.5]} size={[0.17, 0.7, 0.17]} color="#302a26" />
        <PixelPart position={[0, 1.05, 1.02]} size={[0.16, 0.65, 0.2]} color="#302a26" />
        {[-1, 1].map((side) => <PixelPart key={side} position={[side * 0.18, 1.97, -0.88]} size={[0.14, 0.27, 0.15]} color="#754b36" />)}
      </>}
      {camel && <>
        <PixelPart position={[0, 1.52, 0.21]} size={[0.58, 0.45, 0.64]} color="#cda96c" />
        <PixelPart position={[0, 1.48, -0.64]} size={[0.39, 0.89, 0.39]} color="#c5a264" />
        <PixelPart position={[0, 1.84, -0.94]} size={[0.53, 0.47, 0.65]} color="#d0ad74" />
        <PixelPart position={[0, 1.67, -1.3]} size={[0.43, 0.22, 0.24]} color="#b18c5c" />
        <Eyes y={1.93} z={-1.28} width={0.18} />
        {[-1, 1].map((side) => <PixelPart key={side} position={[side * 0.23, 2.13, -0.81]} size={[0.14, 0.22, 0.15]} color="#b3925d" />)}
        <PixelPart position={[0, 0.98, 1.03]} size={[0.12, 0.42, 0.13]} color="#aa8751" />
      </>}
    </group>
  );
}

function Bird({ entity, kind }: { entity: Entity; kind: 'chicken' | 'duck' }) {
  const duck = kind === 'duck';
  return (
    <group scale={duck ? 0.52 : 0.58} rotation={[0, Math.PI, 0]} name={`reference-${kind}`}>
      <PixelPart position={[0, 0.81, 0.06]} size={[0.82, 0.64, 0.91]} color={duck ? '#78543e' : '#e1e3dd'} />
      <PixelPart position={[0, 1.15, -0.35]} size={[0.52, 0.55, 0.52]} color={duck ? '#2e8448' : '#e9ebe4'} />
      <PixelPart position={[0, 1.05, -0.71]} size={[0.39, 0.18, 0.35]} color="#d79e31" />
      <Eyes y={1.23} z={-0.623} width={0.16} />
      {[-1, 1].map((side) => <PixelPart key={side} position={[side * 0.46, 0.85, 0.11]} size={[0.17, 0.4, 0.64]} color={duck ? '#686b69' : '#cbd0c9'} />)}
      <PixelPart position={[0, 0.92, 0.59]} size={[0.25, 0.28, 0.3]} color={duck ? '#5c5e59' : '#d7dcd5'} />
      <Legs entity={entity} bird />
      {!duck && <>
        <PixelPart position={[0, 1.51, -0.33]} size={[0.16, 0.22, 0.16]} color="#c8322d" />
        <PixelPart position={[0, 0.9, -0.58]} size={[0.19, 0.24, 0.15]} color="#c8322d" />
      </>}
      {duck && <PixelPart position={[-0.49, 0.84, 0.15]} size={[0.035, 0.13, 0.36]} color="#7770a6" />}
    </group>
  );
}

function HunyuanAnimal({ entity, kind }: { entity: Entity; kind: keyof typeof hunyuanAnimals }) {
  const { scene } = useGLTF(hunyuanAnimals[kind]);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
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
  return <group name={`reference-${kind}`} rotation={[0, Math.PI, 0]} userData={{ source: 'Hunyuan' }}><primitive object={model} /></group>;
}

export function ReferenceAnimal({ entity, kind }: { entity: Entity; kind: AnimalKind }) {
  if (kind in hunyuanAnimals) return <HunyuanAnimal entity={entity} kind={kind as keyof typeof hunyuanAnimals} />;
  if (kind === 'horse') return <Quadruped entity={entity} kind={kind} />;
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
  return <group name="reference-trader" userData={{ source: 'Hunyuan' }}><primitive object={character} rotation={[0, Math.PI, 0]} /></group>;
}
