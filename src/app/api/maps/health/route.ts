import { NextResponse } from 'next/server';
import { getMapsHealth } from '@/lib/maps';

/**
 * GET /api/maps/health
 * Returns the integration health status for Google Maps and Vector SVG Cadastre.
 * Conforms to AgriDOST 4.0 IntegrationHealthResponse contract.
 */
export async function GET() {
  try {
    const health = await getMapsHealth();
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
        provider: 'google-maps',
        displayName: 'Google Maps JavaScript API',
        category: 'geospatial',
        configurationStatus: 'unconfigured',
        connectivityStatus: 'offline',
        operatingMode: 'ERROR',
        lastSuccessfulCheck: null,
        lastError: message,
        dataFreshness: {
          timestamp: new Date().toISOString(),
          provenance: 'offline_deterministic',
        },
      },
      { status: 500 }
    );
  }
}
