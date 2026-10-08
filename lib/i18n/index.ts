import type { Locale } from '../engine/types';
import { kk } from './kk';
import { ru, type Dict } from './ru';

export type { Dict };

export const dictionaries: Record<Locale, Dict> = { ru, kk };

export const DEFAULT_LOCALE: Locale = 'ru';

export const isLocale = (x: unknown): x is Locale => x === 'ru' || x === 'kk';
