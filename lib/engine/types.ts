export const LOCALES = ['ru', 'kk'] as const;
export type Locale = (typeof LOCALES)[number];
export type L10n = Record<Locale, string>;

export const MODES = ['learning', 'exam'] as const;
export type Mode = (typeof MODES)[number];

export const ROUTE_IDS = ['piv', 'cvc', 'picc', 'io'] as const;
export type RouteId = (typeof ROUTE_IDS)[number];

export const UNIT_IDS = ['mg', 'g', 'ml', 'ml_h', 'mg_kg', 'ml_kg', 'mg_ml'] as const;
export type UnitId = (typeof UNIT_IDS)[number];

export const PUMP_BUTTONS = [
  'POWER', 'MENU', 'LEFT', 'RIGHT', 'PLUS', 'MINUS', 'ENTER', 'START', 'STOP', 'MUTE',
] as const;
export type PumpButton = (typeof PUMP_BUTTONS)[number];

export const ALARM_TYPES = ['occlusion', 'airInLine', 'lowBattery'] as const;
export type AlarmType = (typeof ALARM_TYPES)[number];

export const ERROR_CODES = [
  'wrongDrug', 'criticalDrug', 'routeNotAvailable', 'wrongRoute', 'criticalRoute',
  'wrongCalc', 'wrongUnit', 'wrongRate', 'criticalRate', 'wrongVtbi',
  'ignoredLimitWarning', 'startWithoutCheck', 'wrongAlarmAction', 'restartWithoutFix',
  'stoppedNeedlessly', 'batteryDepleted',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface SimError {
  code: ErrorCode;
  ref?: string;
}

export type Prescription =
  | { kind: 'dosePerKg'; mgPerKg: number; concentrationMgPerMl: number; durationMin: number }
  | { kind: 'volumePerKg'; mlPerKg: number; durationMin: number }
  | { kind: 'maintenance421'; durationMin: number }
  | { kind: 'gir'; mgPerKgMin: number; concentrationMgPerMl: number; durationMin: number };

export interface DrugOption {
  id: string;
  name: L10n;
  /** Text on the pump display, English, e.g. "PARACETAMOL 10 mg/mL". */
  pumpLabel: string;
  /** Training drug-library soft limits, ml/h. */
  softMinRate: number;
  softMaxRate: number;
  critical?: boolean;
}

export type CalcQuantity = 'doseMg' | 'volumeMl' | 'rateMlH';

export interface CalcStep {
  id: string;
  quantity: CalcQuantity;
  prompt: L10n;
  hint: L10n;
  unit: UnitId;
  unitOptions: UnitId[];
}

export interface AlarmAction {
  id: string;
  label: L10n;
  /** Shown after the action, e.g. the cause found while inspecting the line. */
  reveals?: L10n;
}

export interface AlarmSpec {
  type: AlarmType;
  /** Fraction of VTBI infused when the alarm fires, 0..1. */
  atProgress: number;
  /** lowBattery only: fraction at which the battery runs out if not on mains. */
  depleteAtProgress?: number;
  actions: AlarmAction[];
  /** Ids of the correct actions in the required order (the final START is implicit). */
  sequence: string[];
}

export interface Patient {
  code: string;
  age: L10n;
  weightKg: number;
  condition: L10n;
  accesses: RouteId[];
}

export interface Scenario {
  id: string;
  number: number;
  title: L10n;
  reviewStatus: 'draft' | 'reviewed';
  patient: Patient;
  order: L10n;
  prescription: Prescription;
  drugOptions: DrugOption[];
  correctDrugId: string;
  acceptableRoutes: RouteId[];
  criticalRoutes: RouteId[];
  calcSteps: CalcStep[];
  alarm: AlarmSpec | null;
  sources: string[];
}

export type SimEvent =
  | { type: 'drugSelected'; optionId: string; t: number }
  | { type: 'routeSelected'; routeId: RouteId; t: number }
  | { type: 'calcAnswered'; stepId: string; value: number; unit: UnitId; t: number }
  | { type: 'pumpButton'; button: PumpButton; t: number }
  | { type: 'checklistCompleted'; t: number }
  | { type: 'alarmRaised'; alarm: AlarmType; t: number }
  | { type: 'batteryDepleted'; t: number }
  | { type: 'alarmAction'; actionId: string; t: number }
  | { type: 'infusionCompleted'; t: number };

type WithoutT<T> = T extends unknown ? Omit<T, 't'> : never;
/** A SimEvent before the session clock stamps it with `t`. */
export type EventInput = WithoutT<SimEvent>;
