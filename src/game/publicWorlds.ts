import { resolveMultiplayerUrl } from './multiplayer';
import { isGameplayMode } from './worldMode';
import type { GameplayMode } from './worldMode';

export type PublicWorld = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  gameplayMode: import('./worldMode').GameplayMode;
  template?: import('./worldMode').WorldTemplate;
  players: number;
  updatedAt: number;
};

export async function listPublicWorlds(): Promise<PublicWorld[]> {
  const url = new URL(resolveMultiplayerUrl());
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = '/worlds';
  url.search = '';
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return [];
  const data = await response.json() as { worlds?: unknown };
  if (!Array.isArray(data.worlds)) return [];
  return data.worlds.flatMap((value): PublicWorld[] => {
    if (!value || typeof value !== 'object') return [];
    const world = value as Record<string, unknown>;
    if (typeof world.id !== 'string' || typeof world.name !== 'string' || typeof world.ownerId !== 'string' || typeof world.ownerName !== 'string' || !isGameplayMode(world.gameplayMode)) return [];
    return [{
      id: world.id,
      name: world.name,
      ownerId: world.ownerId,
      ownerName: world.ownerName,
      gameplayMode: world.gameplayMode,
      template: world.template === 'city-ancient' || world.template === 'city-modern' || world.template === 'custom' ? world.template : 'nature',
      players: typeof world.players === 'number' ? world.players : 0,
      updatedAt: typeof world.updatedAt === 'number' ? world.updatedAt : 0,
    }];
  });
}

export function countPlayersByMode(worlds: PublicWorld[], mode: GameplayMode, current: { ids: string[]; players: number }) {
  let total = 0;
  let currentIncluded = false;
  for (const world of worlds) {
    if (world.gameplayMode !== mode) continue;
    if (current.ids.includes(world.id)) {
      currentIncluded = true;
      total += Math.max(world.players, current.players);
    } else total += Math.max(0, world.players);
  }
  return total + (currentIncluded ? 0 : current.players);
}

export type ModePlayer = { playerId: string; name: string; room: string; gameplayMode: GameplayMode };

export async function listModePlayers(mode: GameplayMode): Promise<ModePlayer[]> {
  const url = new URL(resolveMultiplayerUrl());
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = '/players';
  url.search = '';
  url.searchParams.set('mode', mode);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return [];
  const data = await response.json() as { players?: unknown };
  if (!Array.isArray(data.players)) return [];
  return data.players.flatMap((value): ModePlayer[] => {
    if (!value || typeof value !== 'object') return [];
    const player = value as Record<string, unknown>;
    if (typeof player.playerId !== 'string' || typeof player.name !== 'string' || typeof player.room !== 'string' || player.gameplayMode !== mode) return [];
    return [{ playerId: player.playerId, name: player.name, room: player.room, gameplayMode: mode }];
  });
}

export function busiestPublicWorld(worlds: PublicWorld[], mode: GameplayMode) {
  return worlds
    .filter((world) => world.gameplayMode === mode && world.players > 0)
    .sort((a, b) => b.players - a.players || b.updatedAt - a.updatedAt)[0] ?? null;
}

export function findPublicWorldByName(worlds: PublicWorld[], name: string) {
  const normalized = name.trim().toLocaleLowerCase('fr');
  if (!normalized) return null;
  return worlds
    .filter((world) => world.id.toLocaleLowerCase('fr') === normalized || world.name.trim().toLocaleLowerCase('fr') === normalized)
    .sort((a, b) => b.players - a.players || b.updatedAt - a.updatedAt)[0] ?? null;
}
