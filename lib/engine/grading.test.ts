import { describe, expect, it } from 'vitest';
import { getScenario, scenarios } from '../scenarios';
import { attemptFactor, gradeSession } from './grading';
import { replay } from './session';
import { digitPresses, perfectEvents, pumpInputs, setupInputs, stamp, startInputs } from './testing';
import type { EventInput, Mode, Scenario } from './types';

const sc = (id: string): Scenario => getScenario(id)!;
const grade = (scenario: Scenario, mode: Mode, inputs: EventInput[]) =>
  gradeSession(replay(scenario, mode, stamp(inputs)));
const done: EventInput = { type: 'infusionCompleted' };

describe('attemptFactor', () => {
  it('applies ×1 / ×0.5 / ×0 in learning mode and one attempt in exam mode', () => {
    expect(attemptFactor(1, 'learning')).toBe(1);
    expect(attemptFactor(2, 'learning')).toBe(0.5);
    expect(attemptFactor(3, 'learning')).toBe(0);
    expect(attemptFactor(null, 'learning')).toBe(0);
    expect(attemptFactor(1, 'exam')).toBe(1);
    expect(attemptFactor(2, 'exam')).toBe(0);
  });
});

describe('gradeSession', () => {
  it.each(scenarios)('$id: a perfect run scores 100 in both modes', (scenario) => {
    for (const mode of ['learning', 'exam'] as const) {
      const events = perfectEvents(scenario);
      const g = gradeSession(replay(scenario, mode, events));
      expect(g).toEqual({
        score: 100,
        passed: true,
        breakdown: { drug: 15, route: 15, calc: 20, rate: 20, vtbi: 10, check: 10, alarm: 10 },
        errors: [],
        durationSec: Math.round(events.at(-1)!.t / 1000),
      });
    }
  });

  it('refuses to grade an unfinished session', () => {
    const s1 = sc('s1-paracetamol');
    expect(() => gradeSession(replay(s1, 'exam', stamp(setupInputs(s1))))).toThrow();
  });

  it('learning: a drug found on the second try gives half points and loses "no errors"', () => {
    const s1 = sc('s1-paracetamol');
    const g = grade(s1, 'learning', [
      { type: 'drugSelected', optionId: 'ketorolac-30' },
      ...setupInputs(s1),
      ...startInputs(s1),
      done,
    ]);
    expect(g.breakdown.drug).toBe(7.5);
    expect(g.breakdown.alarm).toBe(0);
    expect(g.score).toBe(83);
    expect(g.passed).toBe(true);
  });

  it('learning: a calculation fixed on the second try gives half of that step', () => {
    const s1 = sc('s1-paracetamol');
    const [drug, route, dose, volume] = setupInputs(s1);
    const g = grade(s1, 'learning', [
      drug, route,
      { type: 'calcAnswered', stepId: 'dose', value: 21, unit: 'mg' },
      dose, volume,
      ...startInputs(s1),
      done,
    ]);
    expect(g.breakdown.calc).toBe(15);
    expect(g.score).toBe(85);
  });

  it('exam: a wrong rate and a skipped double check', () => {
    const s1 = sc('s1-paracetamol');
    const g = grade(s1, 'exam', [...setupInputs(s1), ...startInputs(s1, { rateTenths: 850, checklist: false }), done]);
    expect(g.breakdown).toEqual({ drug: 15, route: 15, calc: 20, rate: 0, vtbi: 10, check: 0, alarm: 0 });
    expect(g.score).toBe(60);
    expect(g.passed).toBe(true);
  });

  it('exam: a tenfold rate fails the station whatever the score', () => {
    const s1 = sc('s1-paracetamol');
    const tenfold = pumpInputs([
      'POWER', 'ENTER', ...digitPresses(8400, 4), 'ENTER', 'ENTER',
      'MENU', 'ENTER', ...digitPresses(210, 5), 'ENTER',
    ]);
    const g = grade(s1, 'exam', [
      ...setupInputs(s1), ...tenfold, { type: 'checklistCompleted' }, ...pumpInputs(['START', 'START']), done,
    ]);
    expect(g.score).toBe(70);
    expect(g.passed).toBe(false);
  });

  it('alarm actions out of order give half of the alarm points', () => {
    const s2 = sc('s2-ceftriaxone');
    const g = grade(s2, 'learning', [
      ...setupInputs(s2), ...startInputs(s2),
      { type: 'alarmRaised', alarm: 'occlusion' },
      { type: 'alarmAction', actionId: 'open_clamp' },
      { type: 'alarmAction', actionId: 'check_line' },
      ...pumpInputs(['START']),
      done,
    ]);
    expect(g.breakdown.alarm).toBe(5);
    expect(g.score).toBe(95);
  });

  it('a restart before the fix gives half of the alarm points', () => {
    const s2 = sc('s2-ceftriaxone');
    const g = grade(s2, 'learning', [
      ...setupInputs(s2), ...startInputs(s2),
      { type: 'alarmRaised', alarm: 'occlusion' },
      ...pumpInputs(['START']),
      { type: 'alarmAction', actionId: 'check_line' },
      { type: 'alarmAction', actionId: 'open_clamp' },
      ...pumpInputs(['START']),
      done,
    ]);
    expect(g.breakdown.alarm).toBe(5);
  });

  it('exam: an alarm resolved by a senior colleague gives no alarm points', () => {
    const s2 = sc('s2-ceftriaxone');
    const wrong: EventInput = { type: 'alarmAction', actionId: 'power_cycle' };
    const g = grade(s2, 'exam', [
      ...setupInputs(s2), ...startInputs(s2), { type: 'alarmRaised', alarm: 'occlusion' }, wrong, wrong, wrong, done,
    ]);
    expect(g.breakdown.alarm).toBe(0);
    expect(g.score).toBe(90);
    expect(g.errors).toHaveLength(3);
  });

  it('a depleted battery gives no alarm points', () => {
    const s4 = sc('s4-maintenance');
    const g = grade(s4, 'exam', [
      ...setupInputs(s4), ...startInputs(s4),
      { type: 'alarmRaised', alarm: 'lowBattery' },
      { type: 'batteryDepleted' },
      { type: 'alarmAction', actionId: 'connect_power' },
      ...pumpInputs(['START']),
      done,
    ]);
    expect(g.breakdown.alarm).toBe(0);
    expect(g.score).toBe(90);
  });
});
