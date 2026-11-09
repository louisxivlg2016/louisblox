import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { createPortal, useFrame } from '@react-three/fiber';
import { LoopRepeat, Mesh } from 'three';
import type { Object3D } from 'three';
import { animateCharacterRig, createCharacterRig } from '../game/characterRig';
import type { Ref, ReactNode } from 'react';
import { selectedWig, type OutfitKind, type WigSelection } from '../game/outfits';
import { world } from '../game/world';
import { useEatingStore } from '../game/eating';
import { Player, PlayerMount, PlayerState, PlayerVelocity } from '../game/traits';
import { canWalkInVehicle } from '../game/vehicleTypes';
import { fullCharacterHeights } from '../game/fullCharacters';
import { applyCharacterGesture } from '../game/characterGestures';
import type { EmoteKind } from '../game/emotes';
import type { CharacterAppearance } from '../game/appearance';
import kingUrl from '../../assets/models/full-king.glb';
import militaryUrl from '../../assets/models/full-military.glb';
import knightUrl from '../../assets/models/full-knight.glb';
import explorerUrl from '../../assets/models/full-explorer.glb';
import princessUrl from '../../assets/models/full-princess.glb';
import louis14Url from '../../assets/models/full-louis14.glb';
import louis15Url from '../../assets/models/full-louis15.glb';
import pirateUrl from '../../assets/models/full-pirate.glb';
import footballerUrl from '../../assets/models/full-footballer.glb';
import firefighterUrl from '../../assets/models/full-firefighter.glb';
import policeUrl from '../../assets/models/full-police.glb';
import soldierUrl from '../../assets/models/full-soldier.glb';
import classicGirlUrl from '../../assets/models/full-classic-girl.glb';
import classicBoyUrl from '../../assets/models/full-classic-boy.glb';
import traderUrl from '../../assets/models/full-trader.glb';

type FullCharacterModel = Exclude<OutfitKind, 'default'> | 'classic-girl' | 'classic-boy';
const models = { king: kingUrl, military: militaryUrl, knight: knightUrl, explorer: explorerUrl, princess: princessUrl, louis14: louis14Url, louis15: louis15Url, pirate: pirateUrl, footballer: footballerUrl, firefighter: firefighterUrl, police: policeUrl, soldier: soldierUrl, 'classic-girl': classicGirlUrl, 'classic-boy': classicBoyUrl, trader: traderUrl };

export function hasFullCharacter(outfit: OutfitKind, wig: WigSelection = 'auto') {
  return outfit !== 'default' || selectedWig(outfit, wig) === null;
}

function FullCharacter({ outfit, moving, airborne, remote = false, seated = false, emote = null, headRef, appearance, headAccessory }: { outfit: FullCharacterModel; moving?: boolean; airborne?: boolean; remote?: boolean; seated?: boolean; emote?: EmoteKind | null; headRef?: Ref<Object3D>; appearance?: CharacterAppearance; headAccessory?: ReactNode }) {
  const group = useRef<Object3D>(null);
  const current = useRef('');
  const { scene, animations } = useGLTF(models[outfit]);
  const scale = 2.05 / fullCharacterHeights[outfit];
  const character = useMemo(() => {
    const source = scene.clone(true);
    if (outfit === 'soldier') {
      const sideHair: Object3D[] = [];
      source.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (materials.some((material) => material.name === 'soldier-back-hair')) sideHair.push(object);
      });
      for (const part of sideHair) part.removeFromParent();
    }
    return createCharacterRig(source, outfit === 'classic-girl' || outfit === 'classic-boy' ? 'explorer' : outfit, scale, appearance);
  }, [scene, outfit, scale, appearance?.skinColor, appearance?.hairColor, appearance?.eyeColor, appearance?.eyebrowColor, appearance?.originalHairColor]);
  const { actions } = useAnimations(animations, group);
  const metadata = useMemo(() => ({ outfit: outfit.startsWith('classic-') ? 'default' : outfit, source: 'Hunyuan', whole: true }), [outfit]);
  const eating = useEatingStore((state) => remote ? null : state.eating);

  useEffect(() => {
    const head = character.userData.rig?.head as Object3D | undefined;
    if (typeof headRef === 'function') headRef(head ?? null);
    else if (headRef) headRef.current = head ?? null;
    return () => {
      if (typeof headRef === 'function') headRef(null);
      else if (headRef) headRef.current = null;
    };
  }, [character, headRef]);

  useEffect(() => {
    current.current = '';
    return () => {
      for (const action of Object.values(actions)) action?.stop();
    };
  }, [actions]);

  useFrame((_, delta) => {
    if (!group.current) return;
    const player = world.queryFirst(Player);
    const state = player?.get(PlayerState);
    const velocity = player?.get(PlayerVelocity);
    const mounted = player?.get(PlayerMount);
    const walkingCabin = Boolean(mounted?.kind && canWalkInVehicle(mounted.kind, mounted.role));
    const walking = moving ?? Boolean((!mounted?.vehicle || walkingCabin) && state?.grounded && !state.flying && velocity && Math.hypot(velocity.x, velocity.z) > 0.1);
    const jumping = airborne ?? Boolean(!state?.grounded || state?.flying || Math.abs(velocity?.y ?? 0) > 2);
    const name = jumping ? 'jump' : walking ? 'run' : 'idle';
    const action = actions[name];
    if (eating) {
      current.current = '';
      for (const action of Object.values(actions)) action?.stop();
    } else if (name !== current.current) {
      if (action) {
        actions[current.current]?.fadeOut(0.18);
        action.reset().setLoop(LoopRepeat, Infinity).fadeIn(0.18).play();
      }
      current.current = name;
    }
    group.current.userData.clip = name;
    const sitting = seated || emote === 'sit' || Boolean(mounted?.vehicle && !walkingCabin);
    group.current.userData.gesture = sitting ? 'sit' : emote;
    if (animations.length === 0) {
      const time = performance.now() / 1000;
      group.current.position.y = name === 'run' ? Math.abs(Math.sin(time * 8)) * 0.045 : name === 'idle' ? Math.sin(time * 2) * 0.012 : 0;
      group.current.rotation.z = name === 'run' ? Math.sin(time * 8) * 0.035 : 0;
      group.current.rotation.x = name === 'jump' ? -0.12 : 0;
      animateCharacterRig(character, time, walking, jumping, sitting, Math.min(delta, 0.05), eating);
    } else {
      applyCharacterGesture(character, emote, sitting, !walking && !jumping, performance.now() / 1000, delta);
      if (eating) animateCharacterRig(character, performance.now() / 1000, false, jumping, sitting, Math.min(delta, 0.05), eating);
    }
  });

  const head = character.userData.rig?.head as Object3D | undefined;
  return (
    <group ref={group} name="full-character" userData={metadata}>
      <primitive object={character} scale={scale} rotation={[0, Math.PI, 0]} />
      {headAccessory && head ? createPortal(<group name="costume-wig" position={[0, -head.position.y, 0]}>{headAccessory}</group>, head) : null}
    </group>
  );
}

export function FullCharacterGlb(props: Parameters<typeof FullCharacter>[0]) {
  return <Suspense fallback={null}><FullCharacter {...props} /></Suspense>;
}
