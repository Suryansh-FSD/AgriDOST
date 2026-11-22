/**
 * AgriDOST 4.0: Offline Agro-Climatic Weather Generator
 * 
 * Provides realistic seasonal weather simulation for Indian agro-climatic zones
 * when network or Open-Meteo upstream is unavailable.
 * Deterministic based on coordinates and current date, with explicit
 * provenance tagging (`offline_deterministic` or `simulated_fallback`).
 */

import {
  DailyForecastItem,
  FarmWeatherData,
  FarmWeatherResponse,
  HourlyForecastItem,
} from '@/types/weather';
import {
  evaluateSpraySafety,
  findUpcomingSprayWindows,
} from './spray-window';
import { getWmoWeatherDescription } from './wmo-codes';

export interface SeasonalParameters {
  baseTemp: number; // Daily mean °C
  tempDiurnalRange: number; // Day/night variance
  baseHumidity: number; // %
  baseWind: number; // km/h
  baseRainProb: number; // %
  wmoCode: number;
}

/**
 * Derives agro-climatic seasonal baselines for Indian latitudes (8°N to 35°N)
 */
export function getIndianAgroClimaticSeason(
  monthZeroIndexed: number,
  latitude = 20.0
): SeasonalParameters {
  // Indian seasons:
  // 11, 0, 1: Winter (Dec, Jan, Feb)
  // 2, 3, 4: Summer / Pre-monsoon (Mar, Apr, May)
  // 5, 6, 7, 8: Monsoon (Jun, Jul, Aug, Sep)
  // 9, 10: Post-Monsoon (Oct, Nov)

  const isNorth = latitude > 24.0;

  if (monthZeroIndexed === 11 || monthZeroIndexed === 0 || monthZeroIndexed === 1) {
    // Winter
    return {
      baseTemp: isNorth ? 16 : 22,
      tempDiurnalRange: 12,
      baseHumidity: 55,
      baseWind: 8,
      baseRainProb: 5,
      wmoCode: 1, // Mainly clear
    };
  } else if (monthZeroIndexed >= 2 && monthZeroIndexed <= 4) {
    // Summer
    return {
      baseTemp: isNorth ? 33 : 32,
      tempDiurnalRange: 14,
      baseHumidity: 38,
      baseWind: 13,
      baseRainProb: 10,
      wmoCode: 0, // Clear sky
    };
  } else if (monthZeroIndexed >= 5 && monthZeroIndexed <= 8) {
    // Monsoon
    return {
      baseTemp: 26,
      tempDiurnalRange: 6,
      baseHumidity: 82,
      baseWind: 16,
      baseRainProb: 65,
      wmoCode: 61, // Slight rain
    };
  } else {
    // Post-Monsoon (Oct, Nov)
    return {
      baseTemp: 25,
      tempDiurnalRange: 10,
      baseHumidity: 60,
      baseWind: 9,
      baseRainProb: 20,
      wmoCode: 2, // Partly cloudy
    };
  }
}

/**
 * Simple deterministic pseudo-random generator seeded by numbers
 */
function seededSine(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Generates realistic synthetic weather response for offline / disconnected operation
 */
export function generateOfflineWeather(
  latitude = 20.0,
  longitude = 73.78,
  options?: {
    provenance?: 'offline_deterministic' | 'simulated_fallback';
    date?: Date;
  }
): FarmWeatherResponse {
  const provenance = options?.provenance ?? 'offline_deterministic';
  const now = options?.date ?? new Date();
  const currentMonth = now.getMonth();
  const currentHour = now.getHours();

  const season = getIndianAgroClimaticSeason(currentMonth, latitude);

  // Diurnal temperature curve: peaks at 14:00 (2 PM), lowest at 05:00 (5 AM)
  const diurnalHourFactor = Math.sin(((currentHour - 8) / 24) * 2 * Math.PI);
  const currentTemp = Math.round((season.baseTemp + (season.tempDiurnalRange / 2) * diurnalHourFactor) * 10) / 10;

  // Humidity inversely tracks temperature
  const currentHumidity = Math.min(
    95,
    Math.max(25, Math.round(season.baseHumidity - (season.tempDiurnalRange / 2) * diurnalHourFactor * 1.5))
  );

  const windVariation = seededSine(now.getDate() * 100 + currentHour + latitude);
  const currentWind = Math.round((season.baseWind + (windVariation - 0.5) * 6) * 10) / 10;
  const windDirection = Math.round(seededSine(latitude + longitude + currentHour) * 360);

  const rainProb = Math.min(100, Math.max(0, Math.round(season.baseRainProb + (seededSine(now.getDate()) - 0.5) * 20)));
  const precipitation = rainProb > 60 ? Math.round(seededSine(currentHour) * 4 * 10) / 10 : 0;
  const weatherCode = precipitation > 0 ? (rainProb > 75 ? 63 : 61) : season.wmoCode;

  const uvIndex = currentHour >= 10 && currentHour <= 16
    ? Math.min(11, Math.round(7 + diurnalHourFactor * 4))
    : 0;

  const conditionDesc = getWmoWeatherDescription(weatherCode);

  const current: FarmWeatherData = {
    temperature: currentTemp,
    relativeHumidity: currentHumidity,
    precipitation,
    precipitationProbability: rainProb,
    windSpeed: Math.max(2, currentWind),
    windDirection,
    weatherCode,
    uvIndex,
    conditionText: conditionDesc.en,
    conditionTextHi: conditionDesc.hi,
    isDay: currentHour >= 6 && currentHour <= 18,
    time: now.toISOString(),
  };

  // Generate 24-hour hourly forecast
  const hourly: HourlyForecastItem[] = [];
  for (let i = 0; i < 24; i++) {
    const slotDate = new Date(now.getTime() + i * 3600 * 1000);
    const slotHour = slotDate.getHours();
    const slotDiurnal = Math.sin(((slotHour - 8) / 24) * 2 * Math.PI);
    const hTemp = Math.round((season.baseTemp + (season.tempDiurnalRange / 2) * slotDiurnal) * 10) / 10;
    const hHumid = Math.min(95, Math.max(25, Math.round(season.baseHumidity - (season.tempDiurnalRange / 2) * slotDiurnal * 1.5)));
    const hWind = Math.max(3, Math.round((season.baseWind + (seededSine(i + slotHour) - 0.5) * 5) * 10) / 10);
    const hRainProb = Math.min(100, Math.max(0, Math.round(season.baseRainProb + (seededSine(i) - 0.5) * 15)));
    const hRain = hRainProb > 60 ? Math.round(seededSine(i) * 3 * 10) / 10 : 0;
    const hCode = hRain > 0 ? 61 : season.wmoCode;
    const hDesc = getWmoWeatherDescription(hCode);
    const hUv = slotHour >= 10 && slotHour <= 16 ? Math.min(10, Math.round(6 + slotDiurnal * 3)) : 0;

    hourly.push({
      time: slotDate.toISOString(),
      temperature: hTemp,
      relativeHumidity: hHumid,
      precipitation: hRain,
      precipitationProbability: hRainProb,
      windSpeed: hWind,
      windDirection: Math.round(seededSine(i + slotHour) * 360),
      weatherCode: hCode,
      uvIndex: hUv,
      conditionText: hDesc.en,
    });
  }

  // Generate 7-day daily forecast
  const daily: DailyForecastItem[] = [];
  for (let d = 0; d < 7; d++) {
    const dayDate = new Date(now.getTime() + d * 86400 * 1000);
    const dateStr = dayDate.toISOString().split('T')[0];
    const daySeed = dayDate.getDate() + dayDate.getMonth() * 31;
    const maxTemp = Math.round((season.baseTemp + season.tempDiurnalRange / 2 + (seededSine(daySeed) - 0.5) * 3) * 10) / 10;
    const minTemp = Math.round((season.baseTemp - season.tempDiurnalRange / 2 + (seededSine(daySeed + 1) - 0.5) * 3) * 10) / 10;
    const maxWind = Math.round((season.baseWind + 4 + seededSine(daySeed + 2) * 5) * 10) / 10;
    const dRainProb = Math.min(100, Math.max(0, Math.round(season.baseRainProb + (seededSine(daySeed + 3) - 0.5) * 20)));
    const dRainSum = dRainProb > 50 ? Math.round(seededSine(daySeed + 4) * 12 * 10) / 10 : 0;
    const dCode = dRainSum > 5 ? 63 : dRainSum > 0 ? 61 : season.wmoCode;
    const dDesc = getWmoWeatherDescription(dCode);

    daily.push({
      date: dateStr,
      maxTemperature: maxTemp,
      minTemperature: minTemp,
      precipitationSum: dRainSum,
      precipitationProbabilityMax: dRainProb,
      maxWindSpeed: maxWind,
      weatherCode: dCode,
      uvIndexMax: 8,
      sunrise: `${dateStr}T06:15:00Z`,
      sunset: `${dateStr}T18:45:00Z`,
      conditionText: dDesc.en,
    });
  }

  // Evaluate drone spray safety on current conditions
  const sprayAssessment = evaluateSpraySafety({
    temperature: current.temperature,
    relativeHumidity: current.relativeHumidity,
    windSpeed: current.windSpeed,
    windDirection: current.windDirection,
    precipitation: current.precipitation,
    precipitationProbability: current.precipitationProbability,
  });

  const upcomingSprayWindows = findUpcomingSprayWindows(hourly, 24);

  return {
    latitude,
    longitude,
    elevation: 580,
    timezone: 'Asia/Kolkata',
    current,
    hourly,
    daily,
    sprayAssessment,
    upcomingSprayWindows,
    attribution: 'Weather data by Open-Meteo.com (CC-BY 4.0) [Agro-Climatic Offline Fallback]',
    freshness: {
      timestamp: now.toISOString(),
      ageSeconds: 0,
      isStale: false,
      source: 'offline_fallback',
      provenance,
    },
  };
}
