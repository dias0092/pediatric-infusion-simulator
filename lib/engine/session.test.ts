import { describe, expect, it } from 'vitest';
import { getScenario, scenarios } from '../scenarios';
import { ReplayError, applyEvent, createSession, nextAlarmStep, replay, type Session } from './session';
import { digitPresses, perfectEvents, programPump, pumpInputs, setupInputs, stamp, startInputs } from './testing';
import type { EventInput, Mode, Scenario } from './types';

const sc = (id: string): Scenario => getScenario(id)!;
const run = (scenario: Scenario, mode: Mode, inputs: EventInput[]): Session =>
  replay(scenario, mode, stamp(inputs));

describe('perfect runs', () => {
  it.each(scenarios)('$id finishes without errors in both modes', (scenario) => {
    for (const mode of ['learning', 'exam'] as const) {
      const s = replay(scenario, mode, perfectEvents(scenario));
      expect(s.finished).toBe(true);
      expect(s.errors).toEqual([]);
      expect(s.critical).toBe(false);
      expect(s.pump.status).toBe('complete');
    }
  });
});

describe('log validation', () => {
  it('rejects events at the wrong step', () => {
    expect(() =>
      run(sc('s1-paracetamol'), 'exam', [{ type: 'calcAnswered', stepId: 'dose', value: 210, unit: 'mg' }]),
    ).toThrow(ReplayError);
  });

  it('rejects time going backwards', () => {
    const s = createSession(sc('s1-paracetamol'), 'exam');
    const after = applyEvent(s, { type: 'drugSelected', optionId: 'paracetamol-10', t: 5000 });
    expect(() => applyEvent(after, { type: 'routeSelected', routeId: 'piv', t: 4000 })).toThrow(ReplayError);
  });

  it('rejects unknown ids', () => {
    expect(() => run(sc('s1-paracetamol'), 'exam', [{ type: 'drugSelected', optionId: 'nope' }])).toThrow(
      ReplayError,
    );
  });

  it('rejects an alarm the scenario does not have', () => {
    const s1 = sc('s1-paracetamol');
    expect(() =>
      run(s1, 'exam', [...setupInputs(s1), ...startInputs(s1), { type: 'alarmRaised', alarm: 'occlusion' }]),
    ).toThrow(ReplayError);
  });

  it('rejects completion while the scenario alarm was not handled', () => {
    const s2 = sc('s2-ceftriaxone');
    expect(() => run(s2, 'exam', [...setupInputs(s2), ...startInputs(s2), { type: 'infusionCompleted' }])).toThrow(
      ReplayError,
    );
  });

  it('rejects events after the session finished', () => {
    const s1 = sc('s1-paracetamol');
    const done = replay(s1, 'exam', perfectEvents(s1));
    expect(() => applyEvent(done, { type: 'pumpButton', button: 'MUTE', t: done.lastT + 1 })).toThrow(ReplayError);
  });
});

describe('drug, route and calculation steps', () => {
  it('learning mode stays on a wrong drug and counts attempts', () => {
    const s = run(sc('s1-paracetamol'), 'learning', [{ type: 'drugSelected', optionId: 'ketorolac-30' }]);
    expect(s.step).toBe('drug');
    expect(s.errors).toEqual([{ code: 'wrongDrug', ref: 'ketorolac-30' }]);
    expect(s.feedback).toEqual({ kind: 'wrong', codes: ['wrongDrug'] });
    const next = applyEvent(s, { type: 'drugSelected', optionId: 'paracetamol-10', t: s.lastT + 1 });
    expect(next.step).toBe('route');
    expect(next.drug).toMatchObject({ attempts: 2, correctAt: 2, selectedId: 'paracetamol-10' });
  });

  it('exam mode moves on after a wrong drug', () => {
    const s = run(sc('s1-paracetamol'), 'exam', [{ type: 'drugSelected', optionId: 'ketorolac-30' }]);
    expect(s.step).toBe('route');
    expect(s.drug.correctAt).toBeNull();
  });

  it('a dangerous look-alike marks the session critical', () => {
    const s = run(sc('s3-saline-bolus'), 'learning', [{ type: 'drugSelected', optionId: 'nacl-10' }]);
    expect(s.critical).toBe(true);
    expect(s.errors[0].code).toBe('criticalDrug');
  });

  it('checks that the access exists and is allowed', () => {
    const s1 = sc('s1-paracetamol');
    const missing = run(s1, 'learning', [
      { type: 'drugSelected', optionId: 'paracetamol-10' },
      { type: 'routeSelected', routeId: 'cvc' },
    ]);
    expect(missing.errors.at(-1)).toEqual({ code: 'routeNotAvailable', ref: 'cvc' });
    expect(missing.step).toBe('route');

    const s5 = sc('s5-glucose');
    const peripheral = run(s5, 'exam', [
      { type: 'drugSelected', optionId: 'glucose-20' },
      { type: 'routeSelected', routeId: 'piv' },
    ]);
    expect(peripheral.critical).toBe(true);
    expect(peripheral.errors.at(-1)?.code).toBe('criticalRoute');

    const central = run(s5, 'exam', [
      { type: 'drugSelected', optionId: 'glucose-20' },
      { type: 'routeSelected', routeId: 'picc' },
    ]);
    expect(central.critical).toBe(false);
    expect(central.step).toBe('calc');
  });

  it('separates a wrong unit from a wrong value and accepts the tolerance', () => {
    const s1 = sc('s1-paracetamol');
    const base: EventInput[] = [
      { type: 'drugSelected', optionId: 'paracetamol-10' },
      { type: 'routeSelected', routeId: 'piv' },
    ];
    const unit = run(s1, 'learning', [...base, { type: 'calcAnswered', stepId: 'dose', value: 210, unit: 'mg_kg' }]);
    expect(unit.errors.at(-1)).toEqual({ code: 'wrongUnit', ref: 'dose' });
    const value = run(s1, 'learning', [...base, { type: 'calcAnswered', stepId: 'dose', value: 21, unit: 'mg' }]);
    expect(value.errors.at(-1)).toEqual({ code: 'wrongCalc', ref: 'dose' });
    const close = run(s1, 'learning', [...base, { type: 'calcAnswered', stepId: 'dose', value: 209.96, unit: 'mg' }]);
    expect(close.errors).toEqual([]);
    expect(close.calcIndex).toBe(1);
  });
});

describe('starting the pump', () => {
  const s1 = sc('s1-paracetamol');
  // 840.0 ml/h (ten times the order): over the 150 ml/h soft limit, confirmed with a second ENTER.
  const tenfold = pumpInputs([
    'POWER', 'ENTER', ...digitPresses(8400, 4), 'ENTER', 'ENTER',
    'MENU', 'ENTER', ...digitPresses(210, 5), 'ENTER',
  ]);

  it('learning mode blocks a wrong rate and returns to programming', () => {
    const s = run(s1, 'learning', [
      ...setupInputs(s1),
      ...pumpInputs(programPump(850, 210)),
      { type: 'checklistCompleted' },
      ...pumpInputs(['START', 'START']),
    ]);
    expect(s.step).toBe('pump');
    expect(s.pump.status).toBe('program');
    expect(s.feedback).toEqual({ kind: 'blocked', codes: ['wrongRate'] });
    expect(s.start).toEqual({ attempts: 1, rateOkAt: null, vtbiOkAt: 1, checkOkAt: 1 });
  });

  it('a tenfold rate overrides the library warning and is critical', () => {
    const s = run(s1, 'exam', [...setupInputs(s1), ...tenfold, { type: 'checklistCompleted' }, ...pumpInputs(['START', 'START'])]);
    expect(s.step).toBe('infusion');
    expect(s.critical).toBe(true);
    expect(s.errors.map((e) => e.code)).toEqual(['ignoredLimitWarning', 'criticalRate']);
  });

  it('learning mode requires the double check; each category keeps its own first success', () => {
    const blocked = run(s1, 'learning', [...setupInputs(s1), ...startInputs(s1, { checklist: false })]);
    expect(blocked.feedback).toEqual({ kind: 'blocked', codes: ['startWithoutCheck'] });
    const s = run(s1, 'learning', [
      ...setupInputs(s1),
      ...startInputs(s1, { checklist: false }),
      { type: 'checklistCompleted' },
      ...pumpInputs(['START', 'START']),
    ]);
    expect(s.step).toBe('infusion');
    expect(s.start).toEqual({ attempts: 2, rateOkAt: 1, vtbiOkAt: 1, checkOkAt: 2 });
  });

  it('exam mode starts with wrong settings and records the errors silently', () => {
    const s = run(s1, 'exam', [...setupInputs(s1), ...startInputs(s1, { rateTenths: 850, checklist: false })]);
    expect(s.step).toBe('infusion');
    expect(s.pump.status).toBe('running');
    expect(s.feedback).toBeNull();
    expect(s.errors.map((e) => e.code)).toEqual(['wrongRate', 'startWithoutCheck']);
  });
});

describe('alarms', () => {
  const s2 = sc('s2-ceftriaxone');
  const occluded: EventInput[] = [...setupInputs(s2), ...startInputs(s2), { type: 'alarmRaised', alarm: 'occlusion' }];

  it('occlusion: a restart before the fix is a wrong action', () => {
    const s = run(s2, 'learning', [...occluded, { type: 'alarmAction', actionId: 'check_line' }, ...pumpInputs(['START'])]);
    expect(s.pump.status).toBe('alarmStopped');
    expect(s.errors.at(-1)).toEqual({ code: 'restartWithoutFix', ref: 'START' });
    expect(s.alarm).toMatchObject({ wrongCount: 1, resolved: false, performed: ['check_line'] });
    expect(nextAlarmStep(s)).toBe('open_clamp');
  });

  it('occlusion: inspection reveals the cause, then fix and restart', () => {
    const inspected = run(s2, 'learning', [...occluded, { type: 'alarmAction', actionId: 'check_line' }]);
    expect(inspected.feedback?.kind).toBe('reveal');
    const fixed = run(s2, 'learning', [
      ...occluded,
      { type: 'alarmAction', actionId: 'check_line' },
      { type: 'alarmAction', actionId: 'open_clamp' },
    ]);
    expect(nextAlarmStep(fixed)).toBe('START');
    const resumed = applyEvent(fixed, { type: 'pumpButton', button: 'START', t: fixed.lastT + 1 });
    expect(resumed.pump).toMatchObject({ status: 'running', alarm: null });
    expect(resumed.alarm?.resolved).toBe(true);
    expect(nextAlarmStep(resumed)).toBeNull();
  });

  it('exam mode: a senior colleague resolves the alarm after three wrong actions', () => {
    const wrong: EventInput = { type: 'alarmAction', actionId: 'flush_force' };
    const s = run(s2, 'exam', [...occluded, wrong, wrong, wrong]);
    expect(s.alarm).toMatchObject({ resolved: true, autoResolved: true, wrongCount: 3 });
    expect(s.pump.status).toBe('running');
  });

  const s4 = sc('s4-maintenance');
  const lowBattery: EventInput[] = [...setupInputs(s4), ...startInputs(s4), { type: 'alarmRaised', alarm: 'lowBattery' }];

  it('low battery: the pump keeps running, STOP is needless, mains resolves it', () => {
    expect(run(s4, 'learning', lowBattery).pump.status).toBe('running');
    const s = run(s4, 'learning', [
      ...lowBattery,
      ...pumpInputs(['STOP']),
      { type: 'alarmAction', actionId: 'connect_power' },
      ...pumpInputs(['START']),
    ]);
    expect(s.errors.map((e) => e.code)).toEqual(['stoppedNeedlessly']);
    expect(s.alarm).toMatchObject({ resolved: true, wrongCount: 1 });
    expect(s.pump).toMatchObject({ status: 'running', onMains: true, alarm: null });
  });

  it('low battery: depletion stops the pump until mains and START', () => {
    const s = run(s4, 'exam', [
      ...lowBattery,
      { type: 'batteryDepleted' },
      { type: 'alarmAction', actionId: 'connect_power' },
    ]);
    expect(s.pump.status).toBe('alarmStopped');
    expect(nextAlarmStep(s)).toBe('START');
    const resumed = applyEvent(s, { type: 'pumpButton', button: 'START', t: s.lastT + 1 });
    expect(resumed.alarm).toMatchObject({ resolved: true, depleted: true });
    const done = applyEvent(resumed, { type: 'infusionCompleted', t: resumed.lastT + 1 });
    expect(done.finished).toBe(true);
    expect(done.errors.map((e) => e.code)).toEqual(['batteryDepleted']);
  });
});
