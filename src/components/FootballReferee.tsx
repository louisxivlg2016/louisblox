import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { useFootballStore } from '../game/footballClient';
import { turnToward } from '../game/rotation';
import { PixelPart } from './ItemModel';

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

export function FootballReferee() {
  const root = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const yellowCard = useRef<Group>(null);
  const redCard = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const step = useRef(0);
  const lastWhistle = useRef(0);
  const signalUntil = useRef(0);
  const target = useMemo(() => new Vector3(4, 8.51, 5), []);

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
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    const signaling = performance.now() < signalUntil.current;
    const showingCard = signaling && match.notice.includes('carton');
    if (yellowCard.current) yellowCard.current.visible = showingCard && !match.notice.includes('rouge');
    if (redCard.current) redCard.current.visible = showingCard && match.notice.includes('rouge');
    if (leftArm.current) leftArm.current.rotation.x = showingCard ? -2.4 : -swing * 0.7;
    if (rightArm.current) rightArm.current.rotation.x = signaling ? -2.4 : swing * 0.7;
    root.current.userData.signal = showingCard ? 'card' : signaling ? 'whistle' : 'watching';
  });

  return (
    <group ref={root} name="football-referee" position={[4, 8.51, 5]} userData={{ role: 'referee', signal: 'watching' }}>
      <group ref={leftLeg} position={[-0.15, 0.76, 0]}>
        <PixelPart position={[0, -0.35, 0]} size={[0.23, 0.7, 0.27]} color="#20252b" />
        <PixelPart position={[0, -0.69, -0.04]} size={[0.25, 0.14, 0.35]} color="#151a20" />
      </group>
      <group ref={rightLeg} position={[0.15, 0.76, 0]}>
        <PixelPart position={[0, -0.35, 0]} size={[0.23, 0.7, 0.27]} color="#20252b" />
        <PixelPart position={[0, -0.69, -0.04]} size={[0.25, 0.14, 0.35]} color="#151a20" />
      </group>
      <PixelPart position={[0, 1.08, 0]} size={[0.58, 0.66, 0.34]} color="#222b34" />
      <PixelPart position={[0, 1.39, -0.18]} size={[0.22, 0.07, 0.035]} color="#f2c94c" />
      <PixelPart position={[0, 0.77, 0]} size={[0.56, 0.09, 0.35]} color="#d5d9d7" />
      <group ref={leftArm} position={[-0.4, 1.4, 0]}>
        <PixelPart position={[0, -0.11, 0]} size={[0.2, 0.3, 0.24]} color="#222b34" />
        <PixelPart position={[0, -0.4, 0]} size={[0.18, 0.3, 0.21]} color="#c9926e" />
        <group ref={yellowCard} name="referee-yellow-card" visible={false}>
          <PixelPart position={[0, -0.61, -0.08]} size={[0.18, 0.24, 0.025]} color="#ffe03e" />
        </group>
        <group ref={redCard} name="referee-red-card" visible={false}>
          <PixelPart position={[0, -0.61, -0.08]} size={[0.18, 0.24, 0.025]} color="#d82934" />
        </group>
      </group>
      <group ref={rightArm} position={[0.4, 1.4, 0]}>
        <PixelPart position={[0, -0.11, 0]} size={[0.2, 0.3, 0.24]} color="#222b34" />
        <PixelPart position={[0, -0.4, 0]} size={[0.18, 0.3, 0.21]} color="#c9926e" />
        <PixelPart position={[0, -0.58, -0.09]} size={[0.09, 0.07, 0.13]} color="#becbd0" />
      </group>
      <PixelPart position={[0, 1.65, 0]} size={[0.46, 0.46, 0.44]} color="#c9926e" />
      <PixelPart position={[0, 1.89, 0]} size={[0.48, 0.09, 0.46]} color="#352b27" />
      <PixelPart position={[0, 1.76, 0.22]} size={[0.47, 0.23, 0.04]} color="#352b27" />
      <PixelPart position={[-0.11, 1.7, -0.23]} size={[0.05, 0.05, 0.025]} color="#242930" />
      <PixelPart position={[0.11, 1.7, -0.23]} size={[0.05, 0.05, 0.025]} color="#242930" />
      <PixelPart position={[0, 1.57, -0.235]} size={[0.13, 0.035, 0.025]} color="#744f42" />
      <PixelPart position={[0, 1.42, -0.2]} size={[0.035, 0.22, 0.025]} color="#d6dfe2" />
      <PixelPart position={[0, 1.31, -0.23]} size={[0.12, 0.08, 0.08]} color="#d6dfe2" />
    </group>
  );
}
