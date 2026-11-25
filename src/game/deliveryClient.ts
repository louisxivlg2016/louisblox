import { create } from 'zustand';
import type { Camera } from 'three';
import type { World } from 'koota';
import { Vector3 } from 'three';
import { useGameStore } from './store';
import { Player, PlayerPosition } from './traits';
import { DELIVERY_POINTS, DELIVERY_START } from './deliveryCity';
import { useEffectStore } from './effects';
import { getBlockIndex, replaceVoxel } from './chunks';
import { moveVoxelCharacter } from './systems/collisionSystem';
import { raycastVoxel } from './voxel';
import { isDoor, isTrapdoor } from './extraBlocks';
import { isDown, releasePointerForOverlay } from './input';
import { respawnAtBase } from './battle';
import { world } from './world';
import { translate } from './language';

const initial = { phase: 'waiting' as 'waiting' | 'running' | 'finished' | 'lost', startedAt: 0, index: 0, coins: 0, grappleReadyAt: 0 };
export const useDeliveryStore = create<typeof initial>(() => ({ ...initial }));
export function clearDelivery() { useDeliveryStore.setState({ ...initial }); }
const direction = new Vector3();
const grappleDown = new WeakMap<World, boolean>();

export function deliveryControlSystem(world: World, camera: Camera, actions: { place: number; harvest: number; tap: number; interact: number } = { place: 0, harvest: 0, tap: 0, interact: 0 }) {
  if (useGameStore.getState().gameplayMode !== 'delivery') return false;
  let state = useDeliveryStore.getState();
  if (state.phase === 'waiting') {
    respawnAtBase(world, null, DELIVERY_START);
    useEffectStore.getState().activate('speed', 1e9);
    useDeliveryStore.setState({ phase: 'running', startedAt: Date.now() });
    state = useDeliveryStore.getState();
  }
  if (state.phase === 'running' && Date.now() - state.startedAt >= 120000) {
    useDeliveryStore.setState({ phase: 'lost' });
    releasePointerForOverlay();
  }
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player || state.phase !== 'running') return true;
  if (actions.place > 0 || actions.harvest > 0 || actions.tap > 0 || actions.interact > 0) {
    const origin = player.clone();
    origin.y += 1.62;
    camera.getWorldDirection(direction);
    const hit = raycastVoxel(getBlockIndex(world), origin, direction, 4, true);
    if (hit && (isDoor(hit.block.kind) || isTrapdoor(hit.block.kind))) {
      for (let y = hit.y - 2; y <= hit.y + 2; y += 1) {
        const block = getBlockIndex(world).get(`${hit.x},${y},${hit.z}`);
        if (block?.kind === hit.block.kind) replaceVoxel(world, { block, x: hit.x, y, z: hit.z, normal: hit.normal, distance: hit.distance }, block.kind, !hit.block.open, undefined, undefined, undefined, undefined, undefined, undefined, true);
      }
    }
  }
  const point = DELIVERY_POINTS[state.index];
  if (point && Math.hypot(player.x - point.x, player.y - point.y, player.z - point.z) <= 2.5) {
    const index = state.index + 1;
    const coins = state.coins + 500;
    if (index === 1) useGameStore.getState().setNotice(translate('Bottes de vitesse débloquées !', 'Speed boots unlocked!'));
    if (index === 2) {
      useEffectStore.getState().activate('doubleJump', 1e9);
      useGameStore.getState().setNotice(translate('Double saut débloqué !', 'Double jump unlocked!'));
    }
    if (index === 3) useGameStore.getState().setNotice(translate('Grappin débloqué · G pour l’utiliser !', 'Grapple unlocked · press G to use it!'));
    useDeliveryStore.setState({ index, coins, phase: index >= DELIVERY_POINTS.length ? 'finished' : 'running' });
    if (index >= DELIVERY_POINTS.length) releasePointerForOverlay();
  }
  const grapple = isDown('KeyG');
  if (grapple && !grappleDown.get(world) && state.index >= 3 && state.grappleReadyAt <= Date.now()) {
    camera.getWorldDirection(direction);
    moveVoxelCharacter(getBlockIndex(world), player, { x: direction.x * 12, y: Math.max(2, direction.y * 12), z: direction.z * 12 }, false);
    useDeliveryStore.setState({ grappleReadyAt: Date.now() + 15000 });
  }
  grappleDown.set(world, grapple);
  return true;
}
