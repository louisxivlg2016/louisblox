import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Box3 } from 'three';
import type { Group, Object3D } from 'three';
import type { Ref } from 'react';
import workerUrl from '../../assets/models/full-worker.glb';
import { animateCharacterRig, createCharacterRig } from '../game/characterRig';
import { useEatingStore } from '../game/eating';
import type { EmoteKind } from '../game/emotes';
import { Player, PlayerMount, PlayerState, PlayerVelocity } from '../game/traits';
import { canWalkInVehicle } from '../game/vehicleTypes';
import { world } from '../game/world';

export function WorkerCharacterGlb({ moving, airborne, remote = false, seated = false, emote = null, headRef }: { moving?: boolean; airborne?: boolean; remote?: boolean; seated?: boolean; emote?: EmoteKind | null; headRef?: Ref<Object3D> }) {
  const group = useRef<Group>(null);
  const { scene } = useGLTF(workerUrl);
  const eating = useEatingStore((state) => remote ? null : state.eating);
  const scale = useMemo(() => {
    const bounds = new Box3().setFromObject(scene);
    return 2.05 / Math.max(0.001, bounds.max.y - bounds.min.y);
  }, [scene]);
  const model = useMemo(() => {
    const character = createCharacterRig(scene, 'worker', scale);
    character.name = 'hunyuan-worker-model';
    return character;
  }, [scene, scale]);

  useEffect(() => {
    const head = model.userData.rig?.head as Object3D | undefined;
    if (typeof headRef === 'function') headRef(head ?? null);
    else if (headRef) headRef.current = head ?? null;
    return () => {
      if (typeof headRef === 'function') headRef(null);
      else if (headRef) headRef.current = null;
    };
  }, [model, headRef]);

  useFrame((_, delta) => {
    const player = world.queryFirst(Player);
    const state = player?.get(PlayerState);
    const velocity = player?.get(PlayerVelocity);
    const mounted = player?.get(PlayerMount);
    const walkingCabin = Boolean(mounted?.kind && canWalkInVehicle(mounted.kind, mounted.role));
    const walking = moving ?? Boolean((!mounted?.vehicle || walkingCabin) && state?.grounded && !state.flying && velocity && Math.hypot(velocity.x, velocity.z) > 0.1);
    const jumping = airborne ?? Boolean(!state?.grounded || state?.flying || Math.abs(velocity?.y ?? 0) > 2);
    const sitting = seated || emote === 'sit' || Boolean(mounted?.vehicle && !walking);
    if (group.current) {
      group.current.position.y = sitting ? -0.45 : 0;
      group.current.userData.clip = jumping ? 'jump' : walking ? 'run' : 'idle';
      group.current.userData.gesture = sitting ? 'sit' : emote;
    }
    animateCharacterRig(model, performance.now() / 1000, walking, jumping, sitting, Math.min(delta, 0.05), eating);
  });

  return (
    <group ref={group} name="full-character" userData={{ outfit: 'worker', source: 'Hunyuan', whole: true }}>
      <primitive object={model} scale={scale} rotation={[0, Math.PI, 0]} />
    </group>
  );
}
