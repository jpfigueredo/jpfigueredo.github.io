import i18n, { type InitOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslations from './locales/en.json';
import ptTranslations from './locales/pt.json';

const options: InitOptions = {
  resources: {
    en: { translation: enTranslations as unknown as Record<string, unknown> },
    pt: { translation: ptTranslations as unknown as Record<string, unknown> },
  },
  lng: 'en', // Default to English
  fallbackLng: 'en',
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  detection: {
    // Only detect from localStorage (user's explicit choice)
    // Don't auto-detect from browser to force English as default
    order: ['localStorage'],
    caches: ['localStorage'],
    lookupLocalStorage: 'i18nextLng',
    // Convert pt-BR, pt-PT, etc. to just 'pt'
    convertDetectedLanguage: (lng: string) => {
      if (lng.startsWith('pt')) return 'pt';
      if (lng.startsWith('en')) return 'en';
      return 'en'; // Default to English for any other language
    },
  },
  supportedLngs: ['en', 'pt'],
};

i18n.use(LanguageDetector).use(initReactI18next).init(options);

export default i18n;

