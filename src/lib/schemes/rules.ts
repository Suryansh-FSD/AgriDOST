import { z } from 'zod';
import {
  GovernmentScheme,
  FarmerCategory,
  ActivityCategory,
  EligibilityEvaluationInput,
} from '@/types';

/**
 * Zod Schemas for Deterministic Eligibility Engine
 */
export const FarmerCategoryEnum = z.enum([
  'marginal',
  'small',
  'semi_medium',
  'medium',
  'large',
  'tenant',
  'sharecropper',
  'women',
  'sc_st',
  'all',
]);

export const ActivityCategoryEnum = z.enum([
  'agriculture',
  'horticulture',
  'dairy',
  'livestock',
  'fisheries',
  'agroforestry',
  'organic_farming',
  'sericulture',
  'beekeeping',
]);

export const OwnershipTypeEnum = z.enum(['owner', 'tenant', 'sharecropper']);

export const EligibilityEvaluationInputSchema = z.object({
  state: z.string().min(1, 'State name cannot be empty'),
  district: z.string().optional(),
  farmerCategory: FarmerCategoryEnum,
  landHoldingAcres: z.number().min(0, 'Landholding acreage cannot be negative'),
  ownershipType: OwnershipTypeEnum,
  farmingActivities: z.array(ActivityCategoryEnum).min(1, 'At least one farming activity must be selected'),
  cropsGrown: z.array(z.string()).optional(),
  irrigationSource: z.string().optional(),
  annualIncomeInr: z.number().min(0).optional(),
  hasAadhaarLinkedBank: z.boolean(),
  hasKisanCreditCard: z.boolean().optional(),
  ageYears: z.number().int().min(18).max(120).optional(),
  // Extended criteria for specialized state schemes
  hasCCRC: z.boolean().optional(), // Crop Cultivator Rights Card (AP tenant farmers)
  hasTractorRC: z.boolean().optional(), // Tractor RC in farmer name (Punjab CRM)
});

export const PartialEligibilityInputSchema = EligibilityEvaluationInputSchema.partial();
export type EvaluatorInput = z.infer<typeof PartialEligibilityInputSchema>;

export const OFFICIAL_ELIGIBILITY_DISCLAIMER =
  'This eligibility evaluation is deterministic and indicative, based on self-reported farmer profile details and official scheme guidelines as of November 2026. Final eligibility, quota availability, and disbursement are subject to official portal verification and physical inspection by the respective nodal authority.';

/**
 * Derives the official Indian agricultural land classification from landholding acreage.
 * Marginal: < 1 hectare (< 2.47 acres)
 * Small: 1 to 2 hectares (2.47 to 4.94 acres)
 * Semi-medium: 2 to 4 hectares (4.94 to 9.88 acres)
 * Medium: 4 to 10 hectares (9.88 to 24.7 acres)
 * Large: > 10 hectares (> 24.7 acres)
 */
export function deriveFarmerCategory(
  acres?: number,
  ownership?: 'owner' | 'tenant' | 'sharecropper'
): FarmerCategory | undefined {
  if (ownership === 'tenant') return 'tenant';
  if (ownership === 'sharecropper') return 'sharecropper';
  if (acres === undefined || acres === null || acres < 0) return undefined;
  if (acres <= 2.47) return 'marginal';
  if (acres <= 4.94) return 'small';
  if (acres <= 9.88) return 'semi_medium';
  if (acres <= 24.7) return 'medium';
  return 'large';
}

export interface RuleEvaluationCriterion {
  id: string;
  category: 'state' | 'land' | 'ownership' | 'farmer_category' | 'aadhaar_bank' | 'activity' | 'crop' | 'income' | 'custom';
  passed: boolean | 'missing';
  description: string;
  isDisqualifying: boolean;
}

/**
 * Evaluates state geography match.
 */
export function evaluateStateRule(
  scheme: GovernmentScheme,
  input: EvaluatorInput
): RuleEvaluationCriterion {
  const isNational = scheme.applicableStates.some((s) => s.toUpperCase() === 'ALL');

  if (isNational) {
    if (input.state && input.state.trim()) {
      return {
        id: 'state_match',
        category: 'state',
        passed: true,
        description: `State verified: National scheme open to all states (Farmer located in ${input.state}).`,
        isDisqualifying: true,
      };
    }
    return {
      id: 'state_match',
      category: 'state',
      passed: true,
      description: 'State verified: National scheme open to all states in India.',
      isDisqualifying: true,
    };
  }

  // State-specific scheme
  if (!input.state || !input.state.trim()) {
    return {
      id: 'state_match',
      category: 'state',
      passed: 'missing',
      description: `State location is required to evaluate ${scheme.shortName} (applicable in: ${scheme.applicableStates.join(', ')}).`,
      isDisqualifying: true,
    };
  }

  const normalizedInputState = input.state.trim().toLowerCase();
  const matched = scheme.applicableStates.some(
    (s) => s.trim().toLowerCase() === normalizedInputState
  );

  if (matched) {
    return {
      id: 'state_match',
      category: 'state',
      passed: true,
      description: `State match verified: Farmer is located in ${input.state}, matching scheme jurisdiction.`,
      isDisqualifying: true,
    };
  }

  return {
    id: 'state_match',
    category: 'state',
    passed: false,
    description: `Geographic mismatch: ${scheme.shortName} is strictly for farmers in ${scheme.applicableStates.join(', ')}, but applicant is located in ${input.state}.`,
    isDisqualifying: true,
  };
}

/**
 * Evaluates farmer category eligibility.
 */
export function evaluateFarmerCategoryRule(
  scheme: GovernmentScheme,
  input: EvaluatorInput
): RuleEvaluationCriterion {
  const allowed = scheme.eligibilityRules.allowedFarmerCategories;
  if (!allowed || allowed.includes('all')) {
    return {
      id: 'farmer_category_match',
      category: 'farmer_category',
      passed: true,
      description: 'Farmer category: Open to all landholding and cultivator classes.',
      isDisqualifying: false,
    };
  }

  const effectiveCategory =
    input.farmerCategory || deriveFarmerCategory(input.landHoldingAcres, input.ownershipType);

  if (!effectiveCategory) {
    return {
      id: 'farmer_category_match',
      category: 'farmer_category',
      passed: 'missing',
      description: `Farmer category or landholding acreage is required (eligible: ${allowed.join(', ')}).`,
      isDisqualifying: false,
    };
  }

  if (allowed.includes(effectiveCategory)) {
    return {
      id: 'farmer_category_match',
      category: 'farmer_category',
      passed: true,
      description: `Farmer category "${effectiveCategory}" satisfies scheme eligibility.`,
      isDisqualifying: false,
    };
  }

  return {
    id: 'farmer_category_match',
    category: 'farmer_category',
    passed: false,
    description: `Farmer category "${effectiveCategory}" is not covered (eligible categories: ${allowed.join(', ')}).`,
    isDisqualifying: false,
  };
}

/**
 * Evaluates minimum and maximum landholding boundaries.
 */
export function evaluateLandholdingRule(
  scheme: GovernmentScheme,
  input: EvaluatorInput
): RuleEvaluationCriterion[] {
  const results: RuleEvaluationCriterion[] = [];
  const { minLandAcres, maxLandAcres } = scheme.eligibilityRules;

  if (minLandAcres !== undefined) {
    if (input.landHoldingAcres === undefined) {
      results.push({
        id: 'min_land_acres',
        category: 'land',
        passed: 'missing',
        description: `Landholding acreage is required (scheme requires minimum ${minLandAcres} acres).`,
        isDisqualifying: true,
      });
    } else if (input.landHoldingAcres < minLandAcres) {
      const desc =
        minLandAcres > 0 && input.landHoldingAcres === 0
          ? `Cultivable land title required: Scheme requires holding at least ${minLandAcres} acres, but applicant reported 0 acres (landless).`
          : `Landholding below minimum: Applicant has ${input.landHoldingAcres} acres, but scheme requires at least ${minLandAcres} acres.`;
      results.push({
        id: 'min_land_acres',
        category: 'land',
        passed: false,
        description: desc,
        isDisqualifying: true,
      });
    } else {
      results.push({
        id: 'min_land_acres',
        category: 'land',
        passed: true,
        description: `Landholding size (${input.landHoldingAcres} acres) satisfies minimum requirement (>= ${minLandAcres} acres).`,
        isDisqualifying: true,
      });
    }
  }

  if (maxLandAcres !== undefined) {
    if (input.landHoldingAcres === undefined) {
      results.push({
        id: 'max_land_acres',
        category: 'land',
        passed: 'missing',
        description: `Landholding acreage is required (scheme ceiling is ${maxLandAcres} acres).`,
        isDisqualifying: true,
      });
    } else if (input.landHoldingAcres > maxLandAcres) {
      results.push({
        id: 'max_land_acres',
        category: 'land',
        passed: false,
        description: `Landholding exceeds ceiling: Applicant holds ${input.landHoldingAcres} acres, exceeding scheme limit of ${maxLandAcres} acres.`,
        isDisqualifying: true,
      });
    } else {
      results.push({
        id: 'max_land_acres',
        category: 'land',
        passed: true,
        description: `Landholding size (${input.landHoldingAcres} acres) is within ceiling (<= ${maxLandAcres} acres).`,
        isDisqualifying: true,
      });
    }
  }

  return results;
}

/**
 * Evaluates ownership type (owner, tenant, sharecropper).
 */
export function evaluateOwnershipRule(
  scheme: GovernmentScheme,
  input: EvaluatorInput
): RuleEvaluationCriterion {
  const allowed = scheme.eligibilityRules.allowedOwnershipTypes;
  if (!allowed || allowed.length === 0) {
    return {
      id: 'ownership_type_match',
      category: 'ownership',
      passed: true,
      description: 'Ownership type: Open to all land tenure arrangements.',
      isDisqualifying: true,
    };
  }

  if (!input.ownershipType) {
    return {
      id: 'ownership_type_match',
      category: 'ownership',
      passed: 'missing',
      description: `Land tenure status (owner / tenant / sharecropper) is required (eligible: ${allowed.join(', ')}).`,
      isDisqualifying: true,
    };
  }

  if (allowed.includes(input.ownershipType)) {
    return {
      id: 'ownership_type_match',
      category: 'ownership',
      passed: true,
      description: `Ownership type "${input.ownershipType}" is eligible for ${scheme.shortName}.`,
      isDisqualifying: true,
    };
  }

  return {
    id: 'ownership_type_match',
    category: 'ownership',
    passed: false,
    description: `Ownership type "${input.ownershipType}" is not eligible for ${scheme.shortName} (requires: ${allowed.join(', ')}).`,
    isDisqualifying: true,
  };
}

/**
 * Evaluates Aadhaar-linked bank account requirement for DBT schemes.
 */
export function evaluateAadhaarBankRule(
  scheme: GovernmentScheme,
  input: EvaluatorInput
): RuleEvaluationCriterion {
  const requiresBank = scheme.eligibilityRules.requiresAadhaarLinkedBank;
  if (!requiresBank) {
    return {
      id: 'aadhaar_bank_match',
      category: 'aadhaar_bank',
      passed: true,
      description: 'Aadhaar bank mandate: Not required for non-cash or in-kind assistance.',
      isDisqualifying: true,
    };
  }

  if (input.hasAadhaarLinkedBank === true) {
    return {
      id: 'aadhaar_bank_match',
      category: 'aadhaar_bank',
      passed: true,
      description: 'Active Aadhaar-seeded bank account is confirmed for Direct Benefit Transfer (DBT).',
      isDisqualifying: true,
    };
  }

  if (input.hasAadhaarLinkedBank === false) {
    return {
      id: 'aadhaar_bank_match',
      category: 'aadhaar_bank',
      passed: false,
      description: 'Aadhaar-seeded bank account is mandatory for DBT transfers, but applicant does not currently have one linked.',
      isDisqualifying: true,
    };
  }

  return {
    id: 'aadhaar_bank_match',
    category: 'aadhaar_bank',
    passed: 'missing',
    description: 'Confirmation of Aadhaar-linked bank account is required for DBT transfer verification.',
    isDisqualifying: true,
  };
}

/**
 * Evaluates farming activities (agriculture, horticulture, dairy, etc.).
 */
export function evaluateActivitiesRule(
  scheme: GovernmentScheme,
  input: EvaluatorInput
): RuleEvaluationCriterion {
  const required = scheme.eligibilityRules.requiredActivities;
  if (!required || required.length === 0) {
    return {
      id: 'activity_match',
      category: 'activity',
      passed: true,
      description: 'Activities: Open to all agricultural disciplines.',
      isDisqualifying: false,
    };
  }

  if (!input.farmingActivities || input.farmingActivities.length === 0) {
    return {
      id: 'activity_match',
      category: 'activity',
      passed: 'missing',
      description: `Farming activity category is required (eligible: ${required.join(', ')}).`,
      isDisqualifying: false,
    };
  }

  const common = input.farmingActivities.filter((act) => required.includes(act));
  if (common.length > 0) {
    return {
      id: 'activity_match',
      category: 'activity',
      passed: true,
      description: `Farming activity (${common.join(', ')}) matches supported activities.`,
      isDisqualifying: false,
    };
  }

  return {
    id: 'activity_match',
    category: 'activity',
    passed: false,
    description: `Farming activities (${input.farmingActivities.join(', ')}) do not include required activities (${required.join(', ')}).`,
    isDisqualifying: false,
  };
}

/**
 * Evaluates scheme-specific crop requirements (e.g. Paddy for Punjab CRM).
 */
export function evaluateCropsRule(
  scheme: GovernmentScheme,
  input: EvaluatorInput
): RuleEvaluationCriterion | null {
  if (!scheme.supportedCrops || scheme.supportedCrops.length === 0) {
    return null;
  }

  if (scheme.id === 'pb-crop-residue-management') {
    if (!input.cropsGrown || input.cropsGrown.length === 0) {
      return {
        id: 'crop_match_crm',
        category: 'crop',
        passed: 'missing',
        description: 'Crop list is required: Punjab CRM specifically targets paddy/wheat stubble management.',
        isDisqualifying: true,
      };
    }

    const normalizedFarmerCrops = input.cropsGrown.map((c) => c.toLowerCase());
    const matchesCRM = scheme.supportedCrops.some((sc) =>
      normalizedFarmerCrops.includes(sc.toLowerCase())
    );

    if (matchesCRM) {
      return {
        id: 'crop_match_crm',
        category: 'crop',
        passed: true,
        description: `Eligible crop confirmed: Farmer cultivates ${input.cropsGrown.join(', ')} requiring stubble management.`,
        isDisqualifying: true,
      };
    }

    return {
      id: 'crop_match_crm',
      category: 'crop',
      passed: false,
      description: `Crop mismatch: Punjab CRM specifically targets paddy/wheat stubble management, but farmer cultivates ${input.cropsGrown.join(', ')}.`,
      isDisqualifying: true,
    };
  }

  if (input.cropsGrown && input.cropsGrown.length > 0) {
    const normalizedFarmerCrops = input.cropsGrown.map((c) => c.toLowerCase());
    const matches = scheme.supportedCrops.some((sc) =>
      normalizedFarmerCrops.includes(sc.toLowerCase())
    );
    if (matches) {
      return {
        id: 'crop_match',
        category: 'crop',
        passed: true,
        description: `Notified crop (${input.cropsGrown.join(', ')}) is covered under ${scheme.shortName}.`,
        isDisqualifying: false,
      };
    }
  }

  return null;
}

/**
 * Evaluates custom scheme rules such as CCRC card for AP Rythu Bharosa tenant farmers.
 */
export function evaluateCustomRules(
  scheme: GovernmentScheme,
  input: EvaluatorInput
): RuleEvaluationCriterion[] {
  const results: RuleEvaluationCriterion[] = [];

  // Andhra Pradesh Rythu Bharosa: Tenant farmers mandate CCRC card
  if (scheme.id === 'ap-rythu-bharosa') {
    const isTenant =
      input.ownershipType === 'tenant' ||
      input.ownershipType === 'sharecropper' ||
      input.farmerCategory === 'tenant';

    if (isTenant) {
      if (input.hasCCRC === true) {
        results.push({
          id: 'ap_ccrc_verified',
          category: 'custom',
          passed: true,
          description: 'Tenant documentation verified: Possesses valid Crop Cultivator Rights Card (CCRC).',
          isDisqualifying: true,
        });
      } else if (input.hasCCRC === false) {
        results.push({
          id: 'ap_ccrc_verified',
          category: 'custom',
          passed: false,
          description: 'Tenant eligibility failed: Crop Cultivator Rights Card (CCRC) is statutory mandate for tenant farmers in Andhra Pradesh.',
          isDisqualifying: true,
        });
      } else {
        results.push({
          id: 'ap_ccrc_verified',
          category: 'custom',
          passed: 'missing',
          description: 'Confirmation of Crop Cultivator Rights Card (CCRC) is required for tenant farmers under Rythu Bharosa.',
          isDisqualifying: true,
        });
      }
    }
  }

  // Annual income ceiling check if present
  if (scheme.eligibilityRules.maxAnnualIncomeInr !== undefined) {
    const limit = scheme.eligibilityRules.maxAnnualIncomeInr;
    if (input.annualIncomeInr === undefined) {
      results.push({
        id: 'income_limit',
        category: 'income',
        passed: 'missing',
        description: `Annual income is required (must not exceed ₹${limit.toLocaleString('en-IN')}).`,
        isDisqualifying: true,
      });
    } else if (input.annualIncomeInr > limit) {
      results.push({
        id: 'income_limit',
        category: 'income',
        passed: false,
        description: `Annual income (₹${input.annualIncomeInr.toLocaleString('en-IN')}) exceeds scheme limit of ₹${limit.toLocaleString('en-IN')}.`,
        isDisqualifying: true,
      });
    } else {
      results.push({
        id: 'income_limit',
        category: 'income',
        passed: true,
        description: `Annual income is within eligible limit (<= ₹${limit.toLocaleString('en-IN')}).`,
        isDisqualifying: true,
      });
    }
  }

  return results;
}
