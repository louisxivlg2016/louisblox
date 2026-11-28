import { create } from 'zustand';
import { setMusicSuppressed, useAudioSettings } from './audio';
import { RADIO_TRACKS } from './radioTracks';
import { useGameStore } from './store';
import { isAnimalMount } from './vehicleTypes';
import { world } from './world';
import { Player, PlayerMount, VehicleMotion } from './traits';

let audio: HTMLAudioElement | null = null;

export const useRadioStore = create<{ enabled: boolean; trackIndex: number; outside: boolean }>(() => ({ enabled: false, trackIndex: 0, outside: false }));

function currentTrack() {
  return RADIO_TRACKS[useRadioStore.getState().trackIndex];
}

function syncRadioMotion() {
  const mounted = world.queryFirst(Player)?.get(PlayerMount)?.vehicle;
  const state = useRadioStore.getState();
  if (mounted) mounted.set(VehicleMotion, { radioEnabled: state.enabled, radioTrack: state.trackIndex });
  window.dispatchEvent(new Event('louisblox:radio-sync'));
}

export function syncVehicleRadioPlayback(enabled: boolean, trackIndex: number) {
  const current = useRadioStore.getState();
  if (enabled) {
    if (current.enabled && current.trackIndex === trackIndex) return;
    useRadioStore.setState({ enabled: true, trackIndex, outside: false });
    setMusicSuppressed(true);
    playTrack();
  } else if (current.enabled && !current.outside) {
    useRadioStore.setState({ enabled: false, outside: false });
    audio?.pause();
    setMusicSuppressed(false);
  }
}

export function syncSharedRadioPlayback(enabled: boolean, trackIndex: number) {
  const current = useRadioStore.getState();
  if (enabled) {
    if (current.enabled && current.trackIndex === trackIndex) return;
    useRadioStore.setState({ enabled: true, trackIndex, outside: true });
    setMusicSuppressed(true);
    playTrack();
  } else if (current.enabled) {
    useRadioStore.setState({ enabled: false, outside: false });
    audio?.pause();
    setMusicSuppressed(false);
  }
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
    useRadioStore.setState({ enabled: false, outside: false });
    setMusicSuppressed(false);
  });
}

export function stopVehicleRadio() {
  useRadioStore.setState({ enabled: false, outside: false });
  audio?.pause();
  setMusicSuppressed(false);
  syncRadioMotion();
}

export function nextRadioTrack() {
  selectRadioTrack((useRadioStore.getState().trackIndex + 1) % RADIO_TRACKS.length);
}

export function previousRadioTrack() {
  selectRadioTrack((useRadioStore.getState().trackIndex - 1 + RADIO_TRACKS.length) % RADIO_TRACKS.length);
}

export function selectRadioTrack(index: number, outsideVehicle = false) {
  const trackIndex = Math.max(0, Math.min(RADIO_TRACKS.length - 1, Math.floor(index)));
  useRadioStore.setState({ trackIndex });
  if (useRadioStore.getState().enabled) playTrack();
  else toggleVehicleRadio(outsideVehicle);
  syncRadioMotion();
}

export function toggleVehicleRadio(outsideVehicle = false) {
  if (useRadioStore.getState().enabled) {
    stopVehicleRadio();
    return false;
  }
  const game = useGameStore.getState();
  if (!outsideVehicle && (!game.riding || isAnimalMount(game.riding)) || game.mode !== 'play' || !useAudioSettings.getState().music) return false;
  useRadioStore.setState({ enabled: true, outside: outsideVehicle });
  setMusicSuppressed(true);
  playTrack();
  syncRadioMotion();
  return true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLElement && target.isContentEditable) return;
    if (event.code === 'KeyR') {
      event.preventDefault();
      toggleVehicleRadio(event.ctrlKey);
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
  useGameStore.subscribe((state, previous) => {
    const radio = useRadioStore.getState();
    if (radio.enabled && (state.mode !== 'play' && state.mode !== previous.mode && !state.backpackOpen && !previous.backpackOpen || !radio.outside && (!state.riding || isAnimalMount(state.riding)))) stopVehicleRadio();
  });
  useAudioSettings.subscribe((state) => {
    if (!state.music) stopVehicleRadio();
  });
}
