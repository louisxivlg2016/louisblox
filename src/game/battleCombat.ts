import { Vector3 } from 'three';
import type { World } from 'koota';
import { requestBattleHit } from './battle';
import { useBattleStore } from './battle';
import { isBattleEnemy } from './battleArena';
import type { PlayerSnapshot } from './multiplayer';
import { useRemotePlayerStore } from './multiplayerStore';
import { useGameStore } from './store';

const offset = new Vector3();
const renderedTargets = new Map<string, { position: Vector3; yaw: number; flat: boolean }>();

export function updateBattleTargetPose(playerId: string, position: Vector3, yaw: number, flat: boolean) {
  let target = renderedTargets.get(playerId);
  if (!target) {
    target = { position: new Vector3(), yaw, flat };
    renderedTargets.set(playerId, target);
  }
  target.position.copy(position);
  target.yaw = yaw;
  target.flat = flat;
}

export function removeBattleTargetPose(playerId: string) {
  renderedTargets.delete(playerId);
}

function battleTargetPosition(playerId: string, state: PlayerSnapshot) {
  const rendered = renderedTargets.get(playerId);
  const position = rendered?.position.clone() ?? new Vector3();
  if (!rendered) {
    const seatedHeight = state.mounted && state.vehicleKind !== 'horse' ? state.vehicleKind === 'car' ? 0.9 : 0.7 : 0;
    const lyingHeight = !state.mounted && state.emote === 'lie' ? 0.18 : 0;
    position.set(state.x, state.y + (state.flying ? 1 : 0) + lyingHeight - seatedHeight, state.z);
  }
  if (rendered?.flat ?? (state.flying || (!state.mounted && state.emote === 'lie'))) {
    const yaw = rendered?.yaw ?? state.yaw;
    position.x -= Math.sin(yaw) * 0.9;
    position.z -= Math.cos(yaw) * 0.9;
  } else {
    position.y += 0.9;
  }
  return position;
}

export function findBattleTarget(world: World, origin: Vector3, direction: Vector3, maxDistance = 100) {
  if (useGameStore.getState().gameplayMode !== 'battle') return null;
  const team = useBattleStore.getState().team;
  if (!team) return null;
  let target: { playerId: string; distance: number; position: Vector3 } | null = null;
  let closest = maxDistance;
  for (const [playerId, state] of Object.entries(useRemotePlayerStore.getState().players)) {
    if (!isBattleEnemy(team, useBattleStore.getState().teams[playerId])) continue;
    const position = battleTargetPosition(playerId, state);
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
    if (!isBattleEnemy(team, useBattleStore.getState().teams[playerId])) continue;
    const target = battleTargetPosition(playerId, state);
    if (target.distanceTo(position) <= radius) requestBattleHit(playerId, 'bomb');
  }
}
