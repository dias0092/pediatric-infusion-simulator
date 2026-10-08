import { describe, expect, it } from 'vitest';
import { ERROR_CODES, ROUTE_IDS, UNIT_IDS } from '../engine/types';
import { CATEGORIES } from '../engine/grading';
import { dictionaries, isLocale } from './index';
import { kk } from './kk';
import { ru } from './ru';

function shape(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(shape);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, shape(v)]));
  return typeof x;
}

function strings(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) x.forEach((v) => strings(v, out));
  else if (x && typeof x === 'object') Object.values(x).forEach((v) => strings(v, out));
  return out;
}

describe('dictionaries', () => {
  it('kk has exactly the keys and list lengths of ru', () => {
    expect(shape(kk)).toEqual(shape(ru));
  });

  it('has no empty strings', () => {
    for (const d of [ru, kk]) for (const s of strings(d)) expect(s.trim()).not.toBe('');
  });

  it('covers every error code, route, unit and score category', () => {
    for (const d of [ru, kk]) {
      expect(Object.keys(d.errors).sort()).toEqual([...ERROR_CODES].sort());
      expect(Object.keys(d.routes).sort()).toEqual([...ROUTE_IDS].sort());
      expect(Object.keys(d.units).sort()).toEqual([...UNIT_IDS].sort());
      expect(Object.keys(d.categories).sort()).toEqual([...CATEGORIES].sort());
    }
  });

  it('exposes both locales', () => {
    expect(dictionaries.ru).toBe(ru);
    expect(dictionaries.kk).toBe(kk);
    expect(isLocale('kk')).toBe(true);
    expect(isLocale('en')).toBe(false);
  });
});
