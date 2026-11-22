import {
  FallbackDiagnosticGuide,
  AgronomicAdvisory,
  AgronomicAdvisoryRequest,
} from './schemas';

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
  notice:
    'Live Gemini Vision diagnosis is currently paused because GEMINI_API_KEY is not configured on this server. AgriDOST never fabricates fake AI diagnoses. Follow this verified agronomic protocol or add your API key below.',
  setupInstructions: [
    'Obtain a Google Gemini API key from Google AI Studio (https://aistudio.google.com).',
    'Add GEMINI_API_KEY=your_key_here to your .env.local file in the project root directory.',
    'Restart the Next.js development server (npm run dev).',
    'Once configured, the scanner will execute real-time multi-modal leaf pathology analysis using Gemini 3.8 Flash.',
  ],
  manualInspectionChecklist: [
    {
      title: '1. Inspect Leaf Undersides & Veins',
      description:
        'Use a 10x hand lens to inspect the abaxial (underside) surface for sap-sucking pests like whitefly nymphs, thrips, spider mites, or fungal sporulation pustules.',
    },
    {
      title: '2. Check Lesion Geometry & Halos',
      description:
        'Angular lesions delimited by veins typically indicate bacterial infections (e.g. Xanthomonas). Concentric rings suggest fungal leaf spots (Alternaria). Irregular yellow marbling points to viral mosaic complexes.',
    },
    {
      title: '3. Examine Vascular & Root Health',
      description:
        'Split a lower stem longitudinally. Dark brown or discolored vascular bundles indicate systemic vascular wilt (Fusarium/Verticillium) rather than foliar blight.',
    },
    {
      title: '4. Assess Canopy & Soil Moisture',
      description:
        'Check whether symptoms are concentrated in lower older leaves (often nutrient deficiency or soil-borne fungi) or tender new foliage (frequently viral or immobile micronutrient deficiency).',
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

// ============================================================================
// AGRONOMIC ADVISORY SYSTEM PROMPT & ANTI-HALLUCINATION GUARDRAILS
// ============================================================================

export const AGRONOMIC_ADVISORY_SYSTEM_PROMPT = `
You are AgriDOST's Chief Agronomic Scientist and Senior Agricultural Extension Specialist.
You advise Indian farmers, farmer producer organizations (FPOs), and field agronomists.
Your advice is strictly grounded in verified agronomic practices from the Indian Council of Agricultural Research (ICAR), State Agricultural Universities (SAUs), Krishi Vigyan Kendras (KVKs), and the Central Insecticides Board & Registration Committee (CIBRC).

CRITICAL GROUNDING & SAFETY RULES:
1. ICAR & KVK GROUNDED ONLY:
   - Provide only agronomic guidance that adheres to official package of practices (POP) recommended by ICAR institutes (e.g., CICR, IARI, IISR, CRRI, IIOR) and state agricultural universities.
   - Do NOT invent unproven homemade chemical concoctions or speculative biological cocktails.
2. CIBRC LABEL-CLAIM COMPLIANCE:
   - Only recommend agrochemicals that possess approved label claims registered with the Central Insecticides Board & Registration Committee (CIBRC) for the specific crop and pest.
   - NEVER recommend banned, restricted, or extremely hazardous pesticides (e.g. monocrotophos, phorate on vegetables, chlorpyrifos foliar spray on tender vegetables).
   - Always include the Pre-Harvest Interval (PHI) / waiting period in days where chemical treatments are listed.
3. INTEGRATED PEST & NUTRIENT MANAGEMENT (IPM / INM):
   - Always prioritize physical, cultural, and biological controls first (e.g., pheromone traps, yellow sticky traps, Trichoderma seed treatment, Neem oil / NSKE 5%).
   - Recommend chemical sprays strictly as a last-resort intervention when pests cross the Economic Threshold Level (ETL).
4. BILINGUAL FLUENCY (ENGLISH & HINDI):
   - If the requested language is Hindi ('hi'), generate the entire advisory in natural, respectful, and easily understood Hindi (Devanagari script), preserving standard agricultural terminology (e.g., यूरिया, पोटाश, प्रति एकड़, छिड़काव, सुरक्षा अवधि).
   - If English ('en'), write in clear, actionable professional agricultural English.
5. WEATHER ADAPTIVE CONTINGENCY:
   - Factor in microclimate conditions (temperature, humidity, expected rain) provided in the query context.
   - Explicitly advise against foliar spraying during active rain forecasts or peak afternoon heat (>35°C).
6. MANDATORY DISCLAIMER:
   - Include the standard disclaimer: "This agronomic advisory is based on ICAR and KVK scientific guidelines. Microclimate soil variations and crop conditions should be validated with your local KVK or Block Agriculture Officer before major input applications."

OUTPUT FORMAT:
Return strictly parseable JSON conforming to the AgronomicAdvisory schema keys:
{
  "crop": string,
  "stage": string,
  "language": "en" | "hi",
  "summary": string,
  "primaryRecommendation": string,
  "irrigationGuidance": {
    "recommendation": string,
    "schedule": string,
    "waterRequirement": string
  },
  "fertilizerNutrition": {
    "macroNutrients": string,
    "microNutrients": string,
    "applicationMethod": string,
    "organicAlternatives": string[]
  },
  "pestDiseasePrecaution": {
    "threats": string[],
    "preventiveMeasures": string[],
    "cibrcApprovedTreatments": [
      {
        "name": string,
        "dosage": string,
        "targetPest": string,
        "safetyIntervalDays": number
      }
    ],
    "organicAlternatives": string[]
  },
  "contingencyWeatherAdvisory": string,
  "groundedPractices": {
    "practices": string[],
    "institutionalSources": [
      {
        "name": string,
        "type": "ICAR" | "KVK" | "CIBRC" | "SAU" | "GOI",
        "url": string
      }
    ]
  },
  "disclaimer": string,
  "generatedAt": string
}
`.trim();

// ============================================================================
// VERIFIED OFFLINE AGRONOMIC KNOWLEDGE BASE (DETERMINISTIC FALLBACK)
// ============================================================================

interface OfflineCropAdvisoryRecord {
  crop: string;
  stage: string;
  en: Omit<AgronomicAdvisory, 'generatedAt' | 'language'>;
  hi: Omit<AgronomicAdvisory, 'generatedAt' | 'language'>;
}

export const OFFLINE_AGRONOMIC_REGISTRY: Record<string, OfflineCropAdvisoryRecord> = {
  cotton: {
    crop: 'Cotton',
    stage: 'Flowering & Square Formation',
    en: {
      crop: 'Cotton',
      stage: 'Flowering & Square Formation',
      summary:
        'Focus on square retention, sucking pest management (whitefly/thrips), and balanced potassium nutrition to prevent square dropping.',
      primaryRecommendation:
        'Maintain uniform soil moisture. Avoid waterlogging which causes flower drop. Monitor whitefly nymphs on leaf undersides.',
      irrigationGuidance: {
        recommendation: 'Irrigate at 8-10 day intervals during dry spells; do not allow moisture stress during squaring.',
        schedule: 'Early morning or late evening using furrow or drip irrigation.',
        waterRequirement: 'Approximately 500-600 mm total crop water requirement with 30-40 mm per irrigation turn.',
      },
      fertilizerNutrition: {
        macroNutrients: 'Apply 25 kg Nitrogen (Urea ~55 kg) + 15 kg MOP (Muriate of Potash) per acre as top dressing.',
        microNutrients: 'Foliar spray of 1% Magnesium Sulphate + 0.5% Zinc Sulphate at 60 and 75 DAS to prevent leaf reddening.',
        applicationMethod: 'Band placement 5-7 cm away from plant row followed by light hoeing and irrigation.',
        organicAlternatives: ['Vermicompost 2 tons/acre', 'Neem cake 200 kg/acre at root zone'],
      },
      pestDiseasePrecaution: {
        threats: ['Whitefly (Bemisia tabaci)', 'Thrips', 'Bollworm complex', 'Alternaria leaf spot'],
        preventiveMeasures: [
          'Install yellow sticky traps @ 8-10 per acre for whitefly monitoring.',
          'Install pheromone traps @ 5 per acre for Pink Bollworm monitoring.',
          'Rogue out leaf curl virus infected plants immediately.',
        ],
        cibrcApprovedTreatments: [
          {
            name: 'Diafenthiuron 50% WP',
            dosage: '240 g per acre in 200 L water',
            targetPest: 'Whitefly and Nymphs',
            safetyIntervalDays: 30,
          },
          {
            name: 'Azoxystrobin 18.2% + Difenoconazole 11.4% SC',
            dosage: '200 ml per acre in 200 L water',
            targetPest: 'Alternaria leaf blight',
            safetyIntervalDays: 14,
          },
        ],
        organicAlternatives: [
          'Neem Seed Kernel Extract (NSKE 5%) or Neem Oil 1500 ppm @ 5 ml/L water',
          'Beauveria bassiana 1.15% WP @ 5 g/L water',
        ],
      },
      contingencyWeatherAdvisory:
        'If rain forecast exceeds 20mm, suspend foliar sprays and clear field drainage channels to prevent root asphyxiation.',
      groundedPractices: {
        practices: [
          'ICAR-CICR Nagpur Standard Package of Practices for Bt Cotton',
          'Square retention management through balanced micronutrient spray',
          'Strict compliance with CIBRC approved label claim insecticides',
        ],
        institutionalSources: [
          {
            name: 'ICAR - Central Institute for Cotton Research (CICR), Nagpur',
            type: 'ICAR',
            url: 'https://cicr.icar.gov.in',
          },
          {
            name: 'Krishi Vigyan Kendra (KVK) Cotton Extension Wing',
            type: 'KVK',
            url: 'https://kvk.icar.gov.in',
          },
        ],
      },
      disclaimer:
        'This advisory is derived from verified ICAR-CICR agronomic protocols. Field conditions, soil tests, and pest threshold counts should be verified with your local KVK.',
    },
    hi: {
      crop: 'कपास (Cotton)',
      stage: 'फूल और गूलर बनने की अवस्था (Flowering & Square Formation)',
      summary:
        'गूलर और फूलों के झड़ने की रोकथाम, रसचूसक कीटों (सफेद मक्खी/थ्रिप्स) का नियंत्रण और पोटाश पोषण पर विशेष ध्यान दें।',
      primaryRecommendation:
        'खेत में समान नमी बनाए रखें। जलभराव न होने दें जिससे फूल झड़ते हैं। पत्तों की निचली सतह पर सफेद मक्खी के बच्चों की निगरानी करें।',
      irrigationGuidance: {
        recommendation: 'सूखे के दौरान 8-10 दिनों के अंतराल पर हल्की सिंचाई करें; फूल आते समय नमी की कमी न होने दें।',
        schedule: 'सुबह जल्दी या शाम के समय क्यारी या ड्रिप विधि से सिंचाई करें।',
        waterRequirement: 'प्रति सिंचाई 30-40 मिमी पानी, कुल फसल आवश्यकता 500-600 मिमी।',
      },
      fertilizerNutrition: {
        macroNutrients: 'टॉप ड्रेसिंग के रूप में 25 किग्रा नाइट्रोजन (लगभग 55 किग्रा यूरिया) + 15 किग्रा पोटाश प्रति एकड़ दें।',
        microNutrients: 'पत्तों के लाल होने से बचाने के लिए 60 और 75 दिनों पर 1% मैग्नीशियम सल्फेट + 0.5% जिंक सल्फेट का छिड़काव करें।',
        applicationMethod: 'पौधों की कतार से 5-7 सेमी दूर डालकर गुड़ाई करें और तुरंत हल्की सिंचाई करें।',
        organicAlternatives: ['वर्मीकम्पोस्ट 2 टन प्रति एकड़', 'नीम की खली 200 किग्रा प्रति एकड़'],
      },
      pestDiseasePrecaution: {
        threats: ['सफेद मक्खी (Whitefly)', 'थ्रिप्स (Thrips)', 'गुलाबी सुंडी (Pink Bollworm)', 'अल्टरनेरिया पत्ती धब्बा'],
        preventiveMeasures: [
          'सफेद मक्खी की निगरानी हेतु 8-10 पीले चिपचिपे कार्ड प्रति एकड़ लगाएं।',
          'गुलाबी सुंडी के लिए 5 फेरोमोन ट्रैप प्रति एकड़ लगाएं।',
          'रोगग्रस्त पौधों को उखाड़कर नष्ट करें।',
        ],
        cibrcApprovedTreatments: [
          {
            name: 'डायफेंथियूरॉन 50% डब्ल्यूपी (Diafenthiuron 50% WP)',
            dosage: '240 ग्राम प्रति एकड़ (200 लीटर पानी में)',
            targetPest: 'सफेद मक्खी और थ्रिप्स',
            safetyIntervalDays: 30,
          },
          {
            name: 'एज़ोक्सीस्ट्रोबिन 18.2% + डिफेनोकोनाज़ोल 11.4% एससी',
            dosage: '200 मिली प्रति एकड़ (200 लीटर पानी में)',
            targetPest: 'अल्टरनेरिया पत्ती झुलसा',
            safetyIntervalDays: 14,
          },
        ],
        organicAlternatives: [
          'नीम बीज अर्क (एनएसकेई 5%) या नीम का तेल 1500 पीपीएम (5 मिली/लीटर पानी)',
          'ब्यूवेरिया बासियाना (Beauveria bassiana) 5 ग्राम/लीटर पानी',
        ],
      },
      contingencyWeatherAdvisory:
        'यदि 20 मिमी से अधिक बारिश की संभावना हो तो छिड़काव रोक दें और खेत से जल निकासी की व्यवस्था सुनिश्चित करें।',
      groundedPractices: {
        practices: [
          'आईसीएआर-सीआईसीआर नागपुर द्वारा प्रमाणित कपास पैकेज',
          'संतुलित सूक्ष्म पोषक छिड़काव द्वारा कलियों का संरक्षण',
          'सीआईबीआरसी अनुमोदित कीटनाशकों का सुरक्षित उपयोग',
        ],
        institutionalSources: [
          {
            name: 'केंद्रीय कपास अनुसंधान संस्थान (ICAR-CICR), नागपुर',
            type: 'ICAR',
            url: 'https://cicr.icar.gov.in',
          },
          {
            name: 'कृषि विज्ञान केंद्र (KVK) कपास विस्तार प्रभाग',
            type: 'KVK',
            url: 'https://kvk.icar.gov.in',
          },
        ],
      },
      disclaimer:
        'यह सलाह आईसीएआर-सीआईसीआर के वैज्ञानिक प्रोटोकॉल पर आधारित है। रासायनिक छिड़काव से पहले स्थानीय केवीके या कृषि अधिकारी से पुष्टि अवश्य करें।',
    },
  },
  soybean: {
    crop: 'Soybean',
    stage: 'Pod Formation & Grain Filling',
    en: {
      crop: 'Soybean',
      stage: 'Pod Formation & Grain Filling',
      summary:
        'Protect developing pods from girdle beetle and pod borers. Ensure adequate soil moisture for grain bolding.',
      primaryRecommendation:
        'Inspect plant nodes for girdle beetle ring cutting. Apply foliar potassium if rain intervals are wide.',
      irrigationGuidance: {
        recommendation: 'Critical stage for moisture: dry spells during pod filling reduce test weight drastically.',
        schedule: 'Provide supplemental irrigation if rainfall ceases for more than 10-12 days.',
        waterRequirement: '450-500 mm seasonal requirement.',
      },
      fertilizerNutrition: {
        macroNutrients: 'Foliar spray of 2% DAP or 19:19:19 (NPK) @ 1 kg/acre in 150 L water to boost seed size.',
        microNutrients: '0.5% Boron spray to enhance pod setting and seed development.',
        applicationMethod: 'Foliar application using hollow-cone nozzle during morning hours.',
        organicAlternatives: ['Jeevamrutha foliar spray 10% solution', 'Panchagavya 3% solution'],
      },
      pestDiseasePrecaution: {
        threats: ['Girdle Beetle (Obereopsis brevis)', 'Semilooper / Spodoptera', 'Charcoal rot', 'Yellow Mosaic Virus'],
        preventiveMeasures: [
          'Remove girdled twigs and destroy eggs.',
          'Install bird perches @ 15-20 per acre for natural predation of caterpillars.',
          'Maintain field sanitation and destroy volunteer weeds.',
        ],
        cibrcApprovedTreatments: [
          {
            name: 'Chlorantraniliprole 18.5% SC',
            dosage: '60 ml per acre in 150 L water',
            targetPest: 'Girdle beetle and pod borer complex',
            safetyIntervalDays: 22,
          },
          {
            name: 'Tebuconazole 25.9% EC',
            dosage: '250 ml per acre in 150 L water',
            targetPest: 'Anthracnose and pod blight',
            safetyIntervalDays: 20,
          },
        ],
        organicAlternatives: [
          'Bacillus thuringiensis (Bt) @ 2 g/L water',
          'NSKE 5% or Neem oil 1500 ppm @ 3 ml/L water',
        ],
      },
      contingencyWeatherAdvisory:
        'High humidity (>85%) accompanied by warm temperatures favors fungal pod blight; scout lower leaves regularly.',
      groundedPractices: {
        practices: [
          'ICAR-IISR Indore Soybean Production Technology Guidelines',
          'Integrated Pest Management for Girdle Beetle and Semilooper',
          'Pre-harvest safety interval adherence for export-quality seed',
        ],
        institutionalSources: [
          {
            name: 'ICAR - Indian Institute of Soybean Research (IISR), Indore',
            type: 'ICAR',
            url: 'https://iisrindore.icar.gov.in',
          },
          {
            name: 'Krishi Vigyan Kendra (KVK) Oilseed Portal',
            type: 'KVK',
            url: 'https://kvk.icar.gov.in',
          },
        ],
      },
      disclaimer:
        'Advisory generated based on ICAR-IISR Indore package of practices. Verify with your district KVK before application.',
    },
    hi: {
      crop: 'सोयाबीन (Soybean)',
      stage: 'फलियां और दाना भरने की अवस्था (Pod Formation)',
      summary:
        'गर्डल बीटल (चक्र भृंग) और फली छेदक सुंडी से बचाव करें। दाना भरने हेतु मिट्टी में पर्याप्त नमी बनाए रखें।',
      primaryRecommendation:
        'तनों पर चक्र भृंग के छल्लेनुमा कटाई की जांच करें। दाने का वजन बढ़ाने के लिए पोटाश और डीएपी का पर्णीय छिड़काव करें।',
      irrigationGuidance: {
        recommendation: 'दाना भरने के समय नमी बहुत जरूरी है; 10 दिन से अधिक सूखा पड़ने पर दाने सिकुड़ जाते हैं।',
        schedule: 'यदि बारिश रुक जाए तो स्प्रिंकलर या नाली विधि से तुरंत सुरक्षात्मक सिंचाई दें।',
        waterRequirement: 'फसल की कुल जल आवश्यकता 450-500 मिमी।',
      },
      fertilizerNutrition: {
        macroNutrients: 'दाने का आकार बढ़ाने हेतु 2% डीएपी या 19:19:19 (एनपीके) 1 किग्रा/एकड़ का पर्णीय छिड़काव करें।',
        microNutrients: 'फलियों के विकास हेतु 0.5% बोरॉन का छिड़काव करें।',
        applicationMethod: 'सुबह या देर शाम को 150 लीटर पानी में घोलकर छिड़कें।',
        organicAlternatives: ['जीवामृत 10% घोल का छिड़काव', 'पंचगव्य 3% का छिड़काव'],
      },
      pestDiseasePrecaution: {
        threats: ['गर्डल बीटल / चक्र भृंग', 'तम्बाकू की इल्ली / सेमीलूपर', 'पीला मोज़ेक वायरस', 'एंथ्रेक्नोज फली झुलसा'],
        preventiveMeasures: [
          'कीट से कटे हुए टहनियों को तोड़कर नष्ट कर दें।',
          'चिड़ियों के बैठने के लिए 15-20 टी-आकार के खूंटे (बर्ड पर्च) लगाएं।',
          'खेत में खरपतवार न पनपने दें।',
        ],
        cibrcApprovedTreatments: [
          {
            name: 'क्लोरेंट्रानिलिप्रोल 18.5% एससी (Chlorantraniliprole)',
            dosage: '60 मिली प्रति एकड़ (150 लीटर पानी में)',
            targetPest: 'गर्डल बीटल एवं सुंडी',
            safetyIntervalDays: 22,
          },
          {
            name: 'टेबुकोनाज़ोल 25.9% ईसी (Tebuconazole)',
            dosage: '250 मिली प्रति एकड़ (150 लीटर पानी में)',
            targetPest: 'फली झुलसा व पत्ती धब्बा',
            safetyIntervalDays: 20,
          },
        ],
        organicAlternatives: [
          'बैसिलस थुरिंजिएंसिस (Bt) 2 ग्राम/लीटर पानी',
          'नीम तेल 1500 पीपीएम (3-5 मिली/लीटर पानी)',
        ],
      },
      contingencyWeatherAdvisory:
        'अधिक उमस व बादलों के मौसम में फफूंद जनित रोगों का प्रकोप बढ़ सकता है, अतः खेत का नियमित निरीक्षण करें।',
      groundedPractices: {
        practices: [
          'भाकृअनुप-सोयाबीन अनुसंधान संस्थान (IISR) इंदौर प्रमाणित गाइडलाइन',
          'चक्र भृंग व इल्ली का एकीकृत कीट प्रबंधन (IPM)',
          'सीआईबीआरसी नियमों के अनुसार सुरक्षित प्रतीक्षा अवधि',
        ],
        institutionalSources: [
          {
            name: 'भारतीय सोयाबीन अनुसंधान संस्थान (ICAR-IISR), इंदौर',
            type: 'ICAR',
            url: 'https://iisrindore.icar.gov.in',
          },
          {
            name: 'कृषि विज्ञान केंद्र (KVK) सोयाबीन विस्तार',
            type: 'KVK',
            url: 'https://kvk.icar.gov.in',
          },
        ],
      },
      disclaimer:
        'यह सलाह आईसीएआर-आईआईएसआर इंदौर के पैकेज ऑफ प्रैक्टिसेज पर आधारित है। रासायनिक उपचार से पूर्व स्थानीय केवीके से सलाह लें।',
    },
  },
  wheat: {
    crop: 'Wheat',
    stage: 'CRI (Crown Root Initiation) & Tillering',
    en: {
      crop: 'Wheat',
      stage: 'CRI (Crown Root Initiation) & Tillering',
      summary:
        'First irrigation at CRI stage (20-25 DAS) is non-negotiable for root establishment and tiller count.',
      primaryRecommendation:
        'Apply first split of Urea along with first irrigation. Control broadleaf and grassy weeds before tillering closes canopy.',
      irrigationGuidance: {
        recommendation: 'First irrigation at 21-25 days after sowing (CRI stage) is critical for yield.',
        schedule: 'Light irrigation avoiding ponding; heavy flooding causes yellowing of young seedlings.',
        waterRequirement: '60-70 mm per irrigation turn, 4-6 irrigations across season.',
      },
      fertilizerNutrition: {
        macroNutrients: 'Top dress with 30-35 kg Nitrogen (Urea ~65-75 kg) per acre just before first irrigation.',
        microNutrients: 'If soil test shows zinc deficiency, apply 0.5% Zinc Sulphate + 2.5% Urea foliar spray.',
        applicationMethod: 'Broadcasting in moist soil followed by irrigation.',
        organicAlternatives: ['Enriched compost 1 ton/acre', 'Azotobacter seed bio-fertilizer inoculation'],
      },
      pestDiseasePrecaution: {
        threats: ['Phalaris minor (Gullidanda weed)', 'Termites in sandy soil', 'Yellow/Brown rust in Northern plains'],
        preventiveMeasures: [
          'Rotate crops to disrupt Phalaris minor seed bank.',
          'Scout for yellow rust stripe symptoms on upper leaves in Dec-Jan.',
        ],
        cibrcApprovedTreatments: [
          {
            name: 'Clodinafop-propargyl 15% WP',
            dosage: '160 g per acre in 150 L water at 30-35 DAS',
            targetPest: 'Phalaris minor and wild oat',
            safetyIntervalDays: 60,
          },
          {
            name: 'Propiconazole 25% EC',
            dosage: '200 ml per acre in 200 L water',
            targetPest: 'Yellow rust (Stripe rust)',
            safetyIntervalDays: 30,
          },
        ],
        organicAlternatives: ['Hand weeding at 25-30 DAS', 'Trichoderma viride 2.5 kg/acre in FYM'],
      },
      contingencyWeatherAdvisory:
        'Unseasonal winter rains: delay scheduled irrigation by 7-10 days to avoid soil compaction and root rot.',
      groundedPractices: {
        practices: [
          'ICAR-IIWBR Karnal Wheat Package of Practices',
          'Zero-tillage wheat cultivation protocols',
          'Judicious herbicide rotation to prevent herbicide resistance in weeds',
        ],
        institutionalSources: [
          {
            name: 'ICAR - Indian Institute of Wheat and Barley Research (IIWBR), Karnal',
            type: 'ICAR',
            url: 'https://iiwbr.icar.gov.in',
          },
        ],
      },
      disclaimer: 'Based on ICAR-IIWBR Karnal agronomic research. Consult local KVK for area-specific varieties.',
    },
    hi: {
      crop: 'गेहूं (Wheat)',
      stage: 'ताज मूल अवस्था (CRI Stage - 20-25 दिन)',
      summary:
        'बुवाई के 20-25 दिन बाद सीआरआई (ताज मूल) अवस्था पर पहली सिंचाई फसल की पैदावार के लिए सबसे महत्वपूर्ण है।',
      primaryRecommendation:
        'पहली सिंचाई के समय यूरिया की पहली टॉप-ड्रेसिंग करें और गुल्ली-डंडा (मंडूसी) खरपतवार का समय रहते नियंत्रण करें।',
      irrigationGuidance: {
        recommendation: 'बुवाई के 21-25 दिनों बाद ताज मूल निकलते समय हल्की सिंचाई करें।',
        schedule: 'पानी को खेत में रुकने न दें; ज्यादा पानी भरने से पौधे पीले पड़ जाते हैं।',
        waterRequirement: 'प्रति सिंचाई 60-70 मिमी, पूरे मौसम में 4 से 6 सिंचाइयां।',
      },
      fertilizerNutrition: {
        macroNutrients: 'पहली सिंचाई से ठीक पहले 30-35 किग्रा नाइट्रोजन (लगभग 65-75 किग्रा यूरिया) प्रति एकड़ बुरकें।',
        microNutrients: 'जिंक की कमी होने पर 0.5% जिंक सल्फेट + 2.5% यूरिया का पर्णीय छिड़काव करें।',
        applicationMethod: 'ओट (हल्की नमी) आने पर यूरिया का बुरकाव करें।',
        organicAlternatives: ['गोबर की सड़ी खाद 1 टन प्रति एकड़', 'एज़ोटोबैक्टर जैव उर्वरक'],
      },
      pestDiseasePrecaution: {
        threats: ['गुल्ली डंडा / मंडूसी (Phalaris minor)', 'दीमक (रेतीली मिट्टी में)', 'पीला रतुआ (Yellow Rust)'],
        preventiveMeasures: [
          'फसल चक्र अपनाकर मंडूसी के बीजों को नष्ट करें।',
          'दिसंबर-जनवरी में पत्तियों पर पीले रतुआ की धारियों की नियमित निगरानी करें।',
        ],
        cibrcApprovedTreatments: [
          {
            name: 'क्लोडीनाफॉप-प्रोपार्गिल 15% डब्ल्यूपी (Clodinafop-propargyl)',
            dosage: '160 ग्राम प्रति एकड़ (150 लीटर पानी में, 30-35 दिन पर)',
            targetPest: 'मंडूसी (गुल्ली डंडा) खरपतवार',
            safetyIntervalDays: 60,
          },
          {
            name: 'प्रोपिकोनाज़ोल 25% ईसी (Propiconazole)',
            dosage: '200 मिली प्रति एकड़ (200 लीटर पानी में)',
            targetPest: 'पीला रतुआ रोग',
            safetyIntervalDays: 30,
          },
        ],
        organicAlternatives: ['बुवाई के 25-30 दिन बाद हाथ से निराई-गुड़ाई', 'ट्राइकोडर्मा विरिडी 2.5 किग्रा प्रति एकड़'],
      },
      contingencyWeatherAdvisory:
        'सर्दियों में बारिश होने पर प्रस्तावित सिंचाई को 7-10 दिन के लिए टाल दें ताकि जड़ें सड़ें नहीं।',
      groundedPractices: {
        practices: [
          'भाकृअनुप-गेहूं एवं जौ अनुसंधान संस्थान (IIWBR) करनाल की सिफारिशें',
          'समय पर सीआरआई सिंचाई से कल्ले फूटने में वृद्धि',
          'खरपतवारनाशी का वैज्ञानिक इस्तेमाल',
        ],
        institutionalSources: [
          {
            name: 'भारतीय गेहूं एवं जौ अनुसंधान संस्थान (ICAR-IIWBR), करनाल',
            type: 'ICAR',
            url: 'https://iiwbr.icar.gov.in',
          },
        ],
      },
      disclaimer: 'यह सलाह आईसीएआर-आईआईडब्ल्यूबीआर करनाल की शोध पर आधारित है। अपने स्थानीय केवीके से पुष्टि करें।',
    },
  },
  rice: {
    crop: 'Rice / Paddy',
    stage: 'Tillering & Panicle Initiation',
    en: {
      crop: 'Rice / Paddy',
      stage: 'Tillering & Panicle Initiation',
      summary:
        'Maintain thin water layer (2-3 cm). Watch for Stem Borer dead hearts and Brown Planthopper (BPH) at plant base.',
      primaryRecommendation:
        'Split nitrogen application: apply second dose at active tillering. Practice Alternate Wetting and Drying (AWD) to save water and curb BPH.',
      irrigationGuidance: {
        recommendation: 'Maintain shallow water (2-3 cm) during tillering; drain field for 2-3 days before panicle initiation.',
        schedule: 'Alternate Wetting and Drying (AWD) using a field water tube.',
        waterRequirement: '1200-1400 mm total crop water requirement.',
      },
      fertilizerNutrition: {
        macroNutrients: 'Top dress with 25 kg Nitrogen (Urea ~55 kg) + 10 kg MOP per acre at panicle initiation.',
        microNutrients: 'Zinc Sulphate heptahydrate 21% @ 10 kg/acre basal or 0.5% foliar spray to prevent Khaira disease.',
        applicationMethod: 'Broadcast after draining standing water; re-irrigate after 24 hours.',
        organicAlternatives: ['Azolla bio-fertilizer @ 500 kg/acre', 'Blue Green Algae (BGA)'],
      },
      pestDiseasePrecaution: {
        threats: ['Yellow Stem Borer', 'Brown Planthopper (BPH)', 'Bacterial Leaf Blight (BLB)', 'Sheath Blight'],
        preventiveMeasures: [
          'Create alleyways of 30 cm after every 2 meters for aeration and BPH suppression.',
          'Install pheromone traps @ 5 per acre for Yellow Stem Borer.',
        ],
        cibrcApprovedTreatments: [
          {
            name: 'Trifloxystrobin 25% + Tebuconazole 50% WG',
            dosage: '80 g per acre in 200 L water',
            targetPest: 'Sheath Blight and Blast',
            safetyIntervalDays: 21,
          },
          {
            name: 'Pymetrozine 50% WDG',
            dosage: '120 g per acre directed at plant base',
            targetPest: 'Brown Planthopper (BPH)',
            safetyIntervalDays: 19,
          },
        ],
        organicAlternatives: ['Neem oil 1500 ppm @ 3 ml/L', 'Pseudomonas fluorescens @ 5 g/L spray'],
      },
      contingencyWeatherAdvisory:
        'Cloudy humid weather with persistent drizzle triggers Sheath Blight; drain standing water temporarily.',
      groundedPractices: {
        practices: [
          'ICAR-NRRI Cuttack Rice Production Technology',
          'Alternate Wetting and Drying (AWD) water conservation protocol',
          'Basal aeration rows to prevent Brown Planthopper infestation',
        ],
        institutionalSources: [
          {
            name: 'ICAR - National Rice Research Institute (NRRI), Cuttack',
            type: 'ICAR',
            url: 'https://icar-nrri.gov.in',
          },
        ],
      },
      disclaimer: 'Grounded in ICAR-NRRI Cuttack agronomic protocols. Consult local KVK agronomist.',
    },
    hi: {
      crop: 'धान / चावल (Paddy / Rice)',
      stage: 'कल्ले फूटने एवं बाली निकलने की प्रारंभिक अवस्था (Tillering & PI)',
      summary:
        'खेत में 2-3 सेमी उथला पानी रखें। तना छेदक के कारण डेड हार्ट और पौधे के तने पर भूरा फुदका (BPH) की निगरानी करें।',
      primaryRecommendation:
        'यूरिया की दूसरी किस्त दें। पानी बचाने और बीपीएच कीट को रोकने के लिए बीच-बीच में खेत को सुखाएं (AWD विधि)।',
      irrigationGuidance: {
        recommendation: 'कल्ले फूटते समय 2-3 सेमी उथला पानी रखें; बाली बनने से पहले 2 दिन खेत से पानी निकालें।',
        schedule: 'वैकल्पिक गीला और सूखा (AWD) विधि अपनाएं।',
        waterRequirement: 'कुल जल आवश्यकता 1200-1400 मिमी।',
      },
      fertilizerNutrition: {
        macroNutrients: 'बाली बनते समय 25 किग्रा नाइट्रोजन (लगभग 55 किग्रा यूरिया) + 10 किग्रा पोटाश प्रति एकड़ दें।',
        microNutrients: 'खैरा रोग की रोकथाम हेतु 10 किग्रा जिंक सल्फेट प्रति एकड़ या 0.5% जिंक सल्फेट का छिड़काव करें।',
        applicationMethod: 'पानी निकालकर यूरिया बुरकें और 24 घंटे बाद पुनः पानी दें।',
        organicAlternatives: ['अज़ोला जैव उर्वरक 500 किग्रा प्रति एकड़', 'नील हरित शैवाल (BGA)'],
      },
      pestDiseasePrecaution: {
        threats: ['पीला तना छेदक (Stem Borer)', 'भूरा फुदका (BPH)', 'शीथ ब्लाइट (पर्ण झुलसा)', 'जीवाणु पत्ती झुलसा'],
        preventiveMeasures: [
          'खेत में हवा के आवागमन हेतु हर 2 मीटर के बाद 30 सेमी की गली (रास्ता) छोड़ें।',
          'तना छेदक के लिए 5 फेरोमोन ट्रैप प्रति एकड़ लगाएं।',
        ],
        cibrcApprovedTreatments: [
          {
            name: 'ट्राइफ्लोक्सीस्ट्रोबिन 25% + टेबुकोनाज़ोल 50% डब्ल्यूजी',
            dosage: '80 ग्राम प्रति एकड़ (200 लीटर पानी में)',
            targetPest: 'शीथ ब्लाइट एवं झोंका (ब्लास्ट) रोग',
            safetyIntervalDays: 21,
          },
          {
            name: 'पाइमेट्रोज़िन 50% डब्ल्यूडीजी (Pymetrozine)',
            dosage: '120 ग्राम प्रति एकड़ (पौधों के आधार पर छिड़काव)',
            targetPest: 'भूरा फुदका (BPH)',
            safetyIntervalDays: 19,
          },
        ],
        organicAlternatives: ['नीम का तेल 1500 पीपीएम (3 मिली/लीटर पानी)', 'स्यूडोमोनास फ्लोरेसेंस 5 ग्राम/लीटर'],
      },
      contingencyWeatherAdvisory:
        'बादल छाए रहने और हल्की बूंदाबांदी से शीथ ब्लाइट का प्रकोप बढ़ता है; खेत से पानी तुरंत निकालें।',
      groundedPractices: {
        practices: [
          'भाकृअनुप-राष्ट्रीय चावल अनुसंधान संस्थान (NRRI) कटक की संस्तुतियां',
          'वैकल्पिक गीला और सूखा (AWD) सिंचाई तकनीक',
          'भूरा फुदका कीट प्रबंधन हेतु कतारों के बीच हवा का रास्ता',
        ],
        institutionalSources: [
          {
            name: 'राष्ट्रीय चावल अनुसंधान संस्थान (ICAR-NRRI), कटक',
            type: 'ICAR',
            url: 'https://icar-nrri.gov.in',
          },
        ],
      },
      disclaimer: 'यह सलाह आईसीएआर-एनआरआरआई कटक के मानकों पर आधारित है। स्थानीय कृषि अधिकारी से मार्गदर्शन लें।',
    },
  },
  tomato: {
    crop: 'Tomato',
    stage: 'Flowering & Fruit Setting',
    en: {
      crop: 'Tomato',
      stage: 'Flowering & Fruit Setting',
      summary:
        'Control Tomato Pinworm (Tuta absoluta) and Early Blight. Maintain uniform drip irrigation to avoid blossom-end rot.',
      primaryRecommendation:
        'Stake plants properly to keep fruit off soil. Spray calcium nitrate to avoid blossom end rot during hot dry winds.',
      irrigationGuidance: {
        recommendation: 'Irrigate with drip every 2-3 days; avoid erratic irrigation which causes fruit cracking.',
        schedule: 'Morning drip fertigation avoiding wetting foliar canopy.',
        waterRequirement: '400-600 mm seasonal requirement.',
      },
      fertilizerNutrition: {
        macroNutrients: 'Fertigation with 0:0:50 (Potassium Sulphate) + Calcium Nitrate @ 3 kg each per acre weekly.',
        microNutrients: 'Foliar spray of 0.2% Boron (Solubor) at peak flowering to enhance fruit set.',
        applicationMethod: 'Drip fertigation or root drenching.',
        organicAlternatives: ['Neem cake extract drenching', 'Panchagavya 3% foliar spray'],
      },
      pestDiseasePrecaution: {
        threats: ['Tomato Leafminer / Pinworm (Tuta absoluta)', 'Fruit Borer (Helicoverpa)', 'Early Blight (Alternaria)', 'Bacterial Canker'],
        preventiveMeasures: [
          'Install delta pheromone traps @ 12-16 per acre for Tuta absoluta.',
          'Remove infected lower leaves touching soil.',
        ],
        cibrcApprovedTreatments: [
          {
            name: 'Spinetoram 11.7% SC',
            dosage: '180 ml per acre in 200 L water',
            targetPest: 'Tuta absoluta and thrips',
            safetyIntervalDays: 3,
          },
          {
            name: 'Mancozeb 75% WP',
            dosage: '500 g per acre in 200 L water',
            targetPest: 'Early and Late Blight',
            safetyIntervalDays: 7,
          },
        ],
        organicAlternatives: ['Neem oil 10000 ppm @ 2 ml/L', 'Trichoderma harzianum soil drench'],
      },
      contingencyWeatherAdvisory:
        'Sudden rise in temperature (>36°C) causes flower drop; spray micronutrients and maintain mulching.',
      groundedPractices: {
        practices: [
          'ICAR-IIHR Bengaluru Vegetable Production Guide',
          'Tuta absoluta integrated management with pheromone trapping',
          'Safe waiting period adherence for fresh vegetable harvest',
        ],
        institutionalSources: [
          {
            name: 'ICAR - Indian Institute of Horticultural Research (IIHR), Bengaluru',
            type: 'ICAR',
            url: 'https://iihr.icar.gov.in',
          },
        ],
      },
      disclaimer: 'Based on ICAR-IIHR vegetable protocols. Observe safety waiting periods strictly before harvest.',
    },
    hi: {
      crop: 'टमाटर (Tomato)',
      stage: 'फूल और फल बनने की अवस्था (Flowering & Fruit Setting)',
      summary:
        'टुटा एब्सोल्यूटा (पत्ती सुरंग कीट) और फल छेदक से बचाव करें। फल के नीचे का हिस्सा सड़ने से बचाने हेतु कैल्शियम नाइट्रेट दें।',
      primaryRecommendation:
        'पौधों को लकड़ी या तार के सहारे बांधें ताकि फल जमीन न छुएं। अनियमित सिंचाई न करें जिससे फल फटने की समस्या न हो।',
      irrigationGuidance: {
        recommendation: 'ड्रिप विधि से हर 2-3 दिन में हल्की सिंचाई करें; पत्तियों को गीला करने से बचें।',
        schedule: 'सुबह के समय ड्रिप से पानी दें।',
        waterRequirement: 'फसल की कुल जल आवश्यकता 400-600 मिमी।',
      },
      fertilizerNutrition: {
        macroNutrients: 'ड्रिप से 0:0:50 (पोटेशियम सल्फेट) और कैल्शियम नाइट्रेट 3-3 किग्रा प्रति एकड़ प्रति सप्ताह दें।',
        microNutrients: 'फूल आने के समय 0.2% बोरॉन (बोरैक्स 2 ग्राम/लीटर) का पर्णीय छिड़काव करें।',
        applicationMethod: 'ड्रिप फर्टिगेशन या जड़ों के पास ड्रेन्चिंग।',
        organicAlternatives: ['नीम की खली का अर्क जड़ों में दें', 'पंचगव्य 3% का छिड़काव'],
      },
      pestDiseasePrecaution: {
        threats: ['टुटा एब्सोल्यूटा (पिनवर्म)', 'फल छेदक सुंडी', 'अल्टरनेरिया अगेती झुलसा', 'जीवाणु पत्ती धब्बा'],
        preventiveMeasures: [
          'टुटा एब्सोल्यूटा के लिए 12-16 फेरोमोन ट्रैप प्रति एकड़ लगाएं।',
          'जमीन से छूने वाली निचली बीमार पत्तियों को तोड़कर हटा दें।',
        ],
        cibrcApprovedTreatments: [
          {
            name: 'स्पिनेटोरम 11.7% एससी (Spinetoram 11.7% SC)',
            dosage: '180 मिली प्रति एकड़ (200 लीटर पानी में)',
            targetPest: 'टुटा एब्सोल्यूटा और थ्रिप्स',
            safetyIntervalDays: 3,
          },
          {
            name: 'मैनकोज़ेब 75% डब्ल्यूपी (Mancozeb)',
            dosage: '500 ग्राम प्रति एकड़ (200 लीटर पानी में)',
            targetPest: 'अगेती व पछेती झुलसा रोग',
            safetyIntervalDays: 7,
          },
        ],
        organicAlternatives: ['नीम का तेल 10000 पीपीएम (2 मिली/लीटर पानी)', 'ट्राइकोडर्मा हरजिएनम मृदा उपचार'],
      },
      contingencyWeatherAdvisory:
        'तापमान 36°C से ऊपर जाने पर फूल झड़ते हैं; क्यारियों में मल्चिंग करें और नमी बनाए रखें।',
      groundedPractices: {
        practices: [
          'भाकृअनुप-भारतीय बागवानी अनुसंधान संस्थान (IIHR) बेंगलुरु पैकेज',
          'सब्जी फसलों में कीटनाशकों की सुरक्षित तुड़ाई प्रतीक्षा अवधि (PHI)',
          'टुटा एब्सोल्यूटा का एकीकृत कीट नियंत्रण',
        ],
        institutionalSources: [
          {
            name: 'भारतीय बागवानी अनुसंधान संस्थान (ICAR-IIHR), बेंगलुरु',
            type: 'ICAR',
            url: 'https://iihr.icar.gov.in',
          },
        ],
      },
      disclaimer: 'यह सलाह आईसीएआर-आईआईएचआर बेंगलुरु की शोध पर आधारित है। तुड़ाई से पहले सुरक्षा अवधि का पालन करें।',
    },
  },
};

/**
 * Returns a verified, deterministic agronomic advisory for offline or fallback operation.
 */
export function getOfflineAgronomicAdvisory(
  request: Partial<AgronomicAdvisoryRequest> & { cropName: string }
): AgronomicAdvisory {
  const cropKey = (request.cropName || '').toLowerCase().trim();
  const lang = request.language === 'hi' ? 'hi' : 'en';

  let record: OfflineCropAdvisoryRecord | undefined = OFFLINE_AGRONOMIC_REGISTRY[cropKey];

  // Try substring match if exact key not found
  if (!record) {
    const matchedKey = Object.keys(OFFLINE_AGRONOMIC_REGISTRY).find((k) =>
      cropKey.includes(k) || k.includes(cropKey)
    );
    if (matchedKey) {
      record = OFFLINE_AGRONOMIC_REGISTRY[matchedKey];
    }
  }

  // Fallback to cotton or general template if unknown crop
  if (!record) {
    record = OFFLINE_AGRONOMIC_REGISTRY['cotton'];
  }

  const base = record[lang];

  return {
    ...base,
    crop: lang === 'hi' ? base.crop : (request.cropName || base.crop),
    stage: lang === 'hi' ? base.stage : (request.cropStage || base.stage),
    language: lang,
    generatedAt: new Date().toISOString(),
  };
}
