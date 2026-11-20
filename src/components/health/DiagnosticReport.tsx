'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Save,
  Droplets,
  RotateCcw,
  BookOpen,
  Leaf,
  Activity,
  Check,
} from 'lucide-react';
import { AIHealthResponse } from '@/lib/ai/schemas';
import { HealthObservation, SprayOperation } from '@/types';
import { saveHealthObservation, saveSprayOperation } from '@/lib/data/storage';

export interface DiagnosticReportProps {
  report: AIHealthResponse;
  imagePreviewUrl: string | null;
  farmId: string;
  zoneId?: string;
  onSaveToRecords?: (savedRecord: HealthObservation) => void;
  onPlanTreatmentSpray?: (observation: HealthObservation, sprayOp?: SprayOperation) => void;
  onReset?: () => void;
}

export function DiagnosticReport({
  report,
  imagePreviewUrl,
  farmId,
  zoneId,
  onSaveToRecords,
  onPlanTreatmentSpray,
  onReset,
}: DiagnosticReportProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isSprayPlanned, setIsSprayPlanned] = useState(false);
  const [showLimitations, setShowLimitations] = useState(true);
  const [showSources, setShowSources] = useState(false);

  // Severity color badge styling aligned with AgriDOST palette
  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return {
          bg: 'bg-[#B9784F]/15 border-[#B9784F]/30 text-[#9E4E28]',
          dot: 'bg-[#B9784F] animate-pulse',
          label: 'CRITICAL SEVERITY',
        };
      case 'high':
        return {
          bg: 'bg-[#B9784F]/10 border-[#B9784F]/25 text-[#B9784F]',
          dot: 'bg-[#B9784F]',
          label: 'HIGH SEVERITY',
        };
      case 'medium':
        return {
          bg: 'bg-[#F1D98A]/30 border-[#F1D98A] text-[#8C6D1F]',
          dot: 'bg-[#8C6D1F]',
          label: 'MODERATE SEVERITY',
        };
      case 'low':
      default:
        return {
          bg: 'bg-[#DCE8D3]/60 border-[#6F9B55]/30 text-[#173F2B]',
          dot: 'bg-[#6F9B55]',
          label: 'LOW SEVERITY',
        };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'supported':
        return {
          label: 'Strong Visual Correlation',
          bg: 'bg-[#DCE8D3] text-[#173F2B] border-[#6F9B55]/30',
        };
      case 'partial':
        return {
          label: 'Partial / Ambiguous Evidence',
          bg: 'bg-[#F1D98A]/30 text-[#8C6D1F] border-[#F1D98A]',
        };
      case 'insufficient_data':
      default:
        return {
          label: 'Insufficient Optical Detail',
          bg: 'bg-[#B9784F]/10 text-[#B9784F] border-[#B9784F]/30',
        };
    }
  };

  const severityBadge = getSeverityBadge(report.severity || 'medium');
  const statusBadge = getStatusBadge(report.status);

  // Handle Save to LocalStorage
  const handleSaveToRecords = () => {
    const recordId = `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const observationRecord: HealthObservation = {
      id: recordId,
      farmId,
      zoneId: zoneId || undefined,
      cropAffected: report.cropAffected,
      detectedDisease: report.detectedCondition,
      imagePreviewUrl: imagePreviewUrl || undefined,
      symptoms: report.symptoms,
      possibleCauses: report.possibleCauses,
      confidenceNote: `Visual correlation score: ${report.confidenceScore}%. ${report.disclaimer}`,
      confidence: report.confidenceScore,
      severity: report.severity || 'medium',
      detectionMethod: 'Gemini 2.5 Flash Vision Scanner',
      recommendedAction: report.recommendedAction,
      chemicalRecommendation: report.chemicalRecommendation,
      status: 'ai_generated',
      missingInformation: report.missingInformation,
      limitations: report.limitations,
      sources: report.sources,
      createdAt: new Date().toISOString(),
      detectedAt: new Date().toISOString(),
    };

    saveHealthObservation(observationRecord);
    setIsSaved(true);
    if (onSaveToRecords) {
      onSaveToRecords(observationRecord);
    }
  };

  // Handle Plan Treatment Spray
  const handlePlanTreatmentSpray = () => {
    const sprayOpId = `spray-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const observationRecord: HealthObservation = {
      id: `obs-${Date.now()}`,
      farmId,
      zoneId: zoneId || undefined,
      cropAffected: report.cropAffected,
      detectedDisease: report.detectedCondition,
      symptoms: report.symptoms,
      possibleCauses: report.possibleCauses,
      severity: report.severity || 'medium',
      status: 'ai_generated',
      createdAt: new Date().toISOString(),
    };

    const chemical = report.chemicalRecommendation?.name || report.organicAlternative || 'Targeted Bio-Control Spray';
    const dosage = report.chemicalRecommendation?.dosage || 'As per package label recommendations';

    // Scheduled for next morning optimal spray window (06:30 AM)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6, 30, 0, 0);

    const newSprayOp: SprayOperation = {
      id: sprayOpId,
      farmId,
      zoneId: zoneId || undefined,
      operationType:
        report.detectedCondition.toLowerCase().includes('fungal') || report.detectedCondition.toLowerCase().includes('blight')
          ? 'Fungicide'
          : report.detectedCondition.toLowerCase().includes('virus') ||
            report.detectedCondition.toLowerCase().includes('fly') ||
            report.detectedCondition.toLowerCase().includes('worm')
          ? 'Pesticide'
          : 'Foliar Fertilizer',
      productName: chemical,
      dosagePerAcre: dosage,
      dilutionRatio: '1:100 with clean water',
      equipmentType: 'Drone',
      flightAltitudeMeters: 2.5,
      speedKmh: 14,
      windSpeedKmh: 6.5,
      temperatureC: 24,
      humidityPct: 65,
      safetyStatus: 'optimal',
      scheduledTime: tomorrow.toISOString(),
      status: 'scheduled',
      notes: `Generated from AI Health Diagnosis of ${report.cropAffected}: ${report.detectedCondition}. Active: ${chemical}. Field verification required prior to launch.`,
    };

    saveSprayOperation(newSprayOp);
    setIsSprayPlanned(true);
    if (onPlanTreatmentSpray) {
      onPlanTreatmentSpray(observationRecord, newSprayOp);
    }
  };

  return (
    <div className="bg-white border border-[#E7E9E2] rounded-2xl shadow-xs overflow-hidden transition-all duration-300">
      {/* Top Banner: Mandatory Anti-Hallucination Evidence Badge in Refined Earth Clay */}
      <div className="bg-[#B9784F]/10 border-b border-[#B9784F]/20 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider uppercase bg-[#B9784F] text-white shadow-xs">
            <ShieldAlert className="w-3.5 h-3.5" />
            AI-GENERATED — REQUIRES FIELD VERIFICATION
          </span>
          <span className="text-xs text-[#26312A]/80 hidden sm:inline">
            Non-clinical screening based on visible foliar symptoms
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge.bg}`}>
            <Activity className="w-3 h-3" />
            {statusBadge.label}
          </span>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        {/* Header: Crop Affected, Condition & Confidence Dial */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#E7E9E2]">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6F9B55]">
              <Leaf className="w-4 h-4 text-[#6F9B55]" />
              <span>Target Crop: {report.cropAffected}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#173F2B] tracking-tight">
              {report.detectedCondition}
            </h2>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* Severity Pill */}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${severityBadge.bg}`}>
                <span className={`w-2 h-2 rounded-full ${severityBadge.dot}`} />
                {severityBadge.label}
              </span>
              <span className="text-xs text-[#26312A]/70">
                Target Farm: <span className="font-mono font-medium text-[#173F2B]">{farmId}</span>
                {zoneId && (
                  <>
                    {' '}
                    &bull; Zone: <span className="font-mono font-medium text-[#173F2B]">{zoneId}</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Clean Confidence Score Dial in Refined Warm Card */}
          <div className="flex items-center gap-4 bg-[#F7F7F0] p-4 rounded-xl border border-[#E7E9E2] shrink-0">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#E7E9E2]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={
                    report.confidenceScore >= 80
                      ? 'text-[#173F2B]'
                      : report.confidenceScore >= 60
                      ? 'text-[#8C6D1F]'
                      : 'text-[#B9784F]'
                  }
                  strokeDasharray={`${report.confidenceScore}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-sm font-bold text-[#173F2B]">{report.confidenceScore}%</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#26312A]/60 uppercase tracking-wider font-semibold">
                Visual Match
              </div>
              <div className="text-sm font-bold text-[#173F2B]">
                {report.confidenceScore >= 85
                  ? 'High Correlation'
                  : report.confidenceScore >= 70
                  ? 'Moderate Correlation'
                  : 'Inconclusive Pattern'}
              </div>
              <div className="text-[11px] text-[#26312A]/60">Based on 2D foliar vision</div>
            </div>
          </div>
        </div>

        {/* Two-Column Grid: Symptoms & Differential Causes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Observable Physical Symptoms */}
          <div className="bg-[#F7F7F0] p-5 rounded-xl border border-[#E7E9E2] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#173F2B] uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-[#173F2B]" />
              <span>Observable Physical Symptoms</span>
            </div>
            <ul className="space-y-2 text-sm text-[#26312A]">
              {report.symptoms.map((symptom, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#173F2B] mt-2 shrink-0" />
                  <span className="leading-relaxed">{symptom}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Differential Diagnoses & Possible Causes */}
          <div className="bg-[#F7F7F0] p-5 rounded-xl border border-[#E7E9E2] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#B9784F] uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-[#B9784F]" />
              <span>Differential Diagnoses & Causes</span>
            </div>
            <ul className="space-y-2 text-sm text-[#26312A]">
              {report.possibleCauses.map((cause, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B9784F] mt-2 shrink-0" />
                  <span className="leading-relaxed">{cause}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recommended Agronomic Action Plan */}
        <div className="bg-[#DCE8D3]/50 p-5 rounded-xl border border-[#6F9B55]/30 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#173F2B] uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-[#173F2B]" />
            <span>Recommended Agronomic Action Plan</span>
          </div>
          <p className="text-sm text-[#26312A] leading-relaxed">
            {report.recommendedAction}
          </p>
        </div>

        {/* Actionable Treatments: Cultural/Organic Remedies First, Chemical Second */}
        {(report.organicAlternative || report.chemicalRecommendation) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Organic & Cultural Control (Priority) */}
            {report.organicAlternative && (
              <div className="bg-[#DCE8D3]/30 p-4 rounded-xl border border-[#6F9B55]/30 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#173F2B] uppercase tracking-wider">
                  <Leaf className="w-3.5 h-3.5 text-[#173F2B]" />
                  <span>Organic & Cultural Control (Priority)</span>
                </div>
                <div className="text-sm text-[#26312A] font-medium leading-relaxed">
                  {report.organicAlternative}
                </div>
                <div className="text-[11px] text-[#26312A]/60">
                  Recommended for export compliance, soil microbiome health, and integrated pest management (IPM).
                </div>
              </div>
            )}

            {/* 2. Targeted Agrochemical Spray (Advisory) */}
            {report.chemicalRecommendation && (
              <div className="bg-white p-4 rounded-xl border border-[#E7E9E2] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#6F9B55] uppercase tracking-wider">
                  <Droplets className="w-3.5 h-3.5 text-[#6F9B55]" />
                  <span>Standard Agrochemical Prescription (Advisory)</span>
                </div>
                <div className="text-sm font-bold text-[#173F2B]">
                  {report.chemicalRecommendation.name}
                </div>
                <div className="text-xs text-[#26312A] grid grid-cols-2 gap-2 pt-1 border-t border-[#E7E9E2]">
                  <div>
                    <span className="text-[#26312A]/60 block font-medium">Dosage:</span>
                    <span>{report.chemicalRecommendation.dosage}</span>
                  </div>
                  <div>
                    <span className="text-[#26312A]/60 block font-medium">Frequency:</span>
                    <span>{report.chemicalRecommendation.frequency}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expandable Accordion: Missing Field Information & Model Limitations */}
        <div className="border border-[#E7E9E2] rounded-xl overflow-hidden bg-[#F7F7F0]/40">
          <button
            onClick={() => setShowLimitations(!showLimitations)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left text-sm font-semibold text-[#173F2B] hover:bg-[#F7F7F0] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#8C6D1F]" />
              Missing Physical Field Information & Model Limitations ({report.missingInformation.length + report.limitations.length})
            </span>
            {showLimitations ? <ChevronUp className="w-4 h-4 text-[#173F2B]" /> : <ChevronDown className="w-4 h-4 text-[#173F2B]" />}
          </button>

          {showLimitations && (
            <div className="px-5 pb-5 pt-2 space-y-4 border-t border-[#E7E9E2] text-xs">
              <div className="space-y-1.5">
                <span className="font-bold text-[#8C6D1F] uppercase tracking-wider">
                  Missing Field Verification Checks:
                </span>
                <ul className="space-y-1 text-[#26312A] pl-4 list-disc">
                  {report.missingInformation.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#E7E9E2]">
                <span className="font-bold text-[#26312A]/70 uppercase tracking-wider">
                  Optical & Laboratory Screening Limitations:
                </span>
                <ul className="space-y-1 text-[#26312A]/80 pl-4 list-disc">
                  {report.limitations.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Expandable Agronomic Sources & Citations */}
        {report.sources && report.sources.length > 0 && (
          <div className="border border-[#E7E9E2] rounded-xl overflow-hidden bg-[#F7F7F0]/40">
            <button
              onClick={() => setShowSources(!showSources)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left text-sm font-semibold text-[#173F2B] hover:bg-[#F7F7F0] transition-colors"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#6F9B55]" />
                Agronomic Research References & Extension Sources ({report.sources.length})
              </span>
              {showSources ? <ChevronUp className="w-4 h-4 text-[#173F2B]" /> : <ChevronDown className="w-4 h-4 text-[#173F2B]" />}
            </button>

            {showSources && (
              <div className="px-5 pb-5 pt-2 border-t border-[#E7E9E2] space-y-2">
                {report.sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white hover:bg-[#F7F7F0] border border-[#E7E9E2] text-xs font-medium text-[#173F2B] hover:text-[#6F9B55] transition-colors"
                  >
                    <span>{src.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 ml-2 text-[#26312A]/50" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mandatory Agronomic Disclaimer Note */}
        <div className="p-4 rounded-xl bg-[#F7F7F0] border border-[#E7E9E2] flex items-start gap-3">
          <Info className="w-4 h-4 text-[#26312A]/60 mt-0.5 shrink-0" />
          <p className="text-xs text-[#26312A]/70 leading-relaxed italic">
            {report.disclaimer}
          </p>
        </div>

        {/* Actions Bar: Save to Records, Plan Treatment Spray, Rescan */}
        <div className="pt-4 border-t border-[#E7E9E2] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Primary CTA: Save to Farm Health Records */}
            <button
              onClick={handleSaveToRecords}
              disabled={isSaved}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-xs ${
                isSaved
                  ? 'bg-[#DCE8D3] text-[#173F2B] border border-[#6F9B55]/40 cursor-default'
                  : 'bg-[#173F2B] hover:bg-[#123222] active:scale-95 text-white'
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4 text-[#173F2B]" />
                  Saved to Farm Records
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save to Farm Health Records
                </>
              )}
            </button>

            {/* Secondary CTA: Plan Treatment Spray */}
            <button
              onClick={handlePlanTreatmentSpray}
              disabled={isSprayPlanned}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-xs ${
                isSprayPlanned
                  ? 'bg-[#DCE8D3] text-[#173F2B] border border-[#6F9B55]/40 cursor-default'
                  : 'border border-[#E7E9E2] bg-white hover:bg-[#F7F7F0] active:scale-95 text-[#173F2B]'
              }`}
            >
              {isSprayPlanned ? (
                <>
                  <Check className="w-4 h-4 text-[#173F2B]" />
                  Spray Scheduled in Operations
                </>
              ) : (
                <>
                  <Droplets className="w-4 h-4 text-[#6F9B55]" />
                  Plan Treatment Spray
                </>
              )}
            </button>
          </div>

          {/* Reset / Scan Another Leaf */}
          {onReset && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#26312A]/70 hover:text-[#173F2B] hover:bg-[#F7F7F0] border border-[#E7E9E2] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Scan Another Leaf
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
