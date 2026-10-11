import type { Mode } from '../engine/types';
import { KEYS, readJson, writeJson, type KV } from './storage';

export interface HistoryItem {
  id: string;
  scenarioId: string;
  mode: Mode;
  score: number;
  passed: boolean;
  durationSec: number;
  createdAt: string;
}

export const HISTORY_LIMIT = 50;

export function readHistory(kv: KV): HistoryItem[] {
  const list = readJson<unknown>(kv, KEYS.history, []);
  return Array.isArray(list) ? (list as HistoryItem[]) : [];
}

export function addHistory(kv: KV, item: HistoryItem): HistoryItem[] {
  const list = [item, ...readHistory(kv).filter((h) => h.id !== item.id)].slice(0, HISTORY_LIMIT);
  writeJson(kv, KEYS.history, list);
  return list;
}
