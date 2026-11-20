'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  Map, 
  CalendarDays, 
  ScanEye, 
  TreePine, 
  Plane,
  X,
  Info
} from 'lucide-react';

export type NavTab = 
  | 'dashboard' 
  | 'mapping' 
  | 'planner' 
  | 'health' 
  | 'operations' 
  | 'drone';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
}: SidebarProps) {
  const navItems: Array<{
    id: NavTab;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    {
      id: 'dashboard',
      label: 'Farm Overview',
      description: 'Cadastral summary & key metrics',
      icon: LayoutDashboard,
    },
    {
      id: 'mapping',
      label: 'Smart Farm Mapping',
      description: 'Boundary drawing & land cadastre',
      icon: Map,
      badge: 'Core Map',
    },
    {
      id: 'planner',
      label: 'AI Crop Planner',
      description: 'Evidence-based crop zoning',
      icon: CalendarDays,
      badge: 'Zoning',
    },
    {
      id: 'health',
      label: 'AI Crop Health',
      description: 'Gemini visual foliar pathology',
      icon: ScanEye,
      badge: 'Gemini',
    },
    {
      id: 'operations',
      label: 'Trees & Supplies',
      description: 'Boundary agro-forestry & inputs',
      icon: TreePine,
    },
    {
      id: 'drone',
      label: 'Drone Spray Planner',
      description: 'Precision spray zone & GeoJSON',
      icon: Plane,
      badge: 'GeoJSON',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#26312A]/40 backdrop-blur-xs lg:hidden transition-opacity" 
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between border-r border-[#E7E9E2] bg-[#F7F7F0] transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top: Navigation Links */}
        <div>
          <div className="flex h-16 items-center justify-between px-6 border-b border-[#E7E9E2] lg:hidden bg-white">
            <span className="text-base font-bold text-[#173F2B] font-heading">AgriDOST Navigation</span>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[#26312A]/70 hover:bg-[#F7F7F0]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 space-y-1.5">
            <div className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-[#173F2B]/60 font-heading">
              Platform Modules
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    onClose();
                  }}
                  className={`group flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${
                    isActive
                      ? 'bg-[#173F2B] text-white shadow-xs'
                      : 'text-[#26312A] hover:bg-white/80 hover:text-[#173F2B]'
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                      isActive
                        ? 'bg-[#264f3a] text-white'
                        : 'bg-white text-[#173F2B] border border-[#E7E9E2] group-hover:border-[#6F9B55]/40'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs sm:text-sm font-semibold truncate font-heading">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                            isActive
                              ? 'bg-[#DCE8D3] text-[#173F2B]'
                              : 'bg-[#DCE8D3]/60 text-[#173F2B]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] line-clamp-1 transition ${
                        isActive ? 'text-[#DCE8D3]' : 'text-[#26312A]/60'
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Card: Anti-Hallucination & Architecture Notice */}
        <div className="p-4 border-t border-[#E7E9E2] bg-white">
          <div className="rounded-2xl border border-[#E7E9E2] bg-[#F7F7F0] p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#173F2B] font-heading">
              <Info className="h-3.5 w-3.5 text-[#173F2B] shrink-0" />
              <span>AgriDOST Trust Architecture</span>
            </div>
            <ul className="mt-1.5 space-y-1 text-[11px] text-[#26312A]/80 leading-tight">
              <li>• Code calculates geometry (Turf.js)</li>
              <li>• Gemini interprets & explains</li>
              <li>• Human verification before spray</li>
              <li>• 100% Offline LocalStorage sync</li>
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}
