# AgriDOST 4.0: Shared n8n Integration Contract
**Version:** 1.0.0  
**Status:** Canonical Lead Architecture Specification  
**Governing Rule:** All 5 subagents and lead orchestrator must strictly adhere to these interfaces, data contracts, and file boundaries. No agent may independently invent a conflicting API, header, or event envelope.

---

## 1. Architecture Overview

AgriDOST integrates with n8n via a secure, bi-directional, event-driven integration layer:

```
┌─────────────────────────────────────────────────────────────┐
│                       AgriDOST App                          │
│  (Government Assistance, Smart Operations, Market Advisory) │
└──────────────┬──────────────────────────────▲───────────────┘
               │ Event Dispatch               │ Webhook Callback
               │ (HMAC-Signed Payload)        │ (State & Notifications)
               ▼                              │
┌──────────────────────────────┐              │
│    n8n Client / Dispatcher   │              │
│   (src/lib/n8n/client.ts)    │              │
└──────────────┬───────────────┘              │
               │ HTTP POST /webhook           │ POST /api/n8n/callback
               ▼                              │
┌─────────────────────────────────────────────┴───────────────┐
│                    n8n Workflow Engine                      │
│   • Workflow 1: Government Assistance Deadlines & Renewals   │
│   • Workflow 2: Smart Farm Operations & Weather Guard       │
│   • Workflow 3: Market Intelligence & Mandi Price Advisory  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Shared Event Envelope (`N8nEventEnvelope`)

Every event sent from AgriDOST to n8n or received via webhook callback must adhere to this exact JSON schema:

```typescript
export type N8nEventType =
  // 1. Government Assistance Events (Agent B)
  | 'government.application.created'
  | 'government.application.status_changed'
  | 'government.deadline.approaching'
  | 'government.reminder.triggered'

  // 2. Smart Farm Operations Events (Agent C)
  | 'operations.weather.check_requested'
  | 'operations.spray.window_evaluation'
  | 'operations.irrigation.advisory'

  // 3. Market Intelligence Events (Agent D)
  | 'market.price.check_requested'
  | 'market.harvest.recorded'
  | 'market.advisory.generated';

export type N8nProducer = 'agridost-app' | 'agridost-scheduler' | 'n8n-workflow';

export interface N8nEventEnvelope<T = Record<string, unknown>> {
  eventId: string;             // UUID v4 format, e.g. "evt_550e8400-e29b-41d4-a716-446655440000"
  eventType: N8nEventType;
  timestamp: string;           // ISO 8601 string, e.g. "2026-11-22T12:00:00.000Z"
  producer: N8nProducer;
  version: '1.0';
  farmerId: string;            // Authenticated farmer ID or tenant ID (e.g. "demo-farmer-01")
  farmId: string;              // Target farm ID (e.g. "demo-farm-01")
  payload: T;                  // Typed business data (no sensitive credentials)
  idempotencyKey: string;      // Deterministic key: `${eventType}:${farmId}:${entityId || timestamp}`
  signature?: string;          // HMAC-SHA256 signature for verification
}
```

---

## 3. Workflow Execution Lifecycle & States

```typescript
export type N8nExecutionStatus =
  | 'pending'     // Event dispatched / queued
  | 'running'     // Acknowledged by n8n, currently executing
  | 'success'     // Workflow finished with valid output
  | 'failed'      // Execution error encountered
  | 'timeout'     // n8n failed to respond within timeout window
  | 'skipped';    // Idempotent duplicate event ignored
```

### Execution Record Contract
Stored in AgriDOST for Automation Center UI inspection:

```typescript
export interface N8nExecutionRecord {
  id: string;                  // Execution record UUID
  eventId: string;             // References source N8nEventEnvelope.eventId
  eventType: N8nEventType;
  workflowId: 'government-assistance' | 'smart-farm-operations' | 'market-intelligence';
  farmId: string;
  status: N8nExecutionStatus;
  startedAt: string;           // ISO 8601
  completedAt?: string;        // ISO 8601
  durationMs?: number;
  inputSummary: string;        // Human-readable 1-line summary of trigger
  outputSummary?: string;      // Human-readable 1-line summary of result
  outputData?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  retryCount: number;
}
```

---

## 4. Webhook Security, Authentication & Replay Protection

### 4.1 Outbound Requests (AgriDOST -> n8n)
All HTTP POST requests dispatched to n8n webhook URLs must include these headers:
- `Content-Type: application/json`
- `X-AgriDOST-Event-ID`: Envelope `eventId`
- `X-AgriDOST-Timestamp`: ISO 8601 timestamp string
- `X-AgriDOST-Signature`: `t=${timestamp},v1=${hmacSha256(timestamp + "." + rawBody, N8N_WEBHOOK_SECRET)}`
- `Authorization`: `Bearer ${N8N_API_KEY}` (optional, if n8n webhook requires bearer auth)

### 4.2 Inbound Callbacks (n8n -> AgriDOST `/api/n8n/callback`)
- AgriDOST validates the `X-AgriDOST-Signature` against `N8N_WEBHOOK_SECRET`.
- Time drift verification: Callbacks with timestamps older than **300 seconds** (5 minutes) are rejected with HTTP 401 to prevent replay attacks.
- Payload validated via Zod schema (`N8nEventEnvelopeSchema`).

### 4.3 Zero Credential Leakage Rule
- **FORBIDDEN IN PAYLOADS**: Aadhaar numbers, PAN, bank passwords, OTPs, secret tokens, private API keys.
- Only reference keys (e.g. `applicationReferenceNumber`, `schemeId`, `farmId`) may be transmitted.

---

## 5. Idempotency & Duplicate Protection

1. Every event contains `idempotencyKey`.
2. Format: `${eventType}:${farmId}:${entityIdentifier}`
   - Example 1: `government.application.status_changed:demo-farm-01:app-pmk-101`
   - Example 2: `operations.weather.check_requested:demo-farm-01:2026-11-22-AM`
3. Before dispatching or processing:
   - AgriDOST checks whether `idempotencyKey` has been executed within the last **24 hours**.
   - If already executed, return the existing execution record with status `skipped`.

---

## 6. Timeouts & Bounded Retries

- **Timeout**:
  - Webhook dispatch timeout: **8,000 milliseconds**.
  - If n8n fails to reply in 8s, mark status `timeout` and queue for asynchronous background retry if eligible.
- **Retry Policy**:
  - Max Retries: **3**.
  - Backoff Intervals: 1st retry = 500ms, 2nd retry = 1,500ms, 3rd retry = 4,500ms.
  - Retried ONLY on network connectivity drops, HTTP 502/503/504, or timeouts.
  - NEVER retry HTTP 400 (Bad Request), HTTP 401 (Unauthorized), or HTTP 422 (Unprocessable Entity).

---

## 7. Environment Variables Contract

```bash
# n8n Webhook & API Gateway Configuration
N8N_WEBHOOK_URL=http://localhost:5678/webhook/
N8N_API_KEY=agridost_n8n_api_key_secret
N8N_WEBHOOK_SECRET=agridost_hmac_webhook_signing_secret_2026

# Public App URL for n8n -> AgriDOST callbacks
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Testing & Offline Emulation
N8N_SIMULATED_MODE=false
```

---

## 8. Specific Workflow Payloads & Routing

### 8.1 Workflow 1: Government Assistance (`workflows/government-assistance.json`)
- **Webhook Endpoint**: `${N8N_WEBHOOK_URL}agridost-government-assistance`
- **Supported Event Types**:
  - `government.application.created`
  - `government.application.status_changed`
  - `government.deadline.approaching`
  - `government.reminder.triggered`
- **Payload Schema**:
  ```typescript
  export interface GovernmentAssistancePayload {
    schemeId: string;
    schemeName: string;
    applicationId?: string;
    referenceNumber?: string;
    previousStatus?: string;
    currentStatus: string;
    statusSource: 'user_reported' | 'government_verified';
    deadlineDate?: string;
    reminderTitle?: string;
    reminderDueDate?: string;
    farmerName: string;
    farmerContact?: string;
    actionRequired: string;
    officialPortalUrl: string;
  }
  ```
- **Rule**: Never autonomously submit applications or fabricate government approval.

### 8.2 Workflow 2: Smart Farm Operations (`workflows/smart-farm-operations.json`)
- **Webhook Endpoint**: `${N8N_WEBHOOK_URL}agridost-smart-farm-operations`
- **Supported Event Types**:
  - `operations.weather.check_requested`
  - `operations.spray.window_evaluation`
  - `operations.irrigation.advisory`
- **Payload Schema**:
  ```typescript
  export interface SmartFarmOperationsPayload {
    operationType: 'spray' | 'irrigation' | 'fertilizer' | 'harvest';
    zoneId?: string;
    zoneName?: string;
    targetCrop?: string;
    cropVariety?: string;
    scheduledTime: string;
    weatherData: {
      temperatureC: number;
      windSpeedKmh: number;
      humidityPct: number;
      precipitationProbPct: number;
      condition: string;
      forecastTimestamp: string;
      provider: string;
    };
    thresholds: {
      maxWindSpeedKmh: number;
      maxTempC: number;
      minHumidityPct: number;
    };
    chemicalName?: string;
    dosagePerAcre?: string;
  }
  ```
- **Rule**: Never autonomously trigger chemical spraying or drone flight. Recommendations only.

### 8.3 Workflow 3: Market Intelligence (`workflows/market-intelligence.json`)
- **Webhook Endpoint**: `${N8N_WEBHOOK_URL}agridost-market-intelligence`
- **Supported Event Types**:
  - `market.price.check_requested`
  - `market.harvest.recorded`
  - `market.advisory.generated`
- **Payload Schema**:
  ```typescript
  export interface MarketIntelligencePayload {
    commodityName: string;         // e.g. "Wheat", "Soybean", "Cotton"
    variety?: string;
    targetMandi: string;          // e.g. "Nashik APMC", "Bathinda Grain Market"
    state: string;
    harvestYieldTonnes?: number;
    storedQuantityBags?: number;
    farmerTargetPriceInrPerQtl: number;
    currentMandiPriceInrPerQtl: number;
    minSupportPriceInrPerQtl?: number;
    trend7DaysPct?: number;
    priceObservationDate: string;
    priceDataSource: string;      // e.g. "Agmarknet (Govt of India)", "e-NAM"
  }
  ```
- **Rule**: Deterministic calculations for sell/hold advisory. AI used strictly for natural language explanation.

---

## 9. File Ownership Table

| Agent | Module / Area | Exclusive File Boundaries |
|---|---|---|
| **Lead Orchestrator** | Coordination, Integration, Navigation & Contracts | `docs/n8n/shared-integration-contract.md`, `src/types/n8n.ts`, `src/app/page.tsx`, `src/components/layout/Sidebar.tsx`, `N8N_INTEGRATION_QA_REPORT.md`, `N8N_AGENT_EXECUTION_REPORT.md` |
| **Agent A** | Core Infrastructure & Security | `src/lib/n8n/client.ts`, `src/lib/n8n/schemas.ts`, `src/lib/n8n/dispatcher.ts`, `src/lib/n8n/storage.ts`, `src/lib/n8n/index.ts`, `src/app/api/n8n/callback/route.ts`, `src/app/api/n8n/trigger/route.ts`, `tests/n8n-core.test.ts`, `N8N_SETUP_GUIDE.md`, `.env.example` |
| **Agent B** | Government Assistance Automation | `workflows/government-assistance.json`, `src/lib/n8n/workflows/government-assistance.ts`, `tests/n8n-government-assistance.test.ts` |
| **Agent C** | Smart Farm Operations Automation | `workflows/smart-farm-operations.json`, `src/lib/n8n/workflows/smart-farm-operations.ts`, `tests/n8n-smart-farm-operations.test.ts` |
| **Agent D** | Market Intelligence Automation | `workflows/market-intelligence.json`, `src/lib/n8n/workflows/market-intelligence.ts`, `tests/n8n-market-intelligence.test.ts` |
| **Agent E** | Automation Center UI & Demonstration | `src/components/automation/AutomationCenter.tsx`, `src/components/automation/WorkflowCard.tsx`, `src/components/automation/ExecutionHistoryTable.tsx`, `src/components/automation/ManualTriggerModal.tsx`, `src/components/automation/index.ts`, `tests/n8n-automation-ui.test.ts`, `N8N_DEMO_GUIDE.md` |
