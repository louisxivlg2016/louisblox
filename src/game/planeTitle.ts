import { create } from 'zustand';

const STORAGE_KEY = 'louisblox-plane-title';

function initialTitle() {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim().slice(0, 24) || 'louisblox';
  } catch {
    return 'louisblox';
  }
}

export const usePlaneTitleStore = create<{
  title: string;
  setTitle: (title: string) => void;
}>((set) => ({
  title: initialTitle(),
  setTitle: (value) => {
    const title = value.trim().slice(0, 24) || 'louisblox';
    try {
      localStorage.setItem(STORAGE_KEY, title);
    } catch {
    }
    set({ title });
  },
}));
