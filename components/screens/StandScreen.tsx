'use client';

import { toDataURL } from 'qrcode';
import { useEffect, useState } from 'react';
import { useI18n } from '../I18nProvider';
import { Leaderboard } from '../Leaderboard';
import { Card, Page } from '../ui';

export function StandScreen() {
  const { d } = useI18n();
  const [origin, setOrigin] = useState('');
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    const url = window.location.origin;
    setOrigin(url);
    toDataURL(url, { width: 640, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, []);

  return (
    <Page wide title={d.appName}>
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_2fr]">
        <Card className="flex flex-col items-center gap-3 text-center">
          <p className="text-xl font-semibold">{d.stand.scan}</p>
          {qr && <img src={qr} alt={origin} className="w-full max-w-sm" />}
          <p className="break-all font-mono text-sm">{origin}</p>
          {qr && (
            <a href={qr} download="pediatric-infusion-simulator-qr.png" className="btn btn-secondary">
              {d.stand.download}
            </a>
          )}
        </Card>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-2 text-xl font-semibold">{d.modes.exam}</h2>
            <Leaderboard mode="exam" period="today" refreshMs={10000} large />
          </Card>
          <Card>
            <h2 className="mb-2 text-xl font-semibold">{d.modes.learning}</h2>
            <Leaderboard mode="learning" period="today" refreshMs={10000} large />
          </Card>
        </div>
      </div>
    </Page>
  );
}
