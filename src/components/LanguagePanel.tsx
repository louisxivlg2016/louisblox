import { useState } from 'react';
import { createPortal } from 'react-dom';
import { translate, useLanguageStore } from '../game/language';
import languageFrUrl from '../../assets/ui/language-fr.webp';
import languageEnUrl from '../../assets/ui/language-en.webp';
import languageEsUrl from '../../assets/ui/language-es.webp';

export function LanguagePanel({ inline = false }: { inline?: boolean }) {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const [open, setOpen] = useState(false);
  const content = <div className={`language-panel${inline ? ' language-panel-inline' : ''}`} role="group" aria-label="Language / Langue / Idioma">
    <button type="button" className="language-menu-button" aria-label={translate('Langues', 'Languages', 'Idiomas')} aria-expanded={open} onClick={() => setOpen((value) => !value)}><img src={translate(languageFrUrl, languageEnUrl, languageEsUrl)} alt={translate('Langue', 'Language', 'Idioma')} /></button>
    {open && <div className="language-switch language-options">
      <button type="button" className={language === 'fr' ? 'active' : ''} aria-pressed={language === 'fr'} onClick={() => { setLanguage('fr'); setOpen(false); }}>FR</button>
      <button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => { setLanguage('en'); setOpen(false); }}>EN</button>
      <button type="button" className={language === 'es' ? 'active' : ''} aria-pressed={language === 'es'} onClick={() => { setLanguage('es'); setOpen(false); }}>ES</button>
    </div>}
  </div>;
  return inline ? content : createPortal(content, document.body);
}
