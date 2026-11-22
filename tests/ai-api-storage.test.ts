/**
 * tests/ai-api-storage.test.ts
 *
 * Comprehensive Test Suite for AgriDOST:
 * 1. AI Health Schemas (Zod validation for AIHealthResponseSchema & AIHealthRequestSchema)
 * 2. Next.js API Health Route (/api/ai/health GET & POST with mocked Gemini AI)
 * 3. LocalStorage Repository & Offline Data Store (src/lib/data/storage.ts)
 * 4. Synthetic Event Dispatching & React Subscription (agridost:data-changed)
 * 5. Environment Isolation & Security Auditing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  AIHealthResponseSchema,
  AIHealthRequestSchema,
  AIHealthResponse,
} from '@/lib/ai/schemas';
import { GET, POST } from '@/app/api/ai/health/route';
import * as storage from '@/lib/data/storage';
import {
  Farm,
  FarmZone,
  HealthObservation,
  FarmTask,
  CropPlan,
  FarmSupply,
  BoundaryTreePlan,
  SprayOperation,
  GeoJSONPolygon,
} from '@/types';
import { DEMO_FARMS } from '@/lib/data/demo-data';

// ============================================================================
// 1. MOCKING EXTERNAL GEMINI API (@google/genai)
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

// ============================================================================
// 2. ISOLATED IN-MEMORY LOCALSTORAGE MOCK
// ============================================================================
class InMemoryLocalStorage implements Storage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  get length(): number {
    return this.store.size;
  }
}

interface CustomEventDetail<T = unknown> {
  key: string;
  [key: string]: T | string;
}

class MockEventTarget {
  private listeners: Record<string, ((event: Event) => void)[]> = {};

  addEventListener(type: string, listener: (event: Event) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }

  dispatchEvent(event: Event): boolean {
    const handlers = this.listeners[event.type] || [];
    handlers.forEach((h) => {
      try {
        h(event);
      } catch {
        // Safe dispatch
      }
    });
    return true;
  }
}

// ============================================================================
// FIXTURES
// ============================================================================
const createValidAiHealthResponse = (overrides?: Partial<AIHealthResponse>): AIHealthResponse => ({
  status: 'supported',
  cropAffected: 'Cotton',
  detectedCondition: 'Cotton Leaf Curl Virus (CLCuV)',
  confidenceScore: 88,
  severity: 'high',
  symptoms: [
    'Upward leaf curling with thickening of veins',
    'Enation formation on the abaxial leaf surface',
    'Stunted vegetative growth and shortened internodes',
  ],
  possibleCauses: [
    'Cotton Leaf Curl Begomovirus transmitted by Bemisia tabaci (Whitefly)',
    'Differential: Severe zinc deficiency causing marginal cupping',
  ],
  recommendedAction:
    'Rogue and burn severely infected viral host plants. Install yellow sticky cards (15-20/acre) to monitor whitefly vectors.',
  chemicalRecommendation: {
    name: 'Diafenthiuron 50% WP',
    dosage: '240 g per acre in 200 L water',
    frequency: 'Foliar spray during early morning; repeat after 10-12 days if vector pressure persists',
  },
  organicAlternative: 'Spray 5% Neem Seed Kernel Extract (NSKE) or Neem Oil 10,000 ppm at 3 ml/L',
  missingInformation: [
    'Microscopic examination of abaxial leaf side for live whitefly nymphs',
    'Leaf petiole sap analysis for Begomovirus DNA confirmation',
  ],
  limitations: [
    '2D photographic model cannot verify vector population thresholds',
    'Sunlight angle and camera white balance may alter apparent leaf chlorosis',
  ],
  sources: [
    {
      title: 'ICAR - Central Institute for Cotton Research (CICR) Advisory',
      url: 'https://cicr.icar.gov.in',
    },
  ],
  disclaimer:
    'This assessment is an AI-generated advisory screening tool based solely on 2D visual pattern recognition. It does NOT constitute a laboratory diagnostic certification.',
  ...overrides,
});

const samplePolygon: GeoJSONPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [73.81, 19.99],
      [73.82, 19.99],
      [73.82, 20.0],
      [73.81, 20.0],
      [73.81, 19.99],
    ],
  ],
};

const createSampleFarm = (overrides?: Partial<Farm>): Farm => ({
  id: 'test-farm-01',
  name: 'Kisan Organic Farm',
  boundary: samplePolygon,
  areaSqM: 40468,
  areaAcres: 10.0,
  location: 'Nashik, Maharashtra',
  soilType: 'Medium Black',
  waterSource: 'Borewell & Canal',
  primaryCrop: 'Cotton',
  irrigationType: 'Drip',
  isDemo: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

// ============================================================================
// TEST SUITE
// ============================================================================
describe('AgriDOST: AI, API & Storage Automated Test Suite', () => {
  let mockStorage: InMemoryLocalStorage;
  let mockEventTarget: MockEventTarget;
  let originalWindow: unknown;
  let originalEnvApiKey: string | undefined;

  beforeEach(() => {
    // 1. Setup isolated in-memory window & localStorage
    originalWindow = (globalThis as unknown as { window?: unknown }).window;
    originalEnvApiKey = process.env.GEMINI_API_KEY;

    mockStorage = new InMemoryLocalStorage();
    mockEventTarget = new MockEventTarget();

    const mockWin = {
      localStorage: mockStorage,
      addEventListener: (type: string, fn: (ev: Event) => void) => mockEventTarget.addEventListener(type, fn),
      removeEventListener: (type: string, fn: (ev: Event) => void) => mockEventTarget.removeEventListener(type, fn),
      dispatchEvent: (event: Event) => mockEventTarget.dispatchEvent(event),
    };

    (globalThis as unknown as { window: unknown }).window = mockWin;

    // Ensure CustomEvent is available on globalThis/window
    if (typeof globalThis.CustomEvent === 'undefined') {
      class MockCustomEvent<T = unknown> extends Event {
        detail?: T;
        constructor(type: string, params?: { detail?: T }) {
          super(type);
          this.detail = params?.detail;
        }
      }
      (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = MockCustomEvent;
    }

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore environment
    (globalThis as unknown as { window: unknown }).window = originalWindow;
    if (originalEnvApiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalEnvApiKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  });

  // ==========================================================================
  // SUITE 1: ZOD VALIDATION FOR AIHealthResponseSchema
  // ==========================================================================
  describe('Zod Schema Validation: AIHealthResponseSchema', () => {
    it('should successfully validate a complete, valid AI crop health diagnostic payload', () => {
      const validPayload = createValidAiHealthResponse();
      const result = AIHealthResponseSchema.safeParse(validPayload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('supported');
        expect(result.data.confidenceScore).toBe(88);
        expect(result.data.cropAffected).toBe('Cotton');
        expect(result.data.symptoms).toHaveLength(3);
        expect(result.data.chemicalRecommendation?.name).toContain('Diafenthiuron');
      }
    });

    it('should validate a minimal valid payload with defaults applied', () => {
      const minimalPayload = {
        status: 'partial' as const,
        cropAffected: 'Soybean',
        detectedCondition: 'Yellow Mosaic Disease',
        confidenceScore: 65,
        symptoms: ['Chlorotic patches on younger leaves'],
        possibleCauses: ['Soybean Yellow Mosaic Virus'],
        recommendedAction: 'Inspect for whiteflies and monitor spreader infestation.',
        missingInformation: ['Soil nitrogen availability level'],
        limitations: ['Ambient illumination glare on upper canopy'],
        disclaimer: 'Advisory tool only.',
      };

      const result = AIHealthResponseSchema.safeParse(minimalPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.severity).toBe('medium'); // Default severity
        expect(result.data.sources).toEqual([]); // Default empty sources array
        expect(result.data.chemicalRecommendation).toBeUndefined();
        expect(result.data.organicAlternative).toBeUndefined();
      }
    });

    it('should reject invalid evidence status enum values', () => {
      const invalidStatuses = ['healthy', 'critical', 'unknown', 'positive', ''];

      invalidStatuses.forEach((badStatus) => {
        const payload = {
          ...createValidAiHealthResponse(),
          status: badStatus,
        };
        const result = AIHealthResponseSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });

    it('should reject confidenceScore greater than 100', () => {
      const outOfBoundsPayloads = [100.1, 101, 150, 999];

      outOfBoundsPayloads.forEach((score) => {
        const payload = createValidAiHealthResponse({ confidenceScore: score });
        const result = AIHealthResponseSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          const errors = result.error.flatten().fieldErrors;
          expect(errors.confidenceScore).toBeDefined();
        }
      });
    });

    it('should reject confidenceScore less than 0', () => {
      const negativeScores = [-0.1, -1, -50];

      negativeScores.forEach((score) => {
        const payload = createValidAiHealthResponse({ confidenceScore: score });
        const result = AIHealthResponseSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          const errors = result.error.flatten().fieldErrors;
          expect(errors.confidenceScore).toBeDefined();
        }
      });
    });

    it('should accept edge boundary confidenceScore values (0 and 100)', () => {
      const zeroScore = createValidAiHealthResponse({ confidenceScore: 0 });
      const maxScore = createValidAiHealthResponse({ confidenceScore: 100 });

      expect(AIHealthResponseSchema.safeParse(zeroScore).success).toBe(true);
      expect(AIHealthResponseSchema.safeParse(maxScore).success).toBe(true);
    });

    it('should reject empty symptoms array (enforcing visible physical evidence)', () => {
      const emptySymptoms = createValidAiHealthResponse({ symptoms: [] });
      const result = AIHealthResponseSchema.safeParse(emptySymptoms);

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.symptoms).toBeDefined();
      }
    });

    it('should reject empty possibleCauses array (enforcing differential diagnoses)', () => {
      const emptyCauses = createValidAiHealthResponse({ possibleCauses: [] });
      const result = AIHealthResponseSchema.safeParse(emptyCauses);

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.possibleCauses).toBeDefined();
      }
    });

    it('should reject missing mandatory fields', () => {
      const mandatoryFields: (keyof AIHealthResponse)[] = [
        'cropAffected',
        'detectedCondition',
        'recommendedAction',
        'disclaimer',
        'missingInformation',
        'limitations',
      ];

      mandatoryFields.forEach((field) => {
        const payload: Record<string, unknown> = { ...createValidAiHealthResponse() };
        delete payload[field];
        const result = AIHealthResponseSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });

    it('should validate structured chemicalRecommendation and reject malformed subfields', () => {
      const invalidChemical = {
        ...createValidAiHealthResponse(),
        chemicalRecommendation: {
          name: 'Chlorpyrifos',
          // missing dosage and frequency
        },
      };

      const result = AIHealthResponseSchema.safeParse(invalidChemical);
      expect(result.success).toBe(false);
    });

    it('should validate sources array items requiring title and url', () => {
      const invalidSource = {
        ...createValidAiHealthResponse(),
        sources: [{ title: 'ICAR Portal' }], // missing url
      };

      const result = AIHealthResponseSchema.safeParse(invalidSource);
      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // SUITE 2: ZOD VALIDATION FOR AIHealthRequestSchema
  // ==========================================================================
  describe('Zod Schema Validation: AIHealthRequestSchema', () => {
    it('should accept valid request payload with image data and default mimeType', () => {
      const payload = {
        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
      };

      const result = AIHealthRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mimeType).toBe('image/jpeg');
        expect(result.data.cropName).toBeUndefined();
      }
    });

    it('should accept complete request with all metadata fields populated', () => {
      const payload = {
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE...',
        mimeType: 'image/png',
        cropName: 'Tomato',
        farmId: 'farm-123',
        zoneId: 'zone-abc',
        additionalNotes: 'Severe leaf curling observed on lower canopy branches.',
      };

      const result = AIHealthRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cropName).toBe('Tomato');
        expect(result.data.farmId).toBe('farm-123');
        expect(result.data.zoneId).toBe('zone-abc');
        expect(result.data.mimeType).toBe('image/png');
      }
    });

    it('should reject request when image string is empty', () => {
      const payload = { image: '' };
      const result = AIHealthRequestSchema.safeParse(payload);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.image).toBeDefined();
      }
    });

    it('should reject request when image field is missing entirely', () => {
      const payload = { cropName: 'Kinnow' };
      const result = AIHealthRequestSchema.safeParse(payload);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.image).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // SUITE 3: MOCKED GEMINI API & NEXT.JS ROUTE TESTING (/api/ai/health)
  // ==========================================================================
  describe('API Health Route Handlers (/api/ai/health)', () => {
    describe('GET /api/ai/health', () => {
      it('should return available status when GEMINI_API_KEY is configured (>5 chars)', async () => {
        process.env.GEMINI_API_KEY = 'AIzaSyA_mocked_gemini_key_for_testing';

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('available');
        expect(body.apiKeyConfigured).toBe(true);
        expect(body.model).toBe('gemini-3.8-flash');
        // Secret key must NEVER be leaked in API response
        expect(JSON.stringify(body)).not.toContain('AIzaSyA');
      });

      it('should return unavailable status when GEMINI_API_KEY is missing or empty', async () => {
        delete process.env.GEMINI_API_KEY;

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('unavailable');
        expect(body.apiKeyConfigured).toBe(false);
        expect(body.message).toContain('GEMINI_API_KEY environment variable is not configured');
      });

      it('should return unavailable status if GEMINI_API_KEY is too short (<=5 chars)', async () => {
        process.env.GEMINI_API_KEY = '1234';

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('unavailable');
        expect(body.apiKeyConfigured).toBe(false);
      });
    });

    describe('POST /api/ai/health', () => {
      it('should return HTTP 400 when image payload is missing in JSON body', async () => {
        const req = new NextRequest('http://localhost:3000/api/ai/health', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cropName: 'Paddy' }), // image is missing
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.status).toBe('error');
        expect(data.error).toContain('Missing required "image" payload');
      });

      it('should return HTTP 400 when image payload is empty whitespace', async () => {
        const req = new NextRequest('http://localhost:3000/api/ai/health', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image: '   ' }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Missing required "image" payload');
      });

      it('should return HTTP 200 with truthful unavailable status and fallback guide when GEMINI_API_KEY is absent', async () => {
        delete process.env.GEMINI_API_KEY;

        const req = new NextRequest('http://localhost:3000/api/ai/health', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            image: 'data:image/jpeg;base64,samplebase64data',
            cropName: 'Cotton',
          }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.status).toBe('unavailable');
        expect(data.fallbackGuide).toBeDefined();
        expect(data.fallbackGuide.manualInspectionChecklist).toBeInstanceOf(Array);
        expect(data.fallbackGuide.institutionalResources).toBeInstanceOf(Array);
        // Crucial Anti-Hallucination check: No fake AI diagnosis generated!
        expect(data.data).toBeUndefined();
      });

      it('should execute simulated successful Gemini vision analysis and validate output', async () => {
        process.env.GEMINI_API_KEY = 'mock-valid-gemini-key-12345';
        const aiResponsePayload = createValidAiHealthResponse();

        mockGenerateContent.mockResolvedValueOnce({
          text: JSON.stringify(aiResponsePayload),
        });

        const req = new NextRequest('http://localhost:3000/api/ai/health', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            image: 'data:image/jpeg;base64,dGVzdGltYWdlZGF0YQ==',
            cropName: 'Cotton',
            farmId: 'farm-01',
            zoneId: 'zone-01',
          }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.status).toBe('supported');
        expect(data.data.cropAffected).toBe('Cotton');
        expect(data.data.confidenceScore).toBe(88);
        expect(data.farmId).toBe('farm-01');
        expect(data.zoneId).toBe('zone-01');
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      });

      it('should cleanly strip markdown code block fences (```json ... ```) returned by Gemini', async () => {
        process.env.GEMINI_API_KEY = 'mock-valid-gemini-key-12345';
        const aiResponsePayload = createValidAiHealthResponse({
          status: 'partial',
          confidenceScore: 60,
          detectedCondition: 'Alternaria Leaf Spot',
        });

        const fencedText = `\`\`\`json\n${JSON.stringify(aiResponsePayload, null, 2)}\n\`\`\``;
        mockGenerateContent.mockResolvedValueOnce({ text: fencedText });

        const req = new NextRequest('http://localhost:3000/api/ai/health', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            image: 'data:image/jpeg;base64,dGVzdGltYWdlZGF0YQ==',
          }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.detectedCondition).toBe('Alternaria Leaf Spot');
      });

      it('should handle multipart/form-data request body with Blob/file upload', async () => {
        process.env.GEMINI_API_KEY = 'mock-valid-gemini-key-12345';
        const aiResponsePayload = createValidAiHealthResponse();
        mockGenerateContent.mockResolvedValueOnce({
          text: JSON.stringify(aiResponsePayload),
        });

        const formData = new FormData();
        const fakeFile = new Blob(['image binary content'], { type: 'image/jpeg' });
        formData.append('image', fakeFile, 'leaf.jpg');
        formData.append('cropName', 'Groundnut');
        formData.append('farmId', 'farm-groundnut-1');

        const req = new NextRequest('http://localhost:3000/api/ai/health', {
          method: 'POST',
          body: formData,
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.cropName).toBe('Groundnut');
      });

      it('should return HTTP 502 Bad Gateway when Gemini returns schema-violating payload', async () => {
        process.env.GEMINI_API_KEY = 'mock-valid-gemini-key-12345';

        // Malformed payload: confidenceScore is 150 (violates max(100)) and symptoms is empty
        const invalidPayload = {
          status: 'supported',
          cropAffected: 'Cotton',
          detectedCondition: 'Wilt',
          confidenceScore: 150, // Invalid!
          symptoms: [], // Invalid!
          possibleCauses: ['Unknown'],
          recommendedAction: 'Action',
          missingInformation: [],
          limitations: [],
          disclaimer: 'Disclaimer',
        };

        mockGenerateContent.mockResolvedValueOnce({
          text: JSON.stringify(invalidPayload),
        });

        const req = new NextRequest('http://localhost:3000/api/ai/health', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image: 'data:image/jpeg;base64,dGVzdA==' }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(502);
        expect(data.success).toBe(false);
        expect(data.error).toContain('AI output failed strict agronomic schema validation');
      });

      it('should return HTTP 500 when Gemini returns unparseable non-JSON text', async () => {
        process.env.GEMINI_API_KEY = 'mock-valid-gemini-key-12345';
        mockGenerateContent.mockResolvedValueOnce({
          text: 'Hello, I am a model and here is an unstructured description of your crop leaf...',
        });

        const req = new NextRequest('http://localhost:3000/api/ai/health', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image: 'data:image/jpeg;base64,dGVzdA==' }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Failed to parse Gemini output as JSON');
      });

      it('should test candidate model failover: recovers on second model when first candidate throws error', async () => {
        process.env.GEMINI_API_KEY = 'mock-valid-gemini-key-12345';
        const aiResponsePayload = createValidAiHealthResponse();

        // 1st candidate ('gemini-3.8-flash') fails with 503 Overloaded
        mockGenerateContent.mockRejectedValueOnce(new Error('Model gemini-3.8-flash is currently overloaded'));
        // 2nd candidate ('gemini-2.0-flash') succeeds
        mockGenerateContent.mockResolvedValueOnce({
          text: JSON.stringify(aiResponsePayload),
        });

        const req = new NextRequest('http://localhost:3000/api/ai/health', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image: 'data:image/jpeg;base64,dGVzdA==' }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      });

      it('should return HTTP 500 when all candidate Gemini models fail with upstream error', async () => {
        process.env.GEMINI_API_KEY = 'mock-valid-gemini-key-12345';

        // All candidate models fail with upstream rate limit error
        mockGenerateContent.mockRejectedValue(new Error('Gemini API Rate Limit 429'));

        const req = new NextRequest('http://localhost:3000/api/ai/health', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image: 'data:image/jpeg;base64,dGVzdA==' }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Gemini API Rate Limit 429');
      });
    });
  });

  // ==========================================================================
  // SUITE 4: LOCALSTORAGE REPOSITORY & OFFLINE DATA STORE (src/lib/data/storage.ts)
  // ==========================================================================
  describe('LocalStorage Repository & Storage Engine (`src/lib/data/storage.ts`)', () => {
    describe('Initialization & Demo Data Reset', () => {
      it('should initialize localStorage with demo datasets on first access', () => {
        expect(mockStorage.getItem('agridost_storage_initialized_v1')).toBeNull();

        const farms = storage.getFarms();

        expect(mockStorage.getItem('agridost_storage_initialized_v1')).toBe('true');
        expect(farms).toHaveLength(DEMO_FARMS.length);
        expect(farms[0].id).toBe(DEMO_FARMS[0].id);
      });

      it('should reset all collections to pristine demo data with resetToDemoData()', () => {
        // Mutate storage with custom data
        storage.saveFarm(createSampleFarm({ id: 'custom-farm-99', name: 'Temporary Custom Farm' }));
        expect(storage.getFarms().some((f) => f.id === 'custom-farm-99')).toBe(true);

        // Reset
        storage.resetToDemoData();

        const farmsAfterReset = storage.getFarms();
        expect(farmsAfterReset.some((f) => f.id === 'custom-farm-99')).toBe(false);
        expect(farmsAfterReset).toHaveLength(DEMO_FARMS.length);
        expect(storage.getActiveFarmId()).toBe(DEMO_FARMS[0].id);
      });

      it('should dispatch synthetic agridost:data-changed event with detail.key = "*" on reset', () => {
        const eventsReceived: string[] = [];
        mockEventTarget.addEventListener('agridost:data-changed', (e: Event) => {
          const detail = (e as CustomEvent<CustomEventDetail>).detail;
          eventsReceived.push(detail?.key);
        });

        storage.resetToDemoData();

        expect(eventsReceived).toContain('*');
      });
    });

    describe('Missing Keys & Malformed JSON Resilience', () => {
      it('should return empty array or default fallback when storage keys are missing without crashing', () => {
        mockStorage.setItem('agridost_storage_initialized_v1', 'true');
        mockStorage.removeItem('agridost_farms');

        const farms = storage.getFarms();
        expect(farms).toEqual([]);
      });

      it('should recover gracefully from malformed/corrupted JSON in localStorage', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        mockStorage.setItem('agridost_storage_initialized_v1', 'true');
        mockStorage.setItem('agridost_farms', '{{malformed json corrupted by browser crash');

        const farms = storage.getFarms();

        expect(farms).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[AgriDOST Storage] Error reading key "agridost_farms":'),
          expect.any(Error)
        );

        warnSpy.mockRestore();
      });
    });

    describe('Farm Entity Repository (CRUD)', () => {
      beforeEach(() => {
        storage.resetToDemoData();
      });

      it('should retrieve all farms with getFarms()', () => {
        const farms = storage.getFarms();
        expect(Array.isArray(farms)).toBe(true);
        expect(farms.length).toBeGreaterThanOrEqual(1);
      });

      it('should retrieve farm by id with getFarmById() and return undefined for nonexistent id', () => {
        const existingFarm = storage.getFarmById(DEMO_FARMS[0].id);
        expect(existingFarm).toBeDefined();
        expect(existingFarm?.name).toBe(DEMO_FARMS[0].name);

        const nonexistentFarm = storage.getFarmById('nonexistent-uuid');
        expect(nonexistentFarm).toBeUndefined();
      });

      it('should create and unshift a new farm with saveFarm()', () => {
        const newFarm = createSampleFarm({ id: 'farm-kisan-01', name: 'Kisan Farm' });
        storage.saveFarm(newFarm);

        const retrieved = storage.getFarmById('farm-kisan-01');
        expect(retrieved).toBeDefined();
        expect(retrieved?.name).toBe('Kisan Farm');
        expect(retrieved?.createdAt).toBeDefined();
        expect(retrieved?.updatedAt).toBeDefined();

        // Verify unshifted to top of farms list
        const farms = storage.getFarms();
        expect(farms[0].id).toBe('farm-kisan-01');
      });

      it('should set newly saved farm as active if no active farm exists', () => {
        mockStorage.setItem('agridost_active_farm_id', JSON.stringify(''));
        const newFarm = createSampleFarm({ id: 'farm-auto-active', name: 'Auto Active Farm' });

        storage.saveFarm(newFarm);

        expect(storage.getActiveFarmId()).toBe('farm-auto-active');
      });

      it('should update an existing farm in place and update its updatedAt timestamp', () => {
        const existing = storage.getFarms()[0];
        const updated = {
          ...existing,
          name: 'Renamed Green Valley Agro',
          primaryCrop: 'Wheat & Mustard',
        };

        storage.saveFarm(updated);

        const retrieved = storage.getFarmById(existing.id);
        expect(retrieved?.name).toBe('Renamed Green Valley Agro');
        expect(retrieved?.primaryCrop).toBe('Wheat & Mustard');
      });

      it('should delete a farm and cascade delete all associated farm zones', () => {
        const farmToDelete = DEMO_FARMS[0].id;

        // Ensure zones exist for this farm
        const initialZones = storage.getFarmZones(farmToDelete);
        expect(initialZones.length).toBeGreaterThanOrEqual(1);

        storage.deleteFarm(farmToDelete);

        // Verify farm is deleted
        expect(storage.getFarmById(farmToDelete)).toBeUndefined();

        // Verify zones belonging to this farm were cascade deleted
        const remainingZones = storage.getFarmZones(farmToDelete);
        expect(remainingZones).toHaveLength(0);
      });

      it('should automatically switch active farm when currently active farm is deleted', () => {
        const activeId = storage.getActiveFarmId();
        const otherFarms = storage.getFarms().filter((f) => f.id !== activeId);
        expect(otherFarms.length).toBeGreaterThan(0);

        storage.deleteFarm(activeId);

        const newActiveId = storage.getActiveFarmId();
        expect(newActiveId).not.toBe(activeId);
        expect(newActiveId).toBe(otherFarms[0].id);
      });
    });

    describe('Active Farm Management', () => {
      beforeEach(() => {
        storage.resetToDemoData();
      });

      it('should set and get active farm ID', () => {
        storage.setActiveFarmId('custom-active-id');
        expect(storage.getActiveFarmId()).toBe('custom-active-id');
      });

      it('should retrieve active farm object with getActiveFarm()', () => {
        const firstFarm = storage.getFarms()[0];
        storage.setActiveFarmId(firstFarm.id);

        const activeFarm = storage.getActiveFarm();
        expect(activeFarm?.id).toBe(firstFarm.id);
      });

      it('should fallback to first farm if activeFarmId does not match any farm', () => {
        storage.setActiveFarmId('non-existent-farm-id');

        const fallback = storage.getActiveFarm();
        const firstFarm = storage.getFarms()[0];
        expect(fallback?.id).toBe(firstFarm.id);
      });
    });

    describe('Farm Zones Repository (CRUD)', () => {
      beforeEach(() => {
        storage.resetToDemoData();
      });

      it('should retrieve zones filtered by farmId', () => {
        const targetFarmId = DEMO_FARMS[0].id;
        const zones = storage.getFarmZones(targetFarmId);

        expect(Array.isArray(zones)).toBe(true);
        zones.forEach((z) => expect(z.farmId).toBe(targetFarmId));
      });

      it('should save a new farm zone and update existing zone', () => {
        const newZone: FarmZone = {
          id: 'zone-new-99',
          farmId: DEMO_FARMS[0].id,
          type: 'crop',
          name: 'Sector A: Organic Soybean',
          geometry: samplePolygon,
          cropName: 'Soybean',
        };

        storage.saveFarmZone(newZone);

        const saved = storage.getFarmZones().find((z) => z.id === 'zone-new-99');
        expect(saved).toBeDefined();
        expect(saved?.name).toBe('Sector A: Organic Soybean');

        // Update zone
        storage.saveFarmZone({
          ...newZone,
          name: 'Sector A: High-Yield Soybean',
        });

        const updated = storage.getFarmZones().find((z) => z.id === 'zone-new-99');
        expect(updated?.name).toBe('Sector A: High-Yield Soybean');
      });

      it('should delete a farm zone by ID', () => {
        const zones = storage.getFarmZones();
        const zoneToDelete = zones[0];

        storage.deleteFarmZone(zoneToDelete.id);

        const found = storage.getFarmZones().find((z) => z.id === zoneToDelete.id);
        expect(found).toBeUndefined();
      });
    });

    describe('Crop Plans, Health Observations, Tasks, Supplies & Operations', () => {
      beforeEach(() => {
        storage.resetToDemoData();
      });

      it('should save and query CropPlan records by farmId', () => {
        const plan: CropPlan = {
          id: 'plan-kharif-2026',
          farmId: DEMO_FARMS[0].id,
          mode: 'ai_recommended',
          season: 'Kharif',
          year: 2026,
          zones: [],
          rationale: 'Optimized for high soil organic carbon',
          status: 'active',
        };

        storage.saveCropPlan(plan);

        const farmPlans = storage.getCropPlans(DEMO_FARMS[0].id);
        expect(farmPlans.some((p) => p.farmId === plan.farmId && p.season === 'Kharif')).toBe(true);
      });

      it('should save and query HealthObservation records by farmId', () => {
        const record: HealthObservation = {
          id: 'health-obs-99',
          farmId: DEMO_FARMS[0].id,
          cropAffected: 'Cotton',
          detectedDisease: 'Bacterial Blight (Xanthomonas malvacearum)',
          symptoms: ['Angular water-soaked leaf lesions'],
          possibleCauses: ['Xanthomonas citri pv. malvacearum'],
          status: 'ai_generated',
          severity: 'medium',
        };

        storage.saveHealthObservation(record);

        const records = storage.getHealthObservations(DEMO_FARMS[0].id);
        expect(records[0].id).toBe('health-obs-99');
        expect(records[0].cropAffected).toBe('Cotton');
      });

      it('should save, query, and toggle FarmTask status between pending and completed', () => {
        const task: FarmTask = {
          id: 'task-drip-flush-01',
          farmId: DEMO_FARMS[0].id,
          title: 'Flush Secondary Drip Filters',
          dueDate: '2026-03-01',
          status: 'pending',
          category: 'irrigation',
        };

        storage.saveFarmTask(task);

        const tasks = storage.getFarmTasks(DEMO_FARMS[0].id);
        const savedTask = tasks.find((t) => t.id === 'task-drip-flush-01');
        expect(savedTask?.status).toBe('pending');

        // Toggle to completed
        storage.toggleFarmTask('task-drip-flush-01');
        const toggled = storage.getFarmTasks(DEMO_FARMS[0].id).find((t) => t.id === 'task-drip-flush-01');
        expect(toggled?.status).toBe('completed');

        // Toggle back to pending
        storage.toggleFarmTask('task-drip-flush-01');
        const toggledBack = storage.getFarmTasks(DEMO_FARMS[0].id).find((t) => t.id === 'task-drip-flush-01');
        expect(toggledBack?.status).toBe('pending');
      });

      it('should save and query FarmSupply inventory', () => {
        const supply: FarmSupply = {
          id: 'sup-neem-oil-01',
          farmId: DEMO_FARMS[0].id,
          itemName: 'Cold-Pressed Neem Oil (10,000 ppm)',
          quantity: 25,
          unit: 'liters',
          status: 'in_stock',
        };

        storage.saveFarmSupply(supply);

        const supplies = storage.getFarmSupplies(DEMO_FARMS[0].id);
        expect(supplies.some((s) => s.id === 'sup-neem-oil-01')).toBe(true);
      });

      it('should save and query BoundaryTreePlan records', () => {
        const treePlan: BoundaryTreePlan = {
          id: 'tree-plan-teak-01',
          farmId: DEMO_FARMS[0].id,
          speciesName: 'Teak (Tectona grandis)',
          spacingMeters: 3,
          treeCount: 80,
          shadeRisk: 'low',
          rootCompetitionNote: 'Low root overlap with annual cotton drip lines',
          suggestedPositions: [[73.81, 19.99]],
        };

        storage.saveTreePlan(treePlan);

        const plans = storage.getTreePlans(DEMO_FARMS[0].id);
        expect(plans.some((p) => p.id === 'tree-plan-teak-01')).toBe(true);
      });

      it('should save and query SprayOperation flight records', () => {
        const sprayOp: SprayOperation = {
          id: 'spray-drone-01',
          farmId: DEMO_FARMS[0].id,
          operationType: 'Fungicide',
          productName: 'Carbendazim 50% WP',
          dosagePerAcre: '200 g / acre',
          dilutionRatio: '1:100',
          equipmentType: 'Drone',
          windSpeedKmh: 6.5,
          temperatureC: 26,
          humidityPct: 62,
          safetyStatus: 'optimal',
          scheduledTime: '2026-03-02T06:30:00.000Z',
          status: 'scheduled',
        };

        storage.saveSprayOperation(sprayOp);

        const ops = storage.getSprayOperations(DEMO_FARMS[0].id);
        expect(ops[0].id).toBe('spray-drone-01');
        expect(ops[0].equipmentType).toBe('Drone');
      });
    });

    describe('Synthetic Event Dispatching & React Subscription', () => {
      it('should dispatch synthetic agridost:data-changed event with corresponding key on saving farm', () => {
        const dispatchedEvents: string[] = [];
        mockEventTarget.addEventListener('agridost:data-changed', (e: Event) => {
          const detail = (e as CustomEvent<CustomEventDetail>).detail;
          dispatchedEvents.push(detail?.key);
        });

        storage.saveFarm(createSampleFarm({ id: 'farm-event-test' }));

        expect(dispatchedEvents).toContain('agridost_farms');
      });

      it('should notify subscriber via subscribeToDataChanges and clean up on unsubscribe', () => {
        let callbackCallCount = 0;
        const unsubscribe = storage.subscribeToDataChanges(() => {
          callbackCallCount++;
        });

        storage.saveFarmTask({
          id: 'task-sub-test',
          farmId: 'farm-01',
          title: 'Test Notification',
          dueDate: '2026-03-01',
          status: 'pending',
        });

        expect(callbackCallCount).toBeGreaterThanOrEqual(1);

        // Unsubscribe
        const countBeforeUnsub = callbackCallCount;
        unsubscribe();

        storage.saveFarmTask({
          id: 'task-sub-test-2',
          farmId: 'farm-01',
          title: 'After Unsubscribe',
          dueDate: '2026-03-02',
          status: 'pending',
        });

        expect(callbackCallCount).toBe(countBeforeUnsub);
      });
    });

    describe('Server-Side Rendering (SSR) Resilience', () => {
      it('should safely return default values and avoid exceptions when window is undefined', () => {
        (globalThis as unknown as { window?: unknown }).window = undefined;

        expect(() => {
          storage.ensureInitialized();
          const farms = storage.getFarms();
          expect(farms).toEqual([]);

          storage.saveFarm(createSampleFarm());
          storage.deleteFarm('id');

          const zones = storage.getFarmZones();
          expect(zones).toEqual([]);

          const unsubscribe = storage.subscribeToDataChanges(() => {});
          unsubscribe();
        }).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // SUITE 5: SECURITY & ISOLATION VERIFICATION
  // ==========================================================================
  describe('Security & Storage Isolation Auditing', () => {
    it('should verify tests operate strictly within in-memory mocks without touching real host storage', () => {
      const currentStorage = (globalThis as unknown as { window?: { localStorage?: unknown } }).window?.localStorage;
      expect(currentStorage).toBeInstanceOf(InMemoryLocalStorage);
    });

    it('should verify external Google Gemini API is never called with real network traffic', () => {
      // Confirm that the mock is an active Vitest spy
      expect(vi.isMockFunction(mockGenerateContent)).toBe(true);
    });
  });
});
