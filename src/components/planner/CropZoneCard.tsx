'use client';

import React, { useState } from 'react';
import { FarmZone } from '@/types';
import { INDIAN_CROPS_DATABASE } from './agronomy-rules';
import {
  Sprout,
  Calendar,
  IndianRupee,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Trash2,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';

export interface CropZoneCardProps {
  zone: FarmZone;
  index: number;
  totalFarmAcres: number;
  isSelected?: boolean;
  onSelect?: () => void;
  onUpdate: (updated: Partial<FarmZone>) => void;
  onDelete: () => void;
  evidenceStatus?: 'supported' | 'partial' | 'insufficient_data';
  evidenceRationale?: string;
  missingInformation?: string[];
  citations?: Array<{ title: string; source: string; url?: string }>;
}

export function CropZoneCard({
  zone,
  index,
  totalFarmAcres,
  isSelected = false,
  onSelect,
  onUpdate,
  onDelete,
  evidenceStatus = 'supported',
  evidenceRationale,
  missingInformation = [],
  citations = [],
}: CropZoneCardProps) {
  const [showEvidence, setShowEvidence] = useState(false);

  // Find crop master data
  const cropData =
    INDIAN_CROPS_DATABASE.find(
      (c) => c.name.toLowerCase() === (zone.cropName || '').toLowerCase()
    ) || INDIAN_CROPS_DATABASE[0];

  const acres = zone.areaAcres || 0;
  const pctOfFarm = totalFarmAcres > 0 ? ((acres / totalFarmAcres) * 100).toFixed(1) : '0';

  const expectedYieldTonnes =
    zone.targetYieldTonnes ||
    Number((acres * (cropData?.expectedYieldTonnesPerAcre || 1.2)).toFixed(1));

  const estimatedProfitInr = Math.round(
    acres * (cropData?.estimatedNetProfitInrPerAcre || 40000)
  );

  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl border p-4 transition-all duration-150 cursor-pointer ${
        isSelected
          ? 'border-[#173F2B] bg-[#F7F7F0]/60 shadow-xs ring-2 ring-[#173F2B]/15'
          : 'border-[#E7E9E2] bg-white hover:border-[#173F2B]/40 hover:shadow-xs'
      }`}
    >
      {/* Top Header: Zone Name, Color Chip, Actions */}
      <div className="flex items-center justify-between gap-2 border-b border-[#E7E9E2] pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="h-4 w-4 rounded-full shadow-xs shrink-0"
            style={{ backgroundColor: zone.color || cropData?.color || '#173F2B' }}
          />
          <div>
            <h4 className="text-sm font-bold text-[#173F2B] flex items-center gap-2 font-heading">
              <span>{zone.name || `Sector ${index + 1}: ${zone.cropName || 'Crop'}`}</span>
              <span className="rounded-full bg-[#DCE8D3] px-2 py-0.5 text-[10px] font-semibold text-[#173F2B]">
                {pctOfFarm}% of Farm
              </span>
            </h4>
            <p className="text-xs text-[#26312A]/60 font-sans">
              {cropData?.scientificName || 'Cultivated Crop Parcel'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-xl p-1.5 text-[#26312A]/40 hover:bg-[#F7F7F0] hover:text-[#B9784F] transition"
          title="Delete Zone"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Inputs: Crop, Variety, Acreage */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Crop Selection */}
        <div>
          <label className="block text-[11px] font-semibold text-[#26312A]/70 mb-1">
            Crop Type
          </label>
          <select
            value={zone.cropName || cropData.name}
            onChange={(e) => {
              const selectedCrop = INDIAN_CROPS_DATABASE.find((c) => c.name === e.target.value);
              onUpdate({
                cropName: e.target.value,
                cropVariety: selectedCrop?.defaultVariety || '',
                color: selectedCrop?.color,
              });
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] px-3 py-2 text-xs font-medium text-[#26312A] focus:border-[#173F2B] focus:bg-white focus:outline-hidden"
          >
            {INDIAN_CROPS_DATABASE.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name} ({c.season})
              </option>
            ))}
          </select>
        </div>

        {/* Variety Selection */}
        <div>
          <label className="block text-[11px] font-semibold text-[#26312A]/70 mb-1">
            Seed Variety
          </label>
          <select
            value={zone.cropVariety || cropData.defaultVariety}
            onChange={(e) => onUpdate({ cropVariety: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] px-3 py-2 text-xs font-medium text-[#26312A] focus:border-[#173F2B] focus:bg-white focus:outline-hidden"
          >
            {cropData.varieties.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Acreage Input */}
        <div>
          <label className="block text-[11px] font-semibold text-[#26312A]/70 mb-1">
            Assigned Acreage
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0.1"
              max={totalFarmAcres || 100}
              value={acres || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                onUpdate({
                  areaAcres: val,
                  areaSqM: Math.round(val * 4046.856),
                });
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] px-3 py-2 pr-12 text-xs font-bold text-[#173F2B] focus:border-[#173F2B] focus:bg-white focus:outline-hidden"
            />
            <span className="absolute right-3 top-2 text-[11px] font-medium text-[#26312A]/50">
              Acres
            </span>
          </div>
        </div>
      </div>

      {/* Projections & Economics Badge with Harvest Gold accents */}
      <div className="mt-3 flex flex-wrap items-center justify-between rounded-xl bg-[#F7F7F0] border border-[#E7E9E2] p-2.5 text-xs text-[#26312A] gap-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-[#6F9B55] shrink-0" />
          <span className="text-[#26312A]/60">Est. Yield:</span>
          <span className="font-semibold text-[#26312A]">{expectedYieldTonnes} Tonnes</span>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg bg-[#F1D98A]/35 px-2 py-0.5 border border-[#F1D98A]/60">
          <IndianRupee className="h-3.5 w-3.5 text-[#173F2B] shrink-0" />
          <span className="text-[#26312A]/70">Net Profit:</span>
          <span className="font-bold text-[#173F2B]">
            ₹{estimatedProfitInr.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-[#26312A]/60 shrink-0" />
          <span className="text-[#26312A]/60">Duration:</span>
          <span className="font-semibold text-[#26312A]">
            {cropData.durationDays} Days
          </span>
        </div>
      </div>

      {/* AI Evidence Drawer Toggle */}
      <div className="mt-3 pt-2.5 border-t border-[#E7E9E2] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
              evidenceStatus === 'supported'
                ? 'bg-[#DCE8D3] text-[#173F2B] border-[#DCE8D3]'
                : 'bg-[#F7F7F0] text-[#B9784F] border-[#B9784F]/40'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>AI Evidence: {evidenceStatus === 'supported' ? 'Verified' : 'Partial'}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowEvidence((v) => !v);
          }}
          className="flex items-center gap-1 text-xs font-semibold text-[#173F2B] hover:text-[#173F2B]/80"
        >
          <span>{showEvidence ? 'Hide Rationale' : 'View Soil & Scientific Evidence'}</span>
          {showEvidence ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expanded AI Agronomic Evidence Content */}
      {showEvidence && (
        <div className="mt-3 rounded-2xl border border-[#E7E9E2] bg-[#F7F7F0] p-3.5 text-xs text-[#26312A] space-y-2.5">
          {/* Soil Suitability */}
          <div>
            <h5 className="font-bold text-[#173F2B] flex items-center gap-1 mb-0.5">
              <Sprout className="h-3.5 w-3.5 text-[#173F2B]" />
              <span>Soil & Agronomic Suitability</span>
            </h5>
            <p className="text-[#26312A]/80 leading-relaxed text-[11px]">
              {evidenceRationale || cropData.soilSuitabilityRation['Medium Black Soil (Regur)'] || cropData.soilSuitabilityRation.default}
            </p>
          </div>

          {/* Missing Information Alert with Earth Clay accent */}
          {missingInformation.length > 0 && (
            <div className="rounded-xl border border-[#B9784F]/30 bg-white p-2.5 text-[#26312A]">
              <div className="flex items-center gap-1 font-bold text-[11px] text-[#B9784F] mb-0.5">
                <AlertTriangle className="h-3.5 w-3.5 text-[#B9784F] shrink-0" />
                <span>Explicit Data Gaps (Recommended Verification):</span>
              </div>
              <ul className="list-disc list-inside text-[10.5px] text-[#26312A]/80 space-y-0.5">
                {missingInformation.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Verified Citations */}
          {citations.length > 0 && (
            <div className="pt-1 text-[10.5px] text-[#26312A]/70">
              <span className="font-semibold text-[#173F2B] flex items-center gap-1">
                <BookOpen className="h-3 w-3 text-[#173F2B]" />
                <span>Authoritative References:</span>
              </span>
              <div className="mt-0.5 space-y-0.5">
                {citations.map((c, i) => (
                  <div key={i} className="text-[#26312A]/80">
                    • <strong>{c.title}</strong> — {c.source}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
