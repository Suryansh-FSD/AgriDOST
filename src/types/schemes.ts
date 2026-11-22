/**
 * AgriDOST: Government Schemes & Farmer Assistance Data Contracts
 * Version 1.0.0
 */

export type GovernmentLevel = 'central' | 'state' | 'district';

export type FarmerCategory = 
  | 'marginal'        // < 1 hectare (< 2.47 acres)
  | 'small'           // 1 to 2 hectares (2.47 to 4.94 acres)
  | 'semi_medium'     // 2 to 4 hectares (4.94 to 9.88 acres)
  | 'medium'          // 4 to 10 hectares (9.88 to 24.7 acres)
  | 'large'           // > 10 hectares (> 24.7 acres)
  | 'tenant'          // Cultivator on leased land
  | 'sharecropper'    // Shared produce agreement
  | 'women'           // Women farmers / women-headed households
  | 'sc_st'           // Scheduled Caste / Scheduled Tribe
  | 'all';            // Any farmer category

export type ActivityCategory = 
  | 'agriculture'
  | 'horticulture'
  | 'dairy'
  | 'livestock'
  | 'fisheries'
  | 'agroforestry'
  | 'organic_farming'
  | 'sericulture'
  | 'beekeeping';

export type BenefitType = 
  | 'direct_benefit_transfer'
  | 'interest_subvention'
  | 'input_subsidy'
  | 'infrastructure_grant'
  | 'crop_insurance'
  | 'pension'
  | 'solar_pump_subsidy'
  | 'mechanization_subsidy';

export type DocumentCategory = 
  | 'identity'
  | 'land_record'
  | 'bank'
  | 'caste'
  | 'crop_sowing'
  | 'quotation'
  | 'affidavit'
  | 'tenancy_proof';

export interface SchemeDocumentRequirement {
  documentId: string;
  name: string;
  category: DocumentCategory;
  mandatory: boolean;
  description: string;
  issuingAuthority: string;
  procurementMethod: string;
}

export interface SchemeEligibilityRuleSet {
  minLandAcres?: number;
  maxLandAcres?: number;
  allowedFarmerCategories?: FarmerCategory[];
  allowedOwnershipTypes?: Array<'owner' | 'tenant' | 'sharecropper'>;
  allowedStates?: string[]; // ['ALL'] or specific states like ['Maharashtra']
  allowedDistricts?: string[];
  requiredActivities?: ActivityCategory[];
  requiresAadhaarLinkedBank?: boolean;
  maxAnnualIncomeInr?: number;
  minAgeYears?: number;
  maxAgeYears?: number;
  customRules?: Array<{
    id: string;
    description: string;
    evaluationKey: string;
    expectedValue: unknown;
  }>;
}

export type ApplicationAvailability = 'open' | 'seasonal' | 'closed' | 'ongoing';
export type VerificationStatus = 'verified' | 'unverified' | 'incomplete';
export type PublicationStatus = 'published' | 'draft' | 'archived';

export interface GovernmentScheme {
  id: string;
  name: string;
  shortName: string;
  description: string;
  level: GovernmentLevel;
  department: string;
  ministry: string;
  applicableStates: string[]; // ['ALL'] or specific states
  applicableDistricts?: string[];
  beneficiaryCategories: FarmerCategory[];
  supportedActivities: ActivityCategory[];
  supportedCrops?: string[];
  eligibilityRules: SchemeEligibilityRuleSet;
  requiredDocuments: SchemeDocumentRequirement[];
  benefitType: BenefitType;
  benefitDetails: {
    summary: string;
    amountMax?: number;
    amountDescription: string;
    frequency?: 'one_time' | 'annual' | 'triannual' | 'seasonal' | 'monthly';
    unit?: string;
  };
  applicationAvailability: ApplicationAvailability;
  applicationDeadline?: string; // ISO 8601 string if officially verified
  isDeadlineVerified: boolean;
  officialInfoUrl: string;
  officialApplicationUrl: string;
  sourceName: string;
  lastVerifiedDate: string; // ISO 8601 string
  effectiveDate?: string;
  expiryDate?: string;
  version: string;
  publicationStatus: PublicationStatus;
  verificationStatus: VerificationStatus;
  faqs?: Array<{
    question: string;
    answer: string;
    officialSourceRef?: string;
  }>;
}

/**
 * Deterministic Eligibility Evaluation
 */
export interface EligibilityEvaluationInput {
  state: string;
  district?: string;
  farmerCategory: FarmerCategory;
  landHoldingAcres: number;
  ownershipType: 'owner' | 'tenant' | 'sharecropper';
  farmingActivities: ActivityCategory[];
  cropsGrown?: string[];
  irrigationSource?: string;
  annualIncomeInr?: number;
  hasAadhaarLinkedBank: boolean;
  hasKisanCreditCard?: boolean;
  ageYears?: number;
}

export type EligibilityResultStatus = 
  | 'potentially_eligible'
  | 'potentially_ineligible'
  | 'more_information_required'
  | 'official_verification_required';

export interface EligibilityEvaluationResult {
  schemeId: string;
  status: EligibilityResultStatus;
  scorePercentage: number; // 0 to 100 confidence
  reasons: string[];
  passedCriteria: string[];
  failedCriteria: string[];
  missingInformation: string[];
  disclaimer: string;
  evaluatedAt: string;
}

/**
 * Farmer Scheme Application Lifecycle Tracker
 */
export type SchemeApplicationStatus = 
  | 'draft'
  | 'preparing_documents'
  | 'ready_to_apply'
  | 'submitted'
  | 'under_review'
  | 'additional_info_required'
  | 'approved'
  | 'rejected'
  | 'closed';

export type StatusSource = 'user_reported' | 'government_verified';

export interface FarmerSchemeApplication {
  id: string;
  farmId: string;
  schemeId: string;
  status: SchemeApplicationStatus;
  statusSource: StatusSource;
  applicationReferenceNumber?: string;
  submissionDate?: string; // ISO 8601 string
  portalUrl: string;
  nextAction: string;
  notes?: string;
  documentsStatus: Record<string, 'available' | 'missing' | 'in_progress'>;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
}

/**
 * Scheme Reminders & Deadlines
 */
export type SchemeReminderType = 'deadline' | 'document' | 'followup' | 'renewal';

export interface SchemeReminder {
  id: string;
  farmId: string;
  schemeId?: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  type: SchemeReminderType;
  isCompleted: boolean;
  isVerifiedSource: boolean;
  sourceUrl?: string;
  createdAt: string;
}
