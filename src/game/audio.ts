import { create } from 'zustand';
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
import policeSirenUrl from '../../son/sirene-de-police.mp3';
import heistAlarmUrl from '../../alarme-police.mp3';
import carHornUrl from '../../klaxon-bruit.mp3';
import fireHornUrl from '../../camion-pompier-bruit.mp3';
import breakBlockUrl from '../../son/son-de-casse-un-bloc.mp3';
import breakDirtUrl from '../../son/casse-un-bloc-de-terre.mp3';
import vehicleCarUrl from '../../son-de-voiture.mp3';
import vehicleTrainUrl from '../../son/train-moderne.mp3';
import vehicleMetroUrl from '../../son/train-metro.mp3';
import vehiclePlaneUrl from '../../son/avion.mp3';
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
import { Fire, FirePosition, Player, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity, VehicleMotion } from './traits';
import type { VehicleKind } from './vehicleTypes';
import { getSwimState } from './swimming';
import { getBlockIndex } from './chunks';
import { translate } from './language';

let music: HTMLAudioElement | null = null;
let mode: GameplayMode = 'creative';
let started = false;
let listening = false;
let musicSuppressed = false;

function initialAudioSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('louisblox-audio-settings') ?? '{}');
    return { music: saved.music !== false, sounds: saved.sounds !== false };
  } catch {
    return { music: true, sounds: true };
  }
}

export const useAudioSettings = create<{ music: boolean; sounds: boolean }>(initialAudioSettings);

export function setAudioPreference(kind: 'music' | 'sounds', enabled: boolean) {
  useAudioSettings.setState({ [kind]: enabled });
  try {
    localStorage.setItem('louisblox-audio-settings', JSON.stringify(useAudioSettings.getState()));
  } catch {
  }
  if (kind === 'music') {
    if (music && enabled && !musicSuppressed && started) attemptPlay(music);
    else if (!enabled) music?.pause();
  } else {
    if (!enabled) {
      for (const element of audio.values()) element.pause();
      for (const element of loops.values()) element.pause();
    } else if (started) {
      for (const name of activeLoops) {
        const element = loops.get(name);
        if (element) attemptPlay(element);
      }
    }
  }
}

const pending = new Set<HTMLAudioElement>();
const reported = new Set<string>();
const SOUND_BOOST = 1.6;
const louder = (volume: number) => Math.min(1, volume * SOUND_BOOST);

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
      console.warn(translate('Lecture audio différée par le navigateur', 'Audio playback deferred by browser'), error);
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
  if (started && !musicSuppressed && useAudioSettings.getState().music) attemptPlay(music);
}

export function setMusicSuppressed(suppressed: boolean) {
  musicSuppressed = suppressed;
  if (!music) return;
  if (suppressed) music.pause();
  else if (started && useAudioSettings.getState().music) attemptPlay(music);
}

export function startMusic() {
  started = true;
  if (!music) {
    music = new Audio();
    music.id = 'background-music';
    music.volume = 0.4;
    music.style.display = 'none';
    music.addEventListener('ended', playNextTrack);
    document.body.appendChild(music);
  }
  setMusicMode(mode);
  if (!musicSuppressed && useAudioSettings.getState().music) attemptPlay(music);
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

export type SoundEffect = 'whistle' | 'fireSiren' | 'policeSiren' | 'breakBlock' | 'breakDirt' | 'breakGlass' | 'breakWood' | 'vehicleCar' | 'vehicleTrain' | 'vehicleMetro' | 'vehiclePlane' | 'gunshot' | 'ball' | 'explosion' | 'fire' | 'eat' | 'walk' | 'placeBlock' | 'waterSplash'
  | 'animal_duck' | 'animal_horse' | 'animal_pig' | 'animal_sheep' | 'animal_cow' | 'animal_elephant' | 'animal_ocelot' | 'animal_wolf' | 'animal_bear' | 'animal_chicken' | 'carHorn' | 'fireHorn' | 'heistAlarm';

const soundUrls: Record<SoundEffect, string> = {
  whistle: whistleUrl,
  fireSiren: fireSirenUrl,
  policeSiren: policeSirenUrl,
  heistAlarm: heistAlarmUrl,
  breakBlock: breakBlockUrl,
  breakDirt: breakDirtUrl,
  vehicleCar: vehicleCarUrl,
  vehicleTrain: vehicleTrainUrl,
  vehicleMetro: vehicleMetroUrl,
  vehiclePlane: vehiclePlaneUrl,
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
  carHorn: carHornUrl,
  fireHorn: fireHornUrl,
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
  element.volume = louder(volume);
  element.dataset.effect = name;
  if (useAudioSettings.getState().sounds) attemptPlay(element);
  return element;
}

export function playCarHorn(kind: 'car' | 'firetruck' = 'car') {
  return playSound(kind === 'firetruck' ? 'fireHorn' : 'carHorn', 0.65);
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

export function setLoopSound(name: Extract<SoundEffect, 'walk' | 'fire' | 'fireSiren' | 'policeSiren' | 'vehicleCar' | 'vehicleTrain' | 'vehicleMetro' | 'vehiclePlane'>, active: boolean, volume = 0.3) {
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
  element.volume = louder(volume);
  loops.set(name, element);
  if (started && useAudioSettings.getState().sounds) attemptPlay(element);
  else element.pause();
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

const drivingSounds: Partial<Record<VehicleKind, { sound: 'vehicleCar' | 'vehicleTrain' | 'vehicleMetro' | 'vehiclePlane'; volume: number }>> = {
  car: { sound: 'vehicleCar', volume: 0.3 },
  jeep: { sound: 'vehicleCar', volume: 0.3 },
  police: { sound: 'vehicleCar', volume: 0.3 },
  firetruck: { sound: 'vehicleCar', volume: 0.3 },
  train: { sound: 'vehicleTrain', volume: 0.3 },
  metro: { sound: 'vehicleMetro', volume: 0.3 },
  plane: { sound: 'vehiclePlane', volume: 0.34 },
};

export function updateAmbientSounds(world: World, playing: boolean) {
  const playerEntity = world.queryFirst(Player);
  const position = playerEntity?.get(PlayerPosition);
  const state = playerEntity?.get(PlayerState);
  const velocity = playerEntity?.get(PlayerVelocity);
  const mount = playerEntity?.get(PlayerMount);
  const mounted = mount?.vehicle;
  const driving = playing && mounted ? mount.kind : null;
  for (const kind of ['car', 'train', 'metro', 'plane'] as const) {
    const definition = drivingSounds[kind]!;
    const active = driving !== null && drivingSounds[driving as VehicleKind]?.sound === definition.sound;
    setLoopSound(definition.sound, active, definition.volume);
  }
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
