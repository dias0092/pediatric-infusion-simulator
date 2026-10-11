'use client';

import { useState, type FormEvent } from 'react';
import { KEYS, localKV } from '@/lib/client/storage';
import { validateNickname } from '@/lib/nickname';
import { useI18n } from './I18nProvider';

/** The saved nickname, or null when there is none or it no longer passes validation. */
export function readNickname(): string | null {
  const saved = localKV.get(KEYS.nickname);
  if (!saved) return null;
  const check = validateNickname(saved);
  return check.ok ? check.value : null;
}

export function saveNickname(value: string): void {
  localKV.set(KEYS.nickname, value);
}

export function NicknameDialog({ initial = '', onSave, onCancel }: { initial?: string; onSave: (nickname: string) => void; onCancel?: () => void }) {
  const { d } = useI18n();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const check = validateNickname(value);
    if (!check.ok) {
      setError(d.nickname.errors[check.reason]);
      return;
    }
    saveNickname(check.value);
    onSave(check.value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="nickname-title">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3">
        <h2 id="nickname-title" className="text-lg font-semibold">
          {d.nickname.title}
        </h2>
        <label htmlFor="nickname" className="block text-sm font-medium">
          {d.nickname.label}
        </label>
        <input
          id="nickname"
          className="field"
          value={value}
          maxLength={20}
          autoFocus
          autoComplete="nickname"
          placeholder={d.nickname.placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        {error ? (
          <p className="text-sm text-[var(--bad)]" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-xs text-[var(--muted)]">{d.nickname.notice}</p>
        )}
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" className="btn btn-secondary flex-1" onClick={onCancel}>
              {d.common.back}
            </button>
          )}
          <button type="submit" className="btn btn-primary flex-1">
            {d.nickname.save}
          </button>
        </div>
      </form>
    </div>
  );
}
