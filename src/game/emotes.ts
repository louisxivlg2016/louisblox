import { create } from 'zustand';

export type EmoteKind = 'sit' | 'lie' | 'wave';

export const useEmoteStore = create<{
  current: EmoteKind | null;
  open: boolean;
  setCurrent: (emote: EmoteKind | null) => void;
  setOpen: (open: boolean) => void;
}>((set) => ({
  current: null,
  open: false,
  setCurrent: (current) => set({ current }),
  setOpen: (open) => set({ open }),
}));

let waveTimer: number | undefined;

export function chooseEmote(emote: EmoteKind) {
  const store = useEmoteStore.getState();
  if (waveTimer !== undefined) window.clearTimeout(waveTimer);
  waveTimer = undefined;
  if (store.current === emote) {
    store.setCurrent(null);
    return;
  }
  store.setCurrent(emote);
  if (emote === 'wave') waveTimer = window.setTimeout(() => useEmoteStore.getState().setCurrent(null), 3000);
}

export function resetEmote() {
  if (waveTimer !== undefined) window.clearTimeout(waveTimer);
  waveTimer = undefined;
  useEmoteStore.getState().setCurrent(null);
}
