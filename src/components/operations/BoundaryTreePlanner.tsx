'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import * as turf from '@turf/turf';
import {
  Trees,
  TreePine,
  ShieldAlert,
  ShieldCheck,
  Info,
  Save,
  CheckCircle2,
  Calendar,
  Sparkles,
  Leaf,
  Maximize2,
  Layers,
  ChevronRight,
  Trash2,
  Compass,
} from 'lucide-react';
import { Farm, BoundaryTreePlan, Position } from '@/types';
import * as storage from '@/lib/data/storage';
import { calculateBoundingBox } from '@/lib/data/geo-utils';

export interface TreeSpecies {
  id: string;
  commonName: string;
  scientificName: string;
  category: 'Timber' | 'Plywood & Biomass' | 'Fodder & Nitrogen' | 'Nutrition & Cash' | 'Windbreak';
  recommendedSpacingMeters: number;
  availableSpacings: number[];
  shadeRisk: 'low' | 'medium' | 'high';
  rootProfile: 'deep_taproot' | 'lateral' | 'sinker';
  rootCompetitionNote: string;
  canopyDiameterMeters: number;
  maturityYears: number;
  economicValueDesc: string;
  carbonOffsetKgPerYear: number;
  waterRequirement: 'Low' | 'Moderate' | 'High';
  description: string;
}

export const DEMO_TREE_CATALOGUE: TreeSpecies[] = [
  {
    id: 'teak',
    commonName: 'Teak',
    scientificName: 'Tectona grandis',
    category: 'Timber',
    recommendedSpacingMeters: 3.5,
    availableSpacings: [2.5, 3.5, 5.0],
    shadeRisk: 'low',
    rootProfile: 'deep_taproot',
    rootCompetitionNote: 'Strong central taproot reaches deep groundwater without lateral root intrusion into crop furrow drip lines. Safe distance: 1.5m - 2.0m from crop row.',
    canopyDiameterMeters: 4.5,
    maturityYears: 15,
    economicValueDesc: 'High-value timber; estimated ₹35,000 - ₹50,000 per mature tree.',
    carbonOffsetKgPerYear: 28.5,
    waterRequirement: 'Moderate',
    description: 'Premier hardwood timber tree with minimal lateral root competition with surface field crops. Broad deciduous canopy sheds leaves in winter, restoring sunlight during Rabi cycle.',
  },
  {
    id: 'malabar-neem',
    commonName: 'Malabar Neem',
    scientificName: 'Melia dubia',
    category: 'Plywood & Biomass',
    recommendedSpacingMeters: 3.5,
    availableSpacings: [2.5, 3.5, 5.0],
    shadeRisk: 'low',
    rootProfile: 'deep_taproot',
    rootCompetitionNote: 'Straight cylindrical bole with light feathery foliage. Pruning lower lateral branches up to 4m height eliminates shade over boundary crops.',
    canopyDiameterMeters: 3.8,
    maturityYears: 7,
    economicValueDesc: 'Plywood & paper pulp; ₹4,500 - ₹7,000 per tree at 6-8 years.',
    carbonOffsetKgPerYear: 34.0,
    waterRequirement: 'Moderate',
    description: 'Fastest-growing agro-forestry tree in India. Extremely popular for boundary planting in Maharashtra, Karnataka, and Punjab. Leaves decompose rapidly into organic mulch.',
  },
  {
    id: 'subabul',
    commonName: 'Subabul',
    scientificName: 'Leucaena leucocephala',
    category: 'Fodder & Nitrogen',
    recommendedSpacingMeters: 2.5,
    availableSpacings: [2.5, 3.5],
    shadeRisk: 'medium',
    rootProfile: 'sinker',
    rootCompetitionNote: 'Fixes atmospheric nitrogen (up to 150 kg N/ha/yr). Requires regular lateral root pruning or a 1m ditch barrier along adjacent crop lines.',
    canopyDiameterMeters: 3.2,
    maturityYears: 4,
    economicValueDesc: 'High-protein livestock fodder & biomass fuel; recurring monthly yields.',
    carbonOffsetKgPerYear: 22.0,
    waterRequirement: 'Low',
    description: 'Leguminous fast-growing tree. Provides continuous protein-rich green fodder for livestock and enriches border soils with biological nitrogen.',
  },
  {
    id: 'moringa',
    commonName: 'Moringa (Drumstick)',
    scientificName: 'Moringa oleifera',
    category: 'Nutrition & Cash',
    recommendedSpacingMeters: 2.5,
    availableSpacings: [2.5, 3.5],
    shadeRisk: 'low',
    rootProfile: 'deep_taproot',
    rootCompetitionNote: 'Non-aggressive tuberous taproot. Completely compatible with all vegetable and grain crops; zero moisture-stealing effect.',
    canopyDiameterMeters: 2.8,
    maturityYears: 1,
    economicValueDesc: 'High commercial cash crop; ₹1,200 - ₹2,500 pods/leaves revenue per tree annually.',
    carbonOffsetKgPerYear: 18.0,
    waterRequirement: 'Low',
    description: 'Fast-yielding superfood tree. Sparse, pinnate foliage allows 85% sunlight transmission to ground-level crops while producing export-grade drumsticks within 8 months.',
  },
  {
    id: 'casuarina',
    commonName: 'Casuarina (Sarve / Savukku)',
    scientificName: 'Casuarina equisetifolia',
    category: 'Windbreak',
    recommendedSpacingMeters: 2.5,
    availableSpacings: [2.5, 3.5, 5.0],
    shadeRisk: 'low',
    rootProfile: 'sinker',
    rootCompetitionNote: 'Acts as an aerodynamic wind barrier. Dense cylindrical profile reduces wind velocity by 65%, preventing crop lodging during squalls.',
    canopyDiameterMeters: 2.5,
    maturityYears: 5,
    economicValueDesc: 'Scaffolding poles & high-calorific firewood; ₹2,000 - ₹3,500 per pole.',
    carbonOffsetKgPerYear: 30.5,
    waterRequirement: 'Low',
    description: 'Premier boundary windbreak species in coastal and arid belts. Nitrogen-fixing root nodules thrive in sandy and saline soils, shielding crops from desiccating winds.',
  },
];

interface BoundaryTreePlannerProps {
  farm?: Farm;
  onPlanSaved?: (plan: BoundaryTreePlan) => void;
}

export function BoundaryTreePlanner({ farm: propFarm, onPlanSaved }: BoundaryTreePlannerProps) {
  const [activeFarm, setActiveFarm] = useState<Farm | undefined>(propFarm);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>('teak');
  const [spacingMeters, setSpacingMeters] = useState<number>(3.5);
  const [dripBufferDistance, setDripBufferDistance] = useState<number>(2.0);
  const [savedPlans, setSavedPlans] = useState<BoundaryTreePlan[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState<number | null>(null);
  const [showBufferLine, setShowBufferLine] = useState<boolean>(true);

  // Sync farm from storage if not provided via props
  useEffect(() => {
    if (propFarm) {
      setActiveFarm(propFarm);
    } else {
      const f = storage.getActiveFarm();
      setActiveFarm(f);
    }
  }, [propFarm]);

  // Load existing tree plans for this farm
  const loadPlans = useCallback(() => {
    if (!activeFarm) return;
    const plans = storage.getTreePlans(activeFarm.id);
    setSavedPlans(plans);
  }, [activeFarm]);

  useEffect(() => {
    loadPlans();
    const unsub = storage.subscribeToDataChanges(loadPlans);
    return () => unsub();
  }, [loadPlans]);

  const selectedSpecies = useMemo(() => {
    return DEMO_TREE_CATALOGUE.find((s) => s.id === selectedSpeciesId) || DEMO_TREE_CATALOGUE[0];
  }, [selectedSpeciesId]);

  // Ensure selected spacing is compatible with species or update default
  const handleSpeciesSelect = (species: TreeSpecies) => {
    setSelectedSpeciesId(species.id);
    if (!species.availableSpacings.includes(spacingMeters)) {
      setSpacingMeters(species.recommendedSpacingMeters);
    }
  };

  // Deterministic calculation of farm perimeter and tree coordinates using Turf.js
  const calculation = useMemo(() => {
    if (!activeFarm || !activeFarm.boundary || !activeFarm.boundary.coordinates?.[0]?.length) {
      return {
        perimeterMeters: 0,
        treeCount: 0,
        positions: [] as Position[],
        svgPolygonPoints: '',
        svgTrees: [] as { x: number; y: number; index: number; coord: Position }[],
        bbox: null,
      };
    }

    const ring = activeFarm.boundary.coordinates[0];
    const bbox = calculateBoundingBox(activeFarm.boundary);

    // Turf LineString calculation
    const boundaryLine = turf.lineString(ring);
    const perimeterMeters = turf.length(boundaryLine, { units: 'meters' });
    const count = Math.max(1, Math.floor(perimeterMeters / spacingMeters));

    const positions: Position[] = [];
    for (let i = 0; i < count; i++) {
      const dist = i * spacingMeters;
      if (dist < perimeterMeters) {
        const pt = turf.along(boundaryLine, dist, { units: 'meters' });
        positions.push(pt.geometry.coordinates as Position);
      }
    }

    // SVG coordinate transformation
    const svgWidth = 520;
    const svgHeight = 360;
    const padding = 42;

    const lngSpan = bbox.maxLng - bbox.minLng || 0.0001;
    const latSpan = bbox.maxLat - bbox.minLat || 0.0001;
    const drawableW = svgWidth - padding * 2;
    const drawableH = svgHeight - padding * 2;
    const scale = Math.min(drawableW / lngSpan, drawableH / latSpan);
    const offsetX = padding + (drawableW - lngSpan * scale) / 2;
    const offsetY = padding + (drawableH - latSpan * scale) / 2;

    const coordToSvg = (lng: number, lat: number) => {
      const x = offsetX + (lng - bbox.minLng) * scale;
      const y = svgHeight - (offsetY + (lat - bbox.minLat) * scale);
      return { x, y };
    };

    const svgPolygonPoints = ring
      .map(([lng, lat]) => {
        const { x, y } = coordToSvg(lng, lat);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const svgTrees = positions.map((pos, idx) => {
      const { x, y } = coordToSvg(pos[0], pos[1]);
      return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        index: idx + 1,
        coord: pos,
      };
    });

    return {
      perimeterMeters: Math.round(perimeterMeters),
      treeCount: count,
      positions,
      svgPolygonPoints,
      svgTrees,
      bbox,
    };
  }, [activeFarm, spacingMeters]);

  // Handle saving the tree plan
  const handleSavePlan = () => {
    if (!activeFarm) return;

    const newPlan: BoundaryTreePlan = {
      id: `tree-plan-${Date.now()}`,
      farmId: activeFarm.id,
      speciesName: `${selectedSpecies.commonName} (${selectedSpecies.scientificName})`,
      spacingMeters,
      treeCount: calculation.treeCount,
      shadeRisk: selectedSpecies.shadeRisk,
      rootCompetitionNote: `${selectedSpecies.rootCompetitionNote} (Buffer: ${dripBufferDistance}m maintained from active crop drip line).`,
      suggestedPositions: calculation.positions,
      isDemo: activeFarm.isDemo ?? false,
    };

    storage.saveTreePlan(newPlan);
    setSaveSuccessMsg(`Tree plan for ${selectedSpecies.commonName} (${calculation.treeCount} trees) saved successfully.`);
    loadPlans();
    if (onPlanSaved) onPlanSaved(newPlan);

    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 4500);
  };

  const handleDeletePlan = (id: string) => {
    const existing = storage.getTreePlans(activeFarm?.id);
    const updated = existing.filter((p) => p.id !== id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('agridost_tree_plans', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('agridost:data-changed', { detail: { key: 'agridost_tree_plans' } }));
    }
    loadPlans();
  };

  if (!activeFarm) {
    return (
      <div className="bg-[#F7F7F0] border border-[#E7E9E2] rounded-2xl p-8 text-center text-[#26312A]">
        <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-[#B9784F]" />
        <h3 className="font-semibold text-lg text-[#173F2B]">No Active Farm Selected</h3>
        <p className="text-xs mt-1 text-[#26312A]/70">
          Please select or map a farm boundary to plan boundary agro-forestry tree placements.
        </p>
      </div>
    );
  }

  const annualCarbonTonnes = ((calculation.treeCount * selectedSpecies.carbonOffsetKgPerYear) / 1000).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-[#E7E9E2] shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-[#DCE8D3] text-[#173F2B]">
              <Trees className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[#173F2B]">
                Boundary Agro-Forestry Tree Planner
              </h2>
              <p className="text-xs text-[#26312A]/70">
                Perimeter windbreak, carbon credit, and timber yield planner for{' '}
                <span className="font-semibold text-[#173F2B]">{activeFarm.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 bg-[#DCE8D3]/50 text-[#173F2B] font-medium rounded-full border border-[#6F9B55]/30">
              <Sparkles className="w-3.5 h-3.5 text-[#6F9B55]" />
              RFC 7946 Precision
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-[#F7F7F0] text-[#26312A]/80 font-mono text-[11px] rounded-full border border-[#E7E9E2]">
              [Turf.js Deterministic]
            </span>
          </div>
        </div>

        {/* Refined KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#E7E9E2]">
          <div className="p-3.5 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2]">
            <p className="text-[11px] font-medium text-[#26312A]/70 uppercase tracking-wider">Perimeter Length</p>
            <p className="text-xl font-bold text-[#173F2B] mt-0.5">
              {calculation.perimeterMeters.toLocaleString('en-IN')}{' '}
              <span className="text-xs font-normal text-[#26312A]/60">m</span>
            </p>
            <p className="text-[11px] text-[#26312A]/60 mt-0.5">{(calculation.perimeterMeters / 1000).toFixed(2)} km total fence</p>
          </div>

          <div className="p-3.5 bg-[#DCE8D3]/35 rounded-xl border border-[#6F9B55]/25">
            <p className="text-[11px] font-medium text-[#173F2B] uppercase tracking-wider">Trees Planned</p>
            <p className="text-xl font-bold text-[#173F2B] mt-0.5">
              {calculation.treeCount.toLocaleString('en-IN')}{' '}
              <span className="text-xs font-normal text-[#173F2B]/75">trees</span>
            </p>
            <p className="text-[11px] text-[#173F2B]/75 mt-0.5">@ {spacingMeters}m perimeter intervals</p>
          </div>

          <div className="p-3.5 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2]">
            <p className="text-[11px] font-medium text-[#26312A]/70 uppercase tracking-wider">Carbon Offset</p>
            <p className="text-xl font-bold text-[#173F2B] mt-0.5">
              ~{annualCarbonTonnes}{' '}
              <span className="text-xs font-normal text-[#26312A]/60">t CO₂/yr</span>
            </p>
            <p className="text-[11px] text-[#6F9B55] font-medium mt-0.5">Agro-credit eligible</p>
          </div>

          <div className="p-3.5 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2]">
            <p className="text-[11px] font-medium text-[#26312A]/70 uppercase tracking-wider">Shade & Root Risk</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  selectedSpecies.shadeRisk === 'low'
                    ? 'bg-[#6F9B55]'
                    : selectedSpecies.shadeRisk === 'medium'
                    ? 'bg-[#F1D98A]'
                    : 'bg-[#B9784F]'
                }`}
              />
              <span className="text-sm font-semibold capitalize text-[#173F2B]">
                {selectedSpecies.shadeRisk} Risk
              </span>
            </div>
            <p className="text-[11px] text-[#26312A]/60 mt-0.5 capitalize">
              {selectedSpecies.rootProfile.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="bg-[#DCE8D3]/60 border border-[#6F9B55]/40 text-[#173F2B] px-4 py-3 rounded-2xl flex items-center justify-between animate-fadeIn shadow-xs">
          <div className="flex items-center gap-2.5 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#173F2B] shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <span className="text-[11px] text-[#173F2B] bg-white/70 px-2.5 py-0.5 rounded-full border border-[#6F9B55]/30">
            Stored
          </span>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Species Catalogue & Spacing Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Species Selector Card */}
          <div className="bg-white rounded-2xl border border-[#E7E9E2] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#173F2B] text-sm flex items-center gap-2">
                <Leaf className="w-4 h-4 text-[#6F9B55]" />
                Select Boundary Tree Species
              </h3>
              <span className="text-xs text-[#26312A]/60">ICAR-CAFRI Verified</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEMO_TREE_CATALOGUE.map((spec) => {
                const isSelected = spec.id === selectedSpeciesId;
                return (
                  <button
                    key={spec.id}
                    type="button"
                    onClick={() => handleSpeciesSelect(spec)}
                    className={`text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-[#173F2B] bg-[#F7F7F0] ring-1 ring-[#173F2B] shadow-xs'
                        : 'border-[#E7E9E2] bg-white hover:border-[#6F9B55]/60 hover:bg-[#F7F7F0]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div>
                        <p className="font-semibold text-sm text-[#173F2B]">{spec.commonName}</p>
                        <p className="text-xs italic text-[#26312A]/60">{spec.scientificName}</p>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#DCE8D3] text-[#173F2B] border border-[#6F9B55]/20 shrink-0">
                        {spec.category}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-[#26312A]/70 pt-2 border-t border-[#E7E9E2]/60">
                      <span>Harvest: ~{spec.maturityYears} yrs</span>
                      <span className="font-semibold text-[#173F2B]">{spec.carbonOffsetKgPerYear} kg CO₂/yr</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Species In-depth Advisory */}
            <div className="bg-[#F7F7F0] rounded-xl p-4 border border-[#E7E9E2] space-y-3">
              <div>
                <h4 className="text-sm font-bold text-[#173F2B]">
                  {selectedSpecies.commonName}{' '}
                  <span className="font-normal italic text-[#26312A]/60">({selectedSpecies.scientificName})</span>
                </h4>
                <p className="text-xs text-[#26312A]/80 mt-1 leading-relaxed">{selectedSpecies.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-[#E7E9E2]">
                  <span className="text-[#26312A]/60 font-medium block">Economic Returns</span>
                  <span className="font-semibold text-[#173F2B] mt-0.5 block">{selectedSpecies.economicValueDesc}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-[#E7E9E2]">
                  <span className="text-[#26312A]/60 font-medium block">Water & Canopy</span>
                  <span className="font-semibold text-[#173F2B] mt-0.5 block">
                    {selectedSpecies.waterRequirement} Water • Canopy ~{selectedSpecies.canopyDiameterMeters}m
                  </span>
                </div>
              </div>

              {/* Root Competition & Safe Distance Box */}
              <div className="bg-[#DCE8D3]/50 border border-[#6F9B55]/30 rounded-xl p-3 text-xs space-y-1.5 text-[#173F2B]">
                <div className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-[#173F2B]" />
                  <span>Root-Competition & Crop Drip Line Advisory</span>
                </div>
                <p className="text-[#26312A] leading-relaxed text-[11px]">
                  {selectedSpecies.rootCompetitionNote}
                </p>
                <div className="flex items-center gap-3 pt-1 text-[11px] text-[#173F2B]/85 font-medium">
                  <span>• Taproot: Minimal lateral nutrient theft</span>
                  <span>• Buffer: {dripBufferDistance}m distance maintained</span>
                </div>
              </div>
            </div>
          </div>

          {/* Spacing Configuration Card */}
          <div className="bg-white rounded-2xl border border-[#E7E9E2] p-5 shadow-xs space-y-4">
            <h3 className="font-semibold text-[#173F2B] text-sm flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-[#6F9B55]" />
              Perimeter Tree Spacing Configuration
            </h3>

            <div className="grid grid-cols-3 gap-3">
              {[2.5, 3.5, 5.0].map((spacing) => {
                const isSelected = spacingMeters === spacing;
                const isRecommended = selectedSpecies.recommendedSpacingMeters === spacing;
                return (
                  <button
                    key={spacing}
                    type="button"
                    onClick={() => setSpacingMeters(spacing)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-[#173F2B] bg-[#173F2B] text-white shadow-xs'
                        : 'border-[#E7E9E2] bg-white hover:bg-[#F7F7F0] text-[#26312A]'
                    }`}
                  >
                    <span className="text-base font-bold block">{spacing} Meters</span>
                    <span className={`text-[11px] block mt-0.5 ${isSelected ? 'text-white/80' : 'text-[#26312A]/60'}`}>
                      {spacing === 2.5
                        ? 'Dense Windbreak'
                        : spacing === 3.5
                        ? 'Agro-forestry'
                        : 'Timber Alley'}
                    </span>
                    {isRecommended && (
                      <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isSelected ? 'bg-white text-[#173F2B]' : 'bg-[#DCE8D3] text-[#173F2B]'
                      }`}>
                        Recommended
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-[#26312A]/70 border-t border-[#E7E9E2]">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#26312A]/40 shrink-0" />
                <span>
                  Perimeter: <strong className="text-[#173F2B]">{calculation.perimeterMeters}m</strong> ÷{' '}
                  <strong className="text-[#173F2B]">{spacingMeters}m</strong> ={' '}
                  <strong className="text-[#173F2B]">{calculation.treeCount} tree spots</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="bufferRange" className="text-[#26312A]/60">Drip Buffer:</label>
                <select
                  id="bufferRange"
                  value={dripBufferDistance}
                  onChange={(e) => setDripBufferDistance(parseFloat(e.target.value))}
                  className="bg-[#F7F7F0] border border-[#E7E9E2] rounded-lg px-2.5 py-1 text-[#26312A] font-medium"
                >
                  <option value={1.5}>1.5 meters</option>
                  <option value={2.0}>2.0 meters (Recommended)</option>
                  <option value={2.5}>2.5 meters</option>
                  <option value={3.0}>3.0 meters</option>
                </select>
              </div>
            </div>

            {/* Action Save Bar */}
            <div className="pt-2 flex items-center justify-between">
              <div className="text-[11px] text-[#26312A]/60">
                Saves to local registry <code className="bg-[#F7F7F0] px-1.5 py-0.5 rounded border border-[#E7E9E2]">agridost_tree_plans</code>
              </div>
              <button
                type="button"
                onClick={handleSavePlan}
                className="inline-flex items-center gap-2 bg-[#173F2B] hover:bg-[#123222] text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                Save Tree Plan
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive SVG Boundary Preview & Tree Markers (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-[#E7E9E2] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TreePine className="w-4 h-4 text-[#173F2B]" />
                <h3 className="font-semibold text-[#173F2B] text-sm">Cadastral Boundary SVG Preview</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBufferLine(!showBufferLine)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  showBufferLine
                    ? 'bg-[#DCE8D3] text-[#173F2B] border-[#6F9B55]/30'
                    : 'bg-[#F7F7F0] text-[#26312A]/60 border-[#E7E9E2]'
                }`}
              >
                {showBufferLine ? 'Buffer: 2m Active' : 'Show 2m Buffer'}
              </button>
            </div>

            {/* SVG Visualizer Container */}
            <div className="relative bg-[#14221C] rounded-2xl overflow-hidden border border-[#26312A] shadow-inner flex items-center justify-center min-h-[360px]">
              {/* Compass Cardinal Marks */}
              <div className="absolute top-3 left-3 flex items-center gap-1 text-[10px] text-[#DCE8D3] font-mono">
                <Compass className="w-3.5 h-3.5 text-[#6F9B55]" />
                <span>N ▲</span>
              </div>
              <div className="absolute top-3 right-3 text-[10px] font-mono text-[#DCE8D3]/70">
                Perimeter: {calculation.perimeterMeters}m
              </div>

              {calculation.svgPolygonPoints ? (
                <svg
                  viewBox="0 0 520 360"
                  className="w-full h-full max-h-[380px] select-none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="farmFieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#173F2B" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#6F9B55" stopOpacity="0.2" />
                    </linearGradient>
                    <radialGradient id="treeDotGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#DCE8D3" />
                      <stop offset="100%" stopColor="#6F9B55" />
                    </radialGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Field Cadastral Boundary Polygon */}
                  <polygon
                    points={calculation.svgPolygonPoints}
                    fill="url(#farmFieldGrad)"
                    stroke="#6F9B55"
                    strokeWidth="2.2"
                    className="transition-all duration-300"
                  />

                  {/* Inner Crop Drip Line Buffer */}
                  {showBufferLine && (
                    <polygon
                      points={calculation.svgPolygonPoints}
                      fill="none"
                      stroke="#F1D98A"
                      strokeWidth="1.2"
                      strokeDasharray="4 4"
                      opacity="0.65"
                      transform="scale(0.96) translate(10, 8)"
                    />
                  )}

                  {/* Tree Position Marker Dots */}
                  {calculation.svgTrees.map((tree) => {
                    const isHovered = hoveredTreeIndex === tree.index;
                    return (
                      <g
                        key={tree.index}
                        onMouseEnter={() => setHoveredTreeIndex(tree.index)}
                        onMouseLeave={() => setHoveredTreeIndex(null)}
                        className="cursor-pointer"
                      >
                        {isHovered && (
                          <circle
                            cx={tree.x}
                            cy={tree.y}
                            r="9"
                            fill="#DCE8D3"
                            opacity="0.5"
                            filter="url(#glow)"
                          />
                        )}
                        <circle
                          cx={tree.x}
                          cy={tree.y}
                          r={isHovered ? 5.5 : 3.5}
                          fill="url(#treeDotGrad)"
                          stroke="#FFFFFF"
                          strokeWidth="1"
                          className="transition-all duration-150"
                        />
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="text-[#DCE8D3]/60 text-xs p-6 text-center">
                  No boundary polygon available for active farm.
                </div>
              )}

              {/* Hover Tree Tooltip */}
              {hoveredTreeIndex !== null && (
                <div className="absolute bottom-3 left-3 bg-[#173F2B]/95 backdrop-blur-xs border border-[#6F9B55]/40 text-white text-[11px] px-3 py-1.5 rounded-lg shadow-lg font-mono">
                  Tree #{hoveredTreeIndex} of {calculation.treeCount} • ~{(hoveredTreeIndex * spacingMeters).toFixed(0)}m along boundary
                </div>
              )}

              {/* Legend overlay */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-[#173F2B]/85 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-[#26312A] text-[10px] text-[#F7F7F0]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#DCE8D3]" /> Tree Marker
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-[#F1D98A]" /> Drip Buffer
                </span>
              </div>
            </div>

            {/* Quick Summary under Preview */}
            <div className="bg-[#F7F7F0] rounded-xl p-3 border border-[#E7E9E2] text-xs text-[#26312A]/80 flex items-center justify-between">
              <div>
                <span className="font-semibold text-[#173F2B]">Visualized:</span>{' '}
                {calculation.svgTrees.length} perimeter markers around {activeFarm.name}
              </div>
              <span className="text-[11px] text-[#173F2B] font-mono">[RFC 7946]</span>
            </div>
          </div>

          {/* Saved Tree Plans History */}
          <div className="bg-white rounded-2xl border border-[#E7E9E2] p-5 shadow-xs space-y-3">
            <h3 className="font-semibold text-[#173F2B] text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#26312A]/50" />
              Saved Plans for this Farm ({savedPlans.length})
            </h3>

            {savedPlans.length === 0 ? (
              <p className="text-xs text-[#26312A]/50 py-3 text-center">
                No tree plans saved yet for {activeFarm.name}. Click &ldquo;Save Tree Plan&rdquo; above.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {savedPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="p-3 rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] flex items-center justify-between hover:bg-[#F7F7F0]/80 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#173F2B]">{plan.speciesName}</p>
                      <p className="text-[11px] text-[#26312A]/70 mt-0.5">
                        {plan.treeCount} trees @ {plan.spacingMeters}m spacing • Shade: {plan.shadeRisk}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(plan.id)}
                        className="text-[#26312A]/40 hover:text-[#B9784F] p-1 rounded transition-colors"
                        title="Delete Plan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
