'use client';

import { useMemo } from 'react';
import { seededShuffle } from '@/lib/client/shuffle';
import type { Session } from '@/lib/engine/session';
import { useI18n } from '../I18nProvider';
import { Card } from '../ui';

export function StepDrug({ session, onSelect }: { session: Session; onSelect: (optionId: string) => void }) {
  const { d, l } = useI18n();
  const { scenario, mode, drug } = session;
  const options = useMemo(() => seededShuffle(scenario.drugOptions, `${scenario.id}:drugs`), [scenario]);
  const reveal = mode === 'learning' && drug.attempts >= 3 && drug.correctAt === null;
  return (
    <Card className="space-y-2">
      <h2 className="font-semibold">{d.steps.drug}</h2>
      {options.map((o) => {
        const wrong = mode === 'learning' && drug.selectedId === o.id && o.id !== scenario.correctDrugId;
        const hinted = reveal && o.id === scenario.correctDrugId;
        return (
          <button
            key={o.id}
            type="button"
            className={`choice ${wrong ? 'is-wrong' : ''} ${hinted ? 'is-reveal' : ''}`}
            onClick={() => onSelect(o.id)}
          >
            {l(o.name)}
          </button>
        );
      })}
    </Card>
  );
}
