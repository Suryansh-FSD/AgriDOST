/**
 * AgriDOST 4.0: Agro-Climatic Weather Cache & Freshness Management
 * 
 * Provides an in-memory cache with optional LocalStorage persistence (in browser context),
 * enforcing a 15-minute TTL to comply with Open-Meteo fair-use policies (<10,000 requests/day).
 * Tracks detailed data provenance and staleness indicators.
 */

import { DataFreshnessMetadata } from '@/types/integrations';
import { FarmWeatherResponse } from '@/types/weather';

export const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes = 900,000 ms
const LOCALSTORAGE_PREFIX = 'agridost_weather_cache_';

interface CacheEntry {
  data: FarmWeatherResponse;
  cachedAt: number; // Unix epoch ms
}

// In-memory cache store
const memoryCache = new Map<string, CacheEntry>();

/**
 * Standardizes coordinate cache keys by rounding to 2 decimal places (~1.1 km precision)
 * E.g., lat: 19.997, lon: 73.784 => "20.00_73.78"
 */
export function getWeatherCacheKey(latitude: number, longitude: number): string {
  const normLat = Number(latitude).toFixed(2);
  const normLon = Number(longitude).toFixed(2);
  return `${normLat}_${normLon}`;
}

/**
 * Helper to compute DataFreshnessMetadata
 */
export function createFreshnessMetadata(
  cachedAt: number,
  source = 'open-meteo',
  provenance: DataFreshnessMetadata['provenance'] = 'live_api'
): DataFreshnessMetadata {
  const now = Date.now();
  const ageSeconds = Math.max(0, Math.floor((now - cachedAt) / 1000));
  const isStale = now - cachedAt > WEATHER_CACHE_TTL_MS;

  return {
    timestamp: new Date(cachedAt).toISOString(),
    ageSeconds,
    isStale,
    source,
    provenance,
  };
}

/**
 * Retrieves cached weather data if present.
 * Returns null if not found or if expired (unless ignoreExpiration is true).
 */
export function getCachedWeather(
  latitude: number,
  longitude: number,
  options?: { allowStale?: boolean }
): { data: FarmWeatherResponse; ageSeconds: number; isStale: boolean } | null {
  const key = getWeatherCacheKey(latitude, longitude);
  const now = Date.now();

  let entry: CacheEntry | undefined = memoryCache.get(key);

  // If not found in memory, attempt reading from LocalStorage if in browser environment
  if (!entry && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(`${LOCALSTORAGE_PREFIX}${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry;
        if (parsed && parsed.data && parsed.cachedAt) {
          entry = parsed;
          // Hydrate memory cache
          memoryCache.set(key, entry);
        }
      }
    } catch {
      // LocalStorage access issues (e.g. private browsing or disabled cookies) ignored safely
    }
  }

  if (!entry) {
    return null;
  }

  const ageMs = now - entry.cachedAt;
  const ageSeconds = Math.floor(ageMs / 1000);
  const isStale = ageMs > WEATHER_CACHE_TTL_MS;

  if (isStale && !options?.allowStale) {
    return null;
  }

  // Update freshness on returned payload
  const updatedData: FarmWeatherResponse = {
    ...entry.data,
    freshness: {
      ...entry.data.freshness,
      ageSeconds,
      isStale,
      provenance: isStale ? 'simulated_fallback' : 'cached_remote',
    },
  };

  return {
    data: updatedData,
    ageSeconds,
    isStale,
  };
}

/**
 * Stores weather data into memory and LocalStorage cache with timestamp
 */
export function setCachedWeather(
  latitude: number,
  longitude: number,
  data: FarmWeatherResponse
): void {
  const key = getWeatherCacheKey(latitude, longitude);
  const entry: CacheEntry = {
    data,
    cachedAt: Date.now(),
  };

  memoryCache.set(key, entry);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        `${LOCALSTORAGE_PREFIX}${key}`,
        JSON.stringify(entry)
      );
    } catch {
      // Ignore quota exceeded or storage blocked errors gracefully
    }
  }
}

/**
 * Flushes all cached entries (useful for testing and manual resets)
 */
export function clearWeatherCache(): void {
  memoryCache.clear();

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(LOCALSTORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        window.localStorage.removeItem(k);
      }
    } catch {
      // Ignore
    }
  }
}
