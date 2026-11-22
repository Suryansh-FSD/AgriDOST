'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  X,
  ExternalLink,
  ArrowRight,
  Info,
  Check,
  HelpCircle,
  Building,
  Sparkles,
} from 'lucide-react';
import { GovernmentScheme, SchemeDocumentRequirement, Farm } from '@/types';

interface DocumentAssistantProps {
  scheme: GovernmentScheme;
  farm?: Farm;
  isOpen: boolean;
  onClose: () => void;
  onProceedToApply?: (scheme: GovernmentScheme) => void;
}

type DocStatus = 'available' | 'missing' | 'in_progress';

export function DocumentAssistant({
  scheme,
  farm,
  isOpen,
  onClose,
  onProceedToApply,
}: DocumentAssistantProps) {
  // Local state to track document readiness status by documentId
  const [docStatuses, setDocStatuses] = useState<Record<string, DocStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Initialize or load saved state from localStorage for this scheme & farm
  useEffect(() => {
    if (!scheme) return;
    const storageKey = `agridost_doc_checklist_${scheme.id}_${farm?.id || 'default'}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setDocStatuses(JSON.parse(saved));
      } else {
        // Default: mark standard common docs like Aadhaar as 'available' or 'in_progress'
        const initial: Record<string, DocStatus> = {};
        scheme.requiredDocuments.forEach((doc) => {
          if (doc.category === 'identity') {
            initial[doc.documentId] = 'available';
          } else {
            initial[doc.documentId] = 'missing';
          }
        });
        setDocStatuses(initial);
      }
    } catch {
      // Fallback
    }
  }, [scheme, farm]);

  // Persist to local storage
  const updateDocStatus = (docId: string, status: DocStatus) => {
    setDocStatuses((prev) => {
      const updated = { ...prev, [docId]: status };
      const storageKey = `agridost_doc_checklist_${scheme.id}_${farm?.id || 'default'}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save document checklist locally', err);
      }
      return updated;
    });
  };

  // Readiness Metrics
  const metrics = useMemo(() => {
    const totalDocs = scheme.requiredDocuments.length;
    const mandatoryDocs = scheme.requiredDocuments.filter((d) => d.mandatory);
    const mandatoryTotal = mandatoryDocs.length;

    let mandatoryReady = 0;
    let totalReady = 0;
    let totalInProgress = 0;
    let totalMissing = 0;

    scheme.requiredDocuments.forEach((doc) => {
      const status = docStatuses[doc.documentId] || 'missing';
      if (status === 'available') {
        totalReady++;
        if (doc.mandatory) mandatoryReady++;
      } else if (status === 'in_progress') {
        totalInProgress++;
      } else {
        totalMissing++;
      }
    });

    const readinessPct =
      mandatoryTotal > 0 ? Math.round((mandatoryReady / mandatoryTotal) * 100) : 100;

    return {
      totalDocs,
      mandatoryTotal,
      mandatoryReady,
      totalReady,
      totalInProgress,
      totalMissing,
      readinessPct,
      isFullyReady: mandatoryReady === mandatoryTotal,
    };
  }, [scheme.requiredDocuments, docStatuses]);

  // Print or Copy checklist
  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const summary = [
      `AgriDOST Document Preparation Checklist`,
      `Scheme: ${scheme.name} (${scheme.shortName})`,
      `Farm: ${farm?.name || 'My Farm'}`,
      `Readiness: ${metrics.readinessPct}% (${metrics.mandatoryReady}/${metrics.mandatoryTotal} Mandatory Documents Ready)`,
      `\nDocument Details:`,
      ...scheme.requiredDocuments.map((d) => {
        const st = docStatuses[d.documentId] || 'missing';
        return `- [${st.toUpperCase()}] ${d.name} (${d.mandatory ? 'Mandatory' : 'Optional'}) | Authority: ${d.issuingAuthority}`;
      }),
      `\nPrivacy Note: Prepared offline with AgriDOST. Take this list to your local CSC or Talathi office.`,
    ].join('\n');

    navigator.clipboard.writeText(summary);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-xs transition-opacity duration-200">
      <div
        className="relative w-full max-w-4xl bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#E7E9E2] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-[#E7E9E2] bg-gradient-to-r from-[#F7F7F0] to-[#FFFFFF] relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-[#26312A]/60 hover:text-[#26312A] hover:bg-[#E7E9E2]/60 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#DCE8D3] text-[#173F2B] border border-[#4D6B53]/20">
              <FileText className="w-3.5 h-3.5 text-[#173F2B]" />
              Document Preparation Assistant
            </span>
            <span className="text-xs font-medium text-[#26312A]/60">
              {scheme.shortName}
            </span>
          </div>

          <h2 className="text-2xl font-bold font-heading text-[#173F2B]">
            Required Documents Checklist
          </h2>
          <p className="text-sm text-[#26312A]/70 mt-1">
            Prepare every verified document before visiting your local CSC center or applying on {scheme.sourceName}.
          </p>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Privacy & Anti-Leak Assurance Box */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-950 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-950 mb-0.5">
                Zero Sensitive Data Leak Guarantee
              </p>
              <p className="leading-relaxed text-emerald-900/90">
                AgriDOST never requests you to upload full Aadhaar card scans, bank passwords, or sensitive identity proofs. This checklist tracks your physical and digital folder readiness strictly on your device so you never face application rejections at the portal.
              </p>
            </div>
          </div>

          {/* Readiness Dashboard Bar */}
          <div className="bg-[#F7F7F0] p-4 rounded-xl border border-[#E7E9E2] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#4D6B53]">
                  Preparation Progress
                </span>
                <h3 className="text-lg font-bold text-[#173F2B]">
                  {metrics.mandatoryReady} of {metrics.mandatoryTotal} Mandatory Documents Ready
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySummary}
                  className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E7E9E2] text-xs font-semibold text-[#173F2B] hover:bg-[#DCE8D3]/50 transition-colors shadow-xs"
                >
                  {copiedNotification ? 'Copied to Clipboard!' : 'Copy Summary'}
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E7E9E2] text-xs font-semibold text-[#26312A] hover:bg-[#DCE8D3]/50 transition-colors shadow-xs flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Checklist
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#E7E9E2] h-3 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  metrics.readinessPct === 100
                    ? 'bg-emerald-600'
                    : metrics.readinessPct >= 50
                    ? 'bg-[#4D6B53]'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${metrics.readinessPct}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-[#26312A]/70 pt-1">
              <span>{metrics.readinessPct}% Preparation Complete</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Ready: {metrics.totalReady}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  In Progress: {metrics.totalInProgress}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  Missing: {metrics.totalMissing}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Document List */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#4D6B53]">
              Checklist of Required Items
            </h3>

            <div className="space-y-3">
              {scheme.requiredDocuments.map((doc, idx) => {
                const currentStatus = docStatuses[doc.documentId] || 'missing';

                return (
                  <div
                    key={doc.documentId}
                    className={`p-4 rounded-xl border transition-all ${
                      currentStatus === 'available'
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : currentStatus === 'in_progress'
                        ? 'bg-sky-50/40 border-sky-200'
                        : 'bg-[#FFFFFF] border-[#E7E9E2]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Left: Document details */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-[#4D6B53]">
                            #{idx + 1}
                          </span>
                          <h4 className="text-base font-bold text-[#173F2B]">
                            {doc.name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              doc.mandatory
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {doc.mandatory ? 'MANDATORY' : 'OPTIONAL'}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F7F7F0] text-[#26312A]/70 border border-[#E7E9E2]">
                            {doc.category.replace('_', ' ')}
                          </span>
                        </div>

                        <p className="text-xs text-[#26312A]/80 leading-relaxed">
                          {doc.description}
                        </p>

                        {/* Procurement / Issuing info */}
                        <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#26312A]/70">
                          <span className="flex items-center gap-1 font-medium text-[#173F2B]">
                            <Building className="w-3.5 h-3.5 text-[#4D6B53]" />
                            Issuing Authority: {doc.issuingAuthority}
                          </span>
                          <span className="text-[#4D6B53] font-medium">
                            How to get: {doc.procurementMethod}
                          </span>
                        </div>
                      </div>

                      {/* Right: Status selector buttons */}
                      <div className="flex sm:flex-col items-center sm:items-end gap-1.5 shrink-0">
                        <div className="inline-flex rounded-lg border border-[#E7E9E2] p-0.5 bg-[#F7F7F0]">
                          <button
                            type="button"
                            onClick={() => updateDocStatus(doc.documentId, 'available')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                              currentStatus === 'available'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-[#26312A]/70 hover:text-[#26312A]'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Ready
                          </button>
                          <button
                            type="button"
                            onClick={() => updateDocStatus(doc.documentId, 'in_progress')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                              currentStatus === 'in_progress'
                                ? 'bg-sky-600 text-white shadow-xs'
                                : 'text-[#26312A]/70 hover:text-[#26312A]'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            In Progress
                          </button>
                          <button
                            type="button"
                            onClick={() => updateDocStatus(doc.documentId, 'missing')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                              currentStatus === 'missing'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-[#26312A]/70 hover:text-[#26312A]'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Missing
                          </button>
                        </div>

                        <span className="text-[11px] text-[#26312A]/50">
                          {currentStatus === 'available'
                            ? 'Ready for submission'
                            : currentStatus === 'in_progress'
                            ? 'Applied at CSC / Tehsil'
                            : 'Needs to be obtained'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t border-[#E7E9E2] bg-[#F7F7F0] flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E7E9E2] text-sm font-semibold text-[#26312A] hover:bg-[#FFFFFF] transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-3">
            {metrics.isFullyReady ? (
              <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                All mandatory documents prepared!
              </span>
            ) : (
              <span className="text-xs text-[#26312A]/70">
                {metrics.mandatoryTotal - metrics.mandatoryReady} mandatory document(s) remaining
              </span>
            )}

            {onProceedToApply && (
              <button
                onClick={() => {
                  onClose();
                  onProceedToApply(scheme);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#173F2B] text-[#FFFFFF] text-sm font-semibold hover:bg-[#0f2c1e] transition-colors shadow-xs flex items-center gap-2"
              >
                Proceed to Application Guide
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
