/**
 * AgriDOST 4.0: Production TinyFish AI HTTP Client
 * Manages server-side authentication, timeouts, exponential backoff retries,
 * rate limiting, and structured error normalization.
 */

import {
  TinyFishAuthError,
  TinyFishRateLimitError,
  TinyFishTimeoutError,
  TinyFishAPIError,
} from './errors';

export interface TinyFishClientConfig {
  apiKey?: string;
  enabled?: boolean;
  searchBaseUrl?: string;
  fetchBaseUrl?: string;
  agentBaseUrl?: string;
  defaultTimeoutMs?: number;
  maxRetries?: number;
}

export class TinyFishClient {
  private readonly apiKey?: string;
  private readonly enabled: boolean;
  public readonly searchBaseUrl: string;
  public readonly fetchBaseUrl: string;
  public readonly agentBaseUrl: string;
  public readonly defaultTimeoutMs: number;
  public readonly maxRetries: number;

  // Simple token-bucket rate limiter (max 10 requests per second)
  private lastRequestTime = 0;
  private readonly minIntervalMs = 100;

  constructor(config?: TinyFishClientConfig) {
    this.apiKey = config?.apiKey ?? process.env.TINYFISH_API_KEY;
    this.enabled = config?.enabled ?? (process.env.TINYFISH_ENABLED === 'true');
    this.searchBaseUrl = config?.searchBaseUrl ?? 'https://api.search.tinyfish.ai';
    this.fetchBaseUrl = config?.fetchBaseUrl ?? 'https://api.fetch.tinyfish.ai';
    this.agentBaseUrl = config?.agentBaseUrl ?? 'https://agent.tinyfish.ai';
    this.defaultTimeoutMs = config?.defaultTimeoutMs ?? 15000;
    this.maxRetries = config?.maxRetries ?? 2;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5 && !this.apiKey.includes('placeholder'));
  }

  public isLiveReady(): boolean {
    return this.isConfigured() && this.enabled;
  }

  public getMaskedKey(): string {
    if (!this.apiKey) return 'NOT_CONFIGURED';
    const trimmed = this.apiKey.trim();
    if (trimmed.length <= 8) return '****';
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
  }

  /**
   * Internal rate limiter to throttle bursts
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Executes an authorized HTTP request with timeout, retries, and normalized error mapping.
   */
  public async request<T>(
    endpointUrl: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      headers?: Record<string, string>;
      body?: unknown;
      timeoutMs?: number;
      maxRetries?: number;
    }
  ): Promise<T> {
    if (!this.apiKey) {
      throw new TinyFishAuthError('TINYFISH_API_KEY is not configured in the server environment.');
    }

    const method = options?.method ?? 'GET';
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const maxRetries = options?.maxRetries ?? this.maxRetries;

    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'X-TF-Request-Origin': 'api',
      'X-TF-API-Source': 'api-keys',
      'Accept': 'application/json',
      ...options?.headers,
    };

    let serializedBody: string | undefined;
    if (options?.body) {
      headers['Content-Type'] = 'application/json';
      serializedBody = JSON.stringify(options.body);
    }

    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt++;
      await this.throttle();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(endpointUrl, {
          method,
          headers,
          body: serializedBody,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Success
        if (response.ok) {
          const data = (await response.json()) as T;
          return data;
        }

        // Handle HTTP Status Errors
        const status = response.status;
        let errorBodyText = '';
        try {
          errorBodyText = await response.text();
        } catch {
          // ignore
        }

        if (status === 401 || status === 403) {
          throw new TinyFishAuthError(`TinyFish authentication failed (HTTP ${status}): ${errorBodyText}`);
        }

        if (status === 429) {
          // Rate limit - retry if attempts remain
          if (attempt <= maxRetries) {
            const backoff = Math.pow(2, attempt) * 300 + Math.random() * 100;
            console.warn(`[TinyFish Client] Rate limit 429 on ${endpointUrl}, retrying in ${backoff.toFixed(0)}ms...`);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          throw new TinyFishRateLimitError(`TinyFish rate limit exceeded (HTTP 429): ${errorBodyText}`);
        }

        if (status >= 500 && status < 600) {
          // Server error - retry transient errors
          if (attempt <= maxRetries) {
            const backoff = Math.pow(2, attempt) * 200;
            console.warn(`[TinyFish Client] Server error ${status} on ${endpointUrl}, retrying in ${backoff}ms...`);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          throw new TinyFishAPIError(`TinyFish upstream server error (HTTP ${status}): ${errorBodyText}`, status);
        }

        throw new TinyFishAPIError(`TinyFish API returned HTTP ${status}: ${errorBodyText}`, status);
      } catch (err: unknown) {
        clearTimeout(timeoutId);

        if (err instanceof TinyFishAuthError || err instanceof TinyFishRateLimitError || err instanceof TinyFishAPIError) {
          throw err;
        }

        if (err instanceof Error && err.name === 'AbortError') {
          if (attempt <= maxRetries) {
            console.warn(`[TinyFish Client] Timeout after ${timeoutMs}ms on ${endpointUrl}, retrying...`);
            continue;
          }
          throw new TinyFishTimeoutError(`TinyFish request timed out after ${timeoutMs}ms.`);
        }

        // Network error
        if (attempt <= maxRetries) {
          const backoff = 200 * attempt;
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        const message = err instanceof Error ? err.message : String(err);
        throw new TinyFishAPIError(`Network error communicating with TinyFish: ${message}`, 503);
      }
    }

    throw new TinyFishAPIError('Max retries exhausted for TinyFish request.', 500);
  }
}

// Default singleton client
export const defaultTinyFishClient = new TinyFishClient();
