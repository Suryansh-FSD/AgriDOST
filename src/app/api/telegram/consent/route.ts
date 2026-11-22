import { NextRequest, NextResponse } from 'next/server';
import {
  getConsentByChatId,
  getConsentByFarmerId,
  registerConsent,
  revokeConsent,
  listConsents,
} from '@/lib/telegram/consent';

/**
 * GET /api/telegram/consent
 * Check farmer consent & opt-in status by farmerId or chatId.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const farmerId = searchParams.get('farmerId');
    const chatId = searchParams.get('chatId');

    if (!farmerId && !chatId) {
      // If neither specified, return summary of all registered consents (for admin/monitoring)
      const consents = listConsents();
      return NextResponse.json({
        success: true,
        total: consents.length,
        activeOptIns: consents.filter((c) => c.optInStatus).length,
        consents,
      });
    }

    const consent = farmerId
      ? getConsentByFarmerId(farmerId)
      : chatId
      ? getConsentByChatId(chatId)
      : null;

    if (!consent) {
      return NextResponse.json({
        success: true,
        optedIn: false,
        message: 'No consent record found for the provided identifier.',
      });
    }

    return NextResponse.json({
      success: true,
      optedIn: consent.optInStatus,
      consent,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to query consent';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/telegram/consent
 * Grant, update, or revoke consent for a farmer.
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
      farmerId,
      chatId,
      optInStatus = true,
      languagePreference = 'hi',
      username,
      metadata,
    } = body;

    if (!farmerId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: farmerId' },
        { status: 400 }
      );
    }

    // Revocation request
    if (optInStatus === false) {
      const revoked = revokeConsent({ farmerId, chatId });
      const record = getConsentByFarmerId(farmerId);
      return NextResponse.json({
        success: true,
        optedIn: false,
        revoked,
        consent: record,
        message: `Consent revoked for farmer '${farmerId}'. No further alerts will be sent.`,
      });
    }

    // Opt-in / Registration request
    if (!chatId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: chatId is required to register consent' },
        { status: 400 }
      );
    }

    const record = registerConsent({
      farmerId,
      chatId,
      username,
      languagePreference,
      metadata,
    });

    return NextResponse.json({
      success: true,
      optedIn: true,
      consent: record,
      message: `Explicit consent recorded for farmer '${farmerId}' on chat ${chatId}.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to process consent update';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
