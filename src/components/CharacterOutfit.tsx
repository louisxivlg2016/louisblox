import { Suspense } from 'react';
import type { ReactNode, Ref } from 'react';
import type { Object3D } from 'three';
import { selectedWig } from '../game/outfits';
import type { OutfitKind, WigSelection } from '../game/outfits';
import { PixelPart } from './ItemModel';
import { WigGlb } from './WardrobeGlb';
import { FullCharacterGlb } from './FullCharacterGlb';
import { useEmoteStore } from '../game/emotes';
import type { EmoteKind } from '../game/emotes';
import type { CharacterAppearance } from '../game/appearance';
function PeriodWig({ large, color }: { large: boolean; color?: string }) {
  const colors = color ? [color, color, color] : large ? ['#3c2a20', '#5a4030', '#4b3528'] : ['#d7d0c3', '#eee9dd', '#c5bcaf'];
  return (
    <>
      <PixelPart position={[0, 1.99, 0]} size={large ? [0.58, 0.22, 0.56] : [0.52, 0.16, 0.5]} color={colors[0]} />
      {[-1, 1].map((side) => Array.from({ length: large ? 4 : 2 }, (_, index) => (
        <PixelPart
          key={`${side}-${index}`}
          position={[side * 0.3, 1.85 - index * 0.17, 0.03]}
          size={large ? [0.17, 0.18, 0.34] : [0.13, 0.16, 0.28]}
          color={colors[index % colors.length]}
        />
      )))}
      <PixelPart position={[0, large ? 1.63 : 1.78, 0.26]} size={large ? [0.52, 0.64, 0.18] : [0.46, 0.28, 0.14]} color={colors[1]} />
    </>
  );
}

export function CharacterOutfit({ outfit, wig = 'auto', moving, airborne, remote = false, seated = false, emote, head, headRef, appearance, character = 'boy' }: { outfit: OutfitKind; wig?: WigSelection; color?: string | null; moving?: boolean; airborne?: boolean; remote?: boolean; seated?: boolean; emote?: EmoteKind | null; head?: ReactNode; headRef?: Ref<Object3D>; appearance?: CharacterAppearance; character?: 'boy' | 'girl' }) {
  const localEmote = useEmoteStore((state) => state.current);
  const props = { moving, airborne, remote, seated, emote: remote ? emote : localEmote, headRef, appearance };
  if (outfit !== 'default') return <FullCharacterGlb outfit={outfit} {...props} />;
  if (!selectedWig(outfit, wig)) return <FullCharacterGlb outfit={character === 'girl' ? 'classic-girl' : 'classic-boy'} {...props} />;
  return (
    <group name="character-head" ref={headRef} position={[0, 1.45, 0]}>
      <group position={[0, -1.45, 0]}>
        {head}
        {selectedWig(outfit, wig) && <Suspense fallback={<PeriodWig large={selectedWig(outfit, wig) === 'louis14'} color={appearance?.hairColor} />}><WigGlb kind={selectedWig(outfit, wig)!} color={appearance?.hairColor} /></Suspense>}
      </group>
    </group>
  );
}
