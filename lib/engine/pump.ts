import type { AlarmType, PumpButton } from './types';

export const FIELD_DIGITS = { rate: 4, vtbi: 5 } as const;
export type PumpField = keyof typeof FIELD_DIGITS;

export type PumpStatus =
  | 'off' | 'program' | 'limitWarning' | 'confirm' | 'running' | 'paused' | 'alarmStopped' | 'complete';

export interface PumpAlarm {
  type: AlarmType;
  fixed: boolean;
  muted: boolean;
  depleted: boolean;
}

export interface PumpState {
  status: PumpStatus;
  field: PumpField;
  editing: boolean;
  cursor: number;
  draft: number[];
  rateTenths: number;
  vtbiTenths: number;
  pendingTenths: number | null;
  minRateTenths: number;
  maxRateTenths: number;
  alarm: PumpAlarm | null;
  onMains: boolean;
}

export type PumpEffect = 'beep' | 'limitOverride' | 'startAttempt' | 'restartAttempt' | 'stopped' | null;

interface PressResult {
  state: PumpState;
  effect: PumpEffect;
}

const result = (state: PumpState, effect: PumpEffect = null): PressResult => ({ state, effect });

export function createPump(): PumpState {
  return {
    status: 'off',
    field: 'rate',
    editing: false,
    cursor: 0,
    draft: [],
    rateTenths: 0,
    vtbiTenths: 0,
    pendingTenths: null,
    minRateTenths: 0,
    maxRateTenths: 9999,
    alarm: null,
    onMains: false,
  };
}

export function toDigits(tenths: number, count: number): number[] {
  return String(tenths).padStart(count, '0').slice(-count).split('').map(Number);
}

export function fromDigits(digits: number[]): number {
  return digits.reduce((acc, d) => acc * 10 + d, 0);
}

export function formatTenths(tenths: number, count: number): string {
  const s = String(tenths).padStart(count, '0');
  return `${s.slice(0, -1)}.${s.slice(-1)}`;
}

export function setRateLimits(state: PumpState, minRate: number, maxRate: number): PumpState {
  return { ...state, minRateTenths: Math.round(minRate * 10), maxRateTenths: Math.round(maxRate * 10) };
}

const fieldValue = (s: PumpState, field: PumpField): number => (field === 'rate' ? s.rateTenths : s.vtbiTenths);

const withField = (s: PumpState, field: PumpField, value: number): PumpState =>
  field === 'rate' ? { ...s, rateTenths: value } : { ...s, vtbiTenths: value };

function pressInProgram(s: PumpState, button: PumpButton): PressResult {
  switch (button) {
    case 'MENU':
      return result({ ...s, field: s.field === 'rate' ? 'vtbi' : 'rate' });
    case 'ENTER':
      return result({ ...s, editing: true, cursor: 0, draft: toDigits(fieldValue(s, s.field), FIELD_DIGITS[s.field]) });
    case 'START':
      return s.rateTenths === 0 || s.vtbiTenths === 0 ? result(s, 'beep') : result({ ...s, status: 'confirm' });
    default:
      return result(s);
  }
}

function pressWhileEditing(s: PumpState, button: PumpButton): PressResult {
  switch (button) {
    case 'LEFT':
      return result({ ...s, cursor: Math.max(0, s.cursor - 1) });
    case 'RIGHT':
      return result({ ...s, cursor: Math.min(s.draft.length - 1, s.cursor + 1) });
    case 'PLUS':
    case 'MINUS': {
      const draft = [...s.draft];
      draft[s.cursor] = (draft[s.cursor] + (button === 'PLUS' ? 1 : 9)) % 10;
      return result({ ...s, draft });
    }
    case 'ENTER': {
      const value = fromDigits(s.draft);
      const outside = value < s.minRateTenths || value > s.maxRateTenths;
      if (s.field === 'rate' && value > 0 && outside) {
        return result({ ...s, status: 'limitWarning', pendingTenths: value });
      }
      return result({ ...withField(s, s.field, value), editing: false });
    }
    case 'STOP':
      return result({ ...s, editing: false });
    default:
      return result(s);
  }
}

export function pressButton(s: PumpState, button: PumpButton): PressResult {
  // MUTE toggles the alarm sound: a second press brings it back.
  if (button === 'MUTE') {
    return result(s.alarm ? { ...s, alarm: { ...s.alarm, muted: !s.alarm.muted } } : s);
  }
  switch (s.status) {
    case 'off':
      return button === 'POWER' ? result({ ...s, status: 'program' }) : result(s);
    case 'program':
      return s.editing ? pressWhileEditing(s, button) : pressInProgram(s, button);
    case 'limitWarning':
      if (button === 'ENTER' && s.pendingTenths !== null) {
        return result(
          { ...s, rateTenths: s.pendingTenths, pendingTenths: null, editing: false, status: 'program' },
          'limitOverride',
        );
      }
      return button === 'STOP' ? result({ ...s, pendingTenths: null, status: 'program' }) : result(s);
    case 'confirm':
      if (button === 'START') return result(s, 'startAttempt');
      return button === 'STOP' ? result({ ...s, status: 'program' }) : result(s);
    case 'running':
      return button === 'STOP' ? result({ ...s, status: 'paused' }, 'stopped') : result(s);
    case 'paused':
      return button === 'START' ? result({ ...s, status: 'running' }) : result(s);
    case 'alarmStopped':
      return button === 'START' ? result(s, 'restartAttempt') : result(s);
    case 'complete':
      return result(s);
  }
}

export const beginInfusion = (s: PumpState): PumpState => ({ ...s, status: 'running' });

export const rejectStart = (s: PumpState): PumpState => ({ ...s, status: 'program' });

export function raiseAlarm(s: PumpState, type: AlarmType): PumpState {
  return {
    ...s,
    alarm: { type, fixed: false, muted: false, depleted: false },
    status: type === 'lowBattery' ? s.status : 'alarmStopped',
  };
}

export function depleteBattery(s: PumpState): PumpState {
  if (!s.alarm) return s;
  return { ...s, status: 'alarmStopped', alarm: { ...s.alarm, depleted: true, muted: false } };
}

/** Called once the student has done every required action for the active alarm. */
export function markAlarmFixed(s: PumpState): PumpState {
  if (!s.alarm) return s;
  if (s.alarm.type === 'lowBattery') {
    return s.alarm.depleted
      ? { ...s, onMains: true, alarm: { ...s.alarm, fixed: true } }
      : { ...s, onMains: true, alarm: null };
  }
  return { ...s, alarm: { ...s.alarm, fixed: true } };
}

export const resumeAfterAlarm = (s: PumpState): PumpState => ({ ...s, status: 'running', alarm: null });

export const completeInfusion = (s: PumpState): PumpState => ({ ...s, status: 'complete', alarm: null });
