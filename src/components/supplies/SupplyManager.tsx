'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  ShoppingCart,
  Boxes,
  Minus,
  Edit3,
  Calendar,
  Layers,
  Sparkles,
  X,
  Trash2,
  TrendingDown,
  ShieldCheck,
} from 'lucide-react';
import { Farm, FarmSupply } from '@/types';
import * as storage from '@/lib/data/storage';
import { ActivityReminders } from './ActivityReminders';

interface SupplyManagerProps {
  farm?: Farm;
}

export function SupplyManager({ farm: propFarm }: SupplyManagerProps) {
  const [activeFarm, setActiveFarm] = useState<Farm | undefined>(propFarm);
  const [supplies, setSupplies] = useState<FarmSupply[]>([]);
  const [activeTab, setActiveTab] = useState<'supplies' | 'tasks' | 'combined'>('combined');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low' | 'ordered'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddSupplyModalOpen, setIsAddSupplyModalOpen] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Add Supply Form State
  const [newItemName, setNewItemName] = useState<string>('');
  const [newQuantity, setNewQuantity] = useState<number>(10);
  const [newUnit, setNewUnit] = useState<FarmSupply['unit']>('bags');
  const [newStatus, setNewStatus] = useState<FarmSupply['status']>('in_stock');

  // Sync farm from prop or storage
  useEffect(() => {
    if (propFarm) {
      setActiveFarm(propFarm);
    } else {
      setActiveFarm(storage.getActiveFarm());
    }
  }, [propFarm]);

  const loadSupplies = useCallback(() => {
    if (!activeFarm) return;
    const loaded = storage.getFarmSupplies(activeFarm.id);
    setSupplies(loaded);
  }, [activeFarm]);

  useEffect(() => {
    loadSupplies();
    const unsub = storage.subscribeToDataChanges(loadSupplies);
    return () => unsub();
  }, [loadSupplies]);

  // Inventory KPI calculations
  const stats = useMemo(() => {
    const totalItems = supplies.length;
    const inStock = supplies.filter((s) => s.status === 'in_stock').length;
    const lowStock = supplies.filter((s) => s.status === 'low').length;
    const ordered = supplies.filter((s) => s.status === 'ordered').length;
    return { totalItems, inStock, lowStock, ordered };
  }, [supplies]);

  // Filter supplies
  const filteredSupplies = useMemo(() => {
    return supplies.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.itemName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [supplies, statusFilter, searchQuery]);

  // Handle adding new supply
  const handleAddSupply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarm || !newItemName.trim()) return;

    const newSupply: FarmSupply = {
      id: `sup-${Date.now()}`,
      farmId: activeFarm.id,
      itemName: newItemName.trim(),
      quantity: Number(newQuantity) || 0,
      unit: newUnit,
      status: newStatus,
      isDemo: activeFarm.isDemo ?? false,
    };

    storage.saveFarmSupply(newSupply);
    setIsAddSupplyModalOpen(false);
    setNewItemName('');
    setNewQuantity(10);
    setNewUnit('bags');
    setNewStatus('in_stock');
    loadSupplies();

    setSaveSuccessMsg(`Added "${newSupply.itemName}" to inventory.`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Adjust quantity inline (+ / -)
  const handleQuantityAdjust = (id: string, delta: number) => {
    const item = supplies.find((s) => s.id === id);
    if (!item) return;

    const updatedQty = Math.max(0, item.quantity + delta);
    let updatedStatus = item.status;
    if (updatedQty === 0) {
      updatedStatus = 'low';
    } else if (updatedQty <= 3 && item.status === 'in_stock') {
      updatedStatus = 'low';
    } else if (updatedQty > 3 && item.status === 'low') {
      updatedStatus = 'in_stock';
    }

    const updatedItem: FarmSupply = {
      ...item,
      quantity: updatedQty,
      status: updatedStatus,
    };

    storage.saveFarmSupply(updatedItem);
    loadSupplies();
  };

  // Cycle status directly on card
  const handleToggleStatus = (id: string) => {
    const item = supplies.find((s) => s.id === id);
    if (!item) return;

    const nextStatus: Record<FarmSupply['status'], FarmSupply['status']> = {
      in_stock: 'low',
      low: 'ordered',
      ordered: 'in_stock',
    };

    const updatedItem: FarmSupply = {
      ...item,
      status: nextStatus[item.status],
    };

    storage.saveFarmSupply(updatedItem);
    loadSupplies();
  };

  // Delete supply item
  const handleDeleteSupply = (id: string) => {
    const existing = storage.getFarmSupplies();
    const updated = existing.filter((s) => s.id !== id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('agridost_supplies', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('agridost:data-changed', { detail: { key: 'agridost_supplies' } }));
    }
    loadSupplies();
  };

  if (!activeFarm) {
    return (
      <div className="bg-[#F7F7F0] border border-[#E7E9E2] rounded-2xl p-8 text-center text-[#26312A]">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-[#B9784F]" />
        <h3 className="font-semibold text-lg text-[#173F2B]">No Active Farm Selected</h3>
        <p className="text-xs mt-1 text-[#26312A]/70">
          Please select or register a farm to manage supplies and activity schedules.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-[#E7E9E2] shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-[#DCE8D3] text-[#173F2B]">
              <Boxes className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[#173F2B]">
                Farm Supplies & Activity Schedule
              </h2>
              <p className="text-xs text-[#26312A]/70">
                Inputs inventory, stock alerts, and operation reminders for{' '}
                <span className="font-semibold text-[#173F2B]">{activeFarm.name}</span>
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-[#F7F7F0] p-1 rounded-xl text-xs font-semibold border border-[#E7E9E2]">
            <button
              type="button"
              onClick={() => setActiveTab('combined')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'combined'
                  ? 'bg-white text-[#173F2B] shadow-xs'
                  : 'text-[#26312A]/70 hover:text-[#173F2B]'
              }`}
            >
              All Operations
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('supplies')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'supplies'
                  ? 'bg-white text-[#173F2B] shadow-xs'
                  : 'text-[#26312A]/70 hover:text-[#173F2B]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Supplies ({stats.totalItems})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'tasks'
                  ? 'bg-white text-[#173F2B] shadow-xs'
                  : 'text-[#26312A]/70 hover:text-[#173F2B]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Task Schedule
            </button>
          </div>
        </div>

        {/* Stock KPI Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#E7E9E2]">
          <div className="p-3.5 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2]">
            <p className="text-[11px] font-medium text-[#26312A]/70 uppercase tracking-wider">Total Input Items</p>
            <p className="text-xl font-bold text-[#173F2B] mt-0.5">{stats.totalItems}</p>
            <p className="text-[11px] text-[#26312A]/60">Tracked in local registry</p>
          </div>

          <div className="p-3.5 bg-[#DCE8D3]/35 rounded-xl border border-[#6F9B55]/25">
            <p className="text-[11px] font-medium text-[#173F2B] uppercase tracking-wider">In Stock</p>
            <p className="text-xl font-bold text-[#173F2B] mt-0.5">{stats.inStock}</p>
            <p className="text-[11px] text-[#173F2B]/75">Ready for field application</p>
          </div>

          <div className="p-3.5 bg-[#B9784F]/10 rounded-xl border border-[#B9784F]/30">
            <p className="text-[11px] font-medium text-[#9C5832] uppercase tracking-wider">Low Stock Alerts</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-xl font-bold text-[#9C5832]">{stats.lowStock}</p>
              {stats.lowStock > 0 && <TrendingDown className="w-4 h-4 text-[#B9784F]" />}
            </div>
            <p className="text-[11px] text-[#9C5832]/80">Requires dealer replenishment</p>
          </div>

          <div className="p-3.5 bg-[#F7F7F0] rounded-xl border border-[#E7E9E2]">
            <p className="text-[11px] font-medium text-[#26312A]/70 uppercase tracking-wider">On Order</p>
            <p className="text-xl font-bold text-[#173F2B] mt-0.5">{stats.ordered}</p>
            <p className="text-[11px] text-[#26312A]/60">Awaiting supplier dispatch</p>
          </div>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="bg-[#DCE8D3]/60 border border-[#6F9B55]/40 text-[#173F2B] px-4 py-3 rounded-2xl flex items-center justify-between animate-fadeIn shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#173F2B] shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        </div>
      )}

      {/* Main Content Area based on Tab */}
      {(activeTab === 'supplies' || activeTab === 'combined') && (
        <div className="space-y-4">
          {/* Inventory Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E7E9E2] shadow-xs">
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#26312A]/40 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search seeds, fertilizers, bio-agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#F7F7F0] border border-[#E7E9E2] rounded-xl text-xs text-[#26312A] placeholder-[#26312A]/40 focus:outline-none focus:border-[#173F2B]"
                />
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1">
                {(['all', 'in_stock', 'low', 'ordered'] as const).map((st) => {
                  const labels = {
                    all: 'All',
                    in_stock: 'In Stock',
                    low: 'Low Stock',
                    ordered: 'Ordered',
                  };
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                        statusFilter === st
                          ? 'bg-[#173F2B] text-white shadow-xs'
                          : 'bg-[#F7F7F0] text-[#26312A]/70 hover:bg-[#E7E9E2]'
                      }`}
                    >
                      {labels[st]}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddSupplyModalOpen(true)}
              className="inline-flex items-center gap-2 bg-[#173F2B] hover:bg-[#123222] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Add Supply Item
            </button>
          </div>

          {/* Supplies Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredSupplies.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl border border-[#E7E9E2] p-8 text-center text-[#26312A]/50 text-xs">
                <Package className="w-8 h-8 mx-auto mb-2 text-[#26312A]/30" />
                <p className="font-medium text-[#173F2B]">No inventory supplies found.</p>
                <p className="text-[#26312A]/60 mt-0.5">Click &ldquo;Add Supply Item&rdquo; to register inputs.</p>
              </div>
            ) : (
              filteredSupplies.map((item) => {
                const statusMeta = {
                  in_stock: {
                    label: 'In Stock',
                    badge: 'bg-[#DCE8D3] text-[#173F2B] border-[#6F9B55]/30',
                    dot: 'bg-[#6F9B55]',
                  },
                  low: {
                    label: 'Low Stock',
                    badge: 'bg-[#B9784F]/15 text-[#9C5832] border-[#B9784F]/30',
                    dot: 'bg-[#B9784F]',
                  },
                  ordered: {
                    label: 'Ordered',
                    badge: 'bg-[#173F2B]/10 text-[#173F2B] border-[#173F2B]/20',
                    dot: 'bg-[#173F2B]',
                  },
                }[item.status];

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-white rounded-2xl border border-[#E7E9E2] shadow-xs hover:border-[#6F9B55]/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-[#173F2B] text-sm truncate" title={item.itemName}>
                            {item.itemName}
                          </h4>
                          <span className="text-[11px] text-[#26312A]/60 font-mono">
                            Farm: {activeFarm.name.split(' ')[0]}
                          </span>
                        </div>

                        {/* Status Badge - Click to cycle status */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold transition-transform active:scale-95 ${statusMeta.badge}`}
                          title="Click to cycle status"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                          {statusMeta.label}
                        </button>
                      </div>

                      <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-[#173F2B]">{item.quantity}</span>
                        <span className="text-xs font-semibold text-[#26312A]/60 uppercase">{item.unit}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E7E9E2] flex items-center justify-between text-xs">
                      {/* Quantity quick adjust */}
                      <div className="flex items-center gap-1 bg-[#F7F7F0] rounded-lg p-0.5 border border-[#E7E9E2]">
                        <button
                          type="button"
                          onClick={() => handleQuantityAdjust(item.id, -1)}
                          className="p-1 hover:bg-white text-[#26312A] rounded transition-colors"
                          title="Reduce quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2 font-mono font-medium text-[#173F2B]">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleQuantityAdjust(item.id, 1)}
                          className="p-1 hover:bg-white text-[#26312A] rounded transition-colors"
                          title="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.isDemo && (
                          <span className="text-[10px] font-mono text-[#26312A]/40">[DEMO]</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteSupply(item.id)}
                          className="text-[#26312A]/40 hover:text-[#B9784F] p-1.5 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Activity Reminders Section */}
      {(activeTab === 'tasks' || activeTab === 'combined') && (
        <div className="pt-2">
          <ActivityReminders farm={activeFarm} />
        </div>
      )}

      {/* Add Supply Item Modal */}
      {isAddSupplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-[#E7E9E2] max-w-md w-full p-6 shadow-xl relative">
            <button
              type="button"
              onClick={() => setIsAddSupplyModalOpen(false)}
              className="absolute top-4 right-4 text-[#26312A]/50 hover:text-[#26312A] p-1"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-[#173F2B] mb-1 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#173F2B]" />
              Add Farm Inventory Item
            </h3>
            <p className="text-xs text-[#26312A]/70 mb-4">
              Register seeds, fertilizers, bio-agents, or tools for {activeFarm.name}
            </p>

            <form onSubmit={handleAddSupply} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[#26312A] block mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Trichoderma viride Bio-fungicide, DAP Fertiliser"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E7E9E2] bg-[#F7F7F0] rounded-xl text-[#26312A] focus:outline-none focus:border-[#173F2B] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#26312A] block mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-[#E7E9E2] bg-[#F7F7F0] rounded-xl text-[#26312A] focus:outline-none focus:border-[#173F2B] text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#26312A] block mb-1">Unit</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value as FarmSupply['unit'])}
                    className="w-full px-3 py-2 border border-[#E7E9E2] bg-[#F7F7F0] rounded-xl text-[#26312A] focus:outline-none focus:border-[#173F2B] text-xs"
                  >
                    <option value="bags">Bags</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="liters">Liters</option>
                    <option value="packets">Packets</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#26312A] block mb-1">Initial Stock Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['in_stock', 'low', 'ordered'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setNewStatus(st)}
                      className={`py-2 rounded-xl border text-center font-medium capitalize transition-all ${
                        newStatus === st
                          ? 'border-[#173F2B] bg-[#173F2B] text-white shadow-xs'
                          : 'border-[#E7E9E2] bg-[#F7F7F0] text-[#26312A] hover:bg-white'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddSupplyModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-[#26312A]/70 hover:bg-[#F7F7F0] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#173F2B] hover:bg-[#123222] text-white rounded-xl font-semibold shadow-xs transition-all active:scale-95"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
