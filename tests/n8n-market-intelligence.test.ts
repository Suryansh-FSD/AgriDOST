/**
 * tests/n8n-market-intelligence.test.ts
 * 
 * Comprehensive Unit Test Suite for AgriDOST 4.0:
 * 1. n8n Workflow JSON Export Integrity (Schedule, Webhook, Comparator, Notification, HTTP Callback)
 * 2. Deterministic Price Evaluation Rules (MSP protection, target surplus, partial liquidation, upward trend)
 * 3. Official Source Attribution (Agmarknet / e-NAM)
 * 4. Safety Guardrails (Advisory only; zero autonomous financial debits or transactions)
 * 5. Event Envelope & Idempotency Key Generation
 * 6. Simulated Workflow Execution for Offline Environments
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  evaluateMandiPrice,
  createMarketEvent,
  executeMarketWorkflow,
  MARKET_INTELLIGENCE_WORKFLOW_DEF,
  SAFETY_DISCLAIMER,
} from '@/lib/n8n/workflows/market-intelligence';
import { MarketIntelligencePayload } from '@/types';

describe('Market Intelligence n8n Workflow Export JSON Integrity', () => {
  const workflowPath = path.resolve(process.cwd(), 'workflows/market-intelligence.json');

  it('should exist and parse as valid JSON', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
    const raw = fs.readFileSync(workflowPath, 'utf8');
    const json = JSON.parse(raw);

    expect(json).toBeDefined();
    expect(json.name).toContain('Market Intelligence');
    expect(Array.isArray(json.nodes)).toBe(true);
    expect(json.connections).toBeDefined();
  });

  it('should contain a Schedule Trigger node set to Daily 8:00 AM (0 8 * * *)', () => {
    const raw = fs.readFileSync(workflowPath, 'utf8');
    const json = JSON.parse(raw);

    const scheduleNode = json.nodes.find(
      (n: any) => n.type === 'n8n-nodes-base.scheduleTrigger'
    );
    expect(scheduleNode).toBeDefined();
    expect(scheduleNode.parameters?.rule?.interval?.[0]?.expression).toBe('0 8 * * *');
  });

  it('should contain a Webhook node for path agridost-market-intelligence with POST method', () => {
    const raw = fs.readFileSync(workflowPath, 'utf8');
    const json = JSON.parse(raw);

    const webhookNode = json.nodes.find(
      (n: any) => n.type === 'n8n-nodes-base.webhook'
    );
    expect(webhookNode).toBeDefined();
    expect(webhookNode.parameters?.path).toBe('agridost-market-intelligence');
    expect(webhookNode.parameters?.httpMethod).toBe('POST');
  });

  it('should contain a Mandi Price Comparator Code node with deterministic rules', () => {
    const raw = fs.readFileSync(workflowPath, 'utf8');
    const json = JSON.parse(raw);

    const comparatorNode = json.nodes.find(
      (n: any) => n.name === 'Mandi Price Comparator'
    );
    expect(comparatorNode).toBeDefined();
    expect(comparatorNode.type).toBe('n8n-nodes-base.code');

    const code = comparatorNode.parameters?.jsCode || '';
    expect(code).toContain('SELL RECOMMENDED');
    expect(code).toContain('PARTIAL SELL (50%)');
    expect(code).toContain('MSP ALERT / HOLD');
    expect(code).toContain('HOLD (Price trending upward)');
    expect(code).toContain('safetyDisclaimer');
  });

  it('should contain a Notification Builder node producing bilingual cards', () => {
    const raw = fs.readFileSync(workflowPath, 'utf8');
    const json = JSON.parse(raw);

    const notificationNode = json.nodes.find(
      (n: any) => n.name === 'Notification Builder'
    );
    expect(notificationNode).toBeDefined();
    expect(notificationNode.type).toBe('n8n-nodes-base.code');

    const code = notificationNode.parameters?.jsCode || '';
    expect(code).toContain('notificationCard');
    expect(code).toContain('hi:');
    expect(code).toContain('en:');
  });

  it('should contain an HTTP Request node posting callbacks to /api/n8n/callback', () => {
    const raw = fs.readFileSync(workflowPath, 'utf8');
    const json = JSON.parse(raw);

    const httpNode = json.nodes.find(
      (n: any) => n.type === 'n8n-nodes-base.httpRequest'
    );
    expect(httpNode).toBeDefined();
    expect(httpNode.parameters?.url).toContain('/api/n8n/callback');
    expect(httpNode.parameters?.method).toBe('POST');
  });

  it('should have complete node connections routing triggers through comparator to callback', () => {
    const raw = fs.readFileSync(workflowPath, 'utf8');
    const json = JSON.parse(raw);
    const conn = json.connections;

    expect(conn['Schedule Trigger (Daily 8:00 AM)']).toBeDefined();
    expect(conn['Webhook: Market Intelligence Trigger']).toBeDefined();
    expect(conn['Mandi Price Comparator']).toBeDefined();
    expect(conn['Notification Builder']).toBeDefined();
  });
});

describe('Mandi Price Comparator Deterministic Rules', () => {
  const basePayload: MarketIntelligencePayload = {
    commodityName: 'Soybean',
    variety: 'Yellow JS-335',
    targetMandi: 'Latur APMC',
    state: 'Maharashtra',
    farmerTargetPriceInrPerQtl: 4800,
    currentMandiPriceInrPerQtl: 4500,
    minSupportPriceInrPerQtl: 4600,
    trend7DaysPct: -1.2,
    priceObservationDate: '2026-11-22T08:00:00.000Z',
    priceDataSource: 'Agmarknet (Govt of India)',
  };

  it('should return "SELL RECOMMENDED" when current price is >= 105% of target price', () => {
    const payload: MarketIntelligencePayload = {
      ...basePayload,
      currentMandiPriceInrPerQtl: 5100, // 5100 >= 4800 * 1.05 (5040)
      farmerTargetPriceInrPerQtl: 4800,
      minSupportPriceInrPerQtl: 4600,
    };

    const res = evaluateMandiPrice(payload);
    expect(res.action).toBe('SELL RECOMMENDED');
    expect(res.headline).toContain('Sell Recommended');
    expect(res.recommendation).toContain('exceeds your target price');
    expect(res.priceDiffFromTarget).toBe(300);
    expect(res.bilingualMessage.hi).toContain('बिक्री की सिफारिश');
  });

  it('should return "PARTIAL SELL (50%)" when current price meets target price but < 105%', () => {
    const payload: MarketIntelligencePayload = {
      ...basePayload,
      currentMandiPriceInrPerQtl: 4850, // 4850 >= 4800 but < 5040
      farmerTargetPriceInrPerQtl: 4800,
      minSupportPriceInrPerQtl: 4600,
    };

    const res = evaluateMandiPrice(payload);
    expect(res.action).toBe('PARTIAL SELL (50%)');
    expect(res.headline).toContain('Partial Sell (50%)');
    expect(res.recommendation).toContain('reached your target price');
    expect(res.bilingualMessage.hi).toContain('50%');
  });

  it('should return "MSP ALERT / HOLD" when current mandi price is below MSP', () => {
    const payload: MarketIntelligencePayload = {
      ...basePayload,
      currentMandiPriceInrPerQtl: 4200, // 4200 < 4600 MSP
      farmerTargetPriceInrPerQtl: 4800,
      minSupportPriceInrPerQtl: 4600,
    };

    const res = evaluateMandiPrice(payload);
    expect(res.action).toBe('MSP ALERT / HOLD');
    expect(res.headline).toContain('MSP Alert');
    expect(res.recommendation).toContain('below Government Minimum Support Price');
    expect(res.rationale).toContain('MSP procurement center');
    expect(res.bilingualMessage.hi).toContain('न्यूनतम समर्थन मूल्य');
  });

  it('should prioritize MSP Alert over trend when price is below MSP', () => {
    const payload: MarketIntelligencePayload = {
      ...basePayload,
      currentMandiPriceInrPerQtl: 4300, // < 4600 MSP
      minSupportPriceInrPerQtl: 4600,
      trend7DaysPct: 3.5, // Positive trend, but below MSP floor
    };

    const res = evaluateMandiPrice(payload);
    expect(res.action).toBe('MSP ALERT / HOLD');
  });

  it('should return "HOLD (Price trending upward)" when price is below target but 7-day trend > 0', () => {
    const payload: MarketIntelligencePayload = {
      ...basePayload,
      currentMandiPriceInrPerQtl: 4700, // Above MSP (4600) but below target (4800)
      farmerTargetPriceInrPerQtl: 4800,
      minSupportPriceInrPerQtl: 4600,
      trend7DaysPct: 2.8, // Positive trend
    };

    const res = evaluateMandiPrice(payload);
    expect(res.action).toBe('HOLD (Price trending upward)');
    expect(res.headline).toContain('trending upward (+2.8%');
    expect(res.bilingualMessage.hi).toContain('रुझान');
  });

  it('should return "HOLD (Market below target price)" when price is below target and trend is flat/negative', () => {
    const payload: MarketIntelligencePayload = {
      ...basePayload,
      currentMandiPriceInrPerQtl: 4700, // Above MSP (4600) but below target (4800)
      farmerTargetPriceInrPerQtl: 4800,
      minSupportPriceInrPerQtl: 4600,
      trend7DaysPct: -1.5, // Negative trend
    };

    const res = evaluateMandiPrice(payload);
    expect(res.action).toBe('HOLD (Market below target price)');
    expect(res.headline).toContain('Hold: Current price');
  });
});

describe('Official Source Attribution & Safety Guardrails', () => {
  const payload: MarketIntelligencePayload = {
    commodityName: 'Wheat',
    targetMandi: 'Khanna Grain Market',
    state: 'Punjab',
    farmerTargetPriceInrPerQtl: 2400,
    currentMandiPriceInrPerQtl: 2550,
    minSupportPriceInrPerQtl: 2275,
    trend7DaysPct: 1.5,
    priceObservationDate: '2026-11-22T07:30:00.000Z',
    priceDataSource: 'Agmarknet (Govt of India)',
  };

  it('should attach official government data source and observation date', () => {
    const res = evaluateMandiPrice(payload);
    expect(res.officialAttribution.source).toBe('Agmarknet (Govt of India)');
    expect(res.officialAttribution.observedAt).toBe('2026-11-22T07:30:00.000Z');
  });

  it('should support e-NAM as an official data source', () => {
    const enamPayload: MarketIntelligencePayload = {
      ...payload,
      priceDataSource: 'e-NAM (National Agriculture Market)',
    };
    const res = evaluateMandiPrice(enamPayload);
    expect(res.officialAttribution.source).toContain('e-NAM');
  });

  it('should strictly enforce advisory safety rule and include safety disclaimer', () => {
    const res = evaluateMandiPrice(payload);
    expect(res.safetyNotice).toBe(SAFETY_DISCLAIMER);
    expect(res.safetyNotice).toContain('AgriDOST never executes autonomous financial trades');
    expect(res.safetyNotice).toContain('Farmer retains exclusive selling authority');
  });
});

describe('Event Envelope & Simulated Workflow Execution', () => {
  const samplePayload: MarketIntelligencePayload = {
    commodityName: 'Cotton',
    targetMandi: 'Rajkot APMC',
    state: 'Gujarat',
    farmerTargetPriceInrPerQtl: 7200,
    currentMandiPriceInrPerQtl: 7600,
    minSupportPriceInrPerQtl: 7020,
    trend7DaysPct: 3.2,
    priceObservationDate: '2026-11-22T08:00:00.000Z',
    priceDataSource: 'Agmarknet (Govt of India)',
  };

  it('createMarketEvent should generate envelope with proper types and idempotencyKey', () => {
    const event = createMarketEvent(
      'market.price.check_requested',
      'demo-farm-01',
      samplePayload,
      'demo-farmer-01'
    );

    expect(event.eventId).toMatch(/^evt_mkt_/);
    expect(event.eventType).toBe('market.price.check_requested');
    expect(event.producer).toBe('agridost-app');
    expect(event.version).toBe('1.0');
    expect(event.farmId).toBe('demo-farm-01');
    expect(event.farmerId).toBe('demo-farmer-01');

    // Idempotency key format: market.${type}:${farmId}:${commodity}:${date}
    expect(event.idempotencyKey).toBe(
      'market.price.check_requested:demo-farm-01:cotton:2026-11-22'
    );
  });

  it('executeMarketWorkflow should simulate offline execution and produce valid N8nExecutionRecord', () => {
    const event = createMarketEvent(
      'market.price.check_requested',
      'demo-farm-01',
      samplePayload
    );

    const record = executeMarketWorkflow(event);

    expect(record.id).toMatch(/^exec_mkt_/);
    expect(record.eventId).toBe(event.eventId);
    expect(record.eventType).toBe(event.eventType);
    expect(record.workflowId).toBe('market-intelligence');
    expect(record.farmId).toBe('demo-farm-01');
    expect(record.status).toBe('success');
    expect(record.inputSummary).toContain('Cotton');
    expect(record.outputSummary).toContain('SELL RECOMMENDED');
    expect(record.outputSummary).toContain('Agmarknet');
    expect(record.outputData).toBeDefined();
    expect(record.outputData?.safetyVerified).toBe(true);
  });

  it('MARKET_INTELLIGENCE_WORKFLOW_DEF should have correct metadata and supported events', () => {
    expect(MARKET_INTELLIGENCE_WORKFLOW_DEF.id).toBe('market-intelligence');
    expect(MARKET_INTELLIGENCE_WORKFLOW_DEF.category).toBe('Market');
    expect(MARKET_INTELLIGENCE_WORKFLOW_DEF.webhookPath).toBe('agridost-market-intelligence');
    expect(MARKET_INTELLIGENCE_WORKFLOW_DEF.supportedEvents).toContain('market.price.check_requested');
    expect(MARKET_INTELLIGENCE_WORKFLOW_DEF.supportedEvents).toContain('market.advisory.generated');
  });

  describe('Envelope Unwrapping & Price Preservation Regression Tests', () => {
    it('should correctly unwrap n8n webhook envelope { body: { payload: ... } } and preserve actual prices', () => {
      const webhookWrappedInput = {
        headers: { host: 'localhost:5678' },
        body: {
          eventId: 'evt_test_wrap_01',
          eventType: 'market.price.check_requested',
          payload: {
            commodityName: 'Wheat',
            variety: 'Sharbati',
            targetMandi: 'Khanna Mandi',
            state: 'Punjab',
            currentMandiPriceInrPerQtl: 2600,
            farmerTargetPriceInrPerQtl: 2400,
            minSupportPriceInrPerQtl: 2275,
            trend7DaysPct: 3.2,
            priceObservationDate: '2026-11-22T08:00:00Z',
            priceDataSource: 'Agmarknet (Govt of India)'
          }
        }
      };

      const res = evaluateMandiPrice(webhookWrappedInput as any);
      expect(res.action).toBe('SELL RECOMMENDED'); // 2600 >= 2400 * 1.05 (2520)
      expect(res.commodityName).toBe('Wheat');
      expect(res.targetMandi).toBe('Khanna Mandi');
      expect(res.currentPrice).toBe(2600);
      expect(res.targetPrice).toBe(2400);
      expect(res.mspPrice).toBe(2275);
      expect(res.trend7DaysPct).toBe(3.2);
    });

    it('should correctly unwrap direct envelope { payload: ... } and preserve actual prices', () => {
      const directEnvelope = {
        eventId: 'evt_direct_01',
        eventType: 'market.price.check_requested',
        payload: {
          commodityName: 'Mustard',
          targetMandi: 'Bharatpur Mandi',
          currentMandiPriceInrPerQtl: 5450,
          farmerTargetPriceInrPerQtl: 5600,
          minSupportPriceInrPerQtl: 5050,
          trend7DaysPct: 1.5
        }
      };

      const res = evaluateMandiPrice(directEnvelope as any);
      expect(res.action).toBe('HOLD (Price trending upward)');
      expect(res.commodityName).toBe('Mustard');
      expect(res.currentPrice).toBe(5450);
      expect(res.targetPrice).toBe(5600);
      expect(res.mspPrice).toBe(5050);
    });

    it('should support flat unwrapped payloads directly', () => {
      const flatPayload = {
        commodityName: 'Gram (Chana)',
        targetMandi: 'Bhopal APMC',
        currentMandiPriceInrPerQtl: 5800,
        farmerTargetPriceInrPerQtl: 5800,
        minSupportPriceInrPerQtl: 5440,
        trend7DaysPct: 0
      };

      const res = evaluateMandiPrice(flatPayload as any);
      expect(res.action).toBe('PARTIAL SELL (50%)'); // Current == Target
      expect(res.commodityName).toBe('Gram (Chana)');
      expect(res.currentPrice).toBe(5800);
      expect(res.targetPrice).toBe(5800);
    });

    it('should support legacy / alternate field names (currentPriceModal, mandiName, targetPrice)', () => {
      const legacyPayload = {
        commodity: 'Soybean',
        mandiName: 'Indore Mandi',
        currentPriceModal: 4700,
        farmerTargetPrice: 4600,
        mspPrice: 4892,
        trend7DaysPct: 0.5
      };

      const res = evaluateMandiPrice(legacyPayload as any);
      // 4700 < 4892 (MSP) -> Rule 1 MSP Alert takes precedence
      expect(res.action).toBe('MSP ALERT / HOLD');
      expect(res.commodityName).toBe('Soybean');
      expect(res.targetMandi).toBe('Indore Mandi');
      expect(res.currentPrice).toBe(4700);
      expect(res.mspPrice).toBe(4892);
      expect(res.targetPrice).toBe(4600);
    });

    it('should return "DATA UNAVAILABLE" and not silently default to ₹0 when current price is missing or invalid', () => {
      const missingPricePayload = {
        commodityName: 'Wheat',
        targetMandi: 'Ludhiana Mandi',
        farmerTargetPriceInrPerQtl: 2500,
        minSupportPriceInrPerQtl: 2275
        // currentMandiPriceInrPerQtl is missing!
      };

      const res = evaluateMandiPrice(missingPricePayload as any);
      expect(res.action).toBe('DATA UNAVAILABLE');
      expect(res.headline).toContain('Price Unavailable');
      expect(res.recommendation).toContain('currently unavailable or missing');
      expect(res.rationale).toContain('Cannot generate deterministic sell/hold advisory');
      expect(res.bilingualMessage.hi).toContain('वर्तमान मूल्य डेटा उपलब्ध नहीं है');
    });
  });
});
