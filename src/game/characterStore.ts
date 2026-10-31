import { create } from 'zustand';
import { isOutfitKind, isWigSelection } from './outfits';
import type { OutfitKind, WigSelection } from './outfits';
import { DEFAULT_APPEARANCE, sanitizeAppearance } from './appearance';
import type { CharacterAppearance } from './appearance';

export type CharacterKind = 'boy' | 'girl';

type CharacterStore = {
  character: CharacterKind;
  outfit: OutfitKind;
  wig: WigSelection;
  appearance: CharacterAppearance;
  setCharacter: (character: CharacterKind) => void;
  setOutfit: (outfit: OutfitKind) => void;
  setWig: (wig: WigSelection) => void;
  setAppearance: (appearance: Partial<CharacterAppearance>) => void;
};

function initialCharacter(): CharacterKind {
  try {
    return localStorage.getItem('louisblox-character') === 'girl' ? 'girl' : 'boy';
  } catch {
    return 'boy';
  }
}

function initialOutfit(): OutfitKind {
  try {
    const saved = localStorage.getItem('louisblox-outfit');
    return isOutfitKind(saved) ? saved : 'default';
  } catch {
    return 'default';
  }
}

function initialWig(): WigSelection {
  try {
    const saved = localStorage.getItem('louisblox-wig');
    return isWigSelection(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
}

function initialAppearance(): CharacterAppearance {
  try {
    return sanitizeAppearance(JSON.parse(localStorage.getItem('louisblox-appearance') ?? 'null'), initialCharacter());
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

function saveAppearance(appearance: CharacterAppearance) {
  try {
    localStorage.setItem('louisblox-appearance', JSON.stringify(appearance));
  } catch {
  }
}

export const useCharacterStore = create<CharacterStore>((set) => ({
  character: initialCharacter(),
  outfit: initialOutfit(),
  wig: initialWig(),
  appearance: initialAppearance(),
  setCharacter: (character) => {
    try {
      localStorage.setItem('louisblox-character', character);
    } catch {
    }
    set((state) => {
      const appearance = { ...state.appearance, hairStyle: character === 'girl' ? 'long' as const : 'short' as const };
      saveAppearance(appearance);
      return { character, appearance };
    });
  },
  setOutfit: (outfit) => {
    try {
      localStorage.setItem('louisblox-outfit', outfit);
    } catch {
    }
    set({ outfit });
  },
  setWig: (wig) => {
    try {
      localStorage.setItem('louisblox-wig', wig);
    } catch {
    }
    set({ wig });
  },
  setAppearance: (change) => set((state) => {
    const appearance = sanitizeAppearance({ ...state.appearance, ...change }, state.character);
    saveAppearance(appearance);
    return { appearance };
  }),
}));
