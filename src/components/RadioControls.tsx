import { nextRadioTrack, toggleVehicleRadio, useRadioStore } from '../game/radio';
import { RADIO_TRACKS } from '../game/radioTracks';
import { translate, useLanguageStore } from '../game/language';
import { useGameStore } from '../game/store';
import { isAnimalMount } from '../game/vehicleTypes';

export function RadioControls() {
  useLanguageStore((state) => state.language);
  const riding = useGameStore((state) => state.riding);
  const mode = useGameStore((state) => state.mode);
  const enabled = useRadioStore((state) => state.enabled);
  const trackIndex = useRadioStore((state) => state.trackIndex);
  if (mode !== 'play' || !riding || isAnimalMount(riding)) return null;
  return (
    <div className="radio-controls">
      <button type="button" className={`radio-toggle ${enabled ? 'active' : ''}`} aria-pressed={enabled} aria-label={enabled ? translate('Arrêter la radio · R', 'Stop radio · R', 'Apagar la radio · R') : translate('Démarrer la radio · R', 'Start radio · R', 'Encender la radio · R')} onClick={toggleVehicleRadio}>Radio · R</button>
      {enabled && <>
        <span className="radio-track" title={RADIO_TRACKS[trackIndex].title}>{RADIO_TRACKS[trackIndex].title}</span>
        <button type="button" className="radio-next" aria-label={translate('Chanson suivante', 'Next song', 'Siguiente canción')} onClick={nextRadioTrack}>→</button>
      </>}
    </div>
  );
}
