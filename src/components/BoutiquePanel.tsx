import { useState } from 'react';
import { useCharacterStore } from '../game/characterStore';
import { requestPlay } from '../game/input';
import { OUTFIT_ORDER, OUTFITS, WIG_ORDER, WIGS } from '../game/outfits';
import { useGameStore } from '../game/store';
import { defaultAppearance } from '../game/appearance';
import { BoutiqueAvatarPreview } from './BoutiqueAvatarPreview';
import { SettingsPanel } from './SettingsPanel';
import shopUrl from '../../assets/menu/shop.webp';
import settingsButtonUrl from '../../assets/ui/settings-button.webp';

const SKIN_COLORS = ['#f0c7a6', '#e7a0aa', '#c98962', '#966045', '#704735', '#493329'];
const HAIR_COLORS = ['#49382f', '#25232a', '#8a5838', '#d6b46a', '#d7d0c3', '#a74a82', '#4e79a7', '#50844a'];
const EYE_COLORS = ['#273b4b', '#3d6e45', '#6f4d35', '#4e79a7', '#784da0', '#a13c3c'];
const CLOTHING_COLORS = ['#4d83a7', '#9a5f9f', '#8e303d', '#526647', '#c467a5', '#2d467f', '#b98a53', '#35434c'];

export function BoutiquePanel() {
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
      <section className="menu-panel boutique-panel" role="dialog" aria-modal="true" aria-label="Boutique et réglages" style={{ backgroundImage: `linear-gradient(rgba(20,34,24,.93), rgba(20,34,24,.97)), url(${shopUrl})`, backgroundSize: 'cover' }}>
        <div className="boutique-layout">
          <nav className="boutique-tabs" role="tablist" aria-label="Boutique et réglages">
            <button className={`boutique-tab ${tab === 'shop' ? 'active' : ''}`} role="tab" aria-selected={tab === 'shop'} onClick={() => setTab('shop')}>Boutique</button>
            <button className={`boutique-tab image-tab ${tab === 'settings' ? 'active' : ''}`} role="tab" aria-label="Réglages" aria-selected={tab === 'settings'} onClick={() => setTab('settings')}><img src={settingsButtonUrl} alt="" /></button>
          </nav>
          <div className={`boutique-content ${tab === 'shop' ? 'with-preview' : ''}`} role="tabpanel">
            {tab === 'settings' ? <SettingsPanel /> : <>
        <div className="boutique-heading"><p className="eyebrow">PERSONNALISATION</p><h2 id="boutique-title">Boutique</h2><p>Choisis ta tenue. Ton aperçu 3D reste visible en bas pendant ton choix.</p></div>
        <div className="character-selector">
          <span>Personnage</span>
          <div className="character-choice" role="group" aria-label="Choisir le personnage">
            <button type="button" className={character === 'boy' ? 'active' : ''} aria-pressed={character === 'boy'} onClick={() => setCharacter('boy')}>Garçon</button>
            <button type="button" className={character === 'girl' ? 'active' : ''} aria-pressed={character === 'girl'} onClick={() => setCharacter('girl')}>Fille</button>
            <button type="button" className={`original-character-button ${outfit === 'default' ? 'active' : ''}`} aria-pressed={outfit === 'default'} title="Tenue, coiffure et couleurs du personnage original" onClick={() => { setOutfit('default'); setWig('auto'); setAppearance(defaultAppearance(character)); }}>Personnage original</button>
          </div>
        </div>
        <div className="appearance-section">
          <h3>Coiffure</h3>
          <div className="appearance-options">
            <button className={appearance.hairStyle === 'short' ? 'active' : ''} onClick={() => setAppearance({ hairStyle: 'short' })}>Cheveux courts</button>
            <button className={appearance.hairStyle === 'long' ? 'active' : ''} onClick={() => setAppearance({ hairStyle: 'long' })}>Cheveux longs</button>
          </div>
          <h3>Couleur de la peau</h3>
          <div className="appearance-options">
            <button className={appearance.originalSkinColor ? 'active' : ''} aria-pressed={appearance.originalSkinColor} onClick={() => setAppearance({ originalSkinColor: !appearance.originalSkinColor })}>Peau d’origine</button>
            {SKIN_COLORS.map((color) => <button key={color} className={`color-swatch ${!appearance.originalSkinColor && appearance.skinColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setAppearance({ skinColor: color, originalSkinColor: false })} aria-label={`Peau ${color}`} />)}
          </div>
          {outfit !== 'trader' && outfit !== 'firefighter' && <>
            <h3>Couleur des cheveux</h3>
            <div className="appearance-options">
              <button className={appearance.originalHairColor ? 'active' : ''} aria-pressed={appearance.originalHairColor} onClick={() => setAppearance({ originalHairColor: !appearance.originalHairColor })}>Cheveux d’origine</button>
              {HAIR_COLORS.map((color) => <button key={color} className={`color-swatch ${!appearance.originalHairColor && appearance.hairColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setAppearance({ hairColor: color, originalHairColor: false })} aria-label={`Cheveux ${color}`} />)}
            </div>
          </>}
          {outfit !== 'firefighter' && <>
            <h3>Couleur des sourcils</h3>
            <div className="appearance-options">
              <button className={appearance.eyebrowColor === null ? 'active' : ''} onClick={() => setAppearance({ eyebrowColor: null })} aria-label="Sourcils comme les cheveux">Comme les cheveux</button>
              {HAIR_COLORS.map((color) => <button key={color} className={`color-swatch ${appearance.eyebrowColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setAppearance({ eyebrowColor: color })} aria-label={`Sourcils ${color}`} />)}
            </div>
          </>}
          {outfit !== 'louis15' && <>
            <h3>Couleur des yeux</h3>
            <div className="appearance-options">{EYE_COLORS.map((color) => <button key={color} className={`color-swatch ${appearance.eyeColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setAppearance({ eyeColor: color })} aria-label={`Yeux ${color}`} />)}</div>
          </>}
          <h3>Couleur des vêtements</h3>
          <div className="appearance-options">
            <button className={appearance.clothingColor === null ? 'active' : ''} onClick={() => setAppearance({ clothingColor: null })}>Du costume</button>
            {CLOTHING_COLORS.map((color) => <button key={color} className={`color-swatch ${appearance.clothingColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setAppearance({ clothingColor: color })} aria-label={`Vêtements ${color}`} />)}
          </div>
        </div>
        <div className="outfit-grid">
          {OUTFIT_ORDER.map((kind) => {
            const item = OUTFITS[kind];
            return (
              <button key={kind} className={`outfit-card ${outfit === kind ? 'active' : ''}`} onClick={() => setOutfit(kind)} disabled={battle && kind !== 'military'} aria-pressed={outfit === kind}>
                <span className="outfit-swatch" style={{ backgroundColor: appearance.clothingColor ?? item.color }} />
                <strong>{item.name}</strong>
                <small>{item.description}</small>
                {outfit === kind && <span className="outfit-selected">Portée</span>}
              </button>
            );
          })}
        </div>
        <>
            <p className="backpack-label">Coiffure normale ou perruque · ton choix reste quand tu changes de costume</p>
            <div className="outfit-grid wig-grid">
              {WIG_ORDER.map((kind) => {
                const item = WIGS[kind];
                return (
                  <button key={kind} className={`outfit-card ${wig === kind ? 'active' : ''}`} onClick={() => setWig(kind)} aria-pressed={wig === kind}>
                    <span className="outfit-swatch" style={{ backgroundColor: item.color }} />
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                    {wig === kind && <span className="outfit-selected">Choisie</span>}
                  </button>
                );
              })}
            </div>
        </>
        {battle && <p className="backpack-label">Le costume militaire est obligatoire en Bataille.</p>}
        <p className="boutique-hint">B ouvre la boutique · M crée une maison en pleine partie · P change de caméra.</p>
        <button className="primary-button" onClick={close}>Porter et reprendre</button>
            </>}
          </div>
        </div>
        {tab === 'shop' && <aside className="boutique-avatar-preview boutique-dressing-room" aria-label="Aperçu de ton personnage">
          <BoutiqueAvatarPreview />
          <strong>{OUTFITS[outfit].name}</strong>
        </aside>}
      </section>
    </div>
  );
}
