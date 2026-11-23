import { useEffect, useRef } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import type { Group, Object3D } from 'three';
import type { ReactNode, Ref } from 'react';
import { PixelPart } from './ItemModel';
import { useEatingStore } from '../game/eating';
import type { EmoteKind } from '../game/emotes';
import type { CharacterAppearance } from '../game/appearance';
import { appearanceSkinColor } from '../game/appearance';
import { Player, PlayerMount, PlayerState, PlayerVelocity } from '../game/traits';
import { canWalkInVehicle } from '../game/vehicleTypes';
import { world } from '../game/world';

export function MilitaryCharacterGlb({ moving, airborne, remote = false, seated = false, emote = null, headRef, appearance, headAccessory }: { moving?: boolean; airborne?: boolean; remote?: boolean; seated?: boolean; emote?: EmoteKind | null; headRef?: Ref<Object3D>; appearance?: CharacterAppearance; headAccessory?: ReactNode }) {
  const group = useRef<Group>(null);
  const head = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftKnee = useRef<Group>(null);
  const rightKnee = useRef<Group>(null);
  const eating = useEatingStore((state) => remote ? null : state.eating);
  const skin = appearance ? appearanceSkinColor(appearance, 'boy') : '#c9926e';

  useEffect(() => {
    if (typeof headRef === 'function') headRef(head.current);
    else if (headRef) headRef.current = head.current;
    return () => {
      if (typeof headRef === 'function') headRef(null);
      else if (headRef) headRef.current = null;
    };
  }, [headRef]);

  useFrame((_, delta) => {
    const player = world.queryFirst(Player);
    const state = player?.get(PlayerState);
    const velocity = player?.get(PlayerVelocity);
    const mounted = player?.get(PlayerMount);
    const walkingCabin = Boolean(mounted?.kind && canWalkInVehicle(mounted.kind, mounted.role));
    const walking = moving ?? Boolean((!mounted?.vehicle || walkingCabin) && state?.grounded && !state.flying && velocity && Math.hypot(velocity.x, velocity.z) > 0.1);
    const jumping = airborne ?? Boolean(!state?.grounded || state?.flying || Math.abs(velocity?.y ?? 0) > 2);
    const sitting = seated || emote === 'sit' || Boolean(mounted?.vehicle && !walking);
    const movingForward = walking && !jumping && !sitting;
    const time = performance.now() / 1000;
    const swing = movingForward ? Math.sin(time * 8) * 0.48 : 0;
    const amount = Math.min(1, delta * 14);
    const turn = (part: Group | null, target: number) => {
      if (part) part.rotation.x += (target - part.rotation.x) * amount;
    };
    turn(leftArm.current, sitting ? -1.05 : swing);
    if (rightArm.current && eating) {
      const bite = Math.sin(Math.min(1, (performance.now() - eating.startedAt) / 850) * Math.PI);
      rightArm.current.rotation.x = 1.25 + bite * 0.65;
    } else turn(rightArm.current, sitting ? -1.05 : -swing);
    turn(leftLeg.current, sitting ? Math.PI / 2 : -swing * 0.85);
    turn(rightLeg.current, sitting ? Math.PI / 2 : swing * 0.85);
    turn(leftKnee.current, sitting ? -Math.PI / 2 : movingForward ? -Math.max(0, swing) * 0.5 : 0);
    turn(rightKnee.current, sitting ? -Math.PI / 2 : movingForward ? -Math.max(0, -swing) * 0.5 : 0);
    if (group.current) {
      group.current.position.y = sitting ? -0.45 : 0;
      group.current.userData.clip = jumping ? 'jump' : walking ? 'run' : 'idle';
      group.current.userData.gesture = sitting ? 'sit' : emote;
    }
  });

  return (
    <group ref={group} name="full-character" userData={{ outfit: 'military', source: 'Hunyuan', whole: true }}>
      <group ref={head} name="head" position={[0, 1.64, 0]}>
        <PixelPart position={[0, 0, 0]} size={[0.52, 0.52, 0.52]} color={skin} />
        <PixelPart position={[0, 0.27, 0]} size={[0.58, 0.16, 0.58]} color="#405630" />
        <PixelPart position={[0, 0.35, 0]} size={[0.42, 0.1, 0.42]} color="#526b3c" />
        <PixelPart position={[-0.11, 0.03, -0.267]} size={[0.09, 0.06, 0.025]} color="#f4f4ed" />
        <PixelPart position={[0.11, 0.03, -0.267]} size={[0.09, 0.06, 0.025]} color="#f4f4ed" />
        <PixelPart position={[-0.11, 0.03, -0.282]} size={[0.035, 0.045, 0.02]} color="#273b2b" />
        <PixelPart position={[0.11, 0.03, -0.282]} size={[0.035, 0.045, 0.02]} color="#273b2b" />
        {headAccessory && head.current && createPortal(<group name="military-head-accessory">{headAccessory}</group>, head.current)}
      </group>
      <PixelPart position={[0, 1.05, 0]} size={[0.58, 0.68, 0.34]} color="#526b3c" />
      <PixelPart position={[0, 1.08, -0.18]} size={[0.46, 0.36, 0.06]} color="#405630" />
      <group ref={leftArm} name="left-arm" position={[-0.4, 1.36, 0]}>
        <PixelPart position={[0, -0.33, 0]} size={[0.2, 0.66, 0.24]} color="#526b3c" />
        <PixelPart position={[0, -0.59, 0]} size={[0.2, 0.16, 0.24]} color={skin} />
      </group>
      <group ref={rightArm} name="right-arm" position={[0.4, 1.36, 0]}>
        <PixelPart position={[0, -0.33, 0]} size={[0.2, 0.66, 0.24]} color="#526b3c" />
        <PixelPart position={[0, -0.59, 0]} size={[0.2, 0.16, 0.24]} color={skin} />
      </group>
      <group ref={leftLeg} name="left-leg" position={[-0.22, 0.74, 0]}>
        <PixelPart position={[0, -0.36, 0]} size={[0.26, 0.72, 0.3]} color="#405630" />
        <group ref={leftKnee} name="left-knee" position={[0, -0.68, 0]}>
          <PixelPart position={[0, -0.08, -0.04]} size={[0.27, 0.18, 0.34]} color="#293526" />
        </group>
      </group>
      <group ref={rightLeg} name="right-leg" position={[0.22, 0.74, 0]}>
        <PixelPart position={[0, -0.36, 0]} size={[0.26, 0.72, 0.3]} color="#405630" />
        <group ref={rightKnee} name="right-knee" position={[0, -0.68, 0]}>
          <PixelPart position={[0, -0.08, -0.04]} size={[0.27, 0.18, 0.34]} color="#293526" />
        </group>
      </group>
    </group>
  );
}
