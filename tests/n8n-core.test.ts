/**
 * tests/n8n-core.test.ts
 *
 * Comprehensive Unit & Integration Tests for AgriDOST 4.0 n8n Core Infrastructure:
 * 1. HMAC-SHA256 Request Signing & Verification
 * 2. Replay Attack Drift Protection (<= 300s)
 * 3. Zero Credential Leakage & Zod Schema Validation
 * 4. 24-Hour Idempotency & Duplicate Event Prevention
 * 5. Bounded Retries & HTTP Error Differentiation (5xx vs 4xx)
 * 6. LocalStorage Repository & Execution Record Lifecycle
 * 7. Next.js API Route Handlers (/api/n8n/status, /api/n8n/trigger, /api/n8n/callback)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createWebhookSignature,
  verifyWebhookSignature,
  getWebhookUrlForEvent,
  sendN8nWebhook,
} from '@/lib/n8n/client';
import {
  N8nEventEnvelopeSchema,
  GovernmentAssistancePayloadSchema,
  SmartFarmOperationsPayloadSchema,
  MarketIntelligencePayloadSchema,
  N8nCallbackSchema,
} from '@/lib/n8n/schemas';
import {
  dispatchN8nEvent,
  getWorkflowIdForEvent,
  generateInputSummary,
  generateOutputSummary,
} from '@/lib/n8n/dispatcher';
import {
  getExecutionRecords,
  getExecutionById,
  saveExecutionRecord,
  clearExecutions,
  getN8nConfig,
  saveN8nConfig,
  resetN8nStorageToDemo,
  N8N_STORAGE_KEYS,
} from '@/lib/n8n/storage';
import { GET as getStatus } from '@/app/api/n8n/status/route';
import { POST as postTrigger } from '@/app/api/n8n/trigger/route';
import { POST as postCallback } from '@/app/api/n8n/callback/route';
import { N8nEventEnvelope } from '@/types';

// ==============================================================================
// In-Memory Storage Mock for Headless Test Environment
// ==============================================================================
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

describe('1. HMAC-SHA256 Signature Gateway & Replay Protection', () => {
  const secret = 'test_agridost_hmac_secret_2026';
  const testBody = JSON.stringify({
    eventId: 'evt_test_123',
    eventType: 'government.reminder.triggered',
    farmerId: 'demo-farmer-01',
    farmId: 'demo-farm-01',
    payload: { scheme: 'PM-KISAN' },
  });

  it('generates valid HMAC-SHA256 signature header matching expected format', () => {
    const { header, timestamp, signature } = createWebhookSignature(testBody, secret);
    expect(header).toMatch(/^t=[^,]+,v1=[a-f0-9]{64}$/);
    expect(signature.length).toBe(64);
    expect(timestamp).toBeDefined();
  });

  it('verifies untampered webhook signature successfully', () => {
    const { header } = createWebhookSignature(testBody, secret);
    const result = verifyWebhookSignature(testBody, header, secret);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects tampered request payload', () => {
    const { header } = createWebhookSignature(testBody, secret);
    const tamperedBody = testBody.replace('PM-KISAN', 'PM-TAMPERED');
    const result = verifyWebhookSignature(tamperedBody, header, secret);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('mismatch');
  });

  it('rejects tampered secret key', () => {
    const { header } = createWebhookSignature(testBody, secret);
    const result = verifyWebhookSignature(testBody, header, 'wrong_secret_key');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('mismatch');
  });

  it('rejects missing or malformed signature header', () => {
    expect(verifyWebhookSignature(testBody, null, secret).valid).toBe(false);
    expect(verifyWebhookSignature(testBody, '', secret).valid).toBe(false);
    expect(verifyWebhookSignature(testBody, 'malformed-header-without-commas', secret).valid).toBe(false);
  });

  it('rejects expired signature when timestamp drift exceeds 300 seconds (Replay Protection)', () => {
    // 305 seconds in the past
    const expiredTimestamp = new Date(Date.now() - 305 * 1000).toISOString();
    const { header } = createWebhookSignature(testBody, secret, expiredTimestamp);

    const result = verifyWebhookSignature(testBody, header, secret, 300);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Signature timestamp expired');
  });

  it('accepts valid timestamp within allowed 300 seconds drift window', () => {
    // 120 seconds in the past
    const validPastTimestamp = new Date(Date.now() - 120 * 1000).toISOString();
    const { header } = createWebhookSignature(testBody, secret, validPastTimestamp);

    const result = verifyWebhookSignature(testBody, header, secret, 300);
    expect(result.valid).toBe(true);
  });
});

describe('2. Webhook Routing & Endpoint Mapping', () => {
  it('correctly maps government assistance events to agridost-government-assistance webhook', () => {
    const url = getWebhookUrlForEvent('government.application.created', 'http://localhost:5678/webhook');
    expect(url).toBe('http://localhost:5678/webhook/agridost-government-assistance');
  });

  it('correctly maps smart farm operations events to agridost-smart-farm-operations webhook', () => {
    const url = getWebhookUrlForEvent('operations.spray.window_evaluation', 'http://localhost:5678/webhook/');
    expect(url).toBe('http://localhost:5678/webhook/agridost-smart-farm-operations');
  });

  it('correctly maps market intelligence events to agridost-market-intelligence webhook', () => {
    const url = getWebhookUrlForEvent('market.price.check_requested', 'http://localhost:5678/webhook');
    expect(url).toBe('http://localhost:5678/webhook/agridost-market-intelligence');
  });
});

describe('3. Zod Schemas & Zero Credential Leakage Rule', () => {
  it('validates correct GovernmentAssistancePayload', () => {
    const payload = {
      schemeId: 'pm-kisan',
      schemeName: 'Pradhan Mantri Kisan Samman Nidhi',
      currentStatus: 'approved',
      statusSource: 'government_verified',
      farmerName: 'Ramesh Patel',
      actionRequired: 'Verify PFMS installment credit',
      officialPortalUrl: 'https://pmkisan.gov.in/',
    };
    expect(GovernmentAssistancePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('validates correct SmartFarmOperationsPayload', () => {
    const payload = {
      operationType: 'spray',
      scheduledTime: '2026-11-23T06:30:00Z',
      weatherData: {
        temperatureC: 25,
        windSpeedKmh: 10,
        humidityPct: 65,
        precipitationProbPct: 5,
        condition: 'Clear Sky',
        forecastTimestamp: '2026-11-23T06:00:00Z',
        provider: 'OpenMeteo',
      },
      thresholds: {
        maxWindSpeedKmh: 15,
        maxTempC: 32,
        minHumidityPct: 40,
      },
    };
    expect(SmartFarmOperationsPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('validates correct MarketIntelligencePayload', () => {
    const payload = {
      commodityName: 'Soybean',
      targetMandi: 'Nashik APMC',
      state: 'Maharashtra',
      farmerTargetPriceInrPerQtl: 4800,
      currentMandiPriceInrPerQtl: 4920,
      priceObservationDate: '2026-11-22',
      priceDataSource: 'Agmarknet (Govt of India)',
    };
    expect(MarketIntelligencePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects N8nEventEnvelope when payload contains forbidden credential keys (Zero Credential Leakage)', () => {
    const leakedEnvelope = {
      eventId: 'evt_leak_001',
      eventType: 'government.application.created',
      timestamp: new Date().toISOString(),
      producer: 'agridost-app',
      version: '1.0',
      farmerId: 'demo-farmer-01',
      farmId: 'demo-farm-01',
      payload: {
        schemeId: 'pm-kisan',
        farmerName: 'Ramesh Patel',
        aadhaar_number: '1234-5678-9012', // FORBIDDEN LEAKAGE
      },
      idempotencyKey: 'govt:farm1:app1',
    };

    const parseResult = N8nEventEnvelopeSchema.safeParse(leakedEnvelope);
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      expect(parseResult.error.issues[0].message).toContain('Zero Credential Leakage Violation');
    }
  });

  it('accepts clean N8nEventEnvelope without credential keys', () => {
    const cleanEnvelope = {
      eventId: 'evt_clean_001',
      eventType: 'operations.weather.check_requested',
      timestamp: new Date().toISOString(),
      producer: 'agridost-app',
      version: '1.0',
      farmerId: 'demo-farmer-01',
      farmId: 'demo-farm-01',
      payload: {
        operationType: 'spray',
        zoneId: 'zone-01',
      },
      idempotencyKey: 'ops:farm1:zone1',
    };
    expect(N8nEventEnvelopeSchema.safeParse(cleanEnvelope).success).toBe(true);
  });

  it('validates N8nCallbackSchema structure', () => {
    const callback = {
      eventId: 'evt_101',
      workflowId: 'government-assistance',
      status: 'success',
      outputSummary: 'Dispatched SMS notification',
      outputData: { messageId: 'msg_984' },
      completedAt: new Date().toISOString(),
      durationMs: 1200,
    };
    expect(N8nCallbackSchema.safeParse(callback).success).toBe(true);
  });
});

describe('4. LocalStorage Repository & 24h Idempotency Protection', () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    const mockWindow = {
      localStorage: mockStorage,
      dispatchEvent: () => true,
    };
    vi.stubGlobal('window', mockWindow);
    resetN8nStorageToDemo();
  });

  it('initializes with pre-seeded demo execution records', () => {
    const records = getExecutionRecords();
    expect(records.length).toBeGreaterThanOrEqual(3);

    const govtRecord = records.find((r) => r.workflowId === 'government-assistance');
    expect(govtRecord).toBeDefined();
    expect(govtRecord?.status).toBe('success');

    const opsRecord = records.find((r) => r.workflowId === 'smart-farm-operations');
    expect(opsRecord).toBeDefined();

    const mktRecord = records.find((r) => r.workflowId === 'market-intelligence');
    expect(mktRecord).toBeDefined();
  });

  it('saves and retrieves individual execution record', () => {
    const testRecord = {
      id: 'exec-test-999',
      eventId: 'evt-test-999',
      eventType: 'operations.irrigation.advisory' as const,
      workflowId: 'smart-farm-operations' as const,
      farmId: 'demo-farm-01',
      status: 'success' as const,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      inputSummary: 'Irrigation test',
      retryCount: 0,
    };

    saveExecutionRecord(testRecord);
    const retrieved = getExecutionById('exec-test-999');
    expect(retrieved).toBeDefined();
    expect(retrieved?.inputSummary).toBe('Irrigation test');
  });

  it('manages gateway configuration persistence', () => {
    const config = getN8nConfig();
    expect(config.webhookBaseUrl).toBeDefined();

    saveN8nConfig({ simulatedMode: false });
    const updated = getN8nConfig();
    expect(updated.simulatedMode).toBe(false);
  });

  it('suppresses duplicate execution within 24 hours (Idempotency Protection)', async () => {
    const event: N8nEventEnvelope = {
      eventId: `evt_idemp_${Date.now()}`,
      eventType: 'government.reminder.triggered',
      timestamp: new Date().toISOString(),
      producer: 'agridost-app',
      version: '1.0',
      farmerId: 'demo-farmer-01',
      farmId: 'demo-farm-01',
      payload: { schemeId: 'pm-kisan', actionRequired: 'Renew KYC' },
      idempotencyKey: 'idemp-key-test-24h',
    };

    // 1st dispatch
    const firstExec = await dispatchN8nEvent(event, { simulated: true });
    expect(firstExec.status).toBe('success');

    // 2nd dispatch with SAME idempotency key
    const secondExec = await dispatchN8nEvent(event, { simulated: true });
    expect(secondExec.status).toBe('skipped');
    expect(secondExec.outputSummary).toContain('Idempotency match');
  });
});

describe('5. Bounded Retries & Error Handling', () => {
  it('retries up to maxRetries on HTTP 500 server error', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(new Response('Internal Server Error', { status: 500 }));
    });
    vi.stubGlobal('fetch', mockFetch);

    const event: N8nEventEnvelope = {
      eventId: 'evt_retry_test',
      eventType: 'government.application.created',
      timestamp: new Date().toISOString(),
      producer: 'agridost-app',
      version: '1.0',
      farmerId: 'demo-farmer-01',
      farmId: 'demo-farm-01',
      payload: { schemeId: 'pm-kisan' },
      idempotencyKey: `retry_test_${Date.now()}`,
    };

    // Dispatches with live simulated=false and maxRetries=2
    const result = await sendN8nWebhook(event, {
      simulated: false,
      maxRetries: 2,
      timeoutMs: 500,
    });

    expect(callCount).toBe(3); // 1 initial + 2 retries
    expect(result.success).toBe(false);
    expect(result.httpStatus).toBe(500);
    expect(result.error?.retryable).toBe(true);

    vi.unstubAllGlobals();
  });

  it('does NOT retry on HTTP 400 Bad Request client error', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(new Response('Bad Request', { status: 400 }));
    });
    vi.stubGlobal('fetch', mockFetch);

    const event: N8nEventEnvelope = {
      eventId: 'evt_no_retry_test',
      eventType: 'government.application.created',
      timestamp: new Date().toISOString(),
      producer: 'agridost-app',
      version: '1.0',
      farmerId: 'demo-farmer-01',
      farmId: 'demo-farm-01',
      payload: { schemeId: 'pm-kisan' },
      idempotencyKey: `no_retry_${Date.now()}`,
    };

    const result = await sendN8nWebhook(event, {
      simulated: false,
      maxRetries: 3,
      timeoutMs: 500,
    });

    expect(callCount).toBe(1); // Exits immediately on 4xx
    expect(result.success).toBe(false);
    expect(result.httpStatus).toBe(400);
    expect(result.error?.retryable).toBe(false);

    vi.unstubAllGlobals();
  });
});

describe('6. Next.js API Routes Handlers (/api/n8n/...)', () => {
  const secret = 'agridost_hmac_webhook_signing_secret_2026';

  beforeEach(() => {
    const mockStorage = new MockLocalStorage();
    const mockWindow = {
      localStorage: mockStorage,
      dispatchEvent: () => true,
    };
    vi.stubGlobal('window', mockWindow);
    resetN8nStorageToDemo();
  });

  it('GET /api/n8n/status returns configuration, simulated status, and 3 workflows', async () => {
    const response = await getStatus();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.status).toBe('online');
    expect(json.workflows).toHaveLength(3);
    expect(json.workflows.map((w: { id: string }) => w.id)).toEqual([
      'government-assistance',
      'smart-farm-operations',
      'market-intelligence',
    ]);
  });

  it('POST /api/n8n/trigger executes workflow and returns valid execution record', async () => {
    const req = new NextRequest('http://localhost:3000/api/n8n/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'operations.weather.check_requested',
        farmId: 'demo-farm-01',
        payload: {
          operationType: 'spray',
          weatherData: {
            temperatureC: 26,
            windSpeedKmh: 12,
            humidityPct: 55,
            precipitationProbPct: 10,
            condition: 'Clear',
            forecastTimestamp: new Date().toISOString(),
            provider: 'OpenMeteo',
          },
          thresholds: {
            maxWindSpeedKmh: 15,
            maxTempC: 32,
            minHumidityPct: 40,
          },
        },
        simulated: true,
      }),
    });

    const response = await postTrigger(req);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.record).toBeDefined();
    expect(json.record.status).toBe('success');
    expect(json.record.workflowId).toBe('smart-farm-operations');
  });

  it('POST /api/n8n/callback rejects request without valid signature with 401 Unauthorized', async () => {
    const req = new NextRequest('http://localhost:3000/api/n8n/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-demo-govt-01',
        status: 'success',
      }),
    });

    const response = await postCallback(req);
    expect(response.status).toBe(401);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('Unauthorized');
  });

  it('POST /api/n8n/callback rejects request with expired replay drift (>300s) with 401', async () => {
    const callbackBody = JSON.stringify({
      eventId: 'evt-demo-govt-01',
      status: 'success',
      outputSummary: 'Dispatched callback',
    });

    const expiredTs = new Date(Date.now() - 350 * 1000).toISOString();
    const { header } = createWebhookSignature(callbackBody, secret, expiredTs);

    const req = new NextRequest('http://localhost:3000/api/n8n/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgriDOST-Signature': header,
      },
      body: callbackBody,
    });

    const response = await postCallback(req);
    expect(response.status).toBe(401);
  });

  it('POST /api/n8n/callback accepts properly signed callback and updates execution record with 200', async () => {
    const callbackBody = JSON.stringify({
      eventId: 'evt-demo-govt-01',
      status: 'success',
      outputSummary: 'Confirmed SMS Delivery via n8n Callback',
      outputData: { deliveryReceipt: 'sms_ack_12345' },
      durationMs: 850,
    });

    const { header } = createWebhookSignature(callbackBody, secret);

    const req = new NextRequest('http://localhost:3000/api/n8n/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgriDOST-Signature': header,
      },
      body: callbackBody,
    });

    const response = await postCallback(req);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe('success');

    // Verify record was updated in storage
    const updatedRecord = getExecutionById('exec-demo-govt-01');
    expect(updatedRecord?.outputSummary).toBe('Confirmed SMS Delivery via n8n Callback');
    expect(updatedRecord?.outputData?.deliveryReceipt).toBe('sms_ack_12345');
  });

  describe('HMAC-SHA256 Cryptographic Tamper & Security Verification', () => {
    it('POST /api/n8n/callback rejects tampered payload where body was altered after signing', async () => {
      const originalPayload = JSON.stringify({
        eventId: 'evt-demo-govt-01',
        status: 'success',
        outputSummary: 'Legitimate Output',
      });

      // Sign legitimate payload
      const { header } = createWebhookSignature(originalPayload, secret);

      // Maliciously tamper body after signature computation
      const tamperedBody = JSON.stringify({
        eventId: 'evt-demo-govt-01',
        status: 'failed',
        outputSummary: 'Tampered Malicious Injection',
      });

      const req = new NextRequest('http://localhost:3000/api/n8n/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AgriDOST-Signature': header,
        },
        body: tamperedBody,
      });

      const response = await postCallback(req);
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.reason).toContain('HMAC signature mismatch');
    });

    it('POST /api/n8n/callback rejects signatures signed with an invalid / incorrect secret', async () => {
      const payload = JSON.stringify({
        eventId: 'evt-demo-govt-01',
        status: 'success',
      });

      // Sign with an incorrect secret
      const { header } = createWebhookSignature(payload, 'wrong_secret_attacker_key');

      const req = new NextRequest('http://localhost:3000/api/n8n/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AgriDOST-Signature': header,
        },
        body: payload,
      });

      const response = await postCallback(req);
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.reason).toContain('HMAC signature mismatch');
    });

    it('POST /api/n8n/callback rejects requests when signature header format is malformed', async () => {
      const payload = JSON.stringify({
        eventId: 'evt-demo-govt-01',
        status: 'success',
      });

      const req = new NextRequest('http://localhost:3000/api/n8n/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AgriDOST-Signature': 'invalid_format_without_t_and_v1',
        },
        body: payload,
      });

      const response = await postCallback(req);
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.reason).toContain('Invalid signature header format');
    });
  });
});
