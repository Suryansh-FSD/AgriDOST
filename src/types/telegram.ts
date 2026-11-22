/**
 * AgriDOST 4.0: Telegram Bot Integration Contracts
 *
 * Types for Telegram Bot notifications, farmer opt-in consent records,
 * delivery results, webhook payloads, and Telegram API interactions.
 */

export type TelegramNotificationCategory =
  | 'weather'
  | 'crop_health'
  | 'scheme'
  | 'market'
  | 'task';

export type TelegramPriority = 'low' | 'medium' | 'high' | 'urgent';

export type SupportedLanguage = 'en' | 'hi' | 'mr';

export type NotificationLanguageMode = SupportedLanguage | 'bilingual';

/**
 * Standard notification payload to dispatch to an opted-in farmer.
 */
export interface TelegramNotification {
  id: string;
  farmerId: string;
  chatId?: number | string;
  category: TelegramNotificationCategory;
  priority: TelegramPriority;
  titleEn: string;
  bodyEn: string;
  titleHi: string;
  bodyHi: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

/**
 * Farmer opt-in and consent tracking record.
 * AgriDOST strictly enforces that notifications are NEVER sent without explicit consent.
 */
export interface FarmerConsentRecord {
  farmerId: string;
  chatId: number | string;
  username?: string;
  optInStatus: boolean;
  consentTimestamp: string;
  languagePreference: SupportedLanguage;
  revokedTimestamp?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Delivery result returned after notification dispatch attempt.
 */
export interface TelegramDeliveryResult {
  success: boolean;
  messageId?: number;
  deliveredAt?: string;
  error?: string;
  wasDeduplicated?: boolean;
  farmerId?: string;
  chatId?: number | string;
}

/**
 * Telegram User representation from Bot API.
 */
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Telegram Chat representation from Bot API.
 */
export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Telegram Message representation from Bot API.
 */
export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: Array<{
    type: string;
    offset: number;
    length: number;
  }>;
}

/**
 * Incoming Webhook Update payload received from Telegram.
 */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
}

/**
 * Parameters for the Telegram sendMessage method.
 */
export interface TelegramSendMessageParams {
  chat_id: number | string;
  text: string;
  parse_mode?: 'HTML' | 'MarkdownV2' | 'Markdown';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_markup?: unknown;
}

/**
 * Telegram Webhook Info from getWebhookInfo.
 */
export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  ip_address?: string;
}

/**
 * Telegram API Generic Response Envelope.
 */
export interface TelegramApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}
