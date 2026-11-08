import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Entity } from 'koota';
import type { Group } from 'three';
import { getItemMeta } from '../game/items';
import { useCharacterStore } from '../game/characterStore';
import { useGameStore } from '../game/store';
import { PlayerMesh, PlayerMount, PlayerState, PlayerVelocity } from '../game/traits';
import { blockGeometry, blockMaterials } from '../game/textures';
import { ItemModel, PixelPart, heldItemPosition } from './ItemModel';
import { attachCharacterHand } from '../game/characterRig';
import { BombModel, CandleModel, CampfireModel } from './SpecialBlocks';
import { UtilityBlockModel } from './UtilityBlocks';
import { isUtilityBlock } from '../game/extraBlocks';
import { BlockKind } from '../game/voxel';
import { OUTFITS, selectedWig } from '../game/outfits';
import { CharacterOutfit } from './CharacterOutfit';
import { hasFullCharacter } from './FullCharacterGlb';
import { useEmoteStore } from '../game/emotes';
import { useEatingStore } from '../game/eating';
import { canWalkInVehicle } from '../game/vehicleTypes';
import { appearanceHairColor } from '../game/appearance';

export function PlayerAvatar({ entity, preview = false }: { entity: Entity; preview?: boolean }) {
  const cameraMode = useGameStore((state) => state.cameraMode);
  const sleeping = useGameStore((state) => state.sleepProgress !== null);
  const equipped = useGameStore((state) => state.equippedArmor);
  const selected = useGameStore((state) => state.selected);
  const riding = useGameStore((state) => state.riding);
  const ridingRole = useGameStore((state) => state.ridingRole);
  const walkingCabin = canWalkInVehicle(riding, ridingRole ?? 'driver');
  const character = useCharacterStore((state) => state.character);
  const outfit = useCharacterStore((state) => state.outfit);
  const wig = useCharacterStore((state) => state.wig);
  const appearance = useCharacterStore((state) => state.appearance);
  const hair = appearanceHairColor(appearance, character);
  const emote = useEmoteStore((state) => state.current);
  const eating = useEatingStore((state) => state.eating);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const bodyMesh = useRef<Group>(null);
  const phase = useRef(0);

  useFrame((_, delta) => {
    if (!entity) return;
    if (!preview) {
      const mesh = entity.get(PlayerMesh);
      if (mesh) mesh.value = bodyMesh.current;
    }
    const velocity = entity.get(PlayerVelocity);
    const state = entity.get(PlayerState);
    const mounted = entity.get(PlayerMount)?.vehicle;
    const speed = velocity ? Math.hypot(velocity.x, velocity.z) : 0;
    const moving = !sleeping && (!riding && !mounted || walkingCabin) && state?.grounded && !state.flying && speed > 0.1;
    const waving = emote === 'wave';
    if (waving) phase.current += delta * 10;
    else if (moving) phase.current += delta * (5 + Math.min(speed, 4));
    const swing = moving ? Math.sin(phase.current) * 0.85 : 0;
    const amount = Math.min(1, delta * 12);
    const fullHand = attachCharacterHand(bodyMesh.current, rightArm.current, hasFullCharacter(outfit, wig));
    if (leftArm.current) leftArm.current.rotation.x += (swing - leftArm.current.rotation.x) * amount;
    if (rightArm.current && !fullHand) {
      const bite = eating ? Math.sin(Math.min(1, (performance.now() - eating.startedAt) / 850) * Math.PI) : 0;
      if (eating) rightArm.current.rotation.x = 1.25 + bite * 0.65;
      else rightArm.current.rotation.x += ((waving ? Math.PI : -swing) - rightArm.current.rotation.x) * amount;
      rightArm.current.rotation.z += ((waving ? Math.sin(phase.current) * 0.45 : 0) - rightArm.current.rotation.z) * amount;
    }
    if (leftLeg.current) leftLeg.current.rotation.x += (-swing - leftLeg.current.rotation.x) * amount;
    if (rightLeg.current) rightLeg.current.rotation.x += (swing - rightLeg.current.rotation.x) * amount;
    if (headRef.current && state) {
      const bodyYaw = entity.get(PlayerMesh)?.value?.rotation.y ?? state.yaw;
      const headYaw = Math.atan2(Math.sin(state.yaw - bodyYaw), Math.cos(state.yaw - bodyYaw));
      headRef.current.rotation.order = 'YXZ';
      headRef.current.rotation.y += (headYaw - headRef.current.rotation.y) * amount;
      const pitch = hasFullCharacter(outfit, wig) ? -state.pitch : state.pitch;
      headRef.current.rotation.x += (pitch - headRef.current.rotation.x) * amount;
    }
  });

  if (!entity) return null;
  const armor = equipped ? getItemMeta(`armor_${equipped}`).color : null;
  const girl = character === 'girl';
  const body = armor ?? appearance.clothingColor ?? (outfit === 'default' ? (girl ? '#625887' : '#526b45') : OUTFITS[outfit].body);
  const limbs = armor ?? (outfit === 'default' ? body : appearance.skinColor);
  const legs = armor ?? appearance.clothingColor ?? (outfit === 'default' ? '#38363b' : OUTFITS[outfit].legs);
  const hasWig = selectedWig(outfit, wig) !== null;
  const classicDetails = outfit === 'default' && !armor && (
    <group>
      {girl ? <PixelPart position={[0, 1.14, -0.18]} size={[0.21, 0.58, 0.035]} color="#e0e1e5" /> : <>
        <PixelPart position={[0, 1.47, -0.2]} size={[0.46, 0.17, 0.06]} color="#a83c36" />
        <PixelPart position={[0, 1.05, -0.185]} size={[0.24, 0.52, 0.03]} color="#42494a" />
        <PixelPart position={[0, 1.15, -0.205]} size={[0.1, 0.66, 0.035]} color="#76553b" rotation={[0, 0, -0.42]} />
      </>}
      <PixelPart position={[0, 0.81, 0]} size={[0.58, 0.11, 0.36]} color="#60452f" />
    </group>
  );
  const headContent = (
    <>
      <PixelPart position={[0, 1.7, 0]} size={[0.48, 0.48, 0.48]} color={appearance.skinColor} />
      {!hasWig && (
        <group name="natural-hair">
          <PixelPart position={[0, 1.96, 0]} size={[0.5, 0.1, 0.5]} color={hair} />
          <PixelPart position={[0, 1.75, 0.245]} size={[0.5, 0.35, 0.055]} color={hair} />
          <PixelPart position={[0, 1.88, -0.245]} size={[0.5, 0.12, 0.055]} color={hair} />
        </group>
      )}
      {appearance.hairStyle === 'long' && !hasWig && (
        <>
          <PixelPart position={[0, 1.58, 0.24]} size={[0.5, 0.65, 0.12]} color={hair} />
          <PixelPart position={[-0.24, 1.59, 0.08]} size={[0.1, 0.55, 0.28]} color={hair} />
          <PixelPart position={[0.24, 1.59, 0.08]} size={[0.1, 0.55, 0.28]} color={hair} />
        </>
      )}
      <PixelPart position={[-0.11, 1.805, -0.265]} size={[0.12, 0.035, 0.025]} color={appearance.eyebrowColor ?? hair} />
      <PixelPart position={[0.11, 1.805, -0.265]} size={[0.12, 0.035, 0.025]} color={appearance.eyebrowColor ?? hair} />
      {sleeping ? (
        <>
          <PixelPart position={[-0.11, 1.74, -0.25]} size={[0.1, 0.025, 0.025]} color="#49382f" />
          <PixelPart position={[0.11, 1.74, -0.25]} size={[0.1, 0.025, 0.025]} color="#49382f" />
        </>
      ) : (
        <>
          <PixelPart position={[-0.11, 1.74, -0.25]} size={[0.09, 0.07, 0.025]} color="#f4f4ed" />
          <PixelPart position={[0.11, 1.74, -0.25]} size={[0.09, 0.07, 0.025]} color="#f4f4ed" />
          <PixelPart position={[-0.11, 1.74, -0.27]} size={[0.035, 0.05, 0.02]} color={appearance.eyeColor} />
          <PixelPart position={[0.11, 1.74, -0.27]} size={[0.035, 0.05, 0.02]} color={appearance.eyeColor} />
        </>
      )}
      <PixelPart position={[0, 1.62, -0.27]} size={[0.1, 0.08, 0.08]} color="#d98e9b" />
    </>
  );
  const held = eating?.kind ?? selected;
  return (
    <group
      ref={bodyMesh}
      visible={preview || cameraMode !== 'first' || (riding !== 'plane' && sleeping)}
    >
      {(!hasFullCharacter(outfit, wig) || armor) && <PixelPart position={[0, 1.08, 0]} size={[0.56, 0.66, 0.32]} color={body} />}
      <CharacterOutfit character={character} outfit={outfit} wig={wig} color={appearance.clothingColor} seated={Boolean(riding) && !walkingCabin} head={headContent} headRef={headRef} appearance={appearance} />
      {classicDetails}
      <group ref={leftArm} visible={!hasFullCharacter(outfit, wig)} position={[-0.39, 1.4, 0]}>
        <PixelPart position={[0, -0.33, 0]} size={[0.19, 0.66, 0.21]} color={limbs} />
      </group>
      <group name="right-arm" ref={rightArm} position={[0.39, 1.4, 0]}>
        {!hasFullCharacter(outfit, wig) && <PixelPart position={[0, -0.33, 0]} size={[0.19, 0.66, 0.21]} color={limbs} />}
        <group name="held-item" visible={!eating && !preview} position={heldItemPosition(held, hasFullCharacter(outfit, wig))} scale={typeof held === 'number' ? 0.5 : typeof held === 'string' && getItemMeta(held).category === 'vehicle' ? 0.2 : 0.72}>
          {typeof held === 'number'
            ? held === BlockKind.Tnt ? <BombModel /> : held === BlockKind.Candle ? <CandleModel /> : held === BlockKind.Campfire || held === BlockKind.Wildfire ? <CampfireModel destructive={held === BlockKind.Wildfire} /> : isUtilityBlock(held) ? <UtilityBlockModel kind={held} withLight={false} /> : <mesh args={[blockGeometry, blockMaterials[held]]} />
            : <ItemModel kind={held} flipGuns={!hasFullCharacter(outfit, wig)} />}
        </group>
      </group>
      {eating && <group name="eating-food" position={[0, 1.72, -0.42]} scale={0.65}><ItemModel kind={eating.kind} /></group>}
      {riding && !walkingCabin || emote === 'sit' ? (
        <>
          <group name="left-leg" visible={!hasFullCharacter(outfit, wig)} position={[-0.3, 0.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <PixelPart position={[0, -0.38, 0]} size={[0.23, 0.76, 0.27]} color={legs} />
            <group name="left-knee" position={[0, -0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <PixelPart position={[0, -0.25, 0]} size={[0.23, 0.5, 0.25]} color={legs} />
              <PixelPart position={[0, -0.5, -0.04]} size={[0.25, 0.14, 0.34]} color={armor ?? '#302b2b'} />
            </group>
          </group>
          <group name="right-leg" visible={!hasFullCharacter(outfit, wig)} position={[0.3, 0.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <PixelPart position={[0, -0.38, 0]} size={[0.23, 0.76, 0.27]} color={legs} />
            <group name="right-knee" position={[0, -0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <PixelPart position={[0, -0.25, 0]} size={[0.23, 0.5, 0.25]} color={legs} />
              <PixelPart position={[0, -0.5, -0.04]} size={[0.25, 0.14, 0.34]} color={armor ?? '#302b2b'} />
            </group>
          </group>
        </>
      ) : (
        <>
          <group ref={leftLeg} visible={!hasFullCharacter(outfit, wig)} position={[-0.15, 0.78, 0]}>
            <PixelPart position={[0, -0.38, 0]} size={[0.23, 0.76, 0.27]} color={legs} />
            <PixelPart position={[0, -0.71, -0.04]} size={[0.25, 0.14, 0.34]} color={armor ?? '#302b2b'} />
          </group>
          <group ref={rightLeg} visible={!hasFullCharacter(outfit, wig)} position={[0.15, 0.78, 0]}>
            <PixelPart position={[0, -0.38, 0]} size={[0.23, 0.76, 0.27]} color={legs} />
            <PixelPart position={[0, -0.71, -0.04]} size={[0.25, 0.14, 0.34]} color={armor ?? '#302b2b'} />
          </group>
        </>
      )}
      {armor && (
        <>
          <PixelPart position={[0, 1.97, 0]} size={[0.58, 0.14, 0.58]} color={armor} />
          <PixelPart position={[-0.26, 1.74, 0]} size={[0.09, 0.4, 0.55]} color={armor} />
          <PixelPart position={[0.26, 1.74, 0]} size={[0.09, 0.4, 0.55]} color={armor} />
          <PixelPart position={[0, 1.76, 0.26]} size={[0.52, 0.42, 0.08]} color={armor} />
          <PixelPart position={[0, 1.9, -0.27]} size={[0.56, 0.1, 0.07]} color={armor} />
          <PixelPart position={[0, 1.73, -0.3]} size={[0.055, 0.25, 0.05]} color={armor} />
          <PixelPart position={[0, 1.13, -0.18]} size={[0.4, 0.42, 0.07]} color={armor} />
          <PixelPart position={[-0.4, 1.34, 0]} size={[0.28, 0.2, 0.32]} color={armor} />
          <PixelPart position={[0.4, 1.34, 0]} size={[0.28, 0.2, 0.32]} color={armor} />
        </>
      )}
    </group>
  );
}
