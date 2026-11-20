'use client';

import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar, NavTab } from './Sidebar';
import { AddFarmModal } from './AddFarmModal';
import { useFarmData } from '@/lib/data/useFarmData';

interface AppShellProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  children: React.ReactNode;
}

export function AppShell({ currentTab, onSelectTab, children }: AppShellProps) {
  const { farms, activeFarm, switchFarm, addFarm, resetDemo } = useFarmData();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddFarmOpen, setIsAddFarmOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F0] text-[#26312A]">
      {/* Top Application Header */}
      <Header
        farms={farms}
        activeFarm={activeFarm}
        onSelectFarm={switchFarm}
        onOpenAddFarmModal={() => setIsAddFarmOpen(true)}
        onResetDemo={resetDemo}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      {/* Main Body with Sidebar + Content */}
      <div className="flex flex-1">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Add New Farm Modal */}
      <AddFarmModal
        isOpen={isAddFarmOpen}
        onClose={() => setIsAddFarmOpen(false)}
        onSaveFarm={addFarm}
      />
    </div>
  );
}
