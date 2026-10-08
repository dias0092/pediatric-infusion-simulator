export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** localStorage may be missing or throw (private mode, blocked site data); the app then just forgets. */
export const localKV: KV = {
  get(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // storage unavailable
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
