/**
 * tests/schemes-storage-rls.test.ts
 *
 * Comprehensive Test Suite for AgriDOST:
 * 1. Supabase PostgreSQL Migration, Schema & RLS Verification
 * 2. Offline-First LocalStorage Scheme Repository (Applications & Reminders)
 * 3. Lifecycle Transitions, Event Dispatching & Filtering
 * 4. Automated Default Reminders Generation
 * 5. Supabase Client & Honest Offline Synchronization Reporting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  FarmerSchemeApplication,
  SchemeReminder,
  SchemeApplicationStatus,
} from '@/types';
import {
  getApplications,
  getApplicationById,
  saveApplication,
  updateApplicationStatus,
  deleteApplication,
  getReminders,
  saveReminder,
  toggleReminder,
  deleteReminder,
  createDefaultRemindersForApplication,
  resetSchemeStorageToDemo,
  SCHEME_STORAGE_KEYS,
  getSupabaseConfigStatus,
  isSupabaseConfigured,
  checkSupabaseHealth,
  syncToSupabase,
  syncFromSupabase,
} from '@/lib/supabase';

// ==============================================================================
// In-Memory Storage Mock for Test Isolation
// ==============================================================================
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

describe('1. Supabase SQL Migration & Row Level Security (RLS) Verification', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261122_government_assistance.sql'
  );

  it('migration file exists and is non-empty', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const content = fs.readFileSync(migrationPath, 'utf8');
    expect(content.length).toBeGreaterThan(500);
  });

  it('defines all 5 required tables', () => {
    const content = fs.readFileSync(migrationPath, 'utf8');
    expect(content).toMatch(/CREATE TABLE IF NOT EXISTS schemes/i);
    expect(content).toMatch(/CREATE TABLE IF NOT EXISTS scheme_sources/i);
    expect(content).toMatch(/CREATE TABLE IF NOT EXISTS farmer_scheme_applications/i);
    expect(content).toMatch(/CREATE TABLE IF NOT EXISTS farmer_scheme_assessments/i);
    expect(content).toMatch(/CREATE TABLE IF NOT EXISTS scheme_reminders/i);
  });

  it('enables Row Level Security (RLS) on all 5 tables', () => {
    const content = fs.readFileSync(migrationPath, 'utf8');
    expect(content).toMatch(/ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;/i);
    expect(content).toMatch(/ALTER TABLE scheme_sources ENABLE ROW LEVEL SECURITY;/i);
    expect(content).toMatch(/ALTER TABLE farmer_scheme_applications ENABLE ROW LEVEL SECURITY;/i);
    expect(content).toMatch(/ALTER TABLE farmer_scheme_assessments ENABLE ROW LEVEL SECURITY;/i);
    expect(content).toMatch(/ALTER TABLE scheme_reminders ENABLE ROW LEVEL SECURITY;/i);
  });

  it('enforces strict farmer isolation policies (auth.uid() = farmer_id) for user data', () => {
    const content = fs.readFileSync(migrationPath, 'utf8');

    // Applications policies
    expect(content).toMatch(/ON farmer_scheme_applications[\s\S]*?FOR SELECT[\s\S]*?auth\.uid\(\) = farmer_id/i);
    expect(content).toMatch(/ON farmer_scheme_applications[\s\S]*?FOR INSERT[\s\S]*?auth\.uid\(\) = farmer_id/i);
    expect(content).toMatch(/ON farmer_scheme_applications[\s\S]*?FOR UPDATE[\s\S]*?auth\.uid\(\) = farmer_id/i);
    expect(content).toMatch(/ON farmer_scheme_applications[\s\S]*?FOR DELETE[\s\S]*?auth\.uid\(\) = farmer_id/i);

    // Assessments policies
    expect(content).toMatch(/ON farmer_scheme_assessments[\s\S]*?FOR SELECT[\s\S]*?auth\.uid\(\) = farmer_id/i);
    expect(content).toMatch(/ON farmer_scheme_assessments[\s\S]*?FOR INSERT[\s\S]*?auth\.uid\(\) = farmer_id/i);
    expect(content).toMatch(/ON farmer_scheme_assessments[\s\S]*?FOR UPDATE[\s\S]*?auth\.uid\(\) = farmer_id/i);
    expect(content).toMatch(/ON farmer_scheme_assessments[\s\S]*?FOR DELETE[\s\S]*?auth\.uid\(\) = farmer_id/i);

    // Reminders policies
    expect(content).toMatch(/ON scheme_reminders[\s\S]*?FOR SELECT[\s\S]*?auth\.uid\(\) = farmer_id/i);
    expect(content).toMatch(/ON scheme_reminders[\s\S]*?FOR INSERT[\s\S]*?auth\.uid\(\) = farmer_id/i);
    expect(content).toMatch(/ON scheme_reminders[\s\S]*?FOR UPDATE[\s\S]*?auth\.uid\(\) = farmer_id/i);
    expect(content).toMatch(/ON scheme_reminders[\s\S]*?FOR DELETE[\s\S]*?auth\.uid\(\) = farmer_id/i);
  });

  it('configures public read access for schemes and scheme_sources catalog', () => {
    const content = fs.readFileSync(migrationPath, 'utf8');
    expect(content).toMatch(/CREATE POLICY "Public read access for verified schemes"[\s\S]*?ON schemes[\s\S]*?FOR SELECT[\s\S]*?USING \(true\);/i);
    expect(content).toMatch(/CREATE POLICY "Public read access for verified scheme sources"[\s\S]*?ON scheme_sources[\s\S]*?FOR SELECT[\s\S]*?USING \(true\);/i);
  });

  it('defines performance indexes on farm_id, farmer_id, scheme_id, and due_date', () => {
    const content = fs.readFileSync(migrationPath, 'utf8');
    expect(content).toMatch(/INDEX IF NOT EXISTS idx_farmer_scheme_applications_farm_id ON farmer_scheme_applications\(farm_id\)/i);
    expect(content).toMatch(/INDEX IF NOT EXISTS idx_farmer_scheme_applications_farmer_id ON farmer_scheme_applications\(farmer_id\)/i);
    expect(content).toMatch(/INDEX IF NOT EXISTS idx_farmer_scheme_applications_scheme_id ON farmer_scheme_applications\(scheme_id\)/i);
    expect(content).toMatch(/INDEX IF NOT EXISTS idx_farmer_scheme_assessments_farm_id ON farmer_scheme_assessments\(farm_id\)/i);
    expect(content).toMatch(/INDEX IF NOT EXISTS idx_scheme_reminders_farm_id ON scheme_reminders\(farm_id\)/i);
    expect(content).toMatch(/INDEX IF NOT EXISTS idx_scheme_reminders_farmer_id ON scheme_reminders\(farmer_id\)/i);
    expect(content).toMatch(/INDEX IF NOT EXISTS idx_scheme_reminders_due_date ON scheme_reminders\(due_date\)/i);
    expect(content).toMatch(/INDEX IF NOT EXISTS idx_scheme_reminders_scheme_id ON scheme_reminders\(scheme_id\)/i);
  });

  it('seeds initial verified schemes data into migration', () => {
    const content = fs.readFileSync(migrationPath, 'utf8');
    expect(content).toContain('pm-kisan');
    expect(content).toContain('pmfby');
    expect(content).toContain('pm-kusum');
    expect(content).toContain('source-pm-kisan-portal');
  });
});

describe('2. Offline-First Scheme Applications Repository', () => {
  let mockStorage: MockLocalStorage;
  let dispatchedEvents: string[] = [];

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    dispatchedEvents = [];

    // Setup global window and localStorage mock
    const mockWindow = {
      localStorage: mockStorage,
      dispatchEvent: (event: CustomEvent) => {
        dispatchedEvents.push(event.detail?.key || event.type);
        return true;
      },
    };
    vi.stubGlobal('window', mockWindow);
    resetSchemeStorageToDemo();
  });

  it('initializes repository with pre-populated demo applications', () => {
    const apps = getApplications();
    expect(apps.length).toBeGreaterThanOrEqual(3);

    const pmKisan = apps.find((a) => a.schemeId === 'pm-kisan');
    expect(pmKisan).toBeDefined();
    expect(pmKisan?.status).toBe('approved');
    expect(pmKisan?.statusSource).toBe('government_verified');
    expect(pmKisan?.applicationReferenceNumber).toBe('PMK-MH-2024-98412');
  });

  it('filters applications by farmId correctly', () => {
    const farm1Apps = getApplications('demo-farm-01');
    const farm2Apps = getApplications('demo-farm-02');

    expect(farm1Apps.every((a) => a.farmId === 'demo-farm-01')).toBe(true);
    expect(farm2Apps.every((a) => a.farmId === 'demo-farm-02')).toBe(true);
    expect(farm1Apps.length).toBeGreaterThan(0);
    expect(farm2Apps.length).toBeGreaterThan(0);
  });

  it('retrieves single application by ID', () => {
    const app = getApplicationById('app-demo-pmkisan-01');
    expect(app).toBeDefined();
    expect(app?.id).toBe('app-demo-pmkisan-01');

    const notFound = getApplicationById('non-existent-id');
    expect(notFound).toBeUndefined();
  });

  it('saves new application and dispatches agridost:data-changed event', () => {
    const newApp: FarmerSchemeApplication = {
      id: 'app-test-new-01',
      farmId: 'demo-farm-01',
      schemeId: 'soil-health-card',
      status: 'ready_to_apply',
      statusSource: 'user_reported',
      portalUrl: 'https://soilhealth.dac.gov.in/',
      nextAction: 'Submit soil sample at nearest KVK',
      documentsStatus: { aadhaar: 'available' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveApplication(newApp);

    const retrieved = getApplicationById('app-test-new-01');
    expect(retrieved).toBeDefined();
    expect(retrieved?.schemeId).toBe('soil-health-card');
    expect(retrieved?.status).toBe('ready_to_apply');
    expect(dispatchedEvents).toContain(SCHEME_STORAGE_KEYS.APPLICATIONS);
  });

  it('transitions application status, reference number, and next action', () => {
    const updated = updateApplicationStatus(
      'app-demo-pmkusum-01',
      'submitted',
      'Awaiting state nodal agency scrutiny',
      'KUSUM-MH-2026-902'
    );

    expect(updated).toBeDefined();
    expect(updated?.status).toBe('submitted');
    expect(updated?.nextAction).toBe('Awaiting state nodal agency scrutiny');
    expect(updated?.applicationReferenceNumber).toBe('KUSUM-MH-2026-902');

    const reloaded = getApplicationById('app-demo-pmkusum-01');
    expect(reloaded?.status).toBe('submitted');
  });

  it('deletes application and returns boolean confirmation', () => {
    const existsBefore = getApplicationById('app-demo-pmfby-01');
    expect(existsBefore).toBeDefined();

    const result = deleteApplication('app-demo-pmfby-01');
    expect(result).toBe(true);

    const existsAfter = getApplicationById('app-demo-pmfby-01');
    expect(existsAfter).toBeUndefined();

    // Deleting again should return false
    const deleteAgain = deleteApplication('app-demo-pmfby-01');
    expect(deleteAgain).toBe(false);
  });
});

describe('3. Offline-First Scheme Reminders Repository', () => {
  beforeEach(() => {
    const mockStorage = new MockLocalStorage();
    const mockWindow = {
      localStorage: mockStorage,
      dispatchEvent: () => true,
    };
    vi.stubGlobal('window', mockWindow);
    resetSchemeStorageToDemo();
  });

  it('initializes repository with pre-populated demo reminders', () => {
    const reminders = getReminders();
    expect(reminders.length).toBeGreaterThanOrEqual(3);

    const pmfbyReminder = reminders.find((r) => r.schemeId === 'pmfby');
    expect(pmfbyReminder).toBeDefined();
    expect(pmfbyReminder?.type).toBe('deadline');
    expect(pmfbyReminder?.isVerifiedSource).toBe(true);
  });

  it('filters reminders by farmId', () => {
    const farm1Reminders = getReminders('demo-farm-01');
    const farm2Reminders = getReminders('demo-farm-02');

    expect(farm1Reminders.every((r) => r.farmId === 'demo-farm-01')).toBe(true);
    expect(farm2Reminders.every((r) => r.farmId === 'demo-farm-02')).toBe(true);
  });

  it('adds and persists new custom reminder', () => {
    const newRem: SchemeReminder = {
      id: 'rem-custom-test-01',
      farmId: 'demo-farm-01',
      title: 'Submit Fertilizer Subsidy Bill',
      description: 'Upload POS receipt on DBT portal',
      dueDate: '2026-05-15',
      type: 'document',
      isCompleted: false,
      isVerifiedSource: false,
      createdAt: new Date().toISOString(),
    };

    saveReminder(newRem);
    const all = getReminders('demo-farm-01');
    const found = all.find((r) => r.id === 'rem-custom-test-01');
    expect(found).toBeDefined();
    expect(found?.title).toBe('Submit Fertilizer Subsidy Bill');
  });

  it('toggles reminder completion status', () => {
    const reminders = getReminders();
    const target = reminders[0];
    const initialStatus = target.isCompleted;

    const toggled = toggleReminder(target.id);
    expect(toggled).toBe(true);

    const updatedList = getReminders();
    const updated = updatedList.find((r) => r.id === target.id);
    expect(updated?.isCompleted).toBe(!initialStatus);

    // Toggle back
    toggleReminder(target.id);
    const reverted = getReminders().find((r) => r.id === target.id);
    expect(reverted?.isCompleted).toBe(initialStatus);
  });

  it('deletes reminder by ID', () => {
    const rem = getReminders()[0];
    const deleted = deleteReminder(rem.id);
    expect(deleted).toBe(true);

    const after = getReminders().find((r) => r.id === rem.id);
    expect(after).toBeUndefined();
  });

  it('creates default reminders automatically based on scheme deadline and application status', () => {
    const app: FarmerSchemeApplication = {
      id: 'app-auto-rem-01',
      farmId: 'demo-farm-01',
      schemeId: 'pmfby',
      status: 'submitted',
      statusSource: 'user_reported',
      applicationReferenceNumber: 'PMFBY-AUTO-99',
      portalUrl: 'https://pmfby.gov.in/',
      nextAction: 'Check portal status',
      documentsStatus: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const scheme = {
      id: 'pmfby',
      name: 'Pradhan Mantri Fasal Bima Yojana',
      shortName: 'PMFBY',
      applicationDeadline: '2026-07-31T23:59:59Z',
      isDeadlineVerified: true,
      officialApplicationUrl: 'https://pmfby.gov.in/',
    };

    const created = createDefaultRemindersForApplication(app, scheme);
    expect(created.length).toBeGreaterThanOrEqual(2);

    const deadlineRem = created.find((r) => r.type === 'deadline');
    expect(deadlineRem).toBeDefined();
    expect(deadlineRem?.dueDate).toBe('2026-07-31');
    expect(deadlineRem?.isVerifiedSource).toBe(true);

    const followupRem = created.find((r) => r.type === 'followup');
    expect(followupRem).toBeDefined();
  });
});

describe('4. Supabase Client Configuration & Honest Status Reporting', () => {
  it('reports offline mode when Supabase credentials are not provided', () => {
    const status = getSupabaseConfigStatus();
    expect(status).toBeDefined();
    expect(status.mode).toBe('offline_local');
    expect(status.isConfigured).toBe(false);
    expect(status.message).toContain('offline-first LocalStorage mode');
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('health check gracefully reports unconfigured state without throwing', async () => {
    const health = await checkSupabaseHealth();
    expect(health.online).toBe(false);
    expect(health.message).toContain('offline mode');
  });

  it('syncToSupabase honestly acknowledges offline mode and preserves local state', async () => {
    const result = await syncToSupabase({
      applications: getApplications(),
      reminders: getReminders(),
    });

    expect(result.success).toBe(true);
    expect(result.isOffline).toBe(true);
    expect(result.syncedCount).toBe(0);
    expect(result.message).toContain('LocalStorage offline mode');
  });

  it('syncFromSupabase honestly reports offline local source of truth', async () => {
    const result = await syncFromSupabase('demo-farm-01');
    expect(result.success).toBe(true);
    expect(result.isOffline).toBe(true);
    expect(result.message).toContain('primary source of truth');
  });
});
