import { Suspense, useMemo, useRef } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { useFootballStore } from '../game/footballClient';
import { turnToward } from '../game/rotation';
import { createCharacterRig } from '../game/characterRig';
import { fullCharacterHeights } from '../game/fullCharacters';
import { PixelPart } from './ItemModel';
import refereeUrl from '../../assets/models/full-referee.glb';

useGLTF.preload(refereeUrl);
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

function RefereeModel() {
  const root = useRef<Group>(null);
  const yellowCard = useRef<Group>(null);
  const redCard = useRef<Group>(null);
  const step = useRef(0);
  const lastWhistle = useRef(0);
  const signalUntil = useRef(0);
  const target = useMemo(() => new Vector3(4, 8.51, 5), []);
  const { scene } = useGLTF(refereeUrl);
  const scale = 2.05 / fullCharacterHeights.referee;
  const character = useMemo(() => createCharacterRig(scene, 'explorer', scale), [scene, scale]);
  const rig = character.userData.rig as { leftArm?: Group; rightArm?: Group; leftLeg?: Group; rightLeg?: Group };

  useFrame((_, delta) => {
    if (!root.current) return;
    const match = useFootballStore.getState();
    if (match.whistleToken !== lastWhistle.current) {
      lastWhistle.current = match.whistleToken;
      if (match.whistleToken > 0) signalUntil.current = performance.now() + 1400;
    }
    target.set(clamp(match.ball.x * 0.72 + 4, 23), 8.51, clamp(match.ball.z * 0.72 + 5, 12));
    const distance = Math.hypot(target.x - root.current.position.x, target.z - root.current.position.z);
    root.current.position.lerp(target, 1 - Math.exp(-delta * 1.6));
    root.current.rotation.y = turnToward(root.current.rotation.y, Math.atan2(-(match.ball.x - root.current.position.x), -(match.ball.z - root.current.position.z)), delta * 3);
    step.current += delta * (distance > 0.12 ? 7 : 2);
    const swing = distance > 0.12 ? Math.sin(step.current) * 0.55 : 0;
    if (rig.leftLeg) rig.leftLeg.rotation.x = swing;
    if (rig.rightLeg) rig.rightLeg.rotation.x = -swing;
    const signaling = performance.now() < signalUntil.current;
    const showingCard = signaling && match.notice.includes('carton');
    if (yellowCard.current) yellowCard.current.visible = showingCard && !match.notice.includes('rouge');
    if (redCard.current) redCard.current.visible = showingCard && match.notice.includes('rouge');
    if (rig.leftArm) rig.leftArm.rotation.x = showingCard ? -2.4 : -swing * 0.7;
    if (rig.rightArm) rig.rightArm.rotation.x = signaling ? -2.4 : swing * 0.7;
    root.current.userData.signal = showingCard ? 'card' : signaling ? 'whistle' : 'watching';
  });

  return (
    <group ref={root} name="football-referee" position={[4, 8.51, 5]} userData={{ role: 'referee', signal: 'watching', source: 'Hunyuan' }}>
      <primitive name="referee-model" object={character} scale={scale} rotation={[0, Math.PI, 0]} userData={{ source: 'Hunyuan' }} />
      {rig.leftArm && createPortal(<>
        <group ref={yellowCard} name="referee-yellow-card" visible={false}>
          <PixelPart position={[0, -0.61, 0.12]} size={[0.18, 0.24, 0.025]} color="#ffe03e" />
        </group>
        <group ref={redCard} name="referee-red-card" visible={false}>
          <PixelPart position={[0, -0.61, 0.12]} size={[0.18, 0.24, 0.025]} color="#d82934" />
        </group>
      </>, rig.leftArm)}
      {rig.rightArm && createPortal(<group name="referee-whistle"><PixelPart position={[0, -0.61, 0.12]} size={[0.09, 0.07, 0.13]} color="#becbd0" /></group>, rig.rightArm)}
    </group>
  );
}

export function FootballReferee() {
  return <Suspense fallback={null}><RefereeModel /></Suspense>;
}
