/**
 * AgriDOST 4.0: Zod Validation Schemas for n8n Integration Layer
 * Complies with docs/n8n/shared-integration-contract.md
 */

import { z } from 'zod';

// ==============================================================================
// 1. Primitive Enums & Types
// ==============================================================================

export const N8nEventTypeSchema = z.enum([
  // 1. Government Assistance Events
  'government.application.created',
  'government.application.status_changed',
  'government.deadline.approaching',
  'government.reminder.triggered',

  // 2. Smart Farm Operations Events
  'operations.weather.check_requested',
  'operations.spray.window_evaluation',
  'operations.irrigation.advisory',

  // 3. Market Intelligence Events
  'market.price.check_requested',
  'market.harvest.recorded',
  'market.advisory.generated',
]);

export const N8nProducerSchema = z.enum([
  'agridost-app',
  'agridost-scheduler',
  'n8n-workflow',
]);

export const N8nExecutionStatusSchema = z.enum([
  'pending',
  'running',
  'success',
  'failed',
  'timeout',
  'skipped',
]);

export const N8nWorkflowIdSchema = z.enum([
  'government-assistance',
  'smart-farm-operations',
  'market-intelligence',
]);

// Forbidden sensitive credential keys to enforce Zero Credential Leakage rule
const FORBIDDEN_SENSITIVE_KEYS = [
  'aadhaar',
  'password',
  'secret',
  'otp',
  'private_key',
  'privatekey',
  'bank_password',
  'pin',
  'cvv',
];

// ==============================================================================
// 2. Workflow Specific Payloads
// ==============================================================================

export const GovernmentAssistancePayloadSchema = z.object({
  schemeId: z.string().min(1, 'Scheme ID is required'),
  schemeName: z.string().min(1, 'Scheme Name is required'),
  applicationId: z.string().optional(),
  referenceNumber: z.string().optional(),
  previousStatus: z.string().optional(),
  currentStatus: z.string().min(1, 'Current status is required'),
  statusSource: z.enum(['user_reported', 'government_verified']),
  deadlineDate: z.string().optional(),
  reminderTitle: z.string().optional(),
  reminderDueDate: z.string().optional(),
  farmerName: z.string().min(1, 'Farmer Name is required'),
  farmerContact: z.string().optional(),
  actionRequired: z.string().min(1, 'Action required is mandatory'),
  officialPortalUrl: z.string().url('Must be a valid official URL'),
});

export const SmartFarmOperationsPayloadSchema = z.object({
  operationType: z.enum(['spray', 'irrigation', 'fertilizer', 'harvest']),
  zoneId: z.string().optional(),
  zoneName: z.string().optional(),
  targetCrop: z.string().optional(),
  cropVariety: z.string().optional(),
  scheduledTime: z.string().min(1, 'Scheduled time is required'),
  weatherData: z.object({
    temperatureC: z.number(),
    windSpeedKmh: z.number(),
    humidityPct: z.number().min(0).max(100),
    precipitationProbPct: z.number().min(0).max(100),
    condition: z.string(),
    forecastTimestamp: z.string(),
    provider: z.string(),
  }),
  thresholds: z.object({
    maxWindSpeedKmh: z.number(),
    maxTempC: z.number(),
    minHumidityPct: z.number().min(0).max(100),
  }),
  chemicalName: z.string().optional(),
  dosagePerAcre: z.string().optional(),
});

export const MarketIntelligencePayloadSchema = z.object({
  commodityName: z.string().min(1, 'Commodity name is required'),
  variety: z.string().optional(),
  targetMandi: z.string().min(1, 'Target Mandi is required'),
  state: z.string().min(1, 'State is required'),
  harvestYieldTonnes: z.number().nonnegative().optional(),
  storedQuantityBags: z.number().int().nonnegative().optional(),
  farmerTargetPriceInrPerQtl: z.number().positive('Farmer target price must be positive'),
  currentMandiPriceInrPerQtl: z.number().positive('Current mandi price must be positive'),
  minSupportPriceInrPerQtl: z.number().positive().optional(),
  trend7DaysPct: z.number().optional(),
  priceObservationDate: z.string().min(1, 'Price observation date is required'),
  priceDataSource: z.string().min(1, 'Price data source is required'),
});

// ==============================================================================
// 3. Shared Event Envelope Schema
// ==============================================================================

export const N8nEventEnvelopeSchema = z
  .object({
    eventId: z.string().min(1, 'eventId is required'),
    eventType: N8nEventTypeSchema,
    timestamp: z.string().min(1, 'timestamp is required'),
    producer: N8nProducerSchema,
    version: z.literal('1.0'),
    farmerId: z.string().min(1, 'farmerId is required'),
    farmId: z.string().min(1, 'farmId is required'),
    payload: z.record(z.string(), z.unknown()),
    idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
    signature: z.string().optional(),
  })
  .refine(
    (envelope) => {
      // Check for zero credential leakage
      const payloadKeys = Object.keys(envelope.payload || {});
      const hasForbiddenKey = payloadKeys.some((k) =>
        FORBIDDEN_SENSITIVE_KEYS.some((forbidden) => k.toLowerCase().includes(forbidden))
      );
      return !hasForbiddenKey;
    },
    {
      message: 'Zero Credential Leakage Violation: Payload contains forbidden sensitive keys (e.g. aadhaar, password, otp, secret).',
      path: ['payload'],
    }
  );

// ==============================================================================
// 4. Inbound Webhook Callback Schema (n8n -> AgriDOST)
// ==============================================================================

export const N8nCallbackSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  workflowId: N8nWorkflowIdSchema.optional(),
  status: z.enum(['success', 'failed', 'running']),
  outputSummary: z.string().optional(),
  outputData: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean().optional(),
    })
    .optional(),
  completedAt: z.string().optional(),
  durationMs: z.number().optional(),
});

// ==============================================================================
// 5. Execution Record Schema (AgriDOST Local Storage & Inspection)
// ==============================================================================

export const N8nExecutionRecordSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  eventType: N8nEventTypeSchema,
  workflowId: N8nWorkflowIdSchema,
  farmId: z.string().min(1),
  status: N8nExecutionStatusSchema,
  startedAt: z.string(),
  completedAt: z.string().optional(),
  durationMs: z.number().optional(),
  inputSummary: z.string(),
  outputSummary: z.string().optional(),
  outputData: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean(),
    })
    .optional(),
  retryCount: z.number().int().min(0),
});

export type GovernmentAssistancePayload = z.infer<typeof GovernmentAssistancePayloadSchema>;
export type SmartFarmOperationsPayload = z.infer<typeof SmartFarmOperationsPayloadSchema>;
export type MarketIntelligencePayload = z.infer<typeof MarketIntelligencePayloadSchema>;
export type N8nCallback = z.infer<typeof N8nCallbackSchema>;
