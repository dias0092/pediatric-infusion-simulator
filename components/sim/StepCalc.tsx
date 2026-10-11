'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { seededShuffle } from '@/lib/client/shuffle';
import type { Session } from '@/lib/engine/session';
import type { UnitId } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';

export function StepCalc({ session, onAnswer }: { session: Session; onAnswer: (value: number, unit: UnitId) => void }) {
  const { d, l } = useI18n();
  const { scenario, mode } = session;
  const step = scenario.calcSteps[session.calcIndex];
  const units = useMemo(() => seededShuffle(step.unitOptions, `${scenario.id}:${step.id}:units`), [scenario.id, step]);
  const [raw, setRaw] = useState('');
  const [unit, setUnit] = useState<UnitId | ''>('');
  const [incomplete, setIncomplete] = useState(false);
  const record = session.calc[step.id];
  const expected = session.expected[step.quantity];
  const reveal = mode === 'learning' && record.attempts >= 3 && record.correctAt === null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = Number(raw.replace(',', '.').trim());
    if (raw.trim() === '' || !Number.isFinite(value) || unit === '') {
      setIncomplete(true);
      return;
    }
    setIncomplete(false);
    onAnswer(value, unit);
  };

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-semibold">
        {d.steps.calc} ({session.calcIndex + 1}/{scenario.calcSteps.length})
      </h2>
      <p>{l(step.prompt)}</p>
      {mode === 'learning' && (
        <p className="rounded-lg bg-amber-50 p-2 text-sm">
          💡 {d.feedback.hint}: {l(step.hint)}
        </p>
      )}
      <div className="flex gap-2">
        <input
          aria-label={d.steps.value}
          className="field flex-1"
          inputMode="decimal"
          autoComplete="off"
          placeholder={d.steps.value}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <select
          aria-label={d.steps.unit}
          className="field w-36"
          value={unit}
          onChange={(e) => setUnit(e.target.value as UnitId | '')}
        >
          <option value="">{d.steps.chooseUnit}</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {d.units[u]}
            </option>
          ))}
        </select>
      </div>
      {incomplete && <p className="text-sm text-[var(--bad)]">{d.steps.needValue}</p>}
      {reveal && expected !== null && (
        <p className="text-sm text-[var(--ok)]">
          {d.feedback.reveal}: {String(expected).replace('.', ',')} {d.units[step.unit]}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full">
        {d.common.check}
      </button>
    </form>
  );
}
