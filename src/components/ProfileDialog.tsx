import { MenuDialog } from './MenuDialog';
import { ProfileAvatar } from './ProfileAvatar';
import { BoutiqueAvatarPreview } from './BoutiqueAvatarPreview';
import { useCharacterStore } from '../game/characterStore';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useProfileStore } from '../game/profile';
import { OUTFITS } from '../game/outfits';
import { translate } from '../game/language';

function playtime(seconds: number) {
  if (seconds < 60) return translate(`${seconds} seconde${seconds > 1 ? 's' : ''}`, `${seconds} second${seconds > 1 ? 's' : ''}`);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const name = useMultiplayerStore((state) => state.playerName);
  const character = useCharacterStore((state) => state.character);
  const outfit = useCharacterStore((state) => state.outfit);
  const wig = useCharacterStore((state) => state.wig);
  const appearance = useCharacterStore((state) => state.appearance);
  const seconds = useProfileStore((state) => state.seconds);
  const createdAt = useProfileStore((state) => state.createdAt);
  const createdLabel = new Date(createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <MenuDialog title={translate('Mon profil', 'My Profile')} onClose={onClose} className="profile-dialog">
      <div className="world-library-heading"><h2>{translate('Mon profil', 'My Profile')}</h2></div>
      <div className="profile-overview">
        <div className="profile-summary">
          <ProfileAvatar character={character} outfit={outfit} wig={wig} appearance={appearance} size={192} />
          <div className="profile-identity">
            <h3>{name}</h3>
            <dl className="profile-details">
              <div><dt>{translate('Compte créé le', 'Account created on')}</dt><dd>{createdLabel}</dd></div>
              <div><dt>{translate('Temps de jeu', 'Playtime')}</dt><dd>{playtime(seconds)}</dd></div>
              <div><dt>{translate('Personnage', 'Character')}</dt><dd>{character === 'girl' ? translate('Fille', 'Girl') : translate('Garçon', 'Boy')}</dd></div>
              <div><dt>{translate('Tenue actuelle', 'Current Outfit')}</dt><dd>{OUTFITS()[outfit].name}</dd></div>
              <div><dt>{translate('Coiffure', 'Hairstyle')}</dt><dd>{appearance.hairStyle === 'long' ? translate('Cheveux longs', 'Long hair') : translate('Cheveux courts', 'Short hair')}</dd></div>
            </dl>
            <div className="profile-colors" aria-label={translate('Couleurs du personnage', 'Character colors')}>
              <span><i className="profile-color" style={{ backgroundColor: appearance.hairColor }} />{translate('Cheveux', 'Hair')}</span>
              <span><i className="profile-color" style={{ backgroundColor: appearance.eyeColor }} />{translate('Yeux', 'Eyes')}</span>
              <span><i className="profile-color" style={{ backgroundColor: appearance.eyebrowColor ?? appearance.hairColor }} />{translate('Sourcils', 'Eyebrows')}</span>
            </div>
          </div>
        </div>
        <section className="profile-costume" aria-label={translate('Tenue actuelle en 3D', 'Current outfit in 3D')}>
          <h3>{translate('Tenue actuelle', 'Current Outfit')}</h3>
          <strong>{OUTFITS()[outfit].name}</strong>
          <p>{OUTFITS()[outfit].description}</p>
          <BoutiqueAvatarPreview />
        </section>
      </div>
    </MenuDialog>
  );
}
