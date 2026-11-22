import { describe, it, expect } from 'vitest';
import { TinyFishClient, executeTinySearch, executeTinyFetch, runAgriculturalResearch } from '@/lib/integrations/tinyfish';

describe('TinyFish AI Live Network Integration Verification', () => {
  const liveApiKey = process.env.TINYFISH_API_KEY || 'sk-tinyfish-B97GHKp33GAwDhBD_krgnGaUJfaJUlQR';
  const client = new TinyFishClient({
    apiKey: liveApiKey,
    enabled: true,
  });

  it('connects to live TinySearch API and retrieves real Indian agricultural scheme records', async () => {
    const searchRes = await executeTinySearch(
      {
        query: 'PM Kisan Samman Nidhi scheme 2026',
        location: 'IN',
        language: 'en',
        bypassCache: true,
      },
      client
    );

    expect(searchRes.provenance).toBe('live_api');
    expect(searchRes.results.length).toBeGreaterThan(0);
    expect(searchRes.cached).toBe(false);

    // Verify official government classification on live data
    const hasOfficial = searchRes.results.some((r) => r.isOfficial || r.url.includes('.gov.in'));
    expect(hasOfficial).toBe(true);

    const top = searchRes.results[0];
    expect(top.title).toBeDefined();
    expect(top.url).toMatch(/^https?:\/\//);
  }, 15000);

  it('connects to live TinyFetch API and extracts clean content from pmkisan.gov.in', async () => {
    const fetchRes = await executeTinyFetch(
      {
        urls: ['https://pmkisan.gov.in'],
        format: 'markdown',
        bypassCache: true,
      },
      client
    );

    expect(fetchRes.provenance).toBe('live_api');
    expect(fetchRes.results.length).toBe(1);
    expect(fetchRes.results[0].text.length).toBeGreaterThan(50);
    expect(fetchRes.results[0].isOfficial).toBe(true);
  }, 20000);

  it('executes end-to-end domain intelligence for Mandi Prices against live web and separates MSP', async () => {
    const research = await runAgriculturalResearch(
      {
        category: 'mandi',
        query: 'Soyabean Mandi Price Maharashtra Latur',
        commodity: 'Soyabean',
        forceFresh: true,
      },
      client
    );

    expect(research.provider).toBe('tinyfish');
    expect(research.category).toBe('mandi');
    expect(research.provenance).toBe('live_api');
    expect(research.sources.length).toBeGreaterThan(0);
    expect(research.structuredData?.officialMSP).toBeDefined();
    expect(research.confidenceScore).toBeGreaterThanOrEqual(0.75);
  }, 15000);
});
