/**
 * AgriDOST 4.0: Market Intelligence & Mandi Integration Entry Point
 * 
 * Re-exports:
 * - Data.gov.in Agmarknet API client & caching (`client.ts`)
 * - CACP / CCEA Minimum Support Price (MSP) Registry (`msp-registry.ts`)
 * - Profitability, Break-Even & Liquidation Advisory Engine (`intelligence.ts`)
 * - Health check evaluator for master integration registry
 */

import {
  MarketQueryFilters,
  FinancialCalculationParams,
  MarketIntelligenceResult,
} from '@/types/market';
import { fetchMandiPrices, getMarketHealth } from './client';
import { getMSPForCommodity } from './msp-registry';
import {
  calculateFinancialAnalysis,
  generateMarketAdvisory,
  MarketPriceUnavailableError,
} from './intelligence';

export * from './client';
export * from './msp-registry';
export * from './intelligence';

export interface FullMarketIntelligenceOptions {
  filters: MarketQueryFilters;
  financialParams?: FinancialCalculationParams;
  targetPriceInrPerQtl?: number;
  priceTrend?: {
    trendDirection: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';
    changePct?: number;
    periodDays?: number;
  };
}

/**
 * Unified pipeline for fetching mandi prices, calculating farm economics,
 * comparing against MSP floors, and generating deterministic harvest advisories.
 */
export async function getMarketIntelligence(
  options: FullMarketIntelligenceOptions
): Promise<MarketIntelligenceResult> {
  const { filters, financialParams, targetPriceInrPerQtl, priceTrend } = options;

  // 1. Fetch Mandi Price Record (Live -> Cache -> Benchmark Fallback)
  const fetchResult = await fetchMandiPrices(filters);
  const priceRecord = fetchResult.records[0];

  if (!priceRecord || priceRecord.modal_price <= 0) {
    throw new MarketPriceUnavailableError(
      `No valid modal price found for '${filters.commodity}'. AgriDOST prohibits defaulting missing prices to zero.`
    );
  }

  // 2. Resolve MSP Record
  const mspData = getMSPForCommodity(priceRecord.commodity);

  // 3. Compute Financial Analysis if parameters supplied
  let financialAnalysis = undefined;
  if (financialParams && financialParams.expectedYieldTonnes > 0) {
    financialAnalysis = calculateFinancialAnalysis({
      ...financialParams,
      modalPricePerQtl: priceRecord.modal_price,
    });
  }

  // 4. Generate Harvest Advisory
  const advisory = generateMarketAdvisory({
    mandiRecord: priceRecord,
    mspData,
    financialAnalysis,
    targetPriceInrPerQtl,
    priceTrend,
  });

  return {
    query: filters,
    priceRecord,
    mspData,
    financialAnalysis,
    advisory,
    freshness: fetchResult.freshness,
    sourceAttribution: fetchResult.source,
  };
}
