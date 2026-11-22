# AgriDOST 4.0: External Integration Engineering Master Plan

**Date:** November 22, 2026  
**Architect:** Agent 0 (Principal Engineering Orchestrator)  
**Baseline Quality Record:** 342 Passing Vitest Tests | 0 TypeScript Errors | Next.js 16.4.6 Production Build Clean  
**Final Production Verification:** 541 Passing Vitest Tests (19 test files) | 0 TypeScript Errors | Production Build Clean across 19 Routes

---

## 1. Executive Overview & Architectural Guardrails

AgriDOST 4.0 integrates six mission-critical external engineering integrations to scale India's precision agriculture operating system:
1. **Supabase:** Cloud PostgreSQL database, Row Level Security, offline-to-cloud synchronization, retry queues.
2. **Google Gemini:** Vision diagnostic, multilingual advisories, dynamic candidate model failover, Zod schema validation.
3. **Open-Meteo Weather:** Farm coordinate weather, rainfall/wind telemetry, spray window safety gates, caching.
4. **Data.gov.in Mandi Market Intelligence:** Official daily commodity spot prices, MSP comparison, profit & financial advisory.
5. **Telegram Bot API:** Farmer notification delivery, explicit opt-in/opt-out consent, webhook processing, duplicate protection.
6. **Google Maps JavaScript API:** Interactive satellite/hybrid cadastres, GeoJSON boundary rendering, SVG fallback.

### Golden Rules
- **No Direct Modification of Shared Core by Specialists:** Specialist subagents work within isolated file trees (`src/lib/<specialty>/*`, `src/app/api/<specialty>/*`, `tests/<specialty>-*.test.ts`).
- **No Broken Baselines:** The existing 342 tests must continuously pass. Every agent must add unit & mock integration tests.
- **Data Provenance & Anti-Fabrication:** Never silently substitute missing external values with zeroes or fabricate credentials. Clearly label data as `LIVE`, `SIMULATED`, or `OFFLINE`.
- **Honest Health Reporting:** Every integration implements the `IntegrationHealthResponse` contract.

---

## 2. Team Structure & Strict File Ownership

| Agent | Specialty | Primary Responsibility | Exclusive Directory & File Ownership | Model |
|---|---|---|---|---|
| **Agent 0** | Principal Architect / Orchestrator | Coordination, shared contracts, master plan, UI integration, regression testing | `src/types/integrations.ts`, `src/types/index.ts`, `src/lib/integrations/*`, `src/app/api/integrations/*`, `docs/*`, shared UI | Lead |
| **Agent 1** | Supabase Specialist | Database schema, RLS, offline-sync adapters, retry queue, connection health | `supabase/migrations/20261122_agridost_core.sql`, `src/lib/supabase/*`, `tests/supabase-*.test.ts`, `SUPABASE_AGENT_REPORT.md` | Sonnet / Pro |
| **Agent 2** | Gemini AI Specialist | Gemini SDK client, model failover, timeout/retry, Zod validation, prompt grounding | `src/lib/ai/*`, `src/app/api/ai/*`, `tests/ai-*.test.ts`, `GEMINI_AGENT_REPORT.md` | Sonnet / Pro |
| **Agent 3** | Weather Specialist | Open-Meteo API client, coordinate forecasts, caching, spray safety index | `src/lib/weather/*`, `src/app/api/weather/*`, `src/types/weather.ts`, `tests/weather-*.test.ts`, `WEATHER_AGENT_REPORT.md` | Sonnet / Pro |
| **Agent 4** | Market Intelligence Specialist | data.gov.in Mandi ingestion, price normalization, break-even & profit math, MSP check | `src/lib/market/*`, `src/app/api/market/*`, `src/types/market.ts`, `tests/market-*.test.ts`, `MARKET_AGENT_REPORT.md` | Sonnet / Pro |
| **Agent 5** | Telegram Specialist | Telegram Bot API client, webhook handler, farmer consent & opt-in/opt-out, idempotency | `src/lib/telegram/*`, `src/app/api/telegram/*`, `src/types/telegram.ts`, `tests/telegram-*.test.ts`, `TELEGRAM_AGENT_REPORT.md` | Sonnet / Pro |
| **Agent 6** | Google Maps Specialist | Google Maps JS loader, satellite/hybrid modes, GeoJSON overlay sync, SVG fallback | `src/lib/maps/*`, `src/components/map/GoogleFarmMap.tsx`, `src/types/maps.ts`, `tests/maps-*.test.ts`, `MAPS_AGENT_REPORT.md` | Sonnet / Pro |
| **Agent 7** | Independent QA & Security Specialist | Security audit, RLS verification, secret exposure check, test coverage, defect reporting | `docs/INTEGRATION_SECURITY_REVIEW.md`, `docs/INTEGRATION_QA_REPORT.md` | Sonnet / Pro |

---

## 3. Shared Integration Health Contract

Located at `src/types/integrations.ts`:
```typescript
export type IntegrationOperatingMode =
  | 'LIVE'
  | 'SIMULATED'
  | 'OFFLINE'
  | 'NOT_CONFIGURED'
  | 'ERROR';

export type ConfigurationStatus = 'configured' | 'unconfigured' | 'partial';
export type ConnectivityStatus = 'online' | 'offline' | 'unreachable' | 'degraded';

export interface DataFreshnessMetadata {
  timestamp?: string;
  ageSeconds?: number;
  isStale?: boolean;
  source?: string;
  provenance?: 'live_api' | 'cached_remote' | 'simulated_fallback' | 'offline_deterministic';
}

export interface IntegrationHealthResponse {
  provider: string;
  displayName: string;
  category: 'database' | 'ai' | 'weather' | 'market' | 'messaging' | 'geospatial' | 'automation';
  configurationStatus: ConfigurationStatus;
  connectivityStatus: ConnectivityStatus;
  operatingMode: IntegrationOperatingMode;
  lastSuccessfulCheck: string | null;
  lastError: string | null;
  latencyMs?: number;
  dataFreshness?: DataFreshnessMetadata;
  featuresSupported?: string[];
  diagnosticDetails?: Record<string, unknown>;
}
```

---

## 4. Execution Plan & Batching Strategy

To balance parallel agent limits and prevent workspace thrashing:
- **Batch 1 (Data & Intelligence Foundations):**
  - Agent 1: Supabase Specialist (Core schema, migrations, RLS, sync queue)
  - Agent 2: Gemini AI Specialist (Model verification, candidate failover, Zod schema validation)
  - Agent 3: Weather Specialist (Open-Meteo client, cache, drone weather safety)
- **Batch 2 (Market, Communications & Geospatial):**
  - Agent 4: Market Intelligence Specialist (data.gov.in Mandi client, price normalization, advisory)
  - Agent 5: Telegram Specialist (Bot client, consent, webhook, delivery tracking)
  - Agent 6: Google Maps Specialist (Interactive Maps loader, satellite view, SVG fallback)
- **Batch 3 (Review, Integration & Hardening):**
  - Agent 7: Independent QA & Security Specialist (Audit reports, security review, regression verification)
  - Agent 0: Controlled Orchestration Integration into App UI, End-to-End Scenarios A-E, Final Docs.

---

## 5. Acceptance Criteria by Agent

### Agent 1 (Supabase)
- [x] Comprehensive migration `20261122_agridost_core.sql` covering farms, zones, crop_plans, health_records, tasks, supplies, tree_plans, spray_operations.
- [x] Explicit RLS policies with farmer isolation (`auth.uid() = farmer_id`).
- [x] Safe remote client and offline LocalStorage synchronization with conflict resolution.
- [x] Retry queue for offline-queued mutations.
- [x] Health status endpoint adhering to `IntegrationHealthResponse`.
- [x] Zero credential leaks; 100% offline fallback when credentials are absent.
- [x] Passing test suite in `tests/supabase-core-integration.test.ts`.
- [x] `SUPABASE_AGENT_REPORT.md` written.

### Agent 2 (Gemini AI)
- [x] Inspect existing implementation in `src/app/api/ai/health` and `src/app/api/ai/schemes`.
- [x] Verify live API model availability (testing candidate `gemini-3.8-flash` vs `gemini-2.5-flash`/`gemini-2.0-flash` etc. dynamically).
- [x] Configurable timeout (default 12s) and exponential backoff retry.
- [x] Strict Zod schema validation on structured AI output.
- [x] Multilingual Hindi and English output support.
- [x] Deterministic fallback diagnostic guide when offline or quota exceeded.
- [x] Passing test suite in `tests/ai-gemini-integration.test.ts`.
- [x] `GEMINI_AGENT_REPORT.md` written.

### Agent 3 (Weather)
- [x] Farm coordinate weather fetching via Open-Meteo free API (`temperature_2m`, `relative_humidity_2m`, `precipitation`, `precipitation_probability`, `wind_speed_10m`, `wind_direction_10m`).
- [x] In-memory and storage cache with TTL (15 minutes) and freshness metadata.
- [x] CIBRC-compliant drone spray advisory calculation (safe wind < 15 km/h, no rain > 0mm, temp 15-35°C).
- [x] Never automatically initiate spraying (strict human confirmation flag required).
- [x] Full offline deterministic fallback with realistic seasonal weather patterns.
- [x] Passing test suite in `tests/weather-integration.test.ts`.
- [x] `WEATHER_AGENT_REPORT.md` written.

### Agent 4 (Market Intelligence)
- [x] data.gov.in Agmarknet mandi daily spot price integration (`src/lib/market/client.ts`).
- [x] Support state, district, market, commodity, variety filters.
- [x] Normalization of `modal_price`, `min_price`, `max_price` per quintal.
- [x] Strict distinction between `LIVE` data and `SIMULATED` historical benchmarks. Never replace missing price with 0.
- [x] Financial advisory math: estimated revenue = yield * modal_price; production cost; break-even price; net profit; sell/hold advisory.
- [x] Advisory-only notice (never financial guarantee).
- [x] Passing test suite in `tests/market-intelligence-integration.test.ts`.
- [x] `MARKET_AGENT_REPORT.md` written.

### Agent 5 (Telegram)
- [x] Telegram Bot API client (`sendMessage`, `setWebhook`, `getMe`).
- [x] Farmer opt-in/opt-out consent tracking (`farmer_telegram_registrations`).
- [x] Verification of webhook payloads (secret token validation).
- [x] Server-side token protection (never exposed in client bundles).
- [x] Idempotent delivery protection (24h duplicate message prevention).
- [x] Bilingual notification templates (English + Hindi) for alerts (weather, crop disease, schemes, mandi prices).
- [x] Passing test suite in `tests/telegram-integration.test.ts`.
- [x] `TELEGRAM_AGENT_REPORT.md` written.

### Agent 6 (Google Maps)
- [x] Google Maps JS API script loader with idempotency and error boundary.
- [x] Support roadmap, satellite, and hybrid view modes.
- [x] Turf.js polygon overlay rendering for farm boundaries and zones.
- [x] Zone click selection synchronized with AgriDOST state.
- [x] Seamless vector SVG fallback when API key is missing or offline.
- [x] Passing test suite in `tests/maps-integration.test.ts`.
- [x] `MAPS_AGENT_REPORT.md` written.

### Agent 7 (QA & Security)
- [x] Independent code review of all specialist deliverables.
- [x] Secret exposure audit across `.env.*`, client bundle manifests, and public endpoints.
- [x] RLS policy audit against malicious spoofing (`auth.uid()` vs input `farmer_id`).
- [x] Verification of data provenance and offline integrity.
- [x] Output `docs/INTEGRATION_SECURITY_REVIEW.md` and `docs/INTEGRATION_QA_REPORT.md`.
