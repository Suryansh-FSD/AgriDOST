'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Zap,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Server,
  Play,
  RotateCw,
  HelpCircle,
  TrendingUp,
  Cpu,
  Radio,
  FileCheck,
} from 'lucide-react';
import {
  N8nWorkflowDefinition,
  N8nExecutionRecord,
  N8nExecutionStatus,
  Farm,
} from '@/types';
import { WorkflowCard } from './WorkflowCard';
import { ExecutionHistoryTable } from './ExecutionHistoryTable';
import { ManualTriggerModal } from './ManualTriggerModal';

interface AutomationCenterProps {
  farm?: Farm;
}

// LocalStorage Keys
const STORAGE_KEYS = {
  EXECUTIONS: 'agridost_n8n_executions',
  WORKFLOWS: 'agridost_n8n_workflows',
  SIMULATION_MODE: 'agridost_n8n_simulated_mode',
  GATEWAY_STATUS: 'agridost_n8n_gateway_status',
};

// Initial Default Workflows
const INITIAL_WORKFLOWS: N8nWorkflowDefinition[] = [
  {
    id: 'government-assistance',
    name: 'Government Assistance Deadlines & Renewals',
    description:
      'Monitors official scheme deadlines (PM-KISAN, PMFBY), tracks state transitions, and creates farmer reminders.',
    category: 'Government',
    supportedEvents: [
      'government.application.created',
      'government.application.status_changed',
      'government.deadline.approaching',
      'government.reminder.triggered',
    ],
    webhookPath: 'agridost-government-assistance',
    active: true,
    version: '1.0.0',
    lastExecutionAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    lastExecutionStatus: 'success',
  },
  {
    id: 'smart-farm-operations',
    name: 'Smart Farm Operations & Weather Guard',
    description:
      'Evaluates hyper-local wind speed, precipitation, and temperature thresholds before drone spray flights or automated irrigation.',
    category: 'Operations',
    supportedEvents: [
      'operations.weather.check_requested',
      'operations.spray.window_evaluation',
      'operations.irrigation.advisory',
    ],
    webhookPath: 'agridost-smart-farm-operations',
    active: true,
    version: '1.0.0',
    lastExecutionAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    lastExecutionStatus: 'success',
  },
  {
    id: 'market-intelligence',
    name: 'Market Intelligence & Mandi Price Advisory',
    description:
      'Scrapes official Agmarknet & e-NAM prices, compares against farmer target prices and MSP, and issues sell/hold advisories.',
    category: 'Market',
    supportedEvents: [
      'market.price.check_requested',
      'market.harvest.recorded',
      'market.advisory.generated',
    ],
    webhookPath: 'agridost-market-intelligence',
    active: true,
    version: '1.0.0',
    lastExecutionAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    lastExecutionStatus: 'skipped',
  },
];

// Initial Default Executions
const INITIAL_EXECUTIONS: N8nExecutionRecord[] = [
  {
    id: 'exec_gov_01',
    eventId: 'evt_gov_init_01',
    eventType: 'government.deadline.approaching',
    workflowId: 'government-assistance',
    farmId: 'demo-farm-01',
    status: 'success',
    startedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 2 + 142).toISOString(),
    durationMs: 142,
    inputSummary: 'PM-KISAN 17th Installment e-KYC deadline check for Demo Farm',
    outputSummary: 'Verified active criteria. Scheduled 1 reminder 14 days prior to Dec 15 cutoff.',
    outputData: {
      schemeId: 'pm-kisan',
      deadlineDate: '2026-12-15',
      reminderCreated: true,
      channel: 'SMS + Push',
    },
    retryCount: 0,
  },
  {
    id: 'exec_ops_01',
    eventId: 'evt_ops_init_01',
    eventType: 'operations.spray.window_evaluation',
    workflowId: 'smart-farm-operations',
    farmId: 'demo-farm-01',
    status: 'success',
    startedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 5 + 89).toISOString(),
    durationMs: 89,
    inputSummary: 'Zone 1 (Cotton) Drone Spray Window evaluation',
    outputSummary: 'SAFE: Wind 8.4 km/h < 15 km/h, 27°C, 0% rain prob. Optimal 06:00-09:30 AM window approved.',
    outputData: {
      operationApproved: true,
      riskLevel: 'optimal',
      observedWindKmh: 8.4,
      safetyWindowHours: 3.5,
    },
    retryCount: 0,
  },
  {
    id: 'exec_ops_02',
    eventId: 'evt_ops_init_02',
    eventType: 'operations.weather.check_requested',
    workflowId: 'smart-farm-operations',
    farmId: 'demo-farm-01',
    status: 'failed',
    startedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 8 + 110).toISOString(),
    durationMs: 110,
    inputSummary: 'Zone 3 (Soybean) High Wind Warning alert',
    outputSummary: 'UNSAFE: Wind 24.8 km/h exceeded safety threshold (15 km/h). Spray halted.',
    outputData: {
      operationApproved: false,
      riskLevel: 'high',
      observedWindKmh: 24.8,
      thresholdKmh: 15.0,
    },
    error: {
      code: 'ERR_WIND_UNSAFE',
      message: 'Wind speed 24.8 km/h exceeds maximum permissible drone flight limit (15 km/h).',
      retryable: false,
    },
    retryCount: 0,
  },
  {
    id: 'exec_mkt_01',
    eventId: 'evt_mkt_init_01',
    eventType: 'market.price.check_requested',
    workflowId: 'market-intelligence',
    farmId: 'demo-farm-01',
    status: 'skipped',
    startedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 12 + 12).toISOString(),
    durationMs: 12,
    inputSummary: 'Wheat Mandi duplicate check for Demo Farm',
    outputSummary: 'Skipped: Duplicate idempotency key within 24h window (last executed 2h ago).',
    outputData: {
      reason: 'Idempotent duplicate check prevented redundant webhook execution',
    },
    retryCount: 0,
  },
];

export function AutomationCenter({ farm }: AutomationCenterProps) {
  // State
  const [workflows, setWorkflows] = useState<N8nWorkflowDefinition[]>(INITIAL_WORKFLOWS);
  const [executions, setExecutions] = useState<N8nExecutionRecord[]>(INITIAL_EXECUTIONS);
  const [isSimulatedMode, setIsSimulatedMode] = useState<boolean>(true);
  const [gatewayStatus, setGatewayStatus] = useState<'connected' | 'simulated' | 'unconfigured'>('simulated');
  const [webhookUrl, setWebhookUrl] = useState<string>('http://localhost:5678/webhook/');
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState<boolean>(false);
  const [activeModalWorkflowId, setActiveModalWorkflowId] = useState<
    'government-assistance' | 'smart-farm-operations' | 'market-intelligence'
  >('government-assistance');

  // Load from LocalStorage
  const loadStoredData = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedWorkflows = localStorage.getItem(STORAGE_KEYS.WORKFLOWS);
      if (storedWorkflows) {
        setWorkflows(JSON.parse(storedWorkflows));
      } else {
        localStorage.setItem(STORAGE_KEYS.WORKFLOWS, JSON.stringify(INITIAL_WORKFLOWS));
      }

      const storedExecutions = localStorage.getItem(STORAGE_KEYS.EXECUTIONS);
      if (storedExecutions) {
        setExecutions(JSON.parse(storedExecutions));
      } else {
        localStorage.setItem(STORAGE_KEYS.EXECUTIONS, JSON.stringify(INITIAL_EXECUTIONS));
      }

      const storedSimMode = localStorage.getItem(STORAGE_KEYS.SIMULATION_MODE);
      if (storedSimMode !== null) {
        setIsSimulatedMode(storedSimMode === 'true');
        setGatewayStatus(storedSimMode === 'true' ? 'simulated' : 'connected');
      }
    } catch (err) {
      console.warn('[AutomationCenter] LocalStorage read error:', err);
    }
  }, []);

  useEffect(() => {
    loadStoredData();

    if (typeof window !== 'undefined') {
      const handleDataChange = () => loadStoredData();
      window.addEventListener('agridost:data-changed', handleDataChange);
      return () => window.removeEventListener('agridost:data-changed', handleDataChange);
    }
  }, [loadStoredData]);

  // Toggle Workflow Active
  const handleToggleWorkflowActive = (workflowId: string, active: boolean) => {
    setWorkflows((prev) => {
      const updated = prev.map((wf) => (wf.id === workflowId ? { ...wf, active } : wf));
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.WORKFLOWS, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('agridost:data-changed'));
      }
      return updated;
    });
  };

  // Toggle Simulation Mode
  const handleToggleSimulationMode = () => {
    const nextMode = !isSimulatedMode;
    setIsSimulatedMode(nextMode);
    setGatewayStatus(nextMode ? 'simulated' : 'connected');
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SIMULATION_MODE, String(nextMode));
      window.dispatchEvent(new CustomEvent('agridost:data-changed'));
    }
  };

  // Open Modal for Specific Workflow
  const handleOpenTriggerForWorkflow = (workflow: N8nWorkflowDefinition) => {
    setActiveModalWorkflowId(workflow.id);
    setIsTriggerModalOpen(true);
  };

  // On Execution Complete Callback
  const handleExecutionComplete = (newRecord: N8nExecutionRecord) => {
    setExecutions((prev) => {
      const updated = [newRecord, ...prev];
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.EXECUTIONS, JSON.stringify(updated));
      }
      return updated;
    });

    // Update workflow last execution status
    setWorkflows((prev) => {
      const updated = prev.map((wf) => {
        if (wf.id === newRecord.workflowId) {
          return {
            ...wf,
            lastExecutionAt: newRecord.completedAt || newRecord.startedAt,
            lastExecutionStatus: newRecord.status,
          };
        }
        return wf;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.WORKFLOWS, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('agridost:data-changed'));
      }
      return updated;
    });
  };

  // Clear History
  const handleClearHistory = () => {
    setExecutions([]);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.EXECUTIONS, JSON.stringify([]));
      window.dispatchEvent(new CustomEvent('agridost:data-changed'));
    }
  };

  // KPI Statistics
  const kpiStats = useMemo(() => {
    const activeCount = workflows.filter((w) => w.active).length;
    const totalRuns = executions.length;
    const successfulRuns = executions.filter((e) => e.status === 'success').length;
    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 100;
    const pendingCount = executions.filter((e) => e.status === 'running' || e.status === 'pending').length;

    return {
      activeWorkflows: `${activeCount} / ${workflows.length}`,
      totalRuns,
      successRate: `${successRate}%`,
      pendingAlerts: pendingCount > 0 ? pendingCount : executions.length > 0 ? 'Active' : '0',
    };
  }, [workflows, executions]);

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & GATEWAY STATUS BANNER */}
      <div className="bg-gradient-to-br from-[#173F2B] via-[#1e4d36] to-[#26312A] rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-emerald-500/10 pointer-events-none blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#DCE8D3] text-[#173F2B] shadow-xs">
                <Cpu className="w-3.5 h-3.5" />
                AgriDOST 4.0 Event-Driven Engine
              </span>
              <span className="text-xs text-white/70">
                Bi-Directional n8n Workflows • HMAC Webhook Security
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight text-white">
              Automation Center
            </h1>

            <p className="text-sm text-white/80 leading-relaxed">
              Automated scheme deadlines, weather-guarded precision spray operations, and Mandi price advisories powered by n8n.
              {farm ? ` Tailored for ${farm.name}.` : ''}
            </p>
          </div>

          {/* Manual Trigger Primary Action */}
          <div className="shrink-0 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveModalWorkflowId('government-assistance');
                setIsTriggerModalOpen(true);
              }}
              className="px-5 py-3 rounded-xl bg-[#DCE8D3] text-[#173F2B] text-sm font-bold hover:bg-white transition-all shadow-md flex items-center gap-2"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Test / Trigger Workflow</span>
            </button>
          </div>
        </div>

        {/* Gateway Status Sub-Banner */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          {/* Connection Status Pill */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    gatewayStatus === 'connected'
                      ? 'bg-emerald-400'
                      : gatewayStatus === 'simulated'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    gatewayStatus === 'connected'
                      ? 'bg-emerald-500'
                      : gatewayStatus === 'simulated'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
              </span>
              <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                {gatewayStatus === 'connected'
                  ? 'n8n Live Connected'
                  : gatewayStatus === 'simulated'
                  ? 'Offline Simulation Mode'
                  : 'Gateway Unconfigured'}
              </span>
            </div>

            <span className="text-white/40 hidden sm:inline">•</span>

            <span className="font-mono text-[11px] text-white/80">
              Webhook: {webhookUrl}
            </span>
          </div>

          {/* Simulation Mode Toggle Switch */}
          <div className="flex items-center gap-2.5 bg-black/20 px-3 py-1.5 rounded-xl border border-white/10 shrink-0">
            <span className="text-[11px] font-medium text-white/90">
              Simulation Mode:
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isSimulatedMode}
              onClick={handleToggleSimulationMode}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isSimulatedMode ? 'bg-[#DCE8D3]' : 'bg-white/30'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[#173F2B] shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isSimulatedMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-[10px] text-white/70">
              {isSimulatedMode ? 'Deterministic' : 'Live Gateway'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. KPI STATISTICS (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Workflows */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7E9E2] shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#4D6B53] block">
            Active Workflows
          </span>
          <span className="text-2xl font-bold font-heading text-[#173F2B] block">
            {kpiStats.activeWorkflows}
          </span>
          <span className="text-xs text-[#26312A]/60">
            Workflows active and listening
          </span>
        </div>

        {/* Total Runs */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7E9E2] shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#4D6B53] block">
            Total Executions
          </span>
          <span className="text-2xl font-bold font-heading text-[#173F2B] block">
            {kpiStats.totalRuns}
          </span>
          <span className="text-xs text-[#26312A]/60">
            Total event trigger runs recorded
          </span>
        </div>

        {/* Success Rate */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7E9E2] shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#4D6B53] block">
            Success Rate
          </span>
          <span className="text-2xl font-bold font-heading text-emerald-800 block">
            {kpiStats.successRate}
          </span>
          <span className="text-xs text-[#26312A]/60">
            Idempotent & successful runs
          </span>
        </div>

        {/* Pending Alerts */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7E9E2] shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#4D6B53] block">
            Engine State
          </span>
          <span className="text-2xl font-bold font-heading text-[#173F2B] block">
            {kpiStats.pendingAlerts}
          </span>
          <span className="text-xs text-[#26312A]/60">
            {isSimulatedMode ? 'Deterministic local fallback' : 'Live webhook endpoint'}
          </span>
        </div>
      </div>

      {/* 3. WORKFLOWS GRID (3 Cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold font-heading text-[#173F2B] flex items-center gap-2">
            <span>Automated Workflows</span>
            <span className="text-xs font-normal text-[#26312A]/60">
              ({workflows.length} Configured)
            </span>
          </h2>
          <span className="text-xs text-[#26312A]/60">
            Bi-directional event dispatching with HMAC-SHA256 signatures
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {workflows.map((wf) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              onToggleActive={handleToggleWorkflowActive}
              onTestTrigger={handleOpenTriggerForWorkflow}
            />
          ))}
        </div>
      </div>

      {/* 4. EXECUTION HISTORY LOG SECTION */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold font-heading text-[#173F2B] flex items-center gap-2">
            <span>Live Execution History</span>
            <span className="text-xs font-normal text-[#26312A]/60">
              ({executions.length} Events Logged)
            </span>
          </h2>
          <button
            type="button"
            onClick={loadStoredData}
            className="text-xs font-semibold text-[#4D6B53] hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Logs</span>
          </button>
        </div>

        <ExecutionHistoryTable
          executions={executions}
          onClearHistory={handleClearHistory}
          onRefresh={loadStoredData}
        />
      </div>

      {/* 5. MANUAL TRIGGER MODAL */}
      <ManualTriggerModal
        isOpen={isTriggerModalOpen}
        onClose={() => setIsTriggerModalOpen(false)}
        initialWorkflowId={activeModalWorkflowId}
        onExecutionComplete={handleExecutionComplete}
        isSimulatedMode={isSimulatedMode}
      />
    </div>
  );
}
