import { useGameStore } from '../game/store';
import { toggleSiren, useVehicleControls } from '../game/vehicleControls';

export function SirenButton() {
  const riding = useGameStore((state) => state.riding);
  const kind = riding === 'firetruck' ? riding : null;
  const enabled = useVehicleControls((state) => kind ? state[kind] : false);
  if (!kind) return null;

  return (
    <button
      type="button"
      className={`siren-toggle${enabled ? ' active' : ''}`}
      aria-label={enabled ? 'Couper la sirène' : 'Activer la sirène'}
      aria-pressed={enabled}
      title="Sirène · raccourci L"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        toggleSiren(kind);
      }}
    >
      {enabled ? 'Couper la sirène' : 'Sirène'}
    </button>
  );
}
