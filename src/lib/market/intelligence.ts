/**
 * AgriDOST 4.0: Market Intelligence & Financial Advisory Engine
 * 
 * Provides:
 * 1. Strict Price Normalization and Validation (Never substitute missing prices with 0)
 * 2. Farm Profitability & Break-Even Economics
 * 3. MSP Floor Protection Sentinel (Anti-Distress Selling Logic)
 * 4. Deterministic Bilingual Harvest Liquidation Advisory (SELL, HOLD, PARTIAL_SELL)
 * 5. Statutory Advisory Disclaimer (Zero Autonomous Trading)
 */

import {
  MandiPriceRecord,
  FinancialCalculationParams,
  FinancialAnalysis,
  MarketAdvisory,
  MarketAdvisoryRecommendation,
  MSPCropRecord,
} from '@/types/market';
import { getMSPForCommodity } from './msp-registry';

/**
 * Standard Statutory AgriDOST Market Advisory Disclaimer
 */
export const MARKET_ADVISORY_DISCLAIMER =
  'Advisory calculation only. AgriDOST market advisory is a deterministic agronomic decision-support tool ' +
  'based on Agmarknet mandi data and Government CACP/CCEA Minimum Support Price (MSP) benchmarks. ' +
  'It does not constitute a guaranteed financial return, trading contract, or autonomous transaction instruction. ' +
  'Physical harvest liquidation decisions remain exclusively with the farmer.';

export const MARKET_ADVISORY_DISCLAIMER_HI =
  'केवल सलाहकार गणना। एग्रीदोस्त मंडी सलाह एग्मार्कनेट बाजार भावों और सरकारी न्यूनतम समर्थन मूल्य (MSP) ' +
  'पर आधारित एक मार्गदर्शक उपकरण है। यह किसी वित्तीय लाभ की गारंटी या स्वतः लेन-देन का निर्देश नहीं है। ' +
  'फसल बिक्री का अंतिम निर्णय पूरी तरह किसान के अपने विवेक पर निर्भर है।';

/**
 * Custom Error for missing or invalid market prices
 * Enforces CRITICAL RULE: NEVER silently substitute missing prices with zero!
 */
export class MarketPriceUnavailableError extends Error {
  public readonly code = 'PRICE_DATA_UNAVAILABLE';
  constructor(
    message: string = 'Current market price is missing or invalid. AgriDOST strictly prohibits silently substituting missing prices with zero.'
  ) {
    super(message);
    this.name = 'MarketPriceUnavailableError';
  }
}

/**
 * Validates and normalizes price numbers
 * Throws MarketPriceUnavailableError if missing, NaN, null, undefined, or <= 0
 */
export function validateAndNormalizePrice(
  price: unknown,
  fieldName: string = 'modal_price'
): number {
  if (price === null || price === undefined || price === '') {
    throw new MarketPriceUnavailableError(
      `Market price field '${fieldName}' is missing. Cannot proceed with financial or advisory evaluation.`
    );
  }

  let num: number;
  if (typeof price === 'number') {
    num = price;
  } else if (typeof price === 'string') {
    // Strip commas, then match numeric digits including optional decimal
    const withoutCommas = price.replace(/,/g, '').trim();
    const match = withoutCommas.match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      throw new MarketPriceUnavailableError(
        `Market price field '${fieldName}' contains no valid numeric value (${price}).`
      );
    }
    num = parseFloat(match[0]);
  } else {
    throw new MarketPriceUnavailableError(
      `Market price field '${fieldName}' is not a valid number or numeric string.`
    );
  }

  if (isNaN(num) || !isFinite(num) || num <= 0) {
    throw new MarketPriceUnavailableError(
      `Market price field '${fieldName}' evaluated to invalid value (${price}). AgriDOST strictly forbids defaulting missing or zero prices.`
    );
  }

  return Math.round(num * 100) / 100;
}

/**
 * Calculates Farm Profitability, Revenue, and Break-Even Price
 * 
 * Formulas:
 * 1 Metric Tonne = 10 Quintals
 * Yield in Quintals = expectedYieldTonnes * 10
 * Revenue = Yield in Quintals * modalPricePerQtl
 * Cost = totalInputCostInr
 * Break-even Price Per Quintal = Cost / Yield in Quintals
 * Expected Profit = Revenue - Cost
 * Profit Margin % = (Profit / Revenue) * 100
 * ROI % = (Profit / Cost) * 100
 */
export function calculateFinancialAnalysis(
  params: FinancialCalculationParams
): FinancialAnalysis {
  const { expectedYieldTonnes, totalInputCostInr, modalPricePerQtl } = params;

  if (modalPricePerQtl === undefined || modalPricePerQtl === null) {
    throw new MarketPriceUnavailableError(
      'Cannot calculate financial analysis without a valid modal price per quintal.'
    );
  }

  const validModalPrice = validateAndNormalizePrice(modalPricePerQtl, 'modalPricePerQtl');

  if (expectedYieldTonnes <= 0) {
    throw new Error('Expected yield must be greater than 0 metric tonnes.');
  }

  if (totalInputCostInr < 0) {
    throw new Error('Total input cost cannot be negative.');
  }

  // 1 tonne = 10 quintals
  const yieldQuintals = expectedYieldTonnes * 10;
  const estimatedRevenueInr = Math.round(yieldQuintals * validModalPrice);
  const estimatedCostInr = Math.round(totalInputCostInr);
  const expectedProfitInr = estimatedRevenueInr - estimatedCostInr;

  // Break-even price per quintal
  const breakEvenPricePerQtl = Math.round((estimatedCostInr / yieldQuintals) * 100) / 100;

  // Profit margin on revenue: (Profit / Revenue) * 100
  const profitMarginPct =
    estimatedRevenueInr > 0
      ? Math.round((expectedProfitInr / estimatedRevenueInr) * 10000) / 100
      : 0;

  // Return on Investment (ROI) on cost: (Profit / Cost) * 100
  const roiPct =
    estimatedCostInr > 0
      ? Math.round((expectedProfitInr / estimatedCostInr) * 10000) / 100
      : 0;

  return {
    estimatedRevenueInr,
    estimatedCostInr,
    breakEvenPricePerQtl,
    expectedProfitInr,
    profitMarginPct,
    yieldQuintals,
    modalPricePerQtl: validModalPrice,
    roiPct,
  };
}

/**
 * Generates Deterministic Harvest Liquidation Advisory (SELL | HOLD | PARTIAL_SELL)
 */
export function generateMarketAdvisory(params: {
  mandiRecord: MandiPriceRecord;
  mspData?: MSPCropRecord | null;
  financialAnalysis?: FinancialAnalysis;
  targetPriceInrPerQtl?: number;
  priceTrend?: {
    trendDirection: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';
    changePct?: number;
    periodDays?: number;
  };
}): MarketAdvisory {
  const { mandiRecord, mspData, financialAnalysis, targetPriceInrPerQtl, priceTrend } = params;

  // 1. Strict modal price validation
  const currentModalPrice = validateAndNormalizePrice(
    mandiRecord.modal_price,
    'mandiRecord.modal_price'
  );

  // 2. Resolve MSP Record if not explicitly passed
  const activeMsp = mspData ?? getMSPForCommodity(mandiRecord.commodity);
  const mspPrice = activeMsp ? activeMsp.mspPriceInrPerQtl : null;

  // MSP Comparison metrics
  let diffInr = 0;
  let diffPct = 0;
  let isAboveMsp = true;

  if (mspPrice) {
    diffInr = Math.round((currentModalPrice - mspPrice) * 100) / 100;
    diffPct = Math.round(((currentModalPrice - mspPrice) / mspPrice) * 10000) / 100;
    isAboveMsp = currentModalPrice >= mspPrice;
  }

  // Trend analysis
  const trend = priceTrend || {
    trendDirection: 'UNKNOWN' as const,
    changePct: 0,
    periodDays: 7,
  };

  const cropName = mandiRecord.commodity;
  const mandiName = mandiRecord.market;

  let recommendation: MarketAdvisoryRecommendation;
  let confidence: number;
  let rationaleEn: string;
  let rationaleHi: string;
  const actionStepsEn: string[] = [];
  const actionStepsHi: string[] = [];

  // 3. Core Deterministic Decision Tree

  // RULE 1: MSP Distress Protection Sentinel (Highest Priority)
  // If market price is strictly below the Government Minimum Support Price
  if (mspPrice && currentModalPrice < mspPrice) {
    recommendation = 'HOLD';
    confidence = 0.95;
    const agency = activeMsp?.procuringAgency || 'NAFED / FCI / State Civil Supplies';
    const deficitInr = Math.abs(diffInr);

    rationaleEn =
      `CRITICAL MSP ALERT: Current mandi modal price (₹${currentModalPrice}/qtl) is ₹${deficitInr}/qtl below ` +
      `the official Government MSP of ₹${mspPrice}/qtl (${activeMsp?.effectiveYear || '2024-26'}). ` +
      `Selling in the open mandi now would result in a distress sale. Hold harvest and redirect to an official ` +
      `MSP procurement center (${agency}).`;

    rationaleHi =
      `सावधान (MSP चेतावनी): वर्तमान मंडी भाव (₹${currentModalPrice}/क्विंटल) सरकारी न्यूनतम समर्थन मूल्य (₹${mspPrice}/क्विंटल) ` +
      `से ₹${deficitInr}/क्विंटल कम है। खुले बाजार में औने-पौने दाम पर बेचने से बचें। फसल को रोकें और ` +
      `सरकारी खरीद केंद्र (${agency}) पर एमएसपी पर बेचें।`;

    actionStepsEn.push(
      `Register on the State MSP Procurement portal (e-Uparjan / Food Odisha / e-Kharid / KMS/RMS portal) with Aadhaar & Land Record.`,
      `Inspect moisture content (must be ≤ 12% to meet FAQ standards).`,
      `If storage is dry and pest-free, hold stock for at least 10–14 days for procurement centers to mobilize.`
    );

    actionStepsHi.push(
      `आधार और खतौनी/भूलेख के साथ राज्य के ई-उपार्जन / ई-खरीद पोर्टल पर सरकारी खरीद हेतु स्लॉट बुक करें।`,
      `फसल में नमी की जांच करें (FAQ मानकों के अनुसार नमी 12% से कम होनी चाहिए)।`,
      `यदि सुरक्षित व सूखा भंडार उपलब्ध है, तो 10-14 दिन फसल रोकें ताकि सरकारी केंद्र शुरू हो सकें।`
    );
  }
  // RULE 2: Target Price Premium Surplus (SELL RECOMMENDED)
  // When price meets or exceeds target price by 5% or more
  else if (targetPriceInrPerQtl && currentModalPrice >= targetPriceInrPerQtl * 1.05) {
    recommendation = 'SELL';
    confidence = 0.92;
    const surplus = currentModalPrice - targetPriceInrPerQtl;

    rationaleEn =
      `PROFIT LOCK-IN: Current mandi price of ₹${currentModalPrice}/qtl exceeds your target price ` +
      `(₹${targetPriceInrPerQtl}/qtl) by ₹${surplus}/qtl (+${Math.round((surplus / targetPriceInrPerQtl) * 100)}%). ` +
      `Favorable open market rates offer strong profit margins. Selling harvest now is recommended to lock in returns.`;

    rationaleHi =
      `बिक्री की सिफारिश: वर्तमान मंडी भाव ₹${currentModalPrice}/क्विंटल आपके लक्ष्य भाव (₹${targetPriceInrPerQtl}/क्विंटल) ` +
      `से ₹${surplus}/क्विंटल अधिक है। बाजार में मजबूत मांग और प्रीमियम भाव का लाभ उठाते हुए पूरी उपज बेचने की सलाह दी जाती है।`;

    actionStepsEn.push(
      `Grade and clean grain/produce to capture top modal price at ${mandiName}.`,
      `Generate e-NAM gate pass online to avoid long queues at physical APMC gate.`,
      `Compare neighboring mandis within 25 km before final dispatch.`
    );

    actionStepsHi.push(
      `${mandiName} मंडी में उच्चतम भाव पाने के लिए उपज की ग्रेडिंग और छनाई करें।`,
      `मंडी गेट पर कतार से बचने हेतु ई-नाम (e-NAM) पर ऑनलाइन गेट पास जनरेट करें।`,
      `माल रवाना करने से पहले 25 किमी के दायरे की नजदीकी मंडियों के भावों की तुलना करें।`
    );
  }
  // RULE 3: Break-Even Healthy Margin (When no target price, but price >= 125% of break-even)
  else if (
    !targetPriceInrPerQtl &&
    financialAnalysis &&
    currentModalPrice >= financialAnalysis.breakEvenPricePerQtl * 1.25
  ) {
    recommendation = 'SELL';
    confidence = 0.88;
    const profitQtl = currentModalPrice - financialAnalysis.breakEvenPricePerQtl;

    rationaleEn =
      `HEALTHY MARGIN: Current modal price of ₹${currentModalPrice}/qtl provides a ₹${Math.round(profitQtl)}/qtl ` +
      `margin above your calculated production break-even cost of ₹${financialAnalysis.breakEvenPricePerQtl}/qtl. ` +
      `Selling harvest now locks in a healthy ${financialAnalysis.profitMarginPct}% profit margin.`;

    rationaleHi =
      `बिक्री की सिफारिश: वर्तमान भाव ₹${currentModalPrice}/क्विंटल आपकी प्रति क्विंटल लागत (₹${financialAnalysis.breakEvenPricePerQtl}/क्विंटल) ` +
      `से ₹${Math.round(profitQtl)} अधिक है, जिससे ${financialAnalysis.profitMarginPct}% का शुद्ध लाभ सुनिश्चित होता है।`;

    actionStepsEn.push(
      `Bring produce to ${mandiName} during peak morning trading hours (9 AM - 12 PM).`,
      `Request e-NAM electronic weighing to prevent tare weight deduction loss.`
    );

    actionStepsHi.push(
      `सुबह के मुख्य व्यापारिक समय (9 से 12 बजे) के दौरान उपज को ${mandiName} में लाएं।`,
      `तौल में किसी भी कटौती से बचने के लिए ई-नाम इलेक्ट्रॉनिक धर्मकांटा पर तौल कराएं।`
    );
  }
  // RULE 4: Target Price Reached Stable (PARTIAL SELL 50%)
  // When price meets target price (>= 100% but < 105%)
  else if (
    targetPriceInrPerQtl &&
    currentModalPrice >= targetPriceInrPerQtl &&
    currentModalPrice < targetPriceInrPerQtl * 1.05
  ) {
    recommendation = 'PARTIAL_SELL';
    confidence = 0.85;

    rationaleEn =
      `PARTIAL LIQUIDATION: Current price of ₹${currentModalPrice}/qtl has reached your target price ` +
      `(₹${targetPriceInrPerQtl}/qtl). Liquidate 50% of stock to recover input investments, and retain 50% ` +
      `to capitalize on further market upside.`;

    rationaleHi =
      `आंशिक बिक्री (50%): वर्तमान भाव ₹${currentModalPrice}/क्विंटल आपके लक्ष्य भाव के बराबर पहुंच गया है। ` +
      `लागत की भरपाई के लिए 50% उपज बेचें और शेष 50% आगे भाव बढ़ने की संभावना के लिए सुरक्षित रखें।`;

    actionStepsEn.push(
      `Sell 50% stock immediately to settle operational loans and cash obligations.`,
      `Bag and treat the remaining 50% with neem oil / standard grain protectants for 3–4 weeks storage.`
    );

    actionStepsHi.push(
      `खेती की लागत और ऋण चुकाने के लिए 50% माल तुरंत बेचें।`,
      `शेष 50% अनाज को नीम के तेल या कीटनाशक धूमन के साथ 3-4 सप्ताह सुरक्षित भंडारित करें।`
    );
  }
  // RULE 5: Upward Trend with Price Below Target (HOLD FOR UPSIDE)
  else if (
    targetPriceInrPerQtl &&
    currentModalPrice < targetPriceInrPerQtl &&
    (trend.trendDirection === 'UP' || (trend.changePct && trend.changePct > 0))
  ) {
    recommendation = 'HOLD';
    confidence = 0.82;
    const trendText = trend.changePct ? `(+${trend.changePct}% in ${trend.periodDays || 7} days)` : 'upward';

    rationaleEn =
      `MOMENTUM HOLD: Current price (₹${currentModalPrice}/qtl) is below target (₹${targetPriceInrPerQtl}/qtl), ` +
      `but market arrivals show an upward momentum ${trendText}. Holding harvest is recommended to capture higher returns.`;

    rationaleHi =
      `रोकने की सलाह (बढ़ता रुझान): वर्तमान भाव (₹${currentModalPrice}/क्विंटल) लक्ष्य भाव से कम है, परंतु पिछले ` +
      `दिनों में बाजार में तेजी का रुख ${trendText} देखा गया है। बेहतर भाव मिलने तक फसल रोकें।`;

    actionStepsEn.push(
      `Monitor daily mandi price bulletins on AgriDOST or Agmarknet.`,
      `Ensure grain storage moisture remains below 12% to prevent mold and moisture loss.`
    );

    actionStepsHi.push(
      `एग्रीदोस्त पर प्रतिदिन सुबह 8 बजे मंडी भाव अपडेट ट्रैक करें।`,
      `अनाज को फफूंद व कीटों से बचाने के लिए भंडारण में नमी 12% से नीचे बनाए रखें।`
    );
  }
  // RULE 6: Below Break-Even Cost of Production (HOLD - LOSS AVOIDANCE)
  else if (financialAnalysis && currentModalPrice < financialAnalysis.breakEvenPricePerQtl) {
    recommendation = 'HOLD';
    confidence = 0.89;
    const lossPerQtl = Math.round(financialAnalysis.breakEvenPricePerQtl - currentModalPrice);

    rationaleEn =
      `COST DEFICIT ALERT: Current modal price of ₹${currentModalPrice}/qtl is below your break-even cost ` +
      `of ₹${financialAnalysis.breakEvenPricePerQtl}/qtl (estimated loss of ₹${lossPerQtl}/qtl). ` +
      `Do not liquidate harvest at a net negative margin unless immediate liquidity is mandatory.`;

    rationaleHi =
      `लागत से कम भाव: वर्तमान भाव ₹${currentModalPrice}/क्विंटल आपकी प्रति क्विंटल लागत (₹${financialAnalysis.breakEvenPricePerQtl}/क्विंटल) ` +
      `से कम है (प्रति क्विंटल ₹${lossPerQtl} का नुकसान)। जब तक अत्यंत आवश्यकता न हो, घाटे में न बेचें।`;

    actionStepsEn.push(
      `Explore pledge financing (e-NWR warehouse receipt loans) under WDRA to get immediate liquidity without selling produce.`,
      `Hold produce in scientific cold storage / accredited warehouses.`
    );

    actionStepsHi.push(
      `फसल बेचे बिना पैसे की जरूरत पूरी करने के लिए ई-एनडब्ल्यूआर (e-NWR) वेयरहाउस रसीद पर बैंक ऋण लें।`,
      `मान्यता प्राप्त सरकारी या निजी गोदाम में फसल भंडारित करें।`
    );
  }
  // RULE 7: Balanced / Neutral Market
  else {
    recommendation = 'PARTIAL_SELL';
    confidence = 0.78;

    rationaleEn =
      `BALANCED STABILIZATION: Market price of ₹${currentModalPrice}/qtl is in a stable range relative to benchmarks. ` +
      `A phased 50% staggered sale hedges against unforeseen supply surges while securing operating capital.`;

    rationaleHi =
      `संतुलित बाजार: वर्तमान भाव ₹${currentModalPrice}/क्विंटल स्थिर श्रेणी में है। ` +
      `भविष्य की अनिश्चितता और कीमतों के उतार-चढ़ाव से बचने हेतु 50% चरणबद्ध बिक्री करें।`;

    actionStepsEn.push(
      `Stagger sales across 2–3 intervals over the next fortnight.`,
      `Check arrival volume at ${mandiName} before loading transport.`
    );

    actionStepsHi.push(
      `अगले 15 दिनों में 2-3 किस्तों में चरणबद्ध तरीके से उपज बेचें।`,
      `वाहन में माल लोड करने से पहले ${mandiName} में दैनिक आवक की मात्रा जांच लें।`
    );
  }

  return {
    recommendation,
    confidence,
    rationaleEn,
    rationaleHi,
    mspComparison: {
      mspPrice: mspPrice || 0,
      diffInr,
      diffPct,
      isAboveMsp,
      crop: cropName,
      procuringAgency: activeMsp?.procuringAgency,
    },
    priceTrend: trend,
    actionStepsEn,
    actionStepsHi,
    disclaimer: MARKET_ADVISORY_DISCLAIMER,
    generatedAt: new Date().toISOString(),
  };
}
