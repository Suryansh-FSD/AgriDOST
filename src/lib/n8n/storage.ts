/**
 * AgriDOST 4.0: LocalStorage Repository for n8n Executions & Gateway Config
 * Provides offline-first persistence, reactive event dispatching (`agridost:data-changed`),
 * 24-hour idempotency checking, and realistic pre-seeded demonstration records.
 */

import { N8nExecutionRecord, N8nExecutionStatus } from '@/types';

export const N8N_STORAGE_KEYS = {
  EXECUTIONS: 'agridost_n8n_executions',
  CONFIG: 'agridost_n8n_config',
  INITIALIZED: 'agridost_n8n_storage_initialized_v1',
};

export interface N8nGatewayConfig {
  webhookBaseUrl: string;
  apiKey?: string;
  webhookSecret: string;
  simulatedMode: boolean;
  autoRetry: boolean;
  lastPingStatus?: 'online' | 'offline' | 'unreachable';
  lastPingAt?: string;
}

export const DEFAULT_N8N_CONFIG: N8nGatewayConfig = {
  webhookBaseUrl: process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/',
  apiKey: process.env.N8N_API_KEY || 'agridost_n8n_api_key_secret',
  webhookSecret: process.env.N8N_WEBHOOK_SECRET || 'agridost_hmac_webhook_signing_secret_2026',
  simulatedMode: process.env.N8N_SIMULATED_MODE === 'true' || true,
  autoRetry: true,
  lastPingStatus: 'online',
  lastPingAt: new Date().toISOString(),
};

// ==============================================================================
// In-Memory Fallback (for SSR and headless test runners)
// ==============================================================================
const inMemoryStore = new Map<string, string>();

function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    } else {
      const raw = inMemoryStore.get(key);
      if (raw !== undefined) {
        return JSON.parse(raw) as T;
      }
    }
  } catch (err) {
    console.warn(`[N8nStorage] Error reading key "${key}":`, err);
  }
  return defaultValue;
}

function setStorageItem<T>(key: string, value: T): void {
  try {
    const raw = JSON.stringify(value);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, raw);
      window.dispatchEvent(new CustomEvent('agridost:data-changed', { detail: { key } }));
    } else {
      inMemoryStore.set(key, raw);
    }
  } catch (err) {
    console.error(`[N8nStorage] Error writing key "${key}":`, err);
  }
}

// ==============================================================================
// Pre-seeded Demonstration Executions
// ==============================================================================
export const DEMO_N8N_EXECUTIONS: N8nExecutionRecord[] = [
  {
    id: 'exec-demo-govt-01',
    eventId: 'evt-demo-govt-01',
    eventType: 'government.reminder.triggered',
    workflowId: 'government-assistance',
    farmId: 'demo-farm-01',
    status: 'success',
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: new Date(Date.now() - 3598500).toISOString(),
    durationMs: 1500,
    inputSummary: 'PM-KISAN: Annual Aadhaar e-KYC deadline reminder for Farmer Ramesh Patel',
    outputSummary: 'Dispatched automated multi-channel notification (SMS + In-App) for 31 Mar 2026 cutoff.',
    outputData: {
      channels: ['sms', 'in_app'],
      recipient: 'Ramesh Patel (+91 98220 12345)',
      scheme: 'PM-KISAN',
      status: 'dispatched',
      messageId: 'sms_pmk_98412',
    },
    retryCount: 0,
  },
  {
    id: 'exec-demo-ops-01',
    eventId: 'evt-demo-ops-01',
    eventType: 'operations.spray.window_evaluation',
    workflowId: 'smart-farm-operations',
    farmId: 'demo-farm-01',
    status: 'success',
    startedAt: new Date(Date.now() - 7200000).toISOString(),
    completedAt: new Date(Date.now() - 7198800).toISOString(),
    durationMs: 1200,
    inputSummary: 'Cotton Zone 1: Fungicide spray evaluation (Wind: 11 km/h, Temp: 27°C, Precip: 10%)',
    outputSummary: 'Optimal spray window confirmed (06:30 AM - 09:30 AM). Low drift risk.',
    outputData: {
      clearance: 'approved',
      safetyWindow: '06:30 AM - 09:30 AM',
      maxSafeWindKmh: 15,
      actualWindKmh: 11,
      recommendation: 'Optimal weather window for precision drone/boom spraying.',
    },
    retryCount: 0,
  },
  {
    id: 'exec-demo-mkt-01',
    eventId: 'evt-demo-mkt-01',
    eventType: 'market.price.check_requested',
    workflowId: 'market-intelligence',
    farmId: 'demo-farm-01',
    status: 'success',
    startedAt: new Date(Date.now() - 14400000).toISOString(),
    completedAt: new Date(Date.now() - 14398100).toISOString(),
    durationMs: 1900,
    inputSummary: 'Soybean market price check at Nashik APMC (Target: ₹4,800/qtl, Current: ₹4,920/qtl)',
    outputSummary: 'SELL_NOW advisory generated. Mandi spot price is +₹120 above target threshold.',
    outputData: {
      recommendation: 'SELL_NOW',
      commodity: 'Soybean',
      mandi: 'Nashik APMC',
      currentPriceInr: 4920,
      targetPriceInr: 4800,
      gainOverTargetInr: 120,
      rationale: 'Favorable price surge. Selling now locks in an extra ₹120/quintal over expectation.',
    },
    retryCount: 0,
  },
];

/**
 * Initializes n8n storage with demo executions and default config if not initialized.
 */
export function ensureN8nStorageInitialized(): void {
  const isInit = getStorageItem<string | null>(N8N_STORAGE_KEYS.INITIALIZED, null);
  if (!isInit) {
    resetN8nStorageToDemo();
  }
}

/**
 * Resets storage to clean demonstration state.
 */
export function resetN8nStorageToDemo(): void {
  setStorageItem(N8N_STORAGE_KEYS.EXECUTIONS, DEMO_N8N_EXECUTIONS);
  setStorageItem(N8N_STORAGE_KEYS.CONFIG, DEFAULT_N8N_CONFIG);
  setStorageItem(N8N_STORAGE_KEYS.INITIALIZED, 'true');
}

// ==============================================================================
// Executions Repository Methods
// ==============================================================================

export function getExecutionRecords(): N8nExecutionRecord[] {
  ensureN8nStorageInitialized();
  return getStorageItem<N8nExecutionRecord[]>(N8N_STORAGE_KEYS.EXECUTIONS, []);
}

export function getExecutionById(id: string): N8nExecutionRecord | undefined {
  const all = getExecutionRecords();
  return all.find((rec) => rec.id === id);
}

export function getExecutionByEventId(eventId: string): N8nExecutionRecord | undefined {
  const all = getExecutionRecords();
  return all.find((rec) => rec.eventId === eventId);
}

export function saveExecutionRecord(record: N8nExecutionRecord): void {
  ensureN8nStorageInitialized();
  const all = getStorageItem<N8nExecutionRecord[]>(N8N_STORAGE_KEYS.EXECUTIONS, []);
  const index = all.findIndex((r) => r.id === record.id);

  if (index >= 0) {
    all[index] = record;
  } else {
    all.unshift(record);
  }

  setStorageItem(N8N_STORAGE_KEYS.EXECUTIONS, all);
}

export function updateExecutionRecord(
  id: string,
  updates: Partial<N8nExecutionRecord>
): N8nExecutionRecord | undefined {
  const record = getExecutionById(id);
  if (!record) return undefined;

  const updated: N8nExecutionRecord = {
    ...record,
    ...updates,
  };

  saveExecutionRecord(updated);
  return updated;
}

/**
 * Checks whether an idempotency key was executed within the last maxAgeHours (default 24h).
 */
export function findExecutionByIdempotencyKey(
  idempotencyKey: string,
  maxAgeHours = 24
): N8nExecutionRecord | undefined {
  const all = getExecutionRecords();
  const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;

  return all.find((rec) => {
    // Check if event ID or input summary matches idempotency key
    if (rec.id === idempotencyKey || rec.eventId === idempotencyKey) {
      const started = new Date(rec.startedAt).getTime();
      return started >= cutoffTime;
    }
    return false;
  });
}

export function clearExecutions(): void {
  setStorageItem(N8N_STORAGE_KEYS.EXECUTIONS, []);
}

// ==============================================================================
// Configuration Methods
// ==============================================================================

export function getN8nConfig(): N8nGatewayConfig {
  ensureN8nStorageInitialized();
  return getStorageItem<N8nGatewayConfig>(N8N_STORAGE_KEYS.CONFIG, DEFAULT_N8N_CONFIG);
}

export function saveN8nConfig(partialConfig: Partial<N8nGatewayConfig>): N8nGatewayConfig {
  ensureN8nStorageInitialized();
  const current = getN8nConfig();
  const updated: N8nGatewayConfig = {
    ...current,
    ...partialConfig,
  };
  setStorageItem(N8N_STORAGE_KEYS.CONFIG, updated);
  return updated;
}
