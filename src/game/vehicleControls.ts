import { create } from 'zustand';
import { setLoopSound } from './audio';

type SirenKind = 'police' | 'firetruck';

export const useVehicleControls = create<Record<SirenKind, boolean>>(() => ({ police: false, firetruck: false }));

export function toggleSiren(kind: SirenKind) {
  const enabled = !useVehicleControls.getState()[kind];
  useVehicleControls.setState({ [kind]: enabled });
  setLoopSound(kind === 'police' ? 'policeSiren' : 'fireSiren', enabled, 0.42);
  return enabled;
}

export function stopSirens() {
  useVehicleControls.setState({ police: false, firetruck: false });
  setLoopSound('policeSiren', false);
  setLoopSound('fireSiren', false);
}
