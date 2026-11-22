'use client';

import React, { useState, useEffect } from 'react';
import {
  AgriculturalResearchCategory,
  AgriculturalResearchResult,
} from '@/types/tinyfish';
import {
  Search,
  Globe,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Landmark,
  TrendingUp,
  Bug,
  BookOpen,
  AlertCircle,
  Database,
  CheckCircle2,
} from 'lucide-react';

interface TinyFishResearchWidgetProps {
  initialCategory?: AgriculturalResearchCategory;
  defaultCommodity?: string;
}

const CATEGORY_TABS: Array<{
  id: AgriculturalResearchCategory;
  label: string;
  icon: React.ElementType;
  description: string;
}> = [
  {
    id: 'schemes',
    label: 'Government Schemes',
    icon: Landmark,
    description: 'Discover new subsidies, eligibility, deadlines & official guidelines',
  },
  {
    id: 'mandi',
    label: 'Mandi Intelligence',
    icon: TrendingUp,
    description: 'Live APMC spot arrivals, modal wholesale prices & MSP comparison',
  },
  {
    id: 'crop_advisory',
    label: 'Crop Advisory',
    icon: Bug,
    description: 'ICAR / KVK research on crop pathology, pests & approved sprays',
  },
  {
    id: 'market_trends',
    label: 'Market Trends',
    icon: Globe,
    description: 'Regional crop demand, export developments & price trends',
  },
];

const PRESET_QUERIES: Record<AgriculturalResearchCategory, string[]> = {
  schemes: [
    'PM-KISAN 24th Installment 2026',
    'PM Fasal Bima Yojana Kharif Guidelines',
    'Agriculture Infrastructure Fund 3% Interest Subvention',
    'Sub-Mission on Agricultural Mechanization (SMAM)',
  ],
  mandi: [
    'Soyabean Mandi Price Maharashtra Latur Today',
    'Cotton Modal Price Gujarat Rajkot APMC',
    'Wheat Wholesale Arrival Rates Punjab Khanna',
    'Onion Spot Market Arrivals Lasalgaon APMC',
  ],
  crop_advisory: [
    'Cotton Pink Bollworm ICAR Management Protocol',
    'Soyabean Yellow Mosaic Virus Vector Control KVK',
    'Gram Wilt Disease Prevention TNAU Advisory',
    'Paddy Blast Fungicide Spray Window',
  ],
  market_trends: [
    'Soyabean Regional Demand & Crushing Outlook 2026',
    'Cotton Export Parity & Textile Mill Demand',
    'Tur Dal Sowing Area & Market Price Trend',
    'Fertilizer Availability & Monsoon Impact',
  ],
};

export function TinyFishResearchWidget({
  initialCategory = 'schemes',
  defaultCommodity,
}: TinyFishResearchWidgetProps) {
  const [category, setCategory] = useState<AgriculturalResearchCategory>(initialCategory);
  const [query, setQuery] = useState<string>(PRESET_QUERIES[initialCategory][0]);
  const [forceFresh, setForceFresh] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgriculturalResearchResult | null>(null);

  // Execute research
  const handleExecuteResearch = async (searchQuery?: string, bypassCache: boolean = forceFresh) => {
    const activeQuery = searchQuery || query;
    if (!activeQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tinyfish/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          query: activeQuery.trim(),
          commodity: defaultCommodity,
          forceFresh: bypassCache,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setResult(data.research);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Switch category
  const handleSelectCategory = (cat: AgriculturalResearchCategory) => {
    setCategory(cat);
    const defaultQ = PRESET_QUERIES[cat][0];
    setQuery(defaultQ);
    handleExecuteResearch(defaultQ);
  };

  // Initial load
  useEffect(() => {
    handleExecuteResearch(PRESET_QUERIES[initialCategory][0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSourceBadge = (classification: string, isOfficial: boolean) => {
    if (isOfficial || classification === 'official_gov' || classification === 'state_agri_dept') {
      return {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        label: '🏛️ Official Government Portal',
      };
    }
    if (classification === 'icar_kvk_research') {
      return {
        bg: 'bg-blue-50 text-blue-800 border-blue-300',
        label: '🔬 ICAR / Agricultural University',
      };
    }
    if (classification === 'mandi_board') {
      return {
        bg: 'bg-purple-50 text-purple-800 border-purple-300',
        label: '🏬 APMC / Mandi Board',
      };
    }
    if (classification === 'reputable_agri_media') {
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-300',
        label: '📰 Reputable Agri Media',
      };
    }
    return {
      bg: 'bg-gray-50 text-gray-700 border-gray-300',
      label: '📄 Secondary Reference',
    };
  };

  return (
    <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-[#E7E9E2] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DCE8D3] text-[#173F2B]">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#173F2B] font-heading">
                TinyFish AI Agricultural Web Intelligence
              </h2>
              <span className="inline-flex items-center rounded-full bg-[#173F2B] px-2.5 py-0.5 text-[10px] font-bold text-white font-heading">
                Integration #8
              </span>
            </div>
            <p className="text-xs text-[#26312A]/70">
              Live web research, verified government schemes, APMC spot arrivals & ICAR crop advisory
            </p>
          </div>
        </div>

        {/* Operating Status Pill */}
        {result && (
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold font-heading ${
                result.provenance === 'live_api'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : result.provenance === 'cached_remote'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-blue-50 text-blue-800 border-blue-300'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  result.provenance === 'live_api'
                    ? 'bg-emerald-500 animate-pulse'
                    : result.provenance === 'cached_remote'
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
              />
              {result.provenance === 'live_api'
                ? 'LIVE WEB INTELLIGENCE'
                : result.provenance === 'cached_remote'
                ? 'CACHED RESULT'
                : 'OFFLINE DETERMINISTIC'}
            </span>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-5">
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = category === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelectCategory(tab.id)}
              className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                isActive
                  ? 'border-[#173F2B] bg-[#173F2B] text-white shadow-xs'
                  : 'border-[#E7E9E2] bg-[#FBFBFA] text-[#26312A] hover:border-[#6F9B55]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${isActive ? 'text-[#DCE8D3]' : 'text-[#173F2B]'}`} />
                <span className="text-xs font-bold font-heading">{tab.label}</span>
              </div>
              <p
                className={`text-[10px] leading-tight line-clamp-2 ${
                  isActive ? 'text-white/80' : 'text-[#26312A]/60'
                }`}
              >
                {tab.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Search Input Bar */}
      <div className="space-y-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#26312A]/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExecuteResearch()}
              placeholder="Search live agricultural intelligence..."
              className="w-full rounded-xl border border-[#E7E9E2] bg-[#FBFBFA] pl-10 pr-4 py-2.5 text-xs text-[#26312A] placeholder:text-[#26312A]/40 focus:border-[#173F2B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-[#26312A]/70 cursor-pointer select-none px-2">
              <input
                type="checkbox"
                checked={forceFresh}
                onChange={(e) => setForceFresh(e.target.checked)}
                className="rounded border-[#E7E9E2] text-[#173F2B] focus:ring-[#173F2B]"
              />
              <span>Force Fresh</span>
            </label>

            <button
              onClick={() => handleExecuteResearch(query, forceFresh)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-[#173F2B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#1f5037] transition disabled:opacity-50 font-heading"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Researching...' : 'Research'}</span>
            </button>
          </div>
        </div>

        {/* Suggested Queries Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-[#26312A]/50">Suggested:</span>
          {PRESET_QUERIES[category].map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setQuery(preset);
                handleExecuteResearch(preset);
              }}
              className="rounded-lg border border-[#E7E9E2] bg-[#F7F7F0] px-2.5 py-1 text-[11px] font-medium text-[#26312A]/80 hover:border-[#6F9B55] hover:bg-white transition"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-800">
            <p className="font-bold font-heading">Research Request Notice</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="rounded-xl border border-[#E7E9E2] bg-[#FBFBFA] p-6 text-center space-y-3 mb-5">
          <RefreshCw className="h-6 w-6 animate-spin text-[#173F2B] mx-auto" />
          <p className="text-xs font-semibold text-[#173F2B] font-heading">
            Conducting live web research across verified agricultural portals...
          </p>
          <p className="text-[11px] text-[#26312A]/60 max-w-md mx-auto">
            Querying TinyFish live search, extracting JavaScript content, and classifying official government (.gov.in) and ICAR research citations.
          </p>
        </div>
      )}

      {/* Research Results Display */}
      {!loading && result && (
        <div className="space-y-4">
          {/* Executive Summary Card */}
          <div className="rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#173F2B]" />
                <h4 className="font-heading text-xs font-bold text-[#173F2B] uppercase tracking-wide">
                  Intelligence Summary
                </h4>
              </div>
              <span className="text-[10px] text-[#26312A]/50">
                Retrieved: {new Date(result.retrievedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-[#26312A] font-medium">
              {result.summary}
            </p>

            {/* Mandi Intelligence MSP Separation Card */}
            {result.category === 'mandi' && Boolean(result.structuredData?.officialMSP) && (
              <div className="mt-3 rounded-lg border border-[#E7E9E2] bg-white p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#173F2B] font-heading">
                      CACP Official MSP Benchmark:
                    </span>{' '}
                    <span className="font-extrabold text-[#173F2B]">
                      ₹{(result.structuredData?.officialMSP as { mspInrPerQtl: number }).mspInrPerQtl} / quintal
                    </span>
                    <span className="text-[#26312A]/60 ml-2">
                      ({(result.structuredData?.officialMSP as { season: string }).season} Season)
                    </span>
                  </div>
                  <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    Statutory Floor
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-[#26312A]/70">
                  {String(result.structuredData?.disclaimer || '')}
                </p>
              </div>
            )}
          </div>

          {/* Sources List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-heading text-xs font-bold text-[#173F2B]">
                Cited Intelligence Sources ({result.sources.length})
              </h4>
              <span className="text-[10px] text-[#26312A]/60">
                Official Government & ICAR citations prioritized
              </span>
            </div>

            <div className="space-y-2">
              {result.sources.map((src, index) => {
                const badge = getSourceBadge(src.sourceClassification, src.isOfficial);
                return (
                  <div
                    key={`${src.url}-${index}`}
                    className="rounded-xl border border-[#E7E9E2] bg-white p-3 transition hover:border-[#6F9B55]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${badge.bg}`}>
                        {badge.label}
                      </span>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#173F2B] hover:underline"
                      >
                        <span>{src.siteName}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <h5 className="font-heading text-xs font-bold text-[#26312A] mb-1">
                      {src.title}
                    </h5>
                    <p className="text-[11px] text-[#26312A]/80 leading-normal line-clamp-2">
                      {src.snippet}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Warnings & Statutory Guardrails */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold font-heading">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
                <span>Statutory Agronomic & Market Guidelines:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] text-amber-800">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
