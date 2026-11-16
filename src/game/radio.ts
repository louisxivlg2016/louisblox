import { create } from 'zustand';
import { setMusicSuppressed } from './audio';
import { RADIO_TRACKS } from './radioTracks';
import { useGameStore } from './store';
import { isAnimalMount } from './vehicleTypes';

let audio: HTMLAudioElement | null = null;

export const useRadioStore = create<{ enabled: boolean; trackIndex: number }>(() => ({ enabled: false, trackIndex: 0 }));

function currentTrack() {
  return RADIO_TRACKS[useRadioStore.getState().trackIndex];
}

function playTrack() {
  if (typeof document === 'undefined') return;
  if (!audio) {
    audio = new Audio();
    audio.id = 'vehicle-radio';
    audio.volume = 0.48;
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
  const state = useRadioStore.getState();
  const trackIndex = (state.trackIndex + 1) % RADIO_TRACKS.length;
  useRadioStore.setState({ trackIndex });
  if (state.enabled) playTrack();
}

export function toggleVehicleRadio() {
  const game = useGameStore.getState();
  if (!game.riding || isAnimalMount(game.riding) || game.mode !== 'play') return false;
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
    if (event.code !== 'KeyR' || event.repeat) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLElement && target.isContentEditable) return;
    event.preventDefault();
    toggleVehicleRadio();
  });
  useGameStore.subscribe((state) => {
    if (useRadioStore.getState().enabled && (state.mode !== 'play' || !state.riding || isAnimalMount(state.riding))) stopVehicleRadio();
  });
}
