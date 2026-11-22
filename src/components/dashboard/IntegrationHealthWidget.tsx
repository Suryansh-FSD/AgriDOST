'use client';

import React, { useEffect, useState } from 'react';
import {
  MasterIntegrationStatusReport,
  IntegrationHealthResponse,
} from '@/types/integrations';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  RefreshCw,
  Database,
  Sparkles,
  CloudSun,
  TrendingUp,
  Send,
  MapPin,
  Workflow,
  Globe,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  database: Database,
  ai: Sparkles,
  weather: CloudSun,
  market: TrendingUp,
  messaging: Send,
  geospatial: MapPin,
  automation: Workflow,
  'web-intelligence': Globe,
};

export function IntegrationHealthWidget() {
  const [report, setReport] = useState<MasterIntegrationStatusReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/health', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        setLastUpdated(new Date().toLocaleTimeString('en-IN'));
      }
    } catch (err) {
      console.warn('[IntegrationHealthWidget] Failed to poll status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Poll every 60 seconds
    const timer = setInterval(fetchHealth, 60000);
    return () => clearInterval(timer);
  }, []);

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case 'LIVE':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-500',
          label: 'LIVE',
        };
      case 'SIMULATED':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-300',
          dot: 'bg-amber-500',
          label: 'SIMULATED',
        };
      case 'OFFLINE':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-300',
          dot: 'bg-blue-500',
          label: 'OFFLINE',
        };
      case 'NOT_CONFIGURED':
        return {
          bg: 'bg-gray-50 text-gray-700 border-gray-300',
          dot: 'bg-gray-400',
          label: 'UNCONFIGURED',
        };
      default:
        return {
          bg: 'bg-red-50 text-red-800 border-red-300',
          dot: 'bg-red-500',
          label: 'ERROR',
        };
    }
  };

  const integrationsList: IntegrationHealthResponse[] = report?.integrations
    ? Object.values(report.integrations)
    : [];

  return (
    <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DCE8D3] text-[#173F2B]">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-heading text-sm font-bold text-[#173F2B]">
              External Integration Health Gateway
            </h3>
            <p className="text-[11px] text-[#26312A]/60">
              8 Production Integrations (TinyFish AI #8) • {lastUpdated ? `Synced at ${lastUpdated}` : 'Checking connectivity...'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] px-3 py-1.5 text-xs font-semibold text-[#173F2B] hover:bg-[#E7E9E2] transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {integrationsList.map((item) => {
          const Icon = CATEGORY_ICONS[item.category] || Activity;
          const badge = getModeBadge(item.operatingMode);

          return (
            <div
              key={item.provider}
              className="flex flex-col justify-between rounded-xl border border-[#E7E9E2] bg-[#FBFBFA] p-3 text-left transition hover:border-[#6F9B55]/50"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-[#E7E9E2] text-[#173F2B]">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.bg}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                  {badge.label}
                </span>
              </div>

              <div>
                <h4 className="font-heading text-xs font-bold text-[#173F2B] truncate">
                  {item.displayName}
                </h4>
                <p className="text-[10px] text-[#26312A]/70 truncate mt-0.5">
                  {item.latencyMs !== undefined ? `${item.latencyMs}ms latency` : item.connectivityStatus}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
