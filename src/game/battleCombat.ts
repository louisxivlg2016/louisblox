import { Vector3 } from 'three';
import type { World } from 'koota';
import { requestBattleHit } from './battle';
import { useBattleStore } from './battle';
import { useRemotePlayerStore } from './multiplayerStore';
import { useGameStore } from './store';

const offset = new Vector3();

export function findBattleTarget(world: World, origin: Vector3, direction: Vector3, maxDistance = 100) {
  if (useGameStore.getState().gameplayMode !== 'battle') return null;
  const team = useBattleStore.getState().team;
  if (!team) return null;
  let target: { playerId: string; distance: number; position: Vector3 } | null = null;
  let closest = maxDistance;
  for (const [playerId, state] of Object.entries(useRemotePlayerStore.getState().players)) {
    if (!useBattleStore.getState().teams[playerId] || useBattleStore.getState().teams[playerId] === team) continue;
    const position = new Vector3(state.x, state.y + 0.9, state.z);
    offset.copy(position).sub(origin);
    const distance = offset.dot(direction);
    if (distance < 0 || distance >= closest) continue;
    if (offset.lengthSq() - distance * distance > 0.85 * 0.85) continue;
    closest = distance;
    target = { playerId, distance, position };
  }
  return target;
}

export function damageBattlePlayersInRadius(world: World, position: Vector3, radius: number) {
  if (useGameStore.getState().gameplayMode !== 'battle') return;
  const team = useBattleStore.getState().team;
  if (!team) return;
  for (const [playerId, state] of Object.entries(useRemotePlayerStore.getState().players)) {
    if (useBattleStore.getState().teams[playerId] === team) continue;
    const distance = Math.hypot(state.x - position.x, state.y + 0.9 - position.y, state.z - position.z);
    if (distance <= radius) requestBattleHit(playerId, 'bomb');
  }
}
