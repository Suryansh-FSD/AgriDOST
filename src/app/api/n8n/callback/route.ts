import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/n8n/client';
import { N8nCallbackSchema } from '@/lib/n8n/schemas';
import {
  getExecutionByEventId,
  saveExecutionRecord,
  getN8nConfig,
} from '@/lib/n8n/storage';

/**
 * POST /api/n8n/callback
 * Inbound webhook endpoint receiving workflow results, state updates,
 * and delivery confirmations from n8n.
 *
 * Security Requirements:
 * 1. HMAC-SHA256 signature verification (X-AgriDOST-Signature)
 * 2. Replay attack drift check (<= 300 seconds)
 * 3. Zod schema validation
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader =
      req.headers.get('x-agridost-signature') || req.headers.get('X-AgriDOST-Signature');

    const config = getN8nConfig();
    const secret =
      process.env.N8N_WEBHOOK_SECRET ||
      config.webhookSecret ||
      'agridost_hmac_webhook_signing_secret_2026';

    // 1. Verify HMAC Signature & Replay Drift
    const verification = verifyWebhookSignature(rawBody, signatureHeader, secret, 300);

    if (!verification.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Webhook signature verification failed.',
          reason: verification.reason,
        },
        { status: 401 }
      );
    }

    // 2. Parse & Validate Payload
    let jsonBody: unknown;
    try {
      jsonBody = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Malformed JSON payload.' },
        { status: 400 }
      );
    }

    const parseResult = N8nCallbackSchema.safeParse(jsonBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Callback payload failed schema validation.',
          issues: parseResult.error.issues,
        },
        { status: 422 }
      );
    }

    const callbackData = parseResult.data;

    // 3. Find and update existing execution record
    const existingRecord = getExecutionByEventId(callbackData.eventId);
    if (existingRecord) {
      const updated = {
        ...existingRecord,
        status: callbackData.status,
        outputSummary: callbackData.outputSummary || existingRecord.outputSummary,
        outputData: {
          ...existingRecord.outputData,
          ...callbackData.outputData,
        },
        error: callbackData.error
          ? {
              code: callbackData.error.code,
              message: callbackData.error.message,
              retryable: callbackData.error.retryable ?? false,
            }
          : existingRecord.error,
        completedAt: callbackData.completedAt || new Date().toISOString(),
        durationMs: callbackData.durationMs || existingRecord.durationMs,
      };
      saveExecutionRecord(updated);

      return NextResponse.json({
        success: true,
        message: `Execution record ${existingRecord.id} updated.`,
        eventId: callbackData.eventId,
        status: callbackData.status,
      });
    }

    // Acknowledge receipt even if execution record was not locally tracked
    return NextResponse.json({
      success: true,
      message: 'Callback received and verified (no prior local record found).',
      eventId: callbackData.eventId,
      status: callbackData.status,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: `Internal server error processing callback: ${(err as Error)?.message || 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
