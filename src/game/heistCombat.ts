import type { World } from 'koota';
import { Vector3 } from 'three';
import { getBlockIndex } from './chunks';
import { raycastVoxel } from './voxel';
import { useHeistStore } from './heistClient';
import { useGameStore } from './store';
import { translate } from './language';

const offset = new Vector3();

export function findHeistBotTarget(world: World, origin: Vector3, direction: Vector3, maxDistance: number) {
  const bot = useHeistStore.getState().bot;
  if (!bot.enabled || bot.stunnedUntil > Date.now()) return null;
  offset.set(bot.x, bot.y + 1.05, bot.z).sub(origin);
  const distance = offset.dot(direction);
  if (distance < 0 || distance > maxDistance || offset.lengthSq() - distance * distance > 0.85 * 0.85) return null;
  const obstruction = raycastVoxel(getBlockIndex(world), origin, direction, distance);
  if (obstruction && obstruction.distance < distance - 0.4) return null;
  return { distance, position: new Vector3(bot.x, bot.y + 0.8, bot.z) };
}

export function damageHeistBot(amount: number) {
  const state = useHeistStore.getState();
  if (!state.bot.enabled || state.bot.stunnedUntil > Date.now()) return false;
  const health = Math.max(0, state.bot.health - Math.max(1, Math.floor(amount)));
  const stunnedUntil = Date.now() + (health <= 0 ? 8000 : 800);
  useHeistStore.setState({ bot: { ...state.bot, health, stunnedUntil, detecting: false } });
  useGameStore.getState().setNotice(health <= 0
    ? translate('Gardien neutralisé pendant 8 secondes !', 'Guard neutralized for 8 seconds!')
    : translate(`Gardien touché · ${health}/5`, `Guard hit · ${health}/5`));
  return true;
}
