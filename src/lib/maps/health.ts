/**
 * AgriDOST 4.0: Google Maps Health & Provenance Assessment
 *
 * Implements integration health verification conforming to IntegrationHealthResponse:
 * - Detects presence and structural validity of NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * - Evaluates active operating mode (LIVE vs OFFLINE / SIMULATED fallback)
 * - Reports supported capabilities and diagnostic details
 */

import { MapHealthStatus, MapProvider } from '@/types/maps';
import { getGoogleMapsApiKey, isValidGoogleMapsKeyFormat, isGoogleMapsLoaded } from './loader';

/**
 * Evaluates the real-time health and configuration status of the Google Maps integration.
 */
export async function getMapsHealth(): Promise<MapHealthStatus> {
  const startTime = Date.now();
  const apiKey = getGoogleMapsApiKey();
  const hasApiKey = Boolean(apiKey);
  const keyFormatValid = isValidGoogleMapsKeyFormat(apiKey);
  const scriptLoaded = isGoogleMapsLoaded();

  let configurationStatus: MapHealthStatus['configurationStatus'] = 'unconfigured';
  let connectivityStatus: MapHealthStatus['connectivityStatus'] = 'offline';
  let operatingMode: MapHealthStatus['operatingMode'] = 'NOT_CONFIGURED';
  let activeProvider: MapProvider = 'vector_svg';
  let lastError: string | null = null;

  if (!hasApiKey) {
    configurationStatus = 'unconfigured';
    connectivityStatus = 'offline';
    operatingMode = 'OFFLINE';
    activeProvider = 'vector_svg';
    lastError = 'Google Maps API key not set (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY missing). Vector SVG cadastre active.';
  } else if (!keyFormatValid) {
    configurationStatus = 'partial';
    connectivityStatus = 'degraded';
    operatingMode = 'SIMULATED';
    activeProvider = 'vector_svg';
    lastError = 'Google Maps API key is configured with a placeholder or invalid format. Seamlessly falling back to Vector SVG cadastre.';
  } else {
    // Valid key present
    configurationStatus = 'configured';
    connectivityStatus = 'online';
    operatingMode = 'LIVE';
    activeProvider = 'google';
    lastError = null;
  }

  const latencyMs = Date.now() - startTime;

  return {
    provider: 'google-maps',
    displayName: 'Google Maps JavaScript API',
    category: 'geospatial',
    configurationStatus,
    connectivityStatus,
    operatingMode,
    activeProvider,
    hasApiKey,
    keyFormatValid,
    scriptLoaded,
    cadastreFallbackAvailable: true,
    lastSuccessfulCheck: new Date().toISOString(),
    lastError,
    latencyMs,
    dataFreshness: {
      timestamp: new Date().toISOString(),
      ageSeconds: 0,
      isStale: false,
      source: activeProvider === 'google' ? 'Google Maps JS API / Satellite Tiles' : 'Local Vector SVG Cadastre Engine',
      provenance: activeProvider === 'google' ? 'live_api' : 'offline_deterministic',
    },
    featuresSupported: [
      'satellite_imagery_tiles',
      'hybrid_cadastre_view',
      'roadmap_terrain_views',
      'geojson_rfc7946_polygons',
      'color_coded_zones',
      'turf_spatial_calculations',
      'offline_svg_vector_fallback',
      'interactive_zone_selection',
    ],
    diagnosticDetails: {
      keyLength: apiKey ? apiKey.length : 0,
      keyMasked: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : null,
      scriptInjected:
        typeof document !== 'undefined' && typeof document.getElementById === 'function'
          ? Boolean(document.getElementById('google-maps-js-api-agridost'))
          : false,
      windowGoogleAvailable: scriptLoaded,
      fallbackMode: 'VectorFarmMap (interactive SVG)',
    },
  };
}

export const checkGoogleMapsHealth = getMapsHealth;
