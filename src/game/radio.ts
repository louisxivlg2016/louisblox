import { create } from 'zustand';
import { setMusicSuppressed, useAudioSettings } from './audio';
import { RADIO_TRACKS } from './radioTracks';
import { useGameStore } from './store';
import { isAnimalMount } from './vehicleTypes';

let audio: HTMLAudioElement | null = null;

export const useRadioStore = create<{ enabled: boolean; trackIndex: number }>(() => ({ enabled: false, trackIndex: 0 }));

function currentTrack() {
  return RADIO_TRACKS[useRadioStore.getState().trackIndex];
}

function playTrack() {
  if (typeof document === 'undefined' || !useAudioSettings.getState().music) return;
  if (!audio) {
    audio = new Audio();
    audio.id = 'vehicle-radio';
    audio.volume = 0.65;
    audio.preload = 'auto';
    audio.addEventListener('ended', () => nextRadioTrack());
    document.body.appendChild(audio);
  }
  audio.src = currentTrack().url;
  void audio.play().catch(() => {
    useRadioStore.setState({ enabled: false });
    setMusicSuppressed(false);
  });
}

export function stopVehicleRadio() {
  useRadioStore.setState({ enabled: false });
  audio?.pause();
  setMusicSuppressed(false);
}

export function nextRadioTrack() {
  selectRadioTrack((useRadioStore.getState().trackIndex + 1) % RADIO_TRACKS.length);
}

export function previousRadioTrack() {
  selectRadioTrack((useRadioStore.getState().trackIndex - 1 + RADIO_TRACKS.length) % RADIO_TRACKS.length);
}

export function selectRadioTrack(index: number) {
  const trackIndex = Math.max(0, Math.min(RADIO_TRACKS.length - 1, Math.floor(index)));
  useRadioStore.setState({ trackIndex });
  if (useRadioStore.getState().enabled) playTrack();
  else toggleVehicleRadio();
}

export function toggleVehicleRadio() {
  const game = useGameStore.getState();
  if (!game.riding || isAnimalMount(game.riding) || game.mode !== 'play' || !useAudioSettings.getState().music) return false;
  if (useRadioStore.getState().enabled) {
    stopVehicleRadio();
    return false;
  }
  useRadioStore.setState({ enabled: true });
  setMusicSuppressed(true);
  playTrack();
  return true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLElement && target.isContentEditable) return;
    if (event.code === 'KeyR') {
      event.preventDefault();
      toggleVehicleRadio();
      return;
    }
    if (!useRadioStore.getState().enabled) return;
    if (event.code === 'KeyD') {
      event.preventDefault();
      event.stopImmediatePropagation();
      nextRadioTrack();
    } else if (event.code === 'KeyK') {
      event.preventDefault();
      event.stopImmediatePropagation();
      previousRadioTrack();
    }
  });
  useGameStore.subscribe((state) => {
    if (useRadioStore.getState().enabled && (state.mode !== 'play' || !state.riding || isAnimalMount(state.riding))) stopVehicleRadio();
  });
  useAudioSettings.subscribe((state) => {
    if (!state.music) stopVehicleRadio();
  });
}
