import { FarmZone, GeoJSONPolygon } from '@/types';

export interface CropMasterData {
  id: string;
  name: string;
  scientificName: string;
  varieties: string[];
  defaultVariety: string;
  season: 'Kharif' | 'Rabi' | 'Zaid' | 'Annual';
  durationDays: number;
  expectedYieldTonnesPerAcre: number;
  estimatedNetProfitInrPerAcre: number;
  waterRequirement: 'Low' | 'Medium' | 'High' | 'Very High';
  idealSoils: string[];
  color: string;
  soilSuitabilityRation: Record<string, string>;
  evidenceStatus: 'supported' | 'partial' | 'insufficient_data';
  citations: Array<{ title: string; source: string; url?: string }>;
  typicalMissingInfo: string[];
}

export const INDIAN_CROPS_DATABASE: CropMasterData[] = [
  {
    id: 'cotton',
    name: 'Cotton',
    scientificName: 'Gossypium hirsutum',
    varieties: ['Bollgard II Hybrid', 'RCH-2 BG-II', 'Ajeet-155 BG-II', 'DCH-32'],
    defaultVariety: 'Bollgard II Hybrid',
    season: 'Kharif',
    durationDays: 160,
    expectedYieldTonnesPerAcre: 1.2,
    estimatedNetProfitInrPerAcre: 48000,
    waterRequirement: 'Medium',
    idealSoils: ['Medium Black Soil (Regur)', 'Deep Black Soil', 'Alluvial Loam'],
    color: '#173F2B',
    soilSuitabilityRation: {
      'Medium Black Soil (Regur)':
        'High Montmorillonite clay content provides exceptional moisture retention and high cation exchange capacity (CEC), ideal for deep taproot boll development during dry spells.',
      'Alluvial Loam':
        'Good drainage prevents root rot, but requires structured drip fertigation to maintain nitrogen availability during flowering.',
      default:
        'Moderate adaptability; requires monitored irrigation schedule to prevent waterlogging during seedling emergence.',
    },
    evidenceStatus: 'supported',
    citations: [
      {
        title: 'ICAR-Central Institute for Cotton Research (CICR) Advisory',
        source: 'CICR Nagpur Agro-Bulletin 2025-26',
      },
      {
        title: 'Cotton Production Technology in Vertisols',
        source: 'Mahatma Phule Krishi Vidyapeeth (MPKV), Rahuri',
      },
    ],
    typicalMissingInfo: [
      'Lab soil available nitrogen (N) and phosphorus (P2O5) index',
      'Historical bollworm pheromone trap catch counts in immediate village cluster',
    ],
  },
  {
    id: 'wheat',
    name: 'Wheat',
    scientificName: 'Triticum aestivum',
    varieties: ['GW-496 Sharbati', 'HD-2967 (Pusa)', 'PBW-550', 'HI-8759 (Purna)'],
    defaultVariety: 'GW-496 Sharbati',
    season: 'Rabi',
    durationDays: 120,
    expectedYieldTonnesPerAcre: 2.2,
    estimatedNetProfitInrPerAcre: 38000,
    waterRequirement: 'Medium',
    idealSoils: ['Alluvial Loam', 'Medium Black Soil (Regur)', 'Clay Loam'],
    color: '#6F9B55',
    soilSuitabilityRation: {
      'Alluvial Loam':
        'Optimal crumb structure and aeration promote rapid tillering and crown root initiation (CRI Stage).',
      'Medium Black Soil (Regur)':
        'Conserves residual Kharif moisture, reducing the required number of winter auxiliary irrigations from 5 to 3.',
      default:
        'Responds well with timely sowing before mid-November to escape terminal heat stress during grain filling.',
    },
    evidenceStatus: 'supported',
    citations: [
      {
        title: 'ICAR-Indian Institute of Wheat and Barley Research (IIWBR)',
        source: 'Wheat Crop Management Guidelines 2025',
      },
    ],
    typicalMissingInfo: [
      'Pre-sowing soil profile moisture percentage at 0-30 cm depth',
      'Irrigation water electrical conductivity (EC) to assess salinity risk',
    ],
  },
  {
    id: 'soybean',
    name: 'Soybean',
    scientificName: 'Glycine max',
    varieties: ['JS-335', 'NRC-37 (Ahilya-4)', 'JS-9560', 'MACS-1407'],
    defaultVariety: 'JS-335',
    season: 'Kharif',
    durationDays: 95,
    expectedYieldTonnesPerAcre: 1.0,
    estimatedNetProfitInrPerAcre: 34000,
    waterRequirement: 'Medium',
    idealSoils: ['Medium Black Soil (Regur)', 'Deep Black Soil'],
    color: '#B9784F',
    soilSuitabilityRation: {
      'Medium Black Soil (Regur)':
        'Natural Bradyrhizobium nodulation thrives in black soils with neutral to slightly alkaline pH (6.8-7.8), fixing up to 40 kg atmospheric N/acre.',
      default:
        'Requires ridge-and-furrow planting to avert water stagnation during prolonged monsoon showers.',
    },
    evidenceStatus: 'supported',
    citations: [
      {
        title: 'ICAR-Indian Institute of Soybean Research (IISR) Indore',
        source: 'Package of Practices for Soybean in Central Zone',
      },
    ],
    typicalMissingInfo: [
      'Pre-sowing Rhizobium culture seed inoculation verification',
      'Soil sulfur (S) and zinc (Zn) micronutrient laboratory report',
    ],
  },
  {
    id: 'mustard',
    name: 'Mustard (Raya)',
    scientificName: 'Brassica juncea',
    varieties: ['Pusa Bold', 'Giriraj (DRMRIJ-31)', 'RH-749', 'Kranti'],
    defaultVariety: 'Pusa Bold',
    season: 'Rabi',
    durationDays: 110,
    expectedYieldTonnesPerAcre: 1.1,
    estimatedNetProfitInrPerAcre: 39000,
    waterRequirement: 'Low',
    idealSoils: ['Alluvial Loam', 'Sandy Loam', 'Medium Black Soil (Regur)'],
    color: '#ca8a04',
    soilSuitabilityRation: {
      'Alluvial Loam':
        'Deep light loamy soil permits extensive root penetration and rapid nutrient uptake with minimal irrigation.',
      default:
        'Highly drought-hardy oilseed; excellent cash crop to follow Kharif pulses or green manuring.',
    },
    evidenceStatus: 'supported',
    citations: [
      {
        title: 'ICAR-Directorate of Rapeseed-Mustard Research (DRMR) Bharatpur',
        source: 'National Mustard Production Protocol',
      },
    ],
    typicalMissingInfo: [
      'Soil available sulfur status (crucial for glucosinolate and oil content synthesis)',
    ],
  },
  {
    id: 'kinnow',
    name: 'Kinnow Mandarin',
    scientificName: 'Citrus nobilis x Citrus deliciosa',
    varieties: ['PAU Hybrid-1', 'Punjab Kinnow Selection', 'Jaffa Cross'],
    defaultVariety: 'PAU Hybrid-1',
    season: 'Annual',
    durationDays: 365,
    expectedYieldTonnesPerAcre: 8.5,
    estimatedNetProfitInrPerAcre: 115000,
    waterRequirement: 'High',
    idealSoils: ['Alluvial Loam', 'Sandy Loam', 'Deep Well-Drained Soil'],
    color: '#B9784F',
    soilSuitabilityRation: {
      'Alluvial Loam':
        'Well-aerated subsoil profile prevents collar rot (Phytophthora) and supports vigorous rootstock anchored growth.',
      default:
        'Strictly requires soil depth > 1.8m and total absence of hard kankar pan to allow deep taproot development.',
    },
    evidenceStatus: 'supported',
    citations: [
      {
        title: 'Punjab Agricultural University (PAU) Citrus Research Station',
        source: 'Kinnow Orchard Canopy & Irrigation Compendium',
      },
    ],
    typicalMissingInfo: [
      'Subsoil calcium carbonate (CaCO3) kankar layer depth profile',
      'Borewell water boron (B) concentration test',
    ],
  },
  {
    id: 'paddy',
    name: 'Paddy (Rice)',
    scientificName: 'Oryza sativa',
    varieties: ['Sona Masoori (BPT-5204)', 'Pusa Basmati 1509', 'MTU-1010', 'IR-64'],
    defaultVariety: 'Sona Masoori (BPT-5204)',
    season: 'Kharif',
    durationDays: 135,
    expectedYieldTonnesPerAcre: 2.8,
    estimatedNetProfitInrPerAcre: 45000,
    waterRequirement: 'Very High',
    idealSoils: ['Deep Deltaic Alluvial Clay', 'Clayey Vertisols'],
    color: '#173F2B',
    soilSuitabilityRation: {
      'Deep Deltaic Alluvial Clay':
        'Heavy clay texture with low percolation rate creates ideal puddle conditions, retaining standing water without excessive seepage loss.',
      default:
        'Requires continuous irrigation or assured canal supply; alternative wetting and drying (AWD) recommended to save water.',
    },
    evidenceStatus: 'supported',
    citations: [
      {
        title: 'ICAR-National Rice Research Institute (NRRI) Cuttack',
        source: 'Precision Water & Nutrient Management in Paddy',
      },
    ],
    typicalMissingInfo: [
      'Assured seasonal canal water release schedule from local irrigation department',
    ],
  },
  {
    id: 'gram',
    name: 'Bengal Gram (Chickpea)',
    scientificName: 'Cicer arietinum',
    varieties: ['JG-11 (Desi)', 'Vishal (Phule G-12)', 'KAK-2 (Kabuli)', 'Digvijay'],
    defaultVariety: 'JG-11 (Desi)',
    season: 'Rabi',
    durationDays: 105,
    expectedYieldTonnesPerAcre: 1.1,
    estimatedNetProfitInrPerAcre: 36000,
    waterRequirement: 'Low',
    idealSoils: ['Medium Black Soil (Regur)', 'Alluvial Loam'],
    color: '#6F9B55',
    soilSuitabilityRation: {
      'Medium Black Soil (Regur)':
        'Thrives on stored sub-surface soil moisture; provides ideal partner in rotation following Kharif cotton or soybean.',
      default:
        'Sensitive to excess moisture and wilt in waterlogged pockets; needs light, timely irrigations only at pod-filling.',
    },
    evidenceStatus: 'supported',
    citations: [
      {
        title: 'ICAR-Indian Institute of Pulses Research (IIPR) Kanpur',
        source: 'Chickpea Agro-Advisory Series',
      },
    ],
    typicalMissingInfo: [
      'Recent farm field incidence history of Fusarium wilt or root rot',
    ],
  },
  {
    id: 'groundnut',
    name: 'Groundnut (Peanut)',
    scientificName: 'Arachis hypogaea',
    varieties: ['TAG-24', 'TG-37A', 'GG-20', 'Kadiri-6'],
    defaultVariety: 'TAG-24',
    season: 'Kharif',
    durationDays: 115,
    expectedYieldTonnesPerAcre: 1.3,
    estimatedNetProfitInrPerAcre: 41000,
    waterRequirement: 'Medium',
    idealSoils: ['Sandy Loam', 'Light Alluvial Loam', 'Red Sandy Loam'],
    color: '#B9784F',
    soilSuitabilityRation: {
      'Sandy Loam':
        'Friable, loose topsoil allows effortless gynophore (peg) penetration and smooth pod expansion with minimal harvesting loss.',
      default:
        'Heavy sticky clays should be avoided because peg entry is obstructed and pods detach during digging.',
    },
    evidenceStatus: 'supported',
    citations: [
      {
        title: 'ICAR-Directorate of Groundnut Research (DGR) Junagadh',
        source: 'Package of Practices for High-Yielding Peanut Cultivars',
      },
    ],
    typicalMissingInfo: ['Soil calcium availability (essential for peg filling and avoiding pops)'],
  },
];

/**
 * Returns crops matching season filter.
 */
export function getCropsBySeason(season: 'Kharif' | 'Rabi' | 'Zaid' | 'Annual'): CropMasterData[] {
  return INDIAN_CROPS_DATABASE.filter((c) => c.season === season || c.season === 'Annual');
}

/**
 * Agronomic Engine: Generates AI-recommended multi-crop portfolio based on farm characteristics.
 */
export function generateAICropRecommendations(
  farmSoil: string = 'Medium Black Soil (Regur)',
  waterSource: string = 'Drip Irrigation',
  season: 'Kharif' | 'Rabi' | 'Zaid' | 'Annual' = 'Rabi',
  totalAcreage: number = 24.5
): {
  recommendedZones: Array<{
    crop: CropMasterData;
    variety: string;
    allocatedAcres: number;
    percentage: number;
    rationale: string;
    expectedYieldTonnes: number;
    estimatedProfitInr: number;
    evidenceStatus: 'supported' | 'partial';
    missingInfo: string[];
    citations: Array<{ title: string; source: string }>;
  }>;
  overallStrategy: string;
} {
  const isBlackSoil = farmSoil.toLowerCase().includes('black') || farmSoil.toLowerCase().includes('regur');
  const isAlluvial = farmSoil.toLowerCase().includes('alluvial') || farmSoil.toLowerCase().includes('loam');
  const isDeltaic = farmSoil.toLowerCase().includes('delta') || farmSoil.toLowerCase().includes('clay');

  let chosenCrops: Array<{ cropId: string; pct: number }> = [];

  if (season === 'Kharif') {
    if (isDeltaic) {
      chosenCrops = [
        { cropId: 'paddy', pct: 0.7 },
        { cropId: 'soybean', pct: 0.3 },
      ];
    } else if (isBlackSoil) {
      chosenCrops = [
        { cropId: 'cotton', pct: 0.65 },
        { cropId: 'soybean', pct: 0.35 },
      ];
    } else {
      chosenCrops = [
        { cropId: 'cotton', pct: 0.5 },
        { cropId: 'groundnut', pct: 0.5 },
      ];
    }
  } else if (season === 'Rabi') {
    if (isBlackSoil) {
      chosenCrops = [
        { cropId: 'wheat', pct: 0.65 },
        { cropId: 'gram', pct: 0.35 },
      ];
    } else if (isAlluvial) {
      chosenCrops = [
        { cropId: 'wheat', pct: 0.6 },
        { cropId: 'mustard', pct: 0.4 },
      ];
    } else {
      chosenCrops = [
        { cropId: 'wheat', pct: 0.7 },
        { cropId: 'gram', pct: 0.3 },
      ];
    }
  } else if (season === 'Annual') {
    chosenCrops = [
      { cropId: 'kinnow', pct: 0.7 },
      { cropId: 'mustard', pct: 0.3 },
    ];
  } else {
    // Zaid
    chosenCrops = [
      { cropId: 'groundnut', pct: 0.6 },
      { cropId: 'gram', pct: 0.4 },
    ];
  }

  const recommendedZones = chosenCrops.map(({ cropId, pct }) => {
    const crop = INDIAN_CROPS_DATABASE.find((c) => c.id === cropId) || INDIAN_CROPS_DATABASE[0];
    const acres = Number((totalAcreage * pct).toFixed(2));
    const rationale =
      crop.soilSuitabilityRation[farmSoil] ||
      crop.soilSuitabilityRation.default ||
      `Optimized for ${farmSoil} under ${waterSource} infrastructure.`;

    const expectedYield = Number((acres * crop.expectedYieldTonnesPerAcre).toFixed(1));
    const profit = Math.round(acres * crop.estimatedNetProfitInrPerAcre);

    return {
      crop,
      variety: crop.defaultVariety,
      allocatedAcres: acres,
      percentage: Math.round(pct * 100),
      rationale,
      expectedYieldTonnes: expectedYield,
      estimatedProfitInr: profit,
      evidenceStatus: crop.evidenceStatus === 'supported' ? ('supported' as const) : ('partial' as const),
      missingInfo: crop.typicalMissingInfo,
      citations: crop.citations,
    };
  });

  const overallStrategy = `Evidence-based ${season} rotation for ${farmSoil}: Multi-parcel diversification balances high-margin cash crops with nitrogen-fixing companion blocks, optimizing root-zone soil moisture conservation from ${waterSource}.`;

  return { recommendedZones, overallStrategy };
}
