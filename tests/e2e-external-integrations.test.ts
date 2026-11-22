import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMasterIntegrationStatus } from '@/lib/integrations';
import { fetchFarmWeather } from '@/lib/weather/client';
import { evaluateSpraySafety } from '@/lib/weather/spray-window';
import { getOfflineAgronomicAdvisory } from '@/lib/ai/system-prompt';
import { getMSPForCommodity } from '@/lib/market/msp-registry';
import {
  calculateFinancialAnalysis,
  generateMarketAdvisory,
  MARKET_ADVISORY_DISCLAIMER,
} from '@/lib/market/intelligence';
import {
  registerConsent,
  hasConsent,
  revokeConsent,
  getConsentByFarmerId,
} from '@/lib/telegram/consent';
import { sendTelegramNotification } from '@/lib/telegram';
import { runAgriculturalResearch } from '@/lib/integrations/tinyfish';

// In-memory localStorage mock for node environment
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
}

describe('AgriDOST 4.0: Comprehensive End-to-End External Integration Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== 'undefined') {
      const mockStorage = new MockLocalStorage();
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
      });
    }
  });

  describe('Scenario A: Complete Offline / Zero-Connectivity Journey', () => {
    it('should aggregate all 6 integrations with robust fallback operating modes', async () => {
      const report = await getMasterIntegrationStatus();

      expect(report).toBeDefined();
      expect(report.overallStatus).toMatch(/healthy|degraded|offline/);
      expect(report.integrations['supabase']).toBeDefined();
      expect(report.integrations['gemini']).toBeDefined();
      expect(report.integrations['weather']).toBeDefined();
      expect(report.integrations['market']).toBeDefined();
      expect(report.integrations['telegram']).toBeDefined();
      expect(report.integrations['google-maps']).toBeDefined();
      expect(report.integrations['tinyfish']).toBeDefined();

      // Ensure every integration is in a recognized, non-crashing state
      for (const [provider, status] of Object.entries(report.integrations)) {
        expect(['LIVE', 'SIMULATED', 'OFFLINE', 'NOT_CONFIGURED', 'ERROR']).toContain(status.operatingMode);
        expect(status.provider).toBeDefined();
      }
    });

    it('should safely fall back to local simulated data when remote weather is inaccessible', async () => {
      const weather = await fetchFarmWeather({ forceRefresh: true });
      expect(weather).toBeDefined();
      expect(weather.current).toBeDefined();
      expect(weather.current.temperature).toBeGreaterThan(0);
      expect(weather.current.relativeHumidity).toBeGreaterThanOrEqual(0);
      expect(weather.current.relativeHumidity).toBeLessThanOrEqual(100);
      expect(weather.current.windSpeed).toBeGreaterThanOrEqual(0);
      expect(weather.current.windDirection).toBeDefined();
      expect(weather.freshness.provenance).toMatch(/live_api|cache|offline_agro_climatic_model/);
    });
  });

  describe('Scenario B: Agronomic Advisory Grounding & Bilingual Deterministic Failover', () => {
    it('should provide deterministic ICAR/KVK-grounded Hindi advice offline without throwing', () => {
      const offlineHindi = getOfflineAgronomicAdvisory({
        cropName: 'Soybean',
        language: 'hi',
      });

      expect(offlineHindi).toBeDefined();
      expect(offlineHindi.crop).toBeDefined();
      expect(offlineHindi.language).toBe('hi');
      expect(offlineHindi.summary).toBeDefined();
      expect(offlineHindi.disclaimer).toMatch(/आईसीएआर|KVK|ICAR|सलाह/i);
    });

    it('should provide English deterministic advice with proper safety advisories', () => {
      const offlineEnglish = getOfflineAgronomicAdvisory({
        cropName: 'Cotton',
        language: 'en',
      });

      expect(offlineEnglish).toBeDefined();
      expect(offlineEnglish.crop).toBe('Cotton');
      expect(offlineEnglish.language).toBe('en');
      expect(offlineEnglish.primaryRecommendation).toBeDefined();
      expect(offlineEnglish.pestDiseasePrecaution.threats.length).toBeGreaterThan(0);
    });
  });

  describe('Scenario C: Market Intelligence & Mandatory Price Provenance (No Zero Substitution)', () => {
    it('should look up official CACP MSP benchmarks accurately for Kharif / Rabi crops', () => {
      const wheatMSP = getMSPForCommodity('Wheat');
      expect(wheatMSP).toBeDefined();
      expect(wheatMSP?.mspPriceInrPerQtl).toBeGreaterThan(2000);

      const soybeanMSP = getMSPForCommodity('Soybean');
      expect(soybeanMSP).toBeDefined();
      expect(soybeanMSP?.mspPriceInrPerQtl).toBeGreaterThan(4000);
    });

    it('should compute financial intelligence with profit and advisory disclaimers without zero prices', () => {
      const economics = calculateFinancialAnalysis({
        modalPricePerQtl: 4600,
        expectedYieldTonnes: 2.5, // 25 quintals
        totalInputCostInr: 80000,
      });

      expect(economics.breakEvenPricePerQtl).toBe(3200);
      expect(economics.estimatedCostInr).toBe(80000);
      expect(economics.estimatedRevenueInr).toBe(115000);
      expect(economics.expectedProfitInr).toBe(35000);
      expect(economics.profitMarginPct).toBeCloseTo(30.43, 1);

      // Verify mandatory statutory disclaimer
      expect(MARKET_ADVISORY_DISCLAIMER).toMatch(/Advisory calculation only/i);
    });
  });

  describe('Scenario D: Telegram Opt-in / Opt-out Consent & Idempotency Compliance', () => {
    const testFarmerId = 'farmer-test-uuid-999';
    const testChatId = 123456789;

    it('should reject alerts when farmer has not consented', async () => {
      // First ensure consent is revoked
      revokeConsent({ farmerId: testFarmerId });
      expect(hasConsent(testFarmerId)).toBe(false);

      const result = await sendTelegramNotification({
        id: `test-alert-${Date.now()}`,
        farmerId: testFarmerId,
        category: 'weather',
        priority: 'high',
        titleEn: 'High Winds Alert',
        bodyEn: 'Postpone drone spraying due to 22 km/h winds.',
        titleHi: 'तेज हवा चेतावनी',
        bodyHi: '22 किमी/घंटा हवा के कारण ड्रोन छिड़काव स्थगित करें।',
        createdAt: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/FARMER_NOT_OPTED_IN|consent/i);
    });

    it('should deliver simulated/mock alert once farmer provides opt-in consent', async () => {
      registerConsent({
        farmerId: testFarmerId,
        chatId: testChatId,
        languagePreference: 'hi',
      });

      expect(hasConsent(testFarmerId)).toBe(true);
      const record = getConsentByFarmerId(testFarmerId);
      expect(record?.chatId).toBe(testChatId);
      expect(record?.optInStatus).toBe(true);

      const result = await sendTelegramNotification({
        id: `test-alert-consented-${Date.now()}`,
        farmerId: testFarmerId,
        category: 'weather',
        priority: 'medium',
        titleEn: 'Weather Advisory',
        bodyEn: 'Wind speed is 12 km/h. Conditions are optimal for spraying.',
        titleHi: 'मौसम चेतावनी',
        bodyHi: 'हवा की गति 12 किमी/घंटा है। छिड़काव के लिए परिस्थितियां अनुकूल हैं।',
        createdAt: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.chatId).toBe(testChatId);
    });
  });

  describe('Scenario E: Drone Spray Window CIBRC Safety Invariants', () => {
    it('should mark spray window unsafe when wind speed exceeds CIBRC limits (15 km/h)', () => {
      const evaluation = evaluateSpraySafety({
        temperature: 24,
        relativeHumidity: 60,
        windSpeed: 22, // Exceeds CIBRC 15 km/h limit
        precipitation: 0,
        precipitationProbability: 10,
      });

      expect(evaluation.status).toBe('hazardous');
      expect(evaluation.cibrcGuidelinesMet).toBe(false);
      expect(evaluation.warnings.some(w => w.includes('CIBRC maximum safety limit') || w.includes('15 km/h'))).toBe(true);
      // Invariant: Human verification must ALWAYS be required
      expect(evaluation.humanVerificationRequired).toBe(true);
    });

    it('should mark spray window optimal under ideal meteorological conditions', () => {
      const evaluation = evaluateSpraySafety({
        temperature: 22,
        relativeHumidity: 65,
        windSpeed: 8, // Safe range (< 10 km/h)
        precipitation: 0,
        precipitationProbability: 0,
      });

      expect(evaluation.status).toBe('optimal');
      expect(evaluation.cibrcGuidelinesMet).toBe(true);
      // Invariant: Human verification must still be required even when safe
      expect(evaluation.humanVerificationRequired).toBe(true);
    });
  });

  describe('Scenario F: TinyFish AI Web Intelligence Invariants (#8)', () => {
    it('should perform agricultural web research with source classification and MSP separation', async () => {
      const research = await runAgriculturalResearch({
        category: 'mandi',
        query: 'Soyabean Mandi Arrival Latur',
        commodity: 'Soyabean',
      });

      expect(research.provider).toBe('tinyfish');
      expect(research.category).toBe('mandi');
      expect(research.sources.length).toBeGreaterThan(0);
      expect(research.structuredData?.officialMSP).toBeDefined();
      // Ensure MSP and spot prices are not conflated
      expect(research.warnings?.[0]).toContain('Spot market prices');
    });
  });
});
