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
      <form className="book-panel backpack-panel plane-title-panel" aria-label="Modifier le titre de l’avion" onSubmit={(event) => { event.preventDefault(); setTitle(draft); close(); }}>
        <div className="backpack-header"><h2>Titre de l’avion</h2><button type="button" className="secondary-button" onClick={close}>Fermer</button></div>
        <label className="book-field">Texte doré sur la carlingue
          <input aria-label="Nouveau titre de l’avion" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={24} autoFocus />
        </label>
        <button className="primary-button" type="submit">Appliquer</button>
      </form>
    </div>
  );
}
