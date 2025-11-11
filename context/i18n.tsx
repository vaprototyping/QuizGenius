import React, { createContext, useState, useContext, ReactNode } from 'react';
import en from '../locales/en.json';
import nl from '../locales/nl.json';
import it from '../locales/it.json';

const translations: Record<string, any> = { en, nl, it };

interface I18nContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const getNested = (obj: any, path: string): string | undefined => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState('en');

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    const messages = translations[locale] || translations.en;
    const fallbackMessages = translations.en;

    let translation = getNested(messages, key) || getNested(fallbackMessages, key) || key;

    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        const regex = new RegExp(`{${placeholder}}`, 'g');
        translation = translation.replace(regex, String(replacements[placeholder]));
      });
    }

    return translation;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
