import { NextRequest, NextResponse } from 'next/server';
import {
  runAgriculturalResearch,
  AgriculturalResearchRequestSchema,
  persistResearchRecord,
  TinyFishError,
} from '@/lib/integrations/tinyfish';

/**
 * POST /api/tinyfish/research
 * Domain-specific agricultural web research (mandi, schemes, crop advisory, market trends).
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload received in request body.' },
        { status: 400 }
      );
    }

    const validated = AgriculturalResearchRequestSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          issues: validated.error.issues,
        },
        { status: 400 }
      );
    }

    const research = await runAgriculturalResearch(validated.data);

    // Asynchronously persist top official or primary result to Supabase
    if (research.sources.length > 0) {
      const topSource = research.sources[0];
      const ttlHours = 24;
      const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

      persistResearchRecord({
        query: research.query,
        category: research.category,
        provider: 'tinyfish',
        source_url: topSource.url,
        source_name: topSource.siteName,
        source_type: topSource.sourceClassification,
        is_official: topSource.isOfficial,
        extracted_summary: research.summary,
        structured_data: research.structuredData || {},
        retrieved_at: research.retrievedAt,
        expires_at: expiresAt,
        status: 'active',
      }).catch((err) => {
        console.warn('[TinyFish Storage] Background persist error:', err);
      });
    }

    return NextResponse.json(
      {
        success: true,
        research,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof TinyFishError) {
      return NextResponse.json(
        {
          success: false,
          code: err.code,
          error: err.message,
        },
        { status: err.status || 500 }
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
