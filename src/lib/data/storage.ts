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
  DEMO_SPRAY_OPERATIONS,
  DEMO_TASKS,
  DEMO_SUPPLIES,
  DEMO_TREE_PLANS,
} from './demo-data';

// LocalStorage Keys
const KEYS = {
  FARMS: 'agridost_farms',
  ACTIVE_FARM_ID: 'agridost_active_farm_id',
  ZONES: 'agridost_zones',
  CROP_PLANS: 'agridost_crop_plans',
  HEALTH_RECORDS: 'agridost_health_records',
  TASKS: 'agridost_tasks',
  SUPPLIES: 'agridost_supplies',
  TREE_PLANS: 'agridost_tree_plans',
  SPRAY_OPS: 'agridost_spray_operations',
  INITIALIZED: 'agridost_storage_initialized_v1',
};

// SSR-safe storage helper
function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[AgriDOST Storage] Error reading key "${key}":`, err);
    return defaultValue;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    notifyDataChange(key);
  } catch (err) {
    console.error(`[AgriDOST Storage] Error writing key "${key}":`, err);
  }
}

function notifyDataChange(key: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('agridost:data-changed', { detail: { key } }));
}

/**
 * Initializes LocalStorage with demo data if visiting for the first time
 */
export function ensureInitialized(): void {
  if (typeof window === 'undefined') return;
  const isInitialized = window.localStorage.getItem(KEYS.INITIALIZED);
  if (!isInitialized) {
    resetToDemoData();
  }
}

/**
 * Completely resets LocalStorage to the pristine, verified DEMO datasets
 */
export function resetToDemoData(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEYS.FARMS, JSON.stringify(DEMO_FARMS));
  window.localStorage.setItem(KEYS.ACTIVE_FARM_ID, JSON.stringify(DEMO_FARMS[0]?.id || ''));
  window.localStorage.setItem(KEYS.ZONES, JSON.stringify(DEMO_FARM_ZONES));
  window.localStorage.setItem(KEYS.CROP_PLANS, JSON.stringify(DEMO_CROP_PLANS));
  window.localStorage.setItem(KEYS.HEALTH_RECORDS, JSON.stringify(DEMO_HEALTH_OBSERVATIONS));
  window.localStorage.setItem(KEYS.TASKS, JSON.stringify(DEMO_TASKS));
  window.localStorage.setItem(KEYS.SUPPLIES, JSON.stringify(DEMO_SUPPLIES));
  window.localStorage.setItem(KEYS.TREE_PLANS, JSON.stringify(DEMO_TREE_PLANS));
  window.localStorage.setItem(KEYS.SPRAY_OPS, JSON.stringify(DEMO_SPRAY_OPERATIONS));
  window.localStorage.setItem(KEYS.INITIALIZED, 'true');
  notifyDataChange('*');
}

// ================= FARMS ================= //

export function getFarms(): Farm[] {
  ensureInitialized();
  return getStorageItem<Farm[]>(KEYS.FARMS, []);
}

export function getFarmById(id: string): Farm | undefined {
  const farms = getFarms();
  return farms.find((f) => f.id === id);
}

export function saveFarm(farm: Farm): void {
  const farms = getFarms();
  const idx = farms.findIndex((f) => f.id === farm.id);
  const now = new Date().toISOString();
  const updatedFarm = { ...farm, updatedAt: now };

  if (idx >= 0) {
    farms[idx] = updatedFarm;
  } else {
    farms.unshift({ ...updatedFarm, createdAt: now });
  }
  setStorageItem(KEYS.FARMS, farms);

  // If no active farm or saving new farm, make it active
  const activeId = getActiveFarmId();
  if (!activeId || activeId === '') {
    setActiveFarmId(farm.id);
  }
}

export function deleteFarm(id: string): void {
  const farms = getFarms().filter((f) => f.id !== id);
  setStorageItem(KEYS.FARMS, farms);

  // Also cascade clean farm zones, plans, etc.
  const zones = getFarmZones().filter((z) => z.farmId !== id);
  setStorageItem(KEYS.ZONES, zones);

  if (getActiveFarmId() === id) {
    setActiveFarmId(farms[0]?.id || '');
  }
}

export function getActiveFarmId(): string {
  ensureInitialized();
  return getStorageItem<string>(KEYS.ACTIVE_FARM_ID, DEMO_FARMS[0]?.id || '');
}

export function setActiveFarmId(id: string): void {
  setStorageItem(KEYS.ACTIVE_FARM_ID, id);
}

export function getActiveFarm(): Farm | undefined {
  const activeId = getActiveFarmId();
  const farms = getFarms();
  return farms.find((f) => f.id === activeId) || farms[0];
}

// ================= FARM ZONES ================= //

export function getFarmZones(farmId?: string): FarmZone[] {
  ensureInitialized();
  const zones = getStorageItem<FarmZone[]>(KEYS.ZONES, []);
  if (farmId) {
    return zones.filter((z) => z.farmId === farmId);
  }
  return zones;
}

export function saveFarmZone(zone: FarmZone): void {
  const zones = getFarmZones();
  const idx = zones.findIndex((z) => z.id === zone.id);
  const now = new Date().toISOString();
  const updatedZone = { ...zone, updatedAt: now };

  if (idx >= 0) {
    zones[idx] = updatedZone;
  } else {
    zones.push({ ...updatedZone, createdAt: now });
  }
  setStorageItem(KEYS.ZONES, zones);
}

export function deleteFarmZone(id: string): void {
  const zones = getFarmZones().filter((z) => z.id !== id);
  setStorageItem(KEYS.ZONES, zones);
}

// ================= CROP PLANS ================= //

export function getCropPlans(farmId?: string): CropPlan[] {
  ensureInitialized();
  const plans = getStorageItem<CropPlan[]>(KEYS.CROP_PLANS, []);
  if (farmId) {
    return plans.filter((p) => p.farmId === farmId);
  }
  return plans;
}

export function saveCropPlan(plan: CropPlan): void {
  const plans = getCropPlans();
  const idx = plans.findIndex((p) => p.farmId === plan.farmId && p.season === plan.season);
  const now = new Date().toISOString();
  const updatedPlan = { ...plan, updatedAt: now };

  if (idx >= 0) {
    plans[idx] = updatedPlan;
  } else {
    plans.push({ ...updatedPlan, createdAt: now });
  }
  setStorageItem(KEYS.CROP_PLANS, plans);
}

// ================= HEALTH OBSERVATIONS ================= //

export function getHealthObservations(farmId?: string): HealthObservation[] {
  ensureInitialized();
  const observations = getStorageItem<HealthObservation[]>(KEYS.HEALTH_RECORDS, []);
  if (farmId) {
    return observations.filter((o) => o.farmId === farmId);
  }
  return observations;
}

export function saveHealthObservation(record: HealthObservation): void {
  const records = getHealthObservations();
  const idx = records.findIndex((r) => r.id === record.id);
  if (idx >= 0) {
    records[idx] = record;
  } else {
    records.unshift(record);
  }
  setStorageItem(KEYS.HEALTH_RECORDS, records);
}

// ================= FARM TASKS ================= //

export function getFarmTasks(farmId?: string): FarmTask[] {
  ensureInitialized();
  const tasks = getStorageItem<FarmTask[]>(KEYS.TASKS, []);
  if (farmId) {
    return tasks.filter((t) => t.farmId === farmId);
  }
  return tasks;
}

export function saveFarmTask(task: FarmTask): void {
  const tasks = getFarmTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    tasks[idx] = task;
  } else {
    tasks.push(task);
  }
  setStorageItem(KEYS.TASKS, tasks);
}

export function toggleFarmTask(id: string): void {
  const tasks = getFarmTasks();
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.status = task.status === 'completed' ? 'pending' : 'completed';
    setStorageItem(KEYS.TASKS, tasks);
  }
}

// ================= FARM SUPPLIES ================= //

export function getFarmSupplies(farmId?: string): FarmSupply[] {
  ensureInitialized();
  const supplies = getStorageItem<FarmSupply[]>(KEYS.SUPPLIES, []);
  if (farmId) {
    return supplies.filter((s) => s.farmId === farmId);
  }
  return supplies;
}

export function saveFarmSupply(supply: FarmSupply): void {
  const supplies = getFarmSupplies();
  const idx = supplies.findIndex((s) => s.id === supply.id);
  if (idx >= 0) {
    supplies[idx] = supply;
  } else {
    supplies.push(supply);
  }
  setStorageItem(KEYS.SUPPLIES, supplies);
}

// ================= BOUNDARY TREE PLANS ================= //

export function getTreePlans(farmId?: string): BoundaryTreePlan[] {
  ensureInitialized();
  const plans = getStorageItem<BoundaryTreePlan[]>(KEYS.TREE_PLANS, []);
  if (farmId) {
    return plans.filter((p) => p.farmId === farmId);
  }
  return plans;
}

export function saveTreePlan(plan: BoundaryTreePlan): void {
  const plans = getTreePlans();
  const idx = plans.findIndex((p) => p.id === plan.id);
  if (idx >= 0) {
    plans[idx] = plan;
  } else {
    plans.push(plan);
  }
  setStorageItem(KEYS.TREE_PLANS, plans);
}

// ================= SPRAY OPERATIONS ================= //

export function getSprayOperations(farmId?: string): SprayOperation[] {
  ensureInitialized();
  const ops = getStorageItem<SprayOperation[]>(KEYS.SPRAY_OPS, []);
  if (farmId) {
    return ops.filter((o) => o.farmId === farmId);
  }
  return ops;
}

export function saveSprayOperation(op: SprayOperation): void {
  const ops = getSprayOperations();
  const idx = ops.findIndex((o) => o.id === op.id);
  if (idx >= 0) {
    ops[idx] = op;
  } else {
    ops.unshift(op);
  }
  setStorageItem(KEYS.SPRAY_OPS, ops);
}

// React listener helper
export function subscribeToDataChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener('agridost:data-changed', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('agridost:data-changed', handler);
    window.removeEventListener('storage', handler);
  };
}
