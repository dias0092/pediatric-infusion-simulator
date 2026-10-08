import { formatDuration, formatRemaining } from './calc';
import { FIELD_DIGITS, formatTenths, type PumpField, type PumpState } from './pump';

export type ScreenTone = 'off' | 'normal' | 'warn' | 'alarm';

export interface ScreenLine {
  label: string;
  value: string;
  unit: string;
  selected?: boolean;
  /** Present while the field is being edited: the draft digits (last one is tenths). */
  digits?: number[];
  cursor?: number;
}

export interface PumpScreen {
  tone: ScreenTone;
  header: string;
  lines: ScreenLine[];
  footer: string;
}

const UNIT: Record<PumpField, string> = { rate: 'ml/h', vtbi: 'ml' };
const LABEL: Record<PumpField, string> = { rate: 'RATE', vtbi: 'VTBI' };

function fieldLine(s: PumpState, field: PumpField): ScreenLine {
  const tenths = field === 'rate' ? s.rateTenths : s.vtbiTenths;
  const line: ScreenLine = {
    label: LABEL[field],
    value: formatTenths(tenths, FIELD_DIGITS[field]),
    unit: UNIT[field],
    selected: s.field === field,
  };
  return s.editing && s.field === field ? { ...line, digits: s.draft, cursor: s.cursor } : line;
}

const timeLine = (s: PumpState): ScreenLine => ({
  label: 'TIME',
  value: s.rateTenths > 0 && s.vtbiTenths > 0 ? formatDuration(s.vtbiTenths / s.rateTenths) : '--:--',
  unit: 'h:mm',
});

function alarmHeader(s: PumpState): string {
  if (s.alarm?.depleted) return '⛔ BATTERY EMPTY';
  return s.alarm?.type === 'airInLine' ? '⛔ AIR IN LINE' : '⛔ OCCLUSION';
}

export function pumpScreen(s: PumpState, drugLabel: string | null, progress: number): PumpScreen {
  const drug = drugLabel ?? 'NO DRUG LIBRARY';
  const rate = formatTenths(s.rateTenths, FIELD_DIGITS.rate);
  const remainingSec = s.rateTenths > 0 ? ((1 - progress) * (s.vtbiTenths / s.rateTenths)) * 3600 : 0;
  const runLines: ScreenLine[] = [
    { label: 'RATE', value: rate, unit: 'ml/h' },
    { label: 'VI', value: formatTenths(Math.round(progress * s.vtbiTenths), FIELD_DIGITS.vtbi), unit: 'ml' },
    { label: 'LEFT', value: formatRemaining(remainingSec), unit: '' },
  ];

  switch (s.status) {
    case 'off':
      return { tone: 'off', header: '', lines: [], footer: '' };
    case 'program':
      return {
        tone: 'normal',
        header: drug,
        lines: [fieldLine(s, 'rate'), fieldLine(s, 'vtbi'), timeLine(s)],
        footer: s.editing ? '◀ ▶  + −  ENTER = OK  STOP = CANCEL' : 'MENU = FIELD  ENTER = EDIT  START',
      };
    case 'limitWarning': {
      const pending = s.pendingTenths ?? 0;
      return {
        tone: 'warn',
        header: pending > s.maxRateTenths ? '⚠ RATE ABOVE LIMIT' : '⚠ RATE BELOW LIMIT',
        lines: [
          { label: 'RATE', value: formatTenths(pending, FIELD_DIGITS.rate), unit: 'ml/h' },
          {
            label: 'LIMIT',
            value: `${formatTenths(s.minRateTenths, FIELD_DIGITS.rate)}–${formatTenths(s.maxRateTenths, FIELD_DIGITS.rate)}`,
            unit: 'ml/h',
          },
        ],
        footer: 'ENTER = CONFIRM  STOP = BACK',
      };
    }
    case 'confirm':
      return {
        tone: 'normal',
        header: 'CONFIRM SETTINGS?',
        lines: [
          { label: 'RATE', value: rate, unit: 'ml/h' },
          { label: 'VTBI', value: formatTenths(s.vtbiTenths, FIELD_DIGITS.vtbi), unit: 'ml' },
          timeLine(s),
        ],
        footer: 'START = RUN  STOP = BACK',
      };
    case 'running':
      return s.alarm?.type === 'lowBattery'
        ? { tone: 'warn', header: '⚠ LOW BATTERY 10%', lines: runLines, footer: 'MUTE = SILENCE' }
        : { tone: 'normal', header: `▶▶ ${drug}`, lines: runLines, footer: 'STOP = PAUSE' };
    case 'paused':
      return { tone: 'warn', header: 'PAUSED', lines: runLines, footer: 'START = CONTINUE' };
    case 'alarmStopped':
      return {
        tone: 'alarm',
        header: alarmHeader(s),
        lines: runLines,
        footer: s.alarm?.fixed ? 'START = RESTART' : 'MUTE = SILENCE',
      };
    case 'complete':
      return {
        tone: 'normal',
        header: 'VTBI INFUSED',
        lines: [{ label: 'VI', value: formatTenths(s.vtbiTenths, FIELD_DIGITS.vtbi), unit: 'ml' }],
        footer: 'KVO',
      };
  }
}
