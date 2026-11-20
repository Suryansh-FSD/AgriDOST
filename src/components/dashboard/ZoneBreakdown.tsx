'use client';

import React from 'react';
import { FarmZone } from '@/types';
import { Layers, AlertCircle, Plane, Plus } from 'lucide-react';

interface ZoneBreakdownProps {
  zones: FarmZone[];
  onNavigateToTab: (tab: 'mapping' | 'planner' | 'health' | 'operations' | 'drone') => void;
}

export function ZoneBreakdown({ zones, onNavigateToTab }: ZoneBreakdownProps) {
  return (
    <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-[#E7E9E2] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#DCE8D3] text-[#173F2B]">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#173F2B] font-heading">Farm Sectors & Zones</h3>
            <p className="text-[11px] text-[#26312A]/60">
              {zones.length} active polygons mapped to current farm
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigateToTab('planner')}
          className="flex items-center gap-1 rounded-xl bg-[#173F2B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0f2c1e] transition font-heading"
        >
          <Plus className="h-3 w-3 text-[#DCE8D3]" />
          <span>New Zone</span>
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {zones.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#26312A]/50">
            No zones created yet. Delineate sectors using the Crop Planner or Drone Planner.
          </p>
        ) : (
          zones.map((zone) => {
            let badgeBg = 'bg-[#DCE8D3]/60 text-[#173F2B] border-[#DCE8D3]';
            let Icon = Layers;

            if (zone.type === 'disease') {
              badgeBg = 'bg-[#B9784F]/15 text-[#B9784F] border-[#B9784F]/30';
              Icon = AlertCircle;
            } else if (zone.type === 'spray') {
              badgeBg = 'bg-[#F1D98A]/40 text-[#26312A] border-[#F1D98A]';
              Icon = Plane;
            }

            return (
              <div
                key={zone.id}
                className="flex items-center justify-between rounded-2xl border border-[#E7E9E2] p-3 hover:bg-[#F7F7F0] transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${badgeBg}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#173F2B] font-heading truncate">
                        {zone.name}
                      </span>
                      {zone.isDemo && (
                        <span className="rounded-full bg-[#F7F7F0] px-1.5 py-0.2 text-[9px] font-semibold text-[#26312A]/50 border border-[#E7E9E2]">
                          Demo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#26312A]/70 truncate">
                      {zone.cropName ? `Crop: ${zone.cropName}` : ''}
                      {zone.diseaseName ? `Issue: ${zone.diseaseName}` : ''}
                      {zone.chemicalName ? `Chemical: ${zone.chemicalName}` : ''}
                      {!zone.cropName && !zone.diseaseName && !zone.chemicalName && zone.notes}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-3">
                  <span className="text-xs font-bold text-[#173F2B] font-heading">
                    {zone.areaAcres ? `${zone.areaAcres.toFixed(1)} Ac` : '—'}
                  </span>
                  <p className="text-[10px] text-[#26312A]/50 capitalize">{zone.type}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
