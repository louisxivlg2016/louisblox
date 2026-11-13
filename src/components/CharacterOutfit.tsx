import { Suspense } from 'react';
import type { ReactNode, Ref } from 'react';
import type { Object3D } from 'three';
import { selectedWig } from '../game/outfits';
import type { OutfitKind, WigSelection } from '../game/outfits';
import { WigGlb } from './WardrobeGlb';
import { FullCharacterGlb, hasFullCharacter } from './FullCharacterGlb';
import { useEmoteStore } from '../game/emotes';
import type { EmoteKind } from '../game/emotes';
import type { CharacterAppearance } from '../game/appearance';
export function CharacterOutfit({ outfit, wig = 'auto', moving, airborne, remote = false, seated = false, emote, head, headRef, appearance, character = 'boy', avatar = 'pixel' }: { outfit: OutfitKind; wig?: WigSelection; color?: string | null; moving?: boolean; airborne?: boolean; remote?: boolean; seated?: boolean; emote?: EmoteKind | null; head?: ReactNode; headRef?: Ref<Object3D>; appearance?: CharacterAppearance; character?: 'boy' | 'girl'; avatar?: import('../game/avatar').ProfileAvatarKind }) {
  const localEmote = useEmoteStore((state) => state.current);
  const props = { moving, airborne, remote, seated, emote: remote ? emote : localEmote, headRef, appearance };
  const accessory = selectedWig(outfit, wig)
    ? <Suspense fallback={null}><WigGlb kind={selectedWig(outfit, wig)!} /></Suspense>
    : null;
  if (outfit !== 'default') return hasFullCharacter(outfit, wig) ? <FullCharacterGlb outfit={outfit} {...props} profileAvatar={avatar} headAccessory={accessory} /> : <group name="character-head" ref={headRef} position={[0, 1.45, 0]}><group position={[0, -1.45, 0]}>{head}{accessory}</group></group>;
  if (!selectedWig(outfit, wig)) return <FullCharacterGlb outfit={character === 'girl' ? 'classic-girl' : 'classic-boy'} {...props} profileAvatar={avatar} />;
  return (
    <group name="character-head" ref={headRef} position={[0, 1.45, 0]}>
      <group position={[0, -1.45, 0]}>
        {head}
        <group name="costume-wig">{accessory}</group>
      </group>
    </group>
  );
}
