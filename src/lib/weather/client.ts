/**
 * AgriDOST 4.0: Open-Meteo Weather API Client
 * 
 * Production client for agro-meteorological data retrieval.
 * Features:
 * - Farm-coordinate queries (defaults to Nashik: 20.00°N, 73.78°E)
 * - 15-minute agro-climatic caching (respecting Open-Meteo fair-use: <10,000 req/day)
 * - Bounded retries with exponential backoff & 8-second request timeout
 * - Seamless deterministic offline fallback during connectivity failures
 * - CIBRC drone spray safety calculations
 * - Required CC-BY 4.0 attribution
 */

import { IntegrationHealthResponse } from '@/types/integrations';
import {
  DailyForecastItem,
  FarmWeatherData,
  FarmWeatherResponse,
  HourlyForecastItem,
  OpenMeteoRawResponse,
} from '@/types/weather';
import {
  getCachedWeather,
  setCachedWeather,
} from './cache';
import { generateOfflineWeather } from './offline-fallback';
import {
  evaluateSpraySafety,
  findUpcomingSprayWindows,
} from './spray-window';
import { getWmoWeatherDescription } from './wmo-codes';

// Default agricultural coordinate: Nashik, Maharashtra (Grape / Onion / Vegetable Capital)
export const DEFAULT_FARM_COORDINATES = {
  latitude: 20.00,
  longitude: 73.78,
  label: 'Nashik, Maharashtra',
};

export const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
export const OPEN_METEO_ATTRIBUTION = 'Weather data by Open-Meteo.com (CC-BY 4.0)';
export const DEFAULT_TIMEOUT_MS = 8000;
export const MAX_RETRIES = 2;

export interface FetchWeatherOptions {
  latitude?: number;
  longitude?: number;
  forceRefresh?: boolean;
  timeoutMs?: number;
  retries?: number;
}

/**
 * Builds the complete Open-Meteo forecast endpoint URL
 */
export function buildOpenMeteoUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current:
      'temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,uv_index',
    hourly:
      'temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,uv_index',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset',
    timezone: 'Asia/Kolkata',
  });

  return `${OPEN_METEO_BASE_URL}?${params.toString()}`;
}

/**
 * Safely fetches with AbortController timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parses raw Open-Meteo payload into structured FarmWeatherResponse
 */
export function parseOpenMeteoPayload(
  raw: OpenMeteoRawResponse,
  latitude: number,
  longitude: number
): FarmWeatherResponse {
  const now = new Date();
  const currentRaw = raw.current;

  const temp = currentRaw?.temperature_2m ?? raw.current_weather?.temperature ?? 25;
  const humidity = currentRaw?.relative_humidity_2m ?? 55;
  const precipitation = currentRaw?.precipitation ?? 0;
  const precipProb = currentRaw?.precipitation_probability ?? 0;
  const windSpeed = currentRaw?.wind_speed_10m ?? raw.current_weather?.windspeed ?? 8;
  const windDir = currentRaw?.wind_direction_10m ?? raw.current_weather?.winddirection ?? 0;
  const code = currentRaw?.weather_code ?? raw.current_weather?.weathercode ?? 0;
  const uv = currentRaw?.uv_index ?? 5;

  const conditionDesc = getWmoWeatherDescription(code);

  const current: FarmWeatherData = {
    temperature: temp,
    relativeHumidity: humidity,
    precipitation,
    precipitationProbability: precipProb,
    windSpeed,
    windDirection: windDir,
    weatherCode: code,
    uvIndex: uv,
    conditionText: conditionDesc.en,
    conditionTextHi: conditionDesc.hi,
    isDay: currentRaw?.is_day !== undefined ? Boolean(currentRaw.is_day) : true,
    time: currentRaw?.time ?? now.toISOString(),
  };

  // Parse hourly items
  const hourly: HourlyForecastItem[] = [];
  if (raw.hourly && Array.isArray(raw.hourly.time)) {
    const times = raw.hourly.time;
    const len = Math.min(times.length, 72); // Up to 72 hours
    for (let i = 0; i < len; i++) {
      const hCode = raw.hourly.weather_code?.[i] ?? 0;
      const hDesc = getWmoWeatherDescription(hCode);
      hourly.push({
        time: times[i],
        temperature: raw.hourly.temperature_2m?.[i] ?? 20,
        relativeHumidity: raw.hourly.relative_humidity_2m?.[i] ?? 50,
        precipitation: raw.hourly.precipitation?.[i] ?? 0,
        precipitationProbability: raw.hourly.precipitation_probability?.[i] ?? 0,
        windSpeed: raw.hourly.wind_speed_10m?.[i] ?? 5,
        windDirection: raw.hourly.wind_direction_10m?.[i] ?? 0,
        weatherCode: hCode,
        uvIndex: raw.hourly.uv_index?.[i] ?? 0,
        conditionText: hDesc.en,
      });
    }
  }

  // Parse daily items
  const daily: DailyForecastItem[] = [];
  if (raw.daily && Array.isArray(raw.daily.time)) {
    const dTimes = raw.daily.time;
    const dLen = Math.min(dTimes.length, 7); // Next 7 days
    for (let d = 0; d < dLen; d++) {
      const dCode = raw.daily.weather_code?.[d] ?? 0;
      const dDesc = getWmoWeatherDescription(dCode);
      daily.push({
        date: dTimes[d],
        maxTemperature: raw.daily.temperature_2m_max?.[d] ?? 30,
        minTemperature: raw.daily.temperature_2m_min?.[d] ?? 18,
        precipitationSum: raw.daily.precipitation_sum?.[d] ?? 0,
        precipitationProbabilityMax: raw.daily.precipitation_probability_max?.[d] ?? 0,
        maxWindSpeed: raw.daily.wind_speed_10m_max?.[d] ?? 12,
        weatherCode: dCode,
        uvIndexMax: raw.daily.uv_index_max?.[d] ?? 8,
        sunrise: raw.daily.sunrise?.[d],
        sunset: raw.daily.sunset?.[d],
        conditionText: dDesc.en,
      });
    }
  }

  const sprayAssessment = evaluateSpraySafety({
    temperature: current.temperature,
    relativeHumidity: current.relativeHumidity,
    windSpeed: current.windSpeed,
    windDirection: current.windDirection,
    precipitation: current.precipitation,
    precipitationProbability: current.precipitationProbability,
  });

  const upcomingSprayWindows = findUpcomingSprayWindows(hourly, 24);

  return {
    latitude: raw.latitude ?? latitude,
    longitude: raw.longitude ?? longitude,
    elevation: raw.elevation,
    timezone: raw.timezone ?? 'Asia/Kolkata',
    current,
    hourly,
    daily,
    sprayAssessment,
    upcomingSprayWindows,
    attribution: OPEN_METEO_ATTRIBUTION,
    freshness: {
      timestamp: now.toISOString(),
      ageSeconds: 0,
      isStale: false,
      source: 'open-meteo',
      provenance: 'live_api',
    },
  };
}

/**
 * Primary API method to fetch farm weather with caching, retries, and offline fallback.
 */
export async function fetchFarmWeather(options: FetchWeatherOptions = {}): Promise<FarmWeatherResponse> {
  const lat = options.latitude ?? DEFAULT_FARM_COORDINATES.latitude;
  const lon = options.longitude ?? DEFAULT_FARM_COORDINATES.longitude;
  const forceRefresh = options.forceRefresh ?? false;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.retries ?? MAX_RETRIES;

  // 1. Check cache first unless force refresh requested
  if (!forceRefresh) {
    const cached = getCachedWeather(lat, lon);
    if (cached) {
      return cached.data;
    }
  }

  // 2. Perform live fetch with retries
  const url = buildOpenMeteoUrl(lat, lon);
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs);

      if (!response.ok) {
        throw new Error(`Open-Meteo HTTP error: status ${response.status} ${response.statusText}`);
      }

      const raw = (await response.json()) as OpenMeteoRawResponse;
      const parsed = parseOpenMeteoPayload(raw, lat, lon);

      // Save to cache
      setCachedWeather(lat, lon, parsed);
      return parsed;
    } catch (err) {
      attempt++;
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt <= maxRetries) {
        // Short exponential backoff with jitter (e.g. 100ms, 250ms)
        const delay = Math.min(500, Math.pow(2, attempt) * 100 + Math.random() * 50);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // 3. Fallback: Check if stale cache is available before generating synthetic
  const staleCached = getCachedWeather(lat, lon, { allowStale: true });
  if (staleCached) {
    return staleCached.data;
  }

  // 4. Return seasonal deterministic offline fallback
  const fallback = generateOfflineWeather(lat, lon, {
    provenance: 'simulated_fallback',
  });

  return fallback;
}

/**
 * Integration health check matching `IntegrationHealthResponse`
 */
export async function getWeatherHealthCheck(): Promise<IntegrationHealthResponse> {
  const startTime = Date.now();
  let connectivityStatus: IntegrationHealthResponse['connectivityStatus'] = 'online';
  let operatingMode: IntegrationHealthResponse['operatingMode'] = 'LIVE';
  let lastError: string | null = null;

  try {
    const weather = await fetchFarmWeather({
      latitude: DEFAULT_FARM_COORDINATES.latitude,
      longitude: DEFAULT_FARM_COORDINATES.longitude,
      timeoutMs: 4000,
      retries: 1,
    });

    if (weather.freshness.provenance === 'simulated_fallback' || weather.freshness.provenance === 'offline_deterministic') {
      connectivityStatus = 'offline';
      operatingMode = 'SIMULATED';
    } else if (weather.freshness.provenance === 'cached_remote') {
      connectivityStatus = 'online';
      operatingMode = 'LIVE';
    }
  } catch (err) {
    connectivityStatus = 'unreachable';
    operatingMode = 'ERROR';
    lastError = err instanceof Error ? err.message : String(err);
  }

  const latencyMs = Date.now() - startTime;

  return {
    provider: 'open-meteo',
    displayName: 'Open-Meteo Weather Forecast',
    category: 'weather',
    configurationStatus: 'configured', // Open-Meteo requires no API key for standard non-commercial use
    connectivityStatus,
    operatingMode,
    lastSuccessfulCheck: connectivityStatus !== 'unreachable' ? new Date().toISOString() : null,
    lastError,
    latencyMs,
    dataFreshness: {
      timestamp: new Date().toISOString(),
      ageSeconds: 0,
      isStale: false,
      source: 'open-meteo',
      provenance: operatingMode === 'LIVE' ? 'live_api' : 'simulated_fallback',
    },
    featuresSupported: [
      'current_weather',
      'hourly_forecast',
      'daily_forecast',
      'cibrc_drone_spray_safety',
      'chemical_drift_index',
      'offline_seasonal_simulation',
      'fair_use_15m_caching',
    ],
    diagnosticDetails: {
      fairUseDailyLimit: 10000,
      requiresApiKey: false,
      attribution: OPEN_METEO_ATTRIBUTION,
      defaultLocation: DEFAULT_FARM_COORDINATES,
    },
  };
}

/**
 * Alias for getWeatherHealthCheck for integration index compatibility
 */
export const getWeatherHealth = getWeatherHealthCheck;

/**
 * Backwards-compatibility alias for fetchFarmWeather
 */
export const fetchWeather = fetchFarmWeather;

