'use client';

import React, { useEffect } from 'react';
import {
  X,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  LandPlot,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  HelpCircle,
  Clock,
  Banknote,
  Sparkles,
} from 'lucide-react';
import { GovernmentScheme } from '@/types';

interface SchemeDetailModalProps {
  scheme: GovernmentScheme | null;
  isOpen: boolean;
  onClose: () => void;
  onCheckEligibility?: (scheme: GovernmentScheme) => void;
  onPrepareDocuments?: (scheme: GovernmentScheme) => void;
  onStartApplication?: (scheme: GovernmentScheme) => void;
}

export function SchemeDetailModal({
  scheme,
  isOpen,
  onClose,
  onCheckEligibility,
  onPrepareDocuments,
  onStartApplication,
}: SchemeDetailModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !scheme) return null;

  const formattedVerifiedDate = scheme.lastVerifiedDate
    ? new Date(scheme.lastVerifiedDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Recently Verified';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-xs transition-opacity duration-200">
      <div
        className="relative w-full max-w-4xl bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#E7E9E2] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-6 border-b border-[#E7E9E2] bg-gradient-to-r from-[#F7F7F0] via-[#FFFFFF] to-[#F7F7F0] relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-[#26312A]/60 hover:text-[#26312A] hover:bg-[#E7E9E2]/60 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-2 pr-10">
            {/* Level Badge */}
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                scheme.level === 'central'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-sky-50 text-sky-800 border-sky-200'
              }`}
            >
              {scheme.level.toUpperCase()} GOVERNMENT
            </span>

            {/* Official Verification Badge */}
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#DCE8D3] text-[#173F2B] border border-[#4D6B53]/20">
              <ShieldCheck className="w-3.5 h-3.5 text-[#173F2B]" />
              Official Verified Source
            </span>

            {/* Availability */}
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Status: {scheme.applicationAvailability.toUpperCase()}
            </span>
          </div>

          <h2 className="text-2xl font-bold font-heading text-[#173F2B]">
            {scheme.name}
          </h2>
          <p className="text-sm text-[#26312A]/70 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#4D6B53]" />
              {scheme.ministry || scheme.department}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#26312A]/60">
              <Clock className="w-3.5 h-3.5" />
              Verified as of: {formattedVerifiedDate}
            </span>
          </p>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6 text-[#26312A]">
          {/* Benefit Highlight Box */}
          <div className="bg-[#DCE8D3]/35 rounded-xl p-4 border border-[#4D6B53]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-[#4D6B53]">
                Scheme Benefit
              </span>
              <p className="text-lg font-bold text-[#173F2B]">
                {scheme.benefitDetails.summary}
              </p>
              <p className="text-sm text-[#26312A]/80 mt-0.5">
                {scheme.benefitDetails.amountDescription}
              </p>
            </div>
            {scheme.benefitDetails.amountMax ? (
              <div className="bg-[#FFFFFF] px-4 py-2 rounded-xl shadow-xs border border-[#E7E9E2] text-center shrink-0">
                <span className="text-xs text-[#26312A]/60 block font-medium">Max Value</span>
                <span className="text-base font-bold text-[#173F2B]">
                  ₹{scheme.benefitDetails.amountMax.toLocaleString('en-IN')}
                </span>
              </div>
            ) : null}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#4D6B53] mb-2">
              Overview & Objective
            </h3>
            <p className="text-sm leading-relaxed text-[#26312A]/90 whitespace-pre-line">
              {scheme.description}
            </p>
          </div>

          {/* Official Portals & Verified Sources */}
          <div className="bg-[#F7F7F0] rounded-xl p-4 border border-[#E7E9E2]">
            <h3 className="text-sm font-semibold text-[#173F2B] mb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#173F2B]" />
              Direct Official Government Sources
            </h3>
            <p className="text-xs text-[#26312A]/70 mb-3">
              AgriDOST cross-references official gazettes, department portals, and national dashboards. You can visit the official portals below:
            </p>
            <div className="flex flex-wrap gap-2">
              {scheme.officialApplicationUrl && (
                <a
                  href={scheme.officialApplicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E7E9E2] text-[#173F2B] hover:bg-[#DCE8D3]/50 transition-colors shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Official Application Portal ({scheme.sourceName || 'Gov Portal'})
                </a>
              )}
              {scheme.officialInfoUrl && scheme.officialInfoUrl !== scheme.officialApplicationUrl && (
                <a
                  href={scheme.officialInfoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E7E9E2] text-[#4D6B53] hover:bg-[#DCE8D3]/50 transition-colors shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Official Scheme Guidelines & FAQ
                </a>
              )}
            </div>
          </div>

          {/* Beneficiary Categories & Activities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#E7E9E2]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#4D6B53] mb-2 flex items-center gap-1.5">
                <LandPlot className="w-3.5 h-3.5" />
                Target Beneficiaries
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {scheme.beneficiaryCategories.map((cat) => (
                  <span
                    key={cat}
                    className="text-xs px-2 py-0.5 rounded-md bg-[#F7F7F0] text-[#26312A] border border-[#E7E9E2]"
                  >
                    {cat.replace('_', ' ').toUpperCase()}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#E7E9E2]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#4D6B53] mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Supported Activities & Crops
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {scheme.supportedActivities.map((act) => (
                  <span
                    key={act}
                    className="text-xs px-2 py-0.5 rounded-md bg-[#F7F7F0] text-[#26312A] border border-[#E7E9E2]"
                  >
                    {act.replace('_', ' ').toUpperCase()}
                  </span>
                ))}
                {scheme.supportedCrops && scheme.supportedCrops.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                    Crops: {scheme.supportedCrops.join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Eligibility Rules */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#4D6B53] mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#173F2B]" />
              Eligibility Criteria
            </h3>
            <ul className="space-y-2 text-sm text-[#26312A]/90">
              {scheme.eligibilityRules.minLandAcres !== undefined && (
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4D6B53] mt-2 shrink-0" />
                  <span>
                    <strong>Landholding Limit:</strong> Min {scheme.eligibilityRules.minLandAcres} acres
                    {scheme.eligibilityRules.maxLandAcres !== undefined
                      ? ` up to ${scheme.eligibilityRules.maxLandAcres} acres`
                      : ' (No upper cap)'}
                    .
                  </span>
                </li>
              )}
              {scheme.eligibilityRules.allowedStates && (
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4D6B53] mt-2 shrink-0" />
                  <span>
                    <strong>Applicable States:</strong>{' '}
                    {scheme.eligibilityRules.allowedStates.includes('ALL')
                      ? 'All States and Union Territories of India'
                      : scheme.eligibilityRules.allowedStates.join(', ')}
                  </span>
                </li>
              )}
              {scheme.eligibilityRules.allowedOwnershipTypes && (
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4D6B53] mt-2 shrink-0" />
                  <span>
                    <strong>Land Ownership:</strong>{' '}
                    {scheme.eligibilityRules.allowedOwnershipTypes
                      .map((t) => t.toUpperCase())
                      .join(', ')}
                  </span>
                </li>
              )}
              {scheme.eligibilityRules.requiresAadhaarLinkedBank && (
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4D6B53] mt-2 shrink-0" />
                  <span>
                    <strong>Bank Account:</strong> Must have an active bank account seeded with Aadhaar and enabled for NPCI/DBT.
                  </span>
                </li>
              )}
              {scheme.eligibilityRules.customRules?.map((rule) => (
                <li key={rule.id} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4D6B53] mt-2 shrink-0" />
                  <span>{rule.description}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Required Documents Preview */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#4D6B53] mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#173F2B]" />
              Required Documentation Checklist ({scheme.requiredDocuments.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scheme.requiredDocuments.map((doc) => (
                <div
                  key={doc.documentId}
                  className="p-3 rounded-xl bg-[#F7F7F0] border border-[#E7E9E2] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#173F2B]">{doc.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        doc.mandatory
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {doc.mandatory ? 'MANDATORY' : 'OPTIONAL'}
                    </span>
                  </div>
                  <p className="text-[#26312A]/70">{doc.description}</p>
                  <p className="text-[11px] text-[#4D6B53] font-medium pt-1">
                    Authority: {doc.issuingAuthority}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Independent Advisory Disclaimer */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950 mb-0.5">
                Independent Advisory Assistant Notice
              </p>
              <p className="leading-relaxed">
                AgriDOST is an independent, farmer-first advisory assistant designed to empower cultivators with transparent scheme knowledge. AgriDOST is NOT an official government agency and does not process government benefits directly. Applications must be completed on official portals or authorized Common Service Centers (CSCs). We never charge fees or ask for identity passwords.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-[#E7E9E2] bg-[#F7F7F0] flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E7E9E2] text-sm font-semibold text-[#26312A] hover:bg-[#FFFFFF] transition-colors"
          >
            Close
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {onPrepareDocuments && (
              <button
                onClick={() => {
                  onClose();
                  onPrepareDocuments(scheme);
                }}
                className="px-4 py-2.5 rounded-xl border border-[#4D6B53]/30 bg-[#FFFFFF] text-[#173F2B] text-sm font-semibold hover:bg-[#DCE8D3]/50 transition-colors shadow-xs"
              >
                Prepare Documents
              </button>
            )}

            {onCheckEligibility && (
              <button
                onClick={() => {
                  onClose();
                  onCheckEligibility(scheme);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#173F2B] text-[#FFFFFF] text-sm font-semibold hover:bg-[#0f2c1e] transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-[#DCE8D3]" />
                Check My Eligibility
              </button>
            )}

            {onStartApplication && (
              <button
                onClick={() => {
                  onClose();
                  onStartApplication(scheme);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#4D6B53] text-[#FFFFFF] text-sm font-semibold hover:bg-[#3d5542] transition-colors shadow-xs flex items-center gap-1.5"
              >
                Apply / Guide
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
