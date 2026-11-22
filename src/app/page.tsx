'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { NavTab } from '@/components/layout/Sidebar';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { LandingPage } from '@/components/landing/LandingPage';
import { useFarmData } from '@/lib/data/useFarmData';

// Subagent 1: Mapping & Crop Planning
import { FarmMap } from '@/components/map';
import { CropPlanner } from '@/components/planner';

// Subagent 2: AI Crop Health & Pathology
import { CropHealthScanner } from '@/components/health';

// Subagent 3: Farm Operations & Drone
import { BoundaryTreePlanner } from '@/components/operations/BoundaryTreePlanner';
import { ActivityReminders, SupplyManager } from '@/components/supplies';
import { DroneSprayPlanner } from '@/components/drone';

// Subagent 4: Government Assistance & Schemes
import { GovernmentAssistanceModule } from '@/components/schemes';

// AgriDOST 4.0: n8n Automation Center
import { AutomationCenter } from '@/components/automation';

// AgriDOST 4.0: Market Intelligence & Telegram Notifications
import { MarketIntelligenceModule } from '@/components/market';
import { TelegramAlertCenter } from '@/components/telegram';

import { 
  TreePine, 
  Clock, 
  Boxes 
} from 'lucide-react';

export default function Home() {
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [operationsSubTab, setOperationsSubTab] = useState<'trees' | 'tasks' | 'supplies'>('trees');
  const { farms, activeFarm, refresh } = useFarmData();

  if (view === 'landing') {
    return (
      <LandingPage
        onLaunchApp={(tab) => {
          if (tab) {
            setCurrentTab(tab);
          }
          setView('app');
        }}
      />
    );
  }

  return (
    <AppShell 
      currentTab={currentTab} 
      onSelectTab={setCurrentTab}
      onOpenLanding={() => setView('landing')}
    >
      {/* 1. Central Farm Overview & Dashboard */}
      {currentTab === 'dashboard' && (
        <DashboardOverview onNavigateToTab={setCurrentTab} />
      )}

      {/* 2. Smart Farm Cadastral Mapping (Subagent 1) */}
      {currentTab === 'mapping' && (
        <div className="space-y-6">
          <FarmMap
            activeFarm={activeFarm}
            onFarmUpdated={refresh}
          />
        </div>
      )}

      {/* 3. AI & Farmer-Selected Crop Planner (Subagent 1) */}
      {currentTab === 'planner' && (
        <div className="space-y-6">
          <CropPlanner
            activeFarm={activeFarm}
            onPlanSaved={refresh}
          />
        </div>
      )}

      {/* 4. AI Crop Health & Leaf Pathology (Subagent 2) */}
      {currentTab === 'health' && (
        <div className="space-y-6">
          <CropHealthScanner
            initialFarmId={activeFarm?.id}
            onRecordSaved={refresh}
            onSprayPlanned={refresh}
          />
        </div>
      )}

      {/* 5. Farm Operations, Boundary Trees & Supplies (Subagent 3) */}
      {currentTab === 'operations' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DCE8D3] text-[#173F2B]">
                  <TreePine className="h-4 w-4" />
                </div>
                <h2 className="text-xl font-bold text-[#173F2B] font-heading">
                  Farm Operations & Inputs
                </h2>
              </div>
              <p className="mt-1 text-xs text-[#26312A]/60">
                Active Farm: <span className="font-semibold text-[#173F2B] font-heading">{activeFarm?.name}</span> • Boundary agro-forestry, task scheduling & stock
              </p>
            </div>

            {/* Sub-tab Switcher */}
            <div className="flex items-center gap-1.5 rounded-2xl bg-[#F7F7F0] p-1 border border-[#E7E9E2] text-xs font-semibold">
              <button
                onClick={() => setOperationsSubTab('trees')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 transition font-heading ${
                  operationsSubTab === 'trees'
                    ? 'bg-[#173F2B] text-white shadow-xs'
                    : 'text-[#26312A]/70 hover:text-[#173F2B]'
                }`}
              >
                <TreePine className="h-3.5 w-3.5" />
                <span>Boundary Trees</span>
              </button>
              <button
                onClick={() => setOperationsSubTab('tasks')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 transition font-heading ${
                  operationsSubTab === 'tasks'
                    ? 'bg-[#173F2B] text-white shadow-xs'
                    : 'text-[#26312A]/70 hover:text-[#173F2B]'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Task Reminders</span>
              </button>
              <button
                onClick={() => setOperationsSubTab('supplies')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 transition font-heading ${
                  operationsSubTab === 'supplies'
                    ? 'bg-[#173F2B] text-white shadow-xs'
                    : 'text-[#26312A]/70 hover:text-[#173F2B]'
                }`}
              >
                <Boxes className="h-3.5 w-3.5" />
                <span>Farm Supplies</span>
              </button>
            </div>
          </div>

          {operationsSubTab === 'trees' && (
            <BoundaryTreePlanner
              farm={activeFarm}
              onPlanSaved={refresh}
            />
          )}

          {operationsSubTab === 'tasks' && (
            <ActivityReminders
              farm={activeFarm}
              onTaskChange={refresh}
            />
          )}

          {operationsSubTab === 'supplies' && (
            <SupplyManager
              farm={activeFarm}
            />
          )}
        </div>
      )}

      {/* 6. Precision Drone Spray Planner (Subagent 3) */}
      {currentTab === 'drone' && (
        <div className="space-y-6">
          <DroneSprayPlanner
            farm={activeFarm}
            onOperationSaved={refresh}
          />
        </div>
      )}

      {/* 7. Government Assistance & Schemes */}
      {currentTab === 'schemes' && (
        <div className="space-y-6">
          <GovernmentAssistanceModule
            activeFarm={activeFarm}
            farms={farms}
          />
        </div>
      )}

      {/* 8. n8n Automation Center */}
      {currentTab === 'automation' && (
        <div className="space-y-6">
          <AutomationCenter
            farm={activeFarm}
          />
        </div>
      )}

      {/* 9. Market Intelligence & Mandi Pricing */}
      {currentTab === 'market' && (
        <div className="space-y-6">
          <MarketIntelligenceModule
            farm={activeFarm}
          />
        </div>
      )}

      {/* 10. Telegram Farmer Notification Center */}
      {currentTab === 'telegram' && (
        <div className="space-y-6">
          <TelegramAlertCenter
            farm={activeFarm}
          />
        </div>
      )}
    </AppShell>
  );
}
