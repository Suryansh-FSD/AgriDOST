# AgriDOST 4.0: Market Intelligence & Mandi Integration Specialist Report

**Agent Role**: AGENT 4: MARKET INTELLIGENCE SPECIALIST  
**Date**: November 22, 2026  
**Status**: COMPLETE (All 24 Tests Passing, Contract Compliant, Zero TypeScript Errors)  
**Verification Level**: IMPLEMENTED, MOCK_TESTED, INTEGRATION_VERIFIED

---

## 1. Executive Summary

As the Market Intelligence Specialist for AgriDOST 4.0, the core objective was to deliver a production-grade market intelligence subsystem bridging Government of India Mandi data (data.gov.in / Agmarknet), the official CACP/CCEA Minimum Support Price (MSP) registry, and farmer micro-economic break-even models.

### Key Deliverables Completed:
1. **Market Contracts** (`src/types/market.ts`): Standardized types for normalized mandi wholesale price records, MSP crop models, financial break-even analyses, deterministic harvest liquidation advisories, and integration health tracking adhering to `DataFreshnessMetadata` and `IntegrationHealthResponse`.
2. **data.gov.in Agmarknet Client** (`src/lib/market/client.ts`): Implemented ingestion for Agmarknet daily price resource (`9ef84268-d588-465a-a308-a864a43d0070`), robust 15-minute in-memory caching, offline historical benchmark fallback across Indian agricultural hubs, and strict zero-substitution guards.
3. **Official MSP Registry** (`src/lib/market/msp-registry.ts`): Curated Cabinet Committee on Economic Affairs (CCEA) approved MSP rates for 2024-2026 Kharif, Rabi, and Commercial crops, with multi-dialect Hindi/English alias matching (`gehu` -> Wheat, `chana` -> Gram, `sarson` -> Mustard, etc.).
4. **Financial Economics & Advisory Engine** (`src/lib/market/intelligence.ts`): Precision agronomic math (1 metric tonne = 10 quintals), break-even pricing, ROI%, profit margin%, and a 7-rule deterministic decision tree with bilingual rationales (English/Hindi) and statutory advisory disclaimers.
5. **API Route** (`src/app/api/market/route.ts`): Server-side Next.js route handler supporting parameter filtering (`commodity`, `state`, `district`, `market`, `cost`, `yieldTonnes`, `targetPrice`) and integration health checks (`?check=health`).
6. **Comprehensive Test Suite** (`tests/market-intelligence-integration.test.ts`): 24 vitest integration and unit tests passing with 100% test success rate.

---

## 2. data.gov.in API Architecture & Ingestion

### 2.1 Dataset Specifications
- **Catalog Source**: Open Government Data (OGD) Platform India (`data.gov.in`)
- **Dataset**: Daily Mandi Wholesale Arrivals and Prices (Agmarknet, Directorate of Marketing & Inspection, Ministry of Agriculture & Farmers Welfare)
- **Active Resource ID**: `9ef84268-d588-465a-a308-a864a43d0070` (Configurable via `DATA_GOV_RESOURCE_ID`)
- **Base Endpoint**: `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070`
- **Authentication**: `api-key` query parameter (`DATA_GOV_API_KEY`)

### 2.2 Query Parameters & Filter Matrix
| Query Filter | Target Field in Agmarknet API | Example Values |
|---|---|---|
| `state` | `filters[state]` | `Punjab`, `Madhya Pradesh`, `Maharashtra`, `Rajasthan` |
| `district` | `filters[district]` | `Ludhiana`, `Dewas`, `Nashik`, `Bharatpur` |
| `market` | `filters[market]` | `Khanna Grain Market`, `Sehore Mandi`, `Lasalgaon APMC` |
| `commodity` | `filters[commodity]` | `Wheat`, `Paddy`, `Gram`, `Mustard`, `Soybean`, `Cotton` |
| `variety` | `filters[variety]` | `Sharbati`, `Yellow JS-335`, `Desi Chana` |
| `limit` | `limit` | `10` |
| `format` | `format` | `json` |

### 2.3 Strict Price Normalization & Zero-Substitution Guard
- **Unit Standard**: Normalized to INR per quintal (`₹/qtl`), where $1\text{ Quintal} = 100\text{ kg}$.
- **Input Sanitization**: Cleans currency prefixes (`₹`, `Rs.`, `/-`), commas, and whitespace using regex number extraction (`/\d+(?:\.\d+)?/`).
- **CRITICAL ANTI-CORRUPTION RULE**: Under no circumstance does AgriDOST substitute missing, undefined, NaN, empty string, or zero prices with `₹0`. A zero default would corrupt break-even comparisons and falsely trigger distress alerts. If a price is unavailable, the client raises `MarketPriceUnavailableError` with HTTP 404/422 status.

### 2.4 Provenance & Data Freshness Lifecycle
Every returned market record is tagged with `DataFreshnessMetadata`:
1. `provenance: 'live_api'` – Real-time response fetched from data.gov.in with active `DATA_GOV_API_KEY`.
2. `provenance: 'cached_remote'` – Served from high-speed in-memory cache within the 15-minute TTL (`ageSeconds` tracked).
3. `provenance: 'simulated_fallback'` – High-fidelity benchmark data automatically served when unconfigured or when offline.

---

## 3. Official CACP / CCEA Minimum Support Price (MSP) Registry

The MSP registry in `src/lib/market/msp-registry.ts` represents the official price floor approved by the Government of India for the 2024-25 and 2025-26 marketing seasons:

| Commodity | Season | Approved MSP (₹/qtl) | Year / Cycle | Procuring Agency |
|---|---|---|---|---|
| **Wheat (गेहूं)** | Rabi | ₹2,425 (RMS 25-26) / ₹2,275 (24-25) | 2024-26 | FCI / State Civil Supplies Agencies |
| **Paddy Common (धान)** | Kharif | ₹2,300 | 2024-25 | FCI / State Agencies |
| **Paddy Grade A** | Kharif | ₹2,320 | 2024-25 | FCI / State Agencies |
| **Gram / Chana (चना)** | Rabi | ₹5,650 (RMS 25-26) / ₹5,440 (24-25) | 2024-26 | NAFED / FCI (Price Support Scheme) |
| **Mustard / Rapeseed (सरसों)** | Rabi | ₹5,950 (RMS 25-26) / ₹5,650 (24-25) | 2024-26 | NAFED / Hafed / State Federations |
| **Soybean (सोयाबीन)** | Kharif | ₹4,892 | 2024-25 | NAFED / State Oilseed Federations |
| **Cotton Medium (कपास)** | Kharif | ₹7,121 | 2024-25 | CCI (Cotton Corporation of India) |
| **Cotton Long Staple** | Kharif | ₹7,521 | 2024-25 | CCI |
| **Maize (मक्का)** | Kharif | ₹2,225 | 2024-25 | FCI / NAFED |
| **Onion Benchmark (प्याज)** | Commercial / MIS | ₹2,400 | 2024-25 | NAFED / NCCF (Price Stabilization Fund) |
| **Tur / Arhar (अरहर)** | Kharif | ₹7,550 | 2024-25 | NAFED / FCI |
| **Moong (मूंग)** | Kharif | ₹8,682 | 2024-25 | NAFED / FCI |
| **Urad (उड़द)** | Kharif | ₹7,400 | 2024-25 | NAFED / FCI |
| **Groundnut (मूंगफली)** | Kharif | ₹6,783 | 2024-25 | NAFED / State Agencies |
| **Barley (जौ)** | Rabi | ₹1,980 (RMS 25-26) / ₹1,850 (24-25) | 2024-26 | FCI |
| **Bajra (बाजरा)** | Kharif | ₹2,625 | 2024-25 | FCI / State Agencies |
| **Jowar Hybrid (ज्वार)** | Kharif | ₹3,371 | 2024-25 | FCI |
| **Lentil / Masur (मसूर)** | Rabi | ₹6,700 (RMS 25-26) / ₹6,425 (24-25) | 2024-26 | NAFED / FCI |

---

## 4. Financial Economics & Break-Even Mathematics

All financial calculations are performed deterministically in `src/lib/market/intelligence.ts`:

$$\text{Yield in Quintals} = \text{expectedYieldTonnes} \times 10$$
$$\text{Estimated Revenue (₹)} = \text{Yield in Quintals} \times \text{modalPricePerQtl}$$
$$\text{Estimated Cost (₹)} = \text{totalInputCostInr}$$
$$\text{Break-Even Price (₹/qtl)} = \frac{\text{totalInputCostInr}}{\text{Yield in Quintals}}$$
$$\text{Expected Net Profit (₹)} = \text{Estimated Revenue} - \text{Estimated Cost}$$
$$\text{Profit Margin (\%)} = \left(\frac{\text{Expected Net Profit}}{\text{Estimated Revenue}}\right) \times 100$$
$$\text{Return on Investment ROI (\%)} = \left(\frac{\text{Expected Net Profit}}{\text{Estimated Cost}}\right) \times 100$$

---

## 5. Advisory Decision Sentinel & Rules Engine

The harvest liquidation decision tree evaluates market price against MSP, farmer target price, break-even cost, and 7-day momentum:

```
                          [ Current Modal Price ]
                                     |
               +---------------------+---------------------+
               |                                           |
    modal_price < MSP ?                        modal_price >= MSP
               |                                           |
               v                                           |
         [ HOLD / MSP ALERT ]                              |
   (Anti-Distress Selling Sentinel)                        |
   Direct to FCI / NAFED Center                            |
                                                           v
                                            Target Price Specified?
                                                           |
                          +--------------------------------+--------------------------------+
                          |                                                                 |
                        [ YES ]                                                           [ NO ]
                          |                                                                 |
      +-------------------+-------------------+                      +----------------------+----------------------+
      |                                       |                      |                                             |
Price >= 1.05 * Target?              Price >= Target?        Price >= 1.25 * Break-Even?            Price < Break-Even?
      |                                       |                      |                                             |
      v                                       v                      v                                             v
   [ SELL ]                           [ PARTIAL_SELL (50%) ]      [ SELL ]                                      [ HOLD ]
(Lock in surplus)                   (Capitalize & hedge)    (Healthy margin lock)                        (Cost deficit alert)
```

### Statutory Disclaimer
Every advisory includes the explicit legal disclaimer:
> *"Advisory calculation only. AgriDOST market advisory is a deterministic agronomic decision-support tool based on Agmarknet mandi data and Government CACP/CCEA Minimum Support Price (MSP) benchmarks. It does not constitute a guaranteed financial return, trading contract, or autonomous transaction instruction. Physical harvest liquidation decisions remain exclusively with the farmer."*

---

## 6. Server Route Specification (`GET /api/market`)

### Request Parameters:
- `commodity`: *(Required)* Name or alias of crop (e.g. `Wheat`, `Mustard`, `Soybean`, `gehu`, `chana`).
- `state`: *(Optional)* Indian State (e.g. `Punjab`, `Madhya Pradesh`).
- `district`: *(Optional)* District name.
- `market`: *(Optional)* Specific APMC mandi name.
- `variety`: *(Optional)* Variety descriptor.
- `cost`: *(Optional)* Farmer total input cost in INR.
- `yieldTonnes`: *(Optional)* Expected yield in metric tonnes.
- `targetPrice`: *(Optional)* Farmer target sale price in ₹/quintal.
- `check=health`: Triggers integration health check response adhering to `IntegrationHealthResponse`.

### Sample Success Response (`GET /api/market?commodity=Wheat&cost=35000&yieldTonnes=3`):
```json
{
  "success": true,
  "data": {
    "query": { "commodity": "Wheat" },
    "priceRecord": {
      "state": "Punjab",
      "district": "Ludhiana",
      "market": "Khanna Grain Market",
      "commodity": "Wheat",
      "variety": "Sharbati / PBW-550",
      "arrival_date": "2026-11-22",
      "min_price": 2400,
      "max_price": 2580,
      "modal_price": 2480,
      "price_unit": "₹/quintal",
      "status": "available"
    },
    "mspData": {
      "commodity": "Wheat",
      "variety": "Standard / FAQ",
      "hindiName": "गेहूं (Wheat)",
      "season": "Rabi",
      "mspPriceInrPerQtl": 2425,
      "effectiveYear": "2024-26",
      "procuringAgency": "FCI / State Civil Supplies Agencies"
    },
    "financialAnalysis": {
      "estimatedRevenueInr": 74400,
      "estimatedCostInr": 35000,
      "breakEvenPricePerQtl": 1166.67,
      "expectedProfitInr": 39400,
      "profitMarginPct": 52.96,
      "yieldQuintals": 30,
      "modalPricePerQtl": 2480,
      "roiPct": 112.57
    },
    "advisory": {
      "recommendation": "SELL",
      "confidence": 0.88,
      "rationaleEn": "HEALTHY MARGIN: Current modal price of ₹2480/qtl provides a ₹1313/qtl margin above your calculated production break-even cost of ₹1166.67/qtl...",
      "rationaleHi": "बिक्री की सिफारिश: वर्तमान भाव ₹2480/क्विंटल आपकी प्रति क्विंटल लागत (₹1166.67/क्विंटल) से अधिक है...",
      "mspComparison": {
        "mspPrice": 2425,
        "diffInr": 55,
        "diffPct": 2.27,
        "isAboveMsp": true,
        "crop": "Wheat",
        "procuringAgency": "FCI / State Civil Supplies Agencies"
      },
      "disclaimer": "Advisory calculation only..."
    },
    "freshness": {
      "timestamp": "2026-11-22T08:50:00.000Z",
      "ageSeconds": 60,
      "isStale": false,
      "source": "Agmarknet Benchmark Fallback (AgriDOST Offline Engine)",
      "provenance": "simulated_fallback"
    }
  }
}
```

---

## 7. Verification & Test Suite Summary

Executed test suite: `tests/market-intelligence-integration.test.ts` via Vitest.

```
 ✓ tests/market-intelligence-integration.test.ts (24 tests) 698ms
   ✓ Market Intelligence: Price Normalization & Zero-Substitution Guard (4)
     ✓ should cleanly parse and normalize valid prices in ₹/quintal
     ✓ CRITICAL RULE: should throw MarketPriceUnavailableError on missing, empty, or zero prices (NEVER substitute 0)
     ✓ normalizeMandiRecord should correctly build MandiPriceRecord with ₹/quintal unit
     ✓ normalizeMandiRecord should throw MarketPriceUnavailableError if raw modal_price is absent
   ✓ Market Intelligence: MSP Registry & Crop Name Matching (2)
     ✓ should contain official 2024-2026 CACP / CCEA MSP data for major crops
     ✓ should handle phonetic transliterations and Hindi crop aliases
   ✓ Market Intelligence: Financial Break-Even & Profitability Math (3)
     ✓ should accurately compute revenue, break-even, and profit margin (1 Tonne = 10 Quintals)
     ✓ should handle fractional tonnes and costs accurately without rounding anomalies
     ✓ should throw error if yield <= 0 or modal price is missing
   ✓ Market Intelligence: MSP Safeguard & Advisory Decision Sentinel (5)
     ✓ RULE 1: should trigger MSP ALERT / HOLD when market price is below Government MSP
     ✓ RULE 2: should trigger SELL when market price exceeds target price by >= 5%
     ✓ RULE 4: should trigger PARTIAL_SELL (50%) when market price meets target price (100% to 104.9%)
     ✓ RULE 5: should trigger HOLD when price is below target but 7-day trend is upward
     ✓ RULE 6: should trigger HOLD when price is below production break-even cost
   ✓ Market Intelligence: Provenance Tracking & Fallback (3)
     ✓ should return simulated_fallback with verified benchmark data when no API key is present
     ✓ should return cached_remote when queried repeatedly within TTL
     ✓ should throw MarketPriceUnavailableError if commodity does not exist in live or benchmark data
   ✓ Market Intelligence: Unified Engine & Health Check (2)
     ✓ getMarketIntelligence should assemble price, MSP, financials, and advisory bundle
     ✓ getMarketHealth should adhere to IntegrationHealthResponse contract
   ✓ Market Intelligence: API Route (GET /api/market) (5)
     ✓ GET /api/market?check=health should return 200 with health response
     ✓ GET /api/market without commodity parameter should return 400 Bad Request
     ✓ GET /api/market?commodity=Wheat&cost=35000&yieldTonnes=3 should return 200 with complete intelligence payload
     ✓ GET /api/market with invalid yield should return 400 Bad Request
     ✓ GET /api/market with unavailable commodity should return 404 with clear error (no zero default)

Test Files: 1 passed (1)
Tests:      24 passed (24)
Duration:   942ms
```

---

## 8. API Key & Environment Setup Guide

To connect live government mandi data in staging or production:

1. Register on [https://data.gov.in](https://data.gov.in) and obtain an API key.
2. Add the key to your `.env.local` or environment variables:
   ```bash
   # data.gov.in Agmarknet API Key (Server-Side Only)
   DATA_GOV_API_KEY=your_actual_data_gov_api_key_here
   
   # Optional: Override Agmarknet daily price resource id if MoA publishes a new version
   DATA_GOV_RESOURCE_ID=9ef84268-d588-465a-a308-a864a43d0070
   ```
3. When `DATA_GOV_API_KEY` is not present, AgriDOST automatically runs in `SIMULATED` mode using historical CACP/Agmarknet benchmarks, ensuring zero downtime for offline demos and developer workstations.
