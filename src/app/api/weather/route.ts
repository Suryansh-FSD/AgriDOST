/**
 * AgriDOST 4.0: Weather Server API Route Handler
 * Endpoint: /api/weather
 * 
 * Supports:
 * - Query Parameters:
 *   - lat (number, default: 20.00 - Nashik)
 *   - lon (number, default: 73.78 - Nashik)
 *   - forceRefresh (boolean, default: false)
 *   - mode ('health' | 'data', default: 'data')
 *   - health (boolean flag shortcut for health check)
 * 
 * Response formats:
 * - Health check: returns IntegrationHealthResponse
 * - Full data: returns { success: true, data: FarmWeatherResponse, health: IntegrationHealthResponse }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_FARM_COORDINATES,
  fetchFarmWeather,
  getWeatherHealthCheck,
} from '@/lib/weather';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Check for health check request
    const mode = searchParams.get('mode');
    const isHealthRequested = mode === 'health' || searchParams.get('health') === 'true';

    if (isHealthRequested) {
      const health = await getWeatherHealthCheck();
      return NextResponse.json(health, { status: 200 });
    }

    // Parse latitude and longitude
    const latParam = searchParams.get('lat');
    const lonParam = searchParams.get('lon');
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    let latitude = DEFAULT_FARM_COORDINATES.latitude;
    let longitude = DEFAULT_FARM_COORDINATES.longitude;

    if (latParam !== null) {
      const parsedLat = parseFloat(latParam);
      if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid latitude parameter. Must be a valid float between -90 and 90.',
          },
          { status: 400 }
        );
      }
      latitude = parsedLat;
    }

    if (lonParam !== null) {
      const parsedLon = parseFloat(lonParam);
      if (isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid longitude parameter. Must be a valid float between -180 and 180.',
          },
          { status: 400 }
        );
      }
      longitude = parsedLon;
    }

    // Retrieve farm weather data (with caching & fallback)
    const weatherData = await fetchFarmWeather({
      latitude,
      longitude,
      forceRefresh,
    });

    // Generate accompanying health status
    const health = await getWeatherHealthCheck();

    return NextResponse.json(
      {
        success: true,
        data: weatherData,
        health,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=900',
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown weather API error';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
