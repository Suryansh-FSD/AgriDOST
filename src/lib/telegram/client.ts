/**
 * AgriDOST 4.0: Telegram Bot API Client
 *
 * Server-side client for interacting with the official Telegram Bot API.
 * Keeps TELEGRAM_BOT_TOKEN strictly server-side and redacts sensitive credentials.
 */

import {
  TelegramApiResponse,
  TelegramMessage,
  TelegramSendMessageParams,
  TelegramUser,
  TelegramWebhookInfo,
} from '@/types/telegram';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export interface TelegramClientConfig {
  botToken?: string;
  simulated?: boolean;
  timeoutMs?: number;
}

export class TelegramClient {
  private botTokenOverride?: string;
  private simulatedOverride?: boolean;
  private timeoutMs: number;

  constructor(config: TelegramClientConfig = {}) {
    this.botTokenOverride = config.botToken;
    this.simulatedOverride = config.simulated;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  /**
   * Get the active bot token, resolving override or process.env at runtime.
   */
  public getBotToken(): string {
    return this.botTokenOverride ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  }

  /**
   * Check if running in simulated mode.
   */
  public isSimulated(): boolean {
    if (this.simulatedOverride !== undefined) return this.simulatedOverride;
    return (
      process.env.TELEGRAM_SIMULATED_MODE === 'true' ||
      process.env.NODE_ENV === 'test'
    );
  }

  /**
   * Check if client has a configured bot token.
   */
  public isConfigured(): boolean {
    const token = this.getBotToken();
    return Boolean(
      token &&
      token.trim().length > 10 &&
      token.includes(':')
    );
  }

  /**
   * Safe getter for token presence without exposing the secret.
   */
  public getMaskedToken(): string {
    const token = this.getBotToken();
    if (!token || token.length < 8) return '[UNCONFIGURED]';
    const parts = token.split(':');
    if (parts.length === 2) {
      return `${parts[0]}:***${parts[1].slice(-4)}`;
    }
    return `***${token.slice(-4)}`;
  }

  /**
   * Redact token from any string (error messages, URLs).
   */
  private redact(str: string): string {
    const token = this.getBotToken();
    if (!token) return str;
    return str.replace(new RegExp(token, 'g'), '[REDACTED_TELEGRAM_TOKEN]');
  }

  /**
   * Generic request executor against Telegram Bot API.
   */
  private async request<T>(
    method: string,
    body?: Record<string, unknown>
  ): Promise<TelegramApiResponse<T>> {
    // If running in simulated mode or not configured:
    if (this.isSimulated() || !this.isConfigured()) {
      return this.handleSimulatedRequest<T>(method, body);
    }

    const token = this.getBotToken();
    const endpoint = `${TELEGRAM_API_BASE}/bot${token}/${method}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = (await response.json()) as TelegramApiResponse<T>;

      if (!response.ok || !data.ok) {
        const errorDesc = data.description || `HTTP ${response.status} ${response.statusText}`;
        throw new Error(`Telegram API Error (${method}): ${this.redact(errorDesc)}`);
      }

      return data;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Telegram API Error (${method}): Request timed out after ${this.timeoutMs}ms`);
      }
      const rawMsg = err instanceof Error ? err.message : String(err);
      throw new Error(this.redact(rawMsg));
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Deterministic simulated fallback for tests and development without a live bot.
   */
  private handleSimulatedRequest<T>(
    method: string,
    body?: Record<string, unknown>
  ): TelegramApiResponse<T> {
    const timestamp = Math.floor(Date.now() / 1000);

    switch (method) {
      case 'getMe':
        return {
          ok: true,
          result: {
            id: 876543210,
            is_bot: true,
            first_name: 'AgriDOST Farmer Advisory Bot',
            username: 'AgriDOST_Alerts_Bot',
            language_code: 'en',
          } as unknown as T,
        };

      case 'sendMessage': {
        const chatId = body?.chat_id;
        const text = (body?.text as string) || '';
        return {
          ok: true,
          result: {
            message_id: Math.floor(Math.random() * 100000) + 1,
            from: {
              id: 876543210,
              is_bot: true,
              first_name: 'AgriDOST Farmer Advisory Bot',
              username: 'AgriDOST_Alerts_Bot',
            },
            chat: {
              id: typeof chatId === 'number' ? chatId : 12345678,
              type: 'private',
              first_name: 'Farmer',
            },
            date: timestamp,
            text,
          } as unknown as T,
        };
      }

      case 'setWebhook':
        return {
          ok: true,
          result: true as unknown as T,
          description: 'Webhook was set (simulated)',
        };

      case 'getWebhookInfo':
        return {
          ok: true,
          result: {
            url: (body?.url as string) || 'https://agridost.example.com/api/telegram/webhook',
            has_custom_certificate: false,
            pending_update_count: 0,
          } as unknown as T,
        };

      case 'deleteWebhook':
        return {
          ok: true,
          result: true as unknown as T,
          description: 'Webhook was deleted (simulated)',
        };

      default:
        return {
          ok: true,
          result: {} as unknown as T,
        };
    }
  }

  /**
   * Get basic bot info to verify credentials.
   */
  public async getMe(): Promise<TelegramApiResponse<TelegramUser>> {
    return this.request<TelegramUser>('getMe');
  }

  /**
   * Send a formatted message to a Telegram chat.
   */
  public async sendMessage(
    params: TelegramSendMessageParams
  ): Promise<TelegramApiResponse<TelegramMessage>> {
    if (!params.chat_id) {
      throw new Error('Telegram sendMessage error: Missing required chat_id');
    }
    if (!params.text || params.text.trim().length === 0) {
      throw new Error('Telegram sendMessage error: Message text cannot be empty');
    }

    return this.request<TelegramMessage>('sendMessage', {
      chat_id: params.chat_id,
      text: params.text,
      parse_mode: params.parse_mode ?? 'HTML',
      disable_web_page_preview: params.disable_web_page_preview ?? true,
      disable_notification: params.disable_notification ?? false,
      reply_markup: params.reply_markup,
    });
  }

  /**
   * Configure Telegram webhook URL with optional secret token.
   */
  public async setWebhook(
    url: string,
    secretToken?: string,
    allowedUpdates: string[] = ['message', 'edited_message']
  ): Promise<TelegramApiResponse<boolean>> {
    if (!url || !url.startsWith('https://')) {
      throw new Error('Telegram setWebhook error: Webhook URL must use HTTPS protocol');
    }

    const payload: Record<string, unknown> = {
      url,
      allowed_updates: allowedUpdates,
    };

    if (secretToken) {
      payload.secret_token = secretToken;
    }

    return this.request<boolean>('setWebhook', payload);
  }

  /**
   * Query status of currently configured webhook.
   */
  public async getWebhookInfo(): Promise<TelegramApiResponse<TelegramWebhookInfo>> {
    return this.request<TelegramWebhookInfo>('getWebhookInfo');
  }

  /**
   * Remove current webhook to switch back to polling or disable ingress.
   */
  public async deleteWebhook(
    dropPendingUpdates: boolean = false
  ): Promise<TelegramApiResponse<boolean>> {
    return this.request<boolean>('deleteWebhook', {
      drop_pending_updates: dropPendingUpdates,
    });
  }
}

// Default singleton instance
export const defaultTelegramClient = new TelegramClient();
