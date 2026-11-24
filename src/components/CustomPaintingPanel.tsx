import { useEffect, useState } from 'react';
import { requestPlay } from '../game/input';
import { saveCustomPainting, useCustomPaintingStore } from '../game/customPainting';
import { pixelatePaintingFile } from '../game/paintingImage';
import { world } from '../game/world';
import { translate } from '../game/language';

export function CustomPaintingPanel() {
  const editing = useCustomPaintingStore((state) => state.editing);
  const closePainting = useCustomPaintingStore((state) => state.closePainting);
  const [preview, setPreview] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPreview(editing?.image);
    setBusy(false);
    setError('');
  }, [editing?.x, editing?.y, editing?.z]);

  if (!editing) return null;
  const close = () => {
    closePainting();
    void requestPlay();
  };
  const addImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      setPreview(await pixelatePaintingFile(file));
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'format'
        ? translate('Choisis une image PNG, JPEG, GIF ou WebP de moins de 8 Mo.', 'Choose a PNG, JPEG, GIF, or WebP image smaller than 8 MB.')
        : translate('Impossible de lire cette image.', 'Unable to read this image.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="backpack-backdrop">
      <section className="book-panel backpack-panel" role="dialog" aria-modal="true" aria-label={translate('Personnaliser le tableau', 'Customize painting')} data-custom-painting-dialog>
        <div className="backpack-header">
          <h2>{translate('Tableau personnalisé', 'Custom painting')}</h2>
          <button type="button" className="secondary-button" onClick={close}>{translate('Fermer', 'Close')}</button>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!preview || busy) return;
          if (saveCustomPainting(world, editing, preview)) void requestPlay();
          else setError(translate('Impossible d’enregistrer cette image.', 'Unable to save this image.'));
        }}>
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 210, marginBottom: 16, background: '#18281f', border: '2px solid #70836d' }}>
            {preview ? <img data-painting-preview src={preview} alt={translate('Aperçu pixelisé du tableau', 'Pixelated painting preview')} width={256} height={192} style={{ imageRendering: 'pixelated', objectFit: 'fill', maxWidth: '100%' }} /> : <span style={{ color: '#d9e3d4', fontSize: 64, lineHeight: 1 }} aria-hidden="true">+</span>}
          </div>
          <label className="secondary-button" style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
            {busy ? translate('Conversion en pixels…', 'Converting to pixels…') : translate('Ajouter une image', 'Add an image')}
            <input data-painting-image-input type="file" accept=".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp" disabled={busy} onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              void addImage(file);
            }} style={{ display: 'none' }} />
          </label>
          <p className="boutique-hint">{translate('Ton image est réduite à 32 × 32 pixels, comme les images des modes de jeu. Elle est conservée avec le tableau.', 'Your image is reduced to 32 × 32 pixels, like game mode images. It is saved with the painting.')}</p>
          {error && <p role="alert" className="boutique-hint">{error}</p>}
          <button type="submit" className="primary-button" data-save-painting disabled={!preview || busy}>{translate('Enregistrer le tableau', 'Save painting')}</button>
        </form>
      </section>
    </div>
  );
}
