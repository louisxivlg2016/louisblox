import { create } from 'zustand';

export const PROFILE_AVATAR_KINDS = ['pixel', 'louis14', 'louis15', 'king', 'explorer', 'princess', 'knight', 'military', 'pirate', 'footballer', 'firefighter', 'police', 'soldier', 'trader'] as const;
export type ProfileAvatarKind = (typeof PROFILE_AVATAR_KINDS)[number];

export function isProfileAvatarKind(value: unknown): value is ProfileAvatarKind {
  return typeof value === 'string' && (PROFILE_AVATAR_KINDS as readonly string[]).includes(value);
}

function initialAvatar(): ProfileAvatarKind {
  try {
    const saved = localStorage.getItem('louisblox-profile-avatar');
    return (PROFILE_AVATAR_KINDS as readonly string[]).includes(saved ?? '') ? saved as ProfileAvatarKind : 'pixel';
  } catch {
    return 'pixel';
  }
}

export const useAvatarStore = create<{
  kind: ProfileAvatarKind;
  setKind: (kind: ProfileAvatarKind) => void;
}>((set) => ({
  kind: initialAvatar(),
  setKind: (kind) => {
    try {
      localStorage.setItem('louisblox-profile-avatar', kind);
    } catch {
    }
    set({ kind });
  },
}));
