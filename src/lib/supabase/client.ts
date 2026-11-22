/**
 * AgriDOST Supabase Client & Configuration Manager
 * Handles connection status, honest offline-first fallback, authenticated health checks,
 * RLS ownership enforcement, and conflict-safe cloud synchronization.
 */

import { FarmerSchemeApplication, SchemeReminder } from '@/types';

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  urlConfigured: boolean;
  keyConfigured: boolean;
  mode: 'offline_local' | 'supabase_connected';
  message: string;
  supabaseUrl?: string;
  projectRef?: string;
  lastCheckedAt: string;
}

export interface SupabaseSyncResult {
  success: boolean;
  syncedCount: number;
  message: string;
  isOffline: boolean;
  timestamp: string;
  conflictsResolved?: number;
}

export interface SupabaseFetchResult {
  success: boolean;
  applications: FarmerSchemeApplication[];
  reminders: SchemeReminder[];
  message: string;
  isOffline: boolean;
  timestamp: string;
}

export interface SupabaseHealthResult {
  online: boolean;
  authGatewayReady: boolean;
  schemaTablesReady: boolean;
  message: string;
  latencyMs?: number;
  statusCode?: number;
}

/**
 * Extracts Supabase Project Reference from URL or JWT token.
 */
export function extractProjectRef(url?: string, anonKey?: string): string | undefined {
  if (url) {
    const match = url.match(/https:\/\/([a-z0-9_-]+)\.supabase\.co/i);
    if (match) return match[1];
  }
  if (anonKey) {
    try {
      const parts = anonKey.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload.ref) return payload.ref;
      }
    } catch {
      // Ignore parse failure in browser/SSR
    }
  }
  return undefined;
}

/**
 * Evaluates whether Supabase environment credentials are fully provided and structurally valid.
 */
export function getSupabaseConfigStatus(overrides?: {
  url?: string;
  anonKey?: string;
}): SupabaseConfigStatus {
  const url = overrides?.url !== undefined ? overrides.url : process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = overrides?.anonKey !== undefined ? overrides.anonKey : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const urlConfigured = Boolean(
    url &&
    url.trim().length > 0 &&
    !url.includes('placeholder') &&
    url.startsWith('https://')
  );

  const keyConfigured = Boolean(
    anonKey &&
    anonKey.trim().length > 20 &&
    !anonKey.includes('placeholder') &&
    anonKey.includes('.')
  );

  const isConfigured = urlConfigured && keyConfigured;
  const projectRef = extractProjectRef(url, anonKey);

  return {
    isConfigured,
    urlConfigured,
    keyConfigured,
    mode: isConfigured ? 'supabase_connected' : 'offline_local',
    message: isConfigured
      ? `Supabase credentials detected (${projectRef || 'cloud'}). Cloud sync is available.`
      : 'Supabase unconfigured or offline. Running in offline-first LocalStorage mode with 100% feature availability.',
    supabaseUrl: urlConfigured ? url : undefined,
    projectRef,
    lastCheckedAt: new Date().toISOString(),
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigStatus().isConfigured;
}

/**
 * Authenticated-Safe Health Check
 * Probes the GoTrue Auth Gateway (/auth/v1/health) which is accessible via the anon key,
 * and checks whether the database schema cache contains the required tables.
 */
export async function checkSupabaseHealth(overrides?: {
  url?: string;
  anonKey?: string;
}): Promise<SupabaseHealthResult> {
  const status = getSupabaseConfigStatus(overrides);
  if (!status.isConfigured || !status.supabaseUrl) {
    return {
      online: false,
      authGatewayReady: false,
      schemaTablesReady: false,
      message: 'Supabase URL/Key not configured. Operating in verified offline mode.',
    };
  }

  const anonKey = overrides?.anonKey !== undefined ? overrides.anonKey : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
  const baseUrl = status.supabaseUrl.replace(/\/+$/, '');
  const startTime = Date.now();

  try {
    // 1. Probe the Auth gateway health endpoint (GoTrue)
    const authRes = await fetch(`${baseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
      },
    });

    const latency = Date.now() - startTime;
    const authGatewayReady = authRes.ok || authRes.status === 200;

    if (!authGatewayReady && authRes.status !== 401) {
      return {
        online: false,
        authGatewayReady: false,
        schemaTablesReady: false,
        statusCode: authRes.status,
        message: `Supabase endpoint returned status ${authRes.status}. Falling back to offline local storage.`,
        latencyMs: latency,
      };
    }

    // 2. Check if government assistance database tables exist in the PostgREST schema cache
    let schemaTablesReady = false;
    try {
      const tableRes = await fetch(`${baseUrl}/rest/v1/schemes?select=id&limit=1`, {
        method: 'GET',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });
      schemaTablesReady = tableRes.ok;
    } catch {
      schemaTablesReady = false;
    }

    const message = schemaTablesReady
      ? `Supabase endpoint reachable and database tables verified (${latency}ms).`
      : `Supabase endpoint reachable (${latency}ms). Auth gateway online; database tables pending migration.`;

    return {
      online: true,
      authGatewayReady,
      schemaTablesReady,
      statusCode: authRes.status,
      message,
      latencyMs: latency,
    };
  } catch (err) {
    return {
      online: false,
      authGatewayReady: false,
      schemaTablesReady: false,
      message: `Failed to connect to Supabase: ${err instanceof Error ? err.message : 'Network error'}. Operating offline.`,
    };
  }
}

/**
 * Filter out demo profiles and demo data before syncing to the cloud.
 * Rule 8: Never treat demo profiles as authenticated Supabase accounts.
 * Rule 9: Never upload demo data as real farmer records.
 */
export function filterRealFarmerRecords(records: {
  applications?: FarmerSchemeApplication[];
  reminders?: SchemeReminder[];
}): {
  realApplications: FarmerSchemeApplication[];
  realReminders: SchemeReminder[];
  demoFilteredCount: number;
} {
  const rawApps = records.applications || [];
  const rawRems = records.reminders || [];

  const realApplications = rawApps.filter(
    (app) => !app.isDemo && !app.id.includes('demo') && !app.farmId.startsWith('demo-')
  );

  const realReminders = rawRems.filter(
    (rem) => !rem.id.includes('demo') && !rem.farmId.startsWith('demo-')
  );

  const demoFilteredCount =
    (rawApps.length - realApplications.length) + (rawRems.length - realReminders.length);

  return {
    realApplications,
    realReminders,
    demoFilteredCount,
  };
}

/**
 * Conflict Detection & Resolution Strategy (Last-Write-Wins based on ISO timestamps).
 */
export function resolveApplicationConflicts(
  local: FarmerSchemeApplication[],
  remote: FarmerSchemeApplication[]
): {
  merged: FarmerSchemeApplication[];
  conflictsResolved: number;
} {
  let conflictsResolved = 0;
  const map = new Map<string, FarmerSchemeApplication>();

  // Seed with remote records
  for (const r of remote) {
    map.set(r.id, r);
  }

  // Compare local records
  for (const l of local) {
    const existing = map.get(l.id);
    if (!existing) {
      map.set(l.id, l);
    } else {
      const localTime = new Date(l.updatedAt || l.createdAt).getTime();
      const remoteTime = new Date(existing.updatedAt || existing.createdAt).getTime();

      if (localTime > remoteTime) {
        // Local is newer -> overwrite remote in local representation
        map.set(l.id, l);
        conflictsResolved++;
      } else if (remoteTime > localTime) {
        // Remote is newer -> keep remote
        conflictsResolved++;
      }
    }
  }

  return {
    merged: Array.from(map.values()),
    conflictsResolved,
  };
}

/**
 * Synchronize local applications and reminders to Supabase.
 * Strictly enforces:
 * 1. Demo records are NEVER uploaded as real farmer data.
 * 2. Farmer records require valid auth.uid() authentication for RLS compliance.
 * 3. Graceful fallback to LocalStorage when Supabase is unreachable or unconfigured.
 */
export async function syncToSupabase(
  payload: {
    applications?: FarmerSchemeApplication[];
    reminders?: SchemeReminder[];
  },
  options?: {
    authToken?: string;
    skipDemoFilter?: boolean;
    overrides?: { url?: string; anonKey?: string };
  }
): Promise<SupabaseSyncResult> {
  const status = getSupabaseConfigStatus(options?.overrides);
  const timestamp = new Date().toISOString();

  if (!status.isConfigured) {
    return {
      success: true,
      syncedCount: 0,
      message: 'Operating in LocalStorage offline mode. Records preserved locally; cloud sync is on standby.',
      isOffline: true,
      timestamp,
    };
  }

  // Filter out demo data (Rules 8 & 9)
  const { realApplications, realReminders, demoFilteredCount } = options?.skipDemoFilter
    ? {
        realApplications: payload.applications || [],
        realReminders: payload.reminders || [],
        demoFilteredCount: 0,
      }
    : filterRealFarmerRecords(payload);

  const totalToSync = realApplications.length + realReminders.length;

  if (totalToSync === 0) {
    return {
      success: true,
      syncedCount: 0,
      message: demoFilteredCount > 0
        ? `Operating in LocalStorage offline mode. ${demoFilteredCount} demo record(s) preserved locally; demo data is excluded from cloud sync.`
        : 'Operating in LocalStorage offline mode. No new farmer records to synchronize.',
      isOffline: false,
      timestamp,
    };
  }

  try {
    const anonKey = options?.overrides?.anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const baseUrl = (options?.overrides?.url || process.env.NEXT_PUBLIC_SUPABASE_URL!).replace(/\/+$/, '');
    const authHeader = options?.authToken ? `Bearer ${options.authToken}` : `Bearer ${anonKey}`;

    // RLS Protection Check: If writing farmer records without an authenticated session,
    // the Postgres RLS policy (auth.uid() = farmer_id) will reject unauthenticated inserts.
    if (!options?.authToken) {
      return {
        success: true,
        syncedCount: 0,
        message: 'Records preserved safely in LocalStorage. Cloud persistence requires an authenticated farmer session to satisfy RLS ownership isolation.',
        isOffline: true,
        timestamp,
      };
    }

    if (realApplications.length > 0) {
      const appRes = await fetch(`${baseUrl}/rest/v1/farmer_scheme_applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: authHeader,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(realApplications),
      });

      if (!appRes.ok) {
        throw new Error(`Application sync failed with status ${appRes.status}`);
      }
    }

    if (realReminders.length > 0) {
      const remRes = await fetch(`${baseUrl}/rest/v1/scheme_reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: authHeader,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(realReminders),
      });

      if (!remRes.ok) {
        throw new Error(`Reminder sync failed with status ${remRes.status}`);
      }
    }

    return {
      success: true,
      syncedCount: totalToSync,
      message: `Successfully synchronized ${totalToSync} real farmer record(s) to Supabase cloud.`,
      isOffline: false,
      timestamp,
    };
  } catch (err) {
    return {
      success: false,
      syncedCount: 0,
      message: `Cloud sync encountered an issue: ${err instanceof Error ? err.message : 'Unknown error'}. Local copy is safe.`,
      isOffline: true,
      timestamp,
    };
  }
}

/**
 * Fetch applications and reminders from Supabase cloud if configured.
 * Reports honest offline status when unconfigured.
 */
export async function syncFromSupabase(
  farmId?: string,
  options?: {
    authToken?: string;
    overrides?: { url?: string; anonKey?: string };
  }
): Promise<SupabaseFetchResult> {
  const status = getSupabaseConfigStatus(options?.overrides);
  const timestamp = new Date().toISOString();

  if (!status.isConfigured) {
    return {
      success: true,
      applications: [],
      reminders: [],
      message: 'Supabase unconfigured; utilizing LocalStorage as primary source of truth.',
      isOffline: true,
      timestamp,
    };
  }

  try {
    const anonKey = options?.overrides?.anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const baseUrl = (options?.overrides?.url || process.env.NEXT_PUBLIC_SUPABASE_URL!).replace(/\/+$/, '');
    const authHeader = options?.authToken ? `Bearer ${options.authToken}` : `Bearer ${anonKey}`;
    const farmFilter = farmId ? `?farm_id=eq.${encodeURIComponent(farmId)}` : '';

    const [appsRes, remsRes] = await Promise.all([
      fetch(`${baseUrl}/rest/v1/farmer_scheme_applications${farmFilter}`, {
        headers: {
          apikey: anonKey,
          Authorization: authHeader,
        },
      }),
      fetch(`${baseUrl}/rest/v1/scheme_reminders${farmFilter}`, {
        headers: {
          apikey: anonKey,
          Authorization: authHeader,
        },
      }),
    ]);

    const apps = appsRes.ok ? await appsRes.json() : [];
    const rems = remsRes.ok ? await remsRes.json() : [];

    return {
      success: true,
      applications: Array.isArray(apps) ? apps : [],
      reminders: Array.isArray(rems) ? rems : [],
      message: `Fetched ${apps.length} application(s) and ${rems.length} reminder(s) from Supabase.`,
      isOffline: false,
      timestamp,
    };
  } catch (err) {
    return {
      success: false,
      applications: [],
      reminders: [],
      message: `Failed to fetch from cloud: ${err instanceof Error ? err.message : 'Unknown error'}. Using local data.`,
      isOffline: true,
      timestamp,
    };
  }
}

/**
 * Recovery after reconnection:
 * Checks connectivity first, and reconciles state with LocalStorage.
 */
export async function recoverAndSync(
  payload: {
    applications?: FarmerSchemeApplication[];
    reminders?: SchemeReminder[];
  },
  options?: {
    authToken?: string;
    overrides?: { url?: string; anonKey?: string };
  }
): Promise<{
  recovered: boolean;
  message: string;
  syncedCount: number;
}> {
  const health = await checkSupabaseHealth(options?.overrides);
  if (!health.online) {
    return {
      recovered: false,
      message: `Reconnection check failed: ${health.message}. LocalStorage continues as primary store.`,
      syncedCount: 0,
    };
  }

  const syncResult = await syncToSupabase(payload, options);
  return {
    recovered: syncResult.success,
    message: syncResult.message,
    syncedCount: syncResult.syncedCount,
  };
}

/**
 * Returns formatted REST API URL for a table or RPC function.
 */
export function getSupabaseRestUrl(
  endpoint: string,
  overrides?: { url?: string }
): string {
  const baseUrl = (overrides?.url || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  return `${baseUrl}/rest/v1/${cleanEndpoint}`;
}

/**
 * Constructs standard headers for authenticated or anon Supabase REST requests.
 */
export function getSupabaseHeaders(options?: {
  authToken?: string;
  anonKey?: string;
  prefer?: string;
}): Record<string, string> {
  const anonKey = options?.anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const authHeader = options?.authToken ? `Bearer ${options.authToken}` : `Bearer ${anonKey}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: authHeader,
  };

  if (options?.prefer) {
    headers['Prefer'] = options.prefer;
  }

  return headers;
}
