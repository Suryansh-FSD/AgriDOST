import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GovernmentScheme, Farm } from '@/types';
import { getAllSchemes, getSchemeById } from '@/lib/schemes';
import {
  SCHEMES_SYSTEM_PROMPT,
  formatSchemesContext,
  getOfflineSchemeAnswer,
} from '@/lib/ai/schemes-prompt';
import { SupportedLanguage } from '@/lib/i18n';
import {
  callGeminiWithFailover,
  getGeminiIntegrationHealth,
  DEFAULT_GEMINI_CANDIDATES,
} from '@/lib/ai/client';

/**
 * Zod Schema for Scheme AI Request validation.
 */
export const SchemeAiRequestSchema = z.object({
  message: z.string().min(1, 'Message is required and cannot be empty'),
  schemeId: z.string().optional(),
  farmContext: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      areaAcres: z.number().optional(),
      areaSqM: z.number().optional(),
      primaryCrop: z.string().optional(),
      soilType: z.string().optional(),
      waterSource: z.string().optional(),
      irrigationType: z.string().optional(),
      locationDetails: z
        .object({
          state: z.string().optional(),
          district: z.string().optional(),
          village: z.string().optional(),
          city: z.string().optional(),
          country: z.string().optional(),
          pincode: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  lang: z.enum(['en', 'hi']).default('en'),
});

export type SchemeAiRequestBody = z.infer<typeof SchemeAiRequestSchema>;

/**
 * GET /api/ai/schemes
 * Health check & configuration status endpoint for Scheme AI Advisor.
 */
export async function GET() {
  const health = getGeminiIntegrationHealth();
  const apiKey = process.env.GEMINI_API_KEY;
  const isConfigured = Boolean(apiKey && apiKey.trim().length > 5);

  return NextResponse.json({
    ...health,
    status: isConfigured ? 'available' : 'unavailable',
    apiKeyConfigured: isConfigured,
    model: 'gemini-3.8-flash',
    fallbackEngine: 'deterministic-offline-registry-v1',
    supportedLanguages: ['en', 'hi'],
    message: isConfigured
      ? 'Gemini Flash scheme intelligence engine is online and ready.'
      : 'GEMINI_API_KEY is not configured on this server. Scheme advisor will run in verified offline deterministic mode.',
  });
}

/**
 * POST /api/ai/schemes
 * Core endpoint for grounded scheme guidance with anti-hallucination guardrails.
 */
export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Invalid JSON payload received in request body.',
        },
        { status: 400 }
      );
    }

    // 1. Zod Validation
    const validationResult = SchemeAiRequestSchema.safeParse(rawBody);
    if (!validationResult.success) {
      const issue = validationResult.error.issues[0];
      return NextResponse.json(
        {
          status: 'error',
          error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error',
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { message, schemeId, farmContext, lang } = validationResult.data;

    // 2. Fetch verified schemes from the registry
    let schemesInContext: GovernmentScheme[] = [];
    if (schemeId) {
      const singleScheme = getSchemeById(schemeId);
      if (singleScheme) {
        schemesInContext = [singleScheme];
      } else {
        schemesInContext = getAllSchemes();
      }
    } else {
      schemesInContext = getAllSchemes();
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isLiveAiAvailable = Boolean(apiKey && apiKey.trim().length > 5);

    // 3. OFFLINE FALLBACK (when GEMINI_API_KEY is absent)
    if (!isLiveAiAvailable) {
      const offlineResult = getOfflineSchemeAnswer(
        message,
        schemesInContext,
        farmContext as Farm,
        lang as SupportedLanguage
      );

      return NextResponse.json({
        status: 'offline_fallback',
        answer: offlineResult.answer,
        sources: offlineResult.sources,
        verifiedDate: offlineResult.verifiedDate,
        matchedSchemeId: offlineResult.matchedSchemeId,
        isRecognized: offlineResult.isRecognized,
      });
    }

    // 4. LIVE GEMINI INFERENCE with anti-hallucination context injection
    const formattedContext = formatSchemesContext(schemesInContext, farmContext as Farm);

    const userPrompt = `
Language preference: ${lang === 'hi' ? 'HINDI (हिंदी)' : 'ENGLISH'}.
Please respond strictly in ${lang === 'hi' ? 'Hindi (हिंदी)' : 'English'}.

Farmer Question:
"${message}"

${formattedContext}

Remember:
- Only answer using the verified schemes provided above.
- Cite the official portal URL and last verified date.
- Never ask for OTPs or passwords.
- If unknown, state the official refusal referring to KVK / CSC.
`.trim();

    const candidateModels = DEFAULT_GEMINI_CANDIDATES;
    let aiText = '';
    let successfulModel = '';

    try {
      const aiResult = await callGeminiWithFailover(userPrompt, {
        apiKey,
        candidateModels,
        systemInstruction: SCHEMES_SYSTEM_PROMPT,
        temperature: 0.2,
        responseMimeType: 'text/plain',
        maxRetries: 0,
      });
      aiText = aiResult.text;
      successfulModel = aiResult.model;
    } catch (err: unknown) {
      console.warn(
        '[Gemini Schemes AI] All model candidates failed. Seamlessly activating offline deterministic fallback.',
        err
      );

      const offlineResult = getOfflineSchemeAnswer(
        message,
        schemesInContext,
        farmContext as Farm,
        lang as SupportedLanguage
      );

      return NextResponse.json({
        status: 'offline_fallback',
        answer: offlineResult.answer,
        sources: offlineResult.sources,
        verifiedDate: offlineResult.verifiedDate,
        matchedSchemeId: offlineResult.matchedSchemeId,
        fallbackReason: 'Live AI temporarily unavailable; served from verified registry.',
      });
    }

    // Extract citations from the schemes in context
    const sources = schemesInContext.map((s) => ({
      title: s.sourceName || s.name,
      url: s.officialInfoUrl,
      lastVerified: s.lastVerifiedDate,
    }));

    return NextResponse.json({
      status: 'success',
      answer: aiText,
      sources: sources.slice(0, 3),
      verifiedDate: schemesInContext[0]?.lastVerifiedDate || '2026-11-20',
      model: successfulModel,
    });
  } catch (error: unknown) {
    console.error('[POST /api/ai/schemes] Unexpected error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected internal error occurred in Scheme AI Advisor.';
    return NextResponse.json(
      {
        status: 'error',
        error: message,
      },
      { status: 500 }
    );
  }
}
