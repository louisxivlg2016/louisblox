import type { World } from 'koota';
import { useEatingStore } from './eating';
import { useGameStore } from './store';
import { Player, PlayerHealth } from './traits';

export function receiveAppleGift(world: World, value: unknown) {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  if (typeof data.from !== 'string' || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 24 || data.count !== 1) return;
  const player = world.queryFirst(Player);
  const health = player?.get(PlayerHealth);
  if (!player || !health) return;
  const store = useGameStore.getState();
  const name = data.name.trim();
  if (health.value >= health.max) {
    store.collectApple();
    store.setNotice(`${name} t’a offert une pomme. Elle est dans ton sac.`);
    return;
  }
  const healed = Math.min(health.max, health.value + 2);
  player.set(PlayerHealth, { value: healed });
  store.setLives(healed);
  store.setNotice(`${name} t’a offert une pomme : +${healed - health.value} vies.`);
  useEatingStore.getState().startEating('apple');
}
