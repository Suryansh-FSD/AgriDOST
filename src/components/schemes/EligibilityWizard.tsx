'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  ShieldCheck,
  LandPlot,
  Building,
  Layers,
  FileCheck,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  GovernmentScheme,
  EligibilityEvaluationInput,
  EligibilityEvaluationResult,
  FarmerCategory,
  ActivityCategory,
  Farm,
} from '@/types';
import { evaluateEligibility } from '@/lib/schemes';

interface EligibilityWizardProps {
  scheme: GovernmentScheme;
  farm?: Farm;
  isOpen: boolean;
  onClose: () => void;
  onProceedToDocuments?: (scheme: GovernmentScheme, input: EligibilityEvaluationInput) => void;
  onProceedToApply?: (scheme: GovernmentScheme, input: EligibilityEvaluationInput) => void;
}

const INDIAN_STATES = [
  'Maharashtra',
  'Punjab',
  'Andhra Pradesh',
  'Uttar Pradesh',
  'Madhya Pradesh',
  'Gujarat',
  'Karnataka',
  'Rajasthan',
  'Haryana',
  'Tamil Nadu',
  'Telangana',
  'Bihar',
  'West Bengal',
  'Odisha',
  'Kerala',
];

const ACTIVITY_OPTIONS: { id: ActivityCategory; label: string }[] = [
  { id: 'agriculture', label: 'Field Crops / Agriculture' },
  { id: 'horticulture', label: 'Fruits & Veg / Horticulture' },
  { id: 'dairy', label: 'Dairy Cattle' },
  { id: 'livestock', label: 'Livestock / Poultry / Goats' },
  { id: 'fisheries', label: 'Fisheries / Aquaculture' },
  { id: 'agroforestry', label: 'Trees / Agroforestry' },
  { id: 'organic_farming', label: 'Organic / Natural Farming' },
  { id: 'beekeeping', label: 'Beekeeping / Honey' },
];

export function EligibilityWizard({
  scheme,
  farm,
  isOpen,
  onClose,
  onProceedToDocuments,
  onProceedToApply,
}: EligibilityWizardProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Derive initial values from activeFarm
  const defaultState = farm?.locationDetails?.state || 'Maharashtra';
  const defaultDistrict = farm?.locationDetails?.district || 'Pune';
  const defaultAcres = farm?.areaAcres ? Number(farm.areaAcres.toFixed(1)) : 3.5;
  const defaultCrop = farm?.primaryCrop || 'Soybean';

  // Helper: auto-calculate farmer category based on landholding
  const getAutoCategory = (acres: number): FarmerCategory => {
    if (acres < 2.47) return 'marginal';
    if (acres <= 4.94) return 'small';
    if (acres <= 9.88) return 'semi_medium';
    if (acres <= 24.7) return 'medium';
    return 'large';
  };

  // Form State
  const [state, setState] = useState<string>(defaultState);
  const [district, setDistrict] = useState<string>(defaultDistrict);
  const [landHoldingAcres, setLandHoldingAcres] = useState<number>(defaultAcres);
  const [ownershipType, setOwnershipType] = useState<'owner' | 'tenant' | 'sharecropper'>('owner');
  const [farmerCategory, setFarmerCategory] = useState<FarmerCategory>(getAutoCategory(defaultAcres));
  const [cropsGrown, setCropsGrown] = useState<string>(defaultCrop);
  const [farmingActivities, setFarmingActivities] = useState<ActivityCategory[]>(['agriculture']);
  const [hasAadhaarLinkedBank, setHasAadhaarLinkedBank] = useState<boolean>(true);
  const [hasKisanCreditCard, setHasKisanCreditCard] = useState<boolean>(false);
  const [annualIncomeInr, setAnnualIncomeInr] = useState<string>('');

  // Evaluation Result State
  const [evaluationResult, setEvaluationResult] = useState<EligibilityEvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Sync when farm or scheme changes
  useEffect(() => {
    if (farm) {
      if (farm.locationDetails?.state) setState(farm.locationDetails.state);
      if (farm.locationDetails?.district) setDistrict(farm.locationDetails.district);
      if (farm.areaAcres) {
        const acres = Number(farm.areaAcres.toFixed(1));
        setLandHoldingAcres(acres);
        setFarmerCategory(getAutoCategory(acres));
      }
      if (farm.primaryCrop) setCropsGrown(farm.primaryCrop);
    }
  }, [farm]);

  // Landholding changes update auto category if not manually overridden to tenant/women
  const handleAcresChange = (newAcres: number) => {
    setLandHoldingAcres(newAcres);
    if (ownershipType === 'owner') {
      setFarmerCategory(getAutoCategory(newAcres));
    }
  };

  const handleOwnershipChange = (type: 'owner' | 'tenant' | 'sharecropper') => {
    setOwnershipType(type);
    if (type === 'tenant') {
      setFarmerCategory('tenant');
    } else if (type === 'sharecropper') {
      setFarmerCategory('sharecropper');
    } else {
      setFarmerCategory(getAutoCategory(landHoldingAcres));
    }
  };

  const toggleActivity = (act: ActivityCategory) => {
    setFarmingActivities((prev) =>
      prev.includes(act) ? prev.filter((a) => a !== act) : [...prev, act]
    );
  };

  // Compile Input Payload
  const evaluationInput: EligibilityEvaluationInput = useMemo(() => {
    const crops = cropsGrown
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    return {
      state,
      district: district.trim() || undefined,
      farmerCategory,
      landHoldingAcres: Number(landHoldingAcres) || 0,
      ownershipType,
      farmingActivities: farmingActivities.length > 0 ? farmingActivities : ['agriculture'],
      cropsGrown: crops.length > 0 ? crops : undefined,
      hasAadhaarLinkedBank,
      hasKisanCreditCard,
      annualIncomeInr: annualIncomeInr ? Number(annualIncomeInr) : undefined,
    };
  }, [
    state,
    district,
    farmerCategory,
    landHoldingAcres,
    ownershipType,
    farmingActivities,
    cropsGrown,
    hasAadhaarLinkedBank,
    hasKisanCreditCard,
    annualIncomeInr,
  ]);

  // Run Evaluation
  const runEvaluation = () => {
    setIsEvaluating(true);
    try {
      if (typeof evaluateEligibility === 'function') {
        const result = evaluateEligibility(scheme.id, evaluationInput);
        setEvaluationResult(result);
      } else {
        // Fallback local deterministic evaluation
        const rules = scheme.eligibilityRules;
        const passed: string[] = [];
        const failed: string[] = [];
        const missing: string[] = [];

        // Check State
        const isAllStates = rules.allowedStates?.includes('ALL') || scheme.applicableStates.includes('ALL');
        const stateMatch = isAllStates || rules.allowedStates?.map((s) => s.toLowerCase()).includes(state.toLowerCase());
        if (stateMatch) {
          passed.push(`State of ${state} is eligible under ${scheme.shortName}.`);
        } else {
          failed.push(`${state} is not in the eligible states list for ${scheme.shortName}.`);
        }

        // Check Ownership
        if (rules.allowedOwnershipTypes && !rules.allowedOwnershipTypes.includes(ownershipType)) {
          failed.push(`Scheme requires ownership type: ${rules.allowedOwnershipTypes.join(', ')} (Applicant is ${ownershipType}).`);
        } else {
          passed.push(`Land ownership type (${ownershipType.toUpperCase()}) is accepted.`);
        }

        // Check Landholding Limits
        if (rules.minLandAcres !== undefined && landHoldingAcres < rules.minLandAcres) {
          failed.push(`Minimum landholding required is ${rules.minLandAcres} acres (Applicant has ${landHoldingAcres} acres).`);
        } else if (rules.maxLandAcres !== undefined && landHoldingAcres > rules.maxLandAcres) {
          failed.push(`Maximum landholding ceiling is ${rules.maxLandAcres} acres (Applicant has ${landHoldingAcres} acres).`);
        } else {
          passed.push(`Landholding of ${landHoldingAcres} acres satisfies criteria.`);
        }

        // Check Aadhaar Bank Seeding
        if (rules.requiresAadhaarLinkedBank) {
          if (hasAadhaarLinkedBank) {
            passed.push('Bank account is seeded with Aadhaar for NPCI DBT transfers.');
          } else {
            failed.push('Scheme strictly requires an Aadhaar-seeded bank account for Direct Benefit Transfer.');
          }
        }

        // Determine Status & Score
        let status: EligibilityEvaluationResult['status'] = 'potentially_eligible';
        let score = 100;

        if (failed.length > 0) {
          status = 'potentially_ineligible';
          score = Math.max(0, 100 - failed.length * 35);
        } else if (missing.length > 0) {
          status = 'more_information_required';
          score = 70;
        }

        setEvaluationResult({
          schemeId: scheme.id,
          status,
          scorePercentage: score,
          reasons: passed.concat(failed),
          passedCriteria: passed,
          failedCriteria: failed,
          missingInformation: missing,
          disclaimer:
            'This deterministic assessment is based on officially published scheme parameters. Government field authorities make the final decision upon e-KYC and revenue record verification.',
          evaluatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Evaluation failed, generating safe fallback', err);
    } finally {
      setIsEvaluating(false);
      setCurrentStep(3);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-xs transition-opacity duration-200">
      <div
        className="relative w-full max-w-3xl bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#E7E9E2] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-6 border-b border-[#E7E9E2] bg-gradient-to-r from-[#F7F7F0] via-[#FFFFFF] to-[#F7F7F0] relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-[#26312A]/60 hover:text-[#26312A] hover:bg-[#E7E9E2]/60 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#DCE8D3] text-[#173F2B] border border-[#4D6B53]/20">
              <Sparkles className="w-3.5 h-3.5 text-[#173F2B]" />
              Deterministic Eligibility Evaluator
            </span>
            <span className="text-xs font-medium text-[#26312A]/60">
              {scheme.shortName}
            </span>
          </div>

          <h2 className="text-2xl font-bold font-heading text-[#173F2B]">
            Check Scheme Eligibility
          </h2>
          <p className="text-sm text-[#26312A]/70 mt-1">
            Verified questionnaire pre-populated from {farm?.name || 'your farm profile'}.
          </p>

          {/* Stepper Tabs */}
          <div className="flex items-center gap-2 mt-4 pt-2 border-t border-[#E7E9E2]/70">
            <button
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                currentStep === 1
                  ? 'bg-[#173F2B] text-white shadow-xs'
                  : 'bg-[#F7F7F0] text-[#26312A]/70 hover:bg-[#E7E9E2]'
              }`}
            >
              <span>1. Profile & Land</span>
            </button>
            <ArrowRight className="w-3 h-3 text-[#26312A]/40" />
            <button
              onClick={() => setCurrentStep(2)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                currentStep === 2
                  ? 'bg-[#173F2B] text-white shadow-xs'
                  : 'bg-[#F7F7F0] text-[#26312A]/70 hover:bg-[#E7E9E2]'
              }`}
            >
              <span>2. Activities & Bank</span>
            </button>
            <ArrowRight className="w-3 h-3 text-[#26312A]/40" />
            <button
              onClick={() => {
                if (evaluationResult) setCurrentStep(3);
                else runEvaluation();
              }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                currentStep === 3
                  ? 'bg-[#173F2B] text-white shadow-xs'
                  : 'bg-[#F7F7F0] text-[#26312A]/70 hover:bg-[#E7E9E2]'
              }`}
            >
              <span>3. Evaluation Result</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* STEP 1: Profile & Land Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#4D6B53]">
                  Step 1: Farmer Profile & Landholding
                </h3>
                <span className="text-xs text-[#26312A]/60">
                  Pre-filled from Farm Coordinates
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* State */}
                <div>
                  <label className="block text-xs font-bold text-[#173F2B] mb-1">
                    State / Union Territory *
                  </label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9E2] bg-white text-sm text-[#26312A] focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20"
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* District */}
                <div>
                  <label className="block text-xs font-bold text-[#173F2B] mb-1">
                    District
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Pune, Ludhiana, Guntur"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9E2] bg-white text-sm text-[#26312A] focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20"
                  />
                </div>

                {/* Landholding Acres */}
                <div>
                  <label className="block text-xs font-bold text-[#173F2B] mb-1">
                    Total Cultivable Landholding (in Acres) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={landHoldingAcres}
                    onChange={(e) => handleAcresChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9E2] bg-white text-sm text-[#26312A] focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20"
                  />
                  <span className="text-[11px] text-[#26312A]/60 mt-0.5 block">
                    1 Hectare ≈ 2.47 Acres. Enter land in your legal possession.
                  </span>
                </div>

                {/* Ownership Type */}
                <div>
                  <label className="block text-xs font-bold text-[#173F2B] mb-1">
                    Land Ownership Structure *
                  </label>
                  <select
                    value={ownershipType}
                    onChange={(e) =>
                      handleOwnershipChange(e.target.value as 'owner' | 'tenant' | 'sharecropper')
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9E2] bg-white text-sm text-[#26312A] focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20"
                  >
                    <option value="owner">Title Owner (Name on 7/12 or RoR)</option>
                    <option value="tenant">Tenant Cultivator (Leased Land / CCRC)</option>
                    <option value="sharecropper">Sharecropper (Bataidar)</option>
                  </select>
                </div>
              </div>

              {/* Farmer Category */}
              <div className="bg-[#F7F7F0] p-4 rounded-xl border border-[#E7E9E2]">
                <label className="block text-xs font-bold text-[#173F2B] mb-1.5">
                  Farmer Classification Category (Auto-computed)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'marginal', label: 'Marginal (<2.5 ac)' },
                    { id: 'small', label: 'Small (2.5-5 ac)' },
                    { id: 'semi_medium', label: 'Semi-Medium (5-10 ac)' },
                    { id: 'medium', label: 'Medium (10-25 ac)' },
                    { id: 'large', label: 'Large (>25 ac)' },
                    { id: 'tenant', label: 'Tenant Farmer' },
                    { id: 'women', label: 'Woman Farmer' },
                    { id: 'sc_st', label: 'SC / ST Farmer' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFarmerCategory(cat.id as FarmerCategory)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-colors ${
                        farmerCategory === cat.id
                          ? 'bg-[#173F2B] text-white border-[#173F2B] font-bold shadow-xs'
                          : 'bg-white border-[#E7E9E2] text-[#26312A]/80 hover:bg-[#E7E9E2]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Farming Activities & Financial Readiness */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#4D6B53]">
                  Step 2: Activities, Crops & Bank Seeding
                </h3>
              </div>

              {/* Crops Grown */}
              <div>
                <label className="block text-xs font-bold text-[#173F2B] mb-1">
                  Primary Crops Cultivated
                </label>
                <input
                  type="text"
                  value={cropsGrown}
                  onChange={(e) => setCropsGrown(e.target.value)}
                  placeholder="e.g. Cotton, Soybean, Wheat, Paddy, Sugarcane"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9E2] bg-white text-sm text-[#26312A] focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20"
                />
                <span className="text-[11px] text-[#26312A]/60 mt-0.5 block">
                  Separate multiple crops with commas.
                </span>
              </div>

              {/* Farming Activities Chips */}
              <div>
                <label className="block text-xs font-bold text-[#173F2B] mb-1.5">
                  Farming Activities Undertaken
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ACTIVITY_OPTIONS.map((item) => {
                    const isSelected = farmingActivities.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleActivity(item.id)}
                        className={`p-2.5 text-xs rounded-xl border text-left transition-colors ${
                          isSelected
                            ? 'bg-[#173F2B] text-white border-[#173F2B] font-bold shadow-xs'
                            : 'bg-white border-[#E7E9E2] text-[#26312A]/80 hover:bg-[#F7F7F0]'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bank Seeding & KCC Checkboxes */}
              <div className="space-y-3 bg-[#F7F7F0] p-4 rounded-xl border border-[#E7E9E2]">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAadhaarLinkedBank}
                    onChange={(e) => setHasAadhaarLinkedBank(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-[#173F2B] rounded-sm focus:ring-[#173F2B]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#173F2B] block">
                      Aadhaar-Seeded Bank Account (DBT Enabled) *
                    </span>
                    <span className="text-[11px] text-[#26312A]/70">
                      I have an active savings bank account linked to my Aadhaar number and registered on NPCI Aadhaar Payment Bridge.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-[#E7E9E2]">
                  <input
                    type="checkbox"
                    checked={hasKisanCreditCard}
                    onChange={(e) => setHasKisanCreditCard(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-[#173F2B] rounded-sm focus:ring-[#173F2B]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#173F2B] block">
                      Kisan Credit Card (KCC)
                    </span>
                    <span className="text-[11px] text-[#26312A]/70">
                      I currently possess an active Kisan Credit Card with an approved credit limit.
                    </span>
                  </div>
                </label>
              </div>

              {/* Annual Income */}
              <div>
                <label className="block text-xs font-bold text-[#173F2B] mb-1">
                  Annual Household Income (INR, Optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 150000"
                  value={annualIncomeInr}
                  onChange={(e) => setAnnualIncomeInr(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9E2] bg-white text-sm text-[#26312A] focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Evaluation Result */}
          {currentStep === 3 && evaluationResult && (
            <div className="space-y-5">
              {/* Result Status Banner */}
              <div
                className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  evaluationResult.status === 'potentially_eligible'
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : evaluationResult.status === 'potentially_ineligible'
                    ? 'bg-rose-50/80 border-rose-300 text-rose-950'
                    : 'bg-amber-50/80 border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-start gap-3">
                  {evaluationResult.status === 'potentially_eligible' ? (
                    <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
                  ) : evaluationResult.status === 'potentially_ineligible' ? (
                    <AlertTriangle className="w-7 h-7 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <HelpCircle className="w-7 h-7 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-extrabold tracking-wider">
                        Evaluation Verdict
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white shadow-xs">
                        {evaluationResult.scorePercentage}% Match Score
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mt-0.5">
                      {evaluationResult.status === 'potentially_eligible'
                        ? 'Potentially Eligible'
                        : evaluationResult.status === 'potentially_ineligible'
                        ? 'Potentially Ineligible'
                        : 'More Information Required'}
                    </h3>
                    <p className="text-xs mt-1 opacity-90 leading-relaxed">
                      {evaluationResult.status === 'potentially_eligible'
                        ? `Congratulations! Based on your farm profile and land details, you satisfy the published eligibility criteria for ${scheme.name}.`
                        : evaluationResult.status === 'potentially_ineligible'
                        ? `Your current profile does not meet all mandatory conditions for ${scheme.shortName}. Review the detailed criteria below.`
                        : `Your profile partially matches, but certain state or category criteria require in-person verification at your local CSC.`}
                    </p>
                  </div>
                </div>

                {/* Score Bar */}
                <div className="bg-white p-3 rounded-xl border border-black/5 shadow-xs shrink-0 text-center min-w-[120px]">
                  <span className="text-[11px] text-[#26312A]/60 block font-semibold">
                    Confidence
                  </span>
                  <span className="text-2xl font-bold text-[#173F2B]">
                    {evaluationResult.scorePercentage}%
                  </span>
                  <div className="w-full bg-[#E7E9E2] h-2 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full ${
                        evaluationResult.scorePercentage >= 80
                          ? 'bg-emerald-600'
                          : evaluationResult.scorePercentage >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${evaluationResult.scorePercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Passed Criteria Breakdown */}
              {evaluationResult.passedCriteria.length > 0 && (
                <div className="bg-white p-4 rounded-xl border border-[#E7E9E2] space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Passed Criteria ({evaluationResult.passedCriteria.length})
                  </h4>
                  <ul className="space-y-1.5 text-xs text-[#26312A]/90">
                    {evaluationResult.passedCriteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Failed Criteria Breakdown */}
              {evaluationResult.failedCriteria.length > 0 && (
                <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Unmet Requirements ({evaluationResult.failedCriteria.length})
                  </h4>
                  <ul className="space-y-1.5 text-xs text-rose-950">
                    {evaluationResult.failedCriteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Information */}
              {evaluationResult.missingInformation.length > 0 && (
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-amber-600" />
                    Pending Information Needed
                  </h4>
                  <ul className="space-y-1.5 text-xs text-amber-950">
                    {evaluationResult.missingInformation.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <div className="p-3 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2] text-[11px] text-[#26312A]/70 flex items-start gap-2">
                <Info className="w-4 h-4 text-[#4D6B53] shrink-0 mt-0.5" />
                <span>{evaluationResult.disclaimer}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-[#E7E9E2] bg-[#F7F7F0] flex flex-wrap items-center justify-between gap-3">
          {currentStep === 1 && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#E7E9E2] text-sm font-semibold text-[#26312A] hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2.5 rounded-xl bg-[#173F2B] text-white text-sm font-semibold hover:bg-[#0f2c1e] transition-colors shadow-xs flex items-center gap-1.5"
              >
                Next: Activities & Bank
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {currentStep === 2 && (
            <>
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2.5 rounded-xl border border-[#E7E9E2] text-sm font-semibold text-[#26312A] hover:bg-white transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={runEvaluation}
                disabled={isEvaluating}
                className="px-6 py-2.5 rounded-xl bg-[#173F2B] text-white text-sm font-bold hover:bg-[#0f2c1e] transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-[#DCE8D3]" />
                {isEvaluating ? 'Evaluating...' : 'Evaluate Instant Eligibility'}
              </button>
            </>
          )}

          {currentStep === 3 && (
            <>
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2.5 rounded-xl border border-[#E7E9E2] text-sm font-semibold text-[#26312A] hover:bg-white transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Change Answers
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {onProceedToDocuments && (
                  <button
                    onClick={() => {
                      onClose();
                      onProceedToDocuments(scheme, evaluationInput);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-[#4D6B53]/30 bg-white text-[#173F2B] text-sm font-semibold hover:bg-[#DCE8D3]/50 transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <FileCheck className="w-4 h-4" />
                    Prepare Documents
                  </button>
                )}

                {onProceedToApply && (
                  <button
                    onClick={() => {
                      onClose();
                      onProceedToApply(scheme, evaluationInput);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#173F2B] text-white text-sm font-bold hover:bg-[#0f2c1e] transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    Start Application Guide
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
