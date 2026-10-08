import { describe, expect, it } from 'vitest';
import { pumpScreen } from './display';
import {
  beginInfusion, completeInfusion, createPump, markAlarmFixed, pressButton, raiseAlarm, setRateLimits,
  type PumpState,
} from './pump';
import { programPump } from './testing';
import type { PumpButton } from './types';

const press = (s: PumpState, ...buttons: PumpButton[]) => buttons.reduce((acc, b) => pressButton(acc, b).state, s);
const programmed = () => press(setRateLimits(createPump(), 20, 150), ...programPump(840, 210));
const running = () => beginInfusion(press(programmed(), 'START'));

describe('pumpScreen', () => {
  it('is dark when off', () => {
    expect(pumpScreen(createPump(), null, 0)).toEqual({ tone: 'off', header: '', lines: [], footer: '' });
  });

  it('shows RATE, VTBI and the computed TIME while programming', () => {
    const screen = pumpScreen(programmed(), 'PARACETAMOL 10 mg/mL', 0);
    expect(screen.tone).toBe('normal');
    expect(screen.header).toBe('PARACETAMOL 10 mg/mL');
    expect(screen.lines.map((l) => [l.label, l.value, l.unit])).toEqual([
      ['RATE', '084.0', 'ml/h'],
      ['VTBI', '0021.0', 'ml'],
      ['TIME', '0:15', 'h:mm'],
    ]);
    expect(screen.lines[1].selected).toBe(true);
  });

  it('shows the draft digits and the cursor while editing', () => {
    const s = press(createPump(), 'POWER', 'ENTER', 'RIGHT', 'PLUS');
    const rate = pumpScreen(s, null, 0).lines[0];
    expect(rate.digits).toEqual([0, 1, 0, 0]);
    expect(rate.cursor).toBe(1);
    expect(pumpScreen(s, null, 0).lines[2].value).toBe('--:--');
  });

  it('warns about the drug-library limit', () => {
    // 200.0 ml/h against a 20–150 ml/h library limit.
    const s = press(setRateLimits(createPump(), 20, 150), 'POWER', 'ENTER', 'PLUS', 'PLUS', 'ENTER');
    const screen = pumpScreen(s, 'X', 0);
    expect(screen.tone).toBe('warn');
    expect(screen.header).toBe('⚠ RATE ABOVE LIMIT');
    expect(screen.lines[0].value).toBe('200.0');
  });

  it('counts the infused volume and the time left', () => {
    const screen = pumpScreen(running(), 'X', 0.5);
    expect(screen.lines.map((l) => [l.label, l.value])).toEqual([
      ['RATE', '084.0'],
      ['VI', '0010.5'],
      ['LEFT', '07:30'],
    ]);
  });

  it('shows alarms', () => {
    const occlusion = raiseAlarm(running(), 'occlusion');
    expect(pumpScreen(occlusion, 'X', 0.4)).toMatchObject({ tone: 'alarm', header: '⛔ OCCLUSION', footer: 'MUTE = SILENCE' });
    expect(pumpScreen(markAlarmFixed(occlusion), 'X', 0.4).footer).toBe('START = RESTART');
    expect(pumpScreen(raiseAlarm(running(), 'airInLine'), 'X', 0.5).header).toBe('⛔ AIR IN LINE');
    expect(pumpScreen(raiseAlarm(running(), 'lowBattery'), 'X', 0.3)).toMatchObject({
      tone: 'warn',
      header: '⚠ LOW BATTERY 10%',
    });
  });

  it('reports the end of the infusion', () => {
    expect(pumpScreen(completeInfusion(running()), 'X', 1).header).toBe('VTBI INFUSED');
  });
});
