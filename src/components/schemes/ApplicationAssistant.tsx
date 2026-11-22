'use client';

import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  Save,
  X,
  Building,
  HelpCircle,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  GovernmentScheme,
  FarmerSchemeApplication,
  SchemeApplicationStatus,
  Farm,
} from '@/types';
import { saveApplication, getApplications } from '@/lib/supabase';

interface ApplicationAssistantProps {
  scheme: GovernmentScheme;
  farm?: Farm;
  isOpen: boolean;
  onClose: () => void;
  onApplicationSaved?: (app: FarmerSchemeApplication) => void;
}

export function ApplicationAssistant({
  scheme,
  farm,
  isOpen,
  onClose,
  onApplicationSaved,
}: ApplicationAssistantProps) {
  const farmId = farm?.id || 'default-farm';

  // Form State
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [submissionDate, setSubmissionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<SchemeApplicationStatus>('submitted');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [existingAppId, setExistingAppId] = useState<string | null>(null);

  // Load existing application if already recorded for this scheme & farm
  useEffect(() => {
    if (!isOpen || !scheme) return;

    async function loadExisting() {
      try {
        const apps = await Promise.resolve(getApplications(farmId));
        const found = apps.find((a) => a.schemeId === scheme.id);
        if (found) {
          setExistingAppId(found.id);
          setReferenceNumber(found.applicationReferenceNumber || '');
          if (found.submissionDate) {
            setSubmissionDate(found.submissionDate.split('T')[0]);
          }
          setStatus(found.status);
          setNotes(found.notes || '');
        } else {
          setExistingAppId(null);
          setReferenceNumber('');
          setSubmissionDate(new Date().toISOString().split('T')[0]);
          setStatus('submitted');
          setNotes('');
        }
      } catch (err) {
        console.warn('Could not load existing application', err);
      }
    }

    loadExisting();
  }, [isOpen, scheme, farmId]);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheme) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const now = new Date().toISOString();
      const newApp: FarmerSchemeApplication = {
        id: existingAppId || `app-${scheme.id}-${farmId}-${Date.now()}`,
        farmId: farmId,
        schemeId: scheme.id,
        status: status,
        statusSource: 'user_reported', // Zero fake integration: Honest user-reported
        applicationReferenceNumber: referenceNumber.trim() || undefined,
        submissionDate: submissionDate ? new Date(submissionDate).toISOString() : now,
        portalUrl: scheme.officialApplicationUrl || scheme.officialInfoUrl || '',
        nextAction:
          status === 'submitted'
            ? 'Track physical verification or biometric approval with local Agriculture Officer'
            : status === 'under_review'
            ? 'Monitor official portal for beneficiary list release'
            : status === 'approved'
            ? 'Verify installment deposit in Aadhaar-linked bank account'
            : 'Submit required documents at portal or nearest CSC',
        notes: notes.trim() || undefined,
        documentsStatus: {},
        createdAt: now,
        updatedAt: now,
        isDemo: farm?.isDemo ?? false,
      };

      await Promise.resolve(saveApplication(newApp));
      setSaveSuccess(true);
      if (onApplicationSaved) {
        onApplicationSaved(newApp);
      }

      // Hide success message after 4 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 4000);
    } catch (err) {
      console.error('Failed to save application tracker', err);
    } finally {
      setIsSaving(false);
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
              <FileCheck className="w-3.5 h-3.5 text-[#173F2B]" />
              Official Portal Application Walkthrough
            </span>
            <span className="text-xs font-medium text-[#26312A]/60">
              {scheme.shortName}
            </span>
          </div>

          <h2 className="text-2xl font-bold font-heading text-[#173F2B]">
            Apply & Track Your Application
          </h2>
          <p className="text-sm text-[#26312A]/70 mt-1">
            Submit your application on the official government website and record your acknowledgement receipt below.
          </p>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Official Portal Direct Access Action Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#173F2B] to-[#26312A] text-white space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-[#DCE8D3]">
                Step 1: Open Official Government Portal
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/90">
                Official Source
              </span>
            </div>

            <h3 className="text-lg font-bold">
              {scheme.sourceName || 'Government Agriculture Portal'}
            </h3>
            <p className="text-xs text-white/80 leading-relaxed">
              AgriDOST does not take your password or submit on your behalf. Click below to open the authentic portal in a new tab to complete your submission safely:
            </p>

            <div className="pt-1">
              <a
                href={scheme.officialApplicationUrl || scheme.officialInfoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#DCE8D3] text-[#173F2B] text-sm font-bold hover:bg-white transition-all shadow-sm"
              >
                <span>Launch {scheme.shortName} Portal</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <p className="text-[11px] text-white/60">
              Portal URL: {scheme.officialApplicationUrl || scheme.officialInfoUrl}
            </p>
          </div>

          {/* 4-Step Portal Submission Guide */}
          <div className="bg-[#F7F7F0] p-4 rounded-xl border border-[#E7E9E2]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#4D6B53] mb-3">
              Official Portal Application Procedure
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-[#E7E9E2] space-y-1">
                <span className="font-bold text-[#173F2B] block">1. Authentication & e-KYC</span>
                <p className="text-[#26312A]/70">
                  Login using your registered mobile number and verify via Aadhaar OTP or biometric at CSC.
                </p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-[#E7E9E2] space-y-1">
                <span className="font-bold text-[#173F2B] block">2. Land & Crop Details</span>
                <p className="text-[#26312A]/70">
                  Enter Village, Khata / Khasra / Survey Number, and land area matching your 7/12 extract or RoR.
                </p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-[#E7E9E2] space-y-1">
                <span className="font-bold text-[#173F2B] block">3. Bank DBT Verification</span>
                <p className="text-[#26312A]/70">
                  Provide your Aadhaar-seeded bank account IFSC and Account number for direct transfers.
                </p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-[#E7E9E2] space-y-1">
                <span className="font-bold text-[#173F2B] block">4. Receipt & Ack Number</span>
                <p className="text-[#26312A]/70">
                  Save the Application Reference Number or Acknowledgement Receipt PDF from the screen.
                </p>
              </div>
            </div>
          </div>

          {/* Form to Record to AgriDOST Tracker */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#4D6B53]">
                Step 2: Save to My Application Tracker
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                User-Reported Status
              </span>
            </div>

            {saveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Application successfully saved to your offline tracker!</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Application Reference Number */}
              <div>
                <label className="block text-xs font-bold text-[#173F2B] mb-1">
                  Application Reference / Acknowledgement Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH-PMKISAN-2026-98124"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9E2] bg-white text-sm text-[#26312A] focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20"
                />
                <span className="text-[11px] text-[#26312A]/60 mt-0.5 block">
                  Found on the official receipt or SMS acknowledgement.
                </span>
              </div>

              {/* Submission Date */}
              <div>
                <label className="block text-xs font-bold text-[#173F2B] mb-1">
                  Date of Submission *
                </label>
                <input
                  type="date"
                  required
                  value={submissionDate}
                  onChange={(e) => setSubmissionDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9E2] bg-white text-sm text-[#26312A] focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20"
                />
              </div>
            </div>

            {/* Application Status Selector */}
            <div>
              <label className="block text-xs font-bold text-[#173F2B] mb-1">
                Current Status (User-Reported)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'submitted', label: 'Submitted', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                  { id: 'under_review', label: 'Under Review', color: 'bg-sky-50 border-sky-200 text-sky-800' },
                  { id: 'approved', label: 'Approved', color: 'bg-green-100 border-green-300 text-green-900' },
                  { id: 'preparing_documents', label: 'Draft / Incomplete', color: 'bg-amber-50 border-amber-200 text-amber-800' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStatus(item.id as SchemeApplicationStatus)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                      status === item.id
                        ? `${item.color} ring-2 ring-[#173F2B] font-bold shadow-xs`
                        : 'bg-white border-[#E7E9E2] text-[#26312A]/70 hover:bg-[#F7F7F0]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-[#173F2B] mb-1">
                Filing Notes & Follow-Up Details (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Applied via Baramati CSC center, operator Ramesh. Receipt stored in green file."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9E2] bg-white text-sm text-[#26312A] focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20"
              />
            </div>

            {/* Honesty & Anti-Hallucination Disclaimer */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-950 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Verification Standard:</strong> Status recorded here is farmer-reported. AgriDOST does not fabricate government approvals or claim direct integration with closed state portals. Always retain your original physical receipts.
              </span>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#E7E9E2] text-sm font-semibold text-[#26312A] hover:bg-[#F7F7F0] transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-[#173F2B] text-white text-sm font-bold hover:bg-[#0f2c1e] transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : existingAppId ? 'Update Tracker' : 'Save to My Tracker'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
