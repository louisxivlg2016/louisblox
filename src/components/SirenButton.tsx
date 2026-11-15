import { useGameStore } from '../game/store';
import { toggleSiren, useVehicleControls } from '../game/vehicleControls';

export function SirenButton() {
  const riding = useGameStore((state) => state.riding);
  const kind = riding === 'firetruck' || riding === 'police' ? riding : null;
  const enabled = useVehicleControls((state) => kind ? state[kind] : false);
  if (!kind) return null;

  return (
    <button
      type="button"
      className={`siren-toggle${enabled ? ' active' : ''}`}
      aria-label={enabled ? 'Stop siren' : 'Activate siren'}
      aria-pressed={enabled}
      title="Siren · L shortcut"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        toggleSiren(kind);
      }}
    >
      {enabled ? 'Stop siren' : 'Siren'}
    </button>
  );
}
