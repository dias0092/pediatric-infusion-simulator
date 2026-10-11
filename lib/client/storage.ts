export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/**
 * Values that localStorage refused (blocked site data, private mode, quota exceeded). They last for this
 * page session only, so the app keeps working and just forgets after a reload.
 */
const memory = new Map<string, string>();

/** localStorage with an in-memory fallback (spec §9). The server stores nothing, so nothing leaks between requests. */
export const localKV: KV = {
  get(key) {
    if (typeof window === 'undefined') return null;
    const kept = memory.get(key);
    if (kept !== undefined) return kept;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
      memory.delete(key);
    } catch {
      memory.set(key, value);
    }
  },
};

export function memoryKV(): KV {
  const map = new Map<string, string>();
  return { get: (key) => map.get(key) ?? null, set: (key, value) => void map.set(key, value) };
}

export function readJson<T>(kv: KV, key: string, fallback: T): T {
  const raw = kv.get(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(kv: KV, key: string, value: unknown): void {
  kv.set(key, JSON.stringify(value));
}

export const KEYS = {
  nickname: 'pis.nickname',
  locale: 'pis.locale',
  sound: 'pis.sound',
  history: 'pis.history',
  outbox: 'pis.outbox',
} as const;
