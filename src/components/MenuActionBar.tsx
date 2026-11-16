import soloUrl from '../../assets/menu/solo.webp';
import multiplayerUrl from '../../assets/menu/multiplayer.webp';
import createWorldFrUrl from '../../assets/menu/create-world.webp';
import createWorldEnUrl from '../../assets/ui/english/create-a-world.webp';
import profileFrUrl from '../../assets/menu/profile.webp';
import profileEnUrl from '../../assets/ui/english/profile.webp';
import { translate, useLanguageStore } from '../game/language';

export function MenuActionBar({ multiplayer, onSolo, onMultiplayer, onCreate, onProfile, createDisabled = false }: { multiplayer: boolean; onSolo: () => void; onMultiplayer: () => void; onCreate: () => void; onProfile: () => void; createDisabled?: boolean }) {
  const language = useLanguageStore((state) => state.language);
  return (
    <nav className="menu-action-bar" aria-label={translate('Actions de jeu', 'Game actions')}>
      <button className={`menu-action-button ${!multiplayer ? 'active' : ''}`} aria-label={translate('Jouer en solo', 'Play solo')} aria-pressed={!multiplayer} onClick={onSolo}><img src={soloUrl} alt="" /></button>
      <button className={`menu-action-button ${multiplayer ? 'active' : ''}`} aria-label={translate('Jouer en multijoueur', 'Play multiplayer')} aria-pressed={multiplayer} onClick={onMultiplayer}><img src={multiplayerUrl} alt="" /></button>
      <button className="menu-action-button" aria-label={translate('Créer un monde', 'Create a world')} onClick={onCreate} disabled={createDisabled}><img src={language === 'fr' ? createWorldFrUrl : createWorldEnUrl} alt="" /></button>
      <button className="menu-action-button" aria-label={translate('Voir mon profil', 'View my profile')} onClick={onProfile}><img src={language === 'fr' ? profileFrUrl : profileEnUrl} alt="" /></button>
    </nav>
  );
}
