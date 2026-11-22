import { NextResponse } from 'next/server';
import { getTinyFishHealth } from '@/lib/integrations/tinyfish';

/**
 * GET /api/tinyfish/health
 * Returns live health and configuration status for TinyFish AI Web Intelligence.
 */
export async function GET() {
  try {
    const health = await getTinyFishHealth();
    return NextResponse.json(health, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        provider: 'tinyfish',
        displayName: 'TinyFish Web Intelligence',
        category: 'web-intelligence',
        configurationStatus: 'unconfigured',
        connectivityStatus: 'unreachable',
        operatingMode: 'ERROR',
        lastSuccessfulCheck: null,
        lastError: message,
      },
      { status: 500 }
    );
  }
}
