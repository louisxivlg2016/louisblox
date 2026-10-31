export type HairStyle = 'short' | 'long';
export type CharacterAppearance = {
  hairColor: string;
  eyeColor: string;
  clothingColor: string | null;
  hairStyle: HairStyle;
};

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  hairColor: '#49382f',
  eyeColor: '#273b4b',
  clothingColor: null,
  hairStyle: 'short',
};

const color = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

export function sanitizeAppearance(value: unknown, character: 'boy' | 'girl' = 'boy'): CharacterAppearance {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    hairColor: color(data.hairColor) ? data.hairColor : DEFAULT_APPEARANCE.hairColor,
    eyeColor: color(data.eyeColor) ? data.eyeColor : DEFAULT_APPEARANCE.eyeColor,
    clothingColor: data.clothingColor === null || color(data.clothingColor) ? data.clothingColor as string | null : null,
    hairStyle: data.hairStyle === 'long' || data.hairStyle === 'short' ? data.hairStyle : character === 'girl' ? 'long' : 'short',
  };
}
