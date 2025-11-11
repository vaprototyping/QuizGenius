import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

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
  const [translations, setTranslations] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        const [enRes, nlRes, itRes] = await Promise.all([
          fetch('./locales/en.json'),
          fetch('./locales/nl.json'),
          fetch('./locales/it.json')
        ]);

        if (!enRes.ok || !nlRes.ok || !itRes.ok) {
            throw new Error('Failed to fetch one or more translation files.');
        }

        const [en, nl, it] = await Promise.all([
          enRes.json(),
          nlRes.json(),
          itRes.json()
        ]);
        setTranslations({ en, nl, it });
      } catch (error) {
        console.error("Failed to load translations:", error);
        try {
            const enRes = await fetch('./locales/en.json');
            if (!enRes.ok) throw new Error('Failed to fetch English fallback.');
            const en = await enRes.json();
            setTranslations({ en });
        } catch(e) {
            console.error("Failed to load fallback English translation:", e);
            setTranslations({});
        }
      }
    };
    fetchTranslations();
  }, []);

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    if (!translations) {
      return '';
    }
    
    const localeMessages = translations[locale];
    const fallbackMessages = translations.en;

    let translation = (localeMessages && getNested(localeMessages, key)) || (fallbackMessages && getNested(fallbackMessages, key)) || key;

    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        const regex = new RegExp(`{${placeholder}}`, 'g');
        translation = translation.replace(regex, String(replacements[placeholder]));
      });
    }

    return translation;
  };

  if (!translations) {
    // Render nothing while translations are being fetched to avoid showing untranslated keys.
    return null;
  }

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