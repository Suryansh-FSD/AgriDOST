import { NextResponse } from 'next/server';
import { getSupabaseHealth } from '@/lib/supabase/health';

/**
 * GET /api/supabase/health
 * Returns AgriDOST 4.0 standard IntegrationHealthResponse for Supabase.
 * Evaluates GoTrue Auth Gateway readiness, PostgREST schema cache,
 * latency measurement, and operating mode transitions (LIVE, SIMULATED, OFFLINE, NOT_CONFIGURED, ERROR).
 */
export async function GET() {
  try {
    const health = await getSupabaseHealth();
    const httpStatus = health.operatingMode === 'ERROR' ? 503 : 200;

    return NextResponse.json(health, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        provider: 'supabase',
        displayName: 'Supabase Cloud Database & RLS',
        category: 'database',
        configurationStatus: 'unconfigured',
        connectivityStatus: 'offline',
        operatingMode: 'ERROR',
        lastSuccessfulCheck: null,
        lastError: message,
        dataFreshness: {
          timestamp: new Date().toISOString(),
          provenance: 'offline_deterministic',
        },
        diagnosticDetails: {
          error: message,
        },
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}
