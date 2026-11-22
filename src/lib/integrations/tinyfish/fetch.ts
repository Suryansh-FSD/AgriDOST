/**
 * AgriDOST 4.0: TinyFetch Web Content Extraction
 * Extracts clean, normalized content from JavaScript-rendered agricultural sites
 * with SSRF protection, prompt-injection defense, and caching.
 */

import { TinyFishClient, defaultTinyFishClient } from './client';
import { TinyFetchOptions, TinyFetchResponse } from './types';
import { TinyFetchRequestSchema, TinyFetchResponseSchema } from './schemas';
import { tinyFetchCache } from './cache';
import { validateSafeUrl, classifySource, sanitizeUntrustedContent } from './security';
import { getOfflineFetchResults } from './offline';

export interface EnrichedTinyFetchResultItem {
  url: string;
  final_url?: string;
  title?: string;
  text: string;
  language?: string;
  sourceClassification: ReturnType<typeof classifySource>['classification'];
  isOfficial: boolean;
  latency_ms?: number;
  format: string;
}

export interface EnrichedTinyFetchResponse {
  results: EnrichedTinyFetchResultItem[];
  errors: Array<{ url: string; error: string }>;
  cached: boolean;
  retrievedAt: string;
  provenance: 'live_api' | 'cached_remote' | 'offline_deterministic';
}

/**
 * Extracts and normalizes webpage contents via TinyFetch.
 */
export async function executeTinyFetch(
  options: TinyFetchOptions,
  client: TinyFishClient = defaultTinyFishClient
): Promise<EnrichedTinyFetchResponse> {
  const validated = TinyFetchRequestSchema.parse(options);

  // Security Check: Validate all target URLs against SSRF
  for (const urlStr of validated.urls) {
    validateSafeUrl(urlStr);
  }

  const cacheKey = tinyFetchCache.generateKey('fetch', validated);

  // Check cache
  if (!validated.bypassCache) {
    const cached = tinyFetchCache.get<EnrichedTinyFetchResponse>(cacheKey);
    if (cached) {
      return {
        ...cached.data,
        cached: true,
        provenance: 'cached_remote',
      };
    }
  }

  // Fallback if not configured or simulated
  if (!client.isConfigured() || process.env.TINYFISH_SIMULATED_MODE === 'true') {
    const fallback = getOfflineFetchResults(validated.urls);
    return {
      results: fallback.results.map((r) => {
        const meta = classifySource(r.url);
        return {
          url: r.url,
          final_url: r.url,
          title: r.title,
          text: sanitizeUntrustedContent(r.text),
          sourceClassification: meta.classification,
          isOfficial: meta.isOfficial,
          format: validated.format || 'markdown',
        };
      }),
      errors: [],
      cached: false,
      retrievedAt: new Date().toISOString(),
      provenance: 'offline_deterministic',
    };
  }

  const rawResponse = await client.request<TinyFetchResponse>(client.fetchBaseUrl, {
    method: 'POST',
    body: {
      urls: validated.urls,
      format: validated.format || 'markdown',
    },
    timeoutMs: options.timeoutMs ?? 20000,
  });

  const parsed = TinyFetchResponseSchema.parse(rawResponse);
  const retrievedAt = new Date().toISOString();

  const enrichedResults: EnrichedTinyFetchResultItem[] = parsed.results.map((item) => {
    const sourceMeta = classifySource(item.url);
    return {
      url: item.url,
      final_url: item.final_url || item.url,
      title: item.title || undefined,
      text: sanitizeUntrustedContent(item.text),
      language: item.language || undefined,
      sourceClassification: sourceMeta.classification,
      isOfficial: sourceMeta.isOfficial,
      latency_ms: item.latency_ms,
      format: item.format || validated.format || 'markdown',
    };
  });

  const response: EnrichedTinyFetchResponse = {
    results: enrichedResults,
    errors: parsed.errors,
    cached: false,
    retrievedAt,
    provenance: 'live_api',
  };

  // Cache for 30 minutes
  tinyFetchCache.set(cacheKey, response);

  return response;
}
