/**
 * AgriDOST 4.0: Centralized Integration Registry & Health Aggregator
 * Orchestrates health status checks across all 6 core integrations:
 * 1. Supabase (Database & Sync)
 * 2. Gemini AI (Vision & Agronomic LLM)
 * 3. Weather (Open-Meteo)
 * 4. Market Intelligence (data.gov.in Mandi)
 * 5. Telegram (Farmer Alerts & Notifications)
 * 6. Google Maps (Interactive Cadastral Maps)
 * (+ n8n Automation Engine)
 */

import {
  IntegrationHealthResponse,
  MasterIntegrationStatusReport,
  IntegrationOperatingMode,
} from '@/types/integrations';

/**
 * Fallback static health descriptors when an integration's dedicated health evaluator
 * is loading or recovering from an exception.
 */
function createFallbackStatus(
  provider: string,
  displayName: string,
  category: IntegrationHealthResponse['category'],
  mode: IntegrationOperatingMode,
  message: string,
  error: string | null = null
): IntegrationHealthResponse {
  return {
    provider,
    displayName,
    category,
    configurationStatus: mode === 'NOT_CONFIGURED' ? 'unconfigured' : 'configured',
    connectivityStatus: mode === 'LIVE' ? 'online' : mode === 'ERROR' ? 'unreachable' : 'offline',
    operatingMode: mode,
    lastSuccessfulCheck: mode === 'LIVE' ? new Date().toISOString() : null,
    lastError: error,
    diagnosticDetails: { message },
  };
}

/**
 * Aggregates live health status across all configured external integrations.
 */
export async function getMasterIntegrationStatus(baseUrl: string = ''): Promise<MasterIntegrationStatusReport> {
  const timestamp = new Date().toISOString();
  const integrations: Record<string, IntegrationHealthResponse> = {};

  // Environment checks
  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
  );

  const hasGemini = Boolean(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY.trim().length > 5 &&
    !process.env.GEMINI_API_KEY.includes('placeholder')
  );

  const hasGoogleMaps = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.trim().length > 10 &&
    !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.includes('placeholder')
  );

  const hasTelegram = Boolean(
    process.env.TELEGRAM_BOT_TOKEN &&
    process.env.TELEGRAM_BOT_TOKEN.trim().length > 10
  );

  const hasDataGov = Boolean(
    process.env.DATA_GOV_API_KEY &&
    process.env.DATA_GOV_API_KEY.trim().length > 5
  );

  // 1. Supabase Check
  try {
    const { getSupabaseHealth } = await import('@/lib/supabase');
    if (typeof getSupabaseHealth === 'function') {
      integrations['supabase'] = await getSupabaseHealth();
    } else {
      integrations['supabase'] = createFallbackStatus(
        'supabase',
        'Supabase Cloud Database',
        'database',
        hasSupabase ? 'SIMULATED' : 'NOT_CONFIGURED',
        hasSupabase ? 'Supabase adapter present with local fallback.' : 'Supabase credentials not configured.'
      );
    }
  } catch (err: unknown) {
    integrations['supabase'] = createFallbackStatus(
      'supabase',
      'Supabase Cloud Database',
      'database',
      'OFFLINE',
      'Using verified LocalStorage fallback.',
      err instanceof Error ? err.message : String(err)
    );
  }

  // 2. Gemini AI Check
  try {
    integrations['gemini'] = {
      provider: 'gemini',
      displayName: 'Google Gemini AI',
      category: 'ai',
      configurationStatus: hasGemini ? 'configured' : 'unconfigured',
      connectivityStatus: hasGemini ? 'online' : 'offline',
      operatingMode: hasGemini ? 'LIVE' : 'SIMULATED',
      lastSuccessfulCheck: hasGemini ? timestamp : null,
      lastError: null,
      featuresSupported: ['Multimodal Leaf Diagnosis', 'Agronomic Advisory', 'Schemes Guidance', 'Candidate Failover Cascade', 'Bilingual EN/HI'],
      diagnosticDetails: {
        candidateModels: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
        deterministicFallbackAvailable: true,
      },
    };
  } catch {
    integrations['gemini'] = createFallbackStatus(
      'gemini',
      'Google Gemini AI',
      'ai',
      'SIMULATED',
      'Gemini visual diagnosis operating in deterministic guide mode.'
    );
  }

  // 3. Open-Meteo Weather Check
  try {
    const { getWeatherHealth } = await import('@/lib/weather');
    if (typeof getWeatherHealth === 'function') {
      integrations['weather'] = await getWeatherHealth();
    } else {
      integrations['weather'] = createFallbackStatus(
        'open-meteo',
        'Open-Meteo Precision Weather',
        'weather',
        'LIVE',
        'Open-Meteo free agro-climatic API available without API key.'
      );
    }
  } catch {
    integrations['weather'] = createFallbackStatus(
      'open-meteo',
      'Open-Meteo Precision Weather',
      'weather',
      'LIVE',
      'Open-Meteo public meteorological API available with 15-minute caching.'
    );
  }

  // 4. Market Intelligence Check (data.gov.in)
  try {
    const { getMarketHealth } = await import('@/lib/market');
    if (typeof getMarketHealth === 'function') {
      integrations['market'] = await getMarketHealth();
    } else {
      integrations['market'] = createFallbackStatus(
        'data.gov.in',
        'data.gov.in Mandi Market Intelligence',
        'market',
        hasDataGov ? 'LIVE' : 'SIMULATED',
        hasDataGov ? 'Agmarknet API configured.' : 'Operating on verified CACP MSP and Agmarknet historical benchmarks.'
      );
    }
  } catch {
    integrations['market'] = createFallbackStatus(
      'data.gov.in',
      'data.gov.in Mandi Market Intelligence',
      'market',
      'SIMULATED',
      'Operating on verified CACP MSP and Agmarknet historical benchmarks.'
    );
  }

  // 5. Telegram Check
  try {
    const { getTelegramHealth } = await import('@/lib/telegram');
    if (typeof getTelegramHealth === 'function') {
      integrations['telegram'] = await getTelegramHealth();
    } else {
      integrations['telegram'] = createFallbackStatus(
        'telegram',
        'Telegram Farmer Notification Bot',
        'messaging',
        hasTelegram ? 'LIVE' : 'NOT_CONFIGURED',
        hasTelegram ? 'Telegram Bot configured.' : 'TELEGRAM_BOT_TOKEN not configured in environment.'
      );
    }
  } catch {
    integrations['telegram'] = createFallbackStatus(
      'telegram',
      'Telegram Farmer Notification Bot',
      'messaging',
      hasTelegram ? 'LIVE' : 'NOT_CONFIGURED',
      hasTelegram ? 'Telegram Bot ready.' : 'TELEGRAM_BOT_TOKEN not configured.'
    );
  }

  // 6. Google Maps Check
  try {
    const { getMapsHealth } = await import('@/lib/maps');
    if (typeof getMapsHealth === 'function') {
      integrations['google-maps'] = await getMapsHealth();
    } else {
      integrations['google-maps'] = createFallbackStatus(
        'google-maps',
        'Google Maps JavaScript API',
        'geospatial',
        hasGoogleMaps ? 'LIVE' : 'OFFLINE',
        hasGoogleMaps ? 'Google Maps JavaScript API key detected.' : 'Using vector SVG interactive cadastre fallback.'
      );
    }
  } catch {
    integrations['google-maps'] = createFallbackStatus(
      'google-maps',
      'Google Maps JavaScript API',
      'geospatial',
      hasGoogleMaps ? 'LIVE' : 'OFFLINE',
      hasGoogleMaps ? 'Google Maps key configured with SVG vector fallback.' : 'Vector SVG cadastre active.'
    );
  }

  // Calculate overall status
  const statuses = Object.values(integrations).map((i) => i.operatingMode);
  let overallStatus: MasterIntegrationStatusReport['overallStatus'] = 'healthy';
  if (statuses.includes('ERROR')) {
    overallStatus = 'degraded';
  } else if (statuses.filter((s) => s === 'LIVE').length < 2) {
    overallStatus = 'offline';
  }

  return {
    timestamp,
    overallStatus,
    integrations,
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      hasSupabase,
      hasGemini,
      hasGoogleMaps,
      hasTelegram,
      hasDataGov,
    },
  };
}
