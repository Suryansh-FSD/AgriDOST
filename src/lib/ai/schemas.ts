import { z } from 'zod';

/**
 * Strict Anti-Hallucination Zod Schema for Gemini AI Crop Health Analysis
 * Enforces visible-symptom-only reporting, differential causes, confidence bounds,
 * and mandatory limitations & disclaimers.
 */
export const AIHealthResponseSchema = z.object({
  status: z.enum(['supported', 'partial', 'insufficient_data']).describe(
    'Evidence rating based strictly on visual clarity of the photograph: supported = clear diagnostic symptoms; partial = equivocal or ambiguous; insufficient_data = blurry, obscured, or non-plant.'
  ),
  cropAffected: z.string().describe('Identified or user-specified crop species (e.g. Cotton, Soybean, Tomato, Kinnow)'),
  detectedCondition: z.string().describe('Primary suspected pathology, pest symptom, or physiological stress condition'),
  confidenceScore: z.number().min(0).max(100).describe('Confidence score from 0 to 100 based on observable visual symptom correlation'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium').describe('Agronomic urgency rating'),
  symptoms: z.array(z.string()).min(1).describe('Observable physical symptoms directly visible on leaf, vein, margin, or stem in the image'),
  possibleCauses: z.array(z.string()).min(1).describe('Differential diagnoses and causative agents (viral, fungal, bacterial, pest, nutrient deficiency)'),
  recommendedAction: z.string().describe('Immediate agronomic management guidance and field sanitation practices'),
  chemicalRecommendation: z.object({
    name: z.string().describe('Standard agrochemical or fungicide/insecticide active ingredient'),
    dosage: z.string().describe('Application dosage per acre / per liter of water'),
    frequency: z.string().describe('Application timing, spray window, or frequency'),
  }).optional().describe('Advisory spray recommendation if chemical intervention is standard practice'),
  organicAlternative: z.string().optional().describe('Bio-pesticide, organic, or cultural control alternative (e.g. Neem oil, Trichoderma viride)'),
  missingInformation: z.array(z.string()).describe('Physical field data absent from 2D photo required for definitive clinical confirmation'),
  limitations: z.array(z.string()).describe('Vision model optical, lighting, perspective, and laboratory testing limitations'),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string(),
  })).default([]).describe('Agronomic research bodies or agricultural extension sources (e.g. ICAR, KVK, TNAU, PAU)'),
  disclaimer: z.string().describe('Mandatory disclaimer stating this is an AI advisory screening tool, not a clinical lab test'),
});

export type AIHealthResponse = z.infer<typeof AIHealthResponseSchema>;

/**
 * Request schema for Health Analysis API endpoint
 */
export const AIHealthRequestSchema = z.object({
  image: z.string().min(1, 'Image data (base64 or data URL) is required'),
  mimeType: z.string().optional().default('image/jpeg'),
  cropName: z.string().optional(),
  farmId: z.string().optional(),
  zoneId: z.string().optional(),
  additionalNotes: z.string().optional(),
  language: z.enum(['en', 'hi']).optional().default('en'),
});

export type AIHealthRequest = z.infer<typeof AIHealthRequestSchema>;

/**
 * Fallback Diagnostic Guide when GEMINI_API_KEY is not configured
 * Truthful, helpful, educational guidance without fake diagnostic claims.
 */
export interface FallbackDiagnosticGuide {
  title: string;
  notice: string;
  setupInstructions: string[];
  manualInspectionChecklist: {
    title: string;
    description: string;
  }[];
  institutionalResources: {
    title: string;
    organization: string;
    url: string;
    helpline?: string;
  }[];
}

/**
 * Full API response shape from /api/ai/health
 */
export interface HealthApiResponse {
  success: boolean;
  status: 'supported' | 'partial' | 'insufficient_data' | 'unavailable' | 'error';
  data?: AIHealthResponse;
  fallbackGuide?: FallbackDiagnosticGuide;
  message?: string;
  error?: string;
  cropName?: string;
  farmId?: string;
  zoneId?: string;
  model?: string;
  analyzedAt: string;
}

// ============================================================================
// AGRONOMIC ADVISORY SCHEMAS (ICAR / KVK / CIBRC GROUNDED)
// ============================================================================

export const AgronomicAdvisoryRequestSchema = z.object({
  cropName: z.string().min(1, 'Crop name is required'),
  cropStage: z.string().optional().default('vegetative'),
  soilType: z.string().optional(),
  locationDetails: z
    .object({
      state: z.string().optional(),
      district: z.string().optional(),
      pincode: z.string().optional(),
    })
    .optional(),
  weatherContext: z
    .object({
      temperature: z.number().optional(),
      humidity: z.number().optional(),
      rainfallForecastMm: z.number().optional(),
      conditions: z.string().optional(),
    })
    .optional(),
  farmerQuestion: z.string().optional(),
  language: z.enum(['en', 'hi']).default('en'),
  farmId: z.string().optional(),
  zoneId: z.string().optional(),
});

export type AgronomicAdvisoryRequest = z.infer<typeof AgronomicAdvisoryRequestSchema>;

export const CibrcTreatmentSchema = z.object({
  name: z.string().describe('CIBRC approved chemical or biological active ingredient'),
  dosage: z.string().describe('Approved dosage per acre or per liter of spray fluid'),
  targetPest: z.string().optional().describe('Target weed, insect, or fungal pathogen'),
  safetyIntervalDays: z.number().optional().describe('Pre-Harvest Interval (PHI) waiting period in days'),
});

export const AgronomicAdvisorySchema = z.object({
  crop: z.string(),
  stage: z.string(),
  language: z.enum(['en', 'hi']).default('en'),
  summary: z.string().describe('Executive agronomic summary and immediate focus'),
  primaryRecommendation: z.string().describe('Core seasonal guidance based on crop growth stage'),
  irrigationGuidance: z.object({
    recommendation: z.string(),
    schedule: z.string(),
    waterRequirement: z.string(),
  }),
  fertilizerNutrition: z.object({
    macroNutrients: z.string().describe('NPK dosage in kg/acre or gm/plant adhering to ICAR standards'),
    microNutrients: z.string().optional(),
    applicationMethod: z.string(),
    organicAlternatives: z.array(z.string()).default([]),
  }),
  pestDiseasePrecaution: z.object({
    threats: z.array(z.string()).min(1),
    preventiveMeasures: z.array(z.string()).min(1),
    cibrcApprovedTreatments: z.array(CibrcTreatmentSchema).default([]),
    organicAlternatives: z.array(z.string()).default([]),
  }),
  contingencyWeatherAdvisory: z.string().describe('Weather-reactive intervention (e.g. rain, heat, humidity surge)'),
  groundedPractices: z.object({
    practices: z.array(z.string()).min(1),
    institutionalSources: z
      .array(
        z.object({
          name: z.string(),
          type: z.enum(['ICAR', 'KVK', 'CIBRC', 'SAU', 'GOI']),
          url: z.string().optional(),
        })
      )
      .min(1),
  }),
  disclaimer: z.string().describe('Mandatory non-clinical agronomic advisory disclaimer'),
  generatedAt: z.string(),
});

export type AgronomicAdvisory = z.infer<typeof AgronomicAdvisorySchema>;

export interface AdvisoryApiResponse {
  success: boolean;
  status: 'live' | 'offline_fallback' | 'error';
  data?: AgronomicAdvisory;
  message?: string;
  error?: string;
  model?: string;
  source?: 'gemini_live' | 'icar_kvk_offline_registry';
  generatedAt: string;
}
