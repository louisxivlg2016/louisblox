import { MenuDialog } from './MenuDialog';
import { PixelAvatar } from './PixelAvatar';
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
  return (
    <MenuDialog title="Mon profil" onClose={onClose} className="profile-dialog">
      <div className="world-library-heading"><h2>Mon profil</h2></div>
      <div className="profile-summary">
        <PixelAvatar character={character} outfit={outfit} wig={wig} appearance={appearance} size={128} />
        <div><h3>{name}</h3><p><strong>Temps de jeu : </strong>{playtime(seconds)}</p><p><strong>Tenue : </strong>{OUTFITS[outfit].name}</p><p><strong>Coiffure : </strong>{appearance.hairStyle === 'long' ? 'Cheveux longs' : 'Cheveux courts'}</p><span className="profile-color" style={{ backgroundColor: appearance.hairColor }} aria-label="Couleur des cheveux" /></div>
      </div>
    </MenuDialog>
  );
}
