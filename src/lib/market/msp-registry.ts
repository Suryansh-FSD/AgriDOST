/**
 * AgriDOST 4.0: Official CACP / CCEA Minimum Support Price (MSP) Registry
 * Covers 2024-2026 Kharif, Rabi, and Commercial Crops.
 * Source: Commission for Agricultural Costs and Prices (CACP),
 * Department of Agriculture & Farmers Welfare, Ministry of Agriculture, Govt. of India.
 */

import { MSPCropRecord } from '@/types/market';

export const OFFICIAL_MSP_REGISTRY: MSPCropRecord[] = [
  {
    commodity: 'Wheat',
    variety: 'Standard / FAQ',
    hindiName: 'गेहूं (Wheat)',
    season: 'Rabi',
    mspPriceInrPerQtl: 2425, // RMS 2025-26 approved; 2024-25 was 2275
    effectiveYear: '2024-26',
    procuringAgency: 'FCI / State Civil Supplies Agencies',
    descriptionEn: 'CCEA declared MSP for Rabi Marketing Season (RMS) with ₹150 hike for 2025-26 over ₹2,275.',
    descriptionHi: 'रबी विपणन सीजन 2025-26 के लिए गेहूं का न्यूनतम समर्थन मूल्य ₹2,425/क्विंटल निर्धारित (2024-25: ₹2,275)।',
    officialSource: 'CACP, Ministry of Agriculture & Farmers Welfare, GoI',
  },
  {
    commodity: 'Paddy (Common)',
    variety: 'Common',
    hindiName: 'धान सामान्य (Paddy Common)',
    season: 'Kharif',
    mspPriceInrPerQtl: 2300, // KMS 2024-25 (up from 2183)
    effectiveYear: '2024-25',
    procuringAgency: 'FCI / State Food & Civil Supplies Corporations',
    descriptionEn: 'Kharif Marketing Season (KMS) 2024-25 MSP at ₹2,300/qtl (₹117 increase over previous season).',
    descriptionHi: 'खरीफ विपणन सीजन 2024-25 के लिए सामान्य धान का न्यूनतम समर्थन मूल्य ₹2,300/क्विंटल।',
    officialSource: 'CACP / Cabinet Committee on Economic Affairs (CCEA)',
  },
  {
    commodity: 'Paddy (Grade A)',
    variety: 'Grade A',
    hindiName: 'धान ग्रेड ए (Paddy Grade A)',
    season: 'Kharif',
    mspPriceInrPerQtl: 2320,
    effectiveYear: '2024-25',
    procuringAgency: 'FCI / State Agencies',
    descriptionEn: 'Grade A paddy MSP at ₹2,320/qtl for KMS 2024-25.',
    descriptionHi: 'ग्रेड-ए धान का न्यूनतम समर्थन मूल्य ₹2,320/क्विंटल।',
    officialSource: 'CACP, GoI',
  },
  {
    commodity: 'Gram',
    variety: 'Desi / FAQ',
    hindiName: 'चना (Gram / Chana)',
    season: 'Rabi',
    mspPriceInrPerQtl: 5650, // RMS 2025-26 (up from 5440 in 2024-25)
    effectiveYear: '2024-26',
    procuringAgency: 'NAFED / FCI under Price Support Scheme (PSS)',
    descriptionEn: 'Rabi Marketing Season 2025-26 MSP at ₹5,650/qtl (₹210 increase over ₹5,440).',
    descriptionHi: 'चना रबी सीजन 2025-26 के लिए एमएसपी ₹5,650/क्विंटल (2024-25: ₹5,440)।',
    officialSource: 'CACP / CCEA, GoI',
  },
  {
    commodity: 'Mustard',
    variety: 'Yellow / Brown Rapeseed & Mustard',
    hindiName: 'सरसों / राई (Mustard)',
    season: 'Rabi',
    mspPriceInrPerQtl: 5950, // RMS 2025-26 (up from 5650 in 2024-25)
    effectiveYear: '2024-26',
    procuringAgency: 'NAFED / Hafed / State Oilseed Federations',
    descriptionEn: 'Rabi Marketing Season 2025-26 MSP at ₹5,950/qtl (₹300 increase over ₹5,650).',
    descriptionHi: 'सरसों/राई रबी 2025-26 एमएसपी ₹5,950/क्विंटल (2024-25: ₹5,650)।',
    officialSource: 'CACP / CCEA, GoI',
  },
  {
    commodity: 'Soybean',
    variety: 'Yellow JS-335 / FAQ',
    hindiName: 'सोयाबीन पीला (Soybean Yellow)',
    season: 'Kharif',
    mspPriceInrPerQtl: 4892, // KMS 2024-25 (up from 4600)
    effectiveYear: '2024-25',
    procuringAgency: 'NAFED / State Cooperative Marketing Federations',
    descriptionEn: 'Kharif 2024-25 MSP at ₹4,892/qtl (₹292 hike over ₹4,600).',
    descriptionHi: 'सोयाबीन (पीला) खरीफ 2024-25 का न्यूनतम समर्थन मूल्य ₹4,892/क्विंटल।',
    officialSource: 'CACP / CCEA, GoI',
  },
  {
    commodity: 'Cotton (Medium Staple)',
    variety: 'Medium Staple',
    hindiName: 'कपास मध्यम रेशा (Cotton Medium Staple)',
    season: 'Kharif',
    mspPriceInrPerQtl: 7121, // KMS 2024-25 (up from 6620)
    effectiveYear: '2024-25',
    procuringAgency: 'CCI (Cotton Corporation of India) / NAFED',
    descriptionEn: 'Medium staple cotton MSP at ₹7,121/qtl (₹501 increase).',
    descriptionHi: 'कपास (मध्यम रेशा) एमएसपी ₹7,121/क्विंटल।',
    officialSource: 'CACP, GoI',
  },
  {
    commodity: 'Cotton (Long Staple)',
    variety: 'Long Staple',
    hindiName: 'कपास लंबा रेशा (Cotton Long Staple)',
    season: 'Kharif',
    mspPriceInrPerQtl: 7521, // KMS 2024-25 (up from 7020)
    effectiveYear: '2024-25',
    procuringAgency: 'CCI (Cotton Corporation of India)',
    descriptionEn: 'Long staple cotton MSP at ₹7,521/qtl (₹501 increase).',
    descriptionHi: 'कपास (लंबा रेशा) एमएसपी ₹7,521/क्विंटल।',
    officialSource: 'CACP, GoI',
  },
  {
    commodity: 'Maize',
    variety: 'Hybrid / FAQ',
    hindiName: 'मक्का (Maize / Corn)',
    season: 'Kharif',
    mspPriceInrPerQtl: 2225, // KMS 2024-25 (up from 2090)
    effectiveYear: '2024-25',
    procuringAgency: 'FCI / NAFED / State Agencies',
    descriptionEn: 'Kharif 2024-25 MSP at ₹2,225/qtl (₹135 increase).',
    descriptionHi: 'मक्का खरीफ 2024-25 एमएसपी ₹2,225/क्विंटल।',
    officialSource: 'CACP, GoI',
  },
  {
    commodity: 'Onion',
    variety: 'Nasik Red / Garwa / FAQ',
    hindiName: 'प्याज (Onion)',
    season: 'Commercial',
    mspPriceInrPerQtl: 2400, // Market Intervention Scheme (MIS) buffer baseline
    effectiveYear: '2024-25',
    procuringAgency: 'NAFED / NCCF (Price Stabilization Fund)',
    descriptionEn: 'Govt Market Intervention Scheme (MIS) and buffer procurement benchmark to prevent distress liquidation.',
    descriptionHi: 'सरकारी मूल्य स्थिरीकरण कोष (PSF) व नैफेड/एनसीसीएफ बफर खरीद बेंचमार्क दर ₹2,400/क्विंटल।',
    officialSource: 'DoCA / NAFED Buffer Procurement Guidelines',
  },
  {
    commodity: 'Tur (Arhar)',
    variety: 'Red Gram / FAQ',
    hindiName: 'तुअर / अरहर (Tur / Arhar)',
    season: 'Kharif',
    mspPriceInrPerQtl: 7550, // KMS 2024-25 (up from 7000)
    effectiveYear: '2024-25',
    procuringAgency: 'NAFED / FCI',
    descriptionEn: 'Kharif 2024-25 MSP at ₹7,550/qtl (₹550 hike).',
    descriptionHi: 'अरहर (तुअर) खरीफ 2024-25 एमएसपी ₹7,550/क्विंटल।',
    officialSource: 'CACP, GoI',
  },
  {
    commodity: 'Moong',
    variety: 'Green Gram / FAQ',
    hindiName: 'मूंग (Moong)',
    season: 'Kharif',
    mspPriceInrPerQtl: 8682, // KMS 2024-25
    effectiveYear: '2024-25',
    procuringAgency: 'NAFED / FCI',
    descriptionEn: 'Kharif 2024-25 MSP at ₹8,682/qtl (₹124 hike).',
    descriptionHi: 'मूंग खरीफ 2024-25 एमएसपी ₹8,682/क्विंटल।',
    officialSource: 'CACP, GoI',
  },
  {
    commodity: 'Urad',
    variety: 'Black Gram / FAQ',
    hindiName: 'उड़द (Urad)',
    season: 'Kharif',
    mspPriceInrPerQtl: 7400, // KMS 2024-25 (up from 6950)
    effectiveYear: '2024-25',
    procuringAgency: 'NAFED / FCI',
    descriptionEn: 'Kharif 2024-25 MSP at ₹7,400/qtl (₹450 hike).',
    descriptionHi: 'उड़द खरीफ 2024-25 एमएसपी ₹7,400/क्विंटल।',
    officialSource: 'CACP, GoI',
  },
  {
    commodity: 'Groundnut',
    variety: 'Groundnut with pod',
    hindiName: 'मूंगफली (Groundnut)',
    season: 'Kharif',
    mspPriceInrPerQtl: 6783, // KMS 2024-25
    effectiveYear: '2024-25',
    procuringAgency: 'NAFED / State Agencies',
    descriptionEn: 'Kharif 2024-25 MSP at ₹6,783/qtl (₹406 increase).',
    descriptionHi: 'मूंगफली खरीफ 2024-25 एमएसपी ₹6,783/क्विंटल।',
    officialSource: 'CACP, GoI',
  },
  {
    commodity: 'Barley',
    variety: 'FAQ',
    hindiName: 'जौ (Barley)',
    season: 'Rabi',
    mspPriceInrPerQtl: 1980, // RMS 2025-26 (up from 1850)
    effectiveYear: '2024-26',
    procuringAgency: 'FCI / State Agencies',
    descriptionEn: 'Rabi 2025-26 MSP at ₹1,980/qtl (₹130 increase over ₹1,850).',
    descriptionHi: 'जौ रबी 2025-26 एमएसपी ₹1,980/क्विंटल (2024-25: ₹1,850)।',
    officialSource: 'CACP / CCEA, GoI',
  },
  {
    commodity: 'Bajra',
    variety: 'Hybrid / FAQ',
    hindiName: 'बाजरा (Bajra / Pearl Millet)',
    season: 'Kharif',
    mspPriceInrPerQtl: 2625, // KMS 2024-25
    effectiveYear: '2024-25',
    procuringAgency: 'FCI / State Procurement Agencies',
    descriptionEn: 'Kharif 2024-25 MSP at ₹2,625/qtl (₹125 hike).',
    descriptionHi: 'बाजरा खरीफ 2024-25 एमएसपी ₹2,625/क्विंटल।',
    officialSource: 'CACP, GoI',
  },
  {
    commodity: 'Jowar (Hybrid)',
    variety: 'Hybrid',
    hindiName: 'ज्वार हाइब्रिड (Jowar Hybrid)',
    season: 'Kharif',
    mspPriceInrPerQtl: 3371, // KMS 2024-25
    effectiveYear: '2024-25',
    procuringAgency: 'FCI / State Agencies',
    descriptionEn: 'Kharif 2024-25 MSP at ₹3,371/qtl.',
    descriptionHi: 'ज्वार (हाइब्रिड) खरीफ 2024-25 एमएसपी ₹3,371/क्विंटल।',
    officialSource: 'CACP, GoI',
  },
  {
    commodity: 'Lentil (Masur)',
    variety: 'FAQ',
    hindiName: 'मसूर (Lentil / Masur)',
    season: 'Rabi',
    mspPriceInrPerQtl: 6700, // RMS 2025-26 (up from 6425)
    effectiveYear: '2024-26',
    procuringAgency: 'NAFED / FCI',
    descriptionEn: 'Rabi 2025-26 MSP at ₹6,700/qtl (₹275 hike over ₹6,425).',
    descriptionHi: 'मसूर रबी 2025-26 एमएसपी ₹6,700/क्विंटल (2024-25: ₹6,425)।',
    officialSource: 'CACP / CCEA, GoI',
  },
];

/**
 * Commodity name normalization map (English & Hindi synonyms, phonetic transliterations)
 */
const COMMODITY_ALIASES: Record<string, string> = {
  // Wheat
  wheat: 'Wheat',
  gehu: 'Wheat',
  gehun: 'Wheat',
  kanak: 'Wheat',
  gahu: 'Wheat',

  // Paddy / Rice
  paddy: 'Paddy (Common)',
  dhan: 'Paddy (Common)',
  rice: 'Paddy (Common)',
  chawal: 'Paddy (Common)',
  'paddy common': 'Paddy (Common)',
  'paddy (common)': 'Paddy (Common)',
  'paddy grade a': 'Paddy (Grade A)',
  'paddy (grade a)': 'Paddy (Grade A)',

  // Gram / Chana
  gram: 'Gram',
  chana: 'Gram',
  channa: 'Gram',
  chickpea: 'Gram',
  'bengal gram': 'Gram',
  'gram (chana)': 'Gram',
  harbhara: 'Gram',

  // Mustard
  mustard: 'Mustard',
  sarson: 'Mustard',
  sarsho: 'Mustard',
  rapeseed: 'Mustard',
  rai: 'Mustard',
  toria: 'Mustard',
  rayada: 'Mustard',

  // Soybean
  soybean: 'Soybean',
  soya: 'Soybean',
  soyabean: 'Soybean',
  'soybean yellow': 'Soybean',

  // Cotton
  cotton: 'Cotton (Medium Staple)',
  kapas: 'Cotton (Medium Staple)',
  rui: 'Cotton (Medium Staple)',
  'cotton medium': 'Cotton (Medium Staple)',
  'cotton long': 'Cotton (Long Staple)',
  'cotton (medium staple)': 'Cotton (Medium Staple)',
  'cotton (long staple)': 'Cotton (Long Staple)',

  // Maize
  maize: 'Maize',
  makka: 'Maize',
  makki: 'Maize',
  corn: 'Maize',
  bhutta: 'Maize',

  // Onion
  onion: 'Onion',
  pyaj: 'Onion',
  pyaza: 'Onion',
  kanda: 'Onion',
  dungri: 'Onion',

  // Pulses
  tur: 'Tur (Arhar)',
  arhar: 'Tur (Arhar)',
  toor: 'Tur (Arhar)',
  'red gram': 'Tur (Arhar)',
  'pigeon pea': 'Tur (Arhar)',

  moong: 'Moong',
  mung: 'Moong',
  'green gram': 'Moong',

  urad: 'Urad',
  'black gram': 'Urad',
  mash: 'Urad',

  groundnut: 'Groundnut',
  moongphali: 'Groundnut',
  mungfali: 'Groundnut',
  peanut: 'Groundnut',

  barley: 'Barley',
  jau: 'Barley',

  bajra: 'Bajra',
  'pearl millet': 'Bajra',

  jowar: 'Jowar (Hybrid)',
  sorghum: 'Jowar (Hybrid)',

  masur: 'Lentil (Masur)',
  masoor: 'Lentil (Masur)',
  lentil: 'Lentil (Masur)',
};

/**
 * Normalizes input commodity string and retrieves the official MSP record
 */
export function getMSPForCommodity(rawCommodity: string): MSPCropRecord | null {
  if (!rawCommodity || typeof rawCommodity !== 'string') return null;

  const cleaned = rawCommodity.trim().toLowerCase();

  // 1. Direct alias match
  const canonicalName = COMMODITY_ALIASES[cleaned];
  if (canonicalName) {
    const found = OFFICIAL_MSP_REGISTRY.find(
      (m) => m.commodity.toLowerCase() === canonicalName.toLowerCase()
    );
    if (found) return found;
  }

  // 2. Substring / fuzzy match across registry
  const match = OFFICIAL_MSP_REGISTRY.find((record) => {
    const comLower = record.commodity.toLowerCase();
    const hiLower = record.hindiName.toLowerCase();
    return (
      comLower.includes(cleaned) ||
      cleaned.includes(comLower) ||
      hiLower.includes(cleaned)
    );
  });

  return match || null;
}

/**
 * Returns all registered MSP records
 */
export function getAllMSPRecords(): MSPCropRecord[] {
  return [...OFFICIAL_MSP_REGISTRY];
}
