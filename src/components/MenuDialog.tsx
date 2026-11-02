import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function MenuDialog({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, [onClose]);
  return (
    <div className="world-library-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`world-library-modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <button className="world-library-close" aria-label={`Fermer ${title}`} onClick={onClose} autoFocus>×</button>
        {children}
      </section>
    </div>
  );
}
