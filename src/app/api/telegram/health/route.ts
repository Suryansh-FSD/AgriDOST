import { NextResponse } from 'next/server';
import { getTelegramHealth } from '@/lib/telegram';

/**
 * GET /api/telegram/health
 * Health check & diagnostic endpoint conforming to AgriDOST 4.0 IntegrationHealthResponse contract.
 */
export async function GET() {
  const health = await getTelegramHealth();
  return NextResponse.json(health, { status: 200 });
}
