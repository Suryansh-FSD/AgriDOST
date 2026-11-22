/**
 * AgriDOST 4.0: Market Intelligence & Mandi Price Advisory Workflow
 * Version 1.0.0
 * 
 * Provides:
 * 1. Deterministic mandi price evaluation engine (MSP safeguard, target profit, and 7-day trend momentum).
 * 2. Event envelope creation with deterministic idempotency keys.
 * 3. Simulated offline workflow execution for zero-network testing and fallback.
 * 4. Bilingual (English & Hindi) farmer advisory generation with official source attribution (Agmarknet / e-NAM).
 * 5. Strict safety policy: Never executes financial transactions or commodity sales autonomously. Advisory only.
 */

import {
  N8nEventEnvelope,
  N8nEventType,
  N8nExecutionRecord,
  MarketIntelligencePayload,
  N8nWorkflowDefinition,
} from '@/types';

export type MarketRecommendationAction =
  | 'SELL RECOMMENDED'
  | 'PARTIAL SELL (50%)'
  | 'HOLD (Price trending upward)'
  | 'MSP ALERT / HOLD'
  | 'HOLD (Market below target price)'
  | 'DATA UNAVAILABLE';

export interface MarketAdvisoryResult {
  action: MarketRecommendationAction;
  commodityName: string;
  targetMandi: string;
  state: string;
  currentPrice: number;
  targetPrice: number;
  mspPrice?: number;
  priceDiffFromTarget: number;
  priceDiffPct: number;
  trend7DaysPct?: number;
  headline: string;
  recommendation: string;
  rationale: string;
  bilingualMessage: {
    en: string;
    hi: string;
  };
  officialAttribution: {
    source: string;
    observedAt: string;
  };
  safetyNotice: string;
  evaluatedAt: string;
}

export const SAFETY_DISCLAIMER =
  'AgriDOST market recommendations are strictly advisory based on published APMC/Agmarknet data. AgriDOST never executes autonomous financial trades or commodity sales. Farmer retains exclusive selling authority.';

export const SAFETY_DISCLAIMER_HI =
  'एग्रीदोस्त की बाजार सिफारिशें पूरी तरह से प्रकाशित एपीएमसी/एगमार्कनेट डेटा पर आधारित सलाहकारी हैं। एग्रीदोस्त कभी भी स्वचालित वित्तीय लेनदेन या उपज बिक्री नहीं करता है। अंतिम निर्णय किसान का ही होता है।';

/**
 * Evaluates mandi price against farmer target price and Minimum Support Price (MSP)
 * using deterministic rules. Supports both wrapped and unwrapped payloads, preserving
 * actual modal, minimum, maximum, MSP, and target prices.
 */
export function evaluateMandiPrice(input: MarketIntelligencePayload | Record<string, unknown>): MarketAdvisoryResult {
  // Support wrapped envelopes (e.g. { body: { payload: ... } }, { payload: ... }, or flat)
  const rawBody = (input && typeof input === 'object' && 'body' in input && typeof (input as any).body === 'object') ? (input as any).body : null;
  const p = (rawBody && rawBody.payload && typeof rawBody.payload === 'object')
    ? rawBody.payload
    : (input && typeof input === 'object' && 'payload' in input && typeof (input as any).payload === 'object' && !(input as any).headers)
      ? (input as any).payload
      : (rawBody || input || {});

  const rawCurrent = p.currentMandiPriceInrPerQtl ?? p.currentPriceModal ?? p.modalPriceInrPerQtl ?? p.currentPrice;
  const rawTarget = p.farmerTargetPriceInrPerQtl ?? p.farmerTargetPrice ?? p.targetPrice;
  const rawMsp = p.minSupportPriceInrPerQtl ?? p.mspPrice ?? p.minSupportPrice;
  const rawTrend = p.trend7DaysPct;

  const commodity = p.commodityName || p.commodity || 'Produce';
  const mandi = p.targetMandi || p.mandiName || p.mandi || 'Local Mandi';
  const state = p.state || 'All-India';
  const source = p.priceDataSource || p.dataSource || 'Agmarknet (Govt of India)';
  const dateStr = p.priceObservationDate || new Date().toISOString();

  // Validate price availability: Do not silently replace missing/invalid price with ₹0!
  const hasValidCurrentPrice = rawCurrent !== undefined && rawCurrent !== null && !isNaN(Number(rawCurrent)) && Number(rawCurrent) > 0;

  if (!hasValidCurrentPrice) {
    return {
      action: 'DATA UNAVAILABLE',
      commodityName: commodity,
      targetMandi: mandi,
      state,
      currentPrice: 0,
      targetPrice: Number(rawTarget) || 0,
      mspPrice: rawMsp !== undefined ? Number(rawMsp) : undefined,
      priceDiffFromTarget: 0,
      priceDiffPct: 0,
      trend7DaysPct: rawTrend !== undefined ? Number(rawTrend) : undefined,
      headline: `Price Unavailable: No authenticated price data for ${commodity} at ${mandi}`,
      recommendation: `Current market price data for ${commodity} at ${mandi} is currently unavailable or missing from ${source}.`,
      rationale: 'Cannot generate deterministic sell/hold advisory without authenticated current mandi price. Please verify Agmarknet/e-NAM price observation feed.',
      bilingualMessage: {
        en: `Current market price data for ${commodity} at ${mandi} is currently unavailable or missing from ${source}.`,
        hi: `${commodity} के लिए ${mandi} में वर्तमान मूल्य डेटा उपलब्ध नहीं है। कृपया एगमार्कनेट/ई-नाम डेटा स्रोत की पुष्टि करें।`,
      },
      officialAttribution: {
        source,
        observedAt: dateStr,
      },
      safetyNotice: SAFETY_DISCLAIMER,
      evaluatedAt: new Date().toISOString(),
    };
  }

  const current = Number(rawCurrent);
  const target = rawTarget !== undefined && !isNaN(Number(rawTarget)) ? Number(rawTarget) : 0;
  const msp = rawMsp !== undefined && !isNaN(Number(rawMsp)) ? Number(rawMsp) : undefined;
  const trend = rawTrend !== undefined && !isNaN(Number(rawTrend)) ? Number(rawTrend) : undefined;

  const priceDiffFromTarget = current - target;
  const priceDiffPct = target > 0 ? Number(((priceDiffFromTarget / target) * 100).toFixed(2)) : 0;

  let action: MarketRecommendationAction;
  let headline: string;
  let recommendation: string;
  let rationale: string;
  let messageHi: string;

  // Rule 1: Current price is below MSP (Critical safety priority)
  if (msp !== undefined && current < msp) {
    action = 'MSP ALERT / HOLD';
    headline = `MSP Alert: Open market price (₹${current}/qtl) is below MSP (₹${msp}/qtl)`;
    recommendation = `Current mandi price of ₹${current}/qtl is below Government Minimum Support Price (MSP: ₹${msp}/qtl). Do not distress-sell in open mandi.`;
    rationale = `Register your produce at the nearest official MSP procurement center / NAFED / FCI agency to realize the guaranteed floor price of ₹${msp}/qtl.`;
    messageHi = `एमएसपी चेतावनी (न्यूनतम समर्थन मूल्य): ${commodity} का वर्तमान मंडी भाव (₹${current}/क्विंटल) सरकारी न्यूनतम समर्थन मूल्य (MSP: ₹${msp}/क्विंटल) से कम है। खुली मंडी में घाटे में न बेचें। कृपया निकटतम सरकारी खरीद केंद्र (NAFED/FCI) पर पंजीकरण कराएं।`;
  }
  // Rule 2: Strong sell peak (Current >= Target * 1.05)
  else if (target > 0 && current >= target * 1.05) {
    action = 'SELL RECOMMENDED';
    const gainPct = (((current - target) / target) * 100).toFixed(1);
    headline = `Sell Recommended: Price peak (₹${current}/qtl) is ${gainPct}% above target`;
    recommendation = `Current market price of ₹${current}/qtl exceeds your target price (₹${target}/qtl) by ${gainPct}%. Peak price window is active.`;
    rationale = `Strong demand observed at ${mandi}. Excellent window to liquidate stored inventory and maximize profit margins.`;
    messageHi = `बिक्री की सिफारिश (मजबूत मूल्य): ${commodity} का वर्तमान मंडी भाव (₹${current}/क्विंटल) आपके लक्ष्य मूल्य (₹${target}) से ${gainPct}% अधिक है। ${mandi} में फसल बेचने का यह सर्वोत्तम अवसर है।`;
  }
  // Rule 3: Reached target price (Current >= Target)
  else if (target > 0 && current >= target) {
    action = 'PARTIAL SELL (50%)';
    headline = `Partial Sell (50%): Current price (₹${current}/qtl) reached target price`;
    recommendation = `Current price of ₹${current}/qtl has reached your target price of ₹${target}/qtl.`;
    rationale = `Recommend selling 50% of your available inventory to secure profits, while holding the remaining 50% in case market prices continue upward.`;
    messageHi = `आंशिक बिक्री (50% बेचें): ${commodity} का भाव आपके लक्ष्य मूल्य ₹${target}/क्विंटल पर पहुंच गया है। जोखिम कम करने के लिए 50% स्टॉक बेचकर लाभ पक्का करें और 50% को आगे के लिए रोकें।`;
  }
  // Rule 4: Below target price, but 7-day trend is upward (trend > 0)
  else if (trend !== undefined && trend > 0) {
    action = 'HOLD (Price trending upward)';
    headline = `Hold Stock: Price trending upward (+${trend}% over 7 days)`;
    recommendation = `Current price (₹${current}/qtl) is below your target (₹${target}/qtl), but 7-day price momentum is positive (+${trend}%).`;
    rationale = `Market arrivals are tightening and rates are rising. Hold produce to capitalize on anticipated price recovery.`;
    messageHi = `रोक कर रखें (मूल्य में बढ़ोतरी का रुझान): ${commodity} का भाव (₹${current}) अभी लक्ष्य (₹${target}) से कम है परंतु पिछले 7 दिनों में भाव में सुधार का रुझान (+${trend}%) है। बेहतर भाव मिलने तक उपज रोके रखें।`;
  }
  // Rule 5: Below target price with flat or falling trend
  else {
    action = 'HOLD (Market below target price)';
    headline = `Hold: Current price (₹${current}/qtl) is below target (₹${target}/qtl)`;
    recommendation = `Current mandi price of ₹${current}/qtl has not reached your target price (₹${target}/qtl).`;
    rationale = `Market supply is currently heavy. Hold stored produce in dry warehouse or consider warehouse receipt financing (e-NWR) to avoid distress sales.`;
    messageHi = `रोक कर रखें (बाजार भाव कम): ${commodity} का वर्तमान भाव (₹${current}) आपके लक्ष्य मूल्य (₹${target}) से नीचे है। उपज को सुरक्षित गोदाम में रखें और बाजार में सुधार की प्रतीक्षा करें।`;
  }

  return {
    action,
    commodityName: commodity,
    targetMandi: mandi,
    state,
    currentPrice: current,
    targetPrice: target,
    mspPrice: msp,
    priceDiffFromTarget,
    priceDiffPct,
    trend7DaysPct: trend,
    headline,
    recommendation,
    rationale,
    bilingualMessage: {
      en: recommendation,
      hi: messageHi,
    },
    officialAttribution: {
      source,
      observedAt: dateStr,
    },
    safetyNotice: SAFETY_DISCLAIMER,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Constructs a valid N8nEventEnvelope for Market Intelligence events.
 * Generates deterministic idempotency key format:
 * `market.${type}:${farmId}:${commodity}:${date}`
 */
export function createMarketEvent(
  type: N8nEventType,
  farmId: string,
  payload: MarketIntelligencePayload,
  farmerId: string = 'demo-farmer-01'
): N8nEventEnvelope<MarketIntelligencePayload> {
  const dateStr = payload.priceObservationDate
    ? payload.priceObservationDate.split('T')[0]
    : new Date().toISOString().split('T')[0];
  const commodityStr = payload.commodityName.toLowerCase().trim().replace(/\s+/g, '-');

  // Ensure type starts with 'market.'
  const normalizedType = type.startsWith('market.') ? type : (`market.${type}` as N8nEventType);
  
  // Deterministic Idempotency key
  const idempotencyKey = `${normalizedType}:${farmId}:${commodityStr}:${dateStr}`;

  return {
    eventId: `evt_mkt_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`,
    eventType: normalizedType,
    timestamp: new Date().toISOString(),
    producer: 'agridost-app',
    version: '1.0',
    farmerId,
    farmId,
    payload,
    idempotencyKey,
  };
}

/**
 * Deterministic simulated execution engine matching the n8n workflow behavior.
 * Used for offline mode, zero-network environments, and automated unit testing.
 */
export function executeMarketWorkflow(
  event: N8nEventEnvelope<MarketIntelligencePayload>
): N8nExecutionRecord {
  const startedAt = new Date().toISOString();
  const advisory = evaluateMandiPrice(event.payload);
  const completedAt = new Date().toISOString();

  return {
    id: `exec_mkt_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`,
    eventId: event.eventId,
    eventType: event.eventType,
    workflowId: 'market-intelligence',
    farmId: event.farmId,
    status: 'success',
    startedAt,
    completedAt,
    durationMs: 14,
    inputSummary: `Price check for ${event.payload.commodityName} at ${event.payload.targetMandi}`,
    outputSummary: `${advisory.action}: ${event.payload.commodityName} @ ₹${event.payload.currentMandiPriceInrPerQtl}/qtl (${event.payload.targetMandi}) [Source: ${advisory.officialAttribution.source}]`,
    outputData: {
      advisory,
      payload: event.payload,
      executionNode: 'Mandi Price Comparator',
      safetyVerified: true,
    },
    retryCount: 0,
  };
}

/**
 * Workflow definition metadata for UI integration
 */
export const MARKET_INTELLIGENCE_WORKFLOW_DEF: N8nWorkflowDefinition = {
  id: 'market-intelligence',
  name: 'Market Intelligence & Mandi Price Advisory',
  description:
    'Monitors daily mandi spot prices from Agmarknet/e-NAM, compares against farmer target prices and MSP, and issues timely sell/hold recommendations.',
  category: 'Market',
  supportedEvents: [
    'market.price.check_requested',
    'market.harvest.recorded',
    'market.advisory.generated',
  ],
  webhookPath: 'agridost-market-intelligence',
  active: true,
  version: '1.0.0',
};
