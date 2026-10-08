'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { KEYS, localKV } from '@/lib/client/storage';
import type { L10n, Locale } from '@/lib/engine/types';
import { DEFAULT_LOCALE, dictionaries, isLocale, type Dict } from '@/lib/i18n';

interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  d: Dict;
  l: (text: L10n) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const saved = localKV.get(KEYS.locale);
    if (isLocale(saved)) setLocaleState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localKV.set(KEYS.locale, next);
  }, []);

  const value = useMemo<I18n>(
    () => ({ locale, setLocale, d: dictionaries[locale], l: (text) => text[locale] }),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
