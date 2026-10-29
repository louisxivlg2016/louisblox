import { useEffect, useState } from 'react';
import { requestPlay } from '../game/input';
import { selectionInfo } from '../game/items';
import { useGameStore } from '../game/store';

export function BookPanel() {
  const open = useGameStore((state) => state.bookOpen);
  const selected = useGameStore((state) => state.selected);
  const setBookOpen = useGameStore((state) => state.setBookOpen);
  const setNotice = useGameStore((state) => state.setNotice);
  const [title, setTitle] = useState('Mon livre');
  const [text, setText] = useState('');

  useEffect(() => {
    if (!open || typeof selected !== 'string') return;
    try {
      const saved = JSON.parse(localStorage.getItem(`louisblox-book-${selected}`) ?? '{}');
      setTitle(saved.title ?? 'Mon livre');
      setText(saved.text ?? '');
    } catch {
      setTitle('Mon livre');
      setText('');
    }
  }, [open, selected]);

  if (!open || typeof selected !== 'string') return null;
  const close = () => {
    setBookOpen(false);
    void requestPlay();
  };
  const save = () => {
    localStorage.setItem(`louisblox-book-${selected}`, JSON.stringify({ title, text }));
    setNotice('Livre enregistré.');
    close();
  };

  return (
    <div className="backpack-backdrop">
      <section className="book-panel backpack-panel" aria-label="Écrire dans le livre">
        <div className="backpack-header">
          <h2>{selectionInfo(selected).name}</h2>
          <button className="secondary-button" onClick={close}>Fermer</button>
        </div>
        <label className="book-field">
          Titre
          <input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="book-field">
          Texte du livre
          <textarea value={text} rows={12} maxLength={4000} onChange={(event) => setText(event.target.value)} placeholder="Écris ton histoire ici…" />
        </label>
        <button className="primary-button" onClick={save}>Enregistrer le livre</button>
      </section>
    </div>
  );
}
