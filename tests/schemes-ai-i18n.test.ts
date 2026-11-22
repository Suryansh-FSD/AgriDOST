/**
 * tests/schemes-ai-i18n.test.ts
 * 
 * Comprehensive QA Test Suite for AgriDOST:
 * 1. Multilingual Support (i18n dictionary completeness & Hindi/English translations)
 * 2. Prompt Formatter & Anti-Hallucination Grounding Rules
 * 3. Offline Deterministic Q&A Fallback Engine (Zero-network farmer support)
 * 4. Scheme AI Route API Validation (GET status & POST schema validation)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  SCHEMES_DICTIONARY,
  t,
  getDictionary,
  SupportedLanguage,
} from '@/lib/i18n';
import {
  SCHEMES_SYSTEM_PROMPT,
  formatSchemesContext,
  getOfflineSchemeAnswer,
} from '@/lib/ai/schemes-prompt';
import { GET, POST, SchemeAiRequestSchema } from '@/app/api/ai/schemes/route';
import { getAllSchemes, getSchemeById } from '@/lib/schemes';
import { GovernmentScheme, Farm } from '@/types';

// Mock @google/genai
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

// Mock farm for testing context injection
const MOCK_FARM: Farm = {
  id: 'farm-test-1',
  name: 'Ramesh Patel Organic Farm',
  boundary: {
    type: 'Polygon',
    coordinates: [
      [
        [75.85, 22.71],
        [75.86, 22.71],
        [75.86, 22.72],
        [75.85, 22.72],
        [75.85, 22.71],
      ],
    ],
  },
  areaSqM: 18210,
  areaAcres: 4.5,
  locationDetails: {
    state: 'Maharashtra',
    district: 'Nashik',
    city: 'Nashik',
    country: 'India',
    coordinates: [75.85, 22.71],
    pincode: '422001',
  },
  primaryCrop: 'Soybean',
  soilType: 'Black Clay Loam',
  waterSource: 'Borewell & Canal',
  irrigationType: 'Drip Irrigation',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// ============================================================================
// 1. MULTILINGUAL SUPPORT & i18n DICTIONARY TESTS
// ============================================================================
describe('Multilingual Support & i18n Dictionary', () => {
  it('should have complete English and Hindi translations for all dictionary keys', () => {
    const keys = Object.keys(SCHEMES_DICTIONARY);
    expect(keys.length).toBeGreaterThan(30);

    for (const key of keys) {
      const entry = SCHEMES_DICTIONARY[key];
      expect(entry, `Key ${key} must exist`).toBeDefined();
      expect(entry.en, `English translation for ${key} cannot be empty`).toBeTruthy();
      expect(entry.hi, `Hindi translation for ${key} cannot be empty`).toBeTruthy();
      expect(entry.en.trim().length).toBeGreaterThan(0);
      expect(entry.hi.trim().length).toBeGreaterThan(0);
    }
  });

  it('should translate core navigation and headings accurately', () => {
    expect(t('nav.title', 'en')).toBe('Government Assistance');
    expect(t('nav.title', 'hi')).toBe('सरकारी योजनाएं और सहायता');

    expect(t('nav.aiAdvisor', 'en')).toBe('AI Scheme Advisor');
    expect(t('nav.aiAdvisor', 'hi')).toBe('एआई योजना सलाहकार');

    expect(t('nav.tracker', 'en')).toBe('My Applications');
    expect(t('nav.tracker', 'hi')).toBe('मेरे आवेदन');
  });

  it('should translate status badges and government levels in Hindi and English', () => {
    expect(t('status.eligible', 'en')).toBe('Eligible');
    expect(t('status.eligible', 'hi')).toBe('पात्र');

    expect(t('status.ineligible', 'en')).toBe('Ineligible');
    expect(t('status.ineligible', 'hi')).toBe('अपात्र');

    expect(t('status.submitted', 'en')).toBe('Submitted');
    expect(t('status.submitted', 'hi')).toBe('जमा किया गया');

    expect(t('level.central', 'en')).toBe('Central Government');
    expect(t('level.central', 'hi')).toBe('केंद्र सरकार');

    expect(t('level.state', 'en')).toBe('State Government');
    expect(t('level.state', 'hi')).toBe('राज्य सरकार');
  });

  it('should translate mandatory documents accurately', () => {
    expect(t('doc.aadhaar', 'hi')).toContain('आधार कार्ड');
    expect(t('doc.land_record', 'hi')).toContain('भूलेख');
    expect(t('doc.bank_passbook', 'hi')).toContain('बैंक पासबुक');
  });

  it('should gracefully fallback to key or English when key/language is missing', () => {
    expect(t('missing.unknown.key', 'en')).toBe('missing.unknown.key');
    expect(t('missing.unknown.key', 'hi')).toBe('missing.unknown.key');
  });

  it('should return complete dictionary map for getDictionary()', () => {
    const enDict = getDictionary('en');
    const hiDict = getDictionary('hi');

    expect(enDict['nav.title']).toBe('Government Assistance');
    expect(hiDict['nav.title']).toBe('सरकारी योजनाएं और सहायता');
    expect(Object.keys(enDict).length).toEqual(Object.keys(hiDict).length);
  });
});

// ============================================================================
// 2. ANTI-HALLUCINATION PROMPT & CONTEXT FORMATTER TESTS
// ============================================================================
describe('Anti-Hallucination Prompt & Context Formatter', () => {
  it('should include strict grounding rules, citations, and anti-fraud instructions in system prompt', () => {
    expect(SCHEMES_SYSTEM_PROMPT).toContain('STRICT GROUNDING');
    expect(SCHEMES_SYSTEM_PROMPT).toContain('CITATION REQUIREMENT');
    expect(SCHEMES_SYSTEM_PROMPT).toContain('UNVERIFIED SCHEMES REFUSAL');
    expect(SCHEMES_SYSTEM_PROMPT).toContain('NO APPROVAL GUARANTEES');
    expect(SCHEMES_SYSTEM_PROMPT).toContain('ZERO CREDENTIAL HARVESTING');
    expect(SCHEMES_SYSTEM_PROMPT).toContain('BILINGUAL FLUENCY');
    expect(SCHEMES_SYSTEM_PROMPT).toContain('Krishi Vigyan Kendra (KVK)');
  });

  it('should format verified schemes into grounded context with URLs and verified dates', () => {
    const allSchemes = getAllSchemes();
    expect(allSchemes.length).toBeGreaterThan(0);

    const formatted = formatSchemesContext(allSchemes, MOCK_FARM);

    expect(formatted).toContain('=== [VERIFIED SCHEME REGISTRY CONTEXT] ===');
    expect(formatted).toContain('ACTIVE FARM PROFILE CONTEXT:');
    expect(formatted).toContain('Ramesh Patel Organic Farm');
    expect(formatted).toContain('4.50 Acres');
    expect(formatted).toContain('Maharashtra');
    expect(formatted).toContain('Soybean');

    // Must include official URLs and dates
    expect(formatted).toContain('Official Info URL:');
    expect(formatted).toContain('Official Source Portal:');
    expect(formatted).toContain('Last Verified Date:');
  });

  it('should handle empty schemes context gracefully', () => {
    const formatted = formatSchemesContext([]);
    expect(formatted).toContain('No verified schemes provided in current query context');
  });
});

// ============================================================================
// 3. DETERMINISTIC OFFLINE Q&A FALLBACK ENGINE TESTS
// ============================================================================
describe('Deterministic Offline Q&A Fallback Engine', () => {
  const schemes = getAllSchemes();

  it('should accurately answer PM-KISAN amount and DBT details with official citations', () => {
    const res = getOfflineSchemeAnswer('How much is PM-KISAN installment?', schemes, MOCK_FARM, 'en');

    expect(res.isRecognized).toBe(true);
    expect(res.answer).toContain('₹6,000');
    expect(res.answer).toContain('₹2,000');
    expect(res.answer).toContain('DBT');
    expect(res.sources.length).toBeGreaterThan(0);
    expect(res.sources[0].url).toContain('pmkisan.gov.in');
    expect(res.verifiedDate).toBeDefined();
  });

  it('should accurately answer PM-KISAN eligibility criteria', () => {
    const res = getOfflineSchemeAnswer('Who is eligible for PM-KISAN?', schemes, MOCK_FARM, 'en');

    expect(res.isRecognized).toBe(true);
    expect(res.answer).toContain('landholding farmer');
    expect(res.answer).toContain('Aadhaar');
    expect(res.answer).toContain('e-KYC');
    expect(res.sources[0].url).toContain('pmkisan.gov.in');
  });

  it('should accurately answer PMFBY crop insurance premium rates', () => {
    const res = getOfflineSchemeAnswer('What are the premium rates for PMFBY crop insurance?', schemes, MOCK_FARM, 'en');

    expect(res.isRecognized).toBe(true);
    expect(res.answer).toContain('Kharif');
    expect(res.answer).toContain('Rabi');
    expect(res.sources[0].url).toContain('pmfby.gov.in');
  });

  it('should answer PM-KUSUM 60% solar pump subsidy query with required documents', () => {
    const res = getOfflineSchemeAnswer('What documents are needed for solar pump subsidy?', schemes, MOCK_FARM, 'en');

    expect(res.isRecognized).toBe(true);
    expect(res.answer).toContain('Aadhaar');
    expect(res.answer).toContain('Land Record');
    expect(res.answer).toContain('Bank Passbook');
    expect(res.sources[0].url).toContain('pmkusum.mnre.gov.in');
  });

  it('should return fluent Hindi responses when lang is "hi"', () => {
    const resHindi = getOfflineSchemeAnswer('पीएम किसान में कितनी राशि मिलती है?', schemes, MOCK_FARM, 'hi');

    expect(resHindi.isRecognized).toBe(true);
    expect(resHindi.answer).toContain('₹6,000');
    expect(resHindi.answer).toContain('₹2,000');
    expect(resHindi.answer).toContain('पीएम-किसान');
  });

  it('should provide state-specific scheme answers for Maharashtra', () => {
    const res = getOfflineSchemeAnswer('What schemes apply in Maharashtra?', schemes, MOCK_FARM, 'en');

    expect(res.isRecognized).toBe(true);
    expect(res.answer).toContain('Namo Shetkari');
    expect(res.sources.some((s) => s.url.includes('mahadbt.maharashtra.gov.in'))).toBe(true);
  });

  it('should strictly refuse unverified/rumored schemes and refer to KVK/CSC', () => {
    const unverifiedQuery = 'How to get ₹1,00,000 free cash grant under special lottery scheme?';
    const res = getOfflineSchemeAnswer(unverifiedQuery, schemes, MOCK_FARM, 'en');

    expect(res.isRecognized).toBe(false);
    expect(res.answer).toBe(
      'This scheme is not officially verified in AgriDOST registry. Please consult your local Krishi Vigyan Kendra (KVK) or CSC center.'
    );
    expect(res.sources[0].url).toContain('kvk.icar.gov.in');

    // Refusal in Hindi
    const resHi = getOfflineSchemeAnswer('फर्जी लॉटरी योजना के पैसे कब मिलेंगे?', schemes, MOCK_FARM, 'hi');
    expect(resHi.isRecognized).toBe(false);
    expect(resHi.answer).toContain('यह योजना एग्रीदोस्त रजिस्ट्री में आधिकारिक रूप से सत्यापित नहीं है');
  });
});

// ============================================================================
// 4. API ROUTE (/api/ai/schemes) VALIDATION & SCHEMA TESTS
// ============================================================================
describe('API Route /api/ai/schemes', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
  });

  it('GET /api/ai/schemes returns availability and model metadata', async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('unavailable');
    expect(data.apiKeyConfigured).toBe(false);
    expect(data.model).toBe('gemini-3.8-flash');
    expect(data.fallbackEngine).toBe('deterministic-offline-registry-v1');
  });

  it('POST /api/ai/schemes rejects empty or missing message with HTTP 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai/schemes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.status).toBe('error');
    expect(data.error).toContain('Message is required');
  });

  it('POST /api/ai/schemes rejects invalid non-JSON body with HTTP 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai/schemes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-not-json',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('POST /api/ai/schemes returns offline_fallback response when GEMINI_API_KEY is unset', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai/schemes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'How much is PM-KISAN installment?',
        schemeId: 'pm-kisan',
        lang: 'en',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('offline_fallback');
    expect(data.answer).toContain('₹6,000');
    expect(data.sources.length).toBeGreaterThan(0);
    expect(data.sources[0].url).toContain('pmkisan.gov.in');
  });

  it('Zod SchemeAiRequestSchema validates valid and invalid payloads properly', () => {
    const valid = SchemeAiRequestSchema.safeParse({
      message: 'Explain solar pump subsidy',
      schemeId: 'pm-kusum',
      lang: 'hi',
    });
    expect(valid.success).toBe(true);

    const invalidLang = SchemeAiRequestSchema.safeParse({
      message: 'Hello',
      lang: 'french', // only 'en' | 'hi' supported
    });
    expect(invalidLang.success).toBe(false);
  });

  it('POST /api/ai/schemes with valid GEMINI_API_KEY calls Gemini and returns success response', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-api-key-12345';

    mockGenerateContent.mockResolvedValueOnce({
      text: 'Under PM-KISAN, farmers receive ₹6,000 per year via DBT. Official Portal: https://pmkisan.gov.in',
    });

    const req = new NextRequest('http://localhost:3000/api/ai/schemes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Explain PM-KISAN benefits',
        schemeId: 'pm-kisan',
        lang: 'en',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('success');
    expect(data.answer).toContain('PM-KISAN');
    expect(data.model).toBe('gemini-3.8-flash');
    expect(data.sources.length).toBeGreaterThan(0);
  });

  it('POST /api/ai/schemes seamlessly falls back to offline engine when Gemini API call fails', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-api-key-12345';

    mockGenerateContent.mockRejectedValue(new Error('Quota exceeded or network timeout'));

    const req = new NextRequest('http://localhost:3000/api/ai/schemes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'How much is PM-KISAN installment?',
        schemeId: 'pm-kisan',
        lang: 'en',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('offline_fallback');
    expect(data.answer).toContain('₹6,000');
    expect(data.sources.length).toBeGreaterThan(0);
  });
});
