# AgriDOST — Precision Agriculture & Farm Intelligence OS

> **"Map your farm once. Plan and manage it from one place."**

AgriDOST is a modern, map-first farm management platform designed specifically for small and medium-sized Indian farmers. By creating a unified geospatial foundation, AgriDOST anchors crop zoning, agro-forestry boundary trees, activity reminders, AI leaf health pathology, and precision drone spraying to a single, canonical farm boundary.

---

## Key Capabilities

1. **Smart Farm Cadastral Mapping**
   - Google Maps satellite imagery integration.
   - Interactive polygon drawing, vertex editing, clearing, and saving.
   - Built-in SVG vector map fallback ensuring 100% functionality offline and without API keys.
   - Deterministic area (acres, m², hectares) and perimeter calculations using Turf.js (`@turf/turf`).

2. **AI & Farmer-Selected Crop Planner**
   - Three operational modes: AI-Recommended, Farmer-Selected, and Combined.
   - Traceable agronomic evidence status and missing-information indicators.
   - Colored polygon zone overlays adhering to usable farm acreage without overlap.

3. **Boundary Agro-Forestry Tree Planner**
   - Verified Indian tree catalogue: Teak (*Tectona grandis*), Malabar Neem (*Melia dubia*), Subabul, Moringa, and Casuarina.
   - Perimeter-based tree positioning calculations (`turf.along()`) with spacing options (2.5m, 3.5m, 5.0m).
   - Shade risk analysis, root-competition warnings, and annual carbon sequestration estimates.

4. **Farm Supplies & Operations Manager**
   - Input inventory management (Seeds, Fertilizers, Bio-agents, Tools) with stock indicators.
   - Agronomic task schedule with due dates, categories, and one-click completion.

5. **AI Crop Health & Leaf Pathology**
   - Plant photograph upload via file picker, drag-and-drop, or live camera.
   - Server-side Gemini 2.5 Flash analysis with strict anti-hallucination Zod schema validation.
   - Identifies visible symptoms, possible causes (never claims clinical diagnosis), missing information, and laboratory limitations.
   - Pre-diagnostic reference guide fallback when API keys are not present.

6. **Precision Drone Spray Planner**
   - Mark affected zones and compute spray swath areas using Turf.js.
   - Real-time weather feasibility index (wind speed, temperature, humidity thresholds).
   - Mandatory human verification confirmation.
   - Direct browser-side export of standard RFC 7946 `.geojson` files and mission waypoint `.csv` files for ground control stations.

---

## Anti-Hallucination & Architecture Principles

- **Code for Calculations:** All geometric calculations (area, perimeter, coordinates, tree counts) are computed deterministically with code. Never an LLM.
- **AI for Interpretation:** Gemini 2.5 Flash explains symptoms and suggests agronomic rationale without directly mutating data or geometry.
- **Strict Response Validation:** All server-side AI outputs parse through Zod schemas.
- **Explicit Labelling:** All synthetic records carry visible `[DEMO DATA]` badges.
- **Offline Persistence:** Client-side LocalStorage repository (`src/lib/data/storage.ts`) with custom reactive event dispatchers.

---

## Getting Started

### 1. Prerequisites
- Node.js 20+
- npm 10+

### 2. Setup & Installation
```bash
# Clone and enter directory
cd agridost

# Install dependencies
npm install

# Copy environment template (Optional)
cp .env.example .env.local
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm run start
```

---

## Environment Variables (Optional)

AgriDOST runs out-of-the-box with zero required external keys. To enable live external services:

| Variable | Scope | Description |
|---|---|---|
| `GEMINI_API_KEY` | Server-only | Google Gemini API key for live leaf disease visual scanning. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Client-accessible | Google Maps JavaScript API key for live satellite view. |

---

## Documentation Links
- [PROJECT_CONTRACTS.md](file:///Users/suryanshdixit/Desktop/AgriDOST/agridost/PROJECT_CONTRACTS.md): Shared data contracts and architectural boundaries.
- [AGENT_HANDOFF.md](file:///Users/suryanshdixit/Desktop/AgriDOST/agridost/AGENT_HANDOFF.md): Workstream assignments and LocalStorage APIs.
- [VERCEL_DEPLOYMENT.md](file:///Users/suryanshdixit/Desktop/AgriDOST/agridost/VERCEL_DEPLOYMENT.md): Production deployment guide.
