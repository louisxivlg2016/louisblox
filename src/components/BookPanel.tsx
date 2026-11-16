import { useEffect, useRef, useState } from 'react';
import { requestPlay } from '../game/input';
import { selectionInfo } from '../game/items';
import type { SelectedKind } from '../game/items';
import { useGameStore } from '../game/store';
import { translate } from '../game/language';

type BookContent = { title: string; text: string };

function readBook(bookId: string): BookContent {
  try {
    const saved = JSON.parse(localStorage.getItem(`louisblox-book-${bookId}`) ?? '{}');
    return { title: typeof saved.title === 'string' ? saved.title : translate('Mon livre', 'My Book'), text: typeof saved.text === 'string' ? saved.text : '' };
  } catch {
    return { title: translate('Mon livre', 'My Book'), text: '' };
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
      setNotice(translate('Impossible d’enregistrer le livre sur cet appareil.', 'Unable to save the book on this device.'));
      return false;
    }
    setNotice(translate('Livre enregistré.', 'Book saved.'));
    return true;
  };
  const close = () => {
    save();
    onClose();
  };

  return (
    <div className="backpack-backdrop">
      <section className="book-panel backpack-panel" aria-label={translate('Écrire dans le livre', 'Write in book')}>
        <div className="backpack-header">
          <h2>{selectionInfo(bookId).name}</h2>
          <button className="secondary-button" onClick={close}>{translate('Fermer', 'Close')}</button>
        </div>
        <label className="book-field">
          Titre
          <input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="book-field">
          Texte du livre
          <textarea value={text} rows={12} maxLength={4000} onChange={(event) => setText(event.target.value)} placeholder={translate('Écris ton histoire ici…', 'Write your story here…')} />
        </label>
        <button className="primary-button" onClick={close}>{translate('Enregistrer le livre', 'Save book')}</button>
      </section>
    </div>
  );
}
