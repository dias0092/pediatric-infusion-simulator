import type { Prescription } from './types';

export const round1 = (x: number): number => Math.round(x * 10) / 10;

export const doseMg = (mgPerKg: number, weightKg: number): number => mgPerKg * weightKg;

export const volumeFromDose = (dose: number, concentrationMgPerMl: number): number =>
  dose / concentrationMgPerMl;

export const volumeFromMlPerKg = (mlPerKg: number, weightKg: number): number => mlPerKg * weightKg;

export const rateMlH = (volumeMl: number, durationMin: number): number => volumeMl / (durationMin / 60);

/** Holliday–Segar hourly rule: 4 ml/kg/h for the first 10 kg, 2 for the next 10, 1 above 20 kg. */
export function maintenance421(weightKg: number): number {
  const first = Math.min(weightKg, 10);
  const second = Math.min(Math.max(weightKg - 10, 0), 10);
  const rest = Math.max(weightKg - 20, 0);
  return 4 * first + 2 * second + rest;
}

export const girRateMlH = (mgPerKgMin: number, weightKg: number, concentrationMgPerMl: number): number =>
  (mgPerKgMin * weightKg * 60) / concentrationMgPerMl;

export const timeHours = (vtbiMl: number, rate: number): number => vtbiMl / rate;

export interface Expected {
  doseMg: number | null;
  volumeMl: number;
  rateMlH: number;
  vtbiMl: number;
  durationMin: number;
}

export function expectedValues(p: Prescription, weightKg: number): Expected {
  switch (p.kind) {
    case 'dosePerKg': {
      const dose = doseMg(p.mgPerKg, weightKg);
      const volume = round1(volumeFromDose(dose, p.concentrationMgPerMl));
      return {
        doseMg: round1(dose),
        volumeMl: volume,
        rateMlH: round1(rateMlH(volume, p.durationMin)),
        vtbiMl: volume,
        durationMin: p.durationMin,
      };
    }
    case 'volumePerKg': {
      const volume = round1(volumeFromMlPerKg(p.mlPerKg, weightKg));
      return {
        doseMg: null,
        volumeMl: volume,
        rateMlH: round1(rateMlH(volume, p.durationMin)),
        vtbiMl: volume,
        durationMin: p.durationMin,
      };
    }
    case 'maintenance421':
    case 'gir': {
      const rate = round1(
        p.kind === 'gir'
          ? girRateMlH(p.mgPerKgMin, weightKg, p.concentrationMgPerMl)
          : maintenance421(weightKg),
      );
      const vtbi = round1((rate * p.durationMin) / 60);
      return { doseMg: null, volumeMl: vtbi, rateMlH: rate, vtbiMl: vtbi, durationMin: p.durationMin };
    }
  }
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Hours → "H:MM", as on the pump TIME line. */
export function formatDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  return `${Math.floor(totalMin / 60)}:${pad2(totalMin % 60)}`;
}

/** Seconds → "MM:SS" below one hour, otherwise "H:MM:SS". */
export function formatRemaining(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}
