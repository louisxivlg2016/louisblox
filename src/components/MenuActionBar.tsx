import soloUrl from '../../assets/menu/solo.webp';
import multiplayerUrl from '../../assets/menu/multiplayer.webp';
import createWorldUrl from '../../assets/ui/english/create-a-world.webp';
import profileUrl from '../../assets/ui/english/profile.webp';

export function MenuActionBar({ multiplayer, onSolo, onMultiplayer, onCreate, onProfile, createDisabled = false }: { multiplayer: boolean; onSolo: () => void; onMultiplayer: () => void; onCreate: () => void; onProfile: () => void; createDisabled?: boolean }) {
  return (
    <nav className="menu-action-bar" aria-label="Game actions">
      <button className={`menu-action-button ${!multiplayer ? 'active' : ''}`} aria-label="Play solo" aria-pressed={!multiplayer} onClick={onSolo}><img src={soloUrl} alt="" /></button>
      <button className={`menu-action-button ${multiplayer ? 'active' : ''}`} aria-label="Play multiplayer" aria-pressed={multiplayer} onClick={onMultiplayer}><img src={multiplayerUrl} alt="" /></button>
      <button className="menu-action-button" aria-label="Create a world" onClick={onCreate} disabled={createDisabled}><img src={createWorldUrl} alt="" /></button>
      <button className="menu-action-button" aria-label="View my profile" onClick={onProfile}><img src={profileUrl} alt="" /></button>
    </nav>
  );
}
