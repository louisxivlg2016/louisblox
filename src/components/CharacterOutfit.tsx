import { Suspense } from 'react';
import type { ReactNode, Ref } from 'react';
import type { Object3D } from 'three';
import { selectedWig } from '../game/outfits';
import type { OutfitKind, WigSelection } from '../game/outfits';
import { WigGlb } from './WardrobeGlb';
import { FullCharacterGlb } from './FullCharacterGlb';
import { useEmoteStore } from '../game/emotes';
import type { EmoteKind } from '../game/emotes';
import type { CharacterAppearance } from '../game/appearance';
export function CharacterOutfit({ outfit, wig = 'auto', moving, airborne, remote = false, seated = false, emote, headRef, appearance, character = 'boy', avatar = 'pixel' }: { outfit: OutfitKind; wig?: WigSelection; color?: string | null; moving?: boolean; airborne?: boolean; remote?: boolean; seated?: boolean; emote?: EmoteKind | null; head?: ReactNode; headRef?: Ref<Object3D>; appearance?: CharacterAppearance; character?: 'boy' | 'girl'; avatar?: import('../game/avatar').ProfileAvatarKind }) {
  const localEmote = useEmoteStore((state) => state.current);
  const props = { moving, airborne, remote, seated, emote: remote ? emote : localEmote, headRef, appearance };
  const accessory = selectedWig(outfit, wig)
    ? <Suspense fallback={null}><WigGlb kind={selectedWig(outfit, wig)!} /></Suspense>
    : null;
  if (outfit !== 'default') return <FullCharacterGlb outfit={outfit} {...props} profileAvatar={avatar} headAccessory={accessory} />;
  return <FullCharacterGlb outfit={character === 'girl' ? 'classic-girl' : 'classic-boy'} {...props} profileAvatar={avatar} headAccessory={accessory} />;
}
