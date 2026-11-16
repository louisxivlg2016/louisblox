import { useState } from 'react';
import { translate, useLanguageStore } from '../game/language';

export function LanguagePanel() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const [open, setOpen] = useState(false);
  return (
    <div className="language-panel" role="group" aria-label="Language / Langue / Idioma">
      <button type="button" className="language-menu-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{translate('Langues', 'Languages', 'Idiomas')}</button>
      {open && <div className="language-switch language-options">
        <button type="button" className={language === 'fr' ? 'active' : ''} aria-pressed={language === 'fr'} onClick={() => { setLanguage('fr'); setOpen(false); }}>FR</button>
        <button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => { setLanguage('en'); setOpen(false); }}>EN</button>
        <button type="button" className={language === 'es' ? 'active' : ''} aria-pressed={language === 'es'} onClick={() => { setLanguage('es'); setOpen(false); }}>ES</button>
      </div>}
    </div>
  );
}
