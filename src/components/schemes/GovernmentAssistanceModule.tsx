'use client';

import React, { useState } from 'react';
import {
  Landmark,
  FileCheck,
  Calendar,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Farm } from '@/types';
import { SchemesOverview } from './SchemesOverview';
import { ApplicationTracker } from './ApplicationTracker';
import { ReminderManager } from './ReminderManager';
import { SchemeAIAssistant } from './SchemeAIAssistant';

export type SchemesSubTab = 'overview' | 'tracker' | 'reminders' | 'ai';

interface GovernmentAssistanceModuleProps {
  activeFarm?: Farm;
  farms?: Farm[];
}

export function GovernmentAssistanceModule({
  activeFarm,
  farms = [],
}: GovernmentAssistanceModuleProps) {
  const [subTab, setSubTab] = useState<SchemesSubTab>('overview');
  const [selectedSchemeForAI, setSelectedSchemeForAI] = useState<string | undefined>(undefined);

  return (
    <div className="space-y-6">
      {/* Module Header & Subtab Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DCE8D3] text-[#173F2B]">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#173F2B] font-heading">
                  Government Assistance & Schemes
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Verified Registry
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#26312A]/70">
                Official Central & State agricultural schemes, deterministic eligibility checks, document preparation, and offline application tracking.
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-[#F7F7F0] p-1 border border-[#E7E9E2] text-xs font-semibold">
          <button
            onClick={() => setSubTab('overview')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition font-heading ${
              subTab === 'overview'
                ? 'bg-[#173F2B] text-white shadow-xs'
                : 'text-[#26312A]/70 hover:text-[#173F2B]'
            }`}
          >
            <Landmark className="h-3.5 w-3.5" />
            <span>Scheme Directory</span>
          </button>

          <button
            onClick={() => setSubTab('tracker')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition font-heading ${
              subTab === 'tracker'
                ? 'bg-[#173F2B] text-white shadow-xs'
                : 'text-[#26312A]/70 hover:text-[#173F2B]'
            }`}
          >
            <FileCheck className="h-3.5 w-3.5" />
            <span>Application Tracker</span>
          </button>

          <button
            onClick={() => setSubTab('reminders')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition font-heading ${
              subTab === 'reminders'
                ? 'bg-[#173F2B] text-white shadow-xs'
                : 'text-[#26312A]/70 hover:text-[#173F2B]'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Deadlines & Reminders</span>
          </button>

          <button
            onClick={() => setSubTab('ai')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition font-heading ${
              subTab === 'ai'
                ? 'bg-[#173F2B] text-white shadow-xs'
                : 'text-[#26312A]/70 hover:text-[#173F2B]'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>AI Scheme Advisor</span>
          </button>
        </div>
      </div>

      {/* Active Farm Context Reminder */}
      {activeFarm && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] px-4 py-2.5 text-xs text-[#26312A]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#173F2B]">Active Farm Context:</span>
            <span>{activeFarm.name}</span>
            <span className="text-[#26312A]/40">•</span>
            <span>{activeFarm.areaAcres} Acres</span>
            <span className="text-[#26312A]/40">•</span>
            <span>{activeFarm.locationDetails?.state || activeFarm.location || 'India'}</span>
            {activeFarm.locationDetails?.district && (
              <>
                <span className="text-[#26312A]/40">•</span>
                <span>District: {activeFarm.locationDetails.district}</span>
              </>
            )}
            {activeFarm.primaryCrop && (
              <>
                <span className="text-[#26312A]/40">•</span>
                <span>Primary: {activeFarm.primaryCrop}</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-[#4D6B53]">
            Auto-fills eligibility questionnaires & state filtering
          </div>
        </div>
      )}

      {/* Subtab Contents */}
      {subTab === 'overview' && (
        <SchemesOverview farm={activeFarm} />
      )}

      {subTab === 'tracker' && (
        <ApplicationTracker
          farms={farms.length > 0 ? farms : (activeFarm ? [activeFarm] : [])}
          activeFarmId={activeFarm?.id}
        />
      )}

      {subTab === 'reminders' && (
        <ReminderManager
          farms={farms.length > 0 ? farms : (activeFarm ? [activeFarm] : [])}
          activeFarmId={activeFarm?.id}
        />
      )}

      {subTab === 'ai' && (
        <SchemeAIAssistant
          activeFarm={activeFarm}
          selectedSchemeId={selectedSchemeForAI}
          onSelectScheme={(id) => setSelectedSchemeForAI(id)}
        />
      )}
    </div>
  );
}
