import { requestPlay } from '../game/input';
import { BIOME_NAMES } from '../game/levels';
import type { Biome } from '../game/levels';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { teleportToBiome } from '../game/teleport';
import { requestPlayerTeleport, respondToTeleportRequest, useTeleportRequestStore } from '../game/teleportRequests';
import { world } from '../game/world';

const DESTINATIONS: Biome[] = ['winter', 'autumn', 'forest', 'prairie'];

export function TeleportPanel() {
  const open = useGameStore((state) => state.teleportOpen);
  const setOpen = useGameStore((state) => state.setTeleportOpen);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const online = useMultiplayerStore((state) => state.status === 'online');
  const players = useMultiplayerStore((state) => state.players);
  const outgoing = useTeleportRequestStore((state) => state.outgoing);
  const notice = useTeleportRequestStore((state) => state.notice);
  if (!open) return null;

  const travel = (biome: Biome) => {
    teleportToBiome(world, biome);
    setOpen(false);
    void requestPlay();
  };

  return (
    <div className="teleport-panel">
      <strong>Se téléporter</strong>
      {DESTINATIONS.map((biome) => (
        <button key={biome} onClick={() => travel(biome)}>{BIOME_NAMES[biome]}</button>
      ))}
      {enabled && online && (
        <div className="player-teleport">
          <strong>Demander à rejoindre un joueur</strong>
          {players.filter((player) => !player.self).length === 0 ? (
            <span className="teleport-empty">Aucun autre joueur dans ce salon.</span>
          ) : players.filter((player) => !player.self).map((player) => (
            <button
              key={player.playerId}
              className="player-teleport-button"
              disabled={Boolean(outgoing)}
              onClick={() => requestPlayerTeleport(player.playerId, player.name)}
            >
              {outgoing?.playerId === player.playerId ? 'Demande envoyée…' : `Rejoindre ${player.name}`}
            </button>
          ))}
          {notice && <span className="teleport-request-status" role="status">{notice}</span>}
        </div>
      )}
    </div>
  );
}

export function TeleportRequestDialog() {
  const incoming = useTeleportRequestStore((state) => state.incoming);
  if (!incoming) return null;
  return (
    <div className="menu-backdrop teleport-request-backdrop">
      <section className="menu-panel teleport-request-panel" role="dialog" aria-modal="true" aria-labelledby="teleport-request-title">
        <p className="eyebrow">DEMANDE DE TÉLÉPORTATION</p>
        <h2 id="teleport-request-title">{incoming.name}</h2>
        <p>souhaite se téléporter jusqu’à toi.</p>
        <div className="teleport-request-actions">
          <button className="primary-button" onClick={() => respondToTeleportRequest(true)}>Accepter</button>
          <button className="secondary-button" onClick={() => respondToTeleportRequest(false)}>Refuser</button>
        </div>
      </section>
    </div>
  );
}
