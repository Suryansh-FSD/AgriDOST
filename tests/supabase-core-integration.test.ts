/**
 * tests/supabase-core-integration.test.ts
 *
 * AgriDOST 4.0: Supabase Core Integration & Resilience Test Suite
 *
 * Comprehensive validation covering:
 * 1. Configuration evaluation & offline mode detection
 * 2. Standard IntegrationHealthResponse & operating mode transitions (LIVE, SIMULATED, OFFLINE, NOT_CONFIGURED, ERROR)
 * 3. Persistent offline retry queue (enqueue, bounded retries, dead-letter, coalescing)
 * 4. Deterministic Last-Write-Wins (LWW) conflict resolution
 * 5. Transparent offline fallback for all 9 core agronomic domains in core-repository
 * 6. Demo data segregation & RLS DDL policy verification
 * 7. HTTP route handler GET /api/supabase/health
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getSupabaseConfigStatus,
  isSupabaseConfigured,
  extractProjectRef,
  checkSupabaseHealth,
  getSupabaseRestUrl,
  getSupabaseHeaders,
} from '@/lib/supabase/client';
import { getSupabaseHealth } from '@/lib/supabase/health';
import {
  enqueueMutation,
  getPendingMutations,
  removeMutation,
  clearQueue,
  getQueueStats,
  retryQueue,
  resolveRecordConflicts,
  filterDemoRecords,
  syncEntityToSupabase,
  syncEntityFromSupabase,
} from '@/lib/supabase/sync-engine';
import {
  getFarms,
  getFarmById,
  saveFarm,
  deleteFarm,
  getFarmZones,
  saveFarmZone,
  deleteFarmZone,
  getCropPlans,
  saveCropPlan,
  getHealthRecords,
  saveHealthRecord,
  getFarmTasks,
  saveFarmTask,
  toggleFarmTask,
  getFarmSupplies,
  saveFarmSupply,
  getTreePlans,
  saveTreePlan,
  getSprayOperations,
  saveSprayOperation,
  getFarmerProfile,
  saveFarmerProfile,
} from '@/lib/supabase/core-repository';
import { GET as healthRouteGet } from '@/app/api/supabase/health/route';
import { Farm, FarmZone, CropPlan, HealthObservation, FarmTask } from '@/types';

const MOCK_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InBhb3ZucmJzYmtveHVud2FzaG9uIiwic3ViIjoiMTIzNDU2Nzg5MCJ9.signature_agridost';

describe('AgriDOST 4.0: Supabase Core Integration & Resilience Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearQueue();
  });

  // =========================================================================
  // 1. Configuration & Credential Validation
  // =========================================================================
  describe('1. Configuration & Offline Mode Detection', () => {
    it('detects unconfigured state when credentials are empty', () => {
      const status = getSupabaseConfigStatus({ url: '', anonKey: '' });
      expect(status.isConfigured).toBe(false);
      expect(status.mode).toBe('offline_local');
      expect(status.message).toContain('offline-first LocalStorage mode');
    });

    it('rejects URLs containing placeholder strings', () => {
      const status = getSupabaseConfigStatus({
        url: 'https://placeholder.supabase.co',
        anonKey: MOCK_JWT,
      });
      expect(status.isConfigured).toBe(false);
    });

    it('extracts project reference accurately from URL or JWT token', () => {
      const refFromUrl = extractProjectRef('https://paovnrbsbkoxunwashon.supabase.co');
      expect(refFromUrl).toBe('paovnrbsbkoxunwashon');

      const refFromJwt = extractProjectRef(undefined, MOCK_JWT);
      expect(refFromJwt).toBe('paovnrbsbkoxunwashon');
    });

    it('generates correct REST URLs and headers', () => {
      const url = getSupabaseRestUrl('farms', { url: 'https://test.supabase.co' });
      expect(url).toBe('https://test.supabase.co/rest/v1/farms');

      const headers = getSupabaseHeaders({
        authToken: 'my-bearer-token',
        anonKey: 'my-anon-key',
        prefer: 'resolution=merge-duplicates',
      });
      expect(headers['Authorization']).toBe('Bearer my-bearer-token');
      expect(headers['apikey']).toBe('my-anon-key');
      expect(headers['Prefer']).toBe('resolution=merge-duplicates');
    });
  });

  // =========================================================================
  // 2. Integration Health & Operating Mode Transitions
  // =========================================================================
  describe('2. Health Check & Operating Mode Transitions', () => {
    it('returns NOT_CONFIGURED when environment credentials are unset', async () => {
      const health = await getSupabaseHealth({ url: '', anonKey: '' });
      expect(health.provider).toBe('supabase');
      expect(health.category).toBe('database');
      expect(health.operatingMode).toBe('NOT_CONFIGURED');
      expect(health.configurationStatus).toBe('unconfigured');
      expect(health.connectivityStatus).toBe('offline');
      expect(health.featuresSupported).toContain('LocalStorage Offline Engine');
      expect(health.lastError).toContain('unconfigured');
    });

    it('returns OFFLINE when network connection fails or throws', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('DNS lookup failure'));
      vi.stubGlobal('fetch', mockFetch);

      const health = await getSupabaseHealth({
        url: 'https://paovnrbsbkoxunwashon.supabase.co',
        anonKey: MOCK_JWT,
      });

      expect(health.operatingMode).toBe('OFFLINE');
      expect(health.connectivityStatus).toBe('unreachable');
      expect(health.lastError).toContain('DNS lookup failure');
    });

    it('returns ERROR when upstream Supabase gateway responds with HTTP 500+', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });
      vi.stubGlobal('fetch', mockFetch);

      const health = await getSupabaseHealth({
        url: 'https://paovnrbsbkoxunwashon.supabase.co',
        anonKey: MOCK_JWT,
      });

      expect(health.operatingMode).toBe('ERROR');
      expect(health.connectivityStatus).toBe('degraded');
      expect(health.lastError).toContain('503');
    });

    it('returns SIMULATED when Auth Gateway is online but PostgREST tables are pending migration', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/v1/health')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ version: 'v2.198.0', name: 'GoTrue' }),
          });
        }
        if (url.includes('/rest/v1/')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            json: async () => ({ code: 'PGRST205', message: 'Table not found' }),
          });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });
      vi.stubGlobal('fetch', mockFetch);

      const health = await getSupabaseHealth({
        url: 'https://paovnrbsbkoxunwashon.supabase.co',
        anonKey: MOCK_JWT,
      });

      expect(health.operatingMode).toBe('SIMULATED');
      expect(health.connectivityStatus).toBe('online');
      expect(health.diagnosticDetails?.authGatewayReady).toBe(true);
      expect(health.diagnosticDetails?.schemaTablesReady).toBe(false);
      expect(health.dataFreshness?.provenance).toBe('simulated_fallback');
    });

    it('returns LIVE when both Auth Gateway and PostgREST schema tables are online', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/v1/health')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ version: 'v2.198.0' }),
          });
        }
        if (url.includes('/rest/v1/')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [{ id: 'farm-001' }],
          });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });
      vi.stubGlobal('fetch', mockFetch);

      const health = await getSupabaseHealth({
        url: 'https://paovnrbsbkoxunwashon.supabase.co',
        anonKey: MOCK_JWT,
      });

      expect(health.operatingMode).toBe('LIVE');
      expect(health.connectivityStatus).toBe('online');
      expect(health.lastSuccessfulCheck).not.toBeNull();
      expect(health.diagnosticDetails?.schemaTablesReady).toBe(true);
      expect(health.dataFreshness?.provenance).toBe('live_api');
    });
  });

  // =========================================================================
  // 3. Persistent Offline Retry Queue
  // =========================================================================
  describe('3. Persistent Offline Retry Queue', () => {
    it('enqueues mutations and coalesces updates for the same record', () => {
      enqueueMutation('farms', 'UPSERT', 'farm-101', { name: 'Initial Name' });
      expect(getPendingMutations().length).toBe(1);

      // Coalescing update
      enqueueMutation('farms', 'UPSERT', 'farm-101', { name: 'Updated Name' });
      const pending = getPendingMutations();
      expect(pending.length).toBe(1);
      expect((pending[0].payload as { name: string }).name).toBe('Updated Name');
    });

    it('tracks queue statistics including age and count', () => {
      enqueueMutation('farm_tasks', 'INSERT', 'task-01', { title: 'Irrigate' });
      enqueueMutation('farm_supplies', 'UPSERT', 'supp-01', { itemName: 'Urea' });

      const stats = getQueueStats();
      expect(stats.pending).toBe(2);
      expect(stats.total).toBe(2);
      expect(stats.oldestAgeMs).toBeGreaterThanOrEqual(0);
    });

    it('processes and removes successful mutations when retried with auth', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
      });
      vi.stubGlobal('fetch', mockFetch);

      enqueueMutation('farms', 'UPSERT', 'farm-retry-1', { name: 'Retry Farm' });

      const result = await retryQueue({
        authToken: 'farmer.token.jwt',
        overrides: { url: 'https://mock.supabase.co', anonKey: MOCK_JWT },
      });

      expect(result.processedCount).toBe(1);
      expect(result.succeededCount).toBe(1);
      expect(result.remainingPending).toBe(0);
      expect(getPendingMutations().length).toBe(0);
    });

    it('enforces bounded retries and moves mutation to dead-letter (failed) on maxAttempts', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Error',
      });
      vi.stubGlobal('fetch', mockFetch);

      // Max attempts = 2
      enqueueMutation('crop_plans', 'UPSERT', 'plan-fail-1', { season: 'Kharif' }, 2);

      // Attempt 1
      const res1 = await retryQueue({
        authToken: 'farmer.jwt',
        overrides: { url: 'https://mock.supabase.co', anonKey: MOCK_JWT },
      });
      expect(res1.failedCount).toBe(1);
      expect(res1.remainingPending).toBe(1);
      expect(res1.deadLetterCount).toBe(0);

      // Attempt 2 (reaches maxAttempts = 2 -> marked 'failed')
      const res2 = await retryQueue({
        authToken: 'farmer.jwt',
        overrides: { url: 'https://mock.supabase.co', anonKey: MOCK_JWT },
      });
      expect(res2.remainingPending).toBe(0);
      expect(res2.deadLetterCount).toBe(1);
    });
  });

  // =========================================================================
  // 4. Deterministic Last-Write-Wins (LWW) Conflict Resolution
  // =========================================================================
  describe('4. Last-Write-Wins (LWW) Conflict Resolution', () => {
    it('resolves conflicts by allowing strictly newer local record to win', () => {
      const local = [
        {
          id: 'farm-01',
          name: 'Local New Name',
          updatedAt: '2026-06-01T12:00:00.000Z',
        },
      ];
      const remote = [
        {
          id: 'farm-01',
          name: 'Remote Old Name',
          updatedAt: '2026-05-01T12:00:00.000Z',
        },
      ];

      const res = resolveRecordConflicts(local, remote);
      expect(res.conflictsResolved).toBe(1);
      expect(res.localWins).toBe(1);
      expect(res.remoteWins).toBe(0);
      expect(res.merged[0].name).toBe('Local New Name');
    });

    it('resolves conflicts by allowing strictly newer remote record to win', () => {
      const local = [
        {
          id: 'task-01',
          status: 'pending',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
      ];
      const remote = [
        {
          id: 'task-01',
          status: 'completed',
          updatedAt: '2026-04-02T10:00:00.000Z',
        },
      ];

      const res = resolveRecordConflicts(local, remote);
      expect(res.conflictsResolved).toBe(1);
      expect(res.remoteWins).toBe(1);
      expect(res.merged[0].status).toBe('completed');
    });

    it('merges non-overlapping records from both local and remote seamlessly', () => {
      const local = [{ id: 'rec-1', name: 'Only Local', updatedAt: '2026-01-01T00:00:00Z' }];
      const remote = [{ id: 'rec-2', name: 'Only Remote', updatedAt: '2026-01-01T00:00:00Z' }];

      const res = resolveRecordConflicts(local, remote);
      expect(res.conflictsResolved).toBe(0);
      expect(res.merged.length).toBe(2);
    });
  });

  // =========================================================================
  // 5. Core Repository Transparent Offline Fallback (All 9 Domains)
  // =========================================================================
  describe('5. Core Repository CRUD & Offline Fallback', () => {
    it('transparently saves and retrieves farms with offline queue fallback', async () => {
      const farm: Farm = {
        id: 'farm-real-900',
        name: 'Sahyadri Organic Vineyard',
        boundary: {
          type: 'Polygon',
          coordinates: [
            [
              [73.85, 20.01],
              [73.86, 20.01],
              [73.86, 20.02],
              [73.85, 20.02],
              [73.85, 20.01],
            ],
          ],
        },
        areaSqM: 10000,
        areaAcres: 2.47,
        primaryCrop: 'Grapes',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDemo: false,
      };

      const result = await saveFarm(farm);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Sahyadri Organic Vineyard');
      expect(result.source).toBe('queued_offline');

      const fetched = await getFarmById('farm-real-900');
      expect(fetched?.name).toBe('Sahyadri Organic Vineyard');
    });

    it('transparently saves and retrieves farm zones', async () => {
      const zone: FarmZone = {
        id: 'zone-real-101',
        farmId: 'farm-real-900',
        type: 'crop',
        name: 'Thompson Seedless Block A',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [73.85, 20.01],
              [73.855, 20.01],
              [73.855, 20.015],
              [73.85, 20.015],
              [73.85, 20.01],
            ],
          ],
        },
        cropName: 'Grapes',
        cropVariety: 'Thompson Seedless',
        isDemo: false,
      };

      const saveRes = await saveFarmZone(zone);
      expect(saveRes.success).toBe(true);

      const zones = await getFarmZones('farm-real-900');
      const found = zones.find((z) => z.id === 'zone-real-101');
      expect(found?.cropVariety).toBe('Thompson Seedless');
    });

    it('transparently saves and retrieves crop plans', async () => {
      const plan: CropPlan = {
        id: 'plan-real-202',
        farmId: 'farm-real-900',
        mode: 'farmer_selected',
        season: 'Rabi',
        year: 2026,
        zones: [],
        rationale: 'Targeting export market window in Europe',
        expectedTotalYieldTonnes: 18.5,
        status: 'active',
        isDemo: false,
      };

      const res = await saveCropPlan(plan);
      expect(res.success).toBe(true);

      const plans = await getCropPlans('farm-real-900');
      expect(plans.some((p) => p.id === 'plan-real-202')).toBe(true);
    });

    it('transparently saves and toggles farm tasks', async () => {
      const task: FarmTask = {
        id: 'task-real-303',
        farmId: 'farm-real-900',
        title: 'Apply Potassium Schoonite',
        dueDate: '2026-03-10',
        status: 'pending',
        category: 'fertilizer',
        isDemo: false,
      };

      await saveFarmTask(task);
      const tasksBefore = await getFarmTasks('farm-real-900');
      expect(tasksBefore.find((t) => t.id === 'task-real-303')?.status).toBe('pending');

      const toggleRes = await toggleFarmTask('task-real-303');
      expect(toggleRes.success).toBe(true);
      expect(toggleRes.data?.status).toBe('completed');
    });

    it('transparently saves and retrieves health observations', async () => {
      const record: HealthObservation = {
        id: 'health-real-404',
        farmId: 'farm-real-900',
        cropAffected: 'Grapes',
        detectedDisease: 'Downy Mildew',
        symptoms: ['Yellow oil-spots on upper leaf surface', 'White fungal down underneath'],
        possibleCauses: ['High relative humidity > 85%', 'Prolonged leaf wetness'],
        severity: 'medium',
        confidence: 91,
        status: 'active',
        isDemo: false,
      };

      const res = await saveHealthRecord(record);
      expect(res.success).toBe(true);

      const records = await getHealthRecords('farm-real-900');
      expect(records.some((r) => r.id === 'health-real-404')).toBe(true);
    });

    it('transparently saves and retrieves farm supplies', async () => {
      const res = await saveFarmSupply({
        id: 'supp-real-505',
        farmId: 'farm-real-900',
        itemName: 'Bordeaux Mixture Components',
        quantity: 50,
        unit: 'kg',
        status: 'in_stock',
        isDemo: false,
      });
      expect(res.success).toBe(true);

      const supplies = await getFarmSupplies('farm-real-900');
      expect(supplies.some((s) => s.id === 'supp-real-505')).toBe(true);
    });

    it('transparently saves and retrieves tree plans and spray operations', async () => {
      const treeRes = await saveTreePlan({
        id: 'tree-real-606',
        farmId: 'farm-real-900',
        speciesName: 'Subabul / Neem Windbreak',
        spacingMeters: 3,
        treeCount: 45,
        shadeRisk: 'low',
        rootCompetitionNote: 'Trenching along southern boundary prevents root spread into vineyard',
        suggestedPositions: [],
        isDemo: false,
      });
      expect(treeRes.success).toBe(true);

      const sprayRes = await saveSprayOperation({
        id: 'spray-real-707',
        farmId: 'farm-real-900',
        operationType: 'Fungicide',
        productName: 'Metalaxyl 35% WS',
        dosagePerAcre: '250g / 200L',
        dilutionRatio: '1:800',
        equipmentType: 'Drone',
        windSpeedKmh: 8,
        temperatureC: 24,
        humidityPct: 78,
        safetyStatus: 'optimal',
        scheduledTime: '2026-03-05T06:30:00Z',
        status: 'scheduled',
        isDemo: false,
      });
      expect(sprayRes.success).toBe(true);

      const ops = await getSprayOperations('farm-real-900');
      expect(ops.some((o) => o.id === 'spray-real-707')).toBe(true);
    });

    it('saves and retrieves farmer profiles', async () => {
      const profileRes = await saveFarmerProfile({
        id: 'farmer-999',
        fullName: 'Balasaheb Shinde',
        phone: '+91 98234 56789',
        state: 'Maharashtra',
        district: 'Nashik',
        taluka: 'Niphad',
        village: 'Pimpalgaon Baswant',
        pincode: '422209',
        preferredLanguage: 'mr',
        farmerCategory: 'small',
        isDemo: false,
      });
      expect(profileRes.success).toBe(true);

      const profile = await getFarmerProfile();
      expect(profile?.fullName).toBe('Balasaheb Shinde');
      expect(profile?.preferredLanguage).toBe('mr');
    });
  });

  // =========================================================================
  // 6. Demo Data Segregation & RLS DDL Verification
  // =========================================================================
  describe('6. Demo Data Segregation & DDL Verification', () => {
    it('strictly filters out demo items from cloud sync payloads', () => {
      const records = [
        { id: 'demo-farm-01', name: 'Demo 1', isDemo: true },
        { id: 'farm-real-01', name: 'Real 1', isDemo: false },
        { id: 'farm-real-02', farmId: 'demo-farm-99', isDemo: false },
      ];

      const { realRecords, demoCount } = filterDemoRecords(records);
      expect(demoCount).toBe(2);
      expect(realRecords.length).toBe(1);
      expect(realRecords[0].id).toBe('farm-real-01');
    });

    it('verifies DDL migration enables RLS and enforces authenticated farmer isolation on all 9 tables', () => {
      const ddlPath = path.resolve(
        process.cwd(),
        'supabase/migrations/20261122_agridost_core.sql'
      );
      const sql = fs.readFileSync(ddlPath, 'utf8');

      const coreTables = [
        'farmer_profiles',
        'farms',
        'farm_zones',
        'crop_plans',
        'health_records',
        'farm_tasks',
        'farm_supplies',
        'tree_plans',
        'spray_operations',
      ];

      for (const table of coreTables) {
        // 1. RLS Enabled
        expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);

        // 2. Triggers for updated_at
        expect(sql).toContain(`trigger_${table}_updated_at`);

        // 3. TO authenticated check
        const policyRegex = new RegExp(`CREATE POLICY [\\s\\S]*?ON ${table}[\\s\\S]*?TO authenticated`, 'i');
        expect(sql).toMatch(policyRegex);
      }

      // Check subquery wrapper (select auth.uid()) for performance
      expect(sql).toContain('(select auth.uid()) = farmer_id');
      expect(sql).toContain('(select auth.uid()) = id');
    });
  });

  // =========================================================================
  // 7. HTTP Route Handler /api/supabase/health
  // =========================================================================
  describe('7. HTTP Route Handler /api/supabase/health', () => {
    it('returns valid JSON adhering to IntegrationHealthResponse', async () => {
      const res = await healthRouteGet();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.provider).toBe('supabase');
      expect(data.category).toBe('database');
      expect(['LIVE', 'SIMULATED', 'OFFLINE', 'NOT_CONFIGURED', 'ERROR']).toContain(
        data.operatingMode
      );
      expect(data.featuresSupported).toBeInstanceOf(Array);
      expect(data.dataFreshness).toBeDefined();

      // Cache headers
      const cacheControl = res.headers.get('Cache-Control');
      expect(cacheControl).toContain('no-store');
    });
  });
});
