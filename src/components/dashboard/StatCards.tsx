'use client';

import React from 'react';
import { Farm, FarmZone, HealthObservation, SprayOperation, FarmTask } from '@/types';
import { 
  LandPlot, 
  Layers, 
  AlertTriangle, 
  Plane, 
  CheckCircle2,
  TrendingUp
} from 'lucide-react';

interface StatCardsProps {
  farm?: Farm;
  zones: FarmZone[];
  healthObservations: HealthObservation[];
  sprayOps: SprayOperation[];
  tasks: FarmTask[];
}

export function StatCards({
  farm,
  zones,
  healthObservations,
  sprayOps,
  tasks,
}: StatCardsProps) {
  const cropZonesCount = zones.filter((z) => z.type === 'crop').length;
  const diseaseAlertsCount = healthObservations.filter((h) => h.status !== 'treated').length;
  const scheduledSpraysCount = sprayOps.filter((s) => s.status === 'scheduled').length;
  const pendingTasksCount = tasks.filter((t) => t.status === 'pending').length;

  const cards = [
    {
      title: 'Total Mapped Land',
      value: farm ? `${farm.areaAcres.toFixed(1)} Acres` : '0.0 Acres',
      secondary: farm ? `${Math.round(farm.areaSqM).toLocaleString('en-IN')} m²` : '0 m²',
      icon: LandPlot,
      badge: 'Turf.js Code',
      badgeBg: 'bg-[#DCE8D3] text-[#173F2B]',
    },
    {
      title: 'Active Crop Zones',
      value: `${cropZonesCount} Zones`,
      secondary: `${zones.length} Total Farm Sectors`,
      icon: Layers,
      badge: 'Delineated',
      badgeBg: 'bg-[#DCE8D3]/70 text-[#173F2B]',
    },
    {
      title: 'Crop Health Alerts',
      value: `${diseaseAlertsCount} Observed`,
      secondary: 'Requires Field Check',
      icon: AlertTriangle,
      badge: 'AI-Assisted',
      badgeBg: 'bg-[#B9784F]/15 text-[#B9784F]',
    },
    {
      title: 'Scheduled Sprays',
      value: `${scheduledSpraysCount} Missions`,
      secondary: 'Zero-drift verified',
      icon: Plane,
      badge: 'GeoJSON Ready',
      badgeBg: 'bg-[#DCE8D3] text-[#173F2B]',
    },
    {
      title: 'Pending Field Tasks',
      value: `${pendingTasksCount} Tasks`,
      secondary: 'Irrigation & Inputs',
      icon: CheckCircle2,
      badge: 'Action Items',
      badgeBg: 'bg-[#F1D98A]/40 text-[#26312A]',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className="flex flex-col justify-between rounded-2xl border border-[#E7E9E2] bg-white p-4 sm:p-4.5 shadow-xs transition hover:border-[#6F9B55]/50"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${c.badgeBg}`}>
                  {c.badge}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DCE8D3]/60 text-[#173F2B]">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2.5 text-xs font-semibold text-[#26312A]/70 line-clamp-1 font-heading">{c.title}</p>
              <h4 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-[#173F2B] font-heading">
                {c.value}
              </h4>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#E7E9E2] flex items-center justify-between text-[11px] text-[#26312A]/60">
              <span className="truncate">{c.secondary}</span>
              <TrendingUp className="h-3 w-3 text-[#6F9B55] shrink-0 ml-1" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
