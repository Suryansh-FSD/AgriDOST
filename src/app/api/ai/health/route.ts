import { NextRequest, NextResponse } from 'next/server';
import { AIHealthResponseSchema, HealthApiResponse } from '@/lib/ai/schemas';
import { CROP_HEALTH_SYSTEM_PROMPT, FALLBACK_DIAGNOSTIC_GUIDE } from '@/lib/ai/system-prompt';
import {
  callGeminiWithFailover,
  parseAndValidateWithZod,
  getGeminiIntegrationHealth,
  GeminiContentItem,
} from '@/lib/ai/client';

/**
 * GET /api/ai/health
 * Health check & configuration status endpoint adhering to IntegrationHealthResponse.
 * Lets the UI know if live Gemini API is configured without leaking secrets.
 */
export async function GET() {
  const health = getGeminiIntegrationHealth();
  const apiKey = process.env.GEMINI_API_KEY;
  const isConfigured = Boolean(apiKey && apiKey.trim().length > 5);

  return NextResponse.json({
    ...health,
    // Backward compatibility for existing test suite
    status: isConfigured ? 'available' : 'unavailable',
    apiKeyConfigured: isConfigured,
    model: 'gemini-3.8-flash',
    message: isConfigured
      ? 'Gemini Flash Vision diagnostic engine is online and ready.'
      : 'GEMINI_API_KEY environment variable is not configured. Visual diagnostic will run in pre-diagnostic guide mode.',
  });
}

/**
 * POST /api/ai/health
 * Core endpoint for plant health image diagnosis using Gemini 3.8 / candidate cascade.
 */
export async function POST(req: NextRequest) {
  const analyzedAt = new Date().toISOString();

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    // Parse request body (supports both JSON and FormData)
    let image = '';
    let mimeType = 'image/jpeg';
    let cropName: string | undefined;
    let farmId: string | undefined;
    let zoneId: string | undefined;
    let additionalNotes: string | undefined;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('image');
      cropName = (formData.get('cropName') as string) || undefined;
      farmId = (formData.get('farmId') as string) || undefined;
      zoneId = (formData.get('zoneId') as string) || undefined;
      additionalNotes = (formData.get('additionalNotes') as string) || undefined;

      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const buffer = await (file as Blob).arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        mimeType = (file as Blob).type || 'image/jpeg';
        image = `data:${mimeType};base64,${base64}`;
      } else if (typeof file === 'string') {
        image = file;
      }
    } else {
      const body = await req.json();
      image = body.image || '';
      mimeType = body.mimeType || 'image/jpeg';
      cropName = body.cropName;
      farmId = body.farmId;
      zoneId = body.zoneId;
      additionalNotes = body.additionalNotes;
    }

    if (!image || image.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          error: 'Missing required "image" payload. Provide base64 or multipart file.',
          analyzedAt,
        } as HealthApiResponse,
        { status: 400 }
      );
    }

    // If GEMINI_API_KEY is not configured:
    // Truthfully report unavailable status with pre-diagnostic guide.
    // NEVER fabricate a fake diagnosis pretending to be live AI!
    if (!apiKey || apiKey.trim().length === 0) {
      return NextResponse.json(
        {
          success: true,
          status: 'unavailable',
          message:
            'GEMINI_API_KEY is not configured on this server. Real-time vision analysis requires a Google Gemini API key. Refer to the diagnostic protocol below.',
          fallbackGuide: FALLBACK_DIAGNOSTIC_GUIDE,
          cropName,
          farmId,
          zoneId,
          analyzedAt,
        } as HealthApiResponse,
        { status: 200 }
      );
    }

    // Extract base64 payload and MIME type
    let base64Data = image;
    const dataUrlMatch = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      base64Data = dataUrlMatch[2];
    }

    const userPrompt = `
Analyze this plant leaf/crop photograph for visible pathological symptoms, pest infestation, or physiological stress.
${cropName ? `User-Specified Crop Species: ${cropName}` : 'Please identify the probable crop species from visible foliage morphology.'}
${farmId ? `Associated Farm ID: ${farmId}` : ''}
${zoneId ? `Associated Farm Zone ID: ${zoneId}` : ''}
${additionalNotes ? `Farmer Observations / Context: ${additionalNotes}` : ''}

Strict Instructions:
1. Only record observable physical symptoms directly visible in this image.
2. Present conditions as possible causes (differential diagnoses), never as definitive clinical proofs.
3. Quantify limitations and what physical field tests are missing.
4. Output strictly parseable JSON conforming to the schema.
`.trim();

    const contents: GeminiContentItem[] = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: userPrompt,
          },
        ],
      },
    ];

    // Cascade: gemini-3.8-flash, gemini-2.0-flash, gemini-1.5-flash
    const candidateModels = ['gemini-3.8-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    const aiResult = await callGeminiWithFailover(contents, {
      apiKey,
      candidateModels,
      systemInstruction: CROP_HEALTH_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      maxRetries: 0,
    });

    const parsed = parseAndValidateWithZod(aiResult.text, AIHealthResponseSchema);

    // If text was unparseable as JSON, throw error so 500 handler handles it
    if (!parsed.success && !parsed.rawJson) {
      throw new Error(parsed.error || 'Failed to parse Gemini output as JSON');
    }

    // Strict Zod schema validation failed (returns HTTP 502 Bad Gateway)
    if (!parsed.success) {
      console.error('[Gemini Health API] Schema validation error:', parsed.zodIssues);
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          error: 'AI output failed strict agronomic schema validation.',
          analyzedAt,
        } as HealthApiResponse,
        { status: 502 }
      );
    }

    const validatedData = parsed.data!;

    return NextResponse.json(
      {
        success: true,
        status: validatedData.status,
        data: validatedData,
        cropName: cropName || validatedData.cropAffected,
        farmId,
        zoneId,
        model: aiResult.model,
        message: 'Crop health vision analysis completed successfully.',
        analyzedAt,
      } as HealthApiResponse,
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Internal Server Error during vision analysis.';
    console.error('[Gemini Health API Error]:', err);

    return NextResponse.json(
      {
        success: false,
        status: 'error',
        error: errorMessage,
        analyzedAt,
      } as HealthApiResponse,
      { status: 500 }
    );
  }
}
