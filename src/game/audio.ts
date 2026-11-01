import musicUrl from '../../assets/LouisBlox_Theme.mp3';
import battleMusicUrl from '../../assets/audio/The_Last_Move.mp3';
import type { GameplayMode } from './worldMode';

let music: HTMLAudioElement | null = null;
let mode: GameplayMode = 'creative';
let started = false;

export function setMusicMode(nextMode: GameplayMode) {
  mode = nextMode;
  if (!music) return;
  const source = mode === 'battle' ? battleMusicUrl : musicUrl;
  if (music.dataset.track === source) return;
  music.pause();
  music.src = source;
  music.dataset.track = source;
  if (started) void music.play().catch(() => undefined);
}

export function startMusic() {
  started = true;
  if (!music) {
    music = new Audio();
    music.id = 'background-music';
    music.loop = true;
    music.volume = 0.28;
    music.style.display = 'none';
    document.body.appendChild(music);
  }
  setMusicMode(mode);
  if (music.paused) void music.play().catch(() => undefined);
}
