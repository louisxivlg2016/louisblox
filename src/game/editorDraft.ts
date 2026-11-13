import { sanitizeCustomWorld } from './worldCode';
import type { CustomWorldDefinition } from './worldCode';

const DRAFT_KEY = 'louisblox-editor-draft-v1';

export type EditorDraft = { name: string; savedAt: number; world: CustomWorldDefinition; sourceDirty: boolean };

export function readEditorDraft(): EditorDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<EditorDraft> | null;
    if (!value || typeof value.name !== 'string' || typeof value.savedAt !== 'number') return null;
    const world = sanitizeCustomWorld(value.world);
    return world ? { name: value.name.trim().slice(0, 48) || 'Mon aventure', savedAt: value.savedAt, world, sourceDirty: value.sourceDirty === true } : null;
  } catch {
    return null;
  }
}

export function writeEditorDraft(name: string, world: CustomWorldDefinition, sourceDirty = false) {
  const valid = sanitizeCustomWorld(world);
  if (!valid) return false;
  const draft: EditorDraft = { name: name.trim().slice(0, 48) || 'Mon aventure', savedAt: Date.now(), world: valid, sourceDirty };
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
