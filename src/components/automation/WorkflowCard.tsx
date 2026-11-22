'use client';

import React from 'react';
import {
  ShieldCheck,
  CloudRain,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  RotateCw,
  Zap,
  Activity,
  Layers,
  HelpCircle,
  SkipForward,
} from 'lucide-react';
import { N8nWorkflowDefinition, N8nExecutionStatus } from '@/types';

interface WorkflowCardProps {
  workflow: N8nWorkflowDefinition;
  onToggleActive?: (workflowId: string, active: boolean) => void;
  onTestTrigger?: (workflow: N8nWorkflowDefinition) => void;
}

export function WorkflowCard({
  workflow,
  onToggleActive,
  onTestTrigger,
}: WorkflowCardProps) {
  // Category-specific iconography and colors
  const getCategoryStyles = () => {
    switch (workflow.category) {
      case 'Government':
        return {
          icon: <ShieldCheck className="w-5 h-5 text-emerald-700" />,
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          accentBg: 'bg-emerald-50/40',
        };
      case 'Operations':
        return {
          icon: <CloudRain className="w-5 h-5 text-sky-700" />,
          badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
          accentBg: 'bg-sky-50/40',
        };
      case 'Market':
        return {
          icon: <TrendingUp className="w-5 h-5 text-amber-700" />,
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
          accentBg: 'bg-amber-50/40',
        };
      default:
        return {
          icon: <Activity className="w-5 h-5 text-[#173F2B]" />,
          badgeClass: 'bg-[#DCE8D3] text-[#173F2B] border-[#4D6B53]/20',
          accentBg: 'bg-[#F7F7F0]',
        };
    }
  };

  const { icon, badgeClass, accentBg } = getCategoryStyles();

  // Status pill renderer
  const renderStatusPill = (status?: N8nExecutionStatus) => {
    if (!status) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          <Clock className="w-3 h-3 text-slate-400" />
          No Executions
        </span>
      );
    }

    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Last: Success
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            Last: Failed
          </span>
        );
      case 'running':
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
            <RotateCw className="w-3 h-3 text-sky-600 animate-spin" />
            Running
          </span>
        );
      case 'skipped':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <SkipForward className="w-3 h-3 text-slate-500" />
            Skipped
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            <HelpCircle className="w-3 h-3 text-amber-600" />
            {status}
          </span>
        );
    }
  };

  const formattedTimestamp = workflow.lastExecutionAt
    ? new Date(workflow.lastExecutionAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Never';

  return (
    <div
      className={`bg-white rounded-2xl border border-[#E7E9E2] shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group ${
        !workflow.active ? 'opacity-70 bg-[#F7F7F0]/40' : ''
      }`}
    >
      {/* Top Details Section */}
      <div className="p-5 space-y-4">
        {/* Header: Icon, Category Badge & Active Switch */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${accentBg} border border-black/5`}>
              {icon}
            </div>
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeClass}`}
            >
              {workflow.category}
            </span>
          </div>

          {/* Active Switch */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#26312A]/60">
              {workflow.active ? 'Active' : 'Disabled'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={workflow.active}
              onClick={() => onToggleActive?.(workflow.id, !workflow.active)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                workflow.active ? 'bg-[#173F2B]' : 'bg-slate-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  workflow.active ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Title and Description */}
        <div className="space-y-1.5">
          <h3 className="text-base font-bold font-heading text-[#173F2B] group-hover:text-[#4D6B53] transition-colors">
            {workflow.name}
          </h3>
          <p className="text-xs text-[#26312A]/80 leading-relaxed line-clamp-2">
            {workflow.description}
          </p>
        </div>

        {/* Supported Events Tags */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#4D6B53] flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Trigger Events ({workflow.supportedEvents.length})
          </span>
          <div className="flex flex-wrap gap-1">
            {workflow.supportedEvents.map((evt) => (
              <span
                key={evt}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F7F7F0] text-[#26312A]/80 border border-[#E7E9E2]"
              >
                {evt}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer: Last Execution Status & Test Trigger Action */}
      <div className="p-4 bg-[#F7F7F0]/60 border-t border-[#E7E9E2] flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            {renderStatusPill(workflow.lastExecutionStatus)}
          </div>
          {workflow.lastExecutionAt && (
            <span className="text-[10px] text-[#26312A]/50 font-medium">
              at {formattedTimestamp}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onTestTrigger?.(workflow)}
          disabled={!workflow.active}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#173F2B] text-white text-xs font-bold hover:bg-[#0f2c1e] transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Zap className="w-3.5 h-3.5 text-[#DCE8D3]" />
          <span>Test Trigger</span>
        </button>
      </div>
    </div>
  );
}
