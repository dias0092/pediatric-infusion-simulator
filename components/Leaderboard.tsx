'use client';

import { useEffect, useState } from 'react';
import { formatRemaining } from '@/lib/engine/calc';
import type { Mode } from '@/lib/engine/types';
import { getScenario } from '@/lib/scenarios';
import type { LeaderboardRow } from '@/lib/server/repo';
import { useI18n } from './I18nProvider';

export type Period = 'today' | 'all';

interface LeaderboardProps {
  mode: Mode;
  period: Period;
  refreshMs?: number;
  large?: boolean;
}

export function Leaderboard({ mode, period, refreshMs, large = false }: LeaderboardProps) {
  const { d } = useI18n();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const params = new URLSearchParams({ mode });
      if (period === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        params.set('since', start.toISOString());
      }
      try {
        const res = await fetch(`/api/leaderboard?${params}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { rows: LeaderboardRow[] };
        if (!cancelled) {
          setRows(data.rows);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    setRows(null);
    void load();
    const id = refreshMs ? window.setInterval(load, refreshMs) : undefined;
    return () => {
      cancelled = true;
      if (id) window.clearInterval(id);
    };
  }, [mode, period, refreshMs]);

  if (!rows) {
    return <p className="text-sm text-[var(--muted)]">{failed ? d.results.failedToLoad : d.common.loading}</p>;
  }
  if (rows.length === 0) return <p className="text-sm text-[var(--muted)]">{d.results.empty}</p>;

  return (
    <table className={`w-full table-fixed ${large ? 'text-2xl' : 'text-sm'}`}>
      <thead>
        <tr className="text-left text-[var(--muted)]">
          <th className="w-[2.5em] py-1">#</th>
          <th className="py-1">{d.results.colNick}</th>
          <th className="w-[4em] py-1 text-right">{d.results.colScore}</th>
          <th className="w-[4.5em] py-1 text-right">{d.results.colTime}</th>
          <th className="w-[3em] py-1 text-right">№</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.nickname}-${r.createdAt}`} className="border-t border-[var(--line)]">
            <td className="py-1">{i + 1}</td>
            <td className="truncate py-1">
              {r.passed ? '' : '⛔ '}
              {r.nickname}
            </td>
            <td className="py-1 text-right font-semibold tabular-nums">{r.score}</td>
            <td className="py-1 text-right tabular-nums">{formatRemaining(r.durationSec)}</td>
            <td className="py-1 text-right" title={d.results.colScenario}>
              {getScenario(r.scenarioId)?.number ?? '–'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
