'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SchemeReminder, SchemeReminderType, Farm } from '@/types';
import {
  getReminders,
  saveReminder,
  toggleReminder,
  deleteReminder,
  resetSchemeStorageToDemo,
} from '@/lib/supabase';
import {
  Bell,
  Calendar,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  User,
  AlertTriangle,
  RotateCcw,
  Clock,
  Filter,
  Search,
  FileCheck,
  RefreshCw,
  Info,
} from 'lucide-react';

interface ReminderManagerProps {
  farms?: Farm[];
  activeFarmId?: string;
}

const TYPE_CONFIG: Record<
  SchemeReminderType,
  { label: string; bg: string; text: string; border: string }
> = {
  deadline: {
    label: 'Application Deadline',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
  },
  document: {
    label: 'Document Submission',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  followup: {
    label: 'Portal Status Check',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
  },
  renewal: {
    label: 'Annual Renewal / e-KYC',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
  },
};

export function ReminderManager({ farms = [], activeFarmId }: ReminderManagerProps) {
  const [reminders, setReminders] = useState<SchemeReminder[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>(activeFarmId || 'ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Reminder Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [newType, setNewType] = useState<SchemeReminderType>('deadline');
  const [newFarmId, setNewFarmId] = useState<string>(
    activeFarmId && activeFarmId !== 'ALL' ? activeFarmId : farms[0]?.id || 'demo-farm-01'
  );
  const [newSourceUrl, setNewSourceUrl] = useState<string>('');

  const openAddModal = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setNewDueDate(d.toISOString().split('T')[0]);
    setShowAddModal(true);
  };

  // Load reminders
  const loadData = useCallback(() => {
    const data = getReminders(selectedFarmId === 'ALL' ? undefined : selectedFarmId);
    setReminders(data);
  }, [selectedFarmId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep selectedFarmId synced with activeFarmId
  useEffect(() => {
    if (activeFarmId) {
      setSelectedFarmId(activeFarmId);
    }
  }, [activeFarmId]);

  // Reactive listener for local storage changes
  useEffect(() => {
    const handleStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail || customEvent.detail.key?.includes('reminder')) {
        loadData();
      }
    };
    window.addEventListener('agridost:data-changed', handleStorageChange);
    return () => {
      window.removeEventListener('agridost:data-changed', handleStorageChange);
    };
  }, [loadData]);

  // Filtered Reminders
  const filteredReminders = useMemo(() => {
    return reminders
      .filter((rem) => {
        if (statusFilter === 'pending' && rem.isCompleted) return false;
        if (statusFilter === 'completed' && !rem.isCompleted) return false;
        if (typeFilter !== 'all' && rem.type !== typeFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            rem.title.toLowerCase().includes(q) ||
            rem.description.toLowerCase().includes(q) ||
            rem.dueDate.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Uncompleted first, then sorted by due date
        if (a.isCompleted !== b.isCompleted) {
          return a.isCompleted ? 1 : -1;
        }
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [reminders, statusFilter, typeFilter, searchQuery]);

  // Toggle completion
  const handleToggle = (id: string) => {
    toggleReminder(id);
    loadData();
  };

  // Delete reminder
  const handleDelete = (id: string, title: string) => {
    if (confirm(`Delete reminder "${title}"?`)) {
      deleteReminder(id);
      loadData();
    }
  };

  // Add custom reminder
  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const finalDueDate = newDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const newReminder: SchemeReminder = {
      id: `rem-custom-${Date.now()}`,
      farmId: newFarmId,
      title: newTitle.trim(),
      description: newDescription.trim(),
      dueDate: finalDueDate,
      type: newType,
      isCompleted: false,
      isVerifiedSource: false,
      sourceUrl: newSourceUrl.trim() ? newSourceUrl.trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    saveReminder(newReminder);
    setShowAddModal(false);
    setNewTitle('');
    setNewDescription('');
    setNewSourceUrl('');
    loadData();
  };

  // Due date urgency calculation
  const getUrgencyBadge = (dueDateString: string, isCompleted: boolean) => {
    if (isCompleted) {
      return (
        <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
          Completed
        </span>
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateString);
    due.setHours(0, 0, 0, 0);

    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
          <AlertTriangle className="h-3 w-3" />
          Overdue by {Math.abs(diffDays)}d
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse">
          <Clock className="h-3 w-3" />
          Due Today
        </span>
      );
    } else if (diffDays <= 7) {
      return (
        <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
          Due in {diffDays}d
        </span>
      );
    } else {
      return (
        <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
          Due in {diffDays}d
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E7E9E2] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <Bell className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-bold text-[#26312A]">Scheme Reminders & Deadlines</h2>
          </div>
          <p className="text-sm text-stone-600 mt-1">
            Track official government scheme cutoffs, renewal windows, and document deadlines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              if (confirm('Reset reminders to verified demonstration deadlines?')) {
                resetSchemeStorageToDemo();
                loadData();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Demo</span>
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 shadow-2xs transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Custom Reminder</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3.5 rounded-xl border border-[#E7E9E2]">
        {/* Farm selector */}
        <div className="md:col-span-3">
          <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
            Farm
          </label>
          <select
            value={selectedFarmId}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2 text-stone-800 focus:outline-emerald-600"
          >
            <option value="ALL">All Farms</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Completion status */}
        <div className="md:col-span-3">
          <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
            Status
          </label>
          <div className="flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 py-1.5 rounded font-medium transition ${
                statusFilter === 'all' ? 'bg-white shadow-2xs text-stone-900' : 'text-stone-500'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`flex-1 py-1.5 rounded font-medium transition ${
                statusFilter === 'pending'
                  ? 'bg-white shadow-2xs text-emerald-800 font-semibold'
                  : 'text-stone-500'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`flex-1 py-1.5 rounded font-medium transition ${
                statusFilter === 'completed' ? 'bg-white shadow-2xs text-stone-900' : 'text-stone-500'
              }`}
            >
              Done
            </button>
          </div>
        </div>

        {/* Type filter */}
        <div className="md:col-span-3">
          <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
            Reminder Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2 text-stone-800 focus:outline-emerald-600"
          >
            <option value="all">All Types</option>
            {Object.entries(TYPE_CONFIG).map(([k, cfg]) => (
              <option key={k} value={k}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="md:col-span-3">
          <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reminders..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* Reminder Cards List */}
      {filteredReminders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-stone-300 p-6">
          <Bell className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-stone-700">No Reminders Found</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            You have no upcoming deadlines or reminders matching your filters.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create a Reminder</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReminders.map((rem) => {
            const typeConfig = TYPE_CONFIG[rem.type] || TYPE_CONFIG.deadline;
            const farm = farms.find((f) => f.id === rem.farmId);

            return (
              <div
                key={rem.id}
                className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border transition ${
                  rem.isCompleted
                    ? 'bg-stone-50/60 border-stone-200 opacity-70'
                    : 'bg-white border-[#E7E9E2] shadow-2xs hover:shadow-xs'
                }`}
              >
                {/* Left: Checkbox + Details */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggle(rem.id)}
                    className="mt-0.5 text-stone-400 hover:text-emerald-700 transition shrink-0"
                    title={rem.isCompleted ? 'Mark as Pending' : 'Mark as Completed'}
                  >
                    {rem.isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-stone-300 hover:text-stone-500" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={`font-semibold text-sm text-[#26312A] ${
                          rem.isCompleted ? 'line-through text-stone-400' : ''
                        }`}
                      >
                        {rem.title}
                      </h4>

                      {/* Source Badge */}
                      {rem.isVerifiedSource ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300"
                          title="Verified official government portal cutoff deadline"
                        >
                          <ShieldCheck className="h-3 w-3 text-emerald-700" />
                          Verified Official Source
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-semibold bg-stone-100 text-stone-700 border border-stone-200"
                          title="Custom farmer reminder"
                        >
                          <User className="h-3 w-3 text-stone-500" />
                          Farmer Custom
                        </span>
                      )}

                      {/* Type Badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-3xs font-semibold border ${typeConfig.bg} ${typeConfig.text} ${typeConfig.border}`}
                      >
                        {typeConfig.label}
                      </span>
                    </div>

                    {rem.description && (
                      <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                        {rem.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-2xs text-stone-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-stone-400" />
                        <span>Due Date: {rem.dueDate}</span>
                      </span>
                      {farm && <span>Farm: {farm.name}</span>}
                      {rem.sourceUrl && (
                        <a
                          href={rem.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                        >
                          <span>Official Portal</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Urgency Badge & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-3 pl-8 md:pl-0 shrink-0">
                  {getUrgencyBadge(rem.dueDate, rem.isCompleted)}

                  <button
                    onClick={() => handleDelete(rem.id, rem.title)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Delete Reminder"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* Add Custom Reminder Modal */}
      {/* ===================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200">
            <h3 className="text-base font-bold text-stone-900">Create Custom Reminder</h3>
            <p className="text-xs text-stone-600 mt-1">
              Add a personalized cutoff, document submission, or renewal reminder.
            </p>

            <form onSubmit={handleCreateReminder} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Target Farm</label>
                <select
                  value={newFarmId}
                  onChange={(e) => setNewFarmId(e.target.value)}
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
                <label className="block font-semibold text-stone-700 mb-1">Reminder Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Submit Krishi Seva Kendra invoice copy"
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Reminder Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as SchemeReminderType)}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800"
                >
                  {Object.entries(TYPE_CONFIG).map(([k, cfg]) => (
                    <option key={k} value={k}>
                      {cfg.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Due Date *</label>
                <input
                  type="date"
                  required
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Key instructions, officer name, or contact details..."
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Official Portal URL (Optional)
                </label>
                <input
                  type="url"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  placeholder="https://..."
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
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
