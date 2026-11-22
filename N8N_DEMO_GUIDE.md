# AgriDOST 4.0: n8n Automation Center Demonstration Guide
**Version:** 1.0.0  
**Target Audience:** Hackathon Judges, Evaluators, Agronomists & Developers  
**Module:** Event-Driven Automation with n8n Workflow Engine & Offline-First Gateway  

---

## 1. Executive Summary

AgriDOST 4.0 introduces an enterprise-grade, bi-directional, event-driven automation layer powered by **n8n**.

Traditional farm management software either bombards farmers with manual push notifications or leaves them vulnerable to missed government deadlines, dangerous drone spraying in high winds, and distress-selling at predatory Mandi prices.

AgriDOST solves this with **3 Autonomous Workflows** governed by strict safety gates, cryptographic HMAC-SHA256 signatures, and an offline-first deterministic simulation engine.

```
┌─────────────────────────────────────────────────────────────┐
│                   AgriDOST 4.0 App                          │
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

## 2. The 3 Core Workflows at a Glance

| # | Workflow | Primary Triggers | Automated Action & Safety Gate |
|---|---|---|---|
| **1** | **Government Assistance Deadlines & Renewals** | `government.deadline.approaching`, `government.application.status_changed` | Computes countdown to official scheme cutoffs (PM-KISAN, PMFBY), creates verified calendar reminders, dispatches SMS reminders. *Zero fake approvals.* |
| **2** | **Smart Farm Operations & Weather Guard** | `operations.spray.window_evaluation`, `operations.weather.check_requested` | Evaluates hyper-local weather before drone spray operations. Halts operations if wind speed exceeds 15 km/h. *Human in the loop: never sprays autonomously.* |
| **3** | **Market Intelligence & Mandi Price Advisory** | `market.price.check_requested`, `market.harvest.recorded` | Pulls verified Mandi prices from Agmarknet & e-NAM, compares against farmer target and MSP, and issues mathematical SELL / HOLD advisories. |

---

## 3. Step-by-Step 5-Minute Hackathon Demo Script

### **Act 1: The Automation Center Dashboard (0:00 – 1:00)**
1. **Navigate to Automation Center**:
   - In AgriDOST sidebar, click **Automation Center**.
2. **Highlight the Gateway Status Banner**:
   - Point out the status indicator: **`n8n Live Connected`** (or **`Offline Simulation Mode`**).
   - Point out the active Webhook URL: `http://localhost:5678/webhook/`.
   - Toggle **`Simulation Mode`**: Demonstrates offline-first resilience. When disconnected from the internet or n8n container, AgriDOST falls back 100% transparently to its deterministic local automation engine!
3. **Review the 4 KPI Stats**:
   - **Active Workflows**: `3 / 3`
   - **Total Executions**: Live counter of all triggered events
   - **Success Rate**: Execution success percentage (accounting for duplicate idempotent skips)
   - **Engine State**: Instant feedback on gateway readiness

---

### **Act 2: Government Assistance Deadline Automation (1:00 – 2:00)**
1. **Trigger the Workflow**:
   - In the **Workflows Grid**, click **Test Trigger** on the **Government Assistance** card (or click top **Test / Trigger Workflow** button).
2. **Select Scenario Preset**:
   - Choose: **"PM-KISAN e-KYC Renewal Reminder"**.
   - Note the verified payload: Scheme name, reference number, deadline (`2026-12-15`), and action required.
3. **Click "Trigger Workflow"**:
   - Observe the live spinner and instantaneous completion (e.g. ~140ms).
   - **Outcome**: The workflow validates the deadline date, schedules a high-priority notification 14 days before cutoff, and records the event in the audit trail.
4. **Inspect Execution Log**:
   - Notice the new row immediately appearing in **Live Execution History** with a green **Success** pill.

---

### **Act 3: Smart Operations Weather Guard (2:00 – 3:15)**
*This demonstrates safety gates and autonomous halt capabilities.*

1. **Test Safe Weather Condition**:
   - Open **Manual Trigger Modal** and select **Smart Operations**.
   - Choose preset: **"Drone Spray Window: Optimal Weather (Wind 8 km/h)"**.
   - Click **Trigger Workflow**.
   - **Result**: `SAFE: Wind 8.4 km/h < 15 km/h, 27°C, 0% rain prob. Optimal 06:00-09:30 AM window approved.`
2. **Test Safety Alert / High Wind Halt**:
   - In the modal, choose preset: **"Drone Spray Alert: High Wind Warning (25 km/h)"**.
   - Click **Trigger Workflow**.
   - **Result**: Status is marked with red **Failed / Safety Halt** pill:  
     `SAFETY ALERT: Wind speed 25.4 km/h exceeds threshold (15.0 km/h). Spray operation halted.`
   - Point out that AgriDOST adheres to civil aviation and agronomy spray drift safety standards!

---

### **Act 4: Market Intelligence & Mandi Price Advisory (3:15 – 4:15)**
1. **Test Bullish / Sell Advisory**:
   - In **Manual Trigger Modal**, switch to **Market Intelligence**.
   - Choose preset: **"Soybean Mandi Price Check: Target Met (+4.2% Bullish)"**.
   - Current Mandi Price is ₹4,680 vs farmer target of ₹4,500.
   - Click **Trigger Workflow**.
   - **Result**: `BULLISH ADVISORY: Soybean Mandi Price (₹4,680) meets target (₹4,500). Recommendation: SELL.`
2. **Test Bearish / Below MSP Hold Advisory**:
   - Choose preset: **"Wheat Mandi Price Check: Below MSP (Hold Advisory)"**.
   - Current price is ₹2,280 vs MSP ₹2,425.
   - Click **Trigger Workflow**.
   - **Result**: `HOLD ADVISORY: Wheat Price (₹2,280) is below target (₹2,500). Recommendation: HOLD.`
   - Emphasizes that advice protects smallholder farmers against premature distress sales.

---

### **Act 5: Audit Trail, Cryptography & Idempotency (4:15 – 5:00)**
1. **Inspect Row Expansion**:
   - In the **Live Execution History Table**, click on any row to expand it.
   - Highlight the **Execution ID**, **Event ID**, and **Target Farm ID**.
   - Show the side-by-side **Trigger Input** and **Output Result Data** JSON viewers.
   - Click **Copy Raw Record** to demonstrate exportability.
2. **Demonstrate Idempotency Protection**:
   - Notice the **Skipped** execution record in the log.
   - Explain how AgriDOST prevents duplicate alerts: identical event payloads within 24 hours return the existing execution without redundant webhook re-runs.
3. **Filter and Search**:
   - Type `"Soybean"` or `"wind"` in the search bar to demonstrate instant client-side filtering.
   - Toggle status filter pills (**All**, **Success**, **Failed**, **Skipped**).

---

## 4. Evaluator Verification & Security Checklist

| Check | Specification Standard | AgriDOST 4.0 Implementation |
|---|---|---|
| **Zero Credential Leaks** | No Aadhaar, PAN, or bank credentials in webhooks | Payloads only contain scheme IDs, public crop names, and farm IDs. Strictly zero PII. |
| **Replay Attack Defense** | Webhook signature time drift verification | HMAC-SHA256 signatures validated with 300-second maximum allowable drift. |
| **Anti-Hallucination** | No AI-generated fake government approval | Statuses are strictly classified as `user_reported` vs `government_verified`. |
| **Deterministic Fallback** | 100% operational when n8n is offline | Seamless LocalStorage + deterministic engine fallback toggle. |
| **Automated Testing** | 100% test pass rate | Verified via `npx vitest run tests/n8n-automation-ui.test.ts`. |

---

## 5. Quick Commands

```bash
# Run the complete n8n UI test suite
npx vitest run tests/n8n-automation-ui.test.ts

# Run all test suites across AgriDOST
npm test

# Check TypeScript types
npx tsc --noEmit
```
