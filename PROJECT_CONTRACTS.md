# AgriDOST — Shared System Contracts & Architecture Specification

**Version:** 1.0.0  
**Status:** Established by Technical Lead  
**Governing Rule:** All workstreams must strictly adhere to these interfaces and file boundaries. No agent may independently alter shared types, package dependencies, or another agent's files without Lead approval.

---

## 1. Single Source of Truth: Farm Model

Every farm and farm-related entity uses GeoJSON (RFC 7946) Polygon geometry and is tied together by `farmId`.

```typescript
// src/types/index.ts

export type Position = [longitude: number, latitude: number, elevation?: number];

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: Position[][]; // [0] = exterior boundary ring
}

export interface Farm {
  id: string;                    // Unique identifier (e.g. "farm-1740000000000" or "demo-farm-01")
  name: string;                  // User-given farm name
  boundary: GeoJSONPolygon;       // Polygons in [longitude, latitude] coordinates
  areaSqM: number;               // Calculated deterministically using Turf.js
  areaAcres: number;             // Calculated: areaSqM / 4046.856
  location?: string;             // Village / District / State
  soilType?: string;             // Optional farmer input (e.g., "Alluvial", "Black Regur")
  waterSource?: string;          // Optional farmer input (e.g., "Canal", "Tube-well", "Rainfed")
  isDemo?: boolean;              // MUST be true for synthetic/sample records
  createdAt: string;             // ISO 8601 string
  updatedAt: string;             // ISO 8601 string
}
```

---

## 2. Shared Data Contracts for Workstreams

### A. Farm Zones (Used by Agent 2, Agent 3, Agent 4)

```typescript
export type ZoneType = 'crop' | 'disease' | 'spray';

export interface FarmZone {
  id: string;
  farmId: string;                // References parent Farm.id
  type: ZoneType;                // 'crop' | 'disease' | 'spray'
  name: string;                  // e.g. "North Field - Cotton", "Plot B - Blight Hotspot"
  geometry: GeoJSONPolygon;       // Contained within or intersecting farm boundary
  color?: string;                // Hex color for map rendering
  cropName?: string;             // If type === 'crop'
  severity?: 'low' | 'medium' | 'high' | 'critical'; // If type === 'disease'
  sprayStatus?: 'pending' | 'in_progress' | 'completed'; // If type === 'spray'
  notes?: string;
  isDemo?: boolean;
}
```

### B. Crop Plan Contract (Used by Agent 2)

```typescript
export type CropPlanMode = 'ai_recommended' | 'farmer_selected' | 'combined';

export interface CropPlan {
  farmId: string;
  mode: CropPlanMode;
  season?: 'Kharif' | 'Rabi' | 'Zaid' | 'Annual';
  year?: number;
  zones: FarmZone[];
  rationale?: string;            // Why this plan was chosen
  isDemo?: boolean;
}
```

### C. Crop Health Observation Contract (Used by Agent 3)

```typescript
export type AIHealthStatus = 'ai_generated' | 'needs_review' | 'unavailable';

export interface HealthObservation {
  id: string;
  farmId: string;                // References parent Farm.id
  zoneId?: string;               // Optional link to a specific FarmZone
  imagePreviewUrl?: string;      // Base64 or local object URL
  symptoms: string[];            // Visible leaf/plant symptoms
  possibleCauses: string[];      // Fungal, bacterial, pest, nutrient
  confidenceNote?: string;       // Explicit disclaimer on confidence
  status: AIHealthStatus;        // Must NEVER claim confirmed clinical diagnosis
  missingInformation: string[];   // What additional physical evidence is needed
  limitations: string[];         // Image angle, lighting, laboratory limitations
  sources?: { title: string; url: string }[]; // Verifiable citations only; empty if none
  createdAt: string;
  isDemo?: boolean;
}
```

### D. Farm Supplies, Boundary Trees & Drone Spray (Used by Agent 4)

```typescript
export interface FarmTask {
  id: string;
  farmId: string;
  title: string;
  dueDate: string;               // YYYY-MM-DD
  status: 'pending' | 'completed';
  category: 'irrigation' | 'fertilizer' | 'inspection' | 'harvest' | 'general';
  isDemo?: boolean;
}

export interface FarmSupply {
  id: string;
  farmId: string;
  itemName: string;              // e.g. "DAP Fertiliser", "Bio-Neem"
  quantity: number;
  unit: 'kg' | 'liters' | 'bags' | 'packets';
  status: 'in_stock' | 'low' | 'ordered';
  isDemo?: boolean;
}

export interface BoundaryTreePlan {
  id: string;
  farmId: string;
  speciesName: string;           // e.g. "Teak", "Subabul", "Moringa", "Melia Dubia"
  spacingMeters: number;         // Sourced spacing (e.g. 3m)
  treeCount: number;             // Calculated by perimeter / spacing
  shadeRisk: 'low' | 'medium' | 'high';
  rootCompetitionNote: string;
  suggestedPositions: Position[]; // [lng, lat] along farm boundary
  isDemo?: boolean;
}

export interface DroneSprayExport {
  farmId: string;
  zoneId: string;
  areaSqM: number;
  areaAcres: number;
  geoJsonPolygon: GeoJSONPolygon;
  recommendedSprayWindow: string; // Weather-checked window
  humanVerified: boolean;        // Mandatory confirmation checkbox before export
  exportedAt: string;
}
```

---

## 3. Strict Anti-Hallucination & Evidence Policy

1. **Calculations in Code:** All area and perimeter calculations must be computed using Turf.js (`@turf/turf`). Never ask Gemini to calculate hectares or square metres.
2. **AI for Explanations Only:** Gemini 2.5 Flash interprets photographs and suggests agronomic reasoning. It never directly mutates geometry or saves to storage.
3. **Zod Schema Validation:** All server-side Gemini outputs must parse through strict Zod schemas before being sent to the client.
4. **Labels on Every Item:**
   - `[Farmer-provided]` (Inputs typed by user)
   - `[Calculated]` (Turf.js deterministic results)
   - `[AI-Generated - Requires Field Verification]` (Gemini outputs)
   - `[DEMO DATA]` (Sample pre-loaded records)
5. **Missing Information & Failures:** If the Gemini API key is missing or an error occurs, the UI must show a helpful fallback/error card explaining how to add `GEMINI_API_KEY`. It must **never** fabricate a fake disease diagnosis.

---

## 4. LocalStorage Keys & Persistence Convention

All persistence is client-side in the browser `window.localStorage` to keep the hackathon MVP fast and independent of complex cloud databases:

| Key | Purpose |
|-----|---------|
| `agridost_farms` | JSON array of `Farm[]` |
| `agridost_active_farm_id` | String ID of the currently selected farm |
| `agridost_zones` | JSON array of `FarmZone[]` |
| `agridost_crop_plans` | JSON array of `CropPlan[]` |
| `agridost_health_records` | JSON array of `HealthObservation[]` |
| `agridost_tasks` | JSON array of `FarmTask[]` |
| `agridost_supplies` | JSON array of `FarmSupply[]` |
| `agridost_tree_plans` | JSON array of `BoundaryTreePlan[]` |

A custom browser event `window.dispatchEvent(new Event('agridost:data-changed'))` is triggered on every write so all open tabs and components reactively re-render.

---

## 5. Workstream Ownership Boundaries

| Workstream | Team Member | Scope / Owned Files |
|------------|-------------|---------------------|
| **Lead / Integration** | Lead | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/types/**`, `src/lib/data/**`, `src/components/layout/**`, `src/components/dashboard/**`, `PROJECT_CONTRACTS.md` |
| **Agent 2** | Farm Mapping & Crop Planner | `src/components/map/**`, `src/components/planner/**`, `src/lib/geo/**` |
| **Agent 3** | AI Crop Health & Gemini | `src/components/health/**`, `src/app/api/ai/health/route.ts`, `src/lib/ai/**` |
| **Agent 4** | Trees, Supplies & Drone Planner | `src/components/operations/**`, `src/components/supplies/**`, `src/components/drone/**` |

**Rule:** No agent may write to files outside their designated paths without notifying the Lead.
