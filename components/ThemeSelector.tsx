import React, { useEffect, useState } from 'react';
import { useI18n } from '../context/i18n';

export const ThemeSelector: React.FC = () => {
  const { t } = useI18n();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      const saved = localStorage.getItem('quizgenius-theme');
      const next = saved === 'dark' || (saved !== 'light' && media.matches);
      document.documentElement.classList.toggle('dark', next);
      setDark(next);
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  const toggle = () => {
    const next = !dark;
    localStorage.setItem('quizgenius-theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
    setDark(next);
  };
  return <button type="button" onClick={toggle} className="icon-button" aria-label={t(dark ? 'app.switchLight' : 'app.switchDark')} title={t(dark ? 'app.switchLight' : 'app.switchDark')}>
    {dark ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.2 15.4A8.7 8.7 0 0 1 8.6 3.8 8.7 8.7 0 1 0 20.2 15.4Z"/></svg>}
  </button>;
};
