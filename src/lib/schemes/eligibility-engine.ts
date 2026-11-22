import {
  GovernmentScheme,
  EligibilityEvaluationInput,
  EligibilityEvaluationResult,
  EligibilityResultStatus,
} from '@/types';
import { getAllSchemes, getSchemeById } from './registry';
import {
  PartialEligibilityInputSchema,
  EvaluatorInput,
  RuleEvaluationCriterion,
  evaluateStateRule,
  evaluateFarmerCategoryRule,
  evaluateLandholdingRule,
  evaluateOwnershipRule,
  evaluateAadhaarBankRule,
  evaluateActivitiesRule,
  evaluateCropsRule,
  evaluateCustomRules,
  OFFICIAL_ELIGIBILITY_DISCLAIMER,
} from './rules';

/**
 * Deterministically evaluates a farmer's eligibility against a specific government scheme.
 * Operates purely on rules and validated parameters without calling external LLMs.
 *
 * @param schemeOrId The government scheme object or its unique string ID
 * @param input Farmer profile attributes (can be partial)
 * @returns Deterministic EligibilityEvaluationResult
 */
export function evaluateEligibility(
  schemeOrId: GovernmentScheme | string,
  input: Partial<EligibilityEvaluationInput> & { hasCCRC?: boolean; hasTractorRC?: boolean }
): EligibilityEvaluationResult {
  const evaluatedAt = new Date().toISOString();

  // Resolve scheme if an ID string was provided
  const scheme = typeof schemeOrId === 'string' ? getSchemeById(schemeOrId) : schemeOrId;
  if (!scheme) {
    const missingId = typeof schemeOrId === 'string' ? schemeOrId : 'unknown';
    return {
      schemeId: missingId,
      status: 'more_information_required',
      scorePercentage: 0,
      reasons: [`Scheme definition not found for ID "${missingId}".`],
      passedCriteria: [],
      failedCriteria: [`Scheme "${missingId}" is not present in the verified schemes registry.`],
      missingInformation: ['Valid registered scheme reference'],
      disclaimer: OFFICIAL_ELIGIBILITY_DISCLAIMER,
      evaluatedAt,
    };
  }

  // 1. Zod input parsing & sanitization
  const parseResult = PartialEligibilityInputSchema.safeParse(input);
  const validatedInput: EvaluatorInput = parseResult.success
    ? parseResult.data
    : (input as EvaluatorInput);

  // 2. Evaluate all deterministic rules
  const criteria: RuleEvaluationCriterion[] = [];

  // State geography check
  criteria.push(evaluateStateRule(scheme, validatedInput));

  // Farmer category check
  criteria.push(evaluateFarmerCategoryRule(scheme, validatedInput));

  // Landholding acreage checks (min and max)
  criteria.push(...evaluateLandholdingRule(scheme, validatedInput));

  // Land ownership tenure check
  criteria.push(evaluateOwnershipRule(scheme, validatedInput));

  // Aadhaar-seeded bank account for DBT
  criteria.push(evaluateAadhaarBankRule(scheme, validatedInput));

  // Agricultural activity check
  criteria.push(evaluateActivitiesRule(scheme, validatedInput));

  // Crop-specific check if applicable
  const cropCriterion = evaluateCropsRule(scheme, validatedInput);
  if (cropCriterion) {
    criteria.push(cropCriterion);
  }

  // Custom scheme rules (e.g. CCRC for AP tenants, income ceilings)
  criteria.push(...evaluateCustomRules(scheme, validatedInput));

  // 3. Aggregate results
  const passedCriteria: string[] = [];
  const failedCriteria: string[] = [];
  const missingInformation: string[] = [];

  for (const crit of criteria) {
    if (crit.passed === true) {
      passedCriteria.push(crit.description);
    } else if (crit.passed === false) {
      failedCriteria.push(crit.description);
    } else if (crit.passed === 'missing') {
      missingInformation.push(crit.description);
    }
  }

  // 4. Determine status and score deterministically
  let status: EligibilityResultStatus;
  let scorePercentage: number;
  const reasons: string[] = [];

  const totalCriteriaCount = criteria.length;

  if (failedCriteria.length > 0) {
    // Hard disqualification: At least one mandatory criterion failed
    status = 'potentially_ineligible';
    // Score reflects proportional partial match but capped below 40%
    const ratio = totalCriteriaCount > 0 ? passedCriteria.length / totalCriteriaCount : 0;
    scorePercentage = Math.max(0, Math.min(35, Math.round(ratio * 35)));

    reasons.push(
      `Ineligible: Does not satisfy ${failedCriteria.length} mandatory requirement(s) for ${scheme.shortName}.`
    );
    for (const fail of failedCriteria) {
      reasons.push(`• ${fail}`);
    }
    if (missingInformation.length > 0) {
      reasons.push(
        `Note: ${missingInformation.length} additional profile parameter(s) could not be evaluated.`
      );
    }
  } else if (missingInformation.length > 0) {
    // Missing critical parameters: Cannot confirm eligibility
    status = 'more_information_required';
    const ratio = totalCriteriaCount > 0 ? passedCriteria.length / totalCriteriaCount : 0;
    scorePercentage = Math.round(ratio * 70);

    reasons.push(
      `More information required: ${missingInformation.length} profile parameter(s) missing to verify eligibility for ${scheme.shortName}.`
    );
    for (const missing of missingInformation) {
      reasons.push(`• Required: ${missing}`);
    }
    if (passedCriteria.length > 0) {
      reasons.push(`• Currently satisfied: ${passedCriteria.length} parameter(s) verified.`);
    }
  } else {
    // All criteria evaluated and passed without failures or missing data!
    status = 'potentially_eligible';
    scorePercentage = 95;

    reasons.push(`Eligible: Meets all eligibility criteria for ${scheme.name}.`);
    reasons.push(`• Benefit: ${scheme.benefitDetails.summary}`);
    reasons.push(
      `• Next Step: Submit application on official portal: ${scheme.officialApplicationUrl}`
    );

    // List required mandatory documents for farmer preparation
    const mandatoryDocs = scheme.requiredDocuments.filter((d) => d.mandatory);
    if (mandatoryDocs.length > 0) {
      reasons.push(
        `• Mandatory documents to prepare: ${mandatoryDocs.map((d) => d.name).join(', ')}`
      );
    }
  }

  return {
    schemeId: scheme.id,
    status,
    scorePercentage,
    reasons,
    passedCriteria,
    failedCriteria,
    missingInformation,
    disclaimer: OFFICIAL_ELIGIBILITY_DISCLAIMER,
    evaluatedAt,
  };
}

/**
 * Evaluates farmer eligibility across all registered schemes.
 * Sorts results: potentially_eligible first (descending score), followed by
 * official_verification_required, more_information_required, and potentially_ineligible.
 *
 * @param input Farmer profile attributes (can be partial)
 * @returns Array of EligibilityEvaluationResult for all schemes
 */
export function evaluateAllSchemes(
  input: Partial<EligibilityEvaluationInput> & { hasCCRC?: boolean; hasTractorRC?: boolean }
): EligibilityEvaluationResult[] {
  const schemes = getAllSchemes();
  const results = schemes.map((scheme) => evaluateEligibility(scheme, input));

  const statusPriority: Record<EligibilityResultStatus, number> = {
    potentially_eligible: 1,
    official_verification_required: 2,
    more_information_required: 3,
    potentially_ineligible: 4,
  };

  return results.sort((a, b) => {
    const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    return b.scorePercentage - a.scorePercentage;
  });
}
