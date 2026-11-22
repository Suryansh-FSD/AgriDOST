/**
 * AgriDOST 4.0: Supabase Health & Diagnostics Service
 * Implements the standard IntegrationHealthResponse contract for Supabase
 * Supporting states: LIVE, SIMULATED, OFFLINE, NOT_CONFIGURED, ERROR.
 */

import {
  IntegrationHealthResponse,
  IntegrationOperatingMode,
  ConfigurationStatus,
  ConnectivityStatus,
} from '@/types/integrations';
import { getSupabaseConfigStatus, checkSupabaseHealth, extractProjectRef } from './client';

export interface SupabaseHealthOptions {
  url?: string;
  anonKey?: string;
  timeoutMs?: number;
}

/**
 * Returns complete integration health report adhering to standard AgriDOST 4.0 contract.
 */
export async function getSupabaseHealth(
  options?: SupabaseHealthOptions
): Promise<IntegrationHealthResponse> {
  const timestamp = new Date().toISOString();
  const config = getSupabaseConfigStatus(options);
  const projectRef = config.projectRef || extractProjectRef(config.supabaseUrl, options?.anonKey);

  // 1. Unconfigured check
  if (!config.isConfigured || !config.supabaseUrl) {
    return {
      provider: 'supabase',
      displayName: 'Supabase Cloud Database & RLS',
      category: 'database',
      configurationStatus: 'unconfigured',
      connectivityStatus: 'offline',
      operatingMode: 'NOT_CONFIGURED',
      lastSuccessfulCheck: null,
      lastError: 'Supabase URL/Key unconfigured. System running in 100% functional LocalStorage offline mode.',
      latencyMs: 0,
      dataFreshness: {
        timestamp,
        ageSeconds: 0,
        isStale: false,
        source: 'local_storage',
        provenance: 'offline_deterministic',
      },
      featuresSupported: [
        'LocalStorage Offline Engine',
        'Persistent In-Memory Cache',
        'Client-Side RLS Emulator',
        'Offline Mutation Queue',
      ],
      diagnosticDetails: {
        isConfigured: false,
        urlConfigured: config.urlConfigured,
        keyConfigured: config.keyConfigured,
        mode: 'offline_local',
        message: config.message,
      },
    };
  }

  // 2. Active Connectivity Probe with Latency & Schema Audit
  const startTime = Date.now();
  try {
    const rawHealth = await checkSupabaseHealth(options);
    const latency = rawHealth.latencyMs ?? (Date.now() - startTime);

    // Determine Operating Mode
    let operatingMode: IntegrationOperatingMode;
    let connectivityStatus: ConnectivityStatus;
    let lastError: string | null = null;

    if (rawHealth.online) {
      if (rawHealth.schemaTablesReady) {
        // Fully Live: Both Auth Gateway and Database Schema Cache are ready
        operatingMode = 'LIVE';
        connectivityStatus = 'online';
      } else {
        // Connected to GoTrue Auth gateway, but PostgREST tables pending migration
        operatingMode = 'SIMULATED';
        connectivityStatus = 'online';
        lastError = 'PostgREST tables pending migration. Seamlessly operating via LocalStorage fallback.';
      }
    } else {
      if (rawHealth.statusCode && rawHealth.statusCode >= 500) {
        operatingMode = 'ERROR';
        connectivityStatus = 'degraded';
        lastError = rawHealth.message;
      } else {
        operatingMode = 'OFFLINE';
        connectivityStatus = 'unreachable';
        lastError = rawHealth.message;
      }
    }

    return {
      provider: 'supabase',
      displayName: 'Supabase Cloud Database & RLS',
      category: 'database',
      configurationStatus: 'configured' as ConfigurationStatus,
      connectivityStatus,
      operatingMode,
      lastSuccessfulCheck: rawHealth.online ? timestamp : null,
      lastError,
      latencyMs: latency,
      dataFreshness: {
        timestamp,
        ageSeconds: 0,
        isStale: false,
        source: rawHealth.online ? `supabase_cloud:${projectRef || 'default'}` : 'local_storage_cache',
        provenance: rawHealth.online
          ? (rawHealth.schemaTablesReady ? 'live_api' : 'simulated_fallback')
          : 'offline_deterministic',
      },
      featuresSupported: [
        'PostgreSQL Core Schema (farms, zones, plans, health, tasks, supplies, spray, profiles)',
        'Row Level Security (Tenant Isolation auth.uid() = farmer_id)',
        'Bidirectional Sync Engine',
        'Last-Write-Wins Conflict Resolution',
        'Persistent Offline Mutation Queue',
        'GoTrue Auth Gateway Readiness',
      ],
      diagnosticDetails: {
        projectRef: projectRef || null,
        authGatewayReady: rawHealth.authGatewayReady,
        schemaTablesReady: rawHealth.schemaTablesReady,
        httpStatusCode: rawHealth.statusCode || (rawHealth.online ? 200 : 0),
        message: rawHealth.message,
        environmentUrl: config.supabaseUrl,
      },
    };
  } catch (err: unknown) {
    const latency = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    return {
      provider: 'supabase',
      displayName: 'Supabase Cloud Database & RLS',
      category: 'database',
      configurationStatus: 'configured',
      connectivityStatus: 'unreachable',
      operatingMode: 'OFFLINE',
      lastSuccessfulCheck: null,
      lastError: `Connection exception: ${errorMessage}`,
      latencyMs: latency,
      dataFreshness: {
        timestamp,
        ageSeconds: 0,
        isStale: true,
        source: 'local_storage',
        provenance: 'offline_deterministic',
      },
      featuresSupported: [
        'LocalStorage Offline Engine',
        'Persistent In-Memory Cache',
        'Offline Mutation Queue',
      ],
      diagnosticDetails: {
        projectRef,
        error: errorMessage,
        mode: 'offline_local_fallback',
      },
    };
  }
}
