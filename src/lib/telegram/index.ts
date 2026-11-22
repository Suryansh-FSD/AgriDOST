/**
 * AgriDOST 4.0: Telegram Bot Integration Module
 *
 * Central orchestration module for Telegram Bot notifications, farmer consent verification,
 * deduplication, and bilingual message formatting.
 */

import {
  NotificationLanguageMode,
  TelegramDeliveryResult,
  TelegramNotification,
} from '@/types/telegram';
import {
  ConfigurationStatus,
  ConnectivityStatus,
  IntegrationHealthResponse,
  IntegrationOperatingMode,
} from '@/types/integrations';
import { defaultTelegramClient, TelegramClient } from './client';
import { getConsentByFarmerId, hasConsent, listConsents } from './consent';
import { getNotificationDedupKey, isDuplicate, recordDelivery } from './dedup';
import { formatNotification } from './templates';

export * from './client';
export * from './consent';
export * from './dedup';
export * from './templates';

export interface SendTelegramOptions {
  force?: boolean;
  languageMode?: NotificationLanguageMode;
  client?: TelegramClient;
}

/**
 * Dispatch a notification to a farmer via Telegram Bot API.
 *
 * Enforces:
 * 1. MANDATORY FARMER CONSENT CHECK: If the farmer has not opted in, dispatch is aborted immediately.
 * 2. 24-HOUR DEDUPLICATION: Identical notifications to the same farmer within 24 hours are suppressed.
 * 3. BILINGUAL FORMATTING: Formats in the farmer's preferred language (English, Hindi, or dual).
 */
export async function sendTelegramNotification(
  notification: TelegramNotification,
  options: SendTelegramOptions = {}
): Promise<TelegramDeliveryResult> {
  const farmerId = notification.farmerId;

  // 1. Check Mandatory Farmer Consent
  const consent = getConsentByFarmerId(farmerId);
  if (!consent || !consent.optInStatus) {
    return {
      success: false,
      error: 'FARMER_NOT_OPTED_IN',
      farmerId,
      deliveredAt: new Date().toISOString(),
    };
  }

  // 2. Resolve Target Chat ID
  const targetChatId = notification.chatId || consent.chatId;
  if (!targetChatId) {
    return {
      success: false,
      error: 'NO_VALID_CHAT_ID',
      farmerId,
      deliveredAt: new Date().toISOString(),
    };
  }

  // 3. Check 24-Hour Deduplication (unless forced)
  const dedupKey = getNotificationDedupKey(notification);
  if (!options.force && isDuplicate(dedupKey)) {
    return {
      success: true,
      wasDeduplicated: true,
      deliveredAt: new Date().toISOString(),
      farmerId,
      chatId: targetChatId,
    };
  }

  // 4. Determine Language Mode
  let langMode: NotificationLanguageMode = options.languageMode || 'bilingual';
  if (!options.languageMode && consent.languagePreference) {
    langMode = consent.languagePreference === 'en' ? 'en' : 'bilingual';
  }

  // 5. Format Message Text
  const messageText = formatNotification(notification, langMode);

  // 6. Send via Telegram Bot API Client
  const client = options.client || defaultTelegramClient;

  try {
    const apiResult = await client.sendMessage({
      chat_id: targetChatId,
      text: messageText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    const nowIso = new Date().toISOString();
    // Record delivery in dedup cache
    recordDelivery(dedupKey);

    return {
      success: true,
      messageId: apiResult.result?.message_id,
      deliveredAt: nowIso,
      wasDeduplicated: false,
      farmerId,
      chatId: targetChatId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: errorMsg,
      deliveredAt: new Date().toISOString(),
      farmerId,
      chatId: targetChatId,
    };
  }
}

/**
 * Standard health check function for Telegram integration conforming to IntegrationHealthResponse.
 */
export async function getTelegramHealth(): Promise<IntegrationHealthResponse> {
  const startTime = Date.now();
  const isConfigured = defaultTelegramClient.isConfigured();
  const isSimulated = defaultTelegramClient.isSimulated();

  const configStatus: ConfigurationStatus = isConfigured ? 'configured' : 'unconfigured';
  let connStatus: ConnectivityStatus = 'offline';
  let opMode: IntegrationOperatingMode = isConfigured
    ? isSimulated
      ? 'SIMULATED'
      : 'LIVE'
    : 'NOT_CONFIGURED';

  let lastSuccessfulCheck: string | null = null;
  let lastError: string | null = null;
  let botUsername: string | undefined;

  try {
    if (isConfigured || isSimulated) {
      const me = await defaultTelegramClient.getMe();
      if (me.ok && me.result) {
        connStatus = 'online';
        lastSuccessfulCheck = new Date().toISOString();
        botUsername = me.result.username;
      } else {
        connStatus = 'degraded';
        lastError = me.description || 'Failed to verify bot identity';
      }
    } else {
      lastError = 'TELEGRAM_BOT_TOKEN is not configured on this server.';
    }
  } catch (err: unknown) {
    connStatus = 'unreachable';
    lastError = err instanceof Error ? err.message : String(err);
    opMode = 'ERROR';
  }

  const latencyMs = Date.now() - startTime;
  const consents = listConsents();
  const activeOptIns = consents.filter((c) => c.optInStatus).length;

  return {
    provider: 'telegram',
    displayName: 'Telegram Bot API (AgriDOST Alerts)',
    category: 'messaging',
    configurationStatus: configStatus,
    connectivityStatus: connStatus,
    operatingMode: opMode,
    lastSuccessfulCheck,
    lastError,
    latencyMs,
    dataFreshness: {
      timestamp: new Date().toISOString(),
      source: 'telegram-bot-api',
      provenance: isSimulated ? 'simulated_fallback' : 'live_api',
    },
    featuresSupported: [
      'bilingual_alerts',
      'farmer_opt_in',
      'consent_enforcement',
      'deduplication_24h',
      'webhook_dispatch',
      'priority_formatting',
    ],
    diagnosticDetails: {
      botUsername: botUsername || null,
      maskedToken: defaultTelegramClient.getMaskedToken(),
      totalConsentsTracked: consents.length,
      activeFarmerOptIns: activeOptIns,
      simulatedMode: isSimulated,
    },
  };
}
