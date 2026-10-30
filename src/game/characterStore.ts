import { create } from 'zustand';

export type CharacterKind = 'boy' | 'girl';

type CharacterStore = {
  character: CharacterKind;
  setCharacter: (character: CharacterKind) => void;
};

function initialCharacter(): CharacterKind {
  try {
    return localStorage.getItem('louisblox-character') === 'girl' ? 'girl' : 'boy';
  } catch {
    return 'boy';
  }
}

export const useCharacterStore = create<CharacterStore>((set) => ({
  character: initialCharacter(),
  setCharacter: (character) => {
    try {
      localStorage.setItem('louisblox-character', character);
    } catch {
    }
    set({ character });
  },
}));
