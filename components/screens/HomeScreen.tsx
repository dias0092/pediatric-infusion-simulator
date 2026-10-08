'use client';

import { createPump, type PumpState } from '@/lib/engine/pump';
import { useI18n } from '../I18nProvider';
import { Pump } from '../Pump/Pump';
import { LinkButton, Page } from '../ui';

/** A programmed pump for the home page picture: 100 ml/h, 50 ml, 0:30. */
const DEMO: PumpState = { ...createPump(), status: 'program', rateTenths: 1000, vtbiTenths: 500 };

export function HomeScreen() {
  const { d } = useI18n();
  return (
    <Page>
      <div className="mx-auto max-w-md space-y-5 pt-2 text-center">
        <div>
          <h2 className="text-2xl font-bold">{d.appName}</h2>
          <p className="text-[var(--muted)]">{d.appSubtitle}</p>
        </div>
        <Pump state={DEMO} drugLabel="DEMO" progress={0} />
        <p className="text-sm">{d.home.tagline}</p>
        <div className="grid gap-3">
          <LinkButton href="/scenarios?mode=learning">{d.home.start}</LinkButton>
          <LinkButton href="/scenarios?mode=exam" variant="secondary">
            {d.home.exam}
          </LinkButton>
          <div className="grid grid-cols-2 gap-3">
            <LinkButton href="/learn" variant="secondary">
              {d.home.learn}
            </LinkButton>
            <LinkButton href="/results" variant="secondary">
              {d.home.results}
            </LinkButton>
          </div>
        </div>
        <p className="text-xs font-medium text-[var(--warn)]">{d.disclaimer}</p>
      </div>
    </Page>
  );
}
