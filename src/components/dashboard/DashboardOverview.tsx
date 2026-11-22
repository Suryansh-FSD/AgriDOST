'use client';

import React from 'react';
import { useFarmData } from '@/lib/data/useFarmData';
import { StatCards } from './StatCards';
import { FarmSummaryCard } from './FarmSummaryCard';
import { FarmMapPreview } from './FarmMapPreview';
import { ZoneBreakdown } from './ZoneBreakdown';
import { RecentActivity } from './RecentActivity';
import { QuickActionToolbar } from './QuickActionToolbar';
import { IntegrationHealthWidget } from './IntegrationHealthWidget';
import { NavTab } from '../layout/Sidebar';

interface DashboardOverviewProps {
  onNavigateToTab: (tab: NavTab) => void;
}

export function DashboardOverview({ onNavigateToTab }: DashboardOverviewProps) {
  const {
    activeFarm,
    zones,
    healthObservations,
    sprayOps,
    tasks,
    resetDemo,
  } = useFarmData();

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Active Farm Cadastral Summary */}
      <FarmSummaryCard
        farm={activeFarm}
        onNavigateToTab={onNavigateToTab}
      />

      {/* KPI Stats Row */}
      <StatCards
        farm={activeFarm}
        zones={zones}
        healthObservations={healthObservations}
        sprayOps={sprayOps}
        tasks={tasks}
      />

      {/* Quick Action Navigation Bar */}
      <QuickActionToolbar
        onNavigateToTab={onNavigateToTab}
        onResetDemo={resetDemo}
      />

      {/* Main Grid: Interactive Map Cadastre + Zone List */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 sm:gap-6">
        {/* Left Column (7 cols): Map Preview */}
        <div className="lg:col-span-7">
          <FarmMapPreview
            farm={activeFarm}
            zones={zones}
            onNavigateToMapping={() => onNavigateToTab('mapping')}
          />
        </div>

        {/* Right Column (5 cols): Zone Breakdown */}
        <div className="lg:col-span-5">
          <ZoneBreakdown
            zones={zones}
            onNavigateToTab={onNavigateToTab}
          />
        </div>
      </div>

      {/* External Integration Health Gateway */}
      <IntegrationHealthWidget />

      {/* Field Action Feed */}
      <RecentActivity
        healthObservations={healthObservations}
        sprayOps={sprayOps}
        tasks={tasks}
        onNavigateToTab={onNavigateToTab}
      />
    </div>
  );
}
