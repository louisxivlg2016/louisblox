import { useProtectionStore, canManageProtection, updateProtection } from '../game/protection';
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
  const owner = protection.ownerId === playerIdentity() ? 'toi' : people.get(protection.ownerId) ?? 'le propriétaire du monde';
  return (
    <section className="protection-panel">
      <h3>Protection du territoire</h3>
      <p>Zone d’1 km × 1 km autour du centre du monde, propriété de {owner}.</p>
      <label className="protection-option"><input type="checkbox" checked={protection.enabled} disabled={!manage} onChange={(event) => updateProtection({ enabled: event.target.checked })} /> Activer la protection</label>
      {manage ? (
        <>
          <p>Choisis qui peut construire et détruire dans cette zone. Ton autorisation est toujours conservée.</p>
          <div className="protection-players">
            {[...people].map(([playerId, name]) => (
              <label className="protection-option" key={playerId}>
                <input
                  type="checkbox"
                  checked={protection.allowedPlayerIds.includes(playerId)}
                  onChange={(event) => updateProtection({ allowedPlayerIds: event.target.checked ? [...protection.allowedPlayerIds, playerId] : protection.allowedPlayerIds.filter((id) => id !== playerId) })}
                />
                <span>{name} · construire et détruire</span>
              </label>
            ))}
            {people.size === 0 && <p>Ajoute des amis pour leur autoriser la construction ici.</p>}
          </div>
        </>
      ) : <p>Seul le propriétaire peut choisir les autorisations de ce territoire.</p>}
    </section>
  );
}
