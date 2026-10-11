import { describe, expect, it } from 'vitest';
import { expectedValues, formatDuration, timeHours } from '../engine/calc';
import { getScenario, scenarios } from './index';

const table = {
  's1-paracetamol': { rate: 84, vtbi: 21, time: '0:15' },
  's2-ceftriaxone': { rate: 80, vtbi: 40, time: '0:30' },
  's3-saline-bolus': { rate: 720, vtbi: 360, time: '0:30' },
  's4-maintenance': { rate: 50, vtbi: 400, time: '8:00' },
  's5-glucose': { rate: 10.8, vtbi: 43.2, time: '4:00' },
} as const;

function collectL10n(value: unknown, out: Array<{ ru: string; kk: string }> = []) {
  if (Array.isArray(value)) {
    value.forEach((v) => collectL10n(v, out));
  } else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.ru === 'string' && typeof obj.kk === 'string') out.push(obj as { ru: string; kk: string });
    else Object.values(obj).forEach((v) => collectL10n(v, out));
  }
  return out;
}

describe('scenario data', () => {
  it('has five scenarios numbered 1..5 with unique ids', () => {
    expect(scenarios.map((s) => s.number)).toEqual([1, 2, 3, 4, 5]);
    expect(scenarios.map((s) => s.id).sort()).toEqual(Object.keys(table).sort());
  });

  it.each(scenarios)('$id matches the spec table', (s) => {
    const exp = expectedValues(s.prescription, s.patient.weightKg);
    const row = table[s.id as keyof typeof table];
    expect(exp.rateMlH).toBe(row.rate);
    expect(exp.vtbiMl).toBe(row.vtbi);
    expect(formatDuration(timeHours(exp.vtbiMl, exp.rateMlH))).toBe(row.time);
  });

  it.each(scenarios)('$id is internally consistent', (s) => {
    const exp = expectedValues(s.prescription, s.patient.weightKg);
    const correct = s.drugOptions.find((o) => o.id === s.correctDrugId);
    expect(correct).toBeDefined();
    expect(correct!.critical).not.toBe(true);
    expect(exp.rateMlH).toBeGreaterThanOrEqual(correct!.softMinRate);
    expect(exp.rateMlH).toBeLessThanOrEqual(correct!.softMaxRate);
    expect(exp.rateMlH).toBeLessThanOrEqual(999.9);
    expect(exp.vtbiMl).toBeLessThanOrEqual(9999.9);
    expect(s.acceptableRoutes.some((r) => s.patient.accesses.includes(r))).toBe(true);
    expect(s.criticalRoutes.every((r) => !s.acceptableRoutes.includes(r))).toBe(true);
    expect(new Set(s.drugOptions.map((o) => o.id)).size).toBe(s.drugOptions.length);
    expect(s.calcSteps.length).toBeGreaterThan(0);
    for (const c of s.calcSteps) {
      expect(exp[c.quantity]).not.toBeNull();
      expect(c.unitOptions).toContain(c.unit);
    }
    if (s.alarm) {
      const ids = s.alarm.actions.map((a) => a.id);
      expect(s.alarm.sequence.every((id) => ids.includes(id))).toBe(true);
      expect(ids.length).toBeGreaterThan(s.alarm.sequence.length);
      expect(s.alarm.atProgress).toBeGreaterThan(0);
      expect(s.alarm.atProgress).toBeLessThan(1);
    }
    expect(s.sources.length).toBeGreaterThan(0);
  });

  it('has the alarms from the spec', () => {
    expect(scenarios.map((s) => s.alarm?.type ?? null)).toEqual([null, 'occlusion', 'airInLine', 'lowBattery', null]);
    expect(getScenario('s4-maintenance')!.alarm!.depleteAtProgress).toBe(0.7);
  });

  it('marks the dangerous look-alikes and the peripheral route in scenario 5 as critical', () => {
    const critical = scenarios.flatMap((s) => s.drugOptions.filter((o) => o.critical).map((o) => o.id));
    expect(critical.sort()).toEqual(['glucose-40', 'nacl-10']);
    expect(getScenario('s5-glucose')!.criticalRoutes).toEqual(['piv']);
  });

  it('has every text in Russian and Kazakh', () => {
    const texts = collectL10n(scenarios);
    expect(texts.length).toBeGreaterThan(50);
    for (const t of texts) {
      expect(t.ru.trim()).not.toBe('');
      expect(t.kk.trim()).not.toBe('');
    }
  });

  it('returns undefined for an unknown id', () => {
    expect(getScenario('nope')).toBeUndefined();
  });
});
