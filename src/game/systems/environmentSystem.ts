import type { World } from 'koota';
import type { Camera } from 'three';
import { getBlockIndex, getWorldSeed } from '../chunks';
import { isWaterBlock, voxelKey } from '../voxel';
import { useSeasonStore } from '../seasons';
import { biomeAt } from '../levels';
import type { Biome } from '../levels';
import { useGameStore } from '../store';
import { Environment, RainMaterial, SnowMaterial } from '../traits';
import { dayProgressAt } from '../dayNight';

export { DAY_DURATION } from '../dayNight';
export const WEATHER_DURATION = 30 * 60;
export const PRECIPITATION_DURATION = 5 * 60;
export const SNOW_DURATION = 15 * 60;

export function environmentAt(elapsed: number, biome: Biome) {
  const dayProgress = dayProgressAt(elapsed);
  const phase = elapsed % WEATHER_DURATION;
  const snowing = biome === 'winter' || useSeasonStore.getState().season === 'winter' || useSeasonStore.getState().mixedSeasons.includes('winter');
  const precipitating = phase >= WEATHER_DURATION - (snowing ? SNOW_DURATION : PRECIPITATION_DURATION);
  return {
    dayProgress,
    weather: precipitating ? (snowing ? 'snow' : 'rain') : 'clear',
  } as const;
}

export function environmentSystem(world: World, delta: number, camera: Camera) {
  const entity = world.queryFirst(Environment);
  const environment = entity?.get(Environment);
  if (!entity || !environment) return;

  environment.elapsed += delta;
  environment.uiTimer += delta;
  const biome = biomeAt(Math.floor(camera.position.x), Math.floor(camera.position.z), getWorldSeed(world));
  const next = { ...environmentAt(environment.elapsed, biome) };
  const customWeather = useGameStore.getState().customWorld?.environment?.weather;
  if (customWeather) next.weather = customWeather;
  const changed = environment.biome !== biome || environment.weather !== next.weather;
  environment.biome = biome;
  environment.dayProgress = useGameStore.getState().gameplayMode === 'battle' ? 0.38 : next.dayProgress;
  environment.weather = next.weather;

  const blocks = getBlockIndex(world);
  let roofY = 100000;
  const roofX = Math.round(camera.position.x);
  const roofZ = Math.round(camera.position.z);
  for (let y = Math.ceil(camera.position.y); y <= Math.ceil(camera.position.y) + 30; y += 1) {
    const block = blocks.get(voxelKey(roofX, y, roofZ));
    if (!block || isWaterBlock(block.kind)) continue;
    roofY = y + 0.5;
    break;
  }

  const rain = entity.get(RainMaterial)?.value;
  const snow = entity.get(SnowMaterial)?.value;
  if (rain) {
    rain.visible = environment.weather === 'rain';
    rain.uniforms.uTime.value = environment.elapsed;
    rain.uniforms.uOpacity.value = environment.weather === 'rain' ? 1 : 0;
    rain.uniforms.uCamera.value.copy(camera.position);
    rain.uniforms.uRoofY.value = roofY;
  }
  if (snow) {
    snow.visible = environment.weather === 'snow';
    snow.uniforms.uTime.value = environment.elapsed;
    snow.uniforms.uOpacity.value = environment.weather === 'snow' ? 1 : 0;
    snow.uniforms.uCamera.value.copy(camera.position);
    snow.uniforms.uRoofY.value = roofY;
  }

  if (environment.uiTimer >= 0.5 || changed) {
    environment.uiTimer = 0;
    useGameStore.getState().setEnvironment({
      dayProgress: environment.dayProgress,
      weather: environment.weather,
      biome: environment.biome,
      elapsed: environment.elapsed,
    });
  }
}
