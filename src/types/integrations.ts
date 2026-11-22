/**
 * AgriDOST 4.0: Standard External Integration Health & Provenance Contracts
 * Shared interface required across all 6 external integrations:
 * Supabase, Gemini, Weather (Open-Meteo), Market (data.gov.in), Telegram, Google Maps.
 */

export type IntegrationOperatingMode =
  | 'LIVE'
  | 'SIMULATED'
  | 'OFFLINE'
  | 'NOT_CONFIGURED'
  | 'ERROR';

export type ConfigurationStatus =
  | 'configured'
  | 'unconfigured'
  | 'partial';

export type ConnectivityStatus =
  | 'online'
  | 'offline'
  | 'unreachable'
  | 'degraded';

export interface DataFreshnessMetadata {
  timestamp?: string;
  ageSeconds?: number;
  isStale?: boolean;
  source?: string;
  provenance?: 'live_api' | 'cached_remote' | 'simulated_fallback' | 'offline_deterministic';
}

export interface IntegrationHealthResponse {
  provider: string; // e.g., 'supabase', 'gemini', 'open-meteo', 'data.gov.in', 'telegram', 'google-maps', 'n8n'
  displayName: string;
  category: 'database' | 'ai' | 'weather' | 'market' | 'messaging' | 'geospatial' | 'automation' | 'web-intelligence';
  configurationStatus: ConfigurationStatus;
  connectivityStatus: ConnectivityStatus;
  operatingMode: IntegrationOperatingMode;
  lastSuccessfulCheck: string | null;
  lastError: string | null;
  latencyMs?: number;
  dataFreshness?: DataFreshnessMetadata;
  featuresSupported?: string[];
  diagnosticDetails?: Record<string, unknown>;
}

export interface MasterIntegrationStatusReport {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'offline';
  integrations: Record<string, IntegrationHealthResponse>;
  environment: {
    nodeEnv: string;
    hasSupabase: boolean;
    hasGemini: boolean;
    hasGoogleMaps: boolean;
    hasTelegram: boolean;
    hasDataGov: boolean;
    hasTinyFish?: boolean;
  };
}
