import { describe, it, expect } from 'vitest';
import {
  getAllSchemes,
  getSchemeById,
  getSchemesByState,
  getSchemesByCategory,
  searchSchemes,
  evaluateEligibility,
  evaluateAllSchemes,
  deriveFarmerCategory,
  OFFICIAL_ELIGIBILITY_DISCLAIMER,
} from '@/lib/schemes';
import { GovernmentScheme, EligibilityEvaluationInput } from '@/types';

describe('AgriDOST: Government Schemes Intelligence & Eligibility Engine', () => {
  describe('1. Schemes Registry Verification & Integrity', () => {
    it('should register at least 8 verified government schemes', () => {
      const schemes = getAllSchemes();
      expect(schemes.length).toBeGreaterThanOrEqual(8);
    });

    it('should contain all required verified schemes by specific IDs', () => {
      const requiredIds = [
        'pm-kisan',
        'pmfby',
        'aif',
        'pm-kusum-component-b',
        'soil-health-card',
        'mh-namo-shetkari',
        'pb-crop-residue-management',
        'ap-rythu-bharosa',
      ];

      for (const id of requiredIds) {
        const scheme = getSchemeById(id);
        expect(scheme).toBeDefined();
        expect(scheme?.id).toBe(id);
      }
    });

    it('should satisfy strict metadata standards for every scheme', () => {
      const schemes = getAllSchemes();

      for (const scheme of schemes) {
        // Verification metadata
        expect(scheme.verificationStatus).toBe('verified');
        expect(typeof scheme.isDeadlineVerified).toBe('boolean');
        expect(scheme.lastVerifiedDate).toBe('2026-11-20T00:00:00.000Z');
        expect(scheme.publicationStatus).toBe('published');

        // Official URLs
        expect(scheme.officialInfoUrl).toMatch(/^https?:\/\//);
        expect(scheme.officialApplicationUrl).toMatch(/^https?:\/\//);

        // Required documents structure
        expect(scheme.requiredDocuments.length).toBeGreaterThanOrEqual(2);
        for (const doc of scheme.requiredDocuments) {
          expect(doc.documentId).toBeTruthy();
          expect(doc.name).toBeTruthy();
          expect(doc.issuingAuthority).toBeTruthy();
          expect(doc.procurementMethod).toBeTruthy();
        }
      }
    });

    it('should have valid department, ministry, and benefit details', () => {
      const pmKisan = getSchemeById('pm-kisan');
      expect(pmKisan?.ministry).toBe('Ministry of Agriculture and Farmers Welfare');
      expect(pmKisan?.benefitType).toBe('direct_benefit_transfer');
      expect(pmKisan?.benefitDetails.amountMax).toBe(6000);
      expect(pmKisan?.benefitDetails.frequency).toBe('triannual');
    });
  });

  describe('2. Registry Search & Filter Helpers', () => {
    it('getSchemeById should return scheme for valid ID and undefined for non-existent ID', () => {
      const scheme = getSchemeById('pm-kisan');
      expect(scheme?.shortName).toBe('PM-KISAN');

      const nonExistent = getSchemeById('non-existent-scheme');
      expect(nonExistent).toBeUndefined();
    });

    it('getSchemesByState should return all central schemes plus state-specific schemes', () => {
      const mhSchemes = getSchemesByState('Maharashtra');
      const mhIds = mhSchemes.map((s) => s.id);
      expect(mhIds).toContain('pm-kisan');
      expect(mhIds).toContain('pmfby');
      expect(mhIds).toContain('mh-namo-shetkari');
      expect(mhIds).not.toContain('pb-crop-residue-management');
      expect(mhIds).not.toContain('ap-rythu-bharosa');

      const pbSchemes = getSchemesByState('Punjab');
      const pbIds = pbSchemes.map((s) => s.id);
      expect(pbIds).toContain('pm-kisan');
      expect(pbIds).toContain('pb-crop-residue-management');
      expect(pbIds).not.toContain('mh-namo-shetkari');
    });

    it('getSchemesByCategory should match schemes by activity or beneficiary category', () => {
      const agriSchemes = getSchemesByCategory('agriculture');
      expect(agriSchemes.length).toBeGreaterThanOrEqual(6);

      const tenantSchemes = getSchemesByCategory('tenant');
      const tenantIds = tenantSchemes.map((s) => s.id);
      expect(tenantIds).toContain('pmfby');
      expect(tenantIds).toContain('soil-health-card');
      expect(tenantIds).toContain('ap-rythu-bharosa');
    });

    it('searchSchemes should query title, description, and keywords accurately', () => {
      const solarResults = searchSchemes('solar');
      expect(solarResults.some((s) => s.id === 'pm-kusum-component-b')).toBe(true);

      const insuranceResults = searchSchemes('insurance');
      expect(insuranceResults.some((s) => s.id === 'pmfby')).toBe(true);

      const stubbleResults = searchSchemes('stubble');
      expect(stubbleResults.some((s) => s.id === 'pb-crop-residue-management')).toBe(true);

      const emptyQueryResults = searchSchemes('');
      expect(emptyQueryResults.length).toBe(getAllSchemes().length);
    });
  });

  describe('3. PM-KISAN Deterministic Evaluation', () => {
    const pmKisan = getSchemeById('pm-kisan')!;

    it('should mark eligible owner with 2 acres in Maharashtra as potentially_eligible', () => {
      const input: Partial<EligibilityEvaluationInput> = {
        state: 'Maharashtra',
        farmerCategory: 'marginal',
        landHoldingAcres: 2.0,
        ownershipType: 'owner',
        farmingActivities: ['agriculture'],
        hasAadhaarLinkedBank: true,
      };

      const result = evaluateEligibility(pmKisan, input);

      expect(result.status).toBe('potentially_eligible');
      expect(result.scorePercentage).toBeGreaterThanOrEqual(90);
      expect(result.failedCriteria).toHaveLength(0);
      expect(result.missingInformation).toHaveLength(0);
      expect(result.passedCriteria.some((c) => c.includes('Landholding size'))).toBe(true);
      expect(result.passedCriteria.some((c) => c.includes('Active Aadhaar-seeded bank account'))).toBe(true);
      expect(result.disclaimer).toBe(OFFICIAL_ELIGIBILITY_DISCLAIMER);
    });

    it('should mark farmer with 0 acres (landless) as potentially_ineligible', () => {
      const input: Partial<EligibilityEvaluationInput> = {
        state: 'Maharashtra',
        farmerCategory: 'marginal',
        landHoldingAcres: 0, // Landless
        ownershipType: 'owner',
        farmingActivities: ['agriculture'],
        hasAadhaarLinkedBank: true,
      };

      const result = evaluateEligibility(pmKisan, input);

      expect(result.status).toBe('potentially_ineligible');
      expect(result.scorePercentage).toBeLessThan(40);
      expect(result.failedCriteria.some((c) => c.includes('Cultivable land title required') || c.includes('0 acres'))).toBe(true);
    });

    it('should mark farmer without Aadhaar-linked bank account as potentially_ineligible', () => {
      const input: Partial<EligibilityEvaluationInput> = {
        state: 'Maharashtra',
        farmerCategory: 'marginal',
        landHoldingAcres: 2.0,
        ownershipType: 'owner',
        farmingActivities: ['agriculture'],
        hasAadhaarLinkedBank: false, // Ineligible for DBT
      };

      const result = evaluateEligibility(pmKisan, input);

      expect(result.status).toBe('potentially_ineligible');
      expect(result.failedCriteria.some((c) => c.includes('Aadhaar-seeded bank account is mandatory'))).toBe(true);
    });

    it('should mark tenant farmer as potentially_ineligible for PM-KISAN', () => {
      const input: Partial<EligibilityEvaluationInput> = {
        state: 'Maharashtra',
        farmerCategory: 'tenant',
        landHoldingAcres: 2.0,
        ownershipType: 'tenant', // PM-KISAN only allows owners
        farmingActivities: ['agriculture'],
        hasAadhaarLinkedBank: true,
      };

      const result = evaluateEligibility(pmKisan, input);

      expect(result.status).toBe('potentially_ineligible');
      expect(result.failedCriteria.some((c) => c.includes('Ownership type "tenant" is not eligible'))).toBe(true);
    });
  });

  describe('4. PMFBY (Pradhan Mantri Fasal Bima Yojana) Evaluation', () => {
    const pmfby = getSchemeById('pmfby')!;

    it('should mark eligible tenant farmer cultivating crops as potentially_eligible', () => {
      const input: Partial<EligibilityEvaluationInput> = {
        state: 'Madhya Pradesh',
        farmerCategory: 'tenant',
        landHoldingAcres: 3.5,
        ownershipType: 'tenant',
        farmingActivities: ['agriculture'],
        cropsGrown: ['Wheat', 'Soybean'],
        hasAadhaarLinkedBank: true,
      };

      const result = evaluateEligibility(pmfby, input);

      expect(result.status).toBe('potentially_eligible');
      expect(result.scorePercentage).toBeGreaterThanOrEqual(90);
      expect(result.failedCriteria).toHaveLength(0);
      expect(result.passedCriteria.some((c) => c.includes('tenant'))).toBe(true);
    });

    it('should also cover sharecroppers under PMFBY', () => {
      const input: Partial<EligibilityEvaluationInput> = {
        state: 'Uttar Pradesh',
        farmerCategory: 'sharecropper',
        landHoldingAcres: 1.5,
        ownershipType: 'sharecropper',
        farmingActivities: ['agriculture'],
        cropsGrown: ['Paddy'],
        hasAadhaarLinkedBank: true,
      };

      const result = evaluateEligibility(pmfby, input);

      expect(result.status).toBe('potentially_eligible');
      expect(result.failedCriteria).toHaveLength(0);
    });
  });

  describe('5. State-Specific Schemes: Maharashtra Namo Shetkari & Punjab CRM', () => {
    const mhScheme = getSchemeById('mh-namo-shetkari')!;
    const pbScheme = getSchemeById('pb-crop-residue-management')!;

    it('Maharashtra Namo Shetkari: should accept MH farmer and reject Punjab farmer', () => {
      const mhFarmer: Partial<EligibilityEvaluationInput> = {
        state: 'Maharashtra',
        landHoldingAcres: 2.5,
        ownershipType: 'owner',
        farmingActivities: ['agriculture'],
        hasAadhaarLinkedBank: true,
      };

      const pbFarmer: Partial<EligibilityEvaluationInput> = {
        state: 'Punjab',
        landHoldingAcres: 2.5,
        ownershipType: 'owner',
        farmingActivities: ['agriculture'],
        hasAadhaarLinkedBank: true,
      };

      const mhResult = evaluateEligibility(mhScheme, mhFarmer);
      expect(mhResult.status).toBe('potentially_eligible');
      expect(mhResult.failedCriteria).toHaveLength(0);

      const pbResult = evaluateEligibility(mhScheme, pbFarmer);
      expect(pbResult.status).toBe('potentially_ineligible');
      expect(pbResult.failedCriteria.some((c) => c.includes('Geographic mismatch'))).toBe(true);
    });

    it('Punjab CRM: matches Punjab farmer cultivating paddy', () => {
      const pbPaddyFarmer = {
        state: 'Punjab',
        farmerCategory: 'small' as const,
        landHoldingAcres: 4.0,
        ownershipType: 'owner' as const,
        farmingActivities: ['agriculture' as const],
        cropsGrown: ['Paddy'],
        hasAadhaarLinkedBank: true,
      };

      const result = evaluateEligibility(pbScheme, pbPaddyFarmer);
      expect(result.status).toBe('potentially_eligible');
      expect(result.failedCriteria).toHaveLength(0);
      expect(result.passedCriteria.some((c) => c.includes('Eligible crop confirmed'))).toBe(true);
    });

    it('Punjab CRM: rejects Punjab farmer cultivating non-target crops (e.g. only Cotton)', () => {
      const pbCottonFarmer = {
        state: 'Punjab',
        farmerCategory: 'small' as const,
        landHoldingAcres: 4.0,
        ownershipType: 'owner' as const,
        farmingActivities: ['agriculture' as const],
        cropsGrown: ['Cotton'],
        hasAadhaarLinkedBank: true,
      };

      const result = evaluateEligibility(pbScheme, pbCottonFarmer);
      expect(result.status).toBe('potentially_ineligible');
      expect(result.failedCriteria.some((c) => c.includes('Crop mismatch'))).toBe(true);
    });
  });

  describe('6. Andhra Pradesh: YSR Rythu Bharosa with CCRC Card', () => {
    const apScheme = getSchemeById('ap-rythu-bharosa')!;

    it('should mark tenant farmer with valid CCRC card as potentially_eligible', () => {
      const tenantWithCCRC = {
        state: 'Andhra Pradesh',
        farmerCategory: 'tenant' as const,
        landHoldingAcres: 2.0,
        ownershipType: 'tenant' as const,
        farmingActivities: ['agriculture' as const],
        hasAadhaarLinkedBank: true,
        hasCCRC: true,
      };

      const result = evaluateEligibility(apScheme, tenantWithCCRC);

      expect(result.status).toBe('potentially_eligible');
      expect(result.failedCriteria).toHaveLength(0);
      expect(result.passedCriteria.some((c) => c.includes('Crop Cultivator Rights Card (CCRC)'))).toBe(true);
    });

    it('should mark tenant farmer without CCRC card as potentially_ineligible', () => {
      const tenantWithoutCCRC = {
        state: 'Andhra Pradesh',
        farmerCategory: 'tenant' as const,
        landHoldingAcres: 2.0,
        ownershipType: 'tenant' as const,
        farmingActivities: ['agriculture' as const],
        hasAadhaarLinkedBank: true,
        hasCCRC: false,
      };

      const result = evaluateEligibility(apScheme, tenantWithoutCCRC);

      expect(result.status).toBe('potentially_ineligible');
      expect(result.failedCriteria.some((c) => c.includes('Crop Cultivator Rights Card (CCRC)'))).toBe(true);
    });

    it('should mark owner farmer in AP as potentially_eligible without needing CCRC', () => {
      const ownerFarmer = {
        state: 'Andhra Pradesh',
        farmerCategory: 'small' as const,
        landHoldingAcres: 3.0,
        ownershipType: 'owner' as const,
        farmingActivities: ['agriculture' as const],
        hasAadhaarLinkedBank: true,
      };

      const result = evaluateEligibility(apScheme, ownerFarmer);

      expect(result.status).toBe('potentially_eligible');
      expect(result.failedCriteria).toHaveLength(0);
    });
  });

  describe('7. Missing Data Handling (No False Positives)', () => {
    const pmKisan = getSchemeById('pm-kisan')!;

    it('should return more_information_required when empty input is provided', () => {
      const result = evaluateEligibility(pmKisan, {});

      expect(result.status).toBe('more_information_required');
      expect(result.missingInformation.length).toBeGreaterThanOrEqual(2);
      expect(result.failedCriteria).toHaveLength(0);
    });

    it('should return more_information_required when only state is provided', () => {
      const result = evaluateEligibility(pmKisan, { state: 'Punjab' });

      expect(result.status).toBe('more_information_required');
      expect(result.missingInformation.some((m) => m.includes('Landholding acreage is required'))).toBe(true);
      expect(result.missingInformation.some((m) => m.includes('Land tenure status'))).toBe(true);
      expect(result.missingInformation.some((m) => m.includes('Aadhaar-linked bank account'))).toBe(true);
    });

    it('should return more_information_required if state-specific scheme is evaluated with missing state', () => {
      const mhScheme = getSchemeById('mh-namo-shetkari')!;
      const result = evaluateEligibility(mhScheme, {
        landHoldingAcres: 2.0,
        ownershipType: 'owner',
        hasAadhaarLinkedBank: true,
        farmingActivities: ['agriculture'],
      });

      expect(result.status).toBe('more_information_required');
      expect(result.missingInformation.some((m) => m.includes('State location is required'))).toBe(true);
    });
  });

  describe('8. Landholding Boundary Checks & Classification Helper', () => {
    it('deriveFarmerCategory accurately classifies Indian farm sizes', () => {
      expect(deriveFarmerCategory(1.5, 'owner')).toBe('marginal');
      expect(deriveFarmerCategory(2.47, 'owner')).toBe('marginal');
      expect(deriveFarmerCategory(3.5, 'owner')).toBe('small');
      expect(deriveFarmerCategory(4.94, 'owner')).toBe('small');
      expect(deriveFarmerCategory(7.0, 'owner')).toBe('semi_medium');
      expect(deriveFarmerCategory(15.0, 'owner')).toBe('medium');
      expect(deriveFarmerCategory(30.0, 'owner')).toBe('large');
      expect(deriveFarmerCategory(undefined, 'tenant')).toBe('tenant');
      expect(deriveFarmerCategory(undefined, 'sharecropper')).toBe('sharecropper');
    });

    it('should enforce maxLandAcres ceiling when configured on a scheme', () => {
      const syntheticScheme: GovernmentScheme = {
        ...getSchemeById('pm-kisan')!,
        id: 'small-farmer-support',
        shortName: 'Small Farmer Aid',
        eligibilityRules: {
          ...getSchemeById('pm-kisan')!.eligibilityRules,
          minLandAcres: 0.5,
          maxLandAcres: 5.0, // Cap at small farmer limit
        },
      };

      const smallFarmer = {
        state: 'Maharashtra',
        landHoldingAcres: 2.5,
        ownershipType: 'owner' as const,
        farmingActivities: ['agriculture' as const],
        hasAadhaarLinkedBank: true,
      };

      const largeFarmer = {
        state: 'Maharashtra',
        landHoldingAcres: 25.0,
        ownershipType: 'owner' as const,
        farmingActivities: ['agriculture' as const],
        hasAadhaarLinkedBank: true,
      };

      const smallResult = evaluateEligibility(syntheticScheme, smallFarmer);
      expect(smallResult.status).toBe('potentially_eligible');

      const largeResult = evaluateEligibility(syntheticScheme, largeFarmer);
      expect(largeResult.status).toBe('potentially_ineligible');
      expect(largeResult.failedCriteria.some((c) => c.includes('Landholding exceeds ceiling'))).toBe(true);
    });
  });

  describe('9. evaluateAllSchemes Batch Function', () => {
    it('evaluates all schemes and returns results ordered with eligible schemes first', () => {
      const mhOwnerInput = {
        state: 'Maharashtra',
        farmerCategory: 'marginal' as const,
        landHoldingAcres: 2.0,
        ownershipType: 'owner' as const,
        farmingActivities: ['agriculture' as const],
        cropsGrown: ['Soybean', 'Cotton'],
        hasAadhaarLinkedBank: true,
      };

      const allResults = evaluateAllSchemes(mhOwnerInput);

      expect(allResults.length).toBe(getAllSchemes().length);

      // Verify sorting: First items should be potentially_eligible
      const firstStatus = allResults[0].status;
      expect(firstStatus).toBe('potentially_eligible');

      // Maharashtra farmer should be eligible for PM-KISAN and Namo Shetkari
      const eligibleSchemeIds = allResults
        .filter((r) => r.status === 'potentially_eligible')
        .map((r) => r.schemeId);

      expect(eligibleSchemeIds).toContain('pm-kisan');
      expect(eligibleSchemeIds).toContain('mh-namo-shetkari');

      // Should be ineligible for Punjab CRM
      const pbResult = allResults.find((r) => r.schemeId === 'pb-crop-residue-management');
      expect(pbResult?.status).toBe('potentially_ineligible');
    });
  });

  describe('10. Uttar Pradesh Coverage & State-Boundary Verification', () => {
    it('evaluates an Uttar Pradesh farmer: eligible for Central schemes, rejected from other state schemes', () => {
      const upFarmerInput: Partial<EligibilityEvaluationInput> = {
        state: 'Uttar Pradesh',
        district: 'Varanasi',
        farmerCategory: 'small',
        landHoldingAcres: 3.0,
        ownershipType: 'owner',
        farmingActivities: ['agriculture'],
        cropsGrown: ['Wheat', 'Mustard'],
        hasAadhaarLinkedBank: true,
      };

      const results = evaluateAllSchemes(upFarmerInput);

      // 1. Central schemes that apply across all states including Uttar Pradesh:
      const pmKisan = results.find((r) => r.schemeId === 'pm-kisan')!;
      expect(pmKisan.status).toBe('potentially_eligible');
      expect(pmKisan.passedCriteria.some((c) => c.includes('National scheme open to all states'))).toBe(true);

      const pmfby = results.find((r) => r.schemeId === 'pmfby')!;
      expect(pmfby.status).toBe('potentially_eligible');

      const aif = results.find((r) => r.schemeId === 'aif')!;
      expect(aif.status).toBe('potentially_eligible');

      const shc = results.find((r) => r.schemeId === 'soil-health-card')!;
      expect(shc.status).toBe('potentially_eligible');

      // 2. State-specific schemes from other states MUST be marked potentially_ineligible:
      const mhNamo = results.find((r) => r.schemeId === 'mh-namo-shetkari')!;
      expect(mhNamo.status).toBe('potentially_ineligible');
      expect(mhNamo.failedCriteria.some((c) => c.includes('Geographic mismatch'))).toBe(true);

      const pbCrm = results.find((r) => r.schemeId === 'pb-crop-residue-management')!;
      expect(pbCrm.status).toBe('potentially_ineligible');
      expect(pbCrm.failedCriteria.some((c) => c.includes('Geographic mismatch'))).toBe(true);

      const apRythu = results.find((r) => r.schemeId === 'ap-rythu-bharosa')!;
      expect(apRythu.status).toBe('potentially_ineligible');
      expect(apRythu.failedCriteria.some((c) => c.includes('Geographic mismatch'))).toBe(true);
    });
  });
});
