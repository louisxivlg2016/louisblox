import { Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { selectedWig } from '../game/outfits';
import type { OutfitKind, WigSelection } from '../game/outfits';
import { world } from '../game/world';
import { Player, PlayerMount, PlayerState, PlayerVelocity, Sleep } from '../game/traits';
import { PixelPart } from './ItemModel';
import { CostumeGlb, WigGlb } from './WardrobeGlb';

function RoyalCape({ color, moving }: { color: string; moving?: boolean }) {
  const cape = useRef<Group>(null);
  const phase = useRef(0);
  useFrame((_, delta) => {
    const player = world.queryFirst(Player);
    const mounted = player?.get(PlayerMount)?.vehicle;
    const state = player?.get(PlayerState);
    const velocity = player?.get(PlayerVelocity);
    const sleeping = world.queryFirst(Sleep) !== undefined;
    const speed = velocity ? Math.hypot(velocity.x, velocity.z) : 0;
    const walking = moving ?? (!mounted && !sleeping && state?.grounded && !state.flying && speed > 0.1);
    phase.current += delta * (walking ? 9 : 1.4);
    if (!cape.current) return;
    const strength = walking ? 1 : 0.15;
    cape.current.rotation.x = 0.08 + Math.sin(phase.current) * 0.16 * strength;
    cape.current.rotation.z = Math.sin(phase.current * 0.65) * 0.04 * strength;
  });
  return (
    <group name="king-cape" ref={cape} position={[0, 1.48, 0.2]}>
      <PixelPart position={[0, -0.44, 0.04]} size={[0.62, 0.92, 0.12]} color={color} />
    </group>
  );
}

function PeriodWig({ large }: { large: boolean }) {
  const colors = large ? ['#3c2a20', '#5a4030', '#4b3528'] : ['#d7d0c3', '#eee9dd', '#c5bcaf'];
  return (
    <>
      <PixelPart position={[0, 1.99, 0]} size={large ? [0.58, 0.22, 0.56] : [0.52, 0.16, 0.5]} color={colors[0]} />
      {[-1, 1].map((side) => Array.from({ length: large ? 4 : 2 }, (_, index) => (
        <PixelPart
          key={`${side}-${index}`}
          position={[side * 0.3, 1.85 - index * 0.17, 0.03]}
          size={large ? [0.17, 0.18, 0.34] : [0.13, 0.16, 0.28]}
          color={colors[index % colors.length]}
        />
      )))}
      <PixelPart position={[0, large ? 1.63 : 1.78, 0.26]} size={large ? [0.52, 0.64, 0.18] : [0.46, 0.28, 0.14]} color={colors[1]} />
    </>
  );
}

export function CharacterOutfit({ outfit, wig = 'auto', color = null, moving }: { outfit: OutfitKind; wig?: WigSelection; color?: string | null; moving?: boolean }) {
  const cape = outfit === 'king' ? <RoyalCape color="#9f3040" moving={moving} />
    : outfit === 'louis14' ? <RoyalCape color="#2d467f" moving={moving} /> : null;
  const selected = selectedWig(outfit, wig);
  const common = (
    <>
      {cape}
      <CostumeGlb kind={outfit} color={color} />
      {selected && <Suspense fallback={<PeriodWig large={selected === 'louis14'} />}><WigGlb kind={selected} /></Suspense>}
    </>
  );
  if (outfit === 'louis14' || outfit === 'louis15') {
    return (
      <>
        {common}
        <PixelPart position={[0, 1.42, -0.18]} size={[0.58, 0.1, 0.08]} color="#f2ead7" />
        <PixelPart position={[0, 1.38, -0.18]} size={[0.58, 0.12, 0.08]} color="#e4bd4d" />
        {[1.08, 1.23].map((y) => <PixelPart key={y} position={[0, y, -0.23]} size={[0.06, 0.06, 0.035]} color="#f4d668" />)}
      </>
    );
  }
  if (outfit === 'king') {
    return (
      <>
        {common}
        <PixelPart position={[0, 1.42, -0.18]} size={[0.56, 0.12, 0.08]} color="#f2ead7" />
        <PixelPart position={[0, 1.38, -0.18]} size={[0.58, 0.12, 0.08]} color="#e4bd4d" />
        {[1.06, 1.2, 1.34].map((y) => <PixelPart key={y} position={[0, y, -0.23]} size={[0.06, 0.06, 0.035]} color="#f4d668" />)}
        <PixelPart position={[0, 2.03, 0]} size={[0.52, 0.12, 0.52]} color="#e4bd4d" />
        {[-0.2, 0, 0.2].map((x) => <PixelPart key={x} position={[x, 2.17, 0]} size={[0.1, 0.22, 0.1]} color="#f4d668" />)}
        <PixelPart position={[0, 2.06, -0.27]} size={[0.1, 0.08, 0.035]} color="#d74343" />
      </>
    );
  }
  if (outfit === 'military') {
    return (
      <>
        {common}
        <PixelPart position={[0, 1.98, 0]} size={[0.56, 0.2, 0.56]} color="#3e5035" />
        <PixelPart position={[0, 1.88, -0.29]} size={[0.55, 0.07, 0.15]} color="#34452d" />
        <PixelPart position={[0, 2.01, -0.29]} size={[0.32, 0.06, 0.035]} color="#72835c" />
        <PixelPart position={[0, 1.15, -0.18]} size={[0.48, 0.45, 0.1]} color="#40523a" />
        {[-0.13, 0.13].map((x) => <PixelPart key={x} position={[x, 1.2, -0.245]} size={[0.13, 0.14, 0.035]} color="#687a55" />)}
        <PixelPart position={[0, 0.82, -0.02]} size={[0.6, 0.1, 0.35]} color="#303b2b" />
      </>
    );
  }
  if (outfit === 'knight') {
    return (
      <>
        {common}
        <PixelPart position={[0, 1.76, 0.2]} size={[0.52, 0.42, 0.16]} color="#a8b7c3" />
        <PixelPart position={[0, 1.96, 0]} size={[0.55, 0.28, 0.55]} color="#b7c5d0" />
        <PixelPart position={[0, 1.73, -0.27]} size={[0.44, 0.1, 0.05]} color="#394752" />
        <PixelPart position={[0, 1.15, -0.18]} size={[0.46, 0.44, 0.09]} color="#c2ccd4" />
        {[-0.36, 0.36].map((x) => <PixelPart key={x} position={[x, 1.34, 0]} size={[0.18, 0.2, 0.36]} color="#a8b7c3" />)}
        <group position={[0.22, 2.14, 0]} rotation={[0, 0, -0.22]}>
          <PixelPart position={[0, 0.12, 0]} size={[0.1, 0.34, 0.1]} color="#d34b58" />
          <PixelPart position={[0.02, 0.31, 0]} size={[0.07, 0.14, 0.07]} color="#f0f3f5" />
        </group>
        <group position={[-0.37, 0.88, -0.02]} rotation={[0, 0, 0.22]}>
          <PixelPart position={[0, -0.2, 0]} size={[0.1, 0.64, 0.07]} color="#dce7ed" />
          <PixelPart position={[0, 0.15, 0]} size={[0.25, 0.07, 0.1]} color="#d8b33f" />
          <PixelPart position={[0, 0.28, 0]} size={[0.07, 0.18, 0.07]} color="#61412b" />
        </group>
      </>
    );
  }
  if (outfit === 'explorer') {
    return (
      <>
        {common}
        <PixelPart position={[0, 1.98, 0]} size={[0.7, 0.08, 0.7]} color="#6c4d2e" />
        <PixelPart position={[0, 2.1, 0]} size={[0.43, 0.2, 0.43]} color="#89643c" />
        <PixelPart position={[0, 2.01, -0.01]} size={[0.46, 0.07, 0.46]} color="#4d3928" />
        <PixelPart position={[0, 1.38, -0.18]} size={[0.58, 0.12, 0.08]} color="#c48a42" />
        <PixelPart position={[0, 1.13, 0.26]} size={[0.48, 0.55, 0.24]} color="#5b4933" />
        <PixelPart position={[0, 1.48, 0.3]} size={[0.6, 0.14, 0.24]} color="#75865a" />
      </>
    );
  }
  if (outfit === 'princess') {
    return (
      <>
        {common}
        <PixelPart position={[0, 1.04, 0]} size={[0.52, 0.28, 0.34]} color="#d68abb" />
        <PixelPart position={[0, 0.79, 0]} size={[0.64, 0.28, 0.42]} color="#c467a5" />
        <PixelPart position={[0, 0.52, 0]} size={[0.76, 0.3, 0.5]} color="#b85494" />
        <PixelPart position={[0, 0.27, 0]} size={[0.9, 0.28, 0.58]} color="#c467a5" />
        <PixelPart position={[0, 0.06, 0]} size={[1, 0.18, 0.66]} color="#d68abb" />
        <PixelPart position={[0, 1.18, -0.02]} size={[0.56, 0.08, 0.36]} color="#e4bd4d" />
        <PixelPart position={[0, 1.36, -0.18]} size={[0.56, 0.1, 0.08]} color="#efbad5" />
        <PixelPart position={[0, 2.04, 0]} size={[0.42, 0.09, 0.42]} color="#e7c455" />
        {[-0.14, 0.14].map((x) => <PixelPart key={x} position={[x, 2.14, 0]} size={[0.09, 0.16, 0.09]} color="#f4d668" />)}
        <PixelPart position={[0, 2.06, -0.23]} size={[0.07, 0.07, 0.035]} color="#f4f0fa" />
      </>
    );
  }
  return common;
}
