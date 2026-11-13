import { useProtectionStore, canManageProtection, updateProtection, banPlayer, unbanPlayer } from '../game/protection';
import { playerIdentity } from '../game/playerIdentity';
import { useFriendStore } from '../game/friends';
import { useMultiplayerStore } from '../game/multiplayerStore';

export function ProtectionPanel() {
  const protection = useProtectionStore((state) => state.protection);
  const friends = useFriendStore((state) => state.friends);
  const players = useMultiplayerStore((state) => state.players);
  const manage = canManageProtection();
  if (!protection) return <section className="protection-panel"><h3>Territoire</h3><p>Ce monde plus ancien n’a pas de propriétaire de protection enregistré.</p></section>;
  const people = new Map<string, string>();
  for (const friend of friends) people.set(friend.playerId, friend.name);
  for (const player of players) if (!player.self) people.set(player.playerId, player.name);
  const banned = protection.bannedPlayerIds ?? [];
  for (const playerId of banned) people.delete(playerId);
  const owner = protection.ownerId === playerIdentity() ? 'toi' : people.get(protection.ownerId) ?? 'le propriétaire du monde';
  return (
    <section className="protection-panel">
      <h3>Protection du territoire</h3>
      <p>Zone d’1 km × 1 km autour du centre du monde, propriété de {owner}.</p>
      <label className="protection-option"><input type="checkbox" checked={protection.enabled} disabled={!manage} onChange={(event) => updateProtection({ enabled: event.target.checked })} /> Activer la protection</label>
      {manage && (
        <>
          <label className="protection-option"><input type="checkbox" checked={protection.canBreak === true} onChange={(event) => updateProtection({ canBreak: event.target.checked })} /> Les autres joueurs peuvent casser des blocs</label>
          <label className="protection-option"><input type="checkbox" checked={protection.canPlace === true} onChange={(event) => updateProtection({ canPlace: event.target.checked })} /> Les autres joueurs peuvent poser des blocs</label>
          <label className="protection-option"><input type="checkbox" checked={protection.allowDestructiveFire !== false} onChange={(event) => updateProtection({ allowDestructiveFire: event.target.checked })} /> Autoriser le feu rouge destructeur</label>
          <label className="protection-option"><input type="checkbox" checked={protection.allowCampfire !== false} onChange={(event) => updateProtection({ allowCampfire: event.target.checked })} /> Autoriser le feu de camp non destructeur</label>
          <label className="protection-option"><input type="checkbox" checked={protection.allowFloodingWater !== false} onChange={(event) => updateProtection({ allowFloodingWater: event.target.checked })} /> Autoriser l’eau avec inondation</label>
          <label className="protection-option"><input type="checkbox" checked={protection.allowCalmWater !== false} onChange={(event) => updateProtection({ allowCalmWater: event.target.checked })} /> Autoriser l’eau calme sans inondation</label>
        </>
      )}
      {manage ? (
        <>
          <p>Choisis qui peut construire et détruire dans cette zone. Ton autorisation est toujours conservée.</p>
          <div className="protection-players">
            {[...people].map(([playerId, name]) => (
              <div className="protection-player-row" key={playerId}>
                <label className="protection-option">
                  <input
                    type="checkbox"
                    checked={protection.allowedPlayerIds.includes(playerId)}
                    onChange={(event) => updateProtection({ allowedPlayerIds: event.target.checked ? [...protection.allowedPlayerIds, playerId] : protection.allowedPlayerIds.filter((id) => id !== playerId) })}
                  />
                  <span>{name} · construire et détruire</span>
                </label>
                <button type="button" className="secondary-button" onClick={() => { if (window.confirm(`Exclure ${name} de ce monde ? Tu pourras le réadmettre ensuite.`)) banPlayer(playerId); }}>Exclure</button>
              </div>
            ))}
            {people.size === 0 && <p>Ajoute des amis pour leur autoriser la construction ici.</p>}
          </div>
          {banned.length > 0 && (
            <div className="protection-players protection-banned">
              <p>Joueurs exclus · tu peux les laisser revenir dans ce monde.</p>
              {banned.map((playerId) => {
                const name = protection.bannedPlayerNames?.[playerId] ?? 'Joueur';
                return <div className="protection-player-row" key={playerId}><span>{name}</span><button type="button" className="primary-button" aria-label={`Réadmettre ${name}`} onClick={() => unbanPlayer(playerId)}>Réadmettre</button></div>;
              })}
            </div>
          )}
        </>
      ) : <p>Seul le propriétaire peut choisir les autorisations de ce territoire.</p>}
    </section>
  );
}
