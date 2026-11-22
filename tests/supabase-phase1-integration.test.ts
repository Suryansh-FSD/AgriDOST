/**
 * tests/supabase-phase1-integration.test.ts
 *
 * AgriDOST Phase 1: Supabase Cloud Integration Test Suite
 *
 * Covers all 9 mandatory test requirements:
 * 1. Missing credentials
 * 2. Invalid credentials
 * 3. Successful cloud connection
 * 4. Authenticated read/write
 * 5. RLS ownership isolation
 * 6. Offline fallback
 * 7. Network failure
 * 8. Sync conflict
 * 9. Recovery after reconnection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getSupabaseConfigStatus,
  isSupabaseConfigured,
  checkSupabaseHealth,
  syncToSupabase,
  syncFromSupabase,
  filterRealFarmerRecords,
  resolveApplicationConflicts,
  recoverAndSync,
} from '@/lib/supabase/client';
import { FarmerSchemeApplication, SchemeReminder } from '@/types';

const MOCK_VALID_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InBhb3ZucmJzYmtveHVud2FzaG9uIiwic3ViIjoiMTIzNDU2Nzg5MCJ9.mock_signature_for_testing_agridost';

describe('AgriDOST Phase 1: Supabase Cloud Integration Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Missing Credentials
  // =========================================================================
  describe('1. Missing Credentials Handling', () => {
    it('should report offline_local mode when credentials are completely empty', () => {
      const status = getSupabaseConfigStatus({ url: '', anonKey: '' });
      expect(status.isConfigured).toBe(false);
      expect(status.urlConfigured).toBe(false);
      expect(status.keyConfigured).toBe(false);
      expect(status.mode).toBe('offline_local');
      expect(status.message).toContain('offline-first LocalStorage mode');
    });

    it('should report offline_local when only URL is provided without key', () => {
      const status = getSupabaseConfigStatus({
        url: 'https://test-project.supabase.co',
        anonKey: '',
      });
      expect(status.isConfigured).toBe(false);
      expect(status.urlConfigured).toBe(true);
      expect(status.keyConfigured).toBe(false);
      expect(status.mode).toBe('offline_local');
    });

    it('health check gracefully reports unconfigured state without throwing', async () => {
      const health = await checkSupabaseHealth({ url: '', anonKey: '' });
      expect(health.online).toBe(false);
      expect(health.authGatewayReady).toBe(false);
      expect(health.message).toContain('offline mode');
    });

    it('syncToSupabase preserves local state when unconfigured', async () => {
      const result = await syncToSupabase(
        { applications: [] },
        { overrides: { url: '', anonKey: '' } }
      );
      expect(result.success).toBe(true);
      expect(result.isOffline).toBe(true);
      expect(result.syncedCount).toBe(0);
      expect(result.message).toContain('LocalStorage offline mode');
    });
  });

  // =========================================================================
  // 2. Invalid Credentials
  // =========================================================================
  describe('2. Invalid Credentials Handling', () => {
    it('should reject non-HTTPS URLs or placeholder strings', () => {
      const status = getSupabaseConfigStatus({
        url: 'http://insecure-supabase.com',
        anonKey: 'placeholder-anon-key',
      });
      expect(status.isConfigured).toBe(false);
      expect(status.urlConfigured).toBe(false);
      expect(status.keyConfigured).toBe(false);
    });

    it('should reject malformed anon keys lacking JWT dot structure', () => {
      const status = getSupabaseConfigStatus({
        url: 'https://valid-url.supabase.co',
        anonKey: 'not-a-valid-jwt-token-string',
      });
      expect(status.keyConfigured).toBe(false);
      expect(status.isConfigured).toBe(false);
    });

    it('health check handles 401/403 invalid API key response gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid API key' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const health = await checkSupabaseHealth({
        url: 'https://mock-project.supabase.co',
        anonKey: MOCK_VALID_JWT,
      });

      expect(health.online).toBe(true);
      expect(health.schemaTablesReady).toBe(false);
    });
  });

  // =========================================================================
  // 3. Successful Cloud Connection
  // =========================================================================
  describe('3. Successful Cloud Connection', () => {
    it('extracts project reference correctly from valid Supabase URL', () => {
      const status = getSupabaseConfigStatus({
        url: 'https://paovnrbsbkoxunwashon.supabase.co',
        anonKey: MOCK_VALID_JWT,
      });
      expect(status.isConfigured).toBe(true);
      expect(status.projectRef).toBe('paovnrbsbkoxunwashon');
      expect(status.mode).toBe('supabase_connected');
    });

    it('health check verifies GoTrue Auth Gateway and PostgREST readiness', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/v1/health')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ version: 'v2.198.0', name: 'GoTrue' }),
          });
        }
        if (url.includes('/rest/v1/schemes')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [{ id: 'pm-kisan' }],
          });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });
      vi.stubGlobal('fetch', mockFetch);

      const health = await checkSupabaseHealth({
        url: 'https://paovnrbsbkoxunwashon.supabase.co',
        anonKey: MOCK_VALID_JWT,
      });

      expect(health.online).toBe(true);
      expect(health.authGatewayReady).toBe(true);
      expect(health.schemaTablesReady).toBe(true);
      expect(health.message).toContain('database tables verified');
    });
  });

  // =========================================================================
  // 4. Authenticated Read / Write & Demo Filtering (Rules 8 & 9)
  // =========================================================================
  describe('4. Authenticated Read/Write & Demo Data Segregation', () => {
    it('strictly filters out demo applications from cloud synchronization', () => {
      const apps: FarmerSchemeApplication[] = [
        {
          id: 'app-demo-01',
          farmId: 'demo-farm-01',
          schemeId: 'pm-kisan',
          status: 'approved',
          statusSource: 'government_verified',
          portalUrl: 'https://pmkisan.gov.in',
          nextAction: 'None',
          documentsStatus: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          isDemo: true, // Demo flag
        },
        {
          id: 'app-real-farmer-101',
          farmId: 'farm-real-99',
          schemeId: 'pmfby',
          status: 'submitted',
          statusSource: 'user_reported',
          portalUrl: 'https://pmfby.gov.in',
          nextAction: 'Wait for assessment',
          documentsStatus: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          isDemo: false, // Real farmer
        },
      ];

      const { realApplications, demoFilteredCount } = filterRealFarmerRecords({
        applications: apps,
      });

      expect(realApplications.length).toBe(1);
      expect(realApplications[0].id).toBe('app-real-farmer-101');
      expect(demoFilteredCount).toBe(1);
    });

    it('requires authenticated session token before writing farmer records to cloud', async () => {
      const realApp: FarmerSchemeApplication = {
        id: 'app-real-farmer-202',
        farmId: 'farm-real-202',
        schemeId: 'pm-kusum',
        status: 'draft',
        statusSource: 'user_reported',
        portalUrl: 'https://pmkusum.mnre.gov.in',
        nextAction: 'Upload 7/12',
        documentsStatus: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isDemo: false,
      };

      // Unauthenticated call (no authToken)
      const unauthResult = await syncToSupabase(
        { applications: [realApp] },
        {
          overrides: {
            url: 'https://mock.supabase.co',
            anonKey: MOCK_VALID_JWT,
          },
        }
      );

      expect(unauthResult.success).toBe(true);
      expect(unauthResult.syncedCount).toBe(0);
      expect(unauthResult.isOffline).toBe(true);
      expect(unauthResult.message).toContain('authenticated farmer session');
    });

    it('successfully pushes real farmer records when authenticated session token is provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
      });
      vi.stubGlobal('fetch', mockFetch);

      const realApp: FarmerSchemeApplication = {
        id: 'app-real-farmer-303',
        farmId: 'farm-real-303',
        schemeId: 'pm-kisan',
        status: 'submitted',
        statusSource: 'user_reported',
        portalUrl: 'https://pmkisan.gov.in',
        nextAction: 'Check status',
        documentsStatus: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isDemo: false,
      };

      const result = await syncToSupabase(
        { applications: [realApp] },
        {
          authToken: 'valid.farmer.bearer.jwt',
          overrides: {
            url: 'https://mock.supabase.co',
            anonKey: MOCK_VALID_JWT,
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(1);
      expect(result.isOffline).toBe(false);
      expect(result.message).toContain('Successfully synchronized 1 real farmer record');
    });
  });

  // =========================================================================
  // 5. RLS Ownership Isolation
  // =========================================================================
  describe('5. Row Level Security (RLS) Ownership Isolation', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20261122_government_assistance.sql'
    );

    it('enforces auth.uid() = farmer_id across all user data tables in DDL', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');

      // Check farmer_scheme_applications RLS
      expect(sql).toContain('ALTER TABLE farmer_scheme_applications ENABLE ROW LEVEL SECURITY;');
      expect(sql).toMatch(/CREATE POLICY "Farmers can view their own applications"[\s\S]*?auth\.uid\(\) = farmer_id/i);
      expect(sql).toMatch(/CREATE POLICY "Farmers can insert their own applications"[\s\S]*?WITH CHECK \(auth\.uid\(\) = farmer_id\)/i);
      expect(sql).toMatch(/CREATE POLICY "Farmers can update their own applications"[\s\S]*?auth\.uid\(\) = farmer_id/i);
      expect(sql).toMatch(/CREATE POLICY "Farmers can delete their own applications"[\s\S]*?auth\.uid\(\) = farmer_id/i);

      // Check scheme_reminders RLS
      expect(sql).toContain('ALTER TABLE scheme_reminders ENABLE ROW LEVEL SECURITY;');
      expect(sql).toMatch(/CREATE POLICY "Farmers can view their own reminders"[\s\S]*?auth\.uid\(\) = farmer_id/i);

      // Check farmer_scheme_assessments RLS
      expect(sql).toContain('ALTER TABLE farmer_scheme_assessments ENABLE ROW LEVEL SECURITY;');
      expect(sql).toMatch(/CREATE POLICY "Farmers can view their own assessments"[\s\S]*?auth\.uid\(\) = farmer_id/i);
    });

    it('permits public read access for official scheme catalog', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toContain('ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;');
      expect(sql).toMatch(/CREATE POLICY "Public read access for verified schemes"[\s\S]*?FOR SELECT[\s\S]*?USING \(true\)/i);
    });
  });

  // =========================================================================
  // 6. Offline Fallback
  // =========================================================================
  describe('6. Offline Fallback Resilience', () => {
    it('syncFromSupabase returns graceful offline payload when remote server returns error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline or DNS resolution failed'));
      vi.stubGlobal('fetch', mockFetch);

      const result = await syncFromSupabase('farm-demo-01', {
        overrides: {
          url: 'https://mock.supabase.co',
          anonKey: MOCK_VALID_JWT,
        },
      });

      expect(result.success).toBe(false);
      expect(result.isOffline).toBe(true);
      expect(result.applications).toEqual([]);
      expect(result.message).toContain('Using local data');
    });
  });

  // =========================================================================
  // 7. Network Failure Handling
  // =========================================================================
  describe('7. Network Failure & Error Trapping', () => {
    it('checkSupabaseHealth traps fetch rejection and returns online: false without throwing', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      vi.stubGlobal('fetch', mockFetch);

      const health = await checkSupabaseHealth({
        url: 'https://mock.supabase.co',
        anonKey: MOCK_VALID_JWT,
      });

      expect(health.online).toBe(false);
      expect(health.authGatewayReady).toBe(false);
      expect(health.message).toContain('Failed to connect');
    });

    it('syncToSupabase traps HTTP 500 server error and protects local data', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      vi.stubGlobal('fetch', mockFetch);

      const realApp: FarmerSchemeApplication = {
        id: 'app-fail-500',
        farmId: 'farm-500',
        schemeId: 'pm-kisan',
        status: 'submitted',
        statusSource: 'user_reported',
        portalUrl: 'https://pmkisan.gov.in',
        nextAction: 'Retry',
        documentsStatus: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isDemo: false,
      };

      const result = await syncToSupabase(
        { applications: [realApp] },
        {
          authToken: 'farmer.token',
          overrides: { url: 'https://mock.supabase.co', anonKey: MOCK_VALID_JWT },
        }
      );

      expect(result.success).toBe(false);
      expect(result.isOffline).toBe(true);
      expect(result.message).toContain('Cloud sync encountered an issue');
      expect(result.message).toContain('Local copy is safe');
    });
  });

  // =========================================================================
  // 8. Sync Conflict Resolution
  // =========================================================================
  describe('8. Sync Conflict Detection & Resolution', () => {
    it('resolves conflicting updates using Last-Write-Wins based on ISO timestamps', () => {
      const localApps: FarmerSchemeApplication[] = [
        {
          id: 'app-conflict-01',
          farmId: 'farm-01',
          schemeId: 'pm-kisan',
          status: 'ready_to_apply',
          statusSource: 'user_reported',
          portalUrl: 'https://pmkisan.gov.in',
          nextAction: 'Local update action',
          documentsStatus: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-03-01T12:00:00.000Z', // Local is newer
        },
      ];

      const remoteApps: FarmerSchemeApplication[] = [
        {
          id: 'app-conflict-01',
          farmId: 'farm-01',
          schemeId: 'pm-kisan',
          status: 'draft',
          statusSource: 'user_reported',
          portalUrl: 'https://pmkisan.gov.in',
          nextAction: 'Old remote action',
          documentsStatus: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-02-28T12:00:00.000Z', // Remote is older
        },
        {
          id: 'app-conflict-02',
          farmId: 'farm-01',
          schemeId: 'pmfby',
          status: 'submitted',
          statusSource: 'user_reported',
          portalUrl: 'https://pmfby.gov.in',
          nextAction: 'Remote new app',
          documentsStatus: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-03-01T10:00:00.000Z',
        },
      ];

      const { merged, conflictsResolved } = resolveApplicationConflicts(localApps, remoteApps);

      expect(conflictsResolved).toBe(1);
      expect(merged.length).toBe(2);

      const resolvedApp1 = merged.find((a) => a.id === 'app-conflict-01');
      expect(resolvedApp1?.status).toBe('ready_to_apply'); // Local won
      expect(resolvedApp1?.nextAction).toBe('Local update action');
    });

    it('allows newer remote record to overwrite older local record', () => {
      const localApps: FarmerSchemeApplication[] = [
        {
          id: 'app-conflict-02',
          farmId: 'farm-01',
          schemeId: 'pm-kisan',
          status: 'submitted',
          statusSource: 'user_reported',
          portalUrl: 'https://pmkisan.gov.in',
          nextAction: 'Old local action',
          documentsStatus: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-02-15T08:00:00.000Z', // Local is older
        },
      ];

      const remoteApps: FarmerSchemeApplication[] = [
        {
          id: 'app-conflict-02',
          farmId: 'farm-01',
          schemeId: 'pm-kisan',
          status: 'under_review',
          statusSource: 'government_verified',
          portalUrl: 'https://pmkisan.gov.in',
          nextAction: 'Official portal verification updated',
          documentsStatus: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-02-20T10:00:00.000Z', // Remote is newer
        },
      ];

      const { merged, conflictsResolved } = resolveApplicationConflicts(localApps, remoteApps);

      expect(conflictsResolved).toBe(1);
      const resolved = merged.find((a) => a.id === 'app-conflict-02');
      expect(resolved?.status).toBe('under_review'); // Remote won
      expect(resolved?.statusSource).toBe('government_verified');
    });
  });

  // =========================================================================
  // 9. Recovery After Reconnection
  // =========================================================================
  describe('9. Recovery After Reconnection', () => {
    it('verifies connection health before triggering reconciliation sync', async () => {
      // Mock health check passing
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/v1/health')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ version: 'v2.198.0' }),
          });
        }
        if (url.includes('/rest/v1/schemes')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [{ id: 'pm-kisan' }],
          });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });
      vi.stubGlobal('fetch', mockFetch);

      const recovery = await recoverAndSync(
        {
          applications: [
            {
              id: 'app-recovered-01',
              farmId: 'farm-rec-01',
              schemeId: 'pm-kisan',
              status: 'submitted',
              statusSource: 'user_reported',
              portalUrl: 'https://pmkisan.gov.in',
              nextAction: 'Post-recovery sync',
              documentsStatus: {},
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              isDemo: false,
            },
          ],
        },
        {
          authToken: 'valid.token',
          overrides: {
            url: 'https://paovnrbsbkoxunwashon.supabase.co',
            anonKey: MOCK_VALID_JWT,
          },
        }
      );

      expect(recovery.recovered).toBe(true);
      expect(recovery.syncedCount).toBe(1);
      expect(recovery.message).toContain('Successfully synchronized');
    });

    it('safely aborts recovery and reports failure if health check fails', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Gateway still offline'));
      vi.stubGlobal('fetch', mockFetch);

      const recovery = await recoverAndSync(
        { applications: [] },
        {
          overrides: {
            url: 'https://mock.supabase.co',
            anonKey: MOCK_VALID_JWT,
          },
        }
      );

      expect(recovery.recovered).toBe(false);
      expect(recovery.syncedCount).toBe(0);
      expect(recovery.message).toContain('Reconnection check failed');
      expect(recovery.message).toContain('LocalStorage continues as primary store');
    });
  });
});
