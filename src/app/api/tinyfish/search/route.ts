import { NextRequest, NextResponse } from 'next/server';
import { executeTinySearch, TinySearchRequestSchema, TinyFishError } from '@/lib/integrations/tinyfish';

/**
 * POST /api/tinyfish/search
 * Executes live agricultural web search with source classification and caching.
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

    const validated = TinySearchRequestSchema.safeParse(body);
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

    const result = await executeTinySearch(validated.data);

    return NextResponse.json(
      {
        success: true,
        ...result,
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
