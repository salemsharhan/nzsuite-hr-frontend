import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '../data/locales/en.json';
import ar from '../data/locales/ar.json';

// Read from localStorage before initializing to respect user preference
const getInitialLanguage = () => {
  const stored = localStorage.getItem('i18nextLng');
  if (stored && (stored === 'en' || stored === 'ar')) {
    return stored;
  }
  return 'ar'; // Default to Arabic if nothing stored
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: getInitialLanguage(), // Use stored preference or default to Arabic
    fallbackLng: 'ar',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
