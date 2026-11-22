/**
 * AgriDOST 4.0: Farmer Consent & Opt-In Manager
 *
 * CRITICAL RULE: NEVER send notifications without explicit farmer consent!
 * Every notification dispatch must verify that optInStatus === true for the farmerId.
 *
 * Manages:
 * - /start <farmer_id> binding and opt-in consent
 * - /stop or /unsubscribe immediate revocation
 * - Language preference updates (/lang en|hi|mr)
 * - Safe in-memory store with persistence fallback
 */

import {
  FarmerConsentRecord,
  SupportedLanguage,
  TelegramChat,
  TelegramUser,
} from '@/types/telegram';
import {
  getSupabaseConfigStatus,
  getSupabaseRestUrl,
  getSupabaseHeaders,
} from '@/lib/supabase/client';

// In-memory singleton store for farmer consents
class ConsentStore {
  private byFarmerId: Map<string, FarmerConsentRecord> = new Map();
  private byChatId: Map<string, string> = new Map(); // chatId string -> farmerId

  constructor() {
    this.seedDefaultConsents();
  }

  private seedDefaultConsents() {
    // Seed default demo farmer with active consent for seamless demo experience
    const demoConsent: FarmerConsentRecord = {
      farmerId: 'demo-farmer-01',
      chatId: 1098765432,
      username: 'demo_farmer_kisan',
      optInStatus: true,
      consentTimestamp: new Date().toISOString(),
      languagePreference: 'hi',
      metadata: { source: 'demo_seed' },
    };
    this.save(demoConsent);
  }

  public save(record: FarmerConsentRecord): FarmerConsentRecord {
    const copy = { ...record };
    this.byFarmerId.set(record.farmerId, copy);
    this.byChatId.set(String(record.chatId), record.farmerId);
    return copy;
  }

  public getByFarmerId(farmerId: string): FarmerConsentRecord | null {
    const found = this.byFarmerId.get(farmerId);
    return found ? { ...found } : null;
  }

  public getByChatId(chatId: number | string): FarmerConsentRecord | null {
    const farmerId = this.byChatId.get(String(chatId));
    if (!farmerId) return null;
    return this.getByFarmerId(farmerId);
  }

  public revoke(identifier: { farmerId?: string; chatId?: number | string }): boolean {
    let targetRecord: FarmerConsentRecord | null = null;

    if (identifier.farmerId) {
      targetRecord = this.getByFarmerId(identifier.farmerId);
    } else if (identifier.chatId) {
      targetRecord = this.getByChatId(identifier.chatId);
    }

    if (!targetRecord) return false;

    targetRecord.optInStatus = false;
    targetRecord.revokedTimestamp = new Date().toISOString();
    this.save(targetRecord);
    return true;
  }

  public list(): FarmerConsentRecord[] {
    return Array.from(this.byFarmerId.values()).map((r) => ({ ...r }));
  }

  public clear(): void {
    this.byFarmerId.clear();
    this.byChatId.clear();
  }
}

// Global singleton instance
const globalConsentStore = new ConsentStore();

export interface TelegramConsentPersistenceResult {
  success: boolean;
  isOffline: boolean;
  message: string;
  record?: FarmerConsentRecord;
  error?: string;
}

/**
 * Persist an opt-in or revocation consent record to Supabase.
 * Enforces:
 * 1. Checks if Supabase credentials are configured.
 * 2. Uses UPSERT (Prefer: resolution=merge-duplicates) with farmer_id conflict target.
 * 3. Gracefully reports offline when Supabase is unconfigured, unreachable, or table not yet migrated.
 */
export async function persistConsentToSupabase(
  record: FarmerConsentRecord,
  options?: {
    overrides?: { url?: string; anonKey?: string };
    authToken?: string;
  }
): Promise<TelegramConsentPersistenceResult> {
  const status = getSupabaseConfigStatus(options?.overrides);

  if (!status.isConfigured) {
    return {
      success: true,
      isOffline: true,
      message: 'Supabase unconfigured; consent stored in memory and local persistence.',
      record,
    };
  }

  try {
    const endpoint = getSupabaseRestUrl('farmer_telegram_registrations', options?.overrides);
    const headers = getSupabaseHeaders({
      authToken: options?.authToken,
      anonKey: options?.overrides?.anonKey,
      prefer: 'resolution=merge-duplicates',
    });

    const payload = {
      farmer_id: record.farmerId,
      chat_id: Number(record.chatId),
      username: record.username || null,
      opt_in_status: Boolean(record.optInStatus),
      language_preference: record.languagePreference || 'hi',
      consent_timestamp: record.consentTimestamp || new Date().toISOString(),
      revoked_timestamp: record.revokedTimestamp || null,
      metadata: record.metadata || {},
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        isOffline: true,
        message: `Supabase registration table returned HTTP ${res.status}. Falling back to local store.`,
        error: errText || `HTTP ${res.status}`,
        record,
      };
    }

    return {
      success: true,
      isOffline: false,
      message: `Persisted consent for farmer '${record.farmerId}' to Supabase cloud.`,
      record,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Network error';
    return {
      success: false,
      isOffline: true,
      message: `Failed to persist consent to Supabase cloud: ${errorMsg}. Local copy is safe.`,
      error: errorMsg,
      record,
    };
  }
}

/**
 * Load farmer consent record from Supabase cloud if available.
 * Falls back to local in-memory store if unconfigured, offline, or not found.
 */
export async function loadConsentFromSupabase(
  farmerId: string,
  options?: {
    overrides?: { url?: string; anonKey?: string };
    authToken?: string;
  }
): Promise<FarmerConsentRecord | null> {
  if (!farmerId) return null;

  const status = getSupabaseConfigStatus(options?.overrides);
  if (!status.isConfigured) {
    return globalConsentStore.getByFarmerId(farmerId);
  }

  try {
    const baseUrl = getSupabaseRestUrl('farmer_telegram_registrations', options?.overrides);
    const queryUrl = `${baseUrl}?farmer_id=eq.${encodeURIComponent(farmerId)}&select=*`;
    const headers = getSupabaseHeaders({
      authToken: options?.authToken,
      anonKey: options?.overrides?.anonKey,
    });

    const res = await fetch(queryUrl, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      return globalConsentStore.getByFarmerId(farmerId);
    }

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const row = data[0];
      const record: FarmerConsentRecord = {
        farmerId: row.farmer_id,
        chatId: row.chat_id,
        username: row.username || undefined,
        optInStatus: Boolean(row.opt_in_status),
        languagePreference: (row.language_preference as SupportedLanguage) || 'hi',
        consentTimestamp: row.consent_timestamp || new Date().toISOString(),
        revokedTimestamp: row.revoked_timestamp || null,
        metadata: (row.metadata as Record<string, unknown>) || {},
      };

      // Cache into local L1 store
      globalConsentStore.save(record);
      return record;
    }

    return globalConsentStore.getByFarmerId(farmerId);
  } catch {
    return globalConsentStore.getByFarmerId(farmerId);
  }
}

/**
 * Sync all farmer consent registrations from Supabase cloud into the in-memory cache.
 */
export async function syncConsentsWithSupabase(options?: {
  overrides?: { url?: string; anonKey?: string };
  authToken?: string;
}): Promise<{ synced: number; isOffline: boolean; message: string }> {
  const status = getSupabaseConfigStatus(options?.overrides);
  if (!status.isConfigured) {
    return {
      synced: 0,
      isOffline: true,
      message: 'Supabase unconfigured; operating in offline mode.',
    };
  }

  try {
    const endpoint = `${getSupabaseRestUrl('farmer_telegram_registrations', options?.overrides)}?select=*`;
    const headers = getSupabaseHeaders({
      authToken: options?.authToken,
      anonKey: options?.overrides?.anonKey,
    });

    const res = await fetch(endpoint, { method: 'GET', headers });
    if (!res.ok) {
      return {
        synced: 0,
        isOffline: true,
        message: `Supabase returned HTTP ${res.status}.`,
      };
    }

    const rows = await res.json();
    if (!Array.isArray(rows)) {
      return { synced: 0, isOffline: false, message: 'No rows returned.' };
    }

    let synced = 0;
    for (const row of rows) {
      const record: FarmerConsentRecord = {
        farmerId: row.farmer_id,
        chatId: row.chat_id,
        username: row.username || undefined,
        optInStatus: Boolean(row.opt_in_status),
        languagePreference: (row.language_preference as SupportedLanguage) || 'hi',
        consentTimestamp: row.consent_timestamp || new Date().toISOString(),
        revokedTimestamp: row.revoked_timestamp || null,
        metadata: (row.metadata as Record<string, unknown>) || {},
      };
      globalConsentStore.save(record);
      synced++;
    }

    return {
      synced,
      isOffline: false,
      message: `Synchronized ${synced} consent record(s) from Supabase.`,
    };
  } catch (err) {
    return {
      synced: 0,
      isOffline: true,
      message: `Sync failed: ${err instanceof Error ? err.message : 'Network error'}`,
    };
  }
}

/**
 * Register or update explicit consent for a farmer.
 */
export function registerConsent(params: {
  farmerId: string;
  chatId: number | string;
  username?: string;
  languagePreference?: SupportedLanguage;
  metadata?: Record<string, unknown>;
}): FarmerConsentRecord {
  const existing = globalConsentStore.getByFarmerId(params.farmerId);

  const record: FarmerConsentRecord = {
    farmerId: params.farmerId,
    chatId: params.chatId,
    username: params.username ?? existing?.username,
    optInStatus: true,
    consentTimestamp: new Date().toISOString(),
    revokedTimestamp: null,
    languagePreference: params.languagePreference ?? existing?.languagePreference ?? 'hi',
    metadata: {
      ...existing?.metadata,
      ...params.metadata,
      updatedAt: new Date().toISOString(),
    },
  };

  const saved = globalConsentStore.save(record);

  // Background async persistence to Supabase if in server environment with configured URL
  if (
    typeof fetch === 'function' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
  ) {
    persistConsentToSupabase(saved).catch((err) => {
      console.warn('[Telegram Consent] Background Supabase persist error:', err);
    });
  }

  return saved;
}

/**
 * Revoke consent for a farmer or chatId.
 * After revocation, NO notifications will be delivered.
 */
export function revokeConsent(identifier: {
  farmerId?: string;
  chatId?: number | string;
}): boolean {
  const revoked = globalConsentStore.revoke(identifier);
  if (revoked) {
    const updated = identifier.farmerId
      ? globalConsentStore.getByFarmerId(identifier.farmerId)
      : identifier.chatId
      ? globalConsentStore.getByChatId(identifier.chatId)
      : null;

    if (
      updated &&
      typeof fetch === 'function' &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
    ) {
      persistConsentToSupabase(updated).catch((err) => {
        console.warn('[Telegram Consent] Background Supabase revoke persist error:', err);
      });
    }
  }
  return revoked;
}

/**
 * Check whether a farmer has active explicit consent.
 * Returns TRUE only if record exists and optInStatus === true.
 */
export function hasConsent(farmerId: string): boolean {
  if (!farmerId) return false;
  const record = globalConsentStore.getByFarmerId(farmerId);
  return Boolean(record && record.optInStatus === true);
}

/**
 * Get consent record by farmer ID.
 */
export function getConsentByFarmerId(farmerId: string): FarmerConsentRecord | null {
  return globalConsentStore.getByFarmerId(farmerId);
}

/**
 * Get consent record by Telegram chat ID.
 */
export function getConsentByChatId(chatId: number | string): FarmerConsentRecord | null {
  return globalConsentStore.getByChatId(chatId);
}

/**
 * Update preferred language for a farmer.
 */
export function updateLanguagePreference(
  farmerId: string,
  language: SupportedLanguage
): boolean {
  const record = globalConsentStore.getByFarmerId(farmerId);
  if (!record) return false;

  record.languagePreference = language;
  globalConsentStore.save(record);
  return true;
}

/**
 * List all registered consent records.
 */
export function listConsents(): FarmerConsentRecord[] {
  return globalConsentStore.list();
}

/**
 * Clear all consents (used for isolated testing).
 */
export function clearConsentStore(): void {
  globalConsentStore.clear();
}

export interface WebhookCommandResult {
  handled: boolean;
  replyText: string;
  action: 'opt_in' | 'opt_out' | 'language_change' | 'status' | 'help' | 'unknown';
  record?: FarmerConsentRecord;
}

/**
 * Parse and process incoming Telegram bot commands (/start, /stop, /unsubscribe, /lang, /help, /status).
 */
export function handleWebhookCommand(
  text: string,
  fromUser: TelegramUser,
  chat: TelegramChat
): WebhookCommandResult {
  const clean = (text || '').trim();

  // 1. /start [<farmer_id>]
  const startMatch = clean.match(/^\/start(?:\s+(.+))?$/i);
  if (startMatch) {
    const rawArg = startMatch[1]?.trim();
    const farmerId = rawArg || `farmer_${chat.id}`;

    const record = registerConsent({
      farmerId,
      chatId: chat.id,
      username: fromUser.username,
      languagePreference: 'hi',
      metadata: {
        source: 'telegram_bot_command',
        firstName: fromUser.first_name,
        lastName: fromUser.last_name,
      },
    });

    const replyText = `🌾 <b>Welcome to AgriDOST Alerts! / एग्रीदोस्त में आपका स्वागत है!</b>

✅ <b>Farmer Opt-In Confirmed / सहमति दर्ज हो गई है</b>
• Farmer ID: <code>${farmerId}</code>
• Chat ID: <code>${chat.id}</code>
• Language: <b>Hindi / हिंदी</b>

You will now receive timely, verified alerts:
🌦️ Weather & Spray warnings (मौसम और छिड़काव सलाह)
🌿 Crop Health & Pest Diagnoses (फसल रोग व कीट निदान)
🏛️ Government Scheme Deadlines (सरकारी योजनाएं)
📈 Mandi Price Targets (मंडी भाव अलर्ट)

<b>Available Commands / उपलब्ध आदेश:</b>
• /lang hi | en | mr - Change language / भाषा बदलें
• /status - Check subscription / स्थिति देखें
• /stop or /unsubscribe - Revoke consent anytime / सेवा बंद करें`;

    return {
      handled: true,
      replyText,
      action: 'opt_in',
      record,
    };
  }

  // 2. /stop or /unsubscribe
  if (/^\/(stop|unsubscribe)/i.test(clean)) {
    const existing = globalConsentStore.getByChatId(chat.id);
    const farmerId = existing?.farmerId || `farmer_${chat.id}`;

    revokeConsent({ chatId: chat.id });
    const revokedRecord = globalConsentStore.getByChatId(chat.id);

    const replyText = `🛑 <b>AgriDOST Alert Service Deactivated / सेवा बंद की गई</b>

You have successfully revoked your consent for Farmer ID: <code>${farmerId}</code>.
No further automated notifications will be sent to this Telegram account.

आप एग्रीदोस्त अलर्ट सेवा से हट चुके हैं। अब आपको कोई संदेश नहीं भेजा जाएगा।

<i>To re-activate at any time, send /start ${farmerId}</i>`;

    return {
      handled: true,
      replyText,
      action: 'opt_out',
      record: revokedRecord || undefined,
    };
  }

  // 3. /lang [hi|en|mr]
  const langMatch = clean.match(/^\/lang(?:\s+(hi|en|mr))?$/i);
  if (langMatch) {
    const chosenLang = (langMatch[1]?.toLowerCase() as SupportedLanguage) || 'hi';
    const existing = globalConsentStore.getByChatId(chat.id);

    if (!existing) {
      return {
        handled: true,
        replyText: '⚠️ Please subscribe first with /start before selecting a language.',
        action: 'unknown',
      };
    }

    updateLanguagePreference(existing.farmerId, chosenLang);

    const langNames: Record<SupportedLanguage, string> = {
      hi: 'Hindi (हिंदी)',
      en: 'English',
      mr: 'Marathi (मराठी)',
    };

    const replyText = `🌐 <b>Language Updated / भाषा अपडेट हो गई</b>

Your notification language preference is now set to: <b>${langNames[chosenLang]}</b>.
आपकी पसंदीदा भाषा <b>${langNames[chosenLang]}</b> सेट कर दी गई है।`;

    return {
      handled: true,
      replyText,
      action: 'language_change',
      record: globalConsentStore.getByChatId(chat.id) || undefined,
    };
  }

  // 4. /status
  if (/^\/status/i.test(clean)) {
    const existing = globalConsentStore.getByChatId(chat.id);

    if (!existing || !existing.optInStatus) {
      return {
        handled: true,
        replyText: `ℹ️ <b>AgriDOST Status: INACTIVE</b>\n\nYou are not currently subscribed to notifications.\nTo subscribe, send: /start <FARMER_ID>`,
        action: 'status',
      };
    }

    const replyText = `ℹ️ <b>AgriDOST Subscription Status: ACTIVE ✅</b>

• Farmer ID: <code>${existing.farmerId}</code>
• Chat ID: <code>${existing.chatId}</code>
• Language: <code>${existing.languagePreference}</code>
• Opt-In Date: ${existing.consentTimestamp}

You are safely enrolled in consent-based advisory alerts.
Send /stop anytime to unsubscribe.`;

    return {
      handled: true,
      replyText,
      action: 'status',
      record: existing,
    };
  }

  // 5. /help
  if (/^\/(help|about)/i.test(clean)) {
    const replyText = `🌾 <b>AgriDOST 4.0 Telegram Advisory Bot</b>

This bot provides automated, consent-governed alerts for Indian farmers.

<b>Strict Privacy & Consent Policy:</b>
• We NEVER send notifications without prior farmer opt-in.
• No spam, no marketing ads.
• Instant opt-out with /stop.

<b>Commands:</b>
• <code>/start [FARMER_ID]</code> - Opt in and link your farmer profile
• <code>/stop</code> - Immediately unsubscribe
• <code>/status</code> - View current subscription status
• <code>/lang hi|en|mr</code> - Set language (Hindi, English, Marathi)
• <code>/help</code> - Show this guidance manual`;

    return {
      handled: true,
      replyText,
      action: 'help',
    };
  }

  return {
    handled: false,
    replyText: `❓ Unrecognized command. Send /help for available commands or /start to subscribe.`,
    action: 'unknown',
  };
}
