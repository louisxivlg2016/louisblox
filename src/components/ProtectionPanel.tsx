import { useProtectionStore, canManageProtection, updateProtection, banPlayer, unbanPlayer } from '../game/protection';
import { playerIdentity } from '../game/playerIdentity';
import { useFriendStore } from '../game/friends';
import { useMultiplayerStore } from '../game/multiplayerStore';

export function ProtectionPanel() {
  const protection = useProtectionStore((state) => state.protection);
  const friends = useFriendStore((state) => state.friends);
  const players = useMultiplayerStore((state) => state.players);
  const manage = canManageProtection();
  if (!protection) return <section className="protection-panel"><h3>Territory</h3><p>This older world has no recorded protection owner.</p></section>;
  const people = new Map<string, string>();
  for (const friend of friends) people.set(friend.playerId, friend.name);
  for (const player of players) if (!player.self) people.set(player.playerId, player.name);
  const banned = protection.bannedPlayerIds ?? [];
  for (const playerId of banned) people.delete(playerId);
  const owner = protection.ownerId === playerIdentity() ? 'you' : people.get(protection.ownerId) ?? 'the world owner';
  return (
    <section className="protection-panel">
      <h3>Territory protection</h3>
      <p>1 km × 1 km area around the world center, owned by {owner}.</p>
      <label className="protection-option"><input type="checkbox" checked={protection.enabled} disabled={!manage} onChange={(event) => updateProtection({ enabled: event.target.checked })} /> Enable protection</label>
      {manage && (
        <>
          <label className="protection-option"><input type="checkbox" checked={protection.canBreak === true} onChange={(event) => updateProtection({ canBreak: event.target.checked })} /> Other players can break blocks</label>
          <label className="protection-option"><input type="checkbox" checked={protection.canPlace === true} onChange={(event) => updateProtection({ canPlace: event.target.checked })} /> Other players can place blocks</label>
          <label className="protection-option"><input type="checkbox" checked={protection.allowDestructiveFire !== false} onChange={(event) => updateProtection({ allowDestructiveFire: event.target.checked })} /> Allow destructive red fire</label>
          <label className="protection-option"><input type="checkbox" checked={protection.allowCampfire !== false} onChange={(event) => updateProtection({ allowCampfire: event.target.checked })} /> Allow non-destructive campfire</label>
          <label className="protection-option"><input type="checkbox" checked={protection.allowFloodingWater !== false} onChange={(event) => updateProtection({ allowFloodingWater: event.target.checked })} /> Allow flooding water</label>
          <label className="protection-option"><input type="checkbox" checked={protection.allowCalmWater !== false} onChange={(event) => updateProtection({ allowCalmWater: event.target.checked })} /> Allow calm water without flooding</label>
        </>
      )}
      {manage ? (
        <>
          <p>Choose who can build and break in this area. Your permission is always preserved.</p>
          <div className="protection-players">
            {[...people].map(([playerId, name]) => (
              <div className="protection-player-row" key={playerId}>
                <label className="protection-option">
                  <input
                    type="checkbox"
                    checked={protection.allowedPlayerIds.includes(playerId)}
                    onChange={(event) => updateProtection({ allowedPlayerIds: event.target.checked ? [...protection.allowedPlayerIds, playerId] : protection.allowedPlayerIds.filter((id) => id !== playerId) })}
                  />
                  <span>{name} · build and break</span>
                </label>
                <button type="button" className="secondary-button" onClick={() => { if (window.confirm(`Ban ${name} from this world? You can readmit them later.`)) banPlayer(playerId); }}>Ban</button>
              </div>
            ))}
            {people.size === 0 && <p>Add friends to allow them to build here.</p>}
          </div>
          {banned.length > 0 && (
            <div className="protection-players protection-banned">
              <p>Banned players · you can let them back into this world.</p>
              {banned.map((playerId) => {
                const name = protection.bannedPlayerNames?.[playerId] ?? 'Player';
                return <div className="protection-player-row" key={playerId}><span>{name}</span><button type="button" className="primary-button" aria-label={`Readmit ${name}`} onClick={() => unbanPlayer(playerId)}>Readmit</button></div>;
              })}
            </div>
          )}
        </>
      ) : <p>Only the owner can choose permissions for this territory.</p>}
    </section>
  );
}
