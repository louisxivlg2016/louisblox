import { listWorlds, readWorldSave, writeWorldSave } from './save';
import type { WorldMeta } from './save';
import type { WorldSave } from './chunks';
import { MAX_HOMES, useHomeStore } from './homes';
import type { Home } from './homes';

const FORMAT = 'louisblox-worlds-backup';
const WORLD_PREFIX = 'louisblox-world-';
const versions = new Set([1, 2, 3, 4, 5]);

export type WorldBackup = {
  format: typeof FORMAT;
  version: 1;
  exportedAt: string;
  worlds: Array<{ id: string; name: string; save: WorldSave }>;
  homes: Record<string, Home[]>;
};

function validSave(value: unknown): value is WorldSave {
  if (!value || typeof value !== 'object') return false;
  const save = value as WorldSave;
  if (!versions.has(save.version) || !Number.isFinite(save.seed) || !Array.isArray(save.edits)) return false;
  if (!save.player || typeof save.player !== 'object') return false;
  if (!(['x', 'y', 'z', 'yaw', 'pitch'] as const).every((key) => typeof save.player[key] === 'number' && Number.isFinite(save.player[key]))) return false;
  if (typeof save.player.flying !== 'boolean') return false;
  return save.edits.every((entry) => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && Array.isArray(entry[1]));
}

function validId(value: unknown) {
  if (typeof value !== 'string') return null;
  const id = value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return id || null;
}

export function exportWorldBackup(): WorldBackup {
  const metadata = new Map(listWorlds().map((world) => [world.id, world.name]));
  const ids = new Set<string>();
  const worlds: WorldBackup['worlds'] = [];
  const add = (id: string) => {
    if (ids.has(id)) return;
    const save = readWorldSave(id);
    if (!save) return;
    ids.add(id);
    worlds.push({ id, name: metadata.get(id) ?? id, save });
  };
  for (const id of metadata.keys()) add(id);
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(WORLD_PREFIX)) add(key.slice(WORLD_PREFIX.length));
  }
  return {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    worlds,
    homes: JSON.parse(JSON.stringify(useHomeStore.getState().homes)) as Record<string, Home[]>,
  };
}

export function downloadWorldBackup() {
  const backup = exportWorldBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `louisblox-mondes-${backup.exportedAt.slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return backup.worlds.length;
}

export function importWorldBackup(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Ce fichier n’est pas une sauvegarde LouisBlox valide.');
  const backup = value as Partial<WorldBackup>;
  if (backup.format !== FORMAT || backup.version !== 1 || !Array.isArray(backup.worlds)) throw new Error('Ce fichier n’est pas une sauvegarde LouisBlox valide.');
  if (backup.worlds.length > 512) throw new Error('Cette sauvegarde contient trop de mondes.');
  const imported: WorldMeta[] = [];
  const homes: Record<string, Home[]> = {};
  const usedIds = new Set(listWorlds().map((world) => world.id));
  const backupHomes = backup.homes && typeof backup.homes === 'object' && !Array.isArray(backup.homes) ? backup.homes : {};
  let skipped = 0;

  for (const entry of backup.worlds) {
    if (!entry || typeof entry !== 'object') {
      skipped += 1;
      continue;
    }
    const save = entry.save;
    const originalId = validId(entry.id) ?? validId(save?.worldId);
    if (!validSave(save) || !originalId) {
      skipped += 1;
      continue;
    }
    const originalName = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim().slice(0, 80) : originalId;
    let id = originalId;
    let name = originalName;
    while (usedIds.has(id) || readWorldSave(id)) {
      id = `monde-import-${crypto.randomUUID().slice(0, 8)}`;
      name = `${originalName} (copie)`.slice(0, 80);
    }
    usedIds.add(id);
    const metadata = writeWorldSave(id, { ...save, worldId: id }, name);
    if (!metadata) {
      skipped += 1;
      continue;
    }
    imported.push(metadata);
    const worldHomes = backupHomes[originalId];
    if (Array.isArray(worldHomes)) homes[id] = worldHomes.slice(0, MAX_HOMES);
  }
  if (Object.keys(homes).length > 0) useHomeStore.getState().importHomes(homes);
  return { imported, skipped };
}
