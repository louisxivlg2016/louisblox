import { useEffect, useState } from 'react';
import { releasePointerForOverlay, requestPlay } from '../game/input';
import { usePlaneTitleStore } from '../game/planeTitle';
import { translate } from '../game/language';

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
      <form className="book-panel backpack-panel plane-title-panel" aria-label={translate('Modifier le titre de l’avion', 'Edit airplane title')} onSubmit={(event) => { event.preventDefault(); setTitle(draft); close(); }}>
        <div className="backpack-header"><h2>{translate('Titre de l’avion', 'Airplane Title')}</h2><button type="button" className="secondary-button" onClick={close}>{translate('Fermer', 'Close')}</button></div>
        <label className="book-field">Gold text on fuselage
          <input aria-label={translate('Nouveau titre de l’avion', 'New airplane title')} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={24} autoFocus />
        </label>
        <button className="primary-button" type="submit">{translate('Appliquer', 'Apply')}</button>
      </form>
    </div>
  );
}
