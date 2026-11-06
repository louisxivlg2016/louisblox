import { create } from 'zustand';
import { setLoopSound } from './audio';

type SirenKind = 'firetruck';

export const useVehicleControls = create<Record<SirenKind, boolean>>(() => ({ firetruck: false }));

export function toggleSiren(kind: SirenKind) {
  const enabled = !useVehicleControls.getState()[kind];
  useVehicleControls.setState({ [kind]: enabled });
  setLoopSound('fireSiren', enabled, 0.42);
  return enabled;
}

export function stopSirens() {
  useVehicleControls.setState({ firetruck: false });
  setLoopSound('fireSiren', false);
}
