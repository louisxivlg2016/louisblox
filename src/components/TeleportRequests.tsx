import { requestPlay } from '../game/input';
import { BIOME_NAMES } from '../game/levels';
import type { Biome } from '../game/levels';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { teleportToBiome, teleportToRuin } from '../game/teleport';
import type { RuinType } from '../game/ruins';
import { requestPlayerTeleport, respondToTeleportRequest, useTeleportRequestStore } from '../game/teleportRequests';
import { world } from '../game/world';
import { MAX_HOMES, NO_HOMES, useHomeStore } from '../game/homes';
import type { Home } from '../game/homes';
import { teleportToHome } from '../game/teleport';

const DESTINATIONS: Biome[] = ['winter', 'autumn', 'forest', 'jungle', 'prairie', 'desert'];
const RUINS: Array<{ type: RuinType; name: string }> = [
  { type: 'church', name: 'Ruined church' },
  { type: 'palace', name: 'Ruined palace' },
  { type: 'fort', name: 'Ruined castle' },
];
const CITY_DESTINATIONS = {
  modern: [
    { name: 'Glass skyscraper', x: 28, y: 5.51, z: 0 },
    { name: 'Villas with pool', x: 28, y: 5.51, z: 160 },
    { name: 'Beach', x: 28, y: 5.51, z: 195 },
  ],
  ancient: [
    { name: 'Church', x: 28, y: 5.51, z: -56 },
    { name: 'Historic district', x: 0, y: 5.51, z: 28 },
    { name: 'Central square', x: 0, y: 5.51, z: 0 },
  ],
} as const;

export function TeleportPanel() {
  const open = useGameStore((state) => state.teleportOpen);
  const setOpen = useGameStore((state) => state.setTeleportOpen);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const online = useMultiplayerStore((state) => state.status === 'online');
  const players = useMultiplayerStore((state) => state.players);
  const outgoing = useTeleportRequestStore((state) => state.outgoing);
  const notice = useTeleportRequestStore((state) => state.notice);
  const worldId = useGameStore((state) => state.worldId);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const homes = useHomeStore((state) => state.homes[worldId] ?? NO_HOMES);
  const setHomeOpen = useHomeStore((state) => state.setOpen);
  if (!open) return null;
  const cityDestinations = gameplayMode === 'city-modern' ? CITY_DESTINATIONS.modern : gameplayMode === 'city-ancient' ? CITY_DESTINATIONS.ancient : null;

  const travel = (biome: Biome) => {
    teleportToBiome(world, biome);
    setOpen(false);
    void requestPlay();
  };
  const travelToRuin = (type: RuinType) => {
    teleportToRuin(world, type);
    setOpen(false);
    void requestPlay();
  };
  const travelToCity = (destination: { x: number; y: number; z: number }) => {
    teleportToHome(world, { ...destination, yaw: 0, pitch: 0 });
    setOpen(false);
    void requestPlay();
  };
  const travelHome = (home: Home) => {
    teleportToHome(world, home);
    setOpen(false);
    void requestPlay();
  };
  const manageHomes = () => {
    setOpen(false);
    setHomeOpen(true);
  };
  const close = () => {
    setOpen(false);
    void requestPlay();
  };

  return (
    <div className="teleport-panel">
      <div className="teleport-heading">
        <strong>Teleport</strong>
        <button type="button" className="teleport-close" onPointerDown={(event) => { if (event.pointerType === 'touch') { event.preventDefault(); event.stopPropagation(); close(); } }} onClick={close} aria-label="Close teleportation">Close <span aria-hidden="true">×</span></button>
      </div>
      {cityDestinations ? cityDestinations.map((destination) => (
        <button key={destination.name} onClick={() => travelToCity(destination)}>{destination.name}</button>
      )) : <>
        {DESTINATIONS.map((biome) => (
          <button key={biome} onClick={() => travel(biome)}>{BIOME_NAMES[biome]}</button>
        ))}
        {RUINS.map((ruin) => (
          <button key={ruin.type} onClick={() => travelToRuin(ruin.type)}>{ruin.name}</button>
        ))}
      </>}
      <div className="home-destinations">
        <strong>Mes maisons ({homes.length} / {MAX_HOMES})</strong>
        {homes.map((home) => <button key={home.id} className="home-destination" onClick={() => travelHome(home)}>{home.name}</button>)}
        <button className="home-manage-button" onClick={manageHomes}>Create or manage my homes · M</button>
      </div>
      {enabled && online && (
        <div className="player-teleport">
          <strong>Ask to join a player</strong>
          {players.filter((player) => !player.self).length === 0 ? (
            <span className="teleport-empty">No other players in this room.</span>
          ) : players.filter((player) => !player.self).map((player) => (
            <button
              key={player.playerId}
              className="player-teleport-button"
              disabled={Boolean(outgoing)}
              onClick={() => requestPlayerTeleport(player.playerId, player.name)}
            >
              {outgoing?.playerId === player.playerId ? 'Request sent…' : `Join ${player.name}`}
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
        <p className="eyebrow">TELEPORT REQUEST</p>
        <h2 id="teleport-request-title">{incoming.name}</h2>
        <p>wants to teleport to you.</p>
        <div className="teleport-request-actions">
          <button className="primary-button" onClick={() => respondToTeleportRequest(true)}>Accept</button>
          <button className="secondary-button" onClick={() => respondToTeleportRequest(false)}>Decline</button>
        </div>
      </section>
    </div>
  );
}
