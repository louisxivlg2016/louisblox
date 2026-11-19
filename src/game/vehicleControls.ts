import { create } from 'zustand';
import { playCarHorn, setLoopSound } from './audio';

type SirenKind = 'firetruck' | 'police';
type VehicleControlState = Record<SirenKind | 'headlights', boolean>;

export const useVehicleControls = create<VehicleControlState>(() => ({ firetruck: false, police: false, headlights: false }));

export function toggleHeadlights() {
  const enabled = !useVehicleControls.getState().headlights;
  useVehicleControls.setState({ headlights: enabled });
  return enabled;
}

export function honk() {
  playCarHorn();
}

export function toggleSiren(kind: SirenKind) {
  const enabled = !useVehicleControls.getState()[kind];
  const other = kind === 'police' ? 'firetruck' : 'police';
  useVehicleControls.setState({ [kind]: enabled, [other]: false });
  setLoopSound(other === 'police' ? 'policeSiren' : 'fireSiren', false);
  setLoopSound(kind === 'police' ? 'policeSiren' : 'fireSiren', enabled, 0.42);
  return enabled;
}

export function stopSirens() {
  useVehicleControls.setState({ firetruck: false, police: false });
  setLoopSound('fireSiren', false);
  setLoopSound('policeSiren', false);
}
