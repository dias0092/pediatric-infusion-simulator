import { compareForBoard, type LeaderboardRow, type ResultsRepo, type StoredResult } from './repo';

/** In-memory store for local development and the e2e test. Data is lost on restart. */
export function createMemoryRepo(now: () => Date = () => new Date()): ResultsRepo {
  const rows = new Map<string, StoredResult>();

  return {
    async insert(result) {
      const existing = rows.get(result.id);
      if (existing) return { created: false, result: existing };
      const stored: StoredResult = { ...result, hidden: false, createdAt: now().toISOString() };
      rows.set(result.id, stored);
      return { created: true, result: stored };
    },

    async leaderboard({ mode, since, scenarioId, limit }) {
      const best = new Map<string, LeaderboardRow>();
      for (const r of rows.values()) {
        if (r.mode !== mode || r.hidden) continue;
        if (since && r.createdAt < since) continue;
        if (scenarioId && r.scenarioId !== scenarioId) continue;
        const row: LeaderboardRow = {
          nickname: r.nickname,
          score: r.score,
          passed: r.passed,
          durationSec: r.durationSec,
          scenarioId: r.scenarioId,
          createdAt: r.createdAt,
        };
        const key = r.nickname.toLowerCase();
        const current = best.get(key);
        if (!current || compareForBoard(row, current) < 0) best.set(key, row);
      }
      return [...best.values()].sort(compareForBoard).slice(0, limit);
    },

    async recent(limit) {
      return [...rows.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    },

    async hide(id) {
      const r = rows.get(id);
      if (!r) return false;
      rows.set(id, { ...r, hidden: true });
      return true;
    },
  };
}
