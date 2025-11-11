import React from 'react';
import { useI18n } from '../context/i18n';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'it', name: 'Italiano' },
];

export const LanguageSelector: React.FC = () => {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex items-center">
      <label htmlFor="language-select" className="sr-only">{t('languageSelector.label')}</label>
      <select
        id="language-select"
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="block w-full pl-3 pr-8 py-1.5 text-sm border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md shadow-sm"
      >
        {languages.map(({ code, name }) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
};
