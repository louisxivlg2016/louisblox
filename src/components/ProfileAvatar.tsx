import { useEffect, useRef, useState } from 'react';
import { useAvatarStore } from '../game/avatar';
import type { ProfileAvatarKind } from '../game/avatar';
import type { CharacterAppearance } from '../game/appearance';
import type { CharacterKind } from '../game/characterStore';
import type { OutfitKind, WigSelection } from '../game/outfits';
import girlUrl from '../../assets/avatars/fille.webp';
import girlDarkUrl from '../../assets/avatars/fille-noir.webp';
import girlBrownUrl from '../../assets/avatars/fille-brune.webp';
import girlRedUrl from '../../assets/avatars/fille-rousse.webp';
import girlBlackUrl from '../../assets/avatars/fille-noire.webp';
import boyUrl from '../../assets/avatars/garcon.webp';
import boyDarkUrl from '../../assets/avatars/garcon-noir.webp';
import boyBrownUrl from '../../assets/avatars/garcon-brun.webp';
import boyRedUrl from '../../assets/avatars/garcon-roux.webp';
import boyBlackUrl from '../../assets/avatars/garcon-cheveux-noirs.webp';
import traderUrl from '../../assets/avatars/marchand.webp';
import soldierUrl from '../../assets/avatars/soldat.webp';
import louis14Url from '../../assets/avatars/louis14.webp';
import louis15Url from '../../assets/avatars/louis15.webp';
import kingUrl from '../../assets/avatars/king.webp';
import explorerUrl from '../../assets/avatars/explorer.webp';
import princessUrl from '../../assets/avatars/princess.webp';
import knightUrl from '../../assets/avatars/knight.webp';
import militaryUrl from '../../assets/avatars/military.webp';
import pirateUrl from '../../assets/avatars/pirate.webp';
import corsairUrl from '../../assets/avatars/corsair.webp';
import footballerUrl from '../../assets/avatars/footballer.webp';
import firefighterUrl from '../../assets/avatars/firefighter.webp';
import policeUrl from '../../assets/avatars/police.webp';
import workerUrl from '../../assets/avatars/worker.webp';
import { translate } from '../game/language';

export const PHOTO_AVATARS = () => ({
  girl: { name: 'Girl', url: girlUrl },
  'girl-dark': { name: translate('Fille peau foncée', 'Dark-skinned girl'), url: girlDarkUrl },
  'girl-brown': { name: 'Brunette girl · brown eyes', url: girlBrownUrl },
  'girl-red': { name: 'Red-haired girl · green eyes', url: girlRedUrl },
  'girl-black': { name: 'Black-haired girl · blue eyes', url: girlBlackUrl },
  boy: { name: translate('Garçon', 'Boy'), url: boyUrl },
  'boy-dark': { name: translate('Garçon peau foncé', 'Dark-skinned boy'), url: boyDarkUrl },
  'boy-brown': { name: translate('Garçon brun · yeux verts', 'Brunette boy · green eyes'), url: boyBrownUrl },
  'boy-red': { name: translate('Garçon roux · yeux bleus', 'Red-haired boy · blue eyes'), url: boyRedUrl },
  'boy-black': { name: translate('Garçon cheveux noirs · yeux violets', 'Black-haired boy · purple eyes'), url: boyBlackUrl },
  trader: { name: 'Trader', url: traderUrl },
  soldier: { name: 'Soldier', url: soldierUrl },
  louis14: { name: 'Louis XIV', url: louis14Url },
  louis15: { name: 'Louis XV', url: louis15Url },
  king: { name: 'King', url: kingUrl },
  explorer: { name: 'Explorer', url: explorerUrl },
  princess: { name: 'Princess', url: princessUrl },
  knight: { name: 'Knight', url: knightUrl },
  military: { name: 'Military', url: militaryUrl },
  pirate: { name: 'Pirate', url: pirateUrl },
  corsair: { name: 'Bandana Pirate', url: corsairUrl },
  footballer: { name: translate('Joueur de foot', 'Footballer'), url: footballerUrl },
  firefighter: { name: 'Firefighter', url: firefighterUrl },
  worker: { name: 'Construction Worker', url: workerUrl },
  police: { name: 'Police Officer', url: policeUrl },
});
const photoKinds = Object.keys(PHOTO_AVATARS()) as Array<keyof ReturnType<typeof PHOTO_AVATARS>>;

export function ProfileAvatar({ kind, size = 58, outfit }: {
  kind?: ProfileAvatarKind | OutfitKind;
  character?: CharacterKind;
  outfit?: OutfitKind;
  wig?: WigSelection;
  appearance?: CharacterAppearance;
  size?: number;
}) {
  const selected = useAvatarStore((state) => state.kind);
  const current = kind ?? (outfit && outfit !== 'default' ? outfit : selected);
  const photoKind = current === 'pixel' || current === 'default' ? 'boy' : current;
  const photo = PHOTO_AVATARS()[photoKind];
  const newPortrait = ['girl', 'boy', 'trader', 'soldier'].includes(photoKind) || photoKind.startsWith('girl-') || photoKind.startsWith('boy-');
  return <img className={`profile-photo${current === 'footballer' ? ' profile-photo-footballer' : ''}${newPortrait ? ' profile-photo-new' : ''}`} src={photo.url} width={size} height={size} alt={`Portrait ${photo.name}`} />;
}

export function ProfilePhotoPicker({ onClose }: { onClose: () => void }) {
  const selected = useAvatarStore((state) => state.kind);
  const setKind = useAvatarStore((state) => state.setKind);
  const picker = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  useEffect(() => {
    const element = picker.current;
    if (!element) return;
    const update = () => {
      setScrollable(element.scrollHeight > element.clientHeight + 1);
      setAtBottom(element.scrollTop + element.clientHeight >= element.scrollHeight - 8);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
  const choose = (kind: ProfileAvatarKind) => {
    setKind(kind);
    onClose();
  };
  return (
    <div ref={picker} className="profile-photo-picker" role="group" aria-label={translate(`Choisir ma photo, ${photoKinds.length} profils`, `Choose my photo, ${photoKinds.length} profiles`, `Elegir mi foto, ${photoKinds.length} perfiles`)} tabIndex={0} onScroll={(event) => { const element = event.currentTarget; setAtBottom(element.scrollTop + element.clientHeight >= element.scrollHeight - 8); }}>
      {scrollable && !atBottom && <p className="profile-photo-scroll-hint">{translate('Fais défiler pour voir les autres profils ↓', 'Scroll to see more profiles ↓')}</p>}
      {photoKinds.map((kind) => (
        <button key={kind} className={`profile-photo-choice ${selected === kind ? 'active' : ''}`} onClick={() => choose(kind)} aria-pressed={selected === kind} aria-label={translate(`Choisir ${PHOTO_AVATARS()[kind].name}`, `Choose ${PHOTO_AVATARS()[kind].name}`, `Elegir ${PHOTO_AVATARS()[kind].name}`)} title={PHOTO_AVATARS()[kind].name}>
          <ProfileAvatar kind={kind} size={96} />
          <span>{PHOTO_AVATARS()[kind].name}</span>
        </button>
      ))}
    </div>
  );
}
