import { AIHealthResponse } from '@/lib/ai/schemas';

export interface DemoLeafPreset {
  id: string;
  name: string;
  crop: string;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidenceScore: number;
  description: string;
  imageDataUrl: string;
  presetResponse: AIHealthResponse;
}

// Crisp inline SVGs depicting realistic botanical pathology patterns
const SVG_YELLOW_MOSAIC = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <radialGradient id="ymBg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="%231a3311"/>
      <stop offset="100%" stop-color="%230d1a08"/>
    </radialGradient>
    <radialGradient id="chlorosis" cx="45%" cy="40%" r="60%">
      <stop offset="0%" stop-color="%23facc15" stop-opacity="0.95"/>
      <stop offset="40%" stop-color="%2384cc16" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="%2322c55e" stop-opacity="0.2"/>
    </radialGradient>
    <filter id="mottle">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(%23ymBg)"/>
  <!-- Leaf stem -->
  <path d="M 200,380 C 202,320 200,260 200,210" stroke="%23557a2b" stroke-width="8" stroke-linecap="round" fill="none"/>
  <!-- Leaf Blade -->
  <path d="M 200,60 C 290,110 330,220 200,340 C 70,220 110,110 200,60 Z" fill="%232e6930" stroke="%2319401b" stroke-width="3"/>
  <!-- Mosaic Chlorotic Patches -->
  <path d="M 200,60 C 290,110 330,220 200,340 C 70,220 110,110 200,60 Z" fill="url(%23chlorosis)" filter="url(%23mottle)"/>
  <!-- Yellow mosaic islands -->
  <ellipse cx="160" cy="150" rx="35" ry="25" fill="%23facc15" opacity="0.9"/>
  <ellipse cx="230" cy="180" rx="40" ry="28" fill="%23eab308" opacity="0.85"/>
  <ellipse cx="175" cy="240" rx="30" ry="20" fill="%23fde047" opacity="0.9"/>
  <ellipse cx="235" cy="270" rx="25" ry="18" fill="%23facc15" opacity="0.85"/>
  <circle cx="190" cy="110" r="18" fill="%23fde047" opacity="0.95"/>
  <!-- Veins -->
  <path d="M 200,70 L 200,330" stroke="%237cb342" stroke-width="4" stroke-linecap="round"/>
  <path d="M 200,120 Q 230,105 270,115" stroke="%237cb342" stroke-width="2.5" fill="none"/>
  <path d="M 200,120 Q 170,105 130,115" stroke="%237cb342" stroke-width="2.5" fill="none"/>
  <path d="M 200,170 Q 240,155 285,175" stroke="%237cb342" stroke-width="2.5" fill="none"/>
  <path d="M 200,170 Q 160,155 115,175" stroke="%237cb342" stroke-width="2.5" fill="none"/>
  <path d="M 200,230 Q 235,220 270,245" stroke="%237cb342" stroke-width="2" fill="none"/>
  <path d="M 200,230 Q 165,220 130,245" stroke="%237cb342" stroke-width="2" fill="none"/>
  <!-- Pathology label badge in corner -->
  <rect x="15" y="15" width="160" height="26" rx="6" fill="%23000000" fill-opacity="0.7"/>
  <text x="25" y="32" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23facc15">Yellow Mosaic Virus</text>
</svg>`;

const SVG_CITRUS_CANKER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <radialGradient id="ccBg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="%231a2e12"/>
      <stop offset="100%" stop-color="%230b1407"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(%23ccBg)"/>
  <!-- Leaf stem -->
  <path d="M 190,375 Q 192,340 195,300" stroke="%233e6b27" stroke-width="7" stroke-linecap="round"/>
  <!-- Elliptical Citrus Leaf -->
  <path d="M 195,65 C 295,95 315,220 195,310 C 85,220 95,95 195,65 Z" fill="%231e5922" stroke="%23123815" stroke-width="3"/>
  <!-- Main Vein -->
  <path d="M 195,75 Q 194,180 195,305" stroke="%234d8536" stroke-width="3.5" fill="none"/>
  <!-- Lateral veins -->
  <path d="M 195,130 Q 235,120 275,135" stroke="%233d6b2b" stroke-width="1.8" fill="none"/>
  <path d="M 195,130 Q 155,120 115,135" stroke="%233d6b2b" stroke-width="1.8" fill="none"/>
  <path d="M 195,190 Q 240,185 280,210" stroke="%233d6b2b" stroke-width="1.8" fill="none"/>
  <path d="M 195,190 Q 150,185 110,210" stroke="%233d6b2b" stroke-width="1.8" fill="none"/>
  <path d="M 195,250 Q 230,245 260,270" stroke="%233d6b2b" stroke-width="1.8" fill="none"/>
  <path d="M 195,250 Q 160,245 130,270" stroke="%233d6b2b" stroke-width="1.8" fill="none"/>
  <!-- Corky canker pustules with bright yellow halos -->
  <!-- Lesion 1 -->
  <circle cx="150" cy="160" r="22" fill="%23eab308" opacity="0.85"/>
  <circle cx="150" cy="160" r="14" fill="%2378350f"/>
  <circle cx="150" cy="160" r="8" fill="%23451a03"/>
  <!-- Lesion 2 (Large central) -->
  <circle cx="235" cy="195" r="28" fill="%23eab308" opacity="0.9"/>
  <circle cx="235" cy="195" r="18" fill="%2378350f"/>
  <circle cx="235" cy="195" r="10" fill="%23381e05"/>
  <circle cx="233" cy="193" r="4" fill="%239a3412"/>
  <!-- Lesion 3 -->
  <circle cx="165" cy="245" r="18" fill="%23eab308" opacity="0.85"/>
  <circle cx="165" cy="245" r="11" fill="%2378350f"/>
  <circle cx="165" cy="245" r="6" fill="%23381e05"/>
  <!-- Lesion 4 (Small near tip) -->
  <circle cx="215" cy="115" r="14" fill="%23facc15" opacity="0.8"/>
  <circle cx="215" cy="115" r="8" fill="%2378350f"/>
  <!-- Lesion 5 (Margin) -->
  <circle cx="125" cy="210" r="16" fill="%23facc15" opacity="0.8"/>
  <circle cx="125" cy="210" r="10" fill="%2378350f"/>
  <!-- Label -->
  <rect x="15" y="15" width="165" height="26" rx="6" fill="%23000000" fill-opacity="0.7"/>
  <text x="25" y="32" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23fbbf24">Citrus Canker Lesions</text>
</svg>`;

const SVG_BACTERIAL_BLIGHT = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <radialGradient id="bbBg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="%231f2619"/>
      <stop offset="100%" stop-color="%230c100a"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(%23bbBg)"/>
  <!-- Cotton Leaf (Palmate 3-lobed) -->
  <path d="M 200,370 L 200,310" stroke="%23405c2a" stroke-width="8" stroke-linecap="round"/>
  <path d="M 200,310 C 130,310 70,250 85,180 C 95,130 145,150 170,140 C 185,100 175,50 200,50 C 225,50 215,100 230,140 C 255,150 305,130 315,180 C 330,250 270,310 200,310 Z" fill="%23275b2b" stroke="%23143817" stroke-width="3"/>
  <!-- Primary Palmate Veins -->
  <path d="M 200,300 L 200,65" stroke="%2353843b" stroke-width="3.5"/>
  <path d="M 200,280 Q 150,220 95,175" stroke="%2353843b" stroke-width="3"/>
  <path d="M 200,280 Q 250,220 305,175" stroke="%2353843b" stroke-width="3"/>
  <!-- Angular Vein-bounded necrotic spots -->
  <!-- Angular polygon 1 -->
  <polygon points="175,170 195,178 190,205 168,198" fill="%23451a03" stroke="%2378350f" stroke-width="1.5"/>
  <!-- Angular polygon 2 -->
  <polygon points="205,160 228,165 220,190 205,185" fill="%23381e05" stroke="%23854d0e" stroke-width="1.5"/>
  <!-- Angular polygon 3 -->
  <polygon points="140,210 165,215 155,238 135,230" fill="%23451a03" stroke="%2378350f" stroke-width="1.5"/>
  <!-- Angular polygon 4 -->
  <polygon points="215,225 245,220 250,245 225,250" fill="%232e1804" stroke="%23713f12" stroke-width="1.5"/>
  <!-- Vein blackening streak -->
  <path d="M 200,140 L 200,175" stroke="%231f1305" stroke-width="4"/>
  <!-- Small angular speckles -->
  <polygon points="180,120 190,122 188,135 178,130" fill="%23451a03"/>
  <polygon points="230,135 240,138 238,148 228,145" fill="%23451a03"/>
  <!-- Label -->
  <rect x="15" y="15" width="180" height="26" rx="6" fill="%23000000" fill-opacity="0.7"/>
  <text x="25" y="32" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23fb923c">Angular Bacterial Blight</text>
</svg>`;

const SVG_EARLY_BLIGHT = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <radialGradient id="ebBg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="%231b261b"/>
      <stop offset="100%" stop-color="%230b120a"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(%23ebBg)"/>
  <!-- Tomato leaf leaflet with serrated margins -->
  <path d="M 200,375 Q 198,330 200,280" stroke="%233a5927" stroke-width="6" stroke-linecap="round"/>
  <path d="M 200,70 Q 230,90 245,110 Q 275,130 280,165 Q 260,185 275,215 Q 250,235 240,265 Q 215,270 200,290 Q 185,270 160,265 Q 150,235 125,215 Q 140,185 120,165 Q 125,130 155,110 Q 170,90 200,70 Z" fill="%232b5e29" stroke="%23163a15" stroke-width="3"/>
  <!-- Central Vein -->
  <path d="M 200,75 L 200,285" stroke="%234a7d36" stroke-width="3"/>
  <!-- Concentric 'target board' lesions -->
  <!-- Target Spot 1 (Large lower-middle) -->
  <ellipse cx="170" cy="205" rx="35" ry="30" fill="%23eab308" opacity="0.65"/>
  <ellipse cx="170" cy="205" rx="27" ry="23" fill="%23713f12"/>
  <ellipse cx="170" cy="205" rx="21" ry="18" fill="%23451a03" stroke="%23854d0e" stroke-width="2"/>
  <ellipse cx="170" cy="205" rx="14" ry="12" fill="%23713f12" stroke="%23a16207" stroke-width="1.5"/>
  <circle cx="170" cy="205" r="7" fill="%231c0a00"/>
  <!-- Target Spot 2 (Upper right) -->
  <ellipse cx="230" cy="145" rx="28" ry="24" fill="%23eab308" opacity="0.6"/>
  <ellipse cx="230" cy="145" rx="20" ry="17" fill="%23713f12"/>
  <ellipse cx="230" cy="145" rx="14" ry="12" fill="%23451a03" stroke="%23854d0e" stroke-width="1.5"/>
  <circle cx="230" cy="145" r="5" fill="%231c0a00"/>
  <!-- Target Spot 3 (Margin necrotic curl) -->
  <ellipse cx="235" cy="225" rx="22" ry="18" fill="%2378350f"/>
  <ellipse cx="235" cy="225" rx="14" ry="11" fill="%23451a03" stroke="%23a16207" stroke-width="1.2"/>
  <!-- Marginal chlorosis -->
  <path d="M 270,165 Q 260,185 272,210" stroke="%23eab308" stroke-width="5" opacity="0.75" fill="none"/>
  <!-- Label -->
  <rect x="15" y="15" width="185" height="26" rx="6" fill="%23000000" fill-opacity="0.7"/>
  <text x="25" y="32" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23f59e0b">Alternaria Early Blight</text>
</svg>`;

const SVG_FALL_ARMYWORM = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <radialGradient id="fawBg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="%231a261a"/>
      <stop offset="100%" stop-color="%230b140a"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(%23fawBg)"/>
  <!-- Maize elongated blade leaf -->
  <path d="M 200,390 Q 200,260 200,40" stroke="%235b8744" stroke-width="8"/>
  <path d="M 200,40 C 270,100 290,240 230,380 L 170,380 C 110,240 130,100 200,40 Z" fill="%23306634" stroke="%23173d19" stroke-width="3"/>
  <!-- Parallel Veins -->
  <path d="M 200,45 L 200,375" stroke="%2384cc16" stroke-width="4"/>
  <path d="M 180,80 L 180,360" stroke="%234d8036" stroke-width="1.5"/>
  <path d="M 220,80 L 220,360" stroke="%234d8036" stroke-width="1.5"/>
  <path d="M 160,120 L 160,340" stroke="%234d8036" stroke-width="1.2"/>
  <path d="M 240,120 L 240,340" stroke="%234d8036" stroke-width="1.2"/>
  <!-- Chewed irregular windowpaning & shot holes -->
  <!-- Ragged hole 1 -->
  <path d="M 160,160 Q 150,180 165,200 Q 185,190 180,170 Q 170,150 160,160 Z" fill="%231a261a" stroke="%23ca8a04" stroke-width="2"/>
  <!-- Ragged hole 2 (Translucent windowpaning) -->
  <path d="M 215,190 Q 245,185 240,225 Q 210,230 215,190 Z" fill="%23fef08a" fill-opacity="0.35" stroke="%23a16207" stroke-width="1.5"/>
  <!-- Shot holes -->
  <circle cx="225" cy="140" r="9" fill="%231a261a" stroke="%2378350f" stroke-width="1.5"/>
  <circle cx="240" cy="155" r="7" fill="%231a261a" stroke="%2378350f" stroke-width="1.5"/>
  <circle cx="165" cy="245" r="11" fill="%231a261a" stroke="%2378350f" stroke-width="1.5"/>
  <!-- Frass pellets (caterpillar droppings) -->
  <circle cx="195" cy="210" r="3" fill="%2378350f"/>
  <circle cx="190" cy="218" r="3.5" fill="%23451a03"/>
  <circle cx="205" cy="225" r="2.5" fill="%23451a03"/>
  <circle cx="178" cy="195" r="3" fill="%2378350f"/>
  <!-- Margin notched feeding bites -->
  <path d="M 268,260 Q 248,275 272,290 Z" fill="%231a261a"/>
  <!-- Label -->
  <rect x="15" y="15" width="185" height="26" rx="6" fill="%23000000" fill-opacity="0.7"/>
  <text x="25" y="32" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23ef4444">Fall Armyworm Chewing</text>
</svg>`;

export const DEMO_LEAF_PRESETS: DemoLeafPreset[] = [
  {
    id: 'preset-yellow-mosaic',
    name: 'Yellow Mosaic Virus',
    crop: 'Soybean / Cotton',
    condition: 'Begomovirus Mosaic Complex',
    severity: 'high',
    confidenceScore: 92,
    description: 'Irregular bright yellow chlorotic patches, leaf curling, and stunted trifoliate canopy transmitted by whiteflies.',
    imageDataUrl: SVG_YELLOW_MOSAIC,
    presetResponse: {
      status: 'supported',
      cropAffected: 'Soybean / Cotton',
      detectedCondition: 'Yellow Mosaic Virus (Begomovirus)',
      confidenceScore: 92,
      severity: 'high',
      symptoms: [
        'Distinctive irregular bright yellow chlorotic patches intermixed with green tissue',
        'Vein clearing along secondary leaf venation',
        'Mild leaf crinkling, cupping, and reduced lamina expansion',
        'Stunted growth habit on newly emerged trifoliate leaflets',
      ],
      possibleCauses: [
        'Mungbean / Soybean Yellow Mosaic Begomovirus transmitted by Bemisia tabaci (Whitefly)',
        'Secondary differential: Iron (Fe) or Manganese (Mn) induced interveinal chlorosis',
        'Transient herbicide drift phytotoxicity',
      ],
      recommendedAction:
        'Immediately rogue out and destroy severely infected volunteer weeds along farm bunds. Erect yellow sticky traps (15 per acre) at canopy level to monitor and mass-trap whitefly vectors. Avoid late afternoon irrigation to keep foliage dry.',
      chemicalRecommendation: {
        name: 'Acetamiprid 20% SP or Thiamethoxam 25% WG',
        dosage: '50g / 100L water per acre',
        frequency: 'Single targeted perimeter spray during early morning calm hours (wind < 8 km/h)',
      },
      organicAlternative:
        'Neem Seed Kernel Extract (NSKE 5%) or 10,000 ppm cold-pressed Azadirachtin at 3 ml/L water, combined with yellow sticky traps.',
      missingInformation: [
        'Physical count of whitefly adults and nymphs on the abaxial (underside) leaf surface',
        'Recent 14-day rainfall and ambient relative humidity logs',
        'Confirmation of viral coat protein via RT-PCR or ELISA laboratory serological assay',
      ],
      limitations: [
        'Visual 2D screening cannot definitively distinguish viral Begomovirus strains from severe micronutrient deficiency without a laboratory assay',
        'Sunlight reflection may exaggerate brightness of chlorotic patches',
      ],
      sources: [
        {
          title: 'ICAR-Indian Institute of Soybean Research (IISR) Advisory',
          url: 'https://iisrindore.icar.gov.in',
        },
        {
          title: 'TNAU Agritech Portal — Cotton & Pulse Diseases',
          url: 'https://agritech.tnau.ac.in',
        },
      ],
      disclaimer:
        'This assessment is an AI-generated advisory screening tool based on 2D visual pattern recognition. It does not constitute a certified laboratory diagnostic. Field confirmation by a local Krishi Vigyan Kendra (KVK) officer is mandatory before chemical application.',
    },
  },
  {
    id: 'preset-citrus-canker',
    name: 'Citrus Canker',
    crop: 'Kinnow Mandarin',
    condition: 'Xanthomonas axonopodis pv. citri',
    severity: 'medium',
    confidenceScore: 89,
    description: 'Eruptive corky necrotic lesions surrounded by characteristic prominent oily yellow chlorotic halos.',
    imageDataUrl: SVG_CITRUS_CANKER,
    presetResponse: {
      status: 'supported',
      cropAffected: 'Kinnow Mandarin',
      detectedCondition: 'Citrus Bacterial Canker (Xanthomonas axonopodis pv. citri)',
      confidenceScore: 89,
      severity: 'medium',
      symptoms: [
        'Raised corky brownish pustules with crater-like erupted centres on leaf surface',
        'Pronounced bright yellow oily chlorotic halo surrounding each individual necrotic spot',
        'Premature defoliation risk on young tender flush flushes',
      ],
      possibleCauses: [
        'Xanthomonas axonopodis pv. citri bacterial colonization entering stomata and leafminer wounds',
        'Secondary differential: Citrus Scab (Elsinoë fawcettii) — lacks characteristic oily halo',
        'Mechanical wind-scaring or hail abrasion',
      ],
      recommendedAction:
        'Prune and burn infected canker twigs during dormant winter pruning. Control citrus leafminer larvae which create entry portals. Avoid overhead sprinkler irrigation which splashes bacterial ooze.',
      chemicalRecommendation: {
        name: 'Copper Oxychloride 50% WP + Streptocycline (Bactericide)',
        dosage: 'Copper Oxychloride @ 2.5g/L + Streptocycline @ 1g/10L water',
        frequency: 'Preventive spray at onset of new vegetative flush flushes and post-monsoon',
      },
      organicAlternative:
        'Bordeaux Mixture (1%) preventive foliar spray or Pseudomonas fluorescens biological wash.',
      missingInformation: [
        'Microscopic confirmation of bacterial streaming from freshly sectioned corky lesions',
        'Assessment of fruit rind involvement across the orchard blocks',
      ],
      limitations: [
        'Cannot evaluate asymptomatic latent bacterial populations inside woody twigs from leaf photo alone',
      ],
      sources: [
        {
          title: 'ICAR-Central Citrus Research Institute (CCRI) Nagpur',
          url: 'https://ccri.icar.gov.in',
        },
        {
          title: 'Punjab Agricultural University (PAU) Citrus Advisory',
          url: 'https://www.pau.edu',
        },
      ],
      disclaimer:
        'AI-generated advisory. Consult local horticulture extension officer before applying scheduled copper bactericide sprays.',
    },
  },
  {
    id: 'preset-bacterial-blight',
    name: 'Angular Leaf Spot',
    crop: 'BT Cotton',
    condition: 'Bacterial Blight (Xanthomonas citri pv. malvacearum)',
    severity: 'medium',
    confidenceScore: 86,
    description: 'Polygonal water-soaked lesions strictly delimited by major and secondary leaf veins.',
    imageDataUrl: SVG_BACTERIAL_BLIGHT,
    presetResponse: {
      status: 'supported',
      cropAffected: 'BT Cotton',
      detectedCondition: 'Bacterial Blight / Angular Leaf Spot',
      confidenceScore: 86,
      severity: 'medium',
      symptoms: [
        'Polygonal angular water-soaked dark brown spots sharply restricted by leaf veins',
        'Vein necrosis and blackened petiole streaks (black-arm phase)',
        'Shedding of affected young squares and early bolls',
      ],
      possibleCauses: [
        'Xanthomonas citri pv. malvacearum bacterial pathogen',
        'Prolonged high relative humidity (>80%) accompanied by warm temperatures (28-32°C)',
        'Differential: Alternaria macrospora leaf spot (rounded spots with concentric rings, not vein-bounded)',
      ],
      recommendedAction:
        'Improve inter-row air circulation by avoiding excessive plant density. Regulate nitrogenous fertilizer application (excess N increases plant succulence). Collect and burn infected plant debris.',
      chemicalRecommendation: {
        name: 'Copper Hydroxide 77% WP or Copper Oxychloride 50% WP',
        dosage: '25g per 10 liters of water (approx. 250g/acre)',
        frequency: 'Apply immediately upon observing 5% disease incidence in the plot',
      },
      organicAlternative:
        'Seed treatment and foliar application of Trichoderma viride and Bacillus subtilis bio-formulations.',
      missingInformation: [
        'Inspection of cotton bolls for water-soaked sunken lesions',
        'Record of recent overhead wind-driven thunderstorm events',
      ],
      limitations: [
        'Cannot differentiate between seed-borne vs wind-driven secondary spread without seed lot testing',
      ],
      sources: [
        {
          title: 'ICAR-Central Institute for Cotton Research (CICR) Nagpur',
          url: 'https://cicr.icar.gov.in',
        },
      ],
      disclaimer:
        'Advisory diagnosis based on visual geometry of lesions. Field agronomist confirmation required before drone or tractor spray operations.',
    },
  },
  {
    id: 'preset-early-blight',
    name: 'Early Blight Target Spot',
    crop: 'Tomato',
    condition: 'Alternaria solani',
    severity: 'high',
    confidenceScore: 91,
    description: 'Circular necrotic lesions displaying distinct concentric rings resembling target-boards surrounded by yellow chlorotic margins.',
    imageDataUrl: SVG_EARLY_BLIGHT,
    presetResponse: {
      status: 'supported',
      cropAffected: 'Tomato',
      detectedCondition: 'Early Blight (Alternaria solani)',
      confidenceScore: 91,
      severity: 'high',
      symptoms: [
        'Circular brown-black necrotic spots with characteristic concentric ring ridges (target-board pattern)',
        'Prominent yellow chlorotic halo surrounding lesions',
        'Lower senescing leaves affected first, progressing upward through the canopy',
      ],
      possibleCauses: [
        'Alternaria solani fungal infection thriving in alternating dry and wet canopy periods',
        'Differential: Septoria leaf spot (smaller, circular spots with dark borders and grey centres containing black pycnidia)',
        'Late Blight (Phytophthora infestans) — water-soaked greenish-black lesions with white fungal down on undersides',
      ],
      recommendedAction:
        'Prune lower foliage touching the soil to eliminate splash dispersal of fungal spores. Stake tomato vines to elevate canopy off damp mulch. Apply drip irrigation rather than overhead sprinklers.',
      chemicalRecommendation: {
        name: 'Mancozeb 75% WP or Azoxystrobin 23% SC',
        dosage: 'Mancozeb @ 2g/L or Azoxystrobin @ 1ml/L water',
        frequency: 'Spray at 10-14 day intervals during overcast or warm humid weather',
      },
      organicAlternative:
        'Trichoderma harzianum soil and foliar drench combined with copper soap fungicidal wash.',
      missingInformation: [
        'Stem collar inspection for dark sunken canker lesions (collar rot phase)',
        'Fruiting stage evaluation for dark leathery sunken lesions at the stem attachment point',
      ],
      limitations: [
        'Visual similarity to Alternaria alternata or Stemphylium leaf spot without spore micromorphology',
      ],
      sources: [
        {
          title: 'ICAR-Indian Institute of Vegetable Research (IIVR) Varanasi',
          url: 'https://iivr.icar.gov.in',
        },
      ],
      disclaimer:
        'Visual screening only. Always adhere to pre-harvest intervals (PHI) of fungicides before marketing produce.',
    },
  },
  {
    id: 'preset-fall-armyworm',
    name: 'Fall Armyworm Foliar Damage',
    crop: 'Maize / Corn',
    condition: 'Spodoptera frugiperda Chewing Damage',
    severity: 'critical',
    confidenceScore: 95,
    description: 'Windowpane epidermal feeding, ragged saw-tooth holes in leaf whorl, and accumulation of coarse frass pellets.',
    imageDataUrl: SVG_FALL_ARMYWORM,
    presetResponse: {
      status: 'supported',
      cropAffected: 'Maize / Corn',
      detectedCondition: 'Fall Armyworm (Spodoptera frugiperda) Pest Damage',
      confidenceScore: 95,
      severity: 'critical',
      symptoms: [
        'Irregular semi-transparent windowpane patches where young larvae scraped the epidermis',
        'Ragged, elongated shot-holes and saw-tooth torn margins unfolding from leaf whorls',
        'Accumulation of yellowish-brown sawdust-like frass pellets inside central leaf whorl',
      ],
      possibleCauses: [
        'Infestation by 2nd to 4th instar larvae of invasive pest Spodoptera frugiperda',
        'Differential: Maize stem borer (Chilo partellus) — creates neat horizontal rows of pin-holes across blade',
      ],
      recommendedAction:
        'Inspect central whorls for hidden caterpillars. Hand-pick egg masses and caterpillars where feasible. Apply dry sand or wood ash mixed with lime into whorls to physically abrade caterpillar skin.',
      chemicalRecommendation: {
        name: 'Chlorantraniliprole 18.5% SC or Emamectin Benzoate 5% SG',
        dosage: 'Chlorantraniliprole @ 0.4ml/L or Emamectin Benzoate @ 0.4g/L water',
        frequency: 'Direct spray nozzle straight downward into the central whorl; spray in late evening',
      },
      organicAlternative:
        'Release Trichogramma pretiosum parasitoid egg cards (50,000/acre) and spray Bacillus thuringiensis kurstaki (Bt) @ 2g/L water.',
      missingInformation: [
        'Head capsule inspection to confirm inverted Y-shape suture and 4 squarish black pinaculum spots on 8th abdominal segment',
        'Pheromone trap catch count (moths/trap/night) across the field',
      ],
      limitations: [
        'Larva may have burrowed deep into whorl or tassel and may not be directly visible in top-down foliage photo',
      ],
      sources: [
        {
          title: 'ICAR-Indian Institute of Maize Research (IIMR) Ludhiana',
          url: 'https://iimr.icar.gov.in',
        },
        {
          title: 'National Bureau of Agricultural Insect Resources (NBAIR) Bengaluru',
          url: 'https://www.nbair.res.in',
        },
      ],
      disclaimer:
        'Critical invasive pest advisory. Immediate field scout verification and whorl application is recommended under state agricultural advisory protocols.',
    },
  },
];
