/**
 * AgriDOST 4.0: TinyFish AI Web Intelligence Contracts & Domain Types
 * Integration #8: Production-grade live agricultural web search, content extraction,
 * and goal-directed browser research.
 */

import { IntegrationOperatingMode, DataFreshnessMetadata } from './integrations';

// ==============================================================================
// 1. Raw TinyFish API Types & Wire Schemas
// ==============================================================================

export interface TinySearchResultItem {
  position: number;
  title: string;
  url: string;
  snippet: string;
  site_name?: string;
  date?: string;
}

export interface TinySearchResponse {
  query: string;
  results: TinySearchResultItem[];
  total_results: number;
  page: number;
}

export interface TinySearchOptions {
  query: string;
  location?: string; // Default: 'IN'
  language?: string; // Default: 'en'
  include_domains?: string[];
  exclude_domains?: string[];
  recency_minutes?: number;
  after_date?: string;
  timeoutMs?: number;
  bypassCache?: boolean;
}

export interface TinyFetchResultItem {
  url: string;
  final_url?: string;
  title?: string | null;
  description?: string | null;
  language?: string | null;
  text: string;
  author?: string | null;
  published_date?: string | null;
  latency_ms?: number;
  format?: 'markdown' | 'text' | 'html';
}

export interface TinyFetchResponse {
  results: TinyFetchResultItem[];
  errors: Array<{ url: string; error: string }>;
}

export interface TinyFetchOptions {
  urls: string[];
  format?: 'markdown' | 'text' | 'html';
  timeoutMs?: number;
  bypassCache?: boolean;
}

export type TinyAgentRunStatus = 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'RUNNING' | 'PENDING';

export interface TinyAgentRunResponse<T = Record<string, unknown> | string> {
  run_id: string;
  status: TinyAgentRunStatus;
  started_at?: string;
  finished_at?: string;
  num_of_steps?: number;
  result?: T;
  error?: string | Record<string, unknown> | null;
}

export interface TinyAgentRunOptions {
  url: string;
  goal: string;
  max_steps?: number;
  browser_profile?: 'lite' | 'stealth';
  timeoutMs?: number;
}

// ==============================================================================
// 2. Source Classification & Provenance
// ==============================================================================

export type SourceClassification =
  | 'official_gov'          // pmkisan.gov.in, agmarknet.gov.in, data.gov.in, pib.gov.in, etc.
  | 'state_agri_dept'       // krishi.maharashtra.gov.in, upagripardarshi.gov.in, etc.
  | 'icar_kvk_research'     // icar.org.in, tnausip.ac.in, pau.edu, etc.
  | 'mandi_board'           // msamb.com, apmc.punjab.gov.in, etc.
  | 'reputable_agri_media'  // krishijagran.com, thehindubusinessline.com, etc.
  | 'secondary';            // other blogs, forums, unverified aggregators

export interface AgriculturalResearchSource {
  url: string;
  title: string;
  snippet: string;
  siteName: string;
  sourceClassification: SourceClassification;
  isOfficial: boolean;
  retrievedAt: string;
  freshness: 'live' | 'cached' | 'fallback';
}

// ==============================================================================
// 3. Domain Agricultural Intelligence Types
// ==============================================================================

export type AgriculturalResearchCategory =
  | 'mandi'
  | 'schemes'
  | 'crop_advisory'
  | 'market_trends';

export interface AgriculturalIntelligenceQuery {
  category: AgriculturalResearchCategory;
  query: string;
  state?: string;
  commodity?: string;
  district?: string;
  forceFresh?: boolean;
}

export interface AgriculturalResearchResult {
  query: string;
  category: AgriculturalResearchCategory;
  summary: string;
  sources: AgriculturalResearchSource[];
  structuredData?: Record<string, unknown>;
  provenance: DataFreshnessMetadata['provenance'];
  retrievedAt: string;
  provider: 'tinyfish';
  operatingMode: IntegrationOperatingMode;
  confidenceScore?: number;
  warnings?: string[];
  cached?: boolean;
  latencyMs?: number;
}

// ==============================================================================
// 4. Persistence Record Contract (Supabase & LocalStorage)
// ==============================================================================

export interface AgriculturalWebResearchRecord {
  id: string;
  query: string;
  category: AgriculturalResearchCategory;
  provider: 'tinyfish';
  source_url: string;
  source_name: string;
  source_type: SourceClassification;
  is_official: boolean;
  extracted_summary: string;
  structured_data: Record<string, unknown>;
  retrieved_at: string;
  expires_at: string;
  status: 'active' | 'expired' | 'purged';
  created_at?: string;
  updated_at?: string;
}
