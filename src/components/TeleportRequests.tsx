import { useState } from 'react';
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
import { teleportToFarm, teleportToHome, teleportToTrader, teleportToVillage } from '../game/teleport';
import { translate } from '../game/language';
import { sendFriendRequest, useFriendStore } from '../game/friends';
import { useCharacterStore } from '../game/characterStore';
import { historicCityDestinations } from '../game/historicCapitals';

const DESTINATIONS: Biome[] = ['winter', 'autumn', 'forest', 'jungle', 'prairie', 'desert'];
const RUINS: Array<{ type: RuinType; name: string }> = [
  { type: 'church', name: translate('Église en ruines', 'Ruined church') },
  { type: 'palace', name: translate('Palais en ruines', 'Ruined palace') },
  { type: 'fort', name: translate('Château fort en ruines', 'Ruined castle') },
];
const CITY_DESTINATIONS = {
  modern: [
    { name: translate('Gratte-ciel de verre', 'Glass skyscraper'), x: 28, y: 5.51, z: 0 },
    { name: translate('Villas avec piscine', 'Villas with pool'), x: 28, y: 5.51, z: 160 },
    { name: translate('Plage', 'Beach'), x: 28, y: 5.51, z: 195 },
  ],
  ancient: [
    { name: translate('Église', 'Church'), x: 28, y: 5.51, z: -56 },
    { name: translate('Quartier historique', 'Historic district'), x: 0, y: 5.51, z: 28 },
    { name: translate('Place centrale', 'Central square'), x: 0, y: 5.51, z: 0 },
    ...historicCityDestinations(),
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
  const onlinePlayers = useFriendStore((state) => state.onlinePlayers);
  const [inviteNotice, setInviteNotice] = useState('');
  const worldId = useGameStore((state) => state.worldId);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const worldTemplate = useGameStore((state) => state.worldTemplate);
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
  const travelToVillage = () => {
    if (!teleportToVillage(world)) return;
    setOpen(false);
    void requestPlay();
  };
  const travelToFarm = () => {
    if (!teleportToFarm(world)) return;
    setOpen(false);
    void requestPlay();
  };
  const travelToTrader = () => {
    if (!teleportToTrader(world)) return;
    setOpen(false);
    void requestPlay();
  };
  const manageHomes = () => {
    setOpen(false);
    setHomeOpen(true);
  };
  const invite = async (playerId: string, name: string) => {
    const profile = onlinePlayers.find((player) => player.playerId === playerId) ?? {
      playerId,
      name,
      room: useMultiplayerStore.getState().room,
      character: 'boy' as const,
      outfit: 'default' as const,
      wig: 'auto' as const,
      appearance: useCharacterStore.getState().appearance,
    };
    try {
      const delivered = await sendFriendRequest(profile);
      setInviteNotice(delivered ? translate(`Invitation envoyée à ${name}.`, `Invitation sent to ${name}.`) : translate(`Invitation enregistrée pour ${name}.`, `Invitation saved for ${name}.`));
    } catch {
      setInviteNotice(translate('Invitation impossible pour le moment.', 'Unable to send the invitation right now.'));
    }
  };
  const close = () => {
    setOpen(false);
    void requestPlay();
  };

  return (
    <div className="teleport-panel">
      <div className="teleport-heading">
        <strong>{translate('Se téléporter', 'Teleport')}</strong>
        <button type="button" className="teleport-close" onPointerDown={(event) => { if (event.pointerType === 'touch') { event.preventDefault(); event.stopPropagation(); close(); } }} onClick={close} aria-label={translate('Fermer la téléportation', 'Close teleportation')}>{translate('Fermer', 'Close')} <span aria-hidden="true">×</span></button>
      </div>
      {enabled && online && (
        <div className="player-teleport">
          <strong>{translate('Demander à rejoindre un joueur', 'Ask to join a player')}</strong>
          {players.filter((player) => !player.self).length === 0 ? (
            <span className="teleport-empty">{translate('Aucun autre joueur dans ce salon.', 'No other players in this room.')}</span>
          ) : players.filter((player) => !player.self).map((player) => (
            <span key={player.playerId} className="player-teleport-actions">
              <button
                className="player-teleport-button"
                disabled={Boolean(outgoing)}
                onClick={() => requestPlayerTeleport(player.playerId, player.name)}
              >
                {outgoing?.playerId === player.playerId ? translate('Demande envoyée…', 'Request sent…') : `Join ${player.name}`}
              </button>
              <button type="button" className="friend-add" onClick={() => void invite(player.playerId, player.name)}>{translate('Inviter', 'Invite')}</button>
            </span>
          ))}
          {inviteNotice && <span className="teleport-request-status" role="status">{inviteNotice}</span>}
          {notice && <span className="teleport-request-status" role="status">{notice}</span>}
        </div>
      )}
      {(gameplayMode === 'city-ancient' || worldTemplate === 'nature') && <button type="button" data-teleport-village onClick={travelToVillage}>{translate('Petit village', 'Small village')}</button>}
      {(gameplayMode === 'city-ancient' || worldTemplate === 'nature') && <button type="button" data-teleport-farm onClick={travelToFarm}>{translate('Ferme', 'Farm')}</button>}
      {(gameplayMode === 'city-ancient' || worldTemplate === 'nature') && <button type="button" data-teleport-trader onClick={travelToTrader}>{translate('Marchand le plus proche', 'Nearest trader')}</button>}
      {cityDestinations ? cityDestinations.map((destination) => (
        <button key={destination.name} onClick={() => travelToCity(destination)}>{destination.name}</button>
      )) : <>
        {DESTINATIONS.map((biome) => (
          <button key={biome} onClick={() => travel(biome)}>{BIOME_NAMES()[biome]}</button>
        ))}
        {RUINS.map((ruin) => (
          <button key={ruin.type} onClick={() => travelToRuin(ruin.type)}>{ruin.name}</button>
        ))}
      </>}
      <div className="home-destinations">
        <strong>Mes maisons ({homes.length} / {MAX_HOMES})</strong>
        {homes.map((home) => <button key={home.id} className="home-destination" onClick={() => travelHome(home)}>{home.name}</button>)}
        <button className="home-manage-button" onClick={manageHomes}>{translate('Créer ou gérer mes maisons · M', 'Create or manage my homes · M')}</button>
      </div>
      <button type="button" className="teleport-exit" onPointerDown={(event) => { if (event.pointerType === 'touch') { event.preventDefault(); event.stopPropagation(); close(); } }} onClick={close} aria-label={translate('Quitter la téléportation', 'Exit teleportation')}>{translate('Quitter la téléportation', 'Exit teleportation')} <span aria-hidden="true">×</span></button>
    </div>
  );
}

export function TeleportRequestDialog() {
  const incoming = useTeleportRequestStore((state) => state.incoming);
  if (!incoming) return null;
  return (
    <div className="menu-backdrop teleport-request-backdrop">
      <section className="menu-panel teleport-request-panel" role="dialog" aria-modal="true" aria-labelledby="teleport-request-title">
        <p className="eyebrow">{translate('DEMANDE DE TÉLÉPORTATION', 'TELEPORT REQUEST')}</p>
        <h2 id="teleport-request-title">{incoming.name}</h2>
        <p>{translate('souhaite se téléporter jusqu’à toi.', 'wants to teleport to you.')}</p>
        <div className="teleport-request-actions">
          <button className="primary-button" onClick={() => respondToTeleportRequest(true)}>{translate('Accepter', 'Accept')}</button>
          <button className="secondary-button" onClick={() => respondToTeleportRequest(false)}>{translate('Refuser', 'Decline')}</button>
        </div>
      </section>
    </div>
  );
}
