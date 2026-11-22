/**
 * AgriDOST 4.0: CIBRC Drone Spray Weather Window & Safety Evaluation Engine
 * 
 * Implements Central Insecticide Board & Registration Committee (CIBRC)
 * standard operating procedures (SOPs) and Directorate General of Civil Aviation (DGCA)
 * guidelines for agricultural drone application.
 * 
 * CRITICAL SAFETY REQUIREMENT:
 * Under NO circumstances should automated spray initiation be allowed.
 * All outputs are strictly advisory calculations requiring on-site verification
 * by a licensed Remote Pilot-in-Command (RPIC).
 */

import {
  HourlyForecastItem,
  SprayConditionStatus,
  SprayParameterAssessment,
  SpraySafetyAssessment,
  SprayWindowSlot,
} from '@/types/weather';

export interface WeatherObservationInput {
  temperature: number; // °C
  relativeHumidity: number; // %
  windSpeed: number; // km/h
  windDirection?: number; // degrees
  precipitation?: number; // mm
  precipitationProbability?: number; // %
}

/**
 * Evaluates wind speed against CIBRC thresholds:
 * - Optimal: < 10 km/h (minimum off-target chemical drift)
 * - Marginal: 10 - 14.9 km/h (manageable with anti-drift coarse nozzles)
 * - Hazardous: >= 15 km/h (violates CIBRC drone spray guidelines)
 */
export function evaluateWind(windSpeed: number): SprayParameterAssessment {
  if (windSpeed < 10) {
    return {
      value: windSpeed,
      unit: 'km/h',
      status: 'optimal',
      message: `Wind speed (${windSpeed} km/h) is optimal for ultra-low volume drone spraying. Low drift risk.`,
      cibrcThreshold: '< 10 km/h optimal, < 15 km/h required',
    };
  } else if (windSpeed < 15) {
    return {
      value: windSpeed,
      unit: 'km/h',
      status: 'marginal',
      message: `Wind speed (${windSpeed} km/h) is marginal. Maintain larger droplet size (>250 µm) and operate downwind of sensitive buffer zones.`,
      cibrcThreshold: '< 10 km/h optimal, < 15 km/h required',
    };
  } else {
    return {
      value: windSpeed,
      unit: 'km/h',
      status: 'hazardous',
      message: `Wind speed (${windSpeed} km/h) exceeds CIBRC maximum safety limit (15 km/h). Excessive chemical drift hazard.`,
      cibrcThreshold: '< 10 km/h optimal, < 15 km/h required',
    };
  }
}

/**
 * Evaluates precipitation and rain probability against CIBRC thresholds:
 * - Rainfall must be 0 mm.
 * - Rain probability:
 *   - Optimal: < 20%
 *   - Marginal: 20% - 40%
 *   - Hazardous: > 40% or precipitation > 0 mm
 */
export function evaluatePrecipitation(
  precipitation = 0,
  precipitationProbability = 0
): SprayParameterAssessment {
  if (precipitation > 0) {
    return {
      value: precipitation,
      unit: 'mm',
      status: 'hazardous',
      message: `Active precipitation (${precipitation} mm) detected. Immediate chemical wash-off and environmental contamination hazard.`,
      cibrcThreshold: '0 mm required, rain prob < 20% optimal',
    };
  }

  if (precipitationProbability < 20) {
    return {
      value: precipitationProbability,
      unit: '% prob',
      status: 'optimal',
      message: `Rain probability (${precipitationProbability}%) is minimal. Excellent chemical rainfastness window.`,
      cibrcThreshold: '0 mm required, rain prob < 20% optimal',
    };
  } else if (precipitationProbability <= 40) {
    return {
      value: precipitationProbability,
      unit: '% prob',
      status: 'marginal',
      message: `Moderate rain probability (${precipitationProbability}%). Verify systemic chemicals have at least 2-4 hours rainfast period.`,
      cibrcThreshold: '0 mm required, rain prob < 20% optimal',
    };
  } else {
    return {
      value: precipitationProbability,
      unit: '% prob',
      status: 'hazardous',
      message: `High rain probability (${precipitationProbability}%). Postpone spraying to prevent chemical washoff and soil leaching.`,
      cibrcThreshold: '0 mm required, rain prob < 20% optimal',
    };
  }
}

/**
 * Evaluates ambient temperature against CIBRC thresholds:
 * - Optimal: 18°C - 28°C
 * - Marginal: 15°C - 17.9°C OR 28.1°C - 35°C
 * - Hazardous: < 15°C OR > 35°C
 */
export function evaluateTemperature(temperature: number): SprayParameterAssessment {
  if (temperature >= 18 && temperature <= 28) {
    return {
      value: temperature,
      unit: '°C',
      status: 'optimal',
      message: `Temperature (${temperature}°C) is within optimal metabolic and droplet persistence range.`,
      cibrcThreshold: '18°C - 28°C optimal, 15°C - 35°C allowed',
    };
  } else if (
    (temperature >= 15 && temperature < 18) ||
    (temperature > 28 && temperature <= 35)
  ) {
    const isHigh = temperature > 28;
    return {
      value: temperature,
      unit: '°C',
      status: 'marginal',
      message: isHigh
        ? `Temperature (${temperature}°C) is warm. Elevates evaporation of fine droplets; spray early morning or late afternoon.`
        : `Temperature (${temperature}°C) is cool. Chemical uptake and systemic absorption may be slowed.`,
      cibrcThreshold: '18°C - 28°C optimal, 15°C - 35°C allowed',
    };
  } else {
    const isExtremeHigh = temperature > 35;
    return {
      value: temperature,
      unit: '°C',
      status: 'hazardous',
      message: isExtremeHigh
        ? `Extreme temperature (${temperature}°C > 35°C). Severe risk of droplet evaporation, thermal inversion, and crop phytotoxicity/leaf burn.`
        : `Temperature (${temperature}°C < 15°C) is below minimum safe threshold for drone chemical absorption.`,
      cibrcThreshold: '18°C - 28°C optimal, 15°C - 35°C allowed',
    };
  }
}

/**
 * Evaluates relative humidity against CIBRC thresholds:
 * - Optimal: 50% - 75%
 * - Marginal: 40% - 49.9% OR 75.1% - 80%
 * - Hazardous: < 40% OR > 80%
 */
export function evaluateHumidity(humidity: number): SprayParameterAssessment {
  if (humidity >= 50 && humidity <= 75) {
    return {
      value: humidity,
      unit: '%',
      status: 'optimal',
      message: `Relative humidity (${humidity}%) is ideal. Balances droplet drying time and canopy adhesion.`,
      cibrcThreshold: '50% - 75% optimal, 40% - 80% allowed',
    };
  } else if (
    (humidity >= 40 && humidity < 50) ||
    (humidity > 75 && humidity <= 80)
  ) {
    const isDry = humidity < 50;
    return {
      value: humidity,
      unit: '%',
      status: 'marginal',
      message: isDry
        ? `Relative humidity (${humidity}%) is somewhat low. Finer spray droplets may evaporate rapidly before hitting foliage.`
        : `Relative humidity (${humidity}%) is high. Extended drying time may cause foliar runoff if leaf surfaces are wet.`,
      cibrcThreshold: '50% - 75% optimal, 40% - 80% allowed',
    };
  } else {
    const isExtremeDry = humidity < 40;
    return {
      value: humidity,
      unit: '%',
      status: 'hazardous',
      message: isExtremeDry
        ? `Air is critically dry (${humidity}% < 40%). High droplet evaporation rate converts spray into airborne drift.`
        : `Excessive humidity (${humidity}% > 80%). Fog/dew formation impairs foliar adherence, causing pesticide runoff.`,
      cibrcThreshold: '50% - 75% optimal, 40% - 80% allowed',
    };
  }
}

/**
 * Calculates chemical drift risk index (0 - 100):
 * - 0 - 30: Low drift risk
 * - 31 - 60: Moderate drift risk
 * - 61 - 100: High to extreme drift hazard
 * 
 * Formula:
 * - Wind contribution (50% weight): windSpeed normalized to 20 km/h
 * - Temperature contribution (25% weight): heat penalty when temp > 25°C
 * - Humidity contribution (25% weight): dryness penalty when humidity < 50%
 */
export function calculateDriftIndex(
  windSpeed: number,
  temperature: number,
  relativeHumidity: number
): number {
  // Wind factor: 0 at 0 km/h, 100 at >= 20 km/h
  const windFactor = Math.min(100, Math.max(0, (windSpeed / 20) * 100));

  // Temp factor: higher evaporation above 25°C
  const tempFactor = temperature > 25
    ? Math.min(100, Math.max(0, ((temperature - 25) / 15) * 100))
    : 0;

  // Humidity factor: dryness below 55% accelerates droplet shrinking
  const humidityFactor = relativeHumidity < 55
    ? Math.min(100, Math.max(0, ((55 - relativeHumidity) / 35) * 100))
    : 0;

  const rawScore = windFactor * 0.50 + tempFactor * 0.25 + humidityFactor * 0.25;
  return Math.min(100, Math.max(0, Math.round(rawScore)));
}

/**
 * Main evaluation function:
 * Analyzes weather conditions against CIBRC drone spray standards.
 * 
 * NEVER permits autonomous operation; always mandates human RPIC verification.
 */
export function evaluateSpraySafety(input: WeatherObservationInput): SpraySafetyAssessment {
  const windEval = evaluateWind(input.windSpeed);
  const precEval = evaluatePrecipitation(input.precipitation, input.precipitationProbability);
  const tempEval = evaluateTemperature(input.temperature);
  const humidEval = evaluateHumidity(input.relativeHumidity);

  const parameterEvaluations = [windEval, precEval, tempEval, humidEval];
  const warnings: string[] = [];

  for (const item of parameterEvaluations) {
    if (item.status === 'hazardous' || item.status === 'marginal') {
      warnings.push(item.message);
    }
  }

  // Overall status resolution:
  // If ANY is hazardous -> hazardous
  // Else if ANY is marginal -> marginal
  // Else -> optimal
  let overallStatus: SprayConditionStatus = 'optimal';
  if (parameterEvaluations.some((p) => p.status === 'hazardous')) {
    overallStatus = 'hazardous';
  } else if (parameterEvaluations.some((p) => p.status === 'marginal')) {
    overallStatus = 'marginal';
  }

  const cibrGuidelinesMet = overallStatus !== 'hazardous';
  const driftIndex = calculateDriftIndex(
    input.windSpeed,
    input.temperature,
    input.relativeHumidity
  );

  const advisoryStatement =
    'SAFETY ADVISORY: Drone spray operation must NOT be triggered automatically. ' +
    'Under DGCA and CIBRC Standard Operating Procedures, the Remote Pilot-in-Command (RPIC) ' +
    'must perform physical on-site anemometer verification and boundary inspection prior to arming the aircraft.';

  const advisoryStatementHi =
    'सुरक्षा सलाह: ड्रोन छिड़काव कभी भी स्वचालित रूप से शुरू नहीं किया जाना चाहिए। ' +
    'डीजीसीए और सीआईबीआरसी एसओपी के अनुसार, लाइसेंस प्राप्त पायलट को उड़ान से पहले मौके पर ' +
    'एनीमोमीटर से हवा की गति और खेत की सीमा की पुष्टि करना अनिवार्य है।';

  return {
    status: overallStatus,
    suitability: overallStatus,
    driftIndex,
    warnings,
    cibrGuidelinesMet,
    cibrcGuidelinesMet: cibrGuidelinesMet,
    humanVerificationRequired: true,
    advisoryStatement,
    advisoryStatementHi,
    parameters: {
      wind: windEval,
      temperature: tempEval,
      humidity: humidEval,
      precipitation: precEval,
    },
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Scans hourly forecast items to identify and rank safe upcoming spray windows
 */
export function findUpcomingSprayWindows(
  hourlyItems: HourlyForecastItem[],
  maxHours = 24
): SprayWindowSlot[] {
  const targetSlice = hourlyItems.slice(0, maxHours);

  return targetSlice.map((hour) => {
    const assessment = evaluateSpraySafety({
      temperature: hour.temperature,
      relativeHumidity: hour.relativeHumidity,
      windSpeed: hour.windSpeed,
      windDirection: hour.windDirection,
      precipitation: hour.precipitation,
      precipitationProbability: hour.precipitationProbability,
    });

    let recommendation = 'Recommended window for precision drone application.';
    if (assessment.status === 'marginal') {
      recommendation = 'Marginal conditions. Operate with anti-drift nozzles and maintain safe buffer zones.';
    } else if (assessment.status === 'hazardous') {
      recommendation = 'DO NOT SPRAY. Weather conditions violate CIBRC drone safety limits.';
    }

    return {
      time: hour.time,
      status: assessment.status,
      driftIndex: assessment.driftIndex,
      windSpeed: hour.windSpeed,
      temperature: hour.temperature,
      relativeHumidity: hour.relativeHumidity,
      precipitationProbability: hour.precipitationProbability,
      warnings: assessment.warnings,
      recommendation,
    };
  });
}
