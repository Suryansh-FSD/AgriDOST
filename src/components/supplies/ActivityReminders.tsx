'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Plus,
  Clock,
  AlertCircle,
  Filter,
  Check,
  X,
  Sparkles,
  Droplets,
  Sprout,
  Search as SearchIcon,
  Eye,
  Scissors,
  ClipboardList,
} from 'lucide-react';
import { Farm, FarmTask } from '@/types';
import * as storage from '@/lib/data/storage';

interface ActivityRemindersProps {
  farm?: Farm;
  onTaskChange?: () => void;
}

export function ActivityReminders({ farm: propFarm, onTaskChange }: ActivityRemindersProps) {
  const [activeFarm, setActiveFarm] = useState<Farm | undefined>(propFarm);
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // New task form state
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [newCategory, setNewCategory] = useState<NonNullable<FarmTask['category']>>('irrigation');

  // Sync farm
  useEffect(() => {
    if (propFarm) {
      setActiveFarm(propFarm);
    } else {
      setActiveFarm(storage.getActiveFarm());
    }
  }, [propFarm]);

  const loadTasks = useCallback(() => {
    if (!activeFarm) return;
    const loaded = storage.getFarmTasks(activeFarm.id);
    setTasks(loaded);
  }, [activeFarm]);

  useEffect(() => {
    loadTasks();
    const unsub = storage.subscribeToDataChanges(loadTasks);
    return () => unsub();
  }, [loadTasks]);

  const handleToggleTask = (id: string) => {
    storage.toggleFarmTask(id);
    loadTasks();
    if (onTaskChange) onTaskChange();
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarm || !newTitle.trim()) return;

    const newTask: FarmTask = {
      id: `task-${Date.now()}`,
      farmId: activeFarm.id,
      title: newTitle.trim(),
      dueDate: newDueDate,
      status: 'pending',
      category: newCategory,
      isDemo: activeFarm.isDemo ?? false,
    };

    storage.saveFarmTask(newTask);
    setIsAddModalOpen(false);
    setNewTitle('');
    loadTasks();
    if (onTaskChange) onTaskChange();
  };

  const categoryMeta: Record<
    NonNullable<FarmTask['category']>,
    { label: string; icon: React.ElementType; color: string; bg: string; border: string }
  > = {
    irrigation: { label: 'Irrigation', icon: Droplets, color: 'text-[#173F2B]', bg: 'bg-[#DCE8D3]', border: 'border-[#6F9B55]/30' },
    fertilizer: { label: 'Fertilizer', icon: Sprout, color: 'text-[#173F2B]', bg: 'bg-[#DCE8D3]', border: 'border-[#6F9B55]/30' },
    inspection: { label: 'Inspection', icon: Eye, color: 'text-[#8F6805]', bg: 'bg-[#F1D98A]/30', border: 'border-[#F1D98A]' },
    harvest: { label: 'Harvest', icon: Scissors, color: 'text-[#9C5832]', bg: 'bg-[#B9784F]/15', border: 'border-[#B9784F]/30' },
    general: { label: 'General', icon: ClipboardList, color: 'text-[#26312A]', bg: 'bg-[#F7F7F0]', border: 'border-[#E7E9E2]' },
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (categoryFilter !== 'all' && (task.category || 'general') !== categoryFilter) {
        return false;
      }
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return task.title.toLowerCase().includes(q);
      }
      return true;
    });
  }, [tasks, categoryFilter, statusFilter, searchQuery]);

  // Task urgency helper
  const getUrgency = (dueDate: string, status: string) => {
    if (status === 'completed') {
      return { label: 'Done', color: 'text-[#26312A]/50 bg-[#F7F7F0] border-[#E7E9E2]' };
    }
    const today = new Date().toISOString().split('T')[0];
    if (dueDate < today) {
      return { label: 'Overdue', color: 'text-[#9C5832] bg-[#B9784F]/15 border-[#B9784F]/40' };
    }
    if (dueDate === today) {
      return { label: 'Due Today', color: 'text-[#8F6805] bg-[#F1D98A]/30 border-[#F1D98A]' };
    }
    return { label: `Due ${dueDate}`, color: 'text-[#26312A]/70 bg-[#F7F7F0] border-[#E7E9E2]' };
  };

  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-4">
      {/* Activity Reminders Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E7E9E2] shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#DCE8D3] text-[#173F2B] rounded-xl">
              <Calendar className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-semibold text-[#173F2B] text-base">Farm Operations & Task Schedule</h3>
              <p className="text-xs text-[#26312A]/70">
                {pendingCount} pending activity{pendingCount !== 1 ? 's' : ''} • {completedCount} completed
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 bg-[#173F2B] hover:bg-[#123222] text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-xs active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Farm Task
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-[#E7E9E2] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              categoryFilter === 'all'
                ? 'bg-[#173F2B] text-white shadow-xs'
                : 'bg-[#F7F7F0] text-[#26312A]/70 hover:bg-[#E7E9E2]'
            }`}
          >
            All Categories
          </button>
          {(['irrigation', 'fertilizer', 'inspection', 'harvest', 'general'] as const).map((cat) => {
            const isSelected = categoryFilter === cat;
            const meta = categoryMeta[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#173F2B] text-white shadow-xs'
                    : 'bg-[#F7F7F0] text-[#26312A]/70 hover:bg-[#E7E9E2]'
                }`}
              >
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {/* Status Filter & Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-48">
            <SearchIcon className="w-3.5 h-3.5 text-[#26312A]/40 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#F7F7F0] border border-[#E7E9E2] rounded-lg text-xs text-[#26312A] placeholder-[#26312A]/40 focus:outline-none focus:border-[#173F2B]"
            />
          </div>

          <div className="flex items-center border border-[#E7E9E2] rounded-lg p-0.5 bg-[#F7F7F0]">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                statusFilter === 'all' ? 'bg-white shadow-xs text-[#173F2B] font-semibold' : 'text-[#26312A]/60'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                statusFilter === 'pending' ? 'bg-white shadow-xs text-[#173F2B] font-semibold' : 'text-[#26312A]/60'
              }`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                statusFilter === 'completed' ? 'bg-white shadow-xs text-[#173F2B] font-semibold' : 'text-[#26312A]/60'
              }`}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E7E9E2] p-8 text-center text-[#26312A]/50 text-xs">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-[#26312A]/30" />
            <p className="font-medium text-[#173F2B]">No scheduled tasks match your filter.</p>
            <p className="text-[#26312A]/60 mt-0.5">Click &ldquo;Add Farm Task&rdquo; to schedule a new field operation.</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const cat = task.category || 'general';
            const meta = categoryMeta[cat] || categoryMeta.general;
            const CategoryIcon = meta.icon;
            const urgency = getUrgency(task.dueDate, task.status);

            return (
              <div
                key={task.id}
                className={`p-3.5 bg-white rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isCompleted
                    ? 'border-[#E7E9E2] bg-[#F7F7F0]/60 opacity-70'
                    : 'border-[#E7E9E2] hover:border-[#6F9B55]/60 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleTask(task.id)}
                    className="p-1 text-[#26312A]/40 hover:text-[#173F2B] rounded-lg transition-colors shrink-0"
                    title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-[#173F2B] fill-[#DCE8D3]" />
                    ) : (
                      <Circle className="w-5 h-5 text-[#26312A]/35 hover:text-[#173F2B]" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${
                        isCompleted ? 'line-through text-[#26312A]/40' : 'text-[#26312A]'
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px]">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium border ${meta.bg} ${meta.color} ${meta.border}`}>
                        <CategoryIcon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${urgency.color}`}>
                        {urgency.label}
                      </span>
                      {task.isDemo && (
                        <span className="text-[10px] font-mono text-[#26312A]/40">[DEMO]</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-xs text-[#26312A]/60 font-mono hidden sm:inline">
                    {task.dueDate}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-[#E7E9E2] max-w-md w-full p-6 shadow-xl relative">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-[#26312A]/50 hover:text-[#26312A] p-1"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-[#173F2B] mb-1 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#173F2B]" />
              Schedule Farm Task
            </h3>
            <p className="text-xs text-[#26312A]/70 mb-4">
              Add a farm activity reminder for {activeFarm?.name}
            </p>

            <form onSubmit={handleAddTask} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[#26312A] block mb-1">
                  Task Title / Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspect border perimeter for yellow mosaic whiteflies"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E7E9E2] bg-[#F7F7F0] rounded-xl text-[#26312A] focus:outline-none focus:border-[#173F2B] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#26312A] block mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E7E9E2] bg-[#F7F7F0] rounded-xl text-[#26312A] focus:outline-none focus:border-[#173F2B] text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#26312A] block mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as NonNullable<FarmTask['category']>)}
                    className="w-full px-3 py-2 border border-[#E7E9E2] bg-[#F7F7F0] rounded-xl text-[#26312A] focus:outline-none focus:border-[#173F2B] text-xs"
                  >
                    <option value="irrigation">Irrigation</option>
                    <option value="fertilizer">Fertilizer & Nutrition</option>
                    <option value="inspection">Scouting & Inspection</option>
                    <option value="harvest">Harvesting</option>
                    <option value="general">General Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-[#26312A]/70 hover:bg-[#F7F7F0] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#173F2B] hover:bg-[#123222] text-white rounded-xl font-semibold shadow-xs transition-all active:scale-95"
                >
                  Schedule Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
