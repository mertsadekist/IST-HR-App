import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en.json';
import arTranslation from './locales/ar.json';

const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];

// Mirror the whole document for RTL languages and keep <html lang/dir> in sync.
function applyDirection(lng) {
  if (typeof document === 'undefined') return;
  const base = (lng || 'en').split('-')[0];
  const dir = RTL_LANGS.includes(base) ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', base);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      ar: { translation: arTranslation }
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false }
  });

// Set direction on load and on every language change.
applyDirection(i18n.language);
i18n.on('languageChanged', applyDirection);

export default i18n;
