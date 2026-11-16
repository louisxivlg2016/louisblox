import { translate, useLanguageStore } from '../game/language';

export function LanguagePanel() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  return (
    <div className="language-panel language-switch" role="group" aria-label="Language / Langue / Idioma" data-label={translate('Langue', 'Language', 'Idioma')}>
      <button type="button" className={language === 'fr' ? 'active' : ''} aria-pressed={language === 'fr'} onClick={() => setLanguage('fr')}>FR</button>
      <button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
      <button type="button" className={language === 'es' ? 'active' : ''} aria-pressed={language === 'es'} onClick={() => setLanguage('es')}>ES</button>
    </div>
  );
}
