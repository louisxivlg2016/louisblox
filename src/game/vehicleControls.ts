import { create } from 'zustand';
import type { Entity, World } from 'koota';
import { playCarHorn, setLoopSound } from './audio';
import { useGameStore } from './store';
import { Player, PlayerMount, PlayerPosition, VehiclePosition } from './traits';
import { world } from './world';

type SirenKind = 'firetruck' | 'police';
type VehicleControlState = Record<SirenKind | 'headlights', boolean>;

export const useVehicleControls = create<VehicleControlState>(() => ({ firetruck: false, police: false, headlights: false }));

const SIREN_RANGE = 100;
let sirenVehicle: Entity | null = null;

export function toggleHeadlights() {
  const enabled = !useVehicleControls.getState().headlights;
  useVehicleControls.setState({ headlights: enabled });
  return enabled;
}

export function honk() {
  playCarHorn(useGameStore.getState().riding === 'firetruck' ? 'firetruck' : 'car');
}

export function toggleSiren(kind: SirenKind) {
  const enabled = !useVehicleControls.getState()[kind];
  const other = kind === 'police' ? 'firetruck' : 'police';
  sirenVehicle = enabled ? world.queryFirst(Player)?.get(PlayerMount)?.vehicle ?? null : null;
  useVehicleControls.setState({ [kind]: enabled, [other]: false });
  setLoopSound(other === 'police' ? 'policeSiren' : 'fireSiren', false);
  setLoopSound(kind === 'police' ? 'policeSiren' : 'fireSiren', enabled, 0.42);
  return enabled;
}

export function updateSirenAudibility(currentWorld: World) {
  const controls = useVehicleControls.getState();
  const kind = controls.firetruck ? 'firetruck' : controls.police ? 'police' : null;
  if (!kind) return;
  const player = currentWorld.queryFirst(Player)?.get(PlayerPosition);
  const vehicle = sirenVehicle?.isAlive() ? sirenVehicle.get(VehiclePosition) : undefined;
  const distance = player && vehicle ? player.distanceTo(vehicle) : Infinity;
  setLoopSound(kind === 'police' ? 'policeSiren' : 'fireSiren', distance <= SIREN_RANGE, 0.42 * Math.max(0, 1 - distance / SIREN_RANGE));
}

export function stopSirens() {
  sirenVehicle = null;
  useVehicleControls.setState({ firetruck: false, police: false });
  setLoopSound('fireSiren', false);
  setLoopSound('policeSiren', false);
}
