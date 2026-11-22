/**
 * AgriDOST 4.0: Weather Integration & Agro-Meteorological Test Suite
 * 
 * Verifies:
 * 1. Open-Meteo client URL generation, query building, and attribution
 * 2. 15-minute agro-climatic caching, TTL expiration, staleness, and forceRefresh
 * 3. CIBRC drone spray safety evaluation (wind, rain, temp, humidity thresholds)
 * 4. MANDATORY human verification safety assertion (humanVerificationRequired === true)
 * 5. Deterministic offline seasonal fallback for Indian agro-climatic zones
 * 6. Health check contract matching IntegrationHealthResponse
 * 7. Next.js App Router API endpoint (/api/weather) handler
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  DEFAULT_FARM_COORDINATES,
  OPEN_METEO_ATTRIBUTION,
  OPEN_METEO_BASE_URL,
  buildOpenMeteoUrl,
  fetchFarmWeather,
  getWeatherHealthCheck,
  parseOpenMeteoPayload,
} from '@/lib/weather/client';
import {
  WEATHER_CACHE_TTL_MS,
  clearWeatherCache,
  getCachedWeather,
  getWeatherCacheKey,
  setCachedWeather,
} from '@/lib/weather/cache';
import {
  calculateDriftIndex,
  evaluateHumidity,
  evaluatePrecipitation,
  evaluateSpraySafety,
  evaluateTemperature,
  evaluateWind,
  findUpcomingSprayWindows,
} from '@/lib/weather/spray-window';
import {
  generateOfflineWeather,
  getIndianAgroClimaticSeason,
} from '@/lib/weather/offline-fallback';
import {
  getWmoDetails,
  getWmoWeatherDescription,
} from '@/lib/weather/wmo-codes';
import { GET } from '@/app/api/weather/route';
import { OpenMeteoRawResponse } from '@/types/weather';

describe('AgriDOST 4.0: Weather Specialist Integration Suite', () => {
  beforeEach(() => {
    clearWeatherCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearWeatherCache();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Open-Meteo Client & Query Building
  // =========================================================================
  describe('1. Open-Meteo Client & Query Building', () => {
    it('uses Nashik (20.00°N, 73.78°E) as default farm coordinates', () => {
      expect(DEFAULT_FARM_COORDINATES.latitude).toBe(20.0);
      expect(DEFAULT_FARM_COORDINATES.longitude).toBe(73.78);
      expect(DEFAULT_FARM_COORDINATES.label).toContain('Nashik');
    });

    it('builds valid Open-Meteo API query string with required parameters and Asia/Kolkata timezone', () => {
      const url = buildOpenMeteoUrl(20.0, 73.78);
      expect(url).toContain(OPEN_METEO_BASE_URL);
      expect(url).toContain('latitude=20.0000');
      expect(url).toContain('longitude=73.7800');
      expect(url).toContain('timezone=Asia%2FKolkata');
      expect(url).toContain('current=');
      expect(url).toContain('temperature_2m');
      expect(url).toContain('relative_humidity_2m');
      expect(url).toContain('precipitation');
      expect(url).toContain('wind_speed_10m');
      expect(url).toContain('weather_code');
      expect(url).toContain('uv_index');
      expect(url).toContain('daily=');
    });

    it('includes required CC-BY 4.0 Open-Meteo attribution', () => {
      expect(OPEN_METEO_ATTRIBUTION).toContain('Open-Meteo.com');
      expect(OPEN_METEO_ATTRIBUTION).toContain('CC-BY 4.0');
    });

    it('parses raw Open-Meteo response into structured FarmWeatherResponse', () => {
      const mockRaw: OpenMeteoRawResponse = {
        latitude: 20.0,
        longitude: 73.78,
        generationtime_ms: 0.12,
        utc_offset_seconds: 19800,
        timezone: 'Asia/Kolkata',
        timezone_abbreviation: 'IST',
        elevation: 580,
        current: {
          time: '2026-11-22T10:00:00Z',
          temperature_2m: 24.5,
          relative_humidity_2m: 58,
          precipitation: 0,
          precipitation_probability: 5,
          weather_code: 1,
          wind_speed_10m: 7.2,
          wind_direction_10m: 240,
          is_day: 1,
          uv_index: 6,
        },
        hourly: {
          time: ['2026-11-22T10:00:00Z', '2026-11-22T11:00:00Z'],
          temperature_2m: [24.5, 26.1],
          relative_humidity_2m: [58, 52],
          precipitation: [0, 0],
          precipitation_probability: [5, 10],
          weather_code: [1, 2],
          wind_speed_10m: [7.2, 8.5],
          wind_direction_10m: [240, 250],
          uv_index: [6, 7],
        },
        daily: {
          time: ['2026-11-22'],
          weather_code: [1],
          temperature_2m_max: [29.5],
          temperature_2m_min: [17.2],
          precipitation_sum: [0],
          precipitation_probability_max: [10],
          wind_speed_10m_max: [11.0],
          uv_index_max: [8],
          sunrise: ['2026-11-22T06:30:00Z'],
          sunset: ['2026-11-22T17:55:00Z'],
        },
      };

      const result = parseOpenMeteoPayload(mockRaw, 20.0, 73.78);

      expect(result.latitude).toBe(20.0);
      expect(result.longitude).toBe(73.78);
      expect(result.current.temperature).toBe(24.5);
      expect(result.current.relativeHumidity).toBe(58);
      expect(result.current.windSpeed).toBe(7.2);
      expect(result.current.conditionText).toBe('Mainly clear');
      expect(result.current.conditionTextHi).toBe('अधिकांशतः साफ आसमान');
      expect(result.hourly).toHaveLength(2);
      expect(result.daily).toHaveLength(1);
      expect(result.sprayAssessment).toBeDefined();
      expect(result.sprayAssessment.humanVerificationRequired).toBe(true);
      expect(result.attribution).toContain('Open-Meteo.com');
      expect(result.freshness.provenance).toBe('live_api');
    });

    it('fetches live data and saves to cache', async () => {
      const mockRaw: OpenMeteoRawResponse = {
        latitude: 20.0,
        longitude: 73.78,
        generationtime_ms: 0.1,
        utc_offset_seconds: 19800,
        timezone: 'Asia/Kolkata',
        timezone_abbreviation: 'IST',
        elevation: 580,
        current: {
          time: '2026-11-22T12:00:00Z',
          temperature_2m: 27.0,
          relative_humidity_2m: 50,
          precipitation: 0,
          weather_code: 0,
          wind_speed_10m: 6.0,
          wind_direction_10m: 180,
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockRaw,
      } as Response);

      const data = await fetchFarmWeather({ latitude: 20.0, longitude: 73.78 });

      expect(data.current.temperature).toBe(27.0);
      expect(data.freshness.provenance).toBe('live_api');

      // Verify cached
      const cached = getCachedWeather(20.0, 73.78);
      expect(cached).not.toBeNull();
      expect(cached?.data.current.temperature).toBe(27.0);
    });

    it('retries on network failure before falling back gracefully', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new Error('Network unreachable'));

      const data = await fetchFarmWeather({
        latitude: 20.0,
        longitude: 73.78,
        retries: 2,
        timeoutMs: 500,
      });

      // Should have attempted multiple times (1 initial + 2 retries = 3 calls)
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      // Fallback activated gracefully
      expect(data).toBeDefined();
      expect(data.freshness.provenance).toBe('simulated_fallback');
      expect(data.current.temperature).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. Caching & Freshness Metadata
  // =========================================================================
  describe('2. Agro-Climatic Caching & Freshness Indicators', () => {
    it('normalizes coordinate keys by rounding to 2 decimal places', () => {
      expect(getWeatherCacheKey(20.0012, 73.7844)).toBe('20.00_73.78');
      expect(getWeatherCacheKey(20.0, 73.78)).toBe('20.00_73.78');
      expect(getWeatherCacheKey(19.998, 73.776)).toBe('20.00_73.78');
    });

    it('returns cached data within 15-minute TTL without making network calls', async () => {
      const fakeWeather = generateOfflineWeather(20.0, 73.78);
      setCachedWeather(20.0, 73.78, fakeWeather);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const retrieved = await fetchFarmWeather({ latitude: 20.0, longitude: 73.78 });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(retrieved.latitude).toBe(20.0);
      expect(retrieved.freshness.provenance).toBe('cached_remote');
    });

    it('marks cache as stale and expires after 15 minutes (900,000 ms)', () => {
      const fakeWeather = generateOfflineWeather(20.0, 73.78);
      setCachedWeather(20.0, 73.78, fakeWeather);

      // Fast-forward time past 15 minutes
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + WEATHER_CACHE_TTL_MS + 5000);

      const freshCheck = getCachedWeather(20.0, 73.78);
      expect(freshCheck).toBeNull(); // Expired by default

      const staleCheck = getCachedWeather(20.0, 73.78, { allowStale: true });
      expect(staleCheck).not.toBeNull();
      expect(staleCheck?.isStale).toBe(true);
      expect(staleCheck?.ageSeconds).toBeGreaterThan(900);
    });

    it('bypasses cache when forceRefresh is true', async () => {
      const fakeWeather = generateOfflineWeather(20.0, 73.78);
      setCachedWeather(20.0, 73.78, fakeWeather);

      const mockRaw: OpenMeteoRawResponse = {
        latitude: 20.0,
        longitude: 73.78,
        generationtime_ms: 0.1,
        utc_offset_seconds: 19800,
        timezone: 'Asia/Kolkata',
        timezone_abbreviation: 'IST',
        elevation: 580,
        current: {
          time: '2026-11-22T13:00:00Z',
          temperature_2m: 31.2,
          relative_humidity_2m: 44,
          precipitation: 0,
          weather_code: 0,
          wind_speed_10m: 9.0,
          wind_direction_10m: 190,
        },
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockRaw,
      } as Response);

      const result = await fetchFarmWeather({
        latitude: 20.0,
        longitude: 73.78,
        forceRefresh: true,
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(result.current.temperature).toBe(31.2);
    });
  });

  // =========================================================================
  // 3. CIBRC Drone Spray Safety Evaluation
  // =========================================================================
  describe('3. CIBRC Drone Spray Weather Window & Safety Evaluation', () => {
    describe('Wind Speed Evaluation (<10 km/h optimal, <15 km/h allowed, >=15 hazardous)', () => {
      it('evaluates wind < 10 km/h as optimal', () => {
        const evalRes = evaluateWind(6.5);
        expect(evalRes.status).toBe('optimal');
        expect(evalRes.message).toContain('optimal');
      });

      it('evaluates wind between 10 km/h and 14.9 km/h as marginal', () => {
        const evalRes = evaluateWind(12.0);
        expect(evalRes.status).toBe('marginal');
        expect(evalRes.message).toContain('marginal');
      });

      it('evaluates wind >= 15 km/h as hazardous (CIBRC violation)', () => {
        const evalRes = evaluateWind(16.5);
        expect(evalRes.status).toBe('hazardous');
        expect(evalRes.message).toContain('exceeds CIBRC maximum safety limit');
      });
    });

    describe('Precipitation Evaluation (0 mm rain, prob < 20% optimal, > 40% hazardous)', () => {
      it('evaluates 0 mm rain and < 20% rain probability as optimal', () => {
        const evalRes = evaluatePrecipitation(0, 10);
        expect(evalRes.status).toBe('optimal');
      });

      it('evaluates rain probability between 20% and 40% as marginal', () => {
        const evalRes = evaluatePrecipitation(0, 30);
        expect(evalRes.status).toBe('marginal');
      });

      it('evaluates active rain (> 0 mm) as hazardous', () => {
        const evalRes = evaluatePrecipitation(1.5, 90);
        expect(evalRes.status).toBe('hazardous');
        expect(evalRes.message).toContain('Active precipitation');
      });

      it('evaluates rain probability > 40% as hazardous', () => {
        const evalRes = evaluatePrecipitation(0, 55);
        expect(evalRes.status).toBe('hazardous');
        expect(evalRes.message).toContain('High rain probability');
      });
    });

    describe('Temperature Evaluation (18-28°C optimal, 15-35°C allowed, <15 or >35 hazardous)', () => {
      it('evaluates 22°C as optimal', () => {
        const evalRes = evaluateTemperature(22);
        expect(evalRes.status).toBe('optimal');
      });

      it('evaluates 16°C and 32°C as marginal', () => {
        expect(evaluateTemperature(16).status).toBe('marginal');
        expect(evaluateTemperature(32).status).toBe('marginal');
      });

      it('evaluates extreme heat (> 35°C) as hazardous', () => {
        const evalRes = evaluateTemperature(37);
        expect(evalRes.status).toBe('hazardous');
        expect(evalRes.message).toContain('Extreme temperature');
      });

      it('evaluates extreme cold (< 15°C) as hazardous', () => {
        const evalRes = evaluateTemperature(12);
        expect(evalRes.status).toBe('hazardous');
      });
    });

    describe('Relative Humidity Evaluation (50-75% optimal, 40-80% allowed, <40% or >80% hazardous)', () => {
      it('evaluates 60% as optimal', () => {
        const evalRes = evaluateHumidity(60);
        expect(evalRes.status).toBe('optimal');
      });

      it('evaluates 45% and 78% as marginal', () => {
        expect(evaluateHumidity(45).status).toBe('marginal');
        expect(evaluateHumidity(78).status).toBe('marginal');
      });

      it('evaluates critically low humidity (< 40%) as hazardous drift risk', () => {
        const evalRes = evaluateHumidity(32);
        expect(evalRes.status).toBe('hazardous');
        expect(evalRes.message).toContain('critically dry');
      });

      it('evaluates excessive humidity (> 80%) as hazardous leaf runoff risk', () => {
        const evalRes = evaluateHumidity(88);
        expect(evalRes.status).toBe('hazardous');
        expect(evalRes.message).toContain('Excessive humidity');
      });
    });

    describe('Chemical Drift Index Calculation (0-100 scale)', () => {
      it('computes low drift index under calm, cool, humid conditions', () => {
        const drift = calculateDriftIndex(5, 20, 65);
        expect(drift).toBeLessThan(30);
      });

      it('computes high drift index under windy, hot, and dry conditions', () => {
        const drift = calculateDriftIndex(18, 36, 30);
        expect(drift).toBeGreaterThan(60);
      });
    });

    describe('Composite Spray Safety Assessment', () => {
      it('returns status "optimal" and cibrGuidelinesMet: true when all parameters are optimal', () => {
        const assessment = evaluateSpraySafety({
          temperature: 24,
          relativeHumidity: 60,
          windSpeed: 6,
          precipitation: 0,
          precipitationProbability: 5,
        });

        expect(assessment.status).toBe('optimal');
        expect(assessment.suitability).toBe('optimal');
        expect(assessment.cibrGuidelinesMet).toBe(true);
        expect(assessment.cibrcGuidelinesMet).toBe(true);
        expect(assessment.warnings).toHaveLength(0);
      });

      it('returns status "marginal" and cibrGuidelinesMet: true when one parameter is marginal', () => {
        const assessment = evaluateSpraySafety({
          temperature: 24,
          relativeHumidity: 60,
          windSpeed: 12, // Marginal wind
          precipitation: 0,
          precipitationProbability: 10,
        });

        expect(assessment.status).toBe('marginal');
        expect(assessment.cibrGuidelinesMet).toBe(true);
        expect(assessment.warnings.length).toBeGreaterThan(0);
      });

      it('returns status "hazardous" and cibrGuidelinesMet: false when any parameter is hazardous', () => {
        const assessment = evaluateSpraySafety({
          temperature: 24,
          relativeHumidity: 60,
          windSpeed: 17, // Hazardous wind (>=15 km/h)
          precipitation: 0,
          precipitationProbability: 10,
        });

        expect(assessment.status).toBe('hazardous');
        expect(assessment.cibrGuidelinesMet).toBe(false);
        expect(assessment.cibrcGuidelinesMet).toBe(false);
        expect(assessment.warnings.some((w) => w.includes('15 km/h'))).toBe(true);
      });
    });
  });

  // =========================================================================
  // 4. Mandatory Human Verification Safety Rule
  // =========================================================================
  describe('4. Mandatory Human Verification Safety Rule', () => {
    it('CRITICAL: humanVerificationRequired is strictly true in optimal conditions', () => {
      const assessment = evaluateSpraySafety({
        temperature: 22,
        relativeHumidity: 65,
        windSpeed: 5,
        precipitation: 0,
        precipitationProbability: 0,
      });

      expect(assessment.humanVerificationRequired).toBe(true);
    });

    it('CRITICAL: humanVerificationRequired is strictly true in marginal conditions', () => {
      const assessment = evaluateSpraySafety({
        temperature: 30,
        relativeHumidity: 45,
        windSpeed: 12,
        precipitation: 0,
        precipitationProbability: 25,
      });

      expect(assessment.humanVerificationRequired).toBe(true);
    });

    it('CRITICAL: humanVerificationRequired is strictly true in hazardous conditions', () => {
      const assessment = evaluateSpraySafety({
        temperature: 38,
        relativeHumidity: 30,
        windSpeed: 22,
        precipitation: 2,
        precipitationProbability: 80,
      });

      expect(assessment.humanVerificationRequired).toBe(true);
    });

    it('provides clear bilingual safety advisories referencing DGCA and CIBRC SOPs', () => {
      const assessment = evaluateSpraySafety({
        temperature: 25,
        relativeHumidity: 55,
        windSpeed: 8,
      });

      expect(assessment.advisoryStatement).toContain('SAFETY ADVISORY');
      expect(assessment.advisoryStatement).toContain('Remote Pilot-in-Command');
      expect(assessment.advisoryStatement).toContain('DGCA and CIBRC');
      expect(assessment.advisoryStatementHi).toContain('सुरक्षा सलाह');
      expect(assessment.advisoryStatementHi).toContain('डीजीसीए और सीआईबीआरसी');
    });
  });

  // =========================================================================
  // 5. Offline Agro-Climatic Seasonal Fallback
  // =========================================================================
  describe('5. Offline Agro-Climatic Seasonal Fallback', () => {
    it('returns appropriate seasonal parameters for Indian agro-climatic zones', () => {
      // Winter (Dec = 11, Jan = 0)
      const winter = getIndianAgroClimaticSeason(0, 20.0);
      expect(winter.baseTemp).toBeLessThanOrEqual(25);
      expect(winter.baseRainProb).toBeLessThan(15);

      // Summer (Apr = 3)
      const summer = getIndianAgroClimaticSeason(3, 20.0);
      expect(summer.baseTemp).toBeGreaterThan(28);
      expect(summer.baseHumidity).toBeLessThan(50);

      // Monsoon (Jul = 6)
      const monsoon = getIndianAgroClimaticSeason(6, 20.0);
      expect(monsoon.baseHumidity).toBeGreaterThan(70);
      expect(monsoon.baseRainProb).toBeGreaterThan(50);
    });

    it('generates complete FarmWeatherResponse tagged with offline_deterministic provenance', () => {
      const offline = generateOfflineWeather(20.0, 73.78, {
        provenance: 'offline_deterministic',
      });

      expect(offline.latitude).toBe(20.0);
      expect(offline.longitude).toBe(73.78);
      expect(offline.freshness.provenance).toBe('offline_deterministic');
      expect(offline.current).toBeDefined();
      expect(offline.current.temperature).toBeGreaterThan(5);
      expect(offline.current.temperature).toBeLessThan(50);
      expect(offline.current.relativeHumidity).toBeGreaterThan(10);
      expect(offline.hourly).toHaveLength(24);
      expect(offline.daily).toHaveLength(7);
      expect(offline.sprayAssessment.humanVerificationRequired).toBe(true);
      expect(offline.upcomingSprayWindows).toHaveLength(24);
    });
  });

  // =========================================================================
  // 6. WMO Weather Code Translations
  // =========================================================================
  describe('6. WMO Weather Codes & Bilingual Descriptions', () => {
    it('correctly translates code 0 (Clear sky / साफ आसमान)', () => {
      const desc = getWmoWeatherDescription(0);
      expect(desc.en).toBe('Clear sky');
      expect(desc.hi).toBe('साफ आसमान');
    });

    it('correctly identifies rain and severity in code 65 (Heavy rain)', () => {
      const details = getWmoDetails(65);
      expect(details.isRain).toBe(true);
      expect(details.isSevere).toBe(true);
      expect(details.descriptionHi).toContain('भारी बारिश');
    });
  });

  // =========================================================================
  // 7. Health Check Contract & API Route Handlers
  // =========================================================================
  describe('7. Health Check Contract & API Route Handlers', () => {
    it('getWeatherHealthCheck returns structure compliant with IntegrationHealthResponse', async () => {
      const health = await getWeatherHealthCheck();

      expect(health.provider).toBe('open-meteo');
      expect(health.displayName).toContain('Open-Meteo');
      expect(health.category).toBe('weather');
      expect(health.configurationStatus).toBe('configured');
      expect(['online', 'offline', 'degraded', 'unreachable']).toContain(health.connectivityStatus);
      expect(['LIVE', 'SIMULATED', 'OFFLINE', 'ERROR']).toContain(health.operatingMode);
      expect(health.featuresSupported).toContain('cibrc_drone_spray_safety');
      expect(health.featuresSupported).toContain('chemical_drift_index');
      expect(health.diagnosticDetails?.requiresApiKey).toBe(false);
    });

    it('GET /api/weather returns full weather payload by default', async () => {
      const req = new NextRequest('http://localhost:3000/api/weather?lat=20.00&lon=73.78');
      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(json.data.current.temperature).toBeDefined();
      expect(json.data.sprayAssessment.humanVerificationRequired).toBe(true);
      expect(json.health.provider).toBe('open-meteo');
    });

    it('GET /api/weather?mode=health returns IntegrationHealthResponse directly', async () => {
      const req = new NextRequest('http://localhost:3000/api/weather?mode=health');
      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.provider).toBe('open-meteo');
      expect(json.category).toBe('weather');
      expect(json.configurationStatus).toBe('configured');
    });

    it('GET /api/weather validates coordinate bounds and returns 400 on invalid lat/lon', async () => {
      const badLatReq = new NextRequest('http://localhost:3000/api/weather?lat=120.0&lon=73.78');
      const badLatRes = await GET(badLatReq);
      expect(badLatRes.status).toBe(400);

      const badLonReq = new NextRequest('http://localhost:3000/api/weather?lat=20.0&lon=250.0');
      const badLonRes = await GET(badLonReq);
      expect(badLonRes.status).toBe(400);

      const nanReq = new NextRequest('http://localhost:3000/api/weather?lat=invalid&lon=73.78');
      const nanRes = await GET(nanReq);
      expect(nanRes.status).toBe(400);
    });
  });
});
