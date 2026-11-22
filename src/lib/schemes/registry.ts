import {
  GovernmentScheme,
  ActivityCategory,
  FarmerCategory,
} from '@/types';

/**
 * AgriDOST Verified Government Schemes Registry
 * All schemes listed here have been independently verified against official Indian government portals
 * as of November 2026.
 */
export const VERIFIED_SCHEMES_REGISTRY: GovernmentScheme[] = [
  // 1. PM-KISAN (Central)
  {
    id: 'pm-kisan',
    name: 'Pradhan Mantri Kisan Samman Nidhi',
    shortName: 'PM-KISAN',
    description:
      'Central Sector scheme providing income support of ₹6,000 per year in three equal installments of ₹2,000 every four months directly into Aadhaar-seeded bank accounts of all landholding farmer families across India, subject to exclusion criteria.',
    level: 'central',
    department: 'Department of Agriculture and Farmers Welfare (DA&FW)',
    ministry: 'Ministry of Agriculture and Farmers Welfare',
    applicableStates: ['ALL'],
    beneficiaryCategories: ['marginal', 'small', 'semi_medium', 'medium', 'large'],
    supportedActivities: ['agriculture', 'horticulture'],
    eligibilityRules: {
      minLandAcres: 0.01, // Must hold cultivable land in their own/family name
      allowedFarmerCategories: ['marginal', 'small', 'semi_medium', 'medium', 'large'],
      allowedOwnershipTypes: ['owner'],
      allowedStates: ['ALL'],
      requiresAadhaarLinkedBank: true,
      requiredActivities: ['agriculture', 'horticulture'],
      customRules: [
        {
          id: 'land_ownership_title',
          description: 'Applicant must have cultivable land recorded in their name in State Land Revenue records.',
          evaluationKey: 'ownershipType',
          expectedValue: 'owner',
        },
      ],
    },
    requiredDocuments: [
      {
        documentId: 'pmk-aadhaar',
        name: 'Aadhaar Card',
        category: 'identity',
        mandatory: true,
        description: 'Mandatory unique identification for Aadhaar Payment Bridge (APB) direct transfer.',
        issuingAuthority: 'Unique Identification Authority of India (UIDAI)',
        procurementMethod: 'Download e-Aadhaar from myaadhaar.uidai.gov.in or present physical Aadhaar card.',
      },
      {
        documentId: 'pmk-land-record',
        name: 'Land Ownership Record (Khatauni / 7-12 / Jamabandi / RoR)',
        category: 'land_record',
        mandatory: true,
        description: 'Updated Record of Rights proving cultivable land title in the applicant’s name.',
        issuingAuthority: 'State Revenue / Land Records Department (Tehsil / Taluk Office)',
        procurementMethod: 'Obtain digital certified copy from state revenue portal (e.g. Mahabhumi, Bhulekh, BanglarBhumi) or CSC.',
      },
      {
        documentId: 'pmk-bank-passbook',
        name: 'Bank Account Passbook / Cancelled Cheque (Aadhaar Seeded)',
        category: 'bank',
        mandatory: true,
        description: 'Active savings account seeded with Aadhaar and mapped with NPCI mapper for DBT.',
        issuingAuthority: 'Scheduled Commercial / Regional Rural / Cooperative Bank',
        procurementMethod: 'Submit Aadhaar seeding mandate at bank home branch or verify status via NPCI / bank portal.',
      },
    ],
    benefitType: 'direct_benefit_transfer',
    benefitDetails: {
      summary: '₹6,000 per year transferred in 3 tranches of ₹2,000 every 4 months directly to Aadhaar-seeded bank account.',
      amountMax: 6000,
      amountDescription: '₹6,000 per year (₹2,000 every 4 months)',
      frequency: 'triannual',
      unit: 'INR/year',
    },
    applicationAvailability: 'ongoing',
    isDeadlineVerified: true,
    officialInfoUrl: 'https://pmkisan.gov.in/',
    officialApplicationUrl: 'https://pmkisan.gov.in/RegistrationFormNew.aspx',
    sourceName: 'Ministry of Agriculture & Farmers Welfare, Government of India',
    lastVerifiedDate: '2026-11-20T00:00:00.000Z',
    version: '2026.1',
    publicationStatus: 'published',
    verificationStatus: 'verified',
    faqs: [
      {
        question: 'Are tenant farmers or sharecroppers eligible for PM-KISAN?',
        answer: 'No. As per PM-KISAN guidelines, only farmer families holding cultivable land titles in their own names are eligible.',
        officialSourceRef: 'https://pmkisan.gov.in/FAQ.aspx',
      },
      {
        question: 'Is e-KYC mandatory for receiving PM-KISAN installments?',
        answer: 'Yes, OTP-based e-KYC on the PM-KISAN portal or biometric e-KYC at CSC centers is mandatory.',
        officialSourceRef: 'https://pmkisan.gov.in/',
      },
    ],
  },

  // 2. PMFBY (Pradhan Mantri Fasal Bima Yojana)
  {
    id: 'pmfby',
    name: 'Pradhan Mantri Fasal Bima Yojana',
    shortName: 'PMFBY',
    description:
      'National crop insurance scheme providing comprehensive financial support to farmers suffering crop loss or damage arising from non-preventable natural perils (flood, drought, pests, post-harvest unseasonal rain). Premiums are heavily subsidized: 2% for Kharif, 1.5% for Rabi food and oilseed crops, and 5% for commercial/horticultural crops.',
    level: 'central',
    department: 'Department of Agriculture and Farmers Welfare',
    ministry: 'Ministry of Agriculture and Farmers Welfare',
    applicableStates: ['ALL'],
    beneficiaryCategories: ['all', 'marginal', 'small', 'semi_medium', 'medium', 'large', 'tenant', 'sharecropper'],
    supportedActivities: ['agriculture', 'horticulture'],
    supportedCrops: ['Paddy', 'Wheat', 'Maize', 'Soybean', 'Cotton', 'Pulses', 'Oilseeds', 'Sugarcane', 'Groundnut', 'Mustard'],
    eligibilityRules: {
      minLandAcres: 0.01,
      allowedFarmerCategories: ['all', 'marginal', 'small', 'semi_medium', 'medium', 'large', 'tenant', 'sharecropper'],
      allowedOwnershipTypes: ['owner', 'tenant', 'sharecropper'],
      allowedStates: ['ALL'],
      requiresAadhaarLinkedBank: true,
      requiredActivities: ['agriculture', 'horticulture'],
    },
    requiredDocuments: [
      {
        documentId: 'pmfby-aadhaar',
        name: 'Aadhaar Card',
        category: 'identity',
        mandatory: true,
        description: 'Government photo identification for authenticating farmer registration.',
        issuingAuthority: 'UIDAI',
        procurementMethod: 'Online download or physical copy.',
      },
      {
        documentId: 'pmfby-land-possession',
        name: 'Land Record / Tenancy Agreement / CCRC',
        category: 'land_record',
        mandatory: true,
        description: 'RoR/Khatauni for landholders, or certified tenancy agreement / CCRC / sowing declaration for tenant farmers.',
        issuingAuthority: 'State Revenue Department / Gram Panchayat',
        procurementMethod: 'Revenue portal for owners, or registered village head/VRO tenancy certificate for tenant farmers.',
      },
      {
        documentId: 'pmfby-crop-sowing',
        name: 'Crop Sowing Certificate / Self-Declaration',
        category: 'crop_sowing',
        mandatory: true,
        description: 'Official certificate or self-declaration confirming sowing of notified crop in the current season.',
        issuingAuthority: 'Village Agriculture Officer / Patwari / Self Declaration',
        procurementMethod: 'Issued by village agricultural officer or uploaded via PMFBY farmer portal.',
      },
      {
        documentId: 'pmfby-bank-details',
        name: 'Bank Passbook / Account Statement',
        category: 'bank',
        mandatory: true,
        description: 'Bank passbook copy with clear account number and IFSC code for claim settlement.',
        issuingAuthority: 'Commercial / Regional Rural / Cooperative Bank',
        procurementMethod: 'Obtained from bank branch.',
      },
    ],
    benefitType: 'crop_insurance',
    benefitDetails: {
      summary: 'Comprehensive yield loss, localized calamity, and post-harvest risk insurance with premium capped at 1.5% to 2.0% for food grains.',
      amountDescription: 'Sum insured based on district scale of finance; farmer pays only 1.5% (Rabi), 2.0% (Kharif), or 5% (Commercial/Horticultural)',
      frequency: 'seasonal',
    },
    applicationAvailability: 'seasonal',
    isDeadlineVerified: true,
    officialInfoUrl: 'https://pmfby.gov.in/',
    officialApplicationUrl: 'https://pmfby.gov.in/farmerRegistrationForm',
    sourceName: 'Department of Agriculture and Farmers Welfare, GoI',
    lastVerifiedDate: '2026-11-20T00:00:00.000Z',
    version: '2026.1',
    publicationStatus: 'published',
    verificationStatus: 'verified',
    faqs: [
      {
        question: 'Can tenant farmers insure their crops under PMFBY?',
        answer: 'Yes. Tenant farmers and sharecroppers are fully eligible provided they submit a sowing certificate or tenancy agreement recognized by the state.',
        officialSourceRef: 'https://pmfby.gov.in/',
      },
    ],
  },

  // 3. AIF (Agriculture Infrastructure Fund)
  {
    id: 'aif',
    name: 'Agriculture Infrastructure Fund',
    shortName: 'AIF',
    description:
      'Pan-India financing facility providing medium to long term debt financing for investment in viable projects for post-harvest management infrastructure and community farming assets. Offers 3% per annum interest subvention up to a loan limit of ₹2 Crore for a maximum tenure of 7 years, along with CGTMSE credit guarantee coverage.',
    level: 'central',
    department: 'Department of Agriculture and Farmers Welfare',
    ministry: 'Ministry of Agriculture and Farmers Welfare',
    applicableStates: ['ALL'],
    beneficiaryCategories: ['all', 'marginal', 'small', 'semi_medium', 'medium', 'large'],
    supportedActivities: ['agriculture', 'horticulture', 'dairy', 'agroforestry'],
    eligibilityRules: {
      allowedFarmerCategories: ['all', 'marginal', 'small', 'semi_medium', 'medium', 'large'],
      allowedOwnershipTypes: ['owner', 'tenant'],
      allowedStates: ['ALL'],
      requiresAadhaarLinkedBank: true,
      requiredActivities: ['agriculture', 'horticulture', 'dairy', 'agroforestry'],
    },
    requiredDocuments: [
      {
        documentId: 'aif-dpr',
        name: 'Detailed Project Report (DPR)',
        category: 'quotation',
        mandatory: true,
        description: 'Comprehensive techno-economic feasibility study and financial model of the post-harvest/agri-infra project.',
        issuingAuthority: 'Chartered Engineer / Certified Agri-Consultant / NABARD Consultant',
        procurementMethod: 'Commission through a qualified agricultural consultant or chartered accountant.',
      },
      {
        documentId: 'aif-land-record',
        name: 'Land Ownership Document / Registered Lease Agreement (Min 10 years)',
        category: 'land_record',
        mandatory: true,
        description: 'Title deed or registered long-term lease agreement for the project site.',
        issuingAuthority: 'Sub-Registrar Office / Revenue Department',
        procurementMethod: 'Registered deed from local revenue/sub-registrar office.',
      },
      {
        documentId: 'aif-pan-aadhaar',
        name: 'Promoter KYC (PAN & Aadhaar)',
        category: 'identity',
        mandatory: true,
        description: 'Identity and tax proofs for applicant enterprise or farmer promoters.',
        issuingAuthority: 'Income Tax Department & UIDAI',
        procurementMethod: 'National identity and tax portals.',
      },
      {
        documentId: 'aif-bank-sanction',
        name: 'In-Principle Bank Sanction Letter',
        category: 'bank',
        mandatory: true,
        description: 'Approval letter from a participating lending institution under AIF.',
        issuingAuthority: 'Scheduled Commercial Bank / Cooperative Bank / RRB',
        procurementMethod: 'Apply through AIF single-window portal and secure bank in-principle sanction.',
      },
    ],
    benefitType: 'interest_subvention',
    benefitDetails: {
      summary: '3% per annum interest subvention on bank term loans up to ₹2 Crore for up to 7 years, with CGTMSE credit guarantee coverage.',
      amountMax: 20000000,
      amountDescription: '3% annual interest subvention on term loans up to ₹2 Crore for 7 years',
      frequency: 'annual',
      unit: 'INR',
    },
    applicationAvailability: 'open',
    isDeadlineVerified: true,
    officialInfoUrl: 'https://agriinfra.dac.gov.in/',
    officialApplicationUrl: 'https://agriinfra.dac.gov.in/Home/BeneficiaryRegistration',
    sourceName: 'Department of Agriculture & Farmers Welfare, GoI',
    lastVerifiedDate: '2026-11-20T00:00:00.000Z',
    version: '2026.1',
    publicationStatus: 'published',
    verificationStatus: 'verified',
  },

  // 4. PM-KUSUM (Component B - Solar Agriculture Pumps)
  {
    id: 'pm-kusum-component-b',
    name: 'PM-KUSUM Component B: Standalone Solar Agriculture Pumps',
    shortName: 'PM-KUSUM (Component B)',
    description:
      'Central and State co-funded scheme providing 60% capital subsidy (30% Central MNRE + 30% State nodal agency) for individual farmers to install standalone solar agriculture pumps up to 7.5 HP in off-grid or diesel-pump reliant areas. The farmer contributes 40% (or 10% self-contribution + 30% bank loan).',
    level: 'central',
    department: 'Ministry of New and Renewable Energy (MNRE)',
    ministry: 'Ministry of New and Renewable Energy',
    applicableStates: ['ALL'],
    beneficiaryCategories: ['all', 'marginal', 'small', 'semi_medium', 'medium', 'large'],
    supportedActivities: ['agriculture', 'horticulture'],
    eligibilityRules: {
      minLandAcres: 0.5,
      allowedFarmerCategories: ['all', 'marginal', 'small', 'semi_medium', 'medium', 'large'],
      allowedOwnershipTypes: ['owner', 'tenant'],
      allowedStates: ['ALL'],
      requiresAadhaarLinkedBank: true,
      requiredActivities: ['agriculture', 'horticulture'],
      customRules: [
        {
          id: 'water_source_readiness',
          description: 'Applicant must have an available water source (borewell, open well, farm pond) ready for pump installation.',
          evaluationKey: 'irrigationSource',
          expectedValue: 'available',
        },
      ],
    },
    requiredDocuments: [
      {
        documentId: 'kusum-aadhaar',
        name: 'Aadhaar Card',
        category: 'identity',
        mandatory: true,
        description: 'Identity verification for capital subsidy disbursal.',
        issuingAuthority: 'UIDAI',
        procurementMethod: 'Online download or physical card.',
      },
      {
        documentId: 'kusum-land-record',
        name: 'Land Record (7/12 / Khatauni / Jamabandi)',
        category: 'land_record',
        mandatory: true,
        description: 'Proof of land possession and location where solar pump will be erected.',
        issuingAuthority: 'State Revenue Department',
        procurementMethod: 'Online state land portal or revenue office.',
      },
      {
        documentId: 'kusum-water-source',
        name: 'Water Source Availability Certificate / Self-Declaration',
        category: 'affidavit',
        mandatory: true,
        description: 'Confirmation that an open well, borewell, or water reservoir exists on the parcel.',
        issuingAuthority: 'Gram Panchayat / Minor Irrigation Department / Self Declaration',
        procurementMethod: 'Self-declaration with geo-tagged photograph or Panchayat certification.',
      },
      {
        documentId: 'kusum-bank-passbook',
        name: 'Bank Passbook / Cancelled Cheque',
        category: 'bank',
        mandatory: true,
        description: 'Bank details for farmer share financing and subsidy settlement.',
        issuingAuthority: 'Commercial / Cooperative Bank',
        procurementMethod: 'Obtained from bank branch.',
      },
    ],
    benefitType: 'solar_pump_subsidy',
    benefitDetails: {
      summary: '60% subsidy (30% Central MNRE + 30% State Govt) on benchmark cost of solar water pump up to 7.5 HP.',
      amountDescription: '60% capital subsidy on benchmark pump cost; farmer contributes 40% (or 10% + 30% bank loan)',
      frequency: 'one_time',
      unit: 'subsidy_percentage',
    },
    applicationAvailability: 'open',
    isDeadlineVerified: true,
    officialInfoUrl: 'https://pmkusum.mnre.gov.in/',
    officialApplicationUrl: 'https://www.myscheme.gov.in/schemes/pm-kusum-component-b',
    sourceName: 'Ministry of New and Renewable Energy & myScheme',
    lastVerifiedDate: '2026-11-20T00:00:00.000Z',
    version: '2026.1',
    publicationStatus: 'published',
    verificationStatus: 'verified',
  },

  // 5. Soil Health Card Scheme (SHC)
  {
    id: 'soil-health-card',
    name: 'Soil Health Card Scheme',
    shortName: 'Soil Health Card (SHC)',
    description:
      'National scheme providing all farmers with customized soil health cards every 2 years. Features 100% free chemical testing for 12 essential soil parameters (Macro: N, P, K; Secondary: S; Micro: Zn, Fe, Cu, Mn, Bo; Physical: pH, EC, OC) along with customized crop-wise fertilizer dosage recommendations to restore soil vitality and lower input costs.',
    level: 'central',
    department: 'Integrated Nutrient Management Division',
    ministry: 'Ministry of Agriculture and Farmers Welfare',
    applicableStates: ['ALL'],
    beneficiaryCategories: ['all', 'marginal', 'small', 'semi_medium', 'medium', 'large', 'tenant', 'sharecropper'],
    supportedActivities: ['agriculture', 'horticulture', 'organic_farming'],
    eligibilityRules: {
      minLandAcres: 0.01,
      allowedFarmerCategories: ['all', 'marginal', 'small', 'semi_medium', 'medium', 'large', 'tenant', 'sharecropper'],
      allowedOwnershipTypes: ['owner', 'tenant', 'sharecropper'],
      allowedStates: ['ALL'],
      requiresAadhaarLinkedBank: false, // Laboratory testing and advisory card are provided completely free of cost
      requiredActivities: ['agriculture', 'horticulture', 'organic_farming'],
    },
    requiredDocuments: [
      {
        documentId: 'shc-aadhaar',
        name: 'Aadhaar Card / Farmer Photo ID',
        category: 'identity',
        mandatory: true,
        description: 'Photo identification for farmer profile registration in the Soil Health portal.',
        issuingAuthority: 'UIDAI / Election Commission of India',
        procurementMethod: 'Online or physical ID copy.',
      },
      {
        documentId: 'shc-land-khasra',
        name: 'Land Survey / Khasra / Dag Details',
        category: 'land_record',
        mandatory: true,
        description: 'Identification of farm plot for geo-referenced soil sample collection.',
        issuingAuthority: 'Revenue Department / Self-Reported',
        procurementMethod: 'Extract survey number from land record or patwari receipt.',
      },
    ],
    benefitType: 'input_subsidy',
    benefitDetails: {
      summary: '100% free soil sample testing across 12 nutrient indicators and customized soil advisory card issued every 2 years.',
      amountDescription: 'Free of cost comprehensive soil nutrient analysis and tailored fertilizer advisory (valued at ₹300-₹500/sample)',
      frequency: 'annual',
    },
    applicationAvailability: 'ongoing',
    isDeadlineVerified: true,
    officialInfoUrl: 'https://soilhealth.dac.gov.in/',
    officialApplicationUrl: 'https://soilhealth.dac.gov.in/publicreports/farmerregistration',
    sourceName: 'Department of Agriculture and Farmers Welfare, GoI',
    lastVerifiedDate: '2026-11-20T00:00:00.000Z',
    version: '2026.1',
    publicationStatus: 'published',
    verificationStatus: 'verified',
  },

  // 6. Maharashtra: Namo Shetkari Mahasanman Nidhi Yojana
  {
    id: 'mh-namo-shetkari',
    name: 'Namo Shetkari Mahasanman Nidhi Yojana',
    shortName: 'Namo Shetkari (MH)',
    description:
      'Government of Maharashtra flagship scheme providing ₹6,000 per year supplemental direct benefit transfer to all active, verified PM-KISAN beneficiaries in Maharashtra. Disbursed in three 4-monthly installments of ₹2,000 each, bringing combined Central-State assistance to ₹12,000 per year for Maharashtra farmers.',
    level: 'state',
    department: 'Department of Agriculture',
    ministry: 'Government of Maharashtra',
    applicableStates: ['Maharashtra'],
    beneficiaryCategories: ['marginal', 'small', 'semi_medium', 'medium', 'large'],
    supportedActivities: ['agriculture', 'horticulture'],
    eligibilityRules: {
      minLandAcres: 0.01,
      allowedFarmerCategories: ['marginal', 'small', 'semi_medium', 'medium', 'large'],
      allowedOwnershipTypes: ['owner'],
      allowedStates: ['Maharashtra'],
      requiresAadhaarLinkedBank: true,
      requiredActivities: ['agriculture', 'horticulture'],
      customRules: [
        {
          id: 'pm_kisan_approval_in_mh',
          description: 'Applicant must be an approved, active PM-KISAN beneficiary with land in Maharashtra.',
          evaluationKey: 'state',
          expectedValue: 'Maharashtra',
        },
      ],
    },
    requiredDocuments: [
      {
        documentId: 'nsm-aadhaar',
        name: 'Aadhaar Card (Seeded with PM-KISAN)',
        category: 'identity',
        mandatory: true,
        description: 'Aadhaar identity mapped to the approved PM-KISAN beneficiary database in Maharashtra.',
        issuingAuthority: 'UIDAI',
        procurementMethod: 'Online download or physical card.',
      },
      {
        documentId: 'nsm-7-12',
        name: 'Maharashtra 7/12 (Satbara) & 8A Extract',
        category: 'land_record',
        mandatory: true,
        description: 'Digitally signed land record extract confirming cultivable landholding in Maharashtra.',
        issuingAuthority: 'Revenue Department, Government of Maharashtra',
        procurementMethod: 'Download digitally signed 7/12 extract from digitalalm.mahabhumi.gov.in.',
      },
      {
        documentId: 'nsm-bank-passbook',
        name: 'Active Aadhaar-Linked Bank Account Passbook',
        category: 'bank',
        mandatory: true,
        description: 'Bank passbook copy confirming active Aadhaar seeding on the NPCI gateway.',
        issuingAuthority: 'Scheduled Commercial Bank / RRB / DCCB',
        procurementMethod: 'Obtain from bank branch.',
      },
    ],
    benefitType: 'direct_benefit_transfer',
    benefitDetails: {
      summary: '₹6,000 per year in three ₹2,000 installments directly credited to bank account, synchronized with PM-KISAN tranches.',
      amountMax: 6000,
      amountDescription: '₹6,000 per year (₹2,000 per trimester, supplementary to PM-KISAN)',
      frequency: 'triannual',
      unit: 'INR/year',
    },
    applicationAvailability: 'ongoing',
    isDeadlineVerified: true,
    officialInfoUrl: 'https://krishi.maharashtra.gov.in/',
    officialApplicationUrl: 'https://nsmnidy.mahadbt.maharashtra.gov.in/',
    sourceName: 'Department of Agriculture, Government of Maharashtra',
    lastVerifiedDate: '2026-11-20T00:00:00.000Z',
    version: '2026.1',
    publicationStatus: 'published',
    verificationStatus: 'verified',
  },

  // 7. Punjab: Crop Residue Management (CRM) / SMAM
  {
    id: 'pb-crop-residue-management',
    name: 'Punjab Crop Residue Management (CRM) / SMAM Scheme',
    shortName: 'Punjab CRM Stubble Management',
    description:
      'Government of Punjab agricultural mechanization scheme delivering 50% capital subsidy to individual farmers (and up to 80% to Custom Hiring Centers / Panchayats) on modern in-situ paddy straw management machinery (Super Seeder, Happy Seeder, Smart Seeder, Paddy Straw Chopper, Hydraulic Reversible MB Plough, Zero Till Drill).',
    level: 'state',
    department: 'Department of Agriculture and Farmers Welfare',
    ministry: 'Government of Punjab',
    applicableStates: ['Punjab'],
    beneficiaryCategories: ['marginal', 'small', 'semi_medium', 'medium', 'large'],
    supportedActivities: ['agriculture'],
    supportedCrops: ['Paddy', 'Wheat', 'Rice'],
    eligibilityRules: {
      minLandAcres: 0.5,
      allowedFarmerCategories: ['marginal', 'small', 'semi_medium', 'medium', 'large'],
      allowedOwnershipTypes: ['owner', 'tenant'],
      allowedStates: ['Punjab'],
      requiresAadhaarLinkedBank: true,
      requiredActivities: ['agriculture'],
      customRules: [
        {
          id: 'paddy_wheat_crop_cultivation',
          description: 'Applicant must be cultivating paddy/wheat crops and hold a valid tractor registration in Punjab.',
          evaluationKey: 'cropsGrown',
          expectedValue: 'Paddy',
        },
      ],
    },
    requiredDocuments: [
      {
        documentId: 'pb-crm-aadhaar',
        name: 'Aadhaar Card',
        category: 'identity',
        mandatory: true,
        description: 'Biometric identity of the applicant farmer.',
        issuingAuthority: 'UIDAI',
        procurementMethod: 'Online download or physical card.',
      },
      {
        documentId: 'pb-crm-jamabandi',
        name: 'Punjab Land Record (Jamabandi / Fard)',
        category: 'land_record',
        mandatory: true,
        description: 'Certified record of rights showing agricultural land ownership or authorized tenancy in Punjab.',
        issuingAuthority: 'Department of Revenue, Punjab',
        procurementMethod: 'Download digitally from Punjab Land Records Society (PLRS) portal or Tehsil Fard Kendra.',
      },
      {
        documentId: 'pb-crm-tractor-rc',
        name: 'Valid Tractor Registration Certificate (RC)',
        category: 'quotation',
        mandatory: true,
        description: 'Valid RC of tractor registered in the name of the farmer or immediate family member.',
        issuingAuthority: 'Punjab Transport Department (RTO)',
        procurementMethod: 'Original vehicle registration certificate / mParivahan digital RC.',
      },
      {
        documentId: 'pb-crm-affidavit',
        name: 'Self-Declaration / Non-Stubble Burning Undertaking',
        category: 'affidavit',
        mandatory: true,
        description: 'Mandatory undertaking committing to zero crop residue burning on farm parcels.',
        issuingAuthority: 'Self-Declaration / Gram Panchayat',
        procurementMethod: 'Submitted electronically on the Punjab Agri Machinery portal.',
      },
      {
        documentId: 'pb-crm-bank-passbook',
        name: 'Bank Passbook / Cancelled Cheque',
        category: 'bank',
        mandatory: true,
        description: 'Bank passbook copy for direct subsidy transfer upon machinery physical inspection.',
        issuingAuthority: 'Commercial / Regional Rural Bank',
        procurementMethod: 'Obtained from bank branch.',
      },
    ],
    benefitType: 'mechanization_subsidy',
    benefitDetails: {
      summary: '50% capital subsidy on approved CRM machinery for individual farmers (up to 80% for CHCs).',
      amountDescription: '50% subsidy on purchase price of Super Seeder / Happy Seeder up to standard government benchmark ceiling',
      frequency: 'one_time',
      unit: 'subsidy_percentage',
    },
    applicationAvailability: 'seasonal',
    isDeadlineVerified: true,
    officialInfoUrl: 'https://agripb.gov.in/',
    officialApplicationUrl: 'https://agrimachinerypb.com/',
    sourceName: 'Department of Agriculture & Farmers Welfare, Government of Punjab',
    lastVerifiedDate: '2026-11-20T00:00:00.000Z',
    version: '2026.1',
    publicationStatus: 'published',
    verificationStatus: 'verified',
  },

  // 8. Andhra Pradesh: YSR Rythu Bharosa / Annadata Sukhibhava
  {
    id: 'ap-rythu-bharosa',
    name: 'YSR Rythu Bharosa / Annadata Sukhibhava',
    shortName: 'Rythu Bharosa / Annadata Sukhibhava (AP)',
    description:
      'Government of Andhra Pradesh welfare scheme providing financial assistance of ₹13,500 to ₹20,000 per year per farmer family, specifically including landless tenant farmers belonging to SC, ST, BC, and Minority categories possessing a valid Crop Cultivator Rights Card (CCRC) for at least one year.',
    level: 'state',
    department: 'Department of Agriculture',
    ministry: 'Government of Andhra Pradesh',
    applicableStates: ['Andhra Pradesh'],
    beneficiaryCategories: ['all', 'marginal', 'small', 'semi_medium', 'medium', 'large', 'tenant', 'sc_st'],
    supportedActivities: ['agriculture', 'horticulture', 'sericulture'],
    eligibilityRules: {
      minLandAcres: 0.01,
      allowedFarmerCategories: ['all', 'marginal', 'small', 'semi_medium', 'medium', 'large', 'tenant', 'sc_st'],
      allowedOwnershipTypes: ['owner', 'tenant', 'sharecropper'],
      allowedStates: ['Andhra Pradesh'],
      requiresAadhaarLinkedBank: true,
      requiredActivities: ['agriculture', 'horticulture', 'sericulture'],
      customRules: [
        {
          id: 'tenant_ccrc_mandate',
          description: 'Tenant farmers must possess a valid Crop Cultivator Rights Card (CCRC) signed by landowner and VRO.',
          evaluationKey: 'hasCCRC',
          expectedValue: true,
        },
      ],
    },
    requiredDocuments: [
      {
        documentId: 'ap-rb-aadhaar',
        name: 'Aadhaar Card',
        category: 'identity',
        mandatory: true,
        description: 'Biometric identity for Andhra Pradesh e-KYC integration.',
        issuingAuthority: 'UIDAI',
        procurementMethod: 'Online download or physical copy.',
      },
      {
        documentId: 'ap-rb-land-adangal',
        name: 'Webland Adangal / 1B Extract (for Landowners)',
        category: 'land_record',
        mandatory: false,
        description: 'Certified land title extract from Webland AP for owner cultivators.',
        issuingAuthority: 'Revenue Department, Government of Andhra Pradesh',
        procurementMethod: 'Download from Meebhoomi AP portal or obtain via Grama Sachivalayam.',
      },
      {
        documentId: 'ap-rb-ccrc-card',
        name: 'Crop Cultivator Rights Card (CCRC) (Mandatory for Tenant Farmers)',
        category: 'tenancy_proof',
        mandatory: false,
        description: 'Statutory lease agreement under AP Crop Cultivator Rights Act 2019 executed via Grama Sachivalayam.',
        issuingAuthority: 'Village Revenue Officer (VRO) / Tahsildar, Andhra Pradesh',
        procurementMethod: 'Executed at Village Secretariats (Grama Sachivalayam) with landowner concurrence.',
      },
      {
        documentId: 'ap-rb-caste-cert',
        name: 'Caste Certificate (for Tenant SC/ST/BC/Minority Farmers)',
        category: 'caste',
        mandatory: false,
        description: 'Digitally signed caste certificate required for tenant category eligibility.',
        issuingAuthority: 'Revenue Department (Tahsildar) / MeeSeva',
        procurementMethod: 'Obtain from MeeSeva center or Grama Sachivalayam.',
      },
      {
        documentId: 'ap-rb-bank-passbook',
        name: 'Active Aadhaar-Linked Bank Account Passbook',
        category: 'bank',
        mandatory: true,
        description: 'Active savings account with Aadhaar NPCI seeding in Andhra Pradesh.',
        issuingAuthority: 'Commercial / Regional Rural / Cooperative Bank',
        procurementMethod: 'Obtain from bank branch.',
      },
    ],
    benefitType: 'direct_benefit_transfer',
    benefitDetails: {
      summary: '₹13,500 to ₹20,000 annual cash assistance disbursed in 3 phases before crop seasons for input procurement.',
      amountMax: 20000,
      amountDescription: '₹13,500 - ₹20,000 per year per eligible farmer family including tenant farmers with CCRC',
      frequency: 'triannual',
      unit: 'INR/year',
    },
    applicationAvailability: 'ongoing',
    isDeadlineVerified: true,
    officialInfoUrl: 'https://apagrisnet.gov.in/',
    officialApplicationUrl: 'https://ysrrythubharosa.ap.gov.in/',
    sourceName: 'Department of Agriculture, Government of Andhra Pradesh',
    lastVerifiedDate: '2026-11-20T00:00:00.000Z',
    version: '2026.1',
    publicationStatus: 'published',
    verificationStatus: 'verified',
    faqs: [
      {
        question: 'Are tenant farmers eligible without landowner consent for CCRC?',
        answer: 'CCRC requires mutual agreement between landowner and tenant cultivator for a period of 11 months, certified by the Village Revenue Officer (VRO).',
        officialSourceRef: 'https://ysrrythubharosa.ap.gov.in/',
      },
    ],
  },
];

/**
 * Returns all verified schemes in the registry.
 */
export function getAllSchemes(): GovernmentScheme[] {
  return [...VERIFIED_SCHEMES_REGISTRY];
}

/**
 * Finds a scheme by its unique identifier.
 */
export function getSchemeById(id: string): GovernmentScheme | undefined {
  if (!id) return undefined;
  const normalizedId = id.trim().toLowerCase();
  return VERIFIED_SCHEMES_REGISTRY.find(
    (scheme) => scheme.id.toLowerCase() === normalizedId
  );
}

/**
 * Returns all schemes applicable to a given state.
 * Schemes applicable to 'ALL' states are included in all state results.
 */
export function getSchemesByState(state: string): GovernmentScheme[] {
  if (!state) return [];
  const normalizedState = state.trim().toLowerCase();

  return VERIFIED_SCHEMES_REGISTRY.filter((scheme) => {
    return scheme.applicableStates.some((s) => {
      const lower = s.toLowerCase();
      return lower === 'all' || lower === normalizedState;
    });
  });
}

/**
 * Returns schemes matching an activity category or farmer category.
 */
export function getSchemesByCategory(
  category: ActivityCategory | FarmerCategory | string
): GovernmentScheme[] {
  if (!category) return [];
  const normalized = category.trim().toLowerCase();

  return VERIFIED_SCHEMES_REGISTRY.filter((scheme) => {
    const activityMatch = scheme.supportedActivities.some(
      (act) => act.toLowerCase() === normalized
    );
    const beneficiaryMatch = scheme.beneficiaryCategories.some(
      (cat) => cat.toLowerCase() === normalized || cat.toLowerCase() === 'all'
    );
    const ruleMatch = scheme.eligibilityRules.allowedFarmerCategories?.some(
      (cat) => cat.toLowerCase() === normalized || cat.toLowerCase() === 'all'
    );
    return activityMatch || beneficiaryMatch || Boolean(ruleMatch);
  });
}

/**
 * Searches schemes across title, shortName, description, department, ministry, and tags.
 */
export function searchSchemes(query: string): GovernmentScheme[] {
  if (!query || !query.trim()) return getAllSchemes();
  const q = query.trim().toLowerCase();

  return VERIFIED_SCHEMES_REGISTRY.filter((scheme) => {
    const searchableText = [
      scheme.name,
      scheme.shortName,
      scheme.description,
      scheme.department,
      scheme.ministry,
      scheme.benefitType,
      scheme.benefitDetails.summary,
      ...scheme.applicableStates,
      ...(scheme.supportedCrops || []),
      ...scheme.beneficiaryCategories,
      ...scheme.supportedActivities,
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(q);
  });
}
