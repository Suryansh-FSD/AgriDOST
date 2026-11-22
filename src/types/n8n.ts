/**
 * AgriDOST 4.0: n8n Integration & Event-Driven Automation Contracts
 * Version 1.0.0
 */

export type N8nEventType =
  // 1. Government Assistance Events
  | 'government.application.created'
  | 'government.application.status_changed'
  | 'government.deadline.approaching'
  | 'government.reminder.triggered'

  // 2. Smart Farm Operations Events
  | 'operations.weather.check_requested'
  | 'operations.spray.window_evaluation'
  | 'operations.irrigation.advisory'

  // 3. Market Intelligence Events
  | 'market.price.check_requested'
  | 'market.harvest.recorded'
  | 'market.advisory.generated';

export type N8nProducer = 'agridost-app' | 'agridost-scheduler' | 'n8n-workflow';

export type N8nExecutionStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'timeout'
  | 'skipped';

export interface N8nEventEnvelope<T = Record<string, unknown>> {
  eventId: string;
  eventType: N8nEventType;
  timestamp: string;
  producer: N8nProducer;
  version: '1.0';
  farmerId: string;
  farmId: string;
  payload: T;
  idempotencyKey: string;
  signature?: string;
}

export interface N8nExecutionRecord {
  id: string;
  eventId: string;
  eventType: N8nEventType;
  workflowId: 'government-assistance' | 'smart-farm-operations' | 'market-intelligence';
  farmId: string;
  status: N8nExecutionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  inputSummary: string;
  outputSummary?: string;
  outputData?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  retryCount: number;
}

export interface GovernmentAssistancePayload {
  schemeId: string;
  schemeName: string;
  applicationId?: string;
  referenceNumber?: string;
  previousStatus?: string;
  currentStatus: string;
  statusSource: 'user_reported' | 'government_verified';
  deadlineDate?: string;
  reminderTitle?: string;
  reminderDueDate?: string;
  farmerName: string;
  farmerContact?: string;
  actionRequired: string;
  officialPortalUrl: string;
}

export interface SmartFarmOperationsPayload {
  operationType: 'spray' | 'irrigation' | 'fertilizer' | 'harvest';
  zoneId?: string;
  zoneName?: string;
  targetCrop?: string;
  cropVariety?: string;
  scheduledTime: string;
  weatherData: {
    temperatureC: number;
    windSpeedKmh: number;
    humidityPct: number;
    precipitationProbPct: number;
    condition: string;
    forecastTimestamp: string;
    provider: string;
  };
  thresholds: {
    maxWindSpeedKmh: number;
    maxTempC: number;
    minHumidityPct: number;
  };
  chemicalName?: string;
  dosagePerAcre?: string;
}

export interface MarketIntelligencePayload {
  commodityName: string;
  variety?: string;
  targetMandi: string;
  state: string;
  harvestYieldTonnes?: number;
  storedQuantityBags?: number;
  farmerTargetPriceInrPerQtl: number;
  currentMandiPriceInrPerQtl: number;
  minSupportPriceInrPerQtl?: number;
  trend7DaysPct?: number;
  priceObservationDate: string;
  priceDataSource: string;
}

export interface N8nWorkflowDefinition {
  id: 'government-assistance' | 'smart-farm-operations' | 'market-intelligence';
  name: string;
  description: string;
  category: 'Government' | 'Operations' | 'Market';
  supportedEvents: N8nEventType[];
  webhookPath: string;
  active: boolean;
  version: string;
  lastExecutionAt?: string;
  lastExecutionStatus?: N8nExecutionStatus;
}
