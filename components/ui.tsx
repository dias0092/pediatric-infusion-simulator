'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from './I18nProvider';
import { LocaleSwitch } from './LocaleSwitch';

export function Page({ title, back, wide, children }: { title?: string; back?: string; wide?: boolean; children: ReactNode }) {
  const { d } = useI18n();
  return (
    <div className={`mx-auto min-h-dvh px-4 pb-10 ${wide ? 'max-w-6xl' : 'max-w-xl md:max-w-4xl'}`}>
      <header className="flex items-center gap-3 py-3">
        {back ? (
          <Link href={back} className="rounded-lg py-1 pr-2 font-medium text-[var(--brand)]">
            ← {d.common.back}
          </Link>
        ) : (
          <Link href="/" className="font-bold text-[var(--brand)]">
            PIS
          </Link>
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
        <LocaleSwitch />
      </header>
      <main>{children}</main>
      <footer className="mt-10 text-center text-xs text-[var(--muted)]">{d.disclaimer}</footer>
    </div>
  );
}

export function LinkButton({ href, variant = 'primary', children }: { href: string; variant?: 'primary' | 'secondary'; children: ReactNode }) {
  return (
    <Link href={href} className={`btn ${variant === 'primary' ? 'btn-primary' : 'btn-secondary'}`}>
      {children}
    </Link>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-[var(--line)] p-1" role="group">
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${value === option ? 'bg-white shadow' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
