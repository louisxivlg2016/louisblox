import soloUrl from '../../assets/menu/solo.webp';
import multiplayerUrl from '../../assets/menu/multiplayer.webp';
import createWorldUrl from '../../assets/ui/english/create-a-world.webp';
import profileUrl from '../../assets/ui/english/profile.webp';
import { useLanguageStore, translate } from '../game/language';

export function MenuActionBar({ multiplayer, onSolo, onMultiplayer, onCreate, onProfile, createDisabled = false }: { multiplayer: boolean; onSolo: () => void; onMultiplayer: () => void; onCreate: () => void; onProfile: () => void; createDisabled?: boolean }) {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  return (
    <nav className="menu-action-bar" aria-label={translate('Actions de jeu', 'Game actions')}>
      <button className={`menu-action-button ${!multiplayer ? 'active' : ''}`} aria-label={translate('Jouer en solo', 'Play solo')} aria-pressed={!multiplayer} onClick={onSolo}><img src={soloUrl} alt="" /></button>
      <button className={`menu-action-button ${multiplayer ? 'active' : ''}`} aria-label={translate('Jouer en multijoueur', 'Play multiplayer')} aria-pressed={multiplayer} onClick={onMultiplayer}><img src={multiplayerUrl} alt="" /></button>
      <button className="menu-action-button" aria-label={translate('Créer un monde', 'Create a world')} onClick={onCreate} disabled={createDisabled}><img src={createWorldUrl} alt="" /></button>
      <button className="menu-action-button" aria-label={translate('Voir mon profil', 'View my profile')} onClick={onProfile}><img src={profileUrl} alt="" /></button>
      <div className="language-switch" role="group" aria-label="Language / Langue">
        <button type="button" className={language === 'fr' ? 'active' : ''} aria-pressed={language === 'fr'} onClick={() => setLanguage('fr')}>FR</button>
        <button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
      </div>
    </nav>
  );
}
