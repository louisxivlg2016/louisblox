import { useEffect, useState } from 'react';
import { releasePointerForOverlay, requestPlay } from '../game/input';
import { usePoliceTitleStore } from '../game/policeTitle';
import { translate } from '../game/language';

export function PoliceTitleEditor() {
  const open = usePoliceTitleStore((state) => state.editorOpen);
  const title = usePoliceTitleStore((state) => state.title);
  const setTitle = usePoliceTitleStore((state) => state.setTitle);
  const setEditorOpen = usePoliceTitleStore((state) => state.setEditorOpen);
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
      <form className="book-panel backpack-panel plane-title-panel" aria-label={translate('Modifier le titre de la voiture de police', 'Edit police car title', 'Editar el título del coche de policía')} onSubmit={(event) => { event.preventDefault(); setTitle(draft); close(); }}>
        <div className="backpack-header"><h2>{translate('Titre de la voiture de police', 'Police car title', 'Título del coche de policía')}</h2><button type="button" className="secondary-button" onClick={close}>{translate('Fermer', 'Close')}</button></div>
        <label className="book-field">{translate('Texte doré sur le côté', 'Gold text on the side', 'Texto dorado en el lado')}
          <input aria-label={translate('Nouveau titre de la voiture de police', 'New police car title', 'Nuevo título del coche de policía')} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={24} autoFocus />
        </label>
        <button className="primary-button" type="submit">{translate('Appliquer', 'Apply')}</button>
      </form>
    </div>
  );
}
