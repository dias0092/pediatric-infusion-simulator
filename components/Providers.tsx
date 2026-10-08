'use client';

import { useEffect, type ReactNode } from 'react';
import { browserOutbox } from '@/lib/client/outbox';
import { I18nProvider } from './I18nProvider';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const flush = () => void browserOutbox.flush();
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);
  return <I18nProvider>{children}</I18nProvider>;
}
