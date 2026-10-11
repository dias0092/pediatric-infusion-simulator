'use client';

import type { Feedback } from '@/lib/engine/session';
import type { ErrorCode, Mode } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';

export function FeedbackBanner({ feedback, mode }: { feedback: Feedback; mode: Mode }) {
  const { d, l } = useI18n();
  if (!feedback) return null;
  if (feedback.kind === 'reveal') {
    return (
      <p className="rounded-lg bg-sky-50 p-3 text-sm" role="status">
        🔎 {l(feedback.text)}
      </p>
    );
  }
  if (mode === 'exam') return null;
  if (feedback.kind === 'correct') {
    return (
      <p className="rounded-lg bg-green-50 p-3 text-sm text-[var(--ok)]" role="status">
        {d.feedback.correct}
      </p>
    );
  }
  const text = (code: ErrorCode) =>
    feedback.kind === 'blocked' && code in d.blocked ? d.blocked[code as keyof typeof d.blocked] : d.errors[code];
  return (
    <div className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-[var(--bad)]" role="alert">
      {feedback.kind === 'wrong' && <p>{d.feedback.wrong}</p>}
      {feedback.codes.map((code) => (
        <p key={code}>{text(code)}</p>
      ))}
    </div>
  );
}
