import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type LanguageContextType = {
  language: string;
  direction: 'ltr' | 'rtl';
  changeLanguage: (lang: string) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const { i18n } = useTranslation();
  // Initialize from localStorage first, then i18n, then default to Arabic
  const storedLang = localStorage.getItem('i18nextLng');
  // Only use stored lang if it's valid (en or ar)
  const validStoredLang = (storedLang === 'en' || storedLang === 'ar') ? storedLang : null;
  const initialLanguage = validStoredLang || i18n.language || 'ar';
  const [language, setLanguage] = useState(initialLanguage);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(initialLanguage === 'ar' ? 'rtl' : 'ltr');

  // Sync language with localStorage on mount - respect stored preference
  useEffect(() => {
    const currentStoredLang = localStorage.getItem('i18nextLng');
    // Validate stored language
    const validLang = (currentStoredLang === 'en' || currentStoredLang === 'ar') ? currentStoredLang : null;
    
    if (!validLang) {
      // No valid stored preference - default to Arabic and save it
      const defaultLang = 'ar';
      i18n.changeLanguage(defaultLang);
      setLanguage(defaultLang);
      localStorage.setItem('i18nextLng', defaultLang);
    } else {
      // Use stored preference and ensure i18n is synced
      if (i18n.language !== validLang) {
        i18n.changeLanguage(validLang);
        setLanguage(validLang);
      }
      // Ensure localStorage is set correctly
      localStorage.setItem('i18nextLng', validLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const dir = language === 'ar' ? 'rtl' : 'ltr';
    setDirection(dir);
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
    
    // Update font family based on language
    if (language === 'ar') {
      document.documentElement.style.setProperty('--font-sans', '"Tajawal", "Inter", sans-serif');
      document.documentElement.style.setProperty('--font-heading', '"Tajawal", "Manrope", sans-serif');
    } else {
      document.documentElement.style.removeProperty('--font-sans');
      document.documentElement.style.removeProperty('--font-heading');
    }
  }, [language]);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
    // Persist to localStorage
    localStorage.setItem('i18nextLng', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, direction, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
