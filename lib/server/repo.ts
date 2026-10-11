import type { Breakdown } from '../engine/grading';
import type { Locale, Mode, SimError, SimEvent } from '../engine/types';

export interface NewResult {
  id: string;
  nickname: string;
  scenarioId: string;
  mode: Mode;
  score: number;
  passed: boolean;
  breakdown: Breakdown;
  errors: SimError[];
  events: SimEvent[];
  durationSec: number;
  locale: Locale;
  appVersion: string;
}

export interface StoredResult extends NewResult {
  hidden: boolean;
  createdAt: string;
}

export interface LeaderboardRow {
  nickname: string;
  score: number;
  passed: boolean;
  durationSec: number;
  scenarioId: string;
  createdAt: string;
}

export interface LeaderboardQuery {
  mode: Mode;
  since: string | null;
  scenarioId: string | null;
  limit: number;
}

export interface ResultsRepo {
  insert(result: NewResult): Promise<{ created: boolean; result: StoredResult }>;
  leaderboard(query: LeaderboardQuery): Promise<LeaderboardRow[]>;
  recent(limit: number): Promise<StoredResult[]>;
  hide(id: string): Promise<boolean>;
}

/** Passed first, then higher score, shorter time, earlier attempt. */
export function compareForBoard(a: LeaderboardRow, b: LeaderboardRow): number {
  return (
    Number(b.passed) - Number(a.passed) ||
    b.score - a.score ||
    a.durationSec - b.durationSec ||
    a.createdAt.localeCompare(b.createdAt)
  );
}
