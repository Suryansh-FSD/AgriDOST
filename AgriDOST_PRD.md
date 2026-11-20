# AgriDOST
## Product Requirements Document (PRD)
**Version:** 1.0  
**Date:** 20 November 2026  
**Build target:** 3-hour hackathon MVP  
**Product:** AgriDOST  
**Audience:** Small and medium-sized farmers in India

---

## 1. Product summary

AgriDOST is a map-first farm planning and management application for small and medium-sized Indian farmers. A farmer maps their land once. The same farm boundary is then used by crop planning, boundary tree planning, farm reminders, crop-health observations and drone spray-zone planning.

**Product promise:** Map your farm once. Plan and manage it from one place.

AgriDOST is a decision-support prototype. It does not replace local agricultural experts, laboratory soil tests, product labels, or qualified drone operators.

## 2. Problem

Farmers often need to make several connected decisions using disconnected tools or advice:
- How much land is available?
- Which crops may suit the location, season, soil and water availability?
- How should selected crops be arranged across the land?
- Which trees could be planted along the boundary without harming crops?
- Which farm activities and supplies are coming due?
- What might be affecting a plant?
- Which part of the farm needs closer inspection or a treatment plan?

The information needed for these decisions is fragmented. AgriDOST brings the farm boundary and farmer-provided information into one shared workspace.

## 3. Target users

Primary users:
- Small and medium-sized farmers in India.
- Farmers who need a simple visual way to plan fields and farm activities.
- Farmers using smartphones and who may have limited experience with complex software.

Design requirements:
- Mobile-first, readable interface.
- Plain language and clear units.
- Large touch targets.
- Explicit distinction between verified information, estimates, demo data and AI-generated interpretation.

## 4. Product goals

1. Let a farmer create and save a farm boundary.
2. Calculate approximate area and perimeter from that boundary.
3. Let farmers explore crop combinations and manually allocate crops to map zones.
4. Show proposed boundary-tree locations.
5. Create editable supply and activity reminders.
6. Analyse uploaded crop photographs for visible symptoms and possible causes.
7. Let a farmer mark an affected area and export a spray-planning geometry.
8. Keep all farm-related modules connected through one farm ID and GeoJSON geometry.

## 5. Non-goals for the 3-hour MVP

Do not attempt:
- Autonomous drone flight or chemical dispensing.
- A custom-trained crop disease model.
- Guaranteed crop suitability, yield, profit or market-price predictions.
- Automated pesticide or fertiliser dosage recommendations.
- Full agronomic optimisation or a national crop knowledge database.
- User authentication, payments, multi-tenant permissions or a production backend unless already present.
- Live satellite crop-health analysis or claims that satellite imagery identifies disease.
- A complex supply-chain marketplace.

These are future possibilities, not MVP commitments.

## 6. Main user journey

1. Open the dashboard.
2. Create a farm and enter its name and location.
3. Draw the farm boundary on a satellite map, or load an explicitly labelled demo farm if map credentials are unavailable.
4. View approximate area in acres and hectares.
5. Enter location, season, soil and water information.
6. View crop options with evidence status and missing information clearly shown.
7. Select crops and allocate portions of the farm to crop zones.
8. View proposed boundary-tree markers.
9. Add supply items and activity reminders.
10. Upload a crop photograph and review the AI's possible symptom analysis.
11. Mark an affected zone and export a GeoJSON spray-planning file after human verification.

## 7. Functional requirements

### 7.1 Farm mapping
- Google Maps satellite view is the preferred map experience.
- Support drawing, editing and deleting a farm polygon.
- Store geometry as GeoJSON.
- Calculate area and perimeter using Turf.js, not an LLM.
- Display square metres, hectares and acres.
- Label map-derived measurements as approximate.
- Allow manual correction of displayed area without silently changing geometry.
- If the Maps key is missing or invalid, show a clearly labelled demo state. Never pretend a static image is a live interactive map.

### 7.2 Crop planning
Two modes must be available:
- **AI-assisted suggestions:** use available farmer inputs and a small, traceable knowledge set. If evidence is missing, say so and request the missing inputs.
- **Farmer-selected planning:** farmer selects crops and assigns land area or map zones.

Combined mode:
- Show suggestions, then let the farmer edit the crop selection and allocation.

Rules:
- Use deterministic code for area allocation and geometry checks.
- Crop zones must not exceed the farm's usable area.
- Detect overlaps and zones outside the farm boundary.
- Do not invent yield, profit, crop suitability or water requirements.
- Any sample crop advice must be labelled as illustrative demo content, not verified local guidance.

### 7.3 Boundary tree planner
- Allow selection of tree options from a small demo catalogue.
- Display proposed boundary markers using geometry calculations.
- Spacing and suitability must be sourced or entered as user-provided assumptions.
- If verified regional information is unavailable, label the plan as illustrative and ask the farmer to consult local forestry/agriculture guidance.
- Show shade and root-competition caveats.

### 7.4 Supplies and reminders
- Allow manual entry of supply items, stock, units and due dates.
- Generate simple reminders from farmer-entered dates and crop-stage assumptions.
- Do not invent fertiliser or pesticide application rates.
- Quantity calculations require an explicit rate and source or farmer-provided value. Show the formula and units.

### 7.5 Crop health
- Allow image upload.
- Send image to Gemini through a server-side API route.
- Ask for visible symptoms, possible causes, alternative explanations, missing information and next verification steps.
- Clearly label output as AI-generated and not a confirmed diagnosis.
- Do not generate chemical dosages or claim certainty from an image alone.
- If the key is missing or the API fails, show an unavailable/error state, not fabricated output.

### 7.6 Drone spray planner
- Let the farmer draw or select a spray-planning polygon.
- Calculate its area using Turf.js.
- Keep it within the farm boundary.
- Export GeoJSON; CSV may contain zone metadata and area.
- Require human verification.
- No flight control, pesticide selection or autonomous spraying.

### 7.7 Dashboard
Show:
- Farms and approximate total mapped area.
- Crop zones.
- Upcoming user-entered tasks.
- Recent crop-health observations.
- Shortcuts to core modules.
All demo records must be labelled as demo data.

## 8. Fixed technical architecture

### Stack
- **Framework:** Existing project framework. If the project is already Next.js, retain Next.js App Router.
- **Language:** TypeScript.
- **UI:** Existing Tailwind CSS setup; use existing component library if present.
- **Icons:** Lucide React if already installed or quick to add.
- **Map:** Google Maps JavaScript API.
- **Map drawing:** Terra Draw with its Google Maps adapter. Do not use the deprecated Google Maps Drawing Library.
- **Geometry:** Turf.js.
- **AI:** Gemini through the official `@google/genai` SDK, server-side only.
- **Validation:** Zod.
- **Weather:** Excluded from the critical MVP path. Add only if time remains and a real location/API request can be made.
- **Persistence:** LocalStorage for the hackathon demo.
- **Deployment:** Existing deployment target; Vercel only if the project is compatible and time allows.

### Architecture principles
1. Keep one shared farm model.
2. Store all farm geometry as GeoJSON.
3. Use code for calculations, not Gemini.
4. Gemini explains or interprets. It does not write directly to the database or mutate geometry.
5. Validate all AI JSON responses with Zod.
6. Keep Gemini API keys on the server.
7. Do not add Supabase, authentication, queues, microservices or a separate backend for this time-boxed MVP.
8. Do not replace working project configuration without a clear reason.
9. Do not add dependencies unless needed and verified against the current project.

### Suggested project boundaries
Adapt these paths to the existing project rather than forcing a restructure:

- `src/components/layout/` — navigation and shell
- `src/components/dashboard/` — overview
- `src/components/map/` — map and drawing
- `src/components/planner/` — crop planner
- `src/components/health/` — image upload and results
- `src/components/operations/` — trees and farm tasks
- `src/components/supplies/` — stock and reminders
- `src/components/drone/` — spray-zone planner
- `src/lib/geo/` — Turf.js calculations
- `src/lib/data/` — LocalStorage repository and demo records
- `src/lib/ai/` — Gemini client, prompts and schemas
- `src/app/api/ai/` — server-side AI route (Next.js only)
- `src/types/` — shared models

## 9. Shared data contracts

Use TypeScript types consistent with the existing project's conventions.

```ts
type Farm = {
  id: string;
  name: string;
  location?: string;
  boundary: GeoJSON.Polygon;
  areaSqM: number;
  areaAcres: number;
  isDemo?: boolean;
};

type FarmZone = {
  id: string;
  farmId: string;
  type: "crop" | "disease" | "spray";
  name: string;
  geometry: GeoJSON.Polygon;
  isDemo?: boolean;
};

type CropPlan = {
  farmId: string;
  mode: "ai_recommended" | "farmer_selected" | "combined";
  zones: FarmZone[];
};

type HealthObservation = {
  id: string;
  farmId: string;
  zoneId?: string;
  symptoms: string[];
  possibleCauses: string[];
  status: "ai_generated" | "needs_review" | "unavailable";
  createdAt: string;
  isDemo?: boolean;
};

type FarmTask = {
  id: string;
  farmId: string;
  title: string;
  dueDate: string;
  status: "pending" | "completed";
  isDemo?: boolean;
};
```

Additional records may be added only when a module needs them. All farm-linked records must reference `farmId`.

## 10. Anti-hallucination and evidence policy

AgriDOST distinguishes four labels:

- **Farmer-provided:** entered by the user.
- **Calculated:** produced by deterministic code from known inputs.
- **Source-backed:** supported by an identifiable source actually consulted.
- **AI-generated:** interpretation from Gemini that needs review.
- **Demo data:** synthetic information for demonstration.

Rules:
- Never invent source names, links, dates or scientific recommendations.
- Never describe a demo record as real.
- Never invent missing weather, prices, yield or crop data.
- If information is insufficient, return `insufficient_data`.
- AI responses must include limitations and missing information.
- Validate AI output before rendering.
- Never let AI directly edit farm geometry or farmer-entered values.
- Human review is required before acting on disease or spray suggestions.

Suggested AI response shape:

```ts
type AIResult = {
  status: "supported" | "partial" | "insufficient_data";
  observations: string[];
  possibleCauses: string[];
  explanation: string[];
  missingInformation: string[];
  limitations: string[];
  sources: { title: string; url: string }[];
};
```

Only populate `sources` with sources actually supplied to or retrieved by the application. An empty source list is preferable to fabricated citations.

## 11. Three-hour delivery plan

### 0–15 minutes
- Inspect the existing project.
- Confirm framework, package manager and current build.
- Create shared contracts and file ownership.
- Start the app and preserve a working baseline.

### 15–65 minutes
- Work in parallel on map/crop planning, AI/health, and operations/drone.
- Main agent builds shell, dashboard, shared types and persistence.
- Avoid overlapping edits.

### 65–100 minutes
- Integrate modules into the application.
- Ensure every module uses the same `farmId` and GeoJSON geometry.
- Fix imports and interface mismatches.

### 100–130 minutes
- Test the complete farmer journey.
- Fix broken map, AI and export interactions.
- Check missing-key states.

### 130–155 minutes
- Run TypeScript, lint and production build.
- Fix critical errors and mobile layout.

### 155–180 minutes
- Prepare a labelled demo farm.
- Rehearse the end-to-end presentation.
- Deploy only if the build is stable.

## 12. Acceptance criteria

The MVP is ready to demonstrate when:

1. The application starts without a fatal error.
2. Dashboard and navigation work.
3. A farm polygon can be drawn or a clearly labelled demo farm loaded.
4. Area calculation works on known test geometry.
5. Crop selection and allocation update the map.
6. Invalid allocations and overlapping zones are rejected or flagged.
7. Tree markers can be displayed as proposed placements.
8. Tasks and supply records persist after refresh.
9. Image analysis either returns a validated Gemini response or a truthful unavailable/error state.
10. Spray zones can be drawn, measured and exported as GeoJSON.
11. Every demo record is visibly labelled.
12. No module presents fabricated information as verified fact.

## 13. Future roadmap, outside the hackathon MVP

- Supabase authentication and cloud persistence.
- Verified regional crop and tree knowledge base.
- State Agricultural University and KVK source integrations.
- Soil Health Card import.
- Weather-aware crop calendar.
- Market-price integration from reliable sources.
- Hindi and additional Indian-language interface.
- Offline-first progressive web app.
- Agronomist review workflow.
- Integration with certified drone operators.

---

## Final product principle

**AgriDOST must never pretend to know something it does not know.**

Calculate with code. Explain with AI. Show sources when available. Label estimates and demo data. Ask for missing information. Require human verification before agricultural action.
