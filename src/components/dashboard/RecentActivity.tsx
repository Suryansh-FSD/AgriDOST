'use client';

import React from 'react';
import { HealthObservation, SprayOperation, FarmTask } from '@/types';
import { 
  ScanEye, 
  Plane, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';

interface RecentActivityProps {
  healthObservations: HealthObservation[];
  sprayOps: SprayOperation[];
  tasks: FarmTask[];
  onNavigateToTab: (tab: 'mapping' | 'planner' | 'health' | 'operations' | 'drone') => void;
}

export function RecentActivity({
  healthObservations,
  sprayOps,
  tasks,
  onNavigateToTab,
}: RecentActivityProps) {
  return (
    <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-[#E7E9E2] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#DCE8D3] text-[#173F2B]">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#173F2B] font-heading">Field Action Feed</h3>
            <p className="text-[11px] text-[#26312A]/60">Operational events & agronomic tasks</p>
          </div>
        </div>
      </div>

      <div className="mt-3 divide-y divide-[#E7E9E2]">
        {/* Health Observation Items */}
        {healthObservations.slice(0, 2).map((item) => (
          <div key={item.id} className="py-2.5 flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#B9784F]/15 text-[#B9784F]">
              <ScanEye className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#173F2B] font-heading truncate">
                  AI Scan: {item.detectedDisease || 'Visible Leaf Symptoms'}
                </span>
                <span className="rounded-full bg-[#B9784F]/15 px-2 py-0.2 text-[9px] font-bold text-[#B9784F]">
                  {item.severity || 'Review'}
                </span>
              </div>
              <p className="text-[11px] text-[#26312A]/70 line-clamp-1">
                {item.symptoms?.[0] || 'Visible symptom pathology analyzed by Gemini.'}
              </p>
              <button
                onClick={() => onNavigateToTab('health')}
                className="mt-1 text-[11px] font-semibold text-[#173F2B] hover:underline font-heading"
              >
                Inspect Diagnostic Report →
              </button>
            </div>
          </div>
        ))}

        {/* Spray Operation Items */}
        {sprayOps.slice(0, 2).map((item) => (
          <div key={item.id} className="py-2.5 flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#DCE8D3] text-[#173F2B]">
              <Plane className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#173F2B] font-heading truncate">
                  Spray: {item.productName}
                </span>
                <span className="rounded-full bg-[#DCE8D3] px-2 py-0.2 text-[9px] font-bold text-[#173F2B] capitalize">
                  {item.status}
                </span>
              </div>
              <p className="text-[11px] text-[#26312A]/70 line-clamp-1">
                Equipment: {item.equipmentType} • Wind: {item.windSpeedKmh} km/h (Safety: {item.safetyStatus})
              </p>
              <button
                onClick={() => onNavigateToTab('drone')}
                className="mt-1 text-[11px] font-semibold text-[#173F2B] hover:underline font-heading"
              >
                View Spray Corridor & GeoJSON →
              </button>
            </div>
          </div>
        ))}

        {/* Task Items */}
        {tasks.slice(0, 2).map((item) => (
          <div key={item.id} className="py-2.5 flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#6F9B55]/15 text-[#6F9B55]">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-[#173F2B] font-heading block truncate">
                {item.title}
              </span>
              <p className="text-[11px] text-[#26312A]/60">
                Due: {item.dueDate} • Status: <span className="capitalize">{item.status}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
