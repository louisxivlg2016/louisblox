import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { LoopRepeat } from 'three';
import type { Object3D } from 'three';
import { SkeletonUtils } from 'three-stdlib';
import type { Ref } from 'react';
import type { OutfitKind } from '../game/outfits';
import { world } from '../game/world';
import { Player, PlayerMount, PlayerState, PlayerVelocity } from '../game/traits';
import { fullCharacterHeights } from '../game/fullCharacters';
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

function FullCharacter({ outfit, moving, airborne, remote = false, headRef }: { outfit: Exclude<OutfitKind, 'default'>; moving?: boolean; airborne?: boolean; remote?: boolean; headRef?: Ref<Object3D> }) {
  const group = useRef<Object3D>(null);
  const current = useRef('');
  const { scene, animations } = useGLTF(models[outfit]);
  const character = useMemo(() => remote ? SkeletonUtils.clone(scene) : scene, [scene, remote]);
  const { actions } = useAnimations(animations, group);
  const scale = 2.05 / fullCharacterHeights[outfit];
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

  useEffect(() => () => {
    for (const action of Object.values(actions)) action?.stop();
  }, [actions]);

  useFrame(() => {
    if (!group.current) return;
    const player = world.queryFirst(Player);
    const state = player?.get(PlayerState);
    const velocity = player?.get(PlayerVelocity);
    const mounted = player?.get(PlayerMount)?.vehicle;
    const walking = moving ?? Boolean(!mounted && state?.grounded && !state.flying && velocity && Math.hypot(velocity.x, velocity.z) > 0.1);
    const jumping = airborne ?? Boolean(!state?.grounded || state?.flying || Math.abs(velocity?.y ?? 0) > 2);
    const name = jumping ? 'jump' : walking ? 'run' : 'idle';
    const action = actions[name];
    if (name === current.current || !action) return;
    actions[current.current]?.fadeOut(0.18);
    action.reset().setLoop(LoopRepeat, Infinity).fadeIn(0.18).play();
    group.current.userData.clip = name;
    current.current = name;
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
