import { NextRequest, NextResponse } from 'next/server';
import {
  AgronomicAdvisoryRequestSchema,
  AgronomicAdvisorySchema,
  AdvisoryApiResponse,
} from '@/lib/ai/schemas';
import {
  AGRONOMIC_ADVISORY_SYSTEM_PROMPT,
  getOfflineAgronomicAdvisory,
} from '@/lib/ai/system-prompt';
import {
  callGeminiWithFailover,
  parseAndValidateWithZod,
  getGeminiIntegrationHealth,
  DEFAULT_GEMINI_CANDIDATES,
} from '@/lib/ai/client';

/**
 * GET /api/ai/advisory
 * Health check & configuration status endpoint for Agronomic Advisory Engine.
 */
export async function GET() {
  const health = getGeminiIntegrationHealth();
  const apiKey = process.env.GEMINI_API_KEY;
  const isConfigured = Boolean(apiKey && apiKey.trim().length > 5);

  return NextResponse.json({
    ...health,
    endpoint: '/api/ai/advisory',
    description: 'ICAR / KVK / CIBRC Grounded Agronomic Advisory Intelligence Engine',
    status: isConfigured ? 'available' : 'unavailable',
    apiKeyConfigured: isConfigured,
    model: 'gemini-3.8-flash',
    supportedLanguages: ['en', 'hi'],
    cibrcComplianceEnforced: true,
    offlineFallbackEngine: 'icar-kvk-package-of-practices-v1',
    message: isConfigured
      ? 'Gemini Agronomic Advisory engine is online and ready.'
      : 'GEMINI_API_KEY is not configured on this server. Running in verified ICAR/KVK offline advisory mode.',
  });
}

/**
 * POST /api/ai/advisory
 * Generates grounded, ICAR/KVK-compliant seasonal agronomic advisories with bilingual support.
 */
export async function POST(req: NextRequest) {
  const generatedAt = new Date().toISOString();

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          error: 'Invalid JSON payload received in request body.',
          generatedAt,
        } as AdvisoryApiResponse,
        { status: 400 }
      );
    }

    // 1. Validate request body against Zod schema
    const validationResult = AgronomicAdvisoryRequestSchema.safeParse(rawBody);
    if (!validationResult.success) {
      const issue = validationResult.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error',
          generatedAt,
        } as AdvisoryApiResponse,
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const apiKey = process.env.GEMINI_API_KEY;
    const isLiveAiAvailable = Boolean(apiKey && apiKey.trim().length > 5);

    // 2. OFFLINE FALLBACK (Deterministic Grounded ICAR/KVK Registry)
    if (!isLiveAiAvailable) {
      const offlineAdvisory = getOfflineAgronomicAdvisory(data);
      return NextResponse.json(
        {
          success: true,
          status: 'offline_fallback',
          data: offlineAdvisory,
          source: 'icar_kvk_offline_registry',
          message:
            'GEMINI_API_KEY not configured. Serving verified offline advisory from ICAR/KVK package of practices.',
          generatedAt,
        } as AdvisoryApiResponse,
        { status: 200 }
      );
    }

    // 3. LIVE GEMINI INFERENCE
    const langPrompt =
      data.language === 'hi'
        ? 'LANGUAGE REQUIREMENT: Strictly respond in fluent, respectful, and standard HINDI (हिंदी - Devanagari script).'
        : 'LANGUAGE REQUIREMENT: Respond in clear, professional agricultural ENGLISH.';

    const userPrompt = `
${langPrompt}

Target Crop: ${data.cropName}
Growth Stage: ${data.cropStage || 'Vegetative'}
${data.soilType ? `Soil Characteristics: ${data.soilType}` : ''}
${data.locationDetails?.state ? `State: ${data.locationDetails.state}` : ''}
${data.locationDetails?.district ? `District: ${data.locationDetails.district}` : ''}
${
  data.weatherContext
    ? `Current & Forecast Weather: Temp: ${data.weatherContext.temperature ?? 'N/A'}°C, Humidity: ${
        data.weatherContext.humidity ?? 'N/A'
      }%, Forecast Rain: ${data.weatherContext.rainfallForecastMm ?? 0} mm, Sky: ${
        data.weatherContext.conditions ?? 'Normal'
      }`
    : ''
}
${data.farmerQuestion ? `Farmer Specific Query: "${data.farmerQuestion}"` : ''}

Strict Grounding Instructions:
1. Provide actionable ICAR/KVK compliant recommendations for this crop and stage.
2. Only specify CIBRC approved treatments with safe waiting periods (PHI) in days.
3. Recommend bio-pesticides or organic alternatives (e.g. Neem oil, Trichoderma) alongside chemicals.
4. If rain is expected (>10mm), explicitly advise against foliar spraying in the contingency block.
5. Return strictly parseable JSON conforming to the AgronomicAdvisory schema.
`.trim();

    const candidateModels = DEFAULT_GEMINI_CANDIDATES;
    let aiResultText = '';
    let successfulModel = '';

    try {
      const callResult = await callGeminiWithFailover(userPrompt, {
        apiKey,
        candidateModels,
        systemInstruction: AGRONOMIC_ADVISORY_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxRetries: 0,
      });

      aiResultText = callResult.text;
      successfulModel = callResult.model;
    } catch (aiErr: unknown) {
      console.warn(
        '[Gemini Advisory API] Live model cascade failed. Seamlessly activating offline deterministic fallback.',
        aiErr
      );

      const offlineAdvisory = getOfflineAgronomicAdvisory(data);
      return NextResponse.json(
        {
          success: true,
          status: 'offline_fallback',
          data: offlineAdvisory,
          source: 'icar_kvk_offline_registry',
          message:
            'Live Gemini AI temporarily unavailable or timed out; served from verified ICAR/KVK package of practices.',
          generatedAt,
        } as AdvisoryApiResponse,
        { status: 200 }
      );
    }

    // 4. Validate output strictly against AgronomicAdvisorySchema
    const parsed = parseAndValidateWithZod(aiResultText, AgronomicAdvisorySchema);

    // If text was unparseable as JSON, throw 500 error
    if (!parsed.success && !parsed.rawJson) {
      throw new Error(parsed.error || 'Failed to parse Gemini output as JSON');
    }

    // Strict Zod schema validation failed (returns HTTP 502 Bad Gateway)
    if (!parsed.success) {
      console.error('[Gemini Advisory API] Schema validation error:', parsed.zodIssues);
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          error: 'AI advisory failed strict agronomic schema validation.',
          generatedAt,
        } as AdvisoryApiResponse,
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: 'live',
        data: parsed.data,
        model: successfulModel,
        source: 'gemini_live',
        generatedAt,
      } as AdvisoryApiResponse,
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('[POST /api/ai/advisory] Unexpected error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected internal error occurred in Agronomic Advisory Engine.';

    return NextResponse.json(
      {
        success: false,
        status: 'error',
        error: message,
        generatedAt,
      } as AdvisoryApiResponse,
      { status: 500 }
    );
  }
}
