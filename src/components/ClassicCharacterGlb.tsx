import { useEffect, useRef, useState } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import type { Group, Object3D } from 'three';
import type { ReactNode, Ref } from 'react';
import { PixelPart } from './ItemModel';
import { useEatingStore } from '../game/eating';
import type { EmoteKind } from '../game/emotes';
import type { CharacterAppearance } from '../game/appearance';
import { appearanceHairColor, appearanceSkinColor, sanitizeAppearance } from '../game/appearance';
import { Player, PlayerMount, PlayerState, PlayerVelocity } from '../game/traits';
import { canWalkInVehicle } from '../game/vehicleTypes';
import { world } from '../game/world';

export function ClassicCharacterGlb({ outfit = 'default', character = 'boy', moving, airborne, remote = false, seated = false, emote = null, headRef, appearance: requestedAppearance, headAccessory }: { outfit?: 'default' | 'worker'; character?: 'boy' | 'girl'; moving?: boolean; airborne?: boolean; remote?: boolean; seated?: boolean; emote?: EmoteKind | null; headRef?: Ref<Object3D>; appearance?: CharacterAppearance; headAccessory?: ReactNode }) {
  const group = useRef<Group>(null);
  const head = useRef<Group>(null);
  const [headNode, setHeadNode] = useState<Group | null>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftKnee = useRef<Group>(null);
  const rightKnee = useRef<Group>(null);
  const eating = useEatingStore((state) => remote ? null : state.eating);
  const appearance = sanitizeAppearance(requestedAppearance, character);
  const skin = appearanceSkinColor(appearance, character);
  const hair = appearanceHairColor(appearance, character);
  const worker = outfit === 'worker';
  const body = worker ? '#454d50' : appearance.clothingColor ?? (character === 'girl' ? '#625887' : '#526b45');
  const legs = worker ? '#30383c' : appearance.clothingColor ?? '#38363b';

  useEffect(() => {
    setHeadNode(head.current);
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
    <group ref={group} name="full-character" userData={{ outfit, source: 'LouisBlox', whole: true }}>
      <group ref={head} name="head" position={[0, 1.48, 0]}>
        <PixelPart position={[0, 0.22, 0]} size={[0.48, 0.44, 0.44]} color={skin} />
        {!worker && <PixelPart position={[0, 0.47, 0]} size={[0.5, 0.12, 0.48]} color={hair} />}
        {!worker && <PixelPart position={[0, 0.3, 0.235]} size={[0.5, 0.35, 0.06]} color={hair} />}
        {!worker && (character === 'girl' || appearance.hairStyle === 'long') && <>
          <PixelPart position={[-0.24, 0.18, 0.04]} size={[0.055, 0.48, 0.4]} color={hair} />
          <PixelPart position={[0.24, 0.18, 0.04]} size={[0.055, 0.48, 0.4]} color={hair} />
        </>}
        {!worker && <PixelPart position={[0, 0.405, -0.237]} size={[0.5, 0.11, 0.045]} color={hair} />}
        {worker && <>
          <PixelPart position={[0, 0.48, 0]} size={[0.58, 0.14, 0.58]} color="#f3ce35" />
          <PixelPart position={[0, 0.58, 0]} size={[0.4, 0.14, 0.4]} color="#f3ce35" />
          <PixelPart position={[0, 0.48, -0.32]} size={[0.16, 0.1, 0.08]} color="#e8edf0" />
        </>}
        <PixelPart position={[-0.105, 0.22, -0.229]} size={[0.095, 0.065, 0.024]} color="#f4f4ed" />
        <PixelPart position={[0.105, 0.22, -0.229]} size={[0.095, 0.065, 0.024]} color="#f4f4ed" />
        <PixelPart position={[-0.105, 0.22, -0.245]} size={[0.036, 0.052, 0.02]} color={appearance.eyeColor} />
        <PixelPart position={[0.105, 0.22, -0.245]} size={[0.036, 0.052, 0.02]} color={appearance.eyeColor} />
        <PixelPart position={[-0.105, 0.295, -0.234]} size={[0.12, 0.032, 0.024]} color={appearance.eyebrowColor ?? hair} />
        <PixelPart position={[0.105, 0.295, -0.234]} size={[0.12, 0.032, 0.024]} color={appearance.eyebrowColor ?? hair} />
        <PixelPart position={[0, 0.13, -0.245]} size={[0.1, 0.075, 0.065]} color={skin} />
        <PixelPart position={[0, 0.035, -0.232]} size={[0.13, 0.025, 0.024]} color="#b98473" />
        {headAccessory && headNode && createPortal(<group name="costume-wig" position={[0, -1.48, 0]}>{headAccessory}</group>, headNode)}
      </group>
      <PixelPart position={[0, 1.02, 0]} size={[0.58, 0.68, 0.34]} color={body} />
      {worker && <>
        <PixelPart position={[-0.18, 1.02, -0.18]} size={[0.1, 0.66, 0.04]} color="#ed7d24" />
        <PixelPart position={[0.18, 1.02, -0.18]} size={[0.1, 0.66, 0.04]} color="#ed7d24" />
        <PixelPart position={[0, 0.9, -0.205]} size={[0.5, 0.1, 0.04]} color="#e5ec45" />
      </>}
      <group ref={leftArm} name="left-arm" position={[-0.4, 1.32, 0]}>
        <PixelPart position={[0, -0.33, 0]} size={[0.2, 0.66, 0.24]} color={worker ? '#454d50' : body} />
        <PixelPart position={[0, -0.59, 0]} size={[0.2, 0.16, 0.24]} color={skin} />
      </group>
      <group ref={rightArm} name="right-arm" position={[0.4, 1.32, 0]}>
        <PixelPart position={[0, -0.33, 0]} size={[0.2, 0.66, 0.24]} color={worker ? '#454d50' : body} />
        <PixelPart position={[0, -0.59, 0]} size={[0.2, 0.16, 0.24]} color={skin} />
      </group>
      <group ref={leftLeg} name="left-leg" position={[-0.18, 0.72, 0]}>
        <PixelPart position={[0, -0.36, 0]} size={[0.26, 0.72, 0.3]} color={legs} />
        <group ref={leftKnee} name="left-knee" position={[0, -0.68, 0]}><PixelPart position={[0, -0.08, -0.04]} size={[0.27, 0.18, 0.34]} color="#302b2b" /></group>
      </group>
      <group ref={rightLeg} name="right-leg" position={[0.18, 0.72, 0]}>
        <PixelPart position={[0, -0.36, 0]} size={[0.26, 0.72, 0.3]} color={legs} />
        <group ref={rightKnee} name="right-knee" position={[0, -0.68, 0]}><PixelPart position={[0, -0.08, -0.04]} size={[0.27, 0.18, 0.34]} color="#302b2b" /></group>
      </group>
    </group>
  );
}
