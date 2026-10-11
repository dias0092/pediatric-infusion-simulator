import { afterEach, describe, expect, it, vi } from 'vitest';
import { addHistory, HISTORY_LIMIT, readHistory, type HistoryItem } from './history';
import { createOutbox, type ResultPayload } from './outbox';
import { seededShuffle } from './shuffle';
import { KEYS, localKV, memoryKV, readJson } from './storage';

const payload = (id: string): ResultPayload => ({
  id,
  nickname: 'Тест',
  scenarioId: 's1-paracetamol',
  mode: 'learning',
  locale: 'ru',
  appVersion: '1.0.0',
  events: [],
});

describe('storage', () => {
  it('falls back on missing or broken JSON', () => {
    const kv = memoryKV();
    expect(readJson(kv, 'x', 42)).toBe(42);
    kv.set('x', '{broken');
    expect(readJson(kv, 'x', 42)).toBe(42);
  });
});

describe('localKV', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps values in memory when localStorage throws, so queued results still get sent', async () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('SecurityError'); },
        setItem: () => { throw new Error('QuotaExceededError'); },
      },
    });
    localKV.set('k1', 'v');
    expect(localKV.get('k1')).toBe('v');

    const sender = vi.fn(async () => ({ status: 201 }));
    const outbox = createOutbox(localKV, sender);
    outbox.enqueue(payload('fallback-1'));
    expect(await outbox.flush()).toEqual({ 'fallback-1': 'sent' });
    expect(sender).toHaveBeenCalledTimes(1);
    expect(outbox.pending()).toEqual([]);
  });

  it('falls back to memory when the localStorage getter itself throws', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('SecurityError');
      },
    });
    localKV.set('k2', 'v');
    expect(localKV.get('k2')).toBe('v');
  });

  it('reads and writes localStorage when it works', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    });
    localKV.set('k3', 'v');
    expect(store.get('k3')).toBe('v');
    expect(localKV.get('k3')).toBe('v');
  });

  it('replaces a value kept in memory once localStorage works again', () => {
    let broken = true;
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => {
          if (broken) throw new Error('SecurityError');
          return store.get(key) ?? null;
        },
        setItem: (key: string, value: string) => {
          if (broken) throw new Error('QuotaExceededError');
          store.set(key, value);
        },
      },
    });
    localKV.set('k4', 'old');
    broken = false;
    localKV.set('k4', 'new');
    expect(store.get('k4')).toBe('new');
    expect(localKV.get('k4')).toBe('new');
  });

  it('stores nothing on the server, where there is no window', () => {
    expect(localKV.get('k5')).toBeNull();
    expect(() => localKV.set('k5', 'v')).not.toThrow();
    expect(localKV.get('k5')).toBeNull();
    // A server-side write must not reach the in-memory fallback, or it would leak into later reads.
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {} } });
    expect(localKV.get('k5')).toBeNull();
  });
});

describe('history', () => {
  const item = (id: string): HistoryItem => ({
    id, scenarioId: 's1-paracetamol', mode: 'exam', score: 90, passed: true, durationSec: 120, createdAt: '2026-10-08T10:00:00Z',
  });

  it('keeps the newest first, without duplicates, up to the limit', () => {
    const kv = memoryKV();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) addHistory(kv, item(`a${i}`));
    addHistory(kv, item('a54'));
    const list = readHistory(kv);
    expect(list).toHaveLength(HISTORY_LIMIT);
    expect(list[0].id).toBe('a54');
    expect(list.filter((h) => h.id === 'a54')).toHaveLength(1);
  });
});

describe('outbox', () => {
  it('deduplicates by id', () => {
    const outbox = createOutbox(memoryKV(), async () => ({ status: 201 }));
    outbox.enqueue(payload('a'));
    outbox.enqueue(payload('a'));
    expect(outbox.pending()).toHaveLength(1);
  });

  it('drops sent and rejected results, keeps the rest for later', async () => {
    const statuses: Record<string, number | 'throw'> = { ok: 201, dup: 200, bad: 400, down: 503, offline: 'throw' };
    const kv = memoryKV();
    const outbox = createOutbox(kv, async (p) => {
      const s = statuses[p.id];
      if (s === 'throw') throw new TypeError('Failed to fetch');
      return { status: s };
    });
    Object.keys(statuses).forEach((id) => outbox.enqueue(payload(id)));
    const outcomes = await outbox.flush();
    expect(outcomes).toEqual({ ok: 'sent', dup: 'sent', bad: 'rejected', down: 'queued', offline: 'queued' });
    expect(outbox.pending().map((p) => p.id)).toEqual(['down', 'offline']);
    expect(readJson(kv, KEYS.outbox, [])).toHaveLength(2);
  });

  it('keeps results queued while a flush is running', async () => {
    const kv = memoryKV();
    let release: () => void = () => {};
    const outbox = createOutbox(kv, () => new Promise((resolve) => { release = () => resolve({ status: 201 }); }));
    outbox.enqueue(payload('first'));
    const flushing = outbox.flush();
    outbox.enqueue(payload('second'));
    release();
    await flushing;
    expect(outbox.pending().map((p) => p.id)).toEqual(['second']);
  });
});

describe('seededShuffle', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('is a deterministic permutation', () => {
    const once = seededShuffle(items, 's1-paracetamol');
    expect(seededShuffle(items, 's1-paracetamol')).toEqual(once);
    expect([...once].sort()).toEqual(items);
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('depends on the seed', () => {
    const orders = ['a', 'b', 'c'].map((seed) => seededShuffle(items, seed).join(''));
    expect(new Set(orders).size).toBeGreaterThan(1);
  });
});
