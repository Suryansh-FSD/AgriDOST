# AgriDOST — Agent Handoff & Architecture Contract

## Overview
AgriDOST is an AI-powered farm management platform for small and medium-sized Indian farmers.
Central concept: **A farmer maps their land once, and AgriDOST uses that same map to manage the entire farm.**

---

## Shared Tech Stack
- **Framework:** Next.js 16.4 (App Router)
- **UI:** React 19, Tailwind CSS v4, Lucide React
- **Geospatial:** `@turf/turf`, RFC 7946 GeoJSON `[longitude, latitude]` coordinates
- **AI:** `@google/genai` (Server-side Gemini 2.5 Flash), `zod` schema validation
- **Persistence:** Client-side LocalStorage repository (`src/lib/data/storage.ts`)

---

## File Ownership & Workstream Boundaries

| Workstream | Subagent | Owned Directories & Files |
|---|---|---|
| **Main / Lead** | Primary Coordinator | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/components/layout/**`, `src/components/dashboard/**`, `src/types/**`, `src/lib/data/**`, `PROJECT_CONTRACTS.md`, `AGENT_HANDOFF.md`, `VERCEL_DEPLOYMENT.md` |
| **Agent 2** | `MAP_AND_CROP_AGENT` | `src/components/map/**`, `src/components/planner/**`, `src/lib/geo/**` |
| **Agent 3** | `GEMINI_HEALTH_AGENT` | `src/components/health/**`, `src/lib/ai/**`, `src/app/api/ai/health/route.ts` |
| **Agent 4** | `FARM_OPERATIONS_AGENT` | `src/components/operations/**`, `src/components/supplies/**`, `src/components/drone/**` |

**CRITICAL RULE:** Do NOT modify files outside your assigned paths. Do not independently edit `package.json` or `src/types/index.ts`. All dependencies (`@turf/turf`, `@google/genai`, `zod`, `lucide-react`) are pre-installed.

---

## Shared Contracts Summary (`src/types/index.ts`)

### 1. Single Farm Model
```typescript
export interface Farm {
  id: string;               // Unique ID, e.g. "demo-farm-01" or generated
  name: string;             // Farmer-entered name
  boundary: GeoJSONPolygon;  // RFC 7946 GeoJSON Polygon [longitude, latitude]
  areaSqM: number;          // Calculated deterministically using Turf.js
  areaAcres: number;        // Calculated: areaSqM / 4046.856
  location?: string;        // Village / District / State
  soilType?: string;        // e.g. "Medium Black Soil"
  waterSource?: string;     // e.g. "Canal", "Tube-well"
  isDemo?: boolean;         // true for pre-seeded records
  createdAt: string;
  updatedAt: string;
}
```

### 2. Farm Zones (Crop, Disease, Spray)
```typescript
export type ZoneType = 'crop' | 'disease' | 'spray';

export interface FarmZone {
  id: string;
  farmId: string;           // References parent Farm.id
  type: ZoneType;
  name: string;
  geometry: GeoJSONPolygon;
  color?: string;
  areaSqM?: number;
  areaAcres?: number;
  cropName?: string;
  cropVariety?: string;
  diseaseName?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  sprayStatus?: 'pending' | 'in_progress' | 'completed' | 'scheduled';
  chemicalName?: string;
  notes?: string;
  isDemo?: boolean;
}
```

### 3. Crop Plan
```typescript
export type CropPlanMode = 'ai_recommended' | 'farmer_selected' | 'combined';

export interface CropPlan {
  farmId: string;
  mode: CropPlanMode;
  season?: 'Kharif' | 'Rabi' | 'Zaid' | 'Annual';
  year?: number;
  zones: FarmZone[];
  rationale?: string;
  isDemo?: boolean;
}
```

### 4. Crop Health Observation (Agent 3)
```typescript
export interface HealthObservation {
  id: string;
  farmId: string;
  zoneId?: string;
  imagePreviewUrl?: string;
  symptoms: string[];
  possibleCauses: string[];
  confidenceNote?: string;
  status: 'ai_generated' | 'needs_review' | 'unavailable';
  missingInformation?: string[];
  limitations?: string[];
  sources?: { title: string; url: string }[];
  createdAt: string;
  isDemo?: boolean;
}
```

### 5. Farm Operations & Drone Spray (Agent 4)
```typescript
export interface FarmTask {
  id: string;
  farmId: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'completed';
  category?: 'irrigation' | 'fertilizer' | 'inspection' | 'harvest' | 'general';
  isDemo?: boolean;
}

export interface FarmSupply {
  id: string;
  farmId: string;
  itemName: string;
  quantity: number;
  unit: 'kg' | 'liters' | 'bags' | 'packets';
  status: 'in_stock' | 'low' | 'ordered';
  isDemo?: boolean;
}

export interface BoundaryTreePlan {
  id: string;
  farmId: string;
  speciesName: string;
  spacingMeters: number;
  treeCount: number;
  shadeRisk: 'low' | 'medium' | 'high';
  rootCompetitionNote: string;
  suggestedPositions: [number, number][]; // [lng, lat]
  isDemo?: boolean;
}

export interface DroneSprayExport {
  farmId: string;
  zoneId: string;
  areaSqM: number;
  areaAcres: number;
  geoJsonPolygon: GeoJSONPolygon;
  recommendedSprayWindow: string;
  humanVerified: boolean;
  exportedAt: string;
}
```

---

## LocalStorage Repository API (`src/lib/data/storage.ts`)

Import helpers from `@/lib/data/storage`:
- `getFarms()`, `getFarmById(id)`, `saveFarm(farm)`, `deleteFarm(id)`
- `getActiveFarm()`, `getActiveFarmId()`, `setActiveFarmId(id)`
- `getFarmZones(farmId?)`, `saveFarmZone(zone)`, `deleteFarmZone(id)`
- `getCropPlans(farmId?)`, `saveCropPlan(plan)`
- `getHealthObservations(farmId?)`, `saveHealthObservation(record)`
- `getFarmTasks(farmId?)`, `saveFarmTask(task)`, `toggleFarmTask(id)`
- `getFarmSupplies(farmId?)`, `saveFarmSupply(supply)`
- `getTreePlans(farmId?)`, `saveTreePlan(plan)`
- `getSprayOperations(farmId?)`, `saveSprayOperation(op)`
- React hook: `useFarmData()` from `@/lib/data/useFarmData` for auto-reactive data synchronization.

---

## Anti-Hallucination Principles
1. **Deterministic Calculations:** Always compute area, perimeter, and tree counts using code and Turf.js (`@turf/turf`). Never guess or use an LLM for numeric area calculation.
2. **AI Explanations Only:** Gemini analyzes symptoms and provides agronomic reasoning. It never mutates farm geometry.
3. **Zod Validation:** All server-side responses from Gemini must pass Zod schema validation.
4. **Transparent Labelling:** Clearly label all estimates, AI-generated insights, and demo data (`[DEMO DATA]`).
5. **Human Verification:** Drone spray exports and disease treatments require explicit farmer confirmation before saving.
