import { NextRequest, NextResponse } from 'next/server';
import { TelegramNotification } from '@/types/telegram';
import { hasConsent } from '@/lib/telegram/consent';
import { sendTelegramNotification } from '@/lib/telegram';

/**
 * POST /api/telegram/send
 * Server-side notification dispatch endpoint.
 *
 * CRITICAL RULE: NEVER send notifications without explicit farmer consent!
 * Rejects with 403 Forbidden if the recipient farmerId has not opted in.
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
      id,
      farmerId,
      chatId,
      category,
      priority = 'medium',
      titleEn,
      bodyEn,
      titleHi,
      bodyHi,
      metadata,
      force = false,
      languageMode,
    } = body as Partial<TelegramNotification> & {
      force?: boolean;
      languageMode?: 'en' | 'hi' | 'mr' | 'bilingual';
    };

    // 1. Validate Required Fields
    if (!farmerId || typeof farmerId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing required field: farmerId' },
        { status: 400 }
      );
    }

    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing required field: category' },
        { status: 400 }
      );
    }

    if (!titleEn || !bodyEn) {
      return NextResponse.json(
        { success: false, error: 'Missing required notification text (titleEn and bodyEn are required).' },
        { status: 400 }
      );
    }

    // 2. Strict Consent Verification
    const isOptedIn = hasConsent(farmerId);
    if (!isOptedIn) {
      return NextResponse.json(
        {
          success: false,
          error: 'FARMER_NOT_OPTED_IN',
          message: `Farmer '${farmerId}' has not granted explicit opt-in consent to receive Telegram notifications.`,
          consentRequired: true,
        },
        { status: 403 }
      );
    }

    // 3. Construct Notification Payload
    const notification: TelegramNotification = {
      id: id || `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      farmerId,
      chatId,
      category: category as any,
      priority: priority as any,
      titleEn,
      bodyEn,
      titleHi: titleHi || titleEn,
      bodyHi: bodyHi || bodyEn,
      metadata,
    };

    // 4. Dispatch with Deduplication and Bilingual Formatting
    const result = await sendTelegramNotification(notification, {
      force,
      languageMode,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Delivery failed',
          result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        delivered: !result.wasDeduplicated,
        wasDeduplicated: Boolean(result.wasDeduplicated),
        messageId: result.messageId,
        deliveredAt: result.deliveredAt,
        farmerId: result.farmerId,
        chatId: result.chatId,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[Telegram Send API Error]:', err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
