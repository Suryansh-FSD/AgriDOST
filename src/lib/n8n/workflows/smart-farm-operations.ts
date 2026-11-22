import crypto from 'crypto';
import {
  N8nEventEnvelope,
  N8nEventType,
  N8nExecutionRecord,
  N8nProducer,
  SmartFarmOperationsPayload,
} from '@/types/n8n';

/**
 * Standard Agronomic Threshold Defaults for Precision Farm Operations
 * Based on CIBRC (Central Insecticides Board & Registration Committee)
 * and DGCA Agricultural Drone SOP Guidelines.
 */
export const DEFAULT_OPERATIONS_THRESHOLDS: SmartFarmOperationsPayload['thresholds'] = {
  maxWindSpeedKmh: 15, // Max 15 km/h for drone and boom spraying to prevent chemical drift
  maxTempC: 35, // Max 35°C to avoid rapid droplet evaporation & foliar scorch
  minHumidityPct: 40, // Min 40% humidity to prevent droplet crystallization before canopy penetration
};

/**
 * Agronomic Fallback Weather Data
 * Used gracefully when weather API credentials or remote sensors are unavailable.
 */
export const DEFAULT_FALLBACK_WEATHER: SmartFarmOperationsPayload['weatherData'] = {
  temperatureC: 24,
  windSpeedKmh: 8,
  humidityPct: 60,
  precipitationProbPct: 5,
  condition: 'Clear - Safe Agronomic Fallback Mode',
  forecastTimestamp: new Date().toISOString(),
  provider: 'agridost-agronomic-fallback',
};

export type OperationSuitability = 'optimal' | 'caution' | 'unsafe';

export interface BilingualAlert {
  en: {
    title: string;
    summary: string;
    actionRecommendation: string;
    suitability: OperationSuitability;
  };
  hi: {
    title: string;
    summary: string;
    actionRecommendation: string;
    suitability: OperationSuitability;
  };
}

export interface IrrigationAdvisoryResult {
  action: 'proceed' | 'postpone' | 'schedule_early_morning_or_evening' | 'reduce_volume';
  recommendedVolumePct: number;
  waterConservationReasonEn: string;
  waterConservationReasonHi: string;
  nextRecommendedWindow: string;
}

export interface OperationsEvaluationResult {
  suitability: OperationSuitability;
  operationType: SmartFarmOperationsPayload['operationType'];
  violations: string[];
  warnings: string[];
  summaryEn: string;
  summaryHi: string;
  recommendations: string[];
  bilingualAlert: BilingualAlert;
  safetyGate: {
    autonomousExecutionBlocked: boolean;
    autonomousExecutionAllowed: false;
    advisoryOnly: true;
    requiresFarmerConfirmation: true;
    status: 'advisory_only';
    complianceNotice: string;
  };
  irrigationAdvisory?: IrrigationAdvisoryResult;
  weatherSnapshot: SmartFarmOperationsPayload['weatherData'];
}

/**
 * Normalizes event types to valid N8nEventType
 */
export function normalizeOperationsEventType(
  type: string
): N8nEventType {
  const clean = type.startsWith('operations.') ? type : `operations.${type}`;
  const validTypes: N8nEventType[] = [
    'operations.weather.check_requested',
    'operations.spray.window_evaluation',
    'operations.irrigation.advisory',
  ];

  if (validTypes.includes(clean as N8nEventType)) {
    return clean as N8nEventType;
  }

  // Default fallback for general operations
  return 'operations.spray.window_evaluation';
}

/**
 * Construct a valid N8nEventEnvelope<SmartFarmOperationsPayload>
 * Implements deterministic idempotency key format:
 * operations.${cleanType}:${farmId}:${zoneId || 'all'}:${date}
 * Handles missing weather credentials gracefully with safe agronomic fallbacks.
 */
export function createOperationsEvent(
  type: N8nEventType | 'weather.check_requested' | 'spray.window_evaluation' | 'irrigation.advisory' | string,
  farmId: string,
  operation?: Partial<SmartFarmOperationsPayload>,
  weather?: Partial<SmartFarmOperationsPayload['weatherData']> | null,
  options?: {
    farmerId?: string;
    producer?: N8nProducer;
    dateOverride?: string;
  }
): N8nEventEnvelope<SmartFarmOperationsPayload> {
  const normalizedType = normalizeOperationsEventType(type);
  const cleanType = normalizedType.replace(/^operations\./, '');

  const zoneId = operation?.zoneId || 'all';
  const scheduledTime = operation?.scheduledTime || new Date().toISOString();
  const dateStr = options?.dateOverride || scheduledTime.split('T')[0] || new Date().toISOString().split('T')[0];

  const idempotencyKey = `operations.${cleanType}:${farmId}:${zoneId}:${dateStr}`;

  // Graceful fallback for weather data
  const weatherData: SmartFarmOperationsPayload['weatherData'] = {
    temperatureC: weather?.temperatureC ?? DEFAULT_FALLBACK_WEATHER.temperatureC,
    windSpeedKmh: weather?.windSpeedKmh ?? DEFAULT_FALLBACK_WEATHER.windSpeedKmh,
    humidityPct: weather?.humidityPct ?? DEFAULT_FALLBACK_WEATHER.humidityPct,
    precipitationProbPct: weather?.precipitationProbPct ?? DEFAULT_FALLBACK_WEATHER.precipitationProbPct,
    condition: weather?.condition ?? DEFAULT_FALLBACK_WEATHER.condition,
    forecastTimestamp: weather?.forecastTimestamp ?? scheduledTime,
    provider: weather?.provider ?? DEFAULT_FALLBACK_WEATHER.provider,
  };

  const thresholds: SmartFarmOperationsPayload['thresholds'] = {
    maxWindSpeedKmh: operation?.thresholds?.maxWindSpeedKmh ?? DEFAULT_OPERATIONS_THRESHOLDS.maxWindSpeedKmh,
    maxTempC: operation?.thresholds?.maxTempC ?? DEFAULT_OPERATIONS_THRESHOLDS.maxTempC,
    minHumidityPct: operation?.thresholds?.minHumidityPct ?? DEFAULT_OPERATIONS_THRESHOLDS.minHumidityPct,
  };

  const payload: SmartFarmOperationsPayload = {
    operationType: operation?.operationType ?? (normalizedType === 'operations.irrigation.advisory' ? 'irrigation' : 'spray'),
    zoneId: operation?.zoneId,
    zoneName: operation?.zoneName ?? (operation?.zoneId ? `Zone ${operation.zoneId}` : 'All Farm Parcels'),
    targetCrop: operation?.targetCrop ?? 'General Crop',
    cropVariety: operation?.cropVariety,
    scheduledTime,
    weatherData,
    thresholds,
    chemicalName: operation?.chemicalName,
    dosagePerAcre: operation?.dosagePerAcre,
  };

  return {
    eventId: `evt_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
    eventType: normalizedType,
    timestamp: new Date().toISOString(),
    producer: options?.producer ?? 'agridost-app',
    version: '1.0',
    farmerId: options?.farmerId ?? 'demo-farmer-01',
    farmId,
    payload,
    idempotencyKey,
  };
}

/**
 * Evaluates Spray Window Feasibility
 * Checks wind speed, precipitation probability, and temperature against safety thresholds.
 * Strictly adheres to advisory-only safety gate.
 */
export function evaluateSprayFeasibility(
  payload: SmartFarmOperationsPayload
): {
  suitability: OperationSuitability;
  violations: string[];
  warnings: string[];
} {
  const violations: string[] = [];
  const warnings: string[] = [];
  const { weatherData, thresholds } = payload;

  const maxWind = thresholds.maxWindSpeedKmh ?? DEFAULT_OPERATIONS_THRESHOLDS.maxWindSpeedKmh;
  const maxTemp = thresholds.maxTempC ?? DEFAULT_OPERATIONS_THRESHOLDS.maxTempC;
  const minHumidity = thresholds.minHumidityPct ?? DEFAULT_OPERATIONS_THRESHOLDS.minHumidityPct;

  // 1. Wind Speed Evaluation (CIBRC / DGCA SOP limit: 15 km/h)
  if (weatherData.windSpeedKmh > maxWind) {
    violations.push(
      `Wind speed (${weatherData.windSpeedKmh} km/h) exceeds safe threshold (${maxWind} km/h). High chemical drift hazard to neighboring crops and non-target ecology.`
    );
  } else if (weatherData.windSpeedKmh >= 12 && weatherData.windSpeedKmh <= maxWind) {
    warnings.push(
      `Moderate wind speed (${weatherData.windSpeedKmh} km/h) approaching limit (${maxWind} km/h). Use coarse droplets or anti-drift nozzles and maintain lower flight altitude.`
    );
  } else if (weatherData.windSpeedKmh < 3) {
    warnings.push(
      `Very low wind speed (${weatherData.windSpeedKmh} km/h). Risk of microclimate thermal inversion holding chemical aerosols suspended in air.`
    );
  }

  // 2. Precipitation Probability Evaluation (Max 30%)
  if (weatherData.precipitationProbPct > 30) {
    violations.push(
      `Precipitation probability (${weatherData.precipitationProbPct}%) exceeds safe limit (30%). Rainfall will cause chemical wash-off before foliar absorption.`
    );
  } else if (weatherData.precipitationProbPct >= 20 && weatherData.precipitationProbPct <= 30) {
    warnings.push(
      `Moderate precipitation chance (${weatherData.precipitationProbPct}%). Ensure at least a 2 to 4 hour rain-fast period after application.`
    );
  }

  // 3. Temperature Evaluation (Max 35°C)
  if (weatherData.temperatureC > maxTemp) {
    violations.push(
      `Temperature (${weatherData.temperatureC}°C) exceeds safe threshold (${maxTemp}°C). Rapid droplet evaporation, crystallization, and foliar phytotoxicity risk.`
    );
  } else if (weatherData.temperatureC >= 30 && weatherData.temperatureC <= maxTemp) {
    warnings.push(
      `High ambient temperature (${weatherData.temperatureC}°C). Application recommended during early morning (6:00 AM - 9:00 AM) or late afternoon.`
    );
  }

  // 4. Humidity Evaluation
  if (weatherData.humidityPct < minHumidity) {
    warnings.push(
      `Relative humidity (${weatherData.humidityPct}%) is below minimum recommended (${minHumidity}%). Droplets may dry prematurely before canopy penetration.`
    );
  } else if (weatherData.humidityPct > 85) {
    warnings.push(
      `High relative humidity (${weatherData.humidityPct}%). Extended foliar wetness may promote secondary fungal infection.`
    );
  }

  let suitability: OperationSuitability = 'optimal';
  if (violations.length > 0) {
    suitability = 'unsafe';
  } else if (warnings.length > 0) {
    suitability = 'caution';
  }

  return { suitability, violations, warnings };
}

/**
 * Evaluates Irrigation Advisory Calculation
 * Optimizes water usage and prevents waterlogging based on precipitation and temperature.
 */
export function evaluateIrrigationAdvisory(
  payload: SmartFarmOperationsPayload
): IrrigationAdvisoryResult {
  const { weatherData } = payload;

  if (weatherData.precipitationProbPct >= 40) {
    return {
      action: 'postpone',
      recommendedVolumePct: 0,
      waterConservationReasonEn: `Heavy rain probability (${weatherData.precipitationProbPct}%). Postpone scheduled irrigation to conserve water and prevent soil waterlogging.`,
      waterConservationReasonHi: `भारी बारिश की संभावना (${weatherData.precipitationProbPct}%)। पानी बचाने और जलभराव रोकने के लिए निर्धारित सिंचाई स्थगित करें।`,
      nextRecommendedWindow: 'Postpone 24-48 hours until soil drainage check.',
    };
  }

  if (weatherData.temperatureC > 32 && weatherData.humidityPct < 50) {
    return {
      action: 'schedule_early_morning_or_evening',
      recommendedVolumePct: 100,
      waterConservationReasonEn: `High temperature (${weatherData.temperatureC}°C) and low humidity (${weatherData.humidityPct}%). Apply water strictly during early morning (5:00 - 8:00 AM) or evening (6:00 - 8:00 PM) to minimize evaporative loss.`,
      waterConservationReasonHi: `उच्च तापमान (${weatherData.temperatureC}°C) और कम आर्द्रता (${weatherData.humidityPct}%)। वाष्पीकरण रोकने के लिए केवल सुबह (5:00 - 8:00 बजे) या शाम (6:00 - 8:00 बजे) सिंचाई करें।`,
      nextRecommendedWindow: 'Early Morning (05:00 - 08:00 IST)',
    };
  }

  if (weatherData.precipitationProbPct >= 20 && weatherData.precipitationProbPct < 40) {
    return {
      action: 'reduce_volume',
      recommendedVolumePct: 60,
      waterConservationReasonEn: `Moderate rain forecast (${weatherData.precipitationProbPct}%). Reduce irrigation volume by 40% to account for expected precipitation.`,
      waterConservationReasonHi: `मध्यम बारिश का पूर्वानुमान (${weatherData.precipitationProbPct}%)। संभावित बारिश को देखते हुए सिंचाई की मात्रा 40% घटाएं।`,
      nextRecommendedWindow: 'Schedule light irrigation cycle as planned.',
    };
  }

  return {
    action: 'proceed',
    recommendedVolumePct: 100,
    waterConservationReasonEn: `Normal atmospheric conditions. Proceed with regular scheduled irrigation cycle for optimal crop root zone moisture.`,
    waterConservationReasonHi: `सामान्य मौसमी स्थिति। फसल की जड़ों में नमी बनाए रखने के लिए निर्धारित समय पर नियमित सिंचाई करें।`,
    nextRecommendedWindow: 'Optimal window active throughout the day.',
  };
}

/**
 * Generates Localized Bilingual Alerts (English & Hindi)
 */
export function buildBilingualNotification(
  operationType: SmartFarmOperationsPayload['operationType'],
  zoneName: string,
  suitability: OperationSuitability,
  violations: string[],
  warnings: string[],
  weather: SmartFarmOperationsPayload['weatherData']
): BilingualAlert {
  const isSpray = operationType === 'spray';
  const opNameEn = isSpray ? 'Drone/Boom Spraying' : operationType === 'irrigation' ? 'Irrigation' : `${operationType} Operation`;
  const opNameHi = isSpray ? 'ड्रोन/बूम छिड़काव' : operationType === 'irrigation' ? 'सिंचाई' : `${operationType} संचालन`;

  if (suitability === 'unsafe') {
    return {
      en: {
        title: `🚨 ${opNameEn} Advisory: UNSAFE Weather Conditions`,
        summary: `Conditions in ${zoneName} are UNSAFE for ${opNameEn.toLowerCase()}. Wind: ${weather.windSpeedKmh} km/h, Temp: ${weather.temperatureC}°C, Rain Prob: ${weather.precipitationProbPct}%.`,
        actionRecommendation: `DO NOT PROCEED. ${violations.join(' ')} Postpone until weather stabilizes within safe thresholds.`,
        suitability: 'unsafe',
      },
      hi: {
        title: `🚨 ${opNameHi} सलाह: मौसम असुरक्षित है`,
        summary: `${zoneName} में ${opNameHi} के लिए मौसम असुरक्षित है। हवा: ${weather.windSpeedKmh} किमी/घंटा, तापमान: ${weather.temperatureC}°C, बारिश की संभावना: ${weather.precipitationProbPct}%।`,
        actionRecommendation: `छिड़काव न करें। मौसम सुरक्षित मानकों के भीतर आने तक संचालन स्थगित करें।`,
        suitability: 'unsafe',
      },
    };
  }

  if (suitability === 'caution') {
    return {
      en: {
        title: `⚠️ ${opNameEn} Advisory: CAUTION Advised`,
        summary: `Marginal weather in ${zoneName}. Wind: ${weather.windSpeedKmh} km/h, Temp: ${weather.temperatureC}°C, Humidity: ${weather.humidityPct}%.`,
        actionRecommendation: `Proceed with caution. ${warnings.join(' ')} Monitor field conditions closely before and during operation.`,
        suitability: 'caution',
      },
      hi: {
        title: `⚠️ ${opNameHi} सलाह: सावधानी बरतें`,
        summary: `${zoneName} में मौसमी परिस्थितियां सीमांत हैं। हवा: ${weather.windSpeedKmh} किमी/घंटा, तापमान: ${weather.temperatureC}°C, आर्द्रता: ${weather.humidityPct}%।`,
        actionRecommendation: `सावधानीपूर्वक आगे बढ़ें। संचालन के दौरान खेत की स्थिति पर निरंतर नजर रखें।`,
        suitability: 'caution',
      },
    };
  }

  return {
    en: {
      title: `✅ ${opNameEn} Advisory: OPTIMAL Weather Window`,
      summary: `Weather conditions in ${zoneName} are OPTIMAL. Wind: ${weather.windSpeedKmh} km/h, Temp: ${weather.temperatureC}°C, Rain Prob: ${weather.precipitationProbPct}%.`,
      actionRecommendation: `Excellent window for precision operations. Safe to proceed with scheduled application following standard safety practices.`,
      suitability: 'optimal',
    },
    hi: {
      title: `✅ ${opNameHi} सलाह: अनुकूल मौसम विंडो`,
      summary: `${zoneName} में मौसम पूरी तरह अनुकूल है। हवा: ${weather.windSpeedKmh} किमी/घंटा, तापमान: ${weather.temperatureC}°C, बारिश की संभावना: ${weather.precipitationProbPct}%।`,
      actionRecommendation: `योजना के अनुसार संचालन शुरू करना सुरक्षित है। सुरक्षा मानकों का पालन करें।`,
      suitability: 'optimal',
    },
  };
}

/**
 * Evaluates Full Smart Farm Operations Feasibility
 */
export function evaluateOperations(
  payload: SmartFarmOperationsPayload
): OperationsEvaluationResult {
  const { suitability, violations, warnings } = evaluateSprayFeasibility(payload);
  const zoneName = payload.zoneName || (payload.zoneId ? `Zone ${payload.zoneId}` : 'Farm');

  const irrigationAdvisory =
    payload.operationType === 'irrigation' || payload.operationType === 'spray'
      ? evaluateIrrigationAdvisory(payload)
      : undefined;

  const bilingualAlert = buildBilingualNotification(
    payload.operationType,
    zoneName,
    suitability,
    violations,
    warnings,
    payload.weatherData
  );

  const recommendations: string[] = [];
  if (suitability === 'optimal') {
    recommendations.push(
      `Optimal window identified. Ensure pilot/operator verifies line-of-sight and battery reserve before takeoff.`
    );
    if (payload.chemicalName) {
      recommendations.push(
        `Calibrated dosage for ${payload.chemicalName}: ${payload.dosagePerAcre || 'Follow package label'}.`
      );
    }
  } else if (suitability === 'caution') {
    recommendations.push(...warnings);
  } else {
    recommendations.push(...violations);
    recommendations.push('Re-evaluate window at next forecast cycle.');
  }

  return {
    suitability,
    operationType: payload.operationType,
    violations,
    warnings,
    summaryEn: bilingualAlert.en.summary,
    summaryHi: bilingualAlert.hi.summary,
    recommendations,
    bilingualAlert,
    safetyGate: {
      autonomousExecutionBlocked: true,
      autonomousExecutionAllowed: false,
      advisoryOnly: true,
      requiresFarmerConfirmation: true,
      status: 'advisory_only',
      complianceNotice:
        'In strict compliance with CIBRC and DGCA safety guidelines, autonomous drone flight or chemical discharge is disabled. All evaluations serve strictly as decision support.',
    },
    irrigationAdvisory,
    weatherSnapshot: payload.weatherData,
  };
}

/**
 * Deterministic Simulated Execution Engine
 * Matches the n8n workflow behavior for offline testing and fast unit verification.
 */
export async function executeOperationsWorkflow(
  event: N8nEventEnvelope<SmartFarmOperationsPayload>
): Promise<N8nExecutionRecord> {
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  // Validate event payload
  if (!event || !event.payload) {
    const endMs = Date.now();
    return {
      id: `exec_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
      eventId: event?.eventId || 'unknown',
      eventType: event?.eventType || 'operations.spray.window_evaluation',
      workflowId: 'smart-farm-operations',
      farmId: event?.farmId || 'unknown',
      status: 'failed',
      startedAt: startTime,
      completedAt: new Date().toISOString(),
      durationMs: endMs - startMs,
      inputSummary: 'Invalid or missing smart farm operations payload',
      outputSummary: 'Execution rejected: payload missing',
      error: {
        code: 'INVALID_PAYLOAD',
        message: 'The event payload must contain valid SmartFarmOperationsPayload data.',
        retryable: false,
      },
      retryCount: 0,
    };
  }

  // Perform deterministic agronomic evaluation
  const evaluation = evaluateOperations(event.payload);

  const durationMs = Math.max(1, Date.now() - startMs);
  const completedAt = new Date().toISOString();

  const record: N8nExecutionRecord = {
    id: `exec_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
    eventId: event.eventId,
    eventType: event.eventType,
    workflowId: 'smart-farm-operations',
    farmId: event.farmId,
    status: 'success',
    startedAt: startTime,
    completedAt,
    durationMs,
    inputSummary: `${event.payload.operationType.toUpperCase()} feasibility check for farm ${event.farmId} (${event.payload.zoneName || 'All Zones'})`,
    outputSummary: `Evaluation: ${evaluation.suitability.toUpperCase()} (Wind: ${event.payload.weatherData.windSpeedKmh} km/h, Rain: ${event.payload.weatherData.precipitationProbPct}%, Temp: ${event.payload.weatherData.temperatureC}°C)`,
    outputData: {
      suitability: evaluation.suitability,
      operationType: event.payload.operationType,
      zoneId: event.payload.zoneId,
      zoneName: event.payload.zoneName,
      weatherSnapshot: evaluation.weatherSnapshot,
      violations: evaluation.violations,
      warnings: evaluation.warnings,
      recommendations: evaluation.recommendations,
      safetyGate: evaluation.safetyGate,
      bilingualAlert: evaluation.bilingualAlert,
      irrigationAdvisory: evaluation.irrigationAdvisory,
      idempotencyKey: event.idempotencyKey,
      simulationMode: true,
      evaluatedAt: completedAt,
    },
    retryCount: 0,
  };

  return record;
}
