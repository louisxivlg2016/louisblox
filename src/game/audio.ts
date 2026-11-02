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

let whistleContext: AudioContext | null = null;

export function playWhistle(kind: 'short' | 'long' | 'goal' = 'short') {
  try {
    whistleContext ??= new AudioContext();
    void whistleContext.resume().catch(() => undefined);
    const duration = kind === 'short' ? 0.18 : kind === 'goal' ? 0.6 : 0.85;
    const start = whistleContext.currentTime;
    for (const frequency of [2350, 2810]) {
      const oscillator = whistleContext.createOscillator();
      const gain = whistleContext.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.linearRampToValueAtTime(frequency * 1.08, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(whistleContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }
  } catch {
    return;
  }
}
