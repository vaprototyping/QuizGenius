import React, { useEffect, useState } from 'react';
import { useI18n } from '../context/i18n';

type Theme = 'system' | 'light' | 'dark';

export const ThemeSelector: React.FC = () => {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('quizgenius-theme');
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  });
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches));
    update();
    media.addEventListener('change', update);
    localStorage.setItem('quizgenius-theme', theme);
    return () => media.removeEventListener('change', update);
  }, [theme]);
  return <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
    <span className="sr-only">{t('app.theme')}</span>
    <span aria-hidden="true">◐</span>
    <select value={theme} onChange={event => setTheme(event.target.value as Theme)}
      aria-label={t('app.theme')}
      className="rounded-full border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
      {(['system', 'light', 'dark'] as const).map(value => <option value={value} key={value}>{t(`app.theme_${value}`)}</option>)}
    </select>
  </label>;
};
