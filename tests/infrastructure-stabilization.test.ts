/**
 * AgriDOST 4.0: Infrastructure Stabilization & Auditing Integration Suite
 *
 * Verifies:
 * 1. Gemini candidate model cascade, active model IDs, and graceful 503/429/404 failovers.
 * 2. Persistent Telegram consent storage with Supabase, opt-in/opt-out persistence, and offline fallback.
 * 3. Supabase migration audit: schema consistency, RLS (select auth.uid()), foreign keys, indexes, and grants.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// AI Gemini Client & Candidates
import {
  DEFAULT_GEMINI_CANDIDATES,
  callGeminiWithFailover,
  sanitizeErrorMessage,
} from '@/lib/ai/client';

// Telegram Consent Manager & Persistence
import {
  FarmerConsentRecord,
  SupportedLanguage,
} from '@/types/telegram';
import {
  registerConsent,
  revokeConsent,
  hasConsent,
  getConsentByFarmerId,
  clearConsentStore,
  persistConsentToSupabase,
  loadConsentFromSupabase,
  syncConsentsWithSupabase,
  handleWebhookCommand,
} from '@/lib/telegram/consent';

// Mock GoogleGenAI for AI cascade tests
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: mockGenerateContent,
      };
      constructor(public options?: Record<string, unknown>) {}
    },
  };
});

describe('AgriDOST 4.0: Infrastructure Stabilization & Auditing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    clearConsentStore();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    clearConsentStore();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. GEMINI MODEL CASCADE & AVAILABILITY HANDLING
  // =========================================================================
  describe('1. Gemini Model Cascade & Availability Handling', () => {
    it('DEFAULT_GEMINI_CANDIDATES contains verified active models in optimal cascade order', () => {
      expect(DEFAULT_GEMINI_CANDIDATES).toEqual([
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
        'gemini-3-flash-preview',
        'gemini-flash-lite-latest',
      ]);
    });

    it('cascades immediately on HTTP 503 (demand spike) without wasting retry attempts on the overloaded model', async () => {
      process.env.GEMINI_API_KEY = 'test-key-infra-503';

      mockGenerateContent
        .mockRejectedValueOnce(new Error('503 Service Unavailable: This model is currently experiencing high demand.'))
        .mockResolvedValueOnce({
          text: JSON.stringify({ status: 'ok', diagnosis: 'Healthy foliage' }),
        });

      const result = await callGeminiWithFailover('Analyze leaf', {
        candidateModels: DEFAULT_GEMINI_CANDIDATES,
        maxRetries: 2, // Even with maxRetries=2, 503 must cascade immediately
        backoffBaseMs: 10,
      });

      expect(result.model).toBe('gemini-3.1-flash-lite');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(result.attempts[0].model).toBe('gemini-3.8-flash');
      expect(result.attempts[0].status).toBe('error');
      expect(result.attempts[1].model).toBe('gemini-3.1-flash-lite');
      expect(result.attempts[1].status).toBe('success');
    });

    it('cascades immediately on HTTP 404 (unavailable or deprecated model) to next candidate', async () => {
      process.env.GEMINI_API_KEY = 'test-key-infra-404';

      mockGenerateContent
        .mockRejectedValueOnce(new Error('404 Not Found: models/deprecated-model is not found for API version v1beta.'))
        .mockResolvedValueOnce({
          text: JSON.stringify({ status: 'ok' }),
        });

      const result = await callGeminiWithFailover('Prompt', {
        candidateModels: ['deprecated-model', 'gemini-3.1-flash-lite'],
        maxRetries: 2,
        backoffBaseMs: 10,
      });

      expect(result.model).toBe('gemini-3.1-flash-lite');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(result.attempts[0].status).toBe('error');
      expect(result.attempts[1].status).toBe('success');
    });

    it('performs exponential backoff retry on HTTP 429 rate limits before cascading', async () => {
      process.env.GEMINI_API_KEY = 'test-key-infra-429';

      mockGenerateContent
        .mockRejectedValueOnce(new Error('429 ResourceExhausted: rate limit exceeded'))
        .mockResolvedValueOnce({
          text: JSON.stringify({ status: 'success after retry' }),
        });

      const result = await callGeminiWithFailover('Prompt', {
        candidateModels: ['gemini-3.8-flash'],
        maxRetries: 1,
        backoffBaseMs: 5,
      });

      expect(result.model).toBe('gemini-3.8-flash');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(result.attempts[0].status).toBe('error');
      expect(result.attempts[1].status).toBe('success');
    });

    it('redacts API keys and secrets in all sanitized error messages', () => {
      const sensitiveErr = 'API call failed with key AIzaSyD99999999999999999999999999999999 on endpoint';
      const sanitized = sanitizeErrorMessage(sensitiveErr, 'AIzaSyD99999999999999999999999999999999');
      expect(sanitized).not.toContain('AIzaSyD99999999999999999999999999999999');
      expect(sanitized).toContain('[REDACTED_API_KEY]');
    });
  });

  // =========================================================================
  // 2. PERSISTENT TELEGRAM CONSENT WITH SUPABASE
  // =========================================================================
  describe('2. Persistent Telegram Consent with Supabase', () => {
    const VALID_ANON_KEY =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-anon-payload-token.signature12345';

    it('persistConsentToSupabase reports offline gracefully when Supabase is unconfigured', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const record: FarmerConsentRecord = {
        farmerId: 'farmer-offline-test',
        chatId: 987654321,
        optInStatus: true,
        consentTimestamp: new Date().toISOString(),
        languagePreference: 'hi',
      };

      const result = await persistConsentToSupabase(record);
      expect(result.success).toBe(true);
      expect(result.isOffline).toBe(true);
      expect(result.message).toContain('Supabase unconfigured');
    });

    it('persistConsentToSupabase formats REST payload with farmer_telegram_registrations table and upsert header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      const record: FarmerConsentRecord = {
        farmerId: 'farmer-mh-01',
        chatId: 123456789,
        username: 'kisan_user',
        optInStatus: true,
        consentTimestamp: '2026-11-22T10:00:00Z',
        languagePreference: 'mr',
        metadata: { source: 'telegram_bot' },
      };

      const result = await persistConsentToSupabase(record, {
        overrides: {
          url: 'https://test-project.supabase.co',
          anonKey: VALID_ANON_KEY,
        },
      });

      expect(result.success).toBe(true);
      expect(result.isOffline).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe('https://test-project.supabase.co/rest/v1/farmer_telegram_registrations');
      expect(calledOptions.method).toBe('POST');
      expect(calledOptions.headers['Prefer']).toBe('resolution=merge-duplicates');

      const body = JSON.parse(calledOptions.body);
      expect(body.farmer_id).toBe('farmer-mh-01');
      expect(body.chat_id).toBe(123456789);
      expect(body.opt_in_status).toBe(true);
      expect(body.language_preference).toBe('mr');
    });

    it('loadConsentFromSupabase fetches from Supabase and populates local in-memory store', async () => {
      const mockRemoteRow = {
        id: '99999999-9999-9999-9999-999999999999',
        farmer_id: 'farmer-remote-01',
        chat_id: 88888888,
        username: 'remote_kisan',
        opt_in_status: true,
        language_preference: 'hi',
        consent_timestamp: '2026-11-20T12:00:00Z',
        revoked_timestamp: null,
        metadata: { region: 'Nashik' },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [mockRemoteRow],
      });
      vi.stubGlobal('fetch', mockFetch);

      expect(hasConsent('farmer-remote-01')).toBe(false);

      const loaded = await loadConsentFromSupabase('farmer-remote-01', {
        overrides: {
          url: 'https://test-project.supabase.co',
          anonKey: VALID_ANON_KEY,
        },
      });

      expect(loaded).not.toBeNull();
      expect(loaded?.farmerId).toBe('farmer-remote-01');
      expect(loaded?.chatId).toBe(88888888);
      expect(loaded?.optInStatus).toBe(true);

      // Verified cached in local memory
      expect(hasConsent('farmer-remote-01')).toBe(true);
    });

    it('syncConsentsWithSupabase synchronizes multiple cloud registrations into memory', async () => {
      const mockRemoteRows = [
        {
          farmer_id: 'farmer-sync-1',
          chat_id: 11111,
          opt_in_status: true,
          language_preference: 'hi',
          consent_timestamp: '2026-11-21T00:00:00Z',
        },
        {
          farmer_id: 'farmer-sync-2',
          chat_id: 22222,
          opt_in_status: false,
          language_preference: 'en',
          consent_timestamp: '2026-11-21T00:00:00Z',
          revoked_timestamp: '2026-11-22T00:00:00Z',
        },
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRemoteRows,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await syncConsentsWithSupabase({
        overrides: {
          url: 'https://test-project.supabase.co',
          anonKey: VALID_ANON_KEY,
        },
      });

      expect(result.synced).toBe(2);
      expect(result.isOffline).toBe(false);
      expect(hasConsent('farmer-sync-1')).toBe(true);
      expect(hasConsent('farmer-sync-2')).toBe(false);
    });

    it('preserves synchronous opt-in and opt-out commands while persisting to Supabase', () => {
      const registered = registerConsent({
        farmerId: 'farmer-sync-preserve',
        chatId: 55555,
        languagePreference: 'hi',
      });
      expect(registered.optInStatus).toBe(true);
      expect(hasConsent('farmer-sync-preserve')).toBe(true);

      const revoked = revokeConsent({ farmerId: 'farmer-sync-preserve' });
      expect(revoked).toBe(true);
      expect(hasConsent('farmer-sync-preserve')).toBe(false);

      const postRevocationRecord = getConsentByFarmerId('farmer-sync-preserve');
      expect(postRevocationRecord?.optInStatus).toBe(false);
      expect(postRevocationRecord?.revokedTimestamp).toBeDefined();
    });

    it('handleWebhookCommand /start and /stop commands return record ready for Supabase persistence', () => {
      const fromUser = { id: 77777, is_bot: false, first_name: 'Ramesh', username: 'ramesh_k' };
      const chat = { id: 77777, type: 'private' as const };

      // /start
      const startResult = handleWebhookCommand('/start farmer-ramesh-01', fromUser, chat);
      expect(startResult.handled).toBe(true);
      expect(startResult.action).toBe('opt_in');
      expect(startResult.record?.farmerId).toBe('farmer-ramesh-01');
      expect(startResult.record?.optInStatus).toBe(true);

      // /stop
      const stopResult = handleWebhookCommand('/stop', fromUser, chat);
      expect(stopResult.handled).toBe(true);
      expect(stopResult.action).toBe('opt_out');
      expect(stopResult.record?.optInStatus).toBe(false);
      expect(stopResult.record?.revokedTimestamp).toBeDefined();
    });
  });

  // =========================================================================
  // 3. SUPABASE SCHEMA & MIGRATION AUDIT VERIFICATION
  // =========================================================================
  describe('3. Supabase Schema & Migration Audit Verification', () => {
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20261122_agridost_core.sql');
    let migrationSql: string;

    beforeEach(() => {
      migrationSql = fs.readFileSync(migrationPath, 'utf8');
    });

    it('migration file exists and contains valid PostgreSQL migration content', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      expect(migrationSql.length).toBeGreaterThan(10000);
    });

    it('farmer_profiles.id uses coalesce(auth.uid(), gen_random_uuid()) for safe offline/service migration', () => {
      expect(migrationSql).toMatch(
        /CREATE TABLE IF NOT EXISTS farmer_profiles\s*\(\s*id UUID PRIMARY KEY DEFAULT coalesce\(auth\.uid\(\),\s*gen_random_uuid\(\)\)/i
      );
    });

    it('includes dedicated farmer_telegram_registrations table with required schema and constraints', () => {
      expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS farmer_telegram_registrations');
      expect(migrationSql).toContain('farmer_id TEXT NOT NULL UNIQUE');
      expect(migrationSql).toContain('chat_id BIGINT NOT NULL');
      expect(migrationSql).toContain('opt_in_status BOOLEAN NOT NULL DEFAULT true');
      expect(migrationSql).toContain("language_preference TEXT NOT NULL DEFAULT 'hi' CHECK (language_preference IN ('en', 'hi', 'mr'))");
      expect(migrationSql).toContain('consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()');
      expect(migrationSql).toContain('revoked_timestamp TIMESTAMPTZ');
    });

    it('defines updated_at trigger for farmer_telegram_registrations', () => {
      expect(migrationSql).toContain('trigger_farmer_telegram_registrations_updated_at');
      expect(migrationSql).toContain('BEFORE UPDATE ON farmer_telegram_registrations');
    });

    it('creates performance indexes for telegram farmer_id and chat_id', () => {
      expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS idx_telegram_farmer_id ON farmer_telegram_registrations(farmer_id)');
      expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS idx_telegram_chat_id ON farmer_telegram_registrations(chat_id)');
    });

    it('enables Row Level Security on farmer_telegram_registrations and all core tables', () => {
      expect(migrationSql).toContain('ALTER TABLE farmer_telegram_registrations ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE farms ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE farm_zones ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE crop_plans ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE farm_tasks ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE farm_supplies ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE tree_plans ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE spray_operations ENABLE ROW LEVEL SECURITY;');
    });

    it('applies tenant-isolated RLS policies on farmer_telegram_registrations using (select auth.uid())::text', () => {
      expect(migrationSql).toContain('CREATE POLICY "Farmers can view own telegram registration"');
      expect(migrationSql).toContain('CREATE POLICY "Farmers can insert own telegram registration"');
      expect(migrationSql).toContain('CREATE POLICY "Farmers can update own telegram registration"');
      expect(migrationSql).toContain('CREATE POLICY "Farmers can delete own telegram registration"');
      expect(migrationSql).toMatch(/\(select auth\.uid\(\)\)::text\s*=\s*farmer_id/);
    });

    it('applies (select auth.uid()) InitPlan subquery optimization across all domain table RLS policies', () => {
      const selectAuthMatches = migrationSql.match(/\(select auth\.uid\(\)\)/g);
      expect(selectAuthMatches).not.toBeNull();
      expect(selectAuthMatches!.length).toBeGreaterThanOrEqual(25);
    });

    it('enforces cascading foreign keys ON DELETE CASCADE for all farm parcels and records', () => {
      expect(migrationSql).toContain('REFERENCES farms(id) ON DELETE CASCADE');
      expect(migrationSql).toContain('REFERENCES farm_zones(id) ON DELETE SET NULL');
    });

    it('grants explicit schema permissions for authenticated, service_role, and anon roles', () => {
      expect(migrationSql).toContain('GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;');
      expect(migrationSql).toContain('GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;');
    });
  });
});
