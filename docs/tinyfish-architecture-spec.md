# AgriDOST × TinyFish AI: Architecture Specification & Integration Contract

## 1. Executive Summary
TinyFish AI provides live web intelligence capabilities:
1. **TinySearch**: Low-latency (1–3s) ranked web search optimized for agentic queries with structured snippets, publication dates, and source URLs.
2. **TinyFetch**: Fast content extraction (1–20s) for JavaScript-rendered sites, converting HTML into clean Markdown or text.
3. **TinyAgent**: Controlled multi-step browser automation (15–60s) for deep research and structured data extraction.
4. **TinyBrowser**: Remote browser session provisioning via CDP (optional, preserved for raw session needs, not required for core research).

All calls authenticate server-side via the `X-API-Key` HTTP header.

## 2. Live Verification Results (Empirical)
Tested against production `api.search.tinyfish.ai`, `api.fetch.tinyfish.ai`, and `agent.tinyfish.ai`:
- **TinySearch**: Successfully retrieved verified Indian agricultural portal results (`pmkisan.gov.in`, `pmindia.gov.in`, `pib.gov.in`).
- **TinyFetch**: Extracted clean markdown content from `pmkisan.gov.in` in 433ms.
- **TinyAgent**: Executed autonomous inspection on `pmkisan.gov.in` and extracted the 24th installment release details (`30 October 2026, Banaskantha, Gujarat`) in structured JSON.

## 3. Capability Matrix & SLA Guidelines

| Capability | Endpoint | Method | Latency | AgriDOST Use Case |
|---|---|---|---|---|
| **TinySearch** | `https://api.search.tinyfish.ai` | `GET` | 1–3s | Real-time government scheme discovery, mandi news, pest alerts, research papers |
| **TinyFetch** | `https://api.fetch.tinyfish.ai` | `POST` | 1–20s | Full-page extraction from APMC portals, state agriculture department notices |
| **TinyAgent** | `https://agent.tinyfish.ai/v1/automation/run` | `POST` | 15–60s | Complex multi-page research, deep verification of scheme updates |
| **Offline Fallback** | Local Agronomic Engine | Local | <10ms | Zero-connectivity operation, offline demo, API quota exhaustion |

## 4. Source Classification & Provenance Guardrails

1. **Official Government Sources (`official_gov`)**:
   - Domains ending in `.gov.in`, `.nic.in`, `pmkisan.gov.in`, `agmarknet.gov.in`, `pib.gov.in`, `india.gov.in`.
   - Highest confidence; eligible for authoritative scheme notices.
2. **State Agriculture Departments (`state_agri_dept`)**:
   - `krishi.maharashtra.gov.in`, `upagripardarshi.gov.in`, `agri.gujarat.gov.in`, etc.
3. **ICAR & State Agricultural Universities (`icar_kvk_research`)**:
   - `icar.org.in`, `iari.res.in`, `tnausip.ac.in`, `pau.edu`, `uasd.edu`.
   - Authoritative for crop disease, pest control, and scientific agronomy.
4. **Mandi Boards & APMC (`mandi_board`)**:
   - `msamb.com`, `punjabmandiboard.gov.in`, `rajamb.com`.
   - Authoritative for regional spot market arrivals and modal prices.
5. **Secondary Sources (`secondary`)**:
   - General news, blogs, and unverified portals. Clearly labeled as "Secondary / Unverified" in UI and never mixed with verified statutory MSP or official schemes without explicit disclaimers.

## 5. Security & SSRF Defense

- **URL Validation**: Strict rejection of private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `localhost`, `169.254.169.254`, AWS/GCP metadata endpoints).
- **Protocol Enforcement**: Only `http:` and `https:`.
- **Prompt Injection Defense**: All scraped text treated as untrusted data (`untrusted_web_content`), wrapped in protective parsing boundaries, never directly evaluated as system prompts.
- **Controlled Automation**: TinyAgent restricted to read-only research; never allowed to perform form submissions, wallet payments, or modify external accounts.
