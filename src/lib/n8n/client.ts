/**
 * AgriDOST 4.0: n8n Webhook Client & Cryptographic Signature Gateway
 * Implements HMAC-SHA256 request signing, replay drift protection, 8s timeouts,
 * and bounded exponential backoff retries.
 */

import crypto from 'crypto';
import { N8nEventEnvelope, N8nEventType } from '@/types';

export const DEFAULT_N8N_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_RETRIES = 3;
export const RETRY_BACKOFF_MS = [500, 1500, 4500]; // 1st, 2nd, 3rd retry backoff intervals
export const MAX_REPLAY_DRIFT_SECONDS = 300; // 5 minutes drift allowance

export interface N8nWebhookDispatchResult {
  success: boolean;
  httpStatus?: number;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  durationMs: number;
  attempts: number;
  simulated: boolean;
}

export interface WebhookSignatureVerificationResult {
  valid: boolean;
  reason?: string;
  timestamp?: string;
}

/**
 * Maps an event type to the corresponding n8n webhook route.
 */
export function getWebhookUrlForEvent(eventType: N8nEventType, baseUrlOverride?: string): string {
  const envUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/';
  const base = baseUrlOverride || envUrl;
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;

  if (eventType.startsWith('government.')) {
    return `${normalizedBase}agridost-government-assistance`;
  }
  if (eventType.startsWith('operations.')) {
    return `${normalizedBase}agridost-smart-farm-operations`;
  }
  if (eventType.startsWith('market.')) {
    return `${normalizedBase}agridost-market-intelligence`;
  }
  return `${normalizedBase}agridost-generic`;
}

/**
 * Creates HMAC-SHA256 webhook signature header format:
 * `t=${timestamp},v1=${signature}`
 */
export function createWebhookSignature(
  rawBody: string,
  secret: string,
  timestampOverride?: string
): { header: string; timestamp: string; signature: string } {
  const timestamp = timestampOverride || new Date().toISOString();
  const signaturePayload = `${timestamp}.${rawBody}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  const header = `t=${timestamp},v1=${signature}`;
  return { header, timestamp, signature };
}

/**
 * Validates inbound webhook signature and prevents replay attacks via drift checking.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  maxDriftSec = MAX_REPLAY_DRIFT_SECONDS
): WebhookSignatureVerificationResult {
  if (!signatureHeader || !signatureHeader.trim()) {
    return { valid: false, reason: 'Missing X-AgriDOST-Signature header' };
  }

  // Parse t=... and v1=...
  const parts = signatureHeader.split(',');
  let timestampStr: string | undefined;
  let signatureStr: string | undefined;

  for (const part of parts) {
    const [key, val] = part.trim().split('=');
    if (key === 't') timestampStr = val;
    if (key === 'v1') signatureStr = val;
  }

  if (!timestampStr || !signatureStr) {
    return { valid: false, reason: 'Invalid signature header format; expected t=...,v1=...' };
  }

  // Time drift check (prevents replay attacks)
  const headerTime = new Date(timestampStr).getTime();
  if (isNaN(headerTime)) {
    return { valid: false, reason: 'Malformed timestamp in signature header' };
  }

  const now = Date.now();
  const driftSec = Math.abs(now - headerTime) / 1000;

  if (driftSec > maxDriftSec) {
    return {
      valid: false,
      reason: `Signature timestamp expired: drift is ${Math.round(driftSec)}s (max allowed ${maxDriftSec}s)`,
      timestamp: timestampStr,
    };
  }

  // Calculate expected signature
  const signaturePayload = `${timestampStr}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  // Constant-time buffer comparison to prevent timing attacks
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const actualBuf = Buffer.from(signatureStr, 'utf8');

  if (expectedBuf.length !== actualBuf.length) {
    return { valid: false, reason: 'HMAC signature mismatch' };
  }

  const isValid = crypto.timingSafeEqual(expectedBuf, actualBuf);
  return {
    valid: isValid,
    reason: isValid ? undefined : 'HMAC signature mismatch',
    timestamp: timestampStr,
  };
}

/**
 * Sends an event envelope to an n8n webhook with HMAC signing, 8s timeout,
 * and up to 3 bounded retries on 5xx or network drops.
 */
export async function sendN8nWebhook(
  envelope: N8nEventEnvelope,
  options?: {
    webhookUrl?: string;
    secret?: string;
    apiKey?: string;
    simulated?: boolean;
    timeoutMs?: number;
    maxRetries?: number;
  }
): Promise<N8nWebhookDispatchResult> {
  const startTime = Date.now();
  const secret =
    options?.secret ||
    process.env.N8N_WEBHOOK_SECRET ||
    'agridost_hmac_webhook_signing_secret_2026';
  const apiKey = options?.apiKey || process.env.N8N_API_KEY;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_N8N_TIMEOUT_MS;
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const isSimulated =
    options?.simulated ??
    (process.env.N8N_SIMULATED_MODE === 'true' ||
      !process.env.N8N_WEBHOOK_URL ||
      process.env.N8N_WEBHOOK_URL.includes('localhost'));

  const webhookUrl = options?.webhookUrl || getWebhookUrlForEvent(envelope.eventType);
  const rawBody = JSON.stringify(envelope);
  const { header, timestamp } = createWebhookSignature(rawBody, secret, envelope.timestamp);

  // If running in simulated mode or forced simulation, generate simulated response immediately
  if (isSimulated && process.env.N8N_FORCE_LIVE !== 'true') {
    return simulateWebhookExecution(envelope, Date.now() - startTime);
  }

  let attempts = 0;
  let lastError: { code: string; message: string; retryable: boolean } | undefined;
  let lastStatus: number | undefined;

  while (attempts <= maxRetries) {
    attempts++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-AgriDOST-Event-ID': envelope.eventId,
        'X-AgriDOST-Timestamp': timestamp,
        'X-AgriDOST-Signature': header,
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: rawBody,
        signal: controller.signal,
      });

      clearTimeout(timer);
      lastStatus = response.status;

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          success: true,
          httpStatus: response.status,
          data,
          durationMs: Date.now() - startTime,
          attempts,
          simulated: false,
        };
      }

      // Check for non-retryable 4xx client errors
      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text().catch(() => 'Client Error');
        return {
          success: false,
          httpStatus: response.status,
          error: {
            code: `HTTP_${response.status}`,
            message: `n8n rejected webhook with status ${response.status}: ${errorText}`,
            retryable: false,
          },
          durationMs: Date.now() - startTime,
          attempts,
          simulated: false,
        };
      }

      // 5xx Server Error - eligible for retry
      const errorText = await response.text().catch(() => 'Server Error');
      lastError = {
        code: `HTTP_${response.status}`,
        message: `n8n server error (${response.status}): ${errorText}`,
        retryable: true,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = (err as Error)?.name === 'AbortError';
      lastError = {
        code: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: isAbort
          ? `Webhook request timed out after ${timeoutMs}ms`
          : `Network error connecting to n8n: ${(err as Error)?.message || 'Connection refused'}`,
        retryable: true,
      };
    }

    // If retries remain and error is retryable, wait backoff delay
    if (attempts <= maxRetries && lastError?.retryable) {
      const delay = RETRY_BACKOFF_MS[attempts - 1] || 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted. If simulated fallback is acceptable, fallback gracefully
  if (process.env.N8N_FALLBACK_TO_SIMULATION === 'true') {
    const simResult = simulateWebhookExecution(envelope, Date.now() - startTime);
    return {
      ...simResult,
      attempts,
      error: lastError,
    };
  }

  return {
    success: false,
    httpStatus: lastStatus,
    error: lastError || {
      code: 'UNKNOWN_ERROR',
      message: 'Failed to dispatch webhook after retries',
      retryable: false,
    },
    durationMs: Date.now() - startTime,
    attempts,
    simulated: false,
  };
}

/**
 * Generates deterministic realistic output for simulated execution when n8n is offline.
 */
function simulateWebhookExecution(
  envelope: N8nEventEnvelope,
  durationMs: number
): N8nWebhookDispatchResult {
  const { eventType, payload } = envelope;

  let simulatedOutput: Record<string, unknown> = {};

  if (eventType.startsWith('government.')) {
    simulatedOutput = {
      workflow: 'agridost-government-assistance',
      notificationDispatched: true,
      channels: ['sms', 'in_app', 'telegram'],
      recipient: payload.farmerName || 'Farmer Ramesh Patel',
      scheme: payload.schemeName || 'PM-KISAN',
      status: 'acknowledged',
      advisoryMessage: `Notification scheduled for deadline on ${payload.deadlineDate || payload.reminderDueDate || 'upcoming cutoff'}.`,
    };
  } else if (eventType.startsWith('operations.')) {
    const weather = (payload.weatherData as Record<string, unknown>) || {};
    const windSpeed = Number(weather.windSpeedKmh) || 12;
    const canSpray = windSpeed <= 15;

    simulatedOutput = {
      workflow: 'agridost-smart-farm-operations',
      droneFlightClearance: canSpray ? 'approved' : 'caution_high_wind',
      safetyWindow: canSpray ? 'Optimal spray window: 06:30 AM - 09:30 AM' : 'Postpone spray: wind speed exceeds threshold',
      advisory: canSpray
        ? 'Weather conditions optimal for target zone spray.'
        : `Wind speed is ${windSpeed} km/h (threshold 15 km/h). High drift risk.`,
    };
  } else if (eventType.startsWith('market.')) {
    const currentPrice = Number(payload.currentMandiPriceInrPerQtl) || 2800;
    const targetPrice = Number(payload.farmerTargetPriceInrPerQtl) || 2700;
    const recommendation = currentPrice >= targetPrice ? 'SELL_NOW' : 'HOLD';

    simulatedOutput = {
      workflow: 'agridost-market-intelligence',
      recommendation,
      mandi: payload.targetMandi || 'Nashik APMC',
      commodity: payload.commodityName || 'Soybean',
      currentPriceInr: currentPrice,
      targetPriceInr: targetPrice,
      rationale:
        recommendation === 'SELL_NOW'
          ? `Current market price (₹${currentPrice}/qtl) satisfies farmer target (₹${targetPrice}/qtl). Sell recommended.`
          : `Current price (₹${currentPrice}/qtl) is below farmer target (₹${targetPrice}/qtl). Hold advised.`,
    };
  } else {
    simulatedOutput = {
      workflow: 'agridost-generic',
      status: 'acknowledged',
    };
  }

  return {
    success: true,
    httpStatus: 200,
    data: simulatedOutput,
    durationMs: Math.max(durationMs, 85),
    attempts: 1,
    simulated: true,
  };
}
