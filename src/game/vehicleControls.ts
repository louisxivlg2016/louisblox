import { create } from 'zustand';
import { setLoopSound } from './audio';

type SirenKind = 'firetruck' | 'police';

export const useVehicleControls = create<Record<SirenKind, boolean>>(() => ({ firetruck: false, police: false }));

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
