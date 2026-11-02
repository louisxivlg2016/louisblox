import soloUrl from '../../assets/menu/solo.webp';
import multiplayerUrl from '../../assets/menu/multiplayer.webp';
import createWorldUrl from '../../assets/menu/create-world.webp';
import profileUrl from '../../assets/menu/profile.webp';

export function MenuActionBar({ multiplayer, onSolo, onMultiplayer, onCreate, onProfile }: { multiplayer: boolean; onSolo: () => void; onMultiplayer: () => void; onCreate: () => void; onProfile: () => void }) {
  return (
    <nav className="menu-action-bar" aria-label="Actions de jeu">
      <button className={`menu-action-button ${!multiplayer ? 'active' : ''}`} aria-label="Jouer en solo" aria-pressed={!multiplayer} onClick={onSolo}><img src={soloUrl} alt="" /></button>
      <button className={`menu-action-button ${multiplayer ? 'active' : ''}`} aria-label="Jouer en multijoueur" aria-pressed={multiplayer} onClick={onMultiplayer}><img src={multiplayerUrl} alt="" /></button>
      <button className="menu-action-button" aria-label="Créer un monde" onClick={onCreate}><img src={createWorldUrl} alt="" /></button>
      <button className="menu-action-button" aria-label="Voir mon profil" onClick={onProfile}><img src={profileUrl} alt="" /></button>
    </nav>
  );
}
