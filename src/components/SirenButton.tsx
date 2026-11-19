import { useGameStore } from '../game/store';
import { toggleSiren, useVehicleControls } from '../game/vehicleControls';
import { translate } from '../game/language';

export function SirenButton() {
  const riding = useGameStore((state) => state.riding);
  const kind = riding === 'firetruck' || riding === 'police' ? riding : null;
  const enabled = useVehicleControls((state) => kind ? state[kind] : false);
  if (!kind) return null;

  return (
    <button
      type="button"
      className={`siren-toggle${enabled ? ' active' : ''}`}
      aria-label={enabled ? translate('Couper la sirène', 'Stop siren') : translate('Activer la sirène', 'Activate siren')}
      aria-pressed={enabled}
      title={translate('Sirène · raccourci J', 'Siren · J shortcut')}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        toggleSiren(kind);
      }}
    >
      {enabled ? translate('Couper la sirène', 'Stop siren') : translate('Sirène', 'Siren')}
    </button>
  );
}
