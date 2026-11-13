import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { customWorldSpawn } from '../game/customWorld';
import { createEditorCollisionWorld, createEditorPlayer, stepEditorPlayer } from '../game/editorPlayer';
import type { EditorPlayerState } from '../game/editorPlayer';
import { useCharacterStore } from '../game/characterStore';
import { useAvatarStore } from '../game/avatar';
import type { CustomTerrain } from '../game/worldCode';
import type { Voxel } from '../game/voxel';
import { FullCharacterGlb } from './FullCharacterGlb';

export function EditorPlayer({ blocks, terrain, seed, resetKey, keys, spawnPoint }: { blocks: Voxel[]; terrain: CustomTerrain; seed: number; resetKey: number; keys: { current: Set<string> }; spawnPoint?: { x: number; y: number; z: number } | null }) {
  const group = useRef<Group>(null);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as { target: Vector3; update: () => void } | null;
  const character = useCharacterStore((state) => state.character);
  const outfit = useCharacterStore((state) => state.outfit);
  const appearance = useCharacterStore((state) => state.appearance);
  const avatar = useAvatarStore((state) => state.kind);
  const spawn = useMemo(() => customWorldSpawn({ version: 1, source: '', terrain, blocks }, seed), [terrain, blocks, seed]);
  const spawnRef = useRef(spawn);
  spawnRef.current = spawn;
  const collision = useMemo(() => createEditorCollisionWorld(blocks, terrain, seed), [blocks, terrain, seed]);
  const state = useRef<EditorPlayerState>(createEditorPlayer(spawn));
  const previous = useRef(new Vector3(spawn.x, spawn.y, spawn.z));
  const forward = useRef(new Vector3());
  const right = useRef(new Vector3());
  const up = useRef(new Vector3(0, 1, 0));
  const cameraOffset = useRef(new Vector3());
  const flags = useRef({ moving: false, grounded: false });
  const [moving, setMoving] = useState(false);
  const [airborne, setAirborne] = useState(false);

  useEffect(() => {
    const currentSpawn = spawnPoint ?? spawnRef.current;
    state.current = createEditorPlayer(currentSpawn);
    previous.current.set(currentSpawn.x, currentSpawn.y, currentSpawn.z);
    group.current?.position.set(currentSpawn.x, currentSpawn.y, currentSpawn.z);
    if (group.current) group.current.rotation.y = 0;
    if (controls) {
      cameraOffset.current.copy(camera.position).sub(controls.target);
      controls.target.set(currentSpawn.x, currentSpawn.y + 1, currentSpawn.z);
      camera.position.copy(controls.target).add(cameraOffset.current);
      controls.update();
    }
  }, [terrain, resetKey, spawnPoint, camera, controls]);

  useFrame((_, delta) => {
    if (!group.current) return;
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();
    right.current.crossVectors(forward.current, up.current).normalize();
    const forwardInput = Number(keys.current.has('KeyW') || keys.current.has('ArrowUp')) - Number(keys.current.has('KeyS') || keys.current.has('ArrowDown'));
    const rightInput = Number(keys.current.has('KeyD') || keys.current.has('ArrowRight')) - Number(keys.current.has('KeyA') || keys.current.has('ArrowLeft'));
    const current = stepEditorPlayer(state.current, {
      forward: forward.current.z * forwardInput + right.current.z * rightInput,
      right: forward.current.x * forwardInput + right.current.x * rightInput,
      jump: keys.current.has('Space'),
      sprint: keys.current.has('ShiftLeft') || keys.current.has('ShiftRight'),
    }, collision, Math.min(0.05, delta));
    group.current.position.set(current.x, current.y, current.z);
    group.current.rotation.y = current.yaw;
    if (flags.current.moving !== current.moving) {
      flags.current.moving = current.moving;
      setMoving(current.moving);
    }
    if (flags.current.grounded !== current.grounded) {
      flags.current.grounded = current.grounded;
      setAirborne(!current.grounded);
    }
    cameraOffset.current.set(current.x - previous.current.x, current.y - previous.current.y, current.z - previous.current.z);
    if (controls && cameraOffset.current.lengthSq() > 0) {
      camera.position.add(cameraOffset.current);
      controls.target.add(cameraOffset.current);
      controls.update();
    }
    previous.current.set(current.x, current.y, current.z);
  });

  return (
    <group ref={group} name="editor-player" position={[state.current.x, state.current.y, state.current.z]}>
      <FullCharacterGlb outfit={outfit === 'default' ? character === 'girl' ? 'classic-girl' : 'classic-boy' : outfit} moving={moving} airborne={airborne} remote appearance={appearance} profileAvatar={avatar} />
    </group>
  );
}
