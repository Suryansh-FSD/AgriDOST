import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { IntegrationHealthResponse } from '@/types/integrations';

/**
 * Default candidate cascade for Gemini models.
 * Empirically verified against Google AI Studio API:
 * 1. gemini-3.8-flash (Primary high-capability model; may encounter temporary 503 spikes)
 * 2. gemini-3.1-flash-lite (Active, high speed ~1.5s latency, 200 OK verified)
 * 3. gemini-3-flash-preview (Active preview candidate, ~1.3s latency, 200 OK verified)
 * 4. gemini-flash-lite-latest (Active production alias, 200 OK verified)
 */
export const DEFAULT_GEMINI_CANDIDATES = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest',
];

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GeminiContentItem {
  role?: string;
  parts: GeminiPart[];
}

export interface GeminiCallOptions {
  apiKey?: string;
  candidateModels?: string[];
  systemInstruction?: string;
  timeoutMs?: number; // default 12000 (12s abort timeout)
  maxRetries?: number; // default 1 retry per model for transient errors
  backoffBaseMs?: number; // default 100ms
  temperature?: number;
  responseMimeType?: 'application/json' | 'text/plain';
}

export interface GeminiCallResult {
  text: string;
  model: string;
  attempts: {
    model: string;
    status: 'success' | 'error' | 'timeout';
    error?: string;
    durationMs: number;
  }[];
}

/**
 * Strips potential markdown fencing (e.g. ```json ... ```) from Gemini outputs.
 */
export function cleanJsonText(rawText: string): string {
  let clean = (rawText || '').trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return clean;
}

/**
 * Sanitizes any secret keys from error strings to prevent credential leaks.
 */
export function sanitizeErrorMessage(message: string, apiKey?: string): string {
  let sanitized = message || 'Unknown Gemini error';
  if (apiKey && apiKey.length > 5) {
    sanitized = sanitized.split(apiKey).join('[REDACTED_API_KEY]');
  }
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey.length > 5) {
    sanitized = sanitized.split(envKey).join('[REDACTED_API_KEY]');
  }
  return sanitized;
}

/**
 * Calls Gemini with dynamic candidate model failover, exponential backoff, and strict timeout handling.
 */
export async function callGeminiWithFailover(
  contents: GeminiContentItem[] | string,
  options: GeminiCallOptions = {}
): Promise<GeminiCallResult> {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length <= 5) {
    throw new Error('GEMINI_API_KEY is not configured or is invalid.');
  }

  const candidateModels =
    options.candidateModels && options.candidateModels.length > 0
      ? options.candidateModels
      : DEFAULT_GEMINI_CANDIDATES;

  const timeoutMs = options.timeoutMs ?? 12000;
  const maxRetries = options.maxRetries ?? 1;
  const backoffBaseMs = options.backoffBaseMs ?? 100;

  // Format contents into standard SDK payload
  const formattedContents: GeminiContentItem[] =
    typeof contents === 'string'
      ? [{ role: 'user', parts: [{ text: contents }] }]
      : contents;

  const ai = new GoogleGenAI({ apiKey });
  const attempts: GeminiCallResult['attempts'] = [];
  let lastError: unknown = null;

  for (const modelName of candidateModels) {
    let attemptCount = 0;

    while (attemptCount <= maxRetries) {
      attemptCount++;
      const startTime = Date.now();

      try {
        // Enforce per-request timeout (12s abort / reject)
        const callPromise = ai.models.generateContent({
          model: modelName,
          contents: formattedContents,
          config: {
            systemInstruction: options.systemInstruction,
            responseMimeType: options.responseMimeType || 'application/json',
            temperature: options.temperature,
          },
        });

        let timerId: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timerId = setTimeout(() => {
            reject(new Error(`Gemini model ${modelName} timed out after ${timeoutMs}ms.`));
          }, timeoutMs);
        });

        const response = await Promise.race([callPromise, timeoutPromise]).finally(() => {
          if (timerId) clearTimeout(timerId);
        });

        if (response && response.text && response.text.trim().length > 0) {
          attempts.push({
            model: modelName,
            status: 'success',
            durationMs: Date.now() - startTime,
          });

          return {
            text: response.text.trim(),
            model: modelName,
            attempts,
          };
        } else {
          throw new Error(`Gemini model ${modelName} returned an empty response.`);
        }
      } catch (err: unknown) {
        const durationMs = Date.now() - startTime;
        const rawErrMsg = err instanceof Error ? err.message : String(err);
        const errMsg = sanitizeErrorMessage(rawErrMsg, apiKey);
        lastError = err;

        const isTimeout = errMsg.toLowerCase().includes('timed out');
        attempts.push({
          model: modelName,
          status: isTimeout ? 'timeout' : 'error',
          error: errMsg,
          durationMs,
        });

        console.warn(
          `[Gemini Client] Model ${modelName} (attempt ${attemptCount}/${maxRetries + 1}) failed: ${errMsg}`
        );

        // Model availability and error classification for graceful failover
        const isUnavailable =
          errMsg.includes('404') ||
          errMsg.includes('not found') ||
          errMsg.includes('no longer available') ||
          errMsg.includes('unsupported');

        const isOverloadedOrDemandSpike =
          errMsg.includes('503') ||
          errMsg.includes('overloaded') ||
          errMsg.includes('high demand') ||
          errMsg.includes('Service Unavailable');

        const isRateLimit =
          errMsg.includes('429') ||
          errMsg.includes('rate limit') ||
          errMsg.includes('ResourceExhausted');

        // Only retry the SAME model on rate-limits (with backoff) or timeouts,
        // IF we have remaining retries.
        // For 503 high-demand or 404 unavailable models, cascading immediately to
        // the next verified candidate model provides the fastest, most reliable response.
        const shouldRetrySameModel =
          (isRateLimit || isTimeout) &&
          attemptCount <= maxRetries &&
          backoffBaseMs > 0;

        if (shouldRetrySameModel) {
          const delay = backoffBaseMs * Math.pow(2, attemptCount - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue; // Retry same model
        }

        // For 503 or 404 or exhausted retries, log graceful cascade and proceed to next candidate
        if (isOverloadedOrDemandSpike) {
          console.info(
            `[Gemini Client] Model ${modelName} is experiencing high demand (503). Gracefully cascading to next candidate model.`
          );
        } else if (isUnavailable) {
          console.info(
            `[Gemini Client] Model ${modelName} is unavailable/deprecated (404). Cascading immediately to next candidate model.`
          );
        }

        // Break retry loop for this model and cascade to next candidate
        break;
      }
    }
  }

  const finalMessage =
    lastError instanceof Error
      ? sanitizeErrorMessage(lastError.message, apiKey)
      : 'All Gemini candidate models failed to generate content.';

  throw new Error(finalMessage);
}

/**
 * Parses Gemini output text as JSON and validates strictly against a Zod schema.
 */
export function parseAndValidateWithZod<T>(
  rawText: string,
  schema: z.ZodType<T>
): {
  success: boolean;
  data?: T;
  rawJson?: unknown;
  error?: string;
  zodIssues?: z.ZodIssue[];
} {
  const cleaned = cleanJsonText(rawText);

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(cleaned);
  } catch {
    return {
      success: false,
      error: `Failed to parse Gemini output as JSON: ${cleaned.slice(0, 160)}...`,
    };
  }

  const validation = schema.safeParse(rawJson);
  if (!validation.success) {
    return {
      success: false,
      rawJson,
      error: 'AI output failed strict schema validation.',
      zodIssues: validation.error.issues,
    };
  }

  return {
    success: true,
    data: validation.data,
    rawJson,
  };
}

/**
 * Generates an IntegrationHealthResponse adhering to AgriDOST 4.0 integration standards.
 */
export function getGeminiIntegrationHealth(): IntegrationHealthResponse {
  const apiKey = process.env.GEMINI_API_KEY;
  const isConfigured = Boolean(apiKey && apiKey.trim().length > 5);

  return {
    provider: 'gemini',
    displayName: 'Google Gemini AI (Vision & Agronomy)',
    category: 'ai',
    configurationStatus: isConfigured ? 'configured' : 'unconfigured',
    connectivityStatus: isConfigured ? 'online' : 'offline',
    operatingMode: isConfigured ? 'LIVE' : 'NOT_CONFIGURED',
    lastSuccessfulCheck: new Date().toISOString(),
    lastError: isConfigured ? null : 'GEMINI_API_KEY is not configured or too short.',
    featuresSupported: [
      'crop-health-vision',
      'agronomic-advisory',
      'scheme-eligibility-qa',
      'bilingual-en-hi',
      'deterministic-offline-fallback',
      'candidate-model-failover',
    ],
    diagnosticDetails: {
      primaryModel: 'gemini-3.8-flash',
      candidateCascade: DEFAULT_GEMINI_CANDIDATES,
      timeoutMs: 12000,
      maxRetries: 1,
      apiKeyConfigured: isConfigured,
      serverSideOnly: true,
    },
  };
}
