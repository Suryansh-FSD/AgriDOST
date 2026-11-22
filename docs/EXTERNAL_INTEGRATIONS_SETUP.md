# AgriDOST 4.0: External Integrations Setup & Configuration Manual

**Version:** 4.0.0-PROD-READY  
**Target Audience:** System Administrators, DevOps Engineers, and Farm Technical Operators  
**Last Updated:** November 22, 2026  

---

## Quick Reference: Required Environment Variables

Add or verify these environment variables in your `.env.local` or production container environment:

```bash
# ==============================================================================
# 1. SUPABASE DATABASE & AUTHENTICATION
# ==============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...<your-anon-key>
# Optional for server-side administrative tasks only:
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...<your-service-role-key>

# ==============================================================================
# 2. GOOGLE GEMINI AI
# ==============================================================================
GEMINI_API_KEY=AIzaSy...<your-google-ai-studio-key>

# ==============================================================================
# 3. OPEN-METEO WEATHER (Zero API key required)
# ==============================================================================
# Open-Meteo provides free public access. Attribution is required:
# "Weather data by Open-Meteo.com (CC-BY 4.0)"
DEFAULT_FARM_LATITUDE=20.00
DEFAULT_FARM_LONGITUDE=73.78

# ==============================================================================
# 4. DATA.GOV.IN MANDI MARKET INTELLIGENCE
# ==============================================================================
DATA_GOV_IN_API_KEY=<your-data-gov-in-api-key>
# Agmarknet Daily Mandi Spot Price Resource ID:
DATA_GOV_IN_RESOURCE_ID=9ef84268-d588-465a-a308-a864a43d0070

# ==============================================================================
# 5. TELEGRAM BOT NOTIFICATIONS
# ==============================================================================
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_BOT_USERNAME=AgriDOST_Alerts_Bot
TELEGRAM_WEBHOOK_SECRET=your_super_secret_webhook_token_32chars
NEXT_PUBLIC_APP_URL=https://app.agridost.in

# ==============================================================================
# 6. GOOGLE MAPS JAVASCRIPT API
# ==============================================================================
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...<your-google-maps-api-key>
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=<optional-custom-map-style-id>
```

---

## 1. Supabase Database & Offline-to-Cloud Sync

### Step 1.1: Create a Supabase Project
1. Navigate to [https://supabase.com](https://supabase.com) and log in.
2. Click **New Project**, select your organization, choose a region closest to your users (e.g., `ap-south-1` Mumbai for India), and enter a secure database password.
3. Once provisioned, navigate to **Project Settings > API**.
4. Copy the **Project URL** and the **`anon` `public` key**.

### Step 1.2: Execute Core Schema Migration
AgriDOST includes a comprehensive SQL migration that provisions all 9 domain tables, sets up Row Level Security (RLS), adds cascade foreign keys, and indexes for high-throughput queries:

1. In the Supabase Dashboard, open the **SQL Editor**.
2. Click **New query**.
3. Open `supabase/migrations/20261122_agridost_core.sql` from the repository.
4. Copy its entire content into the SQL editor and click **Run**.
5. Verify that the following tables were created with RLS enabled:
   - `farms`
   - `zones`
   - `crop_plans`
   - `health_records`
   - `farm_tasks`
   - `supplies`
   - `tree_plans`
   - `spray_operations`
   - `sync_queue`

### Step 1.3: Verify Row Level Security (RLS)
The migration automatically configures RLS on all tables:
```sql
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "farms_farmer_isolation" ON farms
  FOR ALL USING ((select auth.uid()) = farmer_id);
```
This guarantees strict data isolation: authenticated farmers can only read and mutate their own farm records.

---

## 2. Google Gemini AI (Multimodal Leaf Diagnostics & Advisory)

### Step 2.1: Obtain API Key from Google AI Studio
1. Visit [https://aistudio.google.com](https://aistudio.google.com).
2. Sign in with your Google account.
3. Click **Get API key** $\rightarrow$ **Create API key in new project**.
4. Copy the generated key and assign it to `GEMINI_API_KEY` in `.env.local`.

### Step 2.2: Candidate Model Strategy
AgriDOST 4.0 utilizes a dynamic failover cascade:
1. Primary candidate: `gemini-3.8-flash` (tested and verified online).
2. Fallback candidate 1: `gemini-2.5-flash`.
3. Fallback candidate 2: `gemini-2.0-flash`.
4. Fallback candidate 3: `gemini-1.5-flash`.
5. Offline fallback: Deterministic ICAR/KVK agronomic advisory registry (`src/lib/ai/system-prompt.ts`).

### Step 2.3: Verify Connectivity
Run the integration health check:
```bash
curl -X GET http://localhost:3000/api/ai/health
```
Expected response:
```json
{
  "provider": "google-gemini",
  "operatingMode": "LIVE",
  "connectivityStatus": "online",
  "activeModel": "gemini-3.8-flash",
  "latencyMs": 142
}
```

---

## 3. Open-Meteo Weather & Drone Spray Safety

### Step 3.1: Terms of Use & Attribution
- Open-Meteo does **not** require an API key for fair use ($<10,000$ daily calls).
- AgriDOST includes required attribution in all weather views: `Weather data by Open-Meteo.com (CC-BY 4.0)`.
- If scaling beyond 10,000 calls/day, obtain a commercial API key from [https://open-meteo.com/en/pricing](https://open-meteo.com/en/pricing) and supply `&apikey=<YOUR_KEY>` in `buildOpenMeteoUrl`.

### Step 3.2: Cache Configuration
- Weather queries are cached in-memory and in client storage for 15 minutes (`CACHE_TTL_MS = 15 * 60 * 1000`).
- To force an immediate refresh (e.g. for urgent drone spray checks), pass `{ forceRefresh: true }` or click **Refresh Weather** in the Drone Spray Planner UI.

---

## 4. Data.gov.in Mandi Market Intelligence

### Step 4.1: Register on Data.gov.in (Open Government Data Platform India)
1. Visit [https://data.gov.in](https://data.gov.in) and register for a developer account.
2. Navigate to **My Account > API Key** to generate your 48-character API token.
3. Set `DATA_GOV_IN_API_KEY` in your `.env.local`.

### Step 4.2: Resource Verification
AgriDOST connects to the official daily spot prices dataset published by the Directorate of Marketing & Inspection (DMI):
- **Resource ID:** `9ef84268-d588-465a-a308-a864a43d0070`
- **Fields normalized:** `state`, `district`, `market`, `commodity`, `variety`, `arrival_date`, `min_price`, `max_price`, `modal_price`.
- **Anti-Zero Protection:** If a commodity price is missing from the API response, AgriDOST never substitutes 0. It falls back to official CACP MSP floors (`OFFICIAL_MSP_REGISTRY` in `src/lib/market/msp-registry.ts`).

---

## 5. Telegram Bot Farmer Notification System

### Step 5.1: Create Bot via @BotFather
1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`.
3. Choose a display name: `AgriDOST Farmer Advisory`.
4. Choose a username ending in `bot`: e.g. `AgriDOST_Alerts_Bot`.
5. Copy the HTTP API token provided by BotFather and set `TELEGRAM_BOT_TOKEN` in `.env.local`.

### Step 5.2: Configure Webhook (Production)
In production, register your Next.js webhook endpoint with Telegram:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://app.agridost.in/api/telegram/webhook",
    "secret_token": "your_super_secret_webhook_token_32chars",
    "allowed_updates": ["message"]
  }'
```

### Step 5.3: Farmer Opt-In Flow
1. Farmer navigates to AgriDOST Alert Center in the web app.
2. Farmer clicks **Connect Telegram Bot**, which opens `https://t.me/AgriDOST_Alerts_Bot?start=<FARMER_UUID>`.
3. Farmer presses **Start**.
4. The webhook receives `/start <FARMER_UUID>`, stores opt-in consent (`optInStatus = true`), and sends a bilingual welcome message.
5. To opt out, the farmer sends `/stop` or `/unsubscribe` at any time.

---

## 6. Google Maps JavaScript API

### Step 6.1: Google Cloud Console Setup
1. Visit [https://console.cloud.google.com](https://console.cloud.google.com).
2. Create or select a Google Cloud Project.
3. Enable the **Maps JavaScript API**.
4. Navigate to **APIs & Services > Credentials** $\rightarrow$ **Create Credentials > API Key**.
5. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`.

### Step 6.2: Restrict the API Key (Crucial Security Step)
To protect your \$200 monthly free credit from unauthorized use:
1. Under **Application restrictions**, choose **Websites (HTTP referrers)**.
2. Add your authorized domains:
   - `http://localhost:3000/*` (development)
   - `https://app.agridost.in/*` (production)
3. Under **API restrictions**, select **Restrict key** and choose only **Maps JavaScript API**.

### Step 6.3: Offline / Vector Fallback
- If `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is not provided or if the browser has no internet access, AgriDOST automatically mounts the `VectorFarmMap` SVG interactive renderer.
- All Turf.js area, boundary, and perimeter calculations continue to operate seamlessly offline.
