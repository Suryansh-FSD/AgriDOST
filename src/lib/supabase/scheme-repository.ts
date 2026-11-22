/**
 * AgriDOST Offline-First Government Schemes Repository
 * Backed by LocalStorage with reactive event dispatching (`agridost:data-changed`)
 * and optional Supabase cloud synchronization.
 */

import {
  FarmerSchemeApplication,
  SchemeApplicationStatus,
  StatusSource,
  SchemeReminder,
  SchemeReminderType,
  GovernmentScheme,
} from '@/types';

export const SCHEME_STORAGE_KEYS = {
  APPLICATIONS: 'agridost_scheme_applications',
  REMINDERS: 'agridost_scheme_reminders',
  INITIALIZED: 'agridost_scheme_storage_initialized_v1',
};

// ==============================================================================
// In-Memory Fallback Store (for SSR and Node test environments)
// ==============================================================================
const inMemoryStore = new Map<string, string>();

function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        return JSON.parse(item) as T;
      }
    } else {
      const item = inMemoryStore.get(key);
      if (item !== undefined) {
        return JSON.parse(item) as T;
      }
    }
  } catch (err) {
    console.warn(`[SchemeRepository] Failed to read key "${key}":`, err);
  }
  return defaultValue;
}

function setStorageItem<T>(key: string, value: T): void {
  try {
    const raw = JSON.stringify(value);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, raw);
      window.dispatchEvent(
        new CustomEvent('agridost:data-changed', {
          detail: { key },
        })
      );
    } else {
      inMemoryStore.set(key, raw);
    }
  } catch (err) {
    console.error(`[SchemeRepository] Failed to write key "${key}":`, err);
  }
}

// ==============================================================================
// Realistic Pre-Populated Demonstration Data
// ==============================================================================
export const DEMO_SCHEME_APPLICATIONS: FarmerSchemeApplication[] = [
  {
    id: 'app-demo-pmkisan-01',
    farmId: 'demo-farm-01',
    schemeId: 'pm-kisan',
    status: 'approved',
    statusSource: 'government_verified',
    applicationReferenceNumber: 'PMK-MH-2024-98412',
    submissionDate: '2024-03-15T09:30:00.000Z',
    portalUrl: 'https://pmkisan.gov.in/',
    nextAction: 'Next installment disbursal verification scheduled for April 2026',
    notes: 'eKYC completed via Aadhaar OTP on PM-KISAN portal. Land record 7/12 verified with Nashik collectorate.',
    documentsStatus: {
      aadhaar: 'available',
      land_record: 'available',
      bank_passbook: 'available',
    },
    createdAt: '2024-03-01T10:00:00.000Z',
    updatedAt: '2026-02-15T11:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'app-demo-pmfby-01',
    farmId: 'demo-farm-01',
    schemeId: 'pmfby',
    status: 'submitted',
    statusSource: 'user_reported',
    applicationReferenceNumber: 'PMFBY-2026-K-44219',
    submissionDate: '2026-02-10T14:20:00.000Z',
    portalUrl: 'https://pmfby.gov.in/',
    nextAction: 'Awaiting district insurance officer portal verification for Kharif crop coverage',
    notes: 'Premium paid through primary agricultural credit society (PACS). Sowing certificate uploaded.',
    documentsStatus: {
      sowing_certificate: 'available',
      land_possession: 'available',
      aadhaar: 'available',
      crop_survey: 'in_progress',
    },
    createdAt: '2026-02-05T08:00:00.000Z',
    updatedAt: '2026-02-10T14:20:00.000Z',
    isDemo: true,
  },
  {
    id: 'app-demo-pmkusum-01',
    farmId: 'demo-farm-01',
    schemeId: 'pm-kusum',
    status: 'preparing_documents',
    statusSource: 'user_reported',
    portalUrl: 'https://pmkusum.mnre.gov.in/',
    nextAction: 'Procure water table depth certificate from district groundwater survey department',
    notes: 'Applying for Component B: 5 HP Standalone Solar Agricultural Pump subsidy.',
    documentsStatus: {
      aadhaar: 'available',
      land_title: 'available',
      electricity_noc: 'missing',
      vendor_quotation: 'in_progress',
    },
    createdAt: '2026-01-20T11:00:00.000Z',
    updatedAt: '2026-02-18T16:45:00.000Z',
    isDemo: true,
  },
  {
    id: 'app-demo-smam-02',
    farmId: 'demo-farm-02',
    schemeId: 'smam',
    status: 'under_review',
    statusSource: 'user_reported',
    applicationReferenceNumber: 'SMAM-PB-2026-0019',
    submissionDate: '2026-01-28T10:15:00.000Z',
    portalUrl: 'https://agrimachinery.nic.in/',
    nextAction: 'Dealer quotation and physical verification scheduled by Assistant Agricultural Engineer',
    notes: 'Applied for 40% subsidy on Multi-crop Thresher and Laser Land Leveler.',
    documentsStatus: {
      aadhaar: 'available',
      bank_details: 'available',
      dealer_quotation: 'available',
      caste_certificate: 'available',
    },
    createdAt: '2026-01-15T09:00:00.000Z',
    updatedAt: '2026-02-01T12:30:00.000Z',
    isDemo: true,
  },
];

export const DEMO_SCHEME_REMINDERS: SchemeReminder[] = [
  {
    id: 'rem-demo-pmfby-deadline',
    farmId: 'demo-farm-01',
    schemeId: 'pmfby',
    title: 'PMFBY Kharif Enrollment Deadline',
    description: 'Final cutoff date for Kharif crop insurance premium debit and portal upload.',
    dueDate: '2026-07-31',
    type: 'deadline',
    isCompleted: false,
    isVerifiedSource: true,
    sourceUrl: 'https://pmfby.gov.in/',
    createdAt: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'rem-demo-pmkisan-ekyc',
    farmId: 'demo-farm-01',
    schemeId: 'pm-kisan',
    title: 'PM-KISAN Aadhaar e-KYC Verification',
    description: 'Annual Aadhaar biometric or OTP e-KYC renewal to ensure uninterrupted PFMS installment credits.',
    dueDate: '2026-03-31',
    type: 'renewal',
    isCompleted: true,
    isVerifiedSource: true,
    sourceUrl: 'https://pmkisan.gov.in/',
    createdAt: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'rem-demo-pmkusum-quotation',
    farmId: 'demo-farm-01',
    schemeId: 'pm-kusum',
    title: 'Submit Solar Pump Vendor Quotation',
    description: 'Upload MNRE-empaneled manufacturer quotation to State Nodal Agency portal.',
    dueDate: '2026-04-15',
    type: 'document',
    isCompleted: false,
    isVerifiedSource: false,
    sourceUrl: 'https://pmkusum.mnre.gov.in/',
    createdAt: '2026-01-20T11:00:00.000Z',
  },
  {
    id: 'rem-demo-smam-inspection',
    farmId: 'demo-farm-02',
    schemeId: 'smam',
    title: 'Follow up with District Agricultural Engineer',
    description: 'Verify field inspection report for machinery subsidy disbursement clearance.',
    dueDate: '2026-04-05',
    type: 'followup',
    isCompleted: false,
    isVerifiedSource: false,
    sourceUrl: 'https://agrimachinery.nic.in/',
    createdAt: '2026-01-28T10:15:00.000Z',
  },
];

/**
 * Initializes Scheme storage with demonstration data if not yet present.
 */
export function ensureSchemeStorageInitialized(): void {
  const isInit = getStorageItem<string | null>(SCHEME_STORAGE_KEYS.INITIALIZED, null);
  if (!isInit) {
    resetSchemeStorageToDemo();
  }
}

/**
 * Resets local scheme applications and reminders to initial demonstration state.
 */
export function resetSchemeStorageToDemo(): void {
  setStorageItem(SCHEME_STORAGE_KEYS.APPLICATIONS, DEMO_SCHEME_APPLICATIONS);
  setStorageItem(SCHEME_STORAGE_KEYS.REMINDERS, DEMO_SCHEME_REMINDERS);
  setStorageItem(SCHEME_STORAGE_KEYS.INITIALIZED, 'true');
}

// ==============================================================================
// Applications Repository Methods
// ==============================================================================

/**
 * Retrieve all applications, optionally filtered by farm ID.
 */
export function getApplications(farmId?: string): FarmerSchemeApplication[] {
  ensureSchemeStorageInitialized();
  const allApps = getStorageItem<FarmerSchemeApplication[]>(SCHEME_STORAGE_KEYS.APPLICATIONS, []);
  if (!farmId) {
    return allApps;
  }
  return allApps.filter((app) => app.farmId === farmId);
}

/**
 * Retrieve an individual application by its unique ID.
 */
export function getApplicationById(id: string): FarmerSchemeApplication | undefined {
  const allApps = getApplications();
  return allApps.find((app) => app.id === id);
}

/**
 * Save (insert or update) an application.
 */
export function saveApplication(app: FarmerSchemeApplication): void {
  ensureSchemeStorageInitialized();
  const allApps = getStorageItem<FarmerSchemeApplication[]>(SCHEME_STORAGE_KEYS.APPLICATIONS, []);
  const index = allApps.findIndex((a) => a.id === app.id);

  const updatedApp: FarmerSchemeApplication = {
    ...app,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    allApps[index] = updatedApp;
  } else {
    allApps.unshift(updatedApp);
  }

  setStorageItem(SCHEME_STORAGE_KEYS.APPLICATIONS, allApps);
}

/**
 * Transition the status of an existing application.
 */
export function updateApplicationStatus(
  id: string,
  status: SchemeApplicationStatus,
  nextAction?: string,
  referenceNumber?: string
): FarmerSchemeApplication | undefined {
  const app = getApplicationById(id);
  if (!app) return undefined;

  const updated: FarmerSchemeApplication = {
    ...app,
    status,
    nextAction: nextAction !== undefined ? nextAction : app.nextAction,
    applicationReferenceNumber:
      referenceNumber !== undefined ? referenceNumber : app.applicationReferenceNumber,
    updatedAt: new Date().toISOString(),
  };

  saveApplication(updated);
  return updated;
}

/**
 * Delete an application by ID.
 */
export function deleteApplication(id: string): boolean {
  ensureSchemeStorageInitialized();
  const allApps = getStorageItem<FarmerSchemeApplication[]>(SCHEME_STORAGE_KEYS.APPLICATIONS, []);
  const initialLength = allApps.length;
  const filtered = allApps.filter((a) => a.id !== id);

  if (filtered.length !== initialLength) {
    setStorageItem(SCHEME_STORAGE_KEYS.APPLICATIONS, filtered);
    return true;
  }
  return false;
}

// ==============================================================================
// Reminders Repository Methods
// ==============================================================================

/**
 * Retrieve reminders, optionally filtered by farm ID.
 */
export function getReminders(farmId?: string): SchemeReminder[] {
  ensureSchemeStorageInitialized();
  const allReminders = getStorageItem<SchemeReminder[]>(SCHEME_STORAGE_KEYS.REMINDERS, []);
  if (!farmId) {
    return allReminders;
  }
  return allReminders.filter((rem) => rem.farmId === farmId);
}

/**
 * Save (insert or update) a reminder.
 */
export function saveReminder(reminder: SchemeReminder): void {
  ensureSchemeStorageInitialized();
  const allReminders = getStorageItem<SchemeReminder[]>(SCHEME_STORAGE_KEYS.REMINDERS, []);
  const index = allReminders.findIndex((r) => r.id === reminder.id);

  if (index >= 0) {
    allReminders[index] = reminder;
  } else {
    allReminders.unshift(reminder);
  }

  setStorageItem(SCHEME_STORAGE_KEYS.REMINDERS, allReminders);
}

/**
 * Toggle the completion status of a reminder.
 */
export function toggleReminder(id: string): boolean {
  ensureSchemeStorageInitialized();
  const allReminders = getStorageItem<SchemeReminder[]>(SCHEME_STORAGE_KEYS.REMINDERS, []);
  const reminder = allReminders.find((r) => r.id === id);

  if (reminder) {
    reminder.isCompleted = !reminder.isCompleted;
    setStorageItem(SCHEME_STORAGE_KEYS.REMINDERS, allReminders);
    return true;
  }
  return false;
}

/**
 * Delete a reminder by ID.
 */
export function deleteReminder(id: string): boolean {
  ensureSchemeStorageInitialized();
  const allReminders = getStorageItem<SchemeReminder[]>(SCHEME_STORAGE_KEYS.REMINDERS, []);
  const initialLength = allReminders.length;
  const filtered = allReminders.filter((r) => r.id !== id);

  if (filtered.length !== initialLength) {
    setStorageItem(SCHEME_STORAGE_KEYS.REMINDERS, filtered);
    return true;
  }
  return false;
}

/**
 * Automatically generate standard reminders for an application based on scheme rules.
 */
export function createDefaultRemindersForApplication(
  app: FarmerSchemeApplication,
  scheme?: Partial<GovernmentScheme>
): SchemeReminder[] {
  const generated: SchemeReminder[] = [];
  const now = new Date();

  // 1. Deadline reminder if the scheme has a verified deadline
  if (scheme?.applicationDeadline) {
    const deadlineDate = scheme.applicationDeadline.split('T')[0];
    generated.push({
      id: `rem-${app.id}-deadline-${Date.now()}`,
      farmId: app.farmId,
      schemeId: app.schemeId,
      title: `${scheme.shortName || 'Scheme'} Application Deadline`,
      description: `Official submission deadline for ${scheme.name || 'this scheme'}.`,
      dueDate: deadlineDate,
      type: 'deadline',
      isCompleted: false,
      isVerifiedSource: Boolean(scheme.isDeadlineVerified),
      sourceUrl: scheme.officialApplicationUrl || app.portalUrl,
      createdAt: now.toISOString(),
    });
  }

  // 2. Document preparation reminder if in draft or preparing_documents
  if (app.status === 'draft' || app.status === 'preparing_documents') {
    const docDueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    generated.push({
      id: `rem-${app.id}-docs-${Date.now()}`,
      farmId: app.farmId,
      schemeId: app.schemeId,
      title: `Prepare Documents for ${scheme?.shortName || 'Application'}`,
      description: 'Collate mandatory identity and land records before portal submission.',
      dueDate: docDueDate,
      type: 'document',
      isCompleted: false,
      isVerifiedSource: false,
      sourceUrl: app.portalUrl,
      createdAt: now.toISOString(),
    });
  }

  // 3. Post-submission follow-up reminder if submitted or under review
  if (app.status === 'submitted' || app.status === 'under_review') {
    const followupDueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    generated.push({
      id: `rem-${app.id}-followup-${Date.now()}`,
      farmId: app.farmId,
      schemeId: app.schemeId,
      title: `Portal Status Check for ${scheme?.shortName || 'Application'}`,
      description: `Check status on official portal using reference ${app.applicationReferenceNumber || 'number'}.`,
      dueDate: followupDueDate,
      type: 'followup',
      isCompleted: false,
      isVerifiedSource: false,
      sourceUrl: app.portalUrl,
      createdAt: now.toISOString(),
    });
  }

  // Save generated reminders to repository
  for (const reminder of generated) {
    saveReminder(reminder);
  }

  return generated;
}
