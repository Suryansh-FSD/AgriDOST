'use client';

import React from 'react';
import { Layers, ShieldAlert, Plane, Sprout, Eye, EyeOff } from 'lucide-react';

export interface MapLegendProps {
  showZones?: boolean;
  onToggleZones?: () => void;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  showLabels?: boolean;
  onToggleLabels?: () => void;
  className?: string;
}

export function MapLegend({
  showZones = true,
  onToggleZones,
  showGrid = true,
  onToggleGrid,
  showLabels = true,
  onToggleLabels,
  className = '',
}: MapLegendProps) {
  return (
    <div
      className={`rounded-2xl border border-[#E7E9E2] bg-white p-3.5 shadow-xs text-xs text-[#26312A] ${className}`}
    >
      <div className="flex items-center justify-between border-b border-[#E7E9E2] pb-2 mb-2.5">
        <div className="flex items-center gap-1.5 font-semibold text-[#173F2B]">
          <Layers className="h-3.5 w-3.5 text-[#173F2B]" />
          <span>Cadastre Layers & Legend</span>
        </div>
        <span className="rounded-full bg-[#DCE8D3] px-2 py-0.5 text-[10px] font-semibold text-[#173F2B]">
          RFC 7946 GeoJSON
        </span>
      </div>

      {/* Layer Types */}
      <div className="space-y-2">
        {/* Farm Boundary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3.5 w-3.5 rounded border-2 border-[#173F2B] bg-[#173F2B]/10" />
            <span className="font-medium text-[#26312A]">Farm Perimeter</span>
          </div>
          <span className="text-[10px] text-[#26312A]/60">Outer Boundary</span>
        </div>

        {/* Crop Parcels */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3.5 w-3.5 rounded border border-[#173F2B] bg-[#6F9B55]/40" />
            <div className="flex items-center gap-1">
              <Sprout className="h-3 w-3 text-[#173F2B]" />
              <span>Crop Parcels</span>
            </div>
          </div>
          <span className="text-[10px] text-[#26312A]/60">Zoned Fields</span>
        </div>

        {/* Disease Hotspots */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3.5 w-3.5 rounded border-2 border-dashed border-[#B9784F] bg-[#B9784F]/25" />
            <div className="flex items-center gap-1">
              <ShieldAlert className="h-3 w-3 text-[#B9784F]" />
              <span>Disease Hotspot</span>
            </div>
          </div>
          <span className="text-[10px] text-[#26312A]/60">Infection Alert</span>
        </div>

        {/* Spray Corridors */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3.5 w-3.5 rounded border-2 border-dotted border-[#173F2B] bg-[#6F9B55]/20" />
            <div className="flex items-center gap-1">
              <Plane className="h-3 w-3 text-[#173F2B]" />
              <span>Precision Spray</span>
            </div>
          </div>
          <span className="text-[10px] text-[#26312A]/60">Drone Corridor</span>
        </div>
      </div>

      {/* Toggles */}
      {(onToggleZones || onToggleGrid || onToggleLabels) && (
        <div className="mt-3 pt-2.5 border-t border-[#E7E9E2] flex items-center justify-between gap-1 text-[11px]">
          {onToggleZones && (
            <button
              onClick={onToggleZones}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
                showZones
                  ? 'bg-[#DCE8D3] text-[#173F2B] font-medium'
                  : 'text-[#26312A]/50 hover:text-[#26312A]'
              }`}
              title="Toggle Zones Visibility"
            >
              {showZones ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              <span>Zones</span>
            </button>
          )}

          {onToggleGrid && (
            <button
              onClick={onToggleGrid}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
                showGrid
                  ? 'bg-[#DCE8D3] text-[#173F2B] font-medium'
                  : 'text-[#26312A]/50 hover:text-[#26312A]'
              }`}
              title="Toggle Grid Lines"
            >
              {showGrid ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              <span>Grid</span>
            </button>
          )}

          {onToggleLabels && (
            <button
              onClick={onToggleLabels}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
                showLabels
                  ? 'bg-[#DCE8D3] text-[#173F2B] font-medium'
                  : 'text-[#26312A]/50 hover:text-[#26312A]'
              }`}
              title="Toggle Zone Labels"
            >
              {showLabels ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              <span>Labels</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
