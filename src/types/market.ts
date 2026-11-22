/**
 * AgriDOST 4.0: Market Intelligence Contracts
 * Government Mandi Data (data.gov.in / Agmarknet), Minimum Support Price (MSP) Registry,
 * and Agricultural Profitability / Break-Even Advisory.
 */

import { DataFreshnessMetadata, IntegrationHealthResponse } from './integrations';

/**
 * Normalized Mandi Price Record in INR per quintal (₹/qtl)
 * 1 Quintal = 100 kg. 1 Metric Tonne = 10 Quintals.
 */
export interface MandiPriceRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  arrival_date: string;
  min_price: number; // ₹/quintal
  max_price: number; // ₹/quintal
  modal_price: number; // ₹/quintal (most common transaction price)
  price_unit: '₹/quintal';
  status: 'available' | 'unavailable';
  rawRecord?: Record<string, unknown>;
}

/**
 * Raw data schema returned by data.gov.in Agmarknet Daily Price Resource
 * Resource ID: 9ef84268-d588-465a-a308-a864a43d0070
 */
export interface RawDataGovMandiRecord {
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  variety?: string;
  arrival_date?: string;
  min_price?: string | number;
  max_price?: string | number;
  modal_price?: string | number;
  [key: string]: unknown;
}

export interface DataGovApiResponse {
  status: string;
  total?: number;
  count?: number;
  limit?: string | number;
  offset?: string | number;
  records?: RawDataGovMandiRecord[];
  desc?: string;
  version?: string;
  message?: string;
}

/**
 * Query parameters for searching Agmarknet mandi prices
 */
export interface MarketQueryFilters {
  commodity: string;
  state?: string;
  district?: string;
  market?: string;
  variety?: string;
  limit?: number;
}

/**
 * Parameters for farmer farm profitability & break-even calculation
 */
export interface FinancialCalculationParams {
  expectedYieldTonnes: number; // In metric tonnes (1 tonne = 10 quintals)
  totalInputCostInr: number; // Total input cost (seeds, fertilizer, labor, fuel, pesticide)
  modalPricePerQtl?: number; // Market modal price in ₹/quintal
  farmerTargetPriceInrPerQtl?: number; // Farmer's desired sale price in ₹/quintal
}

/**
 * Financial breakdown and break-even analysis
 */
export interface FinancialAnalysis {
  estimatedRevenueInr: number;
  estimatedCostInr: number;
  breakEvenPricePerQtl: number;
  expectedProfitInr: number;
  profitMarginPct: number; // (Profit / Revenue) * 100
  yieldQuintals: number;
  modalPricePerQtl: number;
  roiPct: number; // (Profit / Cost) * 100
}

/**
 * CACP / Cabinet Committee on Economic Affairs (CCEA) Official Minimum Support Price (MSP)
 */
export interface MSPCropRecord {
  commodity: string;
  variety?: string;
  hindiName: string;
  season: 'Kharif' | 'Rabi' | 'Commercial' | 'All';
  mspPriceInrPerQtl: number;
  effectiveYear: string; // e.g., "2024-25" | "2025-26"
  procuringAgency: string; // e.g. "FCI / NAFED / CCI"
  descriptionEn: string;
  descriptionHi: string;
  officialSource: string;
}

/**
 * Actionable advisory recommendation for farmer harvest liquidation
 */
export type MarketAdvisoryRecommendation = 'SELL' | 'HOLD' | 'PARTIAL_SELL';

export interface MarketAdvisory {
  recommendation: MarketAdvisoryRecommendation;
  confidence: number; // 0.00 to 1.00
  rationaleEn: string;
  rationaleHi: string;
  mspComparison: {
    mspPrice: number;
    diffInr: number;
    diffPct: number;
    isAboveMsp: boolean;
    crop: string;
    procuringAgency?: string;
  };
  priceTrend: {
    trendDirection: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';
    changePct?: number;
    periodDays?: number;
  };
  actionStepsEn: string[];
  actionStepsHi: string[];
  disclaimer: string;
  generatedAt: string;
}

/**
 * Full Market Intelligence Bundle for a requested crop / market
 */
export interface MarketIntelligenceResult {
  query: MarketQueryFilters;
  priceRecord: MandiPriceRecord;
  mspData: MSPCropRecord | null;
  financialAnalysis?: FinancialAnalysis;
  advisory?: MarketAdvisory;
  freshness: DataFreshnessMetadata;
  sourceAttribution: string;
}

/**
 * API Response returned by /api/market
 */
export interface MarketApiResponse {
  success: boolean;
  data?: MarketIntelligenceResult;
  health?: IntegrationHealthResponse;
  error?: string;
  code?: string;
  message?: string;
}
