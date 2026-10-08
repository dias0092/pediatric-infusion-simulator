'use client';

import { useI18n } from '../I18nProvider';
import { Card, Page } from '../ui';

export function LearnScreen() {
  const { d } = useI18n();
  return (
    <Page title={d.learn.title} back="/">
      <div className="grid gap-3 md:grid-cols-2">
        {d.learn.cards.map((card) => (
          <Card key={card.title}>
            <h2 className="mb-2 font-semibold">{card.title}</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {card.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </Page>
  );
}
