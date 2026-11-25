import { useProtectionStore, canManageProtection, updateProtection, banPlayer, unbanPlayer } from '../game/protection';
import { playerIdentity } from '../game/playerIdentity';
import { useFriendStore } from '../game/friends';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { translate } from '../game/language';

export function ProtectionPanel() {
  const protection = useProtectionStore((state) => state.protection);
  const friends = useFriendStore((state) => state.friends);
  const players = useMultiplayerStore((state) => state.players);
  const manage = canManageProtection();
  if (!protection) return <section className="protection-panel"><h3>{translate('Territoire', 'Territory')}</h3><p>{translate('Ce monde plus ancien n’a pas de propriétaire de protection enregistré.', 'This older world has no recorded protection owner.')}</p></section>;
  const people = new Map<string, string>();
  for (const friend of friends) people.set(friend.playerId, friend.name);
  for (const player of players) if (!player.self) people.set(player.playerId, player.name);
  const banned = protection.bannedPlayerIds ?? [];
  for (const playerId of banned) people.delete(playerId);
  const owner = protection.ownerId === playerIdentity() ? translate('toi', 'you') : people.get(protection.ownerId) ?? translate('le propriétaire du monde', 'the world owner');
  return (
    <section className="protection-panel">
      <h3>{translate('Protection du territoire', 'Territory protection')}</h3>
      <p>{translate('Zone d’1 km × 1 km autour du centre du monde, propriété de', '1 km × 1 km area around the world center, owned by')} {owner}.</p>
      <label className="protection-option"><input type="checkbox" checked={protection.enabled} disabled={!manage} onChange={(event) => updateProtection({ enabled: event.target.checked })} /> {translate('Activer la protection', 'Enable protection')}</label>
      {manage && <label className="protection-option"><input type="checkbox" checked={protection.allowedPlayersOnly === true} onChange={(event) => updateProtection({ allowedPlayersOnly: event.target.checked })} /> {translate('Seulement les joueurs cochés peuvent entrer dans mon monde', 'Only selected players can enter my world')}</label>}
      {manage && (
        <>
          <label className="protection-option"><input type="checkbox" checked={protection.canBreak === true} onChange={(event) => updateProtection({ canBreak: event.target.checked })} /> {translate('Les autres joueurs peuvent casser des blocs', 'Other players can break blocks')}</label>
          <label className="protection-option"><input type="checkbox" checked={protection.canPlace === true} onChange={(event) => updateProtection({ canPlace: event.target.checked })} /> {translate('Les autres joueurs peuvent poser des blocs', 'Other players can place blocks')}</label>
          <label className="protection-option"><input type="checkbox" checked={protection.allowDestructiveFire !== false} onChange={(event) => updateProtection({ allowDestructiveFire: event.target.checked })} /> {translate('Autoriser le feu rouge destructeur', 'Allow destructive red fire')}</label>
          <label className="protection-option"><input type="checkbox" checked={protection.allowCampfire !== false} onChange={(event) => updateProtection({ allowCampfire: event.target.checked })} /> {translate('Autoriser le feu de camp non destructeur', 'Allow non-destructive campfire')}</label>
          <label className="protection-option"><input type="checkbox" checked={protection.allowFloodingWater !== false} onChange={(event) => updateProtection({ allowFloodingWater: event.target.checked })} /> {translate('Autoriser l’eau avec inondation', 'Allow flooding water')}</label>
          <label className="protection-option"><input type="checkbox" checked={protection.allowCalmWater !== false} onChange={(event) => updateProtection({ allowCalmWater: event.target.checked })} /> {translate('Autoriser l’eau calme sans inondation', 'Allow calm water without flooding')}</label>
        </>
      )}
      {manage ? (
        <>
          <p>{translate('Choisis qui peut construire et détruire dans cette zone. Ton autorisation est toujours conservée.', 'Choose who can build and break in this area. Your permission is always preserved.')}</p>
          <div className="protection-players">
            {[...people].map(([playerId, name]) => (
              <div className="protection-player-row" key={playerId}>
                <label className="protection-option">
                  <input
                    type="checkbox"
                    checked={protection.allowedPlayerIds.includes(playerId)}
                    onChange={(event) => updateProtection({ allowedPlayerIds: event.target.checked ? [...protection.allowedPlayerIds, playerId] : protection.allowedPlayerIds.filter((id) => id !== playerId) })}
                  />
                  <span>{name} · {protection.allowedPlayersOnly ? translate('entrer et construire', 'enter and build') : translate('construire et détruire', 'build and break')}</span>
                </label>
                <button type="button" className="secondary-button" onClick={() => { if (window.confirm(translate(`Exclure ${name} de ce monde ? Tu pourras le réadmettre ensuite.`, `Ban ${name} from this world? You can readmit them later.`))) banPlayer(playerId); }}>{translate('Exclure', 'Ban')}</button>
              </div>
            ))}
            {people.size === 0 && <p>{translate('Ajoute des amis pour leur autoriser la construction ici.', 'Add friends to allow them to build here.')}</p>}
          </div>
          {banned.length > 0 && (
            <div className="protection-players protection-banned">
              <p>{translate('Joueurs exclus · tu peux les laisser revenir dans ce monde.', 'Banned players · you can let them back into this world.')}</p>
              {banned.map((playerId) => {
                const name = protection.bannedPlayerNames?.[playerId] ?? translate('Joueur', 'Player');
                return <div className="protection-player-row" key={playerId}><span>{name}</span><button type="button" className="primary-button" aria-label={`${translate('Réadmettre', 'Readmit')} ${name}`} onClick={() => unbanPlayer(playerId)}>{translate('Réadmettre', 'Readmit')}</button></div>;
              })}
            </div>
          )}
        </>
      ) : <p>{translate('Seul le propriétaire peut choisir les autorisations de ce territoire.', 'Only the owner can choose permissions for this territory.')}</p>}
    </section>
  );
}
