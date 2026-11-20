'use client';

import { useState, useEffect, useCallback } from 'react';
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
import * as storage from './storage';

export function useFarmData() {
  const [mounted, setMounted] = useState(false);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [activeFarm, setActiveFarm] = useState<Farm | undefined>(undefined);
  const [zones, setZones] = useState<FarmZone[]>([]);
  const [cropPlans, setCropPlans] = useState<CropPlan[]>([]);
  const [healthObservations, setHealthObservations] = useState<HealthObservation[]>([]);
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [supplies, setSupplies] = useState<FarmSupply[]>([]);
  const [treePlans, setTreePlans] = useState<BoundaryTreePlan[]>([]);
  const [sprayOps, setSprayOps] = useState<SprayOperation[]>([]);

  const refresh = useCallback(() => {
    if (typeof window === 'undefined') return;
    storage.ensureInitialized();
    const loadedFarms = storage.getFarms();
    const currentActive = storage.getActiveFarm();
    setFarms(loadedFarms);
    setActiveFarm(currentActive);

    const activeId = currentActive?.id;
    setZones(storage.getFarmZones(activeId));
    setCropPlans(storage.getCropPlans(activeId));
    setHealthObservations(storage.getHealthObservations(activeId));
    setTasks(storage.getFarmTasks(activeId));
    setSupplies(storage.getFarmSupplies(activeId));
    setTreePlans(storage.getTreePlans(activeId));
    setSprayOps(storage.getSprayOperations(activeId));
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
    const unsubscribe = storage.subscribeToDataChanges(refresh);
    return () => unsubscribe();
  }, [refresh]);

  const switchFarm = useCallback((farmId: string) => {
    storage.setActiveFarmId(farmId);
  }, []);

  const addFarm = useCallback((newFarm: Farm) => {
    storage.saveFarm(newFarm);
  }, []);

  const resetDemo = useCallback(() => {
    storage.resetToDemoData();
  }, []);

  return {
    mounted,
    farms,
    activeFarm,
    zones,
    cropPlans,
    healthObservations,
    tasks,
    supplies,
    treePlans,
    sprayOps,
    switchFarm,
    addFarm,
    resetDemo,
    refresh,
  };
}
