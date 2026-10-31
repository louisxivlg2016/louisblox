import { create } from 'zustand';
import { streamChunks } from './chunks';
import { requestPlay } from './input';
import { useGameStore } from './store';
import { Player, PlayerBody, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity, Sleep } from './traits';
import { dismount } from './vehicles';
import { world } from './world';

type TeleportRequest = { id: string; playerId: string; name: string };
type TeleportMessage = {
  type?: unknown;
  requestId?: unknown;
  from?: unknown;
  name?: unknown;
  position?: unknown;
};

let socket: WebSocket | null = null;
let expiration: ReturnType<typeof setTimeout> | null = null;

export const useTeleportRequestStore = create<{
  incoming: TeleportRequest | null;
  outgoing: TeleportRequest | null;
  notice: string;
}>(() => ({ incoming: null, outgoing: null, notice: '' }));

function clearOutgoing() {
  if (expiration !== null) clearTimeout(expiration);
  expiration = null;
  useTeleportRequestStore.setState({ outgoing: null });
}

export function setTeleportSocket(next: WebSocket | null) {
  socket = next;
}

export function clearTeleportRequests() {
  socket = null;
  clearOutgoing();
  useTeleportRequestStore.setState({ incoming: null, notice: '' });
}

export function requestPlayerTeleport(playerId: string, name: string) {
  if (useTeleportRequestStore.getState().outgoing) return;
  if (socket?.readyState !== WebSocket.OPEN) {
    useTeleportRequestStore.setState({ notice: 'La connexion multijoueur est indisponible.' });
    return;
  }
  const request = { id: crypto.randomUUID(), playerId, name };
  useTeleportRequestStore.setState({ outgoing: request, notice: `Demande envoyée à ${name}…` });
  socket.send(JSON.stringify({ type: 'teleport-request', requestId: request.id, targetId: playerId }));
  expiration = setTimeout(() => {
    expiration = null;
    useTeleportRequestStore.setState((state) => state.outgoing?.id === request.id
      ? { outgoing: null, notice: 'La demande a expiré. Tu peux réessayer.' }
      : {});
  }, 30000);
}

export function receiveTeleportRequest(data: TeleportMessage) {
  if (data.type !== 'teleport-request' || typeof data.requestId !== 'string' || typeof data.from !== 'string') return;
  const current = useTeleportRequestStore.getState().incoming;
  if (current?.id === data.requestId) return;
  const incoming = {
    id: data.requestId,
    playerId: data.from,
    name: typeof data.name === 'string' ? data.name : 'Un joueur',
  };
  useTeleportRequestStore.setState({ incoming });
  const game = useGameStore.getState();
  game.setTeleportOpen(false);
  game.setBackpack(false);
  game.setBookOpen(false);
  game.setSeatChoice(null);
  if (game.container) game.closeContainer();
  game.setMode('pause');
  if (document.pointerLockElement) document.exitPointerLock();
}

export function respondToTeleportRequest(accepted: boolean) {
  const incoming = useTeleportRequestStore.getState().incoming;
  if (!incoming) return;
  useTeleportRequestStore.setState({ incoming: null });
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: accepted ? 'teleport-accept' : 'teleport-decline',
      requestId: incoming.id,
      targetId: incoming.playerId,
    }));
  }
  void requestPlay();
}

export function receiveTeleportResponse(data: TeleportMessage) {
  if (typeof data.requestId !== 'string') return;
  const outgoing = useTeleportRequestStore.getState().outgoing;
  if (!outgoing || outgoing.id !== data.requestId) return;
  const name = typeof data.name === 'string' ? data.name : outgoing.name;
  if (data.type === 'teleport-unavailable') {
    clearOutgoing();
    useTeleportRequestStore.setState({ notice: 'Ce joueur n’est plus disponible.' });
    return;
  }
  if (data.type === 'teleport-decline') {
    clearOutgoing();
    useTeleportRequestStore.setState({ notice: `${name} a refusé la demande.` });
    return;
  }
  if (data.type !== 'teleport-accept' || !data.position || typeof data.position !== 'object') return;
  const position = (data.position as Record<string, unknown>);
  if (!['x', 'y', 'z'].every((key) => typeof position[key] === 'number' && Number.isFinite(position[key]))) return;
  const destination = position as { x: number; y: number; z: number };
  const entity = world.queryFirst(Player);
  const playerPosition = entity?.get(PlayerPosition);
  if (!entity || !playerPosition) return;

  clearOutgoing();
  useTeleportRequestStore.setState({ notice: '' });
  if (entity.get(PlayerMount)?.vehicle) dismount(world);
  const sleeping = world.queryFirst(Sleep);
  if (sleeping) sleeping.destroy();
  useGameStore.getState().setSleepProgress(null);
  streamChunks(world, destination.x, destination.z);
  playerPosition.set(destination.x, destination.y, destination.z);
  entity.get(PlayerBody)?.value?.setTranslation(destination, true);
  entity.get(PlayerVelocity)?.set(0, 0, 0);
  entity.set(PlayerState, { flying: false, grounded: false });
  useGameStore.getState().setTeleportOpen(false);
  useGameStore.getState().setNotice(`Téléportation vers ${name}.`);
  void requestPlay();
}
