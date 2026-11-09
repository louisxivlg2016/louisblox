import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import { CanvasTexture, MathUtils, NearestFilter, SRGBColorSpace } from 'three';
import type { Group, Object3D } from 'three';
import type { Ref, ReactNode } from 'react';
import { PixelPart } from './ItemModel';
import { useEatingStore } from '../game/eating';
import { world } from '../game/world';
import { Player, PlayerMount, PlayerState, PlayerVelocity } from '../game/traits';
import { canWalkInVehicle } from '../game/vehicleTypes';
import type { CharacterAppearance } from '../game/appearance';
import type { EmoteKind } from '../game/emotes';

type FootballerAvatarProps = {
  outfit?: 'footballer';
  moving?: boolean;
  airborne?: boolean;
  remote?: boolean;
  seated?: boolean;
  emote?: EmoteKind | null;
  headRef?: Ref<Object3D>;
  appearance?: CharacterAppearance;
  headAccessory?: ReactNode;
};

function jerseyTexture(color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.fillStyle = color;
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = '#174b87';
  context.fillRect(0, 0, 128, 13);
  context.fillStyle = '#f0f3ed';
  context.fillRect(7, 0, 9, 128);
  context.fillRect(112, 0, 9, 128);
  context.fillStyle = '#d9b84b';
  context.fillRect(96, 25, 12, 15);
  context.fillStyle = '#f7f7ed';
  context.font = 'bold 56px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('10', 64, 76);
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function FootballerAvatar({ moving, airborne, remote = false, seated = false, emote = null, headRef, appearance, headAccessory }: FootballerAvatarProps) {
  const [head, setHead] = useState<Group | null>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const eating = useEatingStore((state) => remote ? null : state.eating);
  const skin = appearance?.skinColor ?? '#f0d0b0';
  const hair = appearance?.originalHairColor ? '#d8b84f' : appearance?.hairColor ?? '#d8b84f';
  const eyes = appearance?.eyeColor ?? '#514532';
  const eyebrows = appearance?.eyebrowColor ?? hair;
  const jersey = appearance?.clothingColor ?? '#2868b3';
  const texture = useMemo(() => jerseyTexture(jersey), [jersey]);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => {
    if (typeof headRef === 'function') headRef(head);
    else if (headRef) headRef.current = head;
    return () => {
      if (typeof headRef === 'function') headRef(null);
      else if (headRef) headRef.current = null;
    };
  }, [head, headRef]);

  useFrame((_, delta) => {
    const player = world.queryFirst(Player);
    const state = player?.get(PlayerState);
    const velocity = player?.get(PlayerVelocity);
    const mounted = player?.get(PlayerMount);
    const walkingCabin = Boolean(mounted?.kind && canWalkInVehicle(mounted.kind, mounted.role));
    const walking = moving ?? Boolean((!mounted?.vehicle || walkingCabin) && state?.grounded && !state.flying && velocity && Math.hypot(velocity.x, velocity.z) > 0.1);
    const jumping = airborne ?? Boolean(!state?.grounded || state?.flying || Math.abs(velocity?.y ?? 0) > 2);
    const sitting = seated || emote === 'sit' || Boolean(mounted?.vehicle && !walkingCabin);
    const time = performance.now() / 1000;
    const swing = walking && !jumping && !sitting ? Math.sin(time * 8) * 0.48 : 0;
    if (leftArm.current) leftArm.current.rotation.x = MathUtils.damp(leftArm.current.rotation.x, swing, 14, delta);
    if (rightArm.current) {
      const bite = eating ? Math.sin(Math.min(1, (performance.now() - eating.startedAt) / 850) * Math.PI) : 0;
      const target = eating ? 1.25 + bite * 0.65 : emote === 'wave' ? 0 : -swing;
      rightArm.current.rotation.x = MathUtils.damp(rightArm.current.rotation.x, target, 14, delta);
      rightArm.current.rotation.z = MathUtils.damp(rightArm.current.rotation.z, emote === 'wave' ? 2.5 + Math.sin(time * 8) * 0.25 : 0, 14, delta);
    }
    if (leftLeg.current) leftLeg.current.rotation.x = MathUtils.damp(leftLeg.current.rotation.x, sitting ? -Math.PI / 2 : -swing, 14, delta);
    if (rightLeg.current) rightLeg.current.rotation.x = MathUtils.damp(rightLeg.current.rotation.x, sitting ? -Math.PI / 2 : swing, 14, delta);
    const avatar = leftArm.current?.parent;
    if (avatar) {
      avatar.userData.clip = jumping ? 'jump' : walking ? 'run' : 'idle';
      avatar.userData.gesture = sitting ? 'sit' : emote;
    }
  });

  return (
    <group name="full-character" userData={{ outfit: 'footballer', source: 'LouisBlox', whole: true, jerseyNumber: 10 }}>
      <PixelPart position={[0, 1.09, 0]} size={[0.6, 0.68, 0.36]} color={jersey} />
      <mesh name="football-shirt" position={[0, 1.09, -0.184]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.56, 0.62]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <PixelPart position={[0, 0.78, 0]} size={[0.59, 0.1, 0.35]} color="#f0f1eb" />
      <PixelPart position={[0, 1.435, 0]} size={[0.2, 0.12, 0.2]} color={skin} />
      <PixelPart position={[0, 1.43, -0.04]} size={[0.2, 0.06, 0.31]} color="#174b87" />
      <group name="head" ref={setHead} position={[0, 1.48, 0]}>
        <PixelPart position={[0, 0.22, 0]} size={[0.48, 0.44, 0.44]} color={skin} />
        <PixelPart position={[0, 0.47, 0]} size={[0.5, 0.12, 0.48]} color={hair} />
        <PixelPart position={[0, 0.3, 0.235]} size={[0.5, 0.35, 0.06]} color={hair} />
        <PixelPart position={[-0.24, 0.31, 0.02]} size={[0.055, 0.31, 0.43]} color={hair} />
        <PixelPart position={[0.24, 0.31, 0.02]} size={[0.055, 0.31, 0.43]} color={hair} />
        <PixelPart position={[0, 0.405, -0.237]} size={[0.5, 0.11, 0.045]} color={hair} />
        <PixelPart position={[-0.105, 0.22, -0.229]} size={[0.095, 0.065, 0.024]} color="#f4f4ed" />
        <PixelPart position={[0.105, 0.22, -0.229]} size={[0.095, 0.065, 0.024]} color="#f4f4ed" />
        <PixelPart position={[-0.105, 0.22, -0.245]} size={[0.036, 0.052, 0.02]} color={eyes} />
        <PixelPart position={[0.105, 0.22, -0.245]} size={[0.036, 0.052, 0.02]} color={eyes} />
        <PixelPart position={[-0.105, 0.295, -0.234]} size={[0.12, 0.032, 0.024]} color={eyebrows} />
        <PixelPart position={[0.105, 0.295, -0.234]} size={[0.12, 0.032, 0.024]} color={eyebrows} />
        <PixelPart position={[0, 0.13, -0.245]} size={[0.1, 0.075, 0.065]} color={skin} />
        <PixelPart position={[0, 0.035, -0.232]} size={[0.13, 0.025, 0.024]} color="#b98473" />
        {headAccessory && head ? createPortal(<group name="costume-wig" position={[0, -1.48, 0]}>{headAccessory}</group>, head) : null}
      </group>
      <group name="left-arm" ref={leftArm} position={[-0.4, 1.37, 0]}>
        <PixelPart position={[0, -0.04, 0]} size={[0.2, 0.2, 0.25]} color={jersey} />
        <PixelPart position={[0, -0.17, 0]} size={[0.212, 0.12, 0.262]} color="#b93832" />
        <PixelPart position={[0, -0.37, 0]} size={[0.18, 0.32, 0.22]} color={skin} />
      </group>
      <group name="right-arm" ref={rightArm} position={[0.4, 1.37, 0]}>
        <PixelPart position={[0, -0.04, 0]} size={[0.2, 0.2, 0.25]} color={jersey} />
        <PixelPart position={[0, -0.34, 0]} size={[0.18, 0.4, 0.22]} color={skin} />
      </group>
      {([['left-leg', leftLeg, -0.15], ['right-leg', rightLeg, 0.15]] as const).map(([name, ref, x]) => (
        <group key={name} name={name} ref={ref} position={[x, 0.76, 0]}>
          <PixelPart position={[0, -0.1, 0]} size={[0.28, 0.28, 0.34]} color="#f0f1eb" />
          <PixelPart position={[0, -0.31, 0]} size={[0.22, 0.16, 0.26]} color={skin} />
          <PixelPart position={[0, -0.48, 0]} size={[0.23, 0.22, 0.27]} color={jersey} />
          <PixelPart position={[0, -0.67, -0.045]} size={[0.26, 0.17, 0.36]} color="#282d39" />
          <PixelPart position={[0, -0.665, -0.23]} size={[0.14, 0.025, 0.018]} color="#aeb8c2" />
        </group>
      ))}
    </group>
  );
}
