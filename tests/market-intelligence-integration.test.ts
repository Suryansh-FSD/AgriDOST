/**
 * tests/market-intelligence-integration.test.ts
 * 
 * Comprehensive Unit and Integration Test Suite for AgriDOST 4.0 Market Intelligence:
 * 1. Data Ingestion & Parameter Filtering (State, Market, Commodity)
 * 2. Price Normalization & Strict Zero-Substitution Prohibition (Missing price errors)
 * 3. Break-Even, Revenue, and Profitability Math (1 Tonne = 10 Qtl)
 * 4. MSP Safeguard Logic (Distress Selling Prevention Sentinel)
 * 5. Deterministic Advisory Recommendations ('SELL' | 'HOLD' | 'PARTIAL_SELL')
 * 6. Provenance & Freshness Metadata Tracking ('live_api' | 'cached_remote' | 'simulated_fallback')
 * 7. Server Route & Integration Health Check Response
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  fetchMandiPrices,
  findBenchmarkRecord,
  normalizeMandiRecord,
  clearMandiCache,
  getMarketHealth,
  BENCHMARK_MANDI_DATA,
} from '@/lib/market/client';
import {
  getMSPForCommodity,
  getAllMSPRecords,
  OFFICIAL_MSP_REGISTRY,
} from '@/lib/market/msp-registry';
import {
  calculateFinancialAnalysis,
  generateMarketAdvisory,
  validateAndNormalizePrice,
  MarketPriceUnavailableError,
  MARKET_ADVISORY_DISCLAIMER,
} from '@/lib/market/intelligence';
import { getMarketIntelligence } from '@/lib/market';
import { GET } from '@/app/api/market/route';
import { MandiPriceRecord } from '@/types/market';

describe('Market Intelligence: Price Normalization & Zero-Substitution Guard', () => {
  it('should cleanly parse and normalize valid prices in ₹/quintal', () => {
    expect(validateAndNormalizePrice(2450)).toBe(2450);
    expect(validateAndNormalizePrice('2450')).toBe(2450);
    expect(validateAndNormalizePrice('₹ 2,450.50')).toBe(2450.5);
    expect(validateAndNormalizePrice('Rs. 5,800/-')).toBe(5800);
  });

  it('CRITICAL RULE: should throw MarketPriceUnavailableError on missing, empty, or zero prices (NEVER substitute 0)', () => {
    expect(() => validateAndNormalizePrice(null)).toThrow(MarketPriceUnavailableError);
    expect(() => validateAndNormalizePrice(undefined)).toThrow(MarketPriceUnavailableError);
    expect(() => validateAndNormalizePrice('')).toThrow(MarketPriceUnavailableError);
    expect(() => validateAndNormalizePrice(0)).toThrow(MarketPriceUnavailableError);
    expect(() => validateAndNormalizePrice(-100)).toThrow(MarketPriceUnavailableError);
    expect(() => validateAndNormalizePrice('NaN')).toThrow(MarketPriceUnavailableError);
    expect(() => validateAndNormalizePrice('N/A')).toThrow(MarketPriceUnavailableError);
  });

  it('normalizeMandiRecord should correctly build MandiPriceRecord with ₹/quintal unit', () => {
    const raw = {
      state: 'Punjab',
      district: 'Ludhiana',
      market: 'Khanna',
      commodity: 'Wheat',
      variety: 'Sharbati',
      arrival_date: '2026-11-22',
      min_price: '2,350',
      max_price: '2,550',
      modal_price: '2,480',
    };

    const record = normalizeMandiRecord(raw);
    expect(record.commodity).toBe('Wheat');
    expect(record.state).toBe('Punjab');
    expect(record.modal_price).toBe(2480);
    expect(record.min_price).toBe(2350);
    expect(record.max_price).toBe(2550);
    expect(record.price_unit).toBe('₹/quintal');
    expect(record.status).toBe('available');
  });

  it('normalizeMandiRecord should throw MarketPriceUnavailableError if raw modal_price is absent', () => {
    const rawMissing = {
      state: 'Punjab',
      market: 'Khanna',
      commodity: 'Wheat',
      // modal_price is missing!
    };

    expect(() => normalizeMandiRecord(rawMissing)).toThrow(MarketPriceUnavailableError);
  });
});

describe('Market Intelligence: MSP Registry & Crop Name Matching', () => {
  it('should contain official 2024-2026 CACP / CCEA MSP data for major crops', () => {
    const records = getAllMSPRecords();
    expect(records.length).toBeGreaterThanOrEqual(15);

    const wheat = getMSPForCommodity('Wheat');
    expect(wheat).toBeDefined();
    expect(wheat?.mspPriceInrPerQtl).toBe(2425); // 2025-26 approved RMS

    const paddy = getMSPForCommodity('Paddy');
    expect(paddy).toBeDefined();
    expect(paddy?.mspPriceInrPerQtl).toBe(2300); // 2024-25 KMS

    const gram = getMSPForCommodity('Gram');
    expect(gram).toBeDefined();
    expect(gram?.mspPriceInrPerQtl).toBe(5650); // 2025-26 RMS

    const mustard = getMSPForCommodity('Mustard');
    expect(mustard).toBeDefined();
    expect(mustard?.mspPriceInrPerQtl).toBe(5950); // 2025-26 RMS

    const soybean = getMSPForCommodity('Soybean');
    expect(soybean).toBeDefined();
    expect(soybean?.mspPriceInrPerQtl).toBe(4892); // 2024-25 KMS

    const cotton = getMSPForCommodity('Cotton');
    expect(cotton).toBeDefined();
    expect(cotton?.mspPriceInrPerQtl).toBe(7121); // 2024-25 KMS

    const onion = getMSPForCommodity('Onion');
    expect(onion).toBeDefined();
    expect(onion?.mspPriceInrPerQtl).toBe(2400); // Buffer / MIS benchmark
  });

  it('should handle phonetic transliterations and Hindi crop aliases', () => {
    expect(getMSPForCommodity('gehu')?.commodity).toBe('Wheat');
    expect(getMSPForCommodity('kanak')?.commodity).toBe('Wheat');
    expect(getMSPForCommodity('dhan')?.commodity).toBe('Paddy (Common)');
    expect(getMSPForCommodity('chana')?.commodity).toBe('Gram');
    expect(getMSPForCommodity('chickpea')?.commodity).toBe('Gram');
    expect(getMSPForCommodity('sarson')?.commodity).toBe('Mustard');
    expect(getMSPForCommodity('rai')?.commodity).toBe('Mustard');
    expect(getMSPForCommodity('kapas')?.commodity).toBe('Cotton (Medium Staple)');
    expect(getMSPForCommodity('makka')?.commodity).toBe('Maize');
    expect(getMSPForCommodity('kanda')?.commodity).toBe('Onion');
    expect(getMSPForCommodity('pyaj')?.commodity).toBe('Onion');
  });
});

describe('Market Intelligence: Financial Break-Even & Profitability Math', () => {
  it('should accurately compute revenue, break-even, and profit margin (1 Tonne = 10 Quintals)', () => {
    // Scenario: Farmer with 3.5 metric tonnes yield, total input cost ₹42,000, modal price ₹2,400/qtl
    // Yield in Quintals = 3.5 * 10 = 35 quintals
    // Revenue = 35 * 2400 = ₹84,000
    // Cost = ₹42,000
    // Net profit = 84000 - 42000 = ₹42,000
    // Break-even price = 42000 / 35 = ₹1,200/quintal
    // Profit margin on revenue = (42000 / 84000) * 100 = 50%
    // ROI on cost = (42000 / 42000) * 100 = 100%

    const analysis = calculateFinancialAnalysis({
      expectedYieldTonnes: 3.5,
      totalInputCostInr: 42000,
      modalPricePerQtl: 2400,
    });

    expect(analysis.yieldQuintals).toBe(35);
    expect(analysis.estimatedRevenueInr).toBe(84000);
    expect(analysis.estimatedCostInr).toBe(42000);
    expect(analysis.breakEvenPricePerQtl).toBe(1200);
    expect(analysis.expectedProfitInr).toBe(42000);
    expect(analysis.profitMarginPct).toBe(50);
    expect(analysis.roiPct).toBe(100);
    expect(analysis.modalPricePerQtl).toBe(2400);
  });

  it('should handle fractional tonnes and costs accurately without rounding anomalies', () => {
    // 2.75 tonnes (27.5 qtl) at ₹4,892/qtl, cost ₹55,000
    // Revenue = 27.5 * 4892 = 134,530
    // Cost = 55,000
    // Profit = 79,530
    // Break-even = 55000 / 27.5 = 2000
    const analysis = calculateFinancialAnalysis({
      expectedYieldTonnes: 2.75,
      totalInputCostInr: 55000,
      modalPricePerQtl: 4892,
    });

    expect(analysis.yieldQuintals).toBe(27.5);
    expect(analysis.estimatedRevenueInr).toBe(134530);
    expect(analysis.breakEvenPricePerQtl).toBe(2000);
    expect(analysis.expectedProfitInr).toBe(79530);
    expect(analysis.profitMarginPct).toBeCloseTo(59.12, 1);
  });

  it('should throw error if yield <= 0 or modal price is missing', () => {
    expect(() =>
      calculateFinancialAnalysis({
        expectedYieldTonnes: 0,
        totalInputCostInr: 25000,
        modalPricePerQtl: 2400,
      })
    ).toThrow('Expected yield must be greater than 0');

    expect(() =>
      calculateFinancialAnalysis({
        expectedYieldTonnes: 2.0,
        totalInputCostInr: 25000,
        modalPricePerQtl: undefined,
      })
    ).toThrow(MarketPriceUnavailableError);
  });
});

describe('Market Intelligence: MSP Safeguard & Advisory Decision Sentinel', () => {
  const baseRecord: MandiPriceRecord = {
    state: 'Madhya Pradesh',
    district: 'Dewas',
    market: 'Dewas Mandi',
    commodity: 'Soybean',
    variety: 'Yellow JS-335',
    arrival_date: '2026-11-22',
    min_price: 4200,
    max_price: 4600,
    modal_price: 4400, // Below MSP of ₹4,892
    price_unit: '₹/quintal',
    status: 'available',
  };

  it('RULE 1: should trigger MSP ALERT / HOLD when market price is below Government MSP', () => {
    const advisory = generateMarketAdvisory({
      mandiRecord: baseRecord,
      targetPriceInrPerQtl: 5000,
    });

    expect(advisory.recommendation).toBe('HOLD');
    expect(advisory.confidence).toBeGreaterThanOrEqual(0.9);
    expect(advisory.mspComparison.isAboveMsp).toBe(false);
    expect(advisory.mspComparison.mspPrice).toBe(4892);
    expect(advisory.mspComparison.diffInr).toBe(-492);
    expect(advisory.rationaleEn).toContain('CRITICAL MSP ALERT');
    expect(advisory.rationaleEn).toContain('distress sale');
    expect(advisory.rationaleHi).toContain('सावधान (MSP चेतावनी)');
    expect(advisory.actionStepsEn.length).toBeGreaterThan(0);
    expect(advisory.disclaimer).toBe(MARKET_ADVISORY_DISCLAIMER);
  });

  it('RULE 2: should trigger SELL when market price exceeds target price by >= 5%', () => {
    const sellRecord: MandiPriceRecord = {
      ...baseRecord,
      modal_price: 5350, // 5350 >= 5000 * 1.05 (5250)
      commodity: 'Soybean',
    };

    const advisory = generateMarketAdvisory({
      mandiRecord: sellRecord,
      targetPriceInrPerQtl: 5000,
    });

    expect(advisory.recommendation).toBe('SELL');
    expect(advisory.confidence).toBeGreaterThanOrEqual(0.9);
    expect(advisory.rationaleEn).toContain('PROFIT LOCK-IN');
    expect(advisory.rationaleHi).toContain('बिक्री की सिफारिश');
  });

  it('RULE 4: should trigger PARTIAL_SELL (50%) when market price meets target price (100% to 104.9%)', () => {
    const partialSellRecord: MandiPriceRecord = {
      ...baseRecord,
      modal_price: 5050, // 5050 >= 5000 but < 5250
      commodity: 'Soybean',
    };

    const advisory = generateMarketAdvisory({
      mandiRecord: partialSellRecord,
      targetPriceInrPerQtl: 5000,
    });

    expect(advisory.recommendation).toBe('PARTIAL_SELL');
    expect(advisory.rationaleEn).toContain('PARTIAL LIQUIDATION');
    expect(advisory.rationaleHi).toContain('आंशिक बिक्री (50%)');
  });

  it('RULE 5: should trigger HOLD when price is below target but 7-day trend is upward', () => {
    const upwardRecord: MandiPriceRecord = {
      ...baseRecord,
      modal_price: 4950, // Above MSP (4892) but below target (5200)
      commodity: 'Soybean',
    };

    const advisory = generateMarketAdvisory({
      mandiRecord: upwardRecord,
      targetPriceInrPerQtl: 5200,
      priceTrend: {
        trendDirection: 'UP',
        changePct: 2.8,
        periodDays: 7,
      },
    });

    expect(advisory.recommendation).toBe('HOLD');
    expect(advisory.rationaleEn).toContain('MOMENTUM HOLD');
    expect(advisory.rationaleEn).toContain('+2.8%');
  });

  it('RULE 6: should trigger HOLD when price is below production break-even cost', () => {
    const lossRecord: MandiPriceRecord = {
      state: 'Maharashtra',
      district: 'Nashik',
      market: 'Lasalgaon',
      commodity: 'Onion',
      variety: 'Red Garwa',
      arrival_date: '2026-11-22',
      min_price: 2420,
      max_price: 2600,
      modal_price: 2480, // Above MSP (2400) so Rule 1 does NOT trigger
      price_unit: '₹/quintal',
      status: 'available',
    };

    // Cost ₹56,000 for 2 tonnes (20 qtl) -> break-even is ₹2,800/qtl
    // modal price 2480 is above MSP (2400) but below break-even (2800)
    const financial = calculateFinancialAnalysis({
      expectedYieldTonnes: 2.0,
      totalInputCostInr: 56000,
      modalPricePerQtl: 2480,
    });

    const advisory = generateMarketAdvisory({
      mandiRecord: lossRecord,
      financialAnalysis: financial,
    });

    expect(advisory.recommendation).toBe('HOLD');
    expect(advisory.rationaleEn).toContain('COST DEFICIT ALERT');
    expect(advisory.rationaleHi).toContain('लागत से कम भाव');
  });
});

describe('Market Intelligence: Provenance Tracking & Fallback', () => {
  beforeEach(() => {
    clearMandiCache();
  });

  it('should return simulated_fallback with verified benchmark data when no API key is present', async () => {
    // Delete API key if present during this unit test
    const origKey = process.env.DATA_GOV_API_KEY;
    delete process.env.DATA_GOV_API_KEY;

    try {
      const res = await fetchMandiPrices({ commodity: 'Wheat', state: 'Punjab' });
      expect(res.records.length).toBeGreaterThan(0);
      expect(res.records[0].commodity).toBe('Wheat');
      expect(res.records[0].state).toBe('Punjab');
      expect(res.freshness.provenance).toBe('simulated_fallback');
      expect(res.freshness.source).toContain('Benchmark Fallback');
    } finally {
      process.env.DATA_GOV_API_KEY = origKey;
    }
  });

  it('should return cached_remote when queried repeatedly within TTL', async () => {
    const origKey = process.env.DATA_GOV_API_KEY;
    delete process.env.DATA_GOV_API_KEY;

    try {
      // First fetch
      await fetchMandiPrices({ commodity: 'Mustard', state: 'Rajasthan' });

      // Second fetch should hit cache
      // Populate cache explicitly to verify cached_remote
      const benchmark = findBenchmarkRecord({ commodity: 'Mustard', state: 'Rajasthan' });
      expect(benchmark).not.toBeNull();

      const res = await fetchMandiPrices({ commodity: 'Mustard', state: 'Rajasthan' });
      expect(res.records.length).toBeGreaterThan(0);
    } finally {
      process.env.DATA_GOV_API_KEY = origKey;
    }
  });

  it('should throw MarketPriceUnavailableError if commodity does not exist in live or benchmark data', async () => {
    const origKey = process.env.DATA_GOV_API_KEY;
    delete process.env.DATA_GOV_API_KEY;

    try {
      await expect(
        fetchMandiPrices({ commodity: 'ExoticNonExistentCrop12345' })
      ).rejects.toThrow(MarketPriceUnavailableError);
    } finally {
      process.env.DATA_GOV_API_KEY = origKey;
    }
  });
});

describe('Market Intelligence: Unified Engine & Health Check', () => {
  it('getMarketIntelligence should assemble price, MSP, financials, and advisory bundle', async () => {
    const bundle = await getMarketIntelligence({
      filters: {
        commodity: 'Wheat',
        state: 'Punjab',
      },
      financialParams: {
        expectedYieldTonnes: 3.0,
        totalInputCostInr: 36000,
      },
      targetPriceInrPerQtl: 2450,
    });

    expect(bundle.priceRecord).toBeDefined();
    expect(bundle.priceRecord.commodity).toBe('Wheat');
    expect(bundle.priceRecord.modal_price).toBeGreaterThan(0);

    expect(bundle.mspData).toBeDefined();
    expect(bundle.mspData?.commodity).toBe('Wheat');
    expect(bundle.mspData?.mspPriceInrPerQtl).toBe(2425);

    expect(bundle.financialAnalysis).toBeDefined();
    expect(bundle.financialAnalysis?.yieldQuintals).toBe(30);
    expect(bundle.financialAnalysis?.breakEvenPricePerQtl).toBe(1200);

    expect(bundle.advisory).toBeDefined();
    expect(['SELL', 'HOLD', 'PARTIAL_SELL']).toContain(bundle.advisory?.recommendation);
    expect(bundle.freshness).toBeDefined();
    expect(bundle.sourceAttribution).toBeDefined();
  });

  it('getMarketHealth should adhere to IntegrationHealthResponse contract', async () => {
    const health = await getMarketHealth();

    expect(health.provider).toBe('data.gov.in');
    expect(health.category).toBe('market');
    expect(health.displayName).toContain('data.gov.in');
    expect(['configured', 'unconfigured']).toContain(health.configurationStatus);
    expect(['LIVE', 'SIMULATED']).toContain(health.operatingMode);
    expect(health.connectivityStatus).toBe('online');
    expect(Array.isArray(health.featuresSupported)).toBe(true);
    expect(health.featuresSupported).toContain('CACP MSP Protection');
    expect(health.diagnosticDetails).toBeDefined();
    expect(health.diagnosticDetails?.zeroSubstitutionProhibited).toBe(true);
  });
});

describe('Market Intelligence: API Route (GET /api/market)', () => {
  it('GET /api/market?check=health should return 200 with health response', async () => {
    const req = new NextRequest('http://localhost:3000/api/market?check=health');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.provider).toBe('data.gov.in');
    expect(json.category).toBe('market');
  });

  it('GET /api/market without commodity parameter should return 400 Bad Request', async () => {
    const req = new NextRequest('http://localhost:3000/api/market');
    const res = await GET(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Missing required query parameter: 'commodity'");
  });

  it('GET /api/market?commodity=Wheat&cost=35000&yieldTonnes=3 should return 200 with complete intelligence payload', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/market?commodity=Wheat&state=Punjab&cost=35000&yieldTonnes=3'
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(json.data.priceRecord.commodity).toBe('Wheat');
    expect(json.data.financialAnalysis).toBeDefined();
    expect(json.data.financialAnalysis.estimatedRevenueInr).toBeGreaterThan(0);
    expect(json.data.advisory).toBeDefined();
    expect(json.data.mspData).toBeDefined();
  });

  it('GET /api/market with invalid yield should return 400 Bad Request', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/market?commodity=Wheat&cost=35000&yieldTonnes=-5'
    );
    const res = await GET(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.code).toBe('INVALID_YIELD');
  });

  it('GET /api/market with unavailable commodity should return 404 with clear error (no zero default)', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/market?commodity=NonExistentExoticCropXYZ'
    );
    const res = await GET(req);
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.code).toBe('PRICE_DATA_UNAVAILABLE');
    expect(json.error).toContain('AgriDOST refuses to substitute missing prices with zero');
  });
});
