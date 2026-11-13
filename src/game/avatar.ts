import { create } from 'zustand';
import { useCharacterStore } from './characterStore';

export const PROFILE_AVATAR_KINDS = ['pixel', 'girl', 'girl-dark', 'girl-brown', 'girl-red', 'girl-black', 'boy', 'boy-dark', 'boy-brown', 'boy-red', 'boy-black', 'louis14', 'louis15', 'king', 'explorer', 'princess', 'knight', 'military', 'pirate', 'corsair', 'footballer', 'firefighter', 'police', 'soldier', 'trader'] as const;

export const PROFILE_COLOR_PRESETS = {
  'girl-brown': { character: 'girl', hairColor: '#70452e', eyeColor: '#6b4a2d', eyebrowColor: '#3a271c', hairStyle: 'long' },
  'girl-red': { character: 'girl', hairColor: '#c75a35', eyeColor: '#418647', eyebrowColor: '#84351f', hairStyle: 'long' },
  'girl-black': { character: 'girl', hairColor: '#282836', eyeColor: '#3d83c5', eyebrowColor: '#171821', hairStyle: 'long' },
  'boy-brown': { character: 'boy', hairColor: '#70452e', eyeColor: '#4f8b55', eyebrowColor: '#38271d', hairStyle: 'short' },
  'boy-red': { character: 'boy', hairColor: '#c96932', eyeColor: '#4385bd', eyebrowColor: '#864021', hairStyle: 'short' },
  'boy-black': { character: 'boy', hairColor: '#292b36', eyeColor: '#9b6ac6', eyebrowColor: '#181a22', hairStyle: 'short' },
} as const;
export type ProfileAvatarKind = (typeof PROFILE_AVATAR_KINDS)[number];

export function isProfileAvatarKind(value: unknown): value is ProfileAvatarKind {
  return typeof value === 'string' && (PROFILE_AVATAR_KINDS as readonly string[]).includes(value);
}

function initialAvatar(): ProfileAvatarKind {
  try {
    const saved = localStorage.getItem('louisblox-profile-avatar');
    return saved !== 'pixel' && (PROFILE_AVATAR_KINDS as readonly string[]).includes(saved ?? '') ? saved as ProfileAvatarKind : 'boy';
  } catch {
    return 'boy';
  }
}

export const useAvatarStore = create<{
  kind: ProfileAvatarKind;
  setKind: (kind: ProfileAvatarKind) => void;
}>((set) => ({
  kind: initialAvatar(),
  setKind: (kind) => {
    const preset = PROFILE_COLOR_PRESETS[kind as keyof typeof PROFILE_COLOR_PRESETS];
    if (preset) {
      const { character, ...appearance } = preset;
      const store = useCharacterStore.getState();
      store.setCharacter(character);
      store.setAppearance({ ...appearance, skinColor: '#f0d0b0', clothingColor: null, originalHairColor: false, originalSkinColor: false });
    }
    try {
      localStorage.setItem('louisblox-profile-avatar', kind);
    } catch {
    }
    set({ kind });
  },
}));
