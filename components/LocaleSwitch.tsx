'use client';

import { LOCALES } from '@/lib/engine/types';
import { useI18n } from './I18nProvider';

export function LocaleSwitch() {
  const { locale, setLocale, d } = useI18n();
  return (
    <div className="flex overflow-hidden rounded-lg border border-[var(--line)] text-sm" role="group" aria-label={d.common.language}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          onClick={() => setLocale(l)}
          className={`px-2.5 py-1 font-medium ${locale === l ? 'bg-[var(--brand)] text-white' : 'bg-white'}`}
        >
          {l === 'ru' ? 'RU' : 'KZ'}
        </button>
      ))}
    </div>
  );
}
