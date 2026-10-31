import { useFrame } from '@react-three/fiber';
import { useWorld } from 'koota/react';
import { streamChunks } from '../game/chunks';
import { consumeActions } from '../game/input';
import { useGameStore } from '../game/store';
import { animalCombatSystem } from '../game/systems/animalCombatSystem';
import { animalSystem } from '../game/systems/animalSystem';
import { blockSystem } from '../game/systems/blockSystem';
import { bombSystem, explosionSystem } from '../game/systems/bombSystem';
import { cameraSystem } from '../game/systems/cameraSystem';
import { environmentSystem } from '../game/systems/environmentSystem';
import { itemSystem } from '../game/systems/itemSystem';
import { meatDropSystem } from '../game/systems/meatDropSystem';
import { playerSystem } from '../game/systems/playerSystem';
import { projectileSystem } from '../game/systems/projectileSystem';
import { saveSystem } from '../game/systems/saveSystem';
import { saplingSystem } from '../game/systems/saplingSystem';
import { waterSystem } from '../game/systems/waterSystem';
import { fireSystem } from '../game/systems/fireSystem';
import { fishSystem } from '../game/fish';
import { sleepSystem } from '../game/systems/sleepSystem';
import { vehicleInteractionSystem, vehicleMovementSystem } from '../game/vehicles';
import { vehicleCombatSystem } from '../game/systems/vehicleCombatSystem';
import { BlockTarget, Player, PlayerPosition, Sleep, TargetMesh } from '../game/traits';

export function Systems({ spawn }: { spawn: { x: number; y: number; z: number } }) {
  const world = useWorld();

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    if (useGameStore.getState().mode === 'play') {
      const sleeping = world.queryFirst(Sleep) !== undefined;
      const actions = consumeActions();
      playerSystem(world, dt, spawn);
      vehicleMovementSystem(world, dt);
      cameraSystem(world, camera, dt);
      const itemHandled = !sleeping && itemSystem(world, camera, dt, actions);
      const vehicleHandled = !sleeping && !itemHandled && vehicleInteractionSystem(world, actions.place + actions.harvest);
      const vehicleTarget = !sleeping && vehicleCombatSystem(world, camera, dt, actions.tap);
      const animalTarget = !sleeping && !vehicleTarget && animalCombatSystem(world, camera, dt, actions.tap);
      animalSystem(world, dt);
      fishSystem(world, dt);
      meatDropSystem(world, dt);
      bombSystem(world, dt);
      projectileSystem(world, dt);
      explosionSystem(world, dt);
      saplingSystem(world, dt);
      fireSystem(world, dt);
      waterSystem(world, dt);
      sleepSystem(world, dt);
      const remainingActions = sleeping || vehicleHandled || itemHandled ? { place: 0, harvest: 0 } : actions;
      blockSystem(world, camera, dt, animalTarget || vehicleTarget || sleeping, remainingActions);
    } else {
      cameraSystem(world, camera, delta);
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
