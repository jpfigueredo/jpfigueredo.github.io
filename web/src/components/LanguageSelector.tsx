import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';

export const LanguageSelector: React.FC = () => {
  const { i18n: i18nInstance } = useTranslation();
  const currentLang = i18nInstance.language || 'en';

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => changeLanguage('en')}
        className={`px-2 py-1 rounded text-xs sm:text-sm transition-colors ${
          currentLang === 'en' || currentLang.startsWith('en')
            ? 'bg-neon/20 text-neon border border-neon/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }`}
        aria-label="Switch to English"
      >
        EN
      </button>
      <button
        onClick={() => changeLanguage('pt')}
        className={`px-2 py-1 rounded text-xs sm:text-sm transition-colors ${
          currentLang === 'pt' || currentLang.startsWith('pt')
            ? 'bg-neon/20 text-neon border border-neon/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }`}
        aria-label="Switch to Portuguese"
      >
        PT
      </button>
    </div>
  );
};

