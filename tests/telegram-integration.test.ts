/**
 * AgriDOST 4.0: Comprehensive Telegram Integration Test Suite
 *
 * Verifies:
 * 1. Strict Farmer Consent Enforcement (CRITICAL RULE: No messages without opt-in)
 * 2. Opt-in (/start) and Opt-out (/stop, /unsubscribe) Webhook Commands
 * 3. 24-Hour Notification Deduplication & Idempotency
 * 4. Bilingual Notification Templates & Clean Emoji Formatting
 * 5. Telegram Bot API Client, Error Handling & Secret Redaction
 * 6. Webhook Authentication (X-Telegram-Bot-Api-Secret-Token)
 * 7. Next.js Server API Routes (/send, /webhook, /consent, /health)
 * 8. Standard IntegrationHealthResponse Contract Conformance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Domain Types
import {
  TelegramNotification,
  FarmerConsentRecord,
  TelegramDeliveryResult,
} from '@/types/telegram';
import { IntegrationHealthResponse } from '@/types/integrations';

// Telegram Lib Modules
import { TelegramClient } from '@/lib/telegram/client';
import {
  registerConsent,
  revokeConsent,
  hasConsent,
  getConsentByFarmerId,
  getConsentByChatId,
  updateLanguagePreference,
  clearConsentStore,
  handleWebhookCommand,
  listConsents,
} from '@/lib/telegram/consent';
import {
  formatNotification,
  buildWeatherNotification,
  buildCropHealthNotification,
  buildSchemeNotification,
  buildMarketNotification,
  buildTaskNotification,
} from '@/lib/telegram/templates';
import {
  isDuplicate,
  recordDelivery,
  checkAndRecord,
  clearDedupCache,
  getNotificationDedupKey,
  getDedupStats,
} from '@/lib/telegram/dedup';
import { sendTelegramNotification } from '@/lib/telegram';

// API Route Handlers
import { POST as webhookRoute } from '@/app/api/telegram/webhook/route';
import { POST as sendRoute } from '@/app/api/telegram/send/route';
import { GET as consentGetRoute, POST as consentPostRoute } from '@/app/api/telegram/consent/route';
import { GET as healthRoute } from '@/app/api/telegram/health/route';

describe('AgriDOST 4.0: Telegram Bot Integration Test Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    clearConsentStore();
    clearDedupCache();
    process.env = { ...originalEnv };
    process.env.TELEGRAM_BOT_TOKEN = '123456789:ABCDefGhIJklMnOpQrStUvWxYz-TestToken';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'agridost-secret-webhook-token-2026';
    process.env.TELEGRAM_SIMULATED_MODE = 'true';
  });

  afterEach(() => {
    process.env = originalEnv;
    clearConsentStore();
    clearDedupCache();
  });

  // =========================================================================
  // 1. FARMER CONSENT & OPT-IN MANAGEMENT (CRITICAL RULE)
  // =========================================================================
  describe('1. Farmer Consent & Opt-In Management', () => {
    it('should strictly return false for farmers without explicit consent', () => {
      expect(hasConsent('unknown-farmer-999')).toBe(false);
      expect(getConsentByFarmerId('unknown-farmer-999')).toBeNull();
    });

    it('should grant and store opt-in consent successfully', () => {
      const record = registerConsent({
        farmerId: 'farmer-punjab-01',
        chatId: 987654321,
        username: 'gurpreet_kisan',
        languagePreference: 'hi',
      });

      expect(record.farmerId).toBe('farmer-punjab-01');
      expect(record.chatId).toBe(987654321);
      expect(record.optInStatus).toBe(true);
      expect(record.languagePreference).toBe('hi');
      expect(hasConsent('farmer-punjab-01')).toBe(true);

      const fetched = getConsentByFarmerId('farmer-punjab-01');
      expect(fetched?.optInStatus).toBe(true);
      expect(fetched?.username).toBe('gurpreet_kisan');
    });

    it('should query consent by Telegram chat ID', () => {
      registerConsent({
        farmerId: 'farmer-haryana-02',
        chatId: 88776655,
        languagePreference: 'en',
      });

      const found = getConsentByChatId(88776655);
      expect(found).not.toBeNull();
      expect(found?.farmerId).toBe('farmer-haryana-02');
    });

    it('should immediately revoke consent on unsubscribe/stop', () => {
      registerConsent({
        farmerId: 'farmer-up-03',
        chatId: 77665544,
      });
      expect(hasConsent('farmer-up-03')).toBe(true);

      const revoked = revokeConsent({ farmerId: 'farmer-up-03' });
      expect(revoked).toBe(true);
      expect(hasConsent('farmer-up-03')).toBe(false);

      const record = getConsentByFarmerId('farmer-up-03');
      expect(record?.optInStatus).toBe(false);
      expect(record?.revokedTimestamp).toBeDefined();
    });

    it('should allow updating preferred language', () => {
      registerConsent({
        farmerId: 'farmer-mh-04',
        chatId: 66554433,
        languagePreference: 'hi',
      });

      const updated = updateLanguagePreference('farmer-mh-04', 'mr');
      expect(updated).toBe(true);

      const record = getConsentByFarmerId('farmer-mh-04');
      expect(record?.languagePreference).toBe('mr');
    });
  });

  // =========================================================================
  // 2. WEBHOOK COMMAND PROCESSING (/start, /stop, /lang, /help, /status)
  // =========================================================================
  describe('2. Telegram Webhook Command Processing', () => {
    it('should handle /start <farmer_id> and record explicit opt-in', () => {
      const result = handleWebhookCommand(
        '/start farmer_mh_101',
        { id: 11223344, is_bot: false, first_name: 'Ramesh', username: 'ramesh_k' },
        { id: 11223344, type: 'private', first_name: 'Ramesh' }
      );

      expect(result.handled).toBe(true);
      expect(result.action).toBe('opt_in');
      expect(result.record?.farmerId).toBe('farmer_mh_101');
      expect(result.record?.optInStatus).toBe(true);
      expect(result.replyText).toContain('Welcome to AgriDOST Alerts');
      expect(result.replyText).toContain('farmer_mh_101');
      expect(hasConsent('farmer_mh_101')).toBe(true);
    });

    it('should handle /start without parameter by generating default chat-based farmer ID', () => {
      const result = handleWebhookCommand(
        '/start',
        { id: 55443322, is_bot: false, first_name: 'Suresh' },
        { id: 55443322, type: 'private' }
      );

      expect(result.handled).toBe(true);
      expect(result.action).toBe('opt_in');
      expect(result.record?.farmerId).toBe('farmer_55443322');
      expect(hasConsent('farmer_55443322')).toBe(true);
    });

    it('should handle /stop and /unsubscribe by revoking consent immediately', () => {
      registerConsent({ farmerId: 'farmer_stop_test', chatId: 99001122 });
      expect(hasConsent('farmer_stop_test')).toBe(true);

      const stopResult = handleWebhookCommand(
        '/stop',
        { id: 99001122, is_bot: false, first_name: 'Farmer' },
        { id: 99001122, type: 'private' }
      );

      expect(stopResult.handled).toBe(true);
      expect(stopResult.action).toBe('opt_out');
      expect(stopResult.replyText).toContain('AgriDOST Alert Service Deactivated');
      expect(hasConsent('farmer_stop_test')).toBe(false);

      // Repeat with /unsubscribe
      registerConsent({ farmerId: 'farmer_unsub_test', chatId: 99001123 });
      const unsubResult = handleWebhookCommand(
        '/unsubscribe',
        { id: 99001123, is_bot: false, first_name: 'Farmer' },
        { id: 99001123, type: 'private' }
      );
      expect(unsubResult.action).toBe('opt_out');
      expect(hasConsent('farmer_unsub_test')).toBe(false);
    });

    it('should handle /lang command to change language preference', () => {
      registerConsent({ farmerId: 'farmer_lang_test', chatId: 33445566, languagePreference: 'hi' });

      const langResult = handleWebhookCommand(
        '/lang en',
        { id: 33445566, is_bot: false, first_name: 'Farmer' },
        { id: 33445566, type: 'private' }
      );

      expect(langResult.handled).toBe(true);
      expect(langResult.action).toBe('language_change');
      expect(langResult.replyText).toContain('English');

      const record = getConsentByFarmerId('farmer_lang_test');
      expect(record?.languagePreference).toBe('en');
    });

    it('should handle /status command and show subscription state', () => {
      registerConsent({ farmerId: 'farmer_status_test', chatId: 44556677 });

      const res = handleWebhookCommand(
        '/status',
        { id: 44556677, is_bot: false, first_name: 'Farmer' },
        { id: 44556677, type: 'private' }
      );

      expect(res.handled).toBe(true);
      expect(res.action).toBe('status');
      expect(res.replyText).toContain('ACTIVE ✅');
      expect(res.replyText).toContain('farmer_status_test');
    });

    it('should handle /help command with command menu and privacy commitment', () => {
      const res = handleWebhookCommand(
        '/help',
        { id: 12345, is_bot: false, first_name: 'Farmer' },
        { id: 12345, type: 'private' }
      );

      expect(res.handled).toBe(true);
      expect(res.action).toBe('help');
      expect(res.replyText).toContain('/start');
      expect(res.replyText).toContain('/stop');
      expect(res.replyText).toContain('NEVER send notifications without prior farmer opt-in');
    });
  });

  // =========================================================================
  // 3. 24-HOUR DEDUPLICATION & IDEMPOTENCY ENGINE
  // =========================================================================
  describe('3. Deduplication & Idempotency Engine', () => {
    it('should identify repeated messages as duplicate within the 24-hour window', () => {
      const key = 'dedup:farmer-01:weather:alert-rain-100';

      expect(isDuplicate(key)).toBe(false);

      recordDelivery(key);

      expect(isDuplicate(key)).toBe(true);
    });

    it('should expire duplicate suppression after 24 hours (sliding window)', () => {
      const key = 'dedup:farmer-02:market:wheat-msp';
      const now = Date.now();
      const past25Hours = now - 25 * 60 * 60 * 1000;

      recordDelivery(key, past25Hours);

      // Past 25 hours is beyond the 24h window
      expect(isDuplicate(key)).toBe(false);
    });

    it('should execute atomic checkAndRecord correctly', () => {
      const key = 'dedup:farmer-03:scheme:pm-kisan-18th';

      const firstAttempt = checkAndRecord(key);
      expect(firstAttempt.isDuplicate).toBe(false);
      expect(firstAttempt.recorded).toBe(true);

      const secondAttempt = checkAndRecord(key);
      expect(secondAttempt.isDuplicate).toBe(true);
      expect(secondAttempt.recorded).toBe(false);
    });

    it('should generate deterministic dedup keys from notifications', () => {
      const notif1: TelegramNotification = {
        id: 'storm-warning-01',
        farmerId: 'farmer-rajasthan',
        category: 'weather',
        priority: 'urgent',
        titleEn: 'Heavy Sandstorm Warning',
        bodyEn: 'Avoid outdoor spraying.',
        titleHi: 'रेत के तूफान की चेतावनी',
        bodyHi: 'छिड़काव न करें।',
      };

      const key = getNotificationDedupKey(notif1);
      expect(key).toBe('dedup:farmer-rajasthan:weather:storm-warning-01');
    });
  });

  // =========================================================================
  // 4. BILINGUAL NOTIFICATION TEMPLATES & EMOJIS
  // =========================================================================
  describe('4. Bilingual Notification Templates', () => {
    it('should format weather notifications with clean emojis and bilingual text', () => {
      const notif = buildWeatherNotification({
        farmerId: 'f-101',
        weatherCondition: 'Heavy Monsoon Rain',
        rainfallMm: 65,
        windSpeedKmh: 28,
        sprayCondition: 'Unsafe',
        adviceEn: 'High wind and rain will cause chemical drift and runoff.',
        adviceHi: 'तेज हवा और बारिश से कीटनाशक धुल जाएगा और बहाव होगा।',
        location: 'Nashik, Maharashtra',
      });

      expect(notif.category).toBe('weather');
      expect(notif.priority).toBe('urgent');

      const formatted = formatNotification(notif, 'bilingual');
      expect(formatted).toContain('🌦️');
      expect(formatted).toContain('Weather Advisory');
      expect(formatted).toContain('मौसम सलाह');
      expect(formatted).toContain('🔴');
      expect(formatted).toContain('Heavy Monsoon Rain');
      expect(formatted).toContain('Unsafe');
    });

    it('should format crop health diagnosis alerts with pathogen details and remedies', () => {
      const notif = buildCropHealthNotification({
        farmerId: 'f-102',
        cropName: 'Tomato',
        diseaseNameEn: 'Early Blight (Alternaria solani)',
        diseaseNameHi: 'अगेती झुलसा (अर्ली ब्लाइट)',
        severity: 'high',
        confidenceScore: 92,
        chemicalRemedyEn: 'Foliar spray of Mancozeb 75% WP @ 2g/L.',
        chemicalRemedyHi: 'मैंकोजेब 75% डब्ल्यूपी @ 2 ग्राम/लीटर का पर्णीय छिड़काव करें।',
        organicRemedyEn: 'Neem seed kernel extract (NSKE 5%).',
        organicRemedyHi: 'नीम के बीज का अर्क (एनएसकेई 5%)।',
      });

      const formatted = formatNotification(notif, 'bilingual');
      expect(formatted).toContain('🌿');
      expect(formatted).toContain('Early Blight');
      expect(formatted).toContain('अगेती झुलसा');
      expect(formatted).toContain('Mancozeb');
      expect(formatted).toContain('नीम के बीज');
    });

    it('should format government scheme deadline reminders with dates and action steps', () => {
      const notif = buildSchemeNotification({
        farmerId: 'f-103',
        schemeNameEn: 'PM-KISAN 19th Installment e-KYC',
        schemeNameHi: 'पीएम-किसान 19वीं किस्त ई-केवाईसी',
        deadlineDate: '31 March 2026',
        benefitEn: 'Direct bank transfer of ₹2,000.',
        benefitHi: '₹2,000 का प्रत्यक्ष बैंक हस्तांतरण।',
        actionEn: 'Complete biometric or OTP-based e-KYC on pmkisan.gov.in or nearest CSC.',
        actionHi: 'pmkisan.gov.in या नजदीकी सीएससी केंद्र पर बायोमेट्रिक ई-केवाईसी पूर्ण करें।',
      });

      const formatted = formatNotification(notif, 'bilingual');
      expect(formatted).toContain('🏛️');
      expect(formatted).toContain('PM-KISAN');
      expect(formatted).toContain('31 March 2026');
      expect(formatted).toContain('₹2,000');
    });

    it('should format mandi market intelligence price spike alerts', () => {
      const notif = buildMarketNotification({
        farmerId: 'f-104',
        commodity: 'Soybean (Yellow)',
        mandiName: 'Indore APMC Mandi',
        currentPrice: 4850,
        mspPrice: 4600,
        changePct: 5.4,
        adviceEn: 'Price is ₹250 above MSP. Consider selling 40% of harvest stock.',
        adviceHi: 'भाव एमएसपी से ₹250 अधिक है। 40% स्टॉक बेचने पर विचार करें।',
      });

      const formatted = formatNotification(notif, 'bilingual');
      expect(formatted).toContain('📈');
      expect(formatted).toContain('Soybean');
      expect(formatted).toContain('₹4850');
      expect(formatted).toContain('Indore APMC');
    });

    it('should format farm operations task reminders', () => {
      const notif = buildTaskNotification({
        farmerId: 'f-105',
        taskTitleEn: 'Precision Fungicide Spraying',
        taskTitleHi: 'सटीक फफूंदनाशक छिड़काव',
        scheduledTime: 'Tomorrow 06:30 AM',
        farmName: 'North Orchard Block B',
        detailsEn: 'Wear protective mask and gloves. Optimal wind window 6-8 AM.',
        detailsHi: 'मास्क और दस्ताने पहनें। छिड़काव हेतु अनुकूल समय सुबह 6-8 बजे।',
      });

      const formatted = formatNotification(notif, 'bilingual');
      expect(formatted).toContain('🚜');
      expect(formatted).toContain('Precision Fungicide Spraying');
      expect(formatted).toContain('06:30 AM');
    });

    it('should correctly escape HTML special characters to prevent Telegram API injection', () => {
      const maliciousNotif: TelegramNotification = {
        id: 'test-injection',
        farmerId: 'f-malicious',
        category: 'weather',
        priority: 'low',
        titleEn: 'Alert <script>alert(1)</script> & Warning',
        bodyEn: 'Test <tag> & content',
        titleHi: 'चेतावनी <script>',
        bodyHi: 'विवरण & जानकारी',
      };

      const formatted = formatNotification(maliciousNotif, 'bilingual');
      expect(formatted).not.toContain('<script>');
      expect(formatted).toContain('&lt;script&gt;');
      expect(formatted).toContain('&amp;');
    });
  });

  // =========================================================================
  // 5. TELEGRAM BOT API CLIENT & ERROR HANDLING
  // =========================================================================
  describe('5. Telegram Bot API Client', () => {
    it('should verify bot configuration status and mask token safely', () => {
      const client = new TelegramClient({
        botToken: '123456789:ABCDefGhIJklMnOpQrStUvWxYz-TestToken',
      });

      expect(client.isConfigured()).toBe(true);
      const masked = client.getMaskedToken();
      expect(masked).toContain('123456789:***');
      expect(masked).not.toContain('ABCDefGhIJklMnOpQrStUvWxYz');
    });

    it('should call getMe successfully in simulated mode', async () => {
      const client = new TelegramClient({ simulated: true });
      const res = await client.getMe();

      expect(res.ok).toBe(true);
      expect(res.result?.is_bot).toBe(true);
      expect(res.result?.username).toBe('AgriDOST_Alerts_Bot');
    });

    it('should reject sendMessage with missing chat_id or empty text', async () => {
      const client = new TelegramClient({ simulated: true });

      await expect(
        client.sendMessage({ chat_id: '', text: 'Hello' })
      ).rejects.toThrow('Missing required chat_id');

      await expect(
        client.sendMessage({ chat_id: 123456, text: '   ' })
      ).rejects.toThrow('Message text cannot be empty');
    });

    it('should require HTTPS for webhook URLs in setWebhook', async () => {
      const client = new TelegramClient({ simulated: true });

      await expect(
        client.setWebhook('http://insecure-domain.com/webhook')
      ).rejects.toThrow('Webhook URL must use HTTPS protocol');

      const success = await client.setWebhook('https://secure-domain.com/webhook', 'secret-token');
      expect(success.ok).toBe(true);
    });
  });

  // =========================================================================
  // 6. CENTRAL NOTIFICATION DISPATCH ORCHESTRATOR
  // =========================================================================
  describe('6. Central Notification Dispatch Orchestrator (sendTelegramNotification)', () => {
    it('should REJECT delivery if farmer has not opted in (CRITICAL RULE)', async () => {
      const notif: TelegramNotification = {
        id: 'alert-001',
        farmerId: 'unconsented-farmer',
        category: 'weather',
        priority: 'high',
        titleEn: 'Rain Warning',
        bodyEn: 'Heavy rain anticipated.',
        titleHi: 'वर्षा चेतावनी',
        bodyHi: 'भारी बारिश की संभावना।',
      };

      const result = await sendTelegramNotification(notif);

      expect(result.success).toBe(false);
      expect(result.error).toBe('FARMER_NOT_OPTED_IN');
      expect(result.farmerId).toBe('unconsented-farmer');
    });

    it('should successfully deliver notification when farmer is opted in', async () => {
      registerConsent({
        farmerId: 'farmer-consented-01',
        chatId: 99887766,
        languagePreference: 'hi',
      });

      const notif: TelegramNotification = {
        id: 'alert-002',
        farmerId: 'farmer-consented-01',
        category: 'crop_health',
        priority: 'urgent',
        titleEn: 'Rust Warning',
        bodyEn: 'Leaf rust detected nearby.',
        titleHi: 'रतुआ चेतावनी',
        bodyHi: 'पत्ती का रतुआ पाया गया।',
      };

      const result = await sendTelegramNotification(notif);

      expect(result.success).toBe(true);
      expect(result.wasDeduplicated).toBe(false);
      expect(result.chatId).toBe(99887766);
      expect(result.messageId).toBeDefined();
    });

    it('should suppress duplicate notification to the same farmer within 24h', async () => {
      registerConsent({
        farmerId: 'farmer-consented-02',
        chatId: 55443322,
      });

      const notif: TelegramNotification = {
        id: 'alert-fixed-id-99',
        farmerId: 'farmer-consented-02',
        category: 'market',
        priority: 'medium',
        titleEn: 'Paddy MSP Reached',
        bodyEn: 'Mandi price is good.',
        titleHi: 'धान एमएसपी भाव',
        bodyHi: 'मंडी भाव अच्छा है।',
      };

      // First dispatch: success
      const first = await sendTelegramNotification(notif);
      expect(first.success).toBe(true);
      expect(first.wasDeduplicated).toBe(false);

      // Immediate second dispatch: deduplicated
      const second = await sendTelegramNotification(notif);
      expect(second.success).toBe(true);
      expect(second.wasDeduplicated).toBe(true);

      // Force dispatch: bypasses deduplication
      const forced = await sendTelegramNotification(notif, { force: true });
      expect(forced.success).toBe(true);
      expect(forced.wasDeduplicated).toBe(false);
    });
  });

  // =========================================================================
  // 7. SERVER API ROUTES INTEGRATION
  // =========================================================================
  describe('7. Server API Routes Integration', () => {
    // --- POST /api/telegram/webhook ---
    describe('POST /api/telegram/webhook', () => {
      it('should reject webhook request if secret token header is missing or incorrect', async () => {
        const req = new NextRequest('http://localhost:3000/api/telegram/webhook', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret',
          },
          body: JSON.stringify({ update_id: 12345 }),
        });

        const res = await webhookRoute(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toContain('Unauthorized');
      });

      it('should accept valid webhook and process /start <farmer_id> command', async () => {
        const req = new NextRequest('http://localhost:3000/api/telegram/webhook', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': 'agridost-secret-webhook-token-2026',
          },
          body: JSON.stringify({
            update_id: 10001,
            message: {
              message_id: 501,
              from: { id: 778899, is_bot: false, first_name: 'Balbir', username: 'balbir_singh' },
              chat: { id: 778899, type: 'private' },
              date: Math.floor(Date.now() / 1000),
              text: '/start farmer_punjab_301',
            },
          }),
        });

        const res = await webhookRoute(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(data.action).toBe('opt_in');
        expect(hasConsent('farmer_punjab_301')).toBe(true);
      });

      it('should accept valid webhook and process /stop command to revoke consent', async () => {
        registerConsent({ farmerId: 'farmer_rev_api', chatId: 667788 });

        const req = new NextRequest('http://localhost:3000/api/telegram/webhook', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': 'agridost-secret-webhook-token-2026',
          },
          body: JSON.stringify({
            update_id: 10002,
            message: {
              message_id: 502,
              from: { id: 667788, is_bot: false, first_name: 'Farmer' },
              chat: { id: 667788, type: 'private' },
              date: Math.floor(Date.now() / 1000),
              text: '/stop',
            },
          }),
        });

        const res = await webhookRoute(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.action).toBe('opt_out');
        expect(hasConsent('farmer_rev_api')).toBe(false);
      });

      it('should gracefully ignore non-text updates (e.g. photos, stickers)', async () => {
        const req = new NextRequest('http://localhost:3000/api/telegram/webhook', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': 'agridost-secret-webhook-token-2026',
          },
          body: JSON.stringify({
            update_id: 10003,
            message: {
              message_id: 503,
              chat: { id: 11111, type: 'private' },
              date: Math.floor(Date.now() / 1000),
              photo: [{ file_id: 'sample_photo_id' }],
            },
          }),
        });

        const res = await webhookRoute(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.ignored).toBe(true);
      });
    });

    // --- POST /api/telegram/send ---
    describe('POST /api/telegram/send', () => {
      it('should return 400 Bad Request if required fields are missing', async () => {
        const req = new NextRequest('http://localhost:3000/api/telegram/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ category: 'weather' }), // farmerId missing
        });

        const res = await sendRoute(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('farmerId');
      });

      it('should return 403 Forbidden when farmer has not granted consent', async () => {
        const req = new NextRequest('http://localhost:3000/api/telegram/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            farmerId: 'non-opted-farmer',
            category: 'weather',
            titleEn: 'Alert',
            bodyEn: 'Rain coming',
          }),
        });

        const res = await sendRoute(req);
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.success).toBe(false);
        expect(data.error).toBe('FARMER_NOT_OPTED_IN');
      });

      it('should successfully send notification to opted-in farmer', async () => {
        registerConsent({
          farmerId: 'farmer_send_route_01',
          chatId: 88990011,
        });

        const req = new NextRequest('http://localhost:3000/api/telegram/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            farmerId: 'farmer_send_route_01',
            category: 'task',
            titleEn: 'Irrigation Due',
            bodyEn: 'Water Block 3 today.',
            titleHi: 'सिंचाई आवश्यक',
            bodyHi: 'आज ब्लॉक 3 में पानी दें।',
          }),
        });

        const res = await sendRoute(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.delivered).toBe(true);
        expect(data.wasDeduplicated).toBe(false);
        expect(data.messageId).toBeDefined();
      });

      it('should flag deduplication when the same alert is sent twice within 24h', async () => {
        registerConsent({
          farmerId: 'farmer_dedup_api',
          chatId: 44332211,
        });

        const payload = {
          id: 'unique-alert-1234',
          farmerId: 'farmer_dedup_api',
          category: 'scheme',
          titleEn: 'Scheme Deadline',
          bodyEn: 'Apply before midnight.',
        };

        // First POST: delivered
        const req1 = new NextRequest('http://localhost:3000/api/telegram/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const res1 = await sendRoute(req1);
        const data1 = await res1.json();
        expect(data1.delivered).toBe(true);
        expect(data1.wasDeduplicated).toBe(false);

        // Second POST: deduplicated
        const req2 = new NextRequest('http://localhost:3000/api/telegram/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const res2 = await sendRoute(req2);
        const data2 = await res2.json();
        expect(data2.success).toBe(true);
        expect(data2.wasDeduplicated).toBe(true);
      });
    });

    // --- GET & POST /api/telegram/consent ---
    describe('/api/telegram/consent endpoints', () => {
      it('should register consent via POST /api/telegram/consent', async () => {
        const req = new NextRequest('http://localhost:3000/api/telegram/consent', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            farmerId: 'farmer_api_consent_01',
            chatId: 99884422,
            languagePreference: 'hi',
            username: 'kisan_kumar',
          }),
        });

        const res = await consentPostRoute(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.optedIn).toBe(true);
        expect(hasConsent('farmer_api_consent_01')).toBe(true);
      });

      it('should query consent via GET /api/telegram/consent?farmerId=...', async () => {
        registerConsent({ farmerId: 'farmer_query_test', chatId: 112255 });

        const req = new NextRequest('http://localhost:3000/api/telegram/consent?farmerId=farmer_query_test');
        const res = await consentGetRoute(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.optedIn).toBe(true);
        expect(data.consent.chatId).toBe(112255);
      });

      it('should revoke consent via POST /api/telegram/consent with optInStatus: false', async () => {
        registerConsent({ farmerId: 'farmer_to_revoke', chatId: 556677 });

        const req = new NextRequest('http://localhost:3000/api/telegram/consent', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            farmerId: 'farmer_to_revoke',
            optInStatus: false,
          }),
        });

        const res = await consentPostRoute(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.optedIn).toBe(false);
        expect(data.revoked).toBe(true);
        expect(hasConsent('farmer_to_revoke')).toBe(false);
      });
    });

    // --- GET /api/telegram/health ---
    describe('GET /api/telegram/health', () => {
      it('should conform to AgriDOST 4.0 IntegrationHealthResponse contract', async () => {
        const res = await healthRoute();
        const data = (await res.json()) as IntegrationHealthResponse;

        expect(res.status).toBe(200);
        expect(data.provider).toBe('telegram');
        expect(data.category).toBe('messaging');
        expect(data.configurationStatus).toBe('configured');
        expect(data.connectivityStatus).toBe('online');
        expect(data.operatingMode).toBe('SIMULATED');
        expect(data.featuresSupported).toContain('consent_enforcement');
        expect(data.featuresSupported).toContain('deduplication_24h');
        expect(data.featuresSupported).toContain('bilingual_alerts');
        expect(data.diagnosticDetails?.botUsername).toBe('AgriDOST_Alerts_Bot');
      });
    });
  });
});
