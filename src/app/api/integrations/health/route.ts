import { NextResponse } from 'next/server';
import { getMasterIntegrationStatus } from '@/lib/integrations';

/**
 * GET /api/integrations/health
 * Returns aggregated health status across all 6 core integrations:
 * Supabase, Gemini, Weather, Market, Telegram, Google Maps.
 */
export async function GET() {
  try {
    const report = await getMasterIntegrationStatus();
    return NextResponse.json(report, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        overallStatus: 'error',
        error: message,
      },
      { status: 500 }
    );
  }
}
