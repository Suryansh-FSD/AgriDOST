# AgriDOST 4.0: Agent 5 — Telegram Specialist Integration Report

**Agent Identity:** AGENT 5: TELEGRAM SPECIALIST  
**System:** AgriDOST 4.0 Intelligent Farm Operations & Advisory Platform  
**Integration Domain:** Telegram Bot API, Server-Side Notification Delivery, Webhook Processing, Consent & Opt-in Management, and Idempotent Deduplication  
**Date:** 2026-11-22  
**Status:** IMPLEMENTED & FULLY VERIFIED (40/40 Passing Tests)  

---

## 1. Executive Summary & Architecture

As **Agent 5: Telegram Specialist**, the complete Telegram notification and webhook integration subsystem for **AgriDOST 4.0** has been engineered, verified, and integrated. The subsystem delivers a consent-first, bilingual (English + Hindi), server-side messaging solution designed for Indian farmers.

### Architectural Invariants & Guarantees:
1. **CRITICAL RULE — Absolute Farmer Consent Enforcement:**  
   Notifications are **NEVER** dispatched without prior, explicit farmer opt-in consent (`optInStatus === true`). Any dispatch attempt for an unconsented farmer is strictly aborted with an HTTP 403 Forbidden / `FARMER_NOT_OPTED_IN` error.
2. **24-Hour Sliding Window Deduplication & Idempotency:**  
   Identical notifications (same farmer, category, and alert signature) are suppressed over a 24-hour sliding window to protect farmers from notification fatigue and alert spam.
3. **Strict Server-Side Credential Isolation:**  
   `TELEGRAM_BOT_TOKEN` is maintained strictly server-side and is never bundled into client scripts. The client provides automatic credential masking and regex-based sanitization in error traces.
4. **Bilingual Delivery & Rich Formatting:**  
   Supports English, Hindi, and dual-language templates formatted with clean emojis, urgency badges, and proper HTML escaping to prevent Telegram API injection.
5. **Webhook Secret Token Authentication:**  
   Incoming Telegram webhooks validate the `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET` before parsing update payloads.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AgriDOST 4.0 Telegram Subsystem Architecture             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│     [External Farmer on Telegram]               [AgriDOST Advisory Engine] │
│                   │                                         │               │
│         /start <farmer_id>                                  │               │
│         /stop /unsubscribe                                  │               │
│         /lang hi|en|mr                                      │               │
│                   │                                         │               │
│                   ▼                                         ▼               │
│     ┌───────────────────────────┐             ┌───────────────────────────┐ │
│     │ POST /api/telegram/webhook│             │  POST /api/telegram/send  │ │
│     │ (Validates Secret Token)  │             │  (Dispatch Advisory Alert)│ │
│     └─────────────┬─────────────┘             └─────────────┬─────────────┘ │
│                   │                                         │               │
│                   ▼                                         ▼               │
│     ┌───────────────────────────┐             ┌───────────────────────────┐ │
│     │    handleWebhookCommand   │             │   Strict Consent Gate     │ │
│     │    - Opt-in / Opt-out     │             │   hasConsent(farmerId)?   │ │
│     │    - Language Preference  │             └─────────────┬─────────────┘ │
│     └─────────────┬─────────────┘                           │ Yes           │
│                   │                                         ▼               │
│                   │                           ┌───────────────────────────┐ │
│                   │                           │ 24-Hour Deduplication     │ │
│                   │                           │ isDuplicate(dedupKey)?    │ │
│                   │                           └─────────────┬─────────────┘ │
│                   │                                         │ No            │
│                   ▼                                         ▼               │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │                     Bilingual Template Engine                       │ │
│     │      (Weather, Crop Health, Schemes, Mandi Prices, Field Tasks)     │ │
│     └──────────────────────────────────┬──────────────────────────────────┘ │
│                                        │                                    │
│                                        ▼                                    │
│                     ┌─────────────────────────────────────┐                 │
│                     │       TelegramClient (Server-Side)  │                 │
│                     │  - HTTPS api.telegram.org/bot<tok>  │                 │
│                     │  - Simulated Mode for Offline/Tests │                 │
│                     │  - Automatic Token Redaction        │                 │
│                     └─────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. File Inventory & Component Responsibilities

| File Path | Component | Responsibility |
|---|---|---|
| `src/types/telegram.ts` | Type Contracts | TypeScript interfaces for notifications, consent records, delivery results, and Bot API contracts. |
| `src/types/index.ts` | Central Barrel | Exports `src/types/telegram` alongside integrations, schemes, and n8n types. |
| `src/lib/telegram/client.ts` | Bot API Client | Server-side HTTP client for Telegram Bot API with token protection, timeouts, and deterministic simulation. |
| `src/lib/telegram/consent.ts` | Consent Sentinel | Manages farmer opt-in records, `/start` linking, `/stop` revocation, `/lang` preferences, and in-memory fallback. |
| `src/lib/telegram/templates.ts` | Bilingual Templates | Rich HTML templates with emojis for Weather, Crop Health, Schemes, Mandi Prices, and Task reminders. |
| `src/lib/telegram/dedup.ts` | Deduplication Engine | 24-hour sliding window idempotency cache to eliminate alert spam. |
| `src/lib/telegram/index.ts` | Orchestration Layer | Unified `sendTelegramNotification` function enforcing consent, deduplication, formatting, and dispatch. |
| `src/app/api/telegram/webhook/route.ts` | Webhook API Handler | Inbound endpoint for Telegram updates with secret header validation and automated bot responses. |
| `src/app/api/telegram/send/route.ts` | Notification Send API | Outbound endpoint for sending alerts to opted-in farmers (enforces 403 on unconsented calls). |
| `src/app/api/telegram/consent/route.ts` | Consent API Handler | GET/POST route for querying and updating farmer consent and language preferences. |
| `src/app/api/telegram/health/route.ts` | Health Check API | Standardized `IntegrationHealthResponse` endpoint for system health, latency, and capabilities. |
| `tests/telegram-integration.test.ts` | Test Suite | 40 comprehensive integration tests verifying consent, deduplication, webhooks, templates, and routes. |

---

## 3. Data Contracts & Type Schemas (`src/types/telegram.ts`)

### 3.1 `TelegramNotification`
```typescript
export interface TelegramNotification {
  id: string;
  farmerId: string;
  chatId?: number | string;
  category: 'weather' | 'crop_health' | 'scheme' | 'market' | 'task';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  titleEn: string;
  bodyEn: string;
  titleHi: string;
  bodyHi: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}
```

### 3.2 `FarmerConsentRecord`
```typescript
export interface FarmerConsentRecord {
  farmerId: string;
  chatId: number | string;
  username?: string;
  optInStatus: boolean;
  consentTimestamp: string;
  languagePreference: 'en' | 'hi' | 'mr';
  revokedTimestamp?: string | null;
  metadata?: Record<string, unknown>;
}
```

### 3.3 `TelegramDeliveryResult`
```typescript
export interface TelegramDeliveryResult {
  success: boolean;
  messageId?: number;
  deliveredAt?: string;
  error?: string;
  wasDeduplicated?: boolean;
  farmerId?: string;
  chatId?: number | string;
}
```

---

## 4. Farmer Consent & Privacy Enforcement

### 4.1 The Invariant: Zero Unsolicited Messages
AgriDOST 4.0 strictly respects the privacy of agricultural communities:
1. **No Cold Outreaches:** A farmer must explicitly initiate contact with the bot or sign up via the platform.
2. **Binding via `/start <farmer_id>`:** The bot command links the farmer's Telegram account (`chatId`) with their profile (`farmerId`), recording timestamped consent.
3. **Instant Revocation via `/stop` or `/unsubscribe`:** Revocation takes effect immediately. The system records `revokedTimestamp` and sets `optInStatus: false`.
4. **Hard Interception:** Both `sendTelegramNotification` and `POST /api/telegram/send` evaluate `hasConsent(farmerId)`. If false, execution terminates before any upstream Telegram Bot API call is attempted.

### 4.2 Interactive Bot Commands
- `/start [farmer_id]` — Registers opt-in consent and greets the farmer in Hindi and English.
- `/stop` or `/unsubscribe` — Immediately cancels subscription and revokes consent.
- `/status` — Displays active subscription details, language, and consent timestamp.
- `/lang hi|en|mr` — Switches language preference between Hindi, English, and Marathi.
- `/help` — Displays full command menu and privacy commitment.

---

## 5. Webhook Ingress & Secret Token Security

Telegram Bot API provides mutual authentication through the `X-Telegram-Bot-Api-Secret-Token` header.
- When configuring webhooks with `setWebhook`, AgriDOST registers `secret_token = TELEGRAM_WEBHOOK_SECRET`.
- When an update arrives at `POST /api/telegram/webhook`, the handler validates:
  ```typescript
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const incomingSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (configuredSecret && incomingSecret !== configuredSecret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized: Invalid secret token' }, { status: 401 });
  }
  ```
- Non-text messages (e.g. photos or stickers) are safely acknowledged without error, preventing infinite redelivery loops.

---

## 6. Bilingual Notification Templates & Clean Formatting

Templates provide dual English and Hindi guidance formatted with clean HTML, priority badges, and agricultural emojis:

| Category | Icon | Urgency Badges | Content Covered |
|---|---|---|---|
| **Weather** | 🌦️ | 🔴 CRITICAL / 🟡 ATTENTION | Rainfall (mm), wind speed (km/h), spray viability (Optimal/Unsafe), drift risk warnings. |
| **Crop Health** | 🌿 | 🔴 URGENT / 🟡 ATTENTION | Identified pathogen/pest, confidence score (%), chemical treatments (with CIBRC dosages), organic alternatives. |
| **Schemes** | 🏛️ | 🟠 HIGH PRIORITY | Scheme name (e.g., PM-KISAN, PMFBY), deadline date, financial benefit amount, e-KYC/CSC steps. |
| **Market** | 📈 | 🟡 ATTENTION | Commodity name, APMC Mandi, modal price (₹/qtl), comparison to MSP, buy/hold/sell advisory. |
| **Task** | 🚜 | 🟢 ADVISORY | Operation type (spraying, irrigation), scheduled time, farm/parcel ID, safety gear reminders. |

**HTML Escaping:** All user-supplied fields are sanitized through an HTML entity encoder (`&`, `<`, `>`) to guard against Telegram HTML parse errors or injection.

---

## 7. 24-Hour Deduplication & Idempotency Sentinel

To prevent spamming farmers with repetitive weather or market pings:
1. **Deterministic Key Generation:**  
   `dedup:${farmerId}:${category}:${notification.id}` or a normalized content signature.
2. **24-Hour Window:**  
   Cached delivery timestamps are tracked. Inbound alerts with matching keys within 24 hours are marked with `wasDeduplicated: true` and suppressed from dispatch.
3. **Emergency Bypass:**  
   Critical alerts can specify `{ force: true }` to bypass deduplication when urgent meteorological or pest developments require immediate farmer action.

---

## 8. Integration Health Check Conformance

`GET /api/telegram/health` strictly implements the `IntegrationHealthResponse` schema defined in `src/types/integrations.ts`:

```json
{
  "provider": "telegram",
  "displayName": "Telegram Bot API (AgriDOST Alerts)",
  "category": "messaging",
  "configurationStatus": "configured",
  "connectivityStatus": "online",
  "operatingMode": "LIVE",
  "lastSuccessfulCheck": "2026-11-22T08:52:14.000Z",
  "lastError": null,
  "latencyMs": 42,
  "dataFreshness": {
    "timestamp": "2026-11-22T08:52:14.000Z",
    "source": "telegram-bot-api",
    "provenance": "live_api"
  },
  "featuresSupported": [
    "bilingual_alerts",
    "farmer_opt_in",
    "consent_enforcement",
    "deduplication_24h",
    "webhook_dispatch",
    "priority_formatting"
  ],
  "diagnosticDetails": {
    "botUsername": "AgriDOST_Alerts_Bot",
    "maskedToken": "123456789:***TestToken",
    "totalConsentsTracked": 12,
    "activeFarmerOptIns": 12,
    "simulatedMode": false
  }
}
```

---

## 9. Bot Setup & Webhook Deployment Guide

### Step 1: Create the Bot via @BotFather
1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`.
3. Choose a display name: `AgriDOST Farmer Advisory`.
4. Choose a username ending in `bot`: `AgriDOST_Alerts_Bot`.
5. Copy the generated Bot API Token (e.g. `123456789:ABCDefGhIJklMnOpQrStUvWxYz`).

### Step 2: Configure Environment Variables
Add the following to `.env.local` or production deployment environment:
```bash
# Telegram Bot API Configuration
TELEGRAM_BOT_TOKEN=123456789:ABCDefGhIJklMnOpQrStUvWxYz
TELEGRAM_WEBHOOK_SECRET=your_secure_hex_webhook_secret_here

# Optional: Run in deterministic simulated mode without network calls
TELEGRAM_SIMULATED_MODE=false
```

### Step 3: Register the Webhook
Run the following curl command or use `TelegramClient.setWebhook`:
```bash
curl -F "url=https://your-agridost-domain.com/api/telegram/webhook" \
     -F "secret_token=your_secure_hex_webhook_secret_here" \
     https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
```

### Step 4: Verify Webhook Status
```bash
curl https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo
```

---

## 10. Verification & Test Evidence

The automated test suite in `tests/telegram-integration.test.ts` executes **40 distinct unit and integration tests** across 7 test suites.

```
 ✓ tests/telegram-integration.test.ts (40 tests) 25ms
   ✓ AgriDOST 4.0: Telegram Bot Integration Test Suite (40)
     ✓ 1. Farmer Consent & Opt-In Management (5)
       ✓ should strictly return false for farmers without explicit consent
       ✓ should grant and store opt-in consent successfully
       ✓ should query consent by Telegram chat ID
       ✓ should immediately revoke consent on unsubscribe/stop
       ✓ should allow updating preferred language
     ✓ 2. Telegram Webhook Command Processing (6)
       ✓ should handle /start <farmer_id> and record explicit opt-in
       ✓ should handle /start without parameter by generating default chat-based farmer ID
       ✓ should handle /stop and /unsubscribe by revoking consent immediately
       ✓ should handle /lang command to change language preference
       ✓ should handle /status command and show subscription state
       ✓ should handle /help command with command menu and privacy commitment
     ✓ 3. Deduplication & Idempotency Engine (4)
       ✓ should identify repeated messages as duplicate within the 24-hour window
       ✓ should expire duplicate suppression after 24 hours (sliding window)
       ✓ should execute atomic checkAndRecord correctly
       ✓ should generate deterministic dedup keys from notifications
     ✓ 4. Bilingual Notification Templates (6)
       ✓ should format weather notifications with clean emojis and bilingual text
       ✓ should format crop health diagnosis alerts with pathogen details and remedies
       ✓ should format government scheme deadline reminders with dates and action steps
       ✓ should format mandi market intelligence price spike alerts
       ✓ should format farm operations task reminders
       ✓ should correctly escape HTML special characters to prevent Telegram API injection
     ✓ 5. Telegram Bot API Client (4)
       ✓ should verify bot configuration status and mask token safely
       ✓ should call getMe successfully in simulated mode
       ✓ should reject sendMessage with missing chat_id or empty text
       ✓ should require HTTPS for webhook URLs in setWebhook
     ✓ 6. Central Notification Dispatch Orchestrator (sendTelegramNotification) (3)
       ✓ should REJECT delivery if farmer has not opted in (CRITICAL RULE)
       ✓ should successfully deliver notification when farmer is opted in
       ✓ should suppress duplicate notification to the same farmer within 24h
     ✓ 7. Server API Routes Integration (12)
       ✓ POST /api/telegram/webhook (4)
         ✓ should reject webhook request if secret token header is missing or incorrect
         ✓ should accept valid webhook and process /start <farmer_id> command
         ✓ should accept valid webhook and process /stop command to revoke consent
         ✓ should gracefully ignore non-text updates (e.g. photos, stickers)
       ✓ POST /api/telegram/send (4)
         ✓ should return 400 Bad Request if required fields are missing
         ✓ should return 403 Forbidden when farmer has not granted consent
         ✓ should successfully send notification to opted-in farmer
         ✓ should flag deduplication when the same alert is sent twice within 24h
       ✓ /api/telegram/consent endpoints (3)
         ✓ should register consent via POST /api/telegram/consent
         ✓ should query consent via GET /api/telegram/consent?farmerId=...
         ✓ should revoke consent via POST /api/telegram/consent with optInStatus: false
       ✓ GET /api/telegram/health (1)
         ✓ should conform to AgriDOST 4.0 IntegrationHealthResponse contract

 Test Files  1 passed (1)
      Tests  40 passed (40)
```

---

## 11. Conclusion

The Telegram Bot Integration for AgriDOST 4.0 is complete, secure, and production-ready. It guarantees complete adherence to farmer privacy and consent, provides rich bilingual advisories, eliminates duplicate alert fatigue, and exposes standardized health diagnostics for platform observability.
