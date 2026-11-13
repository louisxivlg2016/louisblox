import musicUrl from '../../assets/LouisBlox_Theme.mp3';
import battleMusicUrl from '../../assets/audio/The_Last_Move.mp3';
import pirateMusicUrl from '../../assets/audio/Salt_On_The_Gunwale.m4a';
import marchMusicUrl from '../../assets/audio/March_to_the_Final_Peak.m4a';
import voxelMusicUrl from '../../assets/audio/Voxel_Ascent.m4a';
import music3Url from '../../son/music3.mp4';
import music4Url from '../../son/music4.mp4';
import music5Url from '../../son/music5.mp4';
import music6Url from '../../son/music6.mp4';
import music7Url from '../../son/music7.mp4';
import music8Url from '../../son/music8.mp4';
import whistleUrl from '../../son/siflet.mp3';
import fireSirenUrl from '../../son/sirene-de-pompier.mp3';
import breakBlockUrl from '../../son/son-de-casse-un-bloc.mp3';
import breakGlassUrl from '../../son/casse-du-verre.mp3';
import breakWoodUrl from '../../son/casse-du-bois.mp3';
import gunshotUrl from '../../son/tire-de-fusil.mp3';
import ballUrl from '../../son/balon.mp3';
import explosionUrl from '../../son/explosion.mp3';
import fireUrl from '../../son/feu.mp3';
import eatUrl from '../../son/manger.mp3';
import walkUrl from '../../son/marcher.mp3';
import placeBlockUrl from '../../son/placer-un-bloc.mp3';
import waterSplashUrl from "../../son/sauter-dans-l'eau.mp3";
import duckSoundUrl from '../../son/bruit-canard.mp3';
import horseSoundUrl from '../../son/bruit-cheval.mp3';
import pigSoundUrl from '../../son/bruit-cochon.mp3';
import sheepSoundUrl from '../../son/bruit-de-mouton.mp3';
import cowSoundUrl from '../../son/bruit-de-vache.mp3';
import elephantSoundUrl from '../../son/bruit-elephant.mp3';
import ocelotSoundUrl from '../../son/bruit-leopard.mp3';
import wolfSoundUrl from '../../son/bruit-loup.mp3';
import bearSoundUrl from '../../son/bruit-ours.mp3';
import chickenSoundUrl from '../../son/bruit-poule.mp3';
import type { AnimalKind } from './animals';
import type { Entity } from 'koota';
import type { GameplayMode } from './worldMode';
import type { World } from 'koota';
import { Fire, FirePosition, Player, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity } from './traits';
import { getSwimState } from './swimming';
import { getBlockIndex } from './chunks';

let music: HTMLAudioElement | null = null;
let mode: GameplayMode = 'creative';
let started = false;
let listening = false;
const pending = new Set<HTMLAudioElement>();
const reported = new Set<string>();

function attemptPlay(element: HTMLAudioElement) {
  if (!element.paused) return;
  void element.play().then(() => {
    pending.delete(element);
    if (element.dataset.effect) window.dispatchEvent(new CustomEvent('louisblox-sound', { detail: element.dataset.effect }));
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === 'AbortError') {
      pending.delete(element);
      return;
    }
    if (pending.size >= 24) {
      const oldest = pending.values().next().value;
      if (oldest) pending.delete(oldest);
    }
    pending.add(element);
    if (!reported.has(element.src)) {
      reported.add(element.src);
      console.warn('Lecture audio différée par le navigateur', error);
    }
  });
}

const explorationTracks = [musicUrl, marchMusicUrl, voxelMusicUrl, music3Url, music4Url, music5Url, music6Url, music7Url, music8Url] as const;
let explorationTrack = 0;

function playNextTrack() {
  if (mode === 'battle' || mode === 'pirates') return;
  explorationTrack = (explorationTrack + 1) % explorationTracks.length;
  setMusicMode(mode);
}

export function setMusicMode(nextMode: GameplayMode) {
  mode = nextMode;
  if (!music) return;
  const source = mode === 'pirates' ? pirateMusicUrl : mode === 'battle' ? battleMusicUrl : explorationTracks[explorationTrack];
  music.loop = mode === 'battle' || mode === 'pirates';
  if (music.dataset.track === source) return;
  music.pause();
  music.src = source;
  music.dataset.track = source;
  if (started) attemptPlay(music);
}

export function startMusic() {
  started = true;
  if (!music) {
    music = new Audio();
    music.id = 'background-music';
    music.volume = 0.28;
    music.style.display = 'none';
    music.addEventListener('ended', playNextTrack);
    document.body.appendChild(music);
  }
  setMusicMode(mode);
  attemptPlay(music);
  for (const name of activeLoops) {
    const element = loops.get(name);
    if (element) attemptPlay(element);
  }
}

export function initAudio() {
  if (listening) return;
  listening = true;
  const unlock = () => {
    startMusic();
    for (const element of [...pending]) attemptPlay(element);
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  window.addEventListener('touchend', unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) unlock();
  });
}

export type SoundEffect = 'whistle' | 'fireSiren' | 'breakBlock' | 'breakGlass' | 'breakWood' | 'gunshot' | 'ball' | 'explosion' | 'fire' | 'eat' | 'walk' | 'placeBlock' | 'waterSplash'
  | 'animal_duck' | 'animal_horse' | 'animal_pig' | 'animal_sheep' | 'animal_cow' | 'animal_elephant' | 'animal_ocelot' | 'animal_wolf' | 'animal_bear' | 'animal_chicken';

const soundUrls: Record<SoundEffect, string> = {
  whistle: whistleUrl,
  fireSiren: fireSirenUrl,
  breakBlock: breakBlockUrl,
  breakGlass: breakGlassUrl,
  breakWood: breakWoodUrl,
  gunshot: gunshotUrl,
  ball: ballUrl,
  explosion: explosionUrl,
  fire: fireUrl,
  eat: eatUrl,
  walk: walkUrl,
  placeBlock: placeBlockUrl,
  waterSplash: waterSplashUrl,
  animal_duck: duckSoundUrl,
  animal_horse: horseSoundUrl,
  animal_pig: pigSoundUrl,
  animal_sheep: sheepSoundUrl,
  animal_cow: cowSoundUrl,
  animal_elephant: elephantSoundUrl,
  animal_ocelot: ocelotSoundUrl,
  animal_wolf: wolfSoundUrl,
  animal_bear: bearSoundUrl,
  animal_chicken: chickenSoundUrl,
};

const animalEffects: Partial<Record<AnimalKind, SoundEffect>> = {
  duck: 'animal_duck',
  horse: 'animal_horse',
  pig: 'animal_pig',
  sheep: 'animal_sheep',
  cow: 'animal_cow',
  elephant: 'animal_elephant',
  ocelot: 'animal_ocelot',
  wolf: 'animal_wolf',
  snowWolf: 'animal_wolf',
  bear: 'animal_bear',
  snowBear: 'animal_bear',
  chicken: 'animal_chicken',
};

const audio = new Map<SoundEffect, HTMLAudioElement>();
const loops = new Map<SoundEffect, HTMLAudioElement>();
const activeLoops = new Set<SoundEffect>();
const animalAudio = new Map<Entity, HTMLAudioElement>();
type WaterSoundState = { inWater: boolean; drySince: number };
const waterStates = new WeakMap<object, WaterSoundState>();
const WATER_EXIT_DELAY = 750;

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
  if (!started) startMusic();
  const element = sound(name).cloneNode(true) as HTMLAudioElement;
  element.volume = volume;
  element.dataset.effect = name;
  attemptPlay(element);
  return element;
}

export function animalSoundEffect(kind: AnimalKind) {
  return animalEffects[kind];
}

export function animalSoundVolume(distance: number) {
  return Math.max(0, 0.45 * (1 - distance / 24));
}

export function playAnimalSound(kind: AnimalKind, distance: number, entity?: Entity) {
  const effect = animalSoundEffect(kind);
  const volume = animalSoundVolume(distance);
  if (!effect || volume <= 0) return;
  if (entity !== undefined) {
    const previous = animalAudio.get(entity);
    if (previous) previous.pause();
    animalAudio.set(entity, playSound(effect, volume));
  } else playSound(effect, volume);
}

export function stopAnimalSound(entity: Entity) {
  const previous = animalAudio.get(entity);
  if (previous) previous.pause();
  animalAudio.delete(entity);
}

export function setLoopSound(name: Extract<SoundEffect, 'walk' | 'fire' | 'fireSiren'>, active: boolean, volume = 0.3) {
  const current = loops.get(name);
  if (!active) {
    activeLoops.delete(name);
    if (current) {
      current.pause();
      pending.delete(current);
    }
    return;
  }
  activeLoops.add(name);
  const element = current ?? sound(name).cloneNode(true) as HTMLAudioElement;
  element.loop = true;
  element.volume = volume;
  loops.set(name, element);
  if (started) attemptPlay(element);
}

export function updateWaterSound(world: object, inWater: boolean) {
  const previous = waterStates.get(world) ?? { inWater: false, drySince: 0 };
  const now = Date.now();
  if (inWater) {
    if (!previous.inWater && now - previous.drySince >= WATER_EXIT_DELAY) playSound('waterSplash', 0.55);
    waterStates.set(world, { inWater: true, drySince: now });
  } else {
    waterStates.set(world, { inWater: false, drySince: previous.inWater ? now : previous.drySince });
  }
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
  if (position) updateWaterSound(world, getSwimState(getBlockIndex(world), position).inWater);
}
