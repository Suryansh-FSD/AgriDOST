import { GeoJSONPolygon, Position, BoundingBox } from './geojson';

export * from './geojson';

export interface LocationDetails {
  village?: string;
  district?: string;
  city?: string;
  state?: string;
  country: string;
  coordinates: Position; // [longitude, latitude]
  address?: string;
  pincode?: string;
}

/**
 * 1. Farm Model (Single Source of Truth)
 */
export interface Farm {
  id: string;
  name: string;
  boundary: GeoJSONPolygon;
  areaSqM: number;
  areaAcres: number;
  location?: string;
  locationDetails?: LocationDetails;
  soilType?: string;
  waterSource?: string;
  primaryCrop?: string;
  irrigationType?: string;
  ownerName?: string;
  surveyNumber?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 2. FarmZone Model
 * Delineated sectors within a farm boundary:
 * - 'crop': Delineated crop varieties or planting parcels
 * - 'disease': Delineated pest/blight/infection hotspot
 * - 'spray': Precision spraying zone (drone/tractor path)
 */
export type ZoneType = 'crop' | 'disease' | 'spray';

export interface FarmZone {
  id: string;
  farmId: string;
  type: ZoneType;
  name: string;
  geometry: GeoJSONPolygon;
  color?: string;
  areaSqM?: number;
  areaAcres?: number;
  // Crop specific metadata
  cropName?: string;
  cropVariety?: string;
  growthStage?: string;
  targetYieldTonnes?: number;
  // Disease specific metadata
  diseaseName?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  confidenceScore?: number;
  // Spray specific metadata
  sprayStatus?: 'pending' | 'in_progress' | 'completed' | 'scheduled';
  chemicalName?: string;
  targetDosageLPerAcre?: number;
  notes?: string;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 3. CropPlan Model
 */
export type CropPlanMode = 'ai_recommended' | 'farmer_selected' | 'combined';

export interface CropPlan {
  id?: string;
  farmId: string;
  mode: CropPlanMode;
  season?: 'Kharif' | 'Rabi' | 'Zaid' | 'Annual';
  year?: number;
  zones: FarmZone[];
  rationale?: string;
  expectedTotalYieldTonnes?: number;
  estimatedNetProfitInr?: number;
  status?: 'draft' | 'active' | 'archived';
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 4. Crop Health Observation Model (Agent 3)
 */
export type AIHealthStatus = 'ai_generated' | 'needs_review' | 'unavailable';

export interface HealthObservation {
  id: string;
  farmId: string;
  zoneId?: string;
  cropAffected?: string;
  detectedDisease?: string;
  imagePreviewUrl?: string;
  symptoms: string[];
  possibleCauses: string[];
  confidenceNote?: string;
  confidence?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  detectionMethod?: string;
  recommendedAction?: string;
  chemicalRecommendation?: {
    name: string;
    dosage: string;
    frequency: string;
  };
  status: AIHealthStatus | 'active' | 'treated' | 'monitoring';
  missingInformation?: string[];
  limitations?: string[];
  sources?: { title: string; url: string }[];
  detectedAt?: string;
  resolvedAt?: string;
  createdAt?: string;
  isDemo?: boolean;
}

// Alias for backwards compatibility
export type DiseaseRecord = HealthObservation;

/**
 * 5. Anti-Hallucination AI Schema for Crop Health API
 */
export interface AIResult {
  status: 'supported' | 'partial' | 'insufficient_data';
  observations: string[];
  possibleCauses: string[];
  explanation: string[];
  missingInformation: string[];
  limitations: string[];
  sources: { title: string; url: string }[];
}

/**
 * 6. Farm Tasks and Operations (Agent 4)
 */
export interface FarmTask {
  id: string;
  farmId: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  status: 'pending' | 'completed';
  category?: 'irrigation' | 'fertilizer' | 'inspection' | 'harvest' | 'general';
  isDemo?: boolean;
}

/**
 * 7. Farm Supplies (Agent 4)
 */
export interface FarmSupply {
  id: string;
  farmId: string;
  itemName: string;
  quantity: number;
  unit: 'kg' | 'liters' | 'bags' | 'packets';
  status: 'in_stock' | 'low' | 'ordered';
  isDemo?: boolean;
}

/**
 * 8. Boundary Tree Planner (Agent 4)
 */
export interface BoundaryTreePlan {
  id: string;
  farmId: string;
  speciesName: string;
  spacingMeters: number;
  treeCount: number;
  shadeRisk: 'low' | 'medium' | 'high';
  rootCompetitionNote: string;
  suggestedPositions: Position[];
  isDemo?: boolean;
}

/**
 * 9. Drone Spray Export & Operation (Agent 4)
 */
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

export interface SprayOperation {
  id: string;
  farmId: string;
  zoneId?: string;
  operationType: 'Pesticide' | 'Fungicide' | 'Foliar Fertilizer' | 'Herbicide';
  productName: string;
  dosagePerAcre: string;
  dilutionRatio: string;
  equipmentType: 'Drone' | 'Tractor Boom' | 'Knapsack Sprayer';
  flightAltitudeMeters?: number;
  speedKmh?: number;
  windSpeedKmh: number;
  temperatureC: number;
  humidityPct: number;
  safetyStatus: 'optimal' | 'caution' | 'unsafe';
  scheduledTime: string;
  completedTime?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  isDemo?: boolean;
}

// Government Schemes & Farmer Assistance Contracts
export * from './schemes';

// n8n Integration & Event-Driven Automation Contracts
export * from './n8n';

// AgriDOST 4.0 Standard Integration Health Contracts
export * from './integrations';

// Market Intelligence & Mandi Contracts
export * from './market';

// Telegram Bot Integration Contracts
export * from './telegram';


