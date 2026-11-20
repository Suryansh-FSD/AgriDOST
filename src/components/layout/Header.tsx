'use client';

import React from 'react';
import { Farm } from '@/types';
import { 
  Sprout, 
  ChevronDown, 
  Plus, 
  Database, 
  RotateCcw, 
  Menu,
  ShieldCheck,
  MapPin,
  BookOpen
} from 'lucide-react';

interface HeaderProps {
  farms: Farm[];
  activeFarm?: Farm;
  onSelectFarm: (farmId: string) => void;
  onOpenAddFarmModal: () => void;
  onResetDemo: () => void;
  onToggleSidebar: () => void;
  onOpenLanding?: () => void;
}

export function Header({
  farms,
  activeFarm,
  onSelectFarm,
  onOpenAddFarmModal,
  onResetDemo,
  onToggleSidebar,
  onOpenLanding,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E7E9E2] bg-white/95 px-4 md:px-6 backdrop-blur shadow-2xs">
      {/* Left: Mobile Menu Trigger & AgriDOST Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#26312A] hover:bg-[#F7F7F0] lg:hidden transition"
          title="Toggle Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div 
          onClick={onOpenLanding}
          className={`flex items-center gap-2.5 ${onOpenLanding ? 'cursor-pointer group' : ''}`}
          title={onOpenLanding ? "Return to AgriDOST Platform Overview & Guide" : undefined}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#173F2B] text-white shadow-xs group-hover:scale-105 transition">
            <Sprout className="h-5 w-5 text-[#DCE8D3]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-[#173F2B] font-heading group-hover:text-[#6F9B55] transition">
                AgriDOST
              </span>
              <span className="rounded-full bg-[#DCE8D3] px-2 py-0.5 text-[10px] font-bold text-[#173F2B] border border-[#6F9B55]/30">
                Precision OS
              </span>
            </div>
            <p className="hidden text-[11px] font-medium text-[#26312A]/70 sm:block">
              Unified Farm Cadastre & Map-First Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Right: Farm Selector & Quick Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Landing Page Guide Button */}
        {onOpenLanding && (
          <button
            onClick={onOpenLanding}
            className="flex h-9 items-center gap-1.5 rounded-2xl border border-[#E7E9E2] bg-white px-3 text-xs font-semibold text-[#173F2B] shadow-2xs hover:bg-[#F7F7F0] hover:border-[#6F9B55]/50 transition"
            title="Read AgriDOST Platform Guide & Technical Architecture"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#6F9B55]" />
            <span className="hidden sm:inline">Platform Guide</span>
          </button>
        )}
        {/* Farm Switcher Dropdown */}
        <div className="relative flex items-center">
          <div className="relative flex items-center rounded-2xl border border-[#E7E9E2] bg-[#F7F7F0] p-1.5 pl-3 transition hover:border-[#6F9B55]/50 shadow-2xs">
            <MapPin className="mr-2 h-4 w-4 text-[#173F2B] shrink-0" />
            <select
              value={activeFarm?.id || ''}
              onChange={(e) => onSelectFarm(e.target.value)}
              className="appearance-none bg-transparent pr-7 text-xs sm:text-sm font-semibold text-[#26312A] focus:outline-hidden cursor-pointer max-w-[130px] sm:max-w-[210px] truncate"
              title="Select Active Farm"
            >
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name} {farm.isDemo ? '(Demo)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[#26312A]/60" />
          </div>
        </div>

        {/* Add Farm Button */}
        <button
          onClick={onOpenAddFarmModal}
          className="flex h-9 items-center gap-1.5 rounded-2xl bg-[#173F2B] px-3.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-[#0f2c1e] transition active:scale-95"
          title="Create New Farm Profile"
        >
          <Plus className="h-4 w-4 text-[#DCE8D3]" />
          <span className="hidden md:inline">New Farm</span>
        </button>

        {/* Reset Demo Data Button */}
        <button
          onClick={onResetDemo}
          className="flex h-9 items-center gap-1.5 rounded-2xl border border-[#E7E9E2] bg-white px-2.5 sm:px-3 text-xs font-semibold text-[#26312A] shadow-2xs hover:bg-[#F7F7F0] transition"
          title="Reset LocalStorage to Verified Demo Farms"
        >
          <RotateCcw className="h-3.5 w-3.5 text-[#26312A]/60" />
          <span className="hidden lg:inline">Reset Demo</span>
        </button>

        {/* Storage Sync Badge */}
        <div className="hidden xl:flex items-center gap-1.5 rounded-2xl bg-[#DCE8D3]/50 px-2.5 py-1 text-[11px] font-semibold text-[#173F2B] border border-[#DCE8D3]">
          <Database className="h-3 w-3 text-[#173F2B]" />
          <span>LocalStorage Synced</span>
          <ShieldCheck className="h-3 w-3 text-[#173F2B] ml-0.5" />
        </div>
      </div>
    </header>
  );
}
