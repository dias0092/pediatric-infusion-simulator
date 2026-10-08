'use client';

import { useState, type FormEvent } from 'react';
import type { Mode } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';
import { Page } from '../ui';

interface AdminRow {
  id: string;
  nickname: string;
  scenarioId: string;
  mode: Mode;
  score: number;
  passed: boolean;
  hidden: boolean;
  createdAt: string;
}

export function AdminScreen() {
  const { d } = useI18n();
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const auth = { Authorization: `Bearer ${token}` };

  const load = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/admin/results?limit=50', { headers: auth, cache: 'no-store' });
      if (res.status === 401) {
        setRows(null);
        setError(d.admin.unauthorized);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows(((await res.json()) as { rows: AdminRow[] }).rows);
    } catch {
      setError(d.results.failedToLoad);
    }
  };

  const hide = async (id: string) => {
    const res = await fetch('/api/admin/hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setRows((list) => list?.map((r) => (r.id === id ? { ...r, hidden: true } : r)) ?? null);
  };

  return (
    <Page title={d.admin.title} back="/">
      <form onSubmit={load} className="card mb-4 flex gap-2">
        <input
          type="password"
          aria-label={d.admin.token}
          placeholder={d.admin.token}
          className="field flex-1"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          {d.admin.load}
        </button>
      </form>
      {error && <p className="mb-3 text-[var(--bad)]">{error}</p>}
      {rows && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="card flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <strong>{r.nickname}</strong> · {r.score} {r.passed ? '' : '⛔'} · {r.mode} · {r.scenarioId} ·{' '}
                {new Date(r.createdAt).toLocaleString('ru-RU')}
              </span>
              {r.hidden ? (
                <span className="badge">{d.admin.hidden}</span>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={() => void hide(r.id)}>
                  {d.admin.hide}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
