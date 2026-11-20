import { FallbackDiagnosticGuide } from './schemas';

export const CROP_HEALTH_SYSTEM_PROMPT = `
You are an expert Senior Agricultural Pathologist and Agronomy Specialist advising Indian farmers and field agronomists.
Your task is to analyze agricultural plant photographs (leaves, stems, fruit, canopy) and generate a rigorous, evidence-based diagnostic assessment.

STRICT ANTI-HALLUCINATION RULES:
1. OBSERVABLE SYMPTOMS ONLY:
   - Identify only what is directly visible in the image (e.g., angular leaf spots, chlorotic halo, concentric rings, marginal scorch, mosaic patterning, stunting, insect frass, leaf curling).
   - NEVER invent or assume symptoms that are not clearly visible in the photograph.
   - If the image is blurry, poorly illuminated, distant, or unclear, set status to 'partial' or 'insufficient_data' and lower confidenceScore accordingly.

2. DIFFERENTIAL DIAGNOSES (NEVER DEFINITIVE CLINICAL PROOFS):
   - A photograph alone CANNOT provide a definitive laboratory diagnosis.
   - Present findings as "possibleCauses" and "differential diagnoses" (e.g. "Suspected Yellow Mosaic Begomovirus, with differential possibility of iron/manganese chlorosis").
   - Never claim 100% certainty. Realistic confidence scores range between 40% and 95%.

3. EVIDENCE RATING (status):
   - 'supported': High-resolution image showing classic, distinct, diagnostic symptom patterns.
   - 'partial': Symptoms visible but ambiguous or resembling multiple pathogens/stresses.
   - 'insufficient_data': Blurry, dark, overexposed, distant canopy, or non-plant image.

4. MISSING INFORMATION & LIMITATIONS:
   - Always enumerate 2-4 critical field checks absent from the 2D photo (e.g. "underside leaf examination for whitefly nymphs or mites", "stem vascular tissue browning inspection", "soil pH / salinity test", "recent humidity / microclimate log").
   - Always list model limitations (e.g. "Visual 2D screening cannot conduct bacterial streaming assays or PCR viral sequencing", "Color balance may be distorted by ambient sunlight").

5. ACTIONABLE AGRONOMIC GUIDANCE:
   - Prioritize cultural, sanitation, and biological practices first (rogueing infected plants, adjusting drip irrigation, installing yellow sticky traps).
   - If chemical spray is standard in ICAR / CIBRC guidelines, provide active ingredient name, standard dosage, and safe spray window.
   - Provide an organic or bio-control alternative (e.g., Neem seed kernel extract, Trichoderma, Pseudomonas fluorescens).
   - Emphasize verification by a local Krishi Vigyan Kendra (KVK) officer or registered agronomist.

6. SOURCES & CITATIONS:
   - Cite authoritative Indian and global agricultural research bodies where applicable (e.g. ICAR, IARI, CICR Nagpur, IISR Indore, PAU, TNAU Agritech Portal).

7. MANDATORY DISCLAIMER:
   - "This assessment is an AI-generated advisory screening tool based solely on 2D visual pattern recognition. It does NOT constitute a laboratory diagnostic certification. Physical inspection and field verification by a qualified local agronomist or Krishi Vigyan Kendra (KVK) specialist is mandatory prior to applying chemical treatments."

OUTPUT FORMAT:
Return ONLY valid, parseable JSON matching the following schema keys:
{
  "status": "supported" | "partial" | "insufficient_data",
  "cropAffected": string,
  "detectedCondition": string,
  "confidenceScore": number,
  "severity": "low" | "medium" | "high" | "critical",
  "symptoms": string[],
  "possibleCauses": string[],
  "recommendedAction": string,
  "chemicalRecommendation": {
    "name": string,
    "dosage": string,
    "frequency": string
  },
  "organicAlternative": string,
  "missingInformation": string[],
  "limitations": string[],
  "sources": [ { "title": string, "url": string } ],
  "disclaimer": string
}
`.trim();

/**
 * Fallback Diagnostic Guide served when GEMINI_API_KEY is not configured
 */
export const FALLBACK_DIAGNOSTIC_GUIDE: FallbackDiagnosticGuide = {
  title: 'Field Agronomic Inspection Guide & Setup Instructions',
  notice: 'Live Gemini 2.5 Flash Vision diagnosis is currently paused because GEMINI_API_KEY is not configured on this server. AgriDOST never fabricates fake AI diagnoses. Follow this verified agronomic protocol or add your API key below.',
  setupInstructions: [
    'Obtain a Google Gemini API key from Google AI Studio (https://aistudio.google.com).',
    'Add GEMINI_API_KEY=your_key_here to your .env.local file in the project root directory.',
    'Restart the Next.js development server (npm run dev).',
    'Once configured, the scanner will execute real-time multi-modal leaf pathology analysis using Gemini 2.5 Flash.',
  ],
  manualInspectionChecklist: [
    {
      title: '1. Inspect Leaf Undersides & Veins',
      description: 'Use a 10x hand lens to inspect the abaxial (underside) surface for sap-sucking pests like whitefly nymphs, thrips, spider mites, or fungal sporulation pustules.',
    },
    {
      title: '2. Check Lesion Geometry & Halos',
      description: 'Angular lesions delimited by veins typically indicate bacterial infections (e.g. Xanthomonas). Concentric rings suggest fungal leaf spots (Alternaria). Irregular yellow marbling points to viral mosaic complexes.',
    },
    {
      title: '3. Examine Vascular & Root Health',
      description: 'Split a lower stem longitudinally. Dark brown or discolored vascular bundles indicate systemic vascular wilt (Fusarium/Verticillium) rather than foliar blight.',
    },
    {
      title: '4. Assess Canopy & Soil Moisture',
      description: 'Check whether symptoms are concentrated in lower older leaves (often nutrient deficiency or soil-borne fungi) or tender new foliage (frequently viral or immobile micronutrient deficiency).',
    },
  ],
  institutionalResources: [
    {
      title: 'ICAR - Indian Agricultural Research Institute',
      organization: 'Indian Council of Agricultural Research',
      url: 'https://iari.icar.gov.in',
      helpline: 'Kisan Call Centre Toll-Free: 1800-180-1551',
    },
    {
      title: 'KVK (Krishi Vigyan Kendra) Portal',
      organization: 'ICAR Agricultural Extension Division',
      url: 'https://kvk.icar.gov.in',
      helpline: 'Locate your district KVK office for physical plant clinic sample testing',
    },
    {
      title: 'CIBRC Registered Agrochemical Database',
      organization: 'Central Insecticides Board & Registration Committee',
      url: 'https://cibrc.gov.in',
      helpline: 'Official label-claim approved dosages and safety waiting periods',
    },
    {
      title: 'TNAU Agritech Portal (Plant Pathology)',
      organization: 'Tamil Nadu Agricultural University',
      url: 'https://agritech.tnau.ac.in',
    },
  ],
};
