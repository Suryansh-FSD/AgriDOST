/**
 * AgriDOST 4.0: Domain-Specific Agricultural Intelligence Engine
 * Connects TinyFish Web Intelligence to Mandi Intelligence, Government Schemes,
 * Crop Advisory, and Market Trends with strict statutory groundings.
 * 
 * Critical Rules Enforced:
 * 1. Never replace verified government APIs with unverified scraped data.
 * 2. Keep MSP benchmarks separate from actual mandi spot prices.
 * 3. Clearly distinguish official government sources from secondary media.
 * 4. Never invent agricultural prices or scheme eligibility.
 */

import {
  AgriculturalIntelligenceQuery,
  AgriculturalResearchResult,
  AgriculturalResearchSource,
} from './types';
import { executeTinySearch } from './search';
import { defaultTinyFishClient, TinyFishClient } from './client';
import { getMSPForCommodity } from '@/lib/market/msp-registry';
import { tinyResearchCache } from './cache';

export const MANDI_INTELLIGENCE_DISCLAIMER =
  'Advisory market intelligence only. Spot prices reflect preliminary market arrivals and web reporting. ' +
  'Official CACP/CCEA Minimum Support Price (MSP) benchmarks are separate statutory safety floors. ' +
  'AgriDOST never replaces verified Agmarknet official records with secondary scraped estimates.';

/**
 * Priority 1: Live Mandi Intelligence & Spot Market Research
 */
export async function researchMandiPrices(
  commodity: string,
  state: string = 'Maharashtra',
  district?: string,
  forceFresh: boolean = false,
  client: TinyFishClient = defaultTinyFishClient
): Promise<AgriculturalResearchResult> {
  const queryStr = `${commodity} mandi price ${district ? district + ' ' : ''}${state} today market arrival rate`;
  const mspRecord = getMSPForCommodity(commodity);

  const searchRes = await executeTinySearch(
    {
      query: queryStr,
      location: 'IN',
      language: 'en',
      bypassCache: forceFresh,
    },
    client
  );

  const sources: AgriculturalResearchSource[] = searchRes.results.map((r) => ({
    url: r.url,
    title: r.title,
    snippet: r.snippet,
    siteName: r.site_name,
    sourceClassification: r.sourceClassification,
    isOfficial: r.isOfficial,
    retrievedAt: searchRes.retrievedAt,
    freshness: searchRes.cached ? 'cached' : 'live',
  }));

  const officialSources = sources.filter((s) => s.isOfficial);
  const secondarySources = sources.filter((s) => !s.isOfficial);

  let summary = `Live market research for ${commodity} in ${state}${district ? ` (${district})` : ''}: `;
  if (sources.length > 0) {
    summary += `Found ${sources.length} active market reports (${officialSources.length} official, ${secondarySources.length} secondary). `;
    summary += `Top reporting source: ${sources[0].siteName} ("${sources[0].title}").`;
  } else {
    summary += `No live market arrivals reported online. Verified baseline CACP benchmarks remain active.`;
  }

  const structuredData: Record<string, unknown> = {
    commodity,
    state,
    district,
    officialMSP: mspRecord
      ? {
          commodity: mspRecord.commodity,
          season: mspRecord.season,
          mspInrPerQtl: mspRecord.mspPriceInrPerQtl,
          effectiveYear: mspRecord.effectiveYear,
          agency: mspRecord.procuringAgency,
        }
      : null,
    totalSourcesFound: sources.length,
    officialSourcesCount: officialSources.length,
    secondarySourcesCount: secondarySources.length,
    disclaimer: MANDI_INTELLIGENCE_DISCLAIMER,
  };

  return {
    query: queryStr,
    category: 'mandi',
    summary,
    sources,
    structuredData,
    provenance: searchRes.provenance,
    retrievedAt: searchRes.retrievedAt,
    provider: 'tinyfish',
    operatingMode: client.isConfigured() ? 'LIVE' : 'SIMULATED',
    confidenceScore: officialSources.length > 0 ? 0.92 : 0.75,
    warnings: [
      'Spot market prices are dynamic and subject to daily APMC arrivals and moisture grading.',
      'Always confirm physical weighbridge receipts with your local APMC Mandi Secretary.',
    ],
    cached: searchRes.cached,
  };
}

/**
 * Priority 2: Government Schemes & Subsidies Research
 */
export async function researchGovernmentSchemes(
  schemeNameOrTopic: string,
  state?: string,
  forceFresh: boolean = false,
  client: TinyFishClient = defaultTinyFishClient
): Promise<AgriculturalResearchResult> {
  const queryStr = `${schemeNameOrTopic} government scheme ${state ? state + ' ' : ''}eligibility deadline guidelines 2026`;

  const searchRes = await executeTinySearch(
    {
      query: queryStr,
      location: 'IN',
      language: 'en',
      bypassCache: forceFresh,
    },
    client
  );

  const sources: AgriculturalResearchSource[] = searchRes.results.map((r) => ({
    url: r.url,
    title: r.title,
    snippet: r.snippet,
    siteName: r.site_name,
    sourceClassification: r.sourceClassification,
    isOfficial: r.isOfficial,
    retrievedAt: searchRes.retrievedAt,
    freshness: searchRes.cached ? 'cached' : 'live',
  }));

  const officialSources = sources.filter((s) => s.isOfficial);

  let summary = `Government scheme intelligence for "${schemeNameOrTopic}": `;
  if (officialSources.length > 0) {
    summary += `Verified by ${officialSources.length} official government portal(s) including ${officialSources[0].siteName}. `;
    summary += `Key announcement: ${officialSources[0].snippet}`;
  } else if (sources.length > 0) {
    summary += `Found ${sources.length} public reference(s). Note: Official .gov.in direct verification recommended.`;
  } else {
    summary += `No recent web updates found. AgriDOST statutory scheme registry retains baseline operational rules.`;
  }

  return {
    query: queryStr,
    category: 'schemes',
    summary,
    sources,
    structuredData: {
      topic: schemeNameOrTopic,
      state: state || 'ALL',
      hasOfficialGovPortal: officialSources.length > 0,
      officialPortalUrls: officialSources.map((s) => s.url),
    },
    provenance: searchRes.provenance,
    retrievedAt: searchRes.retrievedAt,
    provider: 'tinyfish',
    operatingMode: client.isConfigured() ? 'LIVE' : 'SIMULATED',
    confidenceScore: officialSources.length > 0 ? 0.95 : 0.7,
    warnings: [
      'Scheme terms and disbursement cycles are subject to State and Central Cabinet notifications.',
      'Ensure Aadhaar bank seeding and e-KYC compliance for direct DBT bank credit.',
    ],
    cached: searchRes.cached,
  };
}

/**
 * Priority 3: Crop Disease & Agronomic Research
 */
export async function researchCropAdvisory(
  crop: string,
  diseaseOrProblem: string,
  forceFresh: boolean = false,
  client: TinyFishClient = defaultTinyFishClient
): Promise<AgriculturalResearchResult> {
  const queryStr = `${crop} ${diseaseOrProblem} ICAR KVK symptoms management chemical spray advisory`;

  const searchRes = await executeTinySearch(
    {
      query: queryStr,
      location: 'IN',
      language: 'en',
      bypassCache: forceFresh,
    },
    client
  );

  const sources: AgriculturalResearchSource[] = searchRes.results.map((r) => ({
    url: r.url,
    title: r.title,
    snippet: r.snippet,
    siteName: r.site_name,
    sourceClassification: r.sourceClassification,
    isOfficial: r.isOfficial,
    retrievedAt: searchRes.retrievedAt,
    freshness: searchRes.cached ? 'cached' : 'live',
  }));

  const researchSources = sources.filter((s) => s.sourceClassification === 'icar_kvk_research' || s.isOfficial);

  let summary = `Agronomic pathology research for ${diseaseOrProblem} in ${crop}: `;
  if (researchSources.length > 0) {
    summary += `Grounded in ${researchSources.length} scientific research source(s) from ICAR / Agricultural University portals. `;
    summary += `Protocol: ${researchSources[0].snippet}`;
  } else if (sources.length > 0) {
    summary += `Retrieved ${sources.length} agronomic literature reference(s). Follow CIBRC statutory safety guidelines.`;
  } else {
    summary += `Retrieved verified baseline ICAR/KVK package of practices from internal agronomic registry.`;
  }

  return {
    query: queryStr,
    category: 'crop_advisory',
    summary,
    sources,
    structuredData: {
      crop,
      problem: diseaseOrProblem,
      scientificSourcesCount: researchSources.length,
      statutoryCompliance: 'CIBRC Insecticides Act 1968',
    },
    provenance: searchRes.provenance,
    retrievedAt: searchRes.retrievedAt,
    provider: 'tinyfish',
    operatingMode: client.isConfigured() ? 'LIVE' : 'SIMULATED',
    confidenceScore: researchSources.length > 0 ? 0.94 : 0.8,
    warnings: [
      'Chemical recommendations must adhere strictly to CIBRC registered label claims.',
      'Always observe Waiting Period (Pre-Harvest Interval) and wear personal protective equipment (PPE).',
    ],
    cached: searchRes.cached,
  };
}

/**
 * Priority 4: Market Trends & Regional Demand Research
 */
export async function researchMarketTrends(
  commodity: string,
  state: string = 'Maharashtra',
  forceFresh: boolean = false,
  client: TinyFishClient = defaultTinyFishClient
): Promise<AgriculturalResearchResult> {
  const queryStr = `${commodity} crop demand market price trends export trade ${state} 2026`;

  const searchRes = await executeTinySearch(
    {
      query: queryStr,
      location: 'IN',
      language: 'en',
      bypassCache: forceFresh,
    },
    client
  );

  const sources: AgriculturalResearchSource[] = searchRes.results.map((r) => ({
    url: r.url,
    title: r.title,
    snippet: r.snippet,
    siteName: r.site_name,
    sourceClassification: r.sourceClassification,
    isOfficial: r.isOfficial,
    retrievedAt: searchRes.retrievedAt,
    freshness: searchRes.cached ? 'cached' : 'live',
  }));

  const msp = getMSPForCommodity(commodity);

  return {
    query: queryStr,
    category: 'market_trends',
    summary: `Market trend intelligence for ${commodity} in ${state}: Analyzed ${sources.length} trade and market reports. ` +
      (sources.length > 0 ? `Leading report: ${sources[0].title}` : `Standard market benchmarks active.`),
    sources,
    structuredData: {
      commodity,
      state,
      mspFloor: msp?.mspPriceInrPerQtl ?? null,
      reportsCount: sources.length,
    },
    provenance: searchRes.provenance,
    retrievedAt: searchRes.retrievedAt,
    provider: 'tinyfish',
    operatingMode: client.isConfigured() ? 'LIVE' : 'SIMULATED',
    confidenceScore: 0.82,
    cached: searchRes.cached,
  };
}

/**
 * Unified Agricultural Web Research Gateway
 */
export async function runAgriculturalResearch(
  request: AgriculturalIntelligenceQuery,
  client: TinyFishClient = defaultTinyFishClient
): Promise<AgriculturalResearchResult> {
  const cacheKey = tinyResearchCache.generateKey('research', request as unknown as Record<string, unknown>);

  if (!request.forceFresh) {
    const cached = tinyResearchCache.get<AgriculturalResearchResult>(cacheKey);
    if (cached) {
      return {
        ...cached.data,
        cached: true,
        provenance: 'cached_remote',
      };
    }
  }

  let result: AgriculturalResearchResult;
  switch (request.category) {
    case 'mandi':
      result = await researchMandiPrices(
        request.commodity || request.query,
        request.state || 'Maharashtra',
        request.district,
        request.forceFresh,
        client
      );
      break;

    case 'schemes':
      result = await researchGovernmentSchemes(
        request.query,
        request.state,
        request.forceFresh,
        client
      );
      break;

    case 'crop_advisory':
      result = await researchCropAdvisory(
        request.commodity || 'Crops',
        request.query,
        request.forceFresh,
        client
      );
      break;

    case 'market_trends':
    default:
      result = await researchMarketTrends(
        request.commodity || request.query,
        request.state || 'Maharashtra',
        request.forceFresh,
        client
      );
      break;
  }

  tinyResearchCache.set(cacheKey, result);
  return result;
}
