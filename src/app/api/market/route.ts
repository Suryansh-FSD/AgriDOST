/**
 * AgriDOST 4.0: Market Intelligence API Route
 * GET /api/market
 * 
 * Supports:
 * - Querying live/cached/benchmark Agmarknet mandi wholesale prices.
 * - Minimum Support Price (MSP) distress sentinel comparison.
 * - Farm financial break-even and profit margin estimation.
 * - Dedicated health check via ?check=health or ?action=health.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getMarketIntelligence,
  getMarketHealth,
  MarketPriceUnavailableError,
} from '@/lib/market';
import { MarketApiResponse } from '@/types/market';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Health check routing
    const check = searchParams.get('check');
    const action = searchParams.get('action');
    if (check === 'health' || action === 'health') {
      const health = await getMarketHealth();
      return NextResponse.json(health, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // 2. Query parameter extraction
    const commodity = searchParams.get('commodity');
    if (!commodity || commodity.trim() === '') {
      const errorPayload: MarketApiResponse = {
        success: false,
        error: "Missing required query parameter: 'commodity' (e.g. ?commodity=Wheat)",
        code: 'MISSING_COMMODITY',
      };
      return NextResponse.json(errorPayload, { status: 400 });
    }

    const state = searchParams.get('state') || undefined;
    const district = searchParams.get('district') || undefined;
    const market = searchParams.get('market') || undefined;
    const variety = searchParams.get('variety') || undefined;

    // Financial parameters
    const costParam = searchParams.get('cost');
    const yieldParam = searchParams.get('yieldTonnes') || searchParams.get('yield');
    const targetPriceParam = searchParams.get('targetPrice');

    let financialParams = undefined;
    if (yieldParam && costParam) {
      const expectedYieldTonnes = parseFloat(yieldParam);
      const totalInputCostInr = parseFloat(costParam);

      if (isNaN(expectedYieldTonnes) || expectedYieldTonnes <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Parameter 'yieldTonnes' must be a positive number greater than 0.",
            code: 'INVALID_YIELD',
          },
          { status: 400 }
        );
      }

      if (isNaN(totalInputCostInr) || totalInputCostInr < 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Parameter 'cost' must be a non-negative number.",
            code: 'INVALID_COST',
          },
          { status: 400 }
        );
      }

      financialParams = {
        expectedYieldTonnes,
        totalInputCostInr,
      };
    }

    let targetPriceInrPerQtl = undefined;
    if (targetPriceParam) {
      const parsed = parseFloat(targetPriceParam);
      if (!isNaN(parsed) && parsed > 0) {
        targetPriceInrPerQtl = parsed;
      }
    }

    // 3. Execution pipeline
    const result = await getMarketIntelligence({
      filters: {
        commodity: commodity.trim(),
        state,
        district,
        market,
        variety,
      },
      financialParams,
      targetPriceInrPerQtl,
    });

    const responsePayload: MarketApiResponse = {
      success: true,
      data: result,
    };

    return NextResponse.json(responsePayload, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error: unknown) {
    if (error instanceof MarketPriceUnavailableError) {
      const responsePayload: MarketApiResponse = {
        success: false,
        error: error.message,
        code: error.code,
      };
      return NextResponse.json(responsePayload, { status: 404 });
    }

    const message = error instanceof Error ? error.message : String(error);
    const responsePayload: MarketApiResponse = {
      success: false,
      error: `Internal server error during market intelligence processing: ${message}`,
      code: 'INTERNAL_ERROR',
    };
    return NextResponse.json(responsePayload, { status: 500 });
  }
}
