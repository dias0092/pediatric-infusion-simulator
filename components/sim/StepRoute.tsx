'use client';

import type { Session } from '@/lib/engine/session';
import { ROUTE_IDS, type RouteId } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';
import { Card } from '../ui';

export function StepRoute({ session, onSelect }: { session: Session; onSelect: (routeId: RouteId) => void }) {
  const { d } = useI18n();
  const { scenario, mode, route } = session;
  const correct = scenario.acceptableRoutes.find((r) => scenario.patient.accesses.includes(r));
  const reveal = mode === 'learning' && route.attempts >= 3 && route.correctAt === null;
  return (
    <Card className="space-y-2">
      <h2 className="font-semibold">{d.steps.route}</h2>
      {ROUTE_IDS.map((id) => {
        const wrong = mode === 'learning' && route.selectedId === id && id !== correct;
        return (
          <button
            key={id}
            type="button"
            className={`choice ${wrong ? 'is-wrong' : ''} ${reveal && id === correct ? 'is-reveal' : ''}`}
            onClick={() => onSelect(id)}
          >
            {d.routes[id]}
          </button>
        );
      })}
    </Card>
  );
}
