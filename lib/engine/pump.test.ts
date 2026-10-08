import { describe, expect, it } from 'vitest';
import {
  beginInfusion, completeInfusion, createPump, depleteBattery, formatTenths, markAlarmFixed,
  pressButton, raiseAlarm, resumeAfterAlarm, setRateLimits, type PumpState,
} from './pump';
import { programPump } from './testing';
import type { PumpButton } from './types';

function press(state: PumpState, ...buttons: PumpButton[]): PumpState {
  return buttons.reduce((s, b) => pressButton(s, b).state, state);
}

const programmed = (rate: number, vtbi: number) =>
  press(setRateLimits(createPump(), 20, 150), ...programPump(rate, vtbi));

describe('pump programming', () => {
  it('is off until POWER', () => {
    const s = press(createPump(), 'ENTER', 'START', 'MENU');
    expect(s.status).toBe('off');
    expect(press(s, 'POWER').status).toBe('program');
  });

  it('edits RATE digit by digit', () => {
    let s = press(createPump(), 'POWER', 'ENTER');
    expect(s.editing).toBe(true);
    expect(s.draft).toEqual([0, 0, 0, 0]);
    expect(s.cursor).toBe(0);
    s = press(s, 'RIGHT', 'PLUS', 'PLUS', 'RIGHT', 'PLUS', 'ENTER');
    expect(s.editing).toBe(false);
    expect(s.rateTenths).toBe(210);
  });

  it('keeps the cursor inside the field and wraps digits', () => {
    let s = press(createPump(), 'POWER', 'ENTER', 'LEFT');
    expect(s.cursor).toBe(0);
    s = press(s, 'RIGHT', 'RIGHT', 'RIGHT', 'RIGHT', 'RIGHT');
    expect(s.cursor).toBe(3);
    s = press(s, 'MINUS');
    expect(s.draft).toEqual([0, 0, 0, 9]);
    s = press(s, 'PLUS');
    expect(s.draft).toEqual([0, 0, 0, 0]);
  });

  it('STOP discards the draft', () => {
    const s = press(createPump(), 'POWER', 'ENTER', 'PLUS', 'STOP');
    expect(s.editing).toBe(false);
    expect(s.rateTenths).toBe(0);
  });

  it('MENU switches to the 5-digit VTBI field', () => {
    const s = press(createPump(), 'POWER', 'MENU', 'ENTER');
    expect(s.field).toBe('vtbi');
    expect(s.draft).toHaveLength(5);
  });

  it('programPump enters both values', () => {
    const s = programmed(840, 210);
    expect(s).toMatchObject({ status: 'program', rateTenths: 840, vtbiTenths: 210, editing: false });
  });

  it('formats tenths', () => {
    expect(formatTenths(840, 4)).toBe('084.0');
    expect(formatTenths(210, 5)).toBe('0021.0');
  });
});

describe('drug library limits', () => {
  it('warns above the soft limit and records an override', () => {
    // 800.0 ml/h: eight presses on the hundreds digit, limits are 20–150 ml/h.
    let s = press(setRateLimits(createPump(), 20, 150), 'POWER', 'ENTER');
    s = press(s, 'PLUS', 'PLUS', 'PLUS', 'PLUS', 'PLUS', 'PLUS', 'PLUS', 'PLUS', 'ENTER');
    expect(s.status).toBe('limitWarning');
    expect(s.pendingTenths).toBe(8000);
    const confirmed = pressButton(s, 'ENTER');
    expect(confirmed.effect).toBe('limitOverride');
    expect(confirmed.state).toMatchObject({ status: 'program', rateTenths: 8000, editing: false });
  });

  it('STOP on the warning returns to editing without saving', () => {
    let s = press(setRateLimits(createPump(), 20, 150), 'POWER', 'ENTER', 'RIGHT', 'RIGHT', 'PLUS', 'ENTER');
    expect(s.status).toBe('limitWarning');
    s = press(s, 'STOP');
    expect(s).toMatchObject({ status: 'program', editing: true, rateTenths: 0, pendingTenths: null });
  });
});

describe('start and run', () => {
  it('beeps when RATE or VTBI is zero', () => {
    const r = pressButton(press(createPump(), 'POWER'), 'START');
    expect(r.effect).toBe('beep');
    expect(r.state.status).toBe('program');
  });

  it('START → confirm → startAttempt; STOP leaves confirm', () => {
    const confirm = press(programmed(840, 210), 'START');
    expect(confirm.status).toBe('confirm');
    expect(press(confirm, 'STOP').status).toBe('program');
    expect(pressButton(confirm, 'START').effect).toBe('startAttempt');
  });

  it('running ⇄ paused', () => {
    const running = beginInfusion(press(programmed(840, 210), 'START'));
    const stopped = pressButton(running, 'STOP');
    expect(stopped.effect).toBe('stopped');
    expect(stopped.state.status).toBe('paused');
    expect(press(stopped.state, 'MENU', 'ENTER').status).toBe('paused');
    expect(press(stopped.state, 'START').status).toBe('running');
  });

  it('completes', () => {
    const running = beginInfusion(press(programmed(840, 210), 'START'));
    expect(completeInfusion(running).status).toBe('complete');
  });
});

describe('alarms', () => {
  const running = () => beginInfusion(press(programmed(840, 210), 'START'));

  it('occlusion stops the pump; START asks for a restart; MUTE silences', () => {
    const s = raiseAlarm(running(), 'occlusion');
    expect(s.status).toBe('alarmStopped');
    expect(pressButton(s, 'START').effect).toBe('restartAttempt');
    expect(press(s, 'MUTE').alarm?.muted).toBe(true);
    const fixed = markAlarmFixed(s);
    expect(fixed.alarm?.fixed).toBe(true);
    expect(resumeAfterAlarm(fixed)).toMatchObject({ status: 'running', alarm: null });
  });

  it('low battery keeps running; mains clears it', () => {
    const s = raiseAlarm(running(), 'lowBattery');
    expect(s.status).toBe('running');
    expect(markAlarmFixed(s)).toMatchObject({ status: 'running', alarm: null, onMains: true });
  });

  it('depleted battery stops the pump until mains + START', () => {
    const s = depleteBattery(raiseAlarm(running(), 'lowBattery'));
    expect(s.status).toBe('alarmStopped');
    expect(s.alarm?.depleted).toBe(true);
    const fixed = markAlarmFixed(s);
    expect(fixed).toMatchObject({ onMains: true, alarm: { fixed: true } });
    expect(resumeAfterAlarm(fixed).status).toBe('running');
  });
});
