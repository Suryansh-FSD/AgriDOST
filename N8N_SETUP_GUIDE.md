# AgriDOST 4.0: n8n Automation Engine Setup & Operation Guide

Welcome to the **AgriDOST 4.0** n8n Workflow Automation Architecture. This guide walks you through deploying, configuring, and verifying the self-hosted n8n workflow engine connected to AgriDOST.

---

## 1. Architecture Overview

AgriDOST communicates with n8n using an event-driven, bi-directional architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                       AgriDOST App                          │
│  (Government Assistance, Smart Operations, Market Advisory) │
└──────────────┬──────────────────────────────▲───────────────┘
               │ Event Dispatch               │ Webhook Callback
               │ (HMAC-SHA256 Signed Payload) │ (State & Delivery Status)
               ▼                              │
┌──────────────────────────────┐              │
│   src/lib/n8n/client.ts      │              │
│   src/lib/n8n/dispatcher.ts  │              │
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

## 2. Docker Compose Deployment (Self-Hosted n8n)

Save the following configuration as `docker-compose.yml` in your deployment directory:

```yaml
version: '3.8'

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: agridost-n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - NODE_ENV=production
      - WEBHOOK_URL=http://localhost:5678/
      - GENERIC_TIMEZONE=Asia/Kolkata
      - N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168 # 7 days
    volumes:
      - n8n_data:/home/node/.n8n
      - ./workflows:/workflows:ro

volumes:
  n8n_data:
```

### Start n8n:
```bash
docker compose up -d
```
Visit `http://localhost:5678` to initialize your local n8n instance and set up your admin credentials.

---

## 3. Webhook Endpoints & Routing Table

AgriDOST dispatches outbound events to three dedicated webhook routes:

| Workflow | Event Types | Webhook Route | Method |
|---|---|---|---|
| **1. Government Assistance** | `government.application.created`<br>`government.application.status_changed`<br>`government.deadline.approaching`<br>`government.reminder.triggered` | `http://localhost:5678/webhook/agridost-government-assistance` | `POST` |
| **2. Smart Farm Operations** | `operations.weather.check_requested`<br>`operations.spray.window_evaluation`<br>`operations.irrigation.advisory` | `http://localhost:5678/webhook/agridost-smart-farm-operations` | `POST` |
| **3. Market Intelligence** | `market.price.check_requested`<br>`market.harvest.recorded`<br>`market.advisory.generated` | `http://localhost:5678/webhook/agridost-market-intelligence` | `POST` |

---

## 4. Webhook Security & HMAC-SHA256 Signing

To prevent tampering and replay attacks, every outbound event from AgriDOST is signed with an HMAC-SHA256 signature.

### Request Headers
```http
POST /webhook/agridost-government-assistance HTTP/1.1
Host: localhost:5678
Content-Type: application/json
X-AgriDOST-Event-ID: evt_550e8400-e29b-41d4-a716-446655440000
X-AgriDOST-Timestamp: 2026-11-22T12:00:00.000Z
X-AgriDOST-Signature: t=2026-11-22T12:00:00.000Z,v1=5f3759df...
Authorization: Bearer agridost_n8n_api_key_secret
```

### Signature Computation Formula
$$\text{Signature} = \text{HMAC-SHA256}(\text{Secret}, \text{timestamp} + \text{"."} + \text{rawJsonBody})$$

### Inbound Callback Verification in n8n (Code Node Example)
```javascript
const crypto = require('crypto');

const secret = 'agridost_hmac_webhook_signing_secret_2026';
const rawBody = JSON.stringify($json);
const signatureHeader = $headers['x-agridost-signature'];

if (!signatureHeader) {
  throw new Error('Missing X-AgriDOST-Signature');
}

const parts = signatureHeader.split(',');
let timestamp, v1;
for (const p of parts) {
  const [k, v] = p.trim().split('=');
  if (k === 't') timestamp = v;
  if (k === 'v1') v1 = v;
}

// 1. Time Drift Check (max 300 seconds)
const driftMs = Math.abs(Date.now() - new Date(timestamp).getTime());
if (driftMs > 300 * 1000) {
  throw new Error('Signature expired: replay drift > 300s');
}

// 2. HMAC-SHA256 Verification
const expected = crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}.${rawBody}`)
  .digest('hex');

if (expected !== v1) {
  throw new Error('HMAC signature mismatch');
}

return { valid: true };
```

---

## 5. Inbound Callbacks to AgriDOST

When an n8n workflow finishes executing, it posts a callback to:
```
POST http://localhost:3000/api/n8n/callback
```
**Headers:**
- `Content-Type: application/json`
- `X-AgriDOST-Signature: t=${ts},v1=${signature}`

**Body:**
```json
{
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440000",
  "workflowId": "government-assistance",
  "status": "success",
  "outputSummary": "Dispatched SMS reminder for PM-KISAN e-KYC renewal.",
  "outputData": {
    "channels": ["sms", "in_app"],
    "messageId": "sms_98412"
  },
  "completedAt": "2026-11-22T12:00:02.000Z",
  "durationMs": 1450
}
```

---

## 6. Environment Variables Reference

Add to your `.env.local` or production environment:

```env
# n8n Gateway Base URL (must end with /)
N8N_WEBHOOK_URL=http://localhost:5678/webhook/

# Shared Bearer Token (optional)
N8N_API_KEY=agridost_n8n_api_key_secret

# HMAC-SHA256 Signing Secret (mandatory for production)
N8N_WEBHOOK_SECRET=agridost_hmac_webhook_signing_secret_2026

# Public App URL for n8n Webhook Callbacks
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Testing & Offline Emulation
N8N_SIMULATED_MODE=true
N8N_FALLBACK_TO_SIMULATION=true
```

---

## 7. Security Best Practices

1. **Zero Credential Leakage:**  
   AgriDOST strictly forbids passing sensitive personal identifying information (Aadhaar numbers, bank passwords, OTPs) through event payloads. The schema validator rejects any payload containing forbidden keys.
2. **Replay Drift Guard:**  
   Any inbound or outbound request older than **300 seconds** (5 minutes) is rejected immediately with HTTP 401.
3. **Idempotency Protection:**  
   Events sharing the same `idempotencyKey` within a **24-hour** window are automatically recognized and de-duplicated.
4. **Bounded Retries:**  
   Outbound requests retry on network errors or 5xx server responses with backoff delays of **500ms**, **1,500ms**, and **4,500ms**. 4xx client errors are never retried.
