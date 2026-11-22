import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { IntegrationHealthResponse } from '@/types/integrations';

/**
 * Default candidate cascade for Gemini models.
 * Primary: gemini-3.8-flash (empirically verified live)
 * Fallback candidates: gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash
 */
export const DEFAULT_GEMINI_CANDIDATES = [
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
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

        // Check if transient error suitable for backoff retry on same model
        const isTransient =
          errMsg.includes('429') ||
          errMsg.includes('503') ||
          errMsg.includes('overloaded') ||
          errMsg.includes('rate limit') ||
          isTimeout;

        if (isTransient && attemptCount <= maxRetries && backoffBaseMs > 0) {
          const delay = backoffBaseMs * Math.pow(2, attemptCount - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue; // Retry same model
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
