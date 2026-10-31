import type { CSSProperties } from 'react';
import { sanitizeAppearance } from '../game/appearance';
import type { CharacterAppearance } from '../game/appearance';
import type { CharacterKind } from '../game/characterStore';
import { selectedWig } from '../game/outfits';
import type { OutfitKind, WigSelection } from '../game/outfits';

export function PixelAvatar({ character = 'boy', outfit = 'default', wig = 'auto', appearance, size = 64 }: {
  character?: CharacterKind;
  outfit?: OutfitKind;
  wig?: WigSelection;
  appearance?: CharacterAppearance;
  size?: number;
}) {
  const current = sanitizeAppearance(appearance, character);
  const periodWig = selectedWig(outfit, wig);
  const hair = periodWig === 'louis14' ? '#4b3528' : periodWig === 'louis15' ? '#d7d0c3' : current.hairColor;
  const crowned = outfit === 'king' || outfit === 'louis14' || outfit === 'princess';
  return (
    <span
      className={`pixel-avatar hair-${current.hairStyle} ${periodWig ? `wig-${periodWig}` : ''} ${crowned ? 'has-crown' : ''}`}
      style={{ '--avatar-size': `${size}px`, '--skin': '#e7a0aa', '--hair': hair, '--eyes': current.eyeColor } as CSSProperties}
      aria-hidden="true"
    >
      <span className="avatar-crown" />
      <span className="avatar-hair-top" />
      <span className="avatar-hair-side left" />
      <span className="avatar-hair-side right" />
      <span className="avatar-eye left" />
      <span className="avatar-eye right" />
      <span className="avatar-nose" />
    </span>
  );
}
