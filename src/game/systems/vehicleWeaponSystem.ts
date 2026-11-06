import type { World } from 'koota';
import { Euler, Vector3 } from 'three';
import type { Camera } from 'three';
import { isMouseButtonDown, stopMining } from '../input';
import { Player, PlayerMount, PlayerState, VehiclePosition } from '../traits';
import { fireProjectile } from './projectileSystem';

const cooldowns = new WeakMap<World, number>();
const direction = new Vector3();

export function vehicleWeaponSystem(world: World, camera: Camera, dt: number, touchTaps = 0) {
  cooldowns.set(world, Math.max(0, (cooldowns.get(world) ?? 0) - dt));
  const player = world.queryFirst(Player);
  const mount = player?.get(PlayerMount);
  if (!player || mount?.kind !== 'cannon' || mount.role !== 'driver' || !mount.vehicle) return false;
  if (cooldowns.get(world)! > 0 || touchTaps === 0 && !isMouseButtonDown(0)) return true;
  const state = player.get(PlayerState);
  if (state) direction.set(0, 0, -1).applyEuler(new Euler(state.pitch, state.yaw, 0, 'YXZ'));
  else camera.getWorldDirection(direction);
  const position = mount.vehicle.get(VehiclePosition)!;
  const origin = new Vector3(0, 1.9, -3.7).applyAxisAngle(new Vector3(0, 1, 0), state?.yaw ?? 0).add(position);
  fireProjectile(world, origin, direction, 'bomb', 3);
  cooldowns.set(world, 1.3);
  stopMining();
  return true;
}
