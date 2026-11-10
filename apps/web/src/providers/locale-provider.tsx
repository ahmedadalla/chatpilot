'use client';

import * as React from 'react';
import arMessages from '../../messages/ar.json';
import enMessages from '../../messages/en.json';

export type Locale = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';

interface LocaleContextValue {
  locale: Locale;
  direction: Direction;
  toggleLocale: () => void;
  setLocale: (locale: Locale) => void;
  t: (keyPath: string, fallback?: string) => string;
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

const catalogs: Record<Locale, any> = {
  ar: arMessages,
  en: enMessages,
};

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>('ar');

  React.useEffect(() => {
    const saved = localStorage.getItem('cp_locale') as Locale | null;
    if (saved === 'ar' || saved === 'en') {
      setLocaleState(saved);
      document.documentElement.lang = saved;
      document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr';
    } else {
      document.documentElement.lang = 'ar';
      document.documentElement.dir = 'rtl';
    }
  }, []);

  const setLocale = React.useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('cp_locale', newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newLocale === 'ar' ? 'rtl' : 'ltr';
  }, []);

  const toggleLocale = React.useCallback(() => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  }, [locale, setLocale]);

  const direction: Direction = locale === 'ar' ? 'rtl' : 'ltr';

  const t = React.useCallback(
    (keyPath: string, fallback?: string): string => {
      const keys = keyPath.split('.');
      let current = catalogs[locale];

      for (const k of keys) {
        if (!current || typeof current !== 'object') {
          return fallback || keyPath;
        }
        current = current[k];
      }

      if (typeof current === 'string') {
        return current;
      }

      return fallback || keyPath;
    },
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, direction, toggleLocale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = React.useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}
