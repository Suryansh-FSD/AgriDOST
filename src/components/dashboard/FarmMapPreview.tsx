'use client';

import React, { useState } from 'react';
import { Farm, FarmZone } from '@/types';
import { calculateBoundingBox, polygonToSvgPoints } from '@/lib/data/geo-utils';
import { Eye, Compass, MapPin } from 'lucide-react';

interface FarmMapPreviewProps {
  farm?: Farm;
  zones: FarmZone[];
  onNavigateToMapping: () => void;
}

export function FarmMapPreview({
  farm,
  zones,
  onNavigateToMapping,
}: FarmMapPreviewProps) {
  const [selectedZone, setSelectedZone] = useState<FarmZone | null>(null);

  if (!farm || !farm.boundary || !farm.boundary.coordinates?.[0]?.length) {
    return (
      <div className="flex h-80 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E7E9E2] bg-white p-6 text-center shadow-xs">
        <MapPin className="h-10 w-10 text-[#6F9B55]" />
        <h4 className="mt-3 text-base font-bold text-[#173F2B] font-heading">No Farm Boundary Mapped</h4>
        <p className="mt-1 max-w-sm text-xs text-[#26312A]/70">
          Draw your farmland boundary once on satellite imagery or vector canvas to anchor all farm zones.
        </p>
        <button
          onClick={onNavigateToMapping}
          className="mt-4 rounded-2xl bg-[#173F2B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0f2c1e] transition"
        >
          Open Smart Farm Mapper
        </button>
      </div>
    );
  }

  const bbox = calculateBoundingBox(farm.boundary);
  const width = 600;
  const height = 380;
  const farmPoints = polygonToSvgPoints(farm.boundary, width, height, bbox, 35);

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E7E9E2] bg-white shadow-xs">
      {/* Top Header of Map Preview */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7E9E2] px-4 py-3 bg-[#F7F7F0]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#DCE8D3] text-[#173F2B]">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#173F2B] font-heading">
              Unified Cadastral Blueprint
            </h3>
            <p className="text-[11px] text-[#26312A]/60">
              {bbox.centerLat.toFixed(4)}°N, {bbox.centerLng.toFixed(4)}°E • RFC 7946 Canonical GeoJSON
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateToMapping}
            className="flex items-center gap-1.5 rounded-xl border border-[#E7E9E2] bg-white px-2.5 py-1 text-xs font-semibold text-[#173F2B] hover:bg-[#DCE8D3]/50 transition shadow-2xs font-heading"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Open Map Workspace</span>
          </button>
        </div>
      </div>

      {/* Interactive SVG Rendering */}
      <div className="relative w-full h-72 sm:h-80 bg-[#FAF9F5] flex items-center justify-center p-2">
        {/* Coordinate Grid Background */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none" 
          style={{
            backgroundImage: 'radial-gradient(#173F2B 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} 
        />

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full max-h-72 drop-shadow-sm select-none"
        >
          {/* Main Farm Outer Boundary Polygon */}
          <polygon
            points={farmPoints}
            fill="#DCE8D3"
            fillOpacity="0.55"
            stroke="#173F2B"
            strokeWidth="3"
            strokeDasharray="none"
            className="transition hover:fill-opacity-70"
          />

          {/* Farm Zones (Crop, Disease, Spray) */}
          {zones.map((zone) => {
            const zonePoints = polygonToSvgPoints(zone.geometry, width, height, bbox, 35);
            if (!zonePoints) return null;

            const isSelected = selectedZone?.id === zone.id;
            let fillColor = '#6F9B55'; // Crop Green
            let strokeColor = '#173F2B';

            if (zone.type === 'disease') {
              fillColor = '#B9784F'; // Earth Clay
              strokeColor = '#8A4F2A';
            } else if (zone.type === 'spray') {
              fillColor = '#F1D98A'; // Harvest Gold
              strokeColor = '#B9784F';
            }

            return (
              <g key={zone.id} className="cursor-pointer">
                <polygon
                  points={zonePoints}
                  fill={fillColor}
                  fillOpacity={isSelected ? 0.9 : 0.6}
                  stroke={isSelected ? '#173F2B' : strokeColor}
                  strokeWidth={isSelected ? 3 : 1.8}
                  strokeDasharray={zone.type === 'spray' ? '4 3' : 'none'}
                  onClick={() => setSelectedZone(zone)}
                  className="transition duration-150 hover:fill-opacity-80"
                />
              </g>
            );
          })}
        </svg>

        {/* Selected Zone Float Card */}
        {selectedZone && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-xs rounded-2xl border border-[#E7E9E2] bg-white p-3 shadow-lg text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[#173F2B] font-heading truncate">{selectedZone.name}</span>
              <button
                onClick={() => setSelectedZone(null)}
                className="text-[#26312A]/50 hover:text-[#26312A] text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-[#26312A]/70">
              <span className="rounded-full bg-[#F7F7F0] px-2 py-0.5 font-bold uppercase text-[#173F2B] border border-[#E7E9E2]">
                {selectedZone.type}
              </span>
              <span>{selectedZone.areaAcres ? `${selectedZone.areaAcres.toFixed(1)} Acres` : 'Measured Area'}</span>
            </div>
            {selectedZone.cropName && (
              <p className="mt-1 text-[11px] text-[#6F9B55] font-semibold">Crop: {selectedZone.cropName}</p>
            )}
            {selectedZone.diseaseName && (
              <p className="mt-1 text-[11px] text-[#B9784F] font-semibold">Alert: {selectedZone.diseaseName}</p>
            )}
          </div>
        )}
      </div>

      {/* Map Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E7E9E2] px-4 py-2.5 bg-white text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md border border-[#173F2B] bg-[#DCE8D3]" />
            <span className="text-[#26312A]/70 text-[11px]">Farm Boundary</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-[#6F9B55]" />
            <span className="text-[#26312A]/70 text-[11px]">Crop Zones</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-[#B9784F]" />
            <span className="text-[#26312A]/70 text-[11px]">Pathology Alerts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-[#F1D98A] border border-[#B9784F]" />
            <span className="text-[#26312A]/70 text-[11px]">Spray Corridors</span>
          </div>
        </div>

        <span className="text-[10px] text-[#26312A]/50">Click any sector to inspect metadata</span>
      </div>
    </div>
  );
}
