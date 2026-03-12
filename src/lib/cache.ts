/**
 * Simple TTL cache for low-volatility data.
 * Avoids re-fetching topics, questions, and subject slugs on every navigation.
 */

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const store = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > DEFAULT_TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, ts: Date.now() });
}

export function invalidateCache(key?: string): void {
  if (key) {
    store.delete(key);
  } else {
    store.clear();
  }
}

/** Fetch-with-cache: returns cached data if fresh, otherwise calls fetcher and caches result. */
export async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) {
    console.log(`[Cache] HIT: ${key}`);
    return cached;
  }
  console.log(`[Cache] MISS: ${key} — fetching...`);
  const data = await fetcher();
  setCache(key, data);
  return data;
}

// Well-known cache keys
export const CACHE_KEYS = {
  TOPICS: 'topics_active',
  QUESTION_BANK: 'question_bank',
  ALLOWED_SLUGS: (userId: string) => `allowed_slugs_${userId}`,
} as const;
