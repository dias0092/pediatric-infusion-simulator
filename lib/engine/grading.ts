import { EXAM_ALARM_WRONG_LIMIT, type Session } from './session';
import type { Mode, SimError } from './types';

export const POINTS = { drug: 15, route: 15, calc: 20, rate: 20, vtbi: 10, check: 10, alarm: 10 } as const;
export type Category = keyof typeof POINTS;
export const CATEGORIES = Object.keys(POINTS) as Category[];
export type Breakdown = Record<Category, number>;

export interface Grade {
  score: number;
  passed: boolean;
  breakdown: Breakdown;
  errors: SimError[];
  durationSec: number;
}

export function attemptFactor(correctAt: number | null, mode: Mode): number {
  if (correctAt === 1) return 1;
  if (correctAt === 2 && mode === 'learning') return 0.5;
  return 0;
}

export function gradeSession(s: Session): Grade {
  if (!s.finished) throw new Error('cannot grade an unfinished session');
  const f = (at: number | null) => attemptFactor(at, s.mode);
  const steps = s.scenario.calcSteps;
  const calc =
    steps.length === 0
      ? POINTS.calc
      : steps.reduce((sum, c) => sum + (POINTS.calc / steps.length) * f(s.calc[c.id].correctAt), 0);
  const breakdown: Breakdown = {
    drug: POINTS.drug * f(s.drug.correctAt),
    route: POINTS.route * f(s.route.correctAt),
    calc,
    rate: POINTS.rate * f(s.start.rateOkAt),
    vtbi: POINTS.vtbi * f(s.start.vtbiOkAt),
    check: POINTS.check * f(s.start.checkOkAt),
    alarm: alarmPoints(s),
  };
  const total = CATEGORIES.reduce((sum, c) => sum + breakdown[c], 0);
  return {
    score: Math.round(total),
    passed: !s.critical,
    breakdown,
    errors: s.errors,
    durationSec: Math.round(s.lastT / 1000),
  };
}

function alarmPoints(s: Session): number {
  const spec = s.scenario.alarm;
  if (!spec) return s.errors.length === 0 ? POINTS.alarm : 0;
  const a = s.alarm;
  if (!a || !a.resolved || a.depleted || a.autoResolved || a.wrongCount >= EXAM_ALARM_WRONG_LIMIT) return 0;
  const inOrder = a.performed.every((id, i) => id === spec.sequence[i]);
  return a.wrongCount === 0 && inOrder ? POINTS.alarm : POINTS.alarm / 2;
}
