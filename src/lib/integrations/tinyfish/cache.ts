/**
 * AgriDOST 4.0: High-Performance Memory TTL Cache for TinyFish AI
 * Prevents redundant paid upstream API requests and guarantees sub-millisecond
 * cached responses for identical agricultural research queries.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  retrievedAt: string;
  hits: number;
}

export class TinyFishCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;

  constructor(defaultTtlMs: number = 15 * 60 * 1000, maxEntries: number = 500) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
  }

  /**
   * Generates a deterministic cache key from parameters.
   */
  public generateKey(prefix: string, params: Record<string, unknown>): string {
    const sorted = Object.keys(params)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const val = params[key];
        if (val !== undefined && val !== null) {
          acc[key] = val;
        }
        return acc;
      }, {});
    return `${prefix}:${JSON.stringify(sorted)}`;
  }

  /**
   * Retrieves an entry if present and not expired.
   */
  public get<T>(key: string): { data: T; retrievedAt: string; cached: true } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    entry.hits += 1;
    return {
      data: entry.data as T,
      retrievedAt: entry.retrievedAt,
      cached: true,
    };
  }

  /**
   * Stores an entry with given or default TTL.
   */
  public set<T>(key: string, data: T, ttlMs?: number): void {
    // Evict oldest if capacity exceeded
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    const effectiveTtl = ttlMs ?? this.defaultTtlMs;
    this.store.set(key, {
      data,
      expiresAt: Date.now() + effectiveTtl,
      retrievedAt: new Date().toISOString(),
      hits: 0,
    });
  }

  public delete(key: string): boolean {
    return this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }

  public size(): number {
    return this.store.size;
  }
}

// Global singleton cache instances
export const tinySearchCache = new TinyFishCache(15 * 60 * 1000, 300); // 15 mins for search
export const tinyFetchCache = new TinyFishCache(30 * 60 * 1000, 200);  // 30 mins for fetch
export const tinyResearchCache = new TinyFishCache(15 * 60 * 1000, 300); // 15 mins for domain research
