/**
 * AgriDOST 4.0: TinyFish Integration Health & Provenance Evaluator
 * Complies with AgriDOST IntegrationHealthResponse standard contract.
 */

import { IntegrationHealthResponse } from '@/types/integrations';
import { defaultTinyFishClient, TinyFishClient } from './client';
import { tinySearchCache, tinyFetchCache, tinyResearchCache } from './cache';

export async function getTinyFishHealth(
  client: TinyFishClient = defaultTinyFishClient
): Promise<IntegrationHealthResponse> {
  const timestamp = new Date().toISOString();
  const isConfigured = client.isConfigured();
  const isEnabled = client.isLiveReady();

  // If not configured
  if (!isConfigured) {
    return {
      provider: 'tinyfish',
      displayName: 'TinyFish Web Intelligence',
      category: 'web-intelligence',
      configurationStatus: 'unconfigured',
      connectivityStatus: 'offline',
      operatingMode: 'NOT_CONFIGURED',
      lastSuccessfulCheck: null,
      lastError: null,
      featuresSupported: [
        'Live Agricultural Web Search (TinySearch)',
        'JavaScript Content Extraction (TinyFetch)',
        'Controlled Browser Research (TinyAgent)',
        'Official Source Domain Grounding',
        'Deterministic Offline Agricultural Fallback',
      ],
      diagnosticDetails: {
        message: 'TINYFISH_API_KEY not configured. Operating in verified deterministic offline agronomic mode.',
        cacheSize: tinySearchCache.size() + tinyFetchCache.size() + tinyResearchCache.size(),
      },
    };
  }

  // If configured but disabled by flag (TINYFISH_ENABLED=false)
  if (!isEnabled) {
    return {
      provider: 'tinyfish',
      displayName: 'TinyFish Web Intelligence',
      category: 'web-intelligence',
      configurationStatus: 'configured',
      connectivityStatus: 'offline',
      operatingMode: 'SIMULATED',
      lastSuccessfulCheck: timestamp,
      lastError: null,
      featuresSupported: [
        'Live Agricultural Web Search (TinySearch)',
        'JavaScript Content Extraction (TinyFetch)',
        'Controlled Browser Research (TinyAgent)',
        'Official Source Domain Grounding',
        'High-Fidelity Agronomic Simulation',
      ],
      diagnosticDetails: {
        message: 'TINYFISH_API_KEY detected. TINYFISH_ENABLED=false; running in safe local simulation mode.',
        maskedKey: client.getMaskedKey(),
        cacheSize: tinySearchCache.size() + tinyFetchCache.size() + tinyResearchCache.size(),
      },
    };
  }

  // Live Check
  const startTime = Date.now();
  try {
    // Quick test search against Indian agricultural domain
    const searchUrl = `${client.searchBaseUrl}?query=agmarknet+mandi&location=IN&language=en`;
    await client.request(searchUrl, {
      method: 'GET',
      timeoutMs: 8000,
      maxRetries: 1,
    });

    const latencyMs = Date.now() - startTime;

    return {
      provider: 'tinyfish',
      displayName: 'TinyFish Web Intelligence',
      category: 'web-intelligence',
      configurationStatus: 'configured',
      connectivityStatus: 'online',
      operatingMode: 'LIVE',
      lastSuccessfulCheck: timestamp,
      lastError: null,
      latencyMs,
      dataFreshness: {
        timestamp,
        isStale: false,
        source: 'api.search.tinyfish.ai',
        provenance: 'live_api',
      },
      featuresSupported: [
        'Live Agricultural Web Search (TinySearch)',
        'JavaScript Content Extraction (TinyFetch)',
        'Controlled Browser Research (TinyAgent)',
        'Official Source Domain Grounding',
        'Anti-Distress Price Separation',
        'Multi-Tier TTL Cache',
      ],
      diagnosticDetails: {
        maskedKey: client.getMaskedKey(),
        latencyMs,
        searchCacheSize: tinySearchCache.size(),
        fetchCacheSize: tinyFetchCache.size(),
        researchCacheSize: tinyResearchCache.size(),
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - startTime;

    return {
      provider: 'tinyfish',
      displayName: 'TinyFish Web Intelligence',
      category: 'web-intelligence',
      configurationStatus: 'configured',
      connectivityStatus: 'degraded',
      operatingMode: 'SIMULATED',
      lastSuccessfulCheck: null,
      lastError: message,
      latencyMs,
      featuresSupported: [
        'Deterministic Offline Agricultural Fallback',
        'In-Memory TTL Caching',
      ],
      diagnosticDetails: {
        maskedKey: client.getMaskedKey(),
        error: message,
        fallbackActive: true,
      },
    };
  }
}
