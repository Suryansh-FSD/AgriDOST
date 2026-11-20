import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { AIHealthResponseSchema, HealthApiResponse } from '@/lib/ai/schemas';
import { CROP_HEALTH_SYSTEM_PROMPT, FALLBACK_DIAGNOSTIC_GUIDE } from '@/lib/ai/system-prompt';

/**
 * GET /api/ai/health
 * Health check & configuration status endpoint.
 * Lets the UI know if live Gemini API is configured without leaking the secret.
 */
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  const isConfigured = Boolean(apiKey && apiKey.trim().length > 5);

  return NextResponse.json({
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
 * Core endpoint for plant health image diagnosis using Gemini 2.5 Flash.
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

    // Initialize Google GenAI client
    const ai = new GoogleGenAI({ apiKey });

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

    const modelCandidates = ['gemini-3.8-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of modelCandidates) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: [
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
          ],
          config: {
            systemInstruction: CROP_HEALTH_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
          },
        });
        if (response && response.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Model ${modelName} candidate error, trying next]:`, err?.message || err);
      }
    }

    if (!response) {
      throw lastError || new Error('All Gemini model candidates failed to generate content.');
    }

    const responseText = response.text || '';
    if (!responseText.trim()) {
      throw new Error('Gemini API returned an empty text response.');
    }

    // Clean potential markdown fencing
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(cleanJson);
    } catch {
      throw new Error(`Failed to parse Gemini output as JSON: ${cleanJson.slice(0, 200)}...`);
    }

    // Strict Zod schema validation
    const validationResult = AIHealthResponseSchema.safeParse(parsedRaw);
    if (!validationResult.success) {
      console.error('[Gemini Health API] Schema validation error:', validationResult.error.format());
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

    const validatedData = validationResult.data;

    return NextResponse.json(
      {
        success: true,
        status: validatedData.status,
        data: validatedData,
        cropName: cropName || validatedData.cropAffected,
        farmId,
        zoneId,
        message: 'Crop health vision analysis completed successfully.',
        analyzedAt,
      } as HealthApiResponse,
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Internal Server Error during vision analysis.';
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
