'use client';

import React from 'react';
import { Farm } from '@/types';
import { 
  MapPin, 
  User, 
  FileText, 
  Droplets, 
  Layers, 
  Wheat, 
  Sparkles,
  ExternalLink 
} from 'lucide-react';

interface FarmSummaryCardProps {
  farm?: Farm;
  onNavigateToTab: (tab: 'mapping' | 'planner' | 'health' | 'operations' | 'drone') => void;
}

export function FarmSummaryCard({ farm, onNavigateToTab }: FarmSummaryCardProps) {
  if (!farm) return null;

  const areaHectares = (farm.areaAcres * 0.404686).toFixed(2);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E7E9E2] bg-white p-5 sm:p-6 shadow-xs">
      {/* Top Banner Row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#173F2B] font-heading">
              {farm.name}
            </h2>
            {farm.isDemo && (
              <span className="rounded-full bg-[#F1D98A]/60 px-2.5 py-0.5 text-[10px] font-bold text-[#26312A] border border-[#F1D98A]">
                [DEMO DATA]
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-[#26312A]/70">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-[#173F2B]" />
              {farm.location || 'Maharashtra, India'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-[#26312A]/50" />
              {farm.ownerName || 'Lead Farmer'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-[#26312A]/50" />
              Survey: {farm.surveyNumber || 'SN-Verified'}
            </span>
          </div>
        </div>

        {/* Quick CTA to map boundary */}
        <button
          onClick={() => onNavigateToTab('mapping')}
          className="flex items-center gap-1.5 rounded-2xl border border-[#E7E9E2] bg-[#F7F7F0] px-3.5 py-2 text-xs font-semibold text-[#173F2B] hover:bg-[#DCE8D3]/60 transition shadow-2xs font-heading"
        >
          <span>Cadastral Workspace</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Grid of Key Agronomic Attributes */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-4 border-t border-[#E7E9E2]">
        <div className="rounded-2xl bg-[#F7F7F0] p-3 border border-[#E7E9E2]">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-[#26312A]/70 font-heading">
            <Layers className="h-3.5 w-3.5 text-[#173F2B]" />
            <span>Soil Taxonomy</span>
          </div>
          <p className="mt-1 text-xs font-bold text-[#173F2B] truncate font-heading">
            {farm.soilType || 'Medium Black (Regur)'}
          </p>
        </div>

        <div className="rounded-2xl bg-[#F7F7F0] p-3 border border-[#E7E9E2]">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-[#26312A]/70 font-heading">
            <Droplets className="h-3.5 w-3.5 text-[#6F9B55]" />
            <span>Irrigation Facility</span>
          </div>
          <p className="mt-1 text-xs font-bold text-[#173F2B] truncate font-heading">
            {farm.waterSource || 'Drip & Bore-well'}
          </p>
        </div>

        <div className="rounded-2xl bg-[#F7F7F0] p-3 border border-[#E7E9E2]">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-[#26312A]/70 font-heading">
            <Wheat className="h-3.5 w-3.5 text-[#B9784F]" />
            <span>Primary Agronomy</span>
          </div>
          <p className="mt-1 text-xs font-bold text-[#173F2B] truncate font-heading">
            {farm.primaryCrop || 'Cotton, Soybean'}
          </p>
        </div>

        <div className="rounded-2xl bg-[#DCE8D3]/60 p-3 border border-[#DCE8D3]">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-[#173F2B] font-heading">
            <Sparkles className="h-3.5 w-3.5 text-[#173F2B]" />
            <span>Usable Farmland</span>
          </div>
          <p className="mt-1 text-xs font-bold text-[#173F2B] font-heading">
            {farm.areaAcres.toFixed(1)} Acres ({areaHectares} Ha)
          </p>
        </div>
      </div>
    </div>
  );
}
