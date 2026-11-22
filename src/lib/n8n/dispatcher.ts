/**
 * AgriDOST 4.0: Central Event Dispatcher for n8n Workflows
 * Handles validation, 24-hour idempotency checking, execution record lifecycle,
 * and dispatching to n8n webhooks or simulated execution fallbacks.
 */

import { N8nEventEnvelope, N8nExecutionRecord, N8nEventType } from '@/types';
import { N8nEventEnvelopeSchema } from './schemas';
import { sendN8nWebhook } from './client';
import {
  saveExecutionRecord,
  getExecutionRecords,
  getExecutionByEventId,
  getN8nConfig,
} from './storage';

/**
 * Derives the workflow category ID from an event type.
 */
export function getWorkflowIdForEvent(
  eventType: N8nEventType
): 'government-assistance' | 'smart-farm-operations' | 'market-intelligence' {
  if (eventType.startsWith('government.')) return 'government-assistance';
  if (eventType.startsWith('operations.')) return 'smart-farm-operations';
  if (eventType.startsWith('market.')) return 'market-intelligence';
  return 'government-assistance';
}

/**
 * Generates a clean human-readable summary of the trigger payload.
 */
export function generateInputSummary(event: N8nEventEnvelope): string {
  const p = (event.payload || {}) as Record<string, unknown>;

  if (event.eventType.startsWith('government.')) {
    const scheme = p.schemeName || p.schemeId || 'Government Scheme';
    const action = p.actionRequired || p.currentStatus || 'Action Required';
    return `${scheme}: ${action} for ${p.farmerName || 'Farmer'}`;
  }

  if (event.eventType.startsWith('operations.')) {
    const op = p.operationType || 'Smart Operation';
    const weather = (p.weatherData as Record<string, unknown>) || {};
    const wind = weather.windSpeedKmh ? `${weather.windSpeedKmh} km/h wind` : '';
    const temp = weather.temperatureC ? `${weather.temperatureC}°C` : '';
    const conditions = [wind, temp].filter(Boolean).join(', ');
    return `${String(op).toUpperCase()}: Weather evaluation (${conditions || 'Current Forecast'})`;
  }

  if (event.eventType.startsWith('market.')) {
    const crop = p.commodityName || 'Commodity';
    const mandi = p.targetMandi || 'Mandi';
    const price = p.currentMandiPriceInrPerQtl ? `₹${p.currentMandiPriceInrPerQtl}/qtl` : '';
    return `${crop} Price Check at ${mandi} (${price || 'Market Rate'})`;
  }

  return `Triggered ${event.eventType} on ${event.farmId}`;
}

/**
 * Generates a human-readable summary of the execution outcome.
 */
export function generateOutputSummary(
  eventType: N8nEventType,
  outputData?: Record<string, unknown>
): string {
  if (!outputData) return 'Workflow execution completed.';

  if (eventType.startsWith('government.')) {
    return (
      (outputData.advisoryMessage as string) ||
      `Dispatched automated notification via ${(outputData.channels as string[])?.join(' & ') || 'SMS/In-App'}.`
    );
  }

  if (eventType.startsWith('operations.')) {
    return (
      (outputData.advisory as string) ||
      (outputData.safetyWindow as string) ||
      `Safety evaluation: ${outputData.droneFlightClearance || outputData.clearance || 'Completed'}.`
    );
  }

  if (eventType.startsWith('market.')) {
    return (
      (outputData.rationale as string) ||
      `Advisory: ${outputData.recommendation || 'Evaluated'} for ${outputData.commodity || 'crop'}.`
    );
  }

  return 'Workflow executed successfully.';
}

/**
 * Checks for a previously executed idempotency key within the specified window (default: 24h).
 */
export function checkIdempotency(
  idempotencyKey: string,
  maxAgeHours = 24
): N8nExecutionRecord | undefined {
  const all = getExecutionRecords();
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

  for (const record of all) {
    if (record.id === idempotencyKey || record.eventId === idempotencyKey) {
      const time = new Date(record.startedAt).getTime();
      if (time >= cutoff) {
        return record;
      }
    }
    // Also check outputData or metadata if idempotency key is stored
    if (
      record.outputData?._idempotencyKey === idempotencyKey &&
      new Date(record.startedAt).getTime() >= cutoff
    ) {
      return record;
    }
  }
  return undefined;
}

/**
 * Core event dispatcher:
 * 1. Validates envelope schema
 * 2. Enforces 24-hour idempotency protection
 * 3. Records initial execution state
 * 4. Dispatches webhook to n8n or simulated fallback
 * 5. Updates execution store and returns execution record
 */
export async function dispatchN8nEvent(
  event: N8nEventEnvelope,
  options?: {
    simulated?: boolean;
    webhookUrl?: string;
    timeoutMs?: number;
    secret?: string;
    apiKey?: string;
  }
): Promise<N8nExecutionRecord> {
  // 1. Zod Validation
  const validation = N8nEventEnvelopeSchema.safeParse(event);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((i) => i.message).join('; ');
    const failedRecord: N8nExecutionRecord = {
      id: `exec-err-${Date.now()}`,
      eventId: event.eventId || `evt-${Date.now()}`,
      eventType: event.eventType || 'government.application.created',
      workflowId: getWorkflowIdForEvent(event.eventType || 'government.application.created'),
      farmId: event.farmId || 'unknown',
      status: 'failed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      inputSummary: 'Invalid Event Payload Schema',
      outputSummary: `Validation rejected: ${errorMsg}`,
      error: {
        code: 'VALIDATION_ERROR',
        message: errorMsg,
        retryable: false,
      },
      retryCount: 0,
    };
    saveExecutionRecord(failedRecord);
    return failedRecord;
  }

  // 2. Idempotency Check (24-hour duplicate suppression)
  if (event.idempotencyKey) {
    const existing = checkIdempotency(event.idempotencyKey, 24);
    if (existing) {
      // Return skipped record without re-dispatching
      const skippedRecord: N8nExecutionRecord = {
        ...existing,
        id: `exec-skip-${Date.now()}`,
        status: 'skipped',
        outputSummary: `Idempotency match: Duplicate event suppressed (previous execution ${existing.id}).`,
      };
      saveExecutionRecord(skippedRecord);
      return skippedRecord;
    }
  }

  // Also check if exact eventId already exists
  const existingEvent = getExecutionByEventId(event.eventId);
  if (existingEvent) {
    return existingEvent;
  }

  const workflowId = getWorkflowIdForEvent(event.eventType);
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const inputSummary = generateInputSummary(event);

  // 3. Initial Execution Record (Running state)
  const initialRecord: N8nExecutionRecord = {
    id: executionId,
    eventId: event.eventId,
    eventType: event.eventType,
    workflowId,
    farmId: event.farmId,
    status: 'running',
    startedAt: new Date().toISOString(),
    inputSummary,
    retryCount: 0,
    outputData: {
      _idempotencyKey: event.idempotencyKey,
    },
  };
  saveExecutionRecord(initialRecord);

  // 4. Dispatch to n8n via webhook client
  const config = getN8nConfig();
  const simulated = options?.simulated ?? config.simulatedMode;

  const dispatchResult = await sendN8nWebhook(event, {
    webhookUrl: options?.webhookUrl,
    secret: options?.secret || config.webhookSecret,
    apiKey: options?.apiKey || config.apiKey,
    simulated,
    timeoutMs: options?.timeoutMs,
  });

  // 5. Finalize Execution Record
  const completedAt = new Date().toISOString();
  let status: N8nExecutionRecord['status'] = 'success';
  let outputSummary = '';
  let outputData = dispatchResult.data || {};

  // Preserve idempotency key in outputData
  outputData = {
    ...outputData,
    _idempotencyKey: event.idempotencyKey,
    _simulated: dispatchResult.simulated,
  };

  if (dispatchResult.success) {
    status = 'success';
    outputSummary = generateOutputSummary(event.eventType, dispatchResult.data);
  } else {
    status = dispatchResult.error?.code === 'TIMEOUT' ? 'timeout' : 'failed';
    outputSummary = dispatchResult.error?.message || 'Workflow dispatch failed.';
  }

  const finalizedRecord: N8nExecutionRecord = {
    ...initialRecord,
    status,
    completedAt,
    durationMs: dispatchResult.durationMs,
    outputSummary,
    outputData,
    error: dispatchResult.error,
    retryCount: Math.max(0, dispatchResult.attempts - 1),
  };

  saveExecutionRecord(finalizedRecord);
  return finalizedRecord;
}
