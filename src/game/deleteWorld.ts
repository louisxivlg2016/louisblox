import { deleteRoom } from './multiplayer';
import { listPublicWorlds } from './publicWorlds';
import { playerIdentity } from './playerIdentity';
import { deleteWorldSave, listWorlds } from './save';
import { useGameStore } from './store';
import { useMultiplayerStore } from './multiplayerStore';

export async function removeWorld(worldId: string) {
  if (!deleteWorldSave(worldId)) throw new Error('Impossible de supprimer cette sauvegarde sur cet appareil.');
  let warning = '';
  try {
    const shared = (await listPublicWorlds()).find((world) => world.id === worldId && world.ownerId === playerIdentity());
    if (shared) await deleteRoom(worldId);
  } catch {
    warning = 'La sauvegarde est supprimée, mais le salon en ligne n’a pas pu être vérifié.';
  }
  if (useGameStore.getState().worldId === worldId) {
    useMultiplayerStore.getState().setEnabled(false);
    const next = listWorlds()[0];
    if (next) useGameStore.getState().openWorld(next.id, next.name);
    else useGameStore.getState().regenerate('creative', 'main-room', undefined, 'Monde principal');
    useGameStore.getState().setMode('menu');
  }
  return { warning };
}
