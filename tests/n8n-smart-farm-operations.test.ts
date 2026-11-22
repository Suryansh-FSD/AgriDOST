import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  createOperationsEvent,
  evaluateSprayFeasibility,
  evaluateIrrigationAdvisory,
  evaluateOperations,
  executeOperationsWorkflow,
  buildBilingualNotification,
  DEFAULT_FALLBACK_WEATHER,
  DEFAULT_OPERATIONS_THRESHOLDS,
} from '@/lib/n8n/workflows/smart-farm-operations';
import { SmartFarmOperationsPayload, N8nEventEnvelope } from '@/types/n8n';

describe('Smart Farm Operations & Weather Guard Automation (Agent C)', () => {
  const workflowPath = path.resolve(__dirname, '../workflows/smart-farm-operations.json');

  // =========================================================================
  // 1. n8n Workflow Export JSON Verification
  // =========================================================================
  describe('Workflow JSON Structure & Node Integrity', () => {
    it('should be valid JSON and adhere to standard n8n workflow export structure', () => {
      expect(fs.existsSync(workflowPath)).toBe(true);
      const content = fs.readFileSync(workflowPath, 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();

      const workflow = JSON.parse(content);
      expect(workflow).toHaveProperty('name', 'Smart Farm Operations & Weather Guard');
      expect(workflow).toHaveProperty('id', 'smart-farm-operations');
      expect(Array.isArray(workflow.nodes)).toBe(true);
      expect(workflow.nodes.length).toBeGreaterThanOrEqual(5);
      expect(workflow).toHaveProperty('connections');
    });

    it('should contain a Schedule Trigger node set to Daily 6:00 AM (0 6 * * *)', () => {
      const content = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
      const scheduleNode = content.nodes.find(
        (n: { type: string }) => n.type === 'n8n-nodes-base.scheduleTrigger'
      );
      expect(scheduleNode).toBeDefined();
      expect(scheduleNode.parameters?.rule?.interval?.[0]?.field).toBe('cronExpression');
      expect(scheduleNode.parameters?.rule?.interval?.[0]?.expression).toBe('0 6 * * *');
    });

    it('should contain a Webhook node for POST agridost-smart-farm-operations', () => {
      const content = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
      const webhookNode = content.nodes.find(
        (n: { type: string }) => n.type === 'n8n-nodes-base.webhook'
      );
      expect(webhookNode).toBeDefined();
      expect(webhookNode.parameters.httpMethod).toBe('POST');
      expect(webhookNode.parameters.path).toBe('agridost-smart-farm-operations');
    });

    it('should contain Weather Data Processor and Feasibility Evaluator nodes', () => {
      const content = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
      const weatherNode = content.nodes.find(
        (n: { name: string }) => n.name === 'Weather Data Processor'
      );
      const evaluatorNode = content.nodes.find(
        (n: { name: string }) => n.name === 'Spray & Irrigation Feasibility Evaluator'
      );

      expect(weatherNode).toBeDefined();
      expect(evaluatorNode).toBeDefined();
      expect(weatherNode.type).toBe('n8n-nodes-base.code');
      expect(evaluatorNode.type).toBe('n8n-nodes-base.code');

      // Evaluator code must evaluate wind, rain, temp and safety gate
      expect(evaluatorNode.parameters.jsCode).toContain('thresholds.maxWindSpeedKmh');
      expect(evaluatorNode.parameters.jsCode).toContain('precipitationProbPct > 30');
      expect(evaluatorNode.parameters.jsCode).toContain('autonomousExecutionBlocked');
      expect(evaluatorNode.parameters.jsCode).toContain('advisoryOnly');
    });

    it('should contain Notification Builder and HTTP Request Callback nodes', () => {
      const content = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
      const notificationNode = content.nodes.find(
        (n: { name: string }) => n.name === 'Notification Builder'
      );
      const httpNode = content.nodes.find(
        (n: { type: string }) => n.type === 'n8n-nodes-base.httpRequest'
      );

      expect(notificationNode).toBeDefined();
      expect(notificationNode.parameters.jsCode).toContain('bilingualAlert');
      expect(notificationNode.parameters.jsCode).toContain('alertEn');
      expect(notificationNode.parameters.jsCode).toContain('alertHi');

      expect(httpNode).toBeDefined();
      expect(httpNode.parameters.method).toBe('POST');
      expect(httpNode.parameters.url).toContain('/api/n8n/callback');
    });
  });

  // =========================================================================
  // 2. Weather Threshold Evaluation Tests
  // =========================================================================
  describe('Spray Feasibility Rules & Weather Thresholds', () => {
    const basePayload: SmartFarmOperationsPayload = {
      operationType: 'spray',
      zoneId: 'zone-north',
      zoneName: 'North Orchard',
      targetCrop: 'Cotton',
      scheduledTime: '2026-11-22T06:30:00.000Z',
      weatherData: {
        temperatureC: 24,
        windSpeedKmh: 8,
        humidityPct: 65,
        precipitationProbPct: 5,
        condition: 'Clear',
        forecastTimestamp: '2026-11-22T06:30:00.000Z',
        provider: 'mock-weather',
      },
      thresholds: {
        maxWindSpeedKmh: 15,
        maxTempC: 35,
        minHumidityPct: 40,
      },
    };

    it('should mark spray suitability as "optimal" under ideal weather conditions', () => {
      const evaluation = evaluateSprayFeasibility(basePayload);
      expect(evaluation.suitability).toBe('optimal');
      expect(evaluation.violations).toHaveLength(0);
      expect(evaluation.warnings).toHaveLength(0);
    });

    it('should mark spray as "unsafe" when wind speed exceeds 15 km/h limit', () => {
      const highWindPayload: SmartFarmOperationsPayload = {
        ...basePayload,
        weatherData: {
          ...basePayload.weatherData,
          windSpeedKmh: 18.5, // > 15 km/h
        },
      };

      const evaluation = evaluateSprayFeasibility(highWindPayload);
      expect(evaluation.suitability).toBe('unsafe');
      expect(evaluation.violations.some((v) => v.includes('Wind speed (18.5 km/h)'))).toBe(true);
      expect(evaluation.violations.some((v) => v.includes('drift'))).toBe(true);
    });

    it('should flag "caution" when wind speed is approaching threshold (12-15 km/h)', () => {
      const borderlineWindPayload: SmartFarmOperationsPayload = {
        ...basePayload,
        weatherData: {
          ...basePayload.weatherData,
          windSpeedKmh: 13.5,
        },
      };

      const evaluation = evaluateSprayFeasibility(borderlineWindPayload);
      expect(evaluation.suitability).toBe('caution');
      expect(evaluation.violations).toHaveLength(0);
      expect(evaluation.warnings.some((w) => w.includes('Moderate wind speed'))).toBe(true);
    });

    it('should mark spray as "unsafe" when rain probability exceeds 30%', () => {
      const highRainPayload: SmartFarmOperationsPayload = {
        ...basePayload,
        weatherData: {
          ...basePayload.weatherData,
          precipitationProbPct: 45, // > 30%
        },
      };

      const evaluation = evaluateSprayFeasibility(highRainPayload);
      expect(evaluation.suitability).toBe('unsafe');
      expect(evaluation.violations.some((v) => v.includes('Precipitation probability (45%)'))).toBe(true);
      expect(evaluation.violations.some((v) => v.includes('wash-off'))).toBe(true);
    });

    it('should mark spray as "unsafe" when temperature exceeds 35°C', () => {
      const highTempPayload: SmartFarmOperationsPayload = {
        ...basePayload,
        weatherData: {
          ...basePayload.weatherData,
          temperatureC: 38, // > 35°C
        },
      };

      const evaluation = evaluateSprayFeasibility(highTempPayload);
      expect(evaluation.suitability).toBe('unsafe');
      expect(evaluation.violations.some((v) => v.includes('Temperature (38°C)'))).toBe(true);
    });

    it('should flag "caution" when humidity is below minimum (< 40%)', () => {
      const lowHumidityPayload: SmartFarmOperationsPayload = {
        ...basePayload,
        weatherData: {
          ...basePayload.weatherData,
          humidityPct: 32, // < 40%
        },
      };

      const evaluation = evaluateSprayFeasibility(lowHumidityPayload);
      expect(evaluation.suitability).toBe('caution');
      expect(evaluation.warnings.some((w) => w.includes('Relative humidity (32%)'))).toBe(true);
    });
  });

  // =========================================================================
  // 3. Irrigation Advisory Calculation
  // =========================================================================
  describe('Irrigation Advisory Calculations', () => {
    const defaultIrrigationPayload: SmartFarmOperationsPayload = {
      operationType: 'irrigation',
      zoneId: 'zone-south',
      zoneName: 'South Drip Parcel',
      targetCrop: 'Wheat',
      scheduledTime: '2026-11-22T07:00:00.000Z',
      weatherData: {
        temperatureC: 22,
        windSpeedKmh: 6,
        humidityPct: 55,
        precipitationProbPct: 10,
        condition: 'Clear',
        forecastTimestamp: '2026-11-22T07:00:00.000Z',
        provider: 'mock-weather',
      },
      thresholds: DEFAULT_OPERATIONS_THRESHOLDS,
    };

    it('should recommend postponing irrigation when heavy rain (>= 40%) is forecast', () => {
      const rainyPayload: SmartFarmOperationsPayload = {
        ...defaultIrrigationPayload,
        weatherData: {
          ...defaultIrrigationPayload.weatherData,
          precipitationProbPct: 65,
        },
      };

      const advisory = evaluateIrrigationAdvisory(rainyPayload);
      expect(advisory.action).toBe('postpone');
      expect(advisory.recommendedVolumePct).toBe(0);
      expect(advisory.waterConservationReasonEn).toContain('Postpone scheduled irrigation');
      expect(advisory.waterConservationReasonHi).toContain('स्थगित करें');
    });

    it('should recommend early morning or evening irrigation during extreme heat and dry air', () => {
      const hotDryPayload: SmartFarmOperationsPayload = {
        ...defaultIrrigationPayload,
        weatherData: {
          ...defaultIrrigationPayload.weatherData,
          temperatureC: 36,
          humidityPct: 35,
          precipitationProbPct: 5,
        },
      };

      const advisory = evaluateIrrigationAdvisory(hotDryPayload);
      expect(advisory.action).toBe('schedule_early_morning_or_evening');
      expect(advisory.recommendedVolumePct).toBe(100);
      expect(advisory.waterConservationReasonEn).toContain('early morning');
      expect(advisory.waterConservationReasonHi).toContain('सुबह');
    });

    it('should recommend proceeding with normal scheduled irrigation in temperate weather', () => {
      const advisory = evaluateIrrigationAdvisory(defaultIrrigationPayload);
      expect(advisory.action).toBe('proceed');
      expect(advisory.recommendedVolumePct).toBe(100);
      expect(advisory.waterConservationReasonEn).toContain('Normal atmospheric conditions');
    });
  });

  // =========================================================================
  // 4. Mandatory Safety Gate & Bilingual Alerts
  // =========================================================================
  describe('Safety Gate Enforcement & Bilingual Alerts', () => {
    it('must enforce the safety gate: autonomousExecutionAllowed must be false and advisoryOnly must be true', () => {
      const payload: SmartFarmOperationsPayload = {
        operationType: 'spray',
        zoneId: 'zone-1',
        scheduledTime: '2026-11-22T08:00:00.000Z',
        weatherData: DEFAULT_FALLBACK_WEATHER,
        thresholds: DEFAULT_OPERATIONS_THRESHOLDS,
      };

      const evaluation = evaluateOperations(payload);
      expect(evaluation.safetyGate.autonomousExecutionAllowed).toBe(false);
      expect(evaluation.safetyGate.autonomousExecutionBlocked).toBe(true);
      expect(evaluation.safetyGate.advisoryOnly).toBe(true);
      expect(evaluation.safetyGate.requiresFarmerConfirmation).toBe(true);
      expect(evaluation.safetyGate.status).toBe('advisory_only');
      expect(evaluation.safetyGate.complianceNotice).toContain('CIBRC');
    });

    it('should generate accurate bilingual alerts for unsafe spray conditions', () => {
      const alert = buildBilingualNotification(
        'spray',
        'Zone A - Cotton Block',
        'unsafe',
        ['Wind speed (19 km/h) exceeds safe threshold (15 km/h).'],
        [],
        {
          ...DEFAULT_FALLBACK_WEATHER,
          windSpeedKmh: 19,
        }
      );

      expect(alert.en.suitability).toBe('unsafe');
      expect(alert.hi.suitability).toBe('unsafe');
      expect(alert.en.title).toContain('UNSAFE');
      expect(alert.hi.title).toContain('असुरक्षित');
      expect(alert.en.actionRecommendation).toContain('DO NOT PROCEED');
      expect(alert.hi.actionRecommendation).toContain('स्थगित करें');
    });

    it('should generate accurate bilingual alerts for optimal spray conditions', () => {
      const alert = buildBilingualNotification(
        'spray',
        'Zone B - Mustard Field',
        'optimal',
        [],
        [],
        DEFAULT_FALLBACK_WEATHER
      );

      expect(alert.en.suitability).toBe('optimal');
      expect(alert.hi.suitability).toBe('optimal');
      expect(alert.en.title).toContain('OPTIMAL');
      expect(alert.hi.title).toContain('अनुकूल');
      expect(alert.en.actionRecommendation).toContain('Safe to proceed');
      expect(alert.hi.actionRecommendation).toContain('सुरक्षित है');
    });
  });

  // =========================================================================
  // 5. Event Construction & Idempotency Key Format
  // =========================================================================
  describe('createOperationsEvent & Idempotency Key', () => {
    it('should construct a valid N8nEventEnvelope with exact idempotency key format', () => {
      const event = createOperationsEvent(
        'operations.spray.window_evaluation',
        'farm-delhi-01',
        {
          zoneId: 'zone-02',
          operationType: 'spray',
          scheduledTime: '2026-11-22T06:00:00.000Z',
        },
        null, // No weather passed -> test fallback
        { farmerId: 'farmer-ramesh' }
      );

      expect(event.eventId).toMatch(/^evt_/);
      expect(event.eventType).toBe('operations.spray.window_evaluation');
      expect(event.farmId).toBe('farm-delhi-01');
      expect(event.farmerId).toBe('farmer-ramesh');
      expect(event.producer).toBe('agridost-app');
      expect(event.version).toBe('1.0');

      // Check Idempotency key format: operations.${type}:${farmId}:${zoneId || 'all'}:${date}
      expect(event.idempotencyKey).toBe(
        'operations.spray.window_evaluation:farm-delhi-01:zone-02:2026-11-22'
      );

      // Verify graceful fallback weather data
      expect(event.payload.weatherData.provider).toBe('agridost-agronomic-fallback');
      expect(event.payload.weatherData.windSpeedKmh).toBe(DEFAULT_FALLBACK_WEATHER.windSpeedKmh);
    });

    it('should handle short event type without duplicating prefix', () => {
      const event = createOperationsEvent(
        'irrigation.advisory',
        'farm-punjab-05',
        {
          zoneId: undefined, // defaults to 'all'
          scheduledTime: '2026-11-22T10:00:00.000Z',
        }
      );

      expect(event.eventType).toBe('operations.irrigation.advisory');
      expect(event.idempotencyKey).toBe(
        'operations.irrigation.advisory:farm-punjab-05:all:2026-11-22'
      );
    });
  });

  // =========================================================================
  // 6. Simulated Workflow Execution Engine
  // =========================================================================
  describe('executeOperationsWorkflow Simulated Execution', () => {
    it('should deterministically execute operations workflow and return execution record', async () => {
      const event = createOperationsEvent(
        'operations.spray.window_evaluation',
        'demo-farm-01',
        {
          zoneId: 'zone-10',
          zoneName: 'Kinnow Orchard',
          targetCrop: 'Kinnow',
          chemicalName: 'Neem Oil 1500 PPM',
          dosagePerAcre: '500 ml in 200L water',
          scheduledTime: '2026-11-22T06:00:00.000Z',
        },
        {
          temperatureC: 22,
          windSpeedKmh: 9,
          humidityPct: 62,
          precipitationProbPct: 5,
        }
      );

      const record = await executeOperationsWorkflow(event);

      expect(record.status).toBe('success');
      expect(record.workflowId).toBe('smart-farm-operations');
      expect(record.eventId).toBe(event.eventId);
      expect(record.farmId).toBe('demo-farm-01');
      expect(record.outputData).toBeDefined();
      expect(record.outputData?.suitability).toBe('optimal');
      expect((record.outputData as Record<string, any>)?.safetyGate?.autonomousExecutionBlocked).toBe(true);
      expect((record.outputData as Record<string, any>)?.bilingualAlert?.en?.title).toContain('OPTIMAL');
      expect((record.outputData as Record<string, any>)?.bilingualAlert?.hi?.title).toContain('अनुकूल');
    });

    it('should return failed execution record for null or invalid payload', async () => {
      const invalidEvent: N8nEventEnvelope<SmartFarmOperationsPayload> = {
        eventId: 'evt_invalid',
        eventType: 'operations.spray.window_evaluation',
        timestamp: new Date().toISOString(),
        producer: 'agridost-app',
        version: '1.0',
        farmerId: 'demo',
        farmId: 'demo',
        payload: null as unknown as SmartFarmOperationsPayload,
        idempotencyKey: 'test-key',
      };

      const record = await executeOperationsWorkflow(invalidEvent);
      expect(record.status).toBe('failed');
      expect(record.error?.code).toBe('INVALID_PAYLOAD');
      expect(record.error?.retryable).toBe(false);
    });
  });
});
