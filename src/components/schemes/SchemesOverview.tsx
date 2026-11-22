'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  LandPlot,
  Building2,
  Layers,
  ArrowRight,
  FileCheck,
  Calendar,
  AlertCircle,
  HelpCircle,
  Eye,
  X,
  FileText,
  BadgeCheck,
} from 'lucide-react';
import {
  GovernmentScheme,
  Farm,
  FarmerSchemeApplication,
  SchemeReminder,
  EligibilityEvaluationInput,
} from '@/types';
import {
  getAllSchemes,
  searchSchemes,
} from '@/lib/schemes';
import {
  getApplications,
  getReminders,
} from '@/lib/supabase';
import { SchemeDetailModal } from './SchemeDetailModal';
import { EligibilityWizard } from './EligibilityWizard';
import { DocumentAssistant } from './DocumentAssistant';
import { ApplicationAssistant } from './ApplicationAssistant';

interface SchemesOverviewProps {
  farm?: Farm;
}

type LevelFilter = 'all' | 'central' | 'state';
type CategoryFilter = 'all' | 'small_marginal' | 'tenant' | 'dairy_livestock' | 'solar_infra' | 'insurance';

const INDIAN_STATES_FILTER = [
  'All States',
  'Maharashtra',
  'Punjab',
  'Andhra Pradesh',
  'Uttar Pradesh',
  'Madhya Pradesh',
  'Rajasthan',
  'Gujarat',
  'Karnataka',
  'Haryana',
  'Tamil Nadu',
];

export function SchemesOverview({ farm }: SchemesOverviewProps) {
  // Data State
  const [schemes, setSchemes] = useState<GovernmentScheme[]>([]);
  const [applications, setApplications] = useState<FarmerSchemeApplication[]>([]);
  const [reminders, setReminders] = useState<SchemeReminder[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [selectedState, setSelectedState] = useState<string>('All States');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  // Modal / Wizard Active State
  const [detailScheme, setDetailScheme] = useState<GovernmentScheme | null>(null);
  const [wizardScheme, setWizardScheme] = useState<GovernmentScheme | null>(null);
  const [docsScheme, setDocsScheme] = useState<GovernmentScheme | null>(null);
  const [applyScheme, setApplyScheme] = useState<GovernmentScheme | null>(null);

  // Load Schemes & Tracker data
  const loadData = useCallback(() => {
    try {
      const all = getAllSchemes();
      setSchemes(all);

      const apps = getApplications(farm?.id);
      setApplications(apps);

      const rems = getReminders(farm?.id);
      setReminders(rems);
    } catch (err) {
      console.warn('Error loading schemes data', err);
    }
  }, [farm?.id]);

  useEffect(() => {
    loadData();

    // Listen for cross-component storage changes
    if (typeof window !== 'undefined') {
      const handleDataChange = () => loadData();
      window.addEventListener('agridost:data-changed', handleDataChange);
      return () => window.removeEventListener('agridost:data-changed', handleDataChange);
    }
  }, [loadData]);

  // Set default state filter from farm if available
  useEffect(() => {
    if (farm?.locationDetails?.state) {
      const farmState = farm.locationDetails.state;
      const matchedState = INDIAN_STATES_FILTER.find(
        (st) => st.toLowerCase() === farmState.toLowerCase()
      );
      if (matchedState) {
        setSelectedState(matchedState);
      }
    }
  }, [farm]);

  // Calculate Metrics for Top Banner
  const metrics = useMemo(() => {
    const verifiedCount = schemes.length;
    const activeApps = applications.filter((a) => a.status !== 'closed' && a.status !== 'rejected');
    const upcomingDeadlines = reminders.filter((r) => !r.isCompleted);

    return {
      verifiedCount,
      activeAppsCount: activeApps.length,
      upcomingDeadlinesCount: upcomingDeadlines.length,
      deadlines: upcomingDeadlines.slice(0, 2),
    };
  }, [schemes, applications, reminders]);

  // Filtered Schemes
  const filteredSchemes = useMemo(() => {
    let result = schemes;

    // Search query filter
    if (searchQuery.trim()) {
      result = searchSchemes(searchQuery.trim());
    }

    // Level filter
    if (levelFilter !== 'all') {
      result = result.filter((s) => s.level === levelFilter);
    }

    // State filter
    if (selectedState !== 'All States') {
      const targetStateLower = selectedState.toLowerCase();
      result = result.filter(
        (s) =>
          s.applicableStates.includes('ALL') ||
          s.applicableStates.some((st) => st.toLowerCase() === targetStateLower)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter((s) => {
        if (categoryFilter === 'small_marginal') {
          return (
            s.beneficiaryCategories.includes('marginal') ||
            s.beneficiaryCategories.includes('small') ||
            s.beneficiaryCategories.includes('all')
          );
        }
        if (categoryFilter === 'tenant') {
          return (
            s.beneficiaryCategories.includes('tenant') ||
            s.eligibilityRules.allowedOwnershipTypes?.includes('tenant') ||
            s.description.toLowerCase().includes('tenant')
          );
        }
        if (categoryFilter === 'dairy_livestock') {
          return (
            s.supportedActivities.includes('dairy') ||
            s.supportedActivities.includes('livestock') ||
            s.description.toLowerCase().includes('dairy')
          );
        }
        if (categoryFilter === 'solar_infra') {
          return (
            s.benefitType === 'solar_pump_subsidy' ||
            s.benefitType === 'infrastructure_grant' ||
            s.shortName.includes('KUSUM') ||
            s.shortName.includes('AIF')
          );
        }
        if (categoryFilter === 'insurance') {
          return s.benefitType === 'crop_insurance' || s.shortName.includes('PMFBY');
        }
        return true;
      });
    }

    return result;
  }, [schemes, searchQuery, levelFilter, selectedState, categoryFilter]);

  // Check if a scheme already has an active application
  const getSchemeApplication = (schemeId: string) => {
    return applications.find((a) => a.schemeId === schemeId);
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HERO BANNER & METRICS */}
      <div className="bg-gradient-to-br from-[#173F2B] via-[#1e4d36] to-[#26312A] rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        {/* Subtle decorative background circle */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-emerald-500/10 pointer-events-none blur-2xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-[#DCE8D3] text-[#173F2B] shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Government Intelligence
              </span>
              <span className="text-xs text-white/70">
                Direct Official Sources • Zero Fake Subsidies
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight text-white">
              Government Schemes & Farmer Assistance
            </h1>

            <p className="text-sm text-white/80 leading-relaxed">
              Personalized eligibility evaluation, offline document checklists, and guided official portal links for Indian cultivators.
              {farm ? ` Tailored for ${farm.name} (${farm.locationDetails?.state || 'Maharashtra'}).` : ''}
            </p>
          </div>

          {/* 3 Metric Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            {/* Active Applications */}
            <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15">
              <span className="text-[11px] font-semibold text-[#DCE8D3] uppercase tracking-wider block">
                Active Applications
              </span>
              <span className="text-2xl font-bold text-white block mt-0.5">
                {metrics.activeAppsCount}
              </span>
              <span className="text-[10px] text-white/70">
                Tracked locally
              </span>
            </div>

            {/* Verified Schemes */}
            <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15">
              <span className="text-[11px] font-semibold text-[#DCE8D3] uppercase tracking-wider block">
                Verified Schemes
              </span>
              <span className="text-2xl font-bold text-white block mt-0.5">
                {metrics.verifiedCount}
              </span>
              <span className="text-[10px] text-white/70">
                Central & State Portals
              </span>
            </div>

            {/* Upcoming Deadlines */}
            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15">
              <span className="text-[11px] font-semibold text-[#DCE8D3] uppercase tracking-wider block">
                Upcoming Windows
              </span>
              <span className="text-2xl font-bold text-white block mt-0.5">
                {metrics.upcomingDeadlinesCount > 0 ? metrics.upcomingDeadlinesCount : 'Active'}
              </span>
              <span className="text-[10px] text-white/70">
                Kharif & Ongoing
              </span>
            </div>
          </div>
        </div>

        {/* Highlight Banner if farmer has an active application */}
        {metrics.activeAppsCount > 0 && (
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-white/90">
              <BadgeCheck className="w-4 h-4 text-[#DCE8D3]" />
              <span>
                You have <strong>{metrics.activeAppsCount}</strong> scheme application(s) recorded in your offline tracker.
              </span>
            </span>
          </div>
        )}
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="bg-white p-5 rounded-2xl border border-[#E7E9E2] shadow-xs space-y-4">
        {/* Search Input Bar */}
        <div className="relative">
          <Search className="w-5 h-5 text-[#26312A]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by scheme name (PM-KISAN, PMFBY, KUSUM), department, crop, or benefit..."
            className="w-full pl-11 pr-10 py-3 rounded-xl border border-[#E7E9E2] bg-[#F7F7F0]/60 text-sm text-[#26312A] placeholder:text-[#26312A]/40 focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[#26312A]/40 hover:text-[#26312A]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Rows: Level & State Dropdown */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          {/* Level Filter Tabs */}
          <div className="inline-flex p-1 rounded-xl bg-[#F7F7F0] border border-[#E7E9E2]">
            {(
              [
                { id: 'all', label: 'All Schemes' },
                { id: 'central', label: 'Central Government' },
                { id: 'state', label: 'State Government' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLevelFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  levelFilter === tab.id
                    ? 'bg-[#173F2B] text-white shadow-xs'
                    : 'text-[#26312A]/70 hover:text-[#26312A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* State Filter Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#26312A]/70 whitespace-nowrap">
              State:
            </span>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#E7E9E2] bg-white text-xs font-semibold text-[#173F2B] focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20"
            >
              {INDIAN_STATES_FILTER.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#E7E9E2]/70">
          <span className="text-xs font-semibold text-[#26312A]/60 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-[#4D6B53]" />
            Category:
          </span>
          {(
            [
              { id: 'all', label: 'All Categories' },
              { id: 'small_marginal', label: 'Small & Marginal (<5 ac)' },
              { id: 'tenant', label: 'Tenant Cultivator' },
              { id: 'dairy_livestock', label: 'Dairy & Livestock' },
              { id: 'solar_infra', label: 'Solar Pump & Infra' },
              { id: 'insurance', label: 'Crop Insurance (PMFBY)' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors border ${
                categoryFilter === cat.id
                  ? 'bg-[#DCE8D3] text-[#173F2B] border-[#4D6B53] font-bold shadow-xs'
                  : 'bg-white border-[#E7E9E2] text-[#26312A]/70 hover:bg-[#F7F7F0]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. SCHEMES GRID */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold font-heading text-[#173F2B] flex items-center gap-2">
            <span>Verified Agricultural Schemes</span>
            <span className="text-xs font-normal text-[#26312A]/60">
              ({filteredSchemes.length} Available)
            </span>
          </h2>

          {(levelFilter !== 'all' || selectedState !== 'All States' || categoryFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setLevelFilter('all');
                setSelectedState('All States');
                setCategoryFilter('all');
                setSearchQuery('');
              }}
              className="text-xs font-semibold text-[#4D6B53] hover:underline"
            >
              Reset All Filters
            </button>
          )}
        </div>

        {filteredSchemes.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-[#E7E9E2] space-y-3">
            <AlertCircle className="w-10 h-10 text-[#26312A]/40 mx-auto" />
            <h3 className="text-base font-bold text-[#173F2B]">
              No schemes match your filter criteria
            </h3>
            <p className="text-xs text-[#26312A]/70 max-w-md mx-auto">
              Try selecting &quot;All States&quot; or clearing your category filters to view national central schemes applicable to all farmers across India.
            </p>
            <button
              onClick={() => {
                setLevelFilter('all');
                setSelectedState('All States');
                setCategoryFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl bg-[#173F2B] text-white text-xs font-semibold hover:bg-[#0f2c1e] transition-colors"
            >
              View All Schemes
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSchemes.map((scheme) => {
              const activeApp = getSchemeApplication(scheme.id);

              return (
                <div
                  key={scheme.id}
                  className="bg-white rounded-2xl border border-[#E7E9E2] shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  {/* Card Content Top */}
                  <div className="p-5 space-y-3.5">
                    {/* Badges Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            scheme.level === 'central'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-sky-50 text-sky-800 border-sky-200'
                          }`}
                        >
                          {scheme.level.toUpperCase()}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#DCE8D3]/70 text-[#173F2B] border border-[#4D6B53]/20">
                          <CheckCircle2 className="w-3 h-3 text-[#173F2B]" />
                          Verified Official Source
                        </span>
                      </div>

                      {/* State tag if state-specific */}
                      {scheme.applicableStates[0] !== 'ALL' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                          {scheme.applicableStates.join(', ')}
                        </span>
                      )}
                    </div>

                    {/* Title & Short Description */}
                    <div>
                      <h3 className="text-lg font-bold font-heading text-[#173F2B] group-hover:text-[#4D6B53] transition-colors">
                        {scheme.shortName}: {scheme.name}
                      </h3>
                      <p className="text-xs text-[#26312A]/60 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-[#4D6B53]" />
                        {scheme.department || scheme.ministry}
                      </p>
                    </div>

                    {/* Benefit Highlight Box */}
                    <div className="bg-[#DCE8D3]/35 rounded-xl p-3 border border-[#4D6B53]/20">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#4D6B53] block">
                        Assistance / Subsidy Benefit
                      </span>
                      <p className="text-sm font-bold text-[#173F2B]">
                        {scheme.benefitDetails.summary}
                      </p>
                      <p className="text-xs text-[#26312A]/80 mt-0.5">
                        {scheme.benefitDetails.amountDescription}
                      </p>
                    </div>

                    {/* Description preview */}
                    <p className="text-xs text-[#26312A]/80 leading-relaxed line-clamp-2">
                      {scheme.description}
                    </p>

                    {/* Active Tracker Badge if already recorded */}
                    {activeApp && (
                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <BadgeCheck className="w-4 h-4 text-emerald-600" />
                          Tracked: {activeApp.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {activeApp.applicationReferenceNumber && (
                          <span className="text-[10px] text-emerald-800/80 font-mono">
                            Ref: {activeApp.applicationReferenceNumber}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="p-4 bg-[#F7F7F0]/60 border-t border-[#E7E9E2] space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Check Eligibility Button */}
                      <button
                        type="button"
                        onClick={() => setWizardScheme(scheme)}
                        className="w-full px-3 py-2 rounded-xl bg-[#173F2B] text-white text-xs font-bold hover:bg-[#0f2c1e] transition-colors shadow-xs flex items-center justify-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#DCE8D3]" />
                        <span>Eligibility</span>
                      </button>

                      {/* View Details Button */}
                      <button
                        type="button"
                        onClick={() => setDetailScheme(scheme)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#E7E9E2] text-[#26312A] text-xs font-semibold hover:bg-[#E7E9E2]/50 transition-colors shadow-xs flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#4D6B53]" />
                        <span>View Details</span>
                      </button>
                    </div>

                    {/* Apply / Guide Full-Width Button */}
                    <button
                      type="button"
                      onClick={() => setApplyScheme(scheme)}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#4D6B53]/25 bg-white text-[#173F2B] text-xs font-semibold hover:bg-[#DCE8D3]/40 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Apply & Guide Walkthrough</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. MODALS & SUB-ASSISTANTS */}
      {/* Detail Modal */}
      <SchemeDetailModal
        scheme={detailScheme}
        isOpen={Boolean(detailScheme)}
        onClose={() => setDetailScheme(null)}
        onCheckEligibility={(s) => {
          setDetailScheme(null);
          setWizardScheme(s);
        }}
        onPrepareDocuments={(s) => {
          setDetailScheme(null);
          setDocsScheme(s);
        }}
        onStartApplication={(s) => {
          setDetailScheme(null);
          setApplyScheme(s);
        }}
      />

      {/* Eligibility Wizard */}
      {wizardScheme && (
        <EligibilityWizard
          scheme={wizardScheme}
          farm={farm}
          isOpen={Boolean(wizardScheme)}
          onClose={() => setWizardScheme(null)}
          onProceedToDocuments={(s) => {
            setWizardScheme(null);
            setDocsScheme(s);
          }}
          onProceedToApply={(s) => {
            setWizardScheme(null);
            setApplyScheme(s);
          }}
        />
      )}

      {/* Document Assistant */}
      {docsScheme && (
        <DocumentAssistant
          scheme={docsScheme}
          farm={farm}
          isOpen={Boolean(docsScheme)}
          onClose={() => setDocsScheme(null)}
          onProceedToApply={(s) => {
            setDocsScheme(null);
            setApplyScheme(s);
          }}
        />
      )}

      {/* Application Assistant */}
      {applyScheme && (
        <ApplicationAssistant
          scheme={applyScheme}
          farm={farm}
          isOpen={Boolean(applyScheme)}
          onClose={() => setApplyScheme(null)}
          onApplicationSaved={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}
