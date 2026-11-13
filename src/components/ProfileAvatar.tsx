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

export const PHOTO_AVATARS = {
  girl: { name: 'Fille', url: girlUrl },
  'girl-dark': { name: 'Fille peau foncée', url: girlDarkUrl },
  'girl-brown': { name: 'Fille brune · yeux marron', url: girlBrownUrl },
  'girl-red': { name: 'Fille rousse · yeux verts', url: girlRedUrl },
  'girl-black': { name: 'Fille cheveux noirs · yeux bleus', url: girlBlackUrl },
  boy: { name: 'Garçon', url: boyUrl },
  'boy-dark': { name: 'Garçon peau foncé', url: boyDarkUrl },
  'boy-brown': { name: 'Garçon brun · yeux verts', url: boyBrownUrl },
  'boy-red': { name: 'Garçon roux · yeux bleus', url: boyRedUrl },
  'boy-black': { name: 'Garçon cheveux noirs · yeux violets', url: boyBlackUrl },
  trader: { name: 'Marchand', url: traderUrl },
  soldier: { name: 'Soldat', url: soldierUrl },
  louis14: { name: 'Louis XIV', url: louis14Url },
  louis15: { name: 'Louis XV', url: louis15Url },
  king: { name: 'Roi', url: kingUrl },
  explorer: { name: 'Explorateur', url: explorerUrl },
  princess: { name: 'Princesse', url: princessUrl },
  knight: { name: 'Chevalier', url: knightUrl },
  military: { name: 'Militaire', url: militaryUrl },
  pirate: { name: 'Pirate', url: pirateUrl },
  corsair: { name: 'Pirate au bandeau', url: corsairUrl },
  footballer: { name: 'Joueur de foot', url: footballerUrl },
  firefighter: { name: 'Pompier', url: firefighterUrl },
  police: { name: 'Policier', url: policeUrl },
} as const;
const photoKinds = Object.keys(PHOTO_AVATARS) as Array<keyof typeof PHOTO_AVATARS>;

export function ProfileAvatar({ kind, size = 58 }: {
  kind?: ProfileAvatarKind | OutfitKind;
  character?: CharacterKind;
  outfit?: OutfitKind;
  wig?: WigSelection;
  appearance?: CharacterAppearance;
  size?: number;
}) {
  const selected = useAvatarStore((state) => state.kind);
  const current = kind ?? selected;
  const photoKind = current === 'pixel' || current === 'default' ? 'boy' : current;
  const photo = PHOTO_AVATARS[photoKind];
  const newPortrait = ['girl', 'boy', 'trader', 'soldier'].includes(photoKind) || photoKind.startsWith('girl-') || photoKind.startsWith('boy-');
  return <img className={`profile-photo${current === 'footballer' ? ' profile-photo-footballer' : ''}${newPortrait ? ' profile-photo-new' : ''}${photoKind === 'boy-dark' ? ' profile-photo-large' : ''}`} src={photo.url} width={size} height={size} alt={`Portrait ${photo.name}`} />;
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
    <div ref={picker} className="profile-photo-picker" role="group" aria-label={`Choisir ma photo, ${photoKinds.length} profils`} tabIndex={0} onScroll={(event) => { const element = event.currentTarget; setAtBottom(element.scrollTop + element.clientHeight >= element.scrollHeight - 8); }}>
      {scrollable && !atBottom && <p className="profile-photo-scroll-hint">Fais défiler pour voir les autres profils ↓</p>}
      {photoKinds.map((kind) => (
        <button key={kind} className={`profile-photo-choice ${selected === kind ? 'active' : ''}`} onClick={() => choose(kind)} aria-pressed={selected === kind} aria-label={`Choisir ${PHOTO_AVATARS[kind].name}`} title={PHOTO_AVATARS[kind].name}>
          <ProfileAvatar kind={kind} size={kind === 'boy-dark' ? 96 : 56} />
          <span>{PHOTO_AVATARS[kind].name}</span>
        </button>
      ))}
    </div>
  );
}
