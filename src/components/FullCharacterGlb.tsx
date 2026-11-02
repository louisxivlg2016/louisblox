import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Box3, LoopRepeat, Vector3 } from 'three';
import type { Object3D } from 'three';
import { SkeletonUtils } from 'three-stdlib';
import type { Ref } from 'react';
import type { OutfitKind } from '../game/outfits';
import { world } from '../game/world';
import { Player, PlayerMount, PlayerState, PlayerVelocity } from '../game/traits';
import { fullCharacterHeights } from '../game/fullCharacters';
import { applyCharacterGesture } from '../game/characterGestures';
import type { EmoteKind } from '../game/emotes';
import kingUrl from '../../assets/models/full-king.glb';
import militaryUrl from '../../assets/models/full-military.glb';
import knightUrl from '../../assets/models/full-knight.glb';
import explorerUrl from '../../assets/models/full-explorer.glb';
import princessUrl from '../../assets/models/full-princess.glb';
import louis14Url from '../../assets/models/full-louis14.glb';
import louis15Url from '../../assets/models/full-louis15.glb';

const models = { king: kingUrl, military: militaryUrl, knight: knightUrl, explorer: explorerUrl, princess: princessUrl, louis14: louis14Url, louis15: louis15Url };

export function hasFullCharacter(outfit: OutfitKind) {
  return outfit !== 'default';
}

function FullCharacter({ outfit, moving, airborne, remote = false, seated = false, emote = null, headRef }: { outfit: Exclude<OutfitKind, 'default'>; moving?: boolean; airborne?: boolean; remote?: boolean; seated?: boolean; emote?: EmoteKind | null; headRef?: Ref<Object3D> }) {
  const group = useRef<Object3D>(null);
  const current = useRef('');
  const { scene, animations } = useGLTF(models[outfit]);
  const scale = 2.05 / fullCharacterHeights[outfit];
  const character = useMemo(() => {
    const model = SkeletonUtils.clone(scene);
    const bounds = new Box3().setFromObject(model);
    const center = bounds.getCenter(new Vector3());
    model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    return model;
  }, [scene, scale]);
  const { actions } = useAnimations(animations, group);
  const metadata = useMemo(() => ({ outfit, source: 'Hunyuan', whole: true }), [outfit]);

  useEffect(() => {
    let head: Object3D | undefined;
    character.traverse((object: Object3D) => {
      if (!head && object.type === 'Bone' && /head/i.test(object.name)) head = object;
    });
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
    const mounted = player?.get(PlayerMount)?.vehicle;
    const walking = moving ?? Boolean(!mounted && state?.grounded && !state.flying && velocity && Math.hypot(velocity.x, velocity.z) > 0.1);
    const jumping = airborne ?? Boolean(!state?.grounded || state?.flying || Math.abs(velocity?.y ?? 0) > 2);
    const name = jumping ? 'jump' : walking ? 'run' : 'idle';
    const action = actions[name];
    if (name !== current.current) {
      if (action) {
        actions[current.current]?.fadeOut(0.18);
        action.reset().setLoop(LoopRepeat, Infinity).fadeIn(0.18).play();
      }
      current.current = name;
    }
    group.current.userData.clip = name;
    const sitting = seated || emote === 'sit' || Boolean(mounted);
    group.current.userData.gesture = sitting ? 'sit' : emote;
    if (animations.length === 0) {
      const time = performance.now() / 1000;
      group.current.position.y = name === 'run' ? Math.abs(Math.sin(time * 8)) * 0.045 : name === 'idle' ? Math.sin(time * 2) * 0.012 : 0;
      group.current.rotation.z = name === 'run' ? Math.sin(time * 8) * 0.035 : 0;
      group.current.rotation.x = name === 'jump' ? -0.12 : 0;
    } else {
      applyCharacterGesture(character, emote, sitting, !walking && !jumping, performance.now() / 1000, delta);
    }
  });

  return (
    <group ref={group} name="full-character" userData={metadata}>
      <primitive object={character} scale={scale} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

export function FullCharacterGlb(props: Parameters<typeof FullCharacter>[0]) {
  return <Suspense fallback={null}><FullCharacter {...props} /></Suspense>;
}
