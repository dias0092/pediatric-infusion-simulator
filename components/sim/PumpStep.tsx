'use client';

import { formatDuration } from '@/lib/engine/calc';
import { FIELD_DIGITS, formatTenths } from '@/lib/engine/pump';
import type { Session } from '@/lib/engine/session';
import type { PumpButton } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';
import { DripLine } from '../Pump/DripLine';
import { Pump } from '../Pump/Pump';
import { Checklist } from './Checklist';

interface PumpStepProps {
  session: Session;
  progress: number;
  onPress?: (button: PumpButton) => void;
  onChecklist: () => void;
}

export function PumpStep({ session, progress, onPress, onChecklist }: PumpStepProps) {
  const { d } = useI18n();
  const { scenario, mode, pump, step, expected } = session;
  const drug = scenario.drugOptions.find((o) => o.id === session.drug.selectedId) ?? null;
  const showExpected = mode === 'learning' && step === 'pump' && session.start.attempts >= 3;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">{step === 'pump' ? d.steps.pump : d.steps.infusion}</h2>
      <DripLine progress={progress} running={pump.status === 'running'} rateMlH={pump.rateTenths / 10} />
      <p className="text-center text-xs text-[var(--muted)]">{d.infusion.schemeNote}</p>
      <Pump state={pump} drugLabel={drug?.pumpLabel ?? null} progress={progress} onPress={onPress} />
      {pump.status === 'limitWarning' && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-[var(--warn)]" role="alert">
          ⚠ {d.infusion.limitWarning}
        </p>
      )}
      {step === 'pump' && mode === 'learning' && (
        <ol className="card space-y-1 text-sm">
          {d.pumpGuide.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      )}
      {showExpected && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-[var(--ok)]">
          {d.blocked.expected}: RATE {formatTenths(Math.round(expected.rateMlH * 10), FIELD_DIGITS.rate)} ml/h · VTBI{' '}
          {formatTenths(Math.round(expected.vtbiMl * 10), FIELD_DIGITS.vtbi)} ml · TIME {formatDuration(expected.durationMin / 60)}
        </p>
      )}
      {step === 'pump' && <Checklist done={session.checklistDone} onComplete={onChecklist} />}
    </section>
  );
}
