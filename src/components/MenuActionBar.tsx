import multiplayerUrl from '../../assets/menu/multiplayer.webp';
import createWorldFrUrl from '../../assets/menu/create-world.webp';
import createWorldEnUrl from '../../assets/ui/english/create-a-world.webp';
import createWorldEsUrl from '../../assets/ui/spanish/crear-un-mundo.webp';
import profileFrUrl from '../../assets/menu/profile.webp';
import profileEnUrl from '../../assets/ui/english/profile.webp';
import profileEsUrl from '../../assets/ui/spanish/perfil.webp';
import shopFrUrl from '../../assets/menu/shop.webp';
import shopEnUrl from '../../assets/menu/english/shop.webp';
import shopEsUrl from '../../assets/menu/spanish/tienda.webp';
import { translate, useLanguageStore } from '../game/language';

export function MenuActionBar({ multiplayer, onMultiplayer, onCreate, onProfile, onShop, createDisabled = false }: { multiplayer: boolean; onMultiplayer: () => void; onCreate: () => void; onProfile: () => void; onShop: () => void; createDisabled?: boolean }) {
  useLanguageStore((state) => state.language);
  return (
    <nav className="menu-action-bar" aria-label={translate('Actions de jeu', 'Game actions')}>
      <button className={`menu-action-button ${multiplayer ? 'active' : ''}`} aria-label={translate('Jouer en multijoueur', 'Play multiplayer')} aria-pressed={multiplayer} onClick={onMultiplayer}><img src={multiplayerUrl} alt="" /></button>
      <button className="menu-action-button" aria-label={translate('Créer un monde', 'Create a world')} onClick={onCreate} disabled={createDisabled}><img src={translate(createWorldFrUrl, createWorldEnUrl, createWorldEsUrl)} alt="" /></button>
      <button className="menu-action-button" aria-label={translate('Voir mon profil', 'View my profile')} onClick={onProfile}><img src={translate(profileFrUrl, profileEnUrl, profileEsUrl)} alt="" /></button>
      <button className="menu-action-button" aria-label={translate('Ouvrir la boutique', 'Open shop')} onClick={onShop}><img src={translate(shopFrUrl, shopEnUrl, shopEsUrl)} alt="" /></button>
    </nav>
  );
}
