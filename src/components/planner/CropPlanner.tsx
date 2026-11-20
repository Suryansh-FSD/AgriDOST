'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Farm,
  FarmZone,
  CropPlan,
  CropPlanMode,
} from '@/types';
import {
  getActiveFarm,
  getCropPlans,
  saveCropPlan,
  saveFarmZone,
} from '@/lib/data/storage';
import { DEMO_FARMS } from '@/lib/data/demo-data';
import {
  INDIAN_CROPS_DATABASE,
  generateAICropRecommendations,
} from './agronomy-rules';
import { CropZoneCard } from './CropZoneCard';
import { VectorFarmMap } from '@/components/map/VectorFarmMap';
import { subdividePolygon } from '@/lib/geo/calculations';
import {
  Sprout,
  Sparkles,
  User,
  SlidersHorizontal,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Save,
  PlusCircle,
  PieChart,
  Layers,
  RotateCcw,
} from 'lucide-react';

export interface CropPlannerProps {
  activeFarm?: Farm;
  onPlanSaved?: (plan: CropPlan) => void;
  className?: string;
}

export function CropPlanner({
  activeFarm: initialFarm,
  onPlanSaved,
  className = '',
}: CropPlannerProps) {
  // Active Farm state
  const [farm, setFarm] = useState<Farm | undefined>(() => {
    return initialFarm || (typeof window !== 'undefined' ? getActiveFarm() : undefined) || DEMO_FARMS[0];
  });

  useEffect(() => {
    if (initialFarm) {
      setFarm(initialFarm);
    }
  }, [initialFarm]);

  // Season & Year selector
  const [season, setSeason] = useState<'Kharif' | 'Rabi' | 'Zaid' | 'Annual'>('Rabi');
  const [year] = useState<number>(2026);

  // Planning mode: 'ai_recommended' | 'farmer_selected' | 'combined'
  const [mode, setMode] = useState<CropPlanMode>('ai_recommended');

  // Planned Zones
  const [zones, setZones] = useState<FarmZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // AI Recommendation details state
  const [aiDetails, setAiDetails] = useState<{
    strategy: string;
    missingInfo: string[];
    citations: Array<{ title: string; source: string }>;
  }>({
    strategy: '',
    missingInfo: [],
    citations: [],
  });

  // Saving state & Toast
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Total farm acreage
  const totalFarmAcres = farm?.areaAcres || 24.5;

  // Initialize or generate plan when farm, season or mode changes
  const applyAIRecommendations = useCallback(() => {
    if (!farm) return;

    const farmSoil = farm.soilType || 'Medium Black Soil (Regur)';
    const farmWater = farm.waterSource || 'Drip Irrigation';
    const acreage = farm.areaAcres || 24.5;

    const result = generateAICropRecommendations(farmSoil, farmWater, season, acreage);

    // Subdivide farm boundary polygon for visual map rendering
    const proportions = result.recommendedZones.map((z) => z.percentage / 100);
    const subPolygons = subdividePolygon(farm.boundary, proportions);

    const generatedZones: FarmZone[] = result.recommendedZones.map((rec, idx) => {
      const zoneId = `${farm.id}-crop-zone-${idx + 1}`;
      const geom = subPolygons[idx] || farm.boundary;

      return {
        id: zoneId,
        farmId: farm.id,
        type: 'crop',
        name: `Sector ${String.fromCharCode(65 + idx)}1: ${rec.crop.name} (${rec.variety})`,
        cropName: rec.crop.name,
        cropVariety: rec.variety,
        areaAcres: rec.allocatedAcres,
        areaSqM: Math.round(rec.allocatedAcres * 4046.856),
        color: rec.crop.color,
        geometry: geom,
        targetYieldTonnes: rec.expectedYieldTonnes,
        notes: rec.rationale,
        isDemo: farm.isDemo || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    setZones(generatedZones);
    setSelectedZoneId(generatedZones[0]?.id || null);

    // Collect all missing info & citations
    const allMissing = Array.from(new Set(result.recommendedZones.flatMap((z) => z.missingInfo)));
    const allCitations = result.recommendedZones.flatMap((z) => z.citations);

    setAiDetails({
      strategy: result.overallStrategy,
      missingInfo: allMissing,
      citations: allCitations,
    });
  }, [farm, season]);

  // Load existing plan from storage if present, or generate default
  useEffect(() => {
    if (typeof window === 'undefined' || !farm) return;

    const existingPlans = getCropPlans(farm.id);
    const matched = existingPlans.find((p) => p.season === season);

    if (matched && matched.zones.length > 0) {
      setZones(matched.zones);
      setMode(matched.mode || 'ai_recommended');
      setSelectedZoneId(matched.zones[0]?.id || null);
    } else {
      applyAIRecommendations();
    }
  }, [farm?.id, season, applyAIRecommendations]);

  // Switch Mode Handler
  const handleModeChange = (newMode: CropPlanMode) => {
    setMode(newMode);
    if (newMode === 'ai_recommended') {
      applyAIRecommendations();
    } else if (newMode === 'farmer_selected' && zones.length === 0) {
      handleAddBlankZone();
    }
  };

  // Add new zone manually
  const handleAddBlankZone = () => {
    if (!farm) return;
    const defaultCrop = INDIAN_CROPS_DATABASE[0];
    const newIdx = zones.length + 1;
    const remainingAcres = Math.max(1.0, Number((totalFarmAcres - totalAllocatedAcres).toFixed(1)));

    // Subdivide boundary for all zones + 1
    const newProportions = [...zones.map((z) => z.areaAcres || 1), remainingAcres];
    const subPolys = subdividePolygon(farm.boundary, newProportions);

    const newZone: FarmZone = {
      id: `${farm.id}-custom-zone-${Date.now()}`,
      farmId: farm.id,
      type: 'crop',
      name: `Parcel ${newIdx}: ${defaultCrop.name}`,
      cropName: defaultCrop.name,
      cropVariety: defaultCrop.defaultVariety,
      areaAcres: remainingAcres,
      areaSqM: Math.round(remainingAcres * 4046.856),
      color: defaultCrop.color,
      geometry: subPolys[subPolys.length - 1] || farm.boundary,
      notes: 'Farmer-selected crop zone.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [...zones, newZone];
    setZones(updated);
    setSelectedZoneId(newZone.id);
  };

  // Update a zone
  const handleUpdateZone = (zoneId: string, partial: Partial<FarmZone>) => {
    setZones((prev) =>
      prev.map((z) => {
        if (z.id === zoneId) {
          return { ...z, ...partial, updatedAt: new Date().toISOString() };
        }
        return z;
      })
    );
  };

  // Delete a zone
  const handleDeleteZone = (zoneId: string) => {
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
    if (selectedZoneId === zoneId) {
      setSelectedZoneId(null);
    }
  };

  // Deterministic Acreage Calculations & Validation
  const totalAllocatedAcres = useMemo(() => {
    return Number(zones.reduce((sum, z) => sum + (z.areaAcres || 0), 0).toFixed(2));
  }, [zones]);

  const allocationPercentage = totalFarmAcres > 0 ? (totalAllocatedAcres / totalFarmAcres) * 100 : 0;
  const isAcreageExceeded = totalAllocatedAcres > totalFarmAcres + 0.05;

  const unallocatedAcres = Math.max(0, Number((totalFarmAcres - totalAllocatedAcres).toFixed(2)));

  // Total Projected Economics
  const totalProjectedProfitInr = useMemo(() => {
    return zones.reduce((sum, z) => {
      const crop = INDIAN_CROPS_DATABASE.find((c) => c.name === z.cropName);
      const profitRate = crop?.estimatedNetProfitInrPerAcre || 35000;
      return sum + Math.round((z.areaAcres || 0) * profitRate);
    }, 0);
  }, [zones]);

  const totalProjectedYieldTonnes = useMemo(() => {
    return Number(
      zones
        .reduce((sum, z) => {
          const crop = INDIAN_CROPS_DATABASE.find((c) => c.name === z.cropName);
          const yieldRate = crop?.expectedYieldTonnesPerAcre || 1.2;
          return sum + (z.areaAcres || 0) * yieldRate;
        }, 0)
        .toFixed(1)
    );
  }, [zones]);

  // Save Crop Plan
  const handleSavePlan = () => {
    if (!farm) return;

    if (zones.length === 0) {
      setToast({
        type: 'error',
        message: 'Please add at least one crop zone before saving the plan.',
      });
      return;
    }

    if (isAcreageExceeded) {
      setToast({
        type: 'error',
        message: `Allocated area (${totalAllocatedAcres} ac) exceeds farm size (${totalFarmAcres} ac). Adjust acreage to continue.`,
      });
      return;
    }

    setIsSaving(true);
    try {
      zones.forEach((z) => {
        saveFarmZone(z);
      });

      const newPlan: CropPlan = {
        id: `plan-${farm.id}-${season.toLowerCase()}-${year}`,
        farmId: farm.id,
        mode,
        season,
        year,
        zones,
        rationale: aiDetails.strategy || `Crop plan for ${season} ${year}.`,
        expectedTotalYieldTonnes: totalProjectedYieldTonnes,
        estimatedNetProfitInr: totalProjectedProfitInr,
        status: 'active',
        isDemo: farm.isDemo || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      saveCropPlan(newPlan);

      if (onPlanSaved) {
        onPlanSaved(newPlan);
      }

      setToast({
        type: 'success',
        message: `Crop Plan for ${season} ${year} saved successfully! ${zones.length} parcels deployed.`,
      });
    } catch (err) {
      console.error('[AgriDOST Planner] Error saving crop plan:', err);
      setToast({
        type: 'error',
        message: 'Failed to save crop plan. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`flex flex-col gap-4 w-full ${className}`}>
      {/* Toast Banner */}
      {toast && (
        <div
          className={`flex items-center gap-2.5 rounded-2xl p-3.5 text-xs shadow-xs transition-all ${
            toast.type === 'success'
              ? 'border border-[#DCE8D3] bg-[#DCE8D3]/30 text-[#173F2B]'
              : toast.type === 'error'
              ? 'border border-[#B9784F]/40 bg-white text-[#B9784F]'
              : 'border border-[#E7E9E2] bg-white text-[#173F2B]'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 text-[#173F2B] shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="h-4 w-4 text-[#B9784F] shrink-0" />}
          {toast.type === 'info' && <Sparkles className="h-4 w-4 text-[#173F2B] shrink-0" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Top Header Card: Farm Context, Season, Mode Selector */}
      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#DCE8D3] px-2.5 py-0.5 text-xs font-semibold text-[#173F2B]">
                Unified Farm Cadastre
              </span>
              <span className="text-xs text-[#26312A]/60">
                Active Farm: <strong>{farm?.name || 'Active Farm'}</strong>
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#173F2B] font-heading">
              Evidence-Based Crop Planner
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#26312A]/70">
              <span>
                Soil: <strong className="text-[#26312A]">{farm?.soilType || 'Medium Black Soil (Regur)'}</strong>
              </span>
              <span>•</span>
              <span>
                Water Source: <strong className="text-[#26312A]">{farm?.waterSource || 'Drip Irrigation'}</strong>
              </span>
              <span>•</span>
              <span>
                Boundary: <strong className="text-[#173F2B]">{totalFarmAcres} Acres</strong>
              </span>
            </div>
          </div>

          {/* Season & Year Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-1">
              <Calendar className="ml-2 h-4 w-4 text-[#26312A]/60" />
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value as any)}
                className="bg-transparent px-2.5 py-1 text-xs font-semibold text-[#26312A] focus:outline-hidden"
              >
                <option value="Kharif">Kharif (Monsoon)</option>
                <option value="Rabi">Rabi (Winter)</option>
                <option value="Zaid">Zaid (Summer)</option>
                <option value="Annual">Annual / Perennial</option>
              </select>
            </div>

            <div className="flex items-center rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] px-3 py-1.5 text-xs font-semibold text-[#26312A]">
              Year {year}
            </div>

            <button
              onClick={applyAIRecommendations}
              className="flex items-center gap-1.5 rounded-xl border border-[#DCE8D3] bg-[#DCE8D3]/40 px-3 py-2 text-xs font-semibold text-[#173F2B] hover:bg-[#DCE8D3] transition shadow-xs"
              title="Re-run AI Agronomic engine"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#173F2B]" />
              <span>Regenerate AI Plan</span>
            </button>
          </div>
        </div>

        {/* 3 Mode Selector Pills with #173F2B active state and #DCE8D3 soft accents */}
        <div className="mt-4 pt-4 border-t border-[#E7E9E2] flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#26312A]/60 mr-1">Planning Mode:</span>

          {/* AI Recommended */}
          <button
            onClick={() => handleModeChange('ai_recommended')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              mode === 'ai_recommended'
                ? 'bg-[#173F2B] text-white shadow-xs'
                : 'border border-[#E7E9E2] bg-[#F7F7F0] text-[#26312A] hover:bg-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-[#DCE8D3]" />
            <span>AI Recommended</span>
            <span
              className={`rounded-full px-2 py-0.2 text-[10px] font-semibold ${
                mode === 'ai_recommended'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#DCE8D3] text-[#173F2B]'
              }`}
            >
              Evidence-Based
            </span>
          </button>

          {/* Combined */}
          <button
            onClick={() => handleModeChange('combined')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              mode === 'combined'
                ? 'bg-[#173F2B] text-white shadow-xs'
                : 'border border-[#E7E9E2] bg-[#F7F7F0] text-[#26312A] hover:bg-white'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#F1D98A]" />
            <span>Combined Synergy</span>
            <span
              className={`rounded-full px-2 py-0.2 text-[10px] font-semibold ${
                mode === 'combined'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#F1D98A]/50 text-[#173F2B]'
              }`}
            >
              AI + Farmer
            </span>
          </button>

          {/* Farmer Selected */}
          <button
            onClick={() => handleModeChange('farmer_selected')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              mode === 'farmer_selected'
                ? 'bg-[#173F2B] text-white shadow-xs'
                : 'border border-[#E7E9E2] bg-[#F7F7F0] text-[#26312A] hover:bg-white'
            }`}
          >
            <User className="h-3.5 w-3.5 text-[#DCE8D3]" />
            <span>Farmer Directed</span>
          </button>
        </div>
      </div>

      {/* Acreage Allocation & Budget Progress Bar */}
      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-[#173F2B]" />
            <span className="font-bold text-[#173F2B] font-heading">Acreage Allocation Meter</span>
            <span className="text-[#26312A]/60">
              ({totalAllocatedAcres} of {totalFarmAcres} Acres assigned)
            </span>
          </div>

          <div className="flex items-center gap-3">
            {unallocatedAcres > 0 && !isAcreageExceeded && (
              <span className="font-semibold text-[#173F2B]">
                {unallocatedAcres} Acres Available
              </span>
            )}
            {isAcreageExceeded && (
              <span className="font-bold text-[#B9784F] flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Exceeds Boundary by {(totalAllocatedAcres - totalFarmAcres).toFixed(2)} Acres!</span>
              </span>
            )}
            <span className="font-mono text-[#26312A] font-bold">
              {allocationPercentage.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Clean Warm Progress Bar */}
        <div className="mt-2.5 h-3.5 w-full overflow-hidden rounded-full bg-[#F7F7F0] border border-[#E7E9E2] p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isAcreageExceeded
                ? 'bg-[#B9784F]'
                : 'bg-[#173F2B]'
            }`}
            style={{ width: `${Math.min(100, allocationPercentage)}%` }}
          />
        </div>

        {/* Over-allocation Warning */}
        {isAcreageExceeded && (
          <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-white p-2.5 text-xs text-[#B9784F] border border-[#B9784F]/30">
            <AlertTriangle className="h-4 w-4 text-[#B9784F] shrink-0" />
            <span>
              <strong>Boundary Limit Exceeded:</strong> Total zoned acreage exceeds the verified farm boundary.
              Please adjust parcel sizes to proceed.
            </span>
          </div>
        )}
      </div>

      {/* Main Grid: Left = Zones & Agronomic Details; Right = Live Farm Map */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column: Crop Zones List & AI Strategy (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* AI Agronomic Strategy Banner */}
          {aiDetails.strategy && (
            <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#E7E9E2] pb-2.5 mb-2.5">
                <div className="flex items-center gap-2 font-bold text-[#173F2B] text-sm font-heading">
                  <Sparkles className="h-4 w-4 text-[#173F2B]" />
                  <span>AI Agronomic Soil & Crop Strategy</span>
                </div>
                <span className="rounded-full bg-[#DCE8D3] px-2.5 py-0.5 text-[10px] font-semibold text-[#173F2B]">
                  Evidence-Supported
                </span>
              </div>

              <p className="text-xs text-[#26312A]/85 leading-relaxed font-sans">
                {aiDetails.strategy}
              </p>

              {/* Data Gaps Alert (Earth Clay styling) */}
              {aiDetails.missingInfo.length > 0 && (
                <div className="mt-3 rounded-xl border border-[#B9784F]/30 bg-[#F7F7F0] p-2.5 text-xs text-[#26312A]">
                  <div className="flex items-center gap-1.5 font-bold text-[#B9784F] mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-[#B9784F]" />
                    <span>Missing Farm Data (Recommended Field Verification):</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-[#26312A]/80 space-y-0.5 pl-1">
                    {aiDetails.missingInfo.slice(0, 3).map((info, idx) => (
                      <li key={idx}>{info}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Zones Header & Add Button */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#173F2B] flex items-center gap-2 font-heading">
              <Layers className="h-4 w-4 text-[#173F2B]" />
              <span>Delineated Crop Parcels ({zones.length})</span>
            </h3>

            <button
              onClick={handleAddBlankZone}
              className="flex items-center gap-1.5 rounded-xl border border-[#E7E9E2] bg-white px-3 py-1.5 text-xs font-semibold text-[#173F2B] hover:bg-[#F7F7F0] transition shadow-xs"
            >
              <PlusCircle className="h-3.5 w-3.5 text-[#173F2B]" />
              <span>Add Crop Zone</span>
            </button>
          </div>

          {/* Zone Cards List */}
          <div className="space-y-3">
            {zones.map((zone, idx) => (
              <CropZoneCard
                key={zone.id}
                zone={zone}
                index={idx}
                totalFarmAcres={totalFarmAcres}
                isSelected={selectedZoneId === zone.id}
                onSelect={() => setSelectedZoneId(zone.id)}
                onUpdate={(partial) => handleUpdateZone(zone.id, partial)}
                onDelete={() => handleDeleteZone(zone.id)}
                evidenceRationale={zone.notes}
                missingInformation={aiDetails.missingInfo}
                citations={aiDetails.citations}
              />
            ))}

            {zones.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-[#E7E9E2] p-8 text-center text-[#26312A]/50 bg-white">
                <Sprout className="mx-auto h-8 w-8 text-[#173F2B]/40 mb-2" />
                <p className="text-sm font-semibold text-[#26312A]">No crop zones created yet.</p>
                <p className="text-xs text-[#26312A]/60 mt-1">
                  Click &ldquo;Add Crop Zone&rdquo; or click &ldquo;Regenerate AI Plan&rdquo; above.
                </p>
              </div>
            )}
          </div>

          {/* Plan Summary & Save Button Card */}
          <div className="mt-2 rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs text-[#26312A]/60 font-medium">Projected Seasonal Economics</span>
              <div className="flex items-baseline gap-3 mt-0.5">
                <div>
                  <span className="text-xs text-[#26312A]/60">Total Net: </span>
                  <span className="text-base font-bold text-[#173F2B]">
                    ₹{totalProjectedProfitInr.toLocaleString('en-IN')}
                  </span>
                </div>
                <span>•</span>
                <div>
                  <span className="text-xs text-[#26312A]/60">Total Yield: </span>
                  <span className="text-sm font-semibold text-[#26312A]">
                    {totalProjectedYieldTonnes} Tonnes
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSavePlan}
              disabled={isSaving || isAcreageExceeded || zones.length === 0}
              className={`flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition ${
                isAcreageExceeded || zones.length === 0
                  ? 'bg-[#26312A]/30 cursor-not-allowed'
                  : 'bg-[#173F2B] hover:bg-[#173F2B]/90'
              } ${isSaving ? 'opacity-70' : ''}`}
            >
              <Save className="h-4 w-4 text-[#DCE8D3]" />
              <span>{isSaving ? 'Saving Crop Plan...' : 'Save & Deploy Crop Plan'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Colored Cadastre Map Overlay (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-2">
          <div className="sticky top-20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#173F2B] flex items-center gap-1.5 font-heading">
                <Layers className="h-3.5 w-3.5 text-[#173F2B]" />
                <span>Live Cadastre Zone Overlay</span>
              </span>
              <span className="text-[11px] text-[#26312A]/60">
                Click zone on map to inspect
              </span>
            </div>

            <VectorFarmMap
              farm={farm}
              zones={zones}
              selectedZoneId={selectedZoneId}
              onSelectZone={(z) => setSelectedZoneId(z?.id || null)}
              mode="view"
              allowDrawing={false}
              height="580px"
              showLegend={true}
              showStatsOverlay={true}
            />

            <p className="mt-2 text-center text-[11px] text-[#26312A]/60 font-sans">
              Each translucent parcel represents an evidence-zoned crop field. The unified map synchronizes across all farm operations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
