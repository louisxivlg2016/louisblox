import musicUrl from '../../assets/LouisBlox_Theme.mp3';
import battleMusicUrl from '../../assets/audio/The_Last_Move.mp3';
import whistleUrl from '../../son/siflet.mp3';
import policeSirenUrl from '../../son/sirene-de-police.mp3';
import fireSirenUrl from '../../son/sirene-de-pompier.mp3';
import breakBlockUrl from '../../son/son-de-casse-un-bloc.mp3';
import gunshotUrl from '../../son/tire-de-fusil.mp3';
import ballUrl from '../../son/balon.mp3';
import explosionUrl from '../../son/explosion.mp3';
import fireUrl from '../../son/feu.mp3';
import eatUrl from '../../son/manger-bruit.mp3';
import walkUrl from '../../son/marcher.mp3';
import placeBlockUrl from '../../son/placer-un-bloc.mp3';
import waterSplashUrl from "../../son/sauter-dans-l'eau.mp3";
import type { GameplayMode } from './worldMode';
import type { World } from 'koota';
import { Fire, FirePosition, Player, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity } from './traits';
import { getSwimState } from './swimming';
import { getBlockIndex } from './chunks';

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

export type SoundEffect = 'whistle' | 'policeSiren' | 'fireSiren' | 'breakBlock' | 'gunshot' | 'ball' | 'explosion' | 'fire' | 'eat' | 'walk' | 'placeBlock' | 'waterSplash';

const soundUrls: Record<SoundEffect, string> = {
  whistle: whistleUrl,
  policeSiren: policeSirenUrl,
  fireSiren: fireSirenUrl,
  breakBlock: breakBlockUrl,
  gunshot: gunshotUrl,
  ball: ballUrl,
  explosion: explosionUrl,
  fire: fireUrl,
  eat: eatUrl,
  walk: walkUrl,
  placeBlock: placeBlockUrl,
  waterSplash: waterSplashUrl,
};

const audio = new Map<SoundEffect, HTMLAudioElement>();
const loops = new Map<SoundEffect, HTMLAudioElement>();
const waterStates = new WeakMap<object, boolean>();

function sound(name: SoundEffect) {
  let element = audio.get(name);
  if (!element) {
    element = new Audio(soundUrls[name]);
    element.preload = 'auto';
    audio.set(name, element);
  }
  return element;
}

export function playSound(name: SoundEffect, volume = 0.5) {
  if (!started) return;
  const element = sound(name).cloneNode(true) as HTMLAudioElement;
  element.volume = volume;
  element.dataset.effect = name;
  void element.play().catch(() => undefined);
  window.dispatchEvent(new CustomEvent('louisblox-sound', { detail: name }));
}

export function setLoopSound(name: Extract<SoundEffect, 'walk' | 'fire' | 'policeSiren' | 'fireSiren'>, active: boolean, volume = 0.3) {
  const current = loops.get(name);
  if (!active || !started) {
    if (current) current.pause();
    return;
  }
  const element = current ?? sound(name).cloneNode(true) as HTMLAudioElement;
  element.loop = true;
  element.volume = volume;
  loops.set(name, element);
  if (element.paused) void element.play().catch(() => undefined);
}

export function updateWaterSound(world: object, inWater: boolean) {
  if (waterStates.get(world) !== false && inWater) playSound('waterSplash', 0.55);
  waterStates.set(world, inWater);
}

export function playWhistle(kind: 'short' | 'long' | 'goal' = 'short') {
  playSound('whistle', kind === 'long' ? 0.6 : 0.45);
}

export function updateAmbientSounds(world: World, playing: boolean) {
  const playerEntity = world.queryFirst(Player);
  const position = playerEntity?.get(PlayerPosition);
  const state = playerEntity?.get(PlayerState);
  const velocity = playerEntity?.get(PlayerVelocity);
  const mounted = playerEntity?.get(PlayerMount)?.vehicle;
  const walking = Boolean(playing && position && state?.grounded && !state.flying && !mounted && velocity && Math.hypot(velocity.x, velocity.z) > 0.1);
  setLoopSound('walk', walking, 0.32);
  let nearestFire = Infinity;
  if (position && playing) {
    for (const entity of world.query(Fire, FirePosition)) {
      nearestFire = Math.min(nearestFire, entity.get(FirePosition)!.distanceTo(position));
    }
  }
  setLoopSound('fire', nearestFire < 14, Math.max(0.08, 0.48 - nearestFire * 0.025));
  if (position) updateWaterSound(world, playing && getSwimState(getBlockIndex(world), position).inWater);
}
