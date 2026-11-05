import { useEffect, useRef, useState } from 'react';
import { requestPlay } from '../game/input';
import { selectionInfo } from '../game/items';
import type { SelectedKind } from '../game/items';
import { useGameStore } from '../game/store';

type BookContent = { title: string; text: string };

function readBook(bookId: string): BookContent {
  try {
    const saved = JSON.parse(localStorage.getItem(`louisblox-book-${bookId}`) ?? '{}');
    return { title: typeof saved.title === 'string' ? saved.title : 'Mon livre', text: typeof saved.text === 'string' ? saved.text : '' };
  } catch {
    return { title: 'Mon livre', text: '' };
  }
}

function writeBook(bookId: string, content: BookContent) {
  try {
    localStorage.setItem(`louisblox-book-${bookId}`, JSON.stringify(content));
    return true;
  } catch {
    return false;
  }
}

export function BookPanel() {
  const open = useGameStore((state) => state.bookOpen);
  const selected = useGameStore((state) => state.selected);
  const setBookOpen = useGameStore((state) => state.setBookOpen);
  if (!open || typeof selected !== 'string') return null;
  const close = () => {
    setBookOpen(false);
    void requestPlay();
  };
  return <BookEditor key={selected} bookId={selected} onClose={close} />;
}

function BookEditor({ bookId, onClose }: { bookId: Extract<SelectedKind, string>; onClose: () => void }) {
  const [initial] = useState(() => readBook(bookId));
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.text);
  const draft = useRef<BookContent>({ title, text });
  const setNotice = useGameStore((state) => state.setNotice);
  draft.current = { title, text };

  useEffect(() => {
    const timer = window.setTimeout(() => writeBook(bookId, draft.current), 250);
    return () => window.clearTimeout(timer);
  }, [bookId, title, text]);

  useEffect(() => () => {
    writeBook(bookId, draft.current);
  }, [bookId]);

  const save = () => {
    if (!writeBook(bookId, draft.current)) {
      setNotice('Impossible d’enregistrer le livre sur cet appareil.');
      return false;
    }
    setNotice('Livre enregistré.');
    return true;
  };
  const close = () => {
    save();
    onClose();
  };

  return (
    <div className="backpack-backdrop">
      <section className="book-panel backpack-panel" aria-label="Écrire dans le livre">
        <div className="backpack-header">
          <h2>{selectionInfo(bookId).name}</h2>
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
        <button className="primary-button" onClick={close}>Enregistrer le livre</button>
      </section>
    </div>
  );
}
