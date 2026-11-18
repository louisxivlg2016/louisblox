import { useEffect, useRef, useState } from 'react';
import { nextRadioTrack, previousRadioTrack, selectRadioTrack, toggleVehicleRadio, useRadioStore } from '../game/radio';
import { RADIO_TRACKS } from '../game/radioTracks';
import { translate, useLanguageStore } from '../game/language';
import { useGameStore } from '../game/store';
import { isAnimalMount } from '../game/vehicleTypes';
import { normalizeSearch } from '../game/search';
import { useAudioSettings } from '../game/audio';

export function RadioControls() {
  const musicEnabled = useAudioSettings((state) => state.music);
  useLanguageStore((state) => state.language);
  const riding = useGameStore((state) => state.riding);
  const mode = useGameStore((state) => state.mode);
  const enabled = useRadioStore((state) => state.enabled);
  const trackIndex = useRadioStore((state) => state.trackIndex);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if (event.code !== 'KeyH' || event.repeat || !musicEnabled || mode !== 'play' || !riding || isAnimalMount(riding)) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLElement && target.isContentEditable) return;
      event.preventDefault();
      setSearchOpen(true);
      window.requestAnimationFrame(() => {
        searchInput.current?.focus();
        searchInput.current?.select();
      });
    };
    window.addEventListener('keydown', openSearch);
    return () => window.removeEventListener('keydown', openSearch);
  }, [mode, musicEnabled, riding]);
  if (mode !== 'play' || !riding || isAnimalMount(riding)) return null;
  const normalizedQuery = normalizeSearch(query);
  const results = RADIO_TRACKS.map((track, index) => ({ track, index })).filter(({ track }) => normalizeSearch(track.title).includes(normalizedQuery)).slice(0, 6);
  return (
    <div className="radio-controls">
      <button type="button" className={`radio-toggle ${enabled ? 'active' : ''}`} aria-pressed={enabled} aria-label={enabled ? translate('Arrêter la radio · R', 'Stop radio · R', 'Apagar la radio · R') : translate('Démarrer la radio · R', 'Start radio · R', 'Encender la radio · R')} onClick={() => toggleVehicleRadio()} disabled={!musicEnabled}>Radio · R</button>
      {enabled && <>
        <button type="button" className="radio-previous" aria-label={translate('Chanson précédente · K', 'Previous song · K', 'Canción anterior · K')} title={translate('Chanson précédente · K', 'Previous song · K', 'Canción anterior · K')} onClick={previousRadioTrack}>←</button>
        <span className="radio-track" title={RADIO_TRACKS[trackIndex].title}>{RADIO_TRACKS[trackIndex].title}</span>
        <button type="button" className="radio-next" aria-label={translate('Chanson suivante · D', 'Next song · D', 'Siguiente canción · D')} title={translate('Chanson suivante · D', 'Next song · D', 'Siguiente canción · D')} onClick={nextRadioTrack}>→</button>
      </>}
      <div className="radio-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}>
        <input ref={searchInput} type="search" value={query} disabled={!musicEnabled} aria-label={translate('Chercher une chanson', 'Search for a song', 'Buscar una canción')} placeholder={translate('Chercher une chanson · H', 'Search for a song · H', 'Buscar una canción · H')} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} />
        {searchOpen && <div className="radio-search-results" role="listbox">{results.length === 0 ? <span>{translate('Aucune chanson trouvée', 'No songs found', 'No se encontraron canciones')}</span> : results.map(({ track, index }) => <button type="button" role="option" aria-selected={index === trackIndex} key={track.url} onClick={() => { selectRadioTrack(index); setQuery(''); setSearchOpen(false); }}>{track.title}</button>)}</div>}
      </div>
    </div>
  );
}
