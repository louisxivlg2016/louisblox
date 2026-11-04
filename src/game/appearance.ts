export type HairStyle = 'short' | 'long';
export type CharacterAppearance = {
  skinColor: string;
  hairColor: string;
  eyeColor: string;
  eyebrowColor: string | null;
  clothingColor: string | null;
  hairStyle: HairStyle;
};

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  skinColor: '#e7a0aa',
  hairColor: '#49382f',
  eyeColor: '#273b4b',
  eyebrowColor: null,
  clothingColor: null,
  hairStyle: 'short',
};

const color = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

export function sanitizeAppearance(value: unknown, character: 'boy' | 'girl' = 'boy'): CharacterAppearance {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    skinColor: color(data.skinColor) ? data.skinColor : DEFAULT_APPEARANCE.skinColor,
    hairColor: color(data.hairColor) ? data.hairColor : DEFAULT_APPEARANCE.hairColor,
    eyeColor: color(data.eyeColor) ? data.eyeColor : DEFAULT_APPEARANCE.eyeColor,
    eyebrowColor: data.eyebrowColor === null || color(data.eyebrowColor) ? data.eyebrowColor as string | null : null,
    clothingColor: data.clothingColor === null || color(data.clothingColor) ? data.clothingColor as string | null : null,
    hairStyle: data.hairStyle === 'long' || data.hairStyle === 'short' ? data.hairStyle : character === 'girl' ? 'long' : 'short',
  };
}
