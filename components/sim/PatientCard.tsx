'use client';

import type { Scenario } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';
import { Card } from '../ui';

export function PatientCard({ scenario }: { scenario: Scenario }) {
  const { d, l } = useI18n();
  const p = scenario.patient;
  return (
    <Card className="space-y-1 text-sm">
      <div className="flex items-start justify-between gap-2">
        <strong>
          {d.patient.title} {p.code}
        </strong>
        {scenario.reviewStatus === 'draft' && <span className="badge">{d.draftBadge}</span>}
      </div>
      <div>
        {d.patient.age}: {l(p.age)} · {d.patient.weight}: {p.weightKg} {d.patient.kg}
      </div>
      <div>
        {d.patient.condition}: {l(p.condition)}
      </div>
      <div>
        {d.patient.accesses}: {p.accesses.map((r) => d.routes[r]).join(', ')}
      </div>
      <div className="mt-2 rounded-lg bg-cyan-50 p-2">
        <strong>{d.patient.order}:</strong> {l(scenario.order)}
      </div>
    </Card>
  );
}
