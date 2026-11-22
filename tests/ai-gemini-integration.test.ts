/**
 * tests/ai-gemini-integration.test.ts
 *
 * Dedicated Integration Test Suite for AgriDOST 4.0 Gemini AI Subsystem:
 * 1. Strict Zod Schema Validation (AIHealthResponseSchema & AgronomicAdvisorySchema)
 * 2. Model Cascade & Dynamic Failover (gemini-3.8-flash -> gemini-2.5-flash -> gemini-2.0-flash -> gemini-1.5-flash)
 * 3. Timeout Handling & Exponential Backoff Retries
 * 4. Schema Violation Rejection (HTTP 502 Bad Gateway)
 * 5. Deterministic Offline Fallbacks (Vision Guide, Scheme Registry, ICAR/KVK Advisory)
 * 6. Bilingual Support (English + Hindi)
 * 7. Security: Zero API Key Leakage in Client-Facing Responses or Errors
 * 8. External Integration Health Reporting (IntegrationHealthResponse compliance)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  AIHealthResponseSchema,
  AIHealthResponse,
  AgronomicAdvisorySchema,
  AgronomicAdvisory,
  AIHealthRequestSchema,
  AgronomicAdvisoryRequestSchema,
} from '@/lib/ai/schemas';
import {
  callGeminiWithFailover,
  cleanJsonText,
  parseAndValidateWithZod,
  getGeminiIntegrationHealth,
  sanitizeErrorMessage,
  DEFAULT_GEMINI_CANDIDATES,
} from '@/lib/ai/client';
import {
  CROP_HEALTH_SYSTEM_PROMPT,
  AGRONOMIC_ADVISORY_SYSTEM_PROMPT,
  FALLBACK_DIAGNOSTIC_GUIDE,
  getOfflineAgronomicAdvisory,
} from '@/lib/ai/system-prompt';
import { GET as getHealth, POST as postHealth } from '@/app/api/ai/health/route';
import { GET as getAdvisory, POST as postAdvisory } from '@/app/api/ai/advisory/route';
import { GET as getSchemes, POST as postSchemes } from '@/app/api/ai/schemes/route';

// ============================================================================
// MOCK SETUP FOR @google/genai
// ============================================================================
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: mockGenerateContent,
      };
      constructor(public options?: Record<string, unknown>) {}
    },
  };
});

// Helper to create valid AI Health response
function createValidHealthPayload(overrides: Partial<AIHealthResponse> = {}): AIHealthResponse {
  return {
    status: 'supported',
    cropAffected: 'Cotton',
    detectedCondition: 'Alternaria Leaf Blight',
    confidenceScore: 88,
    severity: 'medium',
    symptoms: [
      'Circular to irregular brown lesions with concentric rings on foliage',
      'Chlorotic yellowish halo delimiting necrotic center',
    ],
    possibleCauses: [
      'Alternaria macrospora fungal infection',
      'Secondary physiological stress due to potassium deficiency',
    ],
    recommendedAction:
      'Rogue severely affected lower leaves. Avoid overhead sprinkler irrigation. Ensure proper field drainage.',
    chemicalRecommendation: {
      name: 'Azoxystrobin 18.2% + Difenoconazole 11.4% SC',
      dosage: '200 ml per acre in 200 L water',
      frequency: 'Single spray at symptom onset; repeat after 15 days if wet weather persists',
    },
    organicAlternative: 'Neem seed kernel extract (NSKE 5%) or Trichoderma viride foliar spray',
    missingInformation: [
      'Microscopic spore morphology assay',
      'Soil test report for potassium and nitrogen availability',
    ],
    limitations: [
      'Visual 2D imagery cannot differentiate between physiological bronzing and fungal blight without tissue lab culture',
    ],
    sources: [
      {
        title: 'ICAR - Central Institute for Cotton Research (CICR) Cotton Protection Guide',
        url: 'https://cicr.icar.gov.in',
      },
    ],
    disclaimer:
      'This advisory screening is based on visual pattern recognition and does not constitute a certified lab diagnosis.',
    ...overrides,
  };
}

// Helper to create valid Agronomic Advisory response
function createValidAdvisoryPayload(overrides: Partial<AgronomicAdvisory> = {}): AgronomicAdvisory {
  return {
    crop: 'Cotton',
    stage: 'Flowering & Square Formation',
    language: 'en',
    summary: 'Focus on square retention and sucking pest management.',
    primaryRecommendation: 'Maintain uniform soil moisture. Avoid waterlogging during flowering.',
    irrigationGuidance: {
      recommendation: 'Irrigate every 8-10 days during dry spells; do not let soil crack.',
      schedule: 'Early morning furrow or drip irrigation.',
      waterRequirement: '35 mm per irrigation turn.',
    },
    fertilizerNutrition: {
      macroNutrients: 'Apply 25 kg Nitrogen (Urea ~55 kg) + 15 kg MOP per acre.',
      microNutrients: 'Foliar spray of 1% Magnesium Sulphate at 60 DAS.',
      applicationMethod: 'Side dressing 5 cm away from plant stem.',
      organicAlternatives: ['Vermicompost 2 tons/acre', 'Neem cake 200 kg/acre'],
    },
    pestDiseasePrecaution: {
      threats: ['Whitefly', 'Thrips', 'Pink Bollworm'],
      preventiveMeasures: [
        'Install yellow sticky traps @ 8 per acre',
        'Install pheromone traps @ 5 per acre',
      ],
      cibrcApprovedTreatments: [
        {
          name: 'Diafenthiuron 50% WP',
          dosage: '240 g/acre in 200 L water',
          targetPest: 'Whitefly and Thrips',
          safetyIntervalDays: 30,
        },
      ],
      organicAlternatives: ['Neem oil 1500 ppm @ 5 ml/L water'],
    },
    contingencyWeatherAdvisory:
      'If rainfall exceeds 20 mm, suspend all foliar sprays and open drainage ditches.',
    groundedPractices: {
      practices: [
        'ICAR-CICR Cotton POP 2026',
        'CIBRC approved label-claim treatments only',
      ],
      institutionalSources: [
        {
          name: 'ICAR - Central Institute for Cotton Research, Nagpur',
          type: 'ICAR',
          url: 'https://cicr.icar.gov.in',
        },
      ],
    },
    disclaimer:
      'Based on ICAR-CICR guidelines. Consult your local KVK for farm-specific microclimate validation.',
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AgriDOST 4.0: Gemini AI Specialist Test Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ==========================================================================
  // 1. ZOD SCHEMA INTEGRITY & STRICT ANTI-HALLUCINATION CONTRACTS
  // ==========================================================================
  describe('1. Zod Schema Integrity & Validation', () => {
    it('validates a compliant AIHealthResponse payload successfully', () => {
      const payload = createValidHealthPayload();
      const result = AIHealthResponseSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confidenceScore).toBe(88);
        expect(result.data.status).toBe('supported');
        expect(result.data.cropAffected).toBe('Cotton');
      }
    });

    it('rejects an AIHealthResponse with out-of-range confidenceScore (>100)', () => {
      const invalid = createValidHealthPayload({ confidenceScore: 105 });
      const result = AIHealthResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects an AIHealthResponse with empty symptoms array', () => {
      const invalid = createValidHealthPayload({ symptoms: [] });
      const result = AIHealthResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('validates a compliant AgronomicAdvisory payload with CIBRC treatments', () => {
      const payload = createValidAdvisoryPayload();
      const result = AgronomicAdvisorySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.crop).toBe('Cotton');
        expect(result.data.pestDiseasePrecaution.cibrcApprovedTreatments[0].safetyIntervalDays).toBe(30);
      }
    });

    it('validates AgronomicAdvisoryRequestSchema with defaults', () => {
      const req = AgronomicAdvisoryRequestSchema.safeParse({ cropName: 'Soybean' });
      expect(req.success).toBe(true);
      if (req.success) {
        expect(req.data.cropStage).toBe('vegetative');
        expect(req.data.language).toBe('en');
      }
    });
  });

  // ==========================================================================
  // 2. MODEL CASCADE & DYNAMIC FAILOVER
  // ==========================================================================
  describe('2. Model Cascade & Dynamic Failover', () => {
    it('succeeds on primary model gemini-3.8-flash on first attempt', async () => {
      process.env.GEMINI_API_KEY = 'valid-test-key-12345';
      const mockPayload = createValidHealthPayload();

      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockPayload),
      });

      const result = await callGeminiWithFailover('Analyze leaf image', {
        candidateModels: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'],
        maxRetries: 0,
      });

      expect(result.model).toBe('gemini-3.8-flash');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(result.attempts[0].status).toBe('success');
    });

    it('cascades to second candidate gemini-2.5-flash when gemini-3.8-flash fails (503 overloaded)', async () => {
      process.env.GEMINI_API_KEY = 'valid-test-key-12345';
      const mockPayload = createValidHealthPayload();

      mockGenerateContent
        .mockRejectedValueOnce(new Error('503 Service Unavailable: gemini-3.8-flash is overloaded'))
        .mockResolvedValueOnce({
          text: JSON.stringify(mockPayload),
        });

      const result = await callGeminiWithFailover('Analyze leaf image', {
        candidateModels: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'],
        maxRetries: 0,
      });

      expect(result.model).toBe('gemini-2.5-flash');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(result.attempts[0].status).toBe('error');
      expect(result.attempts[1].status).toBe('success');
    });

    it('cascades down the full chain and throws sanitized error when all models fail', async () => {
      process.env.GEMINI_API_KEY = 'secret-gemini-key-999';

      mockGenerateContent
        .mockRejectedValueOnce(new Error('Error on 3.8'))
        .mockRejectedValueOnce(new Error('Error on 2.5'))
        .mockRejectedValueOnce(new Error('429 Rate limit exhausted with secret-gemini-key-999'));

      await expect(
        callGeminiWithFailover('Test prompt', {
          candidateModels: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'],
          maxRetries: 0,
        })
      ).rejects.toThrow(/Rate limit exhausted/);

      // Verify the secret key is NOT leaked in the thrown error message
      try {
        await callGeminiWithFailover('Test prompt', {
          candidateModels: ['gemini-3.8-flash'],
          maxRetries: 0,
        });
      } catch (err: any) {
        expect(err.message).not.toContain('secret-gemini-key-999');
      }
    });
  });

  // ==========================================================================
  // 3. TIMEOUT & EXPONENTIAL BACKOFF RETRY HANDLING
  // ==========================================================================
  describe('3. Timeout & Retry Handling', () => {
    it('aborts and triggers failover when a model call exceeds timeoutMs', async () => {
      process.env.GEMINI_API_KEY = 'valid-test-key-12345';
      const mockPayload = createValidHealthPayload();

      // First call hangs longer than timeoutMs
      mockGenerateContent
        .mockImplementationOnce(
          () => new Promise((resolve) => setTimeout(resolve, 300))
        )
        // Second candidate responds promptly
        .mockResolvedValueOnce({
          text: JSON.stringify(mockPayload),
        });

      const result = await callGeminiWithFailover('Prompt', {
        candidateModels: ['gemini-3.8-flash', 'gemini-2.5-flash'],
        timeoutMs: 50, // 50ms fast timeout for testing
        maxRetries: 0,
      });

      expect(result.model).toBe('gemini-2.5-flash');
      expect(result.attempts[0].status).toBe('timeout');
      expect(result.attempts[1].status).toBe('success');
    });

    it('executes exponential backoff retry on transient 429 rate limit before cascading', async () => {
      process.env.GEMINI_API_KEY = 'valid-test-key-12345';
      const mockPayload = createValidHealthPayload();

      // First attempt on 3.8 returns 429, second attempt on 3.8 succeeds
      mockGenerateContent
        .mockRejectedValueOnce(new Error('429 Too Many Requests: Rate limit exceeded'))
        .mockResolvedValueOnce({
          text: JSON.stringify(mockPayload),
        });

      const result = await callGeminiWithFailover('Prompt', {
        candidateModels: ['gemini-3.8-flash'],
        maxRetries: 1,
        backoffBaseMs: 10, // Short 10ms backoff for fast testing
      });

      expect(result.model).toBe('gemini-3.8-flash');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // 4. STRUCTURED OUTPUT PARSING & CODE FENCE STRIPPING
  // ==========================================================================
  describe('4. Structured Output Parsing & Zod Validation', () => {
    it('cleanJsonText strips ```json code fences and whitespace cleanly', () => {
      const fenced = '```json\n{"crop": "Wheat", "status": "supported"}\n```';
      expect(cleanJsonText(fenced)).toBe('{"crop": "Wheat", "status": "supported"}');
    });

    it('parseAndValidateWithZod returns parsed data for valid JSON', () => {
      const payload = createValidHealthPayload();
      const parsed = parseAndValidateWithZod(JSON.stringify(payload), AIHealthResponseSchema);
      expect(parsed.success).toBe(true);
      expect(parsed.data?.cropAffected).toBe('Cotton');
    });

    it('parseAndValidateWithZod returns error and zodIssues when schema constraints fail', () => {
      const invalid = createValidHealthPayload({ confidenceScore: 120 });
      const parsed = parseAndValidateWithZod(JSON.stringify(invalid), AIHealthResponseSchema);
      expect(parsed.success).toBe(false);
      expect(parsed.zodIssues).toBeDefined();
      expect(parsed.zodIssues?.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 5. SERVER ROUTES & HTTP 502 SCHEMA REJECTION
  // ==========================================================================
  describe('5. Server Route Endpoints & HTTP Status Codes', () => {
    describe('POST /api/ai/health', () => {
      it('returns HTTP 502 Bad Gateway when Gemini returns a schema-violating payload', async () => {
        process.env.GEMINI_API_KEY = 'mock-valid-key';
        const invalidPayload = createValidHealthPayload({ confidenceScore: 200 }); // invalid score

        mockGenerateContent.mockResolvedValueOnce({
          text: JSON.stringify(invalidPayload),
        });

        const req = new NextRequest('http://localhost:3000/api/ai/health', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image: 'data:image/jpeg;base64,dGVzdA==' }),
        });

        const res = await postHealth(req);
        expect(res.status).toBe(502);

        const data = await res.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('failed strict agronomic schema validation');
      });

      it('returns HTTP 200 with truthful unavailable status and fallback guide when API key is missing', async () => {
        delete process.env.GEMINI_API_KEY;

        const req = new NextRequest('http://localhost:3000/api/ai/health', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image: 'data:image/jpeg;base64,dGVzdA==' }),
        });

        const res = await postHealth(req);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.status).toBe('unavailable');
        expect(data.fallbackGuide).toBeDefined();
        expect(data.data).toBeUndefined(); // Crucial: no fake diagnosis generated
      });
    });

    describe('POST /api/ai/advisory', () => {
      it('returns HTTP 400 when cropName is missing', async () => {
        const req = new NextRequest('http://localhost:3000/api/ai/advisory', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cropStage: 'flowering' }),
        });

        const res = await postAdvisory(req);
        expect(res.status).toBe(400);
      });

      it('returns HTTP 200 with offline ICAR/KVK advisory when GEMINI_API_KEY is missing', async () => {
        delete process.env.GEMINI_API_KEY;

        const req = new NextRequest('http://localhost:3000/api/ai/advisory', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            cropName: 'Cotton',
            cropStage: 'Flowering & Square Formation',
            language: 'en',
          }),
        });

        const res = await postAdvisory(req);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.status).toBe('offline_fallback');
        expect(data.data.crop).toBe('Cotton');
        expect(data.source).toBe('icar_kvk_offline_registry');
      });

      it('returns HTTP 502 Bad Gateway when live Gemini advisory output fails Zod validation', async () => {
        process.env.GEMINI_API_KEY = 'mock-valid-key';
        const invalidAdvisory = {
          crop: 'Cotton',
          summary: 'Missing required sub-objects like irrigation and nutrition',
        };

        mockGenerateContent.mockResolvedValueOnce({
          text: JSON.stringify(invalidAdvisory),
        });

        const req = new NextRequest('http://localhost:3000/api/ai/advisory', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cropName: 'Cotton', language: 'en' }),
        });

        const res = await postAdvisory(req);
        expect(res.status).toBe(502);

        const data = await res.json();
        expect(data.error).toContain('failed strict agronomic schema validation');
      });

      it('returns HTTP 200 with live validated advisory when Gemini succeeds', async () => {
        process.env.GEMINI_API_KEY = 'mock-valid-key';
        const validAdvisory = createValidAdvisoryPayload();

        mockGenerateContent.mockResolvedValueOnce({
          text: JSON.stringify(validAdvisory),
        });

        const req = new NextRequest('http://localhost:3000/api/ai/advisory', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cropName: 'Cotton', language: 'en' }),
        });

        const res = await postAdvisory(req);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.status).toBe('live');
        expect(data.data.crop).toBe('Cotton');
        expect(data.model).toBe('gemini-3.8-flash');
      });

      it('seamlessly falls back to verified ICAR/KVK advisory when live model cascade fails', async () => {
        process.env.GEMINI_API_KEY = 'mock-valid-key';
        mockGenerateContent.mockRejectedValue(new Error('Quota exceeded on all models'));

        const req = new NextRequest('http://localhost:3000/api/ai/advisory', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cropName: 'Soybean', language: 'en' }),
        });

        const res = await postAdvisory(req);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.status).toBe('offline_fallback');
        expect(data.data.crop).toBe('Soybean');
      });
    });
  });

  // ==========================================================================
  // 6. BILINGUAL SUPPORT (ENGLISH & HINDI)
  // ==========================================================================
  describe('6. Bilingual Agronomic Advisory Support', () => {
    it('generates grounded Hindi advisory with verified Devanagari terminology from offline registry', () => {
      const hindiAdvisory = getOfflineAgronomicAdvisory({
        cropName: 'Cotton',
        language: 'hi',
      });

      expect(hindiAdvisory.language).toBe('hi');
      expect(hindiAdvisory.crop).toContain('कपास');
      expect(hindiAdvisory.pestDiseasePrecaution.threats[0]).toContain('सफेद मक्खी');
      expect(hindiAdvisory.fertilizerNutrition.macroNutrients).toContain('यूरिया');
    });

    it('generates grounded Hindi advisory for Soybean in offline registry', () => {
      const hindiAdvisory = getOfflineAgronomicAdvisory({
        cropName: 'Soybean',
        language: 'hi',
      });

      expect(hindiAdvisory.language).toBe('hi');
      expect(hindiAdvisory.crop).toContain('सोयाबीन');
      expect(hindiAdvisory.pestDiseasePrecaution.threats[0]).toContain('गर्डल बीटल');
    });

    it('generates grounded Hindi advisory for Wheat in offline registry', () => {
      const hindiAdvisory = getOfflineAgronomicAdvisory({
        cropName: 'Wheat',
        language: 'hi',
      });

      expect(hindiAdvisory.language).toBe('hi');
      expect(hindiAdvisory.crop).toContain('गेहूं');
      expect(hindiAdvisory.stage).toContain('ताज मूल');
    });

    it('POST /api/ai/advisory respects Hindi language selection in offline mode', async () => {
      delete process.env.GEMINI_API_KEY;

      const req = new NextRequest('http://localhost:3000/api/ai/advisory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cropName: 'Tomato', language: 'hi' }),
      });

      const res = await postAdvisory(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.language).toBe('hi');
      expect(data.data.crop).toContain('टमाटर');
    });
  });

  // ==========================================================================
  // 7. EXTERNAL INTEGRATION HEALTH COMPLIANCE & ZERO SECRET LEAKAGE
  // ==========================================================================
  describe('7. Integration Health Reporting & Secret Isolation', () => {
    it('GET /api/ai/health returns IntegrationHealthResponse adhering to standards', async () => {
      process.env.GEMINI_API_KEY = 'mock-super-secret-key-12345';

      const res = await getHealth();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.provider).toBe('gemini');
      expect(body.displayName).toContain('Google Gemini AI');
      expect(body.category).toBe('ai');
      expect(body.operatingMode).toBe('LIVE');
      expect(body.configurationStatus).toBe('configured');
      expect(body.connectivityStatus).toBe('online');
      expect(body.featuresSupported).toContain('candidate-model-failover');
      expect(body.featuresSupported).toContain('bilingual-en-hi');

      // Crucial security check: Secret key must NEVER be leaked in JSON body
      expect(JSON.stringify(body)).not.toContain('mock-super-secret-key-12345');
    });

    it('GET /api/ai/health reports NOT_CONFIGURED when GEMINI_API_KEY is missing', async () => {
      delete process.env.GEMINI_API_KEY;

      const res = await getHealth();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.operatingMode).toBe('NOT_CONFIGURED');
      expect(body.configurationStatus).toBe('unconfigured');
      expect(body.connectivityStatus).toBe('offline');
      expect(body.status).toBe('unavailable');
    });

    it('GET /api/ai/advisory reports capability and CIBRC compliance', async () => {
      process.env.GEMINI_API_KEY = 'mock-valid-key';

      const res = await getAdvisory();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.provider).toBe('gemini');
      expect(body.cibrcComplianceEnforced).toBe(true);
      expect(body.supportedLanguages).toEqual(['en', 'hi']);
    });

    it('sanitizeErrorMessage redacts both supplied and environment API keys from errors', () => {
      const secret = 'AIzaSySecretApiKey123456789';
      process.env.GEMINI_API_KEY = secret;

      const errorText = `Google API returned 403 Forbidden with key ${secret} on endpoint`;
      const sanitized = sanitizeErrorMessage(errorText, secret);

      expect(sanitized).not.toContain(secret);
      expect(sanitized).toContain('[REDACTED_API_KEY]');
    });
  });
});
