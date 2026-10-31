import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useQueryFirst } from 'koota/react';
import type { Group } from 'three';
import { getItemMeta } from '../game/items';
import { useCharacterStore } from '../game/characterStore';
import { useGameStore } from '../game/store';
import { Player, PlayerMesh, PlayerMount, PlayerState, PlayerVelocity } from '../game/traits';
import { blockGeometry, blockMaterials } from '../game/textures';
import { ItemModel, PixelPart } from './ItemModel';
import { BombModel, CandleModel, CampfireModel } from './SpecialBlocks';
import { UtilityBlockModel } from './UtilityBlocks';
import { isUtilityBlock } from '../game/extraBlocks';
import { BlockKind } from '../game/voxel';
import { OUTFITS, selectedWig } from '../game/outfits';
import { CharacterOutfit } from './CharacterOutfit';
import { hasWardrobeModel } from './WardrobeGlb';

export function PlayerAvatar() {
  const entity = useQueryFirst(Player);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const sleeping = useGameStore((state) => state.sleepProgress !== null);
  const equipped = useGameStore((state) => state.equippedArmor);
  const selected = useGameStore((state) => state.selected);
  const riding = useGameStore((state) => state.riding);
  const character = useCharacterStore((state) => state.character);
  const outfit = useCharacterStore((state) => state.outfit);
  const wig = useCharacterStore((state) => state.wig);
  const appearance = useCharacterStore((state) => state.appearance);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const phase = useRef(0);

  useFrame((_, delta) => {
    if (!entity) return;
    const velocity = entity.get(PlayerVelocity);
    const state = entity.get(PlayerState);
    const mounted = entity.get(PlayerMount)?.vehicle;
    const speed = velocity ? Math.hypot(velocity.x, velocity.z) : 0;
    const moving = !sleeping && !riding && !mounted && state?.grounded && !state.flying && speed > 0.1;
    if (moving) phase.current += delta * (5 + Math.min(speed, 4));
    const swing = moving ? Math.sin(phase.current) * 0.85 : 0;
    const amount = Math.min(1, delta * 12);
    if (leftArm.current) leftArm.current.rotation.x += (swing - leftArm.current.rotation.x) * amount;
    if (rightArm.current) rightArm.current.rotation.x += (-swing - rightArm.current.rotation.x) * amount;
    if (leftLeg.current) leftLeg.current.rotation.x += (-swing - leftLeg.current.rotation.x) * amount;
    if (rightLeg.current) rightLeg.current.rotation.x += (swing - rightLeg.current.rotation.x) * amount;
  });

  if (!entity) return null;
  const armor = equipped ? getItemMeta(`armor_${equipped}`).color : null;
  const girl = character === 'girl';
  const body = armor ?? appearance.clothingColor ?? (outfit === 'default' ? (girl ? '#9a5f9f' : '#4d83a7') : OUTFITS[outfit].body);
  const limbs = armor ?? '#e7a0aa';
  const legs = armor ?? appearance.clothingColor ?? (outfit === 'default' ? (girl ? '#4b405e' : '#354d6d') : OUTFITS[outfit].legs);
  const hasWig = selectedWig(outfit, wig) !== null;
  return (
    <group
      ref={(group) => {
        const holder = entity.get(PlayerMesh);
        if (holder) holder.value = group;
      }}
      visible={(cameraMode !== 'first' || sleeping) && riding !== 'plane' && riding !== 'train'}
    >
      {(!hasWardrobeModel(outfit) || armor) && <PixelPart position={[0, 1.08, 0]} size={[0.56, 0.66, 0.32]} color={body} />}
      <PixelPart position={[0, 1.7, 0]} size={[0.48, 0.48, 0.48]} color="#e7a0aa" />
      {!hasWig && <PixelPart position={[0, 1.96, 0]} size={[0.5, 0.1, 0.5]} color={appearance.hairColor} />}
      {appearance.hairStyle === 'long' && !hasWig && (
        <>
          <PixelPart position={[0, 1.58, 0.24]} size={[0.5, 0.65, 0.12]} color={appearance.hairColor} />
          <PixelPart position={[-0.24, 1.59, 0.08]} size={[0.1, 0.55, 0.28]} color={appearance.hairColor} />
          <PixelPart position={[0.24, 1.59, 0.08]} size={[0.1, 0.55, 0.28]} color={appearance.hairColor} />
        </>
      )}
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
      <CharacterOutfit outfit={outfit} wig={wig} color={appearance.clothingColor} />
      <group ref={leftArm} position={[-0.39, 1.4, 0]}>
        <PixelPart position={[0, -0.33, 0]} size={[0.19, 0.66, 0.21]} color={limbs} />
      </group>
      <group ref={rightArm} position={[0.39, 1.4, 0]}>
        <PixelPart position={[0, -0.33, 0]} size={[0.19, 0.66, 0.21]} color={limbs} />
        <group position={[0.13, -0.48, -0.24]} scale={typeof selected === 'string' && getItemMeta(selected).category === 'vehicle' ? 0.2 : 0.72}>
          {typeof selected === 'number'
            ? selected === BlockKind.Tnt ? <BombModel /> : selected === BlockKind.Candle ? <CandleModel /> : selected === BlockKind.Campfire || selected === BlockKind.Wildfire ? <CampfireModel destructive={selected === BlockKind.Wildfire} /> : isUtilityBlock(selected) ? <UtilityBlockModel kind={selected} /> : <mesh args={[blockGeometry, blockMaterials[selected]]} />
            : <ItemModel kind={selected} />}
        </group>
      </group>
      {riding ? (
        <>
          <PixelPart position={[-0.3, 0.58, -0.22]} size={[0.23, 0.25, 0.62]} color={legs} />
          <PixelPart position={[0.3, 0.58, -0.22]} size={[0.23, 0.25, 0.62]} color={legs} />
          <PixelPart position={[-0.3, 0.27, -0.47]} size={[0.23, 0.5, 0.25]} color={legs} />
          <PixelPart position={[0.3, 0.27, -0.47]} size={[0.23, 0.5, 0.25]} color={legs} />
        </>
      ) : (
        <>
          <group ref={leftLeg} position={[-0.15, 0.78, 0]}>
            <PixelPart position={[0, -0.38, 0]} size={[0.23, 0.76, 0.27]} color={legs} />
            <PixelPart position={[0, -0.71, -0.04]} size={[0.25, 0.14, 0.34]} color={armor ?? '#302b2b'} />
          </group>
          <group ref={rightLeg} position={[0.15, 0.78, 0]}>
            <PixelPart position={[0, -0.38, 0]} size={[0.23, 0.76, 0.27]} color={legs} />
            <PixelPart position={[0, -0.71, -0.04]} size={[0.25, 0.14, 0.34]} color={armor ?? '#302b2b'} />
          </group>
        </>
      )}
      {riding && (
        <>
          <PixelPart position={[-0.15, 0.07, -0.04]} size={[0.25, 0.14, 0.34]} color={armor ?? '#302b2b'} />
          <PixelPart position={[0.15, 0.07, -0.04]} size={[0.25, 0.14, 0.34]} color={armor ?? '#302b2b'} />
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
