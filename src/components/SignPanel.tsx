import { useEffect, useRef, useState } from 'react';
import { requestPlay } from '../game/input';
import { MAX_SIGN_LENGTH, saveSign, useSignStore } from '../game/signs';
import { DEFAULT_SIGN_TEXT_SIZE, SIGN_TEXT_SIZES } from '../game/voxel';
import { BlockKind } from '../game/voxel';
import { world } from '../game/world';
import { translate } from '../game/language';

export function SignPanel() {
  const editing = useSignStore((state) => state.editing);
  const closeSign = useSignStore((state) => state.closeSign);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [length, setLength] = useState(0);
  const [textSize, setTextSize] = useState<number>(DEFAULT_SIGN_TEXT_SIZE);

  useEffect(() => {
    if (editing) {
      setLength(editing.text.length);
      setTextSize(editing.textSize);
    }
  }, [editing?.x, editing?.y, editing?.z]);

  if (!editing) return null;
  const paris = editing.kind === BlockKind.ParisStreetSign;
  const close = () => {
    closeSign();
    void requestPlay();
  };
  return (
    <div className="backpack-backdrop">
      <section className="book-panel backpack-panel" role="dialog" aria-modal="true" aria-label={paris ? translate('Écrire sur la plaque de rue', 'Edit street sign') : translate('Écrire sur le panneau', 'Edit sign')}>
        <div className="backpack-header">
          <h2>{paris ? translate('Plaque de rue', 'Street Sign') : translate('Panneau', 'Sign')}</h2>
          <button type="button" className="secondary-button" onClick={close}>{translate('Fermer', 'Close')}</button>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          saveSign(world, editing, textRef.current?.value ?? editing.text, textSize);
          void requestPlay();
        }}>
          <label className="book-field">
            {translate('Taille de l’écriture', 'Text size', 'Tamaño del texto')}
            <select aria-label={translate('Taille de l’écriture', 'Text size', 'Tamaño del texto')} value={textSize} onChange={(event) => setTextSize(Number(event.target.value))}>
              {SIGN_TEXT_SIZES.map((size) => <option key={size} value={size}>{size === 15 ? translate('Petit', 'Small', 'Pequeño') : size === 30 ? translate('Grand', 'Large', 'Grande') : size === 60 ? translate('Très grand', 'Very large', 'Muy grande') : 'Normal'}</option>)}
            </select>
          </label>
          <label className="book-field">
            {paris ? translate('Texte de la plaque', 'Street sign text') : translate('Texte du panneau', 'Sign text')}
            <textarea ref={textRef} autoFocus defaultValue={editing.text} rows={6} maxLength={MAX_SIGN_LENGTH} onInput={(event) => setLength(event.currentTarget.value.length)} placeholder={paris ? '4th arrondissement\nPeace Street' : translate('Écris quelque chose…', 'Write something…')} />
          </label>
          <p className="boutique-hint">{length} / {MAX_SIGN_LENGTH} {translate('caractères · le texte est enregistré et partagé.', 'characters · text is saved and shared.', 'caracteres · el texto se guarda y comparte.')}</p>
          <button type="submit" className="primary-button">{paris ? translate('Enregistrer la plaque', 'Save street sign') : translate('Enregistrer le panneau', 'Save sign')}</button>
        </form>
      </section>
    </div>
  );
}
