import { NextRequest, NextResponse } from 'next/server';
import { N8nEventEnvelope, N8nEventType } from '@/types';
import { dispatchN8nEvent } from '@/lib/n8n/dispatcher';

/**
 * POST /api/n8n/trigger
 * API endpoint to trigger an n8n workflow from the frontend Automation Center
 * or background schedulers.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Request body must be a valid JSON object.' },
        { status: 400 }
      );
    }

    const {
      eventType,
      farmId = 'demo-farm-01',
      farmerId = 'demo-farmer-01',
      payload = {},
      simulated,
      idempotencyKey,
      eventId,
    } = body as Partial<N8nEventEnvelope> & { simulated?: boolean };

    if (!eventType) {
      return NextResponse.json(
        { success: false, error: 'Missing mandatory field "eventType".' },
        { status: 400 }
      );
    }

    const generatedEventId =
      eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const generatedTimestamp = new Date().toISOString();
    const generatedIdempotencyKey =
      idempotencyKey || `${eventType}:${farmId}:${Date.now()}`;

    const envelope: N8nEventEnvelope = {
      eventId: generatedEventId,
      eventType: eventType as N8nEventType,
      timestamp: generatedTimestamp,
      producer: 'agridost-app',
      version: '1.0',
      farmerId,
      farmId,
      payload: payload as Record<string, unknown>,
      idempotencyKey: generatedIdempotencyKey,
    };

    const record = await dispatchN8nEvent(envelope, { simulated });

    return NextResponse.json({
      success: record.status !== 'failed',
      record,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to trigger workflow: ${(err as Error)?.message || 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
