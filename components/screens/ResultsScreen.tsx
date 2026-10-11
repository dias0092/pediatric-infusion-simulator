'use client';

import { useEffect, useState } from 'react';
import { readHistory, type HistoryItem } from '@/lib/client/history';
import { localKV } from '@/lib/client/storage';
import type { Mode } from '@/lib/engine/types';
import { getScenario } from '@/lib/scenarios';
import { useI18n } from '../I18nProvider';
import { Leaderboard, type Period } from '../Leaderboard';
import { NicknameDialog, readNickname } from '../NicknameDialog';
import { Card, Page, Segmented } from '../ui';

export function ResultsScreen() {
  const { d, l, locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [nickname, setNickname] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<Mode>('learning');
  const [period, setPeriod] = useState<Period>('today');

  useEffect(() => {
    setMounted(true);
    setHistory(readHistory(localKV));
    setNickname(readNickname());
  }, []);

  const dateLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU';

  return (
    <Page title={d.results.title} back="/">
      <div className="space-y-4">
        <Card className="flex items-center justify-between gap-3">
          <strong className="truncate">{nickname ?? '—'}</strong>
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
            {d.nickname.change}
          </button>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">{d.results.leaderboard}</h2>
          <Segmented value={mode} onChange={setMode} options={[['learning', d.modes.learning], ['exam', d.modes.exam]]} />
          <Segmented value={period} onChange={setPeriod} options={[['today', d.results.today], ['all', d.results.allTime]]} />
          <Leaderboard mode={mode} period={period} refreshMs={15000} />
        </Card>

        <Card className="space-y-2">
          <h2 className="font-semibold">{d.results.mine}</h2>
          {mounted && history.length === 0 && <p className="text-sm text-[var(--muted)]">{d.results.none}</p>}
          <ul className="space-y-1 text-sm">
            {history.map((h) => {
              const scenario = getScenario(h.scenarioId);
              return (
                <li key={h.id} className="flex justify-between gap-2 border-t border-[var(--line)] pt-1">
                  <span className="min-w-0 truncate">
                    {new Date(h.createdAt).toLocaleString(dateLocale, { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
                    {scenario ? `${scenario.number}. ${l(scenario.title)}` : h.scenarioId} · {d.modes[h.mode]}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {h.passed ? '' : '⛔ '}
                    {h.score}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      {editing && (
        <NicknameDialog
          initial={nickname ?? ''}
          onSave={(value) => {
            setNickname(value);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </Page>
  );
}
