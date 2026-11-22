import { describe, it, expect } from 'vitest';
import {
  INDIAN_CROPS_DATABASE,
  getCropsBySeason,
  generateAICropRecommendations,
  CropMasterData,
} from '../src/components/planner/agronomy-rules';

describe('Agronomy & Crop Planner Engine (`agronomy-rules.ts`)', () => {
  // =========================================================================
  // 1. Supported Indian Crops Catalog (All 8 Crops)
  // =========================================================================
  describe('Indian Crops Database Catalog Integrity', () => {
    const EXPECTED_CROP_IDS = [
      'cotton',
      'wheat',
      'soybean',
      'mustard',
      'kinnow',
      'paddy',
      'gram',
      'groundnut',
    ];

    it('should contain exactly the 8 supported Indian agricultural crops', () => {
      expect(INDIAN_CROPS_DATABASE).toHaveLength(8);
      const cropIds = INDIAN_CROPS_DATABASE.map((c) => c.id);
      expect(cropIds).toEqual(EXPECTED_CROP_IDS);
    });

    it('should verify botanical/scientific names for all crops', () => {
      const scientificNames: Record<string, string> = {
        cotton: 'Gossypium hirsutum',
        wheat: 'Triticum aestivum',
        soybean: 'Glycine max',
        mustard: 'Brassica juncea',
        kinnow: 'Citrus nobilis x Citrus deliciosa',
        paddy: 'Oryza sativa',
        gram: 'Cicer arietinum',
        groundnut: 'Arachis hypogaea',
      };

      INDIAN_CROPS_DATABASE.forEach((crop) => {
        expect(crop.scientificName).toBe(scientificNames[crop.id]);
      });
    });

    it('should ensure each crop has valid agronomic parameters and positive yields/profits', () => {
      INDIAN_CROPS_DATABASE.forEach((crop) => {
        // Varieties check
        expect(Array.isArray(crop.varieties)).toBe(true);
        expect(crop.varieties.length).toBeGreaterThan(0);
        expect(crop.varieties).toContain(crop.defaultVariety);

        // Season and duration check
        expect(['Kharif', 'Rabi', 'Zaid', 'Annual']).toContain(crop.season);
        expect(crop.durationDays).toBeGreaterThan(60); // Realistic crop growth cycle

        // Economics and yield
        expect(crop.expectedYieldTonnesPerAcre).toBeGreaterThan(0);
        expect(crop.estimatedNetProfitInrPerAcre).toBeGreaterThan(0);

        // Water requirement categories
        expect(['Low', 'Medium', 'High', 'Very High']).toContain(crop.waterRequirement);

        // Soil compatibility
        expect(Array.isArray(crop.idealSoils)).toBe(true);
        expect(crop.idealSoils.length).toBeGreaterThan(0);
        expect(crop.soilSuitabilityRation).toBeDefined();

        // Hex color validation
        expect(crop.color).toMatch(/^#[0-9a-fA-F]{6}$/);

        // Evidence status
        expect(['supported', 'partial', 'insufficient_data']).toContain(crop.evidenceStatus);
      });
    });
  });

  // =========================================================================
  // 2. Institutional Citations Presence and Format Check
  // =========================================================================
  describe('Institutional Citations & Scientific Attribution', () => {
    const REQUIRED_INSTITUTES = [
      { cropId: 'cotton', code: 'CICR', fullName: 'Central Institute for Cotton Research' },
      { cropId: 'cotton', code: 'MPKV', fullName: 'Mahatma Phule Krishi Vidyapeeth' },
      { cropId: 'wheat', code: 'IIWBR', fullName: 'Indian Institute of Wheat and Barley Research' },
      { cropId: 'soybean', code: 'IISR', fullName: 'Indian Institute of Soybean Research' },
      { cropId: 'mustard', code: 'DRMR', fullName: 'Directorate of Rapeseed-Mustard Research' },
      { cropId: 'kinnow', code: 'PAU', fullName: 'Punjab Agricultural University' },
      { cropId: 'paddy', code: 'NRRI', fullName: 'National Rice Research Institute' },
      { cropId: 'gram', code: 'IIPR', fullName: 'Indian Institute of Pulses Research' },
      { cropId: 'groundnut', code: 'DGR', fullName: 'Directorate of Groundnut Research' },
    ];

    it('should verify each crop possesses non-empty citations with title and source', () => {
      INDIAN_CROPS_DATABASE.forEach((crop) => {
        expect(crop.citations.length).toBeGreaterThan(0);
        crop.citations.forEach((citation) => {
          expect(citation.title).toBeDefined();
          expect(citation.title.trim().length).toBeGreaterThan(5);
          expect(citation.source).toBeDefined();
          expect(citation.source.trim().length).toBeGreaterThan(5);
        });
      });
    });

    it('should contain verified ICAR / State Agricultural University (SAU) bodies', () => {
      REQUIRED_INSTITUTES.forEach(({ cropId, code }) => {
        const crop = INDIAN_CROPS_DATABASE.find((c) => c.id === cropId);
        expect(crop).toBeDefined();
        const hasInstitute = crop!.citations.some(
          (cit) => cit.title.includes(code) || cit.source.includes(code)
        );
        expect(hasInstitute).toBe(true);
      });
    });

    it('should properly propagate citations into recommended zones from recommendation engine', () => {
      const rec = generateAICropRecommendations('Medium Black Soil (Regur)', 'Drip', 'Kharif', 10);
      rec.recommendedZones.forEach((zone) => {
        expect(zone.citations).toBeDefined();
        expect(zone.citations.length).toBeGreaterThan(0);
        expect(zone.citations).toEqual(zone.crop.citations);
      });
    });
  });

  // =========================================================================
  // 3. Missing Field Information Warnings (Soil N/P/K, Micronutrients, Pest History)
  // =========================================================================
  describe('Agronomic Missing Information Warnings', () => {
    it('should specify diagnostic data gaps for every crop in catalog', () => {
      INDIAN_CROPS_DATABASE.forEach((crop) => {
        expect(Array.isArray(crop.typicalMissingInfo)).toBe(true);
        expect(crop.typicalMissingInfo.length).toBeGreaterThan(0);
        crop.typicalMissingInfo.forEach((item) => {
          expect(typeof item).toBe('string');
          expect(item.length).toBeGreaterThan(10);
        });
      });
    });

    it('should include specific soil fertility warnings for major crops', () => {
      const cotton = INDIAN_CROPS_DATABASE.find((c) => c.id === 'cotton')!;
      expect(cotton.typicalMissingInfo.some((info) => info.includes('nitrogen (N)') && info.includes('phosphorus'))).toBe(true);
      expect(cotton.typicalMissingInfo.some((info) => info.toLowerCase().includes('bollworm'))).toBe(true);

      const soybean = INDIAN_CROPS_DATABASE.find((c) => c.id === 'soybean')!;
      expect(soybean.typicalMissingInfo.some((info) => info.includes('Rhizobium'))).toBe(true);
      expect(soybean.typicalMissingInfo.some((info) => info.includes('sulfur') || info.includes('zinc'))).toBe(true);

      const mustard = INDIAN_CROPS_DATABASE.find((c) => c.id === 'mustard')!;
      expect(mustard.typicalMissingInfo.some((info) => info.includes('sulfur'))).toBe(true);

      const gram = INDIAN_CROPS_DATABASE.find((c) => c.id === 'gram')!;
      expect(gram.typicalMissingInfo.some((info) => info.toLowerCase().includes('fusarium wilt'))).toBe(true);

      const groundnut = INDIAN_CROPS_DATABASE.find((c) => c.id === 'groundnut')!;
      expect(groundnut.typicalMissingInfo.some((info) => info.toLowerCase().includes('calcium'))).toBe(true);
    });

    it('should propagate missing field info warnings to recommended zones in recommendation output', () => {
      const rec = generateAICropRecommendations('Medium Black Soil (Regur)', 'Drip', 'Kharif', 10);
      rec.recommendedZones.forEach((zone) => {
        expect(zone.missingInfo).toBeDefined();
        expect(zone.missingInfo.length).toBeGreaterThan(0);
        expect(zone.missingInfo).toEqual(zone.crop.typicalMissingInfo);
      });
    });
  });

  // =========================================================================
  // 4. Seasonal Crop Filtering (`getCropsBySeason`)
  // =========================================================================
  describe('Seasonal Crop Filtering (`getCropsBySeason`)', () => {
    it('should return Kharif crops and Annual crops for Kharif filter', () => {
      const kharifCrops = getCropsBySeason('Kharif');
      const ids = kharifCrops.map((c) => c.id);
      expect(ids).toContain('cotton');
      expect(ids).toContain('soybean');
      expect(ids).toContain('paddy');
      expect(ids).toContain('groundnut');
      expect(ids).toContain('kinnow'); // Annual crop is returned for any season
      expect(ids).not.toContain('wheat');
      expect(ids).not.toContain('mustard');
      expect(ids).not.toContain('gram');
    });

    it('should return Rabi crops and Annual crops for Rabi filter', () => {
      const rabiCrops = getCropsBySeason('Rabi');
      const ids = rabiCrops.map((c) => c.id);
      expect(ids).toContain('wheat');
      expect(ids).toContain('mustard');
      expect(ids).toContain('gram');
      expect(ids).toContain('kinnow'); // Annual crop included
      expect(ids).not.toContain('cotton');
      expect(ids).not.toContain('paddy');
    });

    it('should return only Annual crops for Annual filter', () => {
      const annualCrops = getCropsBySeason('Annual');
      expect(annualCrops).toHaveLength(1);
      expect(annualCrops[0].id).toBe('kinnow');
    });

    it('should discover limitation: Zaid filter returns only Annual crops due to catalog season tags', () => {
      // In INDIAN_CROPS_DATABASE, groundnut is tagged 'Kharif', so Zaid filter only matches Annual (Kinnow)
      const zaidCrops = getCropsBySeason('Zaid');
      expect(zaidCrops.map((c) => c.id)).toEqual(['kinnow']);
    });
  });

  // =========================================================================
  // 5. Soil-Dependent Recommendations (`generateAICropRecommendations`)
  // =========================================================================
  describe('Soil-Dependent Crop Recommendations', () => {
    it('should recommend Cotton (65%) and Soybean (35%) on Medium Black Soil (Regur) in Kharif', () => {
      const rec = generateAICropRecommendations('Medium Black Soil (Regur)', 'Drip Irrigation', 'Kharif', 10);
      expect(rec.recommendedZones).toHaveLength(2);

      const cottonZone = rec.recommendedZones.find((z) => z.crop.id === 'cotton')!;
      const soybeanZone = rec.recommendedZones.find((z) => z.crop.id === 'soybean')!;

      expect(cottonZone).toBeDefined();
      expect(cottonZone.percentage).toBe(65);
      expect(cottonZone.allocatedAcres).toBe(6.5);
      expect(cottonZone.rationale).toContain('Montmorillonite clay');

      expect(soybeanZone).toBeDefined();
      expect(soybeanZone.percentage).toBe(35);
      expect(soybeanZone.allocatedAcres).toBe(3.5);
      expect(soybeanZone.rationale).toContain('Bradyrhizobium');
    });

    it('should recommend Paddy (70%) and Soybean (30%) on Deep Deltaic Alluvial Clay in Kharif', () => {
      const rec = generateAICropRecommendations('Deep Deltaic Alluvial Clay', 'Canal Flow', 'Kharif', 20);
      expect(rec.recommendedZones).toHaveLength(2);

      const paddyZone = rec.recommendedZones.find((z) => z.crop.id === 'paddy')!;
      const soybeanZone = rec.recommendedZones.find((z) => z.crop.id === 'soybean')!;

      expect(paddyZone).toBeDefined();
      expect(paddyZone.percentage).toBe(70);
      expect(paddyZone.allocatedAcres).toBe(14);
      expect(paddyZone.rationale).toContain('Heavy clay texture with low percolation');

      expect(soybeanZone).toBeDefined();
      expect(soybeanZone.percentage).toBe(30);
      expect(soybeanZone.allocatedAcres).toBe(6);
    });

    it('should recommend Wheat (65%) and Gram (35%) on Black Soil in Rabi', () => {
      const rec = generateAICropRecommendations('Deep Black Soil', 'Tube Well', 'Rabi', 10);
      expect(rec.recommendedZones).toHaveLength(2);

      const wheatZone = rec.recommendedZones.find((z) => z.crop.id === 'wheat')!;
      const gramZone = rec.recommendedZones.find((z) => z.crop.id === 'gram')!;

      expect(wheatZone.percentage).toBe(65);
      expect(wheatZone.allocatedAcres).toBe(6.5);

      expect(gramZone.percentage).toBe(35);
      expect(gramZone.allocatedAcres).toBe(3.5);
    });

    it('should recommend Wheat (60%) and Mustard (40%) on Alluvial Loam in Rabi', () => {
      const rec = generateAICropRecommendations('Alluvial Loam', 'Sprinkler', 'Rabi', 10);
      expect(rec.recommendedZones).toHaveLength(2);

      const wheatZone = rec.recommendedZones.find((z) => z.crop.id === 'wheat')!;
      const mustardZone = rec.recommendedZones.find((z) => z.crop.id === 'mustard')!;

      expect(wheatZone.percentage).toBe(60);
      expect(wheatZone.allocatedAcres).toBe(6);
      expect(wheatZone.rationale).toContain('Optimal crumb structure');

      expect(mustardZone.percentage).toBe(40);
      expect(mustardZone.allocatedAcres).toBe(4);
      expect(mustardZone.rationale).toContain('Deep light loamy soil');
    });

    it('should handle soil case-insensitivity and substring matching (e.g., lowercase "regur" or uppercase "ALLUVIAL")', () => {
      const blackRec = generateAICropRecommendations('regur soil', 'Rainfed', 'Kharif', 10);
      expect(blackRec.recommendedZones[0].crop.id).toBe('cotton');

      const alluvialRec = generateAICropRecommendations('FERTILE ALLUVIAL PLAIN', 'Drip', 'Rabi', 10);
      expect(alluvialRec.recommendedZones[1].crop.id).toBe('mustard');
    });

    it('should fallback to default soil rotation when unknown soil is provided', () => {
      const redSoilRec = generateAICropRecommendations('Red Sandy Loam', 'Rainfed', 'Kharif', 10);
      expect(redSoilRec.recommendedZones).toHaveLength(2);
      expect(redSoilRec.recommendedZones[0].crop.id).toBe('cotton');
      expect(redSoilRec.recommendedZones[0].percentage).toBe(50);
      expect(redSoilRec.recommendedZones[1].crop.id).toBe('groundnut');
      expect(redSoilRec.recommendedZones[1].percentage).toBe(50);
    });
  });

  // =========================================================================
  // 6. Acreage Allocation & Percentage Invariant Checks (100% Usable Area)
  // =========================================================================
  describe('Acreage Allocation & Invariant Integrity', () => {
    const testCases: Array<{ soil: string; water: string; season: 'Kharif' | 'Rabi' | 'Zaid' | 'Annual'; acres: number }> = [
      { soil: 'Medium Black Soil (Regur)', water: 'Drip', season: 'Kharif', acres: 10 },
      { soil: 'Deep Deltaic Alluvial Clay', water: 'Canal', season: 'Kharif', acres: 25 },
      { soil: 'Sandy Loam', water: 'Tube Well', season: 'Kharif', acres: 15 },
      { soil: 'Medium Black Soil (Regur)', water: 'Sprinkler', season: 'Rabi', acres: 50 },
      { soil: 'Alluvial Loam', water: 'Drip', season: 'Rabi', acres: 100 },
      { soil: 'Sandy Desert Soil', water: 'Drip', season: 'Rabi', acres: 30 },
      { soil: 'Alluvial Loam', water: 'Canal', season: 'Annual', acres: 40 },
      { soil: 'Medium Black Soil', water: 'Tube Well', season: 'Zaid', acres: 20 },
    ];

    it.each(testCases)(
      'should ensure allocated percentages sum to exactly 100% for $season on $soil',
      ({ soil, water, season, acres }) => {
        const result = generateAICropRecommendations(soil, water, season, acres);
        const totalPercentage = result.recommendedZones.reduce((sum, zone) => sum + zone.percentage, 0);
        expect(totalPercentage).toBe(100);
      }
    );

    it('should allocate exact acreage sums for integer acreages', () => {
      const result = generateAICropRecommendations('Alluvial Loam', 'Drip', 'Rabi', 100);
      const totalAcres = result.recommendedZones.reduce((sum, zone) => sum + zone.allocatedAcres, 0);
      expect(totalAcres).toBe(100);
    });

    it('should calculate expected yield and net profit proportionally to allocated acreage', () => {
      const acres = 10;
      const rec = generateAICropRecommendations('Medium Black Soil (Regur)', 'Drip', 'Kharif', acres);

      rec.recommendedZones.forEach((zone) => {
        const expectedYield = Number((zone.allocatedAcres * zone.crop.expectedYieldTonnesPerAcre).toFixed(1));
        const expectedProfit = Math.round(zone.allocatedAcres * zone.crop.estimatedNetProfitInrPerAcre);

        expect(zone.expectedYieldTonnes).toBe(expectedYield);
        expect(zone.estimatedProfitInr).toBe(expectedProfit);
      });
    });

    it('should identify floating point rounding limitation on fractional total acreage (e.g., 24.5 acres)', () => {
      // 24.5 * 0.65 = 15.925 -> 15.93; 24.5 * 0.35 = 8.575 -> 8.58.
      // Sum = 15.93 + 8.58 = 24.51 (0.01 acre rounding offset)
      const rec = generateAICropRecommendations('Medium Black Soil (Regur)', 'Drip', 'Kharif', 24.5);
      const sumAcres = rec.recommendedZones.reduce((sum, z) => sum + z.allocatedAcres, 0);
      expect(Math.abs(sumAcres - 24.5)).toBeLessThanOrEqual(0.02);
    });
  });

  // =========================================================================
  // 7. Fallback Handling for Missing and Undefined Farm Inputs
  // =========================================================================
  describe('Fallback and Default Handling for Missing/Undefined Inputs', () => {
    it('should use sound defaults when called with no arguments', () => {
      const rec = generateAICropRecommendations();
      expect(rec.recommendedZones).toHaveLength(2);
      expect(rec.overallStrategy).toContain('Medium Black Soil (Regur)');
      expect(rec.overallStrategy).toContain('Rabi');
      expect(rec.overallStrategy).toContain('Drip Irrigation');

      // Default total acreage is 24.5
      const totalPct = rec.recommendedZones.reduce((sum, z) => sum + z.percentage, 0);
      expect(totalPct).toBe(100);
    });

    it('should gracefully handle undefined arguments by applying parameter defaults', () => {
      const rec = generateAICropRecommendations(undefined, undefined, undefined, undefined);
      expect(rec.recommendedZones).toHaveLength(2);
      expect(rec.recommendedZones[0].crop.id).toBe('wheat');
      expect(rec.recommendedZones[1].crop.id).toBe('gram');
    });

    it('should handle partial undefined parameters', () => {
      const rec = generateAICropRecommendations('Alluvial Loam', undefined, 'Kharif', 50);
      expect(rec.recommendedZones).toHaveLength(2);
      expect(rec.recommendedZones[0].crop.id).toBe('cotton');
      expect(rec.recommendedZones[1].crop.id).toBe('groundnut');
      expect(rec.overallStrategy).toContain('Alluvial Loam');
      expect(rec.overallStrategy).toContain('Drip Irrigation'); // Default water source
    });

    it('should fallback to default soil rationale when soil has no custom entry', () => {
      const rec = generateAICropRecommendations('Laterite Gravelly Soil', 'Sprinkler', 'Rabi', 10);
      rec.recommendedZones.forEach((zone) => {
        expect(zone.rationale).toBeDefined();
        expect(zone.rationale.length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // 8. Unsupported and Boundary / Edge-Case Input Handling
  // =========================================================================
  describe('Edge Cases and Input Robustness', () => {
    it('should handle zero acreage cleanly', () => {
      const rec = generateAICropRecommendations('Medium Black Soil (Regur)', 'Drip', 'Kharif', 0);
      rec.recommendedZones.forEach((zone) => {
        expect(zone.allocatedAcres).toBe(0);
        expect(zone.expectedYieldTonnes).toBe(0);
        expect(zone.estimatedProfitInr).toBe(0);
        // Percentages still remain valid proportions
        expect(zone.percentage).toBeGreaterThan(0);
      });
      const totalPct = rec.recommendedZones.reduce((sum, z) => sum + z.percentage, 0);
      expect(totalPct).toBe(100);
    });

    it('should handle large commercial acreage without overflow or precision collapse', () => {
      const largeAcreage = 10000;
      const rec = generateAICropRecommendations('Alluvial Loam', 'Canal Flow', 'Rabi', largeAcreage);
      const totalAcres = rec.recommendedZones.reduce((sum, z) => sum + z.allocatedAcres, 0);
      expect(totalAcres).toBe(largeAcreage);
      expect(rec.recommendedZones[0].estimatedProfitInr).toBeGreaterThan(1000000);
    });

    it('should discover limitation: unhandled negative acreage produces negative yield and profit without throwing', () => {
      // The current engine does not validate totalAcreage > 0
      const rec = generateAICropRecommendations('Medium Black Soil (Regur)', 'Drip', 'Kharif', -10);
      expect(rec.recommendedZones[0].allocatedAcres).toBe(-6.5);
      expect(rec.recommendedZones[0].estimatedProfitInr).toBeLessThan(0);
    });

    it('should discover limitation: invalid season falls back to Zaid branch', () => {
      // TypeScript allows any at runtime; 'Monsoon' is not in union but could come from API/JSON
      const rec = generateAICropRecommendations(
        'Medium Black Soil (Regur)',
        'Drip',
        'Monsoon' as any,
        10
      );
      // In the implementation: if season !== Kharif, Rabi, Annual -> falls into else (Zaid: groundnut 60%, gram 40%)
      expect(rec.recommendedZones[0].crop.id).toBe('groundnut');
      expect(rec.recommendedZones[1].crop.id).toBe('gram');
    });

    it('should verify Annual season allocation', () => {
      const rec = generateAICropRecommendations('Alluvial Loam', 'Drip', 'Annual', 10);
      expect(rec.recommendedZones).toHaveLength(2);
      expect(rec.recommendedZones[0].crop.id).toBe('kinnow');
      expect(rec.recommendedZones[0].percentage).toBe(70);
      expect(rec.recommendedZones[1].crop.id).toBe('mustard');
      expect(rec.recommendedZones[1].percentage).toBe(30);
    });
  });
});
