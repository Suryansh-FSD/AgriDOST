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
  analyzedAt: string;
}
