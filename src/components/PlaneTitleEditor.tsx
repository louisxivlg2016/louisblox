import { useEffect, useState } from 'react';
import { releasePointerForOverlay, requestPlay } from '../game/input';
import { usePlaneTitleStore } from '../game/planeTitle';

export function PlaneTitleEditor() {
  const open = usePlaneTitleStore((state) => state.editorOpen);
  const title = usePlaneTitleStore((state) => state.title);
  const setTitle = usePlaneTitleStore((state) => state.setTitle);
  const setEditorOpen = usePlaneTitleStore((state) => state.setEditorOpen);
  const [draft, setDraft] = useState(title);
  useEffect(() => {
    if (open) {
      setDraft(title);
      releasePointerForOverlay();
    }
  }, [open, title]);
  if (!open) return null;
  const close = () => {
    setEditorOpen(false);
    void requestPlay();
  };
  return (
    <div className="backpack-backdrop">
      <form className="book-panel backpack-panel plane-title-panel" aria-label="Edit airplane title" onSubmit={(event) => { event.preventDefault(); setTitle(draft); close(); }}>
        <div className="backpack-header"><h2>Airplane Title</h2><button type="button" className="secondary-button" onClick={close}>Close</button></div>
        <label className="book-field">Gold text on fuselage
          <input aria-label="New airplane title" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={24} autoFocus />
        </label>
        <button className="primary-button" type="submit">Apply</button>
      </form>
    </div>
  );
}
