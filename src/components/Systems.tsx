import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { useWorld } from 'koota/react';
import { streamChunks } from '../game/chunks';
import { useGameStore } from '../game/store';
import { animalCombatSystem } from '../game/systems/animalCombatSystem';
import { animalSystem } from '../game/systems/animalSystem';
import { blockSystem } from '../game/systems/blockSystem';
import { bombSystem, explosionSystem } from '../game/systems/bombSystem';
import { cameraSystem } from '../game/systems/cameraSystem';
import { collisionSystem } from '../game/systems/collisionSystem';
import { environmentSystem } from '../game/systems/environmentSystem';
import { meatDropSystem } from '../game/systems/meatDropSystem';
import { playerSystem } from '../game/systems/playerSystem';
import { saveSystem } from '../game/systems/saveSystem';
import { saplingSystem } from '../game/systems/saplingSystem';
import { waterSystem } from '../game/systems/waterSystem';
import { BlockTarget, Player, PlayerPosition, TargetMesh } from '../game/traits';

export function Systems({ spawn }: { spawn: { x: number; y: number; z: number } }) {
  const world = useWorld();
  const { world: physicsWorld, rapier } = useRapier();
  const controller = useMemo(() => {
    const value = physicsWorld.createCharacterController(0.025);
    value.enableAutostep(1.05, 0.2, true);
    value.enableSnapToGround(0.5);
    value.setMaxSlopeClimbAngle(Math.PI / 4);
    return value;
  }, [physicsWorld]);

  useEffect(() => () => controller.free(), [controller]);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    collisionSystem(world, physicsWorld, rapier);
    if (useGameStore.getState().mode === 'play') {
      playerSystem(world, dt, physicsWorld, controller, spawn);
      cameraSystem(world, camera);
      const animalTarget = animalCombatSystem(world, camera, delta);
      animalSystem(world, dt);
      meatDropSystem(world, dt);
      bombSystem(world, delta);
      explosionSystem(world, delta);
      saplingSystem(world, delta);
      waterSystem(world, delta);
      blockSystem(world, camera, delta, animalTarget);
    } else {
      cameraSystem(world, camera);
      const targetEntity = world.queryFirst(BlockTarget);
      const target = targetEntity?.get(BlockTarget);
      const mesh = targetEntity?.get(TargetMesh)?.value;
      if (target) target.visible = false;
      if (mesh) mesh.visible = false;
      const store = useGameStore.getState();
      if (store.miningProgress !== 0) store.setMiningProgress(0);
    }

    const player = world.queryFirst(Player)?.get(PlayerPosition);
    if (player) streamChunks(world, player.x, player.z);
    environmentSystem(world, delta, camera);
    saveSystem(world, delta);
  });

  return null;
}
