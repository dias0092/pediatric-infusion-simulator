import { describe, expect, it } from 'vitest';
import {
  doseMg, expectedValues, formatDuration, formatRemaining, girRateMlH, maintenance421,
  rateMlH, round1, timeHours, volumeFromDose, volumeFromMlPerKg,
} from './calc';

describe('formulas', () => {
  it('dose, volume, rate', () => {
    expect(doseMg(15, 14)).toBe(210);
    expect(volumeFromDose(210, 10)).toBe(21);
    expect(volumeFromMlPerKg(30, 12)).toBe(360);
    expect(rateMlH(21, 15)).toBe(84);
    expect(timeHours(21, 84)).toBe(0.25);
  });

  it('4-2-1 rule', () => {
    expect(maintenance421(8)).toBe(32);
    expect(maintenance421(15)).toBe(50);
    expect(maintenance421(25)).toBe(65);
  });

  it('GIR', () => {
    expect(round1(girRateMlH(6, 6, 200))).toBe(10.8);
  });

  it('round1', () => {
    expect(round1(10.800000000000001)).toBe(10.8);
    expect(round1(43.2)).toBe(43.2);
  });
});

describe('expectedValues', () => {
  it('dosePerKg', () => {
    expect(
      expectedValues({ kind: 'dosePerKg', mgPerKg: 15, concentrationMgPerMl: 10, durationMin: 15 }, 14),
    ).toEqual({ doseMg: 210, volumeMl: 21, rateMlH: 84, vtbiMl: 21, durationMin: 15 });
  });

  it('volumePerKg', () => {
    expect(expectedValues({ kind: 'volumePerKg', mlPerKg: 30, durationMin: 30 }, 12)).toEqual({
      doseMg: null, volumeMl: 360, rateMlH: 720, vtbiMl: 360, durationMin: 30,
    });
  });

  it('maintenance421', () => {
    expect(expectedValues({ kind: 'maintenance421', durationMin: 480 }, 15)).toEqual({
      doseMg: null, volumeMl: 400, rateMlH: 50, vtbiMl: 400, durationMin: 480,
    });
  });

  it('gir', () => {
    expect(
      expectedValues({ kind: 'gir', mgPerKgMin: 6, concentrationMgPerMl: 200, durationMin: 240 }, 6),
    ).toEqual({ doseMg: null, volumeMl: 43.2, rateMlH: 10.8, vtbiMl: 43.2, durationMin: 240 });
  });
});

describe('formatting', () => {
  it('formatDuration', () => {
    expect(formatDuration(0.25)).toBe('0:15');
    expect(formatDuration(0.5)).toBe('0:30');
    expect(formatDuration(4)).toBe('4:00');
    expect(formatDuration(8)).toBe('8:00');
  });

  it('formatRemaining', () => {
    expect(formatRemaining(1799)).toBe('29:59');
    expect(formatRemaining(0)).toBe('00:00');
    expect(formatRemaining(3600)).toBe('1:00:00');
    expect(formatRemaining(28799.4)).toBe('7:59:59');
  });
});
