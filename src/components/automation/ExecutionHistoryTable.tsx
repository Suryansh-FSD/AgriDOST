'use client';

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  SkipForward,
  Clock,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Code2,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { N8nExecutionRecord, N8nExecutionStatus } from '@/types';

interface ExecutionHistoryTableProps {
  executions: N8nExecutionRecord[];
  onClearHistory?: () => void;
  onRefresh?: () => void;
}

export function ExecutionHistoryTable({
  executions,
  onClearHistory,
  onRefresh,
}: ExecutionHistoryTableProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | N8nExecutionStatus>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Status Pill renderer
  const renderStatusPill = (status: N8nExecutionStatus) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Success
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            Failed
          </span>
        );
      case 'running':
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
            <RotateCw className="w-3 h-3 text-sky-600 animate-spin" />
            {status === 'running' ? 'Running' : 'Pending'}
          </span>
        );
      case 'skipped':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <SkipForward className="w-3 h-3 text-slate-500" />
            Skipped
          </span>
        );
      case 'timeout':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Timeout
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  // Workflow Name Formatter
  const formatWorkflowName = (workflowId: string) => {
    switch (workflowId) {
      case 'government-assistance':
        return 'Government Assistance';
      case 'smart-farm-operations':
        return 'Smart Operations';
      case 'market-intelligence':
        return 'Market Intelligence';
      default:
        return workflowId;
    }
  };

  // Filtered executions
  const filteredExecutions = useMemo(() => {
    return executions.filter((rec) => {
      // Status filter
      if (statusFilter !== 'all' && rec.status !== statusFilter) {
        return false;
      }
      // Workflow filter
      if (workflowFilter !== 'all' && rec.workflowId !== workflowFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesEvent = rec.eventType.toLowerCase().includes(q);
        const matchesInput = rec.inputSummary.toLowerCase().includes(q);
        const matchesOutput = (rec.outputSummary || '').toLowerCase().includes(q);
        const matchesFarm = rec.farmId.toLowerCase().includes(q);
        return matchesEvent || matchesInput || matchesOutput || matchesFarm;
      }
      return true;
    });
  }, [executions, statusFilter, workflowFilter, searchQuery]);

  const toggleRow = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E7E9E2] shadow-xs overflow-hidden space-y-0">
      {/* Table Filter Toolbar */}
      <div className="p-4 sm:p-5 border-b border-[#E7E9E2] bg-gradient-to-r from-[#F7F7F0] to-[#FFFFFF] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter Buttons */}
          <div className="inline-flex p-1 rounded-xl bg-white border border-[#E7E9E2]">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'success', label: 'Success' },
                { id: 'failed', label: 'Failed' },
                { id: 'running', label: 'Running' },
                { id: 'skipped', label: 'Skipped' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  statusFilter === item.id
                    ? 'bg-[#173F2B] text-white shadow-xs'
                    : 'text-[#26312A]/70 hover:text-[#26312A]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Workflow Selector */}
          <select
            value={workflowFilter}
            onChange={(e) => setWorkflowFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-[#E7E9E2] bg-white text-xs font-semibold text-[#173F2B] focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20"
          >
            <option value="all">All Workflows</option>
            <option value="government-assistance">Government Assistance</option>
            <option value="smart-farm-operations">Smart Operations</option>
            <option value="market-intelligence">Market Intelligence</option>
          </select>
        </div>

        {/* Search Input & Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#26312A]/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search event, input..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#E7E9E2] bg-white text-xs text-[#26312A] focus:outline-hidden focus:ring-2 focus:ring-[#173F2B]/20"
            />
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              title="Refresh log"
              className="p-2 rounded-xl border border-[#E7E9E2] bg-white text-[#26312A]/70 hover:text-[#26312A] hover:bg-[#F7F7F0] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {onClearHistory && executions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear all execution history logs?')) {
                  onClearHistory();
                }
              }}
              title="Clear execution history"
              className="p-2 rounded-xl border border-[#E7E9E2] bg-white text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F7F7F0] text-[#26312A]/70 font-semibold border-b border-[#E7E9E2]">
              <th className="py-3 px-4 w-28">Status</th>
              <th className="py-3 px-4">Event Type</th>
              <th className="py-3 px-4">Workflow</th>
              <th className="py-3 px-4">Trigger Summary</th>
              <th className="py-3 px-4">Result Summary</th>
              <th className="py-3 px-3 text-right">Duration</th>
              <th className="py-3 px-4 text-right">Timestamp</th>
              <th className="py-3 px-3 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E9E2] text-[#26312A]">
            {filteredExecutions.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[#26312A]/60">
                  <div className="space-y-1">
                    <p className="font-semibold text-[#173F2B]">No executions recorded</p>
                    <p className="text-xs">
                      {searchQuery || statusFilter !== 'all' || workflowFilter !== 'all'
                        ? 'Try clearing filters or search query.'
                        : 'Trigger a workflow above to see live events.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredExecutions.map((rec) => {
                const isExpanded = expandedRowId === rec.id;
                const formattedTime = new Date(rec.startedAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                const formattedDate = new Date(rec.startedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                });

                return (
                  <React.Fragment key={rec.id}>
                    <tr
                      onClick={() => toggleRow(rec.id)}
                      className={`hover:bg-[#F7F7F0]/80 cursor-pointer transition-colors ${
                        isExpanded ? 'bg-[#F7F7F0]/90' : ''
                      }`}
                    >
                      {/* Status */}
                      <td className="py-3 px-4">{renderStatusPill(rec.status)}</td>

                      {/* Event Type */}
                      <td className="py-3 px-4 font-mono font-medium text-[11px] text-[#173F2B]">
                        {rec.eventType}
                      </td>

                      {/* Workflow Name */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-[#26312A]">
                          {formatWorkflowName(rec.workflowId)}
                        </span>
                      </td>

                      {/* Trigger Input Summary */}
                      <td className="py-3 px-4 max-w-xs truncate text-[#26312A]/90" title={rec.inputSummary}>
                        {rec.inputSummary}
                      </td>

                      {/* Result Summary */}
                      <td
                        className={`py-3 px-4 max-w-sm truncate ${
                          rec.status === 'failed' ? 'text-rose-700 font-medium' : 'text-[#26312A]/80'
                        }`}
                        title={rec.outputSummary || 'No output summary'}
                      >
                        {rec.outputSummary || '—'}
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-3 text-right font-mono text-[11px] text-[#26312A]/70">
                        {rec.durationMs !== undefined ? `${rec.durationMs}ms` : '—'}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 text-right text-[#26312A]/60 whitespace-nowrap">
                        <span className="font-medium">{formattedTime}</span>
                        <span className="block text-[10px] text-[#26312A]/40">{formattedDate}</span>
                      </td>

                      {/* Expand Toggle */}
                      <td className="py-3 px-3 text-center text-[#26312A]/50">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 mx-auto" />
                        ) : (
                          <ChevronDown className="w-4 h-4 mx-auto" />
                        )}
                      </td>
                    </tr>

                    {/* Expandable Row Content */}
                    {isExpanded && (
                      <tr className="bg-[#F7F7F0]/40">
                        <td colSpan={8} className="p-4 sm:p-5 border-t border-b border-[#E7E9E2]">
                          <div className="space-y-4 max-w-5xl">
                            {/* Execution Metadata Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white p-3 rounded-xl border border-[#E7E9E2]">
                              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                                <div>
                                  <span className="text-[10px] font-bold uppercase text-[#4D6B53] block">
                                    Execution ID
                                  </span>
                                  <span className="font-mono text-[#173F2B] font-semibold">{rec.id}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold uppercase text-[#4D6B53] block">
                                    Event ID
                                  </span>
                                  <span className="font-mono text-[#26312A]/80">{rec.eventId}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold uppercase text-[#4D6B53] block">
                                    Target Farm
                                  </span>
                                  <span className="font-semibold text-[#26312A]">{rec.farmId}</span>
                                </div>
                                {rec.retryCount > 0 && (
                                  <div>
                                    <span className="text-[10px] font-bold uppercase text-amber-700 block">
                                      Retries
                                    </span>
                                    <span className="font-bold text-amber-800">{rec.retryCount}</span>
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(JSON.stringify(rec, null, 2), rec.id);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7E9E2] bg-[#F7F7F0] text-xs font-semibold text-[#173F2B] hover:bg-[#DCE8D3]/50 transition-colors"
                              >
                                {copiedId === rec.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Copied JSON</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy Raw Record</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Error Details if Present */}
                            {rec.error && (
                              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-start gap-2.5">
                                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold block">
                                    Error [{rec.error.code}]: {rec.error.message}
                                  </span>
                                  <span className="text-[11px] text-rose-800 mt-0.5 block">
                                    Retryable: {rec.error.retryable ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Side-by-side Payload & Output JSON Viewer */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* Trigger Input Data */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#4D6B53] flex items-center gap-1">
                                    <Code2 className="w-3.5 h-3.5" />
                                    Trigger Input Summary
                                  </span>
                                </div>
                                <div className="p-3 bg-white rounded-xl border border-[#E7E9E2] font-mono text-[11px] text-[#26312A] max-h-48 overflow-y-auto leading-relaxed">
                                  {rec.inputSummary}
                                </div>
                              </div>

                              {/* Output / Result Data */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#4D6B53] flex items-center gap-1">
                                    <Layers className="w-3.5 h-3.5" />
                                    Output Result Data
                                  </span>
                                </div>
                                <pre className="p-3 bg-[#1e2922] text-[#DCE8D3] rounded-xl border border-black/10 font-mono text-[11px] max-h-48 overflow-y-auto leading-relaxed">
                                  {rec.outputData
                                    ? JSON.stringify(rec.outputData, null, 2)
                                    : rec.outputSummary || 'No output data recorded'}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-3 sm:p-4 border-t border-[#E7E9E2] bg-[#F7F7F0] text-xs text-[#26312A]/60 flex items-center justify-between">
        <span>
          Showing <strong>{filteredExecutions.length}</strong> of{' '}
          <strong>{executions.length}</strong> executions
        </span>
        <span className="text-[11px]">Audit log preserved in offline-first repository</span>
      </div>
    </div>
  );
}
