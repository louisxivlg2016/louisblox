import { create } from 'zustand';

const STORAGE_KEY = 'louisblox-plane-title';

function initialTitle() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)?.trim().slice(0, 24);
    return saved && saved !== 'louisblox' ? saved : 'Louisblox';
  } catch {
    return 'Louisblox';
  }
}

export const usePlaneTitleStore = create<{
  title: string;
  editorOpen: boolean;
  setTitle: (title: string) => void;
  setEditorOpen: (open: boolean) => void;
}>((set) => ({
  title: initialTitle(),
  editorOpen: false,
  setEditorOpen: (editorOpen) => set({ editorOpen }),
  setTitle: (value) => {
    const title = value.trim().slice(0, 24) || 'Louisblox';
    try {
      localStorage.setItem(STORAGE_KEY, title);
    } catch {
    }
    set({ title });
  },
}));
