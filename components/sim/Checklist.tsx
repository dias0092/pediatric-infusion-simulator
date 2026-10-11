'use client';

import { useState } from 'react';
import { useI18n } from '../I18nProvider';

export function Checklist({ done, onComplete }: { done: boolean; onComplete: () => void }) {
  const { d } = useI18n();
  const [checked, setChecked] = useState<boolean[]>(() => d.checklist.items.map(() => done));

  const toggle = (index: number) => {
    const next = checked.map((value, i) => (i === index ? !value : value));
    setChecked(next);
    if (!done && next.every(Boolean)) onComplete();
  };

  return (
    <fieldset className="card space-y-2">
      <legend className="px-1 font-semibold">{d.checklist.title}</legend>
      {d.checklist.items.map((item, i) => (
        <label key={i} className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={done || checked[i]} disabled={done} onChange={() => toggle(i)} />
          {item}
        </label>
      ))}
    </fieldset>
  );
}
