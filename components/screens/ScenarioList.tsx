'use client';

import Link from 'next/link';
import type { Mode } from '@/lib/engine/types';
import { scenarios } from '@/lib/scenarios';
import { useI18n } from '../I18nProvider';
import { Page } from '../ui';

export function ScenarioList({ mode }: { mode: Mode }) {
  const { d, l } = useI18n();
  return (
    <Page title={d.modes[mode]} back="/">
      <h2 className="mb-3 text-xl font-semibold">{d.scenarios.title}</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {scenarios.map((s) => (
          <li key={s.id}>
            <Link href={`/sim/${s.id}?mode=${mode}`} className="card block h-full hover:border-[var(--brand)]">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm text-[var(--muted)]">
                  {d.patient.title} {s.patient.code}
                </span>
                {s.reviewStatus === 'draft' && <span className="badge">{d.draftBadge}</span>}
              </div>
              <div className="mt-1 text-lg font-semibold">
                {s.number}. {l(s.title)}
              </div>
              <div className="text-sm text-[var(--muted)]">
                {l(s.patient.age)} · {s.patient.weightKg} {d.patient.kg}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
