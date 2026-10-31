import { useCharacterStore } from '../game/characterStore';
import { requestPlay } from '../game/input';
import { OUTFIT_ORDER, OUTFITS, WIG_ORDER, WIGS } from '../game/outfits';
import { useGameStore } from '../game/store';
import { PixelAvatar } from './PixelAvatar';
import shopUrl from '../../assets/menu/shop.webp';

const HAIR_COLORS = ['#49382f', '#25232a', '#8a5838', '#d6b46a', '#d7d0c3', '#a74a82', '#4e79a7', '#50844a'];
const EYE_COLORS = ['#273b4b', '#3d6e45', '#6f4d35', '#4e79a7', '#784da0', '#a13c3c'];
const CLOTHING_COLORS = ['#4d83a7', '#9a5f9f', '#8e303d', '#526647', '#c467a5', '#2d467f', '#b98a53', '#35434c'];

export function BoutiquePanel() {
  const open = useGameStore((state) => state.shopOpen);
  const setOpen = useGameStore((state) => state.setShopOpen);
  const character = useCharacterStore((state) => state.character);
  const outfit = useCharacterStore((state) => state.outfit);
  const wig = useCharacterStore((state) => state.wig);
  const appearance = useCharacterStore((state) => state.appearance);
  const setOutfit = useCharacterStore((state) => state.setOutfit);
  const setWig = useCharacterStore((state) => state.setWig);
  const setAppearance = useCharacterStore((state) => state.setAppearance);
  if (!open) return null;
  const close = () => {
    setOpen(false);
    void requestPlay();
  };
  return (
    <div className="menu-backdrop boutique-backdrop">
      <section className="menu-panel boutique-panel" role="dialog" aria-modal="true" aria-labelledby="boutique-title" style={{ backgroundImage: `linear-gradient(rgba(20,34,24,.93), rgba(20,34,24,.97)), url(${shopUrl})`, backgroundSize: 'cover' }}>
        <div className="boutique-avatar-preview">
          <PixelAvatar character={character} outfit={outfit} wig={wig} appearance={appearance} size={72} />
          <div><p className="eyebrow">PERSONNALISATION</p><h2 id="boutique-title">Boutique</h2><p>Choisis ta tenue. Les autres joueurs la verront aussi.</p></div>
        </div>
        <div className="appearance-section">
          <h3>Coiffure</h3>
          <div className="appearance-options">
            <button className={appearance.hairStyle === 'short' ? 'active' : ''} onClick={() => setAppearance({ hairStyle: 'short' })}>Cheveux courts</button>
            <button className={appearance.hairStyle === 'long' ? 'active' : ''} onClick={() => setAppearance({ hairStyle: 'long' })}>Cheveux longs</button>
          </div>
          <h3>Couleur des cheveux</h3>
          <div className="appearance-options">{HAIR_COLORS.map((color) => <button key={color} className={`color-swatch ${appearance.hairColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setAppearance({ hairColor: color })} aria-label={`Cheveux ${color}`} />)}</div>
          <h3>Couleur des yeux</h3>
          <div className="appearance-options">{EYE_COLORS.map((color) => <button key={color} className={`color-swatch ${appearance.eyeColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setAppearance({ eyeColor: color })} aria-label={`Yeux ${color}`} />)}</div>
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
              <button key={kind} className={`outfit-card ${outfit === kind ? 'active' : ''}`} onClick={() => setOutfit(kind)} aria-pressed={outfit === kind}>
                <span className="outfit-swatch" style={{ backgroundColor: appearance.clothingColor ?? item.color }} />
                <strong>{item.name}</strong>
                <small>{item.description}</small>
                {outfit === kind && <span className="outfit-selected">Portée</span>}
              </button>
            );
          })}
        </div>
        <p className="backpack-label">Perruques · ta perruque reste quand tu changes de costume</p>
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
        <p className="boutique-hint">B ouvre la boutique · P change de caméra.</p>
        <button className="primary-button" onClick={close}>Porter et reprendre</button>
      </section>
    </div>
  );
}
