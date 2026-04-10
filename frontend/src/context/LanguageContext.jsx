import { createContext, useContext, useState } from 'react';
import en from '../i18n/en';
import fr from '../i18n/fr';

const TRANSLATIONS = { en, fr };

function detectLanguage() {
  const saved = localStorage.getItem('coinche_lang');
  if (saved && TRANSLATIONS[saved]) return saved;
  const nav = (navigator.language || 'en').split('-')[0];
  return TRANSLATIONS[nav] ? nav : 'en';
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(detectLanguage);

  function toggleLang() {
    const next = lang === 'en' ? 'fr' : 'en';
    setLang(next);
    localStorage.setItem('coinche_lang', next);
  }

  const t = TRANSLATIONS[lang];

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
