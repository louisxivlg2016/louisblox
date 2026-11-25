import { useEffect, useRef, useState } from 'react';
import { requestPlay } from '../game/input';
import { changePaintingSize, saveCustomPainting, useCustomPaintingStore } from '../game/customPainting';
import { PAINTING_IMAGE_SIZE, pixelatePaintingFile } from '../game/paintingImage';
import { world } from '../game/world';
import { translate } from '../game/language';
import { DrawingCanvas } from './DrawingCanvas';
import type { DrawingCanvasHandle } from './DrawingCanvas';
import { setVoxelImage } from '../game/chunks';
import { MAX_PAINTING_SIZE, MIN_PAINTING_SIZE } from '../game/voxel';

export function CustomPaintingPanel() {
  const editing = useCustomPaintingStore((state) => state.editing);
  const closePainting = useCustomPaintingStore((state) => state.closePainting);
  const [preview, setPreview] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const drawingRef = useRef<DrawingCanvasHandle>(null);

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
          <h2>{!editing.custom ? translate('Tableau', 'Painting') : editing.drawing ? translate('Tableau à dessiner', 'Drawing painting') : translate('Tableau personnalisé', 'Custom painting')}</h2>
          <button type="button" className="secondary-button" onClick={close}>{translate('Fermer', 'Close')}</button>
        </div>
        <div data-painting-size style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '16px 0' }}>
          <button type="button" className="secondary-button" data-painting-smaller aria-label={translate('Rétrécir le tableau', 'Make painting smaller')} disabled={editing.size <= MIN_PAINTING_SIZE} onClick={() => { if (!changePaintingSize(world, editing, editing.size - 0.5)) setError(translate('Impossible de changer la taille.', 'Unable to resize the painting.')); }} style={{ width: 52, minHeight: 44, margin: 0, fontSize: 24 }}>−</button>
          <strong>{translate(`Taille : ${editing.size} ×`, `Size: ${editing.size} ×`)}</strong>
          <button type="button" className="secondary-button" data-painting-larger aria-label={translate('Agrandir le tableau', 'Make painting larger')} disabled={editing.size >= MAX_PAINTING_SIZE} onClick={() => { if (!changePaintingSize(world, editing, editing.size + 0.5)) setError(translate('Impossible de changer la taille.', 'Unable to resize the painting.')); }} style={{ width: 52, minHeight: 44, margin: 0, fontSize: 24 }}>+</button>
        </div>
        <div className="painting-editor-content">
        {!editing.custom ? <p className="boutique-hint">{translate('Utilise − et + pour choisir la taille du tableau. Elle est enregistrée automatiquement.', 'Use − and + to choose the painting size. It is saved automatically.')}</p> : editing.drawing ? <>
          <DrawingCanvas ref={drawingRef} showSave={false} initialImage={editing.image} onChange={(image) => {
            if (!setVoxelImage(world, editing, image)) setError(translate('Impossible d’enregistrer ce dessin.', 'Unable to save this drawing.'));
          }} onSave={(image) => {
            setError('');
            if (saveCustomPainting(world, editing, image)) void requestPlay();
            else setError(translate('Impossible d’enregistrer ce dessin.', 'Unable to save this drawing.'));
          }} />
          <p className="boutique-hint">{translate('Ton dessin est enregistré automatiquement à chaque trait, même quand tu fermes le tableau.', 'Your drawing is saved automatically after every stroke, even when you close the painting.')}</p>
          {error && <p role="alert" className="boutique-hint">{error}</p>}
        </> : <form id="custom-painting-form" onSubmit={(event) => {
          event.preventDefault();
          if (!preview || busy) return;
          if (saveCustomPainting(world, editing, preview)) void requestPlay();
          else setError(translate('Impossible d’enregistrer cette image.', 'Unable to save this image.'));
        }}>
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 210, marginBottom: 16, background: '#18281f', border: '2px solid #70836d' }}>
            {preview ? <img data-painting-preview src={preview} alt={translate('Aperçu du tableau', 'Painting preview')} width={256} height={192} style={{ imageRendering: 'auto', objectFit: 'fill', maxWidth: '100%' }} /> : <span style={{ color: '#d9e3d4', fontSize: 64, lineHeight: 1 }} aria-hidden="true">+</span>}
          </div>
          <label className="secondary-button" style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
            {busy ? translate('Conversion en pixels…', 'Converting to pixels…') : translate('Ajouter une image', 'Add an image')}
            <input data-painting-image-input type="file" accept=".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp" disabled={busy} onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              void addImage(file);
            }} style={{ display: 'none' }} />
          </label>
          <p className="boutique-hint">{translate(`Ton image est réduite à ${PAINTING_IMAGE_SIZE} × ${PAINTING_IMAGE_SIZE} pixels pour rester légère, sans devenir trop pixelisée. Elle est conservée avec le tableau.`, `Your image is reduced to ${PAINTING_IMAGE_SIZE} × ${PAINTING_IMAGE_SIZE} pixels to keep it light without becoming too pixelated. It is saved with the painting.`)}</p>
          {error && <p role="alert" className="boutique-hint">{error}</p>}
        </form>}
        </div>
        {editing.custom && <div className="painting-save-bar">
          <button type={editing.drawing ? 'button' : 'submit'} form={editing.drawing ? undefined : 'custom-painting-form'} className="primary-button" data-save-painting={editing.drawing ? undefined : ''} data-save-drawing={editing.drawing ? '' : undefined} disabled={!editing.drawing && (!preview || busy)} onClick={editing.drawing ? () => drawingRef.current?.save() : undefined}>{editing.drawing ? translate('Enregistrer le dessin', 'Save drawing') : translate('Enregistrer le tableau', 'Save painting')}</button>
        </div>}
      </section>
    </div>
  );
}
