'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FarmerSchemeApplication,
  SchemeApplicationStatus,
  StatusSource,
  Farm,
} from '@/types';
import {
  getApplications,
  saveApplication,
  updateApplicationStatus,
  deleteApplication,
  resetSchemeStorageToDemo,
  getSupabaseConfigStatus,
  syncToSupabase,
} from '@/lib/supabase';
import {
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Plus,
  CheckCircle2,
  Clock,
  FileText,
  Calendar,
  Search,
  Filter,
  RotateCcw,
  Trash2,
  Edit3,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  Cloud,
  CloudOff,
  Info,
} from 'lucide-react';

interface ApplicationTrackerProps {
  farms?: Farm[];
  activeFarmId?: string;
}

const STAGE_CONFIG: Record<
  SchemeApplicationStatus,
  { label: string; bg: string; text: string; border: string; step: number }
> = {
  draft: {
    label: 'Draft',
    bg: 'bg-stone-100',
    text: 'text-stone-700',
    border: 'border-stone-300',
    step: 1,
  },
  preparing_documents: {
    label: 'Preparing Documents',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    step: 2,
  },
  ready_to_apply: {
    label: 'Ready to Apply',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    step: 3,
  },
  submitted: {
    label: 'Submitted',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    step: 4,
  },
  under_review: {
    label: 'Under Review',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    step: 5,
  },
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    step: 6,
  },
  additional_info_required: {
    label: 'Additional Info Required',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200',
    step: 5,
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    step: 6,
  },
  closed: {
    label: 'Closed',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-300',
    step: 6,
  },
};

const SCHEME_DISPLAY_NAMES: Record<string, string> = {
  'pm-kisan': 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
  pmfby: 'PMFBY (Pradhan Mantri Fasal Bima Yojana)',
  'pm-kusum': 'PM-KUSUM (Solar Agricultural Pumps)',
  smam: 'SMAM (Sub-Mission on Agricultural Mechanization)',
  'soil-health-card': 'Soil Health Card Scheme',
  'kcc-interest-subvention': 'Kisan Credit Card (KCC) Subvention',
};

export function ApplicationTracker({ farms = [], activeFarmId }: ApplicationTrackerProps) {
  const [applications, setApplications] = useState<FarmerSchemeApplication[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>(activeFarmId || 'ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedAppId, setCopiedAppId] = useState<string | null>(null);

  // Status Update Modal State
  const [editingApp, setEditingApp] = useState<FarmerSchemeApplication | null>(null);
  const [newStatus, setNewStatus] = useState<SchemeApplicationStatus>('draft');
  const [newNextAction, setNewNextAction] = useState<string>('');
  const [newRefNumber, setNewRefNumber] = useState<string>('');
  const [newStatusSource, setNewStatusSource] = useState<StatusSource>('user_reported');
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);

  // New Application Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newAppSchemeId, setNewAppSchemeId] = useState<string>('pm-kisan');
  const [newAppFarmId, setNewAppFarmId] = useState<string>(
    activeFarmId && activeFarmId !== 'ALL' ? activeFarmId : farms[0]?.id || 'demo-farm-01'
  );
  const [newAppPortalUrl, setNewAppPortalUrl] = useState<string>('https://pmkisan.gov.in/');
  const [newAppRefNumber, setNewAppRefNumber] = useState<string>('');
  const [newAppNextAction, setNewAppNextAction] = useState<string>('');
  const [newAppNotes, setNewAppNotes] = useState<string>('');
  const [newAppInitialStatus, setNewAppInitialStatus] = useState<SchemeApplicationStatus>('draft');

  // Sync state
  const [syncStatus, setSyncStatus] = useState(getSupabaseConfigStatus());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Refresh application data
  const loadData = useCallback(() => {
    const data = getApplications(selectedFarmId === 'ALL' ? undefined : selectedFarmId);
    setApplications(data);
  }, [selectedFarmId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep selectedFarmId synced with activeFarmId prop if passed
  useEffect(() => {
    if (activeFarmId) {
      setSelectedFarmId(activeFarmId);
    }
  }, [activeFarmId]);

  // Reactive listener for local storage changes across tabs or other components
  useEffect(() => {
    const handleStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail || customEvent.detail.key?.includes('scheme')) {
        loadData();
      }
    };
    window.addEventListener('agridost:data-changed', handleStorageChange);
    return () => {
      window.removeEventListener('agridost:data-changed', handleStorageChange);
    };
  }, [loadData]);

  // Filtered Applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      if (statusFilter !== 'ALL' && app.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const schemeName = (SCHEME_DISPLAY_NAMES[app.schemeId] || app.schemeId).toLowerCase();
        const refNo = (app.applicationReferenceNumber || '').toLowerCase();
        const nextAction = (app.nextAction || '').toLowerCase();
        return schemeName.includes(query) || refNo.includes(query) || nextAction.includes(query);
      }
      return true;
    });
  }, [applications, statusFilter, searchQuery]);

  // Copy reference number helper
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAppId(id);
    setTimeout(() => setCopiedAppId(null), 2000);
  };

  // Open status transition modal
  const handleOpenStatusModal = (app: FarmerSchemeApplication) => {
    setEditingApp(app);
    setNewStatus(app.status);
    setNewNextAction(app.nextAction);
    setNewRefNumber(app.applicationReferenceNumber || '');
    setNewStatusSource(app.statusSource);
    setShowConfirmDialog(false);
  };

  // Confirm status transition
  const handleConfirmStatusUpdate = () => {
    if (!editingApp) return;

    const updated = updateApplicationStatus(
      editingApp.id,
      newStatus,
      newNextAction,
      newRefNumber.trim() ? newRefNumber.trim() : undefined
    );

    if (updated) {
      // If status source was also updated
      if (newStatusSource !== editingApp.statusSource) {
        saveApplication({
          ...updated,
          statusSource: newStatusSource,
        });
      }
    }

    setEditingApp(null);
    setShowConfirmDialog(false);
    loadData();
  };

  // Delete application
  const handleDelete = (id: string, schemeName: string) => {
    if (confirm(`Are you sure you want to delete the application record for "${schemeName}"?`)) {
      deleteApplication(id);
      loadData();
    }
  };

  // Add new application
  const handleCreateApplication = (e: React.FormEvent) => {
    e.preventDefault();
    const newApp: FarmerSchemeApplication = {
      id: `app-${Date.now()}`,
      farmId: newAppFarmId,
      schemeId: newAppSchemeId,
      status: newAppInitialStatus,
      statusSource: 'user_reported',
      applicationReferenceNumber: newAppRefNumber.trim() ? newAppRefNumber.trim() : undefined,
      portalUrl: newAppPortalUrl,
      nextAction: newAppNextAction || 'Review eligibility criteria and prepare required documents.',
      notes: newAppNotes || undefined,
      documentsStatus: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: false,
    };

    saveApplication(newApp);
    setShowAddModal(false);
    // Reset form
    setNewAppRefNumber('');
    setNewAppNextAction('');
    setNewAppNotes('');
    loadData();
  };

  // Trigger Supabase Cloud Sync
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncMessage('Checking cloud sync status...');
    try {
      const result = await syncToSupabase({ applications });
      setSyncStatus(getSupabaseConfigStatus());
      setSyncMessage(result.message);
      setTimeout(() => setSyncMessage(null), 4000);
    } catch {
      setSyncMessage('Sync operation completed.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E7E9E2] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <FileText className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-bold text-[#26312A]">Scheme Application Tracker</h2>
          </div>
          <p className="text-sm text-stone-600 mt-1">
            Offline-first government scheme application lifecycle and deadline pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Supabase Status Pill */}
          <button
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition ${
              syncStatus.isConfigured
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
            title="Click to check cloud sync"
          >
            {syncStatus.isConfigured ? (
              <Cloud className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <CloudOff className="h-3.5 w-3.5 text-stone-400" />
            )}
            <span>{syncStatus.isConfigured ? 'Supabase Live' : 'Offline Storage (Local)'}</span>
          </button>

          {/* Reset Demo Button */}
          <button
            onClick={() => {
              if (confirm('Reset application tracking to default verified demo records?')) {
                resetSchemeStorageToDemo();
                loadData();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Demo</span>
          </button>

          {/* Add New Application Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 shadow-2xs transition"
          >
            <Plus className="h-4 w-4" />
            <span>Track New Application</span>
          </button>
        </div>
      </div>

      {/* Sync feedback notification */}
      {syncMessage && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl animate-fade-in">
          <Info className="h-4 w-4 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Transparency Disclaimer Notice */}
      <div className="flex items-start gap-3 p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900">
        <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-950">
            Government Assistance Transparency Notice:
          </span>{' '}
          Status labels marked as <strong>User-Reported</strong> represent your self-recorded notes
          and offline tracker records. They do not constitute official approval from government
          departments. Always verify official status on the official portal links provided below.
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3.5 rounded-xl border border-[#E7E9E2]">
        {/* Farm selector */}
        <div className="md:col-span-4">
          <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
            Filter By Farm
          </label>
          <select
            value={selectedFarmId}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2 text-stone-800 focus:outline-emerald-600"
          >
            <option value="ALL">All Farms ({applications.length})</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="md:col-span-4">
          <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
            Status Stage
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2 text-stone-800 focus:outline-emerald-600"
          >
            <option value="ALL">All Statuses</option>
            {Object.entries(STAGE_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="md:col-span-4">
          <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
            Search Applications
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scheme, ref no, action..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* Applications List / Kanban Cards */}
      {filteredApplications.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-stone-300 p-6">
          <FileText className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-stone-700">No Applications Found</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            No scheme applications match the selected farm or status filters. Track your first
            government scheme application to begin offline tracking.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Track Scheme Application</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApplications.map((app) => {
            const stage = STAGE_CONFIG[app.status] || STAGE_CONFIG.draft;
            const schemeName = SCHEME_DISPLAY_NAMES[app.schemeId] || app.schemeId.toUpperCase();
            const farm = farms.find((f) => f.id === app.farmId);

            return (
              <div
                key={app.id}
                className="flex flex-col justify-between bg-white rounded-2xl border border-[#E7E9E2] p-5 shadow-2xs hover:shadow-xs transition"
              >
                {/* Header: Scheme Name & Stage */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-[#26312A] line-clamp-2" title={schemeName}>
                      {schemeName}
                    </h3>
                    {app.isDemo && (
                      <span className="shrink-0 px-2 py-0.5 text-3xs font-bold uppercase rounded bg-stone-100 text-stone-600">
                        Demo
                      </span>
                    )}
                  </div>

                  {farm && (
                    <div className="text-2xs text-stone-500 mt-1">Farm: {farm.name}</div>
                  )}

                  {/* Badges: Status & Source */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${stage.bg} ${stage.text} ${stage.border}`}
                    >
                      <Clock className="h-3 w-3" />
                      {stage.label}
                    </span>

                    {app.statusSource === 'government_verified' ? (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-3xs font-semibold bg-emerald-100/80 text-emerald-900 border border-emerald-300"
                        title="Synced from verified government portal"
                      >
                        <ShieldCheck className="h-3 w-3 text-emerald-700" />
                        Govt-Verified
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-3xs font-semibold bg-amber-100/80 text-amber-900 border border-amber-300"
                        title="Self-reported by farmer - not official verification"
                      >
                        <AlertCircle className="h-3 w-3 text-amber-700" />
                        User-Reported
                      </span>
                    )}
                  </div>

                  {/* Reference Number */}
                  <div className="mt-4 p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-3xs text-stone-500 uppercase font-semibold">
                        Application Ref #
                      </div>
                      <div className="font-mono font-medium text-stone-800">
                        {app.applicationReferenceNumber || 'Not Generated Yet'}
                      </div>
                    </div>
                    {app.applicationReferenceNumber && (
                      <button
                        onClick={() => handleCopy(app.id, app.applicationReferenceNumber!)}
                        className="text-stone-400 hover:text-stone-700 p-1 rounded transition"
                        title="Copy Reference Number"
                      >
                        {copiedAppId === app.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Next Action Callout */}
                  <div className="mt-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs">
                    <div className="flex items-center gap-1 text-emerald-900 font-semibold text-2xs uppercase">
                      <ChevronRight className="h-3 w-3 text-emerald-700" />
                      Next Required Action
                    </div>
                    <p className="text-stone-700 mt-1 leading-relaxed text-xs">
                      {app.nextAction || 'Continue preparing application.'}
                    </p>
                  </div>

                  {/* Document Checklist Preview */}
                  {Object.keys(app.documentsStatus || {}).length > 0 && (
                    <div className="mt-3 text-2xs">
                      <div className="font-medium text-stone-500 mb-1">Document Status:</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(app.documentsStatus).map(([docKey, status]) => (
                          <span
                            key={docKey}
                            className={`px-1.5 py-0.5 rounded text-3xs uppercase font-medium ${
                              status === 'available'
                                ? 'bg-emerald-100 text-emerald-800'
                                : status === 'in_progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {docKey.replace(/_/g, ' ')}: {status}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes if present */}
                  {app.notes && (
                    <p className="text-2xs text-stone-500 italic mt-3 bg-stone-50 p-2 rounded-lg">
                      &ldquo;{app.notes}&rdquo;
                    </p>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                  <a
                    href={app.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition"
                  >
                    <span>Official Portal</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenStatusModal(app)}
                      className="p-1.5 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 text-xs flex items-center gap-1 transition"
                      title="Update Application Status"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Update</span>
                    </button>
                    <button
                      onClick={() => handleDelete(app.id, schemeName)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                      title="Delete Application Record"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* Status Update & Transition Modal */}
      {/* ===================================================================== */}
      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200">
            <h3 className="text-base font-bold text-stone-900">Update Application Status</h3>
            <p className="text-xs text-stone-600 mt-1">
              Updating tracker record for{' '}
              <strong>
                {SCHEME_DISPLAY_NAMES[editingApp.schemeId] || editingApp.schemeId}
              </strong>
            </p>

            <div className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Select New Status Stage
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as SchemeApplicationStatus)}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800"
                >
                  {Object.entries(STAGE_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {cfg.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Application Reference Number (from Official Portal)
                </label>
                <input
                  type="text"
                  value={newRefNumber}
                  onChange={(e) => setNewRefNumber(e.target.value)}
                  placeholder="e.g. PMK-2026-98124"
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Next Required Action / Follow-up
                </label>
                <textarea
                  rows={2}
                  value={newNextAction}
                  onChange={(e) => setNewNextAction(e.target.value)}
                  placeholder="e.g. Awaiting district verification or upload documents"
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Status Source Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="statusSource"
                      value="user_reported"
                      checked={newStatusSource === 'user_reported'}
                      onChange={() => setNewStatusSource('user_reported')}
                    />
                    <span>User-Reported (Farmer Tracking)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="statusSource"
                      value="government_verified"
                      checked={newStatusSource === 'government_verified'}
                      onChange={() => setNewStatusSource('government_verified')}
                    />
                    <span>Government-Verified</span>
                  </label>
                </div>
              </div>

              {/* Confirmation check warning */}
              {showConfirmDialog ? (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-2">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-amber-700" />
                    Confirm Status Transition
                  </div>
                  <p className="text-2xs">
                    Are you sure you want to change the status to{' '}
                    <strong>{STAGE_CONFIG[newStatus].label}</strong>? This will update your offline
                    database and schedule corresponding follow-up reminders.
                  </p>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowConfirmDialog(false)}
                      className="px-3 py-1 bg-white border border-stone-200 rounded-lg text-stone-700 hover:bg-stone-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleConfirmStatusUpdate}
                      className="px-3 py-1 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 font-semibold"
                    >
                      Yes, Confirm Update
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    onClick={() => setEditingApp(null)}
                    className="px-4 py-2 border border-stone-200 rounded-xl text-stone-700 hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowConfirmDialog(true)}
                    className="px-4 py-2 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 font-semibold"
                  >
                    Review & Save
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Track New Application Modal */}
      {/* ===================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-stone-900">Track New Scheme Application</h3>
            <p className="text-xs text-stone-600 mt-1">
              Add a government assistance scheme application to your offline tracker.
            </p>

            <form onSubmit={handleCreateApplication} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Target Farm</label>
                <select
                  value={newAppFarmId}
                  onChange={(e) => setNewAppFarmId(e.target.value)}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Government Scheme</label>
                <select
                  value={newAppSchemeId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setNewAppSchemeId(id);
                    if (id === 'pm-kisan') setNewAppPortalUrl('https://pmkisan.gov.in/');
                    else if (id === 'pmfby') setNewAppPortalUrl('https://pmfby.gov.in/');
                    else if (id === 'pm-kusum') setNewAppPortalUrl('https://pmkusum.mnre.gov.in/');
                    else if (id === 'smam') setNewAppPortalUrl('https://agrimachinery.nic.in/');
                  }}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800"
                >
                  {Object.entries(SCHEME_DISPLAY_NAMES).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Initial Status</label>
                <select
                  value={newAppInitialStatus}
                  onChange={(e) =>
                    setNewAppInitialStatus(e.target.value as SchemeApplicationStatus)
                  }
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800"
                >
                  <option value="draft">Draft</option>
                  <option value="preparing_documents">Preparing Documents</option>
                  <option value="ready_to_apply">Ready to Apply</option>
                  <option value="submitted">Submitted</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Application Reference Number (Optional)
                </label>
                <input
                  type="text"
                  value={newAppRefNumber}
                  onChange={(e) => setNewAppRefNumber(e.target.value)}
                  placeholder="e.g. MH-K-2026-10294"
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Official Portal URL</label>
                <input
                  type="url"
                  required
                  value={newAppPortalUrl}
                  onChange={(e) => setNewAppPortalUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Next Action</label>
                <input
                  type="text"
                  value={newAppNextAction}
                  onChange={(e) => setNewAppNextAction(e.target.value)}
                  placeholder="e.g. Obtain 7/12 land extract from Talathi"
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={newAppNotes}
                  onChange={(e) => setNewAppNotes(e.target.value)}
                  placeholder="Additional personal application notes..."
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-stone-200 rounded-xl text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 font-semibold"
                >
                  Add Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
