export type HairStyle = 'short' | 'long';
export type CharacterAppearance = {
  skinColor: string;
  hairColor: string;
  eyeColor: string;
  eyebrowColor: string | null;
  clothingColor: string | null;
  hairStyle: HairStyle;
  originalHairColor: boolean;
  originalSkinColor: boolean;
};

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  skinColor: '#f0d0b0',
  hairColor: '#b5944b',
  eyeColor: '#418647',
  eyebrowColor: null,
  clothingColor: null,
  hairStyle: 'short',
  originalHairColor: false,
  originalSkinColor: false,
};

export function defaultAppearance(character: 'boy' | 'girl'): CharacterAppearance {
  return { ...DEFAULT_APPEARANCE, hairColor: character === 'girl' ? '#d78229' : '#b5944b', hairStyle: character === 'girl' ? 'long' : 'short' };
}

export function appearanceHairColor(appearance: CharacterAppearance, character: 'boy' | 'girl') {
  return appearance.originalHairColor ? defaultAppearance(character).hairColor : appearance.hairColor;
}

export function appearanceSkinColor(appearance: Pick<CharacterAppearance, 'skinColor' | 'originalSkinColor'>, character: 'boy' | 'girl') {
  return appearance.originalSkinColor ? defaultAppearance(character).skinColor : appearance.skinColor;
}

const color = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

export function sanitizeAppearance(value: unknown, character: 'boy' | 'girl' = 'boy'): CharacterAppearance {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const defaults = defaultAppearance(character);
  return {
    skinColor: color(data.skinColor) ? data.skinColor : defaults.skinColor,
    hairColor: color(data.hairColor) ? data.hairColor : defaults.hairColor,
    eyeColor: color(data.eyeColor) ? data.eyeColor : defaults.eyeColor,
    eyebrowColor: data.eyebrowColor === null || color(data.eyebrowColor) ? data.eyebrowColor as string | null : null,
    clothingColor: data.clothingColor === null || color(data.clothingColor) ? data.clothingColor as string | null : null,
    hairStyle: data.hairStyle === 'long' || data.hairStyle === 'short' ? data.hairStyle : defaults.hairStyle,
    originalHairColor: data.originalHairColor === true,
    originalSkinColor: data.originalSkinColor === true,
  };
}
