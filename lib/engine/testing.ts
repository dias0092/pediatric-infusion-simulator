import { expectedValues } from './calc';
import { FIELD_DIGITS, toDigits } from './pump';
import type { EventInput, PumpButton, Scenario, SimEvent } from './types';

/** Button presses that turn an all-zero draft (cursor on the first digit) into `tenths`. */
export function digitPresses(tenths: number, count: number): PumpButton[] {
  const presses: PumpButton[] = [];
  toDigits(tenths, count).forEach((digit, index) => {
    if (index > 0) presses.push('RIGHT');
    for (let k = 0; k < digit; k++) presses.push('PLUS');
  });
  return presses;
}

/** From a switched-off pump: power on, enter RATE, switch to VTBI, enter VTBI. */
export function programPump(rateTenths: number, vtbiTenths: number): PumpButton[] {
  return [
    'POWER',
    'ENTER', ...digitPresses(rateTenths, FIELD_DIGITS.rate), 'ENTER',
    'MENU',
    'ENTER', ...digitPresses(vtbiTenths, FIELD_DIGITS.vtbi), 'ENTER',
  ];
}

/** Gives events increasing timestamps: stepMs, 2 × stepMs, … */
export function stamp(inputs: EventInput[], stepMs = 1000): SimEvent[] {
  return inputs.map((input, i) => ({ ...input, t: (i + 1) * stepMs }) as SimEvent);
}

export const pumpInputs = (buttons: PumpButton[]): EventInput[] =>
  buttons.map((button) => ({ type: 'pumpButton', button }));

/** Correct drug, route and calculation answers. */
export function setupInputs(scenario: Scenario): EventInput[] {
  const exp = expectedValues(scenario.prescription, scenario.patient.weightKg);
  const route = scenario.acceptableRoutes.find((r) => scenario.patient.accesses.includes(r));
  if (!route) throw new Error(`${scenario.id}: no usable route`);
  return [
    { type: 'drugSelected', optionId: scenario.correctDrugId },
    { type: 'routeSelected', routeId: route },
    ...scenario.calcSteps.map(
      (c): EventInput => ({ type: 'calcAnswered', stepId: c.id, value: exp[c.quantity] ?? NaN, unit: c.unit }),
    ),
  ];
}

/** Program the pump (prescribed values unless overridden), optionally double-check, START twice. */
export function startInputs(
  scenario: Scenario,
  opts: { rateTenths?: number; vtbiTenths?: number; checklist?: boolean } = {},
): EventInput[] {
  const exp = expectedValues(scenario.prescription, scenario.patient.weightKg);
  const rate = opts.rateTenths ?? Math.round(exp.rateMlH * 10);
  const vtbi = opts.vtbiTenths ?? Math.round(exp.vtbiMl * 10);
  const check: EventInput[] = opts.checklist === false ? [] : [{ type: 'checklistCompleted' }];
  return [...pumpInputs(programPump(rate, vtbi)), ...check, ...pumpInputs(['START', 'START'])];
}

/** Raise the scenario alarm and answer it correctly. */
export function alarmInputs(scenario: Scenario): EventInput[] {
  const alarm = scenario.alarm;
  if (!alarm) return [];
  return [
    { type: 'alarmRaised', alarm: alarm.type },
    { type: 'pumpButton', button: 'MUTE' },
    ...alarm.sequence.map((id): EventInput => ({ type: 'alarmAction', actionId: id })),
    ...(alarm.type === 'lowBattery' ? [] : pumpInputs(['START'])),
  ];
}

export function perfectEvents(scenario: Scenario): SimEvent[] {
  return stamp([
    ...setupInputs(scenario),
    ...startInputs(scenario),
    ...alarmInputs(scenario),
    { type: 'infusionCompleted' },
  ]);
}
