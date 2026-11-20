'use client';

import React from 'react';
import { 
  Map, 
  CalendarDays, 
  ScanEye, 
  Plane, 
  TreePine, 
  RotateCcw,
  Sparkles 
} from 'lucide-react';

interface QuickActionToolbarProps {
  onNavigateToTab: (tab: 'mapping' | 'planner' | 'health' | 'operations' | 'drone') => void;
  onResetDemo: () => void;
}

export function QuickActionToolbar({
  onNavigateToTab,
  onResetDemo,
}: QuickActionToolbarProps) {
  const actions = [
    {
      label: 'Map Boundary',
      sub: 'Cadastral drawing',
      icon: Map,
      onClick: () => onNavigateToTab('mapping'),
      iconBg: 'bg-[#DCE8D3] text-[#173F2B]',
    },
    {
      label: 'Crop Planner',
      sub: 'AI & manual zoning',
      icon: CalendarDays,
      onClick: () => onNavigateToTab('planner'),
      iconBg: 'bg-[#DCE8D3] text-[#173F2B]',
    },
    {
      label: 'AI Leaf Scan',
      sub: 'Gemini symptom scan',
      icon: ScanEye,
      onClick: () => onNavigateToTab('health'),
      iconBg: 'bg-[#B9784F]/15 text-[#B9784F]',
    },
    {
      label: 'Drone Spray',
      sub: 'GeoJSON corridor',
      icon: Plane,
      onClick: () => onNavigateToTab('drone'),
      iconBg: 'bg-[#F1D98A]/40 text-[#26312A]',
    },
    {
      label: 'Trees & Supplies',
      sub: 'Agro-forestry & stock',
      icon: TreePine,
      onClick: () => onNavigateToTab('operations'),
      iconBg: 'bg-[#DCE8D3] text-[#173F2B]',
    },
  ];

  return (
    <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#173F2B] font-heading">
          <Sparkles className="h-3.5 w-3.5 text-[#6F9B55]" />
          <span>Core Operational Workflows</span>
        </div>

        <button
          onClick={onResetDemo}
          className="flex items-center gap-1 text-[11px] font-semibold text-[#26312A]/60 hover:text-[#173F2B] font-heading"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reload Demo Farms</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {actions.map((act, i) => {
          const Icon = act.icon;
          return (
            <button
              key={i}
              onClick={act.onClick}
              className="flex flex-col items-start rounded-2xl border border-[#E7E9E2] p-3 text-left transition hover:border-[#6F9B55]/60 hover:bg-[#F7F7F0] shadow-2xs active:scale-95"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${act.iconBg}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="mt-2 text-xs font-bold text-[#173F2B] font-heading">{act.label}</span>
              <span className="text-[10px] text-[#26312A]/60">{act.sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
