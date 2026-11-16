import { useEffect, useRef, useState } from 'react';
import { requestPlay } from '../game/input';
import { MAX_SIGN_LENGTH, saveSign, useSignStore } from '../game/signs';
import { BlockKind } from '../game/voxel';
import { world } from '../game/world';
import { translate } from '../game/language';

export function SignPanel() {
  const editing = useSignStore((state) => state.editing);
  const closeSign = useSignStore((state) => state.closeSign);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (editing) setLength(editing.text.length);
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
          saveSign(world, editing, textRef.current?.value ?? editing.text);
          void requestPlay();
        }}>
          <label className="book-field">
            {paris ? translate('Texte de la plaque', 'Street sign text') : translate('Texte du panneau', 'Sign text')}
            <textarea ref={textRef} autoFocus defaultValue={editing.text} rows={6} maxLength={MAX_SIGN_LENGTH} onInput={(event) => setLength(event.currentTarget.value.length)} placeholder={paris ? '4th arrondissement\nPeace Street' : translate('Écris quelque chose…', 'Write something…')} />
          </label>
          <p className="boutique-hint">{length} / {MAX_SIGN_LENGTH} characters · text is saved and shared.</p>
          <button type="submit" className="primary-button">{paris ? translate('Enregistrer la plaque', 'Save street sign') : translate('Enregistrer le panneau', 'Save sign')}</button>
        </form>
      </section>
    </div>
  );
}
