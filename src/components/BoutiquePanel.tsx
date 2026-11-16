import { useState } from 'react';
import { useCharacterStore } from '../game/characterStore';
import { requestPlay } from '../game/input';
import { OUTFIT_ORDER, OUTFITS, WIG_ORDER, WIGS } from '../game/outfits';
import { useGameStore } from '../game/store';
import { defaultAppearance } from '../game/appearance';
import { BoutiqueAvatarPreview } from './BoutiqueAvatarPreview';
import { SettingsPanel } from './SettingsPanel';
import shopFrUrl from '../../assets/menu/shop.webp';
import shopEnUrl from '../../assets/menu/english/shop.webp';
import settingsButtonUrl from '../../assets/ui/settings-button.webp';
import { translate, useLanguageStore } from '../game/language';

const SKIN_COLORS = ['#f0c7a6', '#e7a0aa', '#c98962', '#966045', '#704735', '#493329'];
const HAIR_COLORS = ['#49382f', '#25232a', '#8a5838', '#d6b46a', '#d7d0c3', '#a74a82', '#4e79a7', '#50844a'];
const EYE_COLORS = ['#273b4b', '#3d6e45', '#6f4d35', '#4e79a7', '#784da0', '#a13c3c'];
const CLOTHING_COLORS = ['#4d83a7', '#9a5f9f', '#8e303d', '#526647', '#c467a5', '#2d467f', '#b98a53', '#35434c'];

export function BoutiquePanel() {
  const language = useLanguageStore((state) => state.language);
  const open = useGameStore((state) => state.shopOpen);
  const setOpen = useGameStore((state) => state.setShopOpen);
  const character = useCharacterStore((state) => state.character);
  const setCharacter = useCharacterStore((state) => state.setCharacter);
  const outfit = useCharacterStore((state) => state.outfit);
  const wig = useCharacterStore((state) => state.wig);
  const appearance = useCharacterStore((state) => state.appearance);
  const setOutfit = useCharacterStore((state) => state.setOutfit);
  const setWig = useCharacterStore((state) => state.setWig);
  const setAppearance = useCharacterStore((state) => state.setAppearance);
  const battle = useGameStore((state) => state.gameplayMode === 'battle');
  const [tab, setTab] = useState<'shop' | 'settings'>('shop');
  if (!open) return null;
  const close = () => {
    setOpen(false);
    void requestPlay();
  };
  return (
    <div className="menu-backdrop boutique-backdrop">
      <section className="menu-panel boutique-panel" role="dialog" aria-modal="true" aria-label={translate('Boutique et réglages', 'Shop and settings')} style={{ backgroundImage: `linear-gradient(rgba(20,34,24,.93), rgba(20,34,24,.97)), url(${language === 'fr' ? shopFrUrl : shopEnUrl})`, backgroundSize: 'cover' }}>
        <div className="boutique-layout">
          <nav className="boutique-tabs" role="tablist" aria-label={translate('Boutique et réglages', 'Shop and settings')}>
            <button className={`boutique-tab ${tab === 'shop' ? 'active' : ''}`} role="tab" aria-selected={tab === 'shop'} onClick={() => setTab('shop')}>{translate('Boutique', 'Shop')}</button>
            <button className={`boutique-tab image-tab ${tab === 'settings' ? 'active' : ''}`} role="tab" aria-label={translate('Réglages', 'Settings')} aria-selected={tab === 'settings'} onClick={() => setTab('settings')}><img src={settingsButtonUrl} alt="" /></button>
          </nav>
          <div className={`boutique-content ${tab === 'shop' ? 'with-preview' : ''}`} role="tabpanel">
            {tab === 'settings' ? <SettingsPanel /> : <>
        <div className="boutique-heading"><p className="eyebrow">{translate('PERSONNALISATION', 'CUSTOMIZATION')}</p><h2 id="boutique-title">{translate('Boutique', 'Shop')}</h2><p>{translate('Choisis ta tenue. Ton aperçu 3D reste visible en bas pendant ton choix.', 'Choose your outfit. Your 3D preview stays visible at the bottom while you choose.')}</p></div>
        <div className="character-selector">
          <span>{translate('Personnage', 'Character')}</span>
          <div className="character-choice" role="group" aria-label={translate('Choisir le personnage', 'Choose character')}>
            <button type="button" className={character === 'boy' ? 'active' : ''} aria-pressed={character === 'boy'} onClick={() => setCharacter('boy')}>{translate('Garçon', 'Boy')}</button>
            <button type="button" className={character === 'girl' ? 'active' : ''} aria-pressed={character === 'girl'} onClick={() => setCharacter('girl')}>{translate('Fille', 'Girl')}</button>
            <button type="button" className={`original-character-button ${outfit === 'default' ? 'active' : ''}`} aria-pressed={outfit === 'default'} title={translate('Tenue, coiffure et couleurs du personnage original', 'Original character outfit, hairstyle, and colors')} onClick={() => { setOutfit('default'); setWig('auto'); setAppearance(defaultAppearance(character)); }}>{translate('Personnage original', 'Original character')}</button>
          </div>
        </div>
        <div className="appearance-section">
          {outfit === 'knight' && <p className="appearance-locked-note" role="status">{translate('Le casque du chevalier garde la peau, les cheveux et les sourcils d’origine.', 'The knight helmet keeps the original skin, hair, and eyebrows.')}</p>}
          <fieldset className="appearance-controls" disabled={outfit === 'knight'}>
          <h3>{translate('Coiffure', 'Hairstyle')}</h3>
          <div className="appearance-options">
            <button className={appearance.hairStyle === 'short' ? 'active' : ''} onClick={() => setAppearance({ hairStyle: 'short' })}>{translate('Cheveux courts', 'Short hair')}</button>
            <button className={appearance.hairStyle === 'long' ? 'active' : ''} onClick={() => setAppearance({ hairStyle: 'long' })}>{translate('Cheveux longs', 'Long hair')}</button>
          </div>
          <h3>{translate('Couleur de la peau', 'Skin color')}</h3>
          <div className="appearance-options">
            <button className={appearance.originalSkinColor ? 'active' : ''} aria-pressed={appearance.originalSkinColor} onClick={() => setAppearance({ originalSkinColor: !appearance.originalSkinColor })}>{translate('Peau d’origine', 'Original skin')}</button>
            {SKIN_COLORS.map((color) => <button key={color} className={`color-swatch ${!appearance.originalSkinColor && appearance.skinColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setAppearance({ skinColor: color, originalSkinColor: false })} aria-label={`Skin ${color}`} />)}
          </div>
          {outfit !== 'trader' && outfit !== 'firefighter' && <>
            <h3>{translate('Couleur des cheveux', 'Hair color')}</h3>
            <div className="appearance-options">
              <button className={appearance.originalHairColor ? 'active' : ''} aria-pressed={appearance.originalHairColor} onClick={() => setAppearance({ originalHairColor: !appearance.originalHairColor })}>{translate('Cheveux d’origine', 'Original hair')}</button>
              {HAIR_COLORS.map((color) => <button key={color} className={`color-swatch ${!appearance.originalHairColor && appearance.hairColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setAppearance({ hairColor: color, originalHairColor: false })} aria-label={`Hair ${color}`} />)}
            </div>
          </>}
          {outfit !== 'firefighter' && <>
            <h3>{translate('Couleur des sourcils', 'Eyebrow color')}</h3>
            <div className="appearance-options">
              <button className={appearance.eyebrowColor === null ? 'active' : ''} onClick={() => setAppearance({ eyebrowColor: null })} aria-label={translate('Sourcils comme les cheveux', 'Eyebrows matching hair')}>{translate('Comme les cheveux', 'Same as hair')}</button>
              {HAIR_COLORS.map((color) => <button key={color} className={`color-swatch ${appearance.eyebrowColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setAppearance({ eyebrowColor: color })} aria-label={`Eyebrows ${color}`} />)}
            </div>
          </>}
          </fieldset>
          {outfit !== 'louis15' && <>
            <h3>{translate('Couleur des yeux', 'Eye color')}</h3>
            <div className="appearance-options">{EYE_COLORS.map((color) => <button key={color} className={`color-swatch ${appearance.eyeColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setAppearance({ eyeColor: color })} aria-label={`Eyes ${color}`} />)}</div>
          </>}
          <h3>{translate('Couleur des vêtements', 'Clothing color')}</h3>
          <div className="appearance-options">
            <button className={appearance.clothingColor === null ? 'active' : ''} onClick={() => setAppearance({ clothingColor: null })}>{translate('Du costume', 'Costume default')}</button>
            {CLOTHING_COLORS.map((color) => <button key={color} className={`color-swatch ${appearance.clothingColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setAppearance({ clothingColor: color })} aria-label={`Clothing ${color}`} />)}
          </div>
        </div>
        <div className="outfit-grid">
          {OUTFIT_ORDER.map((kind) => {
            const item = OUTFITS()[kind];
            return (
              <button key={kind} className={`outfit-card ${outfit === kind ? 'active' : ''}`} onClick={() => setOutfit(kind)} disabled={battle && kind !== 'military'} aria-pressed={outfit === kind}>
                <span className="outfit-swatch" style={{ backgroundColor: appearance.clothingColor ?? item.color }} />
                <strong>{item.name}</strong>
                <small>{item.description}</small>
                {outfit === kind && <span className="outfit-selected">{translate('Portée', 'Equipped')}</span>}
              </button>
            );
          })}
        </div>
        <>
            <p className="backpack-label">{translate('Coiffure normale ou perruque · ton choix reste quand tu changes de costume', 'Normal hair or wig · your choice remains when you change costumes')}</p>
            <div className="outfit-grid wig-grid">
              {WIG_ORDER.map((kind) => {
                const item = WIGS()[kind];
                return (
                  <button key={kind} className={`outfit-card ${wig === kind ? 'active' : ''}`} onClick={() => setWig(kind)} aria-pressed={wig === kind}>
                    <span className="outfit-swatch" style={{ backgroundColor: item.color }} />
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                    {wig === kind && <span className="outfit-selected">{translate('Choisie', 'Selected')}</span>}
                  </button>
                );
              })}
            </div>
        </>
        {battle && <p className="backpack-label">{translate('Le costume militaire est obligatoire en Bataille.', 'The military costume is required in Combat mode.')}</p>}
        <p className="boutique-hint">{translate('B ouvre la boutique · M crée une maison en pleine partie · P change de caméra.', 'B opens the shop · M creates a home during gameplay · P changes camera.')}</p>
        <button className="primary-button" onClick={close}>{translate('Porter et reprendre', 'Wear and resume')}</button>
            </>}
          </div>
        </div>
        {tab === 'shop' && <aside className="boutique-avatar-preview boutique-dressing-room" aria-label={translate('Aperçu de ton personnage', 'Your character preview')}>
          <BoutiqueAvatarPreview />
          <strong>{OUTFITS()[outfit].name}</strong>
        </aside>}
      </section>
    </div>
  );
}
