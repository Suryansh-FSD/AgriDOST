/**
 * AgriDOST 4.0: Bidirectional Sync Engine & Offline Retry Queue
 * Implements:
 * 1. Persistent Offline Retry Queue for failed mutations
 * 2. Deterministic Last-Write-Wins (LWW) Conflict Resolution
 * 3. Bidirectional Sync between LocalStorage and Supabase Cloud
 * 4. Demo Data Segregation & RLS Protection
 */

import { getSupabaseConfigStatus, getSupabaseHeaders, getSupabaseRestUrl } from './client';

export type CoreEntityTable =
  | 'farms'
  | 'farm_zones'
  | 'crop_plans'
  | 'health_records'
  | 'farm_tasks'
  | 'farm_supplies'
  | 'tree_plans'
  | 'spray_operations'
  | 'farmer_profiles'
  | 'farmer_scheme_applications'
  | 'scheme_reminders';

export type MutationAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';

export interface SyncMutation<T = unknown> {
  id: string;
  table: CoreEntityTable;
  action: MutationAction;
  recordId: string;
  payload: T;
  timestamp: string;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  status: 'pending' | 'in_flight' | 'failed' | 'completed';
}

export interface QueueRetryResult {
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  remainingPending: number;
  deadLetterCount: number;
  message: string;
}

export interface ConflictResolutionResult<T> {
  merged: T[];
  conflictsResolved: number;
  localWins: number;
  remoteWins: number;
}

export interface EntitySyncResult {
  success: boolean;
  syncedCount: number;
  conflictsResolved: number;
  isOffline: boolean;
  message: string;
  timestamp: string;
}

export const QUEUE_STORAGE_KEY = 'agridost_supabase_sync_queue';

// In-memory fallback for SSR/Node test runner
const inMemoryQueue: Map<string, string> = new Map();

function readQueueRaw(): SyncMutation[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } else {
      const raw = inMemoryQueue.get(QUEUE_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[SyncEngine] Failed to read queue:', err);
  }
  return [];
}

function writeQueueRaw(queue: SyncMutation[]): void {
  try {
    const raw = JSON.stringify(queue);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(QUEUE_STORAGE_KEY, raw);
    } else {
      inMemoryQueue.set(QUEUE_STORAGE_KEY, raw);
    }
  } catch (err) {
    console.error('[SyncEngine] Failed to write queue:', err);
  }
}

// ==============================================================================
// 1. Persistent Offline Retry Queue Operations
// ==============================================================================

/**
 * Enqueues a mutation into the persistent offline retry queue.
 */
export function enqueueMutation<T = unknown>(
  table: CoreEntityTable,
  action: MutationAction,
  recordId: string,
  payload: T,
  maxAttempts: number = 5
): SyncMutation<T> {
  const queue = readQueueRaw();

  // If a mutation for this same table & record is already pending, coalesce it
  const existingIdx = queue.findIndex(
    (m) => m.table === table && m.recordId === recordId && m.status === 'pending'
  );

  const mutation: SyncMutation<T> = {
    id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    table,
    action,
    recordId,
    payload,
    timestamp: new Date().toISOString(),
    attempts: 0,
    maxAttempts,
    status: 'pending',
  };

  if (existingIdx >= 0) {
    // Replace with latest mutation
    queue[existingIdx] = mutation as unknown as SyncMutation;
  } else {
    queue.push(mutation as unknown as SyncMutation);
  }

  writeQueueRaw(queue);
  return mutation;
}

/**
 * Retrieves all pending mutations awaiting synchronization.
 */
export function getPendingMutations(): SyncMutation[] {
  const queue = readQueueRaw();
  return queue.filter((m) => m.status === 'pending');
}

/**
 * Removes a specific mutation by ID after successful processing.
 */
export function removeMutation(id: string): void {
  const queue = readQueueRaw().filter((m) => m.id !== id);
  writeQueueRaw(queue);
}

/**
 * Completely clears the offline retry queue.
 */
export function clearQueue(): void {
  writeQueueRaw([]);
}

/**
 * Retrieves queue statistics for diagnostic reporting.
 */
export function getQueueStats(): {
  pending: number;
  failed: number;
  total: number;
  oldestAgeMs: number | null;
} {
  const queue = readQueueRaw();
  const pending = queue.filter((m) => m.status === 'pending');
  const failed = queue.filter((m) => m.status === 'failed');

  let oldestAgeMs: number | null = null;
  if (pending.length > 0) {
    const oldestTimestamp = new Date(pending[0].timestamp).getTime();
    oldestAgeMs = Math.max(0, Date.now() - oldestTimestamp);
  }

  return {
    pending: pending.length,
    failed: failed.length,
    total: queue.length,
    oldestAgeMs,
  };
}

/**
 * Retries and processes pending mutations against Supabase cloud endpoint.
 * Implements bounded retries (dead-letter after maxAttempts).
 */
export async function retryQueue(options?: {
  authToken?: string;
  overrides?: { url?: string; anonKey?: string };
}): Promise<QueueRetryResult> {
  const status = getSupabaseConfigStatus(options?.overrides);
  const queue = readQueueRaw();
  const pending = queue.filter((m) => m.status === 'pending');

  if (!status.isConfigured || pending.length === 0) {
    return {
      processedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      remainingPending: pending.length,
      deadLetterCount: queue.filter((m) => m.status === 'failed').length,
      message: !status.isConfigured
        ? 'Supabase unconfigured; retry queue preserved locally.'
        : 'Offline retry queue is empty.',
    };
  }

  // Without auth token, cannot satisfy authenticated RLS
  if (!options?.authToken) {
    return {
      processedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      remainingPending: pending.length,
      deadLetterCount: queue.filter((m) => m.status === 'failed').length,
      message: 'Authenticated farmer session required to drain retry queue to cloud.',
    };
  }

  let succeeded = 0;
  let failed = 0;

  for (const mut of pending) {
    mut.attempts += 1;

    try {
      const url = getSupabaseRestUrl(mut.table, options?.overrides);
      const headers = getSupabaseHeaders({
        authToken: options.authToken,
        anonKey: options?.overrides?.anonKey,
        prefer: mut.action === 'UPSERT' || mut.action === 'INSERT'
          ? 'resolution=merge-duplicates'
          : undefined,
      });

      let res: Response;
      if (mut.action === 'DELETE') {
        res = await fetch(`${url}?id=eq.${encodeURIComponent(mut.recordId)}`, {
          method: 'DELETE',
          headers,
        });
      } else if (mut.action === 'UPDATE') {
        res = await fetch(`${url}?id=eq.${encodeURIComponent(mut.recordId)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(mut.payload),
        });
      } else {
        // INSERT or UPSERT
        res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(mut.payload),
        });
      }

      if (res.ok || res.status === 201 || res.status === 204) {
        mut.status = 'completed';
        succeeded++;
      } else {
        const errorText = await res.text().catch(() => `HTTP ${res.status}`);
        mut.lastError = `HTTP ${res.status}: ${errorText}`;
        if (mut.attempts >= mut.maxAttempts) {
          mut.status = 'failed'; // Dead letter
        }
        failed++;
      }
    } catch (err) {
      mut.lastError = err instanceof Error ? err.message : 'Network error';
      if (mut.attempts >= mut.maxAttempts) {
        mut.status = 'failed';
      }
      failed++;
    }
  }

  // Filter out completed mutations
  const updatedQueue = queue.filter((m) => m.status !== 'completed');
  writeQueueRaw(updatedQueue);

  const remaining = updatedQueue.filter((m) => m.status === 'pending').length;
  const deadLetter = updatedQueue.filter((m) => m.status === 'failed').length;

  return {
    processedCount: pending.length,
    succeededCount: succeeded,
    failedCount: failed,
    remainingPending: remaining,
    deadLetterCount: deadLetter,
    message: `Processed ${pending.length} mutation(s): ${succeeded} succeeded, ${failed} failed (${remaining} remaining).`,
  };
}

// ==============================================================================
// 2. Deterministic Last-Write-Wins (LWW) Conflict Resolution
// ==============================================================================

/**
 * Extracts a comparable millisecond timestamp from an entity.
 */
function getRecordTimestamp(record: Record<string, unknown>): number {
  const ts =
    record.updatedAt ||
    record.updated_at ||
    record.createdAt ||
    record.created_at ||
    record.detected_at ||
    record.timestamp;

  if (typeof ts === 'string' || typeof ts === 'number') {
    const parsed = new Date(ts).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

/**
 * Resolves conflicts between local and remote datasets using Last-Write-Wins (LWW).
 * Guarantees convergence across offline sync sessions.
 */
export function resolveRecordConflicts<
  T extends { id: string } & Record<string, unknown>
>(
  local: T[],
  remote: T[]
): ConflictResolutionResult<T> {
  let conflictsResolved = 0;
  let localWins = 0;
  let remoteWins = 0;

  const map = new Map<string, T>();

  // 1. Populate remote items as baseline
  for (const r of remote) {
    if (r && r.id) {
      map.set(r.id, r);
    }
  }

  // 2. Reconcile with local items
  for (const l of local) {
    if (!l || !l.id) continue;

    const existing = map.get(l.id);
    if (!existing) {
      map.set(l.id, l);
    } else {
      const localTime = getRecordTimestamp(l);
      const remoteTime = getRecordTimestamp(existing);

      if (localTime > remoteTime) {
        // Local is strictly newer -> Local wins
        map.set(l.id, l);
        conflictsResolved++;
        localWins++;
      } else if (remoteTime > localTime) {
        // Remote is strictly newer -> Remote wins
        conflictsResolved++;
        remoteWins++;
      } else {
        // Timestamps equal: keep local as optimistic default
        map.set(l.id, l);
      }
    }
  }

  return {
    merged: Array.from(map.values()),
    conflictsResolved,
    localWins,
    remoteWins,
  };
}

// ==============================================================================
// 3. Demo Filter Segregation Helper
// ==============================================================================

/**
 * Filters out demo records from any dataset before pushing to Supabase.
 * Rules:
 * - isDemo === true
 * - is_demo === true
 * - id starts with 'demo-'
 * - farmId/farm_id starts with 'demo-'
 */
export function filterDemoRecords<T extends Record<string, unknown>>(
  records: T[]
): { realRecords: T[]; demoCount: number } {
  const realRecords = records.filter((r) => {
    if (r.isDemo === true || r.is_demo === true) return false;
    if (typeof r.id === 'string' && (r.id.startsWith('demo-') || r.id.includes('-demo-'))) return false;
    if (typeof r.farmId === 'string' && r.farmId.startsWith('demo-')) return false;
    if (typeof r.farm_id === 'string' && r.farm_id.startsWith('demo-')) return false;
    return true;
  });

  return {
    realRecords,
    demoCount: records.length - realRecords.length,
  };
}

// ==============================================================================
// 4. Entity Synchronization Service
// ==============================================================================

/**
 * Synchronizes an array of entity records to Supabase cloud table.
 * If offline or unconfigured, preserves locally and enqueues to retry queue.
 */
export async function syncEntityToSupabase<T extends { id: string } & Record<string, unknown>>(
  table: CoreEntityTable,
  records: T[],
  options?: {
    authToken?: string;
    skipDemoFilter?: boolean;
    overrides?: { url?: string; anonKey?: string };
  }
): Promise<EntitySyncResult> {
  const timestamp = new Date().toISOString();
  const status = getSupabaseConfigStatus(options?.overrides);

  if (!status.isConfigured) {
    return {
      success: true,
      syncedCount: 0,
      conflictsResolved: 0,
      isOffline: true,
      message: `Operating in LocalStorage offline mode. ${records.length} record(s) stored locally.`,
      timestamp,
    };
  }

  const { realRecords, demoCount } = options?.skipDemoFilter
    ? { realRecords: records, demoCount: 0 }
    : filterDemoRecords(records);

  if (realRecords.length === 0) {
    return {
      success: true,
      syncedCount: 0,
      conflictsResolved: 0,
      isOffline: false,
      message: demoCount > 0
        ? `${demoCount} demo record(s) excluded from cloud synchronization.`
        : 'No records to synchronize.',
      timestamp,
    };
  }

  // RLS requires authenticated user token for personal farmer records
  if (!options?.authToken) {
    // Enqueue each record so it gets synchronized once user logs in
    for (const rec of realRecords) {
      enqueueMutation(table, 'UPSERT', rec.id, rec);
    }

    return {
      success: true,
      syncedCount: 0,
      conflictsResolved: 0,
      isOffline: true,
      message: `${realRecords.length} record(s) enqueued in offline retry queue. Cloud sync pending farmer authentication.`,
      timestamp,
    };
  }

  try {
    const url = getSupabaseRestUrl(table, options?.overrides);
    const headers = getSupabaseHeaders({
      authToken: options.authToken,
      anonKey: options?.overrides?.anonKey,
      prefer: 'resolution=merge-duplicates',
    });

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(realRecords),
    });

    if (!res.ok) {
      throw new Error(`Cloud sync returned HTTP ${res.status}: ${res.statusText}`);
    }

    return {
      success: true,
      syncedCount: realRecords.length,
      conflictsResolved: 0,
      isOffline: false,
      message: `Successfully synchronized ${realRecords.length} record(s) to Supabase (${table}).`,
      timestamp,
    };
  } catch (err) {
    // Network or server error: Enqueue to retry queue to ensure zero data loss
    for (const rec of realRecords) {
      enqueueMutation(table, 'UPSERT', rec.id, rec);
    }

    return {
      success: false,
      syncedCount: 0,
      conflictsResolved: 0,
      isOffline: true,
      message: `Sync failed: ${err instanceof Error ? err.message : 'Network error'}. Preserved in offline retry queue.`,
      timestamp,
    };
  }
}

/**
 * Fetches entities from Supabase cloud table with optional query parameters.
 */
export async function syncEntityFromSupabase<T extends { id: string }>(
  table: CoreEntityTable,
  queryParams: string = '',
  options?: {
    authToken?: string;
    overrides?: { url?: string; anonKey?: string };
  }
): Promise<{ success: boolean; data: T[]; message: string; isOffline: boolean }> {
  const status = getSupabaseConfigStatus(options?.overrides);

  if (!status.isConfigured) {
    return {
      success: true,
      data: [],
      message: 'Supabase unconfigured; utilizing LocalStorage as primary source of truth.',
      isOffline: true,
    };
  }

  try {
    const cleanParams = queryParams ? (queryParams.startsWith('?') ? queryParams : `?${queryParams}`) : '';
    const url = `${getSupabaseRestUrl(table, options?.overrides)}${cleanParams}`;
    const headers = getSupabaseHeaders({
      authToken: options?.authToken,
      anonKey: options?.overrides?.anonKey,
    });

    const res = await fetch(url, { method: 'GET', headers });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as T[];
    return {
      success: true,
      data: Array.isArray(data) ? data : [],
      message: `Fetched ${data.length} record(s) from Supabase table ${table}.`,
      isOffline: false,
    };
  } catch (err) {
    return {
      success: false,
      data: [],
      message: `Cloud fetch failed: ${err instanceof Error ? err.message : 'Network error'}. Falling back to local data.`,
      isOffline: true,
    };
  }
}
