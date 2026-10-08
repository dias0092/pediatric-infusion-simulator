'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { FlushOutcome } from '@/lib/client/outbox';
import { formatRemaining } from '@/lib/engine/calc';
import { CATEGORIES, POINTS, type Grade } from '@/lib/engine/grading';
import type { ErrorCode, Mode } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';

export type SubmitState = 'idle' | 'sending' | FlushOutcome;

const formatPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

interface ResultSummaryProps {
  grade: Grade;
  mode: Mode;
  submit: SubmitState;
  onRetry: () => void;
}

export function ResultSummary({ grade, mode, submit, onRetry }: ResultSummaryProps) {
  const { d } = useI18n();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const counts = new Map<ErrorCode, number>();
  for (const e of grade.errors) counts.set(e.code, (counts.get(e.code) ?? 0) + 1);
  const status: Record<SubmitState, string> = {
    idle: '',
    sending: d.result.sending,
    sent: d.result.sent,
    queued: d.result.queued,
    rejected: d.result.rejected,
  };

  return (
    <section ref={ref} className="card space-y-3" aria-labelledby="result-title">
      <h2 id="result-title" className="text-xl font-bold">
        {d.result.title}
      </h2>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold tabular-nums" data-testid="score">
          {grade.score}
        </span>
        <span className="text-[var(--muted)]">/ 100 · {d.result.score}</span>
      </div>
      <p className={`font-semibold ${grade.passed ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}`}>
        {grade.passed ? `✅ ${d.result.passed}` : `⛔ ${d.result.failed}`}
      </p>
      {!grade.passed && <p className="text-sm">{d.result.criticalNote}</p>}
      <table className="w-full text-sm">
        <tbody>
          {CATEGORIES.map((c) => (
            <tr key={c} className="border-t border-[var(--line)]">
              <td className="py-1">{d.categories[c]}</td>
              <td className="py-1 text-right tabular-nums">
                {formatPoints(grade.breakdown[c])} / {POINTS[c]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <h3 className="font-semibold">{d.result.errors}</h3>
        {counts.size === 0 ? (
          <p className="text-sm">{d.result.noErrors}</p>
        ) : (
          <ol className="list-decimal space-y-0.5 pl-5 text-sm">
            {[...counts].map(([code, n]) => (
              <li key={code}>
                {d.errors[code]}
                {n > 1 ? ` ×${n}` : ''}
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="text-sm">
        {d.result.time}: {formatRemaining(grade.durationSec)}
      </p>
      {status[submit] && (
        <p className="text-sm text-[var(--muted)]" role="status">
          {status[submit]}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          {d.result.again}
        </button>
        <Link href={`/scenarios?mode=${mode}`} className="btn btn-secondary">
          {d.result.other}
        </Link>
        <Link href="/results" className="btn btn-secondary col-span-2">
          {d.result.toResults}
        </Link>
      </div>
    </section>
  );
}
