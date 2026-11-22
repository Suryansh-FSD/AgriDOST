/**
 * AgriDOST 4.0: TinySearch Live Agricultural Web Search
 * Discovers live government scheme announcements, agricultural research,
 * and mandi market updates with source classification and caching.
 */

import { TinyFishClient, defaultTinyFishClient } from './client';
import { TinySearchOptions, TinySearchResponse } from './types';
import { TinySearchRequestSchema, TinySearchResponseSchema } from './schemas';
import { tinySearchCache } from './cache';
import { classifySource } from './security';
import { getOfflineSearchResults } from './offline';

export interface EnrichedTinySearchResultItem {
  position: number;
  title: string;
  url: string;
  snippet: string;
  site_name: string;
  date?: string;
  sourceClassification: ReturnType<typeof classifySource>['classification'];
  isOfficial: boolean;
}

export interface EnrichedTinySearchResponse {
  query: string;
  results: EnrichedTinySearchResultItem[];
  total_results: number;
  page: number;
  cached: boolean;
  retrievedAt: string;
  provenance: 'live_api' | 'cached_remote' | 'offline_deterministic';
}

/**
 * Executes a live agricultural search using TinyFish Search API.
 * Falls back to deterministic agronomic search if API key is missing or offline.
 */
export async function executeTinySearch(
  options: TinySearchOptions,
  client: TinyFishClient = defaultTinyFishClient
): Promise<EnrichedTinySearchResponse> {
  const validated = TinySearchRequestSchema.parse(options);
  const cacheKey = tinySearchCache.generateKey('search', validated);

  // Check cache first
  if (!validated.bypassCache) {
    const cached = tinySearchCache.get<EnrichedTinySearchResponse>(cacheKey);
    if (cached) {
      return {
        ...cached.data,
        cached: true,
        provenance: 'cached_remote',
      };
    }
  }

  // If client is not configured or in simulated mode, use high-fidelity offline agronomic search
  if (!client.isConfigured() || process.env.TINYFISH_SIMULATED_MODE === 'true') {
    const fallback = getOfflineSearchResults(validated.query);
    return {
      query: validated.query,
      results: fallback.results.map((r, i) => {
        const sourceMeta = classifySource(r.url);
        return {
          position: i + 1,
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          site_name: sourceMeta.domain,
          date: r.date,
          sourceClassification: sourceMeta.classification,
          isOfficial: sourceMeta.isOfficial,
        };
      }),
      total_results: fallback.results.length,
      page: 0,
      cached: false,
      retrievedAt: new Date().toISOString(),
      provenance: 'offline_deterministic',
    };
  }

  // Build query string
  const url = new URL(client.searchBaseUrl);
  url.searchParams.set('query', validated.query);
  url.searchParams.set('location', validated.location || 'IN');
  url.searchParams.set('language', validated.language || 'en');

  if (validated.include_domains && validated.include_domains.length > 0) {
    url.searchParams.set('include_domains', validated.include_domains.join(','));
  }
  if (validated.exclude_domains && validated.exclude_domains.length > 0) {
    url.searchParams.set('exclude_domains', validated.exclude_domains.join(','));
  }
  if (validated.recency_minutes) {
    url.searchParams.set('recency_minutes', String(validated.recency_minutes));
  }
  if (validated.after_date) {
    url.searchParams.set('after_date', validated.after_date);
  }

  const rawResponse = await client.request<TinySearchResponse>(url.toString(), {
    method: 'GET',
    timeoutMs: options.timeoutMs ?? 10000,
  });

  const parsed = TinySearchResponseSchema.parse(rawResponse);
  const retrievedAt = new Date().toISOString();

  const enrichedResults: EnrichedTinySearchResultItem[] = parsed.results.map((item) => {
    const sourceMeta = classifySource(item.url);
    return {
      position: item.position,
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      site_name: item.site_name || sourceMeta.domain,
      date: item.date,
      sourceClassification: sourceMeta.classification,
      isOfficial: sourceMeta.isOfficial,
    };
  });

  const response: EnrichedTinySearchResponse = {
    query: parsed.query,
    results: enrichedResults,
    total_results: parsed.total_results || enrichedResults.length,
    page: parsed.page || 0,
    cached: false,
    retrievedAt,
    provenance: 'live_api',
  };

  // Cache response for 15 minutes
  tinySearchCache.set(cacheKey, response);

  return response;
}
