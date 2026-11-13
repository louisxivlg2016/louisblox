import { MenuDialog } from './MenuDialog';
import { ProfileAvatar } from './ProfileAvatar';
import { BoutiqueAvatarPreview } from './BoutiqueAvatarPreview';
import { useCharacterStore } from '../game/characterStore';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useProfileStore } from '../game/profile';
import { OUTFITS } from '../game/outfits';

function playtime(seconds: number) {
  if (seconds < 60) return `${seconds} seconde${seconds > 1 ? 's' : ''}`;
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
  const createdLabel = new Date(createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <MenuDialog title="Mon profil" onClose={onClose} className="profile-dialog">
      <div className="world-library-heading"><h2>Mon profil</h2></div>
      <div className="profile-overview">
        <div className="profile-summary">
          <ProfileAvatar character={character} outfit={outfit} wig={wig} appearance={appearance} size={192} />
          <div className="profile-identity">
            <h3>{name}</h3>
            <dl className="profile-details">
              <div><dt>Compte créé le</dt><dd>{createdLabel}</dd></div>
              <div><dt>Temps de jeu</dt><dd>{playtime(seconds)}</dd></div>
              <div><dt>Personnage</dt><dd>{character === 'girl' ? 'Fille' : 'Garçon'}</dd></div>
              <div><dt>Tenue actuelle</dt><dd>{OUTFITS[outfit].name}</dd></div>
              <div><dt>Coiffure</dt><dd>{appearance.hairStyle === 'long' ? 'Cheveux longs' : 'Cheveux courts'}</dd></div>
            </dl>
            <div className="profile-colors" aria-label="Couleurs du personnage">
              <span><i className="profile-color" style={{ backgroundColor: appearance.hairColor }} />Cheveux</span>
              <span><i className="profile-color" style={{ backgroundColor: appearance.eyeColor }} />Yeux</span>
              <span><i className="profile-color" style={{ backgroundColor: appearance.eyebrowColor ?? appearance.hairColor }} />Sourcils</span>
            </div>
          </div>
        </div>
        <section className="profile-costume" aria-label="Tenue actuelle en 3D">
          <h3>Tenue actuelle</h3>
          <strong>{OUTFITS[outfit].name}</strong>
          <p>{OUTFITS[outfit].description}</p>
          <BoutiqueAvatarPreview />
        </section>
      </div>
    </MenuDialog>
  );
}
