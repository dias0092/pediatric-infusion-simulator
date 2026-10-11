import type { Locale, Mode, SimEvent } from '../engine/types';
import { KEYS, localKV, readJson, writeJson, type KV } from './storage';

export interface ResultPayload {
  id: string;
  nickname: string;
  scenarioId: string;
  mode: Mode;
  locale: Locale;
  appVersion: string;
  events: SimEvent[];
}

export type Sender = (payload: ResultPayload) => Promise<{ status: number }>;
export type FlushOutcome = 'sent' | 'queued' | 'rejected';

export function createOutbox(kv: KV, send: Sender) {
  const read = (): ResultPayload[] => {
    const list = readJson<unknown>(kv, KEYS.outbox, []);
    return Array.isArray(list) ? (list as ResultPayload[]) : [];
  };

  return {
    pending: read,

    enqueue(payload: ResultPayload): void {
      const list = read();
      if (!list.some((p) => p.id === payload.id)) writeJson(kv, KEYS.outbox, [...list, payload]);
    },

    /** Sends every queued result: 2xx → sent, 4xx → rejected (dropped), 5xx or network error → stays queued. */
    async flush(): Promise<Record<string, FlushOutcome>> {
      const outcomes: Record<string, FlushOutcome> = {};
      for (const payload of read()) {
        try {
          const { status } = await send(payload);
          outcomes[payload.id] = status >= 500 ? 'queued' : status >= 400 ? 'rejected' : 'sent';
        } catch {
          outcomes[payload.id] = 'queued';
        }
      }
      const finished = new Set(Object.keys(outcomes).filter((id) => outcomes[id] !== 'queued'));
      writeJson(kv, KEYS.outbox, read().filter((p) => !finished.has(p.id)));
      return outcomes;
    },
  };
}

export type Outbox = ReturnType<typeof createOutbox>;

export const postResult: Sender = async (payload) => {
  const res = await fetch('/api/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status };
};

export const browserOutbox: Outbox = createOutbox(localKV, postResult);
