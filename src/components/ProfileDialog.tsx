import { MenuDialog } from './MenuDialog';
import { ProfileAvatar } from './ProfileAvatar';
import { BoutiqueAvatarPreview } from './BoutiqueAvatarPreview';
import { useCharacterStore } from '../game/characterStore';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useProfileStore } from '../game/profile';
import { OUTFITS } from '../game/outfits';

function playtime(seconds: number) {
  if (seconds < 60) return `${seconds} second${seconds > 1 ? 's' : ''}`;
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
    <MenuDialog title="My Profile" onClose={onClose} className="profile-dialog">
      <div className="world-library-heading"><h2>My Profile</h2></div>
      <div className="profile-overview">
        <div className="profile-summary">
          <ProfileAvatar character={character} outfit={outfit} wig={wig} appearance={appearance} size={192} />
          <div className="profile-identity">
            <h3>{name}</h3>
            <dl className="profile-details">
              <div><dt>Account created on</dt><dd>{createdLabel}</dd></div>
              <div><dt>Playtime</dt><dd>{playtime(seconds)}</dd></div>
              <div><dt>Character</dt><dd>{character === 'girl' ? 'Girl' : 'Boy'}</dd></div>
              <div><dt>Current Outfit</dt><dd>{OUTFITS[outfit].name}</dd></div>
              <div><dt>Hairstyle</dt><dd>{appearance.hairStyle === 'long' ? 'Long hair' : 'Short hair'}</dd></div>
            </dl>
            <div className="profile-colors" aria-label="Character colors">
              <span><i className="profile-color" style={{ backgroundColor: appearance.hairColor }} />Hair</span>
              <span><i className="profile-color" style={{ backgroundColor: appearance.eyeColor }} />Eyes</span>
              <span><i className="profile-color" style={{ backgroundColor: appearance.eyebrowColor ?? appearance.hairColor }} />Eyebrows</span>
            </div>
          </div>
        </div>
        <section className="profile-costume" aria-label="Current outfit in 3D">
          <h3>Current Outfit</h3>
          <strong>{OUTFITS[outfit].name}</strong>
          <p>{OUTFITS[outfit].description}</p>
          <BoutiqueAvatarPreview />
        </section>
      </div>
    </MenuDialog>
  );
}
