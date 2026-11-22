/**
 * AgriDOST 4.0: Core Supabase Repository & Transparent Offline Fallback
 * Provides typed CRUD operations for all 9 AgriDOST core agronomic domains:
 * - Farms
 * - Farm Zones
 * - Crop Plans
 * - Health Records (Observations)
 * - Farm Tasks
 * - Farm Supplies
 * - Boundary Tree Plans
 * - Drone Spray Operations
 * - Farmer Profiles
 *
 * Transparently falls back to LocalStorage when Supabase is unconfigured,
 * offline, or experiencing errors, and enqueues failed writes in the offline retry queue.
 */

import {
  Farm,
  FarmZone,
  CropPlan,
  HealthObservation,
  FarmTask,
  FarmSupply,
  BoundaryTreePlan,
  SprayOperation,
} from '@/types';
import {
  DEMO_FARMS,
  DEMO_FARM_ZONES,
  DEMO_CROP_PLANS,
  DEMO_HEALTH_OBSERVATIONS,
  DEMO_TASKS,
  DEMO_SUPPLIES,
  DEMO_TREE_PLANS,
  DEMO_SPRAY_OPERATIONS,
} from '@/lib/data/demo-data';
import {
  enqueueMutation,
  resolveRecordConflicts,
  syncEntityToSupabase,
  syncEntityFromSupabase,
} from './sync-engine';
import { isSupabaseConfigured } from './client';

export interface FarmerProfile {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  state?: string;
  district?: string;
  taluka?: string;
  village?: string;
  pincode?: string;
  preferredLanguage?: 'en' | 'hi' | 'mr';
  farmerCategory?: 'marginal' | 'small' | 'semi_medium' | 'medium' | 'large';
  aadhaarHash?: string;
  isDemo?: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RepositoryOptions {
  authToken?: string;
  forceRemote?: boolean;
  skipDemoFilter?: boolean;
  overrides?: { url?: string; anonKey?: string };
}

export interface RepositoryMutationResult<T> {
  success: boolean;
  data: T;
  source: 'supabase' | 'local_storage' | 'queued_offline';
  message: string;
}

// Storage keys
export const CORE_STORAGE_KEYS = {
  FARMS: 'agridost_farms',
  ZONES: 'agridost_zones',
  CROP_PLANS: 'agridost_crop_plans',
  HEALTH_RECORDS: 'agridost_health_records',
  TASKS: 'agridost_tasks',
  SUPPLIES: 'agridost_supplies',
  TREE_PLANS: 'agridost_tree_plans',
  SPRAY_OPS: 'agridost_spray_operations',
  FARMER_PROFILE: 'agridost_farmer_profile',
  INITIALIZED: 'agridost_storage_initialized_v1',
};

// In-Memory store for SSR and test runner
const memoryStore = new Map<string, string>();

function getLocalItem<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } else {
      const raw = memoryStore.get(key);
      if (raw !== undefined) return JSON.parse(raw) as T;
    }
  } catch (err) {
    console.warn(`[CoreRepository] Failed to read key "${key}":`, err);
  }
  return defaultValue;
}

function setLocalItem<T>(key: string, value: T): void {
  try {
    const raw = JSON.stringify(value);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, raw);
      window.dispatchEvent(new CustomEvent('agridost:data-changed', { detail: { key } }));
    } else {
      memoryStore.set(key, raw);
    }
  } catch (err) {
    console.error(`[CoreRepository] Failed to write key "${key}":`, err);
  }
}

/**
 * Ensures demo datasets are seeded if local storage is uninitialized.
 */
export function ensureCoreDataInitialized(): void {
  const isInit = getLocalItem<string | null>(CORE_STORAGE_KEYS.INITIALIZED, null);
  if (!isInit) {
    setLocalItem(CORE_STORAGE_KEYS.FARMS, DEMO_FARMS);
    setLocalItem(CORE_STORAGE_KEYS.ZONES, DEMO_FARM_ZONES);
    setLocalItem(CORE_STORAGE_KEYS.CROP_PLANS, DEMO_CROP_PLANS);
    setLocalItem(CORE_STORAGE_KEYS.HEALTH_RECORDS, DEMO_HEALTH_OBSERVATIONS);
    setLocalItem(CORE_STORAGE_KEYS.TASKS, DEMO_TASKS);
    setLocalItem(CORE_STORAGE_KEYS.SUPPLIES, DEMO_SUPPLIES);
    setLocalItem(CORE_STORAGE_KEYS.TREE_PLANS, DEMO_TREE_PLANS);
    setLocalItem(CORE_STORAGE_KEYS.SPRAY_OPS, DEMO_SPRAY_OPERATIONS);
    setLocalItem(CORE_STORAGE_KEYS.INITIALIZED, 'true');
  }
}

// ==============================================================================
// 1. Farms CRUD
// ==============================================================================

export async function getFarms(options?: RepositoryOptions): Promise<Farm[]> {
  ensureCoreDataInitialized();
  const local = getLocalItem<Farm[]>(CORE_STORAGE_KEYS.FARMS, []);

  if (options?.forceRemote && isSupabaseConfigured() && options.authToken) {
    const remoteResult = await syncEntityFromSupabase<Farm>('farms', '', options);
    if (remoteResult.success && remoteResult.data.length > 0) {
      const { merged } = resolveRecordConflicts(
        local as unknown as (Farm & Record<string, unknown>)[],
        remoteResult.data as unknown as (Farm & Record<string, unknown>)[]
      );
      setLocalItem(CORE_STORAGE_KEYS.FARMS, merged);
      return merged as unknown as Farm[];
    }
  }

  return local;
}

export async function getFarmById(id: string, options?: RepositoryOptions): Promise<Farm | null> {
  const farms = await getFarms(options);
  return farms.find((f) => f.id === id) || null;
}

export async function saveFarm(
  farm: Farm,
  options?: RepositoryOptions
): Promise<RepositoryMutationResult<Farm>> {
  ensureCoreDataInitialized();
  const now = new Date().toISOString();
  const updatedFarm: Farm = {
    ...farm,
    updatedAt: now,
    createdAt: farm.createdAt || now,
  };

  const farms = getLocalItem<Farm[]>(CORE_STORAGE_KEYS.FARMS, []);
  const idx = farms.findIndex((f) => f.id === farm.id);
  if (idx >= 0) {
    farms[idx] = updatedFarm;
  } else {
    farms.unshift(updatedFarm);
  }
  setLocalItem(CORE_STORAGE_KEYS.FARMS, farms);

  // Cloud Sync
  if (isSupabaseConfigured() && options?.authToken && !farm.isDemo && !farm.id.startsWith('demo-')) {
    const syncRes = await syncEntityToSupabase('farms', [updatedFarm as unknown as Farm & Record<string, unknown>], options);
    if (syncRes.success && !syncRes.isOffline) {
      return {
        success: true,
        data: updatedFarm,
        source: 'supabase',
        message: 'Farm synchronized to Supabase cloud.',
      };
    }
  }

  // If cloud not ready or offline, enqueue mutation
  if (!farm.isDemo && !farm.id.startsWith('demo-')) {
    enqueueMutation('farms', 'UPSERT', farm.id, updatedFarm);
    return {
      success: true,
      data: updatedFarm,
      source: 'queued_offline',
      message: 'Farm saved to LocalStorage and queued for cloud synchronization.',
    };
  }

  return {
    success: true,
    data: updatedFarm,
    source: 'local_storage',
    message: 'Demo farm saved locally.',
  };
}

export async function deleteFarm(
  id: string,
  options?: RepositoryOptions
): Promise<{ success: boolean; source: 'supabase' | 'local_storage' }> {
  ensureCoreDataInitialized();
  const farms = getLocalItem<Farm[]>(CORE_STORAGE_KEYS.FARMS, []).filter((f) => f.id !== id);
  setLocalItem(CORE_STORAGE_KEYS.FARMS, farms);

  if (isSupabaseConfigured() && options?.authToken && !id.startsWith('demo-')) {
    enqueueMutation('farms', 'DELETE', id, { id });
  }

  return { success: true, source: 'local_storage' };
}

// ==============================================================================
// 2. Farm Zones CRUD
// ==============================================================================

export async function getFarmZones(
  farmId?: string,
  options?: RepositoryOptions
): Promise<FarmZone[]> {
  ensureCoreDataInitialized();
  const local = getLocalItem<FarmZone[]>(CORE_STORAGE_KEYS.ZONES, []);
  const filtered = farmId ? local.filter((z) => z.farmId === farmId) : local;

  if (options?.forceRemote && isSupabaseConfigured() && options.authToken) {
    const query = farmId ? `farm_id=eq.${encodeURIComponent(farmId)}` : '';
    const remote = await syncEntityFromSupabase<FarmZone>('farm_zones', query, options);
    if (remote.success && remote.data.length > 0) {
      const { merged } = resolveRecordConflicts(
        filtered as unknown as (FarmZone & Record<string, unknown>)[],
        remote.data as unknown as (FarmZone & Record<string, unknown>)[]
      );
      return merged as unknown as FarmZone[];
    }
  }

  return filtered;
}

export async function saveFarmZone(
  zone: FarmZone,
  options?: RepositoryOptions
): Promise<RepositoryMutationResult<FarmZone>> {
  ensureCoreDataInitialized();
  const now = new Date().toISOString();
  const updatedZone: FarmZone = {
    ...zone,
    updatedAt: now,
    createdAt: zone.createdAt || now,
  };

  const zones = getLocalItem<FarmZone[]>(CORE_STORAGE_KEYS.ZONES, []);
  const idx = zones.findIndex((z) => z.id === zone.id);
  if (idx >= 0) {
    zones[idx] = updatedZone;
  } else {
    zones.push(updatedZone);
  }
  setLocalItem(CORE_STORAGE_KEYS.ZONES, zones);

  if (!zone.isDemo && !zone.id.startsWith('demo-')) {
    if (isSupabaseConfigured() && options?.authToken) {
      const syncRes = await syncEntityToSupabase('farm_zones', [updatedZone as unknown as FarmZone & Record<string, unknown>], options);
      if (syncRes.success && !syncRes.isOffline) {
        return {
          success: true,
          data: updatedZone,
          source: 'supabase',
          message: 'Zone synchronized to Supabase.',
        };
      }
    }
    enqueueMutation('farm_zones', 'UPSERT', zone.id, updatedZone);
    return {
      success: true,
      data: updatedZone,
      source: 'queued_offline',
      message: 'Zone saved locally and enqueued for sync.',
    };
  }

  return {
    success: true,
    data: updatedZone,
    source: 'local_storage',
    message: 'Demo zone saved locally.',
  };
}

export async function deleteFarmZone(
  id: string,
  options?: RepositoryOptions
): Promise<{ success: boolean; source: 'supabase' | 'local_storage' }> {
  ensureCoreDataInitialized();
  const zones = getLocalItem<FarmZone[]>(CORE_STORAGE_KEYS.ZONES, []).filter((z) => z.id !== id);
  setLocalItem(CORE_STORAGE_KEYS.ZONES, zones);

  if (isSupabaseConfigured() && options?.authToken && !id.startsWith('demo-')) {
    enqueueMutation('farm_zones', 'DELETE', id, { id });
  }

  return { success: true, source: 'local_storage' };
}

// ==============================================================================
// 3. Crop Plans CRUD
// ==============================================================================

export async function getCropPlans(
  farmId?: string,
  options?: RepositoryOptions
): Promise<CropPlan[]> {
  ensureCoreDataInitialized();
  const plans = getLocalItem<CropPlan[]>(CORE_STORAGE_KEYS.CROP_PLANS, []);
  return farmId ? plans.filter((p) => p.farmId === farmId) : plans;
}

export async function saveCropPlan(
  plan: CropPlan,
  options?: RepositoryOptions
): Promise<RepositoryMutationResult<CropPlan>> {
  ensureCoreDataInitialized();
  const now = new Date().toISOString();
  const planId = plan.id || `cp_${Date.now()}`;
  const updatedPlan: CropPlan = {
    ...plan,
    id: planId,
    updatedAt: now,
    createdAt: plan.createdAt || now,
  };

  const plans = getLocalItem<CropPlan[]>(CORE_STORAGE_KEYS.CROP_PLANS, []);
  const idx = plans.findIndex(
    (p) => (p.id && p.id === planId) || (p.farmId === plan.farmId && p.season === plan.season)
  );

  if (idx >= 0) {
    plans[idx] = updatedPlan;
  } else {
    plans.push(updatedPlan);
  }
  setLocalItem(CORE_STORAGE_KEYS.CROP_PLANS, plans);

  if (!plan.isDemo && !planId.startsWith('demo-')) {
    enqueueMutation('crop_plans', 'UPSERT', planId, updatedPlan);
    return {
      success: true,
      data: updatedPlan,
      source: 'queued_offline',
      message: 'Crop plan saved locally and queued for cloud synchronization.',
    };
  }

  return {
    success: true,
    data: updatedPlan,
    source: 'local_storage',
    message: 'Demo crop plan saved locally.',
  };
}

// ==============================================================================
// 4. Health Records (Observations) CRUD
// ==============================================================================

export async function getHealthRecords(
  farmId?: string,
  options?: RepositoryOptions
): Promise<HealthObservation[]> {
  ensureCoreDataInitialized();
  const records = getLocalItem<HealthObservation[]>(CORE_STORAGE_KEYS.HEALTH_RECORDS, []);
  return farmId ? records.filter((r) => r.farmId === farmId) : records;
}

export async function saveHealthRecord(
  record: HealthObservation,
  options?: RepositoryOptions
): Promise<RepositoryMutationResult<HealthObservation>> {
  ensureCoreDataInitialized();
  const now = new Date().toISOString();
  const updatedRecord: HealthObservation = {
    ...record,
    createdAt: record.createdAt || now,
  };

  const records = getLocalItem<HealthObservation[]>(CORE_STORAGE_KEYS.HEALTH_RECORDS, []);
  const idx = records.findIndex((r) => r.id === record.id);
  if (idx >= 0) {
    records[idx] = updatedRecord;
  } else {
    records.unshift(updatedRecord);
  }
  setLocalItem(CORE_STORAGE_KEYS.HEALTH_RECORDS, records);

  if (!record.isDemo && !record.id.startsWith('demo-')) {
    enqueueMutation('health_records', 'UPSERT', record.id, updatedRecord);
    return {
      success: true,
      data: updatedRecord,
      source: 'queued_offline',
      message: 'Health observation saved and enqueued for cloud sync.',
    };
  }

  return {
    success: true,
    data: updatedRecord,
    source: 'local_storage',
    message: 'Demo health record saved locally.',
  };
}

// ==============================================================================
// 5. Farm Tasks CRUD
// ==============================================================================

export async function getFarmTasks(
  farmId?: string,
  options?: RepositoryOptions
): Promise<FarmTask[]> {
  ensureCoreDataInitialized();
  const tasks = getLocalItem<FarmTask[]>(CORE_STORAGE_KEYS.TASKS, []);
  return farmId ? tasks.filter((t) => t.farmId === farmId) : tasks;
}

export async function saveFarmTask(
  task: FarmTask,
  options?: RepositoryOptions
): Promise<RepositoryMutationResult<FarmTask>> {
  ensureCoreDataInitialized();
  const tasks = getLocalItem<FarmTask[]>(CORE_STORAGE_KEYS.TASKS, []);
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    tasks[idx] = task;
  } else {
    tasks.push(task);
  }
  setLocalItem(CORE_STORAGE_KEYS.TASKS, tasks);

  if (!task.isDemo && !task.id.startsWith('demo-')) {
    enqueueMutation('farm_tasks', 'UPSERT', task.id, task);
    return {
      success: true,
      data: task,
      source: 'queued_offline',
      message: 'Task saved and queued for sync.',
    };
  }

  return {
    success: true,
    data: task,
    source: 'local_storage',
    message: 'Demo task saved locally.',
  };
}

export async function toggleFarmTask(
  id: string,
  options?: RepositoryOptions
): Promise<{ success: boolean; data?: FarmTask; source: 'supabase' | 'local_storage' }> {
  const tasks = getLocalItem<FarmTask[]>(CORE_STORAGE_KEYS.TASKS, []);
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.status = task.status === 'completed' ? 'pending' : 'completed';
    setLocalItem(CORE_STORAGE_KEYS.TASKS, tasks);
    if (!task.isDemo && !task.id.startsWith('demo-')) {
      enqueueMutation('farm_tasks', 'UPDATE', id, { status: task.status });
    }
    return { success: true, data: task, source: 'local_storage' };
  }
  return { success: false, source: 'local_storage' };
}

// ==============================================================================
// 6. Farm Supplies CRUD
// ==============================================================================

export async function getFarmSupplies(
  farmId?: string,
  options?: RepositoryOptions
): Promise<FarmSupply[]> {
  ensureCoreDataInitialized();
  const supplies = getLocalItem<FarmSupply[]>(CORE_STORAGE_KEYS.SUPPLIES, []);
  return farmId ? supplies.filter((s) => s.farmId === farmId) : supplies;
}

export async function saveFarmSupply(
  supply: FarmSupply,
  options?: RepositoryOptions
): Promise<RepositoryMutationResult<FarmSupply>> {
  ensureCoreDataInitialized();
  const supplies = getLocalItem<FarmSupply[]>(CORE_STORAGE_KEYS.SUPPLIES, []);
  const idx = supplies.findIndex((s) => s.id === supply.id);
  if (idx >= 0) {
    supplies[idx] = supply;
  } else {
    supplies.push(supply);
  }
  setLocalItem(CORE_STORAGE_KEYS.SUPPLIES, supplies);

  if (!supply.isDemo && !supply.id.startsWith('demo-')) {
    enqueueMutation('farm_supplies', 'UPSERT', supply.id, supply);
    return {
      success: true,
      data: supply,
      source: 'queued_offline',
      message: 'Supply item saved and enqueued for sync.',
    };
  }

  return {
    success: true,
    data: supply,
    source: 'local_storage',
    message: 'Demo supply saved locally.',
  };
}

// ==============================================================================
// 7. Tree Plans CRUD
// ==============================================================================

export async function getTreePlans(
  farmId?: string,
  options?: RepositoryOptions
): Promise<BoundaryTreePlan[]> {
  ensureCoreDataInitialized();
  const plans = getLocalItem<BoundaryTreePlan[]>(CORE_STORAGE_KEYS.TREE_PLANS, []);
  return farmId ? plans.filter((p) => p.farmId === farmId) : plans;
}

export async function saveTreePlan(
  plan: BoundaryTreePlan,
  options?: RepositoryOptions
): Promise<RepositoryMutationResult<BoundaryTreePlan>> {
  ensureCoreDataInitialized();
  const plans = getLocalItem<BoundaryTreePlan[]>(CORE_STORAGE_KEYS.TREE_PLANS, []);
  const idx = plans.findIndex((p) => p.id === plan.id);
  if (idx >= 0) {
    plans[idx] = plan;
  } else {
    plans.push(plan);
  }
  setLocalItem(CORE_STORAGE_KEYS.TREE_PLANS, plans);

  if (!plan.isDemo && !plan.id.startsWith('demo-')) {
    enqueueMutation('tree_plans', 'UPSERT', plan.id, plan);
    return {
      success: true,
      data: plan,
      source: 'queued_offline',
      message: 'Tree plan saved and queued for sync.',
    };
  }

  return {
    success: true,
    data: plan,
    source: 'local_storage',
    message: 'Demo tree plan saved locally.',
  };
}

// ==============================================================================
// 8. Spray Operations CRUD
// ==============================================================================

export async function getSprayOperations(
  farmId?: string,
  options?: RepositoryOptions
): Promise<SprayOperation[]> {
  ensureCoreDataInitialized();
  const ops = getLocalItem<SprayOperation[]>(CORE_STORAGE_KEYS.SPRAY_OPS, []);
  return farmId ? ops.filter((o) => o.farmId === farmId) : ops;
}

export async function saveSprayOperation(
  op: SprayOperation,
  options?: RepositoryOptions
): Promise<RepositoryMutationResult<SprayOperation>> {
  ensureCoreDataInitialized();
  const ops = getLocalItem<SprayOperation[]>(CORE_STORAGE_KEYS.SPRAY_OPS, []);
  const idx = ops.findIndex((o) => o.id === op.id);
  if (idx >= 0) {
    ops[idx] = op;
  } else {
    ops.unshift(op);
  }
  setLocalItem(CORE_STORAGE_KEYS.SPRAY_OPS, ops);

  if (!op.isDemo && !op.id.startsWith('demo-')) {
    enqueueMutation('spray_operations', 'UPSERT', op.id, op);
    return {
      success: true,
      data: op,
      source: 'queued_offline',
      message: 'Spray operation saved and queued for sync.',
    };
  }

  return {
    success: true,
    data: op,
    source: 'local_storage',
    message: 'Demo spray operation saved locally.',
  };
}

// ==============================================================================
// 9. Farmer Profile CRUD
// ==============================================================================

export async function getFarmerProfile(
  options?: RepositoryOptions
): Promise<FarmerProfile | null> {
  const profile = getLocalItem<FarmerProfile | null>(CORE_STORAGE_KEYS.FARMER_PROFILE, null);
  if (profile) return profile;

  // Default fallback profile for demo farmer
  return {
    id: 'farmer-ramesh-patil-001',
    fullName: 'Ramesh Patil',
    phone: '+91 98220 12345',
    state: 'Maharashtra',
    district: 'Nashik',
    taluka: 'Dindori',
    village: 'Vani',
    pincode: '422215',
    preferredLanguage: 'mr',
    farmerCategory: 'small',
    isDemo: true,
  };
}

export async function saveFarmerProfile(
  profile: FarmerProfile,
  options?: RepositoryOptions
): Promise<RepositoryMutationResult<FarmerProfile>> {
  const now = new Date().toISOString();
  const updatedProfile: FarmerProfile = {
    ...profile,
    updatedAt: now,
    createdAt: profile.createdAt || now,
  };
  setLocalItem(CORE_STORAGE_KEYS.FARMER_PROFILE, updatedProfile);

  if (!profile.isDemo && isSupabaseConfigured() && options?.authToken) {
    enqueueMutation('farmer_profiles', 'UPSERT', profile.id, updatedProfile);
    return {
      success: true,
      data: updatedProfile,
      source: 'queued_offline',
      message: 'Profile saved and queued for cloud sync.',
    };
  }

  return {
    success: true,
    data: updatedProfile,
    source: 'local_storage',
    message: 'Farmer profile saved locally.',
  };
}
