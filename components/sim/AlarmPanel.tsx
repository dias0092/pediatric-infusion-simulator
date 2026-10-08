'use client';

import { useMemo } from 'react';
import { seededShuffle } from '@/lib/client/shuffle';
import { nextAlarmStep, type Session } from '@/lib/engine/session';
import { useI18n } from '../I18nProvider';

export function AlarmPanel({ session, onAction }: { session: Session; onAction: (actionId: string) => void }) {
  const { d, l } = useI18n();
  const { scenario, mode, alarm } = session;
  const spec = scenario.alarm;
  const actions = useMemo(() => (spec ? seededShuffle(spec.actions, `${scenario.id}:alarm`) : []), [spec, scenario.id]);
  if (!spec || !alarm || alarm.resolved) return null;

  const next = mode === 'learning' ? nextAlarmStep(session) : null;
  const showHint = next !== null && (alarm.wrongCount > 0 || next === 'START');
  const hint = next === 'START' ? d.infusion.restartHint : spec.actions.find((a) => a.id === next);

  return (
    <section className="card space-y-2 border-[var(--bad)]" aria-live="assertive">
      <h3 className="font-semibold text-[var(--bad)]">🚨 {d.infusion.alarmTitle}</h3>
      {actions.map((a) => {
        const done = alarm.performed.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            className={`choice ${done ? 'is-right' : ''}`}
            disabled={done}
            onClick={() => onAction(a.id)}
          >
            {done ? '✓ ' : ''}
            {l(a.label)}
          </button>
        );
      })}
      {showHint && hint && (
        <p className="text-sm">
          💡 {d.infusion.nextHint}: {typeof hint === 'string' ? hint : l(hint.label)}
        </p>
      )}
    </section>
  );
}
