import { create } from 'zustand';

const STORAGE_KEY = 'louisblox-police-title';

function initialTitle() {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim().slice(0, 24) || 'POLICE';
  } catch {
    return 'POLICE';
  }
}

export const usePoliceTitleStore = create<{
  title: string;
  editorOpen: boolean;
  setTitle: (title: string) => void;
  setEditorOpen: (open: boolean) => void;
}>((set) => ({
  title: initialTitle(),
  editorOpen: false,
  setEditorOpen: (editorOpen) => set({ editorOpen }),
  setTitle: (value) => {
    const title = value.trim().slice(0, 24) || 'POLICE';
    try {
      localStorage.setItem(STORAGE_KEY, title);
    } catch {
    }
    set({ title });
  },
}));
