import { useEffect, useRef, useState } from 'react';
import { requestPlay } from '../game/input';
import { MAX_SIGN_LENGTH, saveSign, useSignStore } from '../game/signs';
import { world } from '../game/world';

export function SignPanel() {
  const editing = useSignStore((state) => state.editing);
  const closeSign = useSignStore((state) => state.closeSign);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (editing) setLength(editing.text.length);
  }, [editing?.x, editing?.y, editing?.z]);

  if (!editing) return null;
  const close = () => {
    closeSign();
    void requestPlay();
  };
  return (
    <div className="backpack-backdrop">
      <section className="book-panel backpack-panel" role="dialog" aria-modal="true" aria-label="Écrire sur le panneau">
        <div className="backpack-header">
          <h2>Panneau</h2>
          <button type="button" className="secondary-button" onClick={close}>Fermer</button>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          saveSign(world, editing, textRef.current?.value ?? editing.text);
          void requestPlay();
        }}>
          <label className="book-field">
            Texte du panneau
            <textarea ref={textRef} autoFocus defaultValue={editing.text} rows={6} maxLength={MAX_SIGN_LENGTH} onInput={(event) => setLength(event.currentTarget.value.length)} placeholder="Écris quelque chose…" />
          </label>
          <p className="boutique-hint">{length} / {MAX_SIGN_LENGTH} caractères · le texte est sauvegardé et partagé.</p>
          <button type="submit" className="primary-button">Enregistrer le panneau</button>
        </form>
      </section>
    </div>
  );
}
