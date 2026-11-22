import { NextRequest, NextResponse } from 'next/server';
import { TelegramUpdate } from '@/types/telegram';
import { defaultTelegramClient } from '@/lib/telegram/client';
import { handleWebhookCommand } from '@/lib/telegram/consent';

/**
 * POST /api/telegram/webhook
 * Inbound webhook handler for Telegram Bot updates.
 *
 * Security:
 * - Validates incoming 'X-Telegram-Bot-Api-Secret-Token' header against TELEGRAM_WEBHOOK_SECRET.
 * - Enforces farmer opt-in (/start) and opt-out (/stop) commands.
 */
export async function POST(req: NextRequest) {
  try {
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const incomingSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');

    // Webhook token authentication
    if (configuredSecret && configuredSecret.trim().length > 0) {
      if (!incomingSecret || incomingSecret !== configuredSecret) {
        return NextResponse.json(
          { ok: false, error: 'Unauthorized: Invalid secret token' },
          { status: 401 }
        );
      }
    }

    const body = (await req.json().catch(() => null)) as TelegramUpdate | null;

    if (!body || typeof body !== 'object' || !body.update_id) {
      return NextResponse.json(
        { ok: false, error: 'Invalid Telegram update payload' },
        { status: 400 }
      );
    }

    const message = body.message || body.edited_message;
    if (!message || !message.text) {
      // Ignored non-text updates (e.g. photos, stickers) gracefully
      return NextResponse.json({ ok: true, ignored: true, reason: 'No text message' });
    }

    const fromUser = message.from || {
      id: message.chat.id,
      is_bot: false,
      first_name: message.chat.first_name || 'Farmer',
    };

    const commandResult = handleWebhookCommand(message.text, fromUser, message.chat);

    // If a bot reply is required, send it back to the farmer
    if (commandResult.handled && commandResult.replyText) {
      try {
        await defaultTelegramClient.sendMessage({
          chat_id: message.chat.id,
          text: commandResult.replyText,
          parse_mode: 'HTML',
        });
      } catch (sendErr) {
        console.warn('[Telegram Webhook] Failed to send automatic reply:', sendErr);
      }
    }

    return NextResponse.json({
      ok: true,
      action: commandResult.action,
      handled: commandResult.handled,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown webhook error';
    console.error('[Telegram Webhook Handler Error]:', err);
    return NextResponse.json(
      { ok: false, error: errorMsg },
      { status: 500 }
    );
  }
}
