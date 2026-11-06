import { useAvatarStore } from '../game/avatar';
import type { ProfileAvatarKind } from '../game/avatar';
import type { CharacterAppearance } from '../game/appearance';
import type { CharacterKind } from '../game/characterStore';
import type { OutfitKind, WigSelection } from '../game/outfits';
import { PixelAvatar } from './PixelAvatar';
import louis14Url from '../../assets/avatars/louis14.webp';
import louis15Url from '../../assets/avatars/louis15.webp';
import kingUrl from '../../assets/avatars/king.webp';
import explorerUrl from '../../assets/avatars/explorer.webp';
import princessUrl from '../../assets/avatars/princess.webp';
import knightUrl from '../../assets/avatars/knight.webp';
import militaryUrl from '../../assets/avatars/military.webp';
import pirateUrl from '../../assets/avatars/pirate.webp';
import footballerUrl from '../../assets/avatars/footballer.webp';
import firefighterUrl from '../../assets/avatars/firefighter.webp';
import policeUrl from '../../assets/avatars/police.webp';

export const PHOTO_AVATARS = {
  louis14: { name: 'Louis XIV', url: louis14Url },
  louis15: { name: 'Louis XV', url: louis15Url },
  king: { name: 'Roi', url: kingUrl },
  explorer: { name: 'Explorateur', url: explorerUrl },
  princess: { name: 'Princesse', url: princessUrl },
  knight: { name: 'Chevalier', url: knightUrl },
  military: { name: 'Militaire', url: militaryUrl },
  pirate: { name: 'Pirate', url: pirateUrl },
  footballer: { name: 'Joueur de foot', url: footballerUrl },
  firefighter: { name: 'Pompier', url: firefighterUrl },
  police: { name: 'Policier', url: policeUrl },
} as const;
const photoKinds = Object.keys(PHOTO_AVATARS) as Array<keyof typeof PHOTO_AVATARS>;

export function ProfileAvatar({ kind, character, outfit, wig, appearance, size = 58 }: {
  kind?: ProfileAvatarKind | OutfitKind;
  character?: CharacterKind;
  outfit?: OutfitKind;
  wig?: WigSelection;
  appearance?: CharacterAppearance;
  size?: number;
}) {
  const selected = useAvatarStore((state) => state.kind);
  const current = kind ?? selected;
  if (current === 'pixel' || current === 'soldier' || current === 'default' || current === 'trader') return <PixelAvatar character={character} outfit={outfit} wig={wig} appearance={appearance} size={size} />;
  const photo = PHOTO_AVATARS[current];
  return <img className={`profile-photo${current === 'footballer' ? ' profile-photo-footballer' : ''}`} src={photo.url} width={size} height={size} alt={`Photo ${photo.name}`} />;
}

export function ProfilePhotoPicker({ onClose }: { onClose: () => void }) {
  const selected = useAvatarStore((state) => state.kind);
  const setKind = useAvatarStore((state) => state.setKind);
  const choose = (kind: ProfileAvatarKind) => {
    setKind(kind);
    onClose();
  };
  return (
    <div className="profile-photo-picker" role="group" aria-label="Choisir ma photo">
      <button className={`profile-photo-choice ${selected === 'pixel' ? 'active' : ''}`} onClick={() => choose('pixel')} aria-pressed={selected === 'pixel'}>
        <PixelAvatar size={48} />
        <span>Voxel</span>
      </button>
      {photoKinds.map((kind) => (
        <button key={kind} className={`profile-photo-choice ${selected === kind ? 'active' : ''}`} onClick={() => choose(kind)} aria-pressed={selected === kind} aria-label={`Choisir ${PHOTO_AVATARS[kind].name}`}>
          <ProfileAvatar kind={kind} size={56} />
          <span>{PHOTO_AVATARS[kind].name}</span>
        </button>
      ))}
    </div>
  );
}
