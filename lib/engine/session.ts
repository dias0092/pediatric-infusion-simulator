import { expectedValues, type Expected } from './calc';
import {
  beginInfusion, completeInfusion, createPump, depleteBattery, markAlarmFixed, pressButton,
  raiseAlarm, rejectStart, resumeAfterAlarm, setRateLimits, type PumpState,
} from './pump';
import type {
  AlarmType, ErrorCode, L10n, Mode, PumpButton, RouteId, Scenario, SimError, SimEvent, UnitId,
} from './types';

export const CALC_TOLERANCE = 0.05;
export const CRITICAL_RATE_RATIO = 2;
/** Exam mode: after this many wrong actions a senior colleague resolves the alarm. */
export const EXAM_ALARM_WRONG_LIMIT = 3;

export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayError';
  }
}

export type SimStep = 'drug' | 'route' | 'calc' | 'pump' | 'infusion' | 'done';

export interface Attempts {
  attempts: number;
  /** 1-based number of the first correct attempt. */
  correctAt: number | null;
}

export interface StartRecord {
  attempts: number;
  rateOkAt: number | null;
  vtbiOkAt: number | null;
  checkOkAt: number | null;
}

export interface AlarmProgress {
  /** Correct actions, in the order the student first did them. */
  performed: string[];
  wrongCount: number;
  resolved: boolean;
  depleted: boolean;
  autoResolved: boolean;
}

export type Feedback =
  | { kind: 'correct' }
  | { kind: 'wrong'; codes: ErrorCode[] }
  | { kind: 'blocked'; codes: ErrorCode[] }
  | { kind: 'reveal'; text: L10n }
  | null;

export interface Session {
  scenario: Scenario;
  mode: Mode;
  expected: Expected;
  step: SimStep;
  drug: Attempts & { selectedId: string | null };
  route: Attempts & { selectedId: RouteId | null };
  calc: Record<string, Attempts>;
  calcIndex: number;
  pump: PumpState;
  checklistDone: boolean;
  start: StartRecord;
  alarm: AlarmProgress | null;
  errors: SimError[];
  critical: boolean;
  feedback: Feedback;
  lastT: number;
  finished: boolean;
}

export function createSession(scenario: Scenario, mode: Mode): Session {
  return {
    scenario,
    mode,
    expected: expectedValues(scenario.prescription, scenario.patient.weightKg),
    step: 'drug',
    drug: { attempts: 0, correctAt: null, selectedId: null },
    route: { attempts: 0, correctAt: null, selectedId: null },
    calc: Object.fromEntries(scenario.calcSteps.map((c) => [c.id, { attempts: 0, correctAt: null }])),
    calcIndex: 0,
    pump: createPump(),
    checklistDone: false,
    start: { attempts: 0, rateOkAt: null, vtbiOkAt: null, checkOkAt: null },
    alarm: null,
    errors: [],
    critical: false,
    feedback: null,
    lastT: 0,
    finished: false,
  };
}

export function applyEvent(s: Session, e: SimEvent): Session {
  if (s.finished) throw new ReplayError('the session is already finished');
  if (!Number.isFinite(e.t) || e.t < s.lastT) throw new ReplayError('event time goes backwards');
  const next: Session = { ...s, lastT: e.t, feedback: null };
  switch (e.type) {
    case 'drugSelected':
      return onDrug(next, e.optionId);
    case 'routeSelected':
      return onRoute(next, e.routeId);
    case 'calcAnswered':
      return onCalc(next, e.stepId, e.value, e.unit);
    case 'pumpButton':
      return onPump(next, e.button);
    case 'checklistCompleted':
      return onChecklist(next);
    case 'alarmRaised':
      return onAlarmRaised(next, e.alarm);
    case 'batteryDepleted':
      return onBatteryDepleted(next);
    case 'alarmAction':
      return onAlarmAction(next, e.actionId);
    case 'infusionCompleted':
      return onCompleted(next);
  }
}

export function replay(scenario: Scenario, mode: Mode, events: SimEvent[]): Session {
  return events.reduce(applyEvent, createSession(scenario, mode));
}

/** The next correct alarm action id, 'START' when only the restart is left, or null. */
export function nextAlarmStep(s: Session): string | null {
  const spec = s.scenario.alarm;
  const alarm = s.alarm;
  if (!spec || !alarm || alarm.resolved) return null;
  return spec.sequence.find((id) => !alarm.performed.includes(id)) ?? 'START';
}

function requireStep(s: Session, ...steps: SimStep[]): void {
  if (!steps.includes(s.step)) throw new ReplayError(`unexpected event at step "${s.step}"`);
}

const countAttempt = (a: Attempts, correct: boolean): Attempts => ({
  attempts: a.attempts + 1,
  correctAt: a.correctAt ?? (correct ? a.attempts + 1 : null),
});

const withErrors = (s: Session, errors: SimError[]): Session =>
  errors.length > 0 ? { ...s, errors: [...s.errors, ...errors] } : s;

const feedbackFor = (errors: SimError[]): Feedback =>
  errors.length > 0 ? { kind: 'wrong', codes: errors.map((e) => e.code) } : { kind: 'correct' };

/** Learning mode moves on only after a correct answer; exam mode always moves on. */
const advance = (s: Session, correct: boolean, patch: Partial<Session>): Session =>
  s.mode === 'exam' || correct ? { ...s, ...patch } : s;

function onDrug(s: Session, optionId: string): Session {
  requireStep(s, 'drug');
  const option = s.scenario.drugOptions.find((o) => o.id === optionId);
  if (!option) throw new ReplayError(`unknown drug option: ${optionId}`);
  const correct = option.id === s.scenario.correctDrugId;
  const errors: SimError[] = correct ? [] : [{ code: option.critical ? 'criticalDrug' : 'wrongDrug', ref: option.id }];
  const next = withErrors(
    {
      ...s,
      drug: { ...countAttempt(s.drug, correct), selectedId: option.id },
      pump: setRateLimits(s.pump, option.softMinRate, option.softMaxRate),
      critical: s.critical || option.critical === true,
      feedback: feedbackFor(errors),
    },
    errors,
  );
  return advance(next, correct, { step: 'route' });
}

function onRoute(s: Session, routeId: RouteId): Session {
  requireStep(s, 'route');
  const { patient, acceptableRoutes, criticalRoutes, calcSteps } = s.scenario;
  const available = patient.accesses.includes(routeId);
  const isCritical = available && criticalRoutes.includes(routeId);
  const correct = available && acceptableRoutes.includes(routeId);
  const code: ErrorCode | null = !available
    ? 'routeNotAvailable'
    : isCritical
      ? 'criticalRoute'
      : correct
        ? null
        : 'wrongRoute';
  const errors: SimError[] = code ? [{ code, ref: routeId }] : [];
  const next = withErrors(
    {
      ...s,
      route: { ...countAttempt(s.route, correct), selectedId: routeId },
      critical: s.critical || isCritical,
      feedback: feedbackFor(errors),
    },
    errors,
  );
  return advance(next, correct, calcSteps.length > 0 ? { step: 'calc', calcIndex: 0 } : { step: 'pump' });
}

function onCalc(s: Session, stepId: string, value: number, unit: UnitId): Session {
  requireStep(s, 'calc');
  const step = s.scenario.calcSteps[s.calcIndex];
  if (!step || step.id !== stepId) throw new ReplayError(`unexpected calc step: ${stepId}`);
  const expected = s.expected[step.quantity];
  if (expected === null) throw new ReplayError(`scenario has no ${step.quantity}`);
  if (!Number.isFinite(value)) throw new ReplayError('calc value is not a number');
  const valueOk = Math.abs(value - expected) <= CALC_TOLERANCE + 1e-9;
  const correct = valueOk && unit === step.unit;
  const errors: SimError[] = correct ? [] : [{ code: valueOk ? 'wrongUnit' : 'wrongCalc', ref: step.id }];
  const next = withErrors(
    { ...s, calc: { ...s.calc, [step.id]: countAttempt(s.calc[step.id], correct) }, feedback: feedbackFor(errors) },
    errors,
  );
  const last = s.calcIndex === s.scenario.calcSteps.length - 1;
  return advance(next, correct, last ? { step: 'pump' } : { calcIndex: s.calcIndex + 1 });
}

function onChecklist(s: Session): Session {
  requireStep(s, 'pump');
  return { ...s, checklistDone: true };
}

function onPump(s: Session, button: PumpButton): Session {
  requireStep(s, 'pump', 'infusion');
  const { state: pump, effect } = pressButton(s.pump, button);
  const next: Session = { ...s, pump };
  switch (effect) {
    case 'limitOverride':
      return withErrors(next, [{ code: 'ignoredLimitWarning' }]);
    case 'startAttempt':
      return onStartAttempt(next);
    case 'restartAttempt':
      return onRestartAttempt(next);
    case 'stopped':
      return onStopped(next);
    default:
      return next;
  }
}

function onStartAttempt(s: Session): Session {
  if (s.step !== 'pump') throw new ReplayError('start attempt outside the pump step');
  const n = s.start.attempts + 1;
  const expectedRate = Math.round(s.expected.rateMlH * 10);
  const rateOk = s.pump.rateTenths === expectedRate;
  const vtbiOk = s.pump.vtbiTenths === Math.round(s.expected.vtbiMl * 10);
  const checkOk = s.checklistDone;
  const ratio = s.pump.rateTenths / expectedRate;
  const rateCritical = !rateOk && (ratio >= CRITICAL_RATE_RATIO || ratio <= 1 / CRITICAL_RATE_RATIO);
  const errors: SimError[] = [];
  if (!rateOk) errors.push({ code: rateCritical ? 'criticalRate' : 'wrongRate' });
  if (!vtbiOk) errors.push({ code: 'wrongVtbi' });
  if (!checkOk) errors.push({ code: 'startWithoutCheck' });
  const start: StartRecord = {
    attempts: n,
    rateOkAt: s.start.rateOkAt ?? (rateOk ? n : null),
    vtbiOkAt: s.start.vtbiOkAt ?? (vtbiOk ? n : null),
    checkOkAt: s.start.checkOkAt ?? (checkOk ? n : null),
  };
  const next = withErrors({ ...s, start, critical: s.critical || rateCritical }, errors);
  const allOk = errors.length === 0;
  if (s.mode === 'learning' && !allOk) {
    return { ...next, pump: rejectStart(next.pump), feedback: { kind: 'blocked', codes: errors.map((e) => e.code) } };
  }
  return { ...next, pump: beginInfusion(next.pump), step: 'infusion', feedback: allOk ? { kind: 'correct' } : null };
}

function onRestartAttempt(s: Session): Session {
  if (!s.alarm || !s.pump.alarm) throw new ReplayError('restart without an active alarm');
  if (s.pump.alarm.fixed) {
    return { ...s, pump: resumeAfterAlarm(s.pump), alarm: { ...s.alarm, resolved: true }, feedback: { kind: 'correct' } };
  }
  return wrongAlarmAction(s, 'restartWithoutFix', 'START');
}

function onStopped(s: Session): Session {
  const lowBatteryActive = s.scenario.alarm?.type === 'lowBattery' && s.alarm !== null && !s.alarm.resolved;
  return lowBatteryActive ? wrongAlarmAction(s, 'stoppedNeedlessly', 'STOP') : s;
}

function wrongAlarmAction(s: Session, code: ErrorCode, ref: string): Session {
  if (!s.alarm) throw new ReplayError('no active alarm');
  const alarm: AlarmProgress = { ...s.alarm, wrongCount: s.alarm.wrongCount + 1 };
  const next = withErrors({ ...s, alarm, feedback: { kind: 'wrong', codes: [code] } }, [{ code, ref }]);
  return next.mode === 'exam' && alarm.wrongCount >= EXAM_ALARM_WRONG_LIMIT ? autoResolve(next) : next;
}

function autoResolve(s: Session): Session {
  let pump = s.pump;
  if (pump.alarm?.type === 'lowBattery' && !pump.alarm.depleted) {
    pump = markAlarmFixed(pump);
  } else if (pump.alarm) {
    pump = resumeAfterAlarm({ ...pump, onMains: pump.onMains || pump.alarm.type === 'lowBattery' });
  }
  return { ...s, pump, alarm: { ...s.alarm!, resolved: true, autoResolved: true } };
}

function onAlarmRaised(s: Session, type: AlarmType): Session {
  requireStep(s, 'infusion');
  if (s.scenario.alarm?.type !== type) throw new ReplayError(`scenario has no ${type} alarm`);
  if (s.alarm) throw new ReplayError('the alarm was already raised');
  if (s.pump.status !== 'running') throw new ReplayError('alarm raised while the pump is not running');
  return {
    ...s,
    alarm: { performed: [], wrongCount: 0, resolved: false, depleted: false, autoResolved: false },
    pump: raiseAlarm(s.pump, type),
  };
}

function onBatteryDepleted(s: Session): Session {
  requireStep(s, 'infusion');
  const a = s.alarm;
  if (s.scenario.alarm?.type !== 'lowBattery' || !a || a.resolved || a.depleted || s.pump.status !== 'running') {
    throw new ReplayError('unexpected battery depletion');
  }
  return withErrors({ ...s, alarm: { ...a, depleted: true }, pump: depleteBattery(s.pump) }, [{ code: 'batteryDepleted' }]);
}

function onAlarmAction(s: Session, actionId: string): Session {
  requireStep(s, 'infusion');
  const spec = s.scenario.alarm;
  const a = s.alarm;
  if (!spec || !a || a.resolved) throw new ReplayError('no active alarm');
  const action = spec.actions.find((x) => x.id === actionId);
  if (!action) throw new ReplayError(`unknown alarm action: ${actionId}`);
  if (!spec.sequence.includes(actionId)) return wrongAlarmAction(s, 'wrongAlarmAction', actionId);
  if (a.performed.includes(actionId)) return s;
  const performed = [...a.performed, actionId];
  let next: Session = {
    ...s,
    alarm: { ...a, performed },
    feedback: action.reveals ? { kind: 'reveal', text: action.reveals } : { kind: 'correct' },
  };
  if (spec.sequence.every((id) => performed.includes(id))) {
    next = { ...next, pump: markAlarmFixed(next.pump) };
    if (spec.type === 'lowBattery' && !a.depleted) {
      next = { ...next, alarm: { ...a, performed, resolved: true } };
    }
  }
  return next;
}

function onCompleted(s: Session): Session {
  requireStep(s, 'infusion');
  if (s.pump.status !== 'running' || s.pump.alarm) throw new ReplayError('the infusion cannot complete now');
  if (s.scenario.alarm && !s.alarm?.resolved) throw new ReplayError('the alarm was not handled');
  return { ...s, pump: completeInfusion(s.pump), step: 'done', finished: true };
}
